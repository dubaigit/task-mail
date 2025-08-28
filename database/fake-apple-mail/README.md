# Fake Apple Mail Database for Testing

This directory contains a complete fake Apple Mail SQLite database system that mimics the structure and data of a real Apple Mail "Envelope Index" database. This allows you to test the email sync service without accessing real email data.

## 🎯 Purpose

- **Safe Testing**: Test email sync functionality without touching real email data
- **Development**: Develop and debug features with consistent, predictable data
- **CI/CD**: Run automated tests with reliable fake data
- **Demo**: Demonstrate functionality with realistic email scenarios

## 📁 Files

- **`create-fake-envelope-index.sql`** - Database schema matching Apple Mail structure
- **`seed-fake-data.sql`** - Realistic fake email data (23 messages)
- **`build-fake-database.js`** - Script to create the complete fake database
- **`generate-more-data.js`** - Script to add additional fake emails
- **`fake-envelope-index.sqlite`** - Generated fake database file (created by scripts)

## 🚀 Quick Start

### 1. Build the Fake Database

```bash
# Create the fake database with initial data
npm run fake:db
```

This creates `fake-envelope-index.sqlite` with:
- 23 realistic email messages
- 25 unique subjects
- 20+ email addresses (work colleagues, clients, systems)
- 7 mailboxes (INBOX, Sent, Work, Personal, etc.)
- 6 attachments
- Full message content for testing

### 2. Switch to Fake Database

Edit your `.env` file:

```bash
# Comment out the real database path
# APPLE_MAIL_DB_PATH=/Users/username/Library/Mail/V10/MailData/Envelope Index

# Uncomment the fake database path
APPLE_MAIL_DB_PATH=/home/ubuntu/task-mail/database/fake-apple-mail/fake-envelope-index.sqlite
```

### 3. Restart Your Application

```bash
npx pm2 restart all
```

The sync service will now read from the fake database instead of real Apple Mail.

## 📧 What's Included

### Email Scenarios
- **Work emails**: Team meetings, code reviews, project updates
- **System notifications**: Server alerts, security notifications
- **Client communications**: Support tickets, project discussions  
- **Personal emails**: Newsletters, shopping confirmations
- **Various states**: Read/unread, flagged, with attachments

### Realistic Data
- **Timestamps**: Emails from today, yesterday, this week, last week
- **Recipients**: Proper to/cc/bcc recipient handling
- **Attachments**: PDFs, spreadsheets, images with realistic sizes
- **Mailboxes**: INBOX, Sent, Work, Personal, Drafts, Trash
- **Content**: Full email bodies for select messages

## 🔧 Advanced Usage

### Generate More Test Data

```bash
# Add 50 more fake emails
npm run fake:data

# Add custom amount
node database/fake-apple-mail/generate-more-data.js 100
```

### Reset to Fresh Data

```bash
# Rebuild database + add more data
npm run fake:reset
```

### Database Structure

The fake database includes all Apple Mail tables:

- **`messages`** - Main email storage (ROWID, message_id, subject, sender, dates, flags)
- **`subjects`** - Normalized subject storage
- **`addresses`** - Email addresses with display names
- **`recipients`** - To/CC/BCC recipients (type: 0=to, 1=cc, 2=bcc)
- **`mailboxes`** - Folder structure (INBOX, Sent, etc.)
- **`attachments`** - File attachments with names and sizes
- **`message_data`** - Email content/body text

## 🔄 Switching Between Real and Fake Data

### Use Fake Data (Testing)
```bash
# .env file
APPLE_MAIL_DB_PATH=/home/ubuntu/task-mail/database/fake-apple-mail/fake-envelope-index.sqlite
```

### Use Real Apple Mail (Production)
```bash
# .env file  
APPLE_MAIL_DB_PATH=/Users/username/Library/Mail/V10/MailData/Envelope Index
```

After changing the path, restart the application:
```bash
npx pm2 restart all
```

## 📊 NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run fake:db` | Build fresh fake database |
| `npm run fake:data` | Add more fake emails (50 default) |
| `npm run fake:reset` | Rebuild + add more data |

## 🧪 Testing Scenarios

The fake database includes these test scenarios:

1. **Unread urgent emails** - Test notification systems
2. **Flagged important emails** - Test prioritization
3. **Emails with attachments** - Test attachment handling  
4. **Draft messages** - Test draft sync functionality
5. **Various timestamps** - Test date filtering and sorting
6. **Multiple recipients** - Test to/cc/bcc handling
7. **Different mailboxes** - Test folder organization

## ⚠️ Important Notes

### Read-Only Safety
The fake database is accessed read-only by the sync service, just like real Apple Mail. This prevents accidental data corruption.

### Performance
The fake database is much smaller than a real Apple Mail database, so sync operations will be faster during testing.

### Consistency
Each time you run `npm run fake:db`, you get the same baseline data. Use `npm run fake:data` to add variability.

### Path Requirements
Use absolute paths in the `.env` file. Relative paths may not work correctly with the sync service.

## 🔍 Debugging

### Check Database Contents
```bash
# Open SQLite CLI
sqlite3 database/fake-apple-mail/fake-envelope-index.sqlite

# View message count
SELECT COUNT(*) FROM messages;

# View recent messages
SELECT subjects.subject, addresses.address, datetime(messages.date_received, 'unixepoch') as date
FROM messages 
JOIN subjects ON messages.subject = subjects.ROWID 
JOIN addresses ON messages.sender = addresses.ROWID 
ORDER BY messages.date_received DESC 
LIMIT 10;
```

### Verify Sync Service
```bash
# Check if sync service detects the fake database
npm run sync:status
```

### View Logs
```bash
npx pm2 logs apple-mail-sync
```

## 🚨 Troubleshooting

### "Database not found" Error
- Verify the path in `.env` is absolute and correct
- Run `npm run fake:db` to create the database
- Check file permissions

### "No new messages" in Sync
- The fake database has fixed timestamps
- Restart sync service after switching databases
- Check that `APPLE_MAIL_DB_PATH` points to fake database

### Sync Service Won't Start
- Ensure fake database file exists
- Check that SQLite3 module is installed
- Verify no file locks on the database

## 🎯 Next Steps

1. **Build fake database**: `npm run fake:db`
2. **Update .env**: Point to fake database path  
3. **Restart services**: `npx pm2 restart all`
4. **Test your features**: Develop with consistent fake data
5. **Add more data**: `npm run fake:data` for additional emails
6. **Switch back**: Change .env to real Apple Mail when ready for production

The fake database gives you a realistic Apple Mail environment for safe testing and development!
