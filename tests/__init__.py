"""
Test package initialization
Sets up test environment for Email Intelligence System
"""
import os
import sys
from unittest.mock import patch, MagicMock

# Add project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Mock the database path for all tests
TEST_DB_PATH = ":memory:"  # Use in-memory SQLite for tests

# Patch the database path globally for tests
def setup_test_db():
    """Setup test database configuration"""
    os.environ['APPLE_MAIL_DB_PATH'] = TEST_DB_PATH
    return TEST_DB_PATH

# Auto-setup on import
setup_test_db()
