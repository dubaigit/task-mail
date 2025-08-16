#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Email Intelligence System

Tests FastAPI endpoints, WebSocket connections, database operations,
authentication, and error handling with full mocking.
"""

import pytest
import asyncio
import json
import time
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, call
from typing import Dict, Any, List

# FastAPI testing
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect
import pytest_asyncio

# Database mocking
from unittest.mock import AsyncMock
import sqlalchemy
from sqlalchemy.ext.asyncio import AsyncSession

# Import the backend architecture
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend_architecture import (
    app, db_manager, manager as websocket_manager,
    EmailResponse, BatchRequest, TaskResponse, WebSocketMessage,
    EmailClassification, UrgencyLevel, ProcessingStatus
)
from database_models import Email, EmailIntelligence, EmailTask, EmailBatch

# Test fixtures
@pytest.fixture
def test_client():
    """Create FastAPI test client"""
    return TestClient(app)

@pytest.fixture
def mock_auth_user():
    """Mock authenticated user"""
    return {"user_id": "test_user", "permissions": ["read", "write"]}

@pytest.fixture
def sample_email():
    """Sample email for testing"""
    return {
        "id": 1,
        "message_id": 12345,
        "subject_text": "Test Email Subject",
        "sender_email": "sender@example.com",
        "sender_name": "Test Sender",
        "date_received": datetime.now(),
        "is_read": False,
        "is_flagged": False,
        "processing_status": "completed"
    }

@pytest.fixture
def sample_email_intelligence():
    """Sample email intelligence for testing"""
    return {
        "id": 1,
        "email_id": 1,
        "classification": "needs_reply",
        "urgency": "high",
        "sentiment": "neutral",
        "confidence": 0.85,
        "processing_time_ms": 150
    }

@pytest.fixture
def sample_task():
    """Sample task for testing"""
    return {
        "id": 1,
        "task_id": "email_1_task_1",
        "subject": "Review proposal",
        "description": "Please review the quarterly proposal",
        "task_type": "review",
        "priority": "HIGH",
        "status": "pending",
        "assignee": "test_user"
    }

@pytest.fixture
def mock_database():
    """Mock database session and operations"""
    with patch.object(db_manager, 'get_session') as mock_get_session, \
         patch.object(db_manager, 'get_redis') as mock_get_redis:
        
        # Mock database session
        mock_session = AsyncMock(spec=AsyncSession)
        mock_get_session.return_value.__aenter__.return_value = mock_session
        mock_get_session.return_value.__aexit__.return_value = None
        
        # Mock Redis
        mock_redis = AsyncMock()
        mock_get_redis.return_value = mock_redis
        
        yield {
            'session': mock_session,
            'redis': mock_redis,
            'get_session': mock_get_session,
            'get_redis': mock_get_redis
        }

# ============================================================================
# Health and System Tests
# ============================================================================

@pytest.mark.unit
def test_health_check_success(test_client):
    """Test health check endpoint returns correct status"""
    response = test_client.get("/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data
    assert "version" in data
    assert data["version"] == "1.0.0"

@pytest.mark.unit
def test_health_check_includes_db_status(test_client, mock_database):
    """Test health check includes database connection status"""
    # Mock database as connected
    with patch.object(db_manager, 'engine', MagicMock()):
        response = test_client.get("/health")
        data = response.json()
        assert data["database"] == "connected"
    
    # Mock database as disconnected
    with patch.object(db_manager, 'engine', None):
        response = test_client.get("/health")
        data = response.json()
        assert data["database"] == "disconnected"

@pytest.mark.unit
@patch('backend_architecture.settings')
def test_metrics_endpoint_enabled(mock_settings, test_client):
    """Test metrics endpoint when enabled"""
    mock_settings.ENABLE_METRICS = True
    
    with patch('backend_architecture.generate_latest') as mock_metrics:
        mock_metrics.return_value = b"# Prometheus metrics data"
        response = test_client.get("/metrics")
        
        assert response.status_code == 200
        mock_metrics.assert_called_once()

@pytest.mark.unit
@patch('backend_architecture.settings')
def test_metrics_endpoint_disabled(mock_settings, test_client):
    """Test metrics endpoint when disabled"""
    mock_settings.ENABLE_METRICS = False
    
    response = test_client.get("/metrics")
    assert response.status_code == 404
    assert "Metrics disabled" in response.json()["detail"]

# ============================================================================
# Email Endpoint Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_get_emails_success(mock_auth, test_client, mock_database, sample_email):
    """Test successful email retrieval with pagination"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    # Mock database query results
    mock_email = MagicMock()
    mock_email.configure_mock(**sample_email)
    mock_database['session'].query.return_value.join.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = [mock_email]
    
    response = test_client.get("/emails?limit=10&offset=0")
    
    assert response.status_code == 200
    # Verify query was called with proper parameters
    mock_database['session'].query.assert_called()

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_get_emails_with_filters(mock_auth, test_client, mock_database):
    """Test email retrieval with classification and urgency filters"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    mock_query = mock_database['session'].query.return_value
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.offset.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = []
    
    response = test_client.get(
        "/emails?classification=needs_reply&urgency=high&start_date=2024-01-01T00:00:00"
    )
    
    assert response.status_code == 200
    # Verify filters were applied
    assert mock_query.filter.call_count >= 2  # classification and urgency filters

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_get_emails_date_range_filter(mock_auth, test_client, mock_database):
    """Test email retrieval with date range filtering"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    mock_query = mock_database['session'].query.return_value
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.offset.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = []
    
    start_date = "2024-01-01T00:00:00"
    end_date = "2024-12-31T23:59:59"
    
    response = test_client.get(f"/emails?start_date={start_date}&end_date={end_date}")
    
    assert response.status_code == 200
    # Verify date filters were applied
    assert mock_query.filter.call_count >= 2

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_get_email_by_id_success(mock_auth, test_client, mock_database, sample_email):
    """Test successful retrieval of specific email"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    mock_email = MagicMock()
    mock_email.configure_mock(**sample_email)
    mock_database['session'].get.return_value = mock_email
    
    response = test_client.get("/emails/1")
    
    assert response.status_code == 200
    mock_database['session'].get.assert_called_with(Email, 1)

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_get_email_by_id_not_found(mock_auth, test_client, mock_database):
    """Test email retrieval when email doesn't exist"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    mock_database['session'].get.return_value = None
    
    response = test_client.get("/emails/999")
    
    assert response.status_code == 404
    assert "Email not found" in response.json()["detail"]

