# Technology Stack

## Frontend

### Core Technologies
- **React 18.2.0** - Component-based UI framework
- **TypeScript 5.x** - Type-safe JavaScript
- **Zustand** - Lightweight state management
- **React Router 6** - Client-side routing
- **TailwindCSS** - Utility-first CSS framework

### UI Components & Libraries
- **React Window 1.8.11** - Virtual scrolling for performance
- **React Error Boundary 6.0.0** - Error handling
- **Recharts** - Data visualization
- **Framer Motion** - Animation library
- **React Hook Form** - Form management

### Build Tools
- **Create React App** - Build configuration
- **Craco** - CRA configuration override
- **Webpack 5** - Module bundler
- **Babel 7.26** - JavaScript transpiler

## Backend

### Core Technologies
- **Node.js 16+** - JavaScript runtime
- **Express 4.18.2** - Web application framework
- **TypeScript** - Type safety for Node.js

### Database & Storage
- **PostgreSQL** - Primary database (via Supabase)
- **Redis 5.8.1** - Caching and session storage
- **SQLite 5.1.1** - Local development database
- **Better SQLite3 12.2.0** - SQLite driver

### Authentication & Security
- **JWT (jsonwebtoken 9.0.2)** - Token-based auth
- **Bcrypt 5.1.1** - Password hashing
- **Helmet 7.1.0** - Security headers
- **Express Rate Limit 8.0.1** - Rate limiting
- **CORS 2.8.5** - Cross-origin resource sharing

### AI & ML
- **OpenAI SDK 5.12.2** - GPT-5 integration
- **Natural 8.1.0** - Natural language processing
- **Claude Flow 2.0.0-alpha.90** - AI workflow management

### Real-time & Messaging
- **WebSocket (ws 8.15.1)** - Real-time communication
- **Node Cache 5.1.2** - In-memory caching

### Validation & Schema
- **Zod 3.22.4** - Runtime type validation
- **Joi 18.0.1** - Object schema validation
- **Express Validator 7.0.1** - Request validation

## Infrastructure

### Containerization & Orchestration
- **Docker** - Container runtime
- **Docker Compose** - Multi-container orchestration
- **PM2 (ecosystem.config.js)** - Process management

### Services
- **Supabase** - PostgreSQL hosting & auth
- **Redis** - Cache and session store
- **Nginx** - Reverse proxy (production)

## Development & Testing

### Testing Frameworks
- **Jest 30.0.5** - Unit and integration testing
- **Playwright 1.55.0** - E2E testing
- **Supertest 7.0.0** - API testing
- **Testing Library** - React component testing

### Development Tools
- **Nodemon 3.0.1** - Auto-restart on file changes
- **Winston 3.11.0** - Logging framework
- **Chalk 5.6.0** - Terminal styling
- **Dotenv 16.3.1** - Environment management

### Code Quality
- **ESLint** - JavaScript linting
- **Prettier** - Code formatting
- **TypeScript Compiler** - Type checking
- **Husky** - Git hooks

## Monitoring & Observability

### Logging
- **Winston** - Structured logging
- **Morgan** - HTTP request logging

### Performance
- **Performance Benchmarks** - Custom performance tests
- **Database Query Monitoring** - Query performance tracking
- **Cache Hit Rate Monitoring** - Cache efficiency tracking

## External Integrations

### Apple Ecosystem
- **Apple Mail** - Email synchronization
- **AppleScript** - Native mail integration

### Cloud Services
- **OpenAI API** - AI/ML capabilities
- **Supabase** - Backend as a Service

## Package Management

### Dependencies
- **npm** - Node package manager
- **package-lock.json** - Dependency lock file

## Version Requirements

### Runtime
- **Node.js**: >=16.0.0
- **npm**: >=7.0.0
- **PostgreSQL**: 14+
- **Redis**: 6+

### Browser Support
- **Chrome**: Latest 2 versions
- **Safari**: Latest 2 versions
- **Firefox**: Latest 2 versions
- **Edge**: Latest 2 versions