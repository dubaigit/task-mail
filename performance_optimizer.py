#!/usr/bin/env python3
"""
Performance Optimizer for Email Intelligence System

High-performance optimization layer providing caching, batching, rate limiting,
and intelligent resource management for processing 10k+ emails efficiently.

Features:
- Multi-level caching (memory, disk, distributed)
- Intelligent batch processing optimization
- API rate limiting and retry strategies  
- Resource management and monitoring
- Performance analytics and optimization suggestions
- Cost optimization for AI API calls
"""

import asyncio
import logging
import time
import json
import pickle
import hashlib
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Callable, Union
from dataclasses import dataclass, asdict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor, as_completed
from collections import deque, defaultdict
import sqlite3
import os
import sys
from contextlib import contextmanager
import functools
import weakref

# Redis for distributed caching (optional)
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

# Memory profiling
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

class CacheLevel(Enum):
    """Cache level options"""
    MEMORY = "MEMORY"
    DISK = "DISK"
    DISTRIBUTED = "DISTRIBUTED"
    ALL = "ALL"

class BatchStrategy(Enum):
    """Batch processing strategies"""
    SIZE_BASED = "SIZE_BASED"
    TIME_BASED = "TIME_BASED"  
    PRIORITY_BASED = "PRIORITY_BASED"
    ADAPTIVE = "ADAPTIVE"

class ResourceType(Enum):
    """Resource types for monitoring"""
    CPU = "CPU"
    MEMORY = "MEMORY"
    NETWORK = "NETWORK"
    API_CALLS = "API_CALLS"
    DISK_IO = "DISK_IO"

@dataclass
class CacheStats:
    """Cache performance statistics"""
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    total_size_bytes: int = 0
    avg_access_time_ms: float = 0.0
    hit_rate: float = 0.0
    
    def update_hit_rate(self):
        total = self.hits + self.misses
        self.hit_rate = self.hits / total if total > 0 else 0.0

@dataclass
class BatchMetrics:
    """Batch processing metrics"""
    batch_size: int
    processing_time_ms: float
    throughput_per_second: float
    success_rate: float
    retry_count: int = 0
    cost_estimate: float = 0.0

@dataclass
class ResourceMetrics:
    """Resource utilization metrics"""
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    memory_mb: float = 0.0
    network_io_mb: float = 0.0
    disk_io_mb: float = 0.0
    api_calls_per_minute: float = 0.0
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()

@dataclass
class OptimizationSuggestion:
    """Performance optimization suggestion"""
    category: str
    priority: str  # HIGH, MEDIUM, LOW
    description: str
    estimated_improvement: str
    implementation_effort: str
    code_example: Optional[str] = None

