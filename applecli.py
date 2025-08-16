#!/usr/bin/env python3
"""
AppleCLI - Comprehensive macOS Application Control CLI
Control Apple apps from the command line with ease.
"""

import argparse
import json
import subprocess
import sys
import re
import sqlite3
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import urllib.request
import urllib.parse
import gzip
from html import unescape
from pathlib import Path
import time


class AppleScriptExecutor:
    """Execute AppleScript and JXA commands."""
    
    @staticmethod
    def run_applescript(script: str, use_javascript: bool = False) -> str:
        """Execute AppleScript or JXA and return output."""
        try:
            cmd = ['osascript']
            if use_javascript:
                cmd.extend(['-l', 'JavaScript'])
            cmd.extend(['-e', script])
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                raise Exception(f"Script error: {result.stderr}")
            
            return result.stdout.strip()
        except subprocess.TimeoutExpired:
            raise Exception("Script execution timed out")
        except Exception as e:
            raise Exception(f"Execution failed: {e}")


class ContactsManager:
    """Manage Contacts app operations."""
    
    def __init__(self, executor: AppleScriptExecutor):
        self.executor = executor
    
    def list_all(self, limit: int = None) -> List[Dict]:
        """List all contacts with phone numbers."""
        script = '''
        const Contacts = Application("Contacts");
        Contacts.activate();
        const people = Contacts.people();
        const result = [];
        let count = 0;
        const limit = ''' + str(limit if limit else 'null') + ''';
        
        for (const person of people) {
            if (limit && count >= limit) break;
            try {
                const name = person.name();
                const phones = person.phones().map(phone => phone.value());
                const emails = person.emails().map(email => email.value());
                if (phones.length > 0 || emails.length > 0) {
                    result.push({
                        name: name,
                        phones: phones,
                        emails: emails
                    });
                    count++;
                }
            } catch(e) {}
        }
        JSON.stringify(result);
        '''
        
        output = self.executor.run_applescript(script, use_javascript=True)
        return json.loads(output) if output else []
    
    def search(self, query: str, regex: bool = False) -> List[Dict]:
        """Search contacts by name or pattern."""
        if regex:
            # Get all contacts and filter with regex
            all_contacts = self.list_all()
            pattern = re.compile(query, re.IGNORECASE)
            return [c for c in all_contacts if pattern.search(c['name'])]
        else:
            # Use JXA search
            script = '''
            const Contacts = Application("Contacts");
            Contacts.activate();
            const searchName = "''' + query + '''";
            const people = Contacts.people.whose({name: {_contains: searchName}})();
            const results = [];
            for (const person of people) {
                try {
                    results.push({
                        name: person.name(),
                        phones: person.phones().map(p => p.value()),
                        emails: person.emails().map(e => e.value())
                    });
                } catch(e) {}
            }
            JSON.stringify(results);
            '''
            
            output = self.executor.run_applescript(script, use_javascript=True)
            return json.loads(output) if output else []
    
    def count(self) -> int:
        """Get total number of contacts."""
        script = 'Application("Contacts").people().length'
        output = self.executor.run_applescript(script, use_javascript=True)
        return int(output) if output else 0


class NotesManager:
    """Manage Notes app operations."""
    
    def __init__(self, executor: AppleScriptExecutor):
        self.executor = executor
    
    def list_all(self, limit: int = 10) -> List[Dict]:
        """List all notes."""
        script = f'''
        const Notes = Application("Notes");
        Notes.activate();
        const notes = Notes.notes();
        const result = notes.slice(0, {limit}).map(note => ({{
            name: note.name(),
            folder: note.container().name(),
            preview: note.plaintext().substring(0, 100) + "..."
        }}));
        JSON.stringify(result);
        '''.replace('{{', '{').replace('}}', '}')
        
        
        output = self.executor.run_applescript(script, use_javascript=True)
        return json.loads(output) if output else []
    
    def search(self, query: str) -> List[Dict]:
        """Search notes by content or title."""
        script = '''
        const Notes = Application("Notes");
        Notes.activate();
        const searchText = "''' + query + '''";
        const foundNotes = Notes.notes.whose({
            _or: [
                {name: {_contains: searchText}},
                {plaintext: {_contains: searchText}}
            ]
        })();
        const results = [];
        for (const note of foundNotes.slice(0, 10)) {
            try {
                results.push({
                    name: note.name(),
                    folder: note.container().name(),
                    preview: note.plaintext().substring(0, 200)
                });
            } catch(e) {}
        }
        JSON.stringify(results);
        '''
        
        output = self.executor.run_applescript(script, use_javascript=True)
        return json.loads(output) if output else []
    
    def create(self, title: str, body: str, folder: str = "Notes") -> str:
        """Create a new note."""
        # Use AppleScript for more reliable note creation
        safe_title = title.replace('"', '\\"')
        safe_body = body.replace('"', '\\"')
        
        script = f'''
        tell application "Notes"
            activate
            set noteTitle to "{safe_title}"
            set noteBody to "{safe_body}"
            
            try
                make new note with properties {{name:noteTitle, body:noteBody}}
                return "Note created: " & noteTitle
            on error errMsg
                return "Error creating note: " & errMsg
            end try
        end tell
        '''
        
        return self.executor.run_applescript(script)


