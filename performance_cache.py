#!/usr/bin/env python3
"""
Performance Cache Layer
High-performance Redis-based caching for AI classification results and email processing
"""

import asyncio
import json
import hashlib
import time
from typing import Dict, List, Optional, Any, Union
from datetime import datetime, timedelta
import logging
from dataclasses import dataclass, asdict
from enum import Enum
import pickle

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    redis = None
    REDIS_AVAILABLE = False

try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    aiohttp = None
    AIOHTTP_AVAILABLE = False

# Configure logging
logger = logging.getLogger(__name__)

# Cache configuration
@dataclass
class CacheConfig:
    """Cache configuration settings"""
    host: str = "localhost"
    port: int = 6379
    db: int = 0
    password: Optional[str] = None
    max_connections: int = 20
    socket_keepalive: bool = True
    socket_keepalive_options: Dict = None
    retry_on_timeout: bool = True
    health_check_interval: int = 30
    
    # TTL settings optimized for AI models (in seconds)
    classification_ttl: int = 3600  # 1 hour for gpt-5-nano classifications
    analysis_ttl: int = 1800        # 30 minutes for detailed analysis
    draft_ttl: int = 900            # 15 minutes for gpt-5-mini draft responses
    stats_ttl: int = 300            # 5 minutes for statistics
    email_content_ttl: int = 7200   # 2 hours for email content
    
    # Performance settings for 5-10x improvement
    enable_compression: bool = True
    compression_threshold: int = 512   # Compress if data > 512B (more aggressive)
    batch_size: int = 50              # Optimized batch size
    pipeline_enabled: bool = True
    prefetch_enabled: bool = True     # Enable prefetching for common patterns
    memory_optimization: bool = True   # Enable memory optimizations

class CacheKeys:
    """Cache key constants and generation"""
    
    # Prefixes
    CLASSIFICATION = "cls:"
    ANALYSIS = "ana:"
    DRAFT = "dft:"
    STATS = "sta:"
    EMAIL_CONTENT = "eml:"
    METADATA = "meta:"
    PERFORMANCE = "perf:"
    
    @staticmethod
    def classification_key(content_hash: str, model: str) -> str:
        """Generate cache key for email classification"""
        return f"{CacheKeys.CLASSIFICATION}{model}:{content_hash}"
    
    @staticmethod
    def analysis_key(content_hash: str, model: str) -> str:
        """Generate cache key for detailed analysis"""
        return f"{CacheKeys.ANALYSIS}{model}:{content_hash}"
    
    @staticmethod
    def draft_key(email_id: str, analysis_hash: str) -> str:
        """Generate cache key for draft response"""
        return f"{CacheKeys.DRAFT}{email_id}:{analysis_hash}"
    
    @staticmethod
    def stats_key(timeframe: str) -> str:
        """Generate cache key for statistics"""
        return f"{CacheKeys.STATS}{timeframe}:{datetime.now().strftime('%Y%m%d%H')}"
    
    @staticmethod
    def email_content_key(email_id: str) -> str:
        """Generate cache key for email content"""
        return f"{CacheKeys.EMAIL_CONTENT}{email_id}"
    
    @staticmethod
    def performance_key(metric: str) -> str:
        """Generate cache key for performance metrics"""
        return f"{CacheKeys.PERFORMANCE}{metric}:{datetime.now().strftime('%Y%m%d%H%M')}"

class CompressionUtils:
    """Compression utilities for cache data"""
    
    @staticmethod
    def compress_data(data: Any, threshold: int = 1024) -> bytes:
        """Compress data if it exceeds threshold"""
        serialized = pickle.dumps(data)
        if len(serialized) > threshold:
            import gzip
            return gzip.compress(serialized)
        return serialized
    
    @staticmethod
    def decompress_data(data: bytes) -> Any:
        """Decompress data"""
        try:
            # Try gzip decompression first
            import gzip
            decompressed = gzip.decompress(data)
            return pickle.loads(decompressed)
        except:
            # Fallback to direct pickle
            return pickle.loads(data)

