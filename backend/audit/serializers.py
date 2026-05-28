from rest_framework import serializers
from .models import AuditLog

class AuditLogSerializer(serializers.ModelSerializer):
    changed_by_username = serializers.CharField(source='actor.username', read_only=True)
    actor_username = serializers.CharField(source='actor.username', read_only=True)
    record = serializers.SerializerMethodField()
    normalized_record_id = serializers.SerializerMethodField()
    old_status = serializers.SerializerMethodField()
    new_status = serializers.SerializerMethodField()
    flag_reason = serializers.SerializerMethodField()

    before_state = serializers.SerializerMethodField()
    after_state = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = '__all__'

    def get_before_state(self, obj):
        return obj.before_state or {}

    def get_after_state(self, obj):
        return obj.after_state or {}

    def get_record(self, obj):
        if obj.normalized_record:
            return obj.normalized_record.id
        return obj.original_record_id

    def get_normalized_record_id(self, obj):
        if obj.normalized_record:
            return obj.normalized_record.id
        return obj.original_record_id

    def get_old_status(self, obj):
        if isinstance(obj.before_state, dict):
            return obj.before_state.get('status', '—')
        return '—'

    def get_new_status(self, obj):
        if isinstance(obj.after_state, dict):
            return obj.after_state.get('status', '—')
        return '—'

    def get_flag_reason(self, obj):
        if isinstance(obj.after_state, dict):
            return obj.after_state.get('flag_reason') or ''
        return ''
