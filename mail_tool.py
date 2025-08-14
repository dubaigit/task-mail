#!/usr/bin/env python3
"""
Comprehensive Mail Tool for macOS Mail App
Based on enhanced applecli.py - provides all mail operations with JSON output
"""

import subprocess
import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import argparse
import sys


class MailTool:
    """Complete Mail app interface with all operations."""
    
    def __init__(self):
        """Initialize the Mail tool."""
        self.timeout = 30
    
    def run_applescript(self, script: str) -> str:
        """Execute AppleScript and return output."""
        try:
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                timeout=self.timeout
            )
            if result.returncode != 0:
                raise Exception(f"AppleScript error: {result.stderr}")
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            raise Exception("AppleScript execution timed out")
        except Exception as e:
            raise Exception(f"Failed to execute AppleScript: {e}")
    
    # ==================== READING EMAILS ====================
    
    def get_recent_emails(self, limit: int = 10, mailbox: str = "INBOX") -> List[Dict]:
        """Get recent emails with full content."""
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set emailList to {{}}
            set emailCount to 0
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    if name of mbox contains "{mailbox}" then
                        set msgs to messages of mbox
                        
                        repeat with i from 1 to (count of msgs)
                            if emailCount < {limit} then
                                set msg to item i of msgs
                                
                                set msgID to message id of msg
                                set msgDate to (date received of msg) as string
                                set msgSubject to subject of msg
                                set msgSender to sender of msg
                                set msgRead to read status of msg
                                set msgFlagged to flagged status of msg
                                
                                -- Get content preview
                                set msgContent to ""
                                try
                                    set msgContent to content of msg
                                    if length of msgContent > 5000 then
                                        set msgContent to text 1 thru 5000 of msgContent & "..."
                                    end if
                                on error
                                    set msgContent to "(No content available)"
                                end try
                                
                                -- Get recipients
                                set toList to ""
                                try
                                    repeat with recip in (to recipients of msg)
                                        set toList to toList & (address of recip) & ","
                                    end repeat
                                end try
                                
                                -- Check attachments
                                set hasAttach to false
                                try
                                    set hasAttach to (count of mail attachments of msg) > 0
                                end try
                                
                                set emailInfo to "|||EMAIL|||" & return
                                set emailInfo to emailInfo & "ID:" & msgID & return
                                set emailInfo to emailInfo & "DATE:" & msgDate & return
                                set emailInfo to emailInfo & "SUBJECT:" & msgSubject & return
                                set emailInfo to emailInfo & "FROM:" & msgSender & return
                                set emailInfo to emailInfo & "TO:" & toList & return
                                set emailInfo to emailInfo & "READ:" & msgRead & return
                                set emailInfo to emailInfo & "FLAGGED:" & msgFlagged & return
                                set emailInfo to emailInfo & "ATTACHMENTS:" & hasAttach & return
                                set emailInfo to emailInfo & "MAILBOX:" & (name of mbox) & return
                                set emailInfo to emailInfo & "|||CONTENT|||" & return
                                set emailInfo to emailInfo & msgContent & return
                                set emailInfo to emailInfo & "|||END|||" & return
                                
                                set end of emailList to emailInfo
                                set emailCount to emailCount + 1
                            end if
                        end repeat
                    end if
                end repeat
            end repeat
            
            set AppleScript's text item delimiters to ""
            return emailList as string
        end tell
        '''
        
        output = self.run_applescript(script)
        return self._parse_email_output(output)
    
    def get_unread_emails(self, limit: int = 20) -> List[Dict]:
        """Get all unread emails."""
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set emailList to {{}}
            set emailCount to 0
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set unreadMsgs to (every message of mbox whose read status is false)
                    
                    repeat with msg in unreadMsgs
                        if emailCount < {limit} then
                            set msgID to message id of msg
                            set msgDate to (date received of msg) as string
                            set msgSubject to subject of msg
                            set msgSender to sender of msg
                            set msgFlagged to flagged status of msg
                            
                            set msgContent to ""
                            try
                                set msgContent to content of msg
                                if length of msgContent > 3000 then
                                    set msgContent to text 1 thru 3000 of msgContent & "..."
                                end if
                            on error
                                set msgContent to "(No content)"
                            end try
                            
                            set emailInfo to "|||EMAIL|||" & return
                            set emailInfo to emailInfo & "ID:" & msgID & return
                            set emailInfo to emailInfo & "DATE:" & msgDate & return
                            set emailInfo to emailInfo & "SUBJECT:" & msgSubject & return
                            set emailInfo to emailInfo & "FROM:" & msgSender & return
                            set emailInfo to emailInfo & "FLAGGED:" & msgFlagged & return
                            set emailInfo to emailInfo & "MAILBOX:" & (name of mbox) & return
                            set emailInfo to emailInfo & "|||CONTENT|||" & return
                            set emailInfo to emailInfo & msgContent & return
                            set emailInfo to emailInfo & "|||END|||" & return
                            
                            set end of emailList to emailInfo
                            set emailCount to emailCount + 1
                        end if
                    end repeat
                end repeat
            end repeat
            
            set AppleScript's text item delimiters to ""
            return emailList as string
        end tell
        '''
        
        output = self.run_applescript(script)
        return self._parse_email_output(output)
    
    # ==================== SEARCHING EMAILS ====================
    
    def search_by_subject(self, query: str, limit: int = 20) -> List[Dict]:
        """Search emails by subject."""
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set emailList to {{}}
            set emailCount to 0
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set foundMsgs to (every message of mbox whose subject contains "{query}")
                    
                    repeat with msg in foundMsgs
                        if emailCount < {limit} then
                            set msgID to message id of msg
                            set msgDate to (date received of msg) as string
                            set msgSubject to subject of msg
                            set msgSender to sender of msg
                            set msgRead to read status of msg
                            
                            set emailInfo to "|||EMAIL|||" & return
                            set emailInfo to emailInfo & "ID:" & msgID & return
                            set emailInfo to emailInfo & "DATE:" & msgDate & return
                            set emailInfo to emailInfo & "SUBJECT:" & msgSubject & return
                            set emailInfo to emailInfo & "FROM:" & msgSender & return
                            set emailInfo to emailInfo & "READ:" & msgRead & return
                            set emailInfo to emailInfo & "MAILBOX:" & (name of mbox) & return
                            set emailInfo to emailInfo & "|||END|||" & return
                            
                            set end of emailList to emailInfo
                            set emailCount to emailCount + 1
                        end if
                    end repeat
                end repeat
            end repeat
            
            set AppleScript's text item delimiters to ""
            return emailList as string
        end tell
        '''
        
        output = self.run_applescript(script)
        return self._parse_email_output(output)
    
    def search_by_sender(self, sender: str, limit: int = 20) -> List[Dict]:
        """Search emails by sender name or email."""
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set emailList to {{}}
            set emailCount to 0
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set foundMsgs to (every message of mbox whose sender contains "{sender}")
                    
                    repeat with msg in foundMsgs
                        if emailCount < {limit} then
                            set msgID to message id of msg
                            set msgDate to (date received of msg) as string
                            set msgSubject to subject of msg
                            set msgSender to sender of msg
                            set msgRead to read status of msg
                            set msgFlagged to flagged status of msg
                            
                            set msgContent to ""
                            try
                                set msgContent to content of msg
                                if length of msgContent > 2000 then
                                    set msgContent to text 1 thru 2000 of msgContent & "..."
                                end if
                            on error
                                set msgContent to ""
                            end try
                            
                            set emailInfo to "|||EMAIL|||" & return
                            set emailInfo to emailInfo & "ID:" & msgID & return
                            set emailInfo to emailInfo & "DATE:" & msgDate & return
                            set emailInfo to emailInfo & "SUBJECT:" & msgSubject & return
                            set emailInfo to emailInfo & "FROM:" & msgSender & return
                            set emailInfo to emailInfo & "READ:" & msgRead & return
                            set emailInfo to emailInfo & "FLAGGED:" & msgFlagged & return
                            set emailInfo to emailInfo & "|||CONTENT|||" & return
                            set emailInfo to emailInfo & msgContent & return
                            set emailInfo to emailInfo & "|||END|||" & return
                            
                            set end of emailList to emailInfo
                            set emailCount to emailCount + 1
                        end if
                    end repeat
                end repeat
            end repeat
            
            set AppleScript's text item delimiters to ""
            return emailList as string
        end tell
        '''
        
        output = self.run_applescript(script)
        return self._parse_email_output(output)
    
    def search_by_content(self, query: str, limit: int = 20) -> List[Dict]:
        """Search emails by content."""
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set emailList to {{}}
            set emailCount to 0
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set foundMsgs to (every message of mbox whose content contains "{query}")
                    
                    repeat with msg in foundMsgs
                        if emailCount < {limit} then
                            set msgID to message id of msg
                            set msgDate to (date received of msg) as string
                            set msgSubject to subject of msg
                            set msgSender to sender of msg
                            
                            set emailInfo to "|||EMAIL|||" & return
                            set emailInfo to emailInfo & "ID:" & msgID & return
                            set emailInfo to emailInfo & "DATE:" & msgDate & return
                            set emailInfo to emailInfo & "SUBJECT:" & msgSubject & return
                            set emailInfo to emailInfo & "FROM:" & msgSender & return
                            set emailInfo to emailInfo & "|||END|||" & return
                            
                            set end of emailList to emailInfo
                            set emailCount to emailCount + 1
                        end if
                    end repeat
                end repeat
            end repeat
            
            set AppleScript's text item delimiters to ""
            return emailList as string
        end tell
        '''
        
        output = self.run_applescript(script)
        return self._parse_email_output(output)
    
    def search_by_date_range(self, start_date: str, end_date: str, limit: int = 50) -> List[Dict]:
        """Search emails within date range. Dates in format: MM/DD/YYYY"""
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set emailList to {{}}
            set emailCount to 0
            set startDate to date "{start_date}"
            set endDate to date "{end_date}"
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set foundMsgs to (every message of mbox whose date received ≥ startDate and date received ≤ endDate)
                    
                    repeat with msg in foundMsgs
                        if emailCount < {limit} then
                            set msgID to message id of msg
                            set msgDate to (date received of msg) as string
                            set msgSubject to subject of msg
                            set msgSender to sender of msg
                            set msgRead to read status of msg
                            
                            set emailInfo to "|||EMAIL|||" & return
                            set emailInfo to emailInfo & "ID:" & msgID & return
                            set emailInfo to emailInfo & "DATE:" & msgDate & return
                            set emailInfo to emailInfo & "SUBJECT:" & msgSubject & return
                            set emailInfo to emailInfo & "FROM:" & msgSender & return
                            set emailInfo to emailInfo & "READ:" & msgRead & return
                            set emailInfo to emailInfo & "|||END|||" & return
                            
                            set end of emailList to emailInfo
                            set emailCount to emailCount + 1
                        end if
                    end repeat
                end repeat
            end repeat
            
            set AppleScript's text item delimiters to ""
            return emailList as string
        end tell
        '''
        
        output = self.run_applescript(script)
        return self._parse_email_output(output)
    
    def get_emails_last_n_days(self, days: int = 7, limit: int = 50) -> List[Dict]:
        """Get emails from last N days."""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        start_str = start_date.strftime("%m/%d/%Y")
        end_str = end_date.strftime("%m/%d/%Y")
        
        return self.search_by_date_range(start_str, end_str, limit)
    
    def get_flagged_emails(self, limit: int = 20) -> List[Dict]:
        """Get all flagged/important emails."""
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set emailList to {{}}
            set emailCount to 0
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set flaggedMsgs to (every message of mbox whose flagged status is true)
                    
                    repeat with msg in flaggedMsgs
                        if emailCount < {limit} then
                            set msgID to message id of msg
                            set msgDate to (date received of msg) as string
                            set msgSubject to subject of msg
                            set msgSender to sender of msg
                            set msgRead to read status of msg
                            
                            set emailInfo to "|||EMAIL|||" & return
                            set emailInfo to emailInfo & "ID:" & msgID & return
                            set emailInfo to emailInfo & "DATE:" & msgDate & return
                            set emailInfo to emailInfo & "SUBJECT:" & msgSubject & return
                            set emailInfo to emailInfo & "FROM:" & msgSender & return
                            set emailInfo to emailInfo & "READ:" & msgRead & return
                            set emailInfo to emailInfo & "|||END|||" & return
                            
                            set end of emailList to emailInfo
                            set emailCount to emailCount + 1
                        end if
                    end repeat
                end repeat
            end repeat
            
            set AppleScript's text item delimiters to ""
            return emailList as string
        end tell
        '''
        
        output = self.run_applescript(script)
        return self._parse_email_output(output)
    
    # ==================== EMAIL ACTIONS ====================
    
    def mark_as_read(self, message_id: str) -> Dict:
        """Mark an email as read by message ID."""
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set foundEmail to false
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set msgs to (every message of mbox whose message id is "{message_id}")
                    if (count of msgs) > 0 then
                        set msg to item 1 of msgs
                        set read status of msg to true
                        set foundEmail to true
                        exit repeat
                    end if
                end repeat
                if foundEmail then exit repeat
            end repeat
            
            if foundEmail then
                return "SUCCESS: Email marked as read"
            else
                return "ERROR: Email not found"
            end if
        end tell
        '''
        
        result = self.run_applescript(script)
        return {"status": "success" if "SUCCESS" in result else "error", "message": result}
    
    def mark_as_unread(self, message_id: str) -> Dict:
        """Mark an email as unread by message ID."""
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set foundEmail to false
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set msgs to (every message of mbox whose message id is "{message_id}")
                    if (count of msgs) > 0 then
                        set msg to item 1 of msgs
                        set read status of msg to false
                        set foundEmail to true
                        exit repeat
                    end if
                end repeat
                if foundEmail then exit repeat
            end repeat
            
            if foundEmail then
                return "SUCCESS: Email marked as unread"
            else
                return "ERROR: Email not found"
            end if
        end tell
        '''
        
        result = self.run_applescript(script)
        return {"status": "success" if "SUCCESS" in result else "error", "message": result}
    
    def flag_email(self, message_id: str, flag: bool = True) -> Dict:
        """Flag or unflag an email."""
        flag_status = "true" if flag else "false"
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set foundEmail to false
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set msgs to (every message of mbox whose message id is "{message_id}")
                    if (count of msgs) > 0 then
                        set msg to item 1 of msgs
                        set flagged status of msg to {flag_status}
                        set foundEmail to true
                        exit repeat
                    end if
                end repeat
                if foundEmail then exit repeat
            end repeat
            
            if foundEmail then
                return "SUCCESS: Email flagged status updated"
            else
                return "ERROR: Email not found"
            end if
        end tell
        '''
        
        result = self.run_applescript(script)
        return {"status": "success" if "SUCCESS" in result else "error", "message": result}
    
    def create_draft_reply(self, message_id: str, reply_body: str) -> Dict:
        """Create a draft reply to an email."""
        # Escape quotes in reply body
        reply_body = reply_body.replace('"', '\\"')
        
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set foundEmail to false
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set msgs to (every message of mbox whose message id is "{message_id}")
                    if (count of msgs) > 0 then
                        set msg to item 1 of msgs
                        set replyMsg to reply msg with opening window
                        
                        tell replyMsg
                            set content to "{reply_body}" & return & return & content
                        end tell
                        
                        set foundEmail to true
                        exit repeat
                    end if
                end repeat
                if foundEmail then exit repeat
            end repeat
            
            if foundEmail then
                return "SUCCESS: Reply draft created"
            else
                return "ERROR: Email not found"
            end if
        end tell
        '''
        
        result = self.run_applescript(script)
        return {"status": "success" if "SUCCESS" in result else "error", "message": result}
    
    def compose_email(self, to: str, subject: str, body: str, cc: str = None) -> Dict:
        """Compose a new email draft."""
        # Escape quotes
        subject = subject.replace('"', '\\"')
        body = body.replace('"', '\\"')
        
        cc_line = f'make new cc recipient at end of cc recipients with properties {{address:"{cc}"}}' if cc else ""
        
        script = f'''
        tell application "Mail"
            -- Don't activate (runs in background)
            set newMessage to make new outgoing message with properties {{subject:"{subject}", content:"{body}", visible:false}}
            
            tell newMessage
                make new to recipient at end of to recipients with properties {{address:"{to}"}}
                {cc_line}
            end tell
            
            return "SUCCESS: Email draft created"
        end tell
        '''.replace('{{', '{').replace('}}', '}')
        
        result = self.run_applescript(script)
        return {"status": "success" if "SUCCESS" in result else "error", "message": result}
    
    def get_inbox_summary(self) -> Dict:
        """Get summary statistics of inbox."""
        script = '''
        tell application "Mail"
            -- Don't activate (runs in background)
            set totalEmails to 0
            set totalUnread to 0
            set totalFlagged to 0
            set totalToday to 0
            
            set todayStart to (current date) - (time of (current date))
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    if name of mbox contains "INBOX" then
                        set totalEmails to totalEmails + (count of messages of mbox)
                        set totalUnread to totalUnread + (unread count of mbox)
                        
                        set flaggedMsgs to (every message of mbox whose flagged status is true)
                        set totalFlagged to totalFlagged + (count of flaggedMsgs)
                        
                        set todayMsgs to (every message of mbox whose date received ≥ todayStart)
                        set totalToday to totalToday + (count of todayMsgs)
                    end if
                end repeat
            end repeat
            
            return "TOTAL:" & totalEmails & "|UNREAD:" & totalUnread & "|FLAGGED:" & totalFlagged & "|TODAY:" & totalToday
        end tell
        '''
        
        output = self.run_applescript(script)
        parts = output.split("|")
        
        summary = {}
        for part in parts:
            if ":" in part:
                key, value = part.split(":")
                summary[key.lower()] = int(value)
        
        return summary
    
    def get_mailboxes(self) -> List[str]:
        """Get list of all mailboxes."""
        script = '''
        tell application "Mail"
            -- Don't activate (runs in background)
            set mailboxList to {}
            
            repeat with acct in accounts
                set acctName to name of acct
                repeat with mbox in mailboxes of acct
                    set mboxName to name of mbox
                    set fullName to acctName & "/" & mboxName
                    set end of mailboxList to fullName
                end repeat
            end repeat
            
            set AppleScript's text item delimiters to "|"
            return mailboxList as string
        end tell
        '''
        
        output = self.run_applescript(script)
        return output.split("|") if output else []
    
    # ==================== PARSING HELPER ====================
    
    def _parse_email_output(self, output: str) -> List[Dict]:
        """Parse AppleScript output into list of email dictionaries."""
        emails = []
        
        if not output:
            return emails
        
        email_blocks = output.split("|||EMAIL|||")
        
        for block in email_blocks:
            if "|||END|||" in block:
                email = {}
                content = ""
                in_content = False
                
                lines = block.split("\n")
                for line in lines:
                    if "|||END|||" in line:
                        break
                    elif "|||CONTENT|||" in line:
                        in_content = True
                    elif in_content:
                        content += line + "\n"
                    elif ":" in line:
                        key, value = line.split(":", 1)
                        email[key.strip().lower()] = value.strip()
                
                if content:
                    email['content'] = content.strip()
                
                # Clean up email data
                if 'read' in email:
                    email['read'] = email['read'].lower() == 'true'
                if 'flagged' in email:
                    email['flagged'] = email['flagged'].lower() == 'true'
                if 'attachments' in email:
                    email['attachments'] = email['attachments'].lower() == 'true'
                
                # Extract sender email if available
                if 'from' in email and '<' in email['from']:
                    match = re.search(r'<(.+?)>', email['from'])
                    if match:
                        email['sender_email'] = match.group(1)
                
                if email:
                    emails.append(email)
        
        return emails


def main():
    """Main function with CLI interface."""
    parser = argparse.ArgumentParser(description='Comprehensive Mail Tool for macOS')
    
    # Main action
    parser.add_argument('action', choices=[
        'recent', 'unread', 'search-subject', 'search-sender', 'search-content',
        'search-date', 'last-days', 'flagged', 'summary', 'mailboxes',
        'mark-read', 'mark-unread', 'flag', 'unflag', 'reply', 'compose'
    ], help='Action to perform')
    
    # Parameters
    parser.add_argument('--limit', type=int, default=20, help='Number of results')
    parser.add_argument('--query', help='Search query')
    parser.add_argument('--sender', help='Sender name or email')
    parser.add_argument('--start-date', help='Start date (MM/DD/YYYY)')
    parser.add_argument('--end-date', help='End date (MM/DD/YYYY)')
    parser.add_argument('--days', type=int, default=7, help='Number of days back')
    parser.add_argument('--mailbox', default='INBOX', help='Mailbox name')
    parser.add_argument('--message-id', help='Email message ID')
    parser.add_argument('--to', help='Recipient email')
    parser.add_argument('--subject', help='Email subject')
    parser.add_argument('--body', help='Email body')
    parser.add_argument('--cc', help='CC recipients')
    parser.add_argument('--format', choices=['json', 'pretty'], default='json', help='Output format')
    
    args = parser.parse_args()
    
    # Initialize mail tool
    mail = MailTool()
    result = None
    
    try:
        # Execute action
        if args.action == 'recent':
            result = mail.get_recent_emails(args.limit, args.mailbox)
        
        elif args.action == 'unread':
            result = mail.get_unread_emails(args.limit)
        
        elif args.action == 'search-subject':
            if not args.query:
                print(json.dumps({"error": "Query required for subject search"}))
                sys.exit(1)
            result = mail.search_by_subject(args.query, args.limit)
        
        elif args.action == 'search-sender':
            if not args.sender:
                print(json.dumps({"error": "Sender required for sender search"}))
                sys.exit(1)
            result = mail.search_by_sender(args.sender, args.limit)
        
        elif args.action == 'search-content':
            if not args.query:
                print(json.dumps({"error": "Query required for content search"}))
                sys.exit(1)
            result = mail.search_by_content(args.query, args.limit)
        
        elif args.action == 'search-date':
            if not args.start_date or not args.end_date:
                print(json.dumps({"error": "Start and end dates required"}))
                sys.exit(1)
            result = mail.search_by_date_range(args.start_date, args.end_date, args.limit)
        
        elif args.action == 'last-days':
            result = mail.get_emails_last_n_days(args.days, args.limit)
        
        elif args.action == 'flagged':
            result = mail.get_flagged_emails(args.limit)
        
        elif args.action == 'summary':
            result = mail.get_inbox_summary()
        
        elif args.action == 'mailboxes':
            result = mail.get_mailboxes()
        
        elif args.action == 'mark-read':
            if not args.message_id:
                print(json.dumps({"error": "Message ID required"}))
                sys.exit(1)
            result = mail.mark_as_read(args.message_id)
        
        elif args.action == 'mark-unread':
            if not args.message_id:
                print(json.dumps({"error": "Message ID required"}))
                sys.exit(1)
            result = mail.mark_as_unread(args.message_id)
        
        elif args.action == 'flag':
            if not args.message_id:
                print(json.dumps({"error": "Message ID required"}))
                sys.exit(1)
            result = mail.flag_email(args.message_id, True)
        
        elif args.action == 'unflag':
            if not args.message_id:
                print(json.dumps({"error": "Message ID required"}))
                sys.exit(1)
            result = mail.flag_email(args.message_id, False)
        
        elif args.action == 'reply':
            if not args.message_id or not args.body:
                print(json.dumps({"error": "Message ID and body required"}))
                sys.exit(1)
            result = mail.create_draft_reply(args.message_id, args.body)
        
        elif args.action == 'compose':
            if not args.to or not args.subject or not args.body:
                print(json.dumps({"error": "To, subject, and body required"}))
                sys.exit(1)
            result = mail.compose_email(args.to, args.subject, args.body, args.cc)
        
        # Output result
        if args.format == 'json':
            print(json.dumps(result, indent=2))
        else:
            # Pretty print for human reading
            if isinstance(result, list):
                for i, email in enumerate(result, 1):
                    print(f"\n--- Email {i} ---")
                    for key, value in email.items():
                        if key != 'content':
                            print(f"{key}: {value}")
                    if 'content' in email:
                        print(f"content: {email['content'][:200]}...")
            else:
                print(json.dumps(result, indent=2))
        
    except Exception as e:
        error_result = {"error": str(e)}
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == "__main__":
    main()