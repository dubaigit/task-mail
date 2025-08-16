#!/usr/bin/env python3
"""
Scalable WebSocket Connection Manager for High-Performance Real-time Updates

Designed to handle 500+ concurrent WebSocket connections with:
- Connection pooling and load balancing
- Message broadcasting optimization
- Subscription-based filtering
- Automatic reconnection handling
- Performance monitoring and metrics
- Memory-efficient message buffering
- Rate limiting per connection
- Horizontal scaling support

Optimized for email intelligence real-time notifications with
subscriber patterns and priority messaging.
"""

import asyncio
import logging
import time
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Any, Callable, Union
from dataclasses import dataclass, asdict
from enum import Enum
from collections import defaultdict, deque
import threading
import weakref
from concurrent.futures import ThreadPoolExecutor

# WebSocket support
try:
    from fastapi import WebSocket, WebSocketDisconnect
    FASTAPI_AVAILABLE = True
except ImportError:
    FASTAPI_AVAILABLE = False

# Redis for connection state sharing (optional)
try:
    import redis.asyncio as aioredis
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

class ConnectionState(Enum):
    """WebSocket connection states"""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    RECONNECTING = "reconnecting"

class MessagePriority(Enum):
    """Message priority levels"""
    CRITICAL = 1    # System alerts, errors
    HIGH = 2        # Task updates, urgent notifications
    NORMAL = 3      # Email updates, status changes
    LOW = 4         # Background updates, metrics

class SubscriptionType(Enum):
    """Available subscription types"""
    EMAIL_UPDATES = "email_updates"
    TASK_UPDATES = "task_updates"
    DRAFT_UPDATES = "draft_updates"
    PROCESSING_STATUS = "processing_status"
    ANALYTICS = "analytics"
    SYSTEM_STATUS = "system_status"
    ALL = "all"

@dataclass
class WebSocketMessage:
    """WebSocket message with metadata"""
    id: str
    type: str
    data: Dict[str, Any]
    priority: MessagePriority = MessagePriority.NORMAL
    subscription_types: List[SubscriptionType] = None
    timestamp: datetime = None
    ttl_seconds: Optional[int] = None
    retry_count: int = 0
    max_retries: int = 3
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()
        if self.subscription_types is None:
            self.subscription_types = [SubscriptionType.ALL]
    
    def to_json(self) -> str:
        """Convert to JSON string for transmission"""
        return json.dumps({
            'id': self.id,
            'type': self.type,
            'data': self.data,
            'timestamp': self.timestamp.isoformat(),
            'priority': self.priority.value
        })
    
    def is_expired(self) -> bool:
        """Check if message has expired"""
        if not self.ttl_seconds:
            return False
        return (datetime.now() - self.timestamp).total_seconds() > self.ttl_seconds

@dataclass
class ClientConnection:
    """WebSocket client connection metadata"""
    client_id: str
    websocket: Any  # WebSocket object
    state: ConnectionState
    connected_at: datetime
    last_activity: datetime
    subscriptions: Set[SubscriptionType]
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = None
    message_queue: deque = None
    rate_limit_window: deque = None
    total_messages_sent: int = 0
    total_messages_received: int = 0
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.message_queue is None:
            self.message_queue = deque(maxlen=100)  # Buffer last 100 messages
        if self.rate_limit_window is None:
            self.rate_limit_window = deque()  # For rate limiting
    
    def is_rate_limited(self, max_messages_per_minute: int = 120) -> bool:
        """Check if client is rate limited"""
        now = time.time()
        
        # Clean old entries
        while self.rate_limit_window and now - self.rate_limit_window[0] > 60:
            self.rate_limit_window.popleft()
        
        return len(self.rate_limit_window) >= max_messages_per_minute
    
    def record_message(self):
        """Record a message for rate limiting"""
        self.rate_limit_window.append(time.time())
        self.total_messages_sent += 1
        self.last_activity = datetime.now()

@dataclass
class ConnectionMetrics:
    """Connection performance metrics"""
    total_connections: int = 0
    active_connections: int = 0
    peak_connections: int = 0
    total_messages_sent: int = 0
    total_messages_received: int = 0
    total_broadcast_messages: int = 0
    failed_message_deliveries: int = 0
    average_message_latency_ms: float = 0.0
    connections_per_second: float = 0.0
    messages_per_second: float = 0.0
    memory_usage_mb: float = 0.0
    last_reset: datetime = None
    
    def __post_init__(self):
        if self.last_reset is None:
            self.last_reset = datetime.now()

