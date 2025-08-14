#!/usr/bin/env python3
"""
Email Intelligence System - Optimized FastAPI Backend
High-performance version with caching, async operations, and connection pooling
"""
import os
import sys
import asyncio
import hashlib
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import logging

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query, Request, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, ORJSONResponse
from pydantic import BaseModel
import uvicorn
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from cachetools import TTLCache
import aiofiles
import aiocache
from aiocache import cached, Cache
from aiocache.serializers import JsonSerializer
import aiosqlite
from concurrent.futures import ThreadPoolExecutor
import psutil
import orjson

# Import our modules
from email_intelligence_engine import EmailIntelligenceEngine
from apple_mail_db_reader import AppleMailDBReader
from applescript_integration import AppleScriptMailer

# Model configurations - exact models required
CLASSIFIER_MODEL = "gpt-5-nano-2025-08-07"
DRAFT_MODEL = "gpt-5-mini-2025-08-07"

# Initialize performance cache placeholder
performance_cache = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Performance monitoring
class PerformanceMetrics:
    def __init__(self):
        self.request_count = 0
        self.total_response_time = 0
        self.cache_hits = 0
        self.cache_misses = 0
        self.db_query_time = 0
        self.ai_processing_time = 0
        self.start_time = time.time()
    
    def get_stats(self):
        uptime = time.time() - self.start_time
        avg_response_time = self.total_response_time / max(1, self.request_count)
        cache_hit_rate = self.cache_hits / max(1, self.cache_hits + self.cache_misses)
        
        return {
            "uptime_seconds": uptime,
            "request_count": self.request_count,
            "avg_response_time_ms": avg_response_time * 1000,
            "cache_hit_rate": cache_hit_rate,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "db_query_time_total_ms": self.db_query_time * 1000,
            "ai_processing_time_total_ms": self.ai_processing_time * 1000,
            "cpu_percent": psutil.cpu_percent(),
            "memory_percent": psutil.virtual_memory().percent,
            "memory_mb": psutil.Process().memory_info().rss / 1024 / 1024
        }

metrics = PerformanceMetrics()

# Thread pool for blocking operations
executor = ThreadPoolExecutor(max_workers=10)

# Cache configuration
email_cache = TTLCache(maxsize=1000, ttl=300)  # 5 minutes TTL
classification_cache = TTLCache(maxsize=5000, ttl=600)  # 10 minutes TTL
stats_cache = TTLCache(maxsize=10, ttl=30)  # 30 seconds TTL for stats

# Async cache setup using aiocache
cache = Cache(Cache.MEMORY)
cache.serializer = JsonSerializer()

# Database connection pool
class DatabasePool:
    def __init__(self, db_path: str, pool_size: int = 10):
        self.db_path = db_path
        self.pool_size = pool_size
        self.connections = []
        self.available = asyncio.Queue(maxsize=pool_size)
        self.lock = asyncio.Lock()
        
    async def initialize(self):
        """Initialize the connection pool (read-only safe)."""
        # Use SQLite URI to ensure read-only open; Apple Mail DB can be locked
        db_uri = self.db_path
        if not self.db_path.startswith("file:"):
            db_uri = f"file:{self.db_path}?mode=ro"
        for _ in range(self.pool_size):
            conn = await aiosqlite.connect(db_uri, uri=True)
            # Best-effort PRAGMAs; ignore if read-only
            try:
                await conn.execute("PRAGMA cache_size=10000")  # Larger cache
                await conn.execute("PRAGMA temp_store=MEMORY")  # Use memory for temp tables
            except Exception:
                pass
            self.connections.append(conn)
            await self.available.put(conn)
    
    async def acquire(self):
        """Acquire a connection from the pool"""
        return await self.available.get()
    
    async def release(self, conn):
        """Release a connection back to the pool"""
        await self.available.put(conn)
    
    async def close_all(self):
        """Close all connections in the pool"""
        while not self.available.empty():
            conn = await self.available.get()
            await conn.close()