class MessagesManager:
    """Manage Messages app operations."""
    
    def __init__(self, executor: AppleScriptExecutor):
        self.executor = executor
        self.db_path = os.path.expanduser("~/Library/Messages/chat.db")
    
    def read_from_db(self, phone_number: str = None, limit: int = 10) -> List[Dict]:
        """Read messages from database (requires Full Disk Access)."""
        if not os.path.exists(self.db_path):
            raise Exception("Messages database not accessible. Need Full Disk Access permission.")
        
        try:
            conn = sqlite3.connect(f"file:{self.db_path}?mode=ro", uri=True)
            cursor = conn.cursor()
            
            query = """
            SELECT 
                m.text,
                datetime(m.date/1000000000 + 978307200, 'unixepoch', 'localtime') as date,
                h.id as contact,
                CASE m.is_from_me 
                    WHEN 0 THEN 'Received' 
                    WHEN 1 THEN 'Sent' 
                END as direction
            FROM message m
            JOIN handle h ON m.handle_id = h.ROWID
            WHERE m.text IS NOT NULL
            """
            
            if phone_number:
                query += f" AND h.id LIKE '%{phone_number}%'"
            
            query += f" ORDER BY m.date DESC LIMIT {limit}"
            
            cursor.execute(query)
            columns = [description[0] for description in cursor.description]
            results = []
            for row in cursor.fetchall():
                results.append(dict(zip(columns, row)))
            
            conn.close()
            return results
        except Exception as e:
            raise Exception(f"Database read failed: {e}")
    
    def send(self, phone_number: str, message: str) -> str:
        """Send a message (requires existing contact)."""
        script = f'''
        tell application "Messages"
            activate
            set phoneNumber to "{phone_number}"
            set messageText to "{message}"
            
            try
                set targetBuddy to buddy phoneNumber of service 1
                send messageText to targetBuddy
                return "Message sent to " & phoneNumber
            on error
                return "Error: Contact not found in Messages"
            end try
        end tell
        '''
        
        return self.executor.run_applescript(script)
    
    def get_chats(self, limit: int = 5) -> List[str]:
        """Get list of recent chats."""
        script = f'''
        tell application "Messages"
            activate
            set chatList to {{}}
            set counter to 0
            repeat with eachChat in chats
                if counter < {limit} then
                    try
                        set chatName to name of eachChat
                        set participantCount to count of participants of eachChat
                        
                        -- Handle missing chat names
                        if chatName is missing value or chatName is "" then
                            set chatName to "Unnamed Chat"
                        end if
                        
                        set chatInfo to chatName & " (" & participantCount & " participants)"
                        set end of chatList to chatInfo
                        set counter to counter + 1
                    end try
                end if
            end repeat
            return chatList
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        return output.split(", ") if output else []


class MailManager:
    """Manage Mail app operations."""
    
    def __init__(self, executor: AppleScriptExecutor):
        self.executor = executor
    
    def get_unread(self) -> Dict:
        """Get unread email counts."""
        script = '''
        tell application "Mail"
            activate
            set unreadList to {}
            set totalUnread to 0
            
            repeat with acct in accounts
                set acctName to name of acct
                repeat with mbox in mailboxes of acct
                    try
                        set mboxUnread to unread count of mbox
                        if mboxUnread > 0 then
                            set unreadInfo to acctName & " - " & (name of mbox) & ": " & mboxUnread
                            set end of unreadList to unreadInfo
                            set totalUnread to totalUnread + mboxUnread
                        end if
                    end try
                end repeat
            end repeat
            
            return "Total: " & totalUnread & " | " & unreadList
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        if output:
            parts = output.split(" | ")
            total = int(re.search(r'Total: (\d+)', parts[0]).group(1))
            details = parts[1].split(", ") if len(parts) > 1 else []
            return {"total": total, "details": details}
        return {"total": 0, "details": []}
    
    def get_recent(self, limit: int = 10, mailbox: str = "INBOX") -> List[Dict]:
        """Get recent emails from mailbox."""
        script = f'''
        tell application "Mail"
            activate
            set emailList to {{}}
            set emailCount to 0
            
            try
                repeat with acct in accounts
                    if emailCount < {limit} then
                        repeat with mbox in mailboxes of acct
                            if name of mbox is "{mailbox}" and emailCount < {limit} then
                                set msgs to messages of mbox
                                
                                repeat with i from 1 to (count of msgs)
                                    if emailCount < {limit} then
                                        set msg to item i of msgs
                                        set msgDate to (date received of msg) as string
                                        set msgSubject to subject of msg
                                        set msgSender to sender of msg
                                        set msgRead to read status of msg
                                        
                                        -- Get preview (first 200 chars)
                                        try
                                            set msgContent to content of msg
                                            if length of msgContent > 200 then
                                                set msgPreview to text 1 thru 200 of msgContent & "..."
                                            else
                                                set msgPreview to msgContent
                                            end if
                                        on error
                                            set msgPreview to "(No preview available)"
                                        end try
                                        
                                        set msgInfo to "DATE:" & msgDate & "||SUBJECT:" & msgSubject & "||FROM:" & msgSender & "||READ:" & msgRead & "||PREVIEW:" & msgPreview
                                        set end of emailList to msgInfo
                                        set emailCount to emailCount + 1
                                    else
                                        exit repeat
                                    end if
                                end repeat
                            end if
                        end repeat
                    end if
                end repeat
            end try
            
            return emailList
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        emails = []
        if output:
            # Handle AppleScript list format
            email_entries = output.split(", DATE:")
            for i, entry in enumerate(email_entries):
                if i > 0:
                    entry = "DATE:" + entry
                parts = entry.split("||")
                if len(parts) >= 5:
                    email_dict = {
                        "date": parts[0].replace("DATE:", "").strip(),
                        "subject": parts[1].replace("SUBJECT:", "").strip(),
                        "from": parts[2].replace("FROM:", "").strip(),
                        "read": parts[3].replace("READ:", "").strip() == "true",
                        "preview": parts[4].replace("PREVIEW:", "").strip()
                    }
                    emails.append(email_dict)
        return emails
    
    def get_from_sender(self, sender: str, limit: int = 10) -> List[Dict]:
        """Get emails from specific sender."""
        script = f'''
        tell application "Mail"
            activate
            set emailList to {{}}
            set emailCount to 0
            
            try
                set inbox to mailbox "INBOX" of account 1
                set senderMessages to (every message of inbox whose sender contains "{sender}")
                
                repeat with msg in senderMessages
                    if emailCount < {limit} then
                        set msgDate to (date received of msg) as string
                        set msgSubject to subject of msg
                        set msgSender to sender of msg
                        set msgPreview to content of msg
                        
                        if length of msgPreview > 200 then
                            set msgPreview to text 1 thru 200 of msgPreview & "..."
                        end if
                        
                        set msgInfo to "DATE:" & msgDate & "||SUBJECT:" & msgSubject & "||FROM:" & msgSender & "||PREVIEW:" & msgPreview
                        set end of emailList to msgInfo
                        set emailCount to emailCount + 1
                    end if
                end repeat
            end try
            
            return emailList
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        emails = []
        if output:
            for email_str in output.split(", "):
                parts = email_str.split("||")
                if len(parts) >= 4:
                    email_dict = {
                        "date": parts[0].replace("DATE:", ""),
                        "subject": parts[1].replace("SUBJECT:", ""),
                        "from": parts[2].replace("FROM:", ""),
                        "preview": parts[3].replace("PREVIEW:", "")
                    }
                    emails.append(email_dict)
        return emails
    
    def get_date_range(self, start_date: str, end_date: str, limit: int = 20) -> List[Dict]:
        """Get emails within date range (format: 'MM/DD/YYYY')."""
        script = f'''
        tell application "Mail"
            activate
            set emailList to {{}}
            set emailCount to 0
            set startDate to date "{start_date}"
            set endDate to date "{end_date}"
            
            try
                set inbox to mailbox "INBOX" of account 1
                set dateMessages to (every message of inbox whose date received ≥ startDate and date received ≤ endDate)
                
                repeat with msg in dateMessages
                    if emailCount < {limit} then
                        set msgDate to (date received of msg) as string
                        set msgSubject to subject of msg
                        set msgSender to sender of msg
                        set msgInfo to "DATE:" & msgDate & "||SUBJECT:" & msgSubject & "||FROM:" & msgSender
                        set end of emailList to msgInfo
                        set emailCount to emailCount + 1
                    end if
                end repeat
            end try
            
            return emailList
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        emails = []
        if output:
            for email_str in output.split(", "):
                parts = email_str.split("||")
                if len(parts) >= 3:
                    email_dict = {
                        "date": parts[0].replace("DATE:", ""),
                        "subject": parts[1].replace("SUBJECT:", ""),
                        "from": parts[2].replace("FROM:", "")
                    }
                    emails.append(email_dict)
        return emails
    
    def search(self, query: str, limit: int = 5) -> List[str]:
        """Search emails by subject or content."""
        script = f'''
        tell application "Mail"
            activate
            set searchTerm to "{query}"
            set foundMessages to {{}}
            set searchCount to 0
            
            try
                set inbox to mailbox "INBOX" of account 1
                set msgs to (every message of inbox whose subject contains searchTerm or content contains searchTerm)
                
                repeat with msg in msgs
                    if searchCount < {limit} then
                        set msgDate to (date received of msg) as string
                        set msgInfo to (subject of msg) & " from " & (sender of msg) & " on " & msgDate
                        set end of foundMessages to msgInfo
                        set searchCount to searchCount + 1
                    end if
                end repeat
            end try
            
            return foundMessages
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        return output.split(", ") if output else []
    
    def mark_as_read(self, subject: str) -> str:
        """Mark email as read by subject."""
        script = f'''
        tell application "Mail"
            activate
            set markedCount to 0
            try
                set inbox to mailbox "INBOX" of account 1
                set targetMessages to (every message of inbox whose subject contains "{subject}" and read status is false)
                
                repeat with msg in targetMessages
                    set read status of msg to true
                    set markedCount to markedCount + 1
                end repeat
            end try
            
            return "Marked " & markedCount & " emails as read"
        end tell
        '''
        
        return self.executor.run_applescript(script)
    
    def get_last_week(self, limit: int = 20) -> List[Dict]:
        """Get emails from last week."""
        from datetime import datetime, timedelta
        
        # Calculate dates
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        # Format dates for AppleScript (MM/DD/YYYY)
        start_str = start_date.strftime("%m/%d/%Y")
        end_str = end_date.strftime("%m/%d/%Y")
        
        return self.get_date_range(start_str, end_str, limit)
    
    def get_needs_reply(self, limit: int = 10) -> List[Dict]:
        """Get unread emails that likely need replies (from real people, not automated)."""
        script = f'''
        tell application "Mail"
            activate
            set needsReplyList to {{}}
            set emailCount to 0
            
            try
                set inbox to mailbox "INBOX" of account 1
                set unreadMessages to (every message of inbox whose read status is false)
                
                repeat with msg in unreadMessages
                    if emailCount < {limit} then
                        set msgSender to sender of msg
                        set msgSubject to subject of msg
                        set msgDate to (date received of msg) as string
                        
                        -- Filter out automated emails
                        if msgSender does not contain "no-reply" and msgSender does not contain "noreply" and msgSender does not contain "donotreply" and msgSender does not contain "notification" then
                            set msgPreview to content of msg
                            if length of msgPreview > 150 then
                                set msgPreview to text 1 thru 150 of msgPreview & "..."
                            end if
                            
                            set msgInfo to "DATE:" & msgDate & "||SUBJECT:" & msgSubject & "||FROM:" & msgSender & "||PREVIEW:" & msgPreview
                            set end of needsReplyList to msgInfo
                            set emailCount to emailCount + 1
                        end if
                    end if
                end repeat
            end try
            
            return needsReplyList
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        emails = []
        if output:
            for email_str in output.split(", "):
                parts = email_str.split("||")
                if len(parts) >= 4:
                    email_dict = {
                        "date": parts[0].replace("DATE:", ""),
                        "subject": parts[1].replace("SUBJECT:", ""),
                        "from": parts[2].replace("FROM:", ""),
                        "preview": parts[3].replace("PREVIEW:", ""),
                        "needs_reply": True
                    }
                    emails.append(email_dict)
        return emails
    
    def create_reply_draft(self, subject: str, reply_body: str) -> str:
        """Create a reply draft for an email with the given subject."""
        script = f'''
        tell application "Mail"
            activate
            set replyCreated to false
            
            try
                set inbox to mailbox "INBOX" of account 1
                set targetMessages to (every message of inbox whose subject contains "{subject}")
                
                if (count of targetMessages) > 0 then
                    set msg to item 1 of targetMessages
                    set replyMsg to reply msg with opening window
                    
                    tell replyMsg
                        set content to "{reply_body}" & return & return & content
                    end tell
                    
                    set replyCreated to true
                    return "Reply draft created for: {subject}"
                else
                    return "No email found with subject: {subject}"
                end if
            end try
            
            if not replyCreated then
                return "Failed to create reply draft"
            end if
        end tell
        '''
        
        return self.executor.run_applescript(script)
    
    def get_inbox_summary(self) -> Dict:
        """Get a summary of inbox status."""
        script = '''
        tell application "Mail"
            activate
            set summaryData to {}
            set totalEmails to 0
            set totalUnread to 0
            set todayCount to 0
            set weekCount to 0
            set importantSenders to {}
            
            try
                set todayDate to current date
                set todayStart to todayDate - (time of todayDate)
                set weekAgo to todayDate - (7 * days)
                
                repeat with acct in accounts
                    set acctName to name of acct
                    repeat with mbox in mailboxes of acct
                        if name of mbox is "INBOX" then
                            set allMessages to messages of mbox
                            set totalEmails to totalEmails + (count of allMessages)
                            set totalUnread to totalUnread + (unread count of mbox)
                            
                            repeat with msg in allMessages
                                set msgDate to date received of msg
                                if msgDate ≥ todayStart then
                                    set todayCount to todayCount + 1
                                end if
                                if msgDate ≥ weekAgo then
                                    set weekCount to weekCount + 1
                                end if
                            end repeat
                        end if
                    end repeat
                end repeat
                
                return "Total:" & totalEmails & "||Unread:" & totalUnread & "||Today:" & todayCount & "||Week:" & weekCount
            end try
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        if output:
            parts = output.split("||")
            return {
                "total_emails": int(parts[0].replace("Total:", "")),
                "unread": int(parts[1].replace("Unread:", "")),
                "today": int(parts[2].replace("Today:", "")),
                "this_week": int(parts[3].replace("Week:", ""))
            }
        return {"total_emails": 0, "unread": 0, "today": 0, "this_week": 0}
    
    def flag_email(self, subject: str, flag: bool = True) -> str:
        """Flag or unflag emails by subject."""
        flag_status = "true" if flag else "false"
        script = f'''
        tell application "Mail"
            activate
            set flaggedCount to 0
            
            try
                set inbox to mailbox "INBOX" of account 1
                set targetMessages to (every message of inbox whose subject contains "{subject}")
                
                repeat with msg in targetMessages
                    set flagged status of msg to {flag_status}
                    set flaggedCount to flaggedCount + 1
                end repeat
            end try
            
            if flaggedCount > 0 then
                if {flag_status} then
                    return "Flagged " & flaggedCount & " emails"
                else
                    return "Unflagged " & flaggedCount & " emails"
                end if
            else
                return "No emails found with subject: {subject}"
            end if
        end tell
        '''
        
        return self.executor.run_applescript(script)
    
    def add_email_to_reminders(self, subject: str, list_name: str = "Reminders") -> str:
        """Add an email to Reminders as a task."""
        script = f'''
        tell application "Mail"
            activate
            set emailAdded to false
            
            try
                set inbox to mailbox "INBOX" of account 1
                set targetMessages to (every message of inbox whose subject contains "{subject}")
                
                if (count of targetMessages) > 0 then
                    set msg to item 1 of targetMessages
                    set msgSubject to subject of msg
                    set msgSender to sender of msg
                    set msgDate to (date received of msg) as string
                    set reminderTitle to "Reply to: " & msgSubject
                    set reminderNote to "From: " & msgSender & " on " & msgDate
                    
                    tell application "Reminders"
                        activate
                        set targetList to list "{list_name}"
                        tell targetList
                            set newReminder to make new reminder with properties {{name:reminderTitle, body:reminderNote}}
                        end tell
                    end tell
                    
                    set emailAdded to true
                    return "Added email to reminders: " & msgSubject
                else
                    return "No email found with subject: {subject}"
                end if
            end try
            
            if not emailAdded then
                return "Failed to add email to reminders"
            end if
        end tell
        '''.replace('{{', '{').replace('}}', '}')
        
        return self.executor.run_applescript(script)
    
    def compose(self, to: str, subject: str, body: str, cc: str = None) -> str:
        """Compose a new email (draft)."""
        cc_line = f'make new cc recipient at end of cc recipients with properties {{address:"{cc}"}}' if cc else ""
        
        script = f'''
        tell application "Mail"
            activate
            set newMessage to make new outgoing message with properties {{subject:"{subject}", content:"{body}", visible:false}}
            
            tell newMessage
                make new to recipient at end of to recipients with properties {{address:"{to}"}}
                {cc_line}
            end tell
            
            return "Email draft created: {subject}"
        end tell
        '''.replace('{{', '{').replace('}}', '}')
        
        
        return self.executor.run_applescript(script)


