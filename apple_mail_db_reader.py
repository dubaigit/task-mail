#!/usr/bin/env python3
"""
Apple Mail Database Reader - Direct SQLite access to Apple Mail emails
Provides instant access to email data from Apple Mail's local database
"""

import sqlite3
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import argparse
import os
from pathlib import Path

class AppleMailDBReader:
    """Direct access to Apple Mail's SQLite database for instant email retrieval."""
    
    def __init__(self):
        """Initialize with Apple Mail database path."""
        self.db_path = Path.home() / "Library/Mail/V10/MailData/Envelope Index"
        
        if not self.db_path.exists():
            # Try V9 path
            self.db_path = Path.home() / "Library/Mail/V9/MailData/Envelope Index"
            
        if not self.db_path.exists():
            raise FileNotFoundError(f"Apple Mail database not found at {self.db_path}")
    
    def _get_connection(self):
        """Get database connection with read-only mode."""
        # Use URI mode to open in read-only
        db_uri = f"file:{self.db_path}?mode=ro"
        return sqlite3.connect(db_uri, uri=True)
    
    def _get_write_connection(self):
        """Get database connection with write access for updates."""
        # Use URI mode to open in read-write mode
        db_uri = f"file:{self.db_path}?mode=rw"
        return sqlite3.connect(db_uri, uri=True)
    
    def _convert_timestamp(self, timestamp):
        """Convert Apple Mail timestamp (seconds since 2001-01-01) to readable format."""
        if timestamp:
            try:
                # Apple Mail uses Core Data timestamp (seconds since 2001-01-01)
                apple_epoch = datetime(2001, 1, 1)
                dt = apple_epoch + timedelta(seconds=timestamp)
                return dt.strftime("%Y-%m-%d %H:%M:%S")
            except:
                return str(timestamp)
        return None
    
    def get_recent_emails(self, limit: int = 10) -> List[Dict]:
        """Get recent emails directly from database."""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query = """
            SELECT 
                m.ROWID as id,
                m.message_id,
                m.document_id,
                s.subject as subject_text,
                sender_add.address as sender_email,
                sender_add.comment as sender_name,
                m.date_sent,
                m.date_received,
                m.read,
                m.flagged,
                m.deleted,
                m.size,
                mb.url as mailbox_path
            FROM messages m
            LEFT JOIN subjects s ON m.subject = s.ROWID
            LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
            LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
            WHERE m.deleted = 0
            ORDER BY m.date_received DESC
            LIMIT ?
            """
            
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
            
            emails = []
            for row in rows:
                email = dict(row)
                # Convert timestamps
                email['date_received'] = self._convert_timestamp(email['date_received'])
                email['date_sent'] = self._convert_timestamp(email['date_sent'])
                # Convert boolean flags
                email['is_read'] = bool(email['read'])
                email['is_flagged'] = bool(email['flagged'])
                emails.append(email)
            
            conn.close()
            return emails
            
        except Exception as e:
            return [{"error": str(e)}]
    
    def search_emails(self, query: str, field: str = "all", limit: int = 20) -> List[Dict]:
        """Search emails by various fields."""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            search_pattern = f"%{query}%"
            
            base_query = """
            SELECT 
                m.ROWID as id,
                s.subject as subject_text,
                sender_add.address as sender_email,
                sender_add.comment as sender_name,
                m.date_received,
                m.read,
                m.flagged,
                mb.url as mailbox_path
            FROM messages m
            LEFT JOIN subjects s ON m.subject = s.ROWID
            LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
            LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
            WHERE m.deleted = 0 AND
            """
            
            if field == "subject":
                where_clause = "s.subject LIKE ?"
            elif field == "sender":
                where_clause = "(sender_add.address LIKE ? OR sender_add.comment LIKE ?)"
                search_pattern = (search_pattern, search_pattern)
            elif field == "content":
                where_clause = "s.subject LIKE ?"  # Using subject as content proxy
            else:  # all
                where_clause = """(s.subject LIKE ? 
                                OR sender_add.address LIKE ? 
                                OR sender_add.comment LIKE ?)"""
                search_pattern = (search_pattern, search_pattern, search_pattern)
            
            query_sql = f"{base_query} {where_clause} ORDER BY m.date_received DESC LIMIT ?"
            
            if isinstance(search_pattern, tuple):
                cursor.execute(query_sql, search_pattern + (limit,))
            else:
                cursor.execute(query_sql, (search_pattern, limit))
            
            rows = cursor.fetchall()
            emails = []
            for row in rows:
                email = dict(row)
                email['date_received'] = self._convert_timestamp(email['date_received'])
                email['is_read'] = bool(email['read'])
                email['is_flagged'] = bool(email['flagged'])
                emails.append(email)
            
            conn.close()
            return emails
            
        except Exception as e:
            return [{"error": str(e)}]
    
    def get_unread_emails(self, limit: int = 20) -> List[Dict]:
        """Get unread emails."""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query = """
            SELECT 
                m.ROWID as id,
                s.subject as subject_text,
                sender_add.address as sender_email,
                sender_add.comment as sender_name,
                m.date_received,
                m.flagged,
                mb.url as mailbox_path
            FROM messages m
            LEFT JOIN subjects s ON m.subject = s.ROWID
            LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
            LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
            WHERE m.deleted = 0 AND m.read = 0
            ORDER BY m.date_received DESC
            LIMIT ?
            """
            
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
            
            emails = []
            for row in rows:
                email = dict(row)
                email['date_received'] = self._convert_timestamp(email['date_received'])
                email['is_flagged'] = bool(email['flagged'])
                emails.append(email)
            
            conn.close()
            return emails
            
        except Exception as e:
            return [{"error": str(e)}]
    
    def get_flagged_emails(self, limit: int = 20) -> List[Dict]:
        """Get flagged emails."""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query = """
            SELECT 
                m.ROWID as id,
                s.subject as subject_text,
                sender_add.address as sender_email,
                sender_add.comment as sender_name,
                m.date_received,
                m.read,
                mb.url as mailbox_path
            FROM messages m
            LEFT JOIN subjects s ON m.subject = s.ROWID
            LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
            LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
            WHERE m.deleted = 0 AND m.flagged = 1
            ORDER BY m.date_received DESC
            LIMIT ?
            """
            
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
            
            emails = []
            for row in rows:
                email = dict(row)
                email['date_received'] = self._convert_timestamp(email['date_received'])
                email['is_read'] = bool(email['read'])
                emails.append(email)
            
            conn.close()
            return emails
            
        except Exception as e:
            return [{"error": str(e)}]
    
    def get_email_stats(self) -> Dict:
        """Get email statistics from database."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            stats = {}
            
            # Total emails
            cursor.execute("SELECT COUNT(*) FROM messages WHERE deleted = 0")
            stats['total_emails'] = cursor.fetchone()[0]
            
            # Unread emails
            cursor.execute("SELECT COUNT(*) FROM messages WHERE deleted = 0 AND read = 0")
            stats['unread_count'] = cursor.fetchone()[0]
            
            # Flagged emails
            cursor.execute("SELECT COUNT(*) FROM messages WHERE deleted = 0 AND flagged = 1")
            stats['flagged_count'] = cursor.fetchone()[0]
            
            # Get mailbox distribution
            cursor.execute("""
                SELECT mb.url, COUNT(*) as count 
                FROM messages m
                JOIN mailboxes mb ON m.mailbox = mb.ROWID
                WHERE m.deleted = 0
                GROUP BY mb.url
                ORDER BY count DESC
                LIMIT 10
            """)
            stats['mailbox_distribution'] = cursor.fetchall()
            
            # Recent email count (last 7 days)
            seven_days_ago = datetime.now() - timedelta(days=7)
            apple_epoch = datetime(2001, 1, 1)
            seven_days_timestamp = (seven_days_ago - apple_epoch).total_seconds()
            
            cursor.execute("""
                SELECT COUNT(*) 
                FROM messages 
                WHERE deleted = 0 AND date_received > ?
            """, (seven_days_timestamp,))
            stats['emails_last_7_days'] = cursor.fetchone()[0]
            
            conn.close()
            return stats
            
        except Exception as e:
            return {"error": str(e)}
    
    def get_email_count(self) -> int:
        """Get total count of non-deleted emails."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM messages WHERE deleted = 0")
            result = cursor.fetchone()[0]
            conn.close()
            return result
        except Exception as e:
            return 0
    
    def get_unread_count(self) -> int:
        """Get count of unread emails."""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM messages WHERE deleted = 0 AND read = 0")
            result = cursor.fetchone()[0]
            conn.close()
            return result
        except Exception as e:
            return 0
    
    def get_email(self, email_id: int) -> Optional[Dict]:
        """Get single email by ID."""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query = """
            SELECT 
                m.ROWID as message_id,
                m.message_id as message_id_header,
                s.subject as subject_text,
                sender_add.address as sender_email,
                sender_add.comment as sender_name,
                m.date_received,
                m.date_sent,
                m.read,
                m.flagged,
                m.deleted,
                m.size,
                mb.url as mailbox_path
            FROM messages m
            LEFT JOIN subjects s ON m.subject = s.ROWID
            LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
            LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
            WHERE m.ROWID = ? AND m.deleted = 0
            """
            
            cursor.execute(query, (email_id,))
            row = cursor.fetchone()
            
            if row:
                email = dict(row)
                email['date_received'] = self._convert_timestamp(email['date_received'])
                email['date_sent'] = self._convert_timestamp(email['date_sent'])
                email['is_read'] = bool(email['read'])
                email['is_flagged'] = bool(email['flagged'])
                conn.close()
                return email
            
            conn.close()
            return None
            
        except Exception as e:
            return None
    
    def delete_email(self, email_id: int) -> bool:
        """Soft delete an email by setting deleted flag to 1."""
        try:
            conn = self._get_write_connection()
            cursor = conn.cursor()
            
            # First check if email exists and is not already deleted
            check_query = "SELECT ROWID, deleted FROM messages WHERE ROWID = ?"
            cursor.execute(check_query, (email_id,))
            result = cursor.fetchone()
            
            if not result:
                conn.close()
                return False  # Email not found
                
            if result[1] == 1:  # Already deleted
                conn.close()
                return False  # Already deleted
            
            # Soft delete the email
            update_query = "UPDATE messages SET deleted = 1 WHERE ROWID = ?"
            cursor.execute(update_query, (email_id,))
            
            success = cursor.rowcount > 0
            conn.commit()
            conn.close()
            return success
            
        except Exception as e:
            return False
    
    def archive_email(self, email_id: int) -> bool:
        """Archive an email by moving it to archive status.
        
        Since Apple Mail doesn't have a built-in archive flag, we'll implement this
        by checking if there's an Archive mailbox, or we could add a custom solution.
        For now, we'll use a simple approach of flagging the email as archived.
        """
        try:
            conn = self._get_write_connection()
            cursor = conn.cursor()
            
            # First check if email exists and is not deleted
            check_query = "SELECT ROWID, deleted FROM messages WHERE ROWID = ?"
            cursor.execute(check_query, (email_id,))
            result = cursor.fetchone()
            
            if not result:
                conn.close()
                return False  # Email not found
                
            if result[1] == 1:  # Email is deleted
                conn.close()
                return False  # Cannot archive deleted email
            
            # For archiving, we'll look for an Archive mailbox
            # First, let's try to find an Archive mailbox
            archive_query = """
            SELECT ROWID FROM mailboxes 
            WHERE url LIKE '%Archive%' OR url LIKE '%archive%' 
            LIMIT 1
            """
            cursor.execute(archive_query)
            archive_mailbox = cursor.fetchone()
            
            if archive_mailbox:
                # Move email to archive mailbox
                update_query = "UPDATE messages SET mailbox = ? WHERE ROWID = ?"
                cursor.execute(update_query, (archive_mailbox[0], email_id))
            else:
                # If no archive mailbox exists, we'll mark it as flagged for archive
                # This is a fallback solution - in a real implementation you might
                # want to create an archive mailbox or use a different approach
                update_query = "UPDATE messages SET flagged = 1 WHERE ROWID = ?"
                cursor.execute(update_query, (email_id,))
            
            success = cursor.rowcount > 0
            conn.commit()
            conn.close()
            return success
            
        except Exception as e:
            return False


