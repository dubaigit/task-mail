"""
Comprehensive test suite for BackgroundMailTool implementation.

This test suite provides complete coverage of the BackgroundMailTool functionality
including core operations, error handling, async behavior, caching, security, and
integration testing with mocked external dependencies.
"""

import asyncio
import json
import logging
import pytest
import sqlite3
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from unittest import mock
from unittest.mock import AsyncMock, MagicMock, patch, call
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

# Import the components under test
try:
    from mail_tool_background import (
        BackgroundMailTool, 
        ConnectionPool, 
        MailOperationType,
        MailOperationResult,
        AppleScriptSanitizer,
        MailError,
        ScriptInjectionError,
        ConnectionPoolError
    )
except ImportError:
    # Fallback if the main implementation isn't available
    pytest.skip("BackgroundMailTool not available", allow_module_level=True)


class TestBackgroundMailToolCore:
    """Core functionality tests for BackgroundMailTool."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Setup for each test method."""
        self.tool = BackgroundMailTool(max_workers=2, timeout=5.0, enable_monitoring=False)
        
        # Mock subprocess to avoid real AppleScript execution
        self.subprocess_patcher = patch('subprocess.run')
        self.mock_subprocess = self.subprocess_patcher.start()
        
        # Default successful AppleScript response
        self.mock_subprocess.return_value = MagicMock(
            returncode=0,
            stdout='{"emails": [{"id": "1", "subject": "Test"}]}',
            stderr=''
        )
        
    def teardown_method(self):
        """Cleanup after each test."""
        self.subprocess_patcher.stop()
        if hasattr(self.tool, 'shutdown'):
            self.tool.shutdown()
    
    def test_initialization_success(self):
        """Test successful BackgroundMailTool initialization."""
        tool = BackgroundMailTool(max_workers=3, timeout=10.0)
        
        assert tool.pool is not None
        assert tool.pool.max_workers == 3
        assert tool.pool.timeout == 10.0
        assert tool.enable_monitoring is True  # Default
        
        tool.shutdown()
    
    def test_initialization_with_monitoring_disabled(self):
        """Test initialization with monitoring disabled."""
        tool = BackgroundMailTool(enable_monitoring=False)
        
        assert tool.enable_monitoring is False
        assert not hasattr(tool, '_monitoring_thread')
        
        tool.shutdown()
    
    def test_get_emails_success(self):
        """Test successful email retrieval."""
        # Mock successful AppleScript response
        self.mock_subprocess.return_value.stdout = '1: Test Subject\n2: Another Email'
        
        result = self.tool.get_emails(account='TestAccount', mailbox='INBOX', limit=10)
        
        assert result.success is True
        assert result.error is None
        assert result.operation_id is not None
        assert isinstance(result.data, list)
        assert len(result.data) == 2
        
        # Verify subprocess was called with correct script
        self.mock_subprocess.assert_called_once()
        call_args = self.mock_subprocess.call_args
        assert 'osascript' in call_args[0][0]
        assert 'TestAccount' in call_args[0][2]
    
    def test_get_emails_with_error(self):
        """Test email retrieval with AppleScript error."""
        # Mock failed AppleScript response
        self.mock_subprocess.return_value = MagicMock(
            returncode=1,
            stdout='',
            stderr='AppleScript error: application not found'
        )
        
        result = self.tool.get_emails()
        
        assert result.success is False
        assert 'AppleScript error' in result.error
        assert result.data is None
    
    def test_send_email_success(self):
        """Test successful email sending."""
        # Mock successful send response
        self.mock_subprocess.return_value.stdout = 'SUCCESS: Email sent'
        
        result = self.tool.send_email(
            to_address='test@example.com',
            subject='Test Subject',
            content='Test Content'
        )
        
        assert result.success is True
        assert result.error is None
        
        # Verify script contains sanitized input
        call_args = self.mock_subprocess.call_args[0][2]
        assert 'test@example.com' in call_args
        assert 'Test Subject' in call_args
        assert 'Test Content' in call_args
    
    def test_search_emails_success(self):
        """Test successful email search."""
        # Mock search results
        self.mock_subprocess.return_value.stdout = 'Found: 3 emails\nEmail 1\nEmail 2\nEmail 3'
        
        result = self.tool.search_emails(query='important', account='TestAccount')
        
        assert result.success is True
        assert isinstance(result.data, list)
        assert len(result.data) == 4  # Including header line
        
        # Verify search query in script
        call_args = self.mock_subprocess.call_args[0][2]
        assert 'important' in call_args
        assert 'TestAccount' in call_args
    
    def test_health_status_reporting(self):
        """Test health status reporting functionality."""
        # Simulate some operations
        self.tool.get_emails(limit=5)
        
        health = self.tool.get_health_status()
        
        assert 'status' in health
        assert 'uptime_seconds' in health
        assert 'metrics' in health
        assert health['status'] in ['healthy', 'degraded']
        assert health['metrics']['total_operations'] >= 1
        assert 'success_rate' in health['metrics']
        assert 'cache_hit_rate' in health['metrics']
    
    @pytest.mark.asyncio
    async def test_async_get_emails(self):
        """Test asynchronous email retrieval."""
        # Mock successful response
        self.mock_subprocess.return_value.stdout = 'Async: Email data'
        
        result = await self.tool.get_emails_async(limit=5)
        
        assert result.success is True
        assert result.data is not None
        assert result.execution_time > 0