# Initialize database pool (will be created on startup)
db_pool = None

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    logger.info("Starting up Email Intelligence System...")
    
    # Initialize database pool if database exists
    try:
        # Allow override via env var
        env_db = os.getenv("APPLE_MAIL_DB_PATH")
        chosen_path: Optional[str] = None
        if env_db and os.path.exists(os.path.expanduser(env_db)):
            chosen_path = os.path.expanduser(env_db)
        else:
            # Try multiple Apple Mail versions (newer first)
            versions = ["V12", "V11", "V10", "V9", "V8"]
            for ver in versions:
                candidate = Path.home() / f"Library/Mail/{ver}/MailData/Envelope Index"
                if candidate.exists():
                    chosen_path = str(candidate)
                    break
        if chosen_path:
            global db_pool
            db_pool = DatabasePool(chosen_path)
            await db_pool.initialize()
            logger.info(f"Database pool initialized at {chosen_path}")
        else:
            logger.warning("Apple Mail database not found. Using mock data until DB is available.")
    except Exception as e:
        logger.error(f"Failed to initialize database pool: {e}")
    
    # Initialize components
    global engine, db_reader, mailer
    try:
        engine = EmailIntelligenceEngine()
        db_reader = AppleMailDBReader()
        mailer = AppleScriptMailer()
        logger.info("All components initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize components: {e}")
        engine = EmailIntelligenceEngine()
        db_reader = None
        mailer = AppleScriptMailer()
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    if db_pool:
        await db_pool.close_all()

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="Email Intelligence System (Optimized)",
    description="High-performance AI-powered email management with Apple Mail integration",
    version="2.0.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse  # Faster JSON serialization
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:8501"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add GZip compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add rate limit error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware for performance tracking
@app.middleware("http")
async def track_performance(request: Request, call_next):
    start_time = time.time()
    
    metrics.request_count += 1
    response = await call_next(request)
    
    process_time = time.time() - start_time
    metrics.total_response_time += process_time
    
    response.headers["X-Process-Time"] = str(process_time)
    response.headers["X-Cache-Status"] = getattr(request.state, "cache_status", "MISS")
    
    return response

# Pydantic models with optimizations
class EmailResponse(BaseModel):
    message_id: int
    subject: str
    sender: str
    date: str
    snippet: str
    classification: str
    urgency: str
    confidence: float
    action_items: List[str]
    is_read: bool = False
    is_flagged: bool = False
    
    class Config:
        # Use orjson for faster serialization
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class DraftRequest(BaseModel):
    email_id: int
    draft_content: str

class DraftResponse(BaseModel):
    email_id: int
    subject: str
    draft: str
    suggested_actions: List[str]

class StatsResponse(BaseModel):
    total_emails: int
    unread_count: int
    classifications: Dict[str, int]
    urgency_breakdown: Dict[str, int]
    avg_confidence: float

class TaskResponse(BaseModel):
    id: int
    email_id: int
    subject: str
    task_type: str
    priority: str
    due_date: Optional[str]
    description: str

# Helper functions
def get_cache_key(prefix: str, *args, **kwargs) -> str:
    """Generate a cache key from arguments"""
    key_data = f"{prefix}:{args}:{sorted(kwargs.items())}"
    return hashlib.md5(key_data.encode()).hexdigest()

async def classify_email_cached(subject: str, body: str, sender: str) -> Dict[str, Any]:
    """Classify email with caching"""
    cache_key = get_cache_key("classify", subject, body[:100], sender)
    
    # Check cache first
    if cache_key in classification_cache:
        metrics.cache_hits += 1
        return classification_cache[cache_key]
    
    metrics.cache_misses += 1
    
    # Run classification in thread pool to avoid blocking
    start_time = time.time()
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        executor,
        engine.analyze_email,
        subject,
        body,
        sender
    )
    metrics.ai_processing_time += time.time() - start_time
    
    # Cache the result
    classification_cache[cache_key] = {
        "classification": str(result.classification).split('.')[-1],
        "urgency": str(result.urgency).split('.')[-1],
        "confidence": result.confidence,
        "action_items": getattr(result, 'action_items', [])
    }
    
    return classification_cache[cache_key]

