# Enhanced Mail Features for AppleCLI
## Voice Assistant Ready Email Management

AppleCLI now includes comprehensive email management features designed for voice control and automation. These features enable natural language interactions like "Show me emails from last week" or "Add this email to my task list."

---

## 🎯 New Email Actions

### 1. **Email Summary** (`--action summary`)
Get a complete overview of your inbox status.

```bash
python3 applecli.py --mail --action summary
```

**Returns:**
- Total email count
- Unread count
- Today's emails
- This week's emails

**Voice Command Example:** "Hey assistant, give me my email summary"

---

### 2. **Recent Emails** (`--action recent`)
Get the most recent emails with previews.

```bash
python3 applecli.py --mail --action recent --limit 5
```

**Parameters:**
- `--limit`: Number of emails (default: 10)
- `--mailbox`: Mailbox name (default: INBOX)

**Voice Command Example:** "Show me my latest emails"

---

### 3. **Last Week's Emails** (`--action last-week`)
Get all emails from the past 7 days.

```bash
python3 applecli.py --mail --action last-week --limit 20
```

**Voice Command Example:** "What emails did I get last week?"

---

### 4. **Emails Needing Reply** (`--action needs-reply`)
Smart filtering to show unread emails from real people (excludes no-reply addresses).

```bash
python3 applecli.py --mail --action needs-reply --limit 10
```

**Features:**
- Filters out automated emails
- Shows preview of content
- Prioritizes human senders

**Voice Command Example:** "Which emails need my attention?"

---

### 5. **Emails from Specific Sender** (`--action from-sender`)
Get all emails from a particular person or domain.

```bash
python3 applecli.py --mail --action from-sender --sender "john@example.com" --limit 10
```

**Parameters:**
- `--sender`: Email address or partial match
- `--limit`: Number of results

**Voice Command Example:** "Show me all emails from John"

---

### 6. **Date Range Search** (`--action date-range`)
Get emails between specific dates.

```bash
python3 applecli.py --mail --action date-range --start-date "01/01/2025" --end-date "01/10/2025"
```

**Parameters:**
- `--start-date`: Start date (MM/DD/YYYY)
- `--end-date`: End date (MM/DD/YYYY)

**Voice Command Example:** "Show me emails from the first week of January"

---

### 7. **Create Reply Draft** (`--action reply-draft`)
Create a reply draft for a specific email.

```bash
python3 applecli.py --mail --action reply-draft \
    --subject "Meeting Invitation" \
    --reply-body "I'll be there. Thanks for the invite!"
```

**Parameters:**
- `--subject`: Subject of email to reply to
- `--reply-body`: Your reply message

**Voice Command Example:** "Reply to the meeting invitation saying I'll attend"

---

### 8. **Flag Important Emails** (`--action flag`)
Mark emails as important/flagged for follow-up.

```bash
python3 applecli.py --mail --action flag --subject "Budget Report" --flag-status
```

**Parameters:**
- `--subject`: Email subject to flag
- `--flag-status`: Flag (default) or unflag

**Voice Command Example:** "Flag the budget report as important"

---

### 9. **Add Email to Reminders** (`--action add-to-reminders`)
Convert an email into a task in the Reminders app.

```bash
python3 applecli.py --mail --action add-to-reminders \
    --subject "Project Proposal" \
    --list-name "Work Tasks"
```

**Parameters:**
- `--subject`: Email to convert to task
- `--list-name`: Reminders list (default: "Reminders")

**Voice Command Example:** "Add this email to my task list"

---

## 🎙️ Voice Assistant Use Cases

### Morning Routine
```bash
# "Good morning, check my emails"
python3 applecli.py --mail --action summary

# "Any urgent emails?"
python3 applecli.py --mail --action needs-reply --limit 5

# "What came in overnight?"
python3 applecli.py --mail --action recent --limit 10
```

### Email Triage
```bash
# "Show me emails from my boss"
python3 applecli.py --mail --action from-sender --sender "boss@company.com"

# "Flag the quarterly report"
python3 applecli.py --mail --action flag --subject "Q4 Report"

# "Add the project deadline email to my tasks"
python3 applecli.py --mail --action add-to-reminders --subject "Project Deadline"
```

### Quick Responses
```bash
# "Reply to the lunch invitation"
python3 applecli.py --mail --action reply-draft \
    --subject "Lunch Tomorrow?" \
    --reply-body "Sounds great! See you at noon."

# "Send a quick update to the team"
python3 applecli.py --mail --action compose \
    --to "team@company.com" \
    --subject "Status Update" \
    --body "Project is on track. Details in tomorrow's meeting."
```

---

## 📊 Output Formats

All email actions support three output formats:

### Plain Text (Default)
```bash
python3 applecli.py --mail --action recent --limit 3
```

### JSON (For Integration)
```bash
python3 applecli.py --mail --action recent --limit 3 --format json
```

### Table (For Reports)
```bash
python3 applecli.py --mail --action recent --limit 3 --format table
```

---

## 🤖 Integration Examples

### Shell Script Automation
```bash
#!/bin/bash
# Daily email report

echo "=== Daily Email Report ==="
echo ""

# Get summary
summary=$(python3 applecli.py --mail --action summary --format json)
echo "Inbox Status: $summary"

# Check urgent emails
urgent=$(python3 applecli.py --mail --action needs-reply --limit 5)
if [ -n "$urgent" ]; then
    echo "⚠️ Emails needing attention:"
    echo "$urgent"
fi

# Flag overnight emails
python3 applecli.py --mail --action flag --subject "overnight" --flag-status
```

