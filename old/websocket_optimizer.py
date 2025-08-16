"""
websocket_optimizer.py - WebSocket Performance Optimization Module

Advanced WebSocket optimization for real-time task-centric email interface.
Implements intelligent connection management, message batching, and optimization
for minimal latency and maximum throughput.

Features:
- Intelligent connection pooling and multiplexing
- Message batching and compression
- Adaptive rate limiting and flow control
- Connection quality monitoring
- Real-time performance optimization
- Client-specific optimization
- Network condition adaptation
- Auto-reconnection with exponential backoff
"""

import asyncio
import json
import time
import logging
import weakref
import zlib
from typing import Dict, List, Optional, Any, Callable, Set, Union, Tuple
from dataclasses import dataclass, field
from collections import defaultdict, deque
from datetime import datetime, timedelta
import statistics
import websockets
from websockets.exceptions import ConnectionClosed, InvalidStatusCode
import struct
import hashlib
from enum import Enum
import threading
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class MessagePriority(Enum):
    """Message priority levels"""
    CRITICAL = 1    # Immediate delivery required
    HIGH = 2        # High priority, minimal delay
    MEDIUM = 3      # Standard delivery
    LOW = 4         # Background, can be delayed
    BULK = 5        # Bulk operations, lowest priority

class ConnectionState(Enum):
    """WebSocket connection states"""
    CONNECTING = "connecting"
    CONNECTED = "connected"
    DISCONNECTING = "disconnecting"
    DISCONNECTED = "disconnected"
    ERROR = "error"
    RECONNECTING = "reconnecting"

@dataclass
class WebSocketConfig:
    """WebSocket optimization configuration"""
    # Connection management
    max_connections_per_client: int = 5
    connection_pool_size: int = 100
    max_total_connections: int = 1000
    connection_timeout: float = 30.0
    ping_interval: float = 20.0
    ping_timeout: float = 10.0
    
    # Message optimization
    enable_message_batching: bool = True
    batch_size: int = 10
    batch_timeout_ms: float = 50.0  # Maximum batch wait time
    enable_compression: bool = True
    compression_threshold: int = 1024  # Compress messages larger than this
    compression_level: int = 6
    
    # Performance optimization
    enable_adaptive_rate_limiting: bool = True
    base_rate_limit: float = 100.0  # messages per second
    burst_limit: int = 20
    enable_flow_control: bool = True
    max_queue_size: int = 1000
    
    # Quality monitoring
    enable_quality_monitoring: bool = True
    latency_threshold_ms: float = 100.0
    packet_loss_threshold: float = 0.01  # 1%
    
    # Auto-reconnection
    enable_auto_reconnect: bool = True
    max_reconnect_attempts: int = 10
    base_reconnect_delay: float = 1.0
    max_reconnect_delay: float = 60.0
    reconnect_backoff_factor: float = 2.0

@dataclass
class ConnectionMetrics:
    """Metrics for individual WebSocket connections"""
    connection_id: str
    client_id: str
    state: ConnectionState
    connected_at: datetime
    last_activity: datetime
    
    # Performance metrics
    messages_sent: int = 0
    messages_received: int = 0
    bytes_sent: int = 0
    bytes_received: int = 0
    avg_latency_ms: float = 0.0
    packet_loss_rate: float = 0.0
    
    # Quality metrics
    connection_quality: float = 1.0  # 0.0 to 1.0
    error_count: int = 0
    reconnect_count: int = 0
    
    # Buffer metrics
    send_queue_size: int = 0
    receive_queue_size: int = 0

@dataclass
class WebSocketMessage:
    """WebSocket message with metadata"""
    id: str
    type: str
    payload: Dict[str, Any]
    priority: MessagePriority = MessagePriority.MEDIUM
    timestamp: float = field(default_factory=time.time)
    client_id: Optional[str] = None
    requires_ack: bool = False
    timeout: Optional[float] = None
    retry_count: int = 0
    max_retries: int = 3