class PerformanceCache:
    """Multi-level high-performance cache system"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Memory cache (L1)
        self.memory_cache: Dict[str, Tuple[Any, datetime, float]] = {}  # value, timestamp, ttl
        self.memory_lock = threading.RLock()
        self.max_memory_entries = config.get('max_memory_entries', 10000)
        self.max_memory_mb = config.get('max_memory_mb', 512)
        
        # Disk cache (L2)
        self.disk_cache_dir = config.get('disk_cache_dir', './cache')
        os.makedirs(self.disk_cache_dir, exist_ok=True)
        self.max_disk_mb = config.get('max_disk_mb', 2048)
        
        # Distributed cache (L3) - Redis
        self.redis_client = None
        if REDIS_AVAILABLE and config.get('redis_enabled', False):
            try:
                self.redis_client = redis.Redis(
                    host=config.get('redis_host', 'localhost'),
                    port=config.get('redis_port', 6379),
                    db=config.get('redis_db', 0),
                    decode_responses=True
                )
                self.redis_client.ping()  # Test connection
            except Exception as e:
                self.logger.warning(f"Redis connection failed: {e}")
                self.redis_client = None
        
        # Cache statistics
        self.stats = {
            CacheLevel.MEMORY: CacheStats(),
            CacheLevel.DISK: CacheStats(),
            CacheLevel.DISTRIBUTED: CacheStats()
        }
        
        # LRU tracking
        self.access_order = deque()
        self.access_lock = threading.Lock()
        
    def get(self, key: str, default: Any = None, 
            cache_levels: List[CacheLevel] = None) -> Tuple[Any, bool]:
        """
        Get value from cache with multi-level lookup.
        
        Returns:
            Tuple of (value, cache_hit)
        """
        if cache_levels is None:
            cache_levels = [CacheLevel.MEMORY, CacheLevel.DISK, CacheLevel.DISTRIBUTED]
        
        start_time = time.time()
        
        # Try each cache level in order
        for level in cache_levels:
            try:
                if level == CacheLevel.MEMORY:
                    value, hit = self._get_memory(key)
                elif level == CacheLevel.DISK:
                    value, hit = self._get_disk(key)
                elif level == CacheLevel.DISTRIBUTED:
                    value, hit = self._get_distributed(key)
                else:
                    continue
                
                # Update statistics
                stats = self.stats[level]
                if hit:
                    stats.hits += 1
                    stats.avg_access_time_ms = (
                        (stats.avg_access_time_ms * (stats.hits - 1) + 
                         (time.time() - start_time) * 1000) / stats.hits
                    )
                    stats.update_hit_rate()
                    
                    # Promote to higher cache levels
                    self._promote_to_higher_levels(key, value, level, cache_levels)
                    
                    return value, True
                else:
                    stats.misses += 1
                    stats.update_hit_rate()
                    
            except Exception as e:
                self.logger.warning(f"Cache level {level} failed: {e}")
                continue
        
        return default, False
    
    def put(self, key: str, value: Any, ttl: float = 3600.0,
            cache_levels: List[CacheLevel] = None):
        """Put value in specified cache levels"""
        if cache_levels is None:
            cache_levels = [CacheLevel.MEMORY]
        
        for level in cache_levels:
            try:
                if level == CacheLevel.MEMORY:
                    self._put_memory(key, value, ttl)
                elif level == CacheLevel.DISK:
                    self._put_disk(key, value, ttl)
                elif level == CacheLevel.DISTRIBUTED:
                    self._put_distributed(key, value, ttl)
            except Exception as e:
                self.logger.warning(f"Failed to cache in {level}: {e}")
    
    def _get_memory(self, key: str) -> Tuple[Any, bool]:
        """Get from memory cache"""
        with self.memory_lock:
            if key in self.memory_cache:
                value, timestamp, ttl = self.memory_cache[key]
                
                # Check expiration
                if (datetime.now() - timestamp).total_seconds() <= ttl:
                    # Update access order for LRU
                    with self.access_lock:
                        if key in self.access_order:
                            self.access_order.remove(key)
                        self.access_order.append(key)
                    
                    return value, True
                else:
                    # Expired
                    del self.memory_cache[key]
        
        return None, False
    
    def _put_memory(self, key: str, value: Any, ttl: float):
        """Put in memory cache with LRU eviction"""
        with self.memory_lock:
            # Check memory limits
            self._enforce_memory_limits()
            
            # Store value
            self.memory_cache[key] = (value, datetime.now(), ttl)
            
            # Update access order
            with self.access_lock:
                if key in self.access_order:
                    self.access_order.remove(key)
                self.access_order.append(key)
    
    def _enforce_memory_limits(self):
        """Enforce memory cache size limits"""
        # Evict by count
        while len(self.memory_cache) >= self.max_memory_entries:
            self._evict_lru_memory()
        
        # Evict by memory size (rough estimate)
        if PSUTIL_AVAILABLE:
            current_mb = sys.getsizeof(self.memory_cache) / (1024 * 1024)
            while current_mb > self.max_memory_mb and self.memory_cache:
                self._evict_lru_memory()
                current_mb = sys.getsizeof(self.memory_cache) / (1024 * 1024)
    
    def _evict_lru_memory(self):
        """Evict least recently used item from memory"""
        with self.access_lock:
            if self.access_order:
                lru_key = self.access_order.popleft()
                if lru_key in self.memory_cache:
                    del self.memory_cache[lru_key]
                    self.stats[CacheLevel.MEMORY].evictions += 1
    
    def _get_disk(self, key: str) -> Tuple[Any, bool]:
        """Get from disk cache"""
        cache_file = os.path.join(self.disk_cache_dir, f"{self._hash_key(key)}.pkl")
        
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'rb') as f:
                    cached_data = pickle.load(f)
                
                value, timestamp, ttl = cached_data
                
                # Check expiration
                if (datetime.now() - timestamp).total_seconds() <= ttl:
                    return value, True
                else:
                    # Remove expired file
                    os.remove(cache_file)
            except Exception as e:
                self.logger.warning(f"Disk cache read error: {e}")
                try:
                    os.remove(cache_file)
                except:
                    pass
        
        return None, False
    
    def _put_disk(self, key: str, value: Any, ttl: float):
        """Put in disk cache"""
        cache_file = os.path.join(self.disk_cache_dir, f"{self._hash_key(key)}.pkl")
        
        try:
            # Enforce disk size limits
            self._enforce_disk_limits()
            
            with open(cache_file, 'wb') as f:
                pickle.dump((value, datetime.now(), ttl), f)
                
        except Exception as e:
            self.logger.warning(f"Disk cache write error: {e}")
    
    def _enforce_disk_limits(self):
        """Enforce disk cache size limits"""
        if not os.path.exists(self.disk_cache_dir):
            return
        
        # Calculate current size
        total_size = 0
        cache_files = []
        
        for filename in os.listdir(self.disk_cache_dir):
            if filename.endswith('.pkl'):
                filepath = os.path.join(self.disk_cache_dir, filename)
                if os.path.isfile(filepath):
                    size = os.path.getsize(filepath)
                    mtime = os.path.getmtime(filepath)
                    cache_files.append((filepath, size, mtime))
                    total_size += size
        
        # Convert to MB
        total_mb = total_size / (1024 * 1024)
        
        # Evict oldest files if over limit
        if total_mb > self.max_disk_mb:
            # Sort by modification time (oldest first)
            cache_files.sort(key=lambda x: x[2])
            
            for filepath, size, mtime in cache_files:
                try:
                    os.remove(filepath)
                    total_mb -= size / (1024 * 1024)
                    self.stats[CacheLevel.DISK].evictions += 1
                    
                    if total_mb <= self.max_disk_mb * 0.8:  # Leave some headroom
                        break
                except Exception as e:
                    self.logger.warning(f"Failed to remove cache file {filepath}: {e}")
    
    def _get_distributed(self, key: str) -> Tuple[Any, bool]:
        """Get from distributed cache (Redis)"""
        if not self.redis_client:
            return None, False
        
        try:
            cached_data = self.redis_client.get(key)
            if cached_data:
                value = json.loads(cached_data)
                return value, True
        except Exception as e:
            self.logger.warning(f"Redis get error: {e}")
        
        return None, False
    
    def _put_distributed(self, key: str, value: Any, ttl: float):
        """Put in distributed cache (Redis)"""
        if not self.redis_client:
            return
        
        try:
            serialized = json.dumps(value, default=str)
            self.redis_client.setex(key, int(ttl), serialized)
        except Exception as e:
            self.logger.warning(f"Redis put error: {e}")
    
    def _promote_to_higher_levels(self, key: str, value: Any, 
                                 current_level: CacheLevel,
                                 cache_levels: List[CacheLevel]):
        """Promote cache entry to higher cache levels"""
        level_priority = {
            CacheLevel.MEMORY: 0,
            CacheLevel.DISK: 1,
            CacheLevel.DISTRIBUTED: 2
        }
        
        current_priority = level_priority[current_level]
        
        # Promote to all higher priority levels
        for level in cache_levels:
            if level_priority[level] < current_priority:
                try:
                    if level == CacheLevel.MEMORY:
                        self._put_memory(key, value, 3600.0)
                    elif level == CacheLevel.DISK:
                        self._put_disk(key, value, 3600.0)
                    elif level == CacheLevel.DISTRIBUTED:
                        self._put_distributed(key, value, 3600.0)
                except Exception as e:
                    self.logger.warning(f"Cache promotion to {level} failed: {e}")
    
    def _hash_key(self, key: str) -> str:
        """Generate hash for cache key"""
        return hashlib.md5(key.encode()).hexdigest()
    
    def get_stats(self) -> Dict[str, CacheStats]:
        """Get cache statistics"""
        return {level.value: stats for level, stats in self.stats.items()}
    
    def clear(self, cache_levels: List[CacheLevel] = None):
        """Clear specified cache levels"""
        if cache_levels is None:
            cache_levels = [CacheLevel.MEMORY, CacheLevel.DISK, CacheLevel.DISTRIBUTED]
        
        for level in cache_levels:
            try:
                if level == CacheLevel.MEMORY:
                    with self.memory_lock:
                        self.memory_cache.clear()
                    with self.access_lock:
                        self.access_order.clear()
                
                elif level == CacheLevel.DISK:
                    for filename in os.listdir(self.disk_cache_dir):
                        if filename.endswith('.pkl'):
                            os.remove(os.path.join(self.disk_cache_dir, filename))
                
                elif level == CacheLevel.DISTRIBUTED and self.redis_client:
                    self.redis_client.flushdb()
                    
            except Exception as e:
                self.logger.warning(f"Failed to clear {level}: {e}")

class IntelligentBatchProcessor:
    """Intelligent batch processing with adaptive optimization"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Batch configuration
        self.min_batch_size = config.get('min_batch_size', 5)
        self.max_batch_size = config.get('max_batch_size', 50)
        self.max_wait_time_seconds = config.get('max_wait_time_seconds', 30)
        self.strategy = BatchStrategy(config.get('strategy', 'ADAPTIVE'))
        
        # Adaptive parameters
        self.target_throughput = config.get('target_throughput_per_second', 10)
        self.target_latency_ms = config.get('target_latency_ms', 5000)
        self.cost_per_api_call = config.get('cost_per_api_call', 0.001)
        
        # Threading
        self.max_workers = config.get('max_workers', 4)
        self.executor = ThreadPoolExecutor(max_workers=self.max_workers)
        
        # Batch queue and metrics
        self.pending_items = deque()
        self.batch_metrics_history = deque(maxlen=100)
        self.queue_lock = threading.Lock()
        
        # Adaptive learning
        self.optimal_batch_size = self.min_batch_size
        self.adaptation_rate = 0.1
        
    def add_item(self, item: Any, priority: int = 0) -> str:
        """Add item to batch queue"""
        item_id = f"ITEM-{datetime.now().strftime('%Y%m%d%H%M%S')}-{id(item)}"
        
        with self.queue_lock:
            self.pending_items.append({
                'id': item_id,
                'item': item,
                'priority': priority,
                'timestamp': datetime.now()
            })
        
        return item_id
    
    def process_batch(self, processor_func: Callable[[List[Any]], List[Any]],
                     force_process: bool = False) -> List[BatchMetrics]:
        """Process batches using the specified processor function"""
        
        if not self.pending_items and not force_process:
            return []
        
        batches = self._create_batches()
        results = []
        
        # Process batches concurrently
        future_to_batch = {}
        
        for batch in batches:
            future = self.executor.submit(self._process_single_batch, batch, processor_func)
            future_to_batch[future] = batch
        
        # Collect results
        for future in as_completed(future_to_batch):
            batch = future_to_batch[future]
            try:
                metrics = future.result()
                results.append(metrics)
                
                # Learn from results for adaptive optimization
                self._learn_from_batch_metrics(metrics)
                
            except Exception as e:
                self.logger.error(f"Batch processing failed: {e}")
                # Create error metrics
                error_metrics = BatchMetrics(
                    batch_size=len(batch),
                    processing_time_ms=0,
                    throughput_per_second=0,
                    success_rate=0,
                    retry_count=0
                )
                results.append(error_metrics)
        
        return results
    
    def _create_batches(self) -> List[List[Dict]]:
        """Create batches based on strategy"""
        batches = []
        
        with self.queue_lock:
            items = list(self.pending_items)
            self.pending_items.clear()
        
        if not items:
            return batches
        
        if self.strategy == BatchStrategy.PRIORITY_BASED:
            # Sort by priority (higher first)
            items.sort(key=lambda x: x['priority'], reverse=True)
        
        elif self.strategy == BatchStrategy.TIME_BASED:
            # Sort by timestamp (older first)
            items.sort(key=lambda x: x['timestamp'])
        
        # Create batches
        batch_size = self._get_optimal_batch_size()
        
        for i in range(0, len(items), batch_size):
            batch = items[i:i + batch_size]
            batches.append(batch)
        
        return batches
    
    def _get_optimal_batch_size(self) -> int:
        """Get optimal batch size based on strategy and learning"""
        
        if self.strategy == BatchStrategy.ADAPTIVE:
            return int(self.optimal_batch_size)
        
        elif self.strategy == BatchStrategy.SIZE_BASED:
            return self.max_batch_size
        
        elif self.strategy == BatchStrategy.TIME_BASED:
            # Calculate based on pending time
            with self.queue_lock:
                if self.pending_items:
                    oldest_time = min(item['timestamp'] for item in self.pending_items)
                    wait_time = (datetime.now() - oldest_time).total_seconds()
                    
                    if wait_time > self.max_wait_time_seconds:
                        return len(self.pending_items)  # Process all immediately
                
            return self.min_batch_size
        
        else:
            return self.min_batch_size
    
    def _process_single_batch(self, batch: List[Dict], 
                             processor_func: Callable[[List[Any]], List[Any]]) -> BatchMetrics:
        """Process a single batch and return metrics"""
        start_time = time.time()
        
        try:
            # Extract items from batch metadata
            items = [item_data['item'] for item_data in batch]
            
            # Process batch
            results = processor_func(items)
            
            processing_time = (time.time() - start_time) * 1000  # ms
            
            # Calculate metrics
            batch_size = len(batch)
            throughput = batch_size / (processing_time / 1000) if processing_time > 0 else 0
            success_rate = len(results) / batch_size if batch_size > 0 else 0
            cost_estimate = batch_size * self.cost_per_api_call
            
            metrics = BatchMetrics(
                batch_size=batch_size,
                processing_time_ms=processing_time,
                throughput_per_second=throughput,
                success_rate=success_rate,
                cost_estimate=cost_estimate
            )
            
            # Store metrics for learning
            self.batch_metrics_history.append(metrics)
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Single batch processing failed: {e}")
            processing_time = (time.time() - start_time) * 1000
            
            return BatchMetrics(
                batch_size=len(batch),
                processing_time_ms=processing_time,
                throughput_per_second=0,
                success_rate=0,
                retry_count=1
            )
    
    def _learn_from_batch_metrics(self, metrics: BatchMetrics):
        """Learn optimal batch size from metrics"""
        if self.strategy != BatchStrategy.ADAPTIVE:
            return
        
        # Calculate efficiency score
        # Balance throughput, latency, and success rate
        latency_score = max(0, 1 - (metrics.processing_time_ms / self.target_latency_ms))
        throughput_score = min(1, metrics.throughput_per_second / self.target_throughput)
        success_score = metrics.success_rate
        
        efficiency = (latency_score + throughput_score + success_score * 2) / 4
        
        # Adjust optimal batch size based on efficiency
        if efficiency > 0.8:  # Good performance
            # Try slightly larger batches
            new_size = self.optimal_batch_size * (1 + self.adaptation_rate)
        elif efficiency < 0.5:  # Poor performance
            # Try smaller batches
            new_size = self.optimal_batch_size * (1 - self.adaptation_rate)
        else:
            # Keep current size
            new_size = self.optimal_batch_size
        
        # Clamp to limits
        self.optimal_batch_size = max(
            self.min_batch_size,
            min(self.max_batch_size, new_size)
        )
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get current queue status"""
        with self.queue_lock:
            return {
                'pending_items': len(self.pending_items),
                'optimal_batch_size': self.optimal_batch_size,
                'strategy': self.strategy.value,
                'avg_metrics': self._calculate_average_metrics()
            }
    
    def _calculate_average_metrics(self) -> Dict[str, float]:
        """Calculate average metrics from history"""
        if not self.batch_metrics_history:
            return {}
        
        metrics = list(self.batch_metrics_history)
        return {
            'avg_batch_size': sum(m.batch_size for m in metrics) / len(metrics),
            'avg_processing_time_ms': sum(m.processing_time_ms for m in metrics) / len(metrics),
            'avg_throughput': sum(m.throughput_per_second for m in metrics) / len(metrics),
            'avg_success_rate': sum(m.success_rate for m in metrics) / len(metrics),
            'total_cost_estimate': sum(m.cost_estimate for m in metrics)
        }

class APIRateController:
    """Advanced API rate limiting and cost optimization"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Rate limits
        self.requests_per_minute = config.get('requests_per_minute', 60)
        self.requests_per_hour = config.get('requests_per_hour', 1000)
        self.requests_per_day = config.get('requests_per_day', 10000)
        
        # Cost management
        self.daily_budget = config.get('daily_budget_usd', 100.0)
        self.cost_per_request = config.get('cost_per_request', 0.001)
        self.current_daily_cost = 0.0
        
        # Request tracking
        self.request_timestamps = deque()
        self.hourly_requests = deque()
        self.daily_requests = deque()
        
        # Locks
        self.rate_lock = threading.Lock()
        self.cost_lock = threading.Lock()
        
        # Retry configuration
        self.max_retries = config.get('max_retries', 3)
        self.base_delay = config.get('base_delay_seconds', 1.0)
        self.max_delay = config.get('max_delay_seconds', 60.0)
        self.backoff_factor = config.get('backoff_factor', 2.0)
        
        # Priority queues
        self.high_priority_queue = deque()
        self.normal_priority_queue = deque()
        self.low_priority_queue = deque()
        
        # Auto-reset daily cost at midnight
        self._schedule_daily_reset()
    
    def can_make_request(self, priority: str = "normal") -> Tuple[bool, str]:
        """Check if request can be made given current limits"""
        
        # Check budget
        with self.cost_lock:
            if self.current_daily_cost + self.cost_per_request > self.daily_budget:
                return False, "Daily budget exceeded"
        
        # Check rate limits
        with self.rate_lock:
            now = datetime.now()
            
            # Clean old timestamps
            self._clean_old_timestamps(now)
            
            # Check minute limit
            minute_ago = now - timedelta(minutes=1)
            recent_requests = sum(1 for ts in self.request_timestamps if ts > minute_ago)
            
            if recent_requests >= self.requests_per_minute:
                return False, "Per-minute rate limit exceeded"
            
            # Check hour limit
            hour_ago = now - timedelta(hours=1)
            hourly_requests = sum(1 for ts in self.request_timestamps if ts > hour_ago)
            
            if hourly_requests >= self.requests_per_hour:
                return False, "Per-hour rate limit exceeded"
            
            # Check daily limit
            day_ago = now - timedelta(days=1)
            daily_requests = sum(1 for ts in self.request_timestamps if ts > day_ago)
            
            if daily_requests >= self.requests_per_day:
                return False, "Per-day rate limit exceeded"
        
        return True, "OK"
    
    def wait_for_rate_limit(self, priority: str = "normal") -> float:
        """Wait until rate limit allows request, return wait time"""
        start_time = time.time()
        
        while True:
            can_proceed, reason = self.can_make_request(priority)
            if can_proceed:
                break
            
            # Calculate wait time based on reason
            if "minute" in reason:
                wait_time = 60  # Wait for minute to reset
            elif "hour" in reason:
                wait_time = 300  # Wait 5 minutes
            elif "day" in reason:
                wait_time = 3600  # Wait 1 hour
            elif "budget" in reason:
                # Wait until next day
                now = datetime.now()
                tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                wait_time = (tomorrow - now).total_seconds()
            else:
                wait_time = 1
            
            # Adaptive wait for priority
            if priority == "high":
                wait_time *= 0.5  # High priority waits less
            elif priority == "low":
                wait_time *= 2.0  # Low priority waits more
            
            time.sleep(min(wait_time, 300))  # Max 5 minute wait
        
        return time.time() - start_time
    
    def record_request(self, cost: Optional[float] = None):
        """Record a successful request"""
        now = datetime.now()
        
        with self.rate_lock:
            self.request_timestamps.append(now)
        
        with self.cost_lock:
            request_cost = cost or self.cost_per_request
            self.current_daily_cost += request_cost
    
    def make_request_with_retry(self, request_func: Callable, 
                               *args, priority: str = "normal", **kwargs) -> Any:
        """Make request with automatic retry and rate limiting"""
        
        for attempt in range(self.max_retries + 1):
            try:
                # Wait for rate limit
                wait_time = self.wait_for_rate_limit(priority)
                
                # Make request
                result = request_func(*args, **kwargs)
                
                # Record successful request
                self.record_request()
                
                return result
                
            except Exception as e:
                self.logger.warning(f"Request attempt {attempt + 1} failed: {e}")
                
                # Check if should retry
                if attempt >= self.max_retries:
                    raise e
                
                # Calculate retry delay with exponential backoff
                delay = min(
                    self.base_delay * (self.backoff_factor ** attempt),
                    self.max_delay
                )
                
                # Add jitter
                import random
                delay *= (0.5 + random.random() * 0.5)
                
                time.sleep(delay)
        
        raise Exception(f"Request failed after {self.max_retries} retries")
    
    def _clean_old_timestamps(self, now: datetime):
        """Clean timestamps older than 24 hours"""
        cutoff = now - timedelta(hours=24)
        
        while self.request_timestamps and self.request_timestamps[0] < cutoff:
            self.request_timestamps.popleft()
    
    def _schedule_daily_reset(self):
        """Schedule daily cost reset"""
        def reset_daily_cost():
            while True:
                # Wait until midnight
                now = datetime.now()
                midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
                sleep_seconds = (midnight - now).total_seconds()
                time.sleep(sleep_seconds)
                
                # Reset cost
                with self.cost_lock:
                    self.current_daily_cost = 0.0
                    self.logger.info("Daily API cost reset")
        
        reset_thread = threading.Thread(target=reset_daily_cost, daemon=True)
        reset_thread.start()
    
    def get_status(self) -> Dict[str, Any]:
        """Get current rate controller status"""
        now = datetime.now()
        
        with self.rate_lock:
            self._clean_old_timestamps(now)
            
            minute_ago = now - timedelta(minutes=1)
            hour_ago = now - timedelta(hours=1)
            day_ago = now - timedelta(days=1)
            
            minute_requests = sum(1 for ts in self.request_timestamps if ts > minute_ago)
            hour_requests = sum(1 for ts in self.request_timestamps if ts > hour_ago)
            day_requests = sum(1 for ts in self.request_timestamps if ts > day_ago)
        
        with self.cost_lock:
            current_cost = self.current_daily_cost
            budget_remaining = self.daily_budget - current_cost
        
        return {
            'requests': {
                'last_minute': minute_requests,
                'last_hour': hour_requests,
                'last_day': day_requests,
                'limits': {
                    'per_minute': self.requests_per_minute,
                    'per_hour': self.requests_per_hour,
                    'per_day': self.requests_per_day
                }
            },
            'cost': {
                'daily_spent': current_cost,
                'daily_budget': self.daily_budget,
                'remaining_budget': budget_remaining,
                'budget_utilization': current_cost / self.daily_budget if self.daily_budget > 0 else 0
            },
            'can_make_request': self.can_make_request()[0]
        }

