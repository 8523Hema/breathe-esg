from django.apps import AppConfig
from django.db.models.signals import post_migrate


def create_demo_users():
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        # Create or update admin / admin123 (superuser)
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser("admin", "admin@acme.com", "admin123")
            print("RecordsConfig: Successfully created demo superuser: admin")
        else:
            admin_user = User.objects.get(username="admin")
            admin_user.set_password("admin123")
            admin_user.is_superuser = True
            admin_user.is_staff = True
            admin_user.save()
            print("RecordsConfig: Reset demo superuser password to admin123")
        
        # Create or update analyst / analyst123 (normal user)
        if not User.objects.filter(username="analyst").exists():
            User.objects.create_user(
                username="analyst",
                email="analyst@acme.com",
                password="analyst123",
                is_staff=True
            )
            print("RecordsConfig: Successfully created demo analyst user: analyst")
        else:
            analyst_user = User.objects.get(username="analyst")
            analyst_user.set_password("analyst123")
            analyst_user.is_staff = True
            analyst_user.save()
            print("RecordsConfig: Reset demo analyst password to analyst123")
    except Exception as e:
        print(f"RecordsConfig: Error during demo user creation: {e}")


def load_initial_data(sender, **kwargs):
    from records.models import NormalizedRecord
    from django.core.management import call_command
    try:
        # Run demo user creation first to ensure they exist post-migration
        create_demo_users()
    except Exception:
        pass

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
        # 1. Connect to post_migrate so it runs after migrate in the release phase
        post_migrate.connect(load_initial_data)
        
        # 2. Also try running immediately on app load (e.g. Gunicorn server boot)
        # in case migrations were already run previously.
        try:
            create_demo_users()
        except Exception:
            pass