class WebSocketOptimizer:
    """Main WebSocket optimization class"""
    
    def __init__(self, config: Optional[WebSocketConfig] = None):
        self.config = config or WebSocketConfig()
        
        # Connection management
        self.connections: Dict[str, 'OptimizedWebSocket'] = {}
        self.client_connections: Dict[str, Set[str]] = defaultdict(set)
        self.connection_pool = asyncio.Queue(maxsize=self.config.connection_pool_size)
        
        # Message handling
        self.message_batches: Dict[str, List[WebSocketMessage]] = defaultdict(list)
        self.batch_timers: Dict[str, asyncio.Task] = {}
        self.message_queue: Dict[MessagePriority, deque] = {
            priority: deque() for priority in MessagePriority
        }
        
        # Performance tracking
        self.performance_metrics: Dict[str, ConnectionMetrics] = {}
        self.global_metrics = GlobalWebSocketMetrics()
        
        # Rate limiting
        self.rate_limiters: Dict[str, RateLimiter] = {}
        self.flow_controllers: Dict[str, FlowController] = {}
        
        # Background services
        self.message_processor_task: Optional[asyncio.Task] = None
        self.quality_monitor_task: Optional[asyncio.Task] = None
        self.cleanup_task: Optional[asyncio.Task] = None
        
        # State management
        self.is_running = False
        self.thread_executor = ThreadPoolExecutor(max_workers=4)
        
        # Initialize components
        self._initialize_components()

    def _initialize_components(self):
        """Initialize WebSocket optimization components"""
        logger.info("Initializing WebSocket optimization components")
        
        # Start background services
        self.message_processor_task = asyncio.create_task(self._process_message_queue())
        self.quality_monitor_task = asyncio.create_task(self._monitor_connection_quality())
        self.cleanup_task = asyncio.create_task(self._cleanup_connections())
        
        self.is_running = True

    async def create_optimized_connection(
        self, 
        client_id: str, 
        websocket: websockets.WebSocketServerProtocol
    ) -> 'OptimizedWebSocket':
        """
        Create an optimized WebSocket connection
        
        Args:
            client_id: Unique client identifier
            websocket: WebSocket connection object
            
        Returns:
            Optimized WebSocket wrapper
        """
        # Check connection limits
        if len(self.client_connections[client_id]) >= self.config.max_connections_per_client:
            raise ConnectionError(f"Client {client_id} has reached maximum connections")
        
        if len(self.connections) >= self.config.max_total_connections:
            # Remove oldest connection to make space
            await self._evict_oldest_connection()
        
        # Create optimized connection
        connection_id = f"{client_id}_{int(time.time() * 1000)}"
        optimized_ws = OptimizedWebSocket(
            connection_id=connection_id,
            client_id=client_id,
            websocket=websocket,
            optimizer=self
        )
        
        # Register connection
        self.connections[connection_id] = optimized_ws
        self.client_connections[client_id].add(connection_id)
        
        # Initialize metrics
        self.performance_metrics[connection_id] = ConnectionMetrics(
            connection_id=connection_id,
            client_id=client_id,
            state=ConnectionState.CONNECTED,
            connected_at=datetime.now(),
            last_activity=datetime.now()
        )
        
        # Initialize rate limiter and flow controller
        self.rate_limiters[connection_id] = RateLimiter(
            rate=self.config.base_rate_limit,
            burst=self.config.burst_limit
        )
        
        self.flow_controllers[connection_id] = FlowController(
            max_queue_size=self.config.max_queue_size
        )
        
        logger.info(f"Created optimized WebSocket connection: {connection_id}")
        return optimized_ws

    async def send_message(
        self, 
        client_id: str, 
        message: WebSocketMessage,
        connection_id: Optional[str] = None
    ) -> bool:
        """
        Send optimized message to client
        
        Args:
            client_id: Target client identifier
            message: Message to send
            connection_id: Specific connection ID (optional)
            
        Returns:
            True if message was queued successfully
        """
        try:
            # Find best connection for message
            target_connection_id = connection_id or self._select_best_connection(client_id)
            if not target_connection_id:
                logger.warning(f"No available connections for client: {client_id}")
                return False
            
            connection = self.connections.get(target_connection_id)
            if not connection:
                return False
            
            # Apply rate limiting
            rate_limiter = self.rate_limiters.get(target_connection_id)
            if rate_limiter and not await rate_limiter.allow_request():
                logger.warning(f"Rate limit exceeded for connection: {target_connection_id}")
                return False
            
            # Apply flow control
            flow_controller = self.flow_controllers.get(target_connection_id)
            if flow_controller and not flow_controller.can_send():
                logger.warning(f"Flow control blocking for connection: {target_connection_id}")
                return False
            
            # Queue message for batching or immediate send
            if self.config.enable_message_batching and message.priority != MessagePriority.CRITICAL:
                await self._queue_for_batching(target_connection_id, message)
            else:
                await self._send_immediate(connection, message)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to send message to {client_id}: {e}")
            return False

    async def broadcast_message(
        self, 
        message: WebSocketMessage, 
        client_filter: Optional[Callable[[str], bool]] = None
    ) -> Dict[str, bool]:
        """
        Broadcast message to multiple clients
        
        Args:
            message: Message to broadcast
            client_filter: Optional filter function for clients
            
        Returns:
            Dictionary mapping client_id to success status
        """
        results = {}
        
        # Determine target clients
        target_clients = self.client_connections.keys()
        if client_filter:
            target_clients = [cid for cid in target_clients if client_filter(cid)]
        
        # Send to all target clients
        send_tasks = []
        for client_id in target_clients:
            task = asyncio.create_task(self.send_message(client_id, message))
            send_tasks.append((client_id, task))
        
        # Wait for all sends to complete
        for client_id, task in send_tasks:
            try:
                results[client_id] = await task
            except Exception as e:
                logger.error(f"Broadcast failed for client {client_id}: {e}")
                results[client_id] = False
        
        logger.info(f"Broadcast completed: {sum(results.values())}/{len(results)} successful")
        return results

    async def close_connection(self, connection_id: str, reason: str = "Normal closure"):
        """Close and cleanup WebSocket connection"""
        connection = self.connections.get(connection_id)
        if not connection:
            return
        
        try:
            # Update connection state
            metrics = self.performance_metrics.get(connection_id)
            if metrics:
                metrics.state = ConnectionState.DISCONNECTING
            
            # Close WebSocket
            await connection.close(reason)
            
            # Cleanup resources
            await self._cleanup_connection(connection_id)
            
            logger.info(f"Closed WebSocket connection: {connection_id}")
            
        except Exception as e:
            logger.error(f"Error closing connection {connection_id}: {e}")

    async def get_connection_metrics(self, connection_id: str) -> Optional[ConnectionMetrics]:
        """Get metrics for specific connection"""
        return self.performance_metrics.get(connection_id)

    async def get_global_metrics(self) -> 'GlobalWebSocketMetrics':
        """Get global WebSocket metrics"""
        # Update global metrics
        self.global_metrics.update(self.performance_metrics, self.connections)
        return self.global_metrics

    async def optimize_connection(self, connection_id: str) -> Dict[str, Any]:
        """
        Optimize specific connection based on current metrics
        
        Args:
            connection_id: Connection to optimize
            
        Returns:
            Dictionary with optimization results
        """
        connection = self.connections.get(connection_id)
        metrics = self.performance_metrics.get(connection_id)
        
        if not connection or not metrics:
            return {"status": "error", "message": "Connection not found"}
        
        optimizations = []
        
        try:
            # Optimize based on latency
            if metrics.avg_latency_ms > self.config.latency_threshold_ms:
                # Reduce batch timeout for faster delivery
                self.config.batch_timeout_ms = max(10.0, self.config.batch_timeout_ms * 0.8)
                optimizations.append("Reduced batch timeout for lower latency")
            
            # Optimize based on packet loss
            if metrics.packet_loss_rate > self.config.packet_loss_threshold:
                # Enable more aggressive retry
                connection.enable_aggressive_retry = True
                optimizations.append("Enabled aggressive retry for packet loss")
            
            # Optimize based on queue size
            if metrics.send_queue_size > self.config.max_queue_size * 0.8:
                # Increase rate limit temporarily
                rate_limiter = self.rate_limiters.get(connection_id)
                if rate_limiter:
                    rate_limiter.increase_rate(1.2)
                    optimizations.append("Increased rate limit for queue pressure")
            
            # Optimize compression
            if metrics.bytes_sent > 1024 * 1024 and not self.config.enable_compression:
                self.config.enable_compression = True
                optimizations.append("Enabled compression for large data transfer")
            
            return {
                "status": "success",
                "optimizations": optimizations,
                "metrics": {
                    "latency_ms": metrics.avg_latency_ms,
                    "packet_loss_rate": metrics.packet_loss_rate,
                    "queue_size": metrics.send_queue_size,
                    "connection_quality": metrics.connection_quality
                }
            }
            
        except Exception as e:
            logger.error(f"Connection optimization failed for {connection_id}: {e}")
            return {"status": "error", "message": str(e)}

    # Private helper methods

    def _select_best_connection(self, client_id: str) -> Optional[str]:
        """Select the best connection for a client based on metrics"""
        client_connections = self.client_connections.get(client_id, set())
        if not client_connections:
            return None
        
        best_connection = None
        best_score = -1
        
        for connection_id in client_connections:
            metrics = self.performance_metrics.get(connection_id)
            connection = self.connections.get(connection_id)
            
            if not metrics or not connection or metrics.state != ConnectionState.CONNECTED:
                continue
            
            # Calculate connection score based on multiple factors
            score = self._calculate_connection_score(metrics)
            
            if score > best_score:
                best_score = score
                best_connection = connection_id
        
        return best_connection

    def _calculate_connection_score(self, metrics: ConnectionMetrics) -> float:
        """Calculate connection quality score"""
        # Base score from connection quality
        score = metrics.connection_quality
        
        # Penalty for high latency
        latency_penalty = min(0.5, metrics.avg_latency_ms / 1000.0)
        score -= latency_penalty
        
        # Penalty for packet loss
        loss_penalty = metrics.packet_loss_rate * 10
        score -= loss_penalty
        
        # Penalty for queue size
        queue_penalty = min(0.3, metrics.send_queue_size / self.config.max_queue_size)
        score -= queue_penalty
        
        return max(0.0, score)

    async def _queue_for_batching(self, connection_id: str, message: WebSocketMessage):
        """Queue message for batching"""
        self.message_batches[connection_id].append(message)
        
        # Start batch timer if not already running
        if connection_id not in self.batch_timers:
            self.batch_timers[connection_id] = asyncio.create_task(
                self._batch_timer(connection_id)
            )
        
        # Send immediately if batch is full
        if len(self.message_batches[connection_id]) >= self.config.batch_size:
            await self._send_batch(connection_id)

    async def _batch_timer(self, connection_id: str):
        """Timer for batching messages"""
        try:
            await asyncio.sleep(self.config.batch_timeout_ms / 1000.0)
            await self._send_batch(connection_id)
        except asyncio.CancelledError:
            pass
        finally:
            self.batch_timers.pop(connection_id, None)

    async def _send_batch(self, connection_id: str):
        """Send batched messages"""
        batch = self.message_batches.pop(connection_id, [])
        if not batch:
            return
        
        # Cancel timer if running
        timer = self.batch_timers.pop(connection_id, None)
        if timer and not timer.done():
            timer.cancel()
        
        connection = self.connections.get(connection_id)
        if not connection:
            return
        
        try:
            # Create batch message
            batch_message = {
                "type": "batch",
                "messages": [self._serialize_message(msg) for msg in batch],
                "timestamp": time.time()
            }
            
            await self._send_raw(connection, batch_message)
            
            # Update metrics
            metrics = self.performance_metrics.get(connection_id)
            if metrics:
                metrics.messages_sent += len(batch)
            
        except Exception as e:
            logger.error(f"Failed to send batch for {connection_id}: {e}")

    async def _send_immediate(self, connection: 'OptimizedWebSocket', message: WebSocketMessage):
        """Send message immediately without batching"""
        try:
            serialized = self._serialize_message(message)
            await self._send_raw(connection, serialized)
            
            # Update metrics
            metrics = self.performance_metrics.get(connection.connection_id)
            if metrics:
                metrics.messages_sent += 1
                
        except Exception as e:
            logger.error(f"Failed to send immediate message: {e}")

    async def _send_raw(self, connection: 'OptimizedWebSocket', data: Dict[str, Any]):
        """Send raw data through WebSocket with optimization"""
        try:
            # Serialize data
            json_data = json.dumps(data)
            
            # Apply compression if enabled and data is large enough
            if (self.config.enable_compression and 
                len(json_data) > self.config.compression_threshold):
                compressed_data = zlib.compress(
                    json_data.encode(), 
                    level=self.config.compression_level
                )
                # Add compression header
                final_data = b"COMP" + struct.pack("!I", len(json_data)) + compressed_data
            else:
                final_data = json_data
            
            # Send through WebSocket
            await connection.send(final_data)
            
            # Update metrics
            metrics = self.performance_metrics.get(connection.connection_id)
            if metrics:
                metrics.bytes_sent += len(final_data)
                metrics.last_activity = datetime.now()
            
        except Exception as e:
            logger.error(f"Failed to send raw data: {e}")
            raise

    def _serialize_message(self, message: WebSocketMessage) -> Dict[str, Any]:
        """Serialize WebSocket message"""
        return {
            "id": message.id,
            "type": message.type,
            "payload": message.payload,
            "priority": message.priority.value,
            "timestamp": message.timestamp,
            "requires_ack": message.requires_ack
        }

    async def _process_message_queue(self):
        """Background task to process message queue"""
        while self.is_running:
            try:
                # Process messages by priority
                for priority in MessagePriority:
                    queue = self.message_queue[priority]
                    
                    # Process up to 10 messages per priority level
                    for _ in range(min(10, len(queue))):
                        if queue:
                            client_id, message = queue.popleft()
                            await self.send_message(client_id, message)
                
                await asyncio.sleep(0.01)  # 10ms processing interval
                
            except Exception as e:
                logger.error(f"Message queue processing error: {e}")
                await asyncio.sleep(1.0)

    async def _monitor_connection_quality(self):
        """Background task to monitor connection quality"""
        while self.is_running:
            try:
                for connection_id, metrics in self.performance_metrics.items():
                    connection = self.connections.get(connection_id)
                    if not connection:
                        continue
                    
                    # Update connection quality based on metrics
                    quality = self._calculate_connection_quality(metrics)
                    metrics.connection_quality = quality
                    
                    # Handle poor quality connections
                    if quality < 0.3:
                        logger.warning(f"Poor connection quality for {connection_id}: {quality:.2f}")
                        # Consider auto-optimization or reconnection
                        await self.optimize_connection(connection_id)
                
                await asyncio.sleep(5.0)  # Monitor every 5 seconds
                
            except Exception as e:
                logger.error(f"Quality monitoring error: {e}")
                await asyncio.sleep(10.0)

    def _calculate_connection_quality(self, metrics: ConnectionMetrics) -> float:
        """Calculate connection quality score"""
        quality = 1.0
        
        # Factor in latency (target: <100ms)
        if metrics.avg_latency_ms > 100:
            quality -= min(0.5, (metrics.avg_latency_ms - 100) / 1000)
        
        # Factor in packet loss (target: <1%)
        quality -= metrics.packet_loss_rate * 10
        
        # Factor in error rate
        if metrics.messages_sent > 0:
            error_rate = metrics.error_count / metrics.messages_sent
            quality -= error_rate * 0.5
        
        return max(0.0, min(1.0, quality))

    async def _cleanup_connections(self):
        """Background task to cleanup stale connections"""
        while self.is_running:
            try:
                current_time = datetime.now()
                stale_connections = []
                
                for connection_id, metrics in self.performance_metrics.items():
                    # Check for stale connections (no activity for 5 minutes)
                    if (current_time - metrics.last_activity).total_seconds() > 300:
                        stale_connections.append(connection_id)
                
                # Cleanup stale connections
                for connection_id in stale_connections:
                    await self.close_connection(connection_id, "Stale connection cleanup")
                
                await asyncio.sleep(60.0)  # Cleanup every minute
                
            except Exception as e:
                logger.error(f"Connection cleanup error: {e}")
                await asyncio.sleep(60.0)

    async def _cleanup_connection(self, connection_id: str):
        """Cleanup resources for a specific connection"""
        # Remove from tracking
        self.connections.pop(connection_id, None)
        self.performance_metrics.pop(connection_id, None)
        self.rate_limiters.pop(connection_id, None)
        self.flow_controllers.pop(connection_id, None)
        
        # Remove from client connections
        for client_id, connections in self.client_connections.items():
            connections.discard(connection_id)
        
        # Cancel any pending batches
        batch_timer = self.batch_timers.pop(connection_id, None)
        if batch_timer and not batch_timer.done():
            batch_timer.cancel()
        
        self.message_batches.pop(connection_id, None)

    async def _evict_oldest_connection(self):
        """Evict the oldest connection to make space"""
        if not self.performance_metrics:
            return
        
        # Find oldest connection
        oldest_id = min(
            self.performance_metrics.keys(),
            key=lambda cid: self.performance_metrics[cid].connected_at
        )
        
        await self.close_connection(oldest_id, "Evicted for capacity")

    async def cleanup(self):
        """Cleanup WebSocket optimizer resources"""
        self.is_running = False
        
        # Cancel background tasks
        for task in [self.message_processor_task, self.quality_monitor_task, self.cleanup_task]:
            if task and not task.done():
                task.cancel()
        
        # Close all connections
        close_tasks = []
        for connection_id in list(self.connections.keys()):
            task = asyncio.create_task(
                self.close_connection(connection_id, "Optimizer shutdown")
            )
            close_tasks.append(task)
        
        if close_tasks:
            await asyncio.gather(*close_tasks, return_exceptions=True)
        
        # Shutdown thread executor
        self.thread_executor.shutdown(wait=True)
        
        logger.info("WebSocket optimizer cleanup completed")


