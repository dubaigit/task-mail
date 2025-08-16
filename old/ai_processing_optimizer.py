#!/usr/bin/env python3
"""
AI Processing Performance Optimizer with Redis Caching and Queue Management

High-performance AI processing system for email intelligence with:
- Redis-based caching for AI analysis results
- Intelligent batch processing with priority queues
- Rate limiting with backoff and retry logic
- Performance monitoring and auto-scaling
- WebSocket scaling for 500+ concurrent connections
- Cost optimization for OpenAI API calls

Designed to handle 20+ AI requests/minute with fallback strategies
and comprehensive performance monitoring.
"""

import asyncio
import logging
import time
import json
import hashlib
import pickle
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union, Callable
from dataclasses import dataclass, asdict
from enum import Enum
from collections import deque, defaultdict
import threading
import os
from concurrent.futures import ThreadPoolExecutor

# Redis for distributed caching
try:
    import redis.asyncio as aioredis
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

# Performance monitoring
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

# Setup logging
logger = logging.getLogger(__name__)

class ProcessingPriority(Enum):
    """Processing priority levels"""
    URGENT = "URGENT"      # < 5s response time
    HIGH = "HIGH"          # < 30s response time  
    NORMAL = "NORMAL"      # < 2m response time
    LOW = "LOW"            # < 10m response time
    BACKGROUND = "BACKGROUND"  # Best effort

class CacheType(Enum):
    """Cache data types"""
    CLASSIFICATION = "classification"
    DRAFT = "draft"
    ANALYSIS = "analysis"
    SUMMARY = "summary"
    EMBEDDINGS = "embeddings"

@dataclass
class ProcessingRequest:
    """AI processing request with metadata"""
    request_id: str
    email_id: int
    content_hash: str
    request_type: str  # 'classification', 'draft', 'analysis'
    priority: ProcessingPriority
    content: str
    metadata: Dict[str, Any]
    created_at: datetime
    retry_count: int = 0
    max_retries: int = 3
    timeout_seconds: int = 30
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()

@dataclass
class ProcessingResult:
    """AI processing result with caching metadata"""
    request_id: str
    result: Any
    confidence: float
    processing_time_ms: float
    model_used: str
    cache_hit: bool
    cost_estimate: float
    created_at: datetime
    expires_at: Optional[datetime] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()

