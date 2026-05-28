from rest_framework import serializers
from .models import NormalizedRecord

class NormalizedRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = NormalizedRecord
        fields = '__all__'

class RecordStatusUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NormalizedRecord
        fields = ['status', 'flag_reason']

    def validate(self, data):
        new_status = data.get('status')
        current_status = self.instance.status

        if current_status == 'LOCKED':
            raise serializers.ValidationError("Cannot change status of a LOCKED record.")

        if new_status not in ['APPROVED', 'FLAGGED']:
            raise serializers.ValidationError(f"Invalid status transition to {new_status}. Allowed: APPROVED, FLAGGED.")

        # If it's currently PENDING, we can transition to APPROVED or FLAGGED
        # If it's currently FLAGGED, we can transition to APPROVED
        # If it's currently APPROVED, we can transition to FLAGGED (e.g., if a mistake was noticed)
        # However, the user specifically mentioned PENDING -> APPROVED/FLAGGED.
        # So we'll explicitly allow PENDING->APPROVED, PENDING->FLAGGED, FLAGGED->APPROVED
        allowed_transitions = {
            'PENDING': ['APPROVED', 'FLAGGED'],
            'FLAGGED': ['APPROVED'],
            'APPROVED': ['FLAGGED', 'LOCKED']  # Though LOCKED is not requested via API in the prompt, let's keep it safe.
        }

        if new_status not in allowed_transitions.get(current_status, []):
             raise serializers.ValidationError(f"Cannot transition from {current_status} to {new_status}.")

        return data
