from django.utils import timezone
from rest_framework import generics
from django_filters import rest_framework as filters

from .models import NormalizedRecord
from .serializers import NormalizedRecordSerializer, RecordStatusUpdateSerializer
from audit.models import AuditLog

class NormalizedRecordFilter(filters.FilterSet):
    date_from = filters.DateFilter(field_name="activity_date", lookup_expr='gte')
    date_to = filters.DateFilter(field_name="activity_date", lookup_expr='lte')

    class Meta:
        model = NormalizedRecord
        fields = ['status', 'scope', 'source_type', 'date_from', 'date_to']

class NormalizedRecordListView(generics.ListAPIView):
    queryset = NormalizedRecord.objects.all().order_by('-created_at')
    serializer_class = NormalizedRecordSerializer
    filter_backends = (filters.DjangoFilterBackend,)
    filterset_class = NormalizedRecordFilter

from django.db import transaction
from rest_framework.response import Response
from rest_framework import status

class RecordStatusUpdateView(generics.UpdateAPIView):
    queryset = NormalizedRecord.objects.all()
    serializer_class = RecordStatusUpdateSerializer

    def perform_update(self, serializer):
        record = self.get_object()
        
        # STEP 1 - capture before (do this FIRST, before any changes)
        before_status = NormalizedRecord.objects.get(pk=record.pk).status
        
        # STEP 2 - make changes
        new_status = serializer.validated_data.get('status')
        flag_reason = serializer.validated_data.get('flag_reason', '')
        
        record.status = new_status
        record.flag_reason = flag_reason  # from request body
        record.reviewed_by = self.request.user
        record.reviewed_at = timezone.now()
        record.save()
        
        # STEP 3 - create audit log with correct values
        AuditLog.objects.create(
            normalized_record=record,
            original_record_id=record.id,
            action=new_status,  # "APPROVED" or "FLAGGED"
            actor=self.request.user,
            before_state={"status": before_status},
            after_state={"status": new_status, "flag_reason": flag_reason},
        )

class RecordDeleteView(generics.DestroyAPIView):
    queryset = NormalizedRecord.objects.all()

    def destroy(self, request, *args, **kwargs):
        record = self.get_object()
        
        if record.status in ['APPROVED', 'FLAGGED', 'LOCKED']:
            return Response(
                {"detail": "Only PENDING records can be deleted. Approved and locked records are part of the audit trail."},
                status=status.HTTP_403_FORBIDDEN
            )
            
        if record.status == 'PENDING':
            before_state = {
                "status": "PENDING",
                "description": record.description
            }
            after_state = {
                "status": "DELETED"
            }
            
            with transaction.atomic():
                raw_record = record.raw_record
                
                # Create AuditLog entry before deletion or with null normalized_record
                AuditLog.objects.create(
                    normalized_record=None,
                    original_record_id=record.id,
                    action="DELETED",
                    actor=request.user,
                    before_state=before_state,
                    after_state=after_state
                )
                
                record.delete()
                if raw_record:
                    raw_record.delete()
                    
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