# Supporting classes

class OptimizedWebSocket:
    """Optimized WebSocket wrapper"""
    
    def __init__(
        self, 
        connection_id: str, 
        client_id: str, 
        websocket: websockets.WebSocketServerProtocol,
        optimizer: WebSocketOptimizer
    ):
        self.connection_id = connection_id
        self.client_id = client_id
        self.websocket = websocket
        self.optimizer = optimizer
        self.enable_aggressive_retry = False

    async def send(self, data: Union[str, bytes]):
        """Send data through WebSocket"""
        await self.websocket.send(data)

    async def receive(self):
        """Receive data from WebSocket"""
        return await self.websocket.recv()

    async def close(self, reason: str = "Normal closure"):
        """Close WebSocket connection"""
        await self.websocket.close()

    async def ping(self):
        """Send ping to check connection"""
        return await self.websocket.ping()


class RateLimiter:
    """Token bucket rate limiter"""
    
    def __init__(self, rate: float, burst: int):
        self.rate = rate
        self.burst = burst
        self.tokens = burst
        self.last_update = time.time()
        self.lock = asyncio.Lock()

    async def allow_request(self) -> bool:
        """Check if request is allowed under rate limit"""
        async with self.lock:
            now = time.time()
            elapsed = now - self.last_update
            
            # Add tokens based on elapsed time
            self.tokens = min(self.burst, self.tokens + elapsed * self.rate)
            self.last_update = now
            
            if self.tokens >= 1:
                self.tokens -= 1
                return True
            
            return False

    def increase_rate(self, factor: float):
        """Temporarily increase rate limit"""
        self.rate *= factor