class ResourceMonitor:
    """System resource monitoring and optimization"""
    
    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Monitoring configuration
        self.monitor_interval = config.get('monitor_interval_seconds', 30)
        self.history_size = config.get('history_size', 1000)
        
        # Resource metrics history
        self.metrics_history = deque(maxlen=self.history_size)
        self.monitoring_active = False
        self.monitor_thread = None
        
        # Thresholds
        self.cpu_threshold = config.get('cpu_threshold_percent', 80)
        self.memory_threshold = config.get('memory_threshold_percent', 85)
        self.disk_threshold = config.get('disk_threshold_percent', 90)
        
        # Alerts
        self.alert_callback = config.get('alert_callback', None)
        
    def start_monitoring(self):
        """Start resource monitoring"""
        if self.monitoring_active:
            return
        
        self.monitoring_active = True
        self.monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.monitor_thread.start()
        self.logger.info("Resource monitoring started")
    
    def stop_monitoring(self):
        """Stop resource monitoring"""
        self.monitoring_active = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=5)
        self.logger.info("Resource monitoring stopped")
    
    def _monitor_loop(self):
        """Main monitoring loop"""
        while self.monitoring_active:
            try:
                metrics = self._collect_metrics()
                self.metrics_history.append(metrics)
                
                # Check thresholds and alert
                self._check_thresholds(metrics)
                
                time.sleep(self.monitor_interval)
                
            except Exception as e:
                self.logger.error(f"Resource monitoring error: {e}")
                time.sleep(self.monitor_interval)
    
    def _collect_metrics(self) -> ResourceMetrics:
        """Collect current resource metrics"""
        metrics = ResourceMetrics()
        
        if PSUTIL_AVAILABLE:
            try:
                # CPU metrics
                metrics.cpu_percent = psutil.cpu_percent(interval=1)
                
                # Memory metrics
                memory = psutil.virtual_memory()
                metrics.memory_percent = memory.percent
                metrics.memory_mb = memory.used / (1024 * 1024)
                
                # Network I/O
                network = psutil.net_io_counters()
                if hasattr(self, '_last_network'):
                    bytes_sent = network.bytes_sent - self._last_network.bytes_sent
                    bytes_recv = network.bytes_recv - self._last_network.bytes_recv
                    metrics.network_io_mb = (bytes_sent + bytes_recv) / (1024 * 1024)
                self._last_network = network
                
                # Disk I/O
                disk = psutil.disk_io_counters()
                if disk and hasattr(self, '_last_disk'):
                    bytes_read = disk.read_bytes - self._last_disk.read_bytes
                    bytes_write = disk.write_bytes - self._last_disk.write_bytes
                    metrics.disk_io_mb = (bytes_read + bytes_write) / (1024 * 1024)
                if disk:
                    self._last_disk = disk
                
            except Exception as e:
                self.logger.warning(f"Failed to collect system metrics: {e}")
        
        return metrics
    
    def _check_thresholds(self, metrics: ResourceMetrics):
        """Check resource thresholds and trigger alerts"""
        alerts = []
        
        if metrics.cpu_percent > self.cpu_threshold:
            alerts.append(f"High CPU usage: {metrics.cpu_percent:.1f}%")
        
        if metrics.memory_percent > self.memory_threshold:
            alerts.append(f"High memory usage: {metrics.memory_percent:.1f}%")
        
        # Check if alerts should be sent
        if alerts and self.alert_callback:
            try:
                self.alert_callback(alerts, metrics)
            except Exception as e:
                self.logger.error(f"Alert callback failed: {e}")
    
    def get_current_metrics(self) -> ResourceMetrics:
        """Get current resource metrics"""
        return self._collect_metrics()
    
    def get_metrics_summary(self, last_n_minutes: int = 60) -> Dict[str, Any]:
        """Get summary of metrics for the last N minutes"""
        cutoff_time = datetime.now() - timedelta(minutes=last_n_minutes)
        
        recent_metrics = [
            m for m in self.metrics_history
            if m.timestamp and m.timestamp > cutoff_time
        ]
        
        if not recent_metrics:
            return {}
        
        return {
            'avg_cpu_percent': sum(m.cpu_percent for m in recent_metrics) / len(recent_metrics),
            'max_cpu_percent': max(m.cpu_percent for m in recent_metrics),
            'avg_memory_percent': sum(m.memory_percent for m in recent_metrics) / len(recent_metrics),
            'max_memory_percent': max(m.memory_percent for m in recent_metrics),
            'avg_memory_mb': sum(m.memory_mb for m in recent_metrics) / len(recent_metrics),
            'max_memory_mb': max(m.memory_mb for m in recent_metrics),
            'total_network_io_mb': sum(m.network_io_mb for m in recent_metrics),
            'total_disk_io_mb': sum(m.disk_io_mb for m in recent_metrics),
            'sample_count': len(recent_metrics),
            'time_range_minutes': last_n_minutes
        }

