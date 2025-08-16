#!/usr/bin/env python3

import unittest
import asyncio
import subprocess
from unittest.mock import patch, MagicMock
from mail_tool_background import BackgroundMailTool

class TestBackgroundMailTool(unittest.TestCase):
    """Test suite for BackgroundMailTool"""
    
    def setUp(self):
        """Set up test environment"""
        self.tool = BackgroundMailTool()
        
    def asyncTest(f):
        """Decorator to run async test methods"""
        def wrapper(*args, **kwargs):
            return asyncio.run(f(*args, **kwargs))
        return wrapper
    
    @patch('subprocess.run')
    def test_run_applescript_success(self, mock_run):
        """Test successful AppleScript execution"""
        # Mock successful response
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout="test output",
            stderr=""
        )
        
        result = self.tool.run_applescript("test script")
        self.assertEqual(result, "test output")
        mock_run.assert_called_once()
        
    @patch('subprocess.run')
    def test_run_applescript_failure(self, mock_run):
        """Test failed AppleScript execution"""
        mock_run.return_value = MagicMock(
            returncode=1,
            stdout="",
            stderr="error message"
        )
        
        result = self.tool.run_applescript("test script")
        self.assertEqual(result, "")
        mock_run.assert_called_once()
        
    @patch('subprocess.run')
    def test_run_applescript_timeout(self, mock_run):
        """Test AppleScript timeout"""
        mock_run.side_effect = subprocess.TimeoutExpired("cmd", 30)
        
        result = self.tool.run_applescript("test script")
        self.assertEqual(result, "")
        mock_run.assert_called_once()
    
    def test_init_database(self):
        """Test database initialization"""
        try:
            self.tool.init_database()
            # Check if tables were created
            import sqlite3
            conn = sqlite3.connect(self.tool.db_path)
            cursor = conn.cursor()
            
            # Check emails table
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='emails'")
            self.assertIsNotNone(cursor.fetchone())
            
            # Check sync_log table
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='sync_log'")
            self.assertIsNotNone(cursor.fetchone())
            
            conn.close()
        except Exception as e:
            self.fail(f"Database initialization failed: {e}")
    
    def test_parse_email_data_empty(self):
        """Test parsing empty email data"""
        result = self.tool.parse_email_data("")
        self.assertEqual(result, [])
        
        result = self.tool.parse_email_data(None)
        self.assertEqual(result, [])
    
    def test_parse_email_data_valid(self):
        """Test parsing valid email data"""
        test_data = "id1|||sender1|||subject1|||content1|||2024-01-01|||account1|||inbox|||1|||0|||0§§§"
        result = self.tool.parse_email_data(test_data)
        
        self.assertEqual(len(result), 1)
        email = result[0]
        self.assertEqual(email['id'], 'id1')
        self.assertEqual(email['sender'], 'sender1')
        self.assertEqual(email['subject'], 'subject1')
        self.assertEqual(email['read_status'], 1)
    
    def test_parse_email_data_invalid(self):
        """Test parsing invalid email data"""
        test_data = "invalid§§§format§§§data"
        result = self.tool.parse_email_data(test_data)
        self.assertEqual(result, [])
    
    def test_store_emails_empty(self):
        """Test storing empty email list"""
        result = self.tool.store_emails([])
        self.assertEqual(result, 0)
    
    def test_store_emails_valid(self):
        """Test storing valid emails"""
        test_emails = [{
            'id': 'test1',
            'sender': 'test@example.com',
            'subject': 'Test Subject',
            'content': 'Test Content',
            'date_received': '2024-01-01',
            'account': 'Test Account',
            'mailbox': 'INBOX',
            'read_status': 0,
            'flagged': 0,
            'attachment_count': 0
        }]
        
        count = self.tool.store_emails(test_emails)
        self.assertEqual(count, 1)
        
        # Verify storage
        conn = sqlite3.connect(self.tool.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM emails WHERE id = ?", ('test1',))
        self.assertIsNotNone(cursor.fetchone())
        conn.close()
    
    def test_store_emails_duplicate(self):
        """Test storing duplicate emails"""
        test_email = {
            'id': 'dup1',
            'sender': 'test@example.com',
            'subject': 'Test Subject',
            'content': 'Test Content',
            'date_received': '2024-01-01',
            'account': 'Test Account',
            'mailbox': 'INBOX',
            'read_status': 0,
            'flagged': 0,
            'attachment_count': 0
        }
        
        # Store first time
        count1 = self.tool.store_emails([test_email])
        # Store again
        count2 = self.tool.store_emails([test_email])
        
        self.assertEqual(count1, 1)
        self.assertEqual(count2, 0)  # Should not store duplicate
    
    def test_log_sync_success(self):
        """Test logging successful sync"""
        self.tool.log_sync(10, 'success')
        
        conn = sqlite3.connect(self.tool.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT emails_processed, status FROM sync_log ORDER BY sync_time DESC LIMIT 1")
        result = cursor.fetchone()
        conn.close()
        
        self.assertEqual(result[0], 10)
        self.assertEqual(result[1], 'success')
    
    def test_log_sync_failure(self):
        """Test logging sync failure"""
        error_msg = "Test error"
        self.tool.log_sync(0, 'failed', error_msg)
        
        conn = sqlite3.connect(self.tool.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT emails_processed, status, error_message FROM sync_log ORDER BY sync_time DESC LIMIT 1")
        result = cursor.fetchone()
        conn.close()
        
        self.assertEqual(result[0], 0)
        self.assertEqual(result[1], 'failed')
        self.assertEqual(result[2], error_msg)
    
    @patch('mail_tool_background.BackgroundMailTool.fetch_recent_emails')
    def test_sync_emails_success(self, mock_fetch):
        """Test successful email sync"""
        mock_fetch.return_value = "id1|||sender1|||subject1|||content1|||2024-01-01|||account1|||inbox|||1|||0|||0§§§"
        
        self.tool.sync_emails()
        
        # Verify sync was logged
        conn = sqlite3.connect(self.tool.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT status FROM sync_log ORDER BY sync_time DESC LIMIT 1")
        status = cursor.fetchone()[0]
        conn.close()
        
        self.assertEqual(status, 'success')
    
    @patch('mail_tool_background.BackgroundMailTool.fetch_recent_emails')
    def test_sync_emails_failure(self, mock_fetch):
        """Test failed email sync"""
        mock_fetch.return_value = None
        
        self.tool.sync_emails()
        
        # Verify failure was logged
        conn = sqlite3.connect(self.tool.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT status FROM sync_log ORDER BY sync_time DESC LIMIT 1")
        status = cursor.fetchone()[0]
        conn.close()
        
        self.assertEqual(status, 'failed')
    
    def test_background_sync_start_stop(self):
        """Test background sync start/stop"""
        self.tool.start(interval_minutes=1)
        self.assertTrue(self.tool.running)
        self.assertIsNotNone(self.tool.thread)
        self.assertTrue(self.tool.thread.is_alive())
        
        self.tool.stop()
        self.assertFalse(self.tool.running)
        self.assertFalse(self.tool.thread.is_alive())
    
    def test_get_status(self):
        """Test getting tool status"""
        # Add a sync log entry
        self.tool.log_sync(5, 'success')
        
        status = self.tool.get_status()
        
        self.assertIn('running', status)
        self.assertIn('total_emails', status)
        self.assertIn('last_sync', status)
        self.assertTrue(isinstance(status['total_emails'], int))

if __name__ == '__main__':
    unittest.main()