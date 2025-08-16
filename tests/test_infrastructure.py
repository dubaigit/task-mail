"""
Infrastructure validation tests for backend
Simple tests to verify testing setup is working correctly
"""
import pytest
from unittest.mock import Mock


def test_pytest_is_working():
    """Test that pytest is properly configured"""
    assert True
    assert 1 + 1 == 2
    assert "hello" in "hello world"


def test_fixtures_are_available(sample_email_data, sample_task_data):
    """Test that fixtures are available and working"""
    assert sample_email_data is not None
    assert sample_email_data["id"] == "test-email-001"
    assert sample_email_data["subject"] == "Test Email Subject"
    
    assert sample_task_data is not None
    assert sample_task_data["task_id"] == "task-001"
    assert sample_task_data["title"] == "Review quarterly report"


def test_mock_functionality():
    """Test that mocking is working"""
    mock_function = Mock()
    mock_function.return_value = "mocked_result"
    
    result = mock_function("test_arg")
    
    assert result == "mocked_result"
    mock_function.assert_called_once_with("test_arg")


@pytest.mark.asyncio
async def test_async_functionality():
    """Test async testing capabilities"""
    async def async_operation():
        return "async_result"
    
    result = await async_operation()
    assert result == "async_result"


def test_parametrized_tests(sample_email_data, multiple_emails_data):
    """Test parametrized functionality"""
    test_data = [
        (sample_email_data, "test-email-001"),
        (multiple_emails_data[0], "email-001"),
    ]
    
    for email_data, expected_id in test_data:
        assert email_data["id"] == expected_id


def test_markers_are_working():
    """Test that pytest markers are configured"""
    # This test itself validates that the testing infrastructure
    # can handle marker-based test categorization
    assert hasattr(pytest, "mark")


class TestClassBasedTests:
    """Test class-based test organization"""
    
    def test_class_method_works(self):
        """Test that class-based tests work"""
        assert True
    
    def test_class_with_fixtures(self, mock_redis):
        """Test that fixtures work in class methods"""
        assert mock_redis is not None
        mock_redis.get.assert_not_called()
        
        # Test the mock
        result = mock_redis.get("test_key")
        assert result is None
        mock_redis.get.assert_called_once_with("test_key")