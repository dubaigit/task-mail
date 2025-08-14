# Apple MCP Terminal Commands Reference
## Complete Guide with Tested & Working Commands

> **Last Tested**: January 10, 2025  
> **System**: macOS  
> **Status**: ✅ All commands tested and verified

---

## Table of Contents
1. [System Permissions & Setup](#system-permissions--setup)
2. [Contacts App Commands](#contacts-app-commands)
3. [Notes App Commands](#notes-app-commands)
4. [Messages App Commands](#messages-app-commands)
5. [Mail App Commands](#mail-app-commands)
6. [Calendar App Commands](#calendar-app-commands)
7. [Reminders App Commands](#reminders-app-commands)
8. [Maps App Commands](#maps-app-commands)
9. [Web Search Commands](#web-search-commands)
10. [Utility Commands](#utility-commands)
11. [Troubleshooting](#troubleshooting)

---

## System Permissions & Setup

### Required Permissions

Before using these commands, ensure you have granted the following permissions:

1. **Automation Permission** (Required for all apps)
   - System Settings → Privacy & Security → Automation
   - Enable Terminal/iTerm for each app you want to control

2. **Full Disk Access** (Required for Messages database)
   - System Settings → Privacy & Security → Full Disk Access
   - Add Terminal/iTerm to the list

3. **Contacts Access**
   - System Settings → Privacy & Security → Contacts
   - Enable Terminal/iTerm

4. **Calendar & Reminders Access**
   - System Settings → Privacy & Security → Calendars/Reminders
   - Enable Terminal/iTerm

### Check Permissions

```bash
# Check Automation Permission
osascript -e 'tell application "System Events" to get name of every process whose visible is true' &>/dev/null && echo "✅ Automation allowed" || echo "❌ Automation blocked"

# Check Full Disk Access (for Messages DB)
ls ~/Library/Messages/chat.db &>/dev/null && echo "✅ Has Full Disk Access" || echo "❌ No Full Disk Access"

# Test specific app access
osascript -e 'tell application "Contacts" to activate' &>/dev/null && echo "✅ Contacts accessible" || echo "❌ Contacts blocked"
```

---

## Contacts App Commands

### ✅ Count Total Contacts
```bash
# Using JXA (JavaScript for Automation) - RECOMMENDED
osascript -l JavaScript -e 'Application("Contacts").activate(); Application("Contacts").people().length'

# Using AppleScript (may fail if app not running)
osascript -e 'tell application "Contacts" to activate' && sleep 1 && osascript -e 'tell application "Contacts" to count every person'
```

### ✅ Get All Contacts with Phone Numbers
```bash
osascript -l JavaScript -e '
const Contacts = Application("Contacts");
Contacts.activate();
const people = Contacts.people();
const result = {};
for (const person of people) {
    try {
        const name = person.name();
        const phones = person.phones().map(phone => phone.value());
        if (phones.length > 0) {
            result[name] = phones;
        }
    } catch(e) {}
}
JSON.stringify(result, null, 2);
'
```

### ✅ Search Contact by Name
```bash
# Search for contacts containing "John"
osascript -l JavaScript -e '
const Contacts = Application("Contacts");
Contacts.activate();
const searchName = "John";
const people = Contacts.people.whose({name: {_contains: searchName}})();
const results = people.map(person => ({
    name: person.name(),
    phones: person.phones().map(p => p.value()),
    emails: person.emails().map(e => e.value())
}));
JSON.stringify(results, null, 2);
'
```

### ✅ Get Contact Details
```bash
# Get first contact's full details
osascript -l JavaScript -e '
const Contacts = Application("Contacts");
Contacts.activate();
const person = Contacts.people()[0];
JSON.stringify({
    name: person.name(),
    firstName: person.firstName(),
    lastName: person.lastName(),
    phones: person.phones().map(p => ({label: p.label(), value: p.value()})),
    emails: person.emails().map(e => ({label: e.label(), value: e.value()})),
    organization: person.organization()
}, null, 2);
'
```

---

## Notes App Commands

### ✅ Count Total Notes
```bash
osascript -l JavaScript -e '
const Notes = Application("Notes");
Notes.activate();
const count = Notes.notes().length;
"Total notes: " + count
'
```

### ✅ List All Notes
```bash
osascript -l JavaScript -e '
const Notes = Application("Notes");
Notes.activate();
const notes = Notes.notes();
const result = notes.map(note => ({
    name: note.name(),
    folder: note.container().name(),
    created: note.creationDate(),
    modified: note.modificationDate(),
    preview: note.plaintext().substring(0, 100) + "..."
}));
JSON.stringify(result.slice(0, 10), null, 2); // First 10 notes
'
```

### ✅ Search Notes
```bash
# Search for notes containing specific text
osascript -l JavaScript -e '
const Notes = Application("Notes");
Notes.activate();
const searchText = "meeting";
const foundNotes = Notes.notes.whose({
    _or: [
        {name: {_contains: searchText}},
        {plaintext: {_contains: searchText}}
    ]
})();
const results = foundNotes.map(note => ({
    name: note.name(),
    preview: note.plaintext().substring(0, 200)
}));
JSON.stringify(results, null, 2);
'
```

### ✅ Create New Note
```bash
osascript -l JavaScript -e '
const Notes = Application("Notes");
Notes.activate();
const title = "Terminal Created Note";
const body = "This note was created from Terminal at " + new Date().toString();
const folderName = "Notes"; // Change to your folder

// Find folder
let targetFolder = null;
const folders = Notes.folders();
for (let i = 0; i < folders.length; i++) {
    if (folders[i].name() === folderName) {
        targetFolder = folders[i];
        break;
    }
}

// Create note
if (targetFolder) {
    const newNote = Notes.make({
        new: "note", 
        withProperties: {name: title, body: body}, 
        at: targetFolder
    });
    "Note created: " + title;
} else {
    Notes.make({new: "note", withProperties: {name: title, body: body}});
    "Note created in default folder: " + title;
}
'
```

### ✅ Get Note Content
```bash
# Get content of first note
osascript -l JavaScript -e '
const Notes = Application("Notes");
Notes.activate();
const note = Notes.notes()[0];
JSON.stringify({
    name: note.name(),
    content: note.plaintext(),
    folder: note.container().name()
}, null, 2);
'
```

---

## Messages App Commands

### ✅ Count Message Services
```bash
osascript -e 'tell application "Messages" to activate' && osascript -e 'tell application "Messages" to count every service'
```

### ✅ Send iMessage (Requires Contact in Messages)
```bash
# Send message to phone number
osascript -e '
tell application "Messages"
    activate
    set targetBuddy to buddy "+1234567890" of service 1
    send "Hello from Terminal!" to targetBuddy
end tell
'

# Simple send (if contact exists)
osascript -e 'tell application "Messages" to send "Test message" to buddy "+1234567890"'
```

### ✅ Get Chat Partners
```bash
osascript -e '
tell application "Messages"
    activate
    set chatList to {}
    repeat with eachChat in chats
        try
            set chatName to name of eachChat
            set end of chatList to chatName
        end try
    end repeat
    return chatList
end tell
'
```

### ⚠️ Read Messages from Database (Requires Full Disk Access)
```bash
# Check if you have access first
ls ~/Library/Messages/chat.db &>/dev/null || echo "Need Full Disk Access permission!"

# Get recent messages (if you have access)
sqlite3 -readonly ~/Library/Messages/chat.db "
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
ORDER BY m.date DESC
LIMIT 10;
" 2>/dev/null || echo "Database access denied - check Full Disk Access"

# Get unread messages count
sqlite3 -readonly ~/Library/Messages/chat.db "
SELECT COUNT(*) as unread_count
FROM message
WHERE is_read = 0 AND is_from_me = 0;
" 2>/dev/null || echo "Database access denied"
```

---

## Mail App Commands

### ✅ Count Mail Accounts
```bash
osascript -e 'tell application "Mail" to activate' && sleep 2 && osascript -e 'tell application "Mail" to count accounts'
```

### ✅ List Mail Accounts
```bash
osascript -e 'tell application "Mail" to name of every account'
```

### ✅ Get Mailbox List
```bash
osascript -e '
tell application "Mail"
    activate
    set mailboxList to {}
    repeat with acct in accounts
        set acctName to name of acct
        repeat with mbox in mailboxes of acct
            set end of mailboxList to (acctName & " - " & name of mbox)
        end repeat
    end repeat
    return mailboxList
end tell
'
```

### ✅ Count Unread Emails
```bash
osascript -e '
tell application "Mail"
    activate
    set totalUnread to 0
    repeat with acct in accounts
        repeat with mbox in mailboxes of acct
            try
                set totalUnread to totalUnread + (unread count of mbox)
            end try
        end repeat
    end repeat
    return "Total unread emails: " & totalUnread
end tell
'
```

### ✅ Get Recent Emails
```bash
osascript -e '
tell application "Mail"
    activate
    set recentEmails to {}
    set inbox to mailbox "INBOX" of account 1
    set msgs to messages 1 through 5 of inbox
    repeat with msg in msgs
        set msgInfo to {subject:(subject of msg), sender:(sender of msg), dateSent:(date sent of msg)}
        set end of recentEmails to msgInfo
    end repeat
    return recentEmails
end tell
'
```

### ✅ Search Emails
```bash
# Search for emails containing specific text
osascript -e '
tell application "Mail"
    activate
    set searchTerm to "invoice"
    set foundMessages to {}
    set inbox to mailbox "INBOX" of account 1
    set msgs to (every message of inbox whose subject contains searchTerm)
    repeat with msg in msgs
        set end of foundMessages to subject of msg
    end repeat
    return foundMessages
end tell
'
```

### ✅ Send Email
```bash
osascript -e '
tell application "Mail"
    activate
    set newMessage to make new outgoing message with properties {subject:"Test from Terminal", content:"This email was sent from Terminal", visible:false}
    tell newMessage
        make new to recipient at end of to recipients with properties {address:"test@example.com"}
    end tell
    -- Uncomment next line to actually send:
    -- send newMessage
    return "Email created (not sent)"
end tell
'
```

---

## Calendar App Commands

### ✅ Count Calendars
```bash
osascript -e 'tell application "Calendar" to activate' && sleep 2 && osascript -e 'tell application "Calendar" to count calendars'
```

### ✅ List Calendar Names
```bash
osascript -e 'tell application "Calendar" to name of every calendar'
```

### ✅ Get Today's Events
```bash
osascript -e '
tell application "Calendar"
    activate
    set today to current date
    set tomorrow to today + (1 * days)
    set todayEvents to {}
    
    repeat with cal in calendars
        set calEvents to (events of cal whose start date ≥ today and start date < tomorrow)
        repeat with evt in calEvents
            set eventInfo to summary of evt & " at " & (start date of evt as string)
            set end of todayEvents to eventInfo
        end repeat
    end repeat
    
    if (count of todayEvents) = 0 then
        return "No events today"
    else
        return todayEvents
    end if
end tell
'
```

### ✅ Get Week's Events
```bash
osascript -e '
tell application "Calendar"
    activate
    set today to current date
    set nextWeek to today + (7 * days)
    set weekEvents to {}
    
    repeat with cal in calendars
        try
            set calName to name of cal
            set calEvents to (events of cal whose start date ≥ today and start date ≤ nextWeek)
            repeat with evt in calEvents
                set eventInfo to (summary of evt) & " - " & calName & " - " & (start date of evt as string)
                set end of weekEvents to eventInfo
            end repeat
        end try
    end repeat
    
    return weekEvents
end tell
'
```

### ✅ Create Calendar Event
```bash
osascript -e '
tell application "Calendar"
    activate
    set cal to calendar "Home" -- Change to your calendar name
    set eventStart to (current date) + (1 * days)
    set eventEnd to eventStart + (2 * hours)
    
    tell cal
        make new event with properties {summary:"Meeting from Terminal", start date:eventStart, end date:eventEnd, location:"Office", description:"Created via Terminal command"}
    end tell
    
    return "Event created"
end tell
'
```

### ✅ Search Events
```bash
osascript -e '
tell application "Calendar"
    activate
    set searchText to "meeting"
    set foundEvents to {}
    
    repeat with cal in calendars
        try
            set calEvents to (events of cal whose summary contains searchText)
            repeat with evt in calEvents
                set eventInfo to (summary of evt) & " on " & (start date of evt as string)
                set end of foundEvents to eventInfo
            end repeat
        end try
    end repeat
    
    return foundEvents
end tell
'
```

---

## Reminders App Commands

### ✅ Count Reminder Lists
```bash
osascript -e 'tell application "Reminders" to activate' && sleep 2 && osascript -e 'tell application "Reminders" to count lists'
```

### ✅ List All Reminder Lists
```bash
osascript -e 'tell application "Reminders" to name of every list'
```

### ✅ Get All Reminders
```bash
osascript -e '
tell application "Reminders"
    activate
    set allReminders to {}
    repeat with lst in lists
        set listName to name of lst
        repeat with rmndr in reminders of lst
            try
                set reminderInfo to listName & ": " & (name of rmndr)
                if completed of rmndr then
                    set reminderInfo to reminderInfo & " ✓"
                else
                    set reminderInfo to reminderInfo & " ○"
                end if
                set end of allReminders to reminderInfo
            end try
        end repeat
    end repeat
    return allReminders
end tell
'
```

### ✅ Get Incomplete Reminders
```bash
osascript -e '
tell application "Reminders"
    activate
    set incompleteReminders to {}
    repeat with lst in lists
        set listName to name of lst
        set incompleteTasks to (reminders of lst whose completed is false)
        repeat with rmndr in incompleteTasks
            set reminderInfo to listName & ": " & (name of rmndr)
            try
                set dueDate to due date of rmndr
                set reminderInfo to reminderInfo & " (Due: " & (dueDate as string) & ")"
            end try
            set end of incompleteReminders to reminderInfo
        end repeat
    end repeat
    return incompleteReminders
end tell
'
```

### ✅ Create Reminder
```bash
osascript -e '
tell application "Reminders"
    activate
    set targetList to list "Reminders" -- Change to your list
    set dueDate to (current date) + (1 * days)
    
    tell targetList
        make new reminder with properties {name:"Buy milk", body:"From the grocery store", due date:dueDate}
    end tell
    
    return "Reminder created"
end tell
'
```

### ✅ Search Reminders
```bash
osascript -e '
tell application "Reminders"
    activate
    set searchText to "buy"
    set foundReminders to {}
    
    repeat with lst in lists
        repeat with rmndr in reminders of lst
            if name of rmndr contains searchText then
                set reminderInfo to (name of lst) & ": " & (name of rmndr)
                set end of foundReminders to reminderInfo
            end if
        end repeat
    end repeat
    
    return foundReminders
end tell
'
```

---

## Maps App Commands

### ✅ Open Maps App
```bash
osascript -e 'tell application "Maps" to activate'
```

### ✅ Search Location
```bash
# Search for a location
osascript -e 'tell application "Maps" to search for "Starbucks near me"'

# Search for specific address
osascript -e 'tell application "Maps" to search for "1 Infinite Loop, Cupertino, CA"'
```

### ✅ Get Directions
```bash
osascript -e '
tell application "Maps"
    activate
    -- Note: This opens Maps with the route, but cannot be fully automated
    search for "directions from San Francisco to Los Angeles"
end tell
'
```

### ✅ Open Specific Coordinates
```bash
# Open location by coordinates (using URL scheme)
open "maps://maps.apple.com/?ll=37.7749,-122.4194&z=15"

# Open with a pin at location
open "maps://maps.apple.com/?q=37.7749,-122.4194"
```

---

## Web Search Commands

### ✅ DuckDuckGo Search - Python Method (TESTED & WORKING)
```bash
# Save this as websearch.py or run inline
python3 << 'EOF'
import urllib.request
import urllib.parse
import re
import json
import gzip
from html import unescape

def search_duckduckgo(query, num_results=5):
    """Search DuckDuckGo and return structured results"""
    
    url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}'
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
    }
    
    req = urllib.request.Request(url, headers=headers)
    
    with urllib.request.urlopen(req) as response:
        if response.info().get('Content-Encoding') == 'gzip':
            html = gzip.decompress(response.read()).decode('utf-8')
        else:
            html = response.read().decode('utf-8')
        
        results = []
        result_blocks = re.findall(r'<div[^>]*class="result[^"]*"[^>]*>.*?</div>\s*</div>', html, re.DOTALL)
        
        for block in result_blocks[:num_results]:
            title_match = re.search(r'class="result__title"[^>]*>.*?<a[^>]*>(.*?)</a>', block, re.DOTALL)
            title = unescape(re.sub('<[^>]+>', '', title_match.group(1))) if title_match else ''
            
            url_match = re.search(r'href="//duckduckgo.com/l/\?uddg=([^"&]+)', block)
            result_url = urllib.parse.unquote(url_match.group(1)) if url_match else ''
            
            snippet_match = re.search(r'class="result__snippet"[^>]*>(.*?)</a>', block, re.DOTALL)
            snippet = unescape(re.sub('<[^>]+>', '', snippet_match.group(1))) if snippet_match else ''
            
            if title and result_url:
                results.append({
                    'title': title.strip(),
                    'url': result_url,
                    'snippet': snippet.strip()
                })
        
        return results

# Example usage
results = search_duckduckgo("Python programming")
for i, result in enumerate(results, 1):
    print(f"{i}. {result['title']}")
    print(f"   URL: {result['url']}")
    print()
EOF
```

### ✅ Bash Function for Quick Web Search
```bash
# Add this to your .bashrc or .zshrc
websearch() {
    local query="${1:-test}"
    echo "Searching for: $query"
    echo "-------------------"
    
    python3 -c "
import urllib.request, urllib.parse, re, gzip
from html import unescape

query = '$query'
url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}'

req = urllib.request.Request(url, headers={
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
})

with urllib.request.urlopen(req) as response:
    if response.info().get('Content-Encoding') == 'gzip':
        html = gzip.decompress(response.read()).decode('utf-8')
    else:
        html = response.read().decode('utf-8')
    
    titles = re.findall(r'class=\"result__title\"[^>]*>.*?<a[^>]*>(.*?)</a>', html, re.DOTALL)
    urls = re.findall(r'href=\"//duckduckgo.com/l/\?uddg=([^\"&]+)', html)
    
    for i, (title, url) in enumerate(zip(titles[:5], urls[:5]), 1):
        clean_title = unescape(re.sub('<[^>]+>', '', title)).strip()
        clean_url = urllib.parse.unquote(url)
        print(f'{i}. {clean_title}')
        print(f'   {clean_url}')
        print()
"
}

# Usage examples
websearch "Apple Silicon M1"
websearch "Python tutorial"
websearch "macOS terminal commands"
```

### ✅ One-liner Web Search
```bash
# Quick one-liner for searching
python3 -c "import urllib.request,urllib.parse,re,gzip;from html import unescape;q='YOUR_SEARCH_QUERY';u=f'https://html.duckduckgo.com/html/?q={urllib.parse.quote(q)}';r=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'});h=urllib.request.urlopen(r).read();h=gzip.decompress(h) if h[:2]==b'\x1f\x8b' else h;h=h.decode();t=re.findall(r'class=\"result__title\".*?<a[^>]*>(.*?)</a>',h,re.DOTALL);[print(f'{i+1}. {unescape(re.sub(\"<[^>]+>\",\"\",x)).strip()}') for i,x in enumerate(t[:5])]"
```

### ✅ Search and Open First Result
```bash
# Search and automatically open the first result in browser
search_and_open() {
    local query="$1"
    local url=$(python3 -c "
import urllib.request, urllib.parse, re, gzip

url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote('$query')}'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

with urllib.request.urlopen(req) as response:
    html = response.read()
    if html[:2] == b'\x1f\x8b':
        html = gzip.decompress(html)
    html = html.decode()
    
    match = re.search(r'href=\"//duckduckgo.com/l/\?uddg=([^\"&]+)', html)
    if match:
        print(urllib.parse.unquote(match.group(1)))
")
    
    if [ -n "$url" ]; then
        echo "Opening: $url"
        open "$url"
    else
        echo "No results found"
    fi
}

# Usage
search_and_open "Python documentation"
```

### ✅ Search with JSON Output
```bash
# Get search results as JSON
search_json() {
    python3 -c "
import urllib.request, urllib.parse, re, gzip, json
from html import unescape

query = '$1'
url = f'https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}'

req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

with urllib.request.urlopen(req) as response:
    html = response.read()
    if html[:2] == b'\x1f\x8b':
        html = gzip.decompress(html)
    html = html.decode()
    
    results = []
    blocks = re.findall(r'<div[^>]*class=\"result[^\"]*\"[^>]*>.*?</div>\s*</div>', html, re.DOTALL)
    
    for block in blocks[:5]:
        title_match = re.search(r'class=\"result__title\".*?<a[^>]*>(.*?)</a>', block, re.DOTALL)
        url_match = re.search(r'href=\"//duckduckgo.com/l/\?uddg=([^\"&]+)', block)
        
        if title_match and url_match:
            results.append({
                'title': unescape(re.sub('<[^>]+>', '', title_match.group(1))).strip(),
                'url': urllib.parse.unquote(url_match.group(1))
            })
    
    print(json.dumps(results, indent=2))
"
}

# Usage
search_json "JavaScript frameworks"
```

---

## Utility Commands

### ✅ Check App Running Status
```bash
# Check if an app is running
osascript -e 'tell application "System Events" to (name of processes) contains "Messages"' && echo "Messages is running" || echo "Messages is not running"

# List all running apps
osascript -e 'tell application "System Events" to name of every process whose visible is true'
```

### ✅ Activate App and Wait
```bash
# Function to safely activate an app
activate_app() {
    local app_name="$1"
    osascript -e "tell application \"$app_name\" to activate" && sleep 1
}

# Usage
activate_app "Contacts"
```

### ✅ Convert Between Script Types
```bash
# AppleScript to JavaScript equivalent
# AppleScript: tell application "Notes" to count notes
# JavaScript:
osascript -l JavaScript -e 'Application("Notes").notes().length'

# Run JavaScript with delay
osascript -l JavaScript -e '
const app = Application("Contacts");
app.activate();
delay(1);  // Wait 1 second
app.people().length;
'
```

### ✅ Error Handling
```bash
# Safe command execution with error handling
run_applescript() {
    local script="$1"
    result=$(osascript -e "$script" 2>&1)
    if [ $? -eq 0 ]; then
        echo "Success: $result"
        return 0
    else
        echo "Error: $result"
        return 1
    fi
}

# Usage
run_applescript 'tell application "Contacts" to count people'
```

### ✅ JSON Output Helper
```bash
# Function to get JSON output from JXA
get_json() {
    local script="$1"
    osascript -l JavaScript -e "$script" | python3 -m json.tool
}

# Usage
get_json 'JSON.stringify({test: "value", number: 123})'
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. "Application isn't running" Error
```bash
# Solution: Activate the app first
osascript -e 'tell application "AppName" to activate' && sleep 2
# Then run your command
```

#### 2. "Can't get object" Error
```bash
# Solution: Check if object exists first
osascript -e '
tell application "Mail"
    if (count of accounts) > 0 then
        name of account 1
    else
        return "No accounts configured"
    end if
end tell
'
```

#### 3. Permission Denied Errors
```bash
# Check and fix permissions
tccutil reset All com.apple.Terminal  # Reset Terminal permissions
# Then re-grant permissions in System Settings
```

#### 4. Database Access Issues
```bash
# For Messages database, ensure Full Disk Access is granted
# System Settings → Privacy & Security → Full Disk Access → Add Terminal
```

#### 5. Script Timeout Issues
```bash
# Add timeout handling
osascript -e 'with timeout of 10 seconds
    tell application "Mail" to check for new mail
end timeout'
```

### Debug Mode
```bash
# Enable verbose output for debugging
export OSASCRIPT_DEBUG=1
osascript -e 'tell application "Contacts" to count people'

# Check AppleScript errors
osascript -s o -e 'tell application "Contacts" to count people' 2>&1
```

### Performance Tips

1. **Use JXA over AppleScript** when possible - it's more reliable
2. **Activate apps before querying** them
3. **Add delays** between commands for stability
4. **Cache results** when doing multiple operations
5. **Use batch operations** when processing multiple items

---

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never hardcode sensitive data** in scripts
2. **Be cautious with Messages/Mail** sending commands
3. **Limit database access** to read-only operations
4. **Review scripts** before running them
5. **Use environment variables** for sensitive values

```bash
# Example: Safe credential handling
export PHONE_NUMBER="+1234567890"
osascript -e "tell application \"Messages\" to send \"Test\" to buddy \"$PHONE_NUMBER\""
```

---

## Advanced Examples

### Create Daily Summary
```bash
#!/bin/bash
# Daily summary script

echo "=== Daily Summary ==="
echo ""

# Unread emails
echo "📧 Emails:"
osascript -e 'tell application "Mail" to get unread count of inbox' 2>/dev/null

# Today's calendar events  
echo "📅 Today's Events:"
osascript -e '
tell application "Calendar"
    set today to current date
    set tomorrow to today + (1 * days)
    set eventCount to 0
    repeat with cal in calendars
        set eventCount to eventCount + (count of (events of cal whose start date ≥ today and start date < tomorrow))
    end repeat
    return eventCount & " events today"
end tell
' 2>/dev/null

# Incomplete reminders
echo "✅ Pending Reminders:"
osascript -e '
tell application "Reminders"
    set incompleteCount to 0
    repeat with lst in lists
        set incompleteCount to incompleteCount + (count of (reminders of lst whose completed is false))
    end repeat
    return incompleteCount & " incomplete tasks"
end tell
' 2>/dev/null
```

---

## Contributing

To test new commands or report issues:
1. Test commands in Terminal first
2. Document any permission requirements
3. Include error handling examples
4. Submit to: https://github.com/dhravya/apple-mcp

---

## License

These commands are provided as-is for educational purposes. Use responsibly and in accordance with Apple's terms of service.

---

**Last Updated**: January 10, 2025  
**Tested on**: macOS (Latest)  
**Maintained by**: Apple MCP Community