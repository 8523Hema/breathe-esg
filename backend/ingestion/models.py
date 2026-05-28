from django.db import models
from django.conf import settings

class DataSource(models.Model):
    SOURCE_TYPE_CHOICES = [
        ('SAP', 'SAP'),
        ('UTILITY', 'Utility'),
        ('TRAVEL', 'Travel'),
    ]

    tenant = models.ForeignKey(
        'records.Tenant',
        on_delete=models.CASCADE,
        related_name='data_sources'
    )
    name = models.CharField(max_length=255)
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_TYPE_CHOICES
    )

    def __str__(self):
        return f"{self.name} ({self.source_type}) - {self.tenant.name}"

class IngestionJob(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('RUNNING', 'Running'),
        ('DONE', 'Done'),
        ('FAILED', 'Failed'),
    ]

    data_source = models.ForeignKey(
        DataSource,
        on_delete=models.CASCADE,
        related_name='ingestion_jobs'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    raw_file = models.FileField(
        upload_to='ingestion_jobs/',
        null=True,
        blank=True
    )
    error_message = models.TextField(null=True, blank=True)
    total_parsed = models.IntegerField(default=0)
    total_flagged = models.IntegerField(default=0)
    total_failed = models.IntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ingestion_jobs'
    )

    def __str__(self):
        return f"Job {self.id} ({self.status}) - Source: {self.data_source.name}"

class RawRecord(models.Model):
    PARSE_STATUS_CHOICES = [
        ('OK', 'OK'),
        ('FAILED', 'Failed'),
    ]

    ingestion_job = models.ForeignKey(
        IngestionJob,
        on_delete=models.CASCADE,
        related_name='raw_records'
    )
    row_number = models.PositiveIntegerField()
    raw_data = models.JSONField()
    parse_status = models.CharField(
        max_length=20,
        choices=PARSE_STATUS_CHOICES,
        default='OK'
    )
    parse_error = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ('ingestion_job', 'row_number')

    def __str__(self):
        return f"RawRecord {self.id} (Job: {self.ingestion_job.id}, Row: {self.row_number})"