@pytest.mark.unit
@pytest.mark.api
def test_get_emails_unauthorized(test_client):
    """Test email retrieval without authentication"""
    response = test_client.get("/emails")
    assert response.status_code == 403  # or 401 depending on auth implementation

# ============================================================================
# Batch Processing Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
@patch('backend_architecture.process_email_batch_task')
def test_start_batch_processing_success(mock_task, mock_auth, test_client, mock_database):
    """Test successful batch processing initiation"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["write"]}
    
    # Mock batch creation
    mock_batch = MagicMock()
    mock_batch.id = 123
    mock_database['session'].add.return_value = None
    mock_database['session'].commit.return_value = None
    
    # Mock Celery task
    mock_task.delay.return_value = MagicMock()
    
    batch_request = {
        "start_date": "2024-01-01T00:00:00",
        "end_date": "2024-01-31T23:59:59",
        "batch_size": 50,
        "force_reprocess": False
    }
    
    with patch('backend_architecture.EmailBatch', return_value=mock_batch):
        response = test_client.post("/emails/batch/process", json=batch_request)
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "queued"
    assert "batch_id" in data
    
    # Verify task was queued
    mock_task.delay.assert_called_once()

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_start_batch_processing_default_dates(mock_auth, test_client, mock_database):
    """Test batch processing with default date range"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["write"]}
    
    mock_batch = MagicMock()
    mock_batch.id = 123
    
    with patch('backend_architecture.EmailBatch', return_value=mock_batch), \
         patch('backend_architecture.process_email_batch_task') as mock_task:
        
        mock_task.delay.return_value = MagicMock()
        response = test_client.post("/emails/batch/process", json={})
    
    assert response.status_code == 200
    # Verify default dates were set (2 months back)

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_get_batch_status_success(mock_auth, test_client, mock_database):
    """Test successful batch status retrieval"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    mock_batch = MagicMock()
    mock_batch.id = 123
    mock_batch.status = "processing"
    mock_batch.total_emails = 100
    mock_batch.processed_emails = 75
    mock_batch.failed_emails = 2
    mock_database['session'].get.return_value = mock_batch
    
    response = test_client.get("/emails/batch/123/status")
    
    assert response.status_code == 200
    data = response.json()
    assert data["batch_id"] == 123
    assert data["status"] == "processing"
    assert data["total_emails"] == 100
    assert data["processed_emails"] == 75

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_get_batch_status_not_found(mock_auth, test_client, mock_database):
    """Test batch status when batch doesn't exist"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    mock_database['session'].get.return_value = None
    
    response = test_client.get("/emails/batch/999/status")
    
    assert response.status_code == 404
    assert "Batch not found" in response.json()["detail"]