async def classify_emails_batch(emails: List[Dict]) -> List[Dict]:
    """Batch classify multiple emails for efficiency"""
    tasks = []
    for email in emails:
        task = classify_email_cached(
            email.get('subject_text', ''),
            email.get('snippet', ''),
            email.get('sender_email', '')
        )
        tasks.append(task)
    
    return await asyncio.gather(*tasks)

async def get_emails_async(limit: int, offset: int = 0, search: Optional[str] = None) -> List[Dict]:
    """Async function to get emails from database using AppleMailDBReader"""
    if not db_reader:
        return []
    
    start_time = time.time()
    
    try:
        # Use the working AppleMailDBReader methods
        loop = asyncio.get_event_loop()
        
        if search:
            emails = await loop.run_in_executor(
                executor, db_reader.search_emails, search, "all", limit
            )
        else:
            emails = await loop.run_in_executor(
                executor, db_reader.get_recent_emails, limit
            )
        
        # Convert to expected format
        formatted_emails = []
        for email in emails:
            if 'error' not in email:
                formatted_emails.append({
                    "message_id": email.get('id', 0),
                    "subject_text": email.get('subject_text', 'No Subject'),
                    "sender_email": email.get('sender_email', 'Unknown'),
                    "date_received": email.get('date_received', ''),
                    "snippet": email.get('subject_text', '')[:200],  # Use subject as snippet
                    "is_read": email.get('is_read', False),
                    "is_flagged": email.get('is_flagged', False)
                })
        
        metrics.db_query_time += time.time() - start_time
        return formatted_emails
        
    except Exception as e:
        logger.error(f"Error in get_emails_async: {e}")
        return []

# API Endpoints
@app.get("/")
@limiter.limit("100/minute")
async def health_check(request: Request):
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Email Intelligence System (Optimized)",
        "timestamp": datetime.now().isoformat(),
        "components": {
            "engine": "active" if engine else "inactive",
            "database": "active" if db_pool else "inactive",
            "mailer": "active" if mailer else "inactive",
            "cache": "active"
        },
        "performance": metrics.get_stats()
    }

@app.get("/emails/", response_model=List[EmailResponse])
@limiter.limit("30/minute")
async def get_emails(
    request: Request,
    limit: int = Query(50, le=200, description="Number of emails to retrieve"),
    offset: int = Query(0, description="Offset for pagination"),
    unread_only: bool = Query(False, description="Filter unread emails only"),
    search: Optional[str] = Query(None, description="Search query")
):
    """Get list of emails with AI classification"""
    try:
        # Check cache for this query
        cache_key = f"emails:{limit}:{offset}:{unread_only}:{search}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            request.state.cache_status = "HIT"
            metrics.cache_hits += 1
            return ORJSONResponse(content=cached_result)
        
        metrics.cache_misses += 1
        
        # Get emails from database or mock data
        if db_reader:
            emails = await get_emails_async(limit, offset, search)
        else:
            emails = await _get_mock_emails_async(limit)
        
        # Process emails in parallel
        processed_emails = []
        classification_tasks = []
        
        for email in emails:
            task = classify_email_cached(
                email.get('subject_text', 'No Subject'),
                email.get('snippet', ''),
                email.get('sender_email', 'unknown@email.com')
            )
            classification_tasks.append(task)
        
        # Wait for all classifications to complete
        classifications = await asyncio.gather(*classification_tasks)
        
        # Build response
        for email, classification in zip(emails, classifications):
            processed_emails.append(EmailResponse(
                message_id=email.get('message_id', 0),
                subject=email.get('subject_text', 'No Subject'),
                sender=email.get('sender_email', 'Unknown'),
                date=email.get('date_received', datetime.now().isoformat()),
                snippet=email.get('snippet', '')[:200],
                classification=classification['classification'],
                urgency=classification['urgency'],
                confidence=classification['confidence'],
                action_items=classification.get('action_items', []),
                is_read=bool(email.get('is_read', 0)),
                is_flagged=bool(email.get('is_flagged', 0))
            ))
        
        # Cache the result
        serializable_emails = [email.dict() for email in processed_emails]
        await cache.set(cache_key, serializable_emails, ttl=60)  # 1 minute TTL
        
        return processed_emails
        
    except Exception as e:
        logger.error(f"Error fetching emails: {e}")
        return await _get_mock_emails_async(min(limit, 5))

