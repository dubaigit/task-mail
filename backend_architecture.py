#!/usr/bin/env python3
"""
Production Backend Architecture for Email Intelligence System
FastAPI-based backend with WebSocket support, Redis caching, and PostgreSQL
Optimized for processing 10k+ emails with real-time features
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from contextlib import asynccontextmanager
import os
from pathlib import Path

# Core frameworks
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
import uvicorn

# Database and caching
import asyncpg
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import QueuePool

# Data models
from pydantic import BaseModel, Field, validator
from enum import Enum

# Monitoring and performance
import structlog
from prometheus_client import Counter, Histogram, Gauge, generate_latest
import psutil

# Task queue
from celery import Celery

# Email processing
from database_models import Email, EmailIntelligence, EmailTask, Base
from email_processor import EmailBatchProcessor

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)
logger = structlog.get_logger(__name__)

# Prometheus metrics
REQUESTS_TOTAL = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint'])
REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration')
ACTIVE_CONNECTIONS = Gauge('websocket_connections_active', 'Active WebSocket connections')
EMAILS_PROCESSED = Counter('emails_processed_total', 'Total emails processed')
PROCESSING_TIME = Histogram('email_processing_seconds', 'Email processing time')

# ============================================================================
# Configuration and Settings
# ============================================================================

class Settings(BaseModel):
    """Application settings"""
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./email_intelligence_production.db"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 30
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_DB: int = 0
    CACHE_TTL: int = 3600  # 1 hour
    
    # API Keys
    GPT5_NANO_API_KEY: Optional[str] = None
    GPT5_MINI_API_KEY: Optional[str] = None
    
    # Processing
    BATCH_SIZE: int = 100
    MAX_WORKERS: int = 10
    DEFAULT_EMAIL_MONTHS: int = 2
    
    # Security
    JWT_SECRET: str = "your-secret-key"
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080"]
    
    # Monitoring
    ENABLE_METRICS: bool = True
    LOG_LEVEL: str = "INFO"
    
    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30
    MAX_WS_CONNECTIONS: int = 100

    class Config:
        env_file = ".env"

settings = Settings()

# ============================================================================
# Data Models
# ============================================================================

class EmailClassification(str, Enum):
    NEEDS_REPLY = "needs_reply"
    APPROVAL_REQUIRED = "approval_required"
    CREATE_TASK = "create_task"
    DELEGATE = "delegate"
    FYI = "fyi"
    MEETING = "meeting"
    NEWSLETTER = "newsletter"
    AUTOMATED = "automated"

class UrgencyLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class EmailResponse(BaseModel):
    """Email response model"""
    id: int
    message_id: int
    subject_text: str
    sender_email: str
    sender_name: Optional[str]
    date_received: datetime
    is_read: bool
    is_flagged: bool
    processing_status: ProcessingStatus
    classification: Optional[EmailClassification]
    urgency: Optional[UrgencyLevel]
    confidence: Optional[float]

class BatchRequest(BaseModel):
    """Batch processing request"""
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    force_reprocess: bool = False
    batch_size: int = Field(default=100, ge=10, le=1000)

class TaskResponse(BaseModel):
    """Task response model"""
    id: int
    task_id: str
    subject: str
    description: str
    task_type: str
    priority: str
    assignee: Optional[str]
    due_date: Optional[datetime]
    status: str

class WebSocketMessage(BaseModel):
    """WebSocket message structure"""
    type: str
    data: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.now)

# ============================================================================
# Database Connection Management
# ============================================================================

class DatabaseManager:
    """Async database connection manager with connection pooling"""
    
    def __init__(self):
        self.engine = None
        self.session_maker = None
        self.redis = None
    
    async def initialize(self):
        """Initialize database connections"""
        logger.info("Initializing database connections")
        
        # PostgreSQL async engine with connection pooling
        self.engine = create_async_engine(
            settings.DATABASE_URL,
            poolclass=QueuePool,
            pool_size=settings.DATABASE_POOL_SIZE,
            max_overflow=settings.DATABASE_MAX_OVERFLOW,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=settings.LOG_LEVEL == "DEBUG"
        )
        
        # Create tables
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        # Session maker
        self.session_maker = async_sessionmaker(
            self.engine, expire_on_commit=False
        )
        
        # Redis connection
        self.redis = await aioredis.from_url(
            settings.REDIS_URL, 
            db=settings.REDIS_DB,
            encoding="utf-8",
            decode_responses=True
        )
        
        logger.info("Database connections initialized successfully")
    
    async def get_session(self) -> AsyncSession:
        """Get database session"""
        return self.session_maker()
    
    async def get_redis(self):
        """Get Redis connection"""
        return self.redis
    
    async def close(self):
        """Close database connections"""
        if self.redis:
            await self.redis.close()
        if self.engine:
            await self.engine.dispose()

# Global database manager
db_manager = DatabaseManager()

# ============================================================================
# WebSocket Connection Manager
# ============================================================================

class ConnectionManager:
    """WebSocket connection manager for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_subscriptions: Dict[str, List[str]] = {}  # user_id -> [subscription_types]
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept new WebSocket connection"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        ACTIVE_CONNECTIONS.set(len(self.active_connections))
        logger.info(f"WebSocket connected: {user_id}")
    
    def disconnect(self, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            if user_id in self.user_subscriptions:
                del self.user_subscriptions[user_id]
            ACTIVE_CONNECTIONS.set(len(self.active_connections))
            logger.info(f"WebSocket disconnected: {user_id}")
    
    async def send_personal_message(self, message: WebSocketMessage, user_id: str):
        """Send message to specific user"""
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_text(message.json())
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
                self.disconnect(user_id)
    
    async def broadcast(self, message: WebSocketMessage, subscription_type: str = None):
        """Broadcast message to all or filtered connections"""
        dead_connections = []
        
        for user_id, websocket in self.active_connections.items():
            # Filter by subscription if specified
            if subscription_type and user_id in self.user_subscriptions:
                if subscription_type not in self.user_subscriptions[user_id]:
                    continue
            
            try:
                await websocket.send_text(message.json())
            except Exception as e:
                logger.error(f"Error broadcasting to {user_id}: {e}")
                dead_connections.append(user_id)
        
        # Clean up dead connections
        for user_id in dead_connections:
            self.disconnect(user_id)
    
    def subscribe(self, user_id: str, subscription_types: List[str]):
        """Subscribe user to specific message types"""
        self.user_subscriptions[user_id] = subscription_types

manager = ConnectionManager()

# ============================================================================
# Celery Task Queue Setup
# ============================================================================

# Initialize Celery for background processing
celery_app = Celery(
    'email_intelligence',
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_routes={
        'process_email_batch': {'queue': 'batch_processing'},
        'process_single_email': {'queue': 'real_time'},
    }
)

# ============================================================================
# Background Tasks
# ============================================================================

@celery_app.task
def process_email_batch_task(batch_id: int, start_date: str, end_date: str):
    """Background task for batch email processing"""
    import asyncio
    return asyncio.run(_process_email_batch_async(batch_id, start_date, end_date))

async def _process_email_batch_async(batch_id: int, start_date: str, end_date: str):
    """Async batch processing implementation"""
    try:
        processor = EmailBatchProcessor()
        result = await processor.process_date_range(
            datetime.fromisoformat(start_date),
            datetime.fromisoformat(end_date),
            batch_id=batch_id
        )
        
        # Notify WebSocket clients
        await manager.broadcast(
            WebSocketMessage(
                type="batch_completed",
                data={"batch_id": batch_id, "result": result}
            ),
            subscription_type="batch_updates"
        )
        
        return result
    except Exception as e:
        logger.error(f"Batch processing failed: {e}")
        await manager.broadcast(
            WebSocketMessage(
                type="batch_failed",
                data={"batch_id": batch_id, "error": str(e)}
            ),
            subscription_type="batch_updates"
        )
        raise

# ============================================================================
# Authentication and Security
# ============================================================================

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extract user from JWT token (simplified for demo)"""
    # In production, verify JWT token and extract user info
    return {"user_id": "demo_user", "permissions": ["read", "write"]}

# ============================================================================
# FastAPI Application Setup
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Email Intelligence Backend")
    await db_manager.initialize()
    
    yield
    
    # Shutdown
    logger.info("Shutting down Email Intelligence Backend")
    await db_manager.close()

app = FastAPI(
    title="Email Intelligence API",
    description="Production backend for AI-powered email processing",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(),
        "version": "1.0.0",
        "database": "connected" if db_manager.engine else "disconnected",
        "redis": "connected" if db_manager.redis else "disconnected"
    }

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    if not settings.ENABLE_METRICS:
        raise HTTPException(status_code=404, detail="Metrics disabled")
    
    return generate_latest()

# Email endpoints
@app.get("/emails", response_model=List[EmailResponse])
async def get_emails(
    limit: int = 100,
    offset: int = 0,
    classification: Optional[EmailClassification] = None,
    urgency: Optional[UrgencyLevel] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user: dict = Depends(get_current_user)
):
    """Get emails with filtering and pagination"""
    REQUESTS_TOTAL.labels(method="GET", endpoint="/emails").inc()
    
    with REQUEST_DURATION.time():
        async with db_manager.get_session() as session:
            # Build query with filters
            query = session.query(Email).join(EmailIntelligence, isouter=True)
            
            if classification:
                query = query.filter(EmailIntelligence.classification == classification)
            if urgency:
                query = query.filter(EmailIntelligence.urgency == urgency)
            if start_date:
                query = query.filter(Email.date_received >= start_date)
            if end_date:
                query = query.filter(Email.date_received <= end_date)
            
            # Order and paginate
            query = query.order_by(Email.date_received.desc())
            query = query.offset(offset).limit(limit)
            
            results = await query.all()
            
            return [EmailResponse.from_orm(email) for email in results]

@app.get("/emails/{email_id}")
async def get_email(email_id: int, user: dict = Depends(get_current_user)):
    """Get specific email with full details"""
    async with db_manager.get_session() as session:
        email = await session.get(Email, email_id)
        if not email:
            raise HTTPException(status_code=404, detail="Email not found")
        
        return EmailResponse.from_orm(email)

@app.post("/emails/batch/process")
async def start_batch_processing(
    request: BatchRequest,
    background_tasks: BackgroundTasks,
    user: dict = Depends(get_current_user)
):
    """Start batch email processing"""
    # Default to 2 months if no dates specified
    if not request.start_date:
        request.start_date = datetime.now() - timedelta(days=settings.DEFAULT_EMAIL_MONTHS * 30)
    if not request.end_date:
        request.end_date = datetime.now()
    
    # Create batch record
    async with db_manager.get_session() as session:
        from database_models import EmailBatch
        
        batch = EmailBatch(
            batch_name=f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            start_date=request.start_date,
            end_date=request.end_date,
            status="pending"
        )
        session.add(batch)
        await session.commit()
        
        # Queue background task
        process_email_batch_task.delay(
            batch.id,
            request.start_date.isoformat(),
            request.end_date.isoformat()
        )
        
        return {
            "batch_id": batch.id,
            "status": "queued",
            "start_date": request.start_date,
            "end_date": request.end_date
        }

@app.get("/emails/batch/{batch_id}/status")
async def get_batch_status(batch_id: int, user: dict = Depends(get_current_user)):
    """Get batch processing status"""
    async with db_manager.get_session() as session:
        from database_models import EmailBatch
        
        batch = await session.get(EmailBatch, batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        
        return {
            "batch_id": batch.id,
            "status": batch.status,
            "total_emails": batch.total_emails,
            "processed_emails": batch.processed_emails,
            "failed_emails": batch.failed_emails,
            "started_at": batch.started_at,
            "completed_at": batch.completed_at,
            "processing_time_seconds": batch.processing_time_seconds
        }

# Task endpoints
@app.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(get_current_user)
):
    """Get tasks with filtering"""
    async with db_manager.get_session() as session:
        query = session.query(EmailTask)
        
        if status:
            query = query.filter(EmailTask.status == status)
        if priority:
            query = query.filter(EmailTask.priority == priority)
        if assignee:
            query = query.filter(EmailTask.assignee == assignee)
        
        query = query.order_by(EmailTask.created_at.desc()).limit(limit)
        results = await query.all()
        
        return [TaskResponse.from_orm(task) for task in results]

@app.put("/tasks/{task_id}/status")
async def update_task_status(
    task_id: str,
    status: str,
    user: dict = Depends(get_current_user)
):
    """Update task status"""
    async with db_manager.get_session() as session:
        task = await session.query(EmailTask).filter(EmailTask.task_id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        task.status = status
        if status == "completed":
            task.completed_at = datetime.now()
        
        await session.commit()
        
        # Notify WebSocket clients
        await manager.broadcast(
            WebSocketMessage(
                type="task_updated",
                data={"task_id": task_id, "status": status}
            ),
            subscription_type="task_updates"
        )
        
        return {"task_id": task_id, "status": status}

# Analytics endpoints
@app.get("/analytics/dashboard")
async def get_dashboard_analytics(user: dict = Depends(get_current_user)):
    """Get dashboard analytics data"""
    redis = await db_manager.get_redis()
    
    # Try cache first
    cache_key = "dashboard_analytics"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    async with db_manager.get_session() as session:
        # Get various metrics
        total_emails = await session.query(Email).count()
        unread_emails = await session.query(Email).filter(Email.is_read == False).count()
        urgent_emails = await session.query(EmailIntelligence).filter(
            EmailIntelligence.urgency.in_(['critical', 'high'])
        ).count()
        pending_tasks = await session.query(EmailTask).filter(
            EmailTask.status == 'pending'
        ).count()
        
        analytics = {
            "total_emails": total_emails,
            "unread_emails": unread_emails,
            "urgent_emails": urgent_emails,
            "pending_tasks": pending_tasks,
            "processing_rate": f"{total_emails/30:.1f} emails/day",  # Last 30 days average
            "system_health": "excellent",
            "last_updated": datetime.now().isoformat()
        }
        
        # Cache for 5 minutes
        await redis.setex(cache_key, 300, json.dumps(analytics, default=str))
        
        return analytics

# ============================================================================
# WebSocket Endpoints
# ============================================================================

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            # Wait for client messages
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Handle subscription requests
            if message.get("type") == "subscribe":
                subscriptions = message.get("subscriptions", [])
                manager.subscribe(user_id, subscriptions)
                
                await manager.send_personal_message(
                    WebSocketMessage(
                        type="subscription_confirmed",
                        data={"subscriptions": subscriptions}
                    ),
                    user_id
                )
            
            # Handle ping/pong for connection health
            elif message.get("type") == "ping":
                await manager.send_personal_message(
                    WebSocketMessage(type="pong", data={}),
                    user_id
                )
                
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for {user_id}: {e}")
        manager.disconnect(user_id)

# ============================================================================
# Real-time Processing Service
# ============================================================================

class RealtimeProcessor:
    """Real-time email processing service"""
    
    def __init__(self):
        self.running = False
    
    async def start(self):
        """Start real-time monitoring"""
        self.running = True
        logger.info("Starting real-time email processor")
        
        while self.running:
            try:
                await self.check_new_emails()
                await asyncio.sleep(10)  # Check every 10 seconds
            except Exception as e:
                logger.error(f"Real-time processing error: {e}")
                await asyncio.sleep(30)  # Wait longer on error
    
    async def check_new_emails(self):
        """Check for new emails and process them"""
        async with db_manager.get_session() as session:
            # Find unprocessed emails from last 10 minutes
            cutoff = datetime.now() - timedelta(minutes=10)
            new_emails = await session.query(Email).filter(
                Email.processing_status == 'pending',
                Email.date_received >= cutoff
            ).limit(10).all()
            
            if new_emails:
                logger.info(f"Processing {len(new_emails)} new emails")
                
                for email in new_emails:
                    await self.process_email_realtime(email)
    
    async def process_email_realtime(self, email: Email):
        """Process single email in real-time"""
        try:
            # Update status
            email.processing_status = 'processing'
            
            # Process with AI (simplified for demo)
            await asyncio.sleep(0.1)  # Simulate processing
            
            # Create intelligence record
            async with db_manager.get_session() as session:
                intelligence = EmailIntelligence(
                    email_id=email.id,
                    classification='needs_reply',
                    urgency='medium',
                    sentiment='neutral',
                    overall_confidence=0.85,
                    processing_time_ms=100
                )
                session.add(intelligence)
                
                email.processing_status = 'completed'
                email.processed_at = datetime.now()
                
                await session.commit()
            
            # Notify real-time clients
            await manager.broadcast(
                WebSocketMessage(
                    type="email_processed",
                    data={
                        "email_id": email.id,
                        "classification": "needs_reply",
                        "urgency": "medium"
                    }
                ),
                subscription_type="real_time_processing"
            )
            
            EMAILS_PROCESSED.inc()
            
        except Exception as e:
            logger.error(f"Error processing email {email.id}: {e}")
            email.processing_status = 'failed'

# Global real-time processor
realtime_processor = RealtimeProcessor()

# ============================================================================
# Application Startup
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Application startup tasks"""
    # Start real-time processor
    asyncio.create_task(realtime_processor.start())
    logger.info("Email Intelligence Backend started successfully")

if __name__ == "__main__":
    uvicorn.run(
        "backend_architecture:app",
        host="0.0.0.0",
        port=8000,
        reload=False,  # Disable in production
        workers=1,  # Use multiple workers in production
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True
    )