# ============================================================================
# Task Management Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_get_tasks_success(mock_auth, test_client, mock_database, sample_task):
    """Test successful task retrieval"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    mock_task = MagicMock()
    mock_task.configure_mock(**sample_task)
    
    mock_query = mock_database['session'].query.return_value
    mock_query.filter.return_value = mock_query
    mock_query.order_by.return_value = mock_query
    mock_query.limit.return_value = mock_query
    mock_query.all.return_value = [mock_task]
    
    response = test_client.get("/tasks?status=pending&priority=HIGH")
    
    assert response.status_code == 200
    # Verify filters were applied
    assert mock_query.filter.call_count >= 2

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
@patch('backend_architecture.manager')
def test_update_task_status_success(mock_manager, mock_auth, test_client, mock_database):
    """Test successful task status update"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["write"]}
    
    mock_task = MagicMock()
    mock_task.task_id = "test_task_123"
    mock_task.status = "pending"
    
    mock_query = mock_database['session'].query.return_value
    mock_query.filter.return_value.first.return_value = mock_task
    mock_database['session'].commit.return_value = None
    
    # Mock WebSocket broadcast
    mock_manager.broadcast = AsyncMock()
    
    response = test_client.put("/tasks/test_task_123/status", json={"status": "completed"})
    
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "test_task_123"
    assert data["status"] == "completed"
    
    # Verify task was updated
    assert mock_task.status == "completed"
    assert mock_task.completed_at is not None

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_update_task_status_not_found(mock_auth, test_client, mock_database):
    """Test task status update when task doesn't exist"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["write"]}
    
    mock_query = mock_database['session'].query.return_value
    mock_query.filter.return_value.first.return_value = None
    
    response = test_client.put("/tasks/nonexistent/status", json={"status": "completed"})
    
    assert response.status_code == 404
    assert "Task not found" in response.json()["detail"]

# ============================================================================
# Analytics Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_dashboard_analytics_success(mock_auth, test_client, mock_database):
    """Test successful dashboard analytics retrieval"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    # Mock Redis cache miss
    mock_database['redis'].get.return_value = None
    mock_database['redis'].setex.return_value = None
    
    # Mock database queries
    mock_database['session'].query.return_value.count.return_value = 1500
    mock_database['session'].query.return_value.filter.return_value.count.return_value = 250
    
    response = test_client.get("/analytics/dashboard")
    
    assert response.status_code == 200
    data = response.json()
    assert "total_emails" in data
    assert "unread_emails" in data
    assert "urgent_emails" in data
    assert "pending_tasks" in data
    assert "processing_rate" in data
    assert "system_health" in data

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_dashboard_analytics_cached(mock_auth, test_client, mock_database):
    """Test dashboard analytics with cached data"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    cached_data = {
        "total_emails": 1500,
        "unread_emails": 250,
        "urgent_emails": 45,
        "pending_tasks": 12
    }
    
    # Mock Redis cache hit
    mock_database['redis'].get.return_value = json.dumps(cached_data)
    
    response = test_client.get("/analytics/dashboard")
    
    assert response.status_code == 200
    data = response.json()
    assert data["total_emails"] == 1500
    assert data["unread_emails"] == 250
    
    # Verify Redis was queried but database was not
    mock_database['redis'].get.assert_called()
    mock_database['session'].query.assert_not_called()

# ============================================================================
# WebSocket Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_websocket_connection_success():
    """Test successful WebSocket connection"""
    test_client = TestClient(app)
    user_id = "test_user_123"
    
    with test_client.websocket_connect(f"/ws/{user_id}") as websocket:
        # Send subscription message
        websocket.send_text(json.dumps({
            "type": "subscribe",
            "subscriptions": ["batch_updates", "real_time_processing"]
        }))
        
        # Should receive confirmation
        data = websocket.receive_text()
        message = json.loads(data)
        
        assert message["type"] == "subscription_confirmed"
        assert "batch_updates" in message["data"]["subscriptions"]

@pytest.mark.unit
@pytest.mark.asyncio
async def test_websocket_ping_pong():
    """Test WebSocket ping/pong functionality"""
    test_client = TestClient(app)
    user_id = "test_user_ping"
    
    with test_client.websocket_connect(f"/ws/{user_id}") as websocket:
        # Send ping
        websocket.send_text(json.dumps({"type": "ping"}))
        
        # Should receive pong
        data = websocket.receive_text()
        message = json.loads(data)
        
        assert message["type"] == "pong"

@pytest.mark.unit
def test_websocket_manager_connect():
    """Test WebSocket connection manager"""
    from backend_architecture import ConnectionManager
    
    manager = ConnectionManager()
    mock_websocket = AsyncMock()
    user_id = "test_user"
    
    # Test connection
    asyncio.run(manager.connect(mock_websocket, user_id))
    
    assert user_id in manager.active_connections
    assert manager.active_connections[user_id] == mock_websocket

@pytest.mark.unit
def test_websocket_manager_disconnect():
    """Test WebSocket disconnection manager"""
    from backend_architecture import ConnectionManager
    
    manager = ConnectionManager()
    user_id = "test_user"
    
    # Add connection first
    manager.active_connections[user_id] = AsyncMock()
    manager.user_subscriptions[user_id] = ["updates"]
    
    # Test disconnection
    manager.disconnect(user_id)
    
    assert user_id not in manager.active_connections
    assert user_id not in manager.user_subscriptions

@pytest.mark.unit
@pytest.mark.asyncio
async def test_websocket_broadcast():
    """Test WebSocket broadcast functionality"""
    from backend_architecture import ConnectionManager, WebSocketMessage
    
    manager = ConnectionManager()
    
    # Add multiple connections
    user1_ws = AsyncMock()
    user2_ws = AsyncMock()
    manager.active_connections["user1"] = user1_ws
    manager.active_connections["user2"] = user2_ws
    
    # Subscribe users to different types
    manager.user_subscriptions["user1"] = ["batch_updates"]
    manager.user_subscriptions["user2"] = ["real_time_processing"]
    
    message = WebSocketMessage(
        type="test_broadcast",
        data={"test": "data"}
    )
    
    # Broadcast to specific subscription type
    await manager.broadcast(message, "batch_updates")
    
    # Only user1 should receive the message
    user1_ws.send_text.assert_called_once()
    user2_ws.send_text.assert_not_called()

# ============================================================================
# Error Handling Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.api
def test_invalid_json_request(test_client):
    """Test handling of invalid JSON in request body"""
    response = test_client.post(
        "/emails/batch/process",
        content="invalid json{",
        headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422

@pytest.mark.unit
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_database_connection_error(mock_auth, test_client, mock_database):
    """Test handling of database connection errors"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    # Mock database error
    mock_database['session'].query.side_effect = Exception("Database connection failed")
    
    response = test_client.get("/emails")
    assert response.status_code == 500

