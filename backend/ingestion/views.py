from django.db import transaction
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.permissions import IsAuthenticated

from .models import IngestionJob, RawRecord, DataSource
from .serializers import IngestionJobSerializer
from records.models import NormalizedRecord, Tenant

from .parsers.sap_parser import parse_sap_csv
from .parsers.utility_parser import parse_utility_csv
from .parsers.travel_parser import parse_travel_json

class JobListView(generics.ListAPIView):
    serializer_class = IngestionJobSerializer

    def get_queryset(self):
        qs = IngestionJob.objects.select_related('data_source').order_by('-started_at')
        source_type = self.request.query_params.get('source_type')
        if source_type:
            qs = qs.filter(data_source__source_type=source_type.upper())
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                qs = qs[:int(limit)]
            except (ValueError, TypeError):
                pass
        return qs


class BaseIngestView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    
    # Subclasses must override these
    parser_function = None
    source_type = None  # 'SAP', 'UTILITY', or 'TRAVEL'

    def _resolve_tenant_and_datasource(self, tenant_id, data_source_id):
        """
        If tenant_id and data_source_id are provided, validate and return them.
        Otherwise auto-resolve: find-or-create the default tenant and a matching
        DataSource for this endpoint's source_type.
        """
        if tenant_id and data_source_id:
            try:
                tenant_id = int(tenant_id)
                data_source_id = int(data_source_id)
                ds = DataSource.objects.get(id=data_source_id, tenant_id=tenant_id)
                return tenant_id, data_source_id, ds, None
            except (ValueError, TypeError, DataSource.DoesNotExist):
                return None, None, None, "Invalid tenant_id or data_source_id, or DataSource does not belong to Tenant."

        # Auto-resolve: use / create a Default Tenant + matching DataSource
        tenant, _ = Tenant.objects.get_or_create(
            slug="default",
            defaults={"name": "Default Tenant"},
        )
        ds, _ = DataSource.objects.get_or_create(
            tenant=tenant,
            source_type=self.source_type,
            defaults={"name": f"{self.source_type} Default"},
        )
        return tenant.id, ds.id, ds, None

    def post(self, request, *args, **kwargs):
        if not self.parser_function:
            return Response({"error": "Parser function not configured."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "No file uploaded. Expected 'file' parameter in multipart form."}, status=status.HTTP_400_BAD_REQUEST)

        tenant_id, data_source_id, ds, err = self._resolve_tenant_and_datasource(
            request.data.get('tenant_id'),
            request.data.get('data_source_id'),
        )
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)

        # Create IngestionJob
        job = IngestionJob.objects.create(
            data_source=ds,
            status='RUNNING',
            raw_file=file_obj,
            created_by=request.user
        )

        try:
            # Re-read file content into memory for parsing
            file_obj.seek(0)
            file_content = file_obj.read()
            
            # Execute parsing
            results = self.parser_function(file_content, data_source_id=data_source_id, tenant_id=tenant_id)
            
            total = len(results)
            flagged_count = sum(1 for r in results if r["flagged"])
            failed_count = 0

            with transaction.atomic():
                if RawRecord.objects.filter(ingestion_job=job).exists():
                    results = []
                    total = 0
                    flagged_count = 0
                else:
                    for res in results:
                        try:
                            # Create RawRecord
                            raw_rec = RawRecord.objects.create(
                                ingestion_job=job,
                                row_number=res["row_number"],
                                raw_data=res["raw_data"],
                                parse_status='OK'
                            )
                            
                            # Create NormalizedRecord
                            NormalizedRecord.objects.create(
                                raw_record=raw_rec,
                                tenant_id=tenant_id,
                                data_source_id=data_source_id,
                                source_type=res["normalized"]["source_type"],
                                scope=res["normalized"]["scope"],
                                activity_date=res["normalized"].get("activity_date"),
                                description=res["normalized"]["description"],
                                quantity=res["normalized"]["quantity"],
                                unit=res["normalized"]["unit"],
                                quantity_kg_co2e=res["normalized"]["quantity_kg_co2e"],
                                status=res["normalized"]["status"],
                                flag_reason=res["normalized"]["flag_reason"]
                            )
                        except Exception:
                            failed_count += 1

            # Persist counts on the job row
            job.status = 'DONE'
            job.finished_at = timezone.now()
            job.total_parsed = total
            job.total_flagged = flagged_count
            job.total_failed = failed_count
            job.save()

            return Response({
                "job_id": job.id,
                "status": "DONE",
                "total_parsed": total,
                "total_flagged": flagged_count,
                "total_failed": failed_count,
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            # Handle parsing or DB errors
            job.status = 'FAILED'
            job.error_message = str(e)
            job.finished_at = timezone.now()
            job.save()
            return Response({
                "job_id": job.id,
                "status": "FAILED",
                "error": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class SAPIngestView(BaseIngestView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_function = staticmethod(parse_sap_csv)
    source_type = 'SAP'

class UtilityIngestView(BaseIngestView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_function = staticmethod(parse_utility_csv)
    source_type = 'UTILITY'

class TravelIngestView(BaseIngestView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_function = staticmethod(parse_travel_json)
    source_type = 'TRAVEL'
