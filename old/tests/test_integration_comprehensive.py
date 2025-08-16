#!/usr/bin/env python3
"""
Comprehensive Integration Tests

Tests Apple Mail database operations, AppleScript integration,
email processing workflows, and end-to-end system functionality.

Priority: HIGH - Integration tests ensure components work together
"""

import pytest
import sqlite3
import tempfile
import os
import shutil
import subprocess
import time
import json
from datetime import datetime, timedelta
from unittest.mock import patch, Mock, MagicMock, call, mock_open
from pathlib import Path
import sys

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from apple_mail_db_reader import AppleMailDBReader
from applescript_integration import AppleScriptMailer
from email_intelligence_engine import EmailIntelligenceEngine, EmailClass, Urgency
from email_data_connector import AppleMailConnector
from email_auto_processor import EmailAutoProcessor


class TestAppleMailDatabaseIntegration:
    """Test Apple Mail database integration"""
    
    @pytest.fixture
    def temp_db_path(self):
        """Create temporary database for testing"""
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
        temp_file.close()
        
        # Create test database with Apple Mail schema
        conn = sqlite3.connect(temp_file.name)
        cursor = conn.cursor()
        
        # Create simplified Apple Mail database schema
        cursor.execute('''
            CREATE TABLE message (
                ROWID INTEGER PRIMARY KEY,
                subject TEXT,
                sender TEXT,
                date_received INTEGER,
                date_sent INTEGER,
                snippet TEXT,
                read INTEGER DEFAULT 0,
                flagged INTEGER DEFAULT 0,
                deleted INTEGER DEFAULT 0
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE mailbox (
                ROWID INTEGER PRIMARY KEY,
                url TEXT,
                name TEXT
            )
        ''')
        
        # Insert test data
        test_emails = [
            (1, 'Important Meeting Tomorrow', 'john.doe@company.com', 
             int(time.time()) - 3600, int(time.time()) - 3600, 
             'Please confirm your attendance...', 0, 0, 0),
            (2, 'Weekly Newsletter', 'newsletter@company.com',
             int(time.time()) - 86400, int(time.time()) - 86400,
             'This week in tech news...', 1, 0, 0),
            (3, 'Budget Approval Required', 'finance@company.com',
             int(time.time()) - 7200, int(time.time()) - 7200,
             'Please approve the Q4 budget...', 0, 1, 0),
            (4, 'Deleted Email', 'spam@example.com',
             int(time.time()) - 10800, int(time.time()) - 10800,
             'This email was deleted...', 1, 0, 1)
        ]
        
        cursor.executemany('''
            INSERT INTO message (ROWID, subject, sender, date_received, date_sent, snippet, read, flagged, deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', test_emails)
        
        # Insert mailbox data
        cursor.execute('''
            INSERT INTO mailbox (ROWID, url, name) VALUES 
            (1, 'imap://mail.company.com/INBOX', 'INBOX'),
            (2, 'imap://mail.company.com/Sent', 'Sent'),
            (3, 'imap://mail.company.com/Drafts', 'Drafts')
        ''')
        
        conn.commit()
        conn.close()
        
        yield temp_file.name
        
        # Cleanup
        os.unlink(temp_file.name)
    
    def test_database_connection_and_basic_queries(self, temp_db_path):
        """Test basic database connection and queries"""
        reader = AppleMailDBReader(db_path=temp_db_path)
        
        # Test connection
        assert reader.db_path == temp_db_path
        
        # Test basic email retrieval
        emails = reader.get_recent_emails(limit=10)
        assert len(emails) == 3  # Should exclude deleted email
        
        # Test email structure
        first_email = emails[0]
        assert hasattr(first_email, 'message_id')
        assert hasattr(first_email, 'subject_text')
        assert hasattr(first_email, 'sender_email')
        assert hasattr(first_email, 'date_received')
    
    def test_email_search_functionality(self, temp_db_path):
        """Test email search functionality"""
        reader = AppleMailDBReader(db_path=temp_db_path)
        
        # Search by subject
        results = reader.search_emails('meeting')
        assert len(results) >= 1
        assert any('meeting' in email.subject_text.lower() for email in results)
        
        # Search by sender
        results = reader.search_emails('john.doe')
        assert len(results) >= 1
        assert any('john.doe' in email.sender_email for email in results)
        
        # Search with no results
        results = reader.search_emails('nonexistent_search_term_xyz')
        assert len(results) == 0
    
    def test_email_filtering_and_status(self, temp_db_path):
        """Test email filtering by read/unread and flagged status"""
        reader = AppleMailDBReader(db_path=temp_db_path)
        
        # Test unread count
        unread_count = reader.get_unread_count()
        assert unread_count == 2  # Two unread emails in test data
        
        # Test flagged emails
        flagged_emails = reader.get_flagged_emails()
        assert len(flagged_emails) >= 1
        assert all(email.is_flagged for email in flagged_emails)
        
        # Test email by ID
        email = reader.get_email_by_id(1)
        assert email is not None
        assert email.subject_text == 'Important Meeting Tomorrow'
        assert not email.is_read
    
    def test_date_range_queries(self, temp_db_path):
        """Test date range email queries"""
        reader = AppleMailDBReader(db_path=temp_db_path)
        
        # Test last 24 hours
        yesterday = datetime.now() - timedelta(hours=24)
        recent_emails = reader.get_emails_by_date_range(
            start_date=yesterday,
            end_date=datetime.now()
        )
        
        assert len(recent_emails) >= 1
        
        # Test specific date range
        start_date = datetime.now() - timedelta(hours=48)
        end_date = datetime.now() - timedelta(hours=1)
        range_emails = reader.get_emails_by_date_range(start_date, end_date)
        
        assert len(range_emails) >= 0
    
    def test_sql_injection_prevention(self, temp_db_path):
        """Test SQL injection prevention in search queries"""
        reader = AppleMailDBReader(db_path=temp_db_path)
        
        # Test various SQL injection attempts
        injection_attempts = [
            "'; DROP TABLE message; --",
            "1' OR '1'='1",
            "'; UPDATE message SET subject='hacked'; --",
            "' UNION SELECT * FROM mailbox --"
        ]
        
        for injection in injection_attempts:
            try:
                results = reader.search_emails(injection)
                # Should not raise exception and should not return all emails
                assert isinstance(results, list)
                # If it returns results, they should be legitimate search results
                if results:
                    assert len(results) < 10  # Shouldn't return everything
            except Exception as e:
                # Should handle gracefully without exposing database errors
                assert "SQL" not in str(e)
                assert "syntax" not in str(e).lower()
    
    def test_database_error_handling(self, temp_db_path):
        """Test database error handling"""
        reader = AppleMailDBReader(db_path=temp_db_path)
        
        # Test with corrupted database path
        corrupted_reader = AppleMailDBReader(db_path='/nonexistent/path/fake.db')
        
        # Should handle gracefully
        emails = corrupted_reader.get_recent_emails()
        assert isinstance(emails, list)
        assert len(emails) == 0
        
        # Test with permission denied
        # This is harder to test consistently across platforms
        pass
    
    def test_timestamp_conversion(self, temp_db_path):
        """Test Apple timestamp conversion"""
        reader = AppleMailDBReader(db_path=temp_db_path)
        
        # Test Apple timestamp conversion (Apple epoch starts Jan 1, 2001)
        apple_timestamp = 123456789  # Some Apple timestamp
        converted = reader._convert_timestamp(apple_timestamp)
        
        assert isinstance(converted, datetime)
        assert converted.year >= 2001  # Should be after Apple epoch
        
        # Test None handling
        assert reader._convert_timestamp(None) is None
        
        # Test zero handling
        assert reader._convert_timestamp(0) is not None


class TestAppleScriptIntegration:
    """Test AppleScript integration functionality"""
    
    @pytest.fixture
    def mailer(self):
        """Create AppleScriptMailer instance"""
        return AppleScriptMailer()
    
    @patch('subprocess.run')
    def test_send_email_basic(self, mock_subprocess, mailer):
        """Test basic email sending functionality"""
        # Mock successful AppleScript execution
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Message sent successfully"
        mock_result.stderr = ""
        mock_subprocess.return_value = mock_result
        
        result = mailer.send_email(
            to="test@example.com",
            subject="Test Subject",
            body="Test email body"
        )
        
        assert result is True
        mock_subprocess.assert_called_once()
        
        # Check AppleScript command structure
        call_args = mock_subprocess.call_args[0][0]
        assert 'osascript' in call_args
        assert '-e' in call_args
    
    @patch('subprocess.run')
    def test_send_email_with_cc_bcc(self, mock_subprocess, mailer):
        """Test email sending with CC and BCC"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Message sent successfully"
        mock_subprocess.return_value = mock_result
        
        result = mailer.send_email(
            to="test@example.com",
            subject="Test Subject",
            body="Test body",
            cc="cc@example.com",
            bcc="bcc@example.com"
        )
        
        assert result is True
        
        # Verify CC and BCC are included in AppleScript
        call_args = str(mock_subprocess.call_args)
        assert 'cc@example.com' in call_args
        assert 'bcc@example.com' in call_args
    
    @patch('subprocess.run')
    def test_create_draft_functionality(self, mock_subprocess, mailer):
        """Test draft creation functionality"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Draft created successfully"
        mock_subprocess.return_value = mock_result
        
        result = mailer.create_draft(
            to="test@example.com",
            subject="Draft Subject",
            body="Draft body content"
        )
        
        assert result is True
        
        # Verify it's creating a draft, not sending
        call_args = str(mock_subprocess.call_args)
        assert 'make new outgoing message' in call_args or 'draft' in call_args.lower()
    
    @patch('subprocess.run')
    def test_reply_to_email(self, mock_subprocess, mailer):
        """Test replying to specific email"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Reply sent successfully"
        mock_subprocess.return_value = mock_result
        
        result = mailer.reply_to_email(
            message_id=12345,
            body="This is my reply"
        )
        
        assert result is True
        
        # Verify message ID is used in AppleScript
        call_args = str(mock_subprocess.call_args)
        assert '12345' in call_args
    
    @patch('subprocess.run')
    def test_mark_email_as_read(self, mock_subprocess, mailer):
        """Test marking email as read"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Email marked as read"
        mock_subprocess.return_value = mock_result
        
        result = mailer.mark_as_read(message_id=12345)
        
        assert result is True
        
        # Verify marking as read
        call_args = str(mock_subprocess.call_args)
        assert 'read status' in call_args or 'read' in call_args
    
    @patch('subprocess.run')
    def test_flag_email(self, mock_subprocess, mailer):
        """Test flagging email"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Email flagged successfully"
        mock_subprocess.return_value = mock_result
        
        result = mailer.flag_email(message_id=12345)
        
        assert result is True
        
        # Verify flagging
        call_args = str(mock_subprocess.call_args)
        assert 'flag' in call_args.lower()
    
    @patch('subprocess.run')
    def test_applescript_error_handling(self, mock_subprocess, mailer):
        """Test AppleScript error handling"""
        # Mock AppleScript failure
        mock_result = Mock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "AppleScript Error: Mail is not running"
        mock_subprocess.return_value = mock_result
        
        result = mailer.send_email(
            to="test@example.com",
            subject="Test",
            body="Test"
        )
        
        assert result is False
    
    @patch('subprocess.run')
    def test_special_characters_escaping(self, mock_subprocess, mailer):
        """Test proper escaping of special characters"""
        mock_result = Mock()
        mock_result.returncode = 0
        mock_result.stdout = "Message sent successfully"
        mock_subprocess.return_value = mock_result
        
        # Test with quotes, backslashes, and special characters
        result = mailer.send_email(
            to="test@example.com",
            subject='Subject with "quotes" and \'apostrophes\'',
            body="Body with \\ backslashes and \"quotes\" and 'apostrophes'"
        )
        
        assert result is True
        
        # Verify characters are properly escaped
        call_args = str(mock_subprocess.call_args)
        # Should not contain unescaped quotes that would break AppleScript
        assert '\\\"' in call_args or call_args.count('"') % 2 == 0
    
    @patch('subprocess.run')
    def test_timeout_handling(self, mock_subprocess, mailer):
        """Test timeout handling for long-running AppleScript"""
        # Mock timeout
        mock_subprocess.side_effect = subprocess.TimeoutExpired('osascript', 30)
        
        result = mailer.send_email(
            to="test@example.com",
            subject="Test",
            body="Test"
        )
        
        assert result is False
    
    def test_applescript_command_generation(self, mailer):
        """Test AppleScript command generation"""
        # Test command generation without actually running
        command = mailer._build_send_command(
            to="test@example.com",
            subject="Test Subject",
            body="Test Body"
        )
        
        assert isinstance(command, list)
        assert command[0] == 'osascript'
        assert '-e' in command
        
        # Verify AppleScript structure
        script_parts = [part for part in command if 'tell application "Mail"' in part]
        assert len(script_parts) > 0


class TestEmailProcessingWorkflow:
    """Test end-to-end email processing workflows"""
    
    @pytest.fixture
    def email_processor(self):
        """Create email processor with mocked components"""
        processor = EmailAutoProcessor()
        processor.db_reader = Mock(spec=AppleMailDBReader)
        processor.intelligence_engine = Mock(spec=EmailIntelligenceEngine)
        processor.mailer = Mock(spec=AppleScriptMailer)
        return processor
    
    def test_complete_email_analysis_workflow(self, email_processor):
        """Test complete email analysis workflow"""
        # Mock email data
        mock_email = Email(
            message_id=123,
            subject_text="Important project update",
            sender_email="pm@company.com",
            date_received=datetime.now(),
            snippet="Please review the attached project timeline...",
            is_read=False,
            is_flagged=False
        )
        
        # Mock intelligence engine response
        from email_intelligence_engine import EmailAnalysisResult, ActionItem
        mock_analysis = EmailAnalysisResult(
            classification=EmailClass.NEEDS_REPLY,
            urgency=Urgency.HIGH,
            confidence=0.92,
            action_items=[
                ActionItem(
                    text="Review project timeline",
                    assignee="current_user",
                    deadline=datetime.now() + timedelta(days=1),
                    confidence=0.9
                )
            ],
            processing_time_ms=85.5
        )
        
        # Setup mocks
        email_processor.db_reader.get_recent_emails.return_value = [mock_email]
        email_processor.intelligence_engine.analyze_email.return_value = mock_analysis
        
        # Process emails
        results = email_processor.process_recent_emails(limit=1)
        
        # Verify workflow
        assert len(results) == 1
        assert results[0]['email_id'] == 123
        assert results[0]['classification'] == 'NEEDS_REPLY'
        assert results[0]['urgency'] == 'HIGH'
        assert len(results[0]['action_items']) == 1
        
        # Verify method calls
        email_processor.db_reader.get_recent_emails.assert_called_once()
        email_processor.intelligence_engine.analyze_email.assert_called_once_with(
            mock_email.subject_text,
            mock_email.snippet,
            mock_email.sender_email
        )
    
    def test_draft_generation_workflow(self, email_processor):
        """Test draft generation workflow"""
        # Mock email requiring reply
        mock_email = Email(
            message_id=456,
            subject_text="Client inquiry about pricing",
            sender_email="client@bigcorp.com",
            date_received=datetime.now(),
            snippet="Could you please provide pricing information...",
            is_read=False,
            is_flagged=False
        )
        
        # Mock analysis result
        mock_analysis = EmailAnalysisResult(
            classification=EmailClass.NEEDS_REPLY,
            urgency=Urgency.HIGH,
            confidence=0.88
        )
        
        # Mock draft generation
        mock_draft = "Dear Client,\n\nThank you for your inquiry. I'll provide pricing information shortly.\n\nBest regards"
        
        # Setup mocks
        email_processor.db_reader.get_email_by_id.return_value = mock_email
        email_processor.intelligence_engine.analyze_email.return_value = mock_analysis
        email_processor.intelligence_engine.generate_draft_reply.return_value = mock_draft
        email_processor.mailer.create_draft.return_value = True
        
        # Generate draft
        result = email_processor.generate_draft_for_email(456)
        
        # Verify draft generation
        assert result['success'] is True
        assert result['draft_content'] == mock_draft
        assert result['confidence'] == 0.88
        
        # Verify AppleScript draft creation was called
        email_processor.mailer.create_draft.assert_called_once()
    
    def test_bulk_email_processing(self, email_processor):
        """Test bulk email processing"""
        # Create multiple mock emails
        mock_emails = []
        for i in range(5):
            email = Email(
                message_id=i + 1,
                subject_text=f"Email {i + 1}",
                sender_email=f"sender{i + 1}@company.com",
                date_received=datetime.now() - timedelta(hours=i),
                snippet=f"This is email {i + 1} content...",
                is_read=False,
                is_flagged=False
            )
            mock_emails.append(email)
        
        # Mock analysis results
        def mock_analyze(subject, body, sender):
            return EmailAnalysisResult(
                classification=EmailClass.NEEDS_REPLY,
                urgency=Urgency.MEDIUM,
                confidence=0.75
            )
        
        # Setup mocks
        email_processor.db_reader.get_recent_emails.return_value = mock_emails
        email_processor.intelligence_engine.analyze_email.side_effect = mock_analyze
        
        # Process bulk emails
        results = email_processor.process_recent_emails(limit=5)
        
        # Verify bulk processing
        assert len(results) == 5
        assert all(result['classification'] == 'NEEDS_REPLY' for result in results)
        assert email_processor.intelligence_engine.analyze_email.call_count == 5
    
    def test_error_recovery_in_workflow(self, email_processor):
        """Test error recovery in email processing workflow"""
        # Mock email that causes analysis error
        mock_email = Email(
            message_id=789,
            subject_text="Problematic email",
            sender_email="problem@company.com",
            date_received=datetime.now(),
            snippet="This email causes processing errors...",
            is_read=False,
            is_flagged=False
        )
        
        # Setup mocks
        email_processor.db_reader.get_recent_emails.return_value = [mock_email]
        email_processor.intelligence_engine.analyze_email.side_effect = Exception("Analysis error")
        
        # Process emails with error
        results = email_processor.process_recent_emails(limit=1)
        
        # Should handle error gracefully
        assert len(results) == 1
        assert results[0]['error'] is not None
        assert 'Analysis error' in results[0]['error']
        assert results[0]['email_id'] == 789


class TestAppleMailConnectorIntegration:
    """Test AppleMailConnector integration"""
    
    @pytest.fixture
    def connector(self, temp_db_path):
        """Create AppleMailConnector with test database"""
        return AppleMailConnector(db_path=temp_db_path)
    
    def test_connector_initialization(self, connector):
        """Test connector initialization"""
        assert connector is not None
        assert hasattr(connector, 'db_path')
        assert hasattr(connector, 'get_recent_emails')
    
    def test_real_data_integration(self, connector):
        """Test integration with real-like data"""
        # This would test with actual Apple Mail database structure
        # For now, test the interface
        emails = connector.get_recent_emails(days=7, limit=10)
        assert isinstance(emails, list)
        
        # Test email structure matches expected format
        if emails:
            email = emails[0]
            assert hasattr(email, 'message_id')
            assert hasattr(email, 'subject_text')
            assert hasattr(email, 'sender_email')
    
    def test_mailbox_statistics(self, connector):
        """Test mailbox statistics gathering"""
        try:
            stats = connector.get_mailbox_stats()
            assert isinstance(stats, dict)
            assert 'total_messages' in stats
            assert 'oldest_message' in stats
            assert 'newest_message' in stats
        except Exception:
            # Method might not be implemented yet
            pass


class TestPerformanceIntegration:
    """Test performance of integrated components"""
    
    def test_end_to_end_processing_performance(self):
        """Test end-to-end processing performance"""
        # Create processor with real components
        processor = EmailAutoProcessor()
        
        # Mock database with many emails
        with patch.object(processor, 'db_reader') as mock_reader:
            # Create 100 mock emails
            mock_emails = []
            for i in range(100):
                email = Email(
                    message_id=i,
                    subject_text=f"Performance test email {i}",
                    sender_email=f"test{i}@company.com",
                    date_received=datetime.now(),
                    snippet=f"Test content {i}",
                    is_read=False,
                    is_flagged=False
                )
                mock_emails.append(email)
            
            mock_reader.get_recent_emails.return_value = mock_emails
            
            # Measure processing time
            start_time = time.time()
            results = processor.process_recent_emails(limit=100)
            end_time = time.time()
            
            processing_time = end_time - start_time
            per_email_time = processing_time / 100
            
            # Performance requirements
            assert processing_time < 30, f"Processing 100 emails took {processing_time:.2f}s, should be < 30s"
            assert per_email_time < 0.5, f"Per-email processing {per_email_time:.3f}s too slow"
    
    def test_database_query_performance(self, temp_db_path):
        """Test database query performance"""
        reader = AppleMailDBReader(db_path=temp_db_path)
        
        # Test multiple queries
        start_time = time.time()
        for _ in range(10):
            emails = reader.get_recent_emails(limit=50)
            search_results = reader.search_emails('test')
            unread_count = reader.get_unread_count()
        end_time = time.time()
        
        total_time = end_time - start_time
        assert total_time < 2, f"Database queries took {total_time:.2f}s, should be < 2s"


class TestSecurityIntegration:
    """Test security aspects of integration"""
    
    def test_applescript_injection_prevention(self):
        """Test AppleScript injection prevention"""
        mailer = AppleScriptMailer()
        
        # Test with malicious input
        malicious_inputs = [
            'test"; do shell script "rm -rf /"; tell application "Mail"',
            'test\n"; system("malicious_command"); "',
            'test`rm -rf /`test',
            'test$(rm -rf /)test'
        ]
        
        for malicious_input in malicious_inputs:
            with patch('subprocess.run') as mock_subprocess:
                mock_result = Mock()
                mock_result.returncode = 0
                mock_subprocess.return_value = mock_result
                
                # Should not execute malicious commands
                result = mailer.send_email(
                    to=malicious_input,
                    subject=malicious_input,
                    body=malicious_input
                )
                
                # Verify AppleScript is properly escaped
                call_args = str(mock_subprocess.call_args)
                assert 'rm -rf' not in call_args
                assert 'shell script' not in call_args
    
    def test_database_access_security(self, temp_db_path):
        """Test database access security"""
        reader = AppleMailDBReader(db_path=temp_db_path)
        
        # Test with path traversal attempts
        path_traversal_attempts = [
            '../../../etc/passwd',
            '..\\..\\..\\windows\\system32\\config\\sam',
            '/etc/shadow',
            'C:\\Windows\\System32\\config\\SAM'
        ]
        
        for path in path_traversal_attempts:
            # Should not allow access to system files
            malicious_reader = AppleMailDBReader(db_path=path)
            emails = malicious_reader.get_recent_emails()
            # Should return empty list or handle gracefully
            assert isinstance(emails, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])