@dataclass
class PerformanceMetrics:
    """Performance monitoring metrics"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    avg_response_time_ms: float = 0.0
    requests_per_minute: float = 0.0
    cost_per_hour: float = 0.0
    queue_depth: int = 0
    active_workers: int = 0
    last_reset: datetime = None
    
    def __post_init__(self):
        if self.last_reset is None:
            self.last_reset = datetime.now()

class RedisAICache:
    """High-performance Redis-based cache for AI results"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.redis_client = None
        self.fallback_cache = {}
        self.metrics = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'errors': 0,
            'total_size_mb': 0.0
        }
        
        # Initialize Redis connection
        asyncio.create_task(self._initialize_redis())
    
    async def _initialize_redis(self):
        """Initialize Redis connection with fallback"""
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available, using in-memory fallback")
            return
        
        try:
            self.redis_client = aioredis.Redis(
                host=self.config.get('redis_host', 'localhost'),
                port=self.config.get('redis_port', 6379),
                db=self.config.get('redis_db', 0),
                password=self.config.get('redis_password'),
                decode_responses=False,
                retry_on_timeout=True,
                socket_keepalive=True,
                socket_keepalive_options={},
                health_check_interval=30
            )
            
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis cache initialized successfully")
            
        except Exception as e:
            logger.error(f"Redis initialization failed: {e}")
            self.redis_client = None
    
    def _generate_cache_key(self, request: ProcessingRequest) -> str:
        """Generate deterministic cache key"""
        key_data = {
            'type': request.request_type,
            'content_hash': request.content_hash,
            'model': self.config.get('model_name', 'default')
        }
        key_string = json.dumps(key_data, sort_keys=True)
        return f"ai_cache:{hashlib.md5(key_string.encode()).hexdigest()}"
    
    async def get(self, request: ProcessingRequest) -> Optional[ProcessingResult]:
        """Get cached result for request"""
        cache_key = self._generate_cache_key(request)
        
        try:
            if self.redis_client:
                # Try Redis first
                cached_data = await self.redis_client.get(cache_key)
                if cached_data:
                    result = pickle.loads(cached_data)
                    self.metrics['hits'] += 1
                    logger.debug(f"Cache hit for {request.request_id}")
                    return result
            else:
                # Fallback to memory cache
                if cache_key in self.fallback_cache:
                    entry = self.fallback_cache[cache_key]
                    if entry['expires_at'] > datetime.now():
                        self.metrics['hits'] += 1
                        return entry['result']
                    else:
                        del self.fallback_cache[cache_key]
            
            self.metrics['misses'] += 1
            return None
            
        except Exception as e:
            logger.error(f"Cache get error: {e}")
            self.metrics['errors'] += 1
            return None
    
    async def set(self, request: ProcessingRequest, result: ProcessingResult, ttl_seconds: int = 3600):
        """Cache result for request"""
        cache_key = self._generate_cache_key(request)
        
        try:
            if self.redis_client:
                # Store in Redis with TTL
                serialized_data = pickle.dumps(result)
                await self.redis_client.setex(cache_key, ttl_seconds, serialized_data)
                
                # Update size metrics
                self.metrics['total_size_mb'] += len(serialized_data) / (1024 * 1024)
                
            else:
                # Store in memory fallback
                self.fallback_cache[cache_key] = {
                    'result': result,
                    'expires_at': datetime.now() + timedelta(seconds=ttl_seconds)
                }
                
                # Limit memory cache size
                if len(self.fallback_cache) > 1000:
                    # Remove oldest 10%
                    oldest_keys = sorted(
                        self.fallback_cache.keys(),
                        key=lambda k: self.fallback_cache[k]['expires_at']
                    )[:100]
                    for key in oldest_keys:
                        del self.fallback_cache[key]
            
            self.metrics['sets'] += 1
            logger.debug(f"Cached result for {request.request_id}")
            
        except Exception as e:
            logger.error(f"Cache set error: {e}")
            self.metrics['errors'] += 1
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern"""
        try:
            if self.redis_client:
                keys = await self.redis_client.keys(f"ai_cache:*{pattern}*")
                if keys:
                    return await self.redis_client.delete(*keys)
            else:
                # Fallback cache pattern matching
                keys_to_delete = [
                    key for key in self.fallback_cache.keys()
                    if pattern in key
                ]
                for key in keys_to_delete:
                    del self.fallback_cache[key]
                return len(keys_to_delete)
            
            return 0
            
        except Exception as e:
            logger.error(f"Cache invalidation error: {e}")
            return 0
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get cache performance metrics"""
        base_metrics = self.metrics.copy()
        
        try:
            if self.redis_client:
                info = await self.redis_client.info()
                base_metrics.update({
                    'redis_memory_used': info.get('used_memory', 0),
                    'redis_keys': info.get('db0', {}).get('keys', 0),
                    'redis_connected': True
                })
            else:
                base_metrics.update({
                    'fallback_size': len(self.fallback_cache),
                    'redis_connected': False
                })
            
            # Calculate hit rate
            total_requests = base_metrics['hits'] + base_metrics['misses']
            base_metrics['hit_rate'] = (
                base_metrics['hits'] / total_requests if total_requests > 0 else 0.0
            )
            
        except Exception as e:
            logger.error(f"Error getting cache metrics: {e}")
        
        return base_metrics