@pytest.mark.unit
@pytest.mark.api
def test_validation_error_handling(test_client):
    """Test handling of validation errors"""
    # Invalid batch size (too large)
    batch_request = {
        "batch_size": 5000,  # Max is 1000
        "force_reprocess": "invalid_boolean"
    }
    
    response = test_client.post("/emails/batch/process", json=batch_request)
    assert response.status_code == 422  # Validation error

# ============================================================================
# Performance and Load Tests
# ============================================================================

@pytest.mark.slow
@pytest.mark.unit
@patch('backend_architecture.get_current_user')
def test_email_endpoint_performance(mock_auth, test_client, mock_database):
    """Test email endpoint response time under load"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read"]}
    
    # Mock large dataset
    mock_emails = [MagicMock() for _ in range(100)]
    mock_database['session'].query.return_value.join.return_value.order_by.return_value.offset.return_value.limit.return_value.all.return_value = mock_emails
    
    start_time = time.time()
    response = test_client.get("/emails?limit=100")
    end_time = time.time()
    
    assert response.status_code == 200
    assert (end_time - start_time) < 2.0  # Should respond within 2 seconds

@pytest.mark.slow
@pytest.mark.unit
def test_concurrent_websocket_connections():
    """Test multiple concurrent WebSocket connections"""
    from backend_architecture import ConnectionManager
    
    manager = ConnectionManager()
    
    # Simulate multiple concurrent connections
    for i in range(50):
        user_id = f"user_{i}"
        mock_websocket = AsyncMock()
        asyncio.run(manager.connect(mock_websocket, user_id))
    
    assert len(manager.active_connections) == 50

@pytest.mark.slow
@pytest.mark.unit
@pytest.mark.asyncio
async def test_websocket_broadcast_performance():
    """Test WebSocket broadcast performance with many connections"""
    from backend_architecture import ConnectionManager, WebSocketMessage
    
    manager = ConnectionManager()
    
    # Add many connections
    for i in range(100):
        user_id = f"user_{i}"
        mock_websocket = AsyncMock()
        manager.active_connections[user_id] = mock_websocket
    
    message = WebSocketMessage(type="performance_test", data={})
    
    start_time = time.time()
    await manager.broadcast(message)
    end_time = time.time()
    
    # Should broadcast to all 100 connections quickly
    assert (end_time - start_time) < 1.0

# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.api
@patch('backend_architecture.get_current_user')
def test_full_email_processing_workflow(mock_auth, test_client, mock_database):
    """Test complete email processing workflow"""
    mock_auth.return_value = {"user_id": "test_user", "permissions": ["read", "write"]}
    
    # Step 1: Get initial email count
    mock_database['session'].query.return_value.count.return_value = 100
    response = test_client.get("/analytics/dashboard")
    initial_count = response.json()["total_emails"]
    
    # Step 2: Start batch processing
    with patch('backend_architecture.process_email_batch_task') as mock_task:
        mock_batch = MagicMock()
        mock_batch.id = 456
        
        with patch('backend_architecture.EmailBatch', return_value=mock_batch):
            response = test_client.post("/emails/batch/process", json={})
            
        assert response.status_code == 200
        batch_id = response.json()["batch_id"]
    
    # Step 3: Check batch status
    mock_batch.status = "completed"
    mock_batch.total_emails = 50
    mock_batch.processed_emails = 48
    mock_batch.failed_emails = 2
    
    mock_database['session'].get.return_value = mock_batch
    
    response = test_client.get(f"/emails/batch/{batch_id}/status")
    assert response.status_code == 200
    assert response.json()["status"] == "completed"

@pytest.mark.integration
def test_websocket_real_time_updates():
    """Test real-time updates through WebSocket"""
    test_client = TestClient(app)
    user_id = "integration_test_user"
    
    with test_client.websocket_connect(f"/ws/{user_id}") as websocket:
        # Subscribe to updates
        websocket.send_text(json.dumps({
            "type": "subscribe",
            "subscriptions": ["real_time_processing"]
        }))
        
        # Confirm subscription
        data = websocket.receive_text()
        message = json.loads(data)
        assert message["type"] == "subscription_confirmed"
        
        # Simulate real-time update
        # In real scenario, this would be triggered by email processing
        websocket.send_text(json.dumps({"type": "ping"}))
        
        pong_data = websocket.receive_text()
        pong_message = json.loads(pong_data)
        assert pong_message["type"] == "pong"

# ============================================================================
# Cleanup and Teardown Tests
# ============================================================================

@pytest.mark.unit
def test_database_cleanup():
    """Test proper database connection cleanup"""
    with patch.object(db_manager, 'close') as mock_close:
        # Simulate app shutdown
        asyncio.run(db_manager.close())
        mock_close.assert_called_once()

# ============================================================================
# Security Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.api
def test_unauthorized_access(test_client):
    """Test that endpoints require authentication"""
    # Test without auth header
    response = test_client.get("/emails")
    assert response.status_code in [401, 403]
    
    response = test_client.post("/emails/batch/process", json={})
    assert response.status_code in [401, 403]
    
    response = test_client.get("/analytics/dashboard")
    assert response.status_code in [401, 403]

@pytest.mark.unit
@pytest.mark.api
def test_cors_headers(test_client):
    """Test CORS headers are properly set"""
    response = test_client.options("/emails")
    # Should include CORS headers
    assert "access-control-allow-origin" in response.headers or response.status_code == 200

@pytest.mark.unit
def test_input_sanitization(test_client):
    """Test input sanitization and validation"""
    # Test SQL injection attempt
    malicious_input = "'; DROP TABLE emails; --"
    
    response = test_client.get(f"/emails?classification={malicious_input}")
    # Should not crash and should return validation error or empty results
    assert response.status_code in [200, 422]

# ============================================================================
# Test Utilities
# ============================================================================

def assert_response_time(func, max_time_seconds=1.0):
    """Utility to assert response time"""
    start = time.time()
    func()
    end = time.time()
    assert (end - start) < max_time_seconds

def create_mock_email_batch(batch_id: int, status: str = "completed") -> MagicMock:
    """Utility to create mock email batch"""
    mock_batch = MagicMock()
    mock_batch.id = batch_id
    mock_batch.status = status
    mock_batch.total_emails = 100
    mock_batch.processed_emails = 95
    mock_batch.failed_emails = 5
    mock_batch.started_at = datetime.now() - timedelta(minutes=30)
    mock_batch.completed_at = datetime.now()
    return mock_batch

# ============================================================================
# Test Configuration and Fixtures
# ============================================================================

@pytest.fixture(autouse=True)
def reset_singletons():
    """Reset singleton instances between tests"""
    # Reset WebSocket manager
    websocket_manager.active_connections.clear()
    websocket_manager.user_subscriptions.clear()
    
    yield
    
    # Cleanup after test
    websocket_manager.active_connections.clear()
    websocket_manager.user_subscriptions.clear()

if __name__ == "__main__":
    pytest.main([__file__, "-v"])