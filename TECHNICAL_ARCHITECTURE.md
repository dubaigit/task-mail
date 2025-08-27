# 🏗️ Apple MCP - Technical Architecture Documentation

**A comprehensive technical analysis of the Apple Mail Control Panel (MCP) - Email Intelligence Dashboard**

---

## 📋 Executive Summary

Apple MCP is a sophisticated **email intelligence system** that transforms Apple Mail into a task-centric productivity platform. The system leverages **AI-powered email classification** using GPT-5 models to automatically convert emails into actionable tasks, providing real-time collaboration tracking and intelligent draft generation.

### Core Technology Stack
- **Backend**: Node.js/Express with PostgreSQL + Redis
- **Frontend**: React 18+ with TypeScript, Tailwind CSS, and Radix UI
- **AI**: OpenAI GPT-5 (Mini/Nano models) with intelligent caching
- **Infrastructure**: Docker (Supabase + Redis), PM2 process management
- **Database**: Dual-architecture (Apple Mail SQLite + Supabase PostgreSQL)

---

## 🗂️ Project Structure Analysis

### 📁 Root Level (2.65 MiB total)
```
apple-mcp/
├── 📜 server.js (46.69 KiB)          # Main backend server - Express app with security
├── 📜 ai_service.js (16.07 KiB)      # AI processing service - GPT-5 integration
├── 📋 docker-compose.yml (5.61 KiB) # Infrastructure services (Supabase + Redis)
├── 📊 package.json (4.49 KiB)       # Backend dependencies & scripts
└── 📝 README.md (13.75 KiB)         # Project documentation
```

---

## 🏛️ Architecture Components

### 1. 🖥️ Backend Services (`src/` - 55 directories, 116 files)

#### **Core Server (`server.js` - 46.69 KiB)**
- **Express.js application** with comprehensive security middleware
- **Rate limiting**: General (100 req/15min), Auth (5 req/15min), AI (20 req/hour)
- **Security headers**: Helmet, CORS, request sanitization
- **Performance monitoring**: Request timing, slow query detection
- **Graceful error handling**: Sanitized error responses

**Key Features:**
```javascript
// Security stack
app.use(createSecurityHeaders());
app.use(createSecureCors());
app.use('/api', generalLimiter);
app.use(sanitizeRequest);

// Performance monitoring
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log(`⚠️ Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  next();
});
```

#### **AI Processing Service (`ai_service.js` - 16.07 KiB)**
- **Multi-model AI integration**: GPT-5 Mini/Nano with fallback strategies
- **Intelligent caching**: Redis + local cache with budget tracking
- **Budget management**: Daily ($10) and monthly ($100) spending limits
- **Error resilience**: Graceful degradation when AI services unavailable

**Budget Tracking System:**
```javascript
this.usageStats = {
  gpt5_nano: { requests: 0, tokens: 0, cost: 0 },
  gpt5_mini: { requests: 0, tokens: 0, cost: 0 },
  daily_budget: 10.0,
  monthly_budget: 100.0,
  current_daily_spending: 0,
  current_monthly_spending: 0
};
```

### 2. 🗄️ Database Architecture (`src/database/` - 6 subdirectories)

#### **Dual Database Strategy**
- **Primary**: Apple Mail SQLite (read-only sync)
- **Secondary**: Supabase PostgreSQL (application data)
- **Sync Engine**: Real-time bidirectional synchronization

#### **Key Components:**
- **`OptimizedDatabaseAgent.js`** (20.33 KiB) - High-performance query engine
- **`SupabaseConnectionManager.js`** (22.18 KiB) - Connection pooling & health monitoring  
- **`UnifiedDataLayer.js`** (30.94 KiB) - Abstraction layer for dual databases
- **`apple-mail-sync.js`** (17.45 KiB) - Apple Mail SQLite to Supabase sync

#### **Performance Optimizations:**
```sql
-- Critical indexes for sub-50ms queries
CREATE INDEX CONCURRENTLY idx_messages_sender_date 
ON messages(sender_address_id, date_received DESC);