class ConnectionPool:
    """Manages WebSocket connection pooling and load balancing"""
    
    def __init__(self, max_connections_per_pool: int = 100):
        self.max_connections_per_pool = max_connections_per_pool
        self.pools: List[Dict[str, ClientConnection]] = [{}]
        self.pool_locks: List[threading.RLock] = [threading.RLock()]
        self.current_pool_index = 0
    
    def _get_optimal_pool(self) -> Tuple[int, Dict[str, ClientConnection], threading.RLock]:
        """Get the optimal pool for new connections"""
        # Find pool with space
        for i, pool in enumerate(self.pools):
            if len(pool) < self.max_connections_per_pool:
                return i, pool, self.pool_locks[i]
        
        # Create new pool if all are full
        new_pool = {}
        new_lock = threading.RLock()
        self.pools.append(new_pool)
        self.pool_locks.append(new_lock)
        
        return len(self.pools) - 1, new_pool, new_lock
    
    def add_connection(self, connection: ClientConnection) -> int:
        """Add connection to optimal pool"""
        pool_index, pool, lock = self._get_optimal_pool()
        
        with lock:
            pool[connection.client_id] = connection
        
        return pool_index
    
    def remove_connection(self, client_id: str) -> bool:
        """Remove connection from all pools"""
        for pool, lock in zip(self.pools, self.pool_locks):
            with lock:
                if client_id in pool:
                    del pool[client_id]
                    return True
        return False
    
    def get_connection(self, client_id: str) -> Optional[ClientConnection]:
        """Get connection by client ID"""
        for pool, lock in zip(self.pools, self.pool_locks):
            with lock:
                if client_id in pool:
                    return pool[client_id]
        return None
    
    def get_all_connections(self) -> Dict[str, ClientConnection]:
        """Get all connections from all pools"""
        all_connections = {}
        for pool, lock in zip(self.pools, self.pool_locks):
            with lock:
                all_connections.update(pool)
        return all_connections
    
    def get_pool_stats(self) -> List[Dict[str, Any]]:
        """Get statistics for each pool"""
        stats = []
        for i, (pool, lock) in enumerate(zip(self.pools, self.pool_locks)):
            with lock:
                pool_size = len(pool)
                active_count = sum(1 for conn in pool.values() if conn.state == ConnectionState.CONNECTED)
                
                stats.append({
                    'pool_index': i,
                    'total_connections': pool_size,
                    'active_connections': active_count,
                    'utilization': pool_size / self.max_connections_per_pool,
                    'average_queue_size': sum(len(conn.message_queue) for conn in pool.values()) / max(pool_size, 1)
                })
        
        return stats

