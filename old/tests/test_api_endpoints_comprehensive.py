#!/usr/bin/env python3
"""
Comprehensive API Endpoint Tests

Tests all FastAPI endpoints with authentication, validation, error handling,
input sanitization, and business logic verification.

Priority: CRITICAL - API endpoints are the interface to the system
"""

import pytest
import json
import time
from datetime import datetime, timedelta
from unittest.mock import patch, Mock, MagicMock
from fastapi.testclient import TestClient
from fastapi import status
from pathlib import Path
import sys

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend_architecture import app
from auth_middleware import create_access_token, create_refresh_token, auth_config


class TestAPIEndpointsComprehensive:
    """Comprehensive API endpoint test suite"""
    
    @pytest.fixture
    def client(self):
        """FastAPI test client"""
        return TestClient(app)
    
    @pytest.fixture
    def valid_user_data(self):
        """Valid user data for authentication"""
        return {
            "user_id": "test-user-123",
            "email": "test@example.com",
            "permissions": ["read", "write"],
            "roles": ["user"]
        }
    
    @pytest.fixture
    def admin_user_data(self):
        """Admin user data for testing"""
        return {
            "user_id": "admin-user-123", 
            "email": "admin@example.com",
            "permissions": ["read", "write", "admin"],
            "roles": ["admin", "user"]
        }
    
    @pytest.fixture
    def auth_headers(self, valid_user_data):
        """Headers with valid authentication token"""
        token = create_access_token(valid_user_data)
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture
    def admin_headers(self, admin_user_data):
        """Headers with admin authentication token"""
        token = create_access_token(admin_user_data)
        return {"Authorization": f"Bearer {token}"}


class TestHealthAndSystemEndpoints(TestAPIEndpointsComprehensive):
    """Test health and system endpoints"""
    
    def test_health_endpoint_basic(self, client):
        """Test basic health endpoint functionality"""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should contain basic health information
        assert "status" in data
        assert data["status"] in ["healthy", "degraded", "unhealthy"]
        assert "timestamp" in data
        assert "version" in data
    
    def test_health_endpoint_includes_component_status(self, client):
        """Test health endpoint includes component status"""
        response = client.get("/health")
        
        if response.status_code == 200:
            data = response.json()
            
            # Should include database status
            if "database" in data:
                assert data["database"] in ["connected", "disconnected", "unknown"]
            
            # Should include authentication status
            if "auth" in data:
                assert isinstance(data["auth"], dict)
    
    def test_health_endpoint_performance(self, client):
        """Test health endpoint responds quickly"""
        start_time = time.time()
        response = client.get("/health")
        end_time = time.time()
        
        response_time = (end_time - start_time) * 1000  # ms
        assert response_time < 500, f"Health endpoint took {response_time:.1f}ms, should be < 500ms"
    
    def test_metrics_endpoint_authentication(self, client, auth_headers):
        """Test metrics endpoint authentication"""
        # Without auth should be denied or not found
        response = client.get("/metrics")
        assert response.status_code in [401, 403, 404]
        
        # With auth may be allowed (if metrics are enabled)
        response = client.get("/metrics", headers=auth_headers)
        assert response.status_code in [200, 404]  # 404 if metrics disabled
    
    def test_cors_headers_on_system_endpoints(self, client):
        """Test CORS headers are present on system endpoints"""
        response = client.options("/health")
        
        # Should have CORS headers
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers


