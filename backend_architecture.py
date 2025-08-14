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
# import asyncpg  # Comment out for now
# import redis.asyncio as aioredis  # Comment out for now
# from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
# from sqlalchemy.pool import QueuePool

# Data models
from pydantic import BaseModel, Field, validator
from enum import Enum

# Monitoring and performance - simplified for testing
# import structlog  
# from prometheus_client import Counter, Histogram, Gauge, generate_latest
# import psutil

# Task queue - commented out for now
# from celery import Celery

# Email processing - commented out for now to avoid import errors
# from database_models import Email, EmailIntelligence, EmailTask, Base  
# from email_processor import EmailBatchProcessor

# Configure structured logging - simplified for testing
import logging
logger = logging.getLogger(__name__)

# Prometheus metrics - commented out for now
# REQUESTS_TOTAL = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint'])
# REQUEST_DURATION = Histogram('http_request_duration_seconds', 'HTTP request duration')  
# ACTIVE_CONNECTIONS = Gauge('websocket_connections_active', 'Active WebSocket connections')
# EMAILS_PROCESSED = Counter('emails_processed_total', 'Total emails processed')
# PROCESSING_TIME = Histogram('email_processing_seconds', 'Email processing time')

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
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000"]
    DEVELOPMENT_MODE: bool = True  # Bypass auth in development
    
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
    """Simplified database manager for testing"""
    
    def __init__(self):
        self.engine = None
        self.session_maker = None
        self.redis = None
    
    async def initialize(self):
        """Initialize database connections - simplified for testing"""
        logger.info("Database manager initialized (mock mode)")
        # In actual implementation, initialize real database connections here
    
    async def get_session(self):
        """Get database session - mock for testing"""
        return None  # Return mock session
    
    async def get_redis(self):
        """Get Redis connection - mock for testing"""
        return None  # Return mock redis
    
    async def close(self):
        """Close database connections - mock for testing"""
        logger.info("Database connections closed")

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
        # ACTIVE_CONNECTIONS.set(len(self.active_connections))  # Commented out for testing
        logger.info(f"WebSocket connected: {user_id}")
    
    def disconnect(self, user_id: str):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            if user_id in self.user_subscriptions:
                del self.user_subscriptions[user_id]
            # ACTIVE_CONNECTIONS.set(len(self.active_connections))  # Commented out for testing
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
# Celery Task Queue Setup - commented out for testing
# ============================================================================

# Initialize Celery for background processing - commented out for testing
# celery_app = Celery(
#     'email_intelligence',
#     broker=settings.REDIS_URL,
#     backend=settings.REDIS_URL
# )

# celery_app.conf.update(
#     task_serializer='json',
#     accept_content=['json'],
#     result_serializer='json',
#     timezone='UTC',
#     enable_utc=True,
#     task_routes={
#         'process_email_batch': {'queue': 'batch_processing'},
#         'process_single_email': {'queue': 'real_time'},
#     }
# )

# ============================================================================
# Background Tasks - commented out for testing
# ============================================================================

# @celery_app.task
# def process_email_batch_task(batch_id: int, start_date: str, end_date: str):
#     """Background task for batch email processing"""
#     import asyncio
#     return asyncio.run(_process_email_batch_async(batch_id, start_date, end_date))

# async def _process_email_batch_async(batch_id: int, start_date: str, end_date: str):
#     """Async batch processing implementation"""
#     try:
#         processor = EmailBatchProcessor()
#         result = await processor.process_date_range(
#             datetime.fromisoformat(start_date),
#             datetime.fromisoformat(end_date),
#             batch_id=batch_id
#         )
#         
#         # Notify WebSocket clients
#         await manager.broadcast(
#             WebSocketMessage(
#                 type="batch_completed",
#                 data={"batch_id": batch_id, "result": result}
#             ),
#             subscription_type="batch_updates"
#         )
#         
#         return result
#     except Exception as e:
#         logger.error(f"Batch processing failed: {e}")
#         await manager.broadcast(
#             WebSocketMessage(
#                 type="batch_failed",
#                 data={"batch_id": batch_id, "error": str(e)}
#             ),
#             subscription_type="batch_updates"
#         )
#         raise

