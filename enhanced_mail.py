#!/usr/bin/env python3
"""
Enhanced Mail Module for AppleCLI
Adds missing email functionality like reading emails, date filtering, etc.
"""

import subprocess
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional


class EnhancedMailManager:
    """Enhanced Mail app operations with full email reading capabilities."""
    
    def __init__(self):
        pass
    
    def run_applescript(self, script: str) -> str:
        """Execute AppleScript and return output."""
        try:
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode != 0:
                raise Exception(f"Script error: {result.stderr}")
            return result.stdout.strip()
        except Exception as e:
            raise Exception(f"Execution failed: {e}")
    
    def get_latest_emails(self, limit: int = 10, mailbox: str = "INBOX") -> List[Dict]:
        """Get the latest emails with full details."""
        script = f'''
        tell application "Mail"
            activate
            set emailList to {{}}
            set counter to 0
            
            try
                set targetMailbox to mailbox "{mailbox}" of account 1
                set msgs to messages of targetMailbox
                
                repeat with msg in msgs
                    if counter < {limit} then
                        set msgDate to date received of msg
                        set msgSubject to subject of msg
                        set msgSender to sender of msg
                        set msgContent to content of msg
                        set msgRead to read status of msg
                        set msgID to message id of msg
                        
                        -- Truncate content for preview
                        if length of msgContent > 200 then
                            set msgPreview to text 1 thru 200 of msgContent & "..."
                        else
                            set msgPreview to msgContent
                        end if
                        
                        set msgInfo to "ID:" & msgID & "|DATE:" & (msgDate as string) & "|FROM:" & msgSender & "|SUBJECT:" & msgSubject & "|READ:" & msgRead & "|PREVIEW:" & msgPreview
                        set end of emailList to msgInfo
                        set counter to counter + 1
                    end if
                end repeat
            end try
            
            return emailList
        end tell
        '''
        
        output = self.run_applescript(script)
        if not output:
            return []
        
        emails = []
        for email_str in output.split(", "):
            parts = email_str.split("|")
            email_dict = {}
            for part in parts:
                if ":" in part:
                    key, value = part.split(":", 1)
                    email_dict[key.lower()] = value
            if email_dict:
                emails.append(email_dict)
        
        return emails
    
    def read_email_by_id(self, message_id: str) -> Dict:
        """Read full email content by message ID."""
        script = f'''
        tell application "Mail"
            activate
            set foundEmail to ""
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set msgs to (messages of mbox whose message id is "{message_id}")
                    if (count of msgs) > 0 then
                        set msg to item 1 of msgs
                        set msgDate to date received of msg
                        set msgSubject to subject of msg
                        set msgSender to sender of msg
                        set msgContent to content of msg
                        set msgRead to read status of msg
                        
                        set foundEmail to "DATE:" & (msgDate as string) & "|FROM:" & msgSender & "|SUBJECT:" & msgSubject & "|READ:" & msgRead & "|CONTENT:" & msgContent
                        exit repeat
                    end if
                end repeat
                if foundEmail is not "" then exit repeat
            end repeat
            
            return foundEmail
        end tell
        '''
        
        output = self.run_applescript(script)
        if not output:
            return {}
        
        email_dict = {}
        parts = output.split("|")
        for part in parts:
            if ":" in part:
                key, value = part.split(":", 1)
                email_dict[key.lower()] = value
        
        return email_dict
    
    def get_emails_between_dates(self, start_date: str, end_date: str, limit: int = 20) -> List[Dict]:
        """Get emails between two dates. Dates should be in format: 'MM/DD/YYYY'"""
        script = f'''
        tell application "Mail"
            activate
            set emailList to {{}}
            set counter to 0
            set startDate to date "{start_date}"
            set endDate to date "{end_date}"
            
            try
                set inbox to mailbox "INBOX" of account 1
                set msgs to (messages of inbox whose date received ≥ startDate and date received ≤ endDate)
                
                repeat with msg in msgs
                    if counter < {limit} then
                        set msgDate to date received of msg
                        set msgSubject to subject of msg
                        set msgSender to sender of msg
                        set msgPreview to text 1 thru 100 of (content of msg) & "..."
                        
                        set msgInfo to (date string of msgDate) & " | " & msgSender & " | " & msgSubject & " | " & msgPreview
                        set end of emailList to msgInfo
                        set counter to counter + 1
                    end if
                end repeat
            end try
            
            return emailList
        end tell
        '''
        
        output = self.run_applescript(script)
        return output.split(", ") if output else []
    
    def search_by_sender(self, sender_email: str, limit: int = 10) -> List[Dict]:
        """Search emails by sender email address."""
        script = f'''
        tell application "Mail"
            activate
            set emailList to {{}}
            set counter to 0
            
            try
                set inbox to mailbox "INBOX" of account 1
                set msgs to (messages of inbox whose sender contains "{sender_email}")
                
                repeat with msg in msgs
                    if counter < {limit} then
                        set msgDate to date received of msg
                        set msgSubject to subject of msg
                        set msgSender to sender of msg
                        
                        set msgInfo to (date string of msgDate) & " - " & msgSubject & " (from: " & msgSender & ")"
                        set end of emailList to msgInfo
                        set counter to counter + 1
                    end if
                end repeat
            end try
            
            return emailList
        end tell
        '''
        
        output = self.run_applescript(script)
        return output.split(", ") if output else []
    
    def search_body_content(self, search_term: str, limit: int = 10) -> List[Dict]:
        """Search in email body content."""
        script = f'''
        tell application "Mail"
            activate
            set emailList to {{}}
            set counter to 0
            
            try
                set inbox to mailbox "INBOX" of account 1
                set msgs to (messages of inbox whose content contains "{search_term}")
                
                repeat with msg in msgs
                    if counter < {limit} then
                        set msgDate to date received of msg
                        set msgSubject to subject of msg
                        set msgSender to sender of msg
                        
                        set msgInfo to msgSubject & " from " & msgSender & " on " & (date string of msgDate)
                        set end of emailList to msgInfo
                        set counter to counter + 1
                    end if
                end repeat
            end try
            
            return emailList
        end tell
        '''
        
        output = self.run_applescript(script)
        return output.split(", ") if output else []
    
    def mark_as_read(self, message_id: str, read_status: bool = True) -> str:
        """Mark email as read or unread."""
        status_text = "true" if read_status else "false"
        
        script = f'''
        tell application "Mail"
            activate
            set resultMsg to "Email not found"
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set msgs to (messages of mbox whose message id is "{message_id}")
                    if (count of msgs) > 0 then
                        set msg to item 1 of msgs
                        set read status of msg to {status_text}
                        set resultMsg to "Email marked as " & "{status_text}"
                        exit repeat
                    end if
                end repeat
                if resultMsg is not "Email not found" then exit repeat
            end repeat
            
            return resultMsg
        end tell
        '''
        
        return self.run_applescript(script)
    
    def get_email_count_by_folder(self) -> Dict:
        """Get email count for all folders."""
        script = '''
        tell application "Mail"
            activate
            set folderList to {}
            
            repeat with acct in accounts
                set acctName to name of acct
                repeat with mbox in mailboxes of acct
                    try
                        set mboxName to name of mbox
                        set msgCount to count of messages of mbox
                        set unreadCount to unread count of mbox
                        
                        set folderInfo to acctName & "/" & mboxName & ": " & msgCount & " total, " & unreadCount & " unread"
                        set end of folderList to folderInfo
                    end try
                end repeat
            end repeat
            
            return folderList
        end tell
        '''
        
        output = self.run_applescript(script)
        return output.split(", ") if output else []
    
    def reply_to_email(self, message_id: str, reply_content: str) -> str:
        """Create a reply to an email."""
        script = f'''
        tell application "Mail"
            activate
            set resultMsg to "Email not found"
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set msgs to (messages of mbox whose message id is "{message_id}")
                    if (count of msgs) > 0 then
                        set msg to item 1 of msgs
                        set replyMsg to reply msg with opening window
                        tell replyMsg
                            set content to "{reply_content}" & return & return & content
                        end tell
                        set resultMsg to "Reply draft created"
                        exit repeat
                    end if
                end repeat
                if resultMsg is not "Email not found" then exit repeat
            end repeat
            
            return resultMsg
        end tell
        '''
        
        return self.run_applescript(script)
    
    def get_attachments(self, message_id: str) -> List[str]:
        """Get list of attachments for an email."""
        script = f'''
        tell application "Mail"
            activate
            set attachmentList to {{}}
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    set msgs to (messages of mbox whose message id is "{message_id}")
                    if (count of msgs) > 0 then
                        set msg to item 1 of msgs
                        set attachments to mail attachments of msg
                        
                        repeat with att in attachments
                            set attName to name of att
                            set end of attachmentList to attName
                        end repeat
                        exit repeat
                    end if
                end repeat
                if (count of attachmentList) > 0 then exit repeat
            end repeat
            
            return attachmentList
        end tell
        '''
        
        output = self.run_applescript(script)
        return output.split(", ") if output else []


# Test the enhanced functionality
if __name__ == "__main__":
    import sys
    
    mail = EnhancedMailManager()
    
    if len(sys.argv) > 1:
        action = sys.argv[1]
        
        if action == "latest":
            # Get latest 5 emails
            emails = mail.get_latest_emails(5)
            for email in emails:
                print(f"From: {email.get('from', 'Unknown')}")
                print(f"Subject: {email.get('subject', 'No subject')}")
                print(f"Preview: {email.get('preview', '')[:100]}...")
                print("-" * 50)
        
        elif action == "sender":
            # Search by sender
            if len(sys.argv) > 2:
                results = mail.search_by_sender(sys.argv[2])
                for result in results:
                    print(result)
        
        elif action == "folders":
            # Get folder counts
            folders = mail.get_email_count_by_folder()
            for folder in folders:
                print(folder)
        
        elif action == "body":
            # Search in body
            if len(sys.argv) > 2:
                results = mail.search_body_content(sys.argv[2])
                for result in results:
                    print(result)
        
        else:
            print("Usage: python3 enhanced_mail.py [latest|sender|folders|body] [query]")
    else:
        # Default: show folder counts
        print("Email Folder Summary:")
        folders = mail.get_email_count_by_folder()
        for folder in folders:
            print(folder)