class CalendarManager:
    """Manage Calendar app operations."""
    
    def __init__(self, executor: AppleScriptExecutor):
        self.executor = executor
    
    def get_today_events(self) -> List[str]:
        """Get today's calendar events."""
        script = '''
        tell application "Calendar"
            activate
            set today to current date
            set tomorrow to today + (1 * days)
            set todayEvents to {}
            
            repeat with cal in calendars
                try
                    set calName to name of cal
                    set calEvents to (events of cal whose start date ≥ today and start date < tomorrow)
                    repeat with evt in calEvents
                        set eventTime to (start date of evt)
                        set eventInfo to (time string of eventTime) & " - " & (summary of evt) & " (" & calName & ")"
                        set end of todayEvents to eventInfo
                    end repeat
                end try
            end repeat
            
            if (count of todayEvents) = 0 then
                return "No events scheduled for today"
            else
                return todayEvents
            end if
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        if output == "No events scheduled for today":
            return []
        return output.split(", ") if output else []
    
    def search(self, query: str, days_ahead: int = 30) -> List[str]:
        """Search calendar events."""
        script = f'''
        tell application "Calendar"
            activate
            set searchText to "{query}"
            set foundEvents to {{}}
            set today to current date
            set endDate to today + ({days_ahead} * days)
            
            repeat with cal in calendars
                try
                    set calEvents to (events of cal whose summary contains searchText and start date ≥ today and start date ≤ endDate)
                    repeat with evt in calEvents
                        set eventInfo to (date string of (start date of evt)) & ": " & (summary of evt)
                        set end of foundEvents to eventInfo
                    end repeat
                end try
            end repeat
            
            return foundEvents
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        return output.split(", ") if output else []
    
    def create_event(self, title: str, calendar_name: str = "Home", hours_from_now: int = 24) -> str:
        """Create a calendar event."""
        script = f'''
        tell application "Calendar"
            activate
            set cal to calendar "{calendar_name}"
            set eventStart to ((current date) + ({hours_from_now} * hours))
            set eventEnd to eventStart + (1 * hours)
            
            tell cal
                set newEvent to make new event with properties {{summary:"{title}", start date:eventStart, end date:eventEnd, description:"Created via AppleCLI"}}
            end tell
            
            return "Created event: {title}"
        end tell
        '''.replace('{{', '{').replace('}}', '}')
        
        
        return self.executor.run_applescript(script)


