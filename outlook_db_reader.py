#!/usr/bin/env python3
"""
Outlook Database Reader - Direct SQLite access to Outlook emails
Provides instant access to email data from Outlook's local database
"""

import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
import argparse
import os
from pathlib import Path

class OutlookDBReader:
    """Direct access to Outlook's SQLite database for instant email retrieval."""
    
    def __init__(self):
        """Initialize with Outlook database path."""
        self.db_path = Path.home() / "Library/Group Containers/UBF8T346G9.Office/Outlook/Outlook 15 Profiles/Main Profile/Data/Outlook.sqlite"
        
        if not self.db_path.exists():
            raise FileNotFoundError(f"Outlook database not found at {self.db_path}")
        
        # Create a copy to avoid locking issues
        self.working_db = Path.home() / "Library/Group Containers/UBF8T346G9.Office/Outlook/Outlook 15 Profiles/Main Profile/Data/.outlook_copy.sqlite"
        
    def _get_connection(self):
        """Get database connection with read-only mode."""
        # Use URI mode to open in read-only
        db_uri = f"file:{self.db_path}?mode=ro"
        return sqlite3.connect(db_uri, uri=True)
    
    def get_recent_emails(self, limit: int = 10) -> List[Dict]:
        """Get recent emails directly from database."""
        try:
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query = """
            SELECT 
                Record_RecordID as id,
                Message_MessageID as message_id,
                Message_NormalizedSubject as subject,
                Message_SenderList as sender,
                Message_SenderAddressList as sender_email,
                Message_RecipientList as recipients,
                Message_ToRecipientAddressList as to_emails,
                Message_CCRecipientAddressList as cc_emails,
                Message_Preview as preview,
                Message_TimeReceived as date_received,
                Message_TimeSent as date_sent,
                Message_ReadFlag as is_read,
                Record_FlagStatus as flag_status,
                Message_HasAttachment as has_attachments,
                Message_Size as size_bytes,
                Record_FolderID as folder_id,
                PathToDataFile as data_file_path
            FROM Mail
            WHERE Message_Hidden = 0 
                AND Message_MarkedForDelete = 0
            ORDER BY Message_TimeReceived DESC
            LIMIT ?
            """
            
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
            
            emails = []
            for row in rows:
                email = dict(row)
                # Convert timestamps
                if email['date_received']:
                    try:
                        # Outlook uses Mac absolute time (seconds since 2001-01-01)
                        mac_epoch = datetime(2001, 1, 1)
                        email['date_received'] = str(mac_epoch.timestamp() + float(email['date_received']))
                    except:
                        pass
                        
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
            
            if field == "subject":
                where_clause = "Message_NormalizedSubject LIKE ?"
            elif field == "sender":
                where_clause = "(Message_SenderList LIKE ? OR Message_SenderAddressList LIKE ?)"
                search_pattern = (search_pattern, search_pattern)
            elif field == "content":
                where_clause = "Message_Preview LIKE ?"
            else:  # all
                where_clause = """(Message_NormalizedSubject LIKE ? 
                                OR Message_SenderList LIKE ? 
                                OR Message_Preview LIKE ?
                                OR Message_RecipientList LIKE ?)"""
                search_pattern = (search_pattern, search_pattern, search_pattern, search_pattern)
            
            query_sql = f"""
            SELECT 
                Record_RecordID as id,
                Message_MessageID as message_id,
                Message_NormalizedSubject as subject,
                Message_SenderList as sender,
                Message_Preview as preview,
                Message_TimeReceived as date_received,
                Message_ReadFlag as is_read,
                Message_HasAttachment as has_attachments
            FROM Mail
            WHERE Message_Hidden = 0 
                AND Message_MarkedForDelete = 0
                AND {where_clause}
            ORDER BY Message_TimeReceived DESC
            LIMIT ?
            """
            
            if isinstance(search_pattern, tuple):
                cursor.execute(query_sql, search_pattern + (limit,))
            else:
                cursor.execute(query_sql, (search_pattern, limit))
            
            rows = cursor.fetchall()
            emails = [dict(row) for row in rows]
            
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
                Record_RecordID as id,
                Message_NormalizedSubject as subject,
                Message_SenderList as sender,
                Message_Preview as preview,
                Message_TimeReceived as date_received,
                Message_HasAttachment as has_attachments,
                Record_FlagStatus as flag_status
            FROM Mail
            WHERE Message_Hidden = 0 
                AND Message_MarkedForDelete = 0
                AND Message_ReadFlag = 0
            ORDER BY Message_TimeReceived DESC
            LIMIT ?
            """
            
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
            emails = [dict(row) for row in rows]
            
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
                Record_RecordID as id,
                Message_NormalizedSubject as subject,
                Message_SenderList as sender,
                Message_Preview as preview,
                Message_TimeReceived as date_received,
                Record_FlagStatus as flag_status
            FROM Mail
            WHERE Message_Hidden = 0 
                AND Message_MarkedForDelete = 0
                AND Record_FlagStatus > 0
            ORDER BY Message_TimeReceived DESC
            LIMIT ?
            """
            
            cursor.execute(query, (limit,))
            rows = cursor.fetchall()
            emails = [dict(row) for row in rows]
            
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
            cursor.execute("SELECT COUNT(*) FROM Mail WHERE Message_Hidden = 0 AND Message_MarkedForDelete = 0")
            stats['total_emails'] = cursor.fetchone()[0]
            
            # Unread emails
            cursor.execute("SELECT COUNT(*) FROM Mail WHERE Message_Hidden = 0 AND Message_MarkedForDelete = 0 AND Message_ReadFlag = 0")
            stats['unread_count'] = cursor.fetchone()[0]
            
            # Flagged emails
            cursor.execute("SELECT COUNT(*) FROM Mail WHERE Message_Hidden = 0 AND Message_MarkedForDelete = 0 AND Record_FlagStatus > 0")
            stats['flagged_count'] = cursor.fetchone()[0]
            
            # Emails with attachments
            cursor.execute("SELECT COUNT(*) FROM Mail WHERE Message_Hidden = 0 AND Message_MarkedForDelete = 0 AND Message_HasAttachment = 1")
            stats['with_attachments'] = cursor.fetchone()[0]
            
            # Get folder counts
            cursor.execute("""
                SELECT Record_FolderID, COUNT(*) as count 
                FROM Mail 
                WHERE Message_Hidden = 0 AND Message_MarkedForDelete = 0
                GROUP BY Record_FolderID
                ORDER BY count DESC
                LIMIT 10
            """)
            stats['folder_distribution'] = cursor.fetchall()
            
            conn.close()
            return stats
            
        except Exception as e:
            return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser(description='Direct Outlook Database Reader')
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
        reader = OutlookDBReader()
        
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
            print(json.dumps(result, indent=2))
        else:
            if isinstance(result, dict):
                # Stats output
                for key, value in result.items():
                    print(f"{key}: {value}")
            else:
                # Email list output
                for i, email in enumerate(result, 1):
                    if 'error' in email:
                        print(f"Error: {email['error']}")
                        break
                    print(f"\n--- Email {i} ---")
                    print(f"Subject: {email.get('subject', 'N/A')}")
                    print(f"From: {email.get('sender', 'N/A')}")
                    print(f"Preview: {email.get('preview', 'N/A')[:100]}...")
                    if email.get('is_read') == 0:
                        print("Status: UNREAD")
                    if email.get('has_attachments'):
                        print("Has Attachments: Yes")
    
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Make sure Outlook is installed and has been run at least once.")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()