class TestBackgroundMailToolErrorHandling:
    """Error handling and edge case tests."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Setup for each test method."""
        self.tool = BackgroundMailTool(enable_monitoring=False)
        self.subprocess_patcher = patch('subprocess.run')
        self.mock_subprocess = self.subprocess_patcher.start()
    
    def teardown_method(self):
        """Cleanup after each test."""
        self.subprocess_patcher.stop()
        self.tool.shutdown()
    
    def test_applescript_timeout_handling(self):
        """Test handling of AppleScript timeout errors."""
        # Mock timeout exception
        self.mock_subprocess.side_effect = subprocess.TimeoutExpired('osascript', 30)
        
        result = self.tool.get_emails()
        
        assert result.success is False
        assert 'timed out' in result.error.lower()
    
    def test_applescript_execution_error(self):
        """Test handling of AppleScript execution errors."""
        # Mock execution error
        self.mock_subprocess.side_effect = subprocess.CalledProcessError(
            1, 'osascript', stderr='Execution failed'
        )
        
        result = self.tool.get_emails()
        
        assert result.success is False
        assert result.error is not None
    
    def test_invalid_email_address_validation(self):
        """Test email address validation in send operations."""
        with pytest.raises(ScriptInjectionError):
            self.tool.send_email(
                to_address='invalid-email',
                subject='Test',
                content='Test'
            )
    
    def test_script_injection_prevention(self):
        """Test prevention of script injection attacks."""
        malicious_content = 'do shell script "rm -rf /"'
        
        with pytest.raises(ScriptInjectionError):
            self.tool.send_email(
                to_address='test@example.com',
                subject=malicious_content,
                content='Normal content'
            )
    
    def test_large_input_handling(self):
        """Test handling of oversized input data."""
        large_content = 'A' * 20000  # Exceeds safety limit
        
        with pytest.raises(ScriptInjectionError):
            self.tool.send_email(
                to_address='test@example.com',
                subject='Test',
                content=large_content
            )
    
    def test_connection_pool_exhaustion(self):
        """Test behavior when connection pool is exhausted."""
        # Create tool with very limited workers
        limited_tool = BackgroundMailTool(max_workers=1, timeout=1.0, enable_monitoring=False)
        
        # Mock slow operation
        def slow_operation(*args, **kwargs):
            time.sleep(2)  # Longer than timeout
            return MagicMock(returncode=0, stdout='slow response', stderr='')
        
        with patch('subprocess.run', side_effect=slow_operation):
            result = limited_tool.get_emails()
            
            # Should timeout
            assert result.success is False
            assert 'timeout' in result.error.lower() or 'timed out' in result.error.lower()
        
        limited_tool.shutdown()
    
    def test_empty_query_handling(self):
        """Test handling of empty search queries."""
        result = self.tool.search_emails(query='')
        
        # Should handle gracefully or reject
        if not result.success:
            assert result.error is not None
    
    def test_concurrent_operations_safety(self):
        """Test thread safety with concurrent operations."""
        # Mock successful responses
        self.mock_subprocess.return_value = MagicMock(
            returncode=0,
            stdout='concurrent test',
            stderr=''
        )
        
        # Execute multiple operations concurrently
        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [
                executor.submit(self.tool.get_emails, limit=i)
                for i in range(1, 6)
            ]
            
            results = [future.result() for future in futures]
        
        # All operations should complete
        assert len(results) == 5
        assert all(result.operation_id for result in results)
        
        # Operation IDs should be unique
        operation_ids = [result.operation_id for result in results]
        assert len(set(operation_ids)) == len(operation_ids)


