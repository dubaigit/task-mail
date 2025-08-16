#!/usr/bin/env python3
"""
Async Email Intelligence Engine - Production Optimized

High-performance async email classification and analysis system with:
- Async/await patterns for all I/O operations
- Connection pooling and resource management
- Memory-efficient data structures
- Comprehensive error handling and retry mechanisms
- Performance monitoring and metrics
- Garbage collection optimization
"""

import asyncio
import aiohttp
import aiosqlite
import json
import gc
import psutil
import time
import weakref
from datetime import datetime, timedelta
from typing import (
    Dict, List, Optional, Tuple, Any, Union, AsyncIterator, 
    Callable, TypeVar, Generic, Protocol
)
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict, deque
from contextlib import asynccontextmanager
import logging
import hashlib
import re
import unicodedata
from pathlib import Path
import asyncio.subprocess
import concurrent.futures
from functools import wraps, lru_cache
import numpy as np

# Configure logging with async-safe formatter
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(process)d:%(thread)d] - %(message)s'
)
logger = logging.getLogger(__name__)

# Type definitions
T = TypeVar('T')

# ============================================================================
# Performance Monitoring and Metrics
# ============================================================================

@dataclass
class PerformanceMetrics:
    """Performance metrics for monitoring system health"""
    operation_name: str
    start_time: float
    end_time: Optional[float] = None
    duration_ms: Optional[float] = None
    memory_usage_mb: Optional[float] = None
    cpu_usage_percent: Optional[float] = None
    success: bool = True
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

class AsyncPerformanceMonitor:
    """Async performance monitoring with minimal overhead"""
    
    def __init__(self, max_metrics: int = 10000):
        self.metrics: deque = deque(maxlen=max_metrics)
        self.aggregated_stats: Dict[str, Dict[str, float]] = defaultdict(
            lambda: {'count': 0, 'total_time': 0, 'avg_time': 0, 'min_time': float('inf'), 'max_time': 0}
        )
        self._lock = asyncio.Lock()
    
    @asynccontextmanager
    async def measure(self, operation_name: str, metadata: Dict[str, Any] = None):
        """Async context manager for measuring operation performance"""
        metric = PerformanceMetrics(
            operation_name=operation_name,
            start_time=time.time(),
            metadata=metadata or {}
        )
        
        # Get initial memory usage
        process = psutil.Process()
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        try:
            yield metric
            metric.success = True
        except Exception as e:
            metric.success = False
            metric.error_message = str(e)
            raise
        finally:
            metric.end_time = time.time()
            metric.duration_ms = (metric.end_time - metric.start_time) * 1000
            
            # Calculate memory change
            final_memory = process.memory_info().rss / 1024 / 1024
            metric.memory_usage_mb = final_memory - initial_memory
            
            # Get CPU usage
            metric.cpu_usage_percent = process.cpu_percent()
            
            await self._store_metric(metric)
    
    async def _store_metric(self, metric: PerformanceMetrics):
        """Store metric with thread safety"""
        async with self._lock:
            self.metrics.append(metric)
            
            # Update aggregated stats
            stats = self.aggregated_stats[metric.operation_name]
            stats['count'] += 1
            stats['total_time'] += metric.duration_ms
            stats['avg_time'] = stats['total_time'] / stats['count']
            stats['min_time'] = min(stats['min_time'], metric.duration_ms)
            stats['max_time'] = max(stats['max_time'], metric.duration_ms)
    
    async def get_stats(self, operation_name: Optional[str] = None) -> Dict[str, Any]:
        """Get performance statistics"""
        async with self._lock:
            if operation_name:
                return self.aggregated_stats.get(operation_name, {})
            return dict(self.aggregated_stats)
    
    async def get_recent_metrics(self, limit: int = 100) -> List[PerformanceMetrics]:
        """Get recent metrics"""
        async with self._lock:
            return list(self.metrics)[-limit:]

# ============================================================================
# Async Resource Management
# ============================================================================