# ============================================================================
# Authentication and Security
# ============================================================================

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extract user from JWT token (simplified for demo)"""
    # In production, verify JWT token and extract user info
    return {"user_id": "demo_user", "permissions": ["read", "write"]}

async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))):
    """Optional authentication for development mode"""
    if settings.DEVELOPMENT_MODE:
        # Return demo user in development mode (no auth required)
        return {"user_id": "dev_user", "permissions": ["read", "write"]}
    else:
        # In production, require authentication
        if not credentials:
            raise HTTPException(status_code=401, detail="Authentication required")
        return await get_current_user(credentials)

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
    """Prometheus metrics endpoint - simplified for testing"""
    if not settings.ENABLE_METRICS:
        raise HTTPException(status_code=404, detail="Metrics disabled")
    
    return {"status": "Metrics not available in development mode"}

# Email endpoints
@app.get("/emails")
@app.get("/emails/")
async def get_emails(
    limit: int = 100,
    offset: int = 0,
    classification: Optional[EmailClassification] = None,
    urgency: Optional[UrgencyLevel] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user: dict = Depends(get_current_user_optional)
):
    """Get emails with filtering and pagination"""
    # REQUESTS_TOTAL.labels(method="GET", endpoint="/emails").inc()  # Commented out for testing
    
    # with REQUEST_DURATION.time():  # Commented out for testing
    # Return mock data compatible with frontend interface (no database needed)
    mock_emails = [
        {
            "id": 1,
            "subject": "Important meeting tomorrow",
            "sender": "John Boss <boss@company.com>",
            "date": (datetime.now() - timedelta(hours=2)).isoformat(),
            "classification": "NEEDS_REPLY",
            "urgency": "HIGH",
            "confidence": 0.92,
            "has_draft": False
        },
        {
            "id": 2,
            "subject": "Project update", 
            "sender": "Team Lead <team@company.com>",
            "date": (datetime.now() - timedelta(hours=5)).isoformat(),
            "classification": "FYI",
            "urgency": "MEDIUM",
            "confidence": 0.87,
            "has_draft": True
        },
        {
            "id": 3,
            "subject": "Client proposal review",
            "sender": "Sarah Johnson <sarah@client.com>",
            "date": (datetime.now() - timedelta(hours=8)).isoformat(),
            "classification": "APPROVAL_REQUIRED",
            "urgency": "CRITICAL",
            "confidence": 0.95,
            "has_draft": True
        },
        {
            "id": 4,
            "subject": "Weekly newsletter",
            "sender": "Newsletter <no-reply@company.com>",
            "date": (datetime.now() - timedelta(days=1)).isoformat(),
            "classification": "FYI_ONLY",
            "urgency": "LOW",
            "confidence": 0.78,
            "has_draft": False
        }
    ]
    
    # Apply filters
    filtered_emails = mock_emails
    if limit:
        filtered_emails = filtered_emails[:limit]
    
    return filtered_emails

@app.get("/emails/{email_id}")
async def get_email(email_id: int, user: dict = Depends(get_current_user_optional)):
    """Get specific email with full details"""
    # Return mock data for testing
    if email_id == 1:
        return EmailResponse(
            id=1,
            message_id=1001,
            subject_text="Important meeting tomorrow",
            sender_email="boss@company.com",
            sender_name="John Boss",
            date_received=datetime.now() - timedelta(hours=2),
            is_read=False,
            is_flagged=True,
            processing_status=ProcessingStatus.COMPLETED,
            classification=EmailClassification.NEEDS_REPLY,
            urgency=UrgencyLevel.HIGH,
            confidence=0.92
        )
    else:
        raise HTTPException(status_code=404, detail="Email not found")

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
    
    # Mock batch processing for testing
    batch_id = 1
    
    return {
        "batch_id": batch_id,
        "status": "queued",
        "start_date": request.start_date,
        "end_date": request.end_date
    }

@app.get("/emails/batch/{batch_id}/status")
async def get_batch_status(batch_id: int, user: dict = Depends(get_current_user_optional)):
    """Get batch processing status"""
    # Return mock batch status
    if batch_id == 1:
        return {
            "batch_id": 1,
            "status": "completed",
            "total_emails": 150,
            "processed_emails": 147,
            "failed_emails": 3,
            "started_at": datetime.now() - timedelta(hours=1),
            "completed_at": datetime.now() - timedelta(minutes=15),
            "processing_time_seconds": 2700
        }
    else:
        raise HTTPException(status_code=404, detail="Batch not found")

# Task endpoints
@app.get("/tasks")
@app.get("/tasks/")
async def get_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assignee: Optional[str] = None,
    limit: int = 100,
    user: dict = Depends(get_current_user_optional)
):
    """Get tasks with filtering"""
    # Return mock task data for testing
    mock_tasks = [
        {
            "id": 1,
            "task_id": "task_001",
            "subject": "Reply to client inquiry",
            "description": "Respond to John Doe about project timeline",
            "task_type": "email_reply",
            "priority": "high",
            "assignee": "dev_user",
            "due_date": datetime.now() + timedelta(days=1),
            "status": "pending"
        },
        {
            "id": 2,
            "task_id": "task_002", 
            "subject": "Schedule team meeting",
            "description": "Set up weekly sync meeting with development team",
            "task_type": "meeting",
            "priority": "medium",
            "assignee": "dev_user",
            "due_date": datetime.now() + timedelta(days=2),
            "status": "completed"
        }
    ]
    
    # Apply filters
    filtered_tasks = mock_tasks
    if status:
        filtered_tasks = [t for t in filtered_tasks if t["status"] == status]
    if priority:
        filtered_tasks = [t for t in filtered_tasks if t["priority"] == priority]
    if assignee:
        filtered_tasks = [t for t in filtered_tasks if t["assignee"] == assignee]
    
    # Apply limit
    if limit:
        filtered_tasks = filtered_tasks[:limit]
    
    return filtered_tasks

@app.put("/tasks/{task_id}/status")
async def update_task_status(
    task_id: str,
    status: str,
    user: dict = Depends(get_current_user)
):
    """Update task status"""
    # Mock implementation for testing
    if task_id not in ["task_001", "task_002"]:
        raise HTTPException(status_code=404, detail="Task not found")
    
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
async def get_dashboard_analytics(user: dict = Depends(get_current_user_optional)):
    """Get dashboard analytics data"""
    # Return mock analytics data compatible with frontend interface
    analytics = {
        "total_emails": 1247,
        "unread_emails": 23,
        "classifications": {
            "NEEDS_REPLY": 156,
            "FYI": 423,
            "APPROVAL_REQUIRED": 89,
            "CREATE_TASK": 67,
            "DELEGATE": 34,
            "MEETING": 78,
            "NEWSLETTER": 234,
            "AUTOMATED": 166
        },
        "urgencies": {
            "CRITICAL": 12,
            "HIGH": 89,
            "MEDIUM": 456,
            "LOW": 690
        },
        "processing_stats": {
            "accuracy_estimates": {
                "critical_classes": "94.2%",
                "general_classification": "91.7%", 
                "urgency_detection": "88.9%",
                "sentiment_analysis": "85.3%"
            }
        }
    }
    
    return analytics

# Draft endpoints
@app.get("/drafts")
@app.get("/drafts/")
async def get_drafts(user: dict = Depends(get_current_user_optional)):
    """Get draft replies"""
    # Return mock draft data for testing
    mock_drafts = [
        {
            "id": 1,
            "email_id": 1,
            "content": """Hi John,

