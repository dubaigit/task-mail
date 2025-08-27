# Apple MCP - Email Intelligence Dashboard
## Complete Project Documentation

## 🎯 Project Overview

Apple MCP (Mail Control Panel) is an advanced email intelligence system that integrates with Apple Mail to provide AI-powered task management. It automatically classifies, prioritizes, and organizes emails using GPT-5 models, transforming your inbox into a productivity powerhouse.

### Key Features
- **AI Email Classification**: Automatic categorization using GPT-5 Mini/Nano
- **Task-Centric Interface**: Convert emails to actionable tasks
- **Smart Prioritization**: AI-driven importance scoring
- **Real-time Sync**: Bidirectional sync with Apple Mail
- **Analytics Dashboard**: Visual insights into email patterns
- **Mobile Optimized**: Responsive design for all devices

## 🏗️ System Architecture

### Three-Tier Architecture

#### 1. **Presentation Layer** (React Frontend)
- **Location**: `dashboard/frontend/`
- **Tech**: React 18, TypeScript, Tailwind CSS, Radix UI
- **State**: Zustand for global state management
- **Components**:
  - Email management UI
  - Task-centric dashboard
  - Analytics visualizations
  - AI-powered features
  - Mobile-responsive layouts

#### 2. **Application Layer** (Node.js Backend)
- **Location**: Root directory (`server.js`, `ai_service.js`)
- **Tech**: Express.js, Node.js
- **Features**:
  - RESTful API endpoints
  - WebSocket for real-time updates
  - AI service integration
  - Security middleware
  - Rate limiting
  - Request sanitization

#### 3. **Data Layer** (Dual Database)
- **Primary DB**: Apple Mail SQLite (read-only)
- **Secondary DB**: Supabase PostgreSQL
- **Cache**: Redis for performance
- **Sync Engine**: Real-time bidirectional sync

### AI Integration Architecture

```
User Request → Express Server → AI Service
                                    ↓
                            Redis Cache Check
                                    ↓
                        [Cache Hit?] → Return Cached
                                    ↓ No
                            GPT-5 API Call
                                    ↓
                        Budget Check ($10/day limit)
                                    ↓
                        Model Selection (Mini/Nano)
                                    ↓
                            Process & Cache
                                    ↓
                            Return Response
```

## 📁 Project Structure

```
apple-mcp/
├── 🔧 Backend Core
│   ├── server.js                 # Express server (46.69 KB)
│   ├── ai_service.js            # AI integration (16.07 KB)
│   ├── package.json             # Backend dependencies
│   └── docker-compose.yml       # Infrastructure setup
│
├── 🎨 Frontend Application
│   └── dashboard/frontend/
│       ├── src/
│       │   ├── components/     # React components
│       │   │   ├── AI/        # AI features
│       │   │   ├── Analytics/ # Data viz
│       │   │   ├── Email/     # Email UI
│       │   │   ├── TaskCentric/ # Task hub
│       │   │   └── Mobile/    # Mobile UI
│       │   ├── stores/        # Zustand stores
│       │   ├── hooks/         # Custom hooks
│       │   ├── types/         # TypeScript defs
│       │   └── utils/         # Utilities
│       └── package.json       # Frontend deps
│
├── 🗄️ Backend Services
│   └── src/
│       ├── database/          # DB services
│       ├── services/          # Business logic
│       └── config/            # Configuration
│
└── 🔧 Configuration
    ├── .env.example           # Environment template
    ├── config.yml             # App config
    └── tsconfig.json          # TypeScript config
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js >= 16.0.0
- Docker & Docker Compose
- npm or yarn
- macOS (for Apple Mail integration)

### Environment Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd apple-mcp
```

2. **Configure environment variables**
```bash
cp .env.example .env
cp .env.supabase.example .env.supabase
# Edit .env files with your credentials
```

Required variables:
- `OPENAI_API_KEY`: Your OpenAI API key
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: Secret for JWT tokens

3. **Install dependencies**
```bash
# Install all dependencies
npm run setup
# This runs: npm install && cd dashboard/frontend && npm install && npm run build
```

## 🏃 Running the Application

### Method 1: Full Stack Start (Recommended)
```bash
# Start everything with one command
npm run start:full
# or
./start.sh
```

### Method 2: Manual Start
```bash
# 1. Start infrastructure (Supabase + Redis)
docker-compose up -d

# 2. Start backend server
npm run dev  # Development with hot reload
# or
npm start    # Production

# 3. Start frontend (new terminal)
cd dashboard/frontend
npm start
```

