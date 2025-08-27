# Suggested Commands for Apple MCP

## Development Commands

### Quick Start
```bash
# Start infrastructure services (Supabase + Redis)
docker-compose up -d

# Start backend server
node server.js
# or with nodemon for development
npm run dev

# Start frontend (in another terminal)
cd dashboard/frontend && npm start
```

### Full Stack Commands
```bash
# Full setup (install all dependencies and build)
npm run setup

# Start everything
npm run start:full
./start.sh

# Development mode with hot reload
npm run dev:full
```

## Testing Commands

### Backend Tests
```bash
# All tests
npm test

# Test coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific test suites
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:gpt5
npm run test:database
npm run test:e2e
```

### Frontend Tests
```bash
cd dashboard/frontend

# Run tests
npm test

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# Visual regression tests
npm run test:visual

# Accessibility tests
npm run test:a11y
```

## Build Commands

### Frontend Build
```bash
cd dashboard/frontend
npm run build

# Production build with performance audit
npm run build:production
```

### Backend Build
```bash
# Build frontend from root
npm run build:frontend
```

## Database Commands

```bash
# Initialize databases
npm run db:init

# Sync databases
npm run db:sync

# Check sync status
npm run sync:status
```

## Validation & Quality

```bash
# Validate integration
npm run validate

# Fix validation issues
npm run validate:fix
```

## System Utilities (Darwin/macOS)

```bash
# Git commands
git status
git add .
git commit -m "message"
git push

# Directory navigation
ls -la
cd directory
pwd

# Process management
ps aux | grep node
kill -9 PID

# Docker
docker ps
docker-compose logs -f
docker-compose restart

# Environment variables
export NODE_ENV=development
source .env
```

## Ports & Access
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Health Check: http://localhost:8000/api/health
- Supabase Studio: http://localhost:54323