### Python Integration
```python
import subprocess
import json

def get_email_summary():
    """Get email summary as Python dict."""
    result = subprocess.run(
        ["python3", "applecli.py", "--mail", "--action", "summary", "--format", "json"],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout)

def get_urgent_emails():
    """Get emails that need replies."""
    result = subprocess.run(
        ["python3", "applecli.py", "--mail", "--action", "needs-reply", "--limit", "10", "--format", "json"],
        capture_output=True,
        text=True
    )
    return json.loads(result.stdout) if result.stdout else []

# Use in your automation
summary = get_email_summary()
if summary['unread'] > 50:
    print(f"Alert: {summary['unread']} unread emails!")
    urgent = get_urgent_emails()
    for email in urgent:
        print(f"Needs reply: {email['subject']} from {email['from']}")
```

### Cron Job for Email Tasks
```bash
# Add to crontab for daily email task creation
0 9 * * * python3 /path/to/applecli.py --mail --action needs-reply --limit 10 | while read email; do python3 /path/to/applecli.py --mail --action add-to-reminders --subject "$email" --list-name "Daily Email Tasks"; done
```

---

## 🎯 Smart Email Management Workflows

### 1. Zero Inbox Workflow
```bash
# Step 1: Get overview
python3 applecli.py --mail --action summary

# Step 2: Process urgent emails
python3 applecli.py --mail --action needs-reply --limit 20

# Step 3: Flag important ones
python3 applecli.py --mail --action flag --subject "Important"

# Step 4: Add follow-ups to tasks
python3 applecli.py --mail --action add-to-reminders --subject "Follow up"

# Step 5: Archive processed emails (manual in Mail app)
```

### 2. Daily Review Workflow
```bash
# Morning review
python3 applecli.py --mail --action summary
python3 applecli.py --mail --action recent --limit 10

# Afternoon check
python3 applecli.py --mail --action needs-reply --limit 5

# End of day
python3 applecli.py --mail --action last-week --limit 50
```

### 3. Project Email Tracking
```bash
# Get all project emails
python3 applecli.py --mail --action search --query "Project Alpha"

# Flag project updates
python3 applecli.py --mail --action flag --subject "Alpha Update"

# Add milestones to tasks
python3 applecli.py --mail --action add-to-reminders \
    --subject "Alpha Milestone" \
    --list-name "Project Alpha"
```

---

## 🚀 Quick Start Examples

```bash
# Install and test
python3 applecli.py --mail --action summary

# Your first voice command simulation
echo "Checking emails..." && python3 applecli.py --mail --action needs-reply

# Create a reply
python3 applecli.py --mail --action reply-draft \
    --subject "Team Meeting" \
    --reply-body "I'll join remotely. Thanks!"

# Add to tasks
python3 applecli.py --mail --action add-to-reminders \
    --subject "Review Document" \
    --list-name "Work"

# Flag for follow-up
python3 applecli.py --mail --action flag \
    --subject "Contract Review"
```

---

## 🔧 Troubleshooting

### Common Issues

1. **"No results found"**
   - Check Mail app is running
   - Verify you have emails in the specified mailbox
   - Try with different parameters or mailbox names

2. **AppleScript Timeout**
   - Large mailboxes may take time to process
   - Try reducing the `--limit` parameter
   - Close other apps to free resources

3. **Permission Errors**
   - Grant Terminal/Python automation permissions in System Settings
   - Mail app needs to be accessible via Automation

4. **Date Format Issues**
   - Always use MM/DD/YYYY format for dates
   - Ensure dates are valid (not future dates for past searches)

---

## 📝 Complete Command Reference

```bash
# Summary and Overview
python3 applecli.py --mail --action summary [--format plain|json|table]

# Recent Emails
python3 applecli.py --mail --action recent [--limit N] [--mailbox NAME]

# Time-based Queries
python3 applecli.py --mail --action last-week [--limit N]
python3 applecli.py --mail --action date-range --start-date MM/DD/YYYY --end-date MM/DD/YYYY

# Smart Filters
python3 applecli.py --mail --action needs-reply [--limit N]
python3 applecli.py --mail --action from-sender --sender EMAIL [--limit N]

# Email Management
python3 applecli.py --mail --action flag --subject TEXT [--flag-status]
python3 applecli.py --mail --action add-to-reminders --subject TEXT [--list-name NAME]

# Replies and Composition
python3 applecli.py --mail --action reply-draft --subject TEXT --reply-body TEXT
python3 applecli.py --mail --action compose --to EMAIL --subject TEXT --body TEXT [--cc EMAIL]

# Search
python3 applecli.py --mail --action search --query TEXT [--limit N]

# Legacy
python3 applecli.py --mail --action unread
```

---

## 🎉 What Makes This Special

1. **Voice-Ready**: Every command designed for natural language interaction
2. **Smart Filtering**: Automatically excludes automated emails from "needs-reply"
3. **Task Integration**: Seamlessly convert emails to Reminders tasks
4. **Batch Processing**: Handle multiple emails with single commands
5. **JSON Support**: Easy integration with other tools and scripts
6. **Preview Support**: See email content without opening Mail app
7. **Date Intelligence**: Smart date range queries for time-based email management
8. **Cross-App Integration**: Connect Mail with Reminders for GTD workflows

---

**Created**: January 2025
**Version**: 2.0 - Enhanced for Voice Assistants
**Status**: Production Ready ✅