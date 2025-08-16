#!/usr/bin/env python3
"""
Global test configuration and fixtures for the email intelligence system.
Handles critical import conflicts and sets up test environment.
"""

import pytest
import sys
import os
from unittest.mock import MagicMock, patch

# Add project root to path
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# ============================================================================
# Critical aioredis Import Fix (must be done before any imports)
# ============================================================================

def patch_aioredis_import():
    """
    Fix the aioredis TimeoutError inheritance conflict that prevents test collection.
    
    Issue: aioredis.exceptions.TimeoutError inherits from both asyncio.TimeoutError 
    and builtins.TimeoutError, causing "duplicate base class TimeoutError" error.
    
    Solution: Mock aioredis during imports to avoid the conflict.
    """
    original_import = __import__
    
    def custom_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == 'aioredis' or name.startswith('aioredis.'):
            # Create mock aioredis to avoid TimeoutError conflict
            mock_aioredis = MagicMock()
            mock_aioredis.TimeoutError = TimeoutError  # Use builtin TimeoutError
            mock_aioredis.Redis = MagicMock()
            mock_aioredis.ConnectionError = ConnectionError
            return mock_aioredis
        return original_import(name, globals, locals, fromlist, level)
    
    # Monkey-patch the import function
    import builtins
    builtins.__import__ = custom_import

# Apply the patch immediately
patch_aioredis_import()

# ============================================================================
# Global Test Configuration 
# ============================================================================

# Set test environment variables
os.environ['TESTING'] = 'true'
os.environ['APPLE_MAIL_DB_PATH'] = ':memory:'  # Use in-memory SQLite for tests
os.environ['REDIS_URL'] = 'redis://localhost:6379/1'  # Test Redis DB
os.environ['LOG_LEVEL'] = 'WARNING'  # Reduce log noise during tests

# ============================================================================
# Global Fixtures
# ============================================================================

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    """Setup global test environment - runs once per test session"""
    # Test environment initialization
    
    # Ensure all critical modules can be imported
    try:
        import database_models
        import email_intelligence_engine
        # Core modules imported successfully
    except Exception as e:
        # Failed to import core modules - logged to test framework
        raise
        
    yield
    
    # Test environment cleanup complete

@pytest.fixture(autouse=True)
def isolate_tests():
    """Ensure each test runs in isolation with clean mocks"""
    # Reset any global state before each test
    with patch.dict('os.environ', {}, clear=False):
        # Preserve essential test environment variables
        os.environ.setdefault('TESTING', 'true')
        os.environ.setdefault('APPLE_MAIL_DB_PATH', ':memory:')
        yield

@pytest.fixture
def mock_redis():
    """Provide a mocked Redis connection for tests"""
    mock_redis = MagicMock()
    mock_redis.get = MagicMock(return_value=None)
    mock_redis.set = MagicMock(return_value=True)
    mock_redis.delete = MagicMock(return_value=1)
    mock_redis.exists = MagicMock(return_value=False)
    mock_redis.ping = MagicMock(return_value=True)
    return mock_redis

# ============================================================================
# Enhanced Testing Fixtures for Comprehensive Coverage
# ============================================================================

@pytest.fixture
def sample_email_data():
    """Sample email data for testing"""
    return {
        "id": "test-email-001",
        "subject": "Test Email Subject",
        "sender": "sender@example.com",
        "recipient": "recipient@example.com",
        "cc_addresses": ["cc1@example.com", "cc2@example.com"],
        "bcc_addresses": [],
        "content": "This is a test email content with some important information.",
        "received_date": "2025-08-16T10:00:00Z",
        "is_read": False,
        "is_flagged": False,
        "folder": "INBOX",
        "message_id": "<test-message-001@example.com>",
        "thread_id": "thread-001",
        "importance": "Normal",
        "has_attachments": False,
        "raw_headers": '{"Content-Type": "text/plain"}',
        "body_preview": "This is a test email content with...",
        "to_addresses": ["recipient@example.com"],
        "from_address": "sender@example.com"
    }

