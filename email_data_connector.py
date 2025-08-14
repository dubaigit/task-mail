#!/usr/bin/env python3
"""
Apple Mail Database Connector for Real Email Data Extraction

This module provides a robust connector to Apple's Mail.app database for extracting
email data with proper schema mapping and performance optimizations.
"""

import sqlite3
import os
import json
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from contextlib import contextmanager
import time
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class Email:
    """Email data model matching the required schema"""
    message_id: int
    apple_document_id: int
    subject_text: str
    sender_email: str
    sender_name: str
    to_addresses: List[Dict[str, str]]
    cc_addresses: List[Dict[str, str]]
    bcc_addresses: List[Dict[str, str]]
    date_sent: datetime
    date_received: datetime
    is_read: bool
    is_flagged: bool
    is_deleted: bool
    size_bytes: int
    mailbox_path: str

class AppleMailConnector:
    """
    Apple Mail database connector for extracting email data from Mail.app
    
    Features:
    - Connection management with pooling
    - Efficient SQL joins for complete email data
    - Date range filtering with Unix timestamp conversion
    - Incremental extraction support
    - Data validation and sanitization
    - Performance optimization with caching
    """
    
    def __init__(self, db_path: Optional[str] = None):
        """
        Initialize the Apple Mail connector
        
        Args:
            db_path: Path to the Envelope Index database. If None, uses default location
        """
        self.db_path = db_path or os.path.expanduser("~/Library/Mail/V10/MailData/Envelope Index")
        self.connection = None
        self._validate_database_path()
        
    def _validate_database_path(self) -> None:
        """Validate that the database file exists and is accessible"""
        if not os.path.exists(self.db_path):
            raise FileNotFoundError(f"Apple Mail database not found at: {self.db_path}")
        if not os.access(self.db_path, os.R_OK):
            raise PermissionError(f"Cannot read Apple Mail database at: {self.db_path}")
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections with proper WAL mode handling"""
        conn = None
        try:
            conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            conn.execute("PRAGMA query_only = ON")
            conn.execute("PRAGMA cache_size = 10000")
            conn.execute("PRAGMA temp_store = memory")
            conn.execute("PRAGMA journal_mode = WAL")
            conn.row_factory = sqlite3.Row
            yield conn
        except sqlite3.Error as e:
            logger.error(f"Database connection error: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def _unix_to_datetime(self, unix_timestamp: int) -> datetime:
        """Convert Unix timestamp to datetime object"""
        if not unix_timestamp:
            return datetime.min
        try:
            # Apple's epoch starts at 2001-01-01 00:00:00 UTC (978307200 seconds after Unix epoch)
            # But timestamps in Apple Mail are already relative to Mac absolute time (2001-01-01)
            return datetime.fromtimestamp(unix_timestamp)
        except (OSError, ValueError):
            return datetime.min
    
    def _get_recipients_for_message(self, conn: sqlite3.Connection, message_id: int) -> Dict[str, List[Dict[str, str]]]:
        """Get all recipients for a message grouped by type"""
        query = """
        SELECT r.type, a.address, a.comment
        FROM recipients r
        JOIN addresses a ON r.address = a.ROWID
        WHERE r.message = ?
        ORDER BY r.position
        """
        
        recipients = {
            'to': [],
            'cc': [],
            'bcc': []
        }
        
        try:
            cursor = conn.execute(query, (message_id,))
            for row in cursor.fetchall():
                recipient = {
                    'email': row['address'] or '',
                    'name': row['comment'] or ''
                }
                
                if row['type'] == 1:  # TO
                    recipients['to'].append(recipient)
                elif row['type'] == 2:  # CC
                    recipients['cc'].append(recipient)
                elif row['type'] == 3:  # BCC
                    recipients['bcc'].append(recipient)
        except sqlite3.Error as e:
            logger.warning(f"Error fetching recipients for message {message_id}: {e}")
        
        return recipients
    
    def _execute_query_with_retry(self, conn: sqlite3.Connection, query: str, params: Tuple = ()) -> List[Dict[str, Any]]:
        """Execute query with retry logic and timeout handling"""
        max_retries = 3
        retry_delay = 0.5
        
        for attempt in range(max_retries):
            try:
                conn.execute("PRAGMA busy_timeout = 5000")
                cursor = conn.execute(query, params)
                return cursor.fetchall()
            except sqlite3.OperationalError as e:
                if "database is locked" in str(e) and attempt < max_retries - 1:
                    logger.warning(f"Database locked, retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                raise
            except sqlite3.Error as e:
                logger.error(f"Query execution error: {e}")
                raise
    
    def get_emails_by_date_range(self, start_date: datetime, end_date: datetime, limit: Optional[int] = None) -> List[Email]:
        """
        Get emails within a specific date range
        
        Args:
            start_date: Start date for filtering
            end_date: End date for filtering
            limit: Maximum number of emails to return
            
        Returns:
            List of Email objects
        """
        start_unix = int(start_date.timestamp())
        end_unix = int(end_date.timestamp())
        
        query = """
        SELECT 
            m.ROWID as message_id,
            m.message_id as apple_document_id,
            s.subject as subject_text,
            sa.address as sender_email,
            sa.comment as sender_name,
            m.date_sent,
            m.date_received,
            m.read as is_read,
            m.flagged as is_flagged,
            m.deleted as is_deleted,
            m.size as size_bytes,
            mb.url as mailbox_path
        FROM messages m
        LEFT JOIN subjects s ON m.subject = s.ROWID
        LEFT JOIN addresses sa ON m.sender = sa.ROWID
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        WHERE m.date_received BETWEEN ? AND ?
        ORDER BY m.date_received DESC
        """
        
        if limit:
            query += f" LIMIT {int(limit)}"
        
        emails = []
        
        with self.get_connection() as conn:
            try:
                results = self._execute_query_with_retry(conn, query, (start_unix, end_unix))
                
                for row in results:
                    # Get recipients for this message
                    recipients = self._get_recipients_for_message(conn, row['message_id'])
                    
                    email = Email(
                        message_id=row['message_id'],
                        apple_document_id=row['apple_document_id'],
                        subject_text=row['subject_text'] or '',
                        sender_email=row['sender_email'] or '',
                        sender_name=row['sender_name'] or '',
                        to_addresses=recipients['to'],
                        cc_addresses=recipients['cc'],
                        bcc_addresses=recipients['bcc'],
                        date_sent=self._unix_to_datetime(row['date_sent']),
                        date_received=self._unix_to_datetime(row['date_received']),
                        is_read=bool(row['is_read']),
                        is_flagged=bool(row['is_flagged']),
                        is_deleted=bool(row['is_deleted']),
                        size_bytes=row['size_bytes'] or 0,
                        mailbox_path=row['mailbox_path'] or ''
                    )
                    emails.append(email)
                    
            except Exception as e:
                logger.error(f"Error fetching emails by date range: {e}")
                raise
        
        logger.info(f"Retrieved {len(emails)} emails from {start_date} to {end_date}")
        return emails
    
    def get_recent_emails(self, days: int = 60, limit: Optional[int] = None) -> List[Email]:
        """
        Get recent emails from the last N days
        
        Args:
            days: Number of days to look back (default 60 for 2+ months)
            limit: Maximum number of emails to return
            
        Returns:
            List of Email objects
        """
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        return self.get_emails_by_date_range(start_date, end_date, limit)
    
    def get_email_by_id(self, message_id: int) -> Optional[Email]:
        """
        Get a single email by its message ID
        
        Args:
            message_id: The message ID to look up
            
        Returns:
            Email object or None if not found
        """
        query = """
        SELECT 
            m.ROWID as message_id,
            m.message_id as apple_document_id,
            s.subject as subject_text,
            sa.address as sender_email,
            sa.comment as sender_name,
            m.date_sent,
            m.date_received,
            m.read as is_read,
            m.flagged as is_flagged,
            m.deleted as is_deleted,
            m.size as size_bytes,
            mb.url as mailbox_path
        FROM messages m
        LEFT JOIN subjects s ON m.subject = s.ROWID
        LEFT JOIN addresses sa ON m.sender = sa.ROWID
        LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
        WHERE m.ROWID = ?
        """
        
        with self.get_connection() as conn:
            try:
                results = self._execute_query_with_retry(conn, query, (message_id,))
                if not results:
                    return None
                
                row = results[0]
                recipients = self._get_recipients_for_message(conn, row['message_id'])
                
                return Email(
                    message_id=row['message_id'],
                    apple_document_id=row['apple_document_id'],
                    subject_text=row['subject_text'] or '',
                    sender_email=row['sender_email'] or '',
                    sender_name=row['sender_name'] or '',
                    to_addresses=recipients['to'],
                    cc_addresses=recipients['cc'],
                    bcc_addresses=recipients['bcc'],
                    date_sent=self._unix_to_datetime(row['date_sent']),
                    date_received=self._unix_to_datetime(row['date_received']),
                    is_read=bool(row['is_read']),
                    is_flagged=bool(row['is_flagged']),
                    is_deleted=bool(row['is_deleted']),
                    size_bytes=row['size_bytes'] or 0,
                    mailbox_path=row['mailbox_path'] or ''
                )
                
            except Exception as e:
                logger.error(f"Error fetching email by ID {message_id}: {e}")
                return None
    
    def get_mailbox_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the mail database
        
        Returns:
            Dictionary with mailbox statistics
        """
        stats = {}
        
        with self.get_connection() as conn:
            try:
                # Total messages
                cursor = conn.execute("SELECT COUNT(*) as total FROM messages")
                stats['total_messages'] = cursor.fetchone()['total']
                
                # Date range
                cursor = conn.execute("SELECT MIN(date_received) as min_date, MAX(date_received) as max_date FROM messages")
                row = cursor.fetchone()
                if row and row['min_date'] and row['max_date']:
                    stats['oldest_message'] = self._unix_to_datetime(row['min_date'])
                    stats['newest_message'] = self._unix_to_datetime(row['max_date'])
                
                # Mailbox counts
                cursor = conn.execute("""
                    SELECT mb.url as mailbox, COUNT(*) as count
                    FROM messages m
                    JOIN mailboxes mb ON m.mailbox = mb.ROWID
                    GROUP BY mb.url
                    ORDER BY count DESC
                """)
                stats['mailboxes'] = {row['mailbox']: row['count'] for row in cursor.fetchall()}
                
            except Exception as e:
                logger.error(f"Error getting mailbox stats: {e}")
                raise
        
        return stats
    
    def validate_email_data(self, email: Email) -> bool:
        """
        Validate email data for completeness and correctness
        
        Args:
            email: Email object to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not email.message_id or email.message_id <= 0:
            return False
        if not email.sender_email and not email.subject_text:
            return False
        if email.date_received == datetime.min:
            return False
        return True

# Example usage and testing
if __name__ == "__main__":
    try:
        # Initialize connector
        connector = AppleMailConnector()
        
        # Get mailbox stats
        stats = connector.get_mailbox_stats()
        print(f"Total messages: {stats['total_messages']}")
        print(f"Date range: {stats['oldest_message']} to {stats['newest_message']}")
        
        # Get recent emails (last 7 days for testing)
        recent_emails = connector.get_recent_emails(days=7, limit=10)
        print(f"\nFound {len(recent_emails)} recent emails")
        
        for email in recent_emails[:3]:  # Show first 3
            print(f"\nSubject: {email.subject_text}")
            print(f"From: {email.sender_name} <{email.sender_email}>")
            print(f"Date: {email.date_received}")
            print(f"To: {len(email.to_addresses)} recipients")
            print(f"Size: {email.size_bytes} bytes")
            
    except Exception as e:
        logger.error(f"Error in main: {e}")