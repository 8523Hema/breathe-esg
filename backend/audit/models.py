from django.db import models
from django.conf import settings

class AuditLog(models.Model):
    ACTION_CHOICES = [
        ('APPROVED', 'Approved'),
        ('FLAGGED', 'Flagged'),
        ('EDITED', 'Edited'),
        ('LOCKED', 'Locked'),
        ('DELETED', 'Deleted'),
    ]

    normalized_record = models.ForeignKey(
        'records.NormalizedRecord',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs'
    )
    original_record_id = models.IntegerField(null=True, blank=True)
    action = models.CharField(
        max_length=20,
        choices=ACTION_CHOICES
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='audit_logs'
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    before_state = models.JSONField()
    after_state = models.JSONField()

    def __str__(self):
        record_id = self.normalized_record.id if self.normalized_record else self.original_record_id
        return f"AuditLog {self.id} - Record: {record_id} - Action: {self.action} by {self.actor.username}"
