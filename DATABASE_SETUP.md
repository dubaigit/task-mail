# 🔧 Database Setup Guide

## 🎯 Quick Start (Safe Default)

Your `.env` is configured to use the **fake Apple Mail database** by default - safe for testing and development!

```bash
# Current default in .env (✅ SAFE)
APPLE_MAIL_DB_PATH=/Users/iamomen/task-mail/database/fake-apple-mail/fake-envelope-index.sqlite
```

This fake database contains:
- 23 realistic test emails
- Various scenarios (work, personal, system notifications)
- Safe to experiment with - won't touch your real email

## 🏠 For Production (Real Apple Mail)

To use your actual Apple Mail data, edit `.env`:

```bash
# Comment out the fake database
# APPLE_MAIL_DB_PATH=/Users/iamomen/task-mail/database/fake-apple-mail/fake-envelope-index.sqlite

# Uncomment the real Apple Mail path
APPLE_MAIL_DB_PATH=/Users/iamomen/Library/Mail/V10/MailData/Envelope Index
```

## 🔄 Switching Between Databases

### Switch to Fake (Testing)
```bash
# Edit .env file
APPLE_MAIL_DB_PATH=/Users/iamomen/task-mail/database/fake-apple-mail/fake-envelope-index.sqlite

# Restart services
npx pm2 restart all
```

### Switch to Real (Production)
```bash
# Edit .env file  
APPLE_MAIL_DB_PATH=/Users/iamomen/Library/Mail/V10/MailData/Envelope Index

# Restart services
npx pm2 restart all
```

## 🛠️ Database Management

### Rebuild Fake Database
```bash
npm run fake:db        # Create fresh fake database
npm run fake:data      # Add 50 more test emails  
npm run fake:reset     # Rebuild + add more data
```

### Check Current Database
```bash
# View current path in use
grep APPLE_MAIL_DB_PATH .env

# Check if fake database exists
ls -la database/fake-apple-mail/fake-envelope-index.sqlite
```

## 🚨 Important Notes

- **Default is SAFE**: Fake database prevents accidental real email access
- **.env is gitignored**: Your configuration won't be committed
- **Real path is commented**: Must explicitly uncomment for production
- **Mac only**: Real Apple Mail path only works on macOS
- **Read-only**: Both databases are accessed read-only for safety

## ✅ Current Status

✅ **Fake database exists**: Ready for testing  
✅ **.env configured**: Using fake database by default  
✅ **Gitignore setup**: .env file won't be committed  
✅ **Safe defaults**: Won't accidentally access real email