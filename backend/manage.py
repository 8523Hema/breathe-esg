#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'breathe_esg.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc

    # Temporary Initialization for Render Deployments
    try:
        import django
        django.setup()
        
        from django.db.models.signals import post_migrate
        
        def create_demo_users(sender, **kwargs):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                # Create or update admin / admin123 (superuser)
                if not User.objects.filter(username="admin").exists():
                    User.objects.create_superuser("admin", "admin@acme.com", "admin123")
                    print("Successfully created demo superuser: admin")
                else:
                    admin_user = User.objects.get(username="admin")
                    admin_user.set_password("admin123")
                    admin_user.is_superuser = True
                    admin_user.is_staff = True
                    admin_user.save()
                    print("Reset demo superuser password to admin123")
                
                # Create or update analyst / analyst123 (normal user)
                if not User.objects.filter(username="analyst").exists():
                    User.objects.create_user(
                        username="analyst",
                        email="analyst@acme.com",
                        password="analyst123",
                        is_staff=True
                    )
                    print("Successfully created demo analyst user: analyst")
                else:
                    analyst_user = User.objects.get(username="analyst")
                    analyst_user.set_password("analyst123")
                    analyst_user.is_staff = True
                    analyst_user.save()
                    print("Reset demo analyst password to analyst123")
            except Exception:
                pass

        # 1. Register for migration runs
        post_migrate.connect(create_demo_users)
        
        # 2. Try running immediately for server starts
        try:
            create_demo_users(None)
        except Exception:
            pass
            
    except Exception:
        pass

    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
