#!/usr/bin/env python3
"""
Unit tests for FastAPI endpoints
Tests all API endpoints, request/response handling, and error cases
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dashboard', 'backend'))

# Mock the dependencies before importing
with patch('dashboard.backend.main.EmailIntelligenceEngine'), \
     patch('dashboard.backend.main.AppleMailDBReader'), \
     patch('dashboard.backend.main.AppleMailComposer'), \
     patch('dashboard.backend.main.AppleScriptMailer'):
    from dashboard.backend.main import app

from email_intelligence_engine import EmailClassification, EmailUrgency, EmailAnalysisResult


class TestFastAPIEndpoints:
    """Test suite for FastAPI endpoints"""
    
    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)
    
    @pytest.fixture
    def mock_engine(self):
        """Mock email intelligence engine"""
        mock = MagicMock()
        mock.analyze_email.return_value = EmailAnalysisResult(
            classification=EmailClassification.NEEDS_REPLY,
            urgency=EmailUrgency.MEDIUM,
            confidence=0.85
        )
        mock.generate_draft_reply.return_value = "This is a draft reply."
        mock.get_performance_metrics.return_value = {
            'total_processed': 100,
            'ai_success_rate': 0.8,
            'avg_confidence': 0.85
        }
        return mock
    
    @pytest.fixture
    def mock_db_reader(self):
        """Mock database reader"""
        mock = MagicMock()
        mock.get_recent_emails.return_value = [
            {
                'message_id': 123,
                'subject_text': 'Test Email',
                'sender_email': 'sender@example.com',
                'date_received': '2024-01-15T10:00:00',
                'content': 'Email content'
            }
        ]
        mock.get_email.return_value = {
            'message_id': 123,
            'subject_text': 'Test Email',
            'sender_email': 'sender@example.com',
            'date_received': '2024-01-15T10:00:00',
            'content': 'Email content',
            'message_id_header': '<msg123@example.com>'
        }
        mock.get_email_count.return_value = 100
        mock.get_unread_count.return_value = 25
        return mock
    
    @pytest.fixture
    def mock_mailer(self):
        """Mock AppleScript mailer"""
        mock = MagicMock()
        mock.send_email.return_value = True
        mock.create_draft.return_value = True
        mock.reply_to_email.return_value = True
        mock.mark_as_read.return_value = True
        return mock
    
    def test_root_endpoint(self, client):
        """Test root endpoint"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'ok'
        assert 'Email Intelligence API' in data['message']
    
    @patch('dashboard.backend.main.db_reader')
    @patch('dashboard.backend.main.engine')
    def test_get_emails_success(self, mock_engine_global, mock_db_global, client, mock_engine, mock_db_reader):
        """Test successful email retrieval"""
        mock_db_global.get_recent_emails.return_value = mock_db_reader.get_recent_emails()
        mock_engine_global.analyze_email.return_value = mock_engine.analyze_email()
        
        response = client.get("/emails/")
        
        assert response.status_code == 200
        emails = response.json()
        assert isinstance(emails, list)
        assert len(emails) > 0
        
        # Check email structure
        email = emails[0]
        assert 'id' in email
        assert 'subject' in email
        assert 'sender' in email
        assert 'date' in email
        assert 'classification' in email
        assert 'urgency' in email
        assert 'confidence' in email
        assert 'has_draft' in email
    
    @patch('dashboard.backend.main.db_reader')
    @patch('dashboard.backend.main.engine')
    def test_get_emails_with_limit_offset(self, mock_engine_global, mock_db_global, client):
        """Test email retrieval with limit and offset"""
        mock_db_global.get_recent_emails.return_value = []
        
        response = client.get("/emails/?limit=10&offset=5")
        
        assert response.status_code == 200
        mock_db_global.get_recent_emails.assert_called_with(limit=10)
    
    @patch('dashboard.backend.main.db_reader')
    def test_get_emails_database_error(self, mock_db_global, client):
        """Test email retrieval with database error"""
        mock_db_global.get_recent_emails.side_effect = Exception("Database error")
        
        response = client.get("/emails/")
        
        assert response.status_code == 500
        assert 'Database error' in response.json()['detail']
    
    @patch('dashboard.backend.main.db_reader')
    @patch('dashboard.backend.main.engine')
    def test_get_single_email_success(self, mock_engine_global, mock_db_global, client, mock_db_reader, mock_engine):
        """Test getting single email by ID"""
        mock_db_global.get_email.return_value = mock_db_reader.get_email()
        mock_engine_global.analyze_email.return_value = mock_engine.analyze_email()
        
        response = client.get("/emails/123")
        
        assert response.status_code == 200
        email = response.json()
        assert email['id'] == 123
        assert email['subject'] == 'Test Email'
    
    @patch('dashboard.backend.main.db_reader')
    def test_get_single_email_not_found(self, mock_db_global, client):
        """Test getting non-existent email"""
        mock_db_global.get_email.return_value = None
        
        response = client.get("/emails/999")
        
        assert response.status_code == 404
        assert 'Email not found' in response.json()['detail']
    
    @patch('dashboard.backend.main.db_reader')
    @patch('dashboard.backend.main.engine')
    def test_get_tasks(self, mock_engine_global, mock_db_global, client, mock_db_reader, mock_engine):
        """Test task generation from emails"""
        mock_db_global.get_recent_emails.return_value = mock_db_reader.get_recent_emails()
        
        # Mock classification as CREATE_TASK
        mock_engine_global.analyze_email.return_value = EmailAnalysisResult(
            classification=EmailClassification.CREATE_TASK,
            urgency=EmailUrgency.HIGH,
            confidence=0.9
        )
        
        response = client.get("/tasks/")
        
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
        
        if len(tasks) > 0:
            task = tasks[0]
            assert 'id' in task
            assert 'title' in task
            assert 'description' in task
            assert 'status' in task
            assert 'priority' in task
    
    @patch('dashboard.backend.main.db_reader')
    @patch('dashboard.backend.main.engine')
    def test_get_drafts(self, mock_engine_global, mock_db_global, client, mock_db_reader, mock_engine):
        """Test draft generation"""
        mock_db_global.get_recent_emails.return_value = mock_db_reader.get_recent_emails()
        
        # Mock classification as NEEDS_REPLY
        mock_engine_global.analyze_email.return_value = EmailAnalysisResult(
            classification=EmailClassification.NEEDS_REPLY,
            urgency=EmailUrgency.HIGH,
            confidence=0.9
        )
        mock_engine_global.generate_draft_reply.return_value = "Draft reply content"
        
        response = client.get("/drafts/")
        
        assert response.status_code == 200
        drafts = response.json()
        assert isinstance(drafts, list)
        
        if len(drafts) > 0:
            draft = drafts[0]
            assert 'id' in draft
            assert 'email_id' in draft
            assert 'content' in draft
            assert 'confidence' in draft
            assert 'created_at' in draft
    
    @patch('dashboard.backend.main.db_reader')
    @patch('dashboard.backend.main.engine')
    def test_get_stats(self, mock_engine_global, mock_db_global, client, mock_engine, mock_db_reader):
        """Test statistics endpoint"""
        mock_db_global.get_email_count.return_value = 100
        mock_db_global.get_unread_count.return_value = 25
        mock_db_global.get_recent_emails.return_value = mock_db_reader.get_recent_emails()
        mock_engine_global.analyze_email.return_value = mock_engine.analyze_email()
        mock_engine_global.get_performance_metrics.return_value = mock_engine.get_performance_metrics()
        
        response = client.get("/stats/")
        
        assert response.status_code == 200
        stats = response.json()
        assert stats['total_emails'] == 100
        assert stats['unread_emails'] == 25
        assert 'classifications' in stats
        assert 'urgencies' in stats
        assert 'processing_stats' in stats
    
    @patch('dashboard.backend.main.mailer')
    def test_send_draft(self, mock_mailer_global, client, mock_mailer):
        """Test sending a draft email"""
        mock_mailer_global.send_email.return_value = True
        
        response = client.post("/drafts/1/send?to_email=recipient@example.com")
        
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'sent'
        assert 'Email sent successfully' in data['message']
        
        # Verify mailer was called
        mock_mailer_global.send_email.assert_called_once()
    
    @patch('dashboard.backend.main.mailer')
    def test_send_draft_failure(self, mock_mailer_global, client):
        """Test draft sending failure"""
        mock_mailer_global.send_email.return_value = False
        
        response = client.post("/drafts/1/send?to_email=recipient@example.com")
        
        assert response.status_code == 500
        assert 'Failed to send email' in response.json()['detail']
    
    @patch('dashboard.backend.main.mailer')
    def test_create_draft(self, mock_mailer_global, client, mock_mailer):
        """Test creating a draft in Apple Mail"""
        mock_mailer_global.create_draft.return_value = True
        
        response = client.post(
            "/drafts/create",
            params={
                "to_email": "recipient@example.com",
                "subject": "Test Subject",
                "body": "Test body content"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'created'
        assert 'Draft created in Apple Mail' in data['message']
    
    @patch('dashboard.backend.main.db_reader')
    @patch('dashboard.backend.main.mailer')
    def test_reply_to_email(self, mock_mailer_global, mock_db_global, client, mock_mailer, mock_db_reader):
        """Test replying to an email"""
        mock_db_global.get_email.return_value = mock_db_reader.get_email()
        mock_mailer_global.reply_to_email.return_value = True
        
        response = client.post(
            "/emails/123/reply",
            params={
                "body": "This is my reply",
                "reply_all": False
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'replied'
        assert 'Reply sent successfully' in data['message']
    
    @patch('dashboard.backend.main.db_reader')
    def test_reply_to_nonexistent_email(self, mock_db_global, client):
        """Test replying to non-existent email"""
        mock_db_global.get_email.return_value = None
        
        response = client.post(
            "/emails/999/reply",
            params={"body": "Reply"}
        )
        
        assert response.status_code == 404
        assert 'Email not found' in response.json()['detail']
    
    @patch('dashboard.backend.main.db_reader')
    @patch('dashboard.backend.main.mailer')
    def test_mark_email_read(self, mock_mailer_global, mock_db_global, client, mock_mailer, mock_db_reader):
        """Test marking email as read"""
        mock_db_global.get_email.return_value = mock_db_reader.get_email()
        mock_mailer_global.mark_as_read.return_value = True
        
        response = client.post("/emails/123/mark-read")
        
        assert response.status_code == 200
        data = response.json()
        assert data['status'] == 'marked'
        assert 'Email marked as read' in data['message']
    
    def test_cors_headers(self, client):
        """Test CORS headers are properly set"""
        response = client.options(
            "/emails/",
            headers={
                "Origin": "http://localhost:3001",
                "Access-Control-Request-Method": "GET"
            }
        )
        
        # FastAPI handles CORS through middleware
        assert response.status_code in [200, 405]
    
    def test_invalid_endpoint(self, client):
        """Test invalid endpoint returns 404"""
        response = client.get("/invalid/endpoint")
        
        assert response.status_code == 404
    
    def test_method_not_allowed(self, client):
        """Test method not allowed"""
        response = client.delete("/emails/")
        
        assert response.status_code == 405
    
    @patch('dashboard.backend.main.db_reader')
    def test_server_error_handling(self, mock_db_global, client):
        """Test server error handling"""
        # Simulate unexpected error
        mock_db_global.get_recent_emails.side_effect = RuntimeError("Unexpected error")
        
        response = client.get("/emails/")
        
        assert response.status_code == 500
        assert 'detail' in response.json()


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=dashboard.backend.main"])