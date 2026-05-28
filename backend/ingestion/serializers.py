from rest_framework import serializers
from .models import IngestionJob


class IngestionJobSerializer(serializers.ModelSerializer):
    source_type = serializers.CharField(source='data_source.source_type', read_only=True)

    class Meta:
        model = IngestionJob
        fields = [
            'id', 'status', 'source_type',
            'total_parsed', 'total_flagged', 'total_failed',
            'started_at', 'finished_at', 'error_message',
        ]