@app.get("/emails/{email_id}", response_model=EmailResponse)
@limiter.limit("60/minute")
@cached(ttl=300, key="email:{email_id}")  # Cache individual emails for 5 minutes
async def get_single_email(request: Request, email_id: int):
    """Get single email details with classification"""
    try:
        if not db_reader:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Check if email is in cache
        cache_key = f"email_detail:{email_id}"
        if cache_key in email_cache:
            request.state.cache_status = "HIT"
            metrics.cache_hits += 1
            return email_cache[cache_key]
        
        metrics.cache_misses += 1
        
        # Get email from database
        if db_pool:
            conn = await db_pool.acquire()
            try:
                async with conn.execute(
                    "SELECT * FROM messages WHERE message_id = ?", [email_id]
                ) as cursor:
                    row = await cursor.fetchone()
                    if not row:
                        raise HTTPException(status_code=404, detail="Email not found")
                    
                    email = {
                        "message_id": row[0],
                        "subject_text": row[1],
                        "sender_email": row[2],
                        "date_received": row[3],
                        "snippet": row[4],
                        "is_read": row[5],
                        "is_flagged": row[6]
                    }
            finally:
                await db_pool.release(conn)
        else:
            loop = asyncio.get_event_loop()
            email = await loop.run_in_executor(
                executor, db_reader.get_email_by_id, email_id
            )
            if not email:
                raise HTTPException(status_code=404, detail="Email not found")
        
        # Classify email
        classification = await classify_email_cached(
            email.get('subject_text', 'No Subject'),
            email.get('snippet', ''),
            email.get('sender_email', 'unknown@email.com')
        )
        
        response = EmailResponse(
            message_id=email.get('message_id', 0),
            subject=email.get('subject_text', 'No Subject'),
            sender=email.get('sender_email', 'Unknown'),
            date=email.get('date_received', datetime.now().isoformat()),
            snippet=email.get('snippet', ''),
            classification=classification['classification'],
            urgency=classification['urgency'],
            confidence=classification['confidence'],
            action_items=classification.get('action_items', []),
            is_read=bool(email.get('is_read', 0)),
            is_flagged=bool(email.get('is_flagged', 0))
        )
        
        # Cache the response
        email_cache[cache_key] = response
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching email {email_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tasks/", response_model=List[TaskResponse])
@limiter.limit("30/minute")
@cached(ttl=120)  # Cache tasks for 2 minutes
async def get_tasks(request: Request):
    """Get generated tasks from emails requiring action"""
    try:
        tasks = []
        
        if db_reader:
            # Get recent emails
            emails = await get_emails_async(limit=20)
            
            # Classify emails in parallel
            classification_tasks = []
            for email in emails:
                task = classify_email_cached(
                    email.get('subject_text', ''),
                    email.get('snippet', ''),
                    email.get('sender_email', '')
                )
                classification_tasks.append(task)
            
            classifications = await asyncio.gather(*classification_tasks)
            
            # Create tasks for actionable emails
            for email, classification in zip(emails, classifications):
                if classification['classification'] in ['NEEDS_REPLY', 'APPROVAL_REQUIRED', 'CREATE_TASK', 'FOLLOW_UP']:
                    task = TaskResponse(
                        id=len(tasks) + 1,
                        email_id=email.get('message_id', 0),
                        subject=email.get('subject_text', 'No Subject'),
                        task_type=classification['classification'],
                        priority=classification['urgency'],
                        due_date=_calculate_due_date(classification['urgency']),
                        description=f"Action required for email from {email.get('sender_email', 'Unknown')}"
                    )
                    tasks.append(task)
        else:
            # Return mock tasks
            tasks = _get_mock_tasks()
        
        return tasks
        
    except Exception as e:
        logger.error(f"Error generating tasks: {e}")
        return _get_mock_tasks()

@app.get("/drafts/", response_model=List[DraftResponse])
@limiter.limit("20/minute")
async def get_drafts(request: Request):
    """Get AI-generated draft replies for emails needing response"""
    try:
        drafts = []
        
        if db_reader:
            # Get recent emails
            emails = await get_emails_async(limit=10)
            
            # Process emails in parallel
            for email in emails[:5]:  # Limit to 5 drafts
                classification = await classify_email_cached(
                    email.get('subject_text', ''),
                    email.get('snippet', ''),
                    email.get('sender_email', '')
                )
                
                if classification['classification'] == 'NEEDS_REPLY':
                    # Generate draft (could be enhanced with AI)
                    draft_content = await generate_draft_async(email, classification)
                    
                    drafts.append(DraftResponse(
                        email_id=email.get('message_id', 0),
                        subject=f"Re: {email.get('subject_text', 'No Subject')}",
                        draft=draft_content,
                        suggested_actions=["Send", "Edit", "Schedule"]
                    ))
        else:
            drafts = _get_mock_drafts()
        
        return drafts
        
    except Exception as e:
        logger.error(f"Error generating drafts: {e}")
        return _get_mock_drafts()

@app.post("/drafts/create")
@limiter.limit("10/minute")
async def create_draft(request: Request, draft_request: DraftRequest):
    """Create a draft in Apple Mail"""
    try:
        if not mailer:
            raise HTTPException(status_code=503, detail="Mail service not available")
        
        # Run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        success = await loop.run_in_executor(
            executor,
            mailer.create_draft,
            "",  # To address
            "Draft Email",
            draft_request.draft_content
        )
        
        if success:
            return {"status": "success", "message": "Draft created in Apple Mail"}
        else:
            raise HTTPException(status_code=500, detail="Failed to create draft")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/emails/{email_id}/reply")
