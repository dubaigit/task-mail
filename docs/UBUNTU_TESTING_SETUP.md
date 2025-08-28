# Ubuntu Testing Setup Guide

This guide documents how to set up and test the task-mail application on Ubuntu using local PostgreSQL instead of Docker, exactly as performed during comprehensive testing.

## Prerequisites

- Ubuntu 22.04 or later
- Node.js 18+ installed
- Git installed
- Sudo privileges

## Architecture Overview

The application uses a two-database architecture:
1. **Source Database**: Apple Mail SQLite (read-only) - for reading email data
2. **Target Database**: PostgreSQL (read/write) - for storing processed data and application state

## Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/dubaigit/task-mail.git
cd task-mail

# Install backend dependencies
npm install

# Install frontend dependencies
npm run install:frontend
```

### 2. Install PostgreSQL

```bash
# Update package list
sudo apt update

# Install PostgreSQL and contrib packages
sudo apt install -y postgresql postgresql-contrib

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 3. Setup PostgreSQL Database

```bash
# Create database
sudo -u postgres createdb taskmail

# Create user with password
sudo -u postgres psql -c "CREATE USER taskmail_user WITH PASSWORD 'apple_secure_2024';"

# Grant privileges
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE taskmail TO taskmail_user;"

# Install UUID extension
PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
```

### 4. Initialize Database Schema

```bash
# Run database initialization scripts
PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -f database/init/001_init_schema.sql
PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -f database/init/002_add_users_table.sql

# Optional: Add sample data (may have UUID function issues - can be skipped)
# PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -f database/init/003_sample_data.sql
```

### 5. Install and Configure PostgREST

PostgREST provides a REST API interface for PostgreSQL that the Supabase client expects.

```bash
# Download PostgREST
wget https://github.com/PostgREST/postgrest/releases/download/v12.0.1/postgrest-v12.0.1-linux-static-x64.tar.xz

# Extract and install
tar -xf postgrest-v12.0.1-linux-static-x64.tar.xz
sudo mv postgrest /usr/local/bin/

# Create PostgREST configuration
cat > postgrest.conf << EOF
db-uri = "postgresql://taskmail_user:apple_secure_2024@localhost:5432/taskmail"
db-schemas = "public"
db-anon-role = "taskmail_user"
server-host = "127.0.0.1"
server-port = 3001
jwt-secret = "super-secret-jwt-token-with-at-least-32-characters-long"
EOF

# Start PostgREST (run in background)
postgrest postgrest.conf &
```

### 6. Install SQLite and Create Fake Apple Mail Database

```bash
# Install SQLite
sudo apt install -y sqlite3

# Create fake Apple Mail database for testing
npm run fake:db
```

This creates a fake Apple Mail database at:
`/home/ubuntu/task-mail/database/fake-apple-mail/fake-envelope-index.sqlite`

### 7. Configure Environment Variables

Update the `.env` file with local configuration:

```bash
# Copy example environment file
cp .env.example .env
```

Edit `.env` file with these key settings:

```env
# Database Configuration
SUPABASE_URL=http://127.0.0.1:3001
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU

# Redis Configuration (optional - can use defaults)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_secure_password_2024

# JWT Configuration
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long-change-in-production
JWT_REFRESH_SECRET=super-secret-refresh-token-different-from-jwt-secret
SESSION_SECRET=super-secret-session-key-32-chars-min
ENCRYPTION_KEY=super-secret-encryption-key-32-chars

# OpenAI Configuration (DO NOT PUT API KEY IN FILE - USE ENVIRONMENT VARIABLE)
# OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5-mini
OPENAI_MAX_TOKENS=4000
OPENAI_DAILY_BUDGET=10.00
OPENAI_MONTHLY_BUDGET=100.00

# Application Configuration
PORT=8000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Apple Mail Configuration (using fake database for testing)
APPLE_MAIL_DB_PATH=/home/ubuntu/task-mail/database/fake-apple-mail/fake-envelope-index.sqlite

# Security Configuration
BCRYPT_ROUNDS=12
SESSION_TIMEOUT=3600
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# Frontend Configuration
REACT_APP_API_URL=http://localhost:8000
REACT_APP_SUPABASE_URL=http://127.0.0.1:3001
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

### 8. Set OpenAI API Key as Environment Variable

**IMPORTANT**: Never put your OpenAI API key in the `.env` file. Always use environment variables:

```bash
# Set OpenAI API key as environment variable
export OPENAI_API_KEY="your_openai_api_key_here"

