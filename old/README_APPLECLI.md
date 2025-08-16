# AppleCLI - macOS Application Control CLI Tool

**AppleCLI** is a comprehensive command-line interface tool that allows you to control and interact with native macOS applications directly from the terminal. It supports all major Apple apps including Contacts, Notes, Messages, Mail, Calendar, Reminders, Maps, and includes web search functionality.

## 🚀 Features

- **Contacts Management**: List, search (with regex), and get contact counts
- **Notes Management**: List, search, and create notes in any folder
- **Messages Integration**: Read message history and send messages
- **Mail Control**: Check unread emails, search, and compose drafts
- **Calendar Operations**: View today's events, search, and create new events
- **Reminders Management**: List, search, and create reminders with due dates
- **Maps Integration**: Search locations and get directions
- **Web Search**: Built-in DuckDuckGo search functionality
- **Multiple Output Formats**: Plain text, JSON, and table formats
- **Regex Search Support**: Advanced pattern matching for contacts
- **Comprehensive Error Handling**: Clear error messages and permission checks

## 📋 Prerequisites

### System Requirements
- macOS (tested on macOS Sequoia, compatible with earlier versions)
- Python 3.6 or later
- Terminal or iTerm2

### Required Permissions

Before using AppleCLI, you need to grant the following permissions in **System Settings → Privacy & Security**:

1. **Automation Permission** (Required for all Apple apps)
   - Go to **Privacy & Security → Automation**
   - Enable Terminal/iTerm for each app you want to control

2. **Full Disk Access** (Required for Messages database access)
   - Go to **Privacy & Security → Full Disk Access**
   - Add Terminal/iTerm to the list

3. **Contacts Access** (For Contacts operations)
   - Go to **Privacy & Security → Contacts**
   - Enable Terminal/iTerm

4. **Calendar & Reminders Access** (For respective operations)
   - Go to **Privacy & Security → Calendars**
   - Go to **Privacy & Security → Reminders**
   - Enable Terminal/iTerm for both

## 🛠 Installation

1. Clone or download the repository:
   ```bash
   git clone https://github.com/your-repo/apple-mcp.git
   cd apple-mcp
   ```

2. Make the script executable:
   ```bash
   chmod +x applecli.py
   ```

3. (Optional) Create a symlink for global access:
   ```bash
   ln -s $(pwd)/applecli.py /usr/local/bin/applecli
   ```

## 📖 Usage

### Basic Syntax
```bash
python3 applecli.py --<app> --action <action> [options]
```

### Available Apps
- `--contacts` - Manage Contacts
- `--notes` - Manage Notes  
- `--messages` - Manage Messages
- `--mail` - Manage Mail
- `--calendar` - Manage Calendar
- `--reminders` - Manage Reminders
- `--maps` - Use Maps
- `--web` - Web Search

### Common Actions
- `list` - List items
- `search` - Search with query
- `create` - Create new item
- `read` - Read content
- `send` - Send message/email
- `count` - Get count of items

### Output Formats
- `--format plain` (default) - Human readable text
- `--format json` - JSON output for scripting
- `--format table` - Formatted table output

## 📱 Examples by App

### Contacts
```bash
# List all contacts (with limit)
python3 applecli.py --contacts --action list --limit 10

# Search contacts by name
python3 applecli.py --contacts --action search --query "John"

# Regex search (e.g., names starting with 'J')
python3 applecli.py --contacts --action search --query "^J.*" --regex

# Get total contact count
python3 applecli.py --contacts --action count

# JSON output
python3 applecli.py --contacts --action list --limit 5 --format json
```

### Notes
```bash
# List recent notes
python3 applecli.py --notes --action list --limit 10

# Search notes by content or title
python3 applecli.py --notes --action search --query "meeting"

# Create a new note
python3 applecli.py --notes --action create --title "Shopping List" --body "Milk, Bread, Eggs"

# Create note in specific folder
python3 applecli.py --notes --action create --title "Work Note" --body "Project ideas" --folder "Work"
```

### Messages
```bash
# Read recent messages (requires Full Disk Access)
python3 applecli.py --messages --action read --limit 10

# Read messages from specific contact
python3 applecli.py --messages --action read --phone "+1234567890" --limit 5

# Send a message (contact must exist in Messages)
python3 applecli.py --messages --action send --phone "+1234567890" --text "Hello from CLI!"

# List recent chats
python3 applecli.py --messages --action list --limit 5
```

### Mail
```bash
# Check unread email count
python3 applecli.py --mail --action unread

# Search emails by subject
python3 applecli.py --mail --action search --query "invoice" --limit 5

# Compose email draft
python3 applecli.py --mail --action compose --to "user@example.com" --subject "Test Email" --body "Hello from CLI"

# Compose with CC
python3 applecli.py --mail --action compose --to "user@example.com" --cc "manager@example.com" --subject "Report" --body "Monthly report attached"
```

### Calendar
```bash
# View today's events
python3 applecli.py --calendar --action today

# Search upcoming events
python3 applecli.py --calendar --action search --query "meeting" --days 30

# Create new event (tomorrow at current time + hours offset)
python3 applecli.py --calendar --action create --title "Team Standup" --hours 24

# Create event in specific calendar
python3 applecli.py --calendar --action create --title "Doctor Appointment" --calendar-name "Personal" --hours 48
```