class PerformanceOptimizer:
    """Main performance optimization coordinator"""
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize the performance optimizer"""
        self.config = self._load_config(config)
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.cache = PerformanceCache(self.config.get('cache', {}))
        self.batch_processor = IntelligentBatchProcessor(self.config.get('batch_processing', {}))
        self.rate_controller = APIRateController(self.config.get('rate_limiting', {}))
        self.resource_monitor = ResourceMonitor(self.config.get('resource_monitoring', {}))
        
        # Performance database
        self._initialize_database()
        
        # Start monitoring
        self.resource_monitor.start_monitoring()
        
        self.logger.info("Performance optimizer initialized")
    
    def _load_config(self, config: Optional[Dict]) -> Dict:
        """Load configuration with defaults"""
        default_config = {
            'cache': {
                'max_memory_entries': 10000,
                'max_memory_mb': 512,
                'disk_cache_dir': './cache',
                'max_disk_mb': 2048,
                'redis_enabled': False
            },
            'batch_processing': {
                'min_batch_size': 5,
                'max_batch_size': 50,
                'max_wait_time_seconds': 30,
                'strategy': 'ADAPTIVE',
                'max_workers': 4
            },
            'rate_limiting': {
                'requests_per_minute': 60,
                'requests_per_hour': 1000,
                'daily_budget_usd': 100.0,
                'cost_per_request': 0.001
            },
            'resource_monitoring': {
                'monitor_interval_seconds': 30,
                'cpu_threshold_percent': 80,
                'memory_threshold_percent': 85
            }
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
    
    def _initialize_database(self):
        """Initialize performance metrics database"""
        self.db_path = 'performance_optimizer.db'
        
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    metric_type TEXT,
                    metric_name TEXT,
                    metric_value REAL,
                    metadata TEXT,
                    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS optimization_suggestions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT,
                    priority TEXT,
                    description TEXT,
                    estimated_improvement TEXT,
                    implementation_effort TEXT,
                    status TEXT DEFAULT 'PENDING',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type);
                CREATE INDEX IF NOT EXISTS idx_optimization_priority ON optimization_suggestions(priority);
            """)
    
    @contextmanager
    def cached_operation(self, cache_key: str, ttl: float = 3600.0,
                        cache_levels: List[CacheLevel] = None):
        """Context manager for cached operations"""
        # Try to get from cache
        result, hit = self.cache.get(cache_key, cache_levels=cache_levels)
        
        if hit:
            yield result
        else:
            # Yield None, operation should set the result
            operation_result = yield None
            
            # Cache the result if it was set
            if operation_result is not None:
                self.cache.put(cache_key, operation_result, ttl, cache_levels)
    
    def optimize_api_call(self, api_func: Callable, cache_key: str,
                         priority: str = "normal", ttl: float = 3600.0) -> Any:
        """Optimize API call with caching and rate limiting"""
        # Check cache first
        result, hit = self.cache.get(cache_key)
        if hit:
            return result
        
        # Make rate-limited API call
        result = self.rate_controller.make_request_with_retry(
            api_func, priority=priority
        )
        
        # Cache result
        self.cache.put(cache_key, result, ttl)
        
        return result
    
    def process_batch_optimized(self, items: List[Any], 
                               processor_func: Callable[[List[Any]], List[Any]],
                               priority: int = 0) -> List[Any]:
        """Process items using optimized batching"""
        results = []
        
        # Add items to batch processor
        item_ids = []
        for item in items:
            item_id = self.batch_processor.add_item(item, priority)
            item_ids.append(item_id)
        
        # Process batches
        batch_metrics = self.batch_processor.process_batch(processor_func, force_process=True)
        
        # Log metrics
        for metrics in batch_metrics:
            self._record_performance_metric('batch_processing', 'throughput', metrics.throughput_per_second)
            self._record_performance_metric('batch_processing', 'latency', metrics.processing_time_ms)
            self._record_performance_metric('batch_processing', 'cost', metrics.cost_estimate)
        
        return results
    
    def analyze_performance(self, time_window_hours: int = 24) -> Dict[str, Any]:
        """Analyze performance and generate optimization suggestions"""
        
        # Collect performance data
        cache_stats = self.cache.get_stats()
        batch_status = self.batch_processor.get_queue_status()
        rate_status = self.rate_controller.get_status()
        resource_summary = self.resource_monitor.get_metrics_summary(time_window_hours * 60)
        
        # Generate optimization suggestions
        suggestions = self._generate_optimization_suggestions(
            cache_stats, batch_status, rate_status, resource_summary
        )
        
        # Store suggestions
        for suggestion in suggestions:
            self._store_optimization_suggestion(suggestion)
        
        return {
            'cache_performance': cache_stats,
            'batch_performance': batch_status,
            'rate_limiting_status': rate_status,
            'resource_utilization': resource_summary,
            'optimization_suggestions': [asdict(s) for s in suggestions],
            'overall_health_score': self._calculate_health_score(
                cache_stats, batch_status, rate_status, resource_summary
            )
        }
    
    def _generate_optimization_suggestions(self, cache_stats: Dict, batch_status: Dict,
                                         rate_status: Dict, resource_summary: Dict) -> List[OptimizationSuggestion]:
        """Generate optimization suggestions based on performance data"""
        suggestions = []
        
        # Cache optimization suggestions
        for level, stats in cache_stats.items():
            if stats.hit_rate < 0.5:
                suggestions.append(OptimizationSuggestion(
                    category="cache",
                    priority="HIGH",
                    description=f"Low cache hit rate ({stats.hit_rate:.1%}) for {level}",
                    estimated_improvement="20-40% latency reduction",
                    implementation_effort="LOW",
                    code_example="Increase cache TTL or optimize cache keys"
                ))
        
        # Batch processing suggestions
        if batch_status.get('avg_metrics', {}).get('avg_success_rate', 1.0) < 0.9:
            suggestions.append(OptimizationSuggestion(
                category="batch_processing",
                priority="HIGH",
                description="Low batch processing success rate",
                estimated_improvement="Improve reliability and reduce retries",
                implementation_effort="MEDIUM",
                code_example="Add error handling and retry logic"
            ))
        
        # Rate limiting suggestions
        budget_utilization = rate_status.get('cost', {}).get('budget_utilization', 0)
        if budget_utilization > 0.8:
            suggestions.append(OptimizationSuggestion(
                category="cost_optimization",
                priority="HIGH",
                description=f"High budget utilization ({budget_utilization:.1%})",
                estimated_improvement="Reduce API costs by 20-30%",
                implementation_effort="MEDIUM",
                code_example="Implement more aggressive caching or reduce API calls"
            ))
        
        # Resource utilization suggestions
        if resource_summary.get('max_cpu_percent', 0) > 90:
            suggestions.append(OptimizationSuggestion(
                category="resource_optimization",
                priority="HIGH",
                description="High CPU utilization detected",
                estimated_improvement="Improve system responsiveness",
                implementation_effort="HIGH",
                code_example="Consider scaling horizontally or optimizing algorithms"
            ))
        
        if resource_summary.get('max_memory_percent', 0) > 90:
            suggestions.append(OptimizationSuggestion(
                category="resource_optimization",
                priority="HIGH",
                description="High memory utilization detected",
                estimated_improvement="Prevent out-of-memory errors",
                implementation_effort="MEDIUM",
                code_example="Implement memory-efficient data structures or increase cache eviction"
            ))
        
        return suggestions
    
    def _calculate_health_score(self, cache_stats: Dict, batch_status: Dict,
                               rate_status: Dict, resource_summary: Dict) -> float:
        """Calculate overall system health score (0-100)"""
        scores = []
        
        # Cache health (30% weight)
        cache_health = 0
        for level, stats in cache_stats.items():
            cache_health += stats.hit_rate * 100
        cache_health /= len(cache_stats) if cache_stats else 1
        scores.append(cache_health * 0.3)
        
        # Batch processing health (25% weight)
        batch_health = batch_status.get('avg_metrics', {}).get('avg_success_rate', 1.0) * 100
        scores.append(batch_health * 0.25)
        
        # Cost health (20% weight)
        budget_utilization = rate_status.get('cost', {}).get('budget_utilization', 0)
        cost_health = max(0, 100 - (budget_utilization * 100))
        scores.append(cost_health * 0.2)
        
        # Resource health (25% weight)
        cpu_health = max(0, 100 - resource_summary.get('max_cpu_percent', 0))
        memory_health = max(0, 100 - resource_summary.get('max_memory_percent', 0))
        resource_health = (cpu_health + memory_health) / 2
        scores.append(resource_health * 0.25)
        
        return sum(scores)
    
    def _record_performance_metric(self, metric_type: str, metric_name: str, 
                                  metric_value: float, metadata: Optional[Dict] = None):
        """Record performance metric to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO performance_metrics (metric_type, metric_name, metric_value, metadata)
                    VALUES (?, ?, ?, ?)
                """, (metric_type, metric_name, metric_value, json.dumps(metadata) if metadata else None))
        except Exception as e:
            self.logger.error(f"Failed to record performance metric: {e}")
    
    def _store_optimization_suggestion(self, suggestion: OptimizationSuggestion):
        """Store optimization suggestion to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO optimization_suggestions 
                    (category, priority, description, estimated_improvement, implementation_effort)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    suggestion.category,
                    suggestion.priority,
                    suggestion.description,
                    suggestion.estimated_improvement,
                    suggestion.implementation_effort
                ))
        except Exception as e:
            self.logger.error(f"Failed to store optimization suggestion: {e}")
    
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report"""
        return self.analyze_performance()
    
    def cleanup(self):
        """Cleanup resources"""
        self.resource_monitor.stop_monitoring()
        if hasattr(self.batch_processor, 'executor'):
            self.batch_processor.executor.shutdown(wait=True)
        self.logger.info("Performance optimizer cleaned up")


