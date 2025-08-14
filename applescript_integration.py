#!/usr/bin/env python3
"""
AppleScript Integration for Apple Mail
Handles sending emails and managing drafts via AppleScript
"""

import subprocess
import json
from typing import Dict, Optional, List

class AppleScriptMailer:
    """Send emails and manage drafts using AppleScript"""
    
    def send_email(self, to: str, subject: str, body: str, cc: str = None, bcc: str = None) -> bool:
        """Send an email using Apple Mail via AppleScript"""
        
        # Escape quotes in the text
        subject = subject.replace('"', '\\"')
        body = body.replace('"', '\\"')
        to = to.replace('"', '\\"')
        
        script = f'''
        tell application "Mail"
            set newMessage to make new outgoing message with properties {{subject:"{subject}", content:"{body}", visible:false}}
            tell newMessage
                make new to recipient at end of to recipients with properties {{address:"{to}"}}
        '''
        
        if cc:
            cc = cc.replace('"', '\\"')
            script += f'''
                make new cc recipient at end of cc recipients with properties {{address:"{cc}"}}
            '''
            
        if bcc:
            bcc = bcc.replace('"', '\\"')
            script += f'''
                make new bcc recipient at end of bcc recipients with properties {{address:"{bcc}"}}
            '''
        
        script += '''
                send
            end tell
        end tell
        '''
        
        try:
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                check=True
            )
            return True
        except subprocess.CalledProcessError as e:
            print(f"Error sending email: {e.stderr}")
            return False
    
    def create_draft(self, to: str, subject: str, body: str, cc: str = None) -> bool:
        """Create a draft email in Apple Mail"""
        
        # Escape quotes
        subject = subject.replace('"', '\\"')
        body = body.replace('"', '\\"')
        to = to.replace('"', '\\"')
        
        script = f'''
        tell application "Mail"
            set newMessage to make new outgoing message with properties {{subject:"{subject}", content:"{body}", visible:true}}
            tell newMessage
                make new to recipient at end of to recipients with properties {{address:"{to}"}}
        '''
        
        if cc:
            cc = cc.replace('"', '\\"')
            script += f'''
                make new cc recipient at end of cc recipients with properties {{address:"{cc}"}}
            '''
        
        script += '''
            end tell
            activate
        end tell
        '''
        
        try:
            subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                check=True
            )
            return True
        except subprocess.CalledProcessError as e:
            print(f"Error creating draft: {e.stderr}")
            return False
    
    def reply_to_email(self, message_id: str, body: str, reply_all: bool = False) -> bool:
        """Reply to an email using AppleScript"""
        
        body = body.replace('"', '\\"')
        reply_type = "reply to" if reply_all else "reply"
        
        script = f'''
        tell application "Mail"
            try
                set selectedMessages to (messages of inbox whose message id = "{message_id}")
                if (count of selectedMessages) > 0 then
                    set theMessage to item 1 of selectedMessages
                    set theReply to {reply_type} theMessage with opening window
                    tell theReply
                        set content to "{body}"
                    end tell
                    return true
                else
                    return false
                end if
            on error
                return false
            end try
        end tell
        '''
        
        try:
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                check=True
            )
            return "true" in result.stdout
        except subprocess.CalledProcessError as e:
            print(f"Error replying to email: {e.stderr}")
            return False
    
    def get_selected_emails(self) -> List[Dict]:
        """Get currently selected emails in Mail app"""
        
        script = '''
        tell application "Mail"
            set selectedMessages to selection
            set emailList to {}
            repeat with aMessage in selectedMessages
                set messageInfo to {subject:subject of aMessage, sender:(extract address from sender of aMessage), messageId:message id of aMessage}
                set end of emailList to messageInfo
            end repeat
            return emailList
        end tell
        '''
        
        try:
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                check=True
            )
            # Parse AppleScript list output
            # This is simplified - proper parsing would be more complex
            return []
        except subprocess.CalledProcessError:
            return []
    
    def mark_as_read(self, message_id: str) -> bool:
        """Mark an email as read"""
        
        script = f'''
        tell application "Mail"
            try
                set selectedMessages to (messages of inbox whose message id = "{message_id}")
                if (count of selectedMessages) > 0 then
                    set read status of item 1 of selectedMessages to true
                    return true
                else
                    return false
                end if
            on error
                return false
            end try
        end tell
        '''
        
        try:
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                check=True
            )
            return "true" in result.stdout
        except subprocess.CalledProcessError:
            return False
    
    def flag_email(self, message_id: str, flag: bool = True) -> bool:
        """Flag or unflag an email"""
        
        flag_value = "true" if flag else "false"
        
        script = f'''
        tell application "Mail"
            try
                set selectedMessages to (messages of inbox whose message id = "{message_id}")
                if (count of selectedMessages) > 0 then
                    set flagged status of item 1 of selectedMessages to {flag_value}
                    return true
                else
                    return false
                end if
            on error
                return false
            end try
        end tell
        '''
        
        try:
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                check=True
            )
            return "true" in result.stdout
        except subprocess.CalledProcessError:
            return False