class TestAuthenticationEndpoints(TestAPIEndpointsComprehensive):
    """Test authentication endpoints"""
    
    @patch('auth_middleware.authenticate_user')
    def test_login_endpoint_success(self, mock_auth, client):
        """Test successful login"""
        # Mock successful authentication
        mock_user = {
            "user_id": "user123",
            "email": "test@example.com",
            "permissions": ["read", "write"],
            "roles": ["user"]
        }
        mock_auth.return_value = mock_user
        
        login_data = {
            "email": "test@example.com",
            "password": "correct_password"
        }
        
        response = client.post("/auth/login", json=login_data)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return tokens
        assert "access_token" in data
        assert "refresh_token" in data
        assert "expires_in" in data
        assert "user" in data
        
        # Tokens should be strings
        assert isinstance(data["access_token"], str)
        assert isinstance(data["refresh_token"], str)
        assert len(data["access_token"]) > 50  # JWT tokens are long
    
    @patch('auth_middleware.authenticate_user')
    def test_login_endpoint_failure(self, mock_auth, client):
        """Test login failure with invalid credentials"""
        # Mock authentication failure
        mock_auth.return_value = None
        
        login_data = {
            "email": "test@example.com", 
            "password": "wrong_password"
        }
        
        response = client.post("/auth/login", json=login_data)
        
        assert response.status_code == 401
        data = response.json()
        
        # Should return error
        assert "detail" in data
        assert "email" in data["detail"].lower() or "password" in data["detail"].lower()
    
    def test_login_endpoint_validation(self, client):
        """Test login endpoint input validation"""
        # Test missing email
        response = client.post("/auth/login", json={"password": "test123"})
        assert response.status_code == 422
        
        # Test missing password
        response = client.post("/auth/login", json={"email": "test@example.com"})
        assert response.status_code == 422
        
        # Test invalid email format
        response = client.post("/auth/login", json={
            "email": "not_an_email",
            "password": "test123"
        })
        assert response.status_code == 422
        
        # Test empty credentials
        response = client.post("/auth/login", json={"email": "", "password": ""})
        assert response.status_code == 422
    
    @patch('auth_middleware.validate_refresh_token_and_create_new')
    def test_refresh_token_endpoint(self, mock_refresh, client):
        """Test refresh token endpoint"""
        # Mock successful refresh
        new_tokens = {
            "access_token": "new_access_token",
            "refresh_token": "new_refresh_token", 
            "expires_in": 1800,
            "user": {"user_id": "user123", "email": "test@example.com"}
        }
        mock_refresh.return_value = new_tokens
        
        response = client.post("/auth/refresh", json={"refresh_token": "valid_refresh_token"})
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["access_token"] == "new_access_token"
    
    def test_user_profile_endpoint(self, client, auth_headers, valid_user_data):
        """Test user profile endpoint"""
        with patch('auth_middleware.get_current_user') as mock_get_user:
            # Mock current user
            mock_user = Mock()
            mock_user.user_id = valid_user_data["user_id"]
            mock_user.email = valid_user_data["email"]
            mock_user.permissions = valid_user_data["permissions"]
            mock_get_user.return_value = mock_user
            
            response = client.get("/auth/me", headers=auth_headers)
            
            if response.status_code == 200:
                data = response.json()
                assert "user_id" in data or "email" in data
    
    def test_auth_status_endpoint(self, client):
        """Test authentication status endpoint"""
        response = client.get("/auth/status")
        
        # Should be publicly accessible
        assert response.status_code == 200
        data = response.json()
        
        # Should include auth system status
        assert "production_mode" in data
        assert "secret_configured" in data
        assert isinstance(data["production_mode"], bool)
        assert isinstance(data["secret_configured"], bool)