class RemindersManager:
    """Manage Reminders app operations."""
    
    def __init__(self, executor: AppleScriptExecutor):
        self.executor = executor
    
    def list_all(self, list_name: str = None, incomplete_only: bool = False) -> List[Dict]:
        """List reminders."""
        filter_condition = "whose completed is false" if incomplete_only else ""
        
        if list_name:
            script = f'''
            tell application "Reminders"
                activate
                set targetList to list "{list_name}"
                set remindersList to {{}}
                repeat with rmndr in (reminders of targetList {filter_condition})
                    set reminderInfo to name of rmndr
                    if completed of rmndr then
                        set reminderInfo to reminderInfo & " ✓"
                    else
                        set reminderInfo to reminderInfo & " ○"
                    end if
                    set end of remindersList to reminderInfo
                end repeat
                return remindersList
            end tell
            '''
        else:
            script = f'''
            tell application "Reminders"
                activate
                set allReminders to {{}}
                repeat with lst in lists
                    set listName to name of lst
                    repeat with rmndr in (reminders of lst {filter_condition})
                        set reminderInfo to listName & ": " & (name of rmndr)
                        if completed of rmndr then
                            set reminderInfo to reminderInfo & " ✓"
                        else
                            set reminderInfo to reminderInfo & " ○"
                        end if
                        set end of allReminders to reminderInfo
                    end repeat
                end repeat
                return allReminders
            end tell
            '''
        
        output = self.executor.run_applescript(script)
        if output:
            items = output.split(", ")
            return [{"reminder": item} for item in items]
        return []
    
    def search(self, query: str) -> List[str]:
        """Search reminders."""
        script = f'''
        tell application "Reminders"
            activate
            set searchText to "{query}"
            set foundReminders to {{}}
            
            repeat with lst in lists
                set listName to name of lst
                repeat with rmndr in reminders of lst
                    if name of rmndr contains searchText then
                        set isCompleted to completed of rmndr
                        if isCompleted then
                            set status to "✓"
                        else
                            set status to "○"
                        end if
                        set reminderInfo to status & " " & (name of rmndr) & " (" & listName & ")"
                        set end of foundReminders to reminderInfo
                    end if
                end repeat
            end repeat
            
            return foundReminders
        end tell
        '''
        
        output = self.executor.run_applescript(script)
        return output.split(", ") if output else []
    
    def create(self, name: str, list_name: str = "Reminders", days_from_now: int = 1) -> str:
        """Create a reminder."""
        script = f'''
        tell application "Reminders"
            activate
            set targetList to list "{list_name}"
            set dueDate to (current date) + ({days_from_now} * days)
            
            tell targetList
                set newReminder to make new reminder with properties {{name:"{name}", body:"Created via AppleCLI", due date:dueDate}}
            end tell
            
            return "Created reminder: {name}"
        end tell
        '''.replace('{{', '{').replace('}}', '}')
        
        
        return self.executor.run_applescript(script)


class MapsManager:
    """Manage Maps app operations."""
    
    def __init__(self, executor: AppleScriptExecutor):
        self.executor = executor
    
    def search(self, location: str) -> str:
        """Search for a location in Maps."""
        # URL encode the location
        encoded_location = urllib.parse.quote(location)
        
        script = f'''
        const app = Application.currentApplication();
        app.includeStandardAdditions = true;
        app.doShellScript("open \\"maps://?q={encoded_location}\\"");
        "Opening Maps with search for: {location}";
        '''
        
        return self.executor.run_applescript(script, use_javascript=True)
    
    def directions(self, from_addr: str, to_addr: str) -> str:
        """Get directions between two locations."""
        encoded_from = urllib.parse.quote(from_addr)
        encoded_to = urllib.parse.quote(to_addr)
        
        script = f'''
        const app = Application.currentApplication();
        app.includeStandardAdditions = true;
        app.doShellScript("open \\"maps://?saddr={encoded_from}&daddr={encoded_to}\\"");
        "Opening directions from {from_addr} to {to_addr}";
        '''
        
        return self.executor.run_applescript(script, use_javascript=True)


class WebSearchManager:
    """Manage web search operations."""
    
    @staticmethod
    def search(query: str, num_results: int = 5) -> List[Dict]:
        """Search DuckDuckGo and return results."""
        url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}'
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate'
        }
        
        req = urllib.request.Request(url, headers=headers)
        
        try:
            with urllib.request.urlopen(req) as response:
                if response.info().get('Content-Encoding') == 'gzip':
                    html = gzip.decompress(response.read()).decode('utf-8')
                else:
                    html = response.read().decode('utf-8')
                
                results = []
                result_blocks = re.findall(
                    r'<div[^>]*class="result[^"]*"[^>]*>.*?</div>\s*</div>', 
                    html, 
                    re.DOTALL
                )
                
                for block in result_blocks[:num_results]:
                    title_match = re.search(r'class="result__title"[^>]*>.*?<a[^>]*>(.*?)</a>', block, re.DOTALL)
                    title = unescape(re.sub('<[^>]+>', '', title_match.group(1))) if title_match else ''
                    
                    url_match = re.search(r'href="//duckduckgo.com/l/\?uddg=([^"&]+)', block)
                    result_url = urllib.parse.unquote(url_match.group(1)) if url_match else ''
                    
                    if title and result_url:
                        results.append({
                            'title': title.strip(),
                            'url': result_url
                        })
                
                return results
        except Exception as e:
            raise Exception(f"Search failed: {e}")


