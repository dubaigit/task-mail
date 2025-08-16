from pathlib import Path
#!/usr/bin/env python3
"""
Unit tests for AppleMailDBReader
Tests database reading, email fetching, and search functionality
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import sqlite3
from datetime import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from apple_mail_db_reader import AppleMailDBReader



@pytest.fixture(autouse=True)
def mock_db_path(monkeypatch):
    """Mock the database path to use in-memory SQLite"""
    monkeypatch.setenv('APPLE_MAIL_DB_PATH', ':memory:')
    
    # Mock Path.exists to return True
    def mock_exists(self):
        return True
    monkeypatch.setattr(Path, 'exists', mock_exists)


class TestAppleMailDBReader:
    """Test suite for Apple Mail database reader"""
    
    @pytest.fixture
    def reader(self):
        """Create a reader instance for testing"""
        with patch('os.path.expanduser') as mock_expand:
            mock_expand.return_value = '/Users/test'
            reader = AppleMailDBReader()
            reader.db_path = '/test/path/to/Envelope.db'
            return reader
    
    @pytest.fixture
    def mock_db_connection(self):
        """Create a mock database connection"""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        return mock_conn, mock_cursor
    
    @pytest.fixture
    def sample_email_row(self):
        """Sample email data as returned from database"""
        return {
            'message_id': 12345,
            'subject_text': 'Test Email Subject',
            'sender_email': 'sender@example.com',
            'sender_name': 'John Doe',
            'date_sent': 719163600,  # Apple epoch timestamp
            'date_received': 719163600,
            'read': 1,
            'flagged': 0,
            'deleted': 0,
            'size': 1024,
            'mailbox_path': 'INBOX'
        }
    
    def test_initialization(self):
        """Test reader initialization with default path"""
        with patch('os.path.expanduser') as mock_expand:
            mock_expand.return_value = '/Users/testuser'
            reader = AppleMailDBReader()
            expected_path = '/Users/testuser/Library/Mail/V10/MailData/Envelope Index'
            assert expected_path in reader.db_path
    
    def test_initialization_with_custom_path(self):
        """Test reader initialization with custom database path"""
        custom_path = '/custom/path/to/database.db'
        reader = AppleMailDBReader(db_path=custom_path)
        assert reader.db_path == custom_path
    
    def test_convert_timestamp(self, reader):
        """Test Apple Mail timestamp conversion"""
        # Apple Mail epoch starts at 2001-01-01
        apple_timestamp = 719163600  # Example timestamp
        converted = reader._convert_timestamp(apple_timestamp)
        
        # Should return ISO format string
        assert isinstance(converted, str)
        assert 'T' in converted  # ISO format includes T separator
    
    def test_convert_timestamp_none(self, reader):
        """Test timestamp conversion with None value"""
        result = reader._convert_timestamp(None)
        assert result == ''
    
    @patch('sqlite3.connect')
    def test_get_recent_emails_success(self, mock_connect, reader, mock_db_connection, sample_email_row):
        """Test successful retrieval of recent emails"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        
        # Mock query results
        mock_cursor.fetchall.return_value = [sample_email_row]
        
        # Create a mock row that behaves like sqlite3.Row
        mock_row = MagicMock()
        mock_row.keys.return_value = sample_email_row.keys()
        mock_row.__getitem__.side_effect = sample_email_row.__getitem__
        mock_cursor.fetchall.return_value = [mock_row]
        
        emails = reader.get_recent_emails(limit=10)
        
        assert len(emails) == 1
        assert emails[0]['message_id'] == 12345
        assert emails[0]['subject_text'] == 'Test Email Subject'
        assert emails[0]['is_read'] == True
        assert emails[0]['is_flagged'] == False
        
        # Verify query was executed
        mock_cursor.execute.assert_called_once()
        query = mock_cursor.execute.call_args[0][0]
        assert 'SELECT' in query
        assert 'messages' in query
        assert 'LIMIT' in query
    
    @patch('sqlite3.connect')
    def test_get_recent_emails_database_error(self, mock_connect, reader):
        """Test handling of database errors"""
        mock_connect.side_effect = sqlite3.Error("Database error")
        
        emails = reader.get_recent_emails()
        
        assert isinstance(emails, list)
        assert len(emails) == 1
        assert 'error' in emails[0]
    
    @patch('sqlite3.connect')
    def test_search_emails_by_subject(self, mock_connect, reader, mock_db_connection, sample_email_row):
        """Test email search by subject"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        
        mock_row = MagicMock()
        mock_row.keys.return_value = sample_email_row.keys()
        mock_row.__getitem__.side_effect = sample_email_row.__getitem__
        mock_cursor.fetchall.return_value = [mock_row]
        
        results = reader.search_emails("test", field="subject")
        
        assert len(results) == 1
        mock_cursor.execute.assert_called_once()
        query = mock_cursor.execute.call_args[0][0]
        assert 'subject_text LIKE' in query
    
    @patch('sqlite3.connect')
    def test_search_emails_by_sender(self, mock_connect, reader, mock_db_connection):
        """Test email search by sender"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []
        
        reader.search_emails("john@example.com", field="sender")
        
        query = mock_cursor.execute.call_args[0][0]
        assert 'sender_email LIKE' in query
    
    @patch('sqlite3.connect')
    def test_search_emails_all_fields(self, mock_connect, reader, mock_db_connection):
        """Test email search across all fields"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []
        
        reader.search_emails("search term", field="all")
        
        query = mock_cursor.execute.call_args[0][0]
        assert 'subject_text LIKE' in query
        assert 'OR' in query
        assert 'sender_email LIKE' in query
    
    @patch('sqlite3.connect')
    def test_get_email_by_id(self, mock_connect, reader, mock_db_connection, sample_email_row):
        """Test getting single email by ID"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        
        mock_row = MagicMock()
        mock_row.keys.return_value = sample_email_row.keys()
        mock_row.__getitem__.side_effect = sample_email_row.__getitem__
        mock_cursor.fetchone.return_value = mock_row
        
        email = reader.get_email(12345)
        
        assert email is not None
        assert email['message_id'] == 12345
        mock_cursor.execute.assert_called_once()
        query = mock_cursor.execute.call_args[0][0]
        assert 'WHERE m.ROWID = ?' in query
    
    @patch('sqlite3.connect')
    def test_get_email_not_found(self, mock_connect, reader, mock_db_connection):
        """Test getting non-existent email"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchone.return_value = None
        
        email = reader.get_email(99999)
        
        assert email is None
    
    @patch('sqlite3.connect')
    def test_get_email_count(self, mock_connect, reader, mock_db_connection):
        """Test getting total email count"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchone.return_value = (42,)
        
        count = reader.get_email_count()
        
        assert count == 42
        query = mock_cursor.execute.call_args[0][0]
        assert 'COUNT(*)' in query
    
    @patch('sqlite3.connect')
    def test_get_email_count_error(self, mock_connect, reader):
        """Test email count with database error"""
        mock_connect.side_effect = sqlite3.Error("Database error")
        
        count = reader.get_email_count()
        
        assert count == 0
    
    @patch('sqlite3.connect')
    def test_get_unread_count(self, mock_connect, reader, mock_db_connection):
        """Test getting unread email count"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchone.return_value = (15,)
        
        count = reader.get_unread_count()
        
        assert count == 15
        query = mock_cursor.execute.call_args[0][0]
        assert 'COUNT(*)' in query
        assert 'read = 0' in query
    
    @patch('sqlite3.connect')
    def test_get_flagged_emails(self, mock_connect, reader, mock_db_connection):
        """Test getting flagged emails"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []
        
        reader.get_flagged_emails()
        
        query = mock_cursor.execute.call_args[0][0]
        assert 'flagged = 1' in query
    
    @patch('sqlite3.connect')
    def test_get_emails_by_date_range(self, mock_connect, reader, mock_db_connection):
        """Test getting emails within date range"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []
        
        # Date range in Apple epoch
        start_date = 719163600
        end_date = 719250000
        
        reader.get_emails_by_date_range(start_date, end_date)
        
        query = mock_cursor.execute.call_args[0][0]
        assert 'date_received BETWEEN' in query
    
    @patch('sqlite3.connect')
    def test_sql_injection_prevention(self, mock_connect, reader, mock_db_connection):
        """Test that SQL injection is prevented"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []
        
        # Attempt SQL injection
        malicious_query = "'; DROP TABLE messages; --"
        reader.search_emails(malicious_query)
        
        # Verify parameterized query was used
        mock_cursor.execute.assert_called()
        call_args = mock_cursor.execute.call_args
        # Should use ? placeholder and pass value separately
        assert '?' in call_args[0][0]
        assert malicious_query in str(call_args[0][1])
    
    def test_database_path_validation(self, reader):
        """Test database path validation"""
        # Test with non-existent path
        reader.db_path = '/non/existent/path.db'
        
        with patch('sqlite3.connect') as mock_connect:
            mock_connect.side_effect = sqlite3.OperationalError("Unable to open database")
            
            emails = reader.get_recent_emails()
            assert 'error' in emails[0]
    
    @patch('sqlite3.connect')
    def test_connection_cleanup(self, mock_connect, reader):
        """Test that database connections are properly closed"""
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_conn.cursor.return_value = mock_cursor
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []
        
        reader.get_recent_emails()
        
        # Verify connection was closed
        mock_conn.close.assert_called_once()
    
    @patch('sqlite3.connect')
    def test_empty_result_handling(self, mock_connect, reader, mock_db_connection):
        """Test handling of empty query results"""
        mock_conn, mock_cursor = mock_db_connection
        mock_connect.return_value = mock_conn
        mock_cursor.fetchall.return_value = []
        
        emails = reader.get_recent_emails()
        
        assert emails == []
        assert isinstance(emails, list)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=apple_mail_db_reader"])