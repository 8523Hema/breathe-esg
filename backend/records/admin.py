from django.contrib import admin
from .models import Tenant, NormalizedRecord

@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'slug', 'created_at')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}

@admin.register(NormalizedRecord)
class NormalizedRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'tenant', 'data_source', 'source_type', 'scope', 'activity_date', 'quantity', 'unit', 'quantity_kg_co2e', 'status', 'reviewed_by')
    list_filter = ('status', 'scope', 'source_type', 'tenant')
    search_fields = ('description', 'unit', 'flag_reason')
    readonly_fields = ('created_at', 'updated_at')