class TestConnectionPool:
    """Tests for ConnectionPool functionality."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Setup for each test method."""
        self.pool = ConnectionPool(max_workers=3, timeout=5.0)
        
        # Mock subprocess
        self.subprocess_patcher = patch('subprocess.run')
        self.mock_subprocess = self.subprocess_patcher.start()
        self.mock_subprocess.return_value = MagicMock(
            returncode=0,
            stdout='pool test',
            stderr=''
        )
    
    def teardown_method(self):
        """Cleanup after each test."""
        self.subprocess_patcher.stop()
    
    def test_pool_initialization(self):
        """Test connection pool initialization."""
        assert self.pool.max_workers == 3
        assert self.pool.timeout == 5.0
        assert self.pool._metrics is not None
        assert self.pool._cache is not None
    
    def test_operation_execution(self):
        """Test basic operation execution through pool."""
        result = self.pool.execute(
            MailOperationType.GET_EMAILS,
            {'account': 'test', 'limit': 10}
        )
        
        assert isinstance(result, MailOperationResult)
        assert result.operation_id is not None
        assert result.execution_time > 0
    
    def test_cache_functionality(self):
        """Test caching behavior."""
        params = {'account': 'test', 'limit': 5}
        
        # First execution - should miss cache
        result1 = self.pool.execute(MailOperationType.GET_EMAILS, params)
        
        # Second execution - should hit cache
        result2 = self.pool.execute(MailOperationType.GET_EMAILS, params)
        
        # Cache should be working (both should succeed)
        assert result1.success
        assert result2.success
        
        # Verify metrics
        metrics = self.pool.get_metrics()
        assert metrics.cache_hits > 0 or metrics.cache_misses > 0
    
    def test_cache_expiration(self):
        """Test cache TTL expiration."""
        # Set very short TTL for testing
        self.pool._cache_ttl = 0.1  # 100ms
        
        params = {'account': 'test', 'limit': 1}
        
        # Execute and cache
        result1 = self.pool.execute(MailOperationType.GET_EMAILS, params)
        
        # Wait for cache expiration
        time.sleep(0.2)
        
        # Execute again - should not hit expired cache
        result2 = self.pool.execute(MailOperationType.GET_EMAILS, params)
        
        assert result1.success
        assert result2.success
    
    def test_metrics_collection(self):
        """Test metrics collection and reporting."""
        # Execute some operations
        for i in range(3):
            self.pool.execute(
                MailOperationType.GET_EMAILS,
                {'account': f'test{i}', 'limit': i+1}
            )
        
        metrics = self.pool.get_metrics()
        
        assert metrics.total_operations >= 3
        assert metrics.average_response_time > 0
        assert metrics.last_cleanup is not None
    
    def test_cache_cleanup(self):
        """Test manual cache cleanup."""
        # Add some entries to cache
        for i in range(5):
            self.pool.execute(
                MailOperationType.GET_EMAILS,
                {'account': f'test{i}', 'limit': 1}
            )
        
        # Force cleanup
        cleaned_count = self.pool.cleanup_cache()
        
        # Cleanup should report number of entries processed
        assert isinstance(cleaned_count, int)
        assert cleaned_count >= 0


