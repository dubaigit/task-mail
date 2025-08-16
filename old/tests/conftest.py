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