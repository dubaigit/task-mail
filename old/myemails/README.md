# 📧 Email Archive - Last 30 Days

This directory contains your email archive from the last 30 days, exported in Markdown format for easy reading and searching.

## 📊 Summary Statistics

- **Total Emails Archived**: 100
- **Date Range**: Last 30 days
- **Format**: Markdown (.md)
- **Generated**: August 12, 2025

## 📁 Directory Structure

```
myemails/
├── EMAIL_INDEX.md          # Complete index of all emails
├── README.md               # This file
├── 0001_*.md              # Individual email files (numbered)
├── 0002_*.md
├── ...
└── 0100_*.md
```

## 📋 File Naming Convention

Each email is saved with the format:
```
NNNN_Subject_Title.md
```
- `NNNN` - 4-digit sequential number
- `Subject_Title` - Sanitized email subject

## 🔍 How to Use

### Browse by Index
Open `EMAIL_INDEX.md` to see all emails organized by date with:
- Subject lines
- Sender information
- Date/time received
- Content previews (when available)

### Search for Content
Use your text editor or terminal to search:
```bash
# Search for a keyword across all emails
grep -i "meeting" myemails/*.md

# Find emails from a specific sender
grep -l "john@example.com" myemails/*.md

# Count emails by sender
grep "**From**:" myemails/*.md | sort | uniq -c
```

### Open in Markdown Editor
These files can be opened in:
- VS Code
- Obsidian
- Typora
- MacDown
- Any text editor

## 🎯 Key Features

1. **Chronological Organization** - Emails sorted by date
2. **Individual Files** - Each email in its own file for easy access
3. **Searchable** - Plain text format allows full-text search
4. **Portable** - Markdown files work on any platform
5. **Readable** - Formatted for easy reading

## 🔄 Updating the Archive

To fetch new emails, run:
```bash
python3 fetch_monthly_emails.py
```

This will:
1. Fetch emails from the last 30 days
2. Create/update markdown files
3. Update the index

## 📝 Notes

- Email content is limited to previews (first 200-500 characters)
- Full email bodies require additional API calls
- Attachments are not included in this export
- Some emails may show "(No preview available)" if content couldn't be extracted

## 🛠️ Created With

- **AppleCLI** - Enhanced email management tool
- **Python** - Processing and formatting
- **AppleScript** - Direct Mail.app integration
- **Markdown** - Universal readable format

---

*This archive was generated automatically using the enhanced AppleCLI Mail features.*