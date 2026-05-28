from django.apps import AppConfig
from django.db.models.signals import post_migrate


def load_initial_data(sender, **kwargs):
    from records.models import NormalizedRecord
    from django.core.management import call_command
    try:
        if NormalizedRecord.objects.count() == 0:
            call_command('load_sample_data')
    except Exception:
        # Prevent failure during initial migration setup
        pass


class RecordsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'records'

    def ready(self):
        post_migrate.connect(load_initial_data)
