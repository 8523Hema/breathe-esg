import os
import django
from decimal import Decimal
from io import BytesIO

# Setup Django env
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'breathe_esg.settings')
django.setup()

from django.contrib.auth.models import User
from rest_framework.test import APIClient
from records.models import Tenant
from ingestion.models import DataSource

def setup_test_data():
    user = User.objects.filter(username="testuser").first()
    if not user:
        user = User.objects.create_user(username="testuser", password="testpassword")
    else:
        user.set_password("testpassword")
        user.save()
    
    tenant, _ = Tenant.objects.get_or_create(name="Test Corp", slug="test-corp")
    ds_sap, _ = DataSource.objects.get_or_create(tenant=tenant, name="SAP Primary", source_type="SAP")
    ds_util, _ = DataSource.objects.get_or_create(tenant=tenant, name="Util Primary", source_type="UTILITY")
    ds_travel, _ = DataSource.objects.get_or_create(tenant=tenant, name="Travel Primary", source_type="TRAVEL")
    
    return user, tenant, ds_sap, ds_util, ds_travel

def run_tests():
    print("Setting up test data...")
    user, tenant, ds_sap, ds_util, ds_travel = setup_test_data()

    client = APIClient(SERVER_NAME='localhost')

    print("1. Testing Authentication...")
    resp = client.post('/api/auth/login/', {"username": "testuser", "password": "testpassword"}, format='json')
    assert resp.status_code == 200, f"Login failed: {resp.content}"
    token = resp.json()['access']
    client.credentials(HTTP_AUTHORIZATION='Bearer ' + token)
    print("   [OK] Token received")

    print("2. Testing SAP Ingestion...")
    sap_csv = b"WERKS,MATNR,MENGE,MEINS,BUDAT,KOSTL\n1000,DIESEL-X,100,L,20240101,CC1"
    f = BytesIO(sap_csv)
    f.name = 'sap.csv'
    data = {'tenant_id': tenant.id, 'data_source_id': ds_sap.id, 'file': f}
    resp = client.post('/api/ingest/sap/', data=data, format='multipart')
    assert resp.status_code == 201, f"SAP ingest failed: {resp.content}"
    print(f"   [OK] SAP Ingest: {resp.json()}")

    print("3. Testing Travel Ingestion (JSON)...")
    travel_json = b'[{"trip_id": "T1", "traveler": "Alice", "segment_type": "hotel", "nights": 2, "date": "2024-02-01"}]'
    f2 = BytesIO(travel_json)
    f2.name = 'travel.json'
    data = {'tenant_id': tenant.id, 'data_source_id': ds_travel.id, 'file': f2}
    resp = client.post('/api/ingest/travel/', data=data, format='multipart')
    assert resp.status_code == 201, f"Travel ingest failed: {resp.content}"
    print(f"   [OK] Travel Ingest: {resp.json()}")

    print("4. Testing Jobs Listing...")
    resp = client.get('/api/jobs/')
    assert resp.status_code == 200
    assert len(resp.json()['results']) >= 2
    print(f"   [OK] Jobs count: {len(resp.json()['results'])}")

    print("5. Testing Records Listing with Pagination and Filters...")
    resp = client.get('/api/records/?scope=1')
    assert resp.status_code == 200
    records = resp.json()['results']
    assert len(records) >= 1
    assert records[0]['scope'] == 1
    record_id = records[0]['id']
    print(f"   [OK] Found {len(records)} Scope 1 records")

    print("6. Testing Record Status Update...")
    patch_data = {"status": "APPROVED"}
    resp = client.patch(f'/api/records/{record_id}/status/', data=patch_data, format='json')
    assert resp.status_code == 200, f"Patch failed: {resp.content}"
    assert resp.json()['status'] == "APPROVED"
    print("   [OK] Status updated to APPROVED")

    print("7. Testing Audit Log...")
    resp = client.get('/api/audit/')
    assert resp.status_code == 200
    audits = resp.json()['results']
    assert len(audits) >= 1
    assert audits[0]['action'] == 'APPROVED'
    assert audits[0]['normalized_record'] == record_id
    print("   [OK] Audit log verified")

    print("All API tests passed successfully!")

if __name__ == '__main__':
    run_tests()