CREATE INDEX CONCURRENTLY idx_messages_ai_processing_priority 
ON messages(ai_analyzed, flagged_flag, date_received) 
WHERE COALESCE(ai_analyzed, false) = false;
```

### 3. 🎯 API Layer (`src/api/` - 6 subdirectories)

#### **Enhanced Endpoints (`EnhancedEndpoints.js` - 16.07 KiB)**
- **Sub-50ms response times** through aggressive caching
- **Batch operations** for bulk email processing
- **Real-time WebSocket integration** for live updates
- **Intelligent query optimization** with cached aggregations

#### **Security & Authentication (`src/middleware/`)**
- **`security.js`** (6.82 KiB) - CORS, CSP, security headers
- **`auth.js`** (19.45 KiB) - JWT authentication, role-based access control
- **SQL injection protection** with parameterized queries

### 4. ⚡ Real-time Communication (`src/websocket/`)

#### **WebSocket Manager (`WebSocketManager.js` - 13.38 KiB)**
- **Connection pooling** with room-based message routing
- **Heartbeat monitoring** (30s intervals) for connection health
- **Rate limiting** (10 connections per IP) for security
- **Event-driven architecture** for real-time task updates

### 5. 🤖 AI Processing (`src/ai/`)

#### **Async AI Processor (`AsyncAIProcessor.js` - 19.23 KiB)**
- **Priority-based job queue** (high/medium/low priority)
- **Batch processing** for optimal API usage
- **Load balancing** across multiple AI models
- **Comprehensive metrics** and performance tracking

---

## 🎨 Frontend Architecture (`dashboard/frontend/` - React 18+)

### **Core Application (`src/App.tsx`)**
- **TypeScript React 18+** with modern hooks
- **Theme system**: Dark/light mode with localStorage persistence
- **Route protection**: Authentication-based access control
- **Cache busting**: Deployment-aware cache invalidation

### **Component Architecture (`src/components/` - 62 files)**

#### **Task-Centric Interface (`TaskCentric/`)**
- **`TaskKanbanBoard.tsx`** - Drag-and-drop task management
- **`ColleagueTrackingDashboard.tsx`** - Real-time colleague status
- **`TaskDashboard.tsx`** - Unified task view with analytics

#### **Modern UI Components (`shared/ui/` - 65 files)**
- **Radix UI primitives** for accessibility compliance
- **Tailwind CSS** for consistent design system
- **Lucide React icons** for modern iconography
- **Responsive design** with mobile-first approach

#### **Performance Optimizations**
- **React.lazy()** for code splitting
- **Virtual scrolling** for large email lists
- **Memoization** for expensive calculations
- **Bundle optimization** targeting <500KB gzipped

### **Build System (`craco.config.js` - 10.20 KiB)**
- **Enhanced webpack configuration** without ejecting
- **Content-based hashing** for optimal caching
- **Code splitting** for vendor vs. application code
- **Performance budgets** enforced at build time

---

## 🗃️ Database Schema (`database/`)

### **Core Tables (Apple Mail Mirror)**
```sql
-- Messages table (core email storage)
CREATE TABLE messages (
    ROWID BIGSERIAL PRIMARY KEY,
    message_id TEXT UNIQUE,
    sender_address_id BIGINT REFERENCES addresses(ROWID),
    subject_id BIGINT REFERENCES subjects(ROWID),
    date_received TIMESTAMP,
    date_sent TIMESTAMP,
    content TEXT,
    ai_analyzed BOOLEAN DEFAULT FALSE,
    classification TEXT,
    confidence_score DECIMAL(3,2)
);

