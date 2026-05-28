"""
WSGI config for breathe_esg project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'breathe_esg.settings')

application = get_wsgi_application()

# Safe temporary demo user creation and password reset on Gunicorn startup
try:
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    # Create or update admin / admin123 (superuser)
    if not User.objects.filter(username="admin").exists():
        User.objects.create_superuser("admin", "admin@acme.com", "admin123")
        print("WSGI: Successfully created demo superuser: admin")
    else:
        admin_user = User.objects.get(username="admin")
        admin_user.set_password("admin123")
        admin_user.is_superuser = True
        admin_user.is_staff = True
        admin_user.save()
        print("WSGI: Reset demo superuser password to admin123")
    
    # Create or update analyst / analyst123 (normal user)
    if not User.objects.filter(username="analyst").exists():
        User.objects.create_user(
            username="analyst",
            email="analyst@acme.com",
            password="analyst123",
            is_staff=True
        )
        print("WSGI: Successfully created demo analyst user: analyst")
    else:
        analyst_user = User.objects.get(username="analyst")
        analyst_user.set_password("analyst123")
        analyst_user.is_staff = True
        analyst_user.save()
        print("WSGI: Reset demo analyst password to analyst123")
except Exception as e:
    print(f"WSGI: Error creating/resetting demo users: {e}")