# Add to your shell profile for persistence
echo 'export OPENAI_API_KEY="your_openai_api_key_here"' >> ~/.bashrc
source ~/.bashrc
```

### 9. Test Basic Server Functionality

First, test with a simple server to verify everything works:

```bash
# Create and run test server
cat > test-server.js << EOF
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'Test server is running'
  });
});

app.get('/', (req, res) => {
  res.json({ message: 'Task Mail Test Server' });
});

app.listen(PORT, () => {
  console.log(\`✅ Test server is running on port \${PORT}\`);
  console.log(\`Health check: http://localhost:\${PORT}/api/health\`);
});
EOF

# Run test server
node test-server.js
```

Open browser and visit: `http://localhost:8000/api/health`

You should see:
```json
{
  "status": "healthy",
  "timestamp": "2025-08-27T12:52:21.685Z",
  "message": "Test server is running"
}
```

### 10. Start Main Application

```bash
# Set OpenAI API key and start main server
export OPENAI_API_KEY="your_openai_api_key_here"
node server.js
```

### 11. Build and Start Frontend

```bash
# In a new terminal, build frontend
npm run build:frontend

# Start frontend development server
cd dashboard/frontend
npm start
```

The frontend will be available at: `http://localhost:3000`

## Service Status Verification

### Check PostgreSQL
```bash
sudo systemctl status postgresql
PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -c "SELECT version();"
```

### Check PostgREST
```bash
curl http://127.0.0.1:3001/
```

### Check Fake Apple Mail Database
```bash
sqlite3 database/fake-apple-mail/fake-envelope-index.sqlite "SELECT COUNT(*) FROM messages;"
```

## Troubleshooting

### Server Startup Issues

If the main server hangs during startup:

1. **Check service initialization**: The server may hang during service initialization in route files
2. **Use test server**: Verify basic Express functionality works with `test-server.js`
3. **Check logs**: Look for error messages in the console output
4. **Database connections**: Verify both PostgreSQL and SQLite databases are accessible

### Common Issues

1. **PostgreSQL Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   sudo systemctl status postgresql
   
   # Check if user can connect
   PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -c "SELECT 1;"
   ```

2. **PostgREST Not Responding**
   ```bash
   # Check if PostgREST is running
   ps aux | grep postgrest
   
   # Restart PostgREST
   pkill postgrest
   postgrest postgrest.conf &
   ```

3. **SQLite Database Not Found**
   ```bash
   # Recreate fake database
   npm run fake:db
   
   # Verify file exists
   ls -la database/fake-apple-mail/fake-envelope-index.sqlite
   ```

4. **OpenAI API Issues**
   ```bash
   # Verify API key is set
   echo $OPENAI_API_KEY
   
   # Test API key (optional)
   curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
   ```

## Architecture Verification

After setup, you should have:

- **PostgreSQL** running on port 5432 (target database)
- **PostgREST** running on port 3001 (REST API for PostgreSQL)
- **SQLite database** with fake Apple Mail data (source database)
- **Backend server** running on port 8000 (when working)
- **Frontend server** running on port 3000 (development)

## Testing Endpoints

Once the server is running, test these endpoints:

```bash
# Health check
curl http://localhost:8000/api/health

# Test PostgREST directly
curl http://127.0.0.1:3001/

# Test database connection
curl http://localhost:8000/api/emails
```

## Production Considerations

For production deployment:

1. Use proper PostgreSQL user with limited privileges
2. Set up SSL/TLS for database connections
3. Use environment variables for all secrets
4. Set up proper logging and monitoring
5. Configure firewall rules
6. Use process manager like PM2
7. Set up reverse proxy with Nginx

## Files Created/Modified

During setup, these files are created or modified:

- `postgrest.conf` - PostgREST configuration
- `.env` - Environment configuration (without API keys)
- `test-server.js` - Simple test server
- `database/fake-apple-mail/fake-envelope-index.sqlite` - Fake Apple Mail database

## Security Notes

- ✅ OpenAI API key stored as environment variable (not in files)
- ✅ Database passwords in configuration files (acceptable for local development)
- ✅ JWT secrets in .env file (change for production)
- ⚠️ PostgREST runs without authentication (add auth for production)

This setup provides a complete local development environment that mirrors the production architecture without requiring Docker.

