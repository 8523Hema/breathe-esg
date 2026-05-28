from django.contrib import admin
from .models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'normalized_record', 'action', 'actor', 'timestamp')
    list_filter = ('action', 'timestamp', 'actor')
    search_fields = ('normalized_record__description',)
    readonly_fields = ('timestamp', 'before_state', 'after_state')
