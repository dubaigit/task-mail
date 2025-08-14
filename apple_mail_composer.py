#!/usr/bin/env python3
"""
Apple Mail Composer - Create drafts and reply to emails
Works with Apple Mail through AppleScript for proper email handling
"""

import subprocess
import json
import argparse
import sys
from datetime import datetime
from typing import Optional, List, Dict

class AppleMailComposer:
    """Compose, reply, and manage drafts in Apple Mail."""
    
    def __init__(self):
        """Initialize the Mail composer."""
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
    
    def create_draft(self, to: str, subject: str, body: str, 
                    cc: Optional[str] = None, bcc: Optional[str] = None) -> Dict:
        """Create a new draft email."""
        # Escape quotes in the text
        subject = subject.replace('"', '\\"')
        body = body.replace('"', '\\"')
        
        script = f'''
        tell application "Mail"
            activate
            set newMessage to make new outgoing message with properties {{visible:false, subject:"{subject}", content:"{body}"}}
            
            tell newMessage
                make new to recipient with properties {{address:"{to}"}}
                '''
        
        if cc:
            script += f'''
                make new cc recipient with properties {{address:"{cc}"}}
                '''
        
        if bcc:
            script += f'''
                make new bcc recipient with properties {{address:"{bcc}"}}
                '''
        
        script += '''
                save
                set messageId to id
                set messageSubject to subject
            end tell
            
            return "Created draft: " & messageSubject & " (ID: " & messageId & ")"
        end tell
        '''
        
        try:
            result = self.run_applescript(script)
            return {
                "status": "success",
                "message": result,
                "draft": {
                    "to": to,
                    "subject": subject,
                    "body": body[:100] + "..." if len(body) > 100 else body
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def reply_to_email(self, message_id: str, reply_body: str, 
                      reply_all: bool = False) -> Dict:
        """Reply to an existing email."""
        script = f'''
        tell application "Mail"
            -- Find the original message
            set foundMessage to missing value
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    try
                        set msgs to messages of mbox whose message id = "{message_id}"
                        if (count of msgs) > 0 then
                            set foundMessage to item 1 of msgs
                            exit repeat
                        end if
                    end try
                end repeat
                if foundMessage is not missing value then exit repeat
            end repeat
            
            if foundMessage is missing value then
                return "Error: Message not found"
            else
                '''
        
        if reply_all:
            script += '''
                set replyMessage to reply foundMessage opening window no reply to all yes
                '''
        else:
            script += '''
                set replyMessage to reply foundMessage opening window no reply to all no
                '''
        
        script += f'''
                tell replyMessage
                    set content to "{reply_body}" & return & return & content
                    save
                    set replySubject to subject
                end tell
                
                return "Created reply draft: " & replySubject
            end if
        end tell
        '''
        
        try:
            result = self.run_applescript(script)
            if "Error:" in result:
                return {"status": "error", "message": result}
            return {
                "status": "success",
                "message": result,
                "reply": {
                    "original_id": message_id,
                    "reply_all": reply_all,
                    "body": reply_body[:100] + "..." if len(reply_body) > 100 else reply_body
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def forward_email(self, message_id: str, to: str, 
                     forward_message: Optional[str] = None) -> Dict:
        """Forward an existing email."""
        script = f'''
        tell application "Mail"
            -- Find the original message
            set foundMessage to missing value
            
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    try
                        set msgs to messages of mbox whose message id = "{message_id}"
                        if (count of msgs) > 0 then
                            set foundMessage to item 1 of msgs
                            exit repeat
                        end if
                    end try
                end repeat
                if foundMessage is not missing value then exit repeat
            end repeat
            
            if foundMessage is missing value then
                return "Error: Message not found"
            else
                set forwardMessage to forward foundMessage opening window no
                
                tell forwardMessage
                    make new to recipient with properties {{address:"{to}"}}
                    '''
        
        if forward_message:
            script += f'''
                    set content to "{forward_message}" & return & return & content
                    '''
        
        script += '''
                    save
                    set forwardSubject to subject
                end tell
                
                return "Created forward draft: " & forwardSubject
            end if
        end tell
        '''
        
        try:
            result = self.run_applescript(script)
            if "Error:" in result:
                return {"status": "error", "message": result}
            return {
                "status": "success",
                "message": result,
                "forward": {
                    "original_id": message_id,
                    "to": to,
                    "message": forward_message[:100] + "..." if forward_message and len(forward_message) > 100 else forward_message
                }
            }
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def send_draft(self, draft_id: Optional[str] = None) -> Dict:
        """Send a draft email (latest draft if no ID specified)."""
        if draft_id:
            script = f'''
            tell application "Mail"
                -- Find and send specific draft
                set foundDraft to missing value
                
                repeat with acct in accounts
                    set draftBox to drafts mailbox of acct
                    try
                        set drafts to messages of draftBox whose message id = "{draft_id}"
                        if (count of drafts) > 0 then
                            set foundDraft to item 1 of drafts
                            exit repeat
                        end if
                    end try
                end repeat
                
                if foundDraft is missing value then
                    return "Error: Draft not found"
                else
                    send foundDraft
                    return "Sent draft successfully"
                end if
            end tell
            '''
        else:
            script = '''
            tell application "Mail"
                -- Send the most recent draft
                repeat with acct in accounts
                    set draftBox to drafts mailbox of acct
                    try
                        set draftMessages to messages of draftBox
                        if (count of draftMessages) > 0 then
                            set latestDraft to item 1 of draftMessages
                            set draftSubject to subject of latestDraft
                            send latestDraft
                            return "Sent draft: " & draftSubject
                        end if
                    end try
                end repeat
                
                return "Error: No drafts found"
            end tell
            '''
        
        try:
            result = self.run_applescript(script)
            if "Error:" in result:
                return {"status": "error", "message": result}
            return {"status": "success", "message": result}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def list_drafts(self, limit: int = 10) -> List[Dict]:
        """List current draft emails."""
        script = f'''
        tell application "Mail"
            set draftsList to {{}}
            set draftCount to 0
            
            repeat with acct in accounts
                set draftBox to drafts mailbox of acct
                try
                    set draftMessages to messages of draftBox
                    
                    repeat with msg in draftMessages
                        if draftCount < {limit} then
                            set msgId to message id of msg
                            set msgSubject to subject of msg
                            set msgDate to date received of msg
                            set msgTo to ""
                            try
                                set msgTo to address of item 1 of to recipients of msg
                            end try
                            
                            set end of draftsList to msgId & "|||" & msgSubject & "|||" & msgTo & "|||" & (msgDate as string)
                            set draftCount to draftCount + 1
                        end if
                    end repeat
                end try
            end repeat
            
            if (count of draftsList) = 0 then
                return "No drafts found"
            else
                set AppleScript's text item delimiters to "\\n"
                return draftsList as string
            end if
        end tell
        '''
        
        try:
            result = self.run_applescript(script)
            if result == "No drafts found":
                return []
            
            drafts = []
            for line in result.split('\n'):
                if line.strip():
                    parts = line.split('|||')
                    if len(parts) >= 4:
                        drafts.append({
                            "id": parts[0],
                            "subject": parts[1],
                            "to": parts[2],
                            "date": parts[3]
                        })
            
            return drafts
        except Exception as e:
            return [{"error": str(e)}]


def main():
    parser = argparse.ArgumentParser(description='Apple Mail Composer - Create and manage drafts')
    
    subparsers = parser.add_subparsers(dest='action', help='Action to perform')
    
    # Create draft
    draft_parser = subparsers.add_parser('draft', help='Create a new draft')
    draft_parser.add_argument('--to', required=True, help='Recipient email')
    draft_parser.add_argument('--subject', required=True, help='Email subject')
    draft_parser.add_argument('--body', required=True, help='Email body')
    draft_parser.add_argument('--cc', help='CC recipients')
    draft_parser.add_argument('--bcc', help='BCC recipients')
    
    # Reply to email
    reply_parser = subparsers.add_parser('reply', help='Reply to an email')
    reply_parser.add_argument('--message-id', required=True, help='Original message ID')
    reply_parser.add_argument('--body', required=True, help='Reply body')
    reply_parser.add_argument('--reply-all', action='store_true', help='Reply to all recipients')
    
    # Forward email
    forward_parser = subparsers.add_parser('forward', help='Forward an email')
    forward_parser.add_argument('--message-id', required=True, help='Message ID to forward')
    forward_parser.add_argument('--to', required=True, help='Forward to email')
    forward_parser.add_argument('--message', help='Additional message')
    
    # Send draft
    send_parser = subparsers.add_parser('send', help='Send a draft')
    send_parser.add_argument('--draft-id', help='Draft ID to send (latest if not specified)')
    
    # List drafts
    list_parser = subparsers.add_parser('list', help='List draft emails')
    list_parser.add_argument('--limit', type=int, default=10, help='Number of drafts to list')
    
    args = parser.parse_args()
    
    if not args.action:
        parser.print_help()
        return
    
    composer = AppleMailComposer()
    
    if args.action == 'draft':
        result = composer.create_draft(
            to=args.to,
            subject=args.subject,
            body=args.body,
            cc=args.cc,
            bcc=args.bcc
        )
        print(json.dumps(result, indent=2))
    
    elif args.action == 'reply':
        result = composer.reply_to_email(
            message_id=args.message_id,
            reply_body=args.body,
            reply_all=args.reply_all
        )
        print(json.dumps(result, indent=2))
    
    elif args.action == 'forward':
        result = composer.forward_email(
            message_id=args.message_id,
            to=args.to,
            forward_message=args.message
        )
        print(json.dumps(result, indent=2))
    
    elif args.action == 'send':
        result = composer.send_draft(draft_id=args.draft_id)
        print(json.dumps(result, indent=2))
    
    elif args.action == 'list':
        drafts = composer.list_drafts(limit=args.limit)
        if drafts:
            print("\n📝 Draft Emails:")
            for i, draft in enumerate(drafts, 1):
                if 'error' in draft:
                    print(f"Error: {draft['error']}")
                    break
                print(f"\n--- Draft {i} ---")
                print(f"ID: {draft['id']}")
                print(f"Subject: {draft['subject']}")
                print(f"To: {draft['to']}")
                print(f"Date: {draft['date']}")
        else:
            print("No drafts found")


if __name__ == "__main__":
    main()