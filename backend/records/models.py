from django.db import models
from django.conf import settings

class Tenant(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class NormalizedRecord(models.Model):
    SOURCE_TYPE_CHOICES = [
        ('SAP', 'SAP'),
        ('UTILITY', 'Utility'),
        ('TRAVEL', 'Travel'),
    ]

    SCOPE_CHOICES = [
        (1, 'Scope 1'),
        (2, 'Scope 2'),
        (3, 'Scope 3'),
    ]

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('FLAGGED', 'Flagged'),
        ('APPROVED', 'Approved'),
        ('LOCKED', 'Locked'),
    ]

    raw_record = models.OneToOneField(
        'ingestion.RawRecord',
        on_delete=models.PROTECT,
        related_name='normalized_record'
    )
    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        related_name='normalized_records'
    )
    data_source = models.ForeignKey(
        'ingestion.DataSource',
        on_delete=models.CASCADE,
        related_name='normalized_records'
    )
    source_type = models.CharField(
        max_length=20,
        choices=SOURCE_TYPE_CHOICES
    )
    scope = models.PositiveSmallIntegerField(
        choices=SCOPE_CHOICES
    )
    activity_date = models.DateField()
    description = models.TextField(blank=True)
    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    unit = models.CharField(max_length=50)
    quantity_kg_co2e = models.DecimalField(max_digits=18, decimal_places=4)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING'
    )
    flag_reason = models.TextField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_normalized_records'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Record {self.id} - Scope {self.scope} - {self.tenant.name}"
