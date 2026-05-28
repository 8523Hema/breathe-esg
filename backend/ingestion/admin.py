from django.contrib import admin
from .models import DataSource, IngestionJob, RawRecord

@admin.register(DataSource)
class DataSourceAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'source_type', 'tenant')
    list_filter = ('source_type', 'tenant')
    search_fields = ('name',)

@admin.register(IngestionJob)
class IngestionJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'data_source', 'status', 'started_at', 'finished_at', 'created_by')
    list_filter = ('status', 'data_source__source_type', 'data_source__tenant')
    search_fields = ('error_message',)

@admin.register(RawRecord)
class RawRecordAdmin(admin.ModelAdmin):
    list_display = ('id', 'ingestion_job', 'row_number', 'parse_status')
    list_filter = ('parse_status', 'ingestion_job__status')
    search_fields = ('parse_error',)