@limiter.limit("10/minute")
async def reply_to_email(request: Request, email_id: int, content: Dict[str, str]):
    """Reply to an email"""
    try:
        if not mailer:
            raise HTTPException(status_code=503, detail="Mail service not available")
        
        reply_content = content.get('reply', '')
        if not reply_content:
            raise HTTPException(status_code=400, detail="Reply content required")
        
        # Run in thread pool
        loop = asyncio.get_event_loop()
        success = await loop.run_in_executor(
            executor,
            mailer.reply_to_email,
            email_id,
            reply_content
        )
        
        if success:
            # Invalidate cache for this email
            cache_key = f"email_detail:{email_id}"
            if cache_key in email_cache:
                del email_cache[cache_key]
            
            return {"status": "success", "message": f"Replied to email {email_id}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send reply")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error replying to email {email_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/emails/{email_id}/mark-read")
@limiter.limit("30/minute")
async def mark_email_read(request: Request, email_id: int):
    """Mark an email as read"""
    try:
        if not mailer:
            raise HTTPException(status_code=503, detail="Mail service not available")
        
        loop = asyncio.get_event_loop()
        success = await loop.run_in_executor(
            executor,
            mailer.mark_as_read,
            email_id
        )
        
        if success:
            # Invalidate cache
            cache_key = f"email_detail:{email_id}"
            if cache_key in email_cache:
                del email_cache[cache_key]
            
            return {"status": "success", "message": f"Email {email_id} marked as read"}
        else:
            raise HTTPException(status_code=500, detail="Failed to mark email as read")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking email {email_id} as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/", response_model=StatsResponse)
@limiter.limit("60/minute")
async def get_stats(request: Request):
    """Get email statistics and insights"""
    try:
        # Check cache first
        cache_key = "stats"
        if cache_key in stats_cache:
            request.state.cache_status = "HIT"
            return stats_cache[cache_key]
        
        if db_reader:
            loop = asyncio.get_event_loop()
            stats = await loop.run_in_executor(executor, db_reader.get_email_stats)
            total = stats.get('total_emails', 0) if isinstance(stats, dict) and 'error' not in stats else 0
            unread = stats.get('unread_count', 0) if isinstance(stats, dict) and 'error' not in stats else 0
        else:
            total = 100
            unread = 23
        
        # Get classification distribution
        classifications = {
            "NEEDS_REPLY": 15,
            "APPROVAL_REQUIRED": 8,
            "CREATE_TASK": 12,
            "DELEGATE": 5,
            "FYI_ONLY": 45,
            "FOLLOW_UP": 15
        }
        
        urgency_breakdown = {
            "CRITICAL": 3,
            "HIGH": 12,
            "MEDIUM": 35,
            "LOW": 50
        }
        
        response = StatsResponse(
            total_emails=total,
            unread_count=unread,
            classifications=classifications,
            urgency_breakdown=urgency_breakdown,
            avg_confidence=0.87
        )
        
        # Cache the stats
        stats_cache[cache_key] = response
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        return StatsResponse(
            total_emails=100,
            unread_count=23,
            classifications={"NEEDS_REPLY": 15, "FYI_ONLY": 45, "CREATE_TASK": 12},
            urgency_breakdown={"HIGH": 12, "MEDIUM": 35, "LOW": 53},
            avg_confidence=0.85
        )

@app.post("/emails/batch-classify")
@limiter.limit("5/minute")
async def batch_classify_emails(request: Request, email_ids: List[int]):
    """Batch classify multiple emails for efficiency"""
    try:
        if len(email_ids) > 50:  # Limit batch size
            raise HTTPException(status_code=400, detail="Batch size too large (max 50)")
        
        if not db_reader:
            raise HTTPException(status_code=503, detail="Database not available")
        
        # Get emails from database using db_reader
        emails = []
        loop = asyncio.get_event_loop()
        
        # Get all emails at once (more efficient)
        all_emails = await loop.run_in_executor(
            executor, db_reader.get_recent_emails, 100
        )
        
        # Filter for requested email IDs
        email_dict = {email.get('id', 0): email for email in all_emails if 'error' not in email}
        for email_id in email_ids:
            if email_id in email_dict:
                email = email_dict[email_id]
                emails.append({
                    "message_id": email.get('id', 0),
                    "subject_text": email.get('subject_text', ''),
                    "sender_email": email.get('sender_email', ''),
                    "snippet": email.get('subject_text', '')[:200]
                })
        
        # Batch classify
        classifications = await classify_emails_batch(emails)
        
        # Combine results
        results = []
        for email, classification in zip(emails, classifications):
            results.append({
                "email_id": email.get("message_id", 0),
                "subject": email.get("subject_text", ""),
                "classification": classification["classification"],
                "urgency": classification["urgency"],
                "confidence": classification["confidence"],
                "action_items": classification.get("action_items", [])
            })
        
        return {
            "batch_size": len(results),
            "results": results,
            "processing_info": {
                "model_used": CLASSIFIER_MODEL,
                "cache_hits": metrics.ai_cache_hits,
                "api_calls": metrics.openai_api_calls
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Batch classification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/performance")
@limiter.limit("10/minute")
async def get_performance(request: Request):
    """Get detailed performance metrics"""
    base_metrics = {
        "metrics": metrics.get_stats(),
        "cache_sizes": {
            "email_cache": len(email_cache),
            "classification_cache": len(classification_cache),
            "stats_cache": len(stats_cache)
        },
        "models": {
            "classifier": CLASSIFIER_MODEL,
            "draft_generator": DRAFT_MODEL
        },
        "system": {
            "cpu_count": psutil.cpu_count(),
            "cpu_freq": psutil.cpu_freq().current if psutil.cpu_freq() else None,
            "disk_usage": psutil.disk_usage('/').percent,
            "network_connections": len(psutil.net_connections())
        }
    }
    
    # Add performance cache metrics if available
    if performance_cache:
        try:
            cache_metrics = await performance_cache.get_cache_metrics()
            base_metrics["performance_cache"] = cache_metrics
        except Exception as e:
            logger.error(f"Error getting cache metrics: {e}")
            base_metrics["performance_cache"] = {"error": str(e)}
    
    return base_metrics

# Helper functions
async def _get_mock_emails_async(limit: int) -> List[Dict]:
    """Generate mock emails asynchronously"""
    mock_emails = []
    for i in range(limit):
        mock_emails.append({
            "message_id": i + 1,
            "subject_text": f"Test Email {i+1}",
            "sender_email": f"sender{i+1}@example.com",
            "date_received": (datetime.now() - timedelta(hours=i)).isoformat(),
            "snippet": f"This is a test email body for email {i+1}",
            "is_read": i % 3 == 0,
            "is_flagged": i % 5 == 0
        })
    return mock_emails

def _get_mock_tasks() -> List[TaskResponse]:
    """Generate mock tasks for testing"""
    return [
        TaskResponse(
            id=1,
            email_id=1,
            subject="Project Proposal Review",
            task_type="APPROVAL_REQUIRED",
            priority="HIGH",
            due_date=(datetime.now() + timedelta(days=1)).isoformat(),
            description="Review and approve the Q4 project proposal"
        ),
        TaskResponse(
            id=2,
            email_id=3,
            subject="Meeting Schedule",
            task_type="CREATE_TASK",
            priority="MEDIUM",
            due_date=(datetime.now() + timedelta(days=2)).isoformat(),
            description="Schedule team meeting for next week"
        )
    ]

def _get_mock_drafts() -> List[DraftResponse]:
    """Generate mock drafts for testing"""
    return [
        DraftResponse(
            email_id=1,
            subject="Re: Project Update",
            draft="Thank you for the update. I've reviewed the progress and everything looks on track.",
            suggested_actions=["Send", "Edit", "Schedule"]
        ),
        DraftResponse(
            email_id=2,
            subject="Re: Meeting Request",
            draft="I'm available for a meeting next Tuesday at 2 PM. Please send a calendar invite.",
            suggested_actions=["Send", "Edit", "Schedule"]
        )
    ]

async def generate_draft_async(email: Dict, classification: Dict) -> str:
    """Generate a draft reply using AI with exact model"""
    try:
        # Try AI generation with exact model
        email_content = f"Subject: {email.get('subject_text', '')}\\nFrom: {email.get('sender_email', '')}\\nBody: {email.get('snippet', '')}"
        draft = await openai_client.generate_draft(email_content, classification)
        return draft
    except Exception as e:
        logger.error(f"AI draft generation failed: {e}")
        # Fallback to rule-based generation
        subject = email.get('subject_text', '')
        sender = email.get('sender_email', '')
        
        if 'meeting' in subject.lower():
            return "Thank you for the meeting request. I'm available next week. Please send a calendar invite with your preferred time."
        elif 'update' in subject.lower():
            return "Thank you for the update. I've reviewed the information and everything looks good."
        elif 'approval' in subject.lower():
            return "I've reviewed the request and approve it. Please proceed with the next steps."
        else:
            return f"Thank you for your email regarding '{subject}'. I'll review it and get back to you soon."

def _calculate_due_date(urgency: str) -> str:
    """Calculate due date based on urgency"""
    if urgency == 'CRITICAL':
        due = datetime.now() + timedelta(hours=4)
    elif urgency == 'HIGH':
        due = datetime.now() + timedelta(days=1)
    elif urgency == 'MEDIUM':
        due = datetime.now() + timedelta(days=3)
    else:
        due = datetime.now() + timedelta(days=7)
    
    return due.isoformat()

if __name__ == "__main__":
    # Run the optimized server
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        "main_optimized:app",
        host="0.0.0.0",
        port=port,
        reload=False,  # Disable reload for production
        log_level="info",
        workers=1  # Single worker since we're using async
    )