class OutputFormatter:
    """Format output in different styles."""
    
    @staticmethod
    def format(data: Any, format_type: str = "plain") -> str:
        """Format data based on type."""
        if format_type == "json":
            return json.dumps(data, indent=2)
        elif format_type == "table":
            return OutputFormatter._to_table(data)
        else:  # plain
            return OutputFormatter._to_plain(data)
    
    @staticmethod
    def _to_plain(data: Any) -> str:
        """Convert to plain text format."""
        if isinstance(data, list):
            if not data:
                return "No results found"
            
            output = []
            for i, item in enumerate(data, 1):
                if isinstance(item, dict):
                    output.append(f"\n{i}. " + "\n   ".join(f"{k}: {v}" for k, v in item.items()))
                else:
                    output.append(f"{i}. {item}")
            return "\n".join(output)
        elif isinstance(data, dict):
            return "\n".join(f"{k}: {v}" for k, v in data.items())
        else:
            return str(data)
    
    @staticmethod
    def _to_table(data: Any) -> str:
        """Convert to simple table format."""
        if not isinstance(data, list) or not data:
            return OutputFormatter._to_plain(data)
        
        if not isinstance(data[0], dict):
            return OutputFormatter._to_plain(data)
        
        # Get all keys
        keys = list(data[0].keys())
        
        # Calculate column widths
        widths = {key: max(len(str(key)), max(len(str(item.get(key, ""))) for item in data)) for key in keys}
        
        # Build table
        lines = []
        
        # Header
        header = " | ".join(str(key).ljust(widths[key]) for key in keys)
        lines.append(header)
        lines.append("-" * len(header))
        
        # Rows
        for item in data:
            row = " | ".join(str(item.get(key, "")).ljust(widths[key]) for key in keys)
            lines.append(row)
        
        return "\n".join(lines)


