#!/usr/bin/env python3
"""
Simple email fetcher that gets emails from Mail app and stores them with full content.
"""

import subprocess
import sqlite3
import json
import re
from datetime import datetime, timedelta
import os


def fetch_emails_simple():
    """Fetch emails using a simple AppleScript."""
    
    script = '''
    tell application "Mail"
        activate
        set outputList to {}
        set emailCounter to 0
        set maxEmails to 200
        
        -- Get emails from all inboxes
        repeat with eachAccount in accounts
            set accountName to name of eachAccount
            
            repeat with eachMailbox in mailboxes of eachAccount
                try
                    if name of eachMailbox contains "INBOX" or name of eachMailbox contains "Sent" then
                        set messageList to messages of eachMailbox
                        
                        repeat with i from 1 to count of messageList
                            if emailCounter < maxEmails then
                                set eachMessage to item i of messageList
                                
                                -- Get basic info
                                set messageSubject to subject of eachMessage
                                set messageSender to sender of eachMessage
                                set messageDate to (date received of eachMessage) as string
                                set messageRead to read status of eachMessage
                                set messageFlagged to flagged status of eachMessage
                                
                                -- Get content (may be slow)
                                set messageContent to ""
                                try
                                    set messageContent to content of eachMessage
                                    if length of messageContent > 10000 then
                                        set messageContent to text 1 thru 10000 of messageContent
                                    end if
                                on error
                                    set messageContent to "(Content not available)"
                                end try
                                
                                -- Build output string
                                set emailInfo to "==EMAIL==" & return
                                set emailInfo to emailInfo & "SUBJECT: " & messageSubject & return
                                set emailInfo to emailInfo & "FROM: " & messageSender & return
                                set emailInfo to emailInfo & "DATE: " & messageDate & return
                                set emailInfo to emailInfo & "READ: " & messageRead & return
                                set emailInfo to emailInfo & "FLAGGED: " & messageFlagged & return
                                set emailInfo to emailInfo & "MAILBOX: " & (name of eachMailbox) & return
                                set emailInfo to emailInfo & "ACCOUNT: " & accountName & return
                                set emailInfo to emailInfo & "CONTENT:" & return
                                set emailInfo to emailInfo & messageContent & return
                                set emailInfo to emailInfo & "==END==" & return & return
                                
                                set end of outputList to emailInfo
                                set emailCounter to emailCounter + 1
                                
                                if emailCounter mod 10 = 0 then
                                    log "Processed " & emailCounter & " emails"
                                end if
                            else
                                exit repeat
                            end if
                        end repeat
                    end if
                on error errMsg
                    log "Error with mailbox: " & errMsg
                end try
            end repeat
        end repeat
        
        log "Total emails: " & emailCounter
        
        -- Convert list to string
        set AppleScript's text item delimiters to ""
        set outputString to outputList as string
        return outputString
    end tell
    '''
    
    print("📧 Fetching emails from Mail app...")
    result = subprocess.run(['osascript', '-e', script], 
                          capture_output=True, text=True, timeout=300)
    
    if result.returncode != 0:
        print(f"Error: {result.stderr}")
        return []
    
    # Parse output
    emails = []
    email_blocks = result.stdout.split("==EMAIL==")
    
    for block in email_blocks:
        if "==END==" in block:
            email = {}
            lines = block.split("\n")
            content_started = False
            content_lines = []
            
            for line in lines:
                if line == "==END==":
                    break
                elif content_started:
                    content_lines.append(line)
                elif line.startswith("CONTENT:"):
                    content_started = True
                elif ": " in line:
                    key, value = line.split(": ", 1)
                    email[key.lower()] = value
            
            if content_lines:
                email['content'] = "\n".join(content_lines)
            
            if email:
                emails.append(email)
    
    return emails


