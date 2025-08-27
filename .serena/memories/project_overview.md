# Apple MCP - Email Intelligence Dashboard

## Project Purpose
A sophisticated email task management system that integrates with Apple Mail to automatically classify, prioritize, and organize emails using AI-powered analysis. It transforms Apple Mail into a task-centric productivity platform.

## Tech Stack

### Backend
- **Node.js/Express**: Main backend server (server.js) with comprehensive security middleware
- **PostgreSQL**: Supabase PostgreSQL for application data
- **SQLite**: Apple Mail SQLite database for read-only sync
- **Redis**: Caching layer for performance optimization
- **AI Integration**: OpenAI GPT-5 models (Mini/Nano) with intelligent fallback strategies

### Frontend
- **React 18+**: Frontend framework with TypeScript
- **Tailwind CSS**: Styling framework
- **Radix UI**: Component library
- **Zustand**: State management
- **React Router**: Client-side routing
- **Recharts**: Data visualization

### Infrastructure
- **Docker**: Containerization (docker-compose.yml for Supabase + Redis)
- **PM2**: Process management
- **Supabase**: Backend-as-a-Service for PostgreSQL

## Architecture Highlights

### Dual Database Architecture
- Primary: Apple Mail SQLite (read-only sync)
- Secondary: Supabase PostgreSQL (application data)
- Real-time bidirectional synchronization engine

### AI Service Features
- Multi-model support (GPT-5 Mini/Nano)
- Intelligent caching with Redis
- Budget management ($10 daily, $100 monthly limits)
- Graceful degradation strategies

### Security Features
- Rate limiting (General: 100 req/15min, Auth: 5 req/15min, AI: 20 req/hour)
- Security headers via Helmet
- CORS configuration
- Request sanitization
- Performance monitoring