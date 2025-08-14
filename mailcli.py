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

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import all mail modules
from apple_mail_db_reader import AppleMailDBReader
from apple_mail_composer import AppleMailComposer
from mail_tool import MailTool

class MailCLI:
    """Unified mail CLI interface."""
    
    def __init__(self):
        self.db_reader = AppleMailDBReader()
        self.composer = AppleMailComposer()
        self.mail_tool = MailTool()
        
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
    }
    
    command_func = commands.get(args.command)
    if command_func:
        command_func(args)
    else:
        print(f"❌ Unknown command: {args.command}")
        parser.print_help()


if __name__ == "__main__":
    main()