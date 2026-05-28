from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from records.models import Tenant, NormalizedRecord
from ingestion.models import DataSource, IngestionJob, RawRecord
from ingestion.parsers.sap_parser import parse_sap_csv
from ingestion.parsers.utility_parser import parse_utility_csv
from ingestion.parsers.travel_parser import parse_travel_json
import os
import json

class Command(BaseCommand):
    help = "Loads full realistic sample data from fixtures into Acme Corp tenant"
    def handle(self, *args, **options):
        from records.models import NormalizedRecord
        if NormalizedRecord.objects.exists():
            print("Data exists, skipping.")
            return

        User = get_user_model()
        
        with transaction.atomic():
            # 1. Create test tenant "Acme Corp"
            tenant, _ = Tenant.objects.get_or_create(
                slug="acme-corp",
                defaults={"name": "Acme Corp"}
            )
            self.stdout.write(f"Tenant '{tenant.name}' ready.")

            # 2. Create test user analyst / analyst123
            user, created = User.objects.get_or_create(
                username="analyst",
                defaults={"email": "analyst@acme.com", "is_staff": True}
            )
            if created:
                user.set_password("analyst123")
                user.save()
            self.stdout.write(f"User 'analyst' ready.")

            # 3. Create DataSources
            sap_ds, _ = DataSource.objects.get_or_create(
                tenant=tenant,
                source_type="SAP",
                defaults={"name": "SAP Production"}
            )
            utility_ds, _ = DataSource.objects.get_or_create(
                tenant=tenant,
                source_type="UTILITY",
                defaults={"name": "Main Office Utility"}
            )
            travel_ds, _ = DataSource.objects.get_or_create(
                tenant=tenant,
                source_type="TRAVEL",
                defaults={"name": "Corporate Travel Desk"}
            )
            self.stdout.write("Data sources created/resolved.")

            # Resolve paths
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            fixtures_dir = os.path.join(base_dir, "fixtures")

            # 4. SAP Ingestion
            sap_csv_path = os.path.join(fixtures_dir, "sap_sample.csv")
            if os.path.exists(sap_csv_path):
                with open(sap_csv_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                job = IngestionJob.objects.create(
                    data_source=sap_ds,
                    status="RUNNING",
                    created_by=user
                )
                results = parse_sap_csv(content, data_source_id=sap_ds.id, tenant_id=tenant.id)
                for res in results:
                    raw_rec = RawRecord.objects.create(
                        ingestion_job=job,
                        row_number=res["row_number"],
                        raw_data=res["raw_data"],
                        parse_status="OK"
                    )
                    NormalizedRecord.objects.create(
                        raw_record=raw_rec,
                        tenant=tenant,
                        data_source=sap_ds,
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
                job.status = "DONE"
                job.finished_at = timezone.now()
                job.save()
                self.stdout.write(f"SAP sample records ingested ({len(results)} rows).")

            # 5. Utility Ingestion
            utility_csv_path = os.path.join(fixtures_dir, "utility_sample.csv")
            if os.path.exists(utility_csv_path):
                with open(utility_csv_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                job = IngestionJob.objects.create(
                    data_source=utility_ds,
                    status="RUNNING",
                    created_by=user
                )
                results = parse_utility_csv(content, data_source_id=utility_ds.id, tenant_id=tenant.id)
                for res in results:
                    raw_rec = RawRecord.objects.create(
                        ingestion_job=job,
                        row_number=res["row_number"],
                        raw_data=res["raw_data"],
                        parse_status="OK"
                    )
                    NormalizedRecord.objects.create(
                        raw_record=raw_rec,
                        tenant=tenant,
                        data_source=utility_ds,
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
                job.status = "DONE"
                job.finished_at = timezone.now()
                job.save()
                self.stdout.write(f"Utility sample records ingested ({len(results)} rows).")

            # 6. Travel Ingestion
            travel_json_path = os.path.join(fixtures_dir, "travel_sample.json")
            if os.path.exists(travel_json_path):
                with open(travel_json_path, "r", encoding="utf-8") as f:
                    content = f.read()
                
                job = IngestionJob.objects.create(
                    data_source=travel_ds,
                    status="RUNNING",
                    created_by=user
                )
                # Decode JSON payload to pass to travel parser
                payload = json.loads(content)
                results = parse_travel_json(payload, data_source_id=travel_ds.id, tenant_id=tenant.id)
                for res in results:
                    raw_rec = RawRecord.objects.create(
                        ingestion_job=job,
                        row_number=res["row_number"],
                        raw_data=res["raw_data"],
                        parse_status="OK"
                    )
                    NormalizedRecord.objects.create(
                        raw_record=raw_rec,
                        tenant=tenant,
                        data_source=travel_ds,
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
                job.status = "DONE"
                job.finished_at = timezone.now()
                job.save()
                self.stdout.write(f"Travel sample records ingested ({len(results)} rows).")

        self.stdout.write(self.style.SUCCESS("Successfully loaded realistic ESG datasets into Acme Corp!"))
