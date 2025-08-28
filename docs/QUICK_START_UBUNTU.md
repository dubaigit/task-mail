# Quick Start Guide - Ubuntu Testing

This is a condensed version of the full Ubuntu testing setup. For detailed instructions, see [UBUNTU_TESTING_SETUP.md](./UBUNTU_TESTING_SETUP.md).

## Prerequisites
- Ubuntu 22.04+
- Node.js 18+
- Sudo privileges

## Quick Setup Commands

```bash
# 1. Clone and install
git clone https://github.com/dubaigit/task-mail.git
cd task-mail
npm install && npm run install:frontend

# 2. Install PostgreSQL
sudo apt update && sudo apt install -y postgresql postgresql-contrib sqlite3

# 3. Setup database
sudo systemctl start postgresql
sudo -u postgres createdb taskmail
sudo -u postgres psql -c "CREATE USER taskmail_user WITH PASSWORD 'apple_secure_2024';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE taskmail TO taskmail_user;"

# 4. Initialize schema
PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -f database/init/001_init_schema.sql
PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -f database/init/002_add_users_table.sql

# 5. Install PostgREST
wget https://github.com/PostgREST/postgrest/releases/download/v12.0.1/postgrest-v12.0.1-linux-static-x64.tar.xz
tar -xf postgrest-v12.0.1-linux-static-x64.tar.xz
sudo mv postgrest /usr/local/bin/

# 6. Configure PostgREST
cat > postgrest.conf << EOF
db-uri = "postgresql://taskmail_user:apple_secure_2024@localhost:5432/taskmail"
db-schemas = "public"
db-anon-role = "taskmail_user"
server-host = "127.0.0.1"
server-port = 3001
jwt-secret = "super-secret-jwt-token-with-at-least-32-characters-long"
EOF

# 7. Start PostgREST
postgrest postgrest.conf &

# 8. Create fake Apple Mail database
npm run fake:db

# 9. Set OpenAI API key (REQUIRED)
export OPENAI_API_KEY="your_openai_api_key_here"

# 10. Test basic functionality
node test-server.js
# Visit: http://localhost:8000/api/health
```

## Environment Configuration

Update `.env` file with (defaults for Ubuntu/dev):
```env
SUPABASE_URL=http://127.0.0.1:3001
APPLE_MAIL_DB_PATH=/home/ubuntu/task-mail/database/fake-apple-mail/fake-envelope-index.sqlite
# Optional (macOS only): switch to real Apple Mail database by uncommenting and updating the path
# APPLE_MAIL_DB_PATH=/Users/your-username/Library/Mail/V10/MailData/Envelope Index
```

**IMPORTANT**: Never put OpenAI API key in `.env` file. Always use environment variable.

## Verification

```bash
# Check PostgreSQL
sudo systemctl status postgresql

# Check PostgREST
curl http://127.0.0.1:3001/

# Check fake database
sqlite3 database/fake-apple-mail/fake-envelope-index.sqlite "SELECT COUNT(*) FROM messages;"

# Test health endpoint
curl http://localhost:8000/api/health
```

## Architecture

- **PostgreSQL**: localhost:5432 (target database)
- **PostgREST**: localhost:3001 (REST API)
- **SQLite**: Fake Apple Mail data (source database)
- **Backend**: localhost:8000
- **Frontend**: localhost:3000

## Troubleshooting

1. **Server hangs**: Check service initialization in route files
2. **Database connection**: Verify PostgreSQL is running and user has access
3. **PostgREST issues**: Restart with `pkill postgrest && postgrest postgrest.conf &`
4. **Missing API key**: Ensure `OPENAI_API_KEY` environment variable is set

For detailed troubleshooting, see the full setup guide.

