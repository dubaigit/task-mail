#!/usr/bin/env python3
"""
Complete Email Management Solution
Fetches emails from last month with full content and stores them in SQLite database.
Includes analysis for reply requirements, task generation, and markdown export.
"""

import subprocess
import sqlite3
import json
import re
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional


class CompleteEmailManager:
    def __init__(self):
        self.db_path = "email_management.db"
        self.conn = sqlite3.connect(self.db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        self.create_database()
    
    def create_database(self):
        """Create all necessary tables."""
        
        # Main emails table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS emails (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subject TEXT,
                sender TEXT,
                sender_email TEXT,
                recipients TEXT,
                date_received TEXT,
                content TEXT,
                mailbox TEXT,
                is_read BOOLEAN DEFAULT 0,
                is_flagged BOOLEAN DEFAULT 0,
                has_attachments BOOLEAN DEFAULT 0,
                requires_reply BOOLEAN DEFAULT 0,
                priority TEXT DEFAULT 'normal',
                category TEXT DEFAULT 'general',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Tasks table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email_id INTEGER,
                task_title TEXT,
                task_description TEXT,
                due_date TEXT,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (email_id) REFERENCES emails(id)
            )
        ''')
        
        # Draft replies table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS draft_replies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email_id INTEGER,
                draft_subject TEXT,
                draft_body TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (email_id) REFERENCES emails(id)
            )
        ''')
        
        self.conn.commit()
    
    def fetch_emails_from_mail(self, days_back: int = 30) -> List[Dict]:
        """Fetch emails from Mail app for the specified period."""
        
        print(f"📧 Fetching emails from last {days_back} days...")
        
        # AppleScript to get emails from Exchange account
        script = f'''
        tell application "Mail"
            set emailList to {{}}
            set emailCount to 0
            set maxEmails to 500
            set cutoffDate to (current date) - ({days_back} * days)
            
            -- Process Exchange account mailboxes
            repeat with mb in mailboxes of account "Exchange"
                set mbName to name of mb
                
                -- Check inbox and sent folders
                if mbName contains "Inbox" or mbName contains "Sent" then
                    try
                        -- Get all messages from mailbox
                        set allMessages to messages of mb
                        
                        -- Process each message
                        repeat with msg in allMessages
                            if emailCount < maxEmails then
                                try
                                    set msgDate to date received of msg
                                    
                                    -- Check if within date range
                                    if msgDate ≥ cutoffDate then
                                        -- Get email details
                                        set msgSubject to subject of msg
                                        set msgSender to sender of msg
                                        set msgDateStr to (msgDate as string)
                                        set msgRead to read status of msg
                                        set msgFlagged to flagged status of msg
                                        
                                        -- Get content (limited to avoid memory issues)
                                        set msgContent to ""
                                        try
                                            set msgContent to content of msg
                                            if length of msgContent > 20000 then
                                                set msgContent to text 1 thru 20000 of msgContent & "...[truncated]"
                                            end if
                                        on error
                                            set msgContent to "(Content unavailable)"
                                        end try
                                        
                                        -- Get recipients
                                        set msgRecipients to ""
                                        try
                                            repeat with recip in (to recipients of msg)
                                                set msgRecipients to msgRecipients & (address of recip) & ", "
                                            end repeat
                                        end try
                                        
                                        -- Check attachments
                                        set hasAttach to false
                                        try
                                            set hasAttach to (count of mail attachments of msg) > 0
                                        end try
                                        
                                        -- Build email record
                                        set emailRecord to "|||START|||" & return
                                        set emailRecord to emailRecord & "SUBJECT:" & msgSubject & return
                                        set emailRecord to emailRecord & "FROM:" & msgSender & return
                                        set emailRecord to emailRecord & "TO:" & msgRecipients & return
                                        set emailRecord to emailRecord & "DATE:" & msgDateStr & return
                                        set emailRecord to emailRecord & "MAILBOX:" & mbName & return
                                        set emailRecord to emailRecord & "READ:" & msgRead & return
                                        set emailRecord to emailRecord & "FLAGGED:" & msgFlagged & return
                                        set emailRecord to emailRecord & "ATTACHMENTS:" & hasAttach & return
                                        set emailRecord to emailRecord & "CONTENT_START:" & return
                                        set emailRecord to emailRecord & msgContent & return
                                        set emailRecord to emailRecord & "|||END|||" & return
                                        
                                        set end of emailList to emailRecord
                                        set emailCount to emailCount + 1
                                        
                                        if emailCount mod 25 = 0 then
                                            log "Processed " & emailCount & " emails..."
                                        end if
                                    end if
                                on error errMsg
                                    log "Error processing message: " & errMsg
                                end try
                            end if
                        end repeat
                    on error errMsg
                        log "Error with mailbox " & mbName & ": " & errMsg
                    end try
                end if
            end repeat
            
            log "Total emails fetched: " & emailCount
            
            -- Return as string
            set AppleScript's text item delimiters to ""
            return emailList as string
        end tell
        '''
        
        # Run AppleScript
        result = subprocess.run(['osascript', '-e', script],
                              capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            print(f"❌ Error: {result.stderr}")
            return []
        
        # Parse results
        emails = []
        blocks = result.stdout.split("|||START|||")
        
        for block in blocks:
            if "|||END|||" in block:
                email = self.parse_email_block(block)
                if email:
                    emails.append(email)
        
        print(f"✅ Fetched {len(emails)} emails")
        return emails
    
    def parse_email_block(self, block: str) -> Optional[Dict]:
        """Parse email block into dictionary."""
        
        email = {}
        lines = block.split("\n")
        content_started = False
        content_lines = []
        
        for line in lines:
            if "|||END|||" in line:
                break
            elif "CONTENT_START:" in line:
                content_started = True
            elif content_started:
                content_lines.append(line)
            elif ":" in line and not content_started:
                key, value = line.split(":", 1)
                email[key.strip()] = value.strip()
        
        if content_lines:
            email['CONTENT'] = "\n".join(content_lines)
        
        return email if email else None
    
    def analyze_email(self, email: Dict) -> Dict:
        """Analyze email for reply requirements and categorization."""
        
        sender = email.get('FROM', '').lower()
        subject = email.get('SUBJECT', '').lower()
        content = email.get('CONTENT', '').lower()[:1000]
        
        analysis = {
            'requires_reply': False,
            'priority': 'normal',
            'category': 'general',
            'is_automated': False
        }
        
        # Check if automated
        auto_keywords = ['no-reply', 'noreply', 'notification', 'automated']
        analysis['is_automated'] = any(kw in sender for kw in auto_keywords)
        
        # Check if requires reply
        if not analysis['is_automated']:
            reply_indicators = ['please reply', 'let me know', 'your response',
                              'waiting for', 'urgent', 'asap', '?']
            for indicator in reply_indicators:
                if indicator in subject or indicator in content:
                    analysis['requires_reply'] = True
                    break
        
        # Determine priority
        if any(word in subject or word in content[:200] 
               for word in ['urgent', 'asap', 'critical', 'important']):
            analysis['priority'] = 'high'
        
        # Categorize
        if 'meeting' in subject or 'meeting' in content:
            analysis['category'] = 'meeting'
        elif 'project' in subject or 'project' in content:
            analysis['category'] = 'project'
        elif 'invoice' in subject or 'payment' in content:
            analysis['category'] = 'finance'
        elif any(word in subject or word in content 
                for word in ['bug', 'error', 'issue', 'problem']):
            analysis['category'] = 'technical'
        
        return analysis
    
    def store_emails(self, emails: List[Dict]) -> int:
        """Store emails in database."""
        
        stored = 0
        
        for email in emails:
            try:
                # Extract sender email
                sender_email = ""
                if '<' in email.get('FROM', ''):
                    sender_email = re.search(r'<(.+?)>', email['FROM']).group(1)
                else:
                    sender_email = email.get('FROM', '')
                
                # Analyze email
                analysis = self.analyze_email(email)
                
                # Insert email
                self.cursor.execute('''
                    INSERT INTO emails (
                        subject, sender, sender_email, recipients,
                        date_received, content, mailbox,
                        is_read, is_flagged, has_attachments,
                        requires_reply, priority, category
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    email.get('SUBJECT', ''),
                    email.get('FROM', ''),
                    sender_email,
                    email.get('TO', ''),
                    email.get('DATE', ''),
                    email.get('CONTENT', ''),
                    email.get('MAILBOX', ''),
                    email.get('READ', '').lower() == 'true',
                    email.get('FLAGGED', '').lower() == 'true',
                    email.get('ATTACHMENTS', '').lower() == 'true',
                    analysis['requires_reply'],
                    analysis['priority'],
                    analysis['category']
                ))
                
                email_id = self.cursor.lastrowid
                
                # Create task if needed
                if analysis['requires_reply']:
                    self.cursor.execute('''
                        INSERT INTO tasks (email_id, task_title, task_description, due_date)
                        VALUES (?, ?, ?, ?)
                    ''', (
                        email_id,
                        f"Reply to: {email.get('SUBJECT', 'Email')}",
                        f"From: {email.get('FROM', 'Unknown')}",
                        (datetime.now() + timedelta(days=2)).strftime('%Y-%m-%d')
                    ))
                    
                    # Create draft reply
                    sender_name = email.get('FROM', '').split('<')[0].strip()
                    draft_body = f"""Hi {sender_name},

Thank you for your email regarding "{email.get('SUBJECT', '')}".

I have received your message and will respond with the requested information shortly.

Best regards,
[Your name]"""
                    
                    self.cursor.execute('''
                        INSERT INTO draft_replies (email_id, draft_subject, draft_body)
                        VALUES (?, ?, ?)
                    ''', (
                        email_id,
                        f"Re: {email.get('SUBJECT', '')}",
                        draft_body
                    ))
                
                stored += 1
                
            except Exception as e:
                print(f"Error storing email: {e}")
        
        self.conn.commit()
        return stored
    
    def export_to_markdown(self, output_dir: str = "email_archive"):
        """Export all emails to markdown format."""
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Get all emails
        emails = self.cursor.execute('''
            SELECT * FROM emails 
            ORDER BY date_received DESC
        ''').fetchall()
        
        # Create main index
        index_path = os.path.join(output_dir, "INDEX.md")
        
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write("# 📧 Email Archive\n\n")
            f.write(f"**Total Emails**: {len(emails)}\n")
            f.write(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
            
            # Statistics
            needs_reply = sum(1 for e in emails if e['requires_reply'])
            high_priority = sum(1 for e in emails if e['priority'] == 'high')
            unread = sum(1 for e in emails if not e['is_read'])
            
            f.write("## 📊 Statistics\n\n")
            f.write(f"- 📨 Unread: {unread}\n")
            f.write(f"- ⚠️ Needs Reply: {needs_reply}\n")
            f.write(f"- 🚨 High Priority: {high_priority}\n\n")
            
            # Email list
            f.write("## 📋 Emails\n\n")
            
            for i, email in enumerate(emails, 1):
                # Create individual file
                safe_subject = re.sub(r'[^\w\s-]', '', email['subject'])[:50]
                filename = f"{i:04d}_{safe_subject.replace(' ', '_')}.md"
                filepath = os.path.join(output_dir, filename)
                
                # Index entry
                status = []
                if not email['is_read']:
                    status.append("📨 UNREAD")
                if email['requires_reply']:
                    status.append("⚠️ REPLY")
                if email['priority'] == 'high':
                    status.append("🚨 HIGH")
                
                status_str = " | ".join(status) if status else ""
                
                f.write(f"### {i}. {email['subject']}\n")
                f.write(f"- **From**: {email['sender']}\n")
                f.write(f"- **Date**: {email['date_received']}\n")
                if status_str:
                    f.write(f"- **Status**: {status_str}\n")
                f.write(f"- [📄 View Email]({filename})\n\n")
                
                # Individual email file
                with open(filepath, 'w', encoding='utf-8') as ef:
                    ef.write(f"# {email['subject']}\n\n")
                    ef.write(f"**From**: {email['sender']}\n\n")
                    ef.write(f"**To**: {email['recipients']}\n\n")
                    ef.write(f"**Date**: {email['date_received']}\n\n")
                    ef.write(f"**Mailbox**: {email['mailbox']}\n\n")
                    ef.write(f"**Category**: {email['category']}\n\n")
                    
                    if email['requires_reply']:
                        ef.write("## ⚠️ ACTION REQUIRED: Reply Needed\n\n")
                        
                        # Get draft reply if exists
                        draft = self.cursor.execute('''
                            SELECT draft_body FROM draft_replies 
                            WHERE email_id = ?
                        ''', (email['id'],)).fetchone()
                        
                        if draft:
                            ef.write("### 📝 Suggested Reply:\n\n")
                            ef.write("```\n")
                            ef.write(draft['draft_body'])
                            ef.write("\n```\n\n")
                    
                    # Get tasks if any
                    tasks = self.cursor.execute('''
                        SELECT task_title, task_description, due_date
                        FROM tasks WHERE email_id = ?
                    ''', (email['id'],)).fetchall()
                    
                    if tasks:
                        ef.write("## 📋 Tasks\n\n")
                        for task in tasks:
                            ef.write(f"- [ ] **{task['task_title']}**\n")
                            ef.write(f"  - {task['task_description']}\n")
                            ef.write(f"  - Due: {task['due_date']}\n\n")
                    
                    ef.write("## 📄 Email Content\n\n")
                    ef.write("```\n")
                    ef.write(email['content'] or "(No content)")
                    ef.write("\n```\n\n")
                    
                    ef.write("---\n")
                    ef.write(f"*Email {i} of {len(emails)}*\n")
        
        print(f"✅ Exported {len(emails)} emails to {output_dir}/")
    
    def close(self):
        """Close database connection."""
        self.conn.close()


def main():
    print("🚀 Complete Email Management Solution")
    print("=" * 50)
    
    manager = CompleteEmailManager()
    
    try:
        # Fetch emails from last 30 days
        emails = manager.fetch_emails_from_mail(days_back=30)
        
        if not emails:
            print("Trying last 7 days...")
            emails = manager.fetch_emails_from_mail(days_back=7)
        
        if emails:
            # Store in database
            stored = manager.store_emails(emails)
            print(f"💾 Stored {stored} emails in database")
            
            # Export to markdown
            manager.export_to_markdown()
            
            # Show statistics
            stats = manager.cursor.execute('''
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN requires_reply = 1 THEN 1 ELSE 0 END) as needs_reply,
                    SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) as high_priority,
                    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
                FROM emails
            ''').fetchone()
            
            print("\n📊 Email Statistics:")
            print(f"  Total: {stats['total']}")
            print(f"  Needs Reply: {stats['needs_reply']}")
            print(f"  High Priority: {stats['high_priority']}")
            print(f"  Unread: {stats['unread']}")
            
            print("\n✅ Complete!")
            print(f"📁 Database: email_management.db")
            print(f"📂 Markdown: email_archive/")
        else:
            print("❌ No emails fetched")
    
    finally:
        manager.close()


if __name__ == "__main__":
    main()