class MessageBroadcaster:
    """Optimized message broadcasting with filtering and batching"""
    
    def __init__(self, max_batch_size: int = 50, batch_timeout_ms: int = 100):
        self.max_batch_size = max_batch_size
        self.batch_timeout_ms = batch_timeout_ms
        self.pending_messages: Dict[str, List[WebSocketMessage]] = defaultdict(list)
        self.broadcast_lock = threading.RLock()
        self.executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="broadcaster")
    
    async def queue_message(self, message: WebSocketMessage, target_connections: Dict[str, ClientConnection]):
        """Queue message for broadcast with batching"""
        # Filter connections by subscription
        filtered_connections = self._filter_connections_by_subscription(
            message, target_connections
        )
        
        # Group by priority for optimal delivery
        priority_groups = defaultdict(list)
        for client_id, connection in filtered_connections.items():
            if not connection.is_rate_limited():
                priority_groups[message.priority.value].append((client_id, connection))
        
        # Process each priority group
        for priority, connections in priority_groups.items():
            await self._batch_and_send(message, connections)
    
    def _filter_connections_by_subscription(
        self, 
        message: WebSocketMessage, 
        connections: Dict[str, ClientConnection]
    ) -> Dict[str, ClientConnection]:
        """Filter connections based on message subscription types"""
        filtered = {}
        
        for client_id, connection in connections.items():
            if connection.state != ConnectionState.CONNECTED:
                continue
            
            # Check if connection subscribes to any of the message types
            if (
                SubscriptionType.ALL in connection.subscriptions or
                any(sub_type in connection.subscriptions for sub_type in message.subscription_types)
            ):
                filtered[client_id] = connection
        
        return filtered
    
    async def _batch_and_send(self, message: WebSocketMessage, connections: List[Tuple[str, ClientConnection]]):
        """Batch and send messages for optimal performance"""
        # Split into batches
        for i in range(0, len(connections), self.max_batch_size):
            batch = connections[i:i + self.max_batch_size]
            
            # Send batch concurrently
            send_tasks = [
                self._send_to_connection(message, client_id, connection)
                for client_id, connection in batch
            ]
            
            # Wait for batch to complete with timeout
            try:
                await asyncio.wait_for(
                    asyncio.gather(*send_tasks, return_exceptions=True),
                    timeout=self.batch_timeout_ms / 1000
                )
            except asyncio.TimeoutError:
                logger.warning(f"Batch send timeout for {len(batch)} connections")
    
    async def _send_to_connection(
        self, 
        message: WebSocketMessage, 
        client_id: str, 
        connection: ClientConnection
    ) -> bool:
        """Send message to individual connection"""
        try:
            # Record message for rate limiting
            connection.record_message()
            
            # Send message
            await connection.websocket.send_text(message.to_json())
            
            logger.debug(f"Sent message {message.id} to client {client_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send message to {client_id}: {e}")
            connection.state = ConnectionState.ERROR
            return False