@pytest.fixture
def task_email_data():
    """Email data that should generate a task"""
    return {
        "id": "task-email-001",
        "subject": "Action Required: Please review the quarterly report",
        "sender": "manager@company.com",
        "recipient": "employee@company.com",
        "cc_addresses": ["team@company.com"],
        "bcc_addresses": [],
        "content": "Hi team,\n\nCould you please review the attached quarterly report and provide your feedback by Friday?\n\nThanks,\nManager",
        "received_date": "2025-08-16T09:00:00Z",
        "is_read": False,
        "is_flagged": True,
        "folder": "INBOX",
        "message_id": "<task-message-001@company.com>",
        "thread_id": "task-thread-001",
        "importance": "High",
        "has_attachments": True,
        "raw_headers": '{"Content-Type": "text/plain", "Priority": "High"}',
        "body_preview": "Could you please review the attached...",
        "to_addresses": ["employee@company.com"],
        "from_address": "manager@company.com"
    }

@pytest.fixture
def sample_task_data():
    """Sample task data for testing"""
    return {
        "task_id": "task-001",
        "email_id": "test-email-001",
        "title": "Review quarterly report",
        "description": "Please review the attached quarterly report and provide feedback",
        "category": "REVIEW",
        "priority": "HIGH",
        "status": "pending",
        "assignee": "employee@company.com",
        "due_date": "2025-08-18T17:00:00Z",
        "estimated_duration": 60,
        "dependencies": [],
        "confidence_score": 0.95,
        "created_date": "2025-08-16T10:00:00Z",
        "updated_date": "2025-08-16T10:00:00Z"
    }

@pytest.fixture
def multiple_emails_data():
    """Multiple emails for list testing"""
    return [
        {
            "id": f"email-{i:03d}",
            "subject": f"Test Email {i}",
            "sender": f"sender{i}@example.com",
            "recipient": "test@example.com",
            "cc_addresses": [],
            "bcc_addresses": [],
            "content": f"Content of email {i}",
            "received_date": f"2025-08-{16-i:02d}T10:00:00Z",
            "is_read": i % 2 == 0,
            "is_flagged": i % 3 == 0,
            "folder": "INBOX",
            "message_id": f"<message-{i:03d}@example.com>",
            "thread_id": f"thread-{i:03d}",
            "importance": "Normal",
            "has_attachments": i % 4 == 0,
            "raw_headers": '{"Content-Type": "text/plain"}',
            "body_preview": f"Content of email {i}...",
            "to_addresses": ["test@example.com"],
            "from_address": f"sender{i}@example.com"
        }
        for i in range(1, 11)
    ]

@pytest.fixture
def mock_openai_client():
    """Mock OpenAI client for AI testing"""
    mock_client = MagicMock()
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '{"category": "REVIEW", "priority": "HIGH", "confidence": 0.95}'
    mock_client.chat.completions.create.return_value = mock_response
    return mock_client

@pytest.fixture
def auth_headers():
    """Authentication headers for API testing"""
    return {"Authorization": "Bearer test-token-123"}

@pytest.fixture
def performance_config():
    """Performance testing configuration"""
    return {
        "max_response_time": 2.0,  # seconds
        "max_memory_usage": 100,   # MB
        "max_cpu_usage": 80,       # percentage
        "concurrent_requests": 10
    }

# ============================================================================
# Pytest Configuration Overrides
# ============================================================================

def pytest_configure(config):
    """Configure pytest with custom settings"""
    # Add custom markers
    config.addinivalue_line("markers", "unit: Unit tests - fast, isolated tests")
    config.addinivalue_line("markers", "integration: Integration tests - slower, requires external services")
    config.addinivalue_line("markers", "slow: Slow running tests")
    config.addinivalue_line("markers", "api: API endpoint tests")
    config.addinivalue_line("markers", "db: Database tests")
    config.addinivalue_line("markers", "applescript: AppleScript integration tests")

def pytest_collection_modifyitems(config, items):
    """Modify test collection to handle special cases"""
    for item in items:
        # Auto-mark database tests
        if 'database' in item.name.lower() or 'db' in item.name.lower():
            item.add_marker(pytest.mark.db)
        
        # Auto-mark slow tests
        if any(keyword in item.name.lower() for keyword in ['large', 'batch', 'performance']):
            item.add_marker(pytest.mark.slow)