class FlowController:
    """Flow control for WebSocket connections"""
    
    def __init__(self, max_queue_size: int):
        self.max_queue_size = max_queue_size
        self.current_queue_size = 0
        self.lock = asyncio.Lock()

    def can_send(self) -> bool:
        """Check if sending is allowed"""
        return self.current_queue_size < self.max_queue_size

    async def acquire_send_slot(self):
        """Acquire slot for sending"""
        async with self.lock:
            if self.current_queue_size < self.max_queue_size:
                self.current_queue_size += 1
                return True
            return False

    async def release_send_slot(self):
        """Release sending slot"""
        async with self.lock:
            self.current_queue_size = max(0, self.current_queue_size - 1)


class GlobalWebSocketMetrics:
    """Global WebSocket metrics"""
    
    def __init__(self):
        self.total_connections = 0
        self.active_connections = 0
        self.total_messages_sent = 0
        self.total_messages_received = 0
        self.total_bytes_sent = 0
        self.total_bytes_received = 0
        self.average_latency_ms = 0.0
        self.average_connection_quality = 0.0
        self.error_rate = 0.0
        self.last_updated = datetime.now()

    def update(self, metrics: Dict[str, ConnectionMetrics], connections: Dict[str, Any]):
        """Update global metrics from individual connection metrics"""
        if not metrics:
            return
        
        self.total_connections = len(metrics)
        self.active_connections = len([
            m for m in metrics.values() 
            if m.state == ConnectionState.CONNECTED
        ])
        
        self.total_messages_sent = sum(m.messages_sent for m in metrics.values())
        self.total_messages_received = sum(m.messages_received for m in metrics.values())
        self.total_bytes_sent = sum(m.bytes_sent for m in metrics.values())
        self.total_bytes_received = sum(m.bytes_received for m in metrics.values())
        
        if self.active_connections > 0:
            active_metrics = [
                m for m in metrics.values() 
                if m.state == ConnectionState.CONNECTED
            ]
            
            self.average_latency_ms = statistics.mean(
                m.avg_latency_ms for m in active_metrics
            )
            
            self.average_connection_quality = statistics.mean(
                m.connection_quality for m in active_metrics
            )
            
            total_errors = sum(m.error_count for m in active_metrics)
            total_messages = sum(m.messages_sent for m in active_metrics)
            self.error_rate = total_errors / max(1, total_messages)
        
        self.last_updated = datetime.now()


# Factory function
def create_websocket_optimizer(config: Optional[Dict[str, Any]] = None) -> WebSocketOptimizer:
    """
    Factory function to create WebSocket optimizer
    
    Args:
        config: Optional configuration dictionary
        
    Returns:
        Configured WebSocketOptimizer instance
    """
    if config:
        ws_config = WebSocketConfig(**config)
    else:
        ws_config = WebSocketConfig()
    
    return WebSocketOptimizer(ws_config)


# Example usage
if __name__ == "__main__":
    async def test_websocket_optimizer():
        """Test WebSocket optimizer"""
        optimizer = create_websocket_optimizer()
        
        print("WebSocket Optimizer initialized")
        print(f"Max connections: {optimizer.config.max_total_connections}")
        print(f"Batch size: {optimizer.config.batch_size}")
        print(f"Compression enabled: {optimizer.config.enable_compression}")
        
        # Cleanup
        await optimizer.cleanup()

    # Run test
    asyncio.run(test_websocket_optimizer())