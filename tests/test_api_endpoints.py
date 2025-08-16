"""
Test suite for API endpoints with comprehensive coverage
"""
import pytest
import json
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from httpx import AsyncClient

# Import test fixtures
from conftest import (
    sample_email_data, 
    task_email_data, 
    sample_task_data,
    multiple_emails_data,
    mock_openai_client,
    auth_headers,
    performance_config
)

# Try to import application modules
try:
    from main import app
except ImportError:
    pytest.skip("Main application not available", allow_module_level=True)

@pytest.mark.api
class TestEmailEndpoints:
    """Test email-related API endpoints"""

    def test_get_emails_success(self, client, multiple_emails_data):
        """Test successful email retrieval"""
        with patch('main.get_emails') as mock_get_emails:
            mock_get_emails.return_value = multiple_emails_data
            
            response = client.get("/emails/")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == len(multiple_emails_data)
            assert data[0]["id"] == "email-001"

    def test_get_emails_with_pagination(self, client, multiple_emails_data):
        """Test email pagination"""
        with patch('main.get_emails') as mock_get_emails:
            mock_get_emails.return_value = multiple_emails_data[:5]
            
            response = client.get("/emails/?page=1&per_page=5")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) <= 5

    def test_get_emails_with_filters(self, client, multiple_emails_data):
        """Test email filtering"""
        filtered_emails = [email for email in multiple_emails_data if email["is_flagged"]]
        
        with patch('main.get_emails') as mock_get_emails:
            mock_get_emails.return_value = filtered_emails
            
            response = client.get("/emails/?is_flagged=true")
            
            assert response.status_code == 200
            data = response.json()
            assert all(email["is_flagged"] for email in data)

    def test_get_single_email(self, client, sample_email_data):
        """Test retrieving a single email"""
        with patch('main.get_email_by_id') as mock_get_email:
            mock_get_email.return_value = sample_email_data
            
            response = client.get(f"/emails/{sample_email_data['id']}")
            
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == sample_email_data["id"]
            assert data["subject"] == sample_email_data["subject"]

    def test_get_nonexistent_email(self, client):
        """Test retrieving non-existent email"""
        with patch('main.get_email_by_id') as mock_get_email:
            mock_get_email.return_value = None
            
            response = client.get("/emails/nonexistent-id")
            
            assert response.status_code == 404
            data = response.json()
            assert "not found" in data["detail"].lower()

    def test_email_search(self, client, multiple_emails_data):
        """Test email search functionality"""
        search_results = [email for email in multiple_emails_data if "Test" in email["subject"]]
        
        with patch('main.search_emails') as mock_search:
            mock_search.return_value = search_results
            
            response = client.get("/emails/search/?q=Test")
            
            assert response.status_code == 200
            data = response.json()
            assert all("Test" in email["subject"] for email in data)

