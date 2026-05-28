from django.urls import path
from .views import SAPIngestView, UtilityIngestView, TravelIngestView, JobListView

urlpatterns = [
    path('ingest/sap/', SAPIngestView.as_view(), name='ingest-sap'),
    path('ingest/utility/', UtilityIngestView.as_view(), name='ingest-utility'),
    path('ingest/travel/', TravelIngestView.as_view(), name='ingest-travel'),
    path('jobs/', JobListView.as_view(), name='job-list'),
]
