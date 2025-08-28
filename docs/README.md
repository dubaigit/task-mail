# Task Mail Documentation

This directory contains comprehensive documentation for setting up, testing, and developing the Task Mail application.

## 📚 Available Documentation

### Setup & Installation

- **[Ubuntu Testing Setup Guide](./UBUNTU_TESTING_SETUP.md)** - Complete step-by-step guide for setting up the application on Ubuntu using local PostgreSQL instead of Docker
- **[Quick Start Ubuntu Guide](./QUICK_START_UBUNTU.md)** - Condensed setup commands for quick deployment

### Architecture Overview

The Task Mail application uses a two-database architecture:

1. **Source Database**: Apple Mail SQLite (read-only)
   - Contains email data from Apple Mail
   - For testing: Fake SQLite database with sample data
   - Location: `database/fake-apple-mail/fake-envelope-index.sqlite`

2. **Target Database**: PostgreSQL (read/write)
   - Stores processed email data and application state
   - Accessed via PostgREST REST API
   - Replaces Supabase for local development

### Services Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Apple Mail    │    │   Task Mail      │    │   PostgreSQL    │
│   SQLite DB     │───▶│   Backend        │───▶│   Database      │
│   (Source)      │    │   (Processing)   │    │   (Target)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   PostgREST      │
                       │   REST API       │
                       │   (Port 3001)    │
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   React          │
                       │   Frontend       │
                       │   (Port 3000)    │
                       └──────────────────┘
```

### Testing Environment

The Ubuntu testing setup provides:

- **PostgreSQL 14+** running on localhost:5432
- **PostgREST 12.0.1** providing REST API on localhost:3001
- **Fake Apple Mail Database** with realistic test data:
  - 23 email messages
  - 7 mailboxes
  - 25 subjects
  - 20 email addresses
  - 29 recipients
  - 6 attachments

### Security Considerations

- ✅ **OpenAI API Key**: Stored as environment variable (never in files)
- ✅ **Database Credentials**: Configured for local development
- ✅ **JWT Secrets**: Configurable via environment
- ⚠️ **PostgREST**: Runs without authentication (add auth for production)

### Development Workflow

1. **Setup**: Follow Ubuntu Testing Setup Guide
2. **Development**: Use local PostgreSQL + PostgREST
3. **Testing**: Fake Apple Mail database provides realistic data
4. **Debugging**: Test server available for basic functionality verification

### Troubleshooting

Common issues and solutions are documented in the setup guides:

- Server startup hangs
- Database connection issues
- PostgREST configuration problems
- Missing environment variables
- API key configuration

### File Structure

```
docs/
├── README.md                    # This file - documentation index
├── UBUNTU_TESTING_SETUP.md      # Complete Ubuntu setup guide
└── QUICK_START_UBUNTU.md        # Quick setup commands
```

### Contributing

When adding new documentation:

1. Follow the existing format and structure
2. Include practical examples and commands
3. Add troubleshooting sections for common issues
4. Update this index file with new documentation

### Related Files

- `../README.md` - Main project README with Ubuntu testing section
- `../test-report.md` - Comprehensive testing report
- `../.env.example` - Environment configuration template (defaults: SUPABASE_URL http://127.0.0.1:3001; DB_USER supabase_admin; DB_PASSWORD apple_secure_2024; DB_NAME postgres; APPLE_MAIL_DB_PATH defaults to fake DB)
- `../dashboard/frontend/.env.example` - Frontend env template (REACT_APP_API_URL http://localhost:8000; REACT_APP_SUPABASE_URL http://127.0.0.1:54321)
- Use `npm run bootstrap` to auto-copy env examples, start Docker, init DB, and start services

