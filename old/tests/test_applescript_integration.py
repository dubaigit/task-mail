#!/usr/bin/env python3
"""
Unit tests for AppleScriptMailer
Tests email sending, draft creation, and mail operations via AppleScript
"""

import pytest
from unittest.mock import Mock, patch, MagicMock, call
import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from applescript_integration import AppleScriptMailer


class TestAppleScriptMailer:
    """Test suite for AppleScript email integration"""
    
    @pytest.fixture
    def mailer(self):
        """Create a mailer instance for testing"""
        return AppleScriptMailer()
    
    @patch('subprocess.run')
    def test_send_email_success(self, mock_run, mailer):
        """Test successful email sending"""
        # Mock successful subprocess run
        mock_run.return_value = Mock(
            returncode=0,
            stdout="",
            stderr=""
        )
        
        result = mailer.send_email(
            to="recipient@example.com",
            subject="Test Subject",
            body="Test email body"
        )
        
        assert result == True
        mock_run.assert_called_once()
        
        # Verify osascript was called
        call_args = mock_run.call_args[0][0]
        assert call_args[0] == 'osascript'
        assert call_args[1] == '-e'
        
        # Verify script contains email details
        script = call_args[2]
        assert 'recipient@example.com' in script
        assert 'Test Subject' in script
        assert 'Test email body' in script
        assert 'send' in script
    
    @patch('subprocess.run')
    def test_send_email_with_cc_and_bcc(self, mock_run, mailer):
        """Test sending email with CC and BCC"""
        mock_run.return_value = Mock(returncode=0)
        
        result = mailer.send_email(
            to="to@example.com",
            subject="Subject",
            body="Body",
            cc="cc@example.com",
            bcc="bcc@example.com"
        )
        
        assert result == True
        script = mock_run.call_args[0][0][2]
        assert 'cc@example.com' in script
        assert 'bcc@example.com' in script
        assert 'cc recipient' in script
        assert 'bcc recipient' in script
    
    @patch('subprocess.run')
    def test_send_email_failure(self, mock_run, mailer):
        """Test email sending failure"""
        # Mock subprocess failure
        mock_run.side_effect = subprocess.CalledProcessError(
            1, 'osascript', stderr="Error: Mail not running"
        )
        
        result = mailer.send_email(
            to="recipient@example.com",
            subject="Test",
            body="Test"
        )
        
        assert result == False
    
    @patch('subprocess.run')
    def test_send_email_with_quotes_escaping(self, mock_run, mailer):
        """Test that quotes are properly escaped"""
        mock_run.return_value = Mock(returncode=0)
        
        result = mailer.send_email(
            to='user@example.com',
            subject='Subject with "quotes"',
            body='Body with "quoted text" inside'
        )
        
        assert result == True
        script = mock_run.call_args[0][0][2]
        # Verify quotes are escaped
        assert '\\"quotes\\"' in script
        assert '\\"quoted text\\"' in script
    
    @patch('subprocess.run')
    def test_create_draft_success(self, mock_run, mailer):
        """Test successful draft creation"""
        mock_run.return_value = Mock(returncode=0)
        
        result = mailer.create_draft(
            to="recipient@example.com",
            subject="Draft Subject",
            body="Draft body content"
        )
        
        assert result == True
        mock_run.assert_called_once()
        
        script = mock_run.call_args[0][0][2]
        assert 'visible:true' in script  # Draft should be visible
        assert 'recipient@example.com' in script
        assert 'Draft Subject' in script
        assert 'Draft body content' in script
        assert 'activate' in script  # Mail app should activate
    
    @patch('subprocess.run')
    def test_create_draft_with_cc(self, mock_run, mailer):
        """Test draft creation with CC"""
        mock_run.return_value = Mock(returncode=0)
        
        result = mailer.create_draft(
            to="to@example.com",
            subject="Subject",
            body="Body",
            cc="cc@example.com"
        )
        
        assert result == True
        script = mock_run.call_args[0][0][2]
        assert 'cc@example.com' in script
        assert 'cc recipient' in script
    
    @patch('subprocess.run')
    def test_create_draft_failure(self, mock_run, mailer):
        """Test draft creation failure"""
        mock_run.side_effect = subprocess.CalledProcessError(
            1, 'osascript', stderr="Error"
        )
        
        result = mailer.create_draft(
            to="recipient@example.com",
            subject="Test",
            body="Test"
        )
        
        assert result == False
    
    @patch('subprocess.run')
    def test_reply_to_email_success(self, mock_run, mailer):
        """Test successful reply to email"""
        mock_run.return_value = Mock(
            returncode=0,
            stdout="true",
            stderr=""
        )
        
        result = mailer.reply_to_email(
            message_id="<message123@example.com>",
            body="This is my reply",
            reply_all=False
        )
        
        assert result == True
        
        script = mock_run.call_args[0][0][2]
        assert '<message123@example.com>' in script
        assert 'This is my reply' in script
        assert 'reply to' in script  # Not reply all
    
    @patch('subprocess.run')
    def test_reply_all_to_email(self, mock_run, mailer):
        """Test reply all functionality"""
        mock_run.return_value = Mock(
            returncode=0,
            stdout="true"
        )
        
        result = mailer.reply_to_email(
            message_id="<msg@example.com>",
            body="Reply to all",
            reply_all=True
        )
        
        assert result == True
        script = mock_run.call_args[0][0][2]
        assert 'reply to' in script  # Should be "reply to" for reply all
    
    @patch('subprocess.run')
    def test_reply_to_email_not_found(self, mock_run, mailer):
        """Test reply when email is not found"""
        mock_run.return_value = Mock(
            returncode=0,
            stdout="false"  # Email not found
        )
        
        result = mailer.reply_to_email(
            message_id="<nonexistent@example.com>",
            body="Reply"
        )
        
        assert result == False
    
    @patch('subprocess.run')
    def test_mark_as_read_success(self, mock_run, mailer):
        """Test marking email as read"""
        mock_run.return_value = Mock(
            returncode=0,
            stdout="true"
        )
        
        result = mailer.mark_as_read("<message@example.com>")
        
        assert result == True
        script = mock_run.call_args[0][0][2]
        assert '<message@example.com>' in script
        assert 'read status' in script
        assert 'true' in script
    
    @patch('subprocess.run')
    def test_mark_as_read_not_found(self, mock_run, mailer):
        """Test marking non-existent email as read"""
        mock_run.return_value = Mock(
            returncode=0,
            stdout="false"
        )
        
        result = mailer.mark_as_read("<nonexistent@example.com>")
        
        assert result == False
    
    @patch('subprocess.run')
    def test_flag_email_success(self, mock_run, mailer):
        """Test flagging an email"""
        mock_run.return_value = Mock(
            returncode=0,
            stdout="true"
        )
        
        result = mailer.flag_email("<message@example.com>", flag=True)
        
        assert result == True
        script = mock_run.call_args[0][0][2]
        assert '<message@example.com>' in script
        assert 'flagged status' in script
        assert 'true' in script
    
    @patch('subprocess.run')
    def test_unflag_email(self, mock_run, mailer):
        """Test unflagging an email"""
        mock_run.return_value = Mock(
            returncode=0,
            stdout="true"
        )
        
        result = mailer.flag_email("<message@example.com>", flag=False)
        
        assert result == True
        script = mock_run.call_args[0][0][2]
        assert 'flagged status' in script
        assert 'false' in script
    
    @patch('subprocess.run')
    def test_get_selected_emails(self, mock_run, mailer):
        """Test getting selected emails"""
        # This would need more complex AppleScript parsing
        # For now, test basic functionality
        mock_run.return_value = Mock(
            returncode=0,
            stdout=""
        )
        
        result = mailer.get_selected_emails()
        
        assert isinstance(result, list)
        mock_run.assert_called_once()
        script = mock_run.call_args[0][0][2]
        assert 'selection' in script
        assert 'subject' in script
        assert 'sender' in script
    
    @patch('subprocess.run')
    def test_subprocess_timeout_handling(self, mock_run, mailer):
        """Test handling of subprocess timeout"""
        mock_run.side_effect = subprocess.TimeoutExpired('osascript', 30)
        
        result = mailer.send_email(
            to="test@example.com",
            subject="Test",
            body="Test"
        )
        
        assert result == False
    
    def test_empty_email_handling(self, mailer):
        """Test handling of empty email fields"""
        with patch('subprocess.run') as mock_run:
            mock_run.return_value = Mock(returncode=0)
            
            # Test with empty recipient
            result = mailer.send_email("", "Subject", "Body")
            assert result == True  # Should still try to send
            
            # Test with empty subject
            result = mailer.send_email("test@example.com", "", "Body")
            assert result == True
            
            # Test with empty body
            result = mailer.send_email("test@example.com", "Subject", "")
            assert result == True
    
    @patch('subprocess.run')
    def test_special_characters_escaping(self, mock_run, mailer):
        """Test escaping of special characters"""
        mock_run.return_value = Mock(returncode=0)
        
        result = mailer.send_email(
            to="test@example.com",
            subject="Test & Special < > Characters",
            body="Body with special chars: $, %, &, @"
        )
        
        assert result == True
        # The implementation should handle these characters properly


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=applescript_integration"])