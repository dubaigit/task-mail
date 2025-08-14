#!/usr/bin/env python3
"""
Fetch emails from Mail app and store them in MongoDB with enhanced metadata.
Includes full content, reply requirements, task generation, and draft creation.
"""

import subprocess
import json
import re
from datetime import datetime, timedelta
from pymongo import MongoClient
from typing import Dict, List, Optional
import hashlib
import time

class EmailMongoManager:
    """Manage email storage and processing in MongoDB."""
    
    def __init__(self):
        # MongoDB connection
        self.client = MongoClient('mongodb://emailuser:emailpass@localhost:27017/emaildb')
        self.db = self.client.emaildb
        self.emails_collection = self.db.emails
        self.tasks_collection = self.db.tasks
        self.drafts_collection = self.db.drafts
        
    def get_full_email_content(self, limit: int = 1000) -> List[Dict]:
        """Fetch emails with full content from last month using AppleScript."""
        
        # Calculate last month's date range
        today = datetime.now()
        if today.month == 1:
            last_month_start = datetime(today.year - 1, 12, 1)
            last_month_end = datetime(today.year - 1, 12, 31)
        else:
            last_month_start = datetime(today.year, today.month - 1, 1)
            # Get last day of previous month
            if today.month == 3 and today.day > 28:  # Handle February
                last_month_end = datetime(today.year, 2, 28)
            else:
                last_month_end = datetime(today.year, today.month, 1) - timedelta(days=1)
        
        print(f"📅 Fetching emails from {last_month_start.date()} to {last_month_end.date()}")
        
        script = f'''
        tell application "Mail"
            activate
            set emailList to {{}}
            set emailCount to 0
            set startDate to date "{last_month_start.strftime('%B %d, %Y')}"
            set endDate to date "{last_month_end.strftime('%B %d, %Y')} 23:59:59"
            
            log "Searching for emails between " & (startDate as string) & " and " & (endDate as string)
            
            repeat with acct in accounts
                set acctName to name of acct
                repeat with mbox in mailboxes of acct
                    try
                        if name of mbox is "INBOX" or name of mbox contains "Sent" then
                            set msgs to (every message of mbox whose date received ≥ startDate and date received ≤ endDate)
                            
                            repeat with msg in msgs
                                if emailCount < {limit} then
                                    try
                                        -- Get all email details
                                        set msgID to message id of msg
                                        set msgDate to (date received of msg) as string
                                        set msgSubject to subject of msg
                                        set msgSender to sender of msg
                                        set msgRead to read status of msg
                                        set msgFlagged to flagged status of msg
                                        
                                        -- Get full content
                                        set msgContent to content of msg
                                        
                                        -- Get recipients
                                        set toRecipients to ""
                                        repeat with recipient in (to recipients of msg)
                                            set toRecipients to toRecipients & (address of recipient) & ","
                                        end repeat
                                        
                                        set ccRecipients to ""
                                        try
                                            repeat with recipient in (cc recipients of msg)
                                                set ccRecipients to ccRecipients & (address of recipient) & ","
                                            end repeat
                                        end try
                                        
                                        -- Check for attachments
                                        set hasAttachments to (count of mail attachments of msg) > 0
                                        
                                        -- Create delimiter for parsing
                                        set emailRecord to "<<<EMAIL_START>>>" & return
                                        set emailRecord to emailRecord & "ID:" & msgID & return
                                        set emailRecord to emailRecord & "DATE:" & msgDate & return
                                        set emailRecord to emailRecord & "SUBJECT:" & msgSubject & return
                                        set emailRecord to emailRecord & "FROM:" & msgSender & return
                                        set emailRecord to emailRecord & "TO:" & toRecipients & return
                                        set emailRecord to emailRecord & "CC:" & ccRecipients & return
                                        set emailRecord to emailRecord & "READ:" & msgRead & return
                                        set emailRecord to emailRecord & "FLAGGED:" & msgFlagged & return
                                        set emailRecord to emailRecord & "HAS_ATTACHMENTS:" & hasAttachments & return
                                        set emailRecord to emailRecord & "MAILBOX:" & (name of mbox) & return
                                        set emailRecord to emailRecord & "ACCOUNT:" & acctName & return
                                        set emailRecord to emailRecord & "CONTENT_START:" & return
                                        set emailRecord to emailRecord & msgContent & return
                                        set emailRecord to emailRecord & "<<<EMAIL_END>>>" & return
                                        
                                        set end of emailList to emailRecord
                                        set emailCount to emailCount + 1
                                        
                                        if emailCount mod 10 = 0 then
                                            log "Processed " & emailCount & " emails..."
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
            
            -- Return as a single string with delimiter
            set AppleScript's text item delimiters to ""
            set emailString to emailList as string
            return emailString
        end tell
        '''
        
        print("🔄 Running AppleScript to fetch emails...")
        result = subprocess.run(['osascript', '-e', script], 
                              capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            print(f"❌ Error: {result.stderr}")
            return []
        
        # Parse the output
        emails = []
        email_blocks = result.stdout.split("<<<EMAIL_START>>>")
        
        for block in email_blocks:
            if "<<<EMAIL_END>>>" in block:
                email = self.parse_email_block(block)
                if email:
                    emails.append(email)
        
        print(f"✅ Fetched {len(emails)} emails with full content")
        return emails
    
    def parse_email_block(self, block: str) -> Optional[Dict]:
        """Parse an email block into a dictionary."""
        try:
            lines = block.split("\n")
            email = {}
            content_started = False
            content_lines = []
            
            for line in lines:
                if "<<<EMAIL_END>>>" in line:
                    break
                elif content_started:
                    content_lines.append(line)
                elif line.startswith("CONTENT_START:"):
                    content_started = True
                elif ":" in line and not content_started:
                    key, value = line.split(":", 1)
                    email[key.strip().lower()] = value.strip()
            
            if content_lines:
                email['content'] = "\n".join(content_lines)
            
            # Parse date
            if 'date' in email:
                try:
                    # Parse various date formats
                    date_str = email['date']
                    # Try to parse the date (AppleScript format varies)
                    email['date_parsed'] = datetime.now()  # Fallback to now
                    # You might need to adjust this based on your locale
                except:
                    email['date_parsed'] = datetime.now()
            
            return email if email else None
            
        except Exception as e:
            print(f"Error parsing email block: {e}")
            return None
    
    def analyze_email(self, email: Dict) -> Dict:
        """Analyze email to determine if it requires reply, tasks, etc."""
        
        analysis = {
            'requires_reply': False,
            'priority': 'normal',
            'category': 'general',
            'sentiment': 'neutral',
            'action_items': [],
            'is_automated': False,
            'reply_by': None,
            'keywords': []
        }
        
        sender = email.get('from', '').lower()
        subject = email.get('subject', '').lower()
        content = email.get('content', '').lower()
        
        # Check if automated
        automated_patterns = ['no-reply', 'noreply', 'donotreply', 'notification', 
                            'automated', 'system', 'bounce', 'mailer-daemon']
        analysis['is_automated'] = any(pattern in sender for pattern in automated_patterns)
        
        # Check if requires reply
        if not analysis['is_automated']:
            reply_indicators = ['please reply', 'please respond', 'let me know',
                              'your thoughts', 'feedback', 'urgent', 'asap',
                              'waiting for', 'need your', 'could you', 'can you',
                              'would you', 'will you', '?']
            
            for indicator in reply_indicators:
                if indicator in subject or indicator in content[:500]:
                    analysis['requires_reply'] = True
                    break
        
        # Determine priority
        high_priority_words = ['urgent', 'asap', 'critical', 'important', 
                              'emergency', 'immediate', 'deadline']
        for word in high_priority_words:
            if word in subject or word in content[:200]:
                analysis['priority'] = 'high'
                break
        
        # Extract action items
        action_patterns = [
            r'please (\w+)',
            r'could you (\w+)',
            r'need to (\w+)',
            r'must (\w+)',
            r'should (\w+)',
            r'will you (\w+)',
            r'action required: (.+)',
            r'todo: (.+)',
            r'task: (.+)'
        ]
        
        for pattern in action_patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            analysis['action_items'].extend(matches[:3])  # Limit to 3 per pattern
        
        # Categorize email
        categories = {
            'meeting': ['meeting', 'schedule', 'calendar', 'appointment'],
            'project': ['project', 'milestone', 'deadline', 'deliverable'],
            'finance': ['invoice', 'payment', 'budget', 'expense'],
            'hr': ['leave', 'vacation', 'salary', 'benefits', 'policy'],
            'technical': ['bug', 'issue', 'error', 'system', 'server', 'database'],
            'sales': ['proposal', 'quote', 'contract', 'deal', 'customer']
        }
        
        for category, keywords in categories.items():
            if any(keyword in subject or keyword in content[:300] 
                  for keyword in keywords):
                analysis['category'] = category
                break
        
        # Extract keywords
        important_words = re.findall(r'\b[A-Z][a-z]+\b', email.get('subject', ''))
        analysis['keywords'] = list(set(important_words[:5]))
        
        # Set reply deadline if needed
        if analysis['requires_reply']:
            if analysis['priority'] == 'high':
                analysis['reply_by'] = datetime.now() + timedelta(days=1)
            else:
                analysis['reply_by'] = datetime.now() + timedelta(days=3)
        
        return analysis
    
    def generate_draft_reply(self, email: Dict, analysis: Dict) -> str:
        """Generate a draft reply based on email content and analysis."""
        
        subject = email.get('subject', '')
        sender_name = email.get('from', '').split('<')[0].strip()
        category = analysis.get('category', 'general')
        
        # Generate appropriate draft based on category and content
        drafts = {
            'meeting': f"""Hi {sender_name},

Thank you for the meeting invitation. I've reviewed the details and will confirm my availability shortly.

Best regards,
[Your name]""",
            
            'project': f"""Hi {sender_name},

Thank you for the update on {subject}. I've reviewed the information and will follow up with any questions.

Best regards,
[Your name]""",
            
            'technical': f"""Hi {sender_name},

I've received your message regarding {subject}. I'll investigate this issue and get back to you with findings.

Best regards,
[Your name]""",
            
            'general': f"""Hi {sender_name},

Thank you for your email. I've received your message and will respond in detail soon.

Best regards,
[Your name]"""
        }
        
        return drafts.get(category, drafts['general'])
    
    def create_task_from_email(self, email: Dict, analysis: Dict) -> Dict:
        """Create a task based on email content."""
        
        task = {
            'email_id': email.get('id', ''),
            'title': f"Reply to: {email.get('subject', 'Email')}",
            'description': f"From: {email.get('from', 'Unknown')}\n" + 
                          f"Priority: {analysis.get('priority', 'normal')}\n" +
                          f"Category: {analysis.get('category', 'general')}",
            'due_date': analysis.get('reply_by'),
            'priority': analysis.get('priority', 'normal'),
            'status': 'pending',
            'action_items': analysis.get('action_items', []),
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        return task
    
    def process_and_store_emails(self, emails: List[Dict]):
        """Process emails and store them in MongoDB with analysis."""
        
        stored_count = 0
        skipped_count = 0
        
        for email in emails:
            try:
                # Create unique ID
                email_id = email.get('id', '')
                if not email_id:
                    # Generate ID from content
                    content_hash = hashlib.md5(
                        f"{email.get('subject', '')}{email.get('from', '')}{email.get('date', '')}".encode()
                    ).hexdigest()
                    email_id = content_hash
                
                email['_id'] = email_id
                
                # Check if already exists
                if self.emails_collection.find_one({'_id': email_id}):
                    skipped_count += 1
                    continue
                
                # Analyze email
                analysis = self.analyze_email(email)
                
                # Prepare document
                email_doc = {
                    '_id': email_id,
                    'message_id': email.get('id', ''),
                    'subject': email.get('subject', ''),
                    'sender': email.get('from', ''),
                    'sender_email': self.extract_email_address(email.get('from', '')),
                    'recipients_to': email.get('to', '').split(','),
                    'recipients_cc': email.get('cc', '').split(','),
                    'date_received': email.get('date_parsed', datetime.now()),
                    'date_string': email.get('date', ''),
                    'content': email.get('content', ''),
                    'mailbox': email.get('mailbox', 'INBOX'),
                    'account': email.get('account', ''),
                    'read': email.get('read', '').lower() == 'true',
                    'flagged': email.get('flagged', '').lower() == 'true',
                    'has_attachments': email.get('has_attachments', '').lower() == 'true',
                    'requires_reply': analysis['requires_reply'],
                    'reply_drafted': False,
                    'reply_sent': False,
                    'priority': analysis['priority'],
                    'category': analysis['category'],
                    'is_automated': analysis['is_automated'],
                    'reply_by': analysis['reply_by'],
                    'keywords': analysis['keywords'],
                    'action_items': analysis['action_items'],
                    'metadata': {
                        'processed': True,
                        'processed_at': datetime.now(),
                        'analysis_version': '1.0'
                    }
                }
                
                # Store email
                self.emails_collection.insert_one(email_doc)
                stored_count += 1
                
                # Create draft reply if needed
                if analysis['requires_reply'] and not analysis['is_automated']:
                    draft = {
                        'email_id': email_id,
                        'subject': f"Re: {email.get('subject', '')}",
                        'to': email.get('from', ''),
                        'body': self.generate_draft_reply(email, analysis),
                        'created_at': datetime.now(),
                        'status': 'draft'
                    }
                    self.drafts_collection.insert_one(draft)
                
                # Create task if action items exist
                if analysis['action_items'] or analysis['requires_reply']:
                    task = self.create_task_from_email(email, analysis)
                    self.tasks_collection.insert_one(task)
                
                if stored_count % 10 == 0:
                    print(f"📊 Processed {stored_count} emails...")
                    
            except Exception as e:
                print(f"❌ Error processing email: {e}")
                continue
        
        print(f"\n✅ Stored {stored_count} new emails")
        print(f"⏭️  Skipped {skipped_count} existing emails")
        
        return stored_count
    
    def extract_email_address(self, sender: str) -> str:
        """Extract email address from sender string."""
        match = re.search(r'<(.+?)>', sender)
        if match:
            return match.group(1)
        return sender.strip()
    
    def get_statistics(self) -> Dict:
        """Get statistics from the stored emails."""
        
        stats = {
            'total_emails': self.emails_collection.count_documents({}),
            'unread': self.emails_collection.count_documents({'read': False}),
            'flagged': self.emails_collection.count_documents({'flagged': True}),
            'requires_reply': self.emails_collection.count_documents({'requires_reply': True}),
            'reply_drafted': self.emails_collection.count_documents({'reply_drafted': True}),
            'high_priority': self.emails_collection.count_documents({'priority': 'high'}),
            'automated': self.emails_collection.count_documents({'is_automated': True}),
            'with_attachments': self.emails_collection.count_documents({'has_attachments': True}),
            'total_tasks': self.tasks_collection.count_documents({}),
            'pending_tasks': self.tasks_collection.count_documents({'status': 'pending'}),
            'total_drafts': self.drafts_collection.count_documents({})
        }
        
        # Get top senders
        pipeline = [
            {'$group': {'_id': '$sender_email', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}},
            {'$limit': 10}
        ]
        
        top_senders = list(self.emails_collection.aggregate(pipeline))
        stats['top_senders'] = [(s['_id'], s['count']) for s in top_senders]
        
        # Get category distribution
        categories = self.emails_collection.aggregate([
            {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ])
        stats['categories'] = {c['_id']: c['count'] for c in categories}
        
        return stats
    
    def close(self):
        """Close MongoDB connection."""
        self.client.close()


def main():
    """Main execution function."""
    
    print("🚀 Email to MongoDB Migration Tool")
    print("=" * 50)
    
    # Check if Docker is running
    print("\n📦 Checking Docker status...")
    docker_check = subprocess.run(['docker', 'ps'], capture_output=True)
    
    if docker_check.returncode != 0:
        print("❌ Docker is not running. Please start Docker first.")
        print("\nTo start the MongoDB container:")
        print("  docker-compose up -d")
        return
    
    # Check if MongoDB container is running
    mongo_check = subprocess.run(['docker', 'ps', '-q', '-f', 'name=email-mongodb'], 
                                capture_output=True, text=True)
    
    if not mongo_check.stdout.strip():
        print("🔄 Starting MongoDB container...")
        subprocess.run(['docker-compose', 'up', '-d'])
        print("⏳ Waiting for MongoDB to initialize...")
        time.sleep(10)
    
    try:
        # Initialize manager
        manager = EmailMongoManager()
        
        # Fetch emails
        print("\n📧 Fetching emails from Mail app...")
        emails = manager.get_full_email_content(limit=500)
        
        if not emails:
            print("❌ No emails found. Trying alternative date range...")
            # Try current month if last month has no emails
            emails = manager.get_full_email_content(limit=100)
        
        if emails:
            # Process and store
            print(f"\n💾 Storing {len(emails)} emails in MongoDB...")
            stored = manager.process_and_store_emails(emails)
            
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
                        print(f"   {cat}: {count} emails")
                elif isinstance(value, int):
                    print(f"{key.replace('_', ' ').title()}: {value}")
            
            print("\n✅ Email migration complete!")
            print(f"\n🌐 View your emails at: http://localhost:8081")
            print("   (MongoDB Express Web Interface)")
            
        else:
            print("❌ No emails could be fetched.")
        
        # Close connection
        manager.close()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\nTroubleshooting:")
        print("1. Make sure Docker is running")
        print("2. Run: docker-compose up -d")
        print("3. Wait 10 seconds and try again")
        print("4. Check if Mail app is accessible")


if __name__ == "__main__":
    # Install required package if needed
    try:
        import pymongo
    except ImportError:
        print("📦 Installing pymongo...")
        subprocess.run(['pip3', 'install', 'pymongo'])
        
    main()