-- AI-enhanced task tracking
CREATE TABLE email_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_id BIGINT REFERENCES messages(ROWID),
    task_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    due_date TIMESTAMP,
    assigned_colleague VARCHAR(255),
    ai_confidence DECIMAL(3,2)
);
```

### **Performance Schema (`migrations/005_performance_optimization.sql`)**
- **18 strategically placed indexes** for query optimization
- **Partial indexes** for filtered queries (unread, flagged emails)
- **Composite indexes** for multi-column sorting
- **Materialized views** for dashboard aggregations

---

## 🐳 Infrastructure (`docker-compose.yml` - 5.61 KiB)

### **Services Architecture**
```yaml
services:
  # Database (Supabase PostgreSQL)
  supabase-db:
    image: supabase/postgres:15.1.1.78
    ports: ["5432:5432"]
    volumes:
      - supabase_db_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d

  # Authentication (Supabase Auth)
  supabase-auth:
    image: supabase/gotrue:v2.151.0
    ports: ["9999:9999"]
    
  # API Gateway (Supabase REST)
  supabase-rest:
    image: postgrest/postgrest:v12.0.1
    ports: ["3001:3000"]

  # Real-time (Supabase Realtime)
  supabase-realtime:
    image: supabase/realtime:v2.25.50
    ports: ["4000:4000"]

  # Caching (Redis)
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes
```

### **Development vs Production**
- **Local Development**: Backend/Frontend run locally, only infrastructure in Docker
- **Production**: Full containerization with PM2 process management
- **Health Checks**: All services have comprehensive health monitoring

---

## 🔄 Email Processing Pipeline

### **1. Apple Mail Sync (`src/services/apple-mail-sync.js`)**
```javascript
// Smart sync detection
const syncGap = await this.calculateSyncGap();
if (syncGap >= 100 || isEmpty) {
  await this.performFullSync();
} else {
  await this.performIncrementalSync();
}
```

### **2. AI Classification (`ai_service.js`)**
```javascript
// Email categorization with confidence scoring
const classification = await this.classifyEmail(emailContent, {
  categories: ['task', 'information', 'urgent', 'meeting', 'draft_needed'],
  confidence_threshold: 0.7
});
```

### **3. Task Generation (`AsyncAIProcessor.js`)**
- **Priority assessment** based on content analysis
- **Colleague extraction** from email headers and content
- **Deadline inference** from natural language processing
- **Action item extraction** with confidence scoring

---

## 📊 Performance Metrics & Optimization

### **Target Performance Standards**
- **API Response Time**: <50ms for cached queries
- **Page Load Time**: <2 seconds (95th percentile)
- **Bundle Size**: <500KB gzipped
- **Database Queries**: <100ms for complex operations

### **Current Optimizations**
- **Redis caching**: 15-minute TTL for dashboard data
- **Local caching**: 5-minute TTL for frequently accessed data
- **Database indexing**: 18 strategic indexes for query optimization
- **Frontend code splitting**: Lazy loading for non-critical components

### **Monitoring & Alerting**
```javascript
// Performance monitoring middleware
const performanceThresholds = {
  slow_query: 1000,    // 1 second
  memory_limit: 1024,  // 1GB
  error_rate: 0.05     // 5%
};
```

---

## 🔐 Security Implementation

### **Multi-layered Security**
1. **Request Level**: Rate limiting, CORS, input sanitization
2. **Application Level**: JWT authentication, role-based access
3. **Database Level**: Parameterized queries, connection encryption
4. **Infrastructure Level**: Docker network isolation, secret management

### **Security Headers**
```javascript
const securityHeaders = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"]
    }
  },
  hsts: { maxAge: 31536000, includeSubDomains: true }
};
```

---

## 🚀 Deployment & Operations

### **Process Management (`config/ecosystem.config.js`)**
```javascript
module.exports = {
  apps: [{
    name: 'apple-mcp',
    script: 'server.js',
    instances: 1,           // Single instance for Apple Mail access
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8000
    }
  }]
};
```

### **Health Monitoring**
- **Application health**: `/api/health` endpoint with dependency checks
- **Database health**: Connection pool monitoring, query performance
- **AI service health**: Budget tracking, response time monitoring
- **System health**: Memory usage, CPU utilization

---

## 📈 Scalability Considerations

### **Current Architecture Limits**
- **Single Apple Mail instance**: One user per deployment
- **Local SQLite access**: Mac-only compatibility
- **Memory usage**: ~1GB for optimal performance

### **Scaling Strategies**
1. **Horizontal scaling**: Multiple instances for different users
2. **Caching optimization**: Redis cluster for distributed caching
3. **Database optimization**: Read replicas for analytics queries
4. **AI optimization**: Request batching and intelligent caching

---

## 🔮 Future Enhancements

### **Planned Features**
- **Multi-user support**: Shared workspace capabilities
- **Advanced AI**: Custom model fine-tuning for better classification
- **Mobile app**: React Native client for mobile access
- **Calendar integration**: Automatic meeting scheduling from emails

### **Technical Debt**
- **Legacy components**: Gradual migration to modern React patterns
- **Test coverage**: Comprehensive end-to-end testing suite
- **Documentation**: API documentation with OpenAPI specification
- **Monitoring**: Production-grade observability stack

---

## 🛠️ Development Environment

### **Quick Start**
```bash
# Infrastructure services
docker-compose up -d

# Backend server  
npm start  # Port 8000

# Frontend development
cd dashboard/frontend && npm start  # Port 3000
```

### **Key Development Scripts**
```json
{
  "test": "jest --config tests/jest.config.js",
  "test:e2e": "playwright test",
  "test:a11y": "playwright test tests/accessibility/",
  "build": "npm run build:frontend",
  "validate": "node scripts/validate-integration.js"
}
```

---

## 📊 Key Metrics Summary

| Component | Files | Size | Purpose |
|-----------|--------|------|---------|
| **Backend Core** | `server.js` | 46.69 KiB | Main Express application |
| **AI Service** | `ai_service.js` | 16.07 KiB | GPT-5 integration & caching |
| **Database Layer** | 15 files | ~200 KiB | Dual-database architecture |
| **API Layer** | 8 files | ~100 KiB | Enhanced endpoints & batch ops |
| **Frontend Core** | 116+ files | 1+ MiB | React TypeScript application |
| **Infrastructure** | `docker-compose.yml` | 5.61 KiB | Supabase + Redis services |

**Total Project Size**: 2.65 MiB (excluding node_modules)
**File Count**: 171 files across 55 directories
**Technology Stack**: 12 major technologies with 50+ dependencies

---

## 🏁 Conclusion

Apple MCP represents a **production-ready email intelligence platform** that successfully transforms traditional email workflows into a modern, AI-powered task management system. The architecture demonstrates:

- ✅ **Scalable design** with separation of concerns
- ✅ **Security-first approach** with comprehensive protection layers  
- ✅ **Performance optimization** targeting sub-50ms response times
- ✅ **Modern development practices** with TypeScript, testing, and CI/CD
- ✅ **Maintainable codebase** with clear documentation and structure

The system is **ready for production deployment** and provides a solid foundation for future enhancements and scaling.

---

*Last Updated: January 2025*  
*Architecture Version: 1.0.0*  
*Document Version: 1.0*