def main():
    parser = argparse.ArgumentParser(description='Direct Apple Mail Database Reader')
    parser.add_argument('action', choices=['recent', 'unread', 'search', 'flagged', 'stats'],
                        help='Action to perform')
    parser.add_argument('--limit', type=int, default=10, help='Number of results')
    parser.add_argument('--query', help='Search query')
    parser.add_argument('--field', choices=['all', 'subject', 'sender', 'content'], 
                        default='all', help='Search field')
    parser.add_argument('--format', choices=['json', 'pretty'], default='pretty',
                        help='Output format')
    
    args = parser.parse_args()
    
    try:
        reader = AppleMailDBReader()
        
        if args.action == 'recent':
            result = reader.get_recent_emails(args.limit)
        elif args.action == 'unread':
            result = reader.get_unread_emails(args.limit)
        elif args.action == 'search':
            if not args.query:
                print("Error: --query required for search")
                return
            result = reader.search_emails(args.query, args.field, args.limit)
        elif args.action == 'flagged':
            result = reader.get_flagged_emails(args.limit)
        elif args.action == 'stats':
            result = reader.get_email_stats()
        
        if args.format == 'json':
            print(json.dumps(result, indent=2, default=str))
        else:
            if isinstance(result, dict):
                # Stats output
                if 'error' in result:
                    print(f"Error: {result['error']}")
                else:
                    print("\n📊 Apple Mail Statistics:")
                    print(f"Total Emails: {result.get('total_emails', 0):,}")
                    print(f"Unread: {result.get('unread_count', 0):,}")
                    print(f"Flagged: {result.get('flagged_count', 0):,}")
                    print(f"Last 7 days: {result.get('emails_last_7_days', 0):,}")
                    print("\nTop Mailboxes:")
                    for mailbox, count in result.get('mailbox_distribution', []):
                        print(f"  {mailbox}: {count:,}")
            else:
                # Email list output
                for i, email in enumerate(result, 1):
                    if 'error' in email:
                        print(f"Error: {email['error']}")
                        break
                    print(f"\n--- Email {i} ---")
                    print(f"Subject: {email.get('subject_text', 'N/A')}")
                    print(f"From: {email.get('sender_name', '')} <{email.get('sender_email', 'N/A')}>")
                    print(f"Date: {email.get('date_received', 'N/A')}")
                    print(f"Mailbox: {email.get('mailbox_name', 'N/A')}")
                    if not email.get('is_read'):
                        print("Status: 📬 UNREAD")
                    if email.get('is_flagged'):
                        print("Status: 🚩 FLAGGED")
                    if email.get('preview'):
                        preview = email['preview'][:150].replace('\n', ' ')
                        print(f"Preview: {preview}...")
    
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Make sure Apple Mail is installed and has been used.")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()