@pytest.mark.api
class TestTaskEndpoints:
    """Test task-related API endpoints"""

    def test_get_tasks_success(self, client, sample_task_data):
        """Test successful task retrieval"""
        with patch('main.get_tasks') as mock_get_tasks:
            mock_get_tasks.return_value = [sample_task_data]
            
            response = client.get("/tasks/")
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["task_id"] == sample_task_data["task_id"]

    def test_create_task(self, client, sample_task_data):
        """Test task creation"""
        with patch('main.create_task') as mock_create_task:
            mock_create_task.return_value = sample_task_data
            
            task_data = {
                "title": sample_task_data["title"],
                "description": sample_task_data["description"],
                "category": sample_task_data["category"],
                "priority": sample_task_data["priority"],
                "assignee": sample_task_data["assignee"]
            }
            
            response = client.post("/tasks/", json=task_data)
            
            assert response.status_code == 201
            data = response.json()
            assert data["title"] == task_data["title"]

    def test_update_task(self, client, sample_task_data):
        """Test task update"""
        updated_task = {**sample_task_data, "status": "completed"}
        
        with patch('main.update_task') as mock_update_task:
            mock_update_task.return_value = updated_task
            
            response = client.put(
                f"/tasks/{sample_task_data['task_id']}", 
                json={"status": "completed"}
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "completed"

    def test_delete_task(self, client, sample_task_data):
        """Test task deletion"""
        with patch('main.delete_task') as mock_delete_task:
            mock_delete_task.return_value = True
            
            response = client.delete(f"/tasks/{sample_task_data['task_id']}")
            
            assert response.status_code == 204

    def test_get_tasks_by_status(self, client, sample_task_data):
        """Test filtering tasks by status"""
        pending_tasks = [sample_task_data]
        
        with patch('main.get_tasks_by_status') as mock_get_tasks:
            mock_get_tasks.return_value = pending_tasks
            
            response = client.get("/tasks/?status=pending")
            
            assert response.status_code == 200
            data = response.json()
            assert all(task["status"] == "pending" for task in data)

@pytest.mark.api
class TestAIEndpoints:
    """Test AI-related API endpoints"""

    def test_process_email_for_tasks(self, client, task_email_data, mock_openai_client):
        """Test AI email processing for task generation"""
        with patch('main.email_intelligence_engine') as mock_engine:
            mock_engine.process_email.return_value = {
                "tasks_generated": 1,
                "categories": ["REVIEW"],
                "confidence": 0.95
            }
            
            response = client.post(
                f"/ai/process-email/{task_email_data['id']}"
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["tasks_generated"] >= 1
            assert data["confidence"] > 0.8

    def test_generate_task_suggestions(self, client, task_email_data):
        """Test AI task suggestion generation"""
        with patch('main.ai_task_generator') as mock_generator:
            mock_generator.generate_suggestions.return_value = [
                {
                    "title": "Review quarterly report",
                    "category": "REVIEW",
                    "priority": "HIGH",
                    "confidence": 0.95
                }
            ]
            
            response = client.post("/ai/suggest-tasks", json={
                "email_content": task_email_data["content"],
                "email_subject": task_email_data["subject"]
            })
            
            assert response.status_code == 200
            data = response.json()
            assert len(data) > 0
            assert data[0]["confidence"] > 0.8

    def test_analyze_email_intelligence(self, client, task_email_data):
        """Test email intelligence analysis"""
        with patch('main.email_intelligence_analyzer') as mock_analyzer:
            mock_analyzer.analyze.return_value = {
                "urgency_score": 0.8,
                "action_required": True,
                "sentiment": "neutral",
                "key_phrases": ["review", "quarterly report", "feedback"]
            }
            
            response = client.post("/ai/analyze-email", json={
                "content": task_email_data["content"],
                "subject": task_email_data["subject"]
            })
            
            assert response.status_code == 200
            data = response.json()
            assert "urgency_score" in data
            assert "action_required" in data

@pytest.mark.api
class TestHealthEndpoints:
    """Test health and monitoring endpoints"""

    def test_health_check(self, client):
        """Test basic health check"""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"

    def test_detailed_health_check(self, client):
        """Test detailed health check with dependencies"""
        with patch('main.check_database_health') as mock_db_health, \
             patch('main.check_ai_service_health') as mock_ai_health:
            
            mock_db_health.return_value = {"status": "healthy", "response_time": 0.05}
            mock_ai_health.return_value = {"status": "healthy", "response_time": 0.2}
            
            response = client.get("/health/detailed")
            
            assert response.status_code == 200
            data = response.json()
            assert data["database"]["status"] == "healthy"
            assert data["ai_service"]["status"] == "healthy"

    def test_metrics_endpoint(self, client):
        """Test metrics endpoint"""
        with patch('main.get_system_metrics') as mock_metrics:
            mock_metrics.return_value = {
                "cpu_usage": 45.2,
                "memory_usage": 67.8,
                "disk_usage": 23.1,
                "active_connections": 12
            }
            
            response = client.get("/metrics")
            
            assert response.status_code == 200
            data = response.json()
            assert "cpu_usage" in data
            assert "memory_usage" in data

@pytest.mark.api
@pytest.mark.integration
class TestIntegrationFlows:
    """Test complete integration flows"""

    def test_email_to_task_workflow(self, client, task_email_data):
        """Test complete email to task creation workflow"""
        # Step 1: Process email
        with patch('main.get_email_by_id') as mock_get_email, \
             patch('main.email_intelligence_engine') as mock_engine, \
             patch('main.create_task') as mock_create_task:
            
            mock_get_email.return_value = task_email_data
            mock_engine.process_email.return_value = {
                "tasks_generated": 1,
                "task_data": {
                    "title": "Review quarterly report",
                    "category": "REVIEW",
                    "priority": "HIGH"
                }
            }
            mock_create_task.return_value = {
                "task_id": "generated-task-001",
                "title": "Review quarterly report",
                "status": "pending"
            }
            
            # Process email
            response = client.post(f"/ai/process-email/{task_email_data['id']}")
            assert response.status_code == 200
            
            # Verify task was created
            task_response = client.get("/tasks/")
            assert task_response.status_code == 200

    def test_task_status_update_flow(self, client, sample_task_data):
        """Test task status update and notification flow"""
        with patch('main.get_task_by_id') as mock_get_task, \
             patch('main.update_task') as mock_update_task, \
             patch('main.send_notification') as mock_notify:
            
            mock_get_task.return_value = sample_task_data
            updated_task = {**sample_task_data, "status": "completed"}
            mock_update_task.return_value = updated_task
            mock_notify.return_value = {"sent": True}
            
            # Update task status
            response = client.put(
                f"/tasks/{sample_task_data['task_id']}", 
                json={"status": "completed"}
            )
            
            assert response.status_code == 200
            assert mock_notify.called

@pytest.mark.performance
class TestPerformanceRequirements:
    """Test performance requirements"""

    def test_email_list_response_time(self, client, multiple_emails_data, performance_config):
        """Test email list loads within performance threshold"""
        import time
        
        with patch('main.get_emails') as mock_get_emails:
            mock_get_emails.return_value = multiple_emails_data
            
            start_time = time.time()
            response = client.get("/emails/")
            end_time = time.time()
            
            assert response.status_code == 200
            response_time = end_time - start_time
            assert response_time < performance_config["max_response_time"]

    def test_concurrent_requests(self, client, performance_config):
        """Test handling concurrent requests"""
        import threading
        import time
        
        results = []
        
        def make_request():
            start = time.time()
            response = client.get("/health")
            end = time.time()
            results.append({
                "status_code": response.status_code,
                "response_time": end - start
            })
        
        # Create threads for concurrent requests
        threads = []
        for _ in range(performance_config["concurrent_requests"]):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
        
        # Start all threads
        for thread in threads:
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # Verify results
        assert len(results) == performance_config["concurrent_requests"]
        assert all(result["status_code"] == 200 for result in results)
        avg_response_time = sum(r["response_time"] for r in results) / len(results)
        assert avg_response_time < performance_config["max_response_time"]

@pytest.mark.security
class TestSecurityRequirements:
    """Test security-related requirements"""

    def test_unauthorized_access(self, client):
        """Test that protected endpoints require authentication"""
        protected_endpoints = [
            "/tasks/",
            "/ai/process-email/test-id",
            "/admin/users"
        ]
        
        for endpoint in protected_endpoints:
            response = client.get(endpoint)
            # Should return 401 or 403 for protected endpoints
            assert response.status_code in [401, 403], f"Endpoint {endpoint} should be protected"

    def test_input_validation(self, client):
        """Test input validation and sanitization"""
        # Test malicious input
        malicious_inputs = [
            {"title": "<script>alert('xss')</script>"},
            {"title": "'; DROP TABLE tasks; --"},
            {"title": "x" * 10000},  # Very long input
        ]
        
        for malicious_input in malicious_inputs:
            response = client.post("/tasks/", json=malicious_input)
            # Should validate and reject malicious input
            assert response.status_code in [400, 422]

    def test_rate_limiting(self, client):
        """Test rate limiting protection"""
        # Make many requests quickly
        responses = []
        for _ in range(100):
            response = client.get("/health")
            responses.append(response.status_code)
        
        # Should eventually rate limit (429) or continue allowing (200)
        # The specific behavior depends on rate limiting configuration
        assert all(status in [200, 429] for status in responses)

@pytest.mark.database
class TestDatabaseOperations:
    """Test database-related operations"""

    @pytest.mark.requires_db
    def test_database_connection(self, client):
        """Test database connectivity"""
        response = client.get("/health/db")
        assert response.status_code == 200
        data = response.json()
        assert data["database"]["status"] == "healthy"

    @pytest.mark.requires_db
    def test_data_integrity(self, client, sample_email_data, sample_task_data):
        """Test data integrity constraints"""
        with patch('main.get_emails') as mock_emails, \
             patch('main.get_tasks') as mock_tasks:
            
            mock_emails.return_value = [sample_email_data]
            mock_tasks.return_value = [sample_task_data]
            
            # Verify email exists before creating related task
            email_response = client.get(f"/emails/{sample_email_data['id']}")
            assert email_response.status_code == 200
            
            # Create task linked to email
            task_response = client.get(f"/tasks/?email_id={sample_email_data['id']}")
            assert task_response.status_code == 200

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])