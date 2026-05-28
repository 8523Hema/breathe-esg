from django.urls import path
from .views import NormalizedRecordListView, RecordStatusUpdateView, RecordDeleteView

urlpatterns = [
    path('records/', NormalizedRecordListView.as_view(), name='record-list'),
    path('records/<int:pk>/status/', RecordStatusUpdateView.as_view(), name='record-status-update'),
    path('records/<int:pk>/', RecordDeleteView.as_view(), name='record-delete'),
]
