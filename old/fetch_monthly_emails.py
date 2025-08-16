#!/usr/bin/env python3
"""
Fetch all emails from the last month and save them in markdown format.
"""

import subprocess
import json
import os
from datetime import datetime, timedelta
import re

def sanitize_filename(filename):
    """Remove invalid characters from filename."""
    # Remove or replace invalid characters
    filename = re.sub(r'[<>:"/\\|?*]', '_', filename)
    filename = re.sub(r'[\n\r\t]', ' ', filename)
    # Limit length
    if len(filename) > 100:
        filename = filename[:100]
    return filename.strip()

def get_emails_for_month():
    """Get emails from the last month using AppleCLI."""
    # Calculate dates
    end_date = datetime.now()
    start_date = end_date - timedelta(days=30)
    
    # Format dates for AppleScript (MM/DD/YYYY)
    start_str = start_date.strftime("%m/%d/%Y")
    end_str = end_date.strftime("%m/%d/%Y")
    
    print(f"📧 Fetching emails from {start_str} to {end_str}...")
    
    # Run AppleCLI to get emails
    cmd = [
        "python3", "applecli.py",
        "--mail", "--action", "date-range",
        "--start-date", start_str,
        "--end-date", end_str,
        "--limit", "500",  # Adjust if you need more
        "--format", "json"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0 and result.stdout:
            # Try to parse as JSON
            try:
                emails = json.loads(result.stdout)
                return emails if isinstance(emails, list) else []
            except json.JSONDecodeError:
                # If not JSON, try to parse the text output
                return parse_text_output(result.stdout)
        else:
            print(f"Error fetching emails: {result.stderr}")
            return []
    except Exception as e:
        print(f"Exception occurred: {e}")
        return []

def parse_text_output(output):
    """Parse text output into email list."""
    emails = []
    lines = output.strip().split('\n')
    
    for line in lines:
        if "||" in line:
            # Parse the custom format
            parts = line.split("||")
            email = {}
            for part in parts:
                if ":" in part:
                    key, value = part.split(":", 1)
                    email[key.lower().strip()] = value.strip()
            if email:
                emails.append(email)
        elif " | " in line and " from " in line:
            # Simple format: "Subject from Sender on Date"
            match = re.match(r"(.+) from (.+) on (.+)", line)
            if match:
                emails.append({
                    "subject": match.group(1).strip(),
                    "from": match.group(2).strip(),
                    "date": match.group(3).strip()
                })
    
    return emails

def fetch_full_email_content(subject):
    """Try to get more details about a specific email."""
    cmd = [
        "python3", "applecli.py",
        "--mail", "--action", "search",
        "--query", subject[:50],  # Use first 50 chars of subject
        "--limit", "1",
        "--format", "json"
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        if result.returncode == 0 and result.stdout:
            try:
                details = json.loads(result.stdout)
                if isinstance(details, list) and len(details) > 0:
                    return details[0]
            except:
                pass
    except:
        pass
    
    return None

def create_markdown_file(emails, output_dir):
    """Create markdown files for emails."""
    if not emails:
        print("No emails found to save.")
        return
    
    # Create index file
    index_path = os.path.join(output_dir, "EMAIL_INDEX.md")
    
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write("# Email Archive - Last 30 Days\n")
        f.write(f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"**Total Emails**: {len(emails)}\n\n")
        f.write("---\n\n")
        
        # Group emails by date
        emails_by_date = {}
        for email in emails:
            date = email.get('date', 'Unknown Date')
            # Try to parse and format date nicely
            try:
                if ',' in date:
                    date_only = date.split(',')[0]
                else:
                    date_only = date.split(' ')[0] if ' ' in date else date
            except:
                date_only = date[:10] if len(date) > 10 else date
            
            if date_only not in emails_by_date:
                emails_by_date[date_only] = []
            emails_by_date[date_only].append(email)
        
        # Sort dates
        sorted_dates = sorted(emails_by_date.keys(), reverse=True)
        
        # Write emails grouped by date
        email_count = 0
        for date in sorted_dates:
            f.write(f"## 📅 {date}\n\n")
            
            for email in emails_by_date[date]:
                email_count += 1
                subject = email.get('subject', 'No Subject')
                sender = email.get('from', 'Unknown Sender')
                date_full = email.get('date', '')
                preview = email.get('preview', '')
                
                # Write to index
                f.write(f"### {email_count}. {subject}\n")
                f.write(f"**From**: {sender}\n")
                f.write(f"**Date**: {date_full}\n")
                
                if preview and preview != "(No preview available)":
                    # Clean up preview
                    preview = preview.replace("\\n", "\n").replace("\\r", "")
                    if len(preview) > 500:
                        preview = preview[:500] + "..."
                    f.write(f"\n**Preview**:\n```\n{preview}\n```\n")
                
                f.write("\n---\n\n")
                
                # Also create individual file for each email
                filename = f"{email_count:04d}_{sanitize_filename(subject)}.md"
                email_path = os.path.join(output_dir, filename)
                
                with open(email_path, 'w', encoding='utf-8') as ef:
                    ef.write(f"# {subject}\n\n")
                    ef.write(f"**From**: {sender}\n\n")
                    ef.write(f"**Date**: {date_full}\n\n")
                    
                    if preview and preview != "(No preview available)":
                        ef.write(f"## Content Preview\n\n")
                        ef.write(f"```\n{preview}\n```\n\n")
                    
                    ef.write("---\n\n")
                    ef.write(f"*Email {email_count} of {len(emails)}*\n")
    
    print(f"✅ Saved {len(emails)} emails to {output_dir}")
    print(f"📄 Index file: {index_path}")

def main():
    """Main function."""
    output_dir = "myemails"
    
    # Ensure directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    print("🚀 Starting email fetch process...")
    print("⏳ This may take a minute depending on your mailbox size...\n")
    
    # Get emails
    emails = get_emails_for_month()
    
    if emails:
        print(f"📨 Found {len(emails)} emails from the last month")
        create_markdown_file(emails, output_dir)
        
        # Create summary statistics
        stats_path = os.path.join(output_dir, "STATISTICS.md")
        with open(stats_path, 'w', encoding='utf-8') as f:
            f.write("# Email Statistics - Last 30 Days\n\n")
            f.write(f"**Total Emails**: {len(emails)}\n\n")
            
            # Count by sender
            senders = {}
            for email in emails:
                sender = email.get('from', 'Unknown')
                # Extract email address if possible
                if '<' in sender and '>' in sender:
                    sender = sender.split('<')[1].split('>')[0]
                senders[sender] = senders.get(sender, 0) + 1
            
            # Top senders
            f.write("## Top 10 Senders\n\n")
            sorted_senders = sorted(senders.items(), key=lambda x: x[1], reverse=True)
            for i, (sender, count) in enumerate(sorted_senders[:10], 1):
                f.write(f"{i}. **{sender}**: {count} emails\n")
            
            f.write("\n---\n")
            f.write(f"\n*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*\n")
        
        print(f"📊 Statistics saved to {stats_path}")
    else:
        print("❌ No emails found or error occurred")
        # Try alternative method
        print("\n🔄 Trying alternative fetch method...")
        
        # Create a simple AppleScript to get emails
        script_path = "get_emails.applescript"
        with open(script_path, 'w') as f:
            f.write('''
tell application "Mail"
    activate
    set emailList to {}
    set emailCount to 0
    set thirtyDaysAgo to (current date) - (30 * days)
    
    repeat with acct in accounts
        repeat with mbox in mailboxes of acct
            if name of mbox is "INBOX" then
                try
                    set msgs to (every message of mbox whose date received ≥ thirtyDaysAgo)
                    
                    repeat with msg in msgs
                        if emailCount < 100 then
                            set msgDate to (date received of msg) as string
                            set msgSubject to subject of msg
                            set msgSender to sender of msg
                            
                            set emailInfo to "DATE: " & msgDate & " | FROM: " & msgSender & " | SUBJECT: " & msgSubject
                            set end of emailList to emailInfo
                            set emailCount to emailCount + 1
                        end if
                    end repeat
                end try
            end if
        end repeat
    end repeat
    
    return emailList
end tell
''')
        
        print("📝 Running direct AppleScript...")
        result = subprocess.run(["osascript", script_path], capture_output=True, text=True)
        
        if result.stdout:
            lines = result.stdout.strip().split(", ")
            emails = []
            for line in lines:
                if " | " in line:
                    parts = line.split(" | ")
                    email = {
                        "date": parts[0].replace("DATE: ", ""),
                        "from": parts[1].replace("FROM: ", "") if len(parts) > 1 else "Unknown",
                        "subject": parts[2].replace("SUBJECT: ", "") if len(parts) > 2 else "No Subject"
                    }
                    emails.append(email)
            
            if emails:
                print(f"✅ Found {len(emails)} emails via direct AppleScript")
                create_markdown_file(emails, output_dir)
        
        # Clean up
        if os.path.exists(script_path):
            os.remove(script_path)

if __name__ == "__main__":
    main()