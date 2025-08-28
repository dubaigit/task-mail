Smart Install

Run:
npm run install:all

Reset:
npm run install:all -- --reset

Bootstrap:
npm run bootstrap

# 📧 Task Mail - Email Intelligence Dashboard

# Apple Mail Task-Centric Email Manager

> 🍎 **Task Mail** - A Production-Ready Email Intelligence System  
>   A sophisticated email task management system that integrates with Apple Mail to automatically classify, prioritize, and organize emails using AI-powered analysis. Built with React, Node.js, Supabase, and Redis.

## 🚀 Quick Start

### Option 1: One-Command Bootstrap (Recommended)
```bash
# Installs deps, starts Docker (Supabase + Redis), initializes DB, and starts PM2 (backend + frontend)
npm run bootstrap
```

### Option 2: PM2 Production Setup
```bash
# Install dependencies
npm install && npm run install:frontend

# Start with PM2 process manager
npx pm2 start ecosystem.config.js

# Development mode with auto-restart
npx pm2 restart all --watch
```

### Option 3: Ubuntu Local Setup (No Docker)
```bash
# Install PostgreSQL and setup database
sudo apt update && sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo -u postgres createdb taskmail
sudo -u postgres psql -c "CREATE USER taskmail_user WITH PASSWORD 'apple_secure_2024';"

# Initialize database schema
PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -f database/init/001_init_schema.sql

# Install PostgREST for REST API
wget https://github.com/PostgREST/postgrest/releases/download/v12.0.1/postgrest-v12.0.1-linux-static-x64.tar.xz
tar -xf postgrest-v12.0.1-linux-static-x64.tar.xz && sudo mv postgrest /usr/local/bin/
echo 'db-uri = "postgresql://taskmail_user:apple_secure_2024@localhost:5432/taskmail"
db-schemas = "public"
db-anon-role = "taskmail_user"
server-host = "127.0.0.1"
server-port = 3001' > postgrest.conf
postgrest postgrest.conf &

# Create fake Apple Mail database for testing
npm run fake:db

# Set OpenAI API key in .env, then bootstrap
# echo 'OPENAI_API_KEY=your_openai_api_key_here' >> .env
npm run bootstrap
```

**Access the application:**
- 🌐 **Frontend**: http://localhost:3000 (or http://localhost:3001 for development)
- 🔧 **Backend API**: http://localhost:8000
- 📊 **Health Check**: http://localhost:8000/api/health

### Environment Setup
⚠️ **Important**: Copy `.env.example` to `.env` and configure your OpenAI API key:
```bash
cp .env.example .env
# Edit .env and add: OPENAI_API_KEY=your_openai_api_key_here
```

## 📁 Project Structure