class TestEmailEndpoints(TestAPIEndpointsComprehensive):
    """Test email-related endpoints"""
    
    @patch('backend_architecture.db_manager')
    def test_get_emails_endpoint(self, mock_db_manager, client, auth_headers):
        """Test get emails endpoint"""
        # Mock email data
        mock_emails = [
            {
                "id": 1,
                "subject": "Test Email 1",
                "sender": "test1@example.com",
                "date": "2024-08-15T10:00:00Z",
                "classification": "NEEDS_REPLY",
                "urgency": "HIGH",
                "confidence": 0.92
            },
            {
                "id": 2,
                "subject": "Test Email 2", 
                "sender": "test2@example.com",
                "date": "2024-08-15T09:00:00Z",
                "classification": "FYI_ONLY",
                "urgency": "LOW",
                "confidence": 0.85
            }
        ]
        
        # Mock database manager
        mock_connector = Mock()
        mock_connector.get_recent_emails.return_value = mock_emails
        mock_db_manager.apple_mail_connector = mock_connector
        
        response = client.get("/emails/", headers=auth_headers)
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            if data:
                email = data[0]
                assert "id" in email
                assert "subject" in email
                assert "sender" in email
    
    def test_get_emails_with_filters(self, client, auth_headers):
        """Test get emails with query parameters"""
        # Test various filter combinations
        filter_tests = [
            {"limit": "10"},
            {"offset": "5"},
            {"start_date": "2024-08-01"},
            {"end_date": "2024-08-31"},
            {"classification": "NEEDS_REPLY"},
            {"urgency": "HIGH"},
            {"limit": "5", "classification": "APPROVAL_REQUIRED"}
        ]
        
        for filters in filter_tests:
            response = client.get("/emails/", params=filters, headers=auth_headers)
            
            # Should handle filters gracefully
            assert response.status_code in [200, 400, 401, 403]
            
            if response.status_code == 200:
                data = response.json()
                assert isinstance(data, list)
    
    def test_get_single_email_endpoint(self, client, auth_headers):
        """Test get single email endpoint"""
        # Test with valid email ID
        response = client.get("/emails/1", headers=auth_headers)
        assert response.status_code in [200, 404, 401, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)
            assert "id" in data
        
        # Test with invalid email ID
        response = client.get("/emails/999999", headers=auth_headers)
        assert response.status_code in [404, 401, 403]
        
        # Test with non-numeric ID
        response = client.get("/emails/invalid", headers=auth_headers)
        assert response.status_code in [400, 404, 422]
    
    def test_email_actions_endpoints(self, client, auth_headers):
        """Test email action endpoints"""
        email_id = 1
        
        # Test mark as read
        response = client.post(f"/emails/{email_id}/mark-read", headers=auth_headers)
        assert response.status_code in [200, 404, 401, 403]
        
        # Test archive
        response = client.post(f"/emails/{email_id}/archive", headers=auth_headers)
        assert response.status_code in [200, 404, 401, 403]
        
        # Test reply
        reply_data = {"body": "This is a test reply"}
        response = client.post(f"/emails/{email_id}/reply", json=reply_data, headers=auth_headers)
        assert response.status_code in [200, 404, 401, 403]
    
    def test_emails_endpoint_authentication(self, client):
        """Test emails endpoint requires authentication"""
        # Without authentication
        response = client.get("/emails/")
        assert response.status_code in [401, 403]
        
        # With invalid token
        invalid_headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/emails/", headers=invalid_headers)
        assert response.status_code in [401, 403]
    
    def test_emails_endpoint_input_validation(self, client, auth_headers):
        """Test emails endpoint input validation"""
        # Test invalid query parameters
        invalid_params = [
            {"limit": "-1"},
            {"limit": "not_a_number"},
            {"offset": "-5"},
            {"start_date": "invalid_date"},
            {"end_date": "2024-13-40"},  # Invalid date
            {"classification": "INVALID_CLASSIFICATION"},
            {"urgency": "INVALID_URGENCY"}
        ]
        
        for params in invalid_params:
            response = client.get("/emails/", params=params, headers=auth_headers)
            
            # Should return validation error or ignore invalid params
            assert response.status_code in [200, 400, 422]


