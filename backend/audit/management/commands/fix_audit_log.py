from django.core.management.base import BaseCommand
from audit.models import AuditLog

class Command(BaseCommand):
    help = "Fixes existing audit log entries where before_state and after_state both contain the same status"

    def handle(self, *args, **options):
        for entry in AuditLog.objects.all():
            action = entry.action  # "APPROVED" or "FLAGGED"
            
            # Fix before_state — always was PENDING before analyst action
            entry.before_state = {"status": "PENDING"}
            
            # Fix after_state — should match the action taken
            flag_reason = ""
            if entry.normalized_record:
                flag_reason = entry.normalized_record.flag_reason or ""
            
            if action == "APPROVED":
                entry.after_state = {"status": "APPROVED", "flag_reason": ""}
            elif action == "FLAGGED":
                entry.after_state = {
                    "status": "FLAGGED", 
                    "flag_reason": flag_reason
                }
            else:
                entry.after_state = {"status": action}
            
            entry.save()
            self.stdout.write(f"Fixed entry {entry.id}: PENDING -> {action}")

        self.stdout.write(self.style.SUCCESS("Done."))