```
task-mail/
├── 📄 Core Application Files
│   ├── server.js                     # Main backend server (Node.js/Express)
│   ├── ai_service.js                 # AI integration service (GPT-5)
│   ├── package.json                  # Backend dependencies
│   ├── package-lock.json             # Dependency lock file
│   ├── tsconfig.json                 # TypeScript configuration
│   └── docker-compose.yml            # Infrastructure services (Supabase + Redis)
│
├── 🎨 Frontend Application
│   └── dashboard/
│       ├── frontend/                 # React frontend application
│       │   ├── src/
│       │   │   ├── components/       # React components
│       │   │   │   ├── AI/           # AI-powered features
│       │   │   │   ├── Analytics/    # Data visualization
│       │   │   │   ├── Email/        # Email management
│       │   │   │   ├── TaskCentric/  # Task management hub
│       │   │   │   ├── Mobile/       # Mobile optimizations
│       │   │   │   └── ui/           # Shared UI components
│       │   │   ├── stores/           # Zustand state management
│       │   │   ├── hooks/            # Custom React hooks
│       │   │   ├── types/            # TypeScript definitions
│       │   │   └── utils/            # Utility functions
│       │   ├── public/               # Static assets
│       │   ├── package.json          # Frontend dependencies
│       │   └── craco.config.js       # Build configuration
│       └── requirements.txt          # Python dependencies (if any)
│
├── 🗄️ Backend Source Code
│   └── src/
│       ├── api/                      # API layer
│       │   ├── routes/               # API route handlers
│       │   ├── middleware/           # Express middleware
│       │   ├── core/                 # Core API services
│       │   └── EnhancedEndpoints.js  # Performance-optimized endpoints
│       ├── database/                 # Database layer
│       │   ├── services/             # Database services
│       │   ├── interfaces/           # Database interfaces
│       │   ├── OptimizedDatabaseAgent.js # Main database handler
│       │   └── secure-queries.js     # Parameterized queries
│       ├── ai/                       # AI processing
│       │   └── AsyncAIProcessor.js   # Queue-based AI processing
│       ├── auth/                     # Authentication
│       │   ├── secure-auth-routes.js # Auth routes
│       │   └── session-manager.js    # Session management
│       ├── websocket/                # Real-time communication
│       │   └── WebSocketManager.js   # WebSocket server
│       ├── middleware/               # Express middleware
│       │   ├── auth.js               # Authentication middleware
│       │   ├── security.js           # Security middleware
│       │   └── configuration.js      # Configuration middleware
│       ├── services/                 # Business services
│       │   ├── apple-mail-sync.js    # Apple Mail integration
│       │   └── SyncService.js        # Data synchronization
│       ├── knowledge-base/           # Knowledge management
│       │   ├── api-gateway.js        # Microservice gateway
│       │   ├── search-service.js     # Search functionality
│       │   └── TagManager.js         # Tag management
│       ├── cache/                    # Caching layer
│       │   └── CacheCoordinator.js   # Multi-tier cache management
│       ├── domain/                   # Domain-driven design
│       │   ├── email-management/     # Email domain
│       │   ├── task-processing/      # Task domain
│       │   ├── user-auth/           # User domain
│       │   └── shared/              # Shared domain logic
│       ├── security/                 # Security utilities
│       │   └── sql-sanitizer.js     # SQL injection prevention
│       └── utils/                    # Utility functions
│           └── logger.js            # Logging utilities
│
├── 🗃️ Database & Migrations
│   └── database/
│       ├── init/                     # Initial database setup
│       │   ├── 001_init_schema.sql   # Base schema
│       │   ├── 002_add_users_table.sql # User tables
│       │   └── 003_sample_data.sql   # Sample data
│       ├── migrations/               # Database migrations
│       │   ├── 001_add_ai_optimization_features.sql
│       │   ├── 002_fix_schema_alignment.sql
│       │   ├── 003_fix_column_references.sql
│       │   ├── 004_final_schema_fix.sql
│       │   ├── 005_performance_optimization.sql
│       │   ├── 006_knowledge_base_schema.sql
│       │   ├── 007_enhanced_knowledge_base_schema.sql
│       │   ├── 008_comprehensive_tagging_system.sql
│       │   └── 009_auth_tables.sql
│       ├── supabase-migrations/      # Supabase-specific migrations
│       │   └── 001_create_supabase_schema.sql
│       └── apple_mail_replica.db     # Local Apple Mail database replica
│
├── 🐳 Infrastructure Configuration
│   ├── supabase/                     # Supabase configuration
│   │   ├── migrations/               # Supabase migrations
│   │   ├── seed/                     # Seed data
│   │   └── docker-compose.local.yml  # Local Supabase setup
│   └── config/                       # Application configuration
│       ├── ecosystem.config.js       # PM2 configuration
│       ├── .env.example              # Environment template
│       ├── docker-compose.yml        # Docker configuration
│       ├── kong/                     # API gateway config
│       └── vector/                   # Vector database config
│
├── 📝 Configuration Files
│   ├── .env.example                  # Environment variables template
│   ├── .env.supabase.example         # Supabase environment template
│   ├── .dockerignore                 # Docker ignore rules
│   ├── .gitignore                    # Git ignore rules
│   └── LICENSE                       # MIT License
│
├── 📊 Development Tools
│   ├── .claude/                      # Claude IDE configuration
│   │   ├── hooks/                    # Development hooks
│   │   ├── slash-commands.json       # Custom commands
│   │   └── settings.local.json       # IDE settings
│   ├── .cursor/                      # Cursor IDE settings
│   └── logs/                         # Application logs
│       └── .gitkeep                  # Keep logs directory
│
└── 🗂️ Archive & Backup
    └── .old/                         # Archived files
        ├── docs/                     # Previous documentation
        ├── tests/                    # Test suites
        ├── scripts/                  # Utility scripts
        ├── docker/                   # Docker configurations
        ├── architecture/             # Architecture documentation
        ├── reports/                  # Analysis reports
        └── [various backup files]    # Previous versions
```

