# MailCLI - Unified Apple Mail Command Line Interface

A comprehensive command-line interface for Apple Mail that provides instant database access, email composition, and full mail management capabilities.

## ✨ Features

- **🔍 Instant Search**: Direct SQLite database access for lightning-fast email searches
- **📬 Email Management**: Read, search, and organize emails from the command line
- **✍️ Composition**: Create drafts, reply to emails, and forward messages
- **📊 Statistics**: Get detailed insights about your email usage
- **🚀 Performance**: Dual-mode operation (fast DB access or full AppleScript content)

## 📦 Installation

```bash
# Clone or download the files to your preferred location
cd /Users/iamomen/apple-mcp/

# Make the main script executable
chmod +x mailcli.py

# Optional: Add to PATH for global access
echo 'alias mailcli="python3 /Users/iamomen/apple-mcp/mailcli.py"' >> ~/.zshrc
source ~/.zshrc
```

## 🚀 Quick Start

```bash
# Get email statistics
mailcli stats

# View recent emails
mailcli recent --limit 5

# Search for specific emails
mailcli search "invoice" --field subject

# Check unread emails
mailcli unread

# Compose and send an email
mailcli compose --to "user@example.com" --subject "Hello" --body "Test message" --send
```

## 📚 Commands Reference

### Reading Emails

#### `recent` - Get recent emails
```bash
mailcli recent --limit 10
mailcli recent --limit 5 --verbose  # Show preview
mailcli recent --full               # Use AppleScript for full content
```

#### `search` - Search emails
```bash
mailcli search "keyword"
mailcli search "invoice" --field subject
mailcli search "john" --field sender
mailcli search "meeting" --limit 10 --verbose
```

#### `unread` - Get unread emails
```bash
mailcli unread
mailcli unread --limit 20 --verbose
```

#### `flagged` - Get flagged emails
```bash
mailcli flagged
mailcli flagged --limit 10
```

#### `stats` - Email statistics
```bash
mailcli stats
```

### Composing Emails

#### `compose` - Compose new email
```bash
# Create draft
mailcli compose --to "user@example.com" --subject "Meeting" --body "Let's meet tomorrow"

# Send immediately
mailcli compose --to "user@example.com" --subject "Test" --body "Hello" --send

# With CC and BCC
mailcli compose --to "user@example.com" --cc "cc@example.com" --bcc "bcc@example.com" \
  --subject "Test" --body "Message"
```

#### `draft` - Create draft email
```bash
mailcli draft --to "user@example.com" --subject "Draft" --body "Draft message"
```

#### `reply` - Reply to email
```bash
# Reply to most recent email
mailcli reply --body "Thanks for your email!"

# Reply to specific email
mailcli reply --message-id "MESSAGE_ID" --body "Thanks!"

# Reply all
mailcli reply --body "Thanks everyone!" --reply-all
```

#### `forward` - Forward email
```bash
mailcli forward --message-id "MESSAGE_ID" --to "forward@example.com"
mailcli forward --message-id "MESSAGE_ID" --to "user@example.com" \
  --message "FYI - see below"
```

### Managing Drafts

#### `drafts` - List draft emails
```bash
mailcli drafts
mailcli drafts --limit 5
```

#### `send` - Send a draft
```bash
# Send latest draft
mailcli send

# Send specific draft
mailcli send --draft-id "DRAFT_ID"
```

## 🔧 Advanced Usage

### Search Fields
- `all` - Search in all fields (default)
- `subject` - Search in subject only
- `sender` - Search in sender name/email
- `content` - Search in email content

### Verbose Mode
Add `--verbose` to most commands to see more details:
```bash
mailcli recent --verbose
mailcli search "meeting" --verbose
```

### Full Content Mode
For `recent` command, use `--full` to get complete email content via AppleScript (slower but more complete):
```bash
mailcli recent --full --limit 5
```

## 🏗️ Architecture

MailCLI combines three specialized tools:

1. **apple_mail_db_reader.py** - Direct SQLite database access for instant searches
2. **apple_mail_composer.py** - AppleScript-based email composition and sending
3. **mail_tool.py** - Full AppleScript integration for complete email content

The unified CLI intelligently routes commands to the appropriate backend for optimal performance.

## 📊 Performance

- **Database queries**: < 100ms for most operations
- **Email search**: Instant across 8000+ emails
- **Composition**: ~1-2 seconds per draft
- **Full content retrieval**: ~1-2 seconds per email

## 🔍 Example Workflows

### Daily Email Check
```bash
# Check stats
mailcli stats

# Review unread emails
mailcli unread --limit 10

# Search for important emails
mailcli search "urgent" --field subject
```

### Reply to Latest Email
```bash
# See recent emails
mailcli recent --limit 5

# Reply to the most recent one
mailcli reply --body "Thanks for your message. I'll review and get back to you."
```

### Batch Email Search
```bash
# Find all invoices
mailcli search "invoice" --field subject --limit 50

# Find emails from specific sender
mailcli search "john.doe@example.com" --field sender
```

### Draft Management
```bash
# Create a draft
mailcli draft --to "team@example.com" --subject "Weekly Update" \
  --body "Here's our weekly progress..."

# List drafts
mailcli drafts

# Send the draft
mailcli send
```

## 🐛 Troubleshooting

### Mail App Issues
If you get "Connection is invalid" errors:
- Make sure Apple Mail is configured with at least one account
- Try opening Mail app first: `open -a Mail`

### Database Access
If database is not found:
- Ensure Apple Mail has been used at least once
- Check if database exists: `ls -la ~/Library/Mail/V10/MailData/`

### Permission Issues
If you get permission errors:
- Grant Terminal/iTerm full disk access in System Preferences > Security & Privacy

## 📝 Notes

- Email timestamps may show future dates (2056) due to how Apple Mail stores dates
- The database provides metadata and previews; use `--full` flag for complete content
- Drafts are created in Apple Mail and can be edited there before sending
- All operations work with your existing Apple Mail configuration

## 🔒 Security

- Read-only database access by default
- No credentials stored
- Uses your existing Apple Mail authentication
- All operations performed locally

## 📄 License

This tool is provided as-is for personal use with Apple Mail.

## 🤝 Contributing

Feel free to submit issues, feature requests, or improvements!

---

**Version**: 1.0.0  
**Author**: MailCLI Development  
**Requirements**: macOS, Python 3.6+, Apple Mail configured