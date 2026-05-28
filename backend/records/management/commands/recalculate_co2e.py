from django.core.management.base import BaseCommand
from records.models import NormalizedRecord
from ingestion.parsers.sap_parser import parse_sap_csv
from ingestion.parsers.utility_parser import parse_utility_csv
from ingestion.parsers.travel_parser import parse_travel_json
import csv
import io
import json

class Command(BaseCommand):
    help = "Recalculates CO2e emissions and status/flag reasons for existing non-locked NormalizedRecords using their raw data"

    def handle(self, *args, **options):
        records = NormalizedRecord.objects.select_related('raw_record').exclude(status='LOCKED')
        self.stdout.write(f"Found {records.count()} non-locked records to recalculate.")

        updated_count = 0
        for record in records:
            raw_record = record.raw_record
            raw_data = raw_record.raw_data
            source_type = record.source_type
            data_source_id = record.data_source_id
            tenant_id = record.tenant_id

            new_val = None
            if source_type == 'SAP':
                # Convert raw_data dict to CSV string format
                out = io.StringIO()
                writer = csv.DictWriter(out, fieldnames=list(raw_data.keys()))
                writer.writeheader()
                writer.writerow(raw_data)
                csv_content = out.getvalue()
                
                results = parse_sap_csv(csv_content, data_source_id, tenant_id)
                if results:
                    new_val = results[0]['normalized']
            elif source_type == 'UTILITY':
                # Convert raw_data dict to CSV string format
                out = io.StringIO()
                writer = csv.DictWriter(out, fieldnames=list(raw_data.keys()))
                writer.writeheader()
                writer.writerow(raw_data)
                csv_content = out.getvalue()

                results = parse_utility_csv(csv_content, data_source_id, tenant_id)
                if results:
                    new_val = results[0]['normalized']
            elif source_type == 'TRAVEL':
                # Parse using the JSON array parser
                # travel_parser has parse_travel_json(items, data_source_id, tenant_id) or similar
                # Let's check travel_parser functions
                payload = [raw_data]
                results = parse_travel_json(payload, data_source_id, tenant_id)
                if results:
                    new_val = results[0]['normalized']

            if new_val:
                record.quantity_kg_co2e = new_val['quantity_kg_co2e']
                # Recalculate status and flag reason if status was PENDING or FLAGGED
                if record.status in ('PENDING', 'FLAGGED'):
                    record.status = new_val['status']
                    record.flag_reason = new_val['flag_reason']
                
                # Also update quantity and unit just in case normalisation changed
                record.quantity = new_val['quantity']
                record.unit = new_val['unit']
                record.description = new_val['description']
                record.activity_date = new_val['activity_date']
                
                record.save()
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully recalculated and updated {updated_count} records."))