## ✨ Key Features

### 🎯 Core Functionality
- **AI-Powered Email Classification**: GPT-5 models for automatic email categorization
- **Task Extraction**: Converts emails into actionable tasks with priority levels
- **Smart Filtering**: Advanced search and filtering capabilities
- **Real-time Sync**: Live synchronization with Apple Mail database
- **Usage Analytics**: Comprehensive AI usage statistics and cost tracking

### 📊 Dashboard Features
- **Task-Centric View**: Organized email tasks by priority and category
- **Analytics Dashboard**: Detailed insights into email patterns and AI usage
- **Category Management**: Flexible categorization system
- **Status Tracking**: Real-time processing status and queue management
- **Cost Monitoring**: Track AI API costs and usage patterns

### 🔧 Technical Features
- **Optimized Database Performance**: Connection pooling and query optimization
- **Secure API Design**: Input validation, sanitization, and security headers
- **Responsive UI**: Modern React components with accessibility support
- **Real-time Updates**: Automatic refresh and live status indicators
- **Error Handling**: Comprehensive error management and user feedback

## 🏗️ Architecture

### Backend Stack
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis for session management and caching
- **AI Integration**: OpenAI API (GPT-5 Mini/Nano models)
- **Security**: CORS, input validation, request sanitization

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **State Management**: Zustand for global state
- **Build Tool**: Create React App with Craco
- **Styling**: Tailwind CSS with responsive design
- **Testing**: Jest and React Testing Library

### Modern Architecture
- **Database**: Supabase (Cloud-native PostgreSQL + Auth + REST API + Realtime)
- **Caching**: Redis
- **Process Management**: PM2 for production deployment
- **Development**: Hot reload and live debugging

## 📦 Prerequisites

### Required Software
- **Node.js**: Version 18 or higher
- **Docker**: For Supabase and Redis containers
- **Git**: For version control