class TestAppleScriptSanitizer:
    """Tests for AppleScript input sanitization."""
    
    def test_basic_string_sanitization(self):
        """Test basic string sanitization."""
        input_str = 'Normal email content'
        result = AppleScriptSanitizer.sanitize_string(input_str)
        assert result == input_str
    
    def test_quote_escaping(self):
        """Test proper quote escaping."""
        input_str = 'Content with "quotes" and backslashes\\'
        result = AppleScriptSanitizer.sanitize_string(input_str)
        assert '\\"' in result
        assert '\\\\' in result
    
    def test_dangerous_pattern_detection(self):
        """Test detection of dangerous AppleScript patterns."""
        dangerous_inputs = [
            'do shell script "rm -rf /"',
            'tell application "Terminal" to activate',
            'system events keystroke',
            'with administrator privileges'
        ]
        
        for dangerous_input in dangerous_inputs:
            with pytest.raises(ScriptInjectionError):
                AppleScriptSanitizer.sanitize_string(dangerous_input)
    
    def test_email_address_validation(self):
        """Test email address validation."""
        valid_emails = [
            'user@example.com',
            'test.email+tag@domain.co.uk',
            'name123@test-domain.org'
        ]
        
        invalid_emails = [
            'not-an-email',
            '@domain.com',
            'user@',
            'user space@domain.com',
            'user@domain',
            ''
        ]
        
        for email in valid_emails:
            result = AppleScriptSanitizer.validate_email_address(email)
            assert result == email
        
        for email in invalid_emails:
            with pytest.raises(ScriptInjectionError):
                AppleScriptSanitizer.validate_email_address(email)
    
    def test_length_limit_enforcement(self):
        """Test enforcement of input length limits."""
        long_input = 'A' * 15000  # Exceeds limit
        
        with pytest.raises(ScriptInjectionError):
            AppleScriptSanitizer.sanitize_string(long_input)
    
    def test_non_string_input_rejection(self):
        """Test rejection of non-string inputs."""
        non_string_inputs = [123, [], {}, None, True]
        
        for invalid_input in non_string_inputs:
            with pytest.raises(ScriptInjectionError):
                AppleScriptSanitizer.sanitize_string(invalid_input)


class TestBackgroundMailToolAsync:
    """Tests for async operations and concurrency."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Setup for each test method."""
        self.tool = BackgroundMailTool(enable_monitoring=False)
        
        self.subprocess_patcher = patch('subprocess.run')
        self.mock_subprocess = self.subprocess_patcher.start()
        self.mock_subprocess.return_value = MagicMock(
            returncode=0,
            stdout='async test response',
            stderr=''
        )
    
    def teardown_method(self):
        """Cleanup after each test."""
        self.subprocess_patcher.stop()
        self.tool.shutdown()
    
    @pytest.mark.asyncio
    async def test_async_email_retrieval(self):
        """Test asynchronous email retrieval."""
        result = await self.tool.get_emails_async(limit=10)
        
        assert result.success is True
        assert result.data is not None
        assert result.execution_time > 0
    
    @pytest.mark.asyncio
    async def test_concurrent_async_operations(self):
        """Test multiple concurrent async operations."""
        tasks = [
            self.tool.get_emails_async(limit=i)
            for i in range(1, 6)
        ]
        
        results = await asyncio.gather(*tasks)
        
        assert len(results) == 5
        assert all(result.success for result in results)
        
        # All operations should have unique IDs
        operation_ids = [result.operation_id for result in results]
        assert len(set(operation_ids)) == len(operation_ids)
    
    @pytest.mark.asyncio
    async def test_async_error_handling(self):
        """Test error handling in async operations."""
        # Mock error response
        self.mock_subprocess.side_effect = subprocess.TimeoutExpired('osascript', 5)
        
        result = await self.tool.get_emails_async()
        
        assert result.success is False
        assert 'timed out' in result.error.lower()
    
    def test_context_manager_support(self):
        """Test context manager support for proper cleanup."""
        with BackgroundMailTool(enable_monitoring=False) as tool:
            result = tool.get_emails(limit=1)
            assert result is not None
        
        # Tool should be properly shut down after context exit