class PerformanceCache:
    """High-performance Redis cache for email intelligence system"""
    
    def __init__(self, config: CacheConfig = None):
        self.config = config or CacheConfig()
        self.redis_pool = None
        self.connection_pool = None
        self.health_check_task = None
        self.metrics = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'errors': 0,
            'total_requests': 0,
            'avg_response_time': 0.0
        }
        
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available, using in-memory fallback cache")
            self.fallback_cache = {}
            self.fallback_ttl = {}
    
    async def initialize(self) -> bool:
        """Initialize Redis connection pool"""
        if not REDIS_AVAILABLE:
            logger.info("Using in-memory fallback cache")
            return True
        
        try:
            # Configure connection pool
            pool_kwargs = {
                'host': self.config.host,
                'port': self.config.port,
                'db': self.config.db,
                'max_connections': self.config.max_connections,
                'retry_on_timeout': self.config.retry_on_timeout,
                'socket_keepalive': self.config.socket_keepalive,
                'encoding': 'utf-8',
                'decode_responses': False  # We handle bytes for compression
            }
            
            if self.config.password:
                pool_kwargs['password'] = self.config.password
            
            if self.config.socket_keepalive_options:
                pool_kwargs['socket_keepalive_options'] = self.config.socket_keepalive_options
            
            self.connection_pool = redis.ConnectionPool(**pool_kwargs)
            self.redis_pool = redis.Redis(connection_pool=self.connection_pool)
            
            # Test connection
            await self.redis_pool.ping()
            logger.info(f"Redis cache initialized successfully on {self.config.host}:{self.config.port}")
            
            # Start health check task
            self.health_check_task = asyncio.create_task(self._health_check_loop())
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize Redis cache: {e}")
            logger.info("Falling back to in-memory cache")
            self.fallback_cache = {}
            self.fallback_ttl = {}
            return False
    
    async def close(self):
        """Close Redis connections"""
        if self.health_check_task:
            self.health_check_task.cancel()
        
        if self.redis_pool:
            await self.redis_pool.close()
        
        if self.connection_pool:
            await self.connection_pool.disconnect()
    
    async def _health_check_loop(self):
        """Periodic health check for Redis connection"""
        while True:
            try:
                await asyncio.sleep(self.config.health_check_interval)
                if self.redis_pool:
                    await self.redis_pool.ping()
                    logger.debug("Redis health check passed")
            except Exception as e:
                logger.error(f"Redis health check failed: {e}")
                self.metrics['errors'] += 1
    
    def _generate_content_hash(self, content: str, metadata: Dict = None) -> str:
        """Generate hash for email content"""
        content_to_hash = content
        if metadata:
            content_to_hash += json.dumps(metadata, sort_keys=True)
        return hashlib.sha256(content_to_hash.encode()).hexdigest()[:16]
    
    async def _redis_get(self, key: str) -> Optional[bytes]:
        """Get data from Redis with error handling"""
        start_time = time.time()
        try:
            self.metrics['total_requests'] += 1
            result = await self.redis_pool.get(key)
            
            response_time = (time.time() - start_time) * 1000
            self._update_avg_response_time(response_time)
            
            if result:
                self.metrics['hits'] += 1
                return result
            else:
                self.metrics['misses'] += 1
                return None
                
        except Exception as e:
            logger.error(f"Redis GET error for key {key}: {e}")
            self.metrics['errors'] += 1
            return None
    
    async def _redis_set(self, key: str, value: bytes, ttl: int) -> bool:
        """Set data in Redis with error handling"""
        start_time = time.time()
        try:
            self.metrics['total_requests'] += 1
            self.metrics['sets'] += 1
            
            await self.redis_pool.setex(key, ttl, value)
            
            response_time = (time.time() - start_time) * 1000
            self._update_avg_response_time(response_time)
            
            return True
            
        except Exception as e:
            logger.error(f"Redis SET error for key {key}: {e}")
            self.metrics['errors'] += 1
            return False
    
    def _update_avg_response_time(self, response_time: float):
        """Update average response time metric"""
        if self.metrics['avg_response_time'] == 0:
            self.metrics['avg_response_time'] = response_time
        else:
            # Moving average
            self.metrics['avg_response_time'] = (
                self.metrics['avg_response_time'] * 0.9 + response_time * 0.1
            )
    
    async def _fallback_get(self, key: str) -> Optional[Any]:
        """Get from in-memory fallback cache"""
        if key in self.fallback_cache:
            # Check TTL
            if key in self.fallback_ttl and time.time() > self.fallback_ttl[key]:
                del self.fallback_cache[key]
                del self.fallback_ttl[key]
                self.metrics['misses'] += 1
                return None
            
            self.metrics['hits'] += 1
            return self.fallback_cache[key]
        
        self.metrics['misses'] += 1
        return None
    
    async def _fallback_set(self, key: str, value: Any, ttl: int) -> bool:
        """Set in in-memory fallback cache"""
        try:
            self.fallback_cache[key] = value
            self.fallback_ttl[key] = time.time() + ttl
            self.metrics['sets'] += 1
            return True
        except Exception as e:
            logger.error(f"Fallback cache set error: {e}")
            return False
    
    async def get_classification(self, content: str, metadata: Dict, model: str) -> Optional[Dict]:
        """Get cached email classification"""
        content_hash = self._generate_content_hash(content, metadata)
        cache_key = CacheKeys.classification_key(content_hash, model)
        
        if self.redis_pool:
            data = await self._redis_get(cache_key)
            if data:
                try:
                    return CompressionUtils.decompress_data(data)
                except Exception as e:
                    logger.error(f"Error decompressing classification data: {e}")
                    return None
        else:
            return await self._fallback_get(cache_key)
        
        return None
    
    async def set_classification(self, content: str, metadata: Dict, model: str, 
                               classification_result: Dict) -> bool:
        """Cache email classification result"""
        content_hash = self._generate_content_hash(content, metadata)
        cache_key = CacheKeys.classification_key(content_hash, model)
        
        # Add timestamp for cache invalidation tracking
        cache_data = {
            'result': classification_result,
            'cached_at': datetime.now().isoformat(),
            'model': model,
            'content_hash': content_hash
        }
        
        if self.redis_pool:
            try:
                if self.config.enable_compression:
                    data = CompressionUtils.compress_data(cache_data, self.config.compression_threshold)
                else:
                    data = pickle.dumps(cache_data)
                
                return await self._redis_set(cache_key, data, self.config.classification_ttl)
            except Exception as e:
                logger.error(f"Error compressing classification data: {e}")
                return False
        else:
            return await self._fallback_set(cache_key, cache_data, self.config.classification_ttl)
    
    async def get_analysis(self, content: str, metadata: Dict, model: str) -> Optional[Dict]:
        """Get cached detailed email analysis"""
        content_hash = self._generate_content_hash(content, metadata)
        cache_key = CacheKeys.analysis_key(content_hash, model)
        
        if self.redis_pool:
            data = await self._redis_get(cache_key)
            if data:
                try:
                    return CompressionUtils.decompress_data(data)
                except Exception as e:
                    logger.error(f"Error decompressing analysis data: {e}")
                    return None
        else:
            return await self._fallback_get(cache_key)
        
        return None
    
    async def set_analysis(self, content: str, metadata: Dict, model: str, 
                          analysis_result: Dict) -> bool:
        """Cache detailed email analysis result"""
        content_hash = self._generate_content_hash(content, metadata)
        cache_key = CacheKeys.analysis_key(content_hash, model)
        
        cache_data = {
            'result': analysis_result,
            'cached_at': datetime.now().isoformat(),
            'model': model,
            'content_hash': content_hash
        }
        
        if self.redis_pool:
            try:
                if self.config.enable_compression:
                    data = CompressionUtils.compress_data(cache_data, self.config.compression_threshold)
                else:
                    data = pickle.dumps(cache_data)
                
                return await self._redis_set(cache_key, data, self.config.analysis_ttl)
            except Exception as e:
                logger.error(f"Error compressing analysis data: {e}")
                return False
        else:
            return await self._fallback_set(cache_key, cache_data, self.config.analysis_ttl)
    
    async def get_draft(self, email_id: str, analysis_hash: str) -> Optional[str]:
        """Get cached draft response"""
        cache_key = CacheKeys.draft_key(email_id, analysis_hash)
        
        if self.redis_pool:
            data = await self._redis_get(cache_key)
            if data:
                try:
                    cache_data = CompressionUtils.decompress_data(data)
                    return cache_data.get('draft', '')
                except Exception as e:
                    logger.error(f"Error decompressing draft data: {e}")
                    return None
        else:
            result = await self._fallback_get(cache_key)
            return result.get('draft', '') if result else None
        
        return None
    
    async def set_draft(self, email_id: str, analysis_hash: str, draft_content: str) -> bool:
        """Cache draft response"""
        cache_key = CacheKeys.draft_key(email_id, analysis_hash)
        
        cache_data = {
            'draft': draft_content,
            'cached_at': datetime.now().isoformat(),
            'email_id': email_id,
            'analysis_hash': analysis_hash
        }
        
        if self.redis_pool:
            try:
                if self.config.enable_compression:
                    data = CompressionUtils.compress_data(cache_data, self.config.compression_threshold)
                else:
                    data = pickle.dumps(cache_data)
                
                return await self._redis_set(cache_key, data, self.config.draft_ttl)
            except Exception as e:
                logger.error(f"Error compressing draft data: {e}")
                return False
        else:
            return await self._fallback_set(cache_key, cache_data, self.config.draft_ttl)
    
    async def get_stats(self, timeframe: str) -> Optional[Dict]:
        """Get cached statistics"""
        cache_key = CacheKeys.stats_key(timeframe)
        
        if self.redis_pool:
            data = await self._redis_get(cache_key)
            if data:
                try:
                    return CompressionUtils.decompress_data(data)
                except Exception as e:
                    logger.error(f"Error decompressing stats data: {e}")
                    return None
        else:
            return await self._fallback_get(cache_key)
        
        return None
    
    async def set_stats(self, timeframe: str, stats_data: Dict) -> bool:
        """Cache statistics"""
        cache_key = CacheKeys.stats_key(timeframe)
        
        cache_data = {
            'stats': stats_data,
            'cached_at': datetime.now().isoformat(),
            'timeframe': timeframe
        }
        
        if self.redis_pool:
            try:
                if self.config.enable_compression:
                    data = CompressionUtils.compress_data(cache_data, self.config.compression_threshold)
                else:
                    data = pickle.dumps(cache_data)
                
                return await self._redis_set(cache_key, data, self.config.stats_ttl)
            except Exception as e:
                logger.error(f"Error compressing stats data: {e}")
                return False
        else:
            return await self._fallback_set(cache_key, cache_data, self.config.stats_ttl)
    
    async def invalidate_pattern(self, pattern: str) -> int:
        """Invalidate cache keys matching pattern"""
        if not self.redis_pool:
            # For fallback cache, remove matching keys
            keys_to_remove = [key for key in self.fallback_cache.keys() if pattern in key]
            for key in keys_to_remove:
                del self.fallback_cache[key]
                if key in self.fallback_ttl:
                    del self.fallback_ttl[key]
            return len(keys_to_remove)
        
        try:
            keys = await self.redis_pool.keys(pattern)
            if keys:
                await self.redis_pool.delete(*keys)
                return len(keys)
            return 0
        except Exception as e:
            logger.error(f"Error invalidating cache pattern {pattern}: {e}")
            return 0
    
    async def clear_cache(self) -> bool:
        """Clear all cache data"""
        if self.redis_pool:
            try:
                await self.redis_pool.flushdb()
                return True
            except Exception as e:
                logger.error(f"Error clearing Redis cache: {e}")
                return False
        else:
            self.fallback_cache.clear()
            self.fallback_ttl.clear()
            return True
    
    async def get_cache_metrics(self) -> Dict:
        """Get cache performance metrics"""
        base_metrics = self.metrics.copy()
        
        if self.redis_pool:
            try:
                info = await self.redis_pool.info()
                base_metrics.update({
                    'redis_connected_clients': info.get('connected_clients', 0),
                    'redis_used_memory': info.get('used_memory', 0),
                    'redis_used_memory_human': info.get('used_memory_human', '0B'),
                    'redis_keyspace_hits': info.get('keyspace_hits', 0),
                    'redis_keyspace_misses': info.get('keyspace_misses', 0),
                    'redis_total_commands_processed': info.get('total_commands_processed', 0),
                    'cache_type': 'redis'
                })
            except Exception as e:
                logger.error(f"Error getting Redis info: {e}")
                base_metrics['cache_type'] = 'redis_error'
        else:
            base_metrics.update({
                'fallback_cache_size': len(self.fallback_cache),
                'fallback_ttl_entries': len(self.fallback_ttl),
                'cache_type': 'in_memory'
            })
        
        # Calculate hit rate
        total_requests = base_metrics['hits'] + base_metrics['misses']
        base_metrics['hit_rate'] = (
            base_metrics['hits'] / total_requests if total_requests > 0 else 0.0
        )
        
        return base_metrics
    
    async def warm_cache(self, warm_data: List[Dict]) -> int:
        """Warm cache with pre-computed data"""
        warmed_count = 0
        
        if self.config.pipeline_enabled and self.redis_pool:
            # Use Redis pipeline for batch operations
            pipe = self.redis_pool.pipeline()
            
            for item in warm_data:
                try:
                    if item['type'] == 'classification':
                        cache_key = CacheKeys.classification_key(
                            item['content_hash'], 
                            item['model']
                        )
                        data = CompressionUtils.compress_data(
                            item['data'], 
                            self.config.compression_threshold
                        )
                        pipe.setex(cache_key, self.config.classification_ttl, data)
                        warmed_count += 1
                    
                    elif item['type'] == 'analysis':
                        cache_key = CacheKeys.analysis_key(
                            item['content_hash'], 
                            item['model']
                        )
                        data = CompressionUtils.compress_data(
                            item['data'], 
                            self.config.compression_threshold
                        )
                        pipe.setex(cache_key, self.config.analysis_ttl, data)
                        warmed_count += 1
                        
                except Exception as e:
                    logger.error(f"Error preparing cache warm data: {e}")
            
            try:
                await pipe.execute()
                logger.info(f"Cache warmed with {warmed_count} items")
            except Exception as e:
                logger.error(f"Error executing cache warm pipeline: {e}")
                warmed_count = 0
        else:
            # Sequential warming for fallback or non-pipeline mode
            for item in warm_data:
                try:
                    if item['type'] == 'classification':
                        await self.set_classification(
                            item['content'], 
                            item['metadata'], 
                            item['model'], 
                            item['data']
                        )
                        warmed_count += 1
                    elif item['type'] == 'analysis':
                        await self.set_analysis(
                            item['content'], 
                            item['metadata'], 
                            item['model'], 
                            item['data']
                        )
                        warmed_count += 1
                except Exception as e:
                    logger.error(f"Error warming cache item: {e}")
        
        return warmed_count
    
    async def batch_get_classifications(self, requests: List[Tuple[str, Dict, str]]) -> List[Optional[Dict]]:
        """Batch get multiple classifications for efficiency"""
        if not requests:
            return []
            
        if self.redis_pool and self.config.pipeline_enabled:
            # Use Redis pipeline for batch operations
            pipe = self.redis_pool.pipeline()
            cache_keys = []
            
            for content, metadata, model in requests:
                content_hash = self._generate_content_hash(content, metadata)
                cache_key = CacheKeys.classification_key(content_hash, model)
                cache_keys.append(cache_key)
                pipe.get(cache_key)
            
            try:
                results = await pipe.execute()
                processed_results = []
                
                for result in results:
                    if result:
                        try:
                            decompressed = CompressionUtils.decompress_data(result)
                            processed_results.append(decompressed)
                            self.metrics['hits'] += 1
                        except Exception as e:
                            logger.error(f"Error decompressing batch result: {e}")
                            processed_results.append(None)
                            self.metrics['misses'] += 1
                    else:
                        processed_results.append(None)
                        self.metrics['misses'] += 1
                
                return processed_results
                
            except Exception as e:
                logger.error(f"Batch get error: {e}")
                self.metrics['errors'] += 1
                return [None] * len(requests)
        else:
            # Fallback to individual gets
            results = []
            for content, metadata, model in requests:
                result = await self.get_classification(content, metadata, model)
                results.append(result)
            return results
    
    async def batch_set_classifications(self, data: List[Tuple[str, Dict, str, Dict]]) -> int:
        """Batch set multiple classifications for efficiency"""
        if not data:
            return 0
            
        success_count = 0
        
        if self.redis_pool and self.config.pipeline_enabled:
            # Use Redis pipeline for batch operations
            pipe = self.redis_pool.pipeline()
            
            for content, metadata, model, classification_result in data:
                try:
                    content_hash = self._generate_content_hash(content, metadata)
                    cache_key = CacheKeys.classification_key(content_hash, model)
                    
                    cache_data = {
                        'result': classification_result,
                        'cached_at': datetime.now().isoformat(),
                        'model': model,
                        'content_hash': content_hash
                    }
                    
                    if self.config.enable_compression:
                        compressed_data = CompressionUtils.compress_data(cache_data, self.config.compression_threshold)
                    else:
                        compressed_data = pickle.dumps(cache_data)
                    
                    pipe.setex(cache_key, self.config.classification_ttl, compressed_data)
                    success_count += 1
                    
                except Exception as e:
                    logger.error(f"Error preparing batch set data: {e}")
            
            try:
                await pipe.execute()
                self.metrics['sets'] += success_count
                return success_count
            except Exception as e:
                logger.error(f"Batch set error: {e}")
                self.metrics['errors'] += 1
                return 0
        else:
            # Fallback to individual sets
            for content, metadata, model, classification_result in data:
                success = await self.set_classification(content, metadata, model, classification_result)
                if success:
                    success_count += 1
            return success_count