def main():
    """Demo the performance optimizer"""
    
    # Initialize performance optimizer
    config = {
        'cache': {
            'max_memory_entries': 1000,
            'max_memory_mb': 100
        },
        'batch_processing': {
            'min_batch_size': 3,
            'max_batch_size': 10,
            'strategy': 'ADAPTIVE'
        },
        'rate_limiting': {
            'requests_per_minute': 30,
            'daily_budget_usd': 50.0
        }
    }
    
    optimizer = PerformanceOptimizer(config)
    
    print("Performance Optimizer Demo")
    print("=" * 50)
    
    # Demo caching
    print("\n1. Cache Performance Demo:")
    
    def expensive_operation(x):
        time.sleep(0.1)  # Simulate expensive operation
        return x * x
    
    # First call (cache miss)
    start_time = time.time()
    with optimizer.cached_operation("expensive_op_5") as cached_result:
        if cached_result is None:
            result = expensive_operation(5)
        else:
            result = cached_result
    cache_miss_time = time.time() - start_time
    
    # Second call (cache hit)
    start_time = time.time()
    with optimizer.cached_operation("expensive_op_5") as cached_result:
        if cached_result is None:
            result = expensive_operation(5)
        else:
            result = cached_result
    cache_hit_time = time.time() - start_time
    
    print(f"Cache miss time: {cache_miss_time*1000:.1f}ms")
    print(f"Cache hit time: {cache_hit_time*1000:.1f}ms")
    print(f"Speedup: {cache_miss_time/cache_hit_time:.1f}x")
    
    # Demo batch processing
    print("\n2. Batch Processing Demo:")
    
    def batch_processor_func(items):
        # Simulate batch processing
        time.sleep(0.05 * len(items))  # 50ms per item
        return [item * 2 for item in items]
    
    # Add items to batch
    test_items = list(range(1, 21))  # 20 items
    
    start_time = time.time()
    results = optimizer.process_batch_optimized(test_items, batch_processor_func)
    batch_time = time.time() - start_time
    
    print(f"Processed {len(test_items)} items in {batch_time*1000:.1f}ms")
    
    # Demo API rate limiting
    print("\n3. Rate Limiting Demo:")
    
    def mock_api_call():
        time.sleep(0.01)  # Simulate API call
        return {"status": "success", "data": "mock_data"}
    
    # Test rate limiting
    rate_status = optimizer.rate_controller.get_status()
    print(f"Current rate limit status: {rate_status['can_make_request']}")
    print(f"Requests this minute: {rate_status['requests']['last_minute']}")
    
    # Performance analysis
    print("\n4. Performance Analysis:")
    
    # Generate performance report
    report = optimizer.analyze_performance(time_window_hours=1)
    
    print(f"Overall health score: {report['overall_health_score']:.1f}/100")
    print(f"Cache hit rates: {[f'{level}: {stats.hit_rate:.1%}' for level, stats in report['cache_performance'].items()]}")
    
    if report['optimization_suggestions']:
        print(f"\nOptimization suggestions:")
        for suggestion in report['optimization_suggestions'][:3]:  # Top 3
            print(f"- {suggestion['priority']}: {suggestion['description']}")
    
    # Cleanup
    optimizer.cleanup()


if __name__ == "__main__":
    main()