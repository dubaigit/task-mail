# Email Intelligence System - Production Architecture

## Executive Summary

This document outlines the complete production architecture for a scalable email intelligence system that processes 8k-20k emails with ≤10s response times, real-time updates, and AI-powered task generation and draft creation.

## System Architecture Overview

```mermaid
graph TB
    %% Frontend Layer
    UI[React Frontend<br/>- Real-time UI<br/>- Optimistic Updates<br/>- WebSocket Client]
    
    %% Load Balancer
    LB[Load Balancer<br/>nginx/HAProxy<br/>- SSL Termination<br/>- Rate Limiting]
    
    %% API Layer
    API1[FastAPI Server 1<br/>- REST Endpoints<br/>- WebSocket Manager<br/>- Authentication]
    API2[FastAPI Server 2<br/>- REST Endpoints<br/>- WebSocket Manager<br/>- Authentication]
    
    %% Background Workers
    EW[Email Processor<br/>Workers<br/>- Apple Mail Sync<br/>- Content Extraction]
    AIW[AI Analysis<br/>Workers<br/>- GPT-5 Classification<br/>- Pattern Analysis]
    DW[Draft Generation<br/>Workers<br/>- GPT-5 Drafts<br/>- Template Fallback]
    MW[Maintenance<br/>Workers<br/>- Cache Cleanup<br/>- Metrics Collection]
    
    %% Queue System
    QUEUE[Redis Queue<br/>- Job Management<br/>- Priority Scheduling<br/>- Dead Letter Queue]
    
    %% Caching Layer
    CACHE[Redis Cache<br/>- Analysis Results<br/>- Session Data<br/>- Real-time Analytics]
    
    %% Database Layer
    PGPRI[PostgreSQL Primary<br/>- Application Data<br/>- Tasks & Drafts<br/>- User Analytics]
    PGREP[PostgreSQL Replica<br/>- Read Queries<br/>- Analytics<br/>- Reporting]
    
    %% External Data Source
    MAILDB[(Apple Mail SQLite<br/>- Email Content<br/>- Metadata<br/>- Read-Only Access)]
    
    %% External Services
    GPT5[OpenAI GPT-5<br/>- Classification<br/>- Draft Generation<br/>- Rate Limited]
    
    %% Data Flow
    UI --> LB
    LB --> API1
    LB --> API2
    
    API1 <--> CACHE
    API2 <--> CACHE
    API1 <--> PGPRI
    API2 <--> PGPRI
    API1 <--> PGREP
    API2 <--> PGREP
    
    API1 --> QUEUE
    API2 --> QUEUE
    
    QUEUE --> EW
    QUEUE --> AIW
    QUEUE --> DW
    QUEUE --> MW
    
    EW --> MAILDB
    EW --> PGPRI
    AIW --> GPT5
    AIW --> PGPRI
    DW --> GPT5
    DW --> PGPRI
    
    PGPRI --> PGREP
    
    %% Real-time Updates
    API1 -.->|WebSocket| UI
    API2 -.->|WebSocket| UI
    AIW -.->|Analysis Complete| API1
    DW -.->|Draft Ready| API2
```

## Performance Requirements & SLAs

| Operation | Target Response Time | Scalability |
|-----------|---------------------|-------------|
| Email List API | <200ms (cached) | 1k concurrent users |
| Task Creation | ≤10s (requirement) | 100 tasks/minute |
| Draft Generation | <10s (AI) / <2s (template) | 50 drafts/minute |
| Real-time Updates | <100ms delivery | 500 WebSocket connections |
| Batch Operations | Background processing | 1k emails/minute |
| Undo Operations | <30s window | Immediate rollback |

## Core Components

### 1. FastAPI Backend Servers
- **Purpose**: Handle API requests and WebSocket connections
- **Scaling**: 2-4 instances behind load balancer
- **Features**: JWT auth, rate limiting, real-time updates
- **Performance**: <200ms average response time

### 2. Background Worker System
- **Email Processors**: Sync Apple Mail DB → Application DB
- **AI Workers**: Classification and analysis using GPT-5
- **Draft Workers**: Generate AI-powered email responses
- **Maintenance**: Cache cleanup, metrics, archival

### 3. Data Architecture
- **Apple Mail SQLite**: Read-only source of truth
- **PostgreSQL**: Application data, analytics, user state
- **Redis**: Caching, job queue, session management

### 4. Real-time System
- **WebSocket Manager**: Broadcasts updates to connected clients
- **Event Types**: Analysis complete, task created, draft ready
- **Scaling**: Connection pooling and message broadcasting

## Technology Stack

### Backend
- **Framework**: FastAPI (async Python)
- **Database**: PostgreSQL 15+ with read replicas
- **Cache**: Redis 7+ with persistence
- **Queue**: Celery with Redis broker
- **Web Server**: Gunicorn with uvicorn workers

### AI Integration
- **Classification**: OpenAI GPT-5-nano (speed optimized)
- **Draft Generation**: OpenAI GPT-5-mini (cost optimized)
- **Fallback**: Pattern-based classification system

### Infrastructure
- **Load Balancer**: nginx or HAProxy
- **Monitoring**: Prometheus + Grafana
- **Logging**: Structured logging with ELK stack
- **Deployment**: Docker containers with orchestration

## Scalability Analysis

### Current Capacity (Single Instance)
- **API Server**: 1000 req/min
- **Email Processing**: 100 emails/min
- **AI Analysis**: 20 analyses/min (API limited)
- **Database**: 5k queries/min

### Horizontal Scaling Strategy
- **API Servers**: Linear scaling with load balancer
- **Workers**: Auto-scale based on queue depth
- **Database**: Read replicas for analytics queries
- **Cache**: Redis Cluster for high availability

### Bottleneck Analysis
1. **AI API Rate Limits**: Primary constraint (solved with queue)
2. **Database Writes**: Batch operations and connection pooling
3. **WebSocket Connections**: Connection pooling and broadcasting
4. **Memory Usage**: Efficient caching with TTL and LRU eviction

## Next Steps

1. **Database Schema Implementation** (In Progress)
2. **API Endpoint Design** 
3. **Background Worker Architecture**
4. **Caching Strategy Implementation**
5. **Deployment Pipeline Setup**
6. **Security Implementation**
7. **Performance Testing and Optimization**

---

**Document Status**: Architecture Complete ✅
**Next Deliverable**: Database Schema Design
**Last Updated**: 2025-08-14