class ScalableWebSocketManager:
    """Main WebSocket manager for handling 500+ concurrent connections"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the scalable WebSocket manager"""
        self.config = self._load_config(config)
        self.logger = logging.getLogger(__name__)
        
        # Core components
        self.connection_pool = ConnectionPool(
            max_connections_per_pool=self.config['max_connections_per_pool']
        )
        self.broadcaster = MessageBroadcaster(
            max_batch_size=self.config['broadcast_batch_size'],
            batch_timeout_ms=self.config['broadcast_timeout_ms']
        )
        
        # Performance tracking
        self.metrics = ConnectionMetrics()
        self.metrics_lock = threading.RLock()
        
        # Background tasks
        self.is_running = False
        self.cleanup_task = None
        self.metrics_task = None
        self.heartbeat_task = None
        
        # Redis for distributed state (optional)
        self.redis_client = None
        if REDIS_AVAILABLE and self.config.get('redis_enabled', False):
            asyncio.create_task(self._initialize_redis())
        
        self.logger.info(
            f"Scalable WebSocket Manager initialized "
            f"(max connections: {self.config['max_total_connections']})"
        )
    
    def _load_config(self, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Load configuration with defaults"""
        default_config = {
            'max_total_connections': 500,
            'max_connections_per_pool': 100,
            'broadcast_batch_size': 50,
            'broadcast_timeout_ms': 100,
            'heartbeat_interval_seconds': 30,
            'cleanup_interval_seconds': 60,
            'message_buffer_size': 100,
            'rate_limit_messages_per_minute': 120,
            'connection_timeout_seconds': 300,
            'redis_enabled': False,
            'redis_host': 'localhost',
            'redis_port': 6379,
            'redis_db': 1
        }
        
        if config:
            default_config.update(config)
        
        return default_config
    
    async def _initialize_redis(self):
        """Initialize Redis for distributed state management"""
        try:
            self.redis_client = aioredis.Redis(
                host=self.config['redis_host'],
                port=self.config['redis_port'],
                db=self.config['redis_db'],
                decode_responses=True
            )
            
            await self.redis_client.ping()
            self.logger.info("Redis connection established for WebSocket state")
            
        except Exception as e:
            self.logger.error(f"Redis initialization failed: {e}")
            self.redis_client = None
    
    async def connect_client(
        self, 
        websocket: Any, 
        user_id: Optional[str] = None,
        subscriptions: Optional[List[SubscriptionType]] = None
    ) -> str:
        """Connect new WebSocket client"""
        # Check connection limits
        current_connections = len(self.connection_pool.get_all_connections())
        if current_connections >= self.config['max_total_connections']:
            await websocket.close(code=1013, reason="Server capacity reached")
            raise Exception("Maximum connection limit reached")
        
        # Generate client ID
        client_id = str(uuid.uuid4())
        
        # Accept WebSocket connection
        await websocket.accept()
        
        # Create connection object
        connection = ClientConnection(
            client_id=client_id,
            websocket=websocket,
            state=ConnectionState.CONNECTED,
            connected_at=datetime.now(),
            last_activity=datetime.now(),
            subscriptions=set(subscriptions or [SubscriptionType.ALL]),
            user_id=user_id
        )
        
        # Add to connection pool
        pool_index = self.connection_pool.add_connection(connection)
        
        # Update metrics
        with self.metrics_lock:
            self.metrics.total_connections += 1
            self.metrics.active_connections += 1
            self.metrics.peak_connections = max(
                self.metrics.peak_connections, 
                self.metrics.active_connections
            )
        
        # Store in Redis if available
        if self.redis_client:
            await self._store_connection_state(connection)
        
        # Send welcome message
        welcome_message = WebSocketMessage(
            id=str(uuid.uuid4()),
            type="connection_established",
            data={
                "client_id": client_id,
                "server_time": datetime.now().isoformat(),
                "subscriptions": [sub.value for sub in connection.subscriptions],
                "pool_index": pool_index
            },
            priority=MessagePriority.HIGH
        )
        
        await self._send_to_client(client_id, welcome_message)
        
        self.logger.info(f"Client {client_id} connected (pool {pool_index}, user: {user_id})")
        return client_id
    
    async def disconnect_client(self, client_id: str):
        """Disconnect WebSocket client"""
        connection = self.connection_pool.get_connection(client_id)
        if not connection:
            return
        
        try:
            connection.state = ConnectionState.DISCONNECTED
            await connection.websocket.close()
        except Exception as e:
            self.logger.error(f"Error closing WebSocket for {client_id}: {e}")
        
        # Remove from pool
        self.connection_pool.remove_connection(client_id)
        
        # Update metrics
        with self.metrics_lock:
            self.metrics.active_connections -= 1
        
        # Remove from Redis if available
        if self.redis_client:
            await self._remove_connection_state(client_id)
        
        self.logger.info(f"Client {client_id} disconnected")
    
    async def subscribe_client(self, client_id: str, subscription_types: List[SubscriptionType]):
        """Update client subscriptions"""
        connection = self.connection_pool.get_connection(client_id)
        if not connection:
            raise Exception(f"Client {client_id} not found")
        
        connection.subscriptions.update(subscription_types)
        
        # Update in Redis if available
        if self.redis_client:
            await self._store_connection_state(connection)
        
        self.logger.info(f"Updated subscriptions for client {client_id}: {[s.value for s in subscription_types]}")
    
    async def broadcast_message(
        self, 
        message: WebSocketMessage,
        target_user_ids: Optional[List[str]] = None
    ):
        """Broadcast message to all or specific clients"""
        connections = self.connection_pool.get_all_connections()
        
        # Filter by user IDs if specified
        if target_user_ids:
            connections = {
                client_id: conn for client_id, conn in connections.items()
                if conn.user_id in target_user_ids
            }
        
        # Queue for broadcasting
        await self.broadcaster.queue_message(message, connections)
        
        with self.metrics_lock:
            self.metrics.total_broadcast_messages += 1
            self.metrics.total_messages_sent += len(connections)
    
    async def send_to_client(self, client_id: str, message: WebSocketMessage) -> bool:
        """Send message to specific client"""
        return await self._send_to_client(client_id, message)
    
    async def _send_to_client(self, client_id: str, message: WebSocketMessage) -> bool:
        """Internal method to send message to client"""
        connection = self.connection_pool.get_connection(client_id)
        if not connection or connection.state != ConnectionState.CONNECTED:
            return False
        
        # Check rate limiting
        if connection.is_rate_limited(self.config['rate_limit_messages_per_minute']):
            self.logger.warning(f"Rate limit exceeded for client {client_id}")
            return False
        
        try:
            connection.record_message()
            await connection.websocket.send_text(message.to_json())
            
            with self.metrics_lock:
                self.metrics.total_messages_sent += 1
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to send message to {client_id}: {e}")
            
            # Mark connection as error and schedule for cleanup
            connection.state = ConnectionState.ERROR
            
            with self.metrics_lock:
                self.metrics.failed_message_deliveries += 1
            
            return False
    
    async def start_background_tasks(self):
        """Start background maintenance tasks"""
        if self.is_running:
            return
        
        self.is_running = True
        
        # Start background tasks
        self.cleanup_task = asyncio.create_task(self._cleanup_loop())
        self.metrics_task = asyncio.create_task(self._metrics_loop())
        self.heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        
        self.logger.info("Background tasks started")
    
    async def stop_background_tasks(self):
        """Stop background maintenance tasks"""
        self.is_running = False
        
        # Cancel tasks
        for task in [self.cleanup_task, self.metrics_task, self.heartbeat_task]:
            if task:
                task.cancel()
        
        # Wait for tasks to complete
        tasks = [t for t in [self.cleanup_task, self.metrics_task, self.heartbeat_task] if t]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        
        self.logger.info("Background tasks stopped")
    
    async def _cleanup_loop(self):
        """Background cleanup of dead connections"""
        while self.is_running:
            try:
                await self._cleanup_dead_connections()
                await asyncio.sleep(self.config['cleanup_interval_seconds'])
            except Exception as e:
                self.logger.error(f"Cleanup loop error: {e}")
                await asyncio.sleep(30)
    
    async def _metrics_loop(self):
        """Background metrics collection"""
        while self.is_running:
            try:
                await self._update_metrics()
                await asyncio.sleep(30)  # Update every 30 seconds
            except Exception as e:
                self.logger.error(f"Metrics loop error: {e}")
                await asyncio.sleep(60)
    
    async def _heartbeat_loop(self):
        """Background heartbeat to keep connections alive"""
        while self.is_running:
            try:
                await self._send_heartbeat()
                await asyncio.sleep(self.config['heartbeat_interval_seconds'])
            except Exception as e:
                self.logger.error(f"Heartbeat loop error: {e}")
                await asyncio.sleep(60)
    
    async def _cleanup_dead_connections(self):
        """Remove dead or expired connections"""
        current_time = datetime.now()
        timeout_threshold = timedelta(seconds=self.config['connection_timeout_seconds'])
        
        dead_connections = []
        all_connections = self.connection_pool.get_all_connections()
        
        for client_id, connection in all_connections.items():
            # Check for timeout
            if current_time - connection.last_activity > timeout_threshold:
                dead_connections.append(client_id)
                continue
            
            # Check for error state
            if connection.state == ConnectionState.ERROR:
                dead_connections.append(client_id)
                continue
            
            # Test connection with ping
            try:
                await connection.websocket.ping()
            except Exception:
                dead_connections.append(client_id)
        
        # Clean up dead connections
        for client_id in dead_connections:
            await self.disconnect_client(client_id)
        
        if dead_connections:
            self.logger.info(f"Cleaned up {len(dead_connections)} dead connections")
    
    async def _send_heartbeat(self):
        """Send heartbeat to all connected clients"""
        heartbeat_message = WebSocketMessage(
            id=str(uuid.uuid4()),
            type="heartbeat",
            data={"timestamp": datetime.now().isoformat()},
            priority=MessagePriority.LOW,
            ttl_seconds=60
        )
        
        await self.broadcast_message(heartbeat_message)
    
    async def _update_metrics(self):
        """Update performance metrics"""
        with self.metrics_lock:
            # Calculate rates
            elapsed_seconds = (datetime.now() - self.metrics.last_reset).total_seconds()
            if elapsed_seconds > 0:
                self.metrics.connections_per_second = self.metrics.total_connections / elapsed_seconds
                self.metrics.messages_per_second = self.metrics.total_messages_sent / elapsed_seconds
            
            # Update memory usage if available
            if PSUTIL_AVAILABLE:
                process = psutil.Process()
                self.metrics.memory_usage_mb = process.memory_info().rss / (1024 * 1024)
    
    async def _store_connection_state(self, connection: ClientConnection):
        """Store connection state in Redis"""
        if not self.redis_client:
            return
        
        try:
            state_data = {
                'client_id': connection.client_id,
                'user_id': connection.user_id,
                'state': connection.state.value,
                'connected_at': connection.connected_at.isoformat(),
                'subscriptions': [sub.value for sub in connection.subscriptions],
                'metadata': connection.metadata
            }
            
            await self.redis_client.setex(
                f"ws_connection:{connection.client_id}",
                300,  # 5 minute TTL
                json.dumps(state_data)
            )
            
        except Exception as e:
            self.logger.error(f"Error storing connection state: {e}")
    
    async def _remove_connection_state(self, client_id: str):
        """Remove connection state from Redis"""
        if not self.redis_client:
            return
        
        try:
            await self.redis_client.delete(f"ws_connection:{client_id}")
        except Exception as e:
            self.logger.error(f"Error removing connection state: {e}")
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get comprehensive metrics and status"""
        with self.metrics_lock:
            metrics_copy = asdict(self.metrics)
        
        pool_stats = self.connection_pool.get_pool_stats()
        
        return {
            'timestamp': datetime.now().isoformat(),
            'connection_metrics': metrics_copy,
            'pool_statistics': pool_stats,
            'configuration': {
                'max_total_connections': self.config['max_total_connections'],
                'max_connections_per_pool': self.config['max_connections_per_pool'],
                'broadcast_batch_size': self.config['broadcast_batch_size']
            },
            'health_status': self._calculate_health_status(),
            'redis_enabled': self.redis_client is not None
        }
    
    def _calculate_health_status(self) -> Dict[str, Any]:
        """Calculate system health status"""
        health_score = 100
        issues = []
        
        # Connection utilization
        utilization = self.metrics.active_connections / self.config['max_total_connections']
        if utilization > 0.9:
            health_score -= 30
            issues.append(f"High connection utilization: {utilization:.1%}")
        elif utilization > 0.7:
            health_score -= 15
            issues.append(f"Moderate connection utilization: {utilization:.1%}")
        
        # Message delivery failure rate
        total_attempts = self.metrics.total_messages_sent + self.metrics.failed_message_deliveries
        if total_attempts > 0:
            failure_rate = self.metrics.failed_message_deliveries / total_attempts
            if failure_rate > 0.1:
                health_score -= 25
                issues.append(f"High message failure rate: {failure_rate:.1%}")
        
        # Memory usage
        if self.metrics.memory_usage_mb > 1000:  # 1GB
            health_score -= 20
            issues.append(f"High memory usage: {self.metrics.memory_usage_mb:.1f}MB")
        
        return {
            'score': max(health_score, 0),
            'status': 'healthy' if health_score >= 80 else 'degraded' if health_score >= 60 else 'unhealthy',
            'issues': issues,
            'utilization': utilization,
            'active_pools': len([p for p in self.connection_pool.get_pool_stats() if p['total_connections'] > 0])
        }
    
    async def cleanup(self):
        """Cleanup all resources"""
        await self.stop_background_tasks()
        
        # Disconnect all clients
        all_connections = list(self.connection_pool.get_all_connections().keys())
        for client_id in all_connections:
            await self.disconnect_client(client_id)
        
        # Close Redis connection
        if self.redis_client:
            await self.redis_client.close()
        
        self.logger.info("Scalable WebSocket Manager cleaned up")


# Example usage and testing
async def demo_websocket_manager():
    """Demonstrate the scalable WebSocket manager"""
    
    # Mock WebSocket for testing
    class MockWebSocket:
        def __init__(self, client_id: str):
            self.client_id = client_id
            self.messages = []
            self.closed = False
        
        async def accept(self):
            pass
        
        async def send_text(self, data: str):
            if not self.closed:
                self.messages.append(data)
        
        async def close(self, code: int = 1000, reason: str = ""):
            self.closed = True
        
        async def ping(self):
            if self.closed:
                raise Exception("Connection closed")
    
    # Configuration
    config = {
        'max_total_connections': 500,
        'max_connections_per_pool': 100,
        'broadcast_batch_size': 25,
        'heartbeat_interval_seconds': 10,
        'redis_enabled': False
    }
    
    # Initialize manager
    manager = ScalableWebSocketManager(config)
    
    try:
        # Start background tasks
        await manager.start_background_tasks()
        
        print("\n=== Scalable WebSocket Manager Demo ===")
        
        # Simulate multiple client connections
        client_ids = []
        mock_websockets = []
        
        print("\nConnecting 50 mock clients...")
        for i in range(50):
            mock_ws = MockWebSocket(f"client-{i}")
            mock_websockets.append(mock_ws)
            
            client_id = await manager.connect_client(
                websocket=mock_ws,
                user_id=f"user-{i % 10}",  # 10 different users
                subscriptions=[
                    SubscriptionType.EMAIL_UPDATES,
                    SubscriptionType.TASK_UPDATES
                ]
            )
            client_ids.append(client_id)
        
        # Get initial metrics
        metrics = await manager.get_metrics()
        print(f"\nConnected clients: {metrics['connection_metrics']['active_connections']}")
        print(f"Pool distribution: {[p['total_connections'] for p in metrics['pool_statistics']]}")
        print(f"Health status: {metrics['health_status']['status']} (score: {metrics['health_status']['score']})")
        
        # Test broadcasting
        print("\nTesting message broadcasting...")
        
        # Broadcast email update
        email_message = WebSocketMessage(
            id=str(uuid.uuid4()),
            type="email_processed",
            data={
                "email_id": 123,
                "classification": "NEEDS_REPLY",
                "urgency": "HIGH"
            },
            priority=MessagePriority.HIGH,
            subscription_types=[SubscriptionType.EMAIL_UPDATES]
        )
        
        await manager.broadcast_message(email_message)
        
        # Broadcast task update
        task_message = WebSocketMessage(
            id=str(uuid.uuid4()),
            type="task_created",
            data={
                "task_id": 456,
                "title": "Review quarterly report",
                "priority": "high"
            },
            priority=MessagePriority.NORMAL,
            subscription_types=[SubscriptionType.TASK_UPDATES]
        )
        
        await manager.broadcast_message(task_message)
        
        # Wait for message delivery
        await asyncio.sleep(1)
        
        # Check message delivery
        delivered_count = sum(1 for ws in mock_websockets if len(ws.messages) >= 3)  # Welcome + 2 broadcasts
        print(f"Messages delivered to {delivered_count}/{len(mock_websockets)} clients")
        
        # Test targeted messaging
        print("\nTesting targeted messaging...")
        
        targeted_message = WebSocketMessage(
            id=str(uuid.uuid4()),
            type="urgent_notification",
            data={"message": "System maintenance in 5 minutes"},
            priority=MessagePriority.CRITICAL
        )
        
        # Send to specific users
        await manager.broadcast_message(targeted_message, target_user_ids=["user-1", "user-2"])
        
        # Performance test
        print("\nRunning performance test (100 rapid broadcasts)...")
        start_time = time.time()
        
        for i in range(100):
            perf_message = WebSocketMessage(
                id=str(uuid.uuid4()),
                type="performance_test",
                data={"iteration": i},
                priority=MessagePriority.LOW
            )
            # Don't await to test concurrency
            asyncio.create_task(manager.broadcast_message(perf_message))
        
        # Wait for all messages to be processed
        await asyncio.sleep(2)
        
        end_time = time.time()
        duration = end_time - start_time
        
        # Final metrics
        final_metrics = await manager.get_metrics()
        
        print(f"\n=== Performance Results ===")
        print(f"Performance test duration: {duration:.2f}s")
        print(f"Total messages sent: {final_metrics['connection_metrics']['total_messages_sent']}")
        print(f"Failed deliveries: {final_metrics['connection_metrics']['failed_message_deliveries']}")
        print(f"Messages per second: {final_metrics['connection_metrics']['messages_per_second']:.1f}")
        print(f"Memory usage: {final_metrics['connection_metrics']['memory_usage_mb']:.1f}MB")
        print(f"Health score: {final_metrics['health_status']['score']}/100")
        
        # Test disconnections
        print("\nTesting client disconnections...")
        
        # Disconnect half the clients
        for i in range(0, len(client_ids), 2):
            await manager.disconnect_client(client_ids[i])
        
        final_final_metrics = await manager.get_metrics()
        print(f"Remaining active connections: {final_final_metrics['connection_metrics']['active_connections']}")
    
    finally:
        # Cleanup
        await manager.cleanup()
        print("\nDemo completed and cleaned up.")


if __name__ == "__main__":
    asyncio.run(demo_websocket_manager())