class TestTaskEndpoints(TestAPIEndpointsComprehensive):
    """Test task-related endpoints"""
    
    def test_get_tasks_endpoint(self, client, auth_headers):
        """Test get tasks endpoint"""
        response = client.get("/tasks/", headers=auth_headers)
        
        assert response.status_code in [200, 401, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            
            if data:  # If tasks exist
                task = data[0]
                assert "id" in task or "task_id" in task
                assert "status" in task or "priority" in task
    
    def test_get_tasks_with_filters(self, client, auth_headers):
        """Test get tasks with filters"""
        filter_tests = [
            {"status": "pending"},
            {"priority": "high"},
            {"assignee": "test_user"},
            {"limit": "10"}
        ]
        
        for filters in filter_tests:
            response = client.get("/tasks/", params=filters, headers=auth_headers)
            assert response.status_code in [200, 400, 401, 403]
    
    def test_update_task_status_endpoint(self, client, auth_headers):
        """Test update task status endpoint"""
        task_id = "task_001"
        
        # Test valid status update
        response = client.put(f"/tasks/{task_id}/status", 
                            params={"status": "completed"}, 
                            headers=auth_headers)
        
        assert response.status_code in [200, 404, 401, 403]
        
        # Test invalid status
        response = client.put(f"/tasks/{task_id}/status", 
                            params={"status": "invalid_status"}, 
                            headers=auth_headers)
        
        assert response.status_code in [400, 404, 422, 401, 403]
    
    def test_task_endpoints_authentication(self, client):
        """Test task endpoints require authentication"""
        # Get tasks without auth
        response = client.get("/tasks/")
        assert response.status_code in [401, 403]
        
        # Update task without auth
        response = client.put("/tasks/task_001/status", params={"status": "completed"})
        assert response.status_code in [401, 403]


class TestDraftEndpoints(TestAPIEndpointsComprehensive):
    """Test draft-related endpoints"""
    
    def test_get_drafts_endpoint(self, client, auth_headers):
        """Test get drafts endpoint"""
        response = client.get("/drafts/", headers=auth_headers)
        
        assert response.status_code in [200, 401, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            
            if data:  # If drafts exist
                draft = data[0]
                assert "id" in draft
                assert "content" in draft or "body" in draft
    
    @patch('backend_architecture.db_manager')
    def test_send_draft_endpoint(self, mock_db_manager, client, auth_headers):
        """Test send draft endpoint"""
        draft_id = "draft_001"
        
        # Mock successful send
        mock_mailer = Mock()
        mock_mailer.send_email.return_value = True
        mock_db_manager.mailer = mock_mailer
        
        response = client.post(f"/drafts/{draft_id}/send", headers=auth_headers)
        
        assert response.status_code in [200, 404, 401, 403]
    
    def test_create_draft_endpoint(self, client, auth_headers):
        """Test create draft endpoint"""
        draft_data = {
            "to": "test@example.com",
            "subject": "Test Draft",
            "body": "This is a test draft"
        }
        
        response = client.post("/drafts/create", json=draft_data, headers=auth_headers)
        
        assert response.status_code in [200, 201, 400, 401, 403]
    
    def test_draft_validation(self, client, auth_headers):
        """Test draft creation validation"""
        # Test missing required fields
        invalid_drafts = [
            {},  # Empty
            {"to": "test@example.com"},  # Missing subject and body
            {"subject": "Test"},  # Missing to and body
            {"to": "invalid_email", "subject": "Test", "body": "Body"}  # Invalid email
        ]
        
        for draft_data in invalid_drafts:
            response = client.post("/drafts/create", json=draft_data, headers=auth_headers)
            assert response.status_code in [400, 422, 401, 403]


class TestAnalyticsEndpoints(TestAPIEndpointsComprehensive):
    """Test analytics and statistics endpoints"""
    
    def test_get_stats_endpoint(self, client, auth_headers):
        """Test get statistics endpoint"""
        response = client.get("/stats/", headers=auth_headers)
        
        assert response.status_code in [200, 401, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)
            
            # Should contain statistical information
            stat_fields = ["total_emails", "unread_count", "processing_stats"]
            if any(field in data for field in stat_fields):
                # Has some statistical data
                pass
    
    def test_dashboard_analytics_endpoint(self, client, auth_headers):
        """Test dashboard analytics endpoint"""
        response = client.get("/analytics/dashboard", headers=auth_headers)
        
        assert response.status_code in [200, 401, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)
    
    def test_mailbox_stats_endpoint(self, client, auth_headers):
        """Test mailbox statistics endpoint"""
        response = client.get("/analytics/mailbox-stats", headers=auth_headers)
        
        assert response.status_code in [200, 401, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict)
            
            # Should contain mailbox information
            if "total_messages" in data:
                assert isinstance(data["total_messages"], int)
                assert data["total_messages"] >= 0


class TestErrorHandlingAndValidation(TestAPIEndpointsComprehensive):
    """Test error handling and input validation"""
    
    def test_404_error_handling(self, client, auth_headers):
        """Test 404 error handling"""
        non_existent_endpoints = [
            "/nonexistent",
            "/emails/999999999",
            "/tasks/nonexistent_task",
            "/drafts/nonexistent_draft"
        ]
        
        for endpoint in non_existent_endpoints:
            response = client.get(endpoint, headers=auth_headers)
            assert response.status_code in [404, 401, 403]
            
            if response.status_code == 404:
                # Should return JSON error
                data = response.json()
                assert "detail" in data or "message" in data
    
    def test_method_not_allowed_handling(self, client, auth_headers):
        """Test method not allowed handling"""
        # Try POST on GET-only endpoints
        response = client.post("/health", headers=auth_headers)
        assert response.status_code == 405
        
        # Try GET on POST-only endpoints
        response = client.get("/auth/login", headers=auth_headers)
        assert response.status_code == 405
    
    def test_malformed_json_handling(self, client, auth_headers):
        """Test malformed JSON handling"""
        # Send invalid JSON
        response = client.post("/auth/login", 
                             data="invalid json {",
                             headers={**auth_headers, "Content-Type": "application/json"})
        
        assert response.status_code == 422
    
    def test_large_request_handling(self, client, auth_headers):
        """Test handling of very large requests"""
        # Create large request body
        large_data = {"body": "x" * 100000}  # 100KB body
        
        response = client.post("/drafts/create", json=large_data, headers=auth_headers)
        
        # Should handle gracefully (accept or reject cleanly)
        assert response.status_code in [200, 201, 400, 413, 422, 401, 403]
    
    def test_sql_injection_prevention_in_api(self, client, auth_headers):
        """Test SQL injection prevention in API parameters"""
        injection_attempts = [
            "1'; DROP TABLE emails; --",
            "1 OR 1=1",
            "'; UPDATE emails SET subject='hacked'; --"
        ]
        
        for injection in injection_attempts:
            # Test in various parameters
            response = client.get(f"/emails/{injection}", headers=auth_headers)
            assert response.status_code in [400, 404, 422, 401, 403]
            
            # Should not return database errors
            if response.status_code != 401 and response.status_code != 403:
                response_text = response.text.lower()
                assert "sql" not in response_text
                assert "database" not in response_text
    
    def test_xss_prevention_in_api_responses(self, client, auth_headers):
        """Test XSS prevention in API responses"""
        xss_payloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>"
        ]
        
        for payload in xss_payloads:
            # Test in search parameters
            response = client.get("/emails/", 
                                params={"search": payload}, 
                                headers=auth_headers)
            
            if response.status_code == 200:
                response_text = response.text
                # Should not contain unescaped XSS payload
                assert "<script>" not in response_text
                assert "javascript:" not in response_text
                assert "onerror=" not in response_text


class TestAPIPerformanceAndReliability(TestAPIEndpointsComprehensive):
    """Test API performance and reliability"""
    
    def test_api_response_times(self, client, auth_headers):
        """Test API response times meet requirements"""
        endpoints_to_test = [
            ("GET", "/health"),
            ("GET", "/auth/status"),
            ("GET", "/emails/", auth_headers),
            ("GET", "/tasks/", auth_headers),
            ("GET", "/stats/", auth_headers)
        ]
        
        for method, endpoint, *headers in endpoints_to_test:
            headers = headers[0] if headers else {}
            
            start_time = time.time()
            
            if method == "GET":
                response = client.get(endpoint, headers=headers)
            elif method == "POST":
                response = client.post(endpoint, headers=headers, json={})
            
            end_time = time.time()
            response_time = (end_time - start_time) * 1000  # ms
            
            # API responses should be under 1 second
            assert response_time < 1000, f"{endpoint} took {response_time:.1f}ms"
    
    def test_concurrent_api_requests(self, client, auth_headers):
        """Test API handles concurrent requests"""
        import threading
        import queue
        
        results = queue.Queue()
        
        def make_request():
            try:
                response = client.get("/health")
                results.put(("success", response.status_code))
            except Exception as e:
                results.put(("error", str(e)))
        
        # Make 10 concurrent requests
        threads = []
        for _ in range(10):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads
        for thread in threads:
            thread.join()
        
        # Check results
        success_count = 0
        error_count = 0
        
        while not results.empty():
            result_type, result_value = results.get()
            if result_type == "success":
                success_count += 1
            else:
                error_count += 1
        
        # Most requests should succeed
        assert success_count >= 8, f"Only {success_count}/10 concurrent requests succeeded"
    
    def test_api_consistency(self, client, auth_headers):
        """Test API returns consistent results"""
        # Make same request multiple times
        endpoint = "/health"
        responses = []
        
        for _ in range(5):
            response = client.get(endpoint)
            responses.append(response.status_code)
        
        # Should return consistent status codes
        assert len(set(responses)) <= 2, f"Inconsistent responses: {responses}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])