class AsyncResourcePool(Generic[T]):
    """Generic async resource pool with health checking"""
    
    def __init__(
        self, 
        factory: Callable[[], T],
        health_check: Callable[[T], bool] = None,
        max_size: int = 10,
        min_size: int = 2,
        max_idle_time: float = 300.0  # 5 minutes
    ):
        self.factory = factory
        self.health_check = health_check or (lambda x: True)
        self.max_size = max_size
        self.min_size = min_size
        self.max_idle_time = max_idle_time
        
        self._pool: asyncio.Queue[Tuple[T, float]] = asyncio.Queue(maxsize=max_size)
        self._created_count = 0
        self._lock = asyncio.Lock()
        self._cleanup_task: Optional[asyncio.Task] = None
        self._closed = False
    
    async def __aenter__(self):
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def initialize(self):
        """Initialize the pool with minimum resources"""
        async with self._lock:
            for _ in range(self.min_size):
                resource = await self._create_resource()
                await self._pool.put((resource, time.time()))
        
        # Start cleanup task
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    async def _create_resource(self) -> T:
        """Create a new resource"""
        if self._created_count >= self.max_size:
            raise RuntimeError("Resource pool exhausted")
        
        resource = self.factory()
        self._created_count += 1
        return resource
    
    @asynccontextmanager
    async def acquire(self):
        """Acquire a resource from the pool"""
        if self._closed:
            raise RuntimeError("Resource pool is closed")
        
        try:
            # Try to get from pool first
            try:
                resource, _ = await asyncio.wait_for(self._pool.get_nowait(), timeout=0.1)
                if not self.health_check(resource):
                    # Resource is unhealthy, create new one
                    resource = await self._create_resource()
            except (asyncio.QueueEmpty, asyncio.TimeoutError):
                # Pool is empty, create new resource
                resource = await self._create_resource()
            
            yield resource
            
        finally:
            # Return resource to pool if still healthy
            if not self._closed and self.health_check(resource):
                try:
                    await self._pool.put_nowait((resource, time.time()))
                except asyncio.QueueFull:
                    # Pool is full, just discard
                    self._created_count -= 1
            else:
                self._created_count -= 1
    
    async def _cleanup_loop(self):
        """Cleanup idle resources periodically"""
        while not self._closed:
            try:
                await asyncio.sleep(60)  # Check every minute
                await self._cleanup_idle_resources()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in resource pool cleanup: {e}")
    
    async def _cleanup_idle_resources(self):
        """Remove idle resources beyond max_idle_time"""
        current_time = time.time()
        new_pool = asyncio.Queue(maxsize=self.max_size)
        
        while not self._pool.empty():
            try:
                resource, last_used = await self._pool.get_nowait()
                if current_time - last_used < self.max_idle_time:
                    await new_pool.put((resource, last_used))
                else:
                    self._created_count -= 1
            except asyncio.QueueEmpty:
                break
        
        self._pool = new_pool
    
    async def close(self):
        """Close the pool and cleanup resources"""
        self._closed = True
        
        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass
        
        # Cleanup remaining resources
        while not self._pool.empty():
            try:
                resource, _ = await self._pool.get_nowait()
                # Resource-specific cleanup would go here
            except asyncio.QueueEmpty:
                break

# ============================================================================
# Memory Management and Optimization
# ============================================================================

class MemoryOptimizer:
    """Memory optimization utilities for high-throughput processing"""
    
    def __init__(self, gc_threshold: float = 0.8, max_cache_size: int = 1000):
        self.gc_threshold = gc_threshold  # Memory usage threshold for GC
        self.max_cache_size = max_cache_size
        self._cache_stats = {'hits': 0, 'misses': 0}
        self._last_gc = time.time()
        self._gc_interval = 60.0  # Minimum seconds between GC runs
    
    async def check_memory_pressure(self) -> bool:
        """Check if system is under memory pressure"""
        try:
            memory = psutil.virtual_memory()
            return memory.percent / 100.0 > self.gc_threshold
        except Exception:
            return False
    
    async def optimize_memory(self, force: bool = False):
        """Trigger memory optimization if needed"""
        current_time = time.time()
        
        if force or (
            current_time - self._last_gc > self._gc_interval and
            await self.check_memory_pressure()
        ):
            # Force garbage collection
            collected = gc.collect()
            self._last_gc = current_time
            
            logger.debug(f"Memory optimization: collected {collected} objects")
            
            # Additional cleanup
            await self._cleanup_weak_references()
    
    async def _cleanup_weak_references(self):
        """Cleanup weak references"""
        # This would clean up any weak reference caches
        pass
    
    @lru_cache(maxsize=None)
    def get_cache_key(self, *args, **kwargs) -> str:
        """Generate cache key for function arguments"""
        key_data = str(args) + str(sorted(kwargs.items()))
        return hashlib.md5(key_data.encode()).hexdigest()

def memory_efficient_cache(maxsize: int = 128):
    """Memory-efficient cache decorator with automatic cleanup"""
    def decorator(func):
        cache = {}
        access_times = {}
        
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            key = str(args) + str(sorted(kwargs.items()))
            key_hash = hashlib.md5(key.encode()).hexdigest()
            
            # Check cache
            if key_hash in cache:
                access_times[key_hash] = time.time()
                return cache[key_hash]
            
            # Call function
            result = await func(*args, **kwargs)
            
            # Store in cache with size management
            if len(cache) >= maxsize:
                # Remove oldest accessed item
                oldest_key = min(access_times.keys(), key=lambda k: access_times[k])
                del cache[oldest_key]
                del access_times[oldest_key]
            
            cache[key_hash] = result
            access_times[key_hash] = time.time()
            
            return result
        
        wrapper.cache_info = lambda: {
            'size': len(cache),
            'maxsize': maxsize,
            'hits': sum(1 for _ in cache),
            'misses': 0  # Simplified tracking
        }
        wrapper.cache_clear = lambda: (cache.clear(), access_times.clear())
        
        return wrapper
    return decorator