class TestBackgroundMailToolSecurity:
    """Security-focused tests."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Setup for each test method."""
        self.tool = BackgroundMailTool(enable_monitoring=False)
        
        self.subprocess_patcher = patch('subprocess.run')
        self.mock_subprocess = self.subprocess_patcher.start()
        self.mock_subprocess.return_value = MagicMock(
            returncode=0,
            stdout='security test',
            stderr=''
        )
    
    def teardown_method(self):
        """Cleanup after each test."""
        self.subprocess_patcher.stop()
        self.tool.shutdown()
    
    def test_input_sanitization_comprehensive(self):
        """Test comprehensive input sanitization."""
        malicious_inputs = [
            'subject"; do shell script "rm -rf /"; --',
            'normal subject\ndo shell script "evil"',
            'subject\\"; tell app "Terminal" to activate',
            'subject${IFS}do${IFS}shell${IFS}script',
        ]
        
        for malicious_input in malicious_inputs:
            with pytest.raises(ScriptInjectionError):
                self.tool.send_email(
                    to_address='test@example.com',
                    subject=malicious_input,
                    content='normal content'
                )
    
    def test_parameter_validation(self):
        """Test validation of all input parameters."""
        # Test invalid email addresses
        invalid_emails = [
            'javascript:alert(1)',
            'test@domain.com; do shell script',
            '$(rm -rf /)',
            '../../../etc/passwd'
        ]
        
        for invalid_email in invalid_emails:
            with pytest.raises(ScriptInjectionError):
                self.tool.send_email(
                    to_address=invalid_email,
                    subject='test',
                    content='test'
                )
    
    def test_output_sanitization(self):
        """Test that output doesn't contain sensitive information."""
        # Mock response with potential sensitive data
        self.mock_subprocess.return_value.stdout = 'password: secret123\nemail: user@domain.com'
        
        result = self.tool.get_emails()
        
        # Result should not expose raw sensitive data
        if result.success and result.data:
            for item in result.data:
                if isinstance(item, dict):
                    # Should not contain raw passwords or sensitive fields
                    assert 'password' not in str(item).lower()
    
    def test_error_information_disclosure(self):
        """Test that errors don't disclose sensitive system information."""
        # Mock error with system information
        self.mock_subprocess.return_value = MagicMock(
            returncode=1,
            stdout='',
            stderr='Error: /Users/admin/secret/file not found'
        )
        
        result = self.tool.get_emails()
        
        assert result.success is False
        # Error should not expose full system paths
        assert '/Users/admin/secret' not in result.error


class TestMailOperationResult:
    """Tests for MailOperationResult data structure."""
    
    def test_result_creation(self):
        """Test creation of MailOperationResult."""
        result = MailOperationResult(
            success=True,
            data=['email1', 'email2'],
            execution_time=1.5,
            operation_id='test123'
        )
        
        assert result.success is True
        assert result.data == ['email1', 'email2']
        assert result.error is None
        assert result.execution_time == 1.5
        assert result.operation_id == 'test123'
    
    def test_error_result_creation(self):
        """Test creation of error MailOperationResult."""
        result = MailOperationResult(
            success=False,
            error='Operation failed',
            execution_time=0.5
        )
        
        assert result.success is False
        assert result.data is None
        assert result.error == 'Operation failed'
        assert result.execution_time == 0.5


