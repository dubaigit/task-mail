#!/usr/bin/env python3

import unittest
import asyncio
import sqlite3
from unittest.mock import patch, MagicMock
from mail_tool_background import BackgroundMailTool

class TestMailToolCoreFunctionality(unittest.TestCase):
    """Test core functionality of BackgroundMailTool"""
    
    def setUp(self):
        """Set up test environment"""
        self.tool = BackgroundMailTool()
        self.tool.db_path = "test_mail.db"
        self.tool.init_database()
    
    def tearDown(self):
        """Clean up test environment"""
        import os
        if os.path.exists(self.tool.db_path):
            os.remove(self.tool.db_path)
    
    @patch('mail_tool_background.BackgroundMailTool.run_applescript')
    def test_fetch_recent_emails(self, mock_run):
        """Test fetching recent emails"""
        # Test successful fetch
        mock_run.return_value = "id1|||sender1|||subject1|||content1|||2024-01-01|||account1|||inbox|||1|||0|||0"
        result = self.tool.fetch_recent_emails(hours_back=1)
        self.assertIsNotNone(result)
        self.assertIn("id1", result)
        
        # Test failed fetch
        mock_run.return_value = None
        result = self.tool.fetch_recent_emails(hours_back=1)
        self.assertIsNone(result)
    
    def test_parse_email_data_comprehensive(self):
        """Test comprehensive email data parsing"""
        # Test with valid single email
        data = "id1|||sender1|||subject1|||content1|||2024-01-01|||account1|||inbox|||1|||0|||0§§§"
        result = self.tool.parse_email_data(data)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['id'], 'id1')
        
        # Test with multiple emails
        data = """
        id1|||sender1|||subject1|||content1|||2024-01-01|||account1|||inbox|||1|||0|||0§§§
        id2|||sender2|||subject2|||content2|||2024-01-01|||account2|||inbox|||0|||1|||2§§§
        """
        result = self.tool.parse_email_data(data)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[1]['attachment_count'], 2)
        
        # Test with malformed data
        data = "malformed|||data"
        result = self.tool.parse_email_data(data)
        self.assertEqual(result, [])
        
        # Test with empty strings in fields
        data = "id3||||||content3|||2024-01-01|||account3|||inbox|||0|||0|||0§§§"
        result = self.tool.parse_email_data(data)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['sender'], '')
        self.assertEqual(result[0]['subject'], '')
    
    def test_store_emails_comprehensive(self):
        """Test comprehensive email storage scenarios"""
        # Test storing multiple emails
        emails = [
            {
                'id': 'test1',
                'sender': 'sender1@example.com',
                'subject': 'Subject 1',
                'content': 'Content 1',
                'date_received': '2024-01-01',
                'account': 'Account 1',
                'mailbox': 'INBOX',
                'read_status': 0,
                'flagged': 0,
                'attachment_count': 0
            },
            {
                'id': 'test2',
                'sender': 'sender2@example.com',
                'subject': 'Subject 2',
                'content': 'Content 2',
                'date_received': '2024-01-02',
                'account': 'Account 2',
                'mailbox': 'Sent',
                'read_status': 1,
                'flagged': 1,
                'attachment_count': 2
            }
        ]
        
        count = self.tool.store_emails(emails)
        self.assertEqual(count, 2)
        
        # Verify storage
        conn = sqlite3.connect(self.tool.db_path)
        cursor = conn.cursor()
        
        # Check first email
        cursor.execute("SELECT * FROM emails WHERE id = ?", ('test1',))
        email1 = cursor.fetchone()
        self.assertIsNotNone(email1)
        self.assertEqual(email1[2], 'sender1@example.com')
        
        # Check second email
        cursor.execute("SELECT * FROM emails WHERE id = ?", ('test2',))
        email2 = cursor.fetchone()
        self.assertIsNotNone(email2)
        self.assertEqual(email2[9], 1)  # flagged status
        
        conn.close()
        
        # Test updating existing email
        updated_email = emails[0].copy()
        updated_email['read_status'] = 1
        
        count = self.tool.store_emails([updated_email])
        self.assertEqual(count, 1)
        
        # Verify update
        conn = sqlite3.connect(self.tool.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT read_status FROM emails WHERE id = ?", ('test1',))
        read_status = cursor.fetchone()[0]
        conn.close()
        
        self.assertEqual(read_status, 1)
    
    def test_sync_log_comprehensive(self):
        """Test comprehensive sync logging scenarios"""
        # Test successful sync with emails
        self.tool.log_sync(10, 'success')
        
        # Test failed sync with error
        self.tool.log_sync(0, 'failed', 'Network error')
        
        # Test partial sync
        self.tool.log_sync(5, 'partial', 'Some emails failed')
        
        # Verify logs
        conn = sqlite3.connect(self.tool.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT emails_processed, status, error_message FROM sync_log ORDER BY sync_time DESC")
        logs = cursor.fetchall()
        conn.close()
        
        self.assertEqual(len(logs), 3)
        self.assertEqual(logs[0], (5, 'partial', 'Some emails failed'))
        self.assertEqual(logs[1], (0, 'failed', 'Network error'))
        self.assertEqual(logs[2], (10, 'success', None))
    
    def test_get_status_comprehensive(self):
        """Test comprehensive status reporting"""
        # Add some test data
        self.tool.store_emails([{
            'id': 'status_test1',
            'sender': 'test@example.com',
            'subject': 'Test Subject',
            'content': 'Test Content',
            'date_received': '2024-01-01',
            'account': 'Test Account',
            'mailbox': 'INBOX',
            'read_status': 0,
            'flagged': 0,
            'attachment_count': 0
        }])
        
        self.tool.log_sync(1, 'success')
        
        # Test initial status
        status = self.tool.get_status()
        self.assertFalse(status['running'])
        self.assertEqual(status['total_emails'], 1)
        self.assertIsNotNone(status['last_sync'])
        self.assertEqual(status['last_sync']['emails_processed'], 1)
        
        # Test status with sync error
        self.tool.log_sync(0, 'failed', 'Test error')
        status = self.tool.get_status()
        self.assertEqual(status['last_sync']['status'], 'failed')
        self.assertEqual(status['last_sync']['error_message'], 'Test error')
        
        # Test status while running
        self.tool.running = True
        status = self.tool.get_status()
        self.assertTrue(status['running'])
    
    def test_thread_safety(self):
        """Test thread safety of core operations"""
        import threading
        
        def sync_operation():
            """Simulated sync operation"""
            self.tool.log_sync(1, 'success')
            self.tool.store_emails([{
                'id': f'thread_test_{threading.get_ident()}',
                'sender': 'test@example.com',
                'subject': 'Thread Test',
                'content': 'Test Content',
                'date_received': '2024-01-01',
                'account': 'Test Account',
                'mailbox': 'INBOX',
                'read_status': 0,
                'flagged': 0,
                'attachment_count': 0
            }])
        
        # Run multiple threads
        threads = []
        for _ in range(5):
            t = threading.Thread(target=sync_operation)
            threads.append(t)
            t.start()
        
        # Wait for all threads
        for t in threads:
            t.join()
        
        # Verify results
        conn = sqlite3.connect(self.tool.db_path)
        cursor = conn.cursor()
        
        # Check email count
        cursor.execute("SELECT COUNT(*) FROM emails")
        email_count = cursor.fetchone()[0]
        self.assertEqual(email_count, 5)
        
        # Check sync log count
        cursor.execute("SELECT COUNT(*) FROM sync_log")
        log_count = cursor.fetchone()[0]
        self.assertEqual(log_count, 5)
        
        conn.close()

if __name__ == '__main__':
    unittest.main()