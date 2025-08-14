#!/usr/bin/env python3
"""
Fetch emails from Mail app and store them in SQLite database with enhanced metadata.
Includes full content, reply requirements, task generation, and draft creation.
No Docker required - uses local SQLite database.
"""

import subprocess
import json
import re
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import hashlib
import os

class EmailDatabaseManager:
    """Manage email storage and processing in SQLite database."""
    
    def __init__(self, db_path: str = "emails.db"):
        self.db_path = db_path
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()
        self.create_tables()
    
    def create_tables(self):
        """Create database tables if they don't exist."""
        
        # Emails table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS emails (
                id TEXT PRIMARY KEY,
                message_id TEXT,
                subject TEXT,
                sender TEXT,
                sender_email TEXT,
                recipients_to TEXT,
                recipients_cc TEXT,
                date_received TIMESTAMP,
                date_string TEXT,
                content TEXT,
                mailbox TEXT,
                account TEXT,
                is_read BOOLEAN,
                is_flagged BOOLEAN,
                has_attachments BOOLEAN,
                requires_reply BOOLEAN,
                reply_drafted BOOLEAN,
                reply_sent BOOLEAN,
                priority TEXT,
                category TEXT,
                is_automated BOOLEAN,
                reply_by TIMESTAMP,
                keywords TEXT,
                action_items TEXT,
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Tasks table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email_id TEXT,
                title TEXT,
                description TEXT,
                due_date TIMESTAMP,
                priority TEXT,
                status TEXT,
                action_items TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP,
                FOREIGN KEY (email_id) REFERENCES emails(id)
            )
        ''')
        
        # Drafts table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS drafts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email_id TEXT,
                subject TEXT,
                to_address TEXT,
                cc_address TEXT,
                body TEXT,
                status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                sent_at TIMESTAMP,
                FOREIGN KEY (email_id) REFERENCES emails(id)
            )
        ''')
        
        # Create indexes
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_email_date ON emails(date_received DESC)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_email_sender ON emails(sender_email)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_email_requires_reply ON emails(requires_reply)')
        self.cursor.execute('CREATE INDEX IF NOT EXISTS idx_task_status ON tasks(status)')
        
        self.conn.commit()
    
    def get_full_email_content(self, days_back: int = 30, limit: int = 1000) -> List[Dict]:
        """Fetch emails with full content from specified days back using AppleScript."""
        
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days_back)
        
        print(f"📅 Fetching emails from {start_date.date()} to {end_date.date()}")
        
        script = f'''
        tell application "Mail"
            activate
            set emailList to {{}}
            set emailCount to 0
            set startDate to (current date) - ({days_back} * days)
            set endDate to current date
            
            log "Fetching emails from last {days_back} days"
            
            repeat with acct in accounts
                set acctName to name of acct
                repeat with mbox in mailboxes of acct
                    try
                        if name of mbox is "INBOX" or name of mbox is "Sent" or name of mbox contains "Important" then
                            -- Get recent messages
                            set msgs to messages of mbox
                            set msgCount to count of msgs
                            
                            -- Process most recent messages first
                            repeat with i from 1 to msgCount
                                if emailCount < {limit} then
                                    try
                                        set msg to item i of msgs
                                        set msgDate to date received of msg
                                        
                                        if msgDate ≥ startDate and msgDate ≤ endDate then
                                            -- Get all email details
                                            set msgID to message id of msg
                                            set msgDateStr to (msgDate as string)
                                            set msgSubject to subject of msg
                                            set msgSender to sender of msg
                                            set msgRead to read status of msg
                                            set msgFlagged to flagged status of msg
                                            
                                            -- Get full content (may be large)
                                            set msgContent to ""
                                            try
                                                set msgContent to content of msg
                                                -- Limit content to 50000 chars to avoid memory issues
                                                if length of msgContent > 50000 then
                                                    set msgContent to text 1 thru 50000 of msgContent & "...[truncated]"
                                                end if
                                            on error
                                                set msgContent to "(Content unavailable)"
                                            end try
                                            
                                            -- Get recipients
                                            set toRecipients to ""
                                            try
                                                repeat with recipient in (to recipients of msg)
                                                    set toRecipients to toRecipients & (address of recipient) & ","
                                                end repeat
                                            end try
                                            
                                            set ccRecipients to ""
                                            try
                                                repeat with recipient in (cc recipients of msg)
                                                    set ccRecipients to ccRecipients & (address of recipient) & ","
                                                end repeat
                                            end try
                                            
                                            -- Check for attachments
                                            set hasAttachments to false
                                            try
                                                set hasAttachments to (count of mail attachments of msg) > 0
                                            end try
                                            
                                            -- Create structured output
                                            set emailRecord to "|||EMAIL_START|||" & return
                                            set emailRecord to emailRecord & "ID:" & msgID & return
                                            set emailRecord to emailRecord & "DATE:" & msgDateStr & return
                                            set emailRecord to emailRecord & "SUBJECT:" & msgSubject & return
                                            set emailRecord to emailRecord & "FROM:" & msgSender & return
                                            set emailRecord to emailRecord & "TO:" & toRecipients & return
                                            set emailRecord to emailRecord & "CC:" & ccRecipients & return
                                            set emailRecord to emailRecord & "READ:" & msgRead & return
                                            set emailRecord to emailRecord & "FLAGGED:" & msgFlagged & return
                                            set emailRecord to emailRecord & "ATTACHMENTS:" & hasAttachments & return
                                            set emailRecord to emailRecord & "MAILBOX:" & (name of mbox) & return
                                            set emailRecord to emailRecord & "ACCOUNT:" & acctName & return
                                            set emailRecord to emailRecord & "|||CONTENT_START|||" & return
                                            set emailRecord to emailRecord & msgContent & return
                                            set emailRecord to emailRecord & "|||EMAIL_END|||" & return
                                            
                                            set end of emailList to emailRecord
                                            set emailCount to emailCount + 1
                                            
                                            if emailCount mod 25 = 0 then
                                                log "Processed " & emailCount & " emails..."
                                            end if
                                        end if
                                    on error errMsg
                                        log "Error processing email: " & errMsg
                                    end try
                                end if
                            end repeat
                        end if
                    on error errMsg
                        log "Error accessing mailbox: " & errMsg
                    end try
                end repeat
            end repeat
            
            log "Total emails found: " & emailCount
            
            -- Return as string
            set AppleScript's text item delimiters to ""
            return emailList as string
        end tell
        '''
        
        print("🔄 Running AppleScript to fetch emails (this may take a minute)...")
        result = subprocess.run(['osascript', '-e', script], 
                              capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            print(f"❌ Error: {result.stderr}")
            return []
        
        # Parse the output
        emails = []
        email_blocks = result.stdout.split("|||EMAIL_START|||")
        
        for block in email_blocks:
            if "|||EMAIL_END|||" in block:
                email = self.parse_email_block(block)
                if email:
                    emails.append(email)
        
        print(f"✅ Fetched {len(emails)} emails with full content")
        return emails
    
    def parse_email_block(self, block: str) -> Optional[Dict]:
        """Parse an email block into a dictionary."""
        try:
            email = {}
            content_started = False
            content_lines = []
            
            lines = block.split("\n")
            for line in lines:
                if "|||EMAIL_END|||" in line:
                    break
                elif "|||CONTENT_START|||" in line:
                    content_started = True
                elif content_started:
                    content_lines.append(line)
                elif ":" in line and not content_started:
                    key, value = line.split(":", 1)
                    email[key.strip().lower()] = value.strip()
            
            if content_lines:
                email['content'] = "\n".join(content_lines)
            
            return email if email else None
            
        except Exception as e:
            print(f"Error parsing email: {e}")
            return None
    
    def analyze_email(self, email: Dict) -> Dict:
        """Analyze email to determine if it requires reply, tasks, etc."""
        
        analysis = {
            'requires_reply': False,
            'priority': 'normal',
            'category': 'general',
            'action_items': [],
            'is_automated': False,
            'reply_by': None,
            'keywords': []
        }
        
        sender = email.get('from', '').lower()
        subject = email.get('subject', '').lower()
        content = email.get('content', '').lower()[:2000]  # Analyze first 2000 chars
        
        # Check if automated
        automated_patterns = ['no-reply', 'noreply', 'donotreply', 'notification', 
                            'automated', 'system', 'bounce', 'mailer-daemon', 
                            'postmaster', 'auto-confirm']
        analysis['is_automated'] = any(pattern in sender for pattern in automated_patterns)
        
        # Check if requires reply
        if not analysis['is_automated']:
            reply_indicators = [
                'please reply', 'please respond', 'let me know', 'let us know',
                'your thoughts', 'feedback', 'urgent', 'asap', 'action required',
                'waiting for', 'need your', 'could you', 'can you',
                'would you', 'will you', 'kindly', 'request'
            ]
            
            # Check for questions
            if '?' in subject or content.count('?') > 1:
                analysis['requires_reply'] = True
            else:
                for indicator in reply_indicators:
                    if indicator in subject or indicator in content:
                        analysis['requires_reply'] = True
                        break
        
        # Determine priority
        high_priority_words = ['urgent', 'asap', 'critical', 'important', 
                              'emergency', 'immediate', 'deadline', 'escalation',
                              'high priority', 'time sensitive']
        for word in high_priority_words:
            if word in subject or word in content[:500]:
                analysis['priority'] = 'high'
                break
        
        # Extract action items using regex
        action_patterns = [
            r'please (\w+ \w+|\w+)',
            r'could you (\w+ \w+|\w+)',
            r'can you (\w+ \w+|\w+)',
            r'need to (\w+ \w+|\w+)',
            r'must (\w+ \w+|\w+)',
            r'should (\w+ \w+|\w+)',
            r'action: (.+)',
            r'todo: (.+)',
            r'task: (.+)',
            r'- \[ \] (.+)'  # Markdown checkboxes
        ]
        
        for pattern in action_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            for match in matches[:3]:  # Limit to 3 per pattern
                if len(match) > 3:  # Filter out too short matches
                    analysis['action_items'].append(match.strip())
        
        # Categorize email
        categories = {
            'meeting': ['meeting', 'schedule', 'calendar', 'appointment', 'call', 'conference'],
            'project': ['project', 'milestone', 'deadline', 'deliverable', 'sprint', 'release'],
            'finance': ['invoice', 'payment', 'budget', 'expense', 'purchase', 'cost'],
            'hr': ['leave', 'vacation', 'salary', 'benefits', 'policy', 'training'],
            'technical': ['bug', 'issue', 'error', 'system', 'server', 'database', 'deploy'],
            'sales': ['proposal', 'quote', 'contract', 'deal', 'customer', 'client'],
            'support': ['ticket', 'help', 'support', 'problem', 'resolve']
        }
        
        for category, keywords in categories.items():
            if any(keyword in subject or keyword in content[:500] 
                  for keyword in keywords):
                analysis['category'] = category
                break
        
        # Extract important keywords from subject
        words = re.findall(r'\b[A-Z][a-z]+\b', email.get('subject', ''))
        analysis['keywords'] = list(set(words[:5]))
        
        # Set reply deadline
        if analysis['requires_reply']:
            if analysis['priority'] == 'high':
                analysis['reply_by'] = datetime.now() + timedelta(hours=24)
            else:
                analysis['reply_by'] = datetime.now() + timedelta(days=3)
        
        return analysis
    
    def generate_draft_reply(self, email: Dict, analysis: Dict) -> str:
        """Generate a smart draft reply based on email content."""
        
        subject = email.get('subject', '')
        sender_name = email.get('from', '').split('<')[0].strip()
        category = analysis.get('category', 'general')
        action_items = analysis.get('action_items', [])
        
        # Category-specific templates
        templates = {
            'meeting': f"""Hi {sender_name},

Thank you for the meeting invitation regarding "{subject}".

I've reviewed the proposed time and will confirm my availability shortly. Please let me know if there are any specific items you'd like me to prepare or review beforehand.

Best regards,
[Your name]""",
            
            'project': f"""Hi {sender_name},

Thank you for the update on "{subject}".

I've reviewed the information provided and noted the following action items:
{chr(10).join(['• ' + item for item in action_items[:3]]) if action_items else '• Will review and provide feedback'}

I'll follow up with any questions or updates by [date].

Best regards,
[Your name]""",
            
            'technical': f"""Hi {sender_name},

I've received your message regarding "{subject}".

I'll investigate this issue and provide an update with:
• Initial findings
• Proposed solution
• Timeline for resolution

I'll get back to you within 24 hours with more details.

Best regards,
[Your name]""",
            
            'support': f"""Hi {sender_name},

Thank you for reaching out regarding "{subject}".

I understand your concern and will look into this immediately. To better assist you, could you please provide:
• Any error messages you're seeing
• Steps to reproduce the issue
• Your system/version information

I'll work on resolving this as quickly as possible.

Best regards,
[Your name]""",
            
            'general': f"""Hi {sender_name},

Thank you for your email regarding "{subject}".

I've received your message and will review it carefully. I'll respond with detailed feedback soon.

Best regards,
[Your name]"""
        }
        
        return templates.get(category, templates['general'])
    
    def store_emails(self, emails: List[Dict]) -> int:
        """Store emails in the database with analysis."""
        
        stored_count = 0
        skipped_count = 0
        
        for email in emails:
            try:
                # Generate unique ID
                email_id = email.get('id', '')
                if not email_id:
                    content_hash = hashlib.md5(
                        f"{email.get('subject', '')}{email.get('from', '')}{email.get('date', '')}".encode()
                    ).hexdigest()
                    email_id = content_hash
                
                # Check if exists
                existing = self.cursor.execute(
                    'SELECT id FROM emails WHERE id = ?', (email_id,)
                ).fetchone()
                
                if existing:
                    skipped_count += 1
                    continue
                
                # Analyze email
                analysis = self.analyze_email(email)
                
                # Extract email address
                sender_email = re.search(r'<(.+?)>', email.get('from', ''))
                sender_email = sender_email.group(1) if sender_email else email.get('from', '')
                
                # Parse date
                date_str = email.get('date', '')
                try:
                    # Try to parse the date string
                    date_received = datetime.now()  # Fallback
                except:
                    date_received = datetime.now()
                
                # Insert email
                self.cursor.execute('''
                    INSERT INTO emails (
                        id, message_id, subject, sender, sender_email,
                        recipients_to, recipients_cc, date_received, date_string,
                        content, mailbox, account, is_read, is_flagged,
                        has_attachments, requires_reply, reply_drafted, reply_sent,
                        priority, category, is_automated, reply_by,
                        keywords, action_items, processed_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    email_id,
                    email.get('id', ''),
                    email.get('subject', ''),
                    email.get('from', ''),
                    sender_email,
                    email.get('to', ''),
                    email.get('cc', ''),
                    date_received,
                    date_str,
                    email.get('content', ''),
                    email.get('mailbox', 'INBOX'),
                    email.get('account', ''),
                    email.get('read', '').lower() == 'true',
                    email.get('flagged', '').lower() == 'true',
                    email.get('attachments', '').lower() == 'true',
                    analysis['requires_reply'],
                    False,
                    False,
                    analysis['priority'],
                    analysis['category'],
                    analysis['is_automated'],
                    analysis['reply_by'],
                    json.dumps(analysis['keywords']),
                    json.dumps(analysis['action_items']),
                    datetime.now()
                ))
                
                stored_count += 1
                
                # Create draft if needed
                if analysis['requires_reply'] and not analysis['is_automated']:
                    draft_body = self.generate_draft_reply(email, analysis)
                    self.cursor.execute('''
                        INSERT INTO drafts (email_id, subject, to_address, body, status)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (
                        email_id,
                        f"Re: {email.get('subject', '')}",
                        email.get('from', ''),
                        draft_body,
                        'draft'
                    ))
                
                # Create task if needed
                if analysis['action_items'] or (analysis['requires_reply'] and not analysis['is_automated']):
                    self.cursor.execute('''
                        INSERT INTO tasks (
                            email_id, title, description, due_date,
                            priority, status, action_items, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        email_id,
                        f"Reply to: {email.get('subject', 'Email')}",
                        f"From: {email.get('from', 'Unknown')}\nCategory: {analysis['category']}",
                        analysis['reply_by'],
                        analysis['priority'],
                        'pending',
                        json.dumps(analysis['action_items']),
                        datetime.now()
                    ))
                
                if stored_count % 10 == 0:
                    print(f"📊 Processed {stored_count} emails...")
                    self.conn.commit()
                    
            except Exception as e:
                print(f"❌ Error storing email: {e}")
                continue
        
        self.conn.commit()
        print(f"\n✅ Stored {stored_count} new emails")
        print(f"⏭️  Skipped {skipped_count} existing emails")
        
        return stored_count
    
    def get_statistics(self) -> Dict:
        """Get statistics from stored emails."""
        
        stats = {}
        
        # Basic counts
        stats['total_emails'] = self.cursor.execute('SELECT COUNT(*) FROM emails').fetchone()[0]
        stats['unread'] = self.cursor.execute('SELECT COUNT(*) FROM emails WHERE is_read = 0').fetchone()[0]
        stats['flagged'] = self.cursor.execute('SELECT COUNT(*) FROM emails WHERE is_flagged = 1').fetchone()[0]
        stats['requires_reply'] = self.cursor.execute('SELECT COUNT(*) FROM emails WHERE requires_reply = 1').fetchone()[0]
        stats['high_priority'] = self.cursor.execute('SELECT COUNT(*) FROM emails WHERE priority = "high"').fetchone()[0]
        stats['automated'] = self.cursor.execute('SELECT COUNT(*) FROM emails WHERE is_automated = 1').fetchone()[0]
        stats['with_attachments'] = self.cursor.execute('SELECT COUNT(*) FROM emails WHERE has_attachments = 1').fetchone()[0]
        
        # Tasks and drafts
        stats['total_tasks'] = self.cursor.execute('SELECT COUNT(*) FROM tasks').fetchone()[0]
        stats['pending_tasks'] = self.cursor.execute('SELECT COUNT(*) FROM tasks WHERE status = "pending"').fetchone()[0]
        stats['total_drafts'] = self.cursor.execute('SELECT COUNT(*) FROM drafts').fetchone()[0]
        
        # Top senders
        top_senders = self.cursor.execute('''
            SELECT sender_email, COUNT(*) as count 
            FROM emails 
            GROUP BY sender_email 
            ORDER BY count DESC 
            LIMIT 10
        ''').fetchall()
        stats['top_senders'] = [(row[0], row[1]) for row in top_senders]
        
        # Category distribution
        categories = self.cursor.execute('''
            SELECT category, COUNT(*) as count 
            FROM emails 
            GROUP BY category 
            ORDER BY count DESC
        ''').fetchall()
        stats['categories'] = {row[0]: row[1] for row in categories}
        
        return stats
    
    def export_to_markdown(self, output_dir: str = "email_export"):
        """Export emails to markdown files."""
        
        os.makedirs(output_dir, exist_ok=True)
        
        # Get all emails
        emails = self.cursor.execute('''
            SELECT * FROM emails 
            ORDER BY date_received DESC 
            LIMIT 1000
        ''').fetchall()
        
        # Create index file
        index_path = os.path.join(output_dir, "INDEX.md")
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write("# Email Database Export\n")
            f.write(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"**Total Emails**: {len(emails)}\n\n")
            
            # Statistics
            stats = self.get_statistics()
            f.write("## 📊 Statistics\n\n")
            f.write(f"- **Unread**: {stats['unread']}\n")
            f.write(f"- **Requires Reply**: {stats['requires_reply']}\n")
            f.write(f"- **High Priority**: {stats['high_priority']}\n")
            f.write(f"- **With Attachments**: {stats['with_attachments']}\n")
            f.write(f"- **Pending Tasks**: {stats['pending_tasks']}\n")
            f.write(f"- **Draft Replies**: {stats['total_drafts']}\n\n")
            
            f.write("## 📧 Emails\n\n")
            
            for i, email in enumerate(emails, 1):
                # Create individual file
                filename = f"{i:04d}_{self.sanitize_filename(email['subject'])}.md"
                email_path = os.path.join(output_dir, filename)
                
                # Write to index
                f.write(f"### {i}. [{email['subject']}]({filename})\n")
                f.write(f"- **From**: {email['sender']}\n")
                f.write(f"- **Date**: {email['date_string']}\n")
                f.write(f"- **Category**: {email['category']}\n")
                f.write(f"- **Priority**: {email['priority']}\n")
                if email['requires_reply']:
                    f.write(f"- **⚠️ Requires Reply**\n")
                f.write("\n")
                
                # Write individual file
                with open(email_path, 'w', encoding='utf-8') as ef:
                    ef.write(f"# {email['subject']}\n\n")
                    ef.write(f"**From**: {email['sender']}\n\n")
                    ef.write(f"**To**: {email['recipients_to']}\n\n")
                    ef.write(f"**Date**: {email['date_string']}\n\n")
                    ef.write(f"**Category**: {email['category']}\n\n")
                    ef.write(f"**Priority**: {email['priority']}\n\n")
                    
                    if email['requires_reply']:
                        ef.write("## ⚠️ Requires Reply\n\n")
                        
                        # Get draft if exists
                        draft = self.cursor.execute(
                            'SELECT body FROM drafts WHERE email_id = ?',
                            (email['id'],)
                        ).fetchone()
                        
                        if draft:
                            ef.write("### Suggested Reply:\n\n")
                            ef.write("```\n")
                            ef.write(draft[0])
                            ef.write("\n```\n\n")
                    
                    if email['action_items'] and email['action_items'] != '[]':
                        ef.write("## 📋 Action Items\n\n")
                        items = json.loads(email['action_items'])
                        for item in items:
                            ef.write(f"- [ ] {item}\n")
                        ef.write("\n")
                    
                    ef.write("## 📄 Content\n\n")
                    ef.write("```\n")
                    ef.write(email['content'] or "(No content)")
                    ef.write("\n```\n\n")
                    
                    ef.write("---\n\n")
                    ef.write(f"*Email {i} of {len(emails)}*\n")
        
        print(f"✅ Exported {len(emails)} emails to {output_dir}/")
    
    def sanitize_filename(self, filename: str) -> str:
        """Remove invalid characters from filename."""
        filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
        filename = re.sub(r'[\n\r\t]', ' ', filename)
        if len(filename) > 50:
            filename = filename[:50]
        return filename.strip()
    
    def close(self):
        """Close database connection."""
        self.conn.close()


def main():
    """Main execution function."""
    
    print("🚀 Email Database Manager")
    print("=" * 50)
    
    # Initialize manager
    manager = EmailDatabaseManager()
    
    try:
        # Fetch emails from last 30 days
        print("\n📧 Fetching emails from Mail app...")
        print("   (Requesting last 30 days of emails with full content)")
        emails = manager.get_full_email_content(days_back=30, limit=500)
        
        if not emails:
            print("⚠️  No emails from last 30 days. Trying last 7 days...")
            emails = manager.get_full_email_content(days_back=7, limit=200)
        
        if emails:
            # Store in database
            print(f"\n💾 Storing {len(emails)} emails in database...")
            stored = manager.store_emails(emails)
            
            # Get statistics
            print("\n📊 Database Statistics:")
            print("-" * 40)
            stats = manager.get_statistics()
            
            for key, value in stats.items():
                if key == 'top_senders':
                    print(f"\n🏆 Top Senders:")
                    for sender, count in value[:5]:
                        print(f"   {sender}: {count} emails")
                elif key == 'categories':
                    print(f"\n📁 Categories:")
                    for cat, count in value.items():
                        if cat:
                            print(f"   {cat}: {count} emails")
                elif isinstance(value, int):
                    print(f"{key.replace('_', ' ').title()}: {value}")
            
            # Export to markdown
            print("\n📝 Exporting to Markdown...")
            manager.export_to_markdown("email_export")
            
            print("\n✅ Email processing complete!")
            print(f"\n📁 Database saved as: emails.db")
            print(f"📂 Markdown export in: email_export/")
            print("\nYou can view the emails by:")
            print("  1. Opening email_export/INDEX.md")
            print("  2. Using SQLite browser on emails.db")
            
        else:
            print("❌ No emails could be fetched.")
            print("\nTroubleshooting:")
            print("1. Make sure Mail app is running")
            print("2. Grant Terminal permission to access Mail")
            print("3. Check if you have emails in the specified date range")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Close connection
        manager.close()


if __name__ == "__main__":
    main()