### Access Points
- 🌐 **Frontend**: http://localhost:3000
- 🔧 **Backend API**: http://localhost:8000
- 📊 **API Health**: http://localhost:8000/api/health
- 🗄️ **Supabase Studio**: http://localhost:54323

## 🔒 Security Features

### Rate Limiting
- **General API**: 100 requests / 15 minutes
- **Authentication**: 5 requests / 15 minutes  
- **AI Endpoints**: 20 requests / hour

### Security Headers
- Helmet.js for security headers
- CORS configuration
- XSS protection
- CSRF protection
- Content Security Policy

### Data Protection
- JWT authentication
- bcrypt password hashing
- Input sanitization
- SQL injection prevention
- Environment variable isolation

## 🤖 AI Service Details

### Models & Fallback Strategy
1. **Primary**: GPT-5 Mini (balanced performance)
2. **Fallback**: GPT-5 Nano (cost-effective)
3. **Cache**: Redis caching for repeated queries

### Budget Management
- **Daily Limit**: $10.00
- **Monthly Limit**: $100.00
- **Token Tracking**: Per-request monitoring
- **Cost Optimization**: Intelligent model selection

### AI Features
- Email classification
- Priority scoring
- Task extraction
- Smart summarization
- Draft generation
- Sentiment analysis

## 🗄️ Database Architecture

### Dual Database System

#### Apple Mail SQLite (Read-Only)
- **Purpose**: Source of truth for emails
- **Access**: Read-only sync
- **Location**: `~/Library/Mail/V10/MailData/Envelope\ Index`
- **Tables**: messages, addresses, mailboxes

#### Supabase PostgreSQL
- **Purpose**: Application data & metadata
- **Features**: 
  - Task management
  - User preferences
  - AI processing results
  - Analytics data
- **Schema**: Managed migrations

#### Sync Strategy
```
Apple Mail SQLite → Sync Engine → Supabase PostgreSQL
                         ↓
                  Change Detection
                         ↓
                  Conflict Resolution
                         ↓
                  Real-time Updates
```

## 🧪 Testing Strategy

### Test Coverage
- **Unit Tests**: Core business logic
- **Integration Tests**: API endpoints
- **E2E Tests**: User workflows
- **Performance Tests**: Load testing
- **Security Tests**: Vulnerability scanning

### Running Tests
```bash
# All tests with coverage
npm run test:coverage

# Specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:performance
npm run test:gpt5
npm run test:database

# Frontend tests
cd dashboard/frontend
npm test
npm run test:e2e
npm run test:visual
npm run test:a11y
```

## 📊 Performance Optimization

### Caching Strategy
- **Redis**: API response caching
- **Local Cache**: In-memory caching
- **Browser Cache**: Static asset caching
- **CDN**: For production deployment

### Database Optimization
- Indexed queries for <50ms response
- Connection pooling
- Query optimization
- Batch operations

### Frontend Optimization
- Code splitting
- Lazy loading
- Virtual scrolling for large lists
- Optimistic UI updates
- Service workers for offline support

## 🚀 Deployment

### Production Build
```bash
# Build frontend
cd dashboard/frontend
npm run build:production

# Start production server
NODE_ENV=production npm start
```

### Docker Deployment
```bash
# Build and run with Docker
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Management
- Development: `.env.development`
- Staging: `.env.staging`
- Production: `.env.production`

## 🛠️ Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check if ports are in use
lsof -i :3000  # Frontend
lsof -i :8000  # Backend
lsof -i :54323 # Supabase
```

#### Docker Issues
```bash
# Reset Docker services
docker-compose down
docker-compose up -d --force-recreate

# View logs
docker-compose logs -f
```

#### Database Sync Issues
```bash
# Check sync status
npm run sync:status

# Force resync
npm run db:sync
```

## 📈 Monitoring & Logging

### Application Monitoring
- Request timing (>1000ms logged as slow)
- Error tracking with stack traces
- Performance metrics
- API usage statistics

### Log Locations
- Backend: Console output & `logs/` directory
- Frontend: Browser console
- Docker: `docker-compose logs`

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Make changes
3. Run tests
4. Submit PR
5. Code review
6. Merge to main

### Code Standards
- ESLint for linting
- Prettier for formatting
- TypeScript for type safety
- Jest for testing

## 📄 License
MIT License - See LICENSE file

## 🆘 Support
- GitHub Issues for bug reports
- Discussions for questions
- Wiki for documentation

## 🔄 Version History
- **v1.0.0**: Initial release with core features
- Email classification, task management, AI integration
- Dual database architecture
- Real-time sync capabilities