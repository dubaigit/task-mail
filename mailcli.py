#!/usr/bin/env python3
"""
MailCLI - Unified Apple Mail Command Line Interface
Combines database access, AppleScript operations, and email composition
"""

import sys
import os
import json
import argparse
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
import time

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import all mail modules
from apple_mail_db_reader import AppleMailDBReader
from apple_mail_composer import AppleMailComposer
from mail_tool import MailTool

# Import database and task management modules
try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker
    from database_models import Email, EmailTask, EmailIntelligence, Base
    from task_builder import IntelligentTaskBuilder
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False
    print("⚠️  SQLAlchemy not available - task features will be limited")


class TaskManager:
    """
    High-performance task management for email-task integration.
    Provides <100ms query performance for task operations.
    """
    
    def __init__(self, database_url: str = "sqlite:///email_intelligence.db"):
        """Initialize task manager with database connection."""
        if not SQLALCHEMY_AVAILABLE:
            raise RuntimeError("SQLAlchemy required for task management features")
        
        self.engine = create_engine(
            database_url,
            pool_pre_ping=True,
            pool_recycle=300,
            echo=False  # Set to True for SQL debugging
        )
        self.Session = sessionmaker(bind=self.engine)
        self.task_builder = IntelligentTaskBuilder()
        
    def get_task_status_summary(self) -> Dict[str, Any]:
        """Get high-level task status summary with <100ms performance."""
        start_time = time.time()
        
        with self.Session() as session:
            # Use raw SQL for maximum performance
            result = session.execute(text("""
                SELECT 
                    status,
                    priority,
                    COUNT(*) as count,
                    COUNT(CASE WHEN due_date < datetime('now') THEN 1 END) as overdue_count
                FROM email_tasks 
                WHERE status != 'completed' AND status != 'cancelled'
                GROUP BY status, priority
                ORDER BY 
                    CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
                    status
            """))
            
            summary = {
                'total_active_tasks': 0,
                'overdue_tasks': 0,
                'by_status': {},
                'by_priority': {},
                'query_time_ms': 0
            }
            
            for row in result:
                status, priority, count, overdue_count = row
                summary['total_active_tasks'] += count
                summary['overdue_tasks'] += overdue_count
                
                if status not in summary['by_status']:
                    summary['by_status'][status] = 0
                summary['by_status'][status] += count
                
                if priority not in summary['by_priority']:
                    summary['by_priority'][priority] = 0
                summary['by_priority'][priority] += count
            
            summary['query_time_ms'] = round((time.time() - start_time) * 1000, 2)
            return summary
    
    def get_tasks_by_status(self, status: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get tasks by status with email context."""
        start_time = time.time()
        
        with self.Session() as session:
            result = session.execute(text("""
                SELECT 
                    et.id,
                    et.task_id,
                    et.subject,
                    et.description,
                    et.priority,
                    et.status,
                    et.assignee,
                    et.due_date,
                    et.created_at,
                    e.subject_text as email_subject,
                    e.sender_email,
                    e.sender_name,
                    e.date_received
                FROM email_tasks et
                JOIN emails e ON et.email_id = e.id
                WHERE et.status = :status
                ORDER BY 
                    CASE et.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
                    et.due_date ASC NULLS LAST,
                    et.created_at DESC
                LIMIT :limit
            """), {"status": status, "limit": limit})
            
            tasks = []
            for row in result:
                task = {
                    'id': row.id,
                    'task_id': row.task_id,
                    'subject': row.subject,
                    'description': row.description,
                    'priority': row.priority,
                    'status': row.status,
                    'assignee': row.assignee,
                    'due_date': row.due_date,
                    'created_at': row.created_at,
                    'email_context': {
                        'subject': row.email_subject,
                        'sender_email': row.sender_email,
                        'sender_name': row.sender_name,
                        'date_received': row.date_received
                    },
                    'query_time_ms': round((time.time() - start_time) * 1000, 2)
                }
                tasks.append(task)
            
            return tasks
    
    def get_colleague_tasks(self, colleague_email: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get tasks assigned to or involving a colleague."""
        start_time = time.time()
        
        with self.Session() as session:
            # Find tasks assigned to colleague or where colleague was involved in email
            result = session.execute(text("""
                SELECT DISTINCT
                    et.id,
                    et.task_id,
                    et.subject,
                    et.priority,
                    et.status,
                    et.assignee,
                    et.due_date,
                    e.subject_text as email_subject,
                    e.sender_email,
                    e.to_addresses,
                    e.cc_addresses,
                    e.date_received
                FROM email_tasks et
                JOIN emails e ON et.email_id = e.id
                WHERE 
                    et.assignee LIKE :colleague 
                    OR e.sender_email = :colleague_exact
                    OR e.to_addresses LIKE :colleague_json
                    OR e.cc_addresses LIKE :colleague_json
                ORDER BY 
                    CASE et.priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
                    et.due_date ASC NULLS LAST
                LIMIT :limit
            """), {
                "colleague": f"%{colleague_email}%",
                "colleague_exact": colleague_email,
                "colleague_json": f'%"{colleague_email}"%',
                "limit": limit
            })
            
            tasks = []
            for row in result:
                task = {
                    'id': row.id,
                    'task_id': row.task_id,
                    'subject': row.subject,
                    'priority': row.priority,
                    'status': row.status,
                    'assignee': row.assignee,
                    'due_date': row.due_date,
                    'email_context': {
                        'subject': row.email_subject,
                        'sender_email': row.sender_email,
                        'to_addresses': row.to_addresses,
                        'cc_addresses': row.cc_addresses,
                        'date_received': row.date_received
                    },
                    'query_time_ms': round((time.time() - start_time) * 1000, 2)
                }
                tasks.append(task)
            
            return tasks
    
    def update_task_status(self, task_id: str, new_status: str, notes: str = "") -> Dict[str, Any]:
        """Update task status with tracking."""
        start_time = time.time()
        
        with self.Session() as session:
            # Update task status
            result = session.execute(text("""
                UPDATE email_tasks 
                SET status = :new_status, updated_at = datetime('now')
                WHERE task_id = :task_id
            """), {"new_status": new_status, "task_id": task_id})
            
            if result.rowcount == 0:
                return {"error": f"Task {task_id} not found"}
            
            # If completing task, set completion timestamp
            if new_status == 'completed':
                session.execute(text("""
                    UPDATE email_tasks 
                    SET completed_at = datetime('now')
                    WHERE task_id = :task_id
                """), {"task_id": task_id})
            
            session.commit()
            
            return {
                "success": True,
                "task_id": task_id,
                "new_status": new_status,
                "notes": notes,
                "updated_at": datetime.now().isoformat(),
                "query_time_ms": round((time.time() - start_time) * 1000, 2)
            }
    
    def get_colleague_communication_patterns(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Analyze colleague communication patterns for task assignment insights."""
        start_time = time.time()
        
        with self.Session() as session:
            result = session.execute(text("""
                SELECT 
                    colleague_email,
                    COUNT(*) as email_count,
                    COUNT(CASE WHEN et.id IS NOT NULL THEN 1 END) as task_count,
                    COUNT(CASE WHEN et.status = 'completed' THEN 1 END) as completed_tasks,
                    AVG(CASE WHEN et.status = 'completed' AND et.due_date IS NOT NULL 
                        THEN julianday(et.completed_at) - julianday(et.due_date) END) as avg_completion_time_days
                FROM (
                    SELECT DISTINCT sender_email as colleague_email FROM emails
                    UNION
                    SELECT DISTINCT json_extract(value, '$') as colleague_email 
                    FROM emails, json_each(to_addresses) WHERE json_extract(value, '$') != ''
                    UNION  
                    SELECT DISTINCT json_extract(value, '$') as colleague_email 
                    FROM emails, json_each(cc_addresses) WHERE json_extract(value, '$') != ''
                ) colleagues
                LEFT JOIN emails e ON e.sender_email = colleagues.colleague_email
                LEFT JOIN email_tasks et ON et.email_id = e.id
                WHERE colleague_email IS NOT NULL AND colleague_email != ''
                GROUP BY colleague_email
                HAVING email_count > 1
                ORDER BY task_count DESC, email_count DESC
                LIMIT :limit
            """), {"limit": limit})
            
            colleagues = []
            for row in result:
                colleague = {
                    'email': row.colleague_email,
                    'email_count': row.email_count,
                    'task_count': row.task_count or 0,
                    'completed_tasks': row.completed_tasks or 0,
                    'completion_rate': round((row.completed_tasks or 0) / max(row.task_count or 1, 1) * 100, 1),
                    'avg_completion_time_days': round(row.avg_completion_time_days or 0, 1),
                    'query_time_ms': round((time.time() - start_time) * 1000, 2)
                }
                colleagues.append(colleague)
            
            return colleagues
    
    def create_task_from_email(self, email_id: int, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new task linked to an email."""
        start_time = time.time()
        
        with self.Session() as session:
            try:
                # Generate unique task ID
                task_count = session.execute(text("SELECT COUNT(*) FROM email_tasks")).scalar()
                task_id = f"TASK-{datetime.now().strftime('%Y%m%d')}-{task_count + 1:04d}"
                
                # Insert new task
                session.execute(text("""
                    INSERT INTO email_tasks (
                        task_id, email_id, subject, description, task_type, priority,
                        assignee, due_date, status, confidence, created_at, updated_at
                    ) VALUES (
                        :task_id, :email_id, :subject, :description, :task_type, :priority,
                        :assignee, :due_date, 'pending', :confidence, datetime('now'), datetime('now')
                    )
                """), {
                    "task_id": task_id,
                    "email_id": email_id,
                    "subject": task_data.get('subject', 'New Task'),
                    "description": task_data.get('description', ''),
                    "task_type": task_data.get('task_type', 'review'),
                    "priority": task_data.get('priority', 'MEDIUM'),
                    "assignee": task_data.get('assignee'),
                    "due_date": task_data.get('due_date'),
                    "confidence": task_data.get('confidence', 0.8)
                })
                
                session.commit()
                
                return {
                    "success": True,
                    "task_id": task_id,
                    "email_id": email_id,
                    "created_at": datetime.now().isoformat(),
                    "query_time_ms": round((time.time() - start_time) * 1000, 2)
                }
                
            except Exception as e:
                session.rollback()
                return {"error": str(e)}


class MailCLI:
    """Unified mail CLI interface."""
    
    def __init__(self):
        self.db_reader = AppleMailDBReader()
        self.composer = AppleMailComposer()
        self.mail_tool = MailTool()
        
        # Initialize task manager if available
        try:
            self.task_manager = TaskManager() if SQLALCHEMY_AVAILABLE else None
        except Exception as e:
            print(f"⚠️  Task management unavailable: {e}")
            self.task_manager = None
        
    def format_email_output(self, email: dict, index: int = 1, verbose: bool = False) -> str:
        """Format email for display."""
        output = f"\n{'='*60}\n"
        output += f"📧 Email #{index}\n"
        output += f"{'='*60}\n"
        
        # Core fields
        output += f"📍 ID: {email.get('id', 'N/A')}\n"
        output += f"📝 Subject: {email.get('subject', email.get('subject_text', 'N/A'))}\n"
        
        # Sender info
        sender_name = email.get('sender_name', email.get('from', ''))
        sender_email = email.get('sender_email', email.get('sender_email', ''))
        if sender_name or sender_email:
            output += f"👤 From: {sender_name} <{sender_email}>\n"
        
        # Recipients
        if email.get('to'):
            output += f"📮 To: {email.get('to')}\n"
        
        # Date
        date = email.get('date_received', email.get('date', 'N/A'))
        output += f"📅 Date: {date}\n"
        
        # Status
        status = []
        if not email.get('is_read', email.get('read', True)):
            status.append("📬 UNREAD")
        if email.get('is_flagged', email.get('flagged', False)):
            status.append("🚩 FLAGGED")
        if email.get('has_attachments', email.get('attachments', False)):
            status.append("📎 ATTACHMENTS")
        if status:
            output += f"📊 Status: {' | '.join(status)}\n"
        
        # Mailbox
        mailbox = email.get('mailbox', email.get('mailbox_path', email.get('mailbox_name', '')))
        if mailbox:
            output += f"📁 Mailbox: {mailbox}\n"
        
        # Content preview
        if verbose:
            preview = email.get('preview', email.get('content', ''))
            if preview:
                preview_lines = preview[:500].replace('\n', '\n    ')
                output += f"\n📄 Preview:\n    {preview_lines}...\n"
        
        return output
    
    def search_emails(self, args):
        """Search emails using database."""
        try:
            results = self.db_reader.search_emails(
                query=args.query,
                field=args.field,
                limit=args.limit
            )
            
            if not results:
                print("No emails found.")
                return
            
            print(f"\n🔍 Search Results for '{args.query}':")
            print(f"Found {len(results)} email(s)\n")
            
            for i, email in enumerate(results, 1):
                if 'error' in email:
                    print(f"❌ Error: {email['error']}")
                    break
                print(self.format_email_output(email, i, args.verbose))
                
        except Exception as e:
            print(f"❌ Error searching emails: {e}")
    
    def get_recent_emails(self, args):
        """Get recent emails."""
        try:
            if args.full:
                # Use AppleScript for full content
                emails = self.mail_tool.get_recent_emails(limit=args.limit)
            else:
                # Use database for quick access
                emails = self.db_reader.get_recent_emails(limit=args.limit)
            
            print(f"\n📬 Recent Emails (Last {args.limit}):")
            
            for i, email in enumerate(emails, 1):
                if 'error' in email:
                    print(f"❌ Error: {email['error']}")
                    break
                print(self.format_email_output(email, i, args.verbose))
                
        except Exception as e:
            print(f"❌ Error getting recent emails: {e}")
    
    def get_unread_emails(self, args):
        """Get unread emails."""
        try:
            emails = self.db_reader.get_unread_emails(limit=args.limit)
            
            if not emails:
                print("✅ No unread emails!")
                return
            
            print(f"\n📬 Unread Emails ({len(emails)} found):")
            
            for i, email in enumerate(emails, 1):
                if 'error' in email:
                    print(f"❌ Error: {email['error']}")
                    break
                print(self.format_email_output(email, i, args.verbose))
                
        except Exception as e:
            print(f"❌ Error getting unread emails: {e}")
    
    def get_flagged_emails(self, args):
        """Get flagged emails."""
        try:
            emails = self.db_reader.get_flagged_emails(limit=args.limit)
            
            if not emails:
                print("No flagged emails found.")
                return
            
            print(f"\n🚩 Flagged Emails ({len(emails)} found):")
            
            for i, email in enumerate(emails, 1):
                if 'error' in email:
                    print(f"❌ Error: {email['error']}")
                    break
                print(self.format_email_output(email, i, args.verbose))
                
        except Exception as e:
            print(f"❌ Error getting flagged emails: {e}")
    
    def get_stats(self, args):
        """Get email statistics."""
        try:
            stats = self.db_reader.get_email_stats()
            
            if 'error' in stats:
                print(f"❌ Error: {stats['error']}")
                return
            
            print("\n" + "="*60)
            print("📊 Apple Mail Statistics")
            print("="*60)
            print(f"📧 Total Emails: {stats.get('total_emails', 0):,}")
            print(f"📬 Unread: {stats.get('unread_count', 0):,}")
            print(f"🚩 Flagged: {stats.get('flagged_count', 0):,}")
            print(f"📅 Last 7 days: {stats.get('emails_last_7_days', 0):,}")
            
            print("\n📁 Top Mailboxes:")
            for mailbox, count in stats.get('mailbox_distribution', []):
                # Extract mailbox name from URL
                mailbox_name = mailbox.split('/')[-1].replace('%20', ' ')
                print(f"  • {mailbox_name}: {count:,}")
            print()
            
        except Exception as e:
            print(f"❌ Error getting stats: {e}")
    
    def create_draft(self, args):
        """Create a new draft email."""
        try:
            result = self.composer.create_draft(
                to=args.to,
                subject=args.subject,
                body=args.body,
                cc=args.cc,
                bcc=args.bcc
            )
            
            if result['status'] == 'success':
                print("✅ Draft created successfully!")
                print(f"📝 {result['message']}")
                if args.verbose and 'draft' in result:
                    print(f"\nDraft details:")
                    print(json.dumps(result['draft'], indent=2))
            else:
                print(f"❌ Error: {result['message']}")
                
        except Exception as e:
            print(f"❌ Error creating draft: {e}")
    
    def reply_to_email(self, args):
        """Reply to an email."""
        try:
            # If no message ID provided, get the most recent email
            if not args.message_id:
                print("📧 Getting most recent email to reply to...")
                recent = self.db_reader.get_recent_emails(limit=1)
                if recent and not 'error' in recent[0]:
                    args.message_id = recent[0].get('message_id', recent[0].get('id'))
                    print(f"Replying to: {recent[0].get('subject_text', 'N/A')}")
                else:
                    print("❌ Could not find recent email to reply to")
                    return
            
            result = self.composer.reply_to_email(
                message_id=args.message_id,
                reply_body=args.body,
                reply_all=args.reply_all
            )
            
            if result['status'] == 'success':
                print("✅ Reply draft created!")
                print(f"📝 {result['message']}")
            else:
                print(f"❌ Error: {result['message']}")
                
        except Exception as e:
            print(f"❌ Error creating reply: {e}")
    
    def forward_email(self, args):
        """Forward an email."""
        try:
            result = self.composer.forward_email(
                message_id=args.message_id,
                to=args.to,
                forward_message=args.message
            )
            
            if result['status'] == 'success':
                print("✅ Forward draft created!")
                print(f"📝 {result['message']}")
            else:
                print(f"❌ Error: {result['message']}")
                
        except Exception as e:
            print(f"❌ Error forwarding email: {e}")
    
    def list_drafts(self, args):
        """List draft emails."""
        try:
            drafts = self.composer.list_drafts(limit=args.limit)
            
            if not drafts:
                print("No drafts found.")
                return
            
            print(f"\n📝 Draft Emails ({len(drafts)} found):")
            
            for i, draft in enumerate(drafts, 1):
                if 'error' in draft:
                    print(f"❌ Error: {draft['error']}")
                    break
                print(f"\n--- Draft {i} ---")
                print(f"📍 ID: {draft['id']}")
                print(f"📝 Subject: {draft['subject']}")
                print(f"📮 To: {draft['to']}")
                print(f"📅 Date: {draft['date']}")
                
        except Exception as e:
            print(f"❌ Error listing drafts: {e}")
    
    def send_draft(self, args):
        """Send a draft email."""
        try:
            result = self.composer.send_draft(draft_id=args.draft_id)
            
            if result['status'] == 'success':
                print("✅ Email sent successfully!")
                print(f"📤 {result['message']}")
            else:
                print(f"❌ Error: {result['message']}")
                
        except Exception as e:
            print(f"❌ Error sending draft: {e}")
    
    def compose_email(self, args):
        """Compose and optionally send an email."""
        try:
            # First create the draft
            result = self.composer.create_draft(
                to=args.to,
                subject=args.subject,
                body=args.body,
                cc=args.cc,
                bcc=args.bcc
            )
            
            if result['status'] == 'success':
                print("✅ Email composed!")
                
                if args.send:
                    # Send immediately
                    send_result = self.composer.send_draft()
                    if send_result['status'] == 'success':
                        print("📤 Email sent successfully!")
                    else:
                        print(f"⚠️ Draft created but not sent: {send_result['message']}")
                else:
                    print("📝 Saved as draft (use 'send' command to send)")
            else:
                print(f"❌ Error: {result['message']}")
                
        except Exception as e:
            print(f"❌ Error composing email: {e}")
    
    def get_task_status(self, args):
        """Get task status summary and details."""
        if not self.task_manager:
            print("❌ Task management not available. Install SQLAlchemy and ensure database is set up.")
            return
        
        try:
            if args.task_id:
                # Get specific task details
                tasks = self.task_manager.get_tasks_by_status("all", limit=100)
                task = next((t for t in tasks if t['task_id'] == args.task_id), None)
                
                if not task:
                    print(f"❌ Task {args.task_id} not found")
                    return
                
                print(f"\n📋 Task Details: {args.task_id}")
                print("=" * 60)
                print(f"📝 Subject: {task['subject']}")
                print(f"📊 Status: {task['status']}")
                print(f"🚨 Priority: {task['priority']}")
                if task['assignee']:
                    print(f"👤 Assignee: {task['assignee']}")
                if task['due_date']:
                    print(f"⏰ Due Date: {task['due_date']}")
                print(f"📅 Created: {task['created_at']}")
                
                print(f"\n📧 Related Email:")
                print(f"   Subject: {task['email_context']['subject']}")
                print(f"   From: {task['email_context']['sender_email']}")
                print(f"   Date: {task['email_context']['date_received']}")
                
                if args.verbose:
                    print(f"\n📄 Description:")
                    print(f"   {task['description']}")
                
                print(f"\n⏱️  Query time: {task['query_time_ms']}ms")
                
            else:
                # Get task summary
                summary = self.task_manager.get_task_status_summary()
                
                print("\n📊 Task Status Summary")
                print("=" * 60)
                print(f"📋 Total Active Tasks: {summary['total_active_tasks']}")
                print(f"🚨 Overdue Tasks: {summary['overdue_tasks']}")
                
                if summary['by_status']:
                    print(f"\n📈 By Status:")
                    for status, count in summary['by_status'].items():
                        print(f"   • {status}: {count}")
                
                if summary['by_priority']:
                    print(f"\n🎯 By Priority:")
                    for priority, count in summary['by_priority'].items():
                        print(f"   • {priority}: {count}")
                
                print(f"\n⏱️  Query time: {summary['query_time_ms']}ms")
                
        except Exception as e:
            print(f"❌ Error getting task status: {e}")
    
    def update_task(self, args):
        """Update task status."""
        if not self.task_manager:
            print("❌ Task management not available")
            return
        
        try:
            result = self.task_manager.update_task_status(
                task_id=args.task_id,
                new_status=args.status,
                notes=args.notes or ""
            )
            
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
            else:
                print(f"✅ Task {args.task_id} updated to '{args.status}'")
                print(f"📅 Updated at: {result['updated_at']}")
                print(f"⏱️  Query time: {result['query_time_ms']}ms")
                
        except Exception as e:
            print(f"❌ Error updating task: {e}")
    
    def get_colleague_tasks(self, args):
        """Get tasks for a specific colleague."""
        if not self.task_manager:
            print("❌ Task management not available")
            return
        
        try:
            tasks = self.task_manager.get_colleague_tasks(
                colleague_email=args.colleague,
                limit=args.limit
            )
            
            if not tasks:
                print(f"No tasks found for colleague: {args.colleague}")
                return
            
            print(f"\n👥 Tasks for {args.colleague} ({len(tasks)} found)")
            print("=" * 60)
            
            for i, task in enumerate(tasks, 1):
                print(f"\n📋 Task #{i}: {task['task_id']}")
                print(f"📝 Subject: {task['subject']}")
                print(f"📊 Status: {task['status']}")
                print(f"🚨 Priority: {task['priority']}")
                if task['assignee']:
                    print(f"👤 Assignee: {task['assignee']}")
                if task['due_date']:
                    print(f"⏰ Due: {task['due_date']}")
                
                print(f"📧 Email Context:")
                print(f"   From: {task['email_context']['sender_email']}")
                print(f"   Subject: {task['email_context']['subject']}")
                print(f"   Date: {task['email_context']['date_received']}")
                
                if args.verbose and i <= 3:  # Limit verbose output
                    if task['email_context'].get('to_addresses'):
                        print(f"   To: {task['email_context']['to_addresses']}")
                    if task['email_context'].get('cc_addresses'):
                        print(f"   CC: {task['email_context']['cc_addresses']}")
            
            if tasks:
                print(f"\n⏱️  Query time: {tasks[0]['query_time_ms']}ms")
                
        except Exception as e:
            print(f"❌ Error getting colleague tasks: {e}")
    
    def get_task_dashboard(self, args):
        """Display comprehensive task dashboard."""
        if not self.task_manager:
            print("❌ Task management not available")
            return
        
        try:
            # Get summary
            summary = self.task_manager.get_task_status_summary()
            
            # Get pending tasks
            pending_tasks = self.task_manager.get_tasks_by_status("pending", limit=5)
            
            # Get colleague patterns
            colleagues = self.task_manager.get_colleague_communication_patterns(limit=5)
            
            print("\n" + "=" * 80)
            print("📊 TASK DASHBOARD")
            print("=" * 80)
            
            # Summary section
            print(f"\n📈 OVERVIEW")
            print(f"   📋 Active Tasks: {summary['total_active_tasks']}")
            print(f"   🚨 Overdue: {summary['overdue_tasks']}")
            
            if summary['by_priority']:
                critical = summary['by_priority'].get('CRITICAL', 0)
                high = summary['by_priority'].get('HIGH', 0)
                if critical > 0:
                    print(f"   🔴 Critical: {critical}")
                if high > 0:
                    print(f"   🟠 High: {high}")
            
            # Recent pending tasks
            if pending_tasks:
                print(f"\n📋 RECENT PENDING TASKS")
                for i, task in enumerate(pending_tasks[:3], 1):
                    print(f"   {i}. {task['subject']} [{task['priority']}]")
                    print(f"      From: {task['email_context']['sender_email']}")
                    if task['due_date']:
                        print(f"      Due: {task['due_date']}")
            
            # Top colleagues
            if colleagues:
                print(f"\n👥 COLLEAGUE ACTIVITY")
                for colleague in colleagues[:3]:
                    print(f"   • {colleague['email']}: {colleague['task_count']} tasks "
                          f"({colleague['completion_rate']}% completion rate)")
            
            print(f"\n⏱️  Dashboard generated in {summary['query_time_ms']}ms")
            print("=" * 80)
            
        except Exception as e:
            print(f"❌ Error generating dashboard: {e}")


def main():
    parser = argparse.ArgumentParser(
        description='MailCLI - Unified Apple Mail Command Line Interface',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s search "invoice" --field subject
  %(prog)s recent --limit 5 --verbose
  %(prog)s unread
  %(prog)s compose --to user@example.com --subject "Test" --body "Hello" --send
  %(prog)s reply --body "Thanks for your email!"
  %(prog)s stats
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Search command
    search_parser = subparsers.add_parser('search', help='Search emails')
    search_parser.add_argument('query', help='Search query')
    search_parser.add_argument('--field', choices=['all', 'subject', 'sender', 'content'],
                               default='all', help='Field to search')
    search_parser.add_argument('--limit', type=int, default=20, help='Number of results')
    search_parser.add_argument('--verbose', action='store_true', help='Show email preview')
    
    # Recent emails
    recent_parser = subparsers.add_parser('recent', help='Get recent emails')
    recent_parser.add_argument('--limit', type=int, default=10, help='Number of emails')
    recent_parser.add_argument('--verbose', action='store_true', help='Show email preview')
    recent_parser.add_argument('--full', action='store_true', 
                               help='Use AppleScript for full content (slower)')
    
    # Unread emails
    unread_parser = subparsers.add_parser('unread', help='Get unread emails')
    unread_parser.add_argument('--limit', type=int, default=20, help='Number of emails')
    unread_parser.add_argument('--verbose', action='store_true', help='Show email preview')
    
    # Flagged emails
    flagged_parser = subparsers.add_parser('flagged', help='Get flagged emails')
    flagged_parser.add_argument('--limit', type=int, default=20, help='Number of emails')
    flagged_parser.add_argument('--verbose', action='store_true', help='Show email preview')
    
    # Statistics
    stats_parser = subparsers.add_parser('stats', help='Get email statistics')
    
    # Compose email
    compose_parser = subparsers.add_parser('compose', help='Compose new email')
    compose_parser.add_argument('--to', required=True, help='Recipient email')
    compose_parser.add_argument('--subject', required=True, help='Email subject')
    compose_parser.add_argument('--body', required=True, help='Email body')
    compose_parser.add_argument('--cc', help='CC recipients')
    compose_parser.add_argument('--bcc', help='BCC recipients')
    compose_parser.add_argument('--send', action='store_true', help='Send immediately')
    
    # Create draft
    draft_parser = subparsers.add_parser('draft', help='Create draft email')
    draft_parser.add_argument('--to', required=True, help='Recipient email')
    draft_parser.add_argument('--subject', required=True, help='Email subject')
    draft_parser.add_argument('--body', required=True, help='Email body')
    draft_parser.add_argument('--cc', help='CC recipients')
    draft_parser.add_argument('--bcc', help='BCC recipients')
    draft_parser.add_argument('--verbose', action='store_true', help='Show draft details')
    
    # Reply to email
    reply_parser = subparsers.add_parser('reply', help='Reply to email')
    reply_parser.add_argument('--message-id', help='Message ID (uses most recent if not specified)')
    reply_parser.add_argument('--body', required=True, help='Reply body')
    reply_parser.add_argument('--reply-all', action='store_true', help='Reply to all')
    
    # Forward email
    forward_parser = subparsers.add_parser('forward', help='Forward email')
    forward_parser.add_argument('--message-id', required=True, help='Message ID to forward')
    forward_parser.add_argument('--to', required=True, help='Forward to email')
    forward_parser.add_argument('--message', help='Additional message')
    
    # List drafts
    drafts_parser = subparsers.add_parser('drafts', help='List draft emails')
    drafts_parser.add_argument('--limit', type=int, default=10, help='Number of drafts')
    
    # Send draft
    send_parser = subparsers.add_parser('send', help='Send a draft')
    send_parser.add_argument('--draft-id', help='Draft ID (latest if not specified)')
    
    # Task management commands
    task_status_parser = subparsers.add_parser('task-status', help='Get task status summary or specific task details')
    task_status_parser.add_argument('--task-id', help='Specific task ID to get details for')
    task_status_parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed information')
    
    task_update_parser = subparsers.add_parser('task-update', help='Update task status')
    task_update_parser.add_argument('task_id', help='Task ID to update')
    task_update_parser.add_argument('status', choices=['pending', 'in-progress', 'completed', 'cancelled'], help='New task status')
    task_update_parser.add_argument('--notes', help='Optional notes about the update')
    
    colleague_tasks_parser = subparsers.add_parser('colleague-tasks', help='Get tasks for a specific colleague')
    colleague_tasks_parser.add_argument('colleague', help='Colleague email address')
    colleague_tasks_parser.add_argument('--limit', type=int, default=20, help='Maximum number of tasks to show')
    colleague_tasks_parser.add_argument('--verbose', '-v', action='store_true', help='Show detailed email context')
    
    task_dashboard_parser = subparsers.add_parser('task-dashboard', help='Display comprehensive task dashboard')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    # Initialize CLI
    cli = MailCLI()
    
    # Route commands
    commands = {
        'search': cli.search_emails,
        'recent': cli.get_recent_emails,
        'unread': cli.get_unread_emails,
        'flagged': cli.get_flagged_emails,
        'stats': cli.get_stats,
        'compose': cli.compose_email,
        'draft': cli.create_draft,
        'reply': cli.reply_to_email,
        'forward': cli.forward_email,
        'drafts': cli.list_drafts,
        'send': cli.send_draft,
        'task-status': cli.get_task_status,
        'task-update': cli.update_task,
        'colleague-tasks': cli.get_colleague_tasks,
        'task-dashboard': cli.get_task_dashboard,
    }
    
    command_func = commands.get(args.command)
    if command_func:
        command_func(args)
    else:
        print(f"❌ Unknown command: {args.command}")
        parser.print_help()


if __name__ == "__main__":
    main()