class TaskWorkflowManager:
    """
    Task-centric workflow management with AppleScript integration.
    Provides draft sending patterns, calendar integration, and colleague tracking.
    """
    
    def __init__(self, executor: AppleScriptExecutor):
        self.executor = executor
        self.mail_manager = MailManager(executor)
        self.calendar_manager = CalendarManager(executor)
        self.contacts_manager = ContactsManager(executor)
        
        # Initialize database connection for task integration
        try:
            from sqlalchemy import create_engine, text
            from sqlalchemy.orm import sessionmaker
            self.engine = create_engine("sqlite:///email_intelligence.db", echo=False)
            self.Session = sessionmaker(bind=self.engine)
            self.db_available = True
        except ImportError:
            self.db_available = False
            print("⚠️  Database features unavailable - install SQLAlchemy for full task integration")
    
    def generate_task_reply_draft(self, task_id: str, reply_type: str = "status_update") -> Dict[str, Any]:
        """Generate pre-populated reply draft for task-related communications."""
        if not self.db_available:
            return {"error": "Database unavailable"}
        
        try:
            with self.Session() as session:
                # Get task details with email context
                result = session.execute(text("""
                    SELECT 
                        et.task_id, et.subject, et.status, et.priority, et.assignee,
                        et.due_date, et.description,
                        e.subject_text as email_subject, e.sender_email, e.sender_name,
                        e.to_addresses, e.cc_addresses, e.date_received
                    FROM email_tasks et
                    JOIN emails e ON et.email_id = e.id
                    WHERE et.task_id = :task_id
                """), {"task_id": task_id})
                
                task_row = result.fetchone()
                if not task_row:
                    return {"error": f"Task {task_id} not found"}
                
                # Prepare reply content based on type
                reply_templates = {
                    "status_update": self._generate_status_update_reply,
                    "completion": self._generate_completion_reply,
                    "delegation": self._generate_delegation_reply,
                    "follow_up": self._generate_follow_up_reply
                }
                
                if reply_type not in reply_templates:
                    return {"error": f"Unknown reply type: {reply_type}"}
                
                reply_content = reply_templates[reply_type](task_row)
                
                # Create draft using AppleScript
                draft_script = f'''
                tell application "Mail"
                    activate
                    set newMessage to make new outgoing message with properties {{
                        subject: "{reply_content['subject']}",
                        content: "{reply_content['body']}",
                        visible: true
                    }}
                    
                    tell newMessage
                        make new to recipient with properties {{address: "{task_row.sender_email}"}}
                    end tell
                    
                    return id of newMessage
                end tell
                '''
                
                draft_id = self.executor.run_applescript(draft_script)
                
                return {
                    "success": True,
                    "draft_id": draft_id,
                    "task_id": task_id,
                    "reply_type": reply_type,
                    "subject": reply_content['subject'],
                    "recipient": task_row.sender_email
                }
                
        except Exception as e:
            return {"error": str(e)}
    
    def _generate_status_update_reply(self, task_row) -> Dict[str, str]:
        """Generate status update reply content."""
        status_messages = {
            "pending": "I've received your request and will get started on this shortly.",
            "in-progress": "I'm currently working on this and making good progress.",
            "completed": "I've completed this task as requested.",
            "cancelled": "This task has been cancelled due to changing priorities."
        }
        
        subject = f"Re: {task_row.email_subject} - Task Update"
        
        body = f"""Hi {task_row.sender_name or 'there'},

{status_messages.get(task_row.status, 'I wanted to update you on the status of this task.')"}

Task: {task_row.subject}
Status: {task_row.status.title()}
Priority: {task_row.priority}"""

        if task_row.due_date:
            body += f"\nDue Date: {task_row.due_date}"
        
        if task_row.status == "completed":
            body += "\n\nPlease let me know if you need any additional information or have follow-up questions."
        elif task_row.status == "in-progress":
            body += "\n\nI'll keep you updated as I make progress. Please let me know if you have any questions or changes."
        
        body += "\n\nBest regards"
        
        return {"subject": subject, "body": body}
    
    def _generate_completion_reply(self, task_row) -> Dict[str, str]:
        """Generate task completion notification."""
        subject = f"✅ Completed: {task_row.subject}"
        
        body = f"""Hi {task_row.sender_name or 'there'},

I'm pleased to inform you that the following task has been completed:

Task: {task_row.subject}
Completed: {datetime.now().strftime('%Y-%m-%d %H:%M')}
Priority: {task_row.priority}

{task_row.description if task_row.description else ''}

The work has been completed as requested. Please review and let me know if you need any adjustments or have follow-up requirements.

Best regards"""
        
        return {"subject": subject, "body": body}
    
    def _generate_delegation_reply(self, task_row) -> Dict[str, str]:
        """Generate task delegation forward."""
        subject = f"Task Delegation: {task_row.subject}"
        
        body = f"""Hi,

I'm forwarding this task for your attention and action:

Original Task: {task_row.subject}
Priority: {task_row.priority}
Original Requester: {task_row.sender_name} ({task_row.sender_email})"""

        if task_row.due_date:
            body += f"\nDue Date: {task_row.due_date}"
        
        body += f"""

Task Details:
{task_row.description if task_row.description else 'See original email below for context.'}

Please confirm receipt and expected completion timeline.

Best regards"""
        
        return {"subject": subject, "body": body}
    
    def _generate_follow_up_reply(self, task_row) -> Dict[str, str]:
        """Generate follow-up inquiry."""
        subject = f"Follow-up: {task_row.subject}"
        
        days_since = (datetime.now() - datetime.fromisoformat(task_row.date_received.replace('Z', '+00:00'))).days
        
        body = f"""Hi {task_row.sender_name or 'there'},

I wanted to follow up on the task we discussed {days_since} days ago:

Task: {task_row.subject}
Current Status: {task_row.status.title()}
Priority: {task_row.priority}"""

        if task_row.due_date:
            due_date = datetime.fromisoformat(task_row.due_date.replace('Z', '+00:00'))
            if due_date < datetime.now():
                body += f"\nDue Date: {task_row.due_date} (OVERDUE)"
            else:
                body += f"\nDue Date: {task_row.due_date}"
        
        body += "\n\nCould you please provide an update on the current status or let me know if you need any assistance?\n\nThanks!"
        
        return {"subject": subject, "body": body}
    
    def schedule_task_follow_up(self, task_id: str, follow_up_date: str) -> Dict[str, Any]:
        """Schedule calendar reminder for task follow-up."""
        try:
            if not self.db_available:
                return {"error": "Database unavailable"}
            
            with self.Session() as session:
                # Get task details
                result = session.execute(text("""
                    SELECT et.subject, et.assignee, et.due_date, e.sender_email, e.sender_name
                    FROM email_tasks et
                    JOIN emails e ON et.email_id = e.id
                    WHERE et.task_id = :task_id
                """), {"task_id": task_id})
                
                task_row = result.fetchone()
                if not task_row:
                    return {"error": f"Task {task_id} not found"}
            
            # Create calendar event for follow-up
            calendar_script = f'''
            tell application "Calendar"
                activate
                set followUpDate to date "{follow_up_date}"
                set newEvent to make new event at calendar "Tasks" with properties {{
                    summary: "Follow up: {task_row.subject}",
                    start date: followUpDate,
                    end date: followUpDate + 1 * hours,
                    description: "Follow up on task {task_id} with {task_row.sender_name} ({task_row.sender_email})"
                }}
                return id of newEvent
            end tell
            '''
            
            event_id = self.executor.run_applescript(calendar_script)
            
            return {
                "success": True,
                "event_id": event_id,
                "task_id": task_id,
                "follow_up_date": follow_up_date,
                "task_subject": task_row.subject
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def get_colleague_contact_info(self, email: str) -> Dict[str, Any]:
        """Get colleague contact information for task assignment."""
        try:
            contacts = self.contacts_manager.search(email)
            
            if not contacts:
                # Try searching by email in database
                if self.db_available:
                    with self.Session() as session:
                        result = session.execute(text("""
                            SELECT DISTINCT sender_name, sender_email, COUNT(*) as email_count
                            FROM emails 
                            WHERE sender_email = :email
                            GROUP BY sender_email, sender_name
                        """), {"email": email})
                        
                        db_contact = result.fetchone()
                        if db_contact:
                            return {
                                "name": db_contact.sender_name,
                                "email": db_contact.sender_email,
                                "email_count": db_contact.email_count,
                                "source": "email_database"
                            }
                
                return {"error": f"No contact found for {email}"}
            
            contact = contacts[0]  # Get first match
            return {
                "name": contact['name'],
                "emails": contact['emails'],
                "phones": contact.get('phones', []),
                "source": "contacts_app"
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def create_task_delegation_email(self, task_id: str, delegate_email: str, 
                                   message: str = "") -> Dict[str, Any]:
        """Create delegation email with task context."""
        try:
            if not self.db_available:
                return {"error": "Database unavailable"}
            
            with self.Session() as session:
                # Get task and original email details
                result = session.execute(text("""
                    SELECT 
                        et.task_id, et.subject, et.description, et.priority, et.due_date,
                        e.subject_text, e.sender_email, e.sender_name, e.full_content
                    FROM email_tasks et
                    JOIN emails e ON et.email_id = e.id
                    WHERE et.task_id = :task_id
                """), {"task_id": task_id})
                
                task_row = result.fetchone()
                if not task_row:
                    return {"error": f"Task {task_id} not found"}
                
                # Get colleague info
                colleague_info = self.get_colleague_contact_info(delegate_email)
                colleague_name = colleague_info.get('name', delegate_email.split('@')[0])
                
                # Create delegation email
                subject = f"Task Assignment: {task_row.subject}"
                
                body = f"""Hi {colleague_name},

I'm assigning the following task to you:

Task: {task_row.subject}
Priority: {task_row.priority}
Original Requester: {task_row.sender_name} ({task_row.sender_email})"""

                if task_row.due_date:
                    body += f"\nDue Date: {task_row.due_date}"
                
                if message:
                    body += f"\n\nAdditional Notes:\n{message}"
                
                body += f"""

Task Description:
{task_row.description}

Original Email Context:
{task_row.full_content[:500] if task_row.full_content else 'See forwarded email for full context.'}

Please confirm receipt and let me know your expected completion timeline.

Best regards"""
                
                # Create email draft
                draft_script = f'''
                tell application "Mail"
                    activate
                    set newMessage to make new outgoing message with properties {{
                        subject: "{subject}",
                        content: "{body}",
                        visible: true
                    }}
                    
                    tell newMessage
                        make new to recipient with properties {{address: "{delegate_email}"}}
                        make new cc recipient with properties {{address: "{task_row.sender_email}"}}
                    end tell
                    
                    return id of newMessage
                end tell
                '''
                
                draft_id = self.executor.run_applescript(draft_script)
                
                # Update task assignee in database
                session.execute(text("""
                    UPDATE email_tasks 
                    SET assignee = :assignee, updated_at = datetime('now')
                    WHERE task_id = :task_id
                """), {"assignee": delegate_email, "task_id": task_id})
                session.commit()
                
                return {
                    "success": True,
                    "draft_id": draft_id,
                    "task_id": task_id,
                    "delegate_email": delegate_email,
                    "subject": subject
                }
                
        except Exception as e:
            return {"error": str(e)}


class AppleCLI:
    """Main CLI application."""
    
    def __init__(self):
        self.executor = AppleScriptExecutor()
        self.contacts = ContactsManager(self.executor)
        self.notes = NotesManager(self.executor)
        self.messages = MessagesManager(self.executor)
        self.mail = MailManager(self.executor)
        self.calendar = CalendarManager(self.executor)
        self.reminders = RemindersManager(self.executor)
        self.maps = MapsManager(self.executor)
        self.web = WebSearchManager()
        self.formatter = OutputFormatter()
        
        # Initialize task workflow manager
        try:
            self.task_workflows = TaskWorkflowManager(self.executor)
        except Exception as e:
            print(f"⚠️  Task workflow features unavailable: {e}")
            self.task_workflows = None
    
    def create_parser(self) -> argparse.ArgumentParser:
        """Create argument parser."""
        parser = argparse.ArgumentParser(
            description="AppleCLI - Control macOS apps from the command line",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  # Contacts
  %(prog)s --contacts --action list --limit 5
  %(prog)s --contacts --action search --query "John"
  %(prog)s --contacts --action search --query "^J.*" --regex
  
  # Notes
  %(prog)s --notes --action list
  %(prog)s --notes --action search --query "meeting"
  %(prog)s --notes --action create --title "Shopping" --body "Buy milk"
  
  # Messages
  %(prog)s --messages --action read --limit 10
  %(prog)s --messages --action send --phone "+1234567890" --text "Hello!"
  
  # Mail
  %(prog)s --mail --action unread
  %(prog)s --mail --action recent --limit 5
  %(prog)s --mail --action last-week
  %(prog)s --mail --action needs-reply
  %(prog)s --mail --action summary
  %(prog)s --mail --action from-sender --sender "john@example.com"
  %(prog)s --mail --action date-range --start-date "01/01/2025" --end-date "01/10/2025"
  %(prog)s --mail --action search --query "invoice"
  %(prog)s --mail --action flag --subject "Important Meeting"
  %(prog)s --mail --action reply-draft --subject "Meeting" --reply-body "I'll be there"
  %(prog)s --mail --action compose --to "user@example.com" --subject "Test" --body "Content"
  
  # Calendar
  %(prog)s --calendar --action today
  %(prog)s --calendar --action search --query "meeting"
  %(prog)s --calendar --action create --title "Team Standup"
  
  # Reminders
  %(prog)s --reminders --action list
  %(prog)s --reminders --action search --query "buy"
  %(prog)s --reminders --action create --title "Buy groceries"
  
  # Maps
  %(prog)s --maps --action search --location "Apple Park"
  %(prog)s --maps --action directions --from "San Francisco" --to "San Jose"
  
  # Web Search
  %(prog)s --web --action search --query "Python programming"
            """)
        
        # App selection
        app_group = parser.add_mutually_exclusive_group(required=True)
        app_group.add_argument('--contacts', action='store_true', help='Manage Contacts')
        app_group.add_argument('--notes', action='store_true', help='Manage Notes')
        app_group.add_argument('--messages', action='store_true', help='Manage Messages')
        app_group.add_argument('--mail', action='store_true', help='Manage Mail')
        app_group.add_argument('--calendar', action='store_true', help='Manage Calendar')
        app_group.add_argument('--reminders', action='store_true', help='Manage Reminders')
        app_group.add_argument('--maps', action='store_true', help='Use Maps')
        app_group.add_argument('--web', action='store_true', help='Web Search')
        app_group.add_argument('--task-workflows', action='store_true', help='Task workflow management')
        
        # Actions
        parser.add_argument('--action', required=True, 
                          choices=['list', 'search', 'create', 'read', 'send', 
                                  'unread', 'compose', 'today', 'directions', 'count',
                                  'recent', 'last-week', 'needs-reply', 'reply-draft',
                                  'summary', 'flag', 'from-sender', 'date-range', 
                                  'add-to-reminders', 'reply', 'delegate', 'followup',
                                  'complete', 'colleague-info'],
                          help='Action to perform')
        
        # Common parameters
        parser.add_argument('--query', help='Search query')
        parser.add_argument('--regex', action='store_true', help='Use regex for search')
        parser.add_argument('--limit', type=int, default=10, help='Limit results')
        parser.add_argument('--format', choices=['plain', 'json', 'table'], 
                          default='plain', help='Output format')
        
        # Content parameters
        parser.add_argument('--title', help='Title/name for creation')
        parser.add_argument('--body', help='Body/content for creation')
        parser.add_argument('--text', help='Text content for messages')
        
        # Contact parameters
        parser.add_argument('--phone', help='Phone number')
        parser.add_argument('--to', help='Email recipient')
        parser.add_argument('--cc', help='Email CC recipient')
        parser.add_argument('--subject', help='Email subject')
        
        # Location parameters
        parser.add_argument('--location', help='Location for Maps')
        parser.add_argument('--from', dest='from_addr', help='Starting location')
        parser.add_argument('--to-addr', dest='to_addr', help='Destination location')
        
        # List/folder parameters
        parser.add_argument('--list-name', help='Reminders list name')
        parser.add_argument('--folder', help='Notes folder name')
        parser.add_argument('--calendar-name', default='Home', help='Calendar name')
        
        # Time parameters
        parser.add_argument('--days', type=int, default=1, help='Days from now')
        parser.add_argument('--hours', type=int, default=24, help='Hours from now')
        
        # Flags
        parser.add_argument('--incomplete', action='store_true', 
                          help='Show only incomplete reminders')
        
        # Enhanced Mail parameters
        parser.add_argument('--sender', help='Email sender for filtering')
        parser.add_argument('--start-date', help='Start date for email range (MM/DD/YYYY)')
        parser.add_argument('--end-date', help='End date for email range (MM/DD/YYYY)')
        parser.add_argument('--mailbox', default='INBOX', help='Mailbox to search (default: INBOX)')
        parser.add_argument('--reply-body', help='Body text for reply draft')
        parser.add_argument('--flag-status', action='store_true', help='Flag emails as important')
        
        # Task workflow arguments
        parser.add_argument('--task-id', help='Task ID for workflow operations')
        parser.add_argument('--reply-type', choices=['status_update', 'completion', 'delegation', 'follow_up'],
                          default='status_update', help='Type of task reply to generate')
        parser.add_argument('--delegate-email', help='Email address to delegate task to')
        parser.add_argument('--follow-up-date', help='Date for follow-up reminder (YYYY-MM-DD)')
        parser.add_argument('--email', help='Email address for colleague information lookup')
        
        return parser
    
    def run(self, args):
        """Execute the requested action."""
        try:
            result = None
            
            # Contacts
            if args.contacts:
                if args.action == 'list':
                    result = self.contacts.list_all(args.limit)
                elif args.action == 'search':
                    if not args.query:
                        raise ValueError("--query required for search")
                    result = self.contacts.search(args.query, args.regex)
                elif args.action == 'count':
                    result = f"Total contacts: {self.contacts.count()}"
                else:
                    raise ValueError(f"Invalid action for contacts: {args.action}")
            
            # Notes
            elif args.notes:
                if args.action == 'list':
                    result = self.notes.list_all(args.limit)
                elif args.action == 'search':
                    if not args.query:
                        raise ValueError("--query required for search")
                    result = self.notes.search(args.query)
                elif args.action == 'create':
                    if not args.title or not args.body:
                        raise ValueError("--title and --body required for creation")
                    folder = args.folder or "Notes"
                    result = self.notes.create(args.title, args.body, folder)
                else:
                    raise ValueError(f"Invalid action for notes: {args.action}")
            
            # Messages
            elif args.messages:
                if args.action == 'read':
                    result = self.messages.read_from_db(args.phone, args.limit)
                elif args.action == 'send':
                    if not args.phone or not args.text:
                        raise ValueError("--phone and --text required for sending")
                    result = self.messages.send(args.phone, args.text)
                elif args.action == 'list':
                    result = self.messages.get_chats(args.limit)
                else:
                    raise ValueError(f"Invalid action for messages: {args.action}")
            
            # Mail
            elif args.mail:
                if args.action == 'unread':
                    result = self.mail.get_unread()
                elif args.action == 'recent':
                    result = self.mail.get_recent(args.limit, args.mailbox)
                elif args.action == 'last-week':
                    result = self.mail.get_last_week(args.limit)
                elif args.action == 'needs-reply':
                    result = self.mail.get_needs_reply(args.limit)
                elif args.action == 'from-sender':
                    if not args.sender:
                        raise ValueError("--sender required for from-sender action")
                    result = self.mail.get_from_sender(args.sender, args.limit)
                elif args.action == 'date-range':
                    if not args.start_date or not args.end_date:
                        raise ValueError("--start-date and --end-date required for date-range")
                    result = self.mail.get_date_range(args.start_date, args.end_date, args.limit)
                elif args.action == 'summary':
                    result = self.mail.get_inbox_summary()
                elif args.action == 'reply-draft':
                    if not args.subject or not args.reply_body:
                        raise ValueError("--subject and --reply-body required for reply-draft")
                    result = self.mail.create_reply_draft(args.subject, args.reply_body)
                elif args.action == 'flag':
                    if not args.subject:
                        raise ValueError("--subject required for flag action")
                    result = self.mail.flag_email(args.subject, args.flag_status)
                elif args.action == 'add-to-reminders':
                    if not args.subject:
                        raise ValueError("--subject required for add-to-reminders")
                    list_name = args.list_name or "Reminders"
                    result = self.mail.add_email_to_reminders(args.subject, list_name)
                elif args.action == 'search':
                    if not args.query:
                        raise ValueError("--query required for search")
                    result = self.mail.search(args.query, args.limit)
                elif args.action == 'compose':
                    if not args.to or not args.subject or not args.body:
                        raise ValueError("--to, --subject, and --body required for compose")
                    result = self.mail.compose(args.to, args.subject, args.body, args.cc)
                else:
                    raise ValueError(f"Invalid action for mail: {args.action}")
            
            # Calendar
            elif args.calendar:
                if args.action == 'today':
                    result = self.calendar.get_today_events()
                elif args.action == 'search':
                    if not args.query:
                        raise ValueError("--query required for search")
                    result = self.calendar.search(args.query, args.days)
                elif args.action == 'create':
                    if not args.title:
                        raise ValueError("--title required for creation")
                    result = self.calendar.create_event(args.title, args.calendar_name, args.hours)
                else:
                    raise ValueError(f"Invalid action for calendar: {args.action}")
            
            # Reminders
            elif args.reminders:
                if args.action == 'list':
                    result = self.reminders.list_all(args.list_name, args.incomplete)
                elif args.action == 'search':
                    if not args.query:
                        raise ValueError("--query required for search")
                    result = self.reminders.search(args.query)
                elif args.action == 'create':
                    if not args.title:
                        raise ValueError("--title required for creation")
                    list_name = args.list_name or "Reminders"
                    result = self.reminders.create(args.title, list_name, args.days)
                else:
                    raise ValueError(f"Invalid action for reminders: {args.action}")
            
            # Maps
            elif args.maps:
                if args.action == 'search':
                    if not args.location:
                        raise ValueError("--location required for search")
                    result = self.maps.search(args.location)
                elif args.action == 'directions':
                    if not args.from_addr or not args.to_addr:
                        raise ValueError("--from and --to-addr required for directions")
                    result = self.maps.directions(args.from_addr, args.to_addr)
                else:
                    raise ValueError(f"Invalid action for maps: {args.action}")
            
            # Web Search
            elif args.web:
                if args.action == 'search':
                    if not args.query:
                        raise ValueError("--query required for search")
                    result = self.web.search(args.query, args.limit)
                else:
                    raise ValueError(f"Invalid action for web: {args.action}")
            
            elif args.task_workflows:
                # Handle task workflow actions
                if args.action == 'reply':
                    if not args.task_id:
                        raise ValueError("--task-id required for reply action")
                    self.handle_task_reply(args)
                    return  # These methods handle their own output
                
                elif args.action == 'delegate':
                    if not args.task_id or not args.delegate_email:
                        raise ValueError("--task-id and --delegate-email required for delegate action")
                    self.handle_task_delegate(args)
                    return
                
                elif args.action == 'followup':
                    if not args.task_id:
                        raise ValueError("--task-id required for followup action")
                    self.handle_task_followup(args)
                    return
                
                elif args.action == 'complete':
                    if not args.task_id:
                        raise ValueError("--task-id required for complete action")
                    self.handle_task_complete(args)
                    return
                
                elif args.action == 'colleague-info':
                    if not args.email:
                        raise ValueError("--email required for colleague-info action")
                    self.handle_colleague_info(args)
                    return
                
                else:
                    raise ValueError(f"Invalid action for task-workflows: {args.action}")
            
            # Format and print output
            if result is not None:
                print(self.formatter.format(result, args.format))
            
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
    
    def handle_task_reply(self, args):
        """Handle task-reply command."""
        if not self.task_workflows:
            print("❌ Task workflow features not available")
            return
        
        try:
            result = self.task_workflows.generate_task_reply_draft(
                task_id=args.task_id,
                reply_type=args.reply_type
            )
            
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
            else:
                print(f"✅ Task reply draft created successfully!")
                print(f"📧 Draft ID: {result['draft_id']}")
                print(f"📋 Task: {result['task_id']}")
                print(f"📝 Type: {result['reply_type']}")
                print(f"📬 Recipient: {result['recipient']}")
                print(f"📄 Subject: {result['subject']}")
                print("\n📝 Draft has been created in Mail.app - review and send when ready.")
                
        except Exception as e:
            print(f"❌ Error creating task reply: {e}")
    
    def handle_task_delegate(self, args):
        """Handle task-delegate command."""
        if not self.task_workflows:
            print("❌ Task workflow features not available")
            return
        
        try:
            result = self.task_workflows.create_task_delegation_email(
                task_id=args.task_id,
                delegate_email=args.delegate_email,
                message=args.message or ""
            )
            
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
            else:
                print(f"✅ Task delegation email created successfully!")
                print(f"📧 Draft ID: {result['draft_id']}")
                print(f"📋 Task: {result['task_id']}")
                print(f"👤 Delegate: {result['delegate_email']}")
                print(f"📄 Subject: {result['subject']}")
                print("\n📝 Delegation email drafted in Mail.app with original requester CC'd.")
                print("📤 Review and send when ready.")
                
        except Exception as e:
            print(f"❌ Error creating delegation email: {e}")
    
    def handle_task_followup(self, args):
        """Handle task-followup command."""
        if not self.task_workflows:
            print("❌ Task workflow features not available")
            return
        
        try:
            # Create follow-up email draft
            reply_result = self.task_workflows.generate_task_reply_draft(
                task_id=args.task_id,
                reply_type="follow_up"
            )
            
            if 'error' in reply_result:
                print(f"❌ Error creating follow-up email: {reply_result['error']}")
                return
            
            # Schedule calendar reminder if date provided
            calendar_result = None
            if args.follow_up_date:
                calendar_result = self.task_workflows.schedule_task_follow_up(
                    task_id=args.task_id,
                    follow_up_date=args.follow_up_date
                )
            
            print(f"✅ Task follow-up created successfully!")
            print(f"📧 Draft ID: {reply_result['draft_id']}")
            print(f"📋 Task: {args.task_id}")
            print(f"📬 Recipient: {reply_result['recipient']}")
            
            if calendar_result and 'error' not in calendar_result:
                print(f"📅 Calendar reminder scheduled for: {args.follow_up_date}")
                print(f"🗓️  Event ID: {calendar_result['event_id']}")
            elif args.follow_up_date:
                print(f"⚠️  Could not schedule calendar reminder: {calendar_result.get('error', 'Unknown error')}")
            
            print("\n📝 Follow-up email drafted in Mail.app - review and send when ready.")
                
        except Exception as e:
            print(f"❌ Error creating follow-up: {e}")
    
    def handle_task_complete(self, args):
        """Handle task-complete command."""
        if not self.task_workflows:
            print("❌ Task workflow features not available")
            return
        
        try:
            result = self.task_workflows.generate_task_reply_draft(
                task_id=args.task_id,
                reply_type="completion"
            )
            
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
            else:
                print(f"✅ Task completion notification created!")
                print(f"📧 Draft ID: {result['draft_id']}")
                print(f"📋 Task: {result['task_id']}")
                print(f"📬 Recipient: {result['recipient']}")
                print(f"📄 Subject: {result['subject']}")
                print("\n🎉 Completion notification drafted in Mail.app.")
                print("📤 Review and send to notify task completion.")
                
        except Exception as e:
            print(f"❌ Error creating completion notification: {e}")
    
    def handle_colleague_info(self, args):
        """Handle colleague-info command."""
        if not self.task_workflows:
            print("❌ Task workflow features not available")
            return
        
        try:
            result = self.task_workflows.get_colleague_contact_info(args.email)
            
            if 'error' in result:
                print(f"❌ Error: {result['error']}")
            else:
                print(f"\n👤 Colleague Information: {args.email}")
                print("=" * 60)
                print(f"📛 Name: {result['name']}")
                
                if result['source'] == 'contacts_app':
                    print(f"📧 Emails: {', '.join(result['emails'])}")
                    if result['phones']:
                        print(f"📞 Phones: {', '.join(result['phones'])}")
                    print(f"📍 Source: Contacts App")
                elif result['source'] == 'email_database':
                    print(f"📧 Email: {result['email']}")
                    print(f"📊 Email History: {result['email_count']} emails")
                    print(f"📍 Source: Email Database")
                
        except Exception as e:
            print(f"❌ Error getting colleague info: {e}")


def main():
    """Main entry point."""
    cli = AppleCLI()
    parser = cli.create_parser()
    args = parser.parse_args()
    cli.run(args)


if __name__ == "__main__":
    main()