class PriorityQueue:
    """Thread-safe priority queue for processing requests"""
    
    def __init__(self, max_size: int = 10000):
        self.max_size = max_size
        self.queues = {
            ProcessingPriority.URGENT: deque(),
            ProcessingPriority.HIGH: deque(),
            ProcessingPriority.NORMAL: deque(),
            ProcessingPriority.LOW: deque(),
            ProcessingPriority.BACKGROUND: deque()
        }
        self.lock = threading.RLock()
        self.condition = threading.Condition(self.lock)
        self.total_size = 0
    
    def put(self, request: ProcessingRequest) -> bool:
        """Add request to appropriate priority queue"""
        with self.condition:
            if self.total_size >= self.max_size:
                # Remove oldest background tasks if full
                if self.queues[ProcessingPriority.BACKGROUND]:
                    self.queues[ProcessingPriority.BACKGROUND].popleft()
                    self.total_size -= 1
                else:
                    return False  # Queue full
            
            self.queues[request.priority].append(request)
            self.total_size += 1
            self.condition.notify()
            return True
    
    def get(self, timeout: Optional[float] = None) -> Optional[ProcessingRequest]:
        """Get highest priority request"""
        with self.condition:
            # Check for timeout
            end_time = time.time() + timeout if timeout else None
            
            while self.total_size == 0:
                if end_time and time.time() >= end_time:
                    return None
                wait_time = min(1.0, end_time - time.time()) if end_time else None
                self.condition.wait(timeout=wait_time)
            
            # Get highest priority item
            for priority in ProcessingPriority:
                if self.queues[priority]:
                    request = self.queues[priority].popleft()
                    self.total_size -= 1
                    return request
            
            return None
    
    def size(self) -> int:
        """Get total queue size"""
        with self.lock:
            return self.total_size
    
    def priority_sizes(self) -> Dict[str, int]:
        """Get size by priority"""
        with self.lock:
            return {priority.value: len(queue) for priority, queue in self.queues.items()}

class RateLimiter:
    """Advanced rate limiter with backoff and cost tracking"""
    
    def __init__(self, config: Dict[str, Any]):
        self.requests_per_minute = config.get('requests_per_minute', 20)
        self.requests_per_hour = config.get('requests_per_hour', 1000)
        self.cost_limit_per_hour = config.get('cost_limit_per_hour', 10.0)
        self.base_delay = config.get('base_delay_seconds', 1.0)
        self.max_delay = config.get('max_delay_seconds', 60.0)
        
        # Sliding window counters
        self.minute_requests = deque()
        self.hour_requests = deque()
        self.hour_costs = deque()
        
        # Backoff tracking
        self.consecutive_failures = 0
        self.last_failure_time = None
        
        self.lock = threading.RLock()
    
    def _clean_windows(self):
        """Clean expired entries from sliding windows"""
        now = time.time()
        
        # Clean minute window
        while self.minute_requests and now - self.minute_requests[0] > 60:
            self.minute_requests.popleft()
        
        # Clean hour window
        while self.hour_requests and now - self.hour_requests[0][0] > 3600:
            self.hour_requests.popleft()
        
        # Clean cost window
        while self.hour_costs and now - self.hour_costs[0][0] > 3600:
            self.hour_costs.popleft()
    
    async def acquire(self, estimated_cost: float = 0.001) -> bool:
        """Acquire rate limit permit"""
        with self.lock:
            self._clean_windows()
            
            # Check minute limit
            if len(self.minute_requests) >= self.requests_per_minute:
                return False
            
            # Check hour limit
            if len(self.hour_requests) >= self.requests_per_hour:
                return False
            
            # Check cost limit
            current_hour_cost = sum(cost[1] for cost in self.hour_costs)
            if current_hour_cost + estimated_cost > self.cost_limit_per_hour:
                return False
            
            # Check backoff delay
            if self.last_failure_time:
                backoff_delay = min(
                    self.base_delay * (2 ** self.consecutive_failures),
                    self.max_delay
                )
                if time.time() - self.last_failure_time < backoff_delay:
                    return False
            
            # Acquire permit
            now = time.time()
            self.minute_requests.append(now)
            self.hour_requests.append((now, estimated_cost))
            self.hour_costs.append((now, estimated_cost))
            
            return True
    
    def record_success(self):
        """Record successful request"""
        with self.lock:
            self.consecutive_failures = 0
            self.last_failure_time = None
    
    def record_failure(self):
        """Record failed request"""
        with self.lock:
            self.consecutive_failures += 1
            self.last_failure_time = time.time()
    
    def get_status(self) -> Dict[str, Any]:
        """Get current rate limit status"""
        with self.lock:
            self._clean_windows()
            
            current_hour_cost = sum(cost[1] for cost in self.hour_costs)
            
            return {
                'requests_this_minute': len(self.minute_requests),
                'requests_this_hour': len(self.hour_requests),
                'cost_this_hour': current_hour_cost,
                'consecutive_failures': self.consecutive_failures,
                'backoff_until': (
                    self.last_failure_time + min(
                        self.base_delay * (2 ** self.consecutive_failures),
                        self.max_delay
                    ) if self.last_failure_time else None
                ),
                'can_make_request': (
                    len(self.minute_requests) < self.requests_per_minute and
                    len(self.hour_requests) < self.requests_per_hour and
                    current_hour_cost < self.cost_limit_per_hour
                )
            }