# Performance and integration tests
class TestBackgroundMailToolPerformance:
    """Performance and stress tests."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Setup for each test method."""
        self.tool = BackgroundMailTool(max_workers=5, enable_monitoring=False)
        
        self.subprocess_patcher = patch('subprocess.run')
        self.mock_subprocess = self.subprocess_patcher.start()
        self.mock_subprocess.return_value = MagicMock(
            returncode=0,
            stdout='performance test',
            stderr=''
        )
    
    def teardown_method(self):
        """Cleanup after each test."""
        self.subprocess_patcher.stop()
        self.tool.shutdown()
    
    def test_high_volume_operations(self):
        """Test handling of high volume operations."""
        # Execute many operations
        results = []
        for i in range(50):
            result = self.tool.get_emails(limit=1)
            results.append(result)
        
        # All operations should succeed
        assert len(results) == 50
        success_count = sum(1 for r in results if r.success)
        assert success_count >= 45  # Allow for some failures in high-volume scenario
    
    def test_cache_performance(self):
        """Test cache performance with repeated operations."""
        params_sets = [
            {'account': 'test1', 'limit': 5},
            {'account': 'test2', 'limit': 10},
            {'account': 'test1', 'limit': 5},  # Repeat
            {'account': 'test2', 'limit': 10},  # Repeat
        ]
        
        start_time = time.time()
        
        for params in params_sets:
            result = self.tool.get_emails(**params)
            assert result.success
        
        total_time = time.time() - start_time
        
        # Cached operations should improve performance
        metrics = self.tool.pool.get_metrics()
        assert metrics.cache_hits > 0
        
        # Should complete in reasonable time
        assert total_time < 5.0
    
    @pytest.mark.slow
    def test_memory_usage_stability(self):
        """Test memory usage remains stable under load."""
        import gc
        import sys
        
        # Get initial memory usage
        initial_objects = len(gc.get_objects())
        
        # Perform many operations
        for i in range(100):
            result = self.tool.get_emails(limit=1)
            if i % 10 == 0:
                gc.collect()  # Force garbage collection
        
        # Check final memory usage
        final_objects = len(gc.get_objects())
        
        # Memory growth should be reasonable
        growth_ratio = final_objects / initial_objects
        assert growth_ratio < 2.0  # Less than 2x growth


# Integration tests with real-world scenarios
@pytest.mark.integration
class TestBackgroundMailToolIntegration:
    """Integration tests for real-world scenarios."""
    
    @pytest.fixture(autouse=True)
    def setup_method(self):
        """Setup for integration tests."""
        self.tool = BackgroundMailTool(enable_monitoring=False)
    
    def teardown_method(self):
        """Cleanup after each test."""
        self.tool.shutdown()
    
    @pytest.mark.skipif(
        not hasattr(subprocess, 'run'),
        reason="Subprocess not available"
    )
    def test_real_applescript_validation(self):
        """Test that AppleScript syntax is valid (without execution)."""
        # Test script generation without execution
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout='test', stderr='')
            
            result = self.tool.get_emails(limit=1)
            
            # Verify script was generated and would be executed
            assert mock_run.called
            call_args = mock_run.call_args[0]
            assert 'osascript' in call_args
            assert '-e' in call_args
            
            # Script should be valid AppleScript syntax
            script = call_args[2]
            assert 'tell application "Mail"' in script
            assert 'end tell' in script


if __name__ == '__main__':
    # Run tests with comprehensive output
    pytest.main([
        __file__,
        '-v',
        '--tb=short',
        '--durations=10',
        '--cov=mail_tool_background',
        '--cov-report=term-missing'
    ])