# Global cache instance
cache_instance = None

async def get_cache() -> PerformanceCache:
    """Get or create global cache instance"""
    global cache_instance
    if cache_instance is None:
        cache_instance = PerformanceCache()
        await cache_instance.initialize()
    return cache_instance

async def cleanup_cache():
    """Cleanup global cache instance"""
    global cache_instance
    if cache_instance:
        await cache_instance.close()
        cache_instance = None

# Context manager for cache operations
class CacheManager:
    """Context manager for cache operations"""
    
    def __init__(self, config: CacheConfig = None):
        self.config = config
        self.cache = None
    
    async def __aenter__(self) -> PerformanceCache:
        self.cache = PerformanceCache(self.config)
        await self.cache.initialize()
        return self.cache
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.cache:
            await self.cache.close()

# Example usage and testing
async def example_usage():
    """Example usage of the performance cache"""
    config = CacheConfig(
        host="localhost",
        port=6379,
        classification_ttl=3600,
        enable_compression=True
    )
    
    async with CacheManager(config) as cache:
        # Test classification caching with exact models
        content = "Please review and approve the budget for Q4 project"
        metadata = {"sender": "john@company.com", "subject": "Budget Approval"}
        model = "gpt-5-nano-2025-08-07"  # EXACT model for classification
        
        # Simulate classification result
        classification_result = {
            "classification": "APPROVAL_REQUIRED",
            "urgency": "HIGH",
            "confidence": 0.95,
            "action_items": ["Review budget", "Approve or reject"],
            "processing_time_ms": 45.2,
            "model_used": model
        }
        
        # Cache the result
        success = await cache.set_classification(content, metadata, model, classification_result)
        print(f"Cached classification: {success}")
        
        # Retrieve from cache
        cached_result = await cache.get_classification(content, metadata, model)
        print(f"Retrieved from cache: {cached_result is not None}")
        
        # Get cache metrics
        metrics = await cache.get_cache_metrics()
        print(f"Cache metrics: {metrics}")

if __name__ == "__main__":
    asyncio.run(example_usage())