### API Keys
- **OpenAI API Key**: Required for AI email classification
  - Sign up at [OpenAI Platform](https://platform.openai.com/)
  - Add API key to `.env` file

### System Requirements
- **macOS**: For Apple Mail database access
- **RAM**: Minimum 4GB recommended
- **Disk Space**: At least 2GB free space

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd task-mail
```

### 2. Install Dependencies
```bash
# Backend dependencies
npm install

# Frontend dependencies
cd dashboard/frontend && npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Database Configuration
POSTGRES_PASSWORD=apple_secure_2024
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long

# Application Configuration
PORT=8000
CORS_ORIGIN=http://localhost:3000
```

### 4. Start Everything
```bash
# Single command: installs, starts Docker services, initializes DB, and starts PM2
npm run bootstrap
```

### 5. Advanced (optional)
```bash
# If you prefer manual control:
docker compose up -d            # Start Supabase + Redis
npm run db:init                 # Initialize database
npx pm2 start ecosystem.config.js
```

## 🐧 Ubuntu Testing Setup (Alternative to Docker)

For testing and development on Ubuntu without Docker, we provide comprehensive documentation for setting up local PostgreSQL and all required services.

### Quick Start - Ubuntu Testing
```bash
# Complete setup in one go
git clone https://github.com/dubaigit/task-mail.git
cd task-mail
npm install && npm run install:frontend

# Install PostgreSQL and setup database
sudo apt update && sudo apt install -y postgresql postgresql-contrib sqlite3
sudo systemctl start postgresql
sudo -u postgres createdb taskmail
sudo -u postgres psql -c "CREATE USER taskmail_user WITH PASSWORD 'apple_secure_2024';"

# Initialize database schema
PGPASSWORD=apple_secure_2024 psql -h localhost -U taskmail_user -d taskmail -f database/init/001_init_schema.sql

# Install and start PostgREST (REST API for PostgreSQL)
wget https://github.com/PostgREST/postgrest/releases/download/v12.0.1/postgrest-v12.0.1-linux-static-x64.tar.xz
tar -xf postgrest-v12.0.1-linux-static-x64.tar.xz && sudo mv postgrest /usr/local/bin/
echo 'db-uri = "postgresql://taskmail_user:apple_secure_2024@localhost:5432/taskmail"
db-schemas = "public"
db-anon-role = "taskmail_user"
server-host = "127.0.0.1"
server-port = 3001' > postgrest.conf
postgrest postgrest.conf &

# Create fake Apple Mail database for testing
npm run fake:db

# Set OPENAI in .env and use bootstrap instead of direct node
# echo 'OPENAI_API_KEY=your_openai_api_key_here' >> .env
npm run bootstrap
```

### 📚 Detailed Ubuntu Setup Documentation

- **[Complete Ubuntu Testing Setup Guide](./docs/UBUNTU_TESTING_SETUP.md)** - Comprehensive step-by-step instructions
- **[Quick Start Ubuntu Guide](./docs/QUICK_START_UBUNTU.md)** - Condensed setup commands
- **Architecture**: Uses local PostgreSQL + PostgREST instead of Supabase Docker
- **Testing Database**: Includes fake Apple Mail SQLite database with sample data
- **Security**: OpenAI API key stored as environment variable (not in files)

### Ubuntu Testing Features
- ✅ **Local PostgreSQL** database with full schema
- ✅ **PostgREST** providing REST API (replaces Supabase)
- ✅ **Fake Apple Mail Database** with 23 test messages
- ✅ **Complete Environment** setup without Docker
- ✅ **Security Best Practices** for API key management
- ✅ **Troubleshooting Guide** for common issues

## 🎮 Usage

### API Endpoints

#### Health Check
```bash
GET /api/health
# Returns: { status: "healthy", database: "connected", timestamp: "..." }
```

#### AI Usage Statistics
```bash
GET /api/ai/usage-stats
# Returns: Usage metrics including costs, processing counts, and balance
```

#### Email Classification
```bash
POST /api/ai/classify-email
Content-Type: application/json

{
  "content": "Email content here...",
  "subject": "Email subject",
  "sender": "sender@example.com"
}
```

#### Task Management
```bash
GET /api/tasks?limit=50&offset=0&filter=pending
# Returns: Paginated list of email tasks with metadata
```

## 🔐 Security Features

- **Input Validation**: Comprehensive request validation
- **SQL Injection Prevention**: Parameterized queries
- **Rate Limiting**: Protects against API abuse
- **CORS Protection**: Configured for specific origins
- **Authentication**: JWT-based authentication system
- **Error Sanitization**: Prevents information leakage

## 🚀 Performance Optimizations

- **Database Connection Management**: Optimized Supabase connections
- **Multi-tier Caching**: Local + Redis caching strategy
- **Query Optimization**: Indexed queries and prepared statements
- **Real-time Updates**: WebSocket for live synchronization
- **Bundle Optimization**: Code splitting and lazy loading

## 📈 Monitoring & Analytics

- **Health Endpoints**: System health monitoring
- **Usage Tracking**: AI API usage and costs
- **Performance Metrics**: Response times and throughput
- **Error Tracking**: Comprehensive error logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- **Health Check**: http://localhost:8000/api/health
- **Frontend**: http://localhost:3000
- **API Documentation**: Available at `/api` endpoints

---

**Built with ❤️ for efficient email management and AI-powered productivity**