def save_to_database(emails):
    """Save emails to SQLite database."""
    
    conn = sqlite3.connect('emails_simple.db')
    cursor = conn.cursor()
    
    # Create table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            subject TEXT,
            sender TEXT,
            date_string TEXT,
            content TEXT,
            mailbox TEXT,
            account TEXT,
            is_read BOOLEAN,
            is_flagged BOOLEAN,
            requires_reply BOOLEAN,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert emails
    for email in emails:
        # Check if needs reply
        content_lower = email.get('content', '').lower()
        subject_lower = email.get('subject', '').lower()
        sender_lower = email.get('from', '').lower()
        
        requires_reply = False
        if 'no-reply' not in sender_lower and 'noreply' not in sender_lower:
            reply_keywords = ['please reply', 'let me know', 'your thoughts', 
                            'can you', 'could you', 'urgent', '?']
            for keyword in reply_keywords:
                if keyword in subject_lower or keyword in content_lower[:500]:
                    requires_reply = True
                    break
        
        cursor.execute('''
            INSERT INTO emails (subject, sender, date_string, content, 
                              mailbox, account, is_read, is_flagged, requires_reply)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            email.get('subject', ''),
            email.get('from', ''),
            email.get('date', ''),
            email.get('content', ''),
            email.get('mailbox', ''),
            email.get('account', ''),
            email.get('read', '').lower() == 'true',
            email.get('flagged', '').lower() == 'true',
            requires_reply
        ))
    
    conn.commit()
    return cursor.lastrowid


def export_to_markdown(db_path='emails_simple.db', output_dir='myemails'):
    """Export database to markdown files."""
    
    os.makedirs(output_dir, exist_ok=True)
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get all emails
    emails = cursor.execute('SELECT * FROM emails ORDER BY id DESC').fetchall()
    
    # Create index
    index_path = os.path.join(output_dir, 'EMAIL_DATABASE.md')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write('# Email Database\n\n')
        f.write(f'**Total Emails**: {len(emails)}\n')
        f.write(f'**Generated**: {datetime.now()}\n\n')
        
        # Statistics
        unread = cursor.execute('SELECT COUNT(*) FROM emails WHERE is_read = 0').fetchone()[0]
        flagged = cursor.execute('SELECT COUNT(*) FROM emails WHERE is_flagged = 1').fetchone()[0]
        needs_reply = cursor.execute('SELECT COUNT(*) FROM emails WHERE requires_reply = 1').fetchone()[0]
        
        f.write('## 📊 Statistics\n\n')
        f.write(f'- Unread: {unread}\n')
        f.write(f'- Flagged: {flagged}\n')
        f.write(f'- Needs Reply: {needs_reply}\n\n')
        
        f.write('## 📧 Emails\n\n')
        
        for i, email in enumerate(emails, 1):
            # Clean subject for filename
            clean_subject = re.sub(r'[^a-zA-Z0-9 ]', '', email['subject'])[:50]
            filename = f'{i:04d}_{clean_subject.replace(" ", "_")}.md'
            filepath = os.path.join(output_dir, filename)
            
            # Write to index
            f.write(f'### {i}. {email["subject"]}\n')
            f.write(f'- From: {email["sender"]}\n')
            f.write(f'- Date: {email["date_string"]}\n')
            if email['requires_reply']:
                f.write('- **⚠️ NEEDS REPLY**\n')
            f.write(f'- [View Full Email]({filename})\n\n')
            
            # Write individual file
            with open(filepath, 'w', encoding='utf-8') as ef:
                ef.write(f'# {email["subject"]}\n\n')
                ef.write(f'**From**: {email["sender"]}\n\n')
                ef.write(f'**Date**: {email["date_string"]}\n\n')
                ef.write(f'**Mailbox**: {email["mailbox"]} ({email["account"]})\n\n')
                
                if email['is_flagged']:
                    ef.write('**🚩 FLAGGED**\n\n')
                if email['requires_reply']:
                    ef.write('**⚠️ NEEDS REPLY**\n\n')
                if not email['is_read']:
                    ef.write('**📨 UNREAD**\n\n')
                
                ef.write('## Content\n\n')
                ef.write('```\n')
                ef.write(email['content'] or '(No content)')
                ef.write('\n```\n\n')
                
                if email['requires_reply']:
                    ef.write('## Suggested Reply\n\n')
                    ef.write('```\n')
                    sender_name = email['sender'].split('<')[0].strip()
                    ef.write(f'Hi {sender_name},\n\n')
                    ef.write(f'Thank you for your email regarding "{email["subject"]}".\n\n')
                    ef.write('I have received your message and will respond shortly.\n\n')
                    ef.write('Best regards,\n[Your name]\n')
                    ef.write('```\n\n')
                
                ef.write('---\n')
                ef.write(f'Email {i} of {len(emails)}\n')
    
    conn.close()
    print(f'✅ Exported {len(emails)} emails to {output_dir}/')


def main():
    print('🚀 Simple Email Fetcher\n')
    
    # Fetch emails
    emails = fetch_emails_simple()
    
    if emails:
        print(f'✅ Fetched {len(emails)} emails')
        
        # Save to database
        save_to_database(emails)
        print(f'💾 Saved to emails_simple.db')
        
        # Export to markdown
        export_to_markdown()
        print(f'📝 Exported to myemails/')
        
        # Show sample
        print('\n📊 Sample emails:')
        for email in emails[:3]:
            print(f'  - {email.get("subject", "No subject")} from {email.get("from", "Unknown")}')
    else:
        print('❌ No emails fetched')


if __name__ == '__main__':
    main()