# ============================================================================
# Async Email Intelligence Engine
# ============================================================================

class EmailClass(Enum):
    NEEDS_REPLY = "NEEDS_REPLY"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    CREATE_TASK = "CREATE_TASK"
    DELEGATE = "DELEGATE"
    FYI_ONLY = "FYI_ONLY"
    FOLLOW_UP = "FOLLOW_UP"

class Urgency(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class Sentiment(Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"
    FRUSTRATED = "FRUSTRATED"

@dataclass
class ActionItem:
    """Extracted action item with context"""
    text: str
    assignee: Optional[str] = None
    deadline: Optional[datetime] = None
    confidence: float = 0.0

@dataclass
class EmailIntelligence:
    """Complete email analysis result"""
    classification: EmailClass
    confidence: float
    urgency: Urgency
    sentiment: Sentiment
    intent: str
    action_items: List[ActionItem]
    deadlines: List[Tuple[datetime, str]]
    confidence_scores: Dict[str, float]
    processing_time_ms: float

class AsyncEmailIntelligenceEngine:
    """
    Production-optimized async email intelligence engine
    
    Features:
    - Async I/O for all operations
    - Connection pooling for HTTP and database
    - Memory-efficient processing with garbage collection
    - Comprehensive error handling and retries
    - Performance monitoring and metrics
    """
    
    def __init__(
        self,
        openai_api_key: Optional[str] = None,
        max_concurrent_requests: int = 10,
        db_pool_size: int = 5,
        cache_size: int = 1000,
        enable_monitoring: bool = True
    ):
        self.openai_api_key = openai_api_key
        self.max_concurrent_requests = max_concurrent_requests
        self.cache_size = cache_size
        
        # Initialize components
        self.monitor = AsyncPerformanceMonitor() if enable_monitoring else None
        self.memory_optimizer = MemoryOptimizer(max_cache_size=cache_size)
        
        # Connection pools
        self._http_session: Optional[aiohttp.ClientSession] = None
        self._db_pool: Optional[AsyncResourcePool] = None
        
        # Semaphore for rate limiting
        self._request_semaphore = asyncio.Semaphore(max_concurrent_requests)
        
        # Pattern compilation (done once for performance)
        self._compile_patterns()
        
        # Statistics
        self.stats = {
            'total_analyzed': 0,
            'avg_confidence': 0.0,
            'cache_hits': 0,
            'cache_misses': 0,
            'errors': 0
        }
        
        # Cache for classifications
        self._classification_cache: Dict[str, EmailIntelligence] = {}
        self._cache_access_times: Dict[str, float] = {}
    
    async def __aenter__(self):
        await self.initialize()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.cleanup()
    
    async def initialize(self):
        """Initialize async resources"""
        # Initialize HTTP session with optimized settings
        connector = aiohttp.TCPConnector(
            limit=100,
            limit_per_host=30,
            keepalive_timeout=30,
            enable_cleanup_closed=True
        )
        
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        
        self._http_session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={'User-Agent': 'EmailIntelligenceEngine/1.0'}
        )
        
        # Initialize database pool
        self._db_pool = AsyncResourcePool(
            factory=lambda: aiosqlite.connect("email_intelligence.db"),
            max_size=5,
            min_size=2
        )
        
        await self._db_pool.initialize()
        await self._init_database()
        
        logger.info("AsyncEmailIntelligenceEngine initialized")
    
    async def cleanup(self):
        """Cleanup async resources"""
        if self._http_session:
            await self._http_session.close()
        
        if self._db_pool:
            await self._db_pool.close()
        
        # Final memory cleanup
        await self.memory_optimizer.optimize_memory(force=True)
        
        logger.info("AsyncEmailIntelligenceEngine cleaned up")
    
    def _compile_patterns(self):
        """Compile regex patterns for performance"""
        self.classification_patterns = {
            EmailClass.NEEDS_REPLY: {
                'patterns': [
                    (re.compile(r'\b(please\s+(?:reply|respond|confirm|let\s+me\s+know))\b', re.IGNORECASE), 0.9),
                    (re.compile(r'\b(waiting\s+for\s+your\s+(?:response|reply))\b', re.IGNORECASE), 0.85),
                    (re.compile(r'\b(could\s+you\s+please)\b', re.IGNORECASE), 0.8),
                    (re.compile(r'\?[^?]*$', re.IGNORECASE), 0.6),
                ],
                'negative': [
                    (re.compile(r'\b(fyi|for\s+your\s+information|just\s+to\s+let\s+you\s+know)\b', re.IGNORECASE), -0.5),
                ]
            },
            # Add other patterns...
        }
        
        self.urgency_patterns = {
            Urgency.CRITICAL: [
                (re.compile(r'\b(urgent|asap|immediately|critical|emergency)\b', re.IGNORECASE), 0.95),
                (re.compile(r'\b(today|right\s+now|this\s+morning)\b', re.IGNORECASE), 0.8),
            ],
            # Add other patterns...
        }
    
    async def _init_database(self):
        """Initialize database schema"""
        async with self._db_pool.acquire() as db:
            await db.execute("""
                CREATE TABLE IF NOT EXISTS email_intelligence (
                    id TEXT PRIMARY KEY,
                    email_hash TEXT UNIQUE,
                    classification TEXT,
                    confidence REAL,
                    urgency TEXT,
                    sentiment TEXT,
                    processing_time_ms REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_email_hash ON email_intelligence(email_hash)
            """)
            
            await db.execute("""
                CREATE INDEX IF NOT EXISTS idx_created_at ON email_intelligence(created_at)
            """)
            
            await db.commit()
    
    @memory_efficient_cache(maxsize=500)
    async def analyze_email(
        self, 
        subject: str, 
        body: str, 
        sender: str = "",
        metadata: Optional[Dict] = None,
        use_cache: bool = True
    ) -> EmailIntelligence:
        """
        Analyze email with async optimizations and caching
        """
        if self.monitor:
            async with self.monitor.measure("analyze_email", {"sender": sender}) as metric:
                return await self._analyze_email_impl(subject, body, sender, metadata, use_cache)
        else:
            return await self._analyze_email_impl(subject, body, sender, metadata, use_cache)
    
    async def _analyze_email_impl(
        self, 
        subject: str, 
        body: str, 
        sender: str,
        metadata: Optional[Dict],
        use_cache: bool
    ) -> EmailIntelligence:
        """Internal implementation of email analysis"""
        start_time = time.time()
        
        # Generate cache key
        content_hash = self._generate_content_hash(subject, body, sender)
        
        # Check cache first
        if use_cache and content_hash in self._classification_cache:
            self.stats['cache_hits'] += 1
            self._cache_access_times[content_hash] = time.time()
            cached_result = self._classification_cache[content_hash]
            cached_result.processing_time_ms = 0  # Indicate cache hit
            return cached_result
        
        self.stats['cache_misses'] += 1
        
        try:
            # Preprocess text efficiently
            full_text = await self._preprocess_text_async(f"{subject} {body}")
            
            # Classification with rate limiting
            async with self._request_semaphore:
                classification, confidence = await self._classify_email_async(
                    full_text, subject, sender
                )
            
            # Extract features concurrently
            urgency_task = asyncio.create_task(self._extract_urgency_async(full_text))
            sentiment_task = asyncio.create_task(self._extract_sentiment_async(full_text))
            intent_task = asyncio.create_task(self._extract_intent_async(full_text, classification))
            action_items_task = asyncio.create_task(self._extract_action_items_async(full_text))
            deadlines_task = asyncio.create_task(self._extract_deadlines_async(full_text))
            
            # Wait for all tasks to complete
            urgency, sentiment, intent, action_items, deadlines = await asyncio.gather(
                urgency_task, sentiment_task, intent_task, action_items_task, deadlines_task
            )
            
            # Calculate confidence scores
            confidence_scores = {
                'classification': confidence,
                'urgency': await self._calculate_confidence_async(urgency, full_text, self.urgency_patterns),
                'sentiment': 0.8,  # Simplified for demo
                'action_items': np.mean([item.confidence for item in action_items]) if action_items else 0.0,
                'deadlines': 0.8 if deadlines else 0.0
            }
            
            processing_time = (time.time() - start_time) * 1000
            
            result = EmailIntelligence(
                classification=classification,
                confidence=confidence,
                urgency=urgency,
                sentiment=sentiment,
                intent=intent,
                action_items=action_items,
                deadlines=deadlines,
                confidence_scores=confidence_scores,
                processing_time_ms=processing_time
            )
            
            # Cache result with size management
            await self._cache_result(content_hash, result)
            
            # Store in database asynchronously
            asyncio.create_task(self._store_result_async(content_hash, result))
            
            # Update statistics
            self.stats['total_analyzed'] += 1
            if self.stats['avg_confidence'] == 0:
                self.stats['avg_confidence'] = confidence
            else:
                self.stats['avg_confidence'] = (self.stats['avg_confidence'] + confidence) / 2
            
            # Trigger memory optimization if needed
            asyncio.create_task(self.memory_optimizer.optimize_memory())
            
            return result
            
        except Exception as e:
            self.stats['errors'] += 1
            logger.error(f"Error analyzing email: {e}")
            raise
    
    async def _preprocess_text_async(self, text: str) -> str:
        """Async text preprocessing"""
        # Run CPU-intensive preprocessing in thread pool
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            return await loop.run_in_executor(executor, self._preprocess_text_sync, text)
    
    def _preprocess_text_sync(self, text: str) -> str:
        """Synchronous text preprocessing for thread pool"""
        # Handle unicode normalization
        text = unicodedata.normalize('NFKD', text)
        text = text.lower()
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'--\s*\n.*', '', text, flags=re.DOTALL)
        return text
    
    async def _classify_email_async(
        self, 
        text: str, 
        subject: str, 
        sender: str
    ) -> Tuple[EmailClass, float]:
        """Async email classification with AI fallback"""
        
        # Try AI classification first if configured
        if self.openai_api_key and self._http_session:
            try:
                result = await self._classify_with_ai_async(text, subject, sender)
                if result:
                    return result
            except Exception as e:
                logger.warning(f"AI classification failed: {e}")
        
        # Fallback to pattern-based classification
        return await self._classify_with_patterns_async(text, subject, sender)
    
    async def _classify_with_ai_async(
        self, 
        text: str, 
        subject: str, 
        sender: str
    ) -> Optional[Tuple[EmailClass, float]]:
        """Async AI-based classification with retry logic"""
        
        system_prompt = (
            "You are an email classification expert. Classify emails into one of these categories:\n"
            "- NEEDS_REPLY: Requires a response from the recipient\n"
            "- APPROVAL_REQUIRED: Requires approval or sign-off\n"
            "- CREATE_TASK: Contains action items or tasks to complete\n"
            "- DELEGATE: Should be delegated to someone else\n"
            "- FYI_ONLY: Informational only, no action needed\n"
            "- FOLLOW_UP: Requires follow-up or check-in\n\n"
            "Respond with ONLY the category name and a confidence score (0-1) separated by a pipe, e.g.: NEEDS_REPLY|0.95"
        )
        
        user_prompt = (
            f"Subject: {subject}\n"
            f"From: {sender}\n\n"
            f"Email content:\n{text[:1000]}"  # Limit for efficiency
        )
        
        payload = {
            "model": "gpt-3.5-turbo",  # Use available model
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 50,
        }
        
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json",
        }
        
        # Retry logic with exponential backoff
        for attempt in range(3):
            try:
                async with self._http_session.post(
                    "https://api.openai.com/v1/chat/completions",
                    json=payload,
                    headers=headers
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        result = (
                            data.get("choices", [{}])[0]
                            .get("message", {})
                            .get("content", "")
                            .strip()
                        )
                        
                        if result and "|" in result:
                            parts = result.split("|")
                            class_name = parts[0].strip()
                            confidence = float(parts[1].strip())
                            
                            # Map string to enum
                            for email_class in EmailClass:
                                if email_class.value == class_name:
                                    return email_class, confidence
                        
                        return None
                    
                    elif response.status == 429:  # Rate limited
                        wait_time = 2 ** attempt
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        response.raise_for_status()
                        
            except Exception as e:
                if attempt == 2:  # Last attempt
                    logger.error(f"AI classification failed after retries: {e}")
                    return None
                await asyncio.sleep(2 ** attempt)
        
        return None
    
    async def _classify_with_patterns_async(
        self, 
        text: str, 
        subject: str, 
        sender: str
    ) -> Tuple[EmailClass, float]:
        """Async pattern-based classification"""
        
        class_scores = {}
        
        for email_class, patterns_data in self.classification_patterns.items():
            score = 0.0
            
            # Positive patterns
            for pattern, weight in patterns_data['patterns']:
                matches = len(pattern.findall(text))
                score += matches * weight
            
            # Negative patterns
            for pattern, weight in patterns_data.get('negative', []):
                matches = len(pattern.findall(text))
                score += matches * weight  # weight is negative
            
            class_scores[email_class] = max(0.0, score)
        
        # Apply business rules
        class_scores = await self._apply_classification_rules_async(
            class_scores, text, subject, sender
        )
        
        # Get best classification
        if not class_scores or max(class_scores.values()) == 0:
            return EmailClass.FYI_ONLY, 0.5
        
        best_class = max(class_scores.items(), key=lambda x: x[1])
        
        # Normalize confidence
        max_score = max(class_scores.values())
        confidence = min(best_class[1] / (max_score + 1.0), 1.0) if max_score > 0 else 0.5
        
        return best_class[0], confidence
    
    async def _apply_classification_rules_async(
        self, 
        scores: Dict, 
        text: str, 
        subject: str, 
        sender: str
    ) -> Dict:
        """Apply business rules asynchronously"""
        
        # Run rule application in thread pool for CPU-intensive work
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            return await loop.run_in_executor(
                executor, self._apply_classification_rules_sync, scores, text, subject, sender
            )
    
    def _apply_classification_rules_sync(
        self, 
        scores: Dict, 
        text: str, 
        subject: str, 
        sender: str
    ) -> Dict:
        """Synchronous rule application"""
        
        # Rule: Emails with questions likely need replies
        question_count = len(re.findall(r'\?', text))
        if question_count > 0:
            scores[EmailClass.NEEDS_REPLY] = scores.get(EmailClass.NEEDS_REPLY, 0) + question_count * 0.3
        
        # Rule: Subject line indicators
        if re.search(r'\b(re:|fwd:)\b', subject.lower()):
            scores[EmailClass.FOLLOW_UP] = scores.get(EmailClass.FOLLOW_UP, 0) + 0.2
        
        if re.search(r'\b(urgent|asap)\b', subject.lower()):
            scores[EmailClass.NEEDS_REPLY] = scores.get(EmailClass.NEEDS_REPLY, 0) + 0.3
        
        # Rule: Automated emails
        if re.search(r'\b(no-?reply|donotreply|automated)\b', sender.lower()):
            scores[EmailClass.FYI_ONLY] = scores.get(EmailClass.FYI_ONLY, 0) + 0.5
        
        return scores
    
    async def _extract_urgency_async(self, text: str) -> Urgency:
        """Extract urgency level asynchronously"""
        urgency_scores = {}
        
        for urgency, patterns in self.urgency_patterns.items():
            score = 0.0
            for pattern, weight in patterns:
                matches = len(pattern.findall(text))
                score += matches * weight
            urgency_scores[urgency] = score
        
        if not urgency_scores or max(urgency_scores.values()) == 0:
            return Urgency.MEDIUM
        
        return max(urgency_scores.items(), key=lambda x: x[1])[0]
    
    async def _extract_sentiment_async(self, text: str) -> Sentiment:
        """Extract sentiment asynchronously"""
        # Simplified sentiment analysis
        if re.search(r'\b(thanks?|thank\s+you|appreciate|great|excellent)\b', text, re.IGNORECASE):
            return Sentiment.POSITIVE
        elif re.search(r'\b(frustrated|annoyed|disappointed|problem|issue)\b', text, re.IGNORECASE):
            return Sentiment.NEGATIVE
        else:
            return Sentiment.NEUTRAL
    
    async def _extract_intent_async(self, text: str, classification: EmailClass) -> str:
        """Extract intent asynchronously"""
        # Simplified intent extraction
        return classification.value.lower().replace('_', ' ')
    
    async def _extract_action_items_async(self, text: str) -> List[ActionItem]:
        """Extract action items asynchronously"""
        action_items = []
        
        # Simple pattern matching
        patterns = [
            (re.compile(r'\b(please\s+(?:\w+\s+){0,3}\w+)', re.IGNORECASE), 0.8),
            (re.compile(r'\b(need\s+to\s+(?:\w+\s+){0,3}\w+)', re.IGNORECASE), 0.7),
            (re.compile(r'\b(action\s+item:?\s+(.+))', re.IGNORECASE), 0.9),
        ]
        
        for pattern, confidence in patterns:
            for match in pattern.finditer(text):
                action_text = match.group(1) if match.groups() else match.group(0)
                action_text = action_text.strip()
                
                if len(action_text) > 10:  # Filter out very short actions
                    action_items.append(ActionItem(
                        text=action_text,
                        confidence=confidence
                    ))
        
        return action_items[:5]  # Limit to top 5
    
    async def _extract_deadlines_async(self, text: str) -> List[Tuple[datetime, str]]:
        """Extract deadlines asynchronously"""
        deadlines = []
        
        patterns = [
            (re.compile(r'\b(by\s+(?:monday|tuesday|wednesday|thursday|friday))\b', re.IGNORECASE), 0.9),
            (re.compile(r'\b(due\s+(?:date|by)?:?\s*([^.!?\n]+))', re.IGNORECASE), 0.85),
            (re.compile(r'\b(by\s+tomorrow)\b', re.IGNORECASE), 0.95),
        ]
        
        for pattern, confidence in patterns:
            for match in pattern.finditer(text):
                deadline_text = match.group(1) if match.groups() else match.group(0)
                deadline_date = await self._parse_deadline_date_async(deadline_text)
                
                if deadline_date:
                    deadlines.append((deadline_date, deadline_text.strip()))
        
        return sorted(list(set(deadlines)), key=lambda x: x[0])[:3]
    
    async def _parse_deadline_date_async(self, deadline_text: str) -> Optional[datetime]:
        """Parse deadline text asynchronously"""
        now = datetime.now()
        deadline_text = deadline_text.lower().strip()
        
        if 'today' in deadline_text:
            return now.replace(hour=17, minute=0, second=0, microsecond=0)
        elif 'tomorrow' in deadline_text:
            return (now + timedelta(days=1)).replace(hour=17, minute=0, second=0, microsecond=0)
        elif 'friday' in deadline_text:
            days_until_friday = (4 - now.weekday()) % 7
            if days_until_friday == 0:
                days_until_friday = 7
            return (now + timedelta(days=days_until_friday)).replace(hour=17, minute=0, second=0, microsecond=0)
        
        return None
    
    async def _calculate_confidence_async(self, prediction: Any, text: str, patterns: Dict) -> float:
        """Calculate confidence score asynchronously"""
        if prediction in patterns:
            score = 0.0
            for pattern, weight in patterns[prediction]:
                matches = len(pattern.findall(text))
                score += matches * weight
            return min(score, 1.0)
        return 0.5
    
    def _generate_content_hash(self, subject: str, body: str, sender: str) -> str:
        """Generate hash for content caching"""
        content = f"{subject}|{body}|{sender}"
        return hashlib.sha256(content.encode()).hexdigest()
    
    async def _cache_result(self, content_hash: str, result: EmailIntelligence):
        """Cache result with size management"""
        if len(self._classification_cache) >= self.cache_size:
            # Remove oldest accessed item
            oldest_hash = min(
                self._cache_access_times.keys(),
                key=lambda k: self._cache_access_times[k]
            )
            del self._classification_cache[oldest_hash]
            del self._cache_access_times[oldest_hash]
        
        self._classification_cache[content_hash] = result
        self._cache_access_times[content_hash] = time.time()
    
    async def _store_result_async(self, content_hash: str, result: EmailIntelligence):
        """Store result in database asynchronously"""
        try:
            async with self._db_pool.acquire() as db:
                await db.execute("""
                    INSERT OR REPLACE INTO email_intelligence 
                    (email_hash, classification, confidence, urgency, sentiment, processing_time_ms)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    content_hash,
                    result.classification.value,
                    result.confidence,
                    result.urgency.value,
                    result.sentiment.value,
                    result.processing_time_ms
                ))
                await db.commit()
        except Exception as e:
            logger.error(f"Error storing result in database: {e}")
    
    async def batch_analyze(
        self, 
        emails: List[Dict],
        batch_size: int = 50,
        max_concurrency: int = 10
    ) -> List[EmailIntelligence]:
        """Analyze multiple emails efficiently with batching and concurrency control"""
        
        if self.monitor:
            async with self.monitor.measure("batch_analyze", {"count": len(emails)}) as metric:
                return await self._batch_analyze_impl(emails, batch_size, max_concurrency)
        else:
            return await self._batch_analyze_impl(emails, batch_size, max_concurrency)
    
    async def _batch_analyze_impl(
        self,
        emails: List[Dict],
        batch_size: int,
        max_concurrency: int
    ) -> List[EmailIntelligence]:
        """Internal batch analysis implementation"""
        
        results = []
        semaphore = asyncio.Semaphore(max_concurrency)
        
        async def analyze_single(email):
            async with semaphore:
                try:
                    return await self.analyze_email(
                        subject=email.get('subject', ''),
                        body=email.get('body', ''),
                        sender=email.get('sender', ''),
                        metadata=email.get('metadata', {})
                    )
                except Exception as e:
                    logger.error(f"Error analyzing email in batch: {e}")
                    # Return fallback result
                    return EmailIntelligence(
                        classification=EmailClass.FYI_ONLY,
                        confidence=0.0,
                        urgency=Urgency.MEDIUM,
                        sentiment=Sentiment.NEUTRAL,
                        intent="unknown",
                        action_items=[],
                        deadlines=[],
                        confidence_scores={},
                        processing_time_ms=0.0
                    )
        
        # Process emails in batches
        for i in range(0, len(emails), batch_size):
            batch = emails[i:i + batch_size]
            
            # Create tasks for batch
            tasks = [analyze_single(email) for email in batch]
            
            # Execute batch with concurrency control
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Handle exceptions and collect results
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.error(f"Batch processing error: {result}")
                    # Add fallback result
                    results.append(EmailIntelligence(
                        classification=EmailClass.FYI_ONLY,
                        confidence=0.0,
                        urgency=Urgency.MEDIUM,
                        sentiment=Sentiment.NEUTRAL,
                        intent="error",
                        action_items=[],
                        deadlines=[],
                        confidence_scores={},
                        processing_time_ms=0.0
                    ))
                else:
                    results.append(result)
            
            # Trigger garbage collection between batches
            if i % (batch_size * 5) == 0:  # Every 5 batches
                await self.memory_optimizer.optimize_memory()
        
        return results
    
    async def get_performance_metrics(self) -> Dict[str, Any]:
        """Get comprehensive performance metrics"""
        base_metrics = {
            'engine_stats': self.stats,
            'cache_info': {
                'size': len(self._classification_cache),
                'hit_rate': self.stats['cache_hits'] / max(1, self.stats['cache_hits'] + self.stats['cache_misses']),
                'max_size': self.cache_size
            },
            'memory_info': {
                'rss_mb': psutil.Process().memory_info().rss / 1024 / 1024,
                'percent': psutil.virtual_memory().percent
            }
        }
        
        if self.monitor:
            performance_stats = await self.monitor.get_stats()
            base_metrics['performance_stats'] = performance_stats
            
            recent_metrics = await self.monitor.get_recent_metrics(limit=50)
            base_metrics['recent_metrics'] = [
                {
                    'operation': m.operation_name,
                    'duration_ms': m.duration_ms,
                    'success': m.success,
                    'memory_mb': m.memory_usage_mb
                }
                for m in recent_metrics
            ]
        
        return base_metrics

# ============================================================================
# Example Usage and Testing
# ============================================================================

async def demo_async_engine():
    """Demonstration of the async email intelligence engine"""
    
    print("🚀 Starting Async Email Intelligence Engine Demo")
    print("=" * 60)
    
    # Initialize engine with context manager
    async with AsyncEmailIntelligenceEngine(
        max_concurrent_requests=5,
        cache_size=100,
        enable_monitoring=True
    ) as engine:
        
        # Test emails
        test_emails = [
            {
                'subject': 'URGENT: Please approve budget for Q4',
                'body': 'Hi team, I need your approval for the Q4 marketing budget by end of this week. The amount is $50,000. Please let me know if you have any questions.',
                'sender': 'john.doe@company.com'
            },
            {
                'subject': 'FYI: Server maintenance scheduled',
                'body': 'Just to let you know that we have scheduled server maintenance for this weekend. No action required from your side.',
                'sender': 'it-team@company.com'
            },
            {
                'subject': 'Can you help with the presentation?',
                'body': 'Hi Sarah, could you please help me with the slides for tomorrow\'s client presentation? I need someone to review the financial projections section.',
                'sender': 'mike.wilson@company.com'
            }
        ]
        
        print(f"📧 Processing {len(test_emails)} emails...")
        
        # Process single email
        start_time = time.time()
        result = await engine.analyze_email(
            subject=test_emails[0]['subject'],
            body=test_emails[0]['body'],
            sender=test_emails[0]['sender']
        )
        single_time = time.time() - start_time
        
        print(f"\n🔍 Single Email Analysis (took {single_time*1000:.1f}ms):")
        print(f"  Classification: {result.classification.value}")
        print(f"  Confidence: {result.confidence:.2f}")
        print(f"  Urgency: {result.urgency.value}")
        print(f"  Action Items: {len(result.action_items)}")
        
        # Process batch
        start_time = time.time()
        batch_results = await engine.batch_analyze(test_emails)
        batch_time = time.time() - start_time
        
        print(f"\n📦 Batch Analysis (took {batch_time*1000:.1f}ms):")
        for i, result in enumerate(batch_results):
            print(f"  Email {i+1}: {result.classification.value} ({result.confidence:.2f})")
        
        # Test caching by re-analyzing same email
        start_time = time.time()
        cached_result = await engine.analyze_email(
            subject=test_emails[0]['subject'],
            body=test_emails[0]['body'],
            sender=test_emails[0]['sender']
        )
        cache_time = time.time() - start_time
        
        print(f"\n💾 Cached Analysis (took {cache_time*1000:.1f}ms):")
        print(f"  Processing time: {cached_result.processing_time_ms:.1f}ms (cache hit)")
        
        # Get performance metrics
        metrics = await engine.get_performance_metrics()
        print(f"\n📊 Performance Metrics:")
        print(f"  Total Analyzed: {metrics['engine_stats']['total_analyzed']}")
        print(f"  Cache Hit Rate: {metrics['cache_info']['hit_rate']:.1%}")
        print(f"  Memory Usage: {metrics['memory_info']['rss_mb']:.1f} MB")
        print(f"  Errors: {metrics['engine_stats']['errors']}")
        
        if 'performance_stats' in metrics:
            analyze_stats = metrics['performance_stats'].get('analyze_email', {})
            if analyze_stats:
                print(f"  Avg Analysis Time: {analyze_stats.get('avg_time', 0):.1f}ms")
                print(f"  Analysis Count: {analyze_stats.get('count', 0)}")

if __name__ == "__main__":
    asyncio.run(demo_async_engine())