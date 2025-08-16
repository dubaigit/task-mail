#!/usr/bin/env python3
"""
Background Mail Tool for macOS
Runs completely in background without activating Mail app or disrupting your workflow.
Optimized for silent operation with progress indicators.
"""

import subprocess
import json
import sys
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import time


class BackgroundMailTool:
    """Silent mail operations without screen interruption."""
    
    def __init__(self, silent: bool = True):
        """Initialize with silent mode option."""
        self.timeout = 30
        self.silent = silent
    
    def run_applescript_background(self, script: str, show_progress: bool = False) -> str:
        """Execute AppleScript silently in background."""
        try:
            if show_progress and not self.silent:
                print("⏳ Processing in background...", end="", flush=True)
            
            # Run the script directly without wrapping (ignoring responses can cause issues)
            result = subprocess.run(
                ['osascript', '-e', script],
                capture_output=True,
                text=True,
                timeout=self.timeout,
                stderr=subprocess.DEVNULL  # Suppress error output
            )
            
            if show_progress and not self.silent:
                print(" ✅")
            
            if result.returncode != 0:
                return ""
            return result.stdout.strip()
            
        except subprocess.TimeoutExpired:
            if not self.silent:
                print(" ⏱️ Timeout")
            return ""
        except Exception:
            return ""
    
    def get_inbox_stats_silent(self) -> Dict:
        """Get inbox statistics without activating Mail."""
        script = '''
        tell application "Mail"
            -- Background operation
            set totalCount to 0
            set unreadCount to 0
            set flaggedCount to 0
            set todayCount to 0
            
            set todayStart to (current date) - (time of (current date))
            
            try
                repeat with acct in accounts
                    repeat with mbox in mailboxes of acct
                        if name of mbox contains "INBOX" then
                            set totalCount to totalCount + (count of messages of mbox)
                            set unreadCount to unreadCount + (unread count of mbox)
                            
                            -- Count flagged
                            try
                                set flaggedMsgs to (every message of mbox whose flagged status is true)
                                set flaggedCount to flaggedCount + (count of flaggedMsgs)
                            end try
                            
                            -- Count today's emails
                            try
                                set todayMsgs to (every message of mbox whose date received ≥ todayStart)
                                set todayCount to todayCount + (count of todayMsgs)
                            end try
                        end if
                    end repeat
                end repeat
            end try
            
            return "TOTAL:" & totalCount & "|UNREAD:" & unreadCount & "|FLAGGED:" & flaggedCount & "|TODAY:" & todayCount
        end tell
        '''
        
        output = self.run_applescript_background(script, show_progress=True)
        
        stats = {}
        if output:
            for part in output.split("|"):
                if ":" in part:
                    key, value = part.split(":")
                    stats[key.lower()] = int(value)
        
        return stats
    
    def quick_search(self, query: str, limit: int = 5) -> List[Dict]:
        """Quick background search across all emails."""
        script = f'''
        tell application "Mail"
            -- Silent search operation
            set results to {{}}
            set matchCount to 0
            
            try
                repeat with acct in accounts
                    if matchCount < {limit} then
                        repeat with mbox in mailboxes of acct
                            if matchCount < {limit} then
                                try
                                    -- Search in subject and sender
                                    set matches to (every message of mbox whose subject contains "{query}" or sender contains "{query}")
                                    
                                    repeat with msg in matches
                                        if matchCount < {limit} then
                                            set msgSubject to subject of msg
                                            set msgFrom to sender of msg
                                            set msgDate to (date received of msg) as string
                                            
                                            set emailInfo to "SUBJ:" & msgSubject & "|FROM:" & msgFrom & "|DATE:" & msgDate & "||"
                                            set end of results to emailInfo
                                            set matchCount to matchCount + 1
                                        end if
                                    end repeat
                                end try
                            end if
                        end repeat
                    end if
                end repeat
            end try
            
            set AppleScript's text item delimiters to ""
            return results as string
        end tell
        '''
        
        output = self.run_applescript_background(script, show_progress=True)
        
        emails = []
        if output:
            for block in output.split("||"):
                if block.strip():
                    email = {}
                    for field in block.split("|"):
                        if ":" in field:
                            key, value = field.split(":", 1)
                            if key == "SUBJ":
                                email['subject'] = value
                            elif key == "FROM":
                                email['from'] = value
                            elif key == "DATE":
                                email['date'] = value
                    if email:
                        emails.append(email)
        
        return emails
    
    def get_unread_count(self) -> int:
        """Get unread email count silently."""
        script = '''
        tell application "Mail"
            set unreadTotal to 0
            try
                repeat with acct in accounts
                    repeat with mbox in mailboxes of acct
                        set unreadTotal to unreadTotal + (unread count of mbox)
                    end repeat
                end repeat
            end try
            return unreadTotal
        end tell
        '''
        
        try:
            output = self.run_applescript_background(script)
            return int(output) if output else 0
        except:
            return 0
    
    def mark_as_read_silent(self, subject_pattern: str) -> bool:
        """Mark emails as read based on subject pattern."""
        script = f'''
        tell application "Mail"
            set markedCount to 0
            try
                repeat with acct in accounts
                    repeat with mbox in mailboxes of acct
                        set msgs to (every message of mbox whose subject contains "{subject_pattern}" and read status is false)
                        repeat with msg in msgs
                            set read status of msg to true
                            set markedCount to markedCount + 1
                        end repeat
                    end repeat
                end repeat
            end try
            return markedCount
        end tell
        '''
        
        output = self.run_applescript_background(script)
        try:
            count = int(output) if output else 0
            return count > 0
        except:
            return False
    
    def get_recent_emails(self, limit: int = 100) -> List[Dict]:
        """Get recent emails from all accounts."""
        script = f'''
        tell application "Mail"
            -- Silent operation to get recent emails
            set results to {{}}
            set emailCount to 0
            
            try
                repeat with acct in accounts
                    if emailCount < {limit} then
                        repeat with mbox in mailboxes of acct
                            if emailCount < {limit} then
                                try
                                    -- Get recent messages from all mailboxes
                                    set msgs to (every message of mbox)
                                    
                                    repeat with msg in msgs
                                        if emailCount < {limit} then
                                            try
                                                set msgSubject to subject of msg
                                                set msgFrom to sender of msg
                                                set msgDate to (date received of msg) as string
                                                set msgRead to read status of msg
                                                
                                                set emailInfo to "SUBJ:" & msgSubject & "|FROM:" & msgFrom & "|DATE:" & msgDate & "|READ:" & msgRead & "||"
                                                set end of results to emailInfo
                                                set emailCount to emailCount + 1
                                            end try
                                        end if
                                    end repeat
                                end try
                            end if
                        end repeat
                    end if
                end repeat
            end try
            
            set AppleScript's text item delimiters to ""
            return results as string
        end tell
        '''
        
        output = self.run_applescript_background(script, show_progress=True)
        
        emails = []
        if output:
            for block in output.split("||"):
                if block.strip():
                    email = {}
                    for field in block.split("|"):
                        if ":" in field:
                            key, value = field.split(":", 1)
                            if key == "SUBJ":
                                email['subject'] = value
                            elif key == "FROM":
                                email['from'] = value
                            elif key == "DATE":
                                email['date'] = value
                            elif key == "READ":
                                email['read'] = value.lower() == 'true'
                    if email:
                        emails.append(email)
        
        return emails

    def background_monitor(self, interval: int = 60):
        """Monitor inbox in background and report changes."""
        print("📊 Starting background email monitor...")
        print("Press Ctrl+C to stop\n")
        
        last_stats = {}
        
        try:
            while True:
                stats = self.get_inbox_stats_silent()
                
                if stats and stats != last_stats:
                    # Check for new emails
                    if last_stats and stats.get('total', 0) > last_stats.get('total', 0):
                        new_count = stats['total'] - last_stats['total']
                        print(f"📨 {new_count} new email(s) received!")
                    
                    # Display current stats
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ", end="")
                    print(f"Total: {stats.get('total', 0)} | ", end="")
                    print(f"Unread: {stats.get('unread', 0)} | ", end="")
                    print(f"Flagged: {stats.get('flagged', 0)} | ", end="")
                    print(f"Today: {stats.get('today', 0)}")
                    
                    last_stats = stats
                
                # Wait for next check
                time.sleep(interval)
                
        except KeyboardInterrupt:
            print("\n✅ Monitor stopped")