### Reminders
```bash
# List all reminders
python3 applecli.py --reminders --action list

# List only incomplete reminders
python3 applecli.py --reminders --action list --incomplete

# Search reminders
python3 applecli.py --reminders --action search --query "buy"

# Create reminder (due tomorrow)
python3 applecli.py --reminders --action create --title "Buy groceries" --days 1

# Create reminder in specific list
python3 applecli.py --reminders --action create --title "Call dentist" --list-name "Personal" --days 2
```

### Maps
```bash
# Search for a location
python3 applecli.py --maps --action search --location "Apple Park Cupertino"

# Get directions between two locations
python3 applecli.py --maps --action directions --from "San Francisco" --to-addr "San Jose"

# Search for nearby places
python3 applecli.py --maps --action search --location "Starbucks near me"
```

### Web Search
```bash
# Basic web search
python3 applecli.py --web --action search --query "Python programming"

# Limited results
python3 applecli.py --web --action search --query "macOS tips" --limit 3

# JSON output for scripting
python3 applecli.py --web --action search --query "AI tools" --format json
```

## 🔧 Advanced Usage

### Scripting with JSON Output
```bash
# Get contact count programmatically
COUNT=$(python3 applecli.py --contacts --action count --format json | jq -r '.')
echo "Total contacts: $COUNT"

# Search and process results
python3 applecli.py --web --action search --query "weather API" --format json | jq -r '.[].title'
```

### Batch Operations
```bash
# Create multiple reminders
for item in "Buy milk" "Call doctor" "Pay bills"; do
    python3 applecli.py --reminders --action create --title "$item" --days 1
done

# Search multiple terms
for term in "meeting" "appointment" "call"; do
    echo "=== Searching for: $term ==="
    python3 applecli.py --calendar --action search --query "$term" --days 7
done
```

### Error Handling in Scripts
```bash
#!/bin/bash
# Safe execution with error handling

if python3 applecli.py --contacts --action count >/dev/null 2>&1; then
    python3 applecli.py --contacts --action list --limit 5
else
    echo "Error: Cannot access contacts. Check permissions."
fi
```

## ⚠️ Troubleshooting

### Common Issues

1. **"Script execution timed out"**
   - Apps may need time to launch. Try running the command again.
   - For large operations, increase timeout or reduce scope.

2. **"Application isn't running" Error**
   - AppleCLI automatically activates apps, but sometimes they need time to start.
   - Manually open the app once, then try again.

3. **Permission Denied Errors**
   - Check that automation permissions are granted in System Settings.
   - For Messages, ensure Full Disk Access is enabled.

4. **"Contact not found in Messages"**
   - You can only send messages to existing contacts in Messages app.
   - The contact must have been used in Messages before.

5. **Database Access Issues (Messages)**
   - Ensure Terminal/iTerm has Full Disk Access permission.
   - Try: `ls ~/Library/Messages/chat.db` to verify access.

### Permission Check Commands
```bash
# Check if automation is working
osascript -e 'tell application "System Events" to get name of every process whose visible is true' >/dev/null && echo "✅ Automation allowed" || echo "❌ Automation blocked"

# Check Full Disk Access for Messages
ls ~/Library/Messages/chat.db >/dev/null 2>&1 && echo "✅ Has Full Disk Access" || echo "❌ No Full Disk Access"

# Test specific app access
osascript -e 'tell application "Contacts" to activate' >/dev/null 2>&1 && echo "✅ Contacts accessible" || echo "❌ Contacts blocked"
```

## 🔒 Security Notes

- **No Sensitive Data Storage**: AppleCLI doesn't store passwords or sensitive information
- **Read-Only by Default**: Most operations are read-only unless explicitly creating content
- **Input Sanitization**: User inputs are properly escaped for AppleScript execution
- **Permission Checks**: Clear error messages when permissions are missing

## 🚀 Performance Tips

1. **Use Limits**: Always use `--limit` for large datasets to avoid timeouts
2. **Specific Searches**: Use specific search terms rather than broad queries
3. **JSON for Scripting**: Use JSON format when parsing output programmatically
4. **Cache Results**: For repetitive operations, consider caching results locally

## 🧩 Architecture

AppleCLI is built with a modular architecture:

- **AppleScriptExecutor**: Handles AppleScript and JXA execution
- **App Managers**: Individual classes for each Apple app (ContactsManager, NotesManager, etc.)
- **OutputFormatter**: Handles different output formats (plain, JSON, table)
- **CLI Interface**: Argument parsing and command routing

### Technical Stack
- **Python 3.6+**: Core application
- **AppleScript/JXA**: Native macOS app automation
- **SQLite**: Direct Messages database access
- **urllib**: Web search functionality
- **argparse**: Command-line interface

## 📚 Related Documentation

- [COMPLETE_TEST_RESULTS.md](COMPLETE_TEST_RESULTS.md) - Comprehensive test results with timing
- [APPLE_MCP_COMMANDS_REFERENCE.md](APPLE_MCP_COMMANDS_REFERENCE.md) - Raw command reference
- [MCP_ANALYSIS_REPORT.md](MCP_ANALYSIS_REPORT.md) - Technical architecture analysis

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Test your changes thoroughly with different apps and permissions
4. Ensure error handling works properly
5. Update documentation as needed
6. Submit a pull request

## 📝 License

This project is provided as-is for educational and personal use. Please respect Apple's terms of service and user privacy when using these tools.

---

**AppleCLI v1.0** - Complete macOS application control from the command line.

For support or questions, please refer to the troubleshooting section or create an issue in the repository.