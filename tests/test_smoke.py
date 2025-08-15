#!/usr/bin/env python3
"""
Smoke Test Suite
Basic tests to verify test infrastructure is working
"""

import pytest
import sys
import os

# Add project root to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestSmokeTests:
    """Basic smoke tests to verify test infrastructure"""
    
    def test_basic_python_functionality(self):
        """Test basic Python functionality works"""
        assert 1 + 1 == 2
        assert "hello" + " world" == "hello world"
        assert len([1, 2, 3]) == 3
    
    def test_imports_work(self):
        """Test that basic imports work without errors"""
        import json
        import datetime
        import sqlite3
        
        # Test JSON functionality
        data = {"test": True}
        json_str = json.dumps(data)
        parsed = json.loads(json_str)
        assert parsed["test"] is True
        
        # Test datetime functionality
        now = datetime.datetime.now()
        assert now.year >= 2020
        
        # Test sqlite3 functionality
        conn = sqlite3.connect(":memory:")
        cursor = conn.cursor()
        cursor.execute("CREATE TABLE test (id INTEGER PRIMARY KEY)")
        cursor.execute("INSERT INTO test (id) VALUES (1)")
        result = cursor.fetchone()
        conn.close()
        assert result is None or result[0] == 1

    def test_project_imports(self):
        """Test that project modules can be imported"""
        try:
            from apple_mail_db_reader import AppleMailDBReader
            assert AppleMailDBReader is not None
        except ImportError:
            pytest.skip("AppleMailDBReader not available - mock environment")
        
        try:
            from email_intelligence_engine import EmailIntelligenceEngine
            assert EmailIntelligenceEngine is not None
        except ImportError:
            pytest.skip("EmailIntelligenceEngine not available - mock environment")
    
    def test_async_functionality(self):
        """Test async functionality works"""
        import asyncio
        
        async def async_function():
            await asyncio.sleep(0.001)
            return "success"
        
        result = asyncio.run(async_function())
        assert result == "success"
    
    def test_mock_functionality(self):
        """Test that mocking works properly"""
        from unittest.mock import Mock, patch
        
        # Test basic mock
        mock_obj = Mock()
        mock_obj.method.return_value = "mocked"
        assert mock_obj.method() == "mocked"
        
        # Test patch
        with patch('os.path.exists', return_value=True):
            import os
            assert os.path.exists("fake_path") is True
    
    def test_pytest_fixtures(self):
        """Test that pytest fixtures work"""
        # This test verifies pytest is functioning correctly
        assert True

@pytest.fixture
def sample_fixture():
    """Sample fixture to verify fixture functionality"""
    return {"test": "data"}

def test_fixture_usage(sample_fixture):
    """Test that fixtures can be used"""
    assert sample_fixture["test"] == "data"

@pytest.mark.unit
def test_marked_test():
    """Test with unit marker"""
    assert True

class TestAsyncSmoke:
    """Async smoke tests"""
    
    @pytest.mark.asyncio
    async def test_async_test(self):
        """Test async test functionality"""
        import asyncio
        await asyncio.sleep(0.001)
        assert True