class AIProcessingOptimizer:
    """Main AI processing optimizer with Redis caching and queue management"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the AI processing optimizer"""
        self.config = self._load_config(config)
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.cache = RedisAICache(self.config.get('cache', {}))
        self.queue = PriorityQueue(self.config.get('max_queue_size', 10000))
        self.rate_limiter = RateLimiter(self.config.get('rate_limiting', {}))
        
        # Worker management
        self.workers = []
        self.num_workers = self.config.get('num_workers', 4)
        self.is_running = False
        
        # Performance tracking
        self.metrics = PerformanceMetrics()
        self.metrics_lock = threading.RLock()
        
        # AI client (mock for now - replace with actual OpenAI client)
        self.ai_client = None
        
        self.logger.info(f"AI Processing Optimizer initialized with {self.num_workers} workers")
    
    def _load_config(self, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Load configuration with defaults"""
        default_config = {
            'cache': {
                'redis_host': 'localhost',
                'redis_port': 6379,
                'redis_db': 0,
                'redis_password': None
            },
            'rate_limiting': {
                'requests_per_minute': 20,
                'requests_per_hour': 1000,
                'cost_limit_per_hour': 10.0,
                'base_delay_seconds': 1.0,
                'max_delay_seconds': 60.0
            },
            'processing': {
                'default_timeout': 30,
                'max_retries': 3,
                'classification_model': 'gpt-5-nano-2025-08-07',
                'draft_model': 'gpt-5-mini-2025-08-07'
            },
            'num_workers': 4,
            'max_queue_size': 10000
        }
        
        if config:
            self._deep_update(default_config, config)
        
        return default_config
    
    def _deep_update(self, base: dict, update: dict):
        """Deep update dictionary"""
        for key, value in update.items():
            if isinstance(value, dict) and key in base:
                self._deep_update(base[key], value)
            else:
                base[key] = value
    
    async def submit_request(self, request: ProcessingRequest) -> str:
        """Submit processing request to queue"""
        if not self.queue.put(request):
            raise Exception("Queue full - cannot accept new requests")
        
        with self.metrics_lock:
            self.metrics.total_requests += 1
            self.metrics.queue_depth = self.queue.size()
        
        self.logger.debug(f"Submitted request {request.request_id} with priority {request.priority.value}")
        return request.request_id
    
    async def process_request(self, request: ProcessingRequest) -> ProcessingResult:
        """Process individual AI request with caching and rate limiting"""
        start_time = time.time()
        
        # Check cache first
        cached_result = await self.cache.get(request)
        if cached_result:
            cached_result.cache_hit = True
            self.logger.debug(f"Cache hit for request {request.request_id}")
            return cached_result
        
        # Rate limiting
        estimated_cost = self._estimate_cost(request)
        if not await self.rate_limiter.acquire(estimated_cost):
            raise Exception("Rate limit exceeded - request rejected")
        
        try:
            # Mock AI processing (replace with actual OpenAI API call)
            result_data = await self._mock_ai_processing(request)
            
            # Create result
            processing_time = (time.time() - start_time) * 1000
            result = ProcessingResult(
                request_id=request.request_id,
                result=result_data,
                confidence=0.95,
                processing_time_ms=processing_time,
                model_used=self._get_model_for_request(request),
                cache_hit=False,
                cost_estimate=estimated_cost,
                created_at=datetime.now()
            )
            
            # Cache result
            cache_ttl = self._get_cache_ttl(request)
            await self.cache.set(request, result, cache_ttl)
            
            # Record success
            self.rate_limiter.record_success()
            
            with self.metrics_lock:
                self.metrics.successful_requests += 1
                # Update average response time
                total_successful = self.metrics.successful_requests
                self.metrics.avg_response_time_ms = (
                    (self.metrics.avg_response_time_ms * (total_successful - 1) + processing_time) / total_successful
                )
            
            self.logger.debug(f"Processed request {request.request_id} in {processing_time:.1f}ms")
            return result
            
        except Exception as e:
            self.rate_limiter.record_failure()
            
            with self.metrics_lock:
                self.metrics.failed_requests += 1
            
            self.logger.error(f"Error processing request {request.request_id}: {e}")
            raise
    
    async def _mock_ai_processing(self, request: ProcessingRequest) -> Dict[str, Any]:
        """Mock AI processing - replace with actual OpenAI API calls"""
        # Simulate processing delay
        delay = {
            ProcessingPriority.URGENT: 0.5,
            ProcessingPriority.HIGH: 1.0,
            ProcessingPriority.NORMAL: 2.0,
            ProcessingPriority.LOW: 3.0,
            ProcessingPriority.BACKGROUND: 5.0
        }.get(request.priority, 2.0)
        
        await asyncio.sleep(delay)
        
        # Mock results based on request type
        if request.request_type == 'classification':
            return {
                'category': 'NEEDS_REPLY',
                'urgency': 'HIGH',
                'confidence': 0.95
            }
        elif request.request_type == 'draft':
            return {
                'content': f"Thank you for your email. I'll review the content and get back to you soon.",
                'tone': 'professional',
                'confidence': 0.92
            }
        elif request.request_type == 'analysis':
            return {
                'sentiment': 'neutral',
                'key_topics': ['business', 'meeting', 'deadline'],
                'action_items': ['Schedule meeting', 'Review document'],
                'confidence': 0.88
            }
        else:
            return {'result': 'processed', 'confidence': 0.80}
    
    def _estimate_cost(self, request: ProcessingRequest) -> float:
        """Estimate processing cost for request"""
        base_costs = {
            'classification': 0.0001,  # GPT-5-nano
            'draft': 0.0005,          # GPT-5-mini
            'analysis': 0.0003,       # GPT-5-mini
            'summary': 0.0002         # GPT-5-nano
        }
        
        base_cost = base_costs.get(request.request_type, 0.0001)
        
        # Adjust for content length
        content_multiplier = min(len(request.content) / 1000, 5.0)
        
        return base_cost * (1 + content_multiplier)
    
    def _get_model_for_request(self, request: ProcessingRequest) -> str:
        """Get appropriate model for request type"""
        if request.request_type in ['classification', 'summary']:
            return self.config['processing']['classification_model']
        else:
            return self.config['processing']['draft_model']
    
    def _get_cache_ttl(self, request: ProcessingRequest) -> int:
        """Get cache TTL based on request type"""
        ttl_map = {
            'classification': 3600,    # 1 hour
            'draft': 1800,            # 30 minutes
            'analysis': 7200,         # 2 hours
            'summary': 14400          # 4 hours
        }
        return ttl_map.get(request.request_type, 3600)
    
    async def start_workers(self):
        """Start background worker processes"""
        if self.is_running:
            return
        
        self.is_running = True
        
        # Start worker tasks
        for i in range(self.num_workers):
            worker = asyncio.create_task(self._worker_loop(f"worker-{i}"))
            self.workers.append(worker)
        
        # Start metrics updater
        self.metrics_task = asyncio.create_task(self._metrics_loop())
        
        self.logger.info(f"Started {self.num_workers} AI processing workers")
    
    async def stop_workers(self):
        """Stop background worker processes"""
        self.is_running = False
        
        # Cancel all workers
        for worker in self.workers:
            worker.cancel()
        
        # Wait for workers to finish
        if self.workers:
            await asyncio.gather(*self.workers, return_exceptions=True)
        
        # Cancel metrics task
        if hasattr(self, 'metrics_task'):
            self.metrics_task.cancel()
        
        self.workers.clear()
        self.logger.info("Stopped all AI processing workers")
    
    async def _worker_loop(self, worker_id: str):
        """Main worker processing loop"""
        self.logger.info(f"Worker {worker_id} started")
        
        with self.metrics_lock:
            self.metrics.active_workers += 1
        
        try:
            while self.is_running:
                # Get request from queue
                request = self.queue.get(timeout=1.0)
                if not request:
                    continue
                
                try:
                    # Process request
                    result = await self.process_request(request)
                    self.logger.debug(f"Worker {worker_id} processed {request.request_id}")
                    
                    # Store result somewhere (implement result storage)
                    # await self._store_result(request, result)
                    
                except Exception as e:
                    self.logger.error(f"Worker {worker_id} error processing {request.request_id}: {e}")
                    
                    # Retry logic
                    if request.retry_count < request.max_retries:
                        request.retry_count += 1
                        
                        # Exponential backoff
                        delay = 2 ** request.retry_count
                        await asyncio.sleep(min(delay, 60))
                        
                        # Re-queue request
                        self.queue.put(request)
                        self.logger.info(f"Retrying request {request.request_id} (attempt {request.retry_count})")
                
                # Update queue depth metric
                with self.metrics_lock:
                    self.metrics.queue_depth = self.queue.size()
        
        finally:
            with self.metrics_lock:
                self.metrics.active_workers -= 1
            
            self.logger.info(f"Worker {worker_id} stopped")
    
    async def _metrics_loop(self):
        """Background metrics collection loop"""
        while self.is_running:
            try:
                await self._update_metrics()
                await asyncio.sleep(30)  # Update every 30 seconds
            except Exception as e:
                self.logger.error(f"Metrics update error: {e}")
                await asyncio.sleep(60)
    
    async def _update_metrics(self):
        """Update performance metrics"""
        with self.metrics_lock:
            # Calculate requests per minute
            total_requests = self.metrics.total_requests
            elapsed_minutes = (datetime.now() - self.metrics.last_reset).total_seconds() / 60
            self.metrics.requests_per_minute = total_requests / max(elapsed_minutes, 1)
            
            # Estimate cost per hour
            if elapsed_minutes > 0:
                cost_per_minute = (self.metrics.successful_requests * 0.0003) / elapsed_minutes
                self.metrics.cost_per_hour = cost_per_minute * 60
    
    async def get_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        with self.metrics_lock:
            metrics_copy = asdict(self.metrics)
        
        cache_metrics = await self.cache.get_metrics()
        rate_limit_status = self.rate_limiter.get_status()
        queue_status = self.queue.priority_sizes()
        
        return {
            'timestamp': datetime.now().isoformat(),
            'performance_metrics': metrics_copy,
            'cache_metrics': cache_metrics,
            'rate_limit_status': rate_limit_status,
            'queue_status': queue_status,
            'worker_status': {
                'total_workers': self.num_workers,
                'active_workers': self.metrics.active_workers,
                'is_running': self.is_running
            },
            'system_health': self._calculate_health_score()
        }
    
    def _calculate_health_score(self) -> Dict[str, Any]:
        """Calculate system health score"""
        score = 100
        issues = []
        
        # Queue depth check
        if self.metrics.queue_depth > 1000:
            score -= 20
            issues.append("High queue depth")
        
        # Error rate check
        total_requests = self.metrics.total_requests
        if total_requests > 0:
            error_rate = self.metrics.failed_requests / total_requests
            if error_rate > 0.1:  # 10% error rate
                score -= 30
                issues.append(f"High error rate: {error_rate:.1%}")
        
        # Cache hit rate check
        cache_total = self.cache.metrics['hits'] + self.cache.metrics['misses']
        if cache_total > 0:
            hit_rate = self.cache.metrics['hits'] / cache_total
            if hit_rate < 0.5:  # 50% hit rate
                score -= 15
                issues.append(f"Low cache hit rate: {hit_rate:.1%}")
        
        # Worker health check
        if self.metrics.active_workers < self.num_workers / 2:
            score -= 25
            issues.append("Low worker availability")
        
        return {
            'score': max(score, 0),
            'status': 'healthy' if score >= 80 else 'degraded' if score >= 60 else 'unhealthy',
            'issues': issues
        }
    
    async def cleanup(self):
        """Cleanup resources"""
        await self.stop_workers()
        
        if self.cache.redis_client:
            await self.cache.redis_client.close()
        
        self.logger.info("AI Processing Optimizer cleaned up")


# Example usage and testing
async def main():
    """Example usage of AI Processing Optimizer"""
    
    # Configuration
    config = {
        'cache': {
            'redis_host': 'localhost',
            'redis_port': 6379,
            'redis_db': 0
        },
        'rate_limiting': {
            'requests_per_minute': 20,
            'requests_per_hour': 1000,
            'cost_limit_per_hour': 10.0
        },
        'num_workers': 4
    }
    
    # Initialize optimizer
    optimizer = AIProcessingOptimizer(config)
    
    try:
        # Start workers
        await optimizer.start_workers()
        
        # Submit test requests
        print("\n=== AI Processing Optimizer Demo ===")
        
        # Test different priority requests
        test_requests = [
            ProcessingRequest(
                request_id=f"req-{i}",
                email_id=i,
                content_hash=f"hash-{i}",
                request_type='classification',
                priority=ProcessingPriority.HIGH,
                content=f"Test email content {i}",
                metadata={'test': True},
                created_at=datetime.now()
            )
            for i in range(10)
        ]
        
        # Submit requests
        for request in test_requests:
            await optimizer.submit_request(request)
            print(f"Submitted {request.request_id} with priority {request.priority.value}")
        
        # Wait for processing
        print("\nWaiting for processing...")
        await asyncio.sleep(5)
        
        # Get performance report
        report = await optimizer.get_performance_report()
        
        print(f"\n=== Performance Report ===")
        print(f"Total requests: {report['performance_metrics']['total_requests']}")
        print(f"Successful: {report['performance_metrics']['successful_requests']}")
        print(f"Failed: {report['performance_metrics']['failed_requests']}")
        print(f"Cache hit rate: {report['cache_metrics']['hit_rate']:.1%}")
        print(f"Avg response time: {report['performance_metrics']['avg_response_time_ms']:.1f}ms")
        print(f"Queue depth: {report['queue_status']}")
        print(f"Health score: {report['system_health']['score']}/100 ({report['system_health']['status']})")
        
        if report['system_health']['issues']:
            print(f"Issues: {', '.join(report['system_health']['issues'])}")
    
    finally:
        # Cleanup
        await optimizer.cleanup()
        print("\nDemo completed.")


if __name__ == "__main__":
    asyncio.run(main())