Thank you for reaching out about tomorrow's meeting. I'll be there and have prepared the quarterly review materials we discussed.

Looking forward to our discussion.

Best regards,
[Your Name]""",
            "confidence": 0.89,
            "created_at": (datetime.now() - timedelta(minutes=30)).isoformat()
        },
        {
            "id": 2,
            "email_id": 3,
            "content": """Hi Sarah,

I've reviewed the client proposal and it looks comprehensive. I have a few suggestions for the timeline section that I think would improve our delivery schedule.

Can we schedule a call to discuss these changes?

Best,
[Your Name]""",
            "confidence": 0.94,
            "created_at": (datetime.now() - timedelta(hours=1)).isoformat()
        }
    ]
    
    return mock_drafts

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
        """Check for new emails and process them - mock implementation"""
        # Mock implementation - would check database for new emails
        logger.info("Checking for new emails (mock)")
        pass
    
    async def process_email_realtime(self, email_data):
        """Process single email in real-time - mock implementation"""
        try:
            # Mock processing
            await asyncio.sleep(0.1)  # Simulate processing
            
            # Notify real-time clients
            await manager.broadcast(
                WebSocketMessage(
                    type="email_processed",
                    data={
                        "email_id": 1,
                        "classification": "needs_reply",
                        "urgency": "medium"
                    }
                ),
                subscription_type="real_time_processing"
            )
            
            # EMAILS_PROCESSED.inc()  # Commented out for testing
            
        except Exception as e:
            logger.error(f"Error processing email: {e}")

# Global real-time processor
realtime_processor = RealtimeProcessor()

# ============================================================================
# Application Startup
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Application startup tasks"""
    # Start real-time processor - commented out for testing
    # asyncio.create_task(realtime_processor.start())
    logger.info("Email Intelligence Backend started successfully")

if __name__ == "__main__":
    uvicorn.run(
        "backend_architecture:app",
        host="0.0.0.0",
        port=8002,  # Changed to 8002 to avoid conflicts
        reload=False,  # Disable in production
        workers=1,  # Use multiple workers in production
        log_level=settings.LOG_LEVEL.lower(),
        access_log=True
    )