def main():
    """Main CLI interface for background mail operations."""
    parser = argparse.ArgumentParser(
        description='Background Mail Tool - Silent email operations'
    )
    
    parser.add_argument(
        'action',
        choices=['stats', 'search', 'unread', 'mark-read', 'monitor', 'recent'],
        help='Action to perform'
    )
    
    parser.add_argument('--query', help='Search query')
    parser.add_argument('--limit', type=int, default=10, help='Result limit')
    parser.add_argument('--pattern', help='Pattern for marking emails')
    parser.add_argument('--interval', type=int, default=60, help='Monitor interval in seconds')
    parser.add_argument('--silent', action='store_true', help='Completely silent mode')
    parser.add_argument('--format', choices=['json', 'text'], default='json', help='Output format')
    
    args = parser.parse_args()
    
    # Initialize tool
    tool = BackgroundMailTool(silent=args.silent)
    
    try:
        if args.action == 'stats':
            result = tool.get_inbox_stats_silent()
            if args.format == 'json':
                print(json.dumps(result, indent=2))
            else:
                for key, value in result.items():
                    print(f"{key}: {value}")
        
        elif args.action == 'search':
            if not args.query:
                print(json.dumps({"error": "Query required"}))
                sys.exit(1)
            
            results = tool.quick_search(args.query, args.limit)
            if args.format == 'json':
                print(json.dumps(results, indent=2))
            else:
                for i, email in enumerate(results, 1):
                    print(f"\n{i}. {email.get('subject', 'No subject')}")
                    print(f"   From: {email.get('from', 'Unknown')}")
                    print(f"   Date: {email.get('date', 'Unknown')}")
        
        elif args.action == 'unread':
            count = tool.get_unread_count()
            if args.format == 'json':
                print(json.dumps({"unread": count}))
            else:
                print(f"Unread emails: {count}")
        
        elif args.action == 'mark-read':
            if not args.pattern:
                print(json.dumps({"error": "Pattern required"}))
                sys.exit(1)
            
            success = tool.mark_as_read_silent(args.pattern)
            if args.format == 'json':
                print(json.dumps({"success": success}))
            else:
                print("✅ Emails marked as read" if success else "❌ No emails found")
        
        elif args.action == 'recent':
            results = tool.get_recent_emails(args.limit)
            if args.format == 'json':
                print(json.dumps(results, indent=2))
            else:
                for i, email in enumerate(results, 1):
                    print(f"\n{i}. {email.get('subject', 'No subject')}")
                    print(f"   From: {email.get('from', 'Unknown')}")
                    print(f"   Date: {email.get('date', 'Unknown')}")
                    print(f"   Read: {'Yes' if email.get('read', False) else 'No'}")
        
        elif args.action == 'monitor':
            # Always run monitor in text mode
            tool.background_monitor(args.interval)
        
    except Exception as e:
        if not args.silent:
            print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()