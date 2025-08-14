#!/usr/bin/env python3
"""
WebSocket Manager - Real-time communication for Email Intelligence System
Handles WebSocket connections, message broadcasting, and client management
"""

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Set, Optional, Any, Callable
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
from enum import Enum

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel

# Configure logging
logger = logging.getLogger(__name__)

class MessageType(Enum):
    """WebSocket message types"""
    EMAIL_UPDATE = "email_update"
    ANALYTICS_UPDATE = "analytics_update"
    URGENT_NOTIFICATION = "urgent_notification"
    CONNECTION_ACK = "connection_ack"
    HEARTBEAT = "heartbeat"
    ERROR = "error"
    SUBSCRIPTION_UPDATE = "subscription_update"

@dataclass
class WebSocketMessage:
    """Standard WebSocket message format"""
    event_type: str
    timestamp: datetime
    data: Dict[str, Any]
    metadata: Dict[str, Any]
    sequence_number: Optional[int] = None
    client_id: Optional[str] = None

class SubscriptionManager:
    """Manages client subscriptions to different data streams"""
    
    def __init__(self):
        self.subscriptions: Dict[str, Set[str]] = defaultdict(set)  # topic -> client_ids
        self.client_subscriptions: Dict[str, Set[str]] = defaultdict(set)  # client_id -> topics
    
    def subscribe(self, client_id: str, topic: str):
        """Subscribe client to a topic"""
        self.subscriptions[topic].add(client_id)
        self.client_subscriptions[client_id].add(topic)
        logger.debug(f"Client {client_id} subscribed to {topic}")
    
    def unsubscribe(self, client_id: str, topic: str):
        """Unsubscribe client from a topic"""
        self.subscriptions[topic].discard(client_id)
        self.client_subscriptions[client_id].discard(topic)
        logger.debug(f"Client {client_id} unsubscribed from {topic}")
    
    def unsubscribe_all(self, client_id: str):
        """Unsubscribe client from all topics"""
        for topic in list(self.client_subscriptions[client_id]):
            self.unsubscribe(client_id, topic)
    
    def get_subscribers(self, topic: str) -> Set[str]:
        """Get all clients subscribed to a topic"""
        return self.subscriptions.get(topic, set())
    
    def get_subscriptions(self, client_id: str) -> Set[str]:
        """Get all topics a client is subscribed to"""
        return self.client_subscriptions.get(client_id, set())

@dataclass
class ClientConnection:
    """Client connection information"""
    client_id: str
    websocket: WebSocket
    connected_at: datetime
    last_heartbeat: datetime
    subscriptions: Set[str]
    message_queue: deque
    sequence_number: int = 0
    
    def get_next_sequence(self) -> int:
        """Get next sequence number for messages"""
        self.sequence_number += 1
        return self.sequence_number

class RateLimiter:
    """Simple rate limiter for WebSocket connections"""
    
    def __init__(self, max_messages: int = 100, window_seconds: int = 60):
        self.max_messages = max_messages
        self.window_seconds = window_seconds
        self.client_windows: Dict[str, deque] = defaultdict(deque)
    
    def is_allowed(self, client_id: str) -> bool:
        """Check if client is within rate limits"""
        now = time.time()
        window = self.client_windows[client_id]
        
        # Remove old messages outside the window
        while window and window[0] < now - self.window_seconds:
            window.popleft()
        
        # Check if under limit
        if len(window) >= self.max_messages:
            return False
        
        # Add current message
        window.append(now)
        return True

class WebSocketManager:
    """
    Manages WebSocket connections and real-time message broadcasting
    Handles multiple clients, subscriptions, and message queuing
    """
    
    def __init__(self, max_clients: int = 100):
        self.max_clients = max_clients
        self.connections: Dict[str, ClientConnection] = {}
        self.subscription_manager = SubscriptionManager()
        self.rate_limiter = RateLimiter()
        self.message_buffer: Dict[str, deque] = defaultdict(lambda: deque(maxlen=100))
        
        # Statistics
        self.stats = {
            'total_connections': 0,
            'current_connections': 0,
            'messages_sent': 0,
            'messages_received': 0,
            'errors': 0
        }
        
        # Background tasks
        self._cleanup_task = None
        self._heartbeat_task = None
    
    async def connect_client(self, websocket: WebSocket, client_id: str = None) -> str:
        """Connect a new WebSocket client"""
        if len(self.connections) >= self.max_clients:
            await websocket.close(code=1013, reason="Too many connections")
            raise Exception("Maximum client limit reached")
        
        # Generate client ID if not provided
        if not client_id:
            client_id = str(uuid.uuid4())
        
        # Accept WebSocket connection
        await websocket.accept()
        
        # Create client connection
        connection = ClientConnection(
            client_id=client_id,
            websocket=websocket,
            connected_at=datetime.now(),
            last_heartbeat=datetime.now(),
            subscriptions=set(),
            message_queue=deque(maxlen=50)
        )
        
        self.connections[client_id] = connection
        self.stats['total_connections'] += 1
        self.stats['current_connections'] += 1
        
        # Send connection acknowledgment
        await self._send_to_client(client_id, WebSocketMessage(
            event_type=MessageType.CONNECTION_ACK.value,
            timestamp=datetime.now(),
            data={"client_id": client_id, "status": "connected"},
            metadata={"server_time": datetime.now().isoformat()}
        ))
        
        logger.info(f"Client {client_id} connected")
        return client_id
    
    async def disconnect_client(self, client_id: str):
        """Disconnect a WebSocket client"""
        if client_id in self.connections:
            connection = self.connections[client_id]
            
            # Unsubscribe from all topics
            self.subscription_manager.unsubscribe_all(client_id)
            
            # Close WebSocket if still open
            try:
                await connection.websocket.close()
            except Exception:
                pass  # Already closed
            
            # Remove connection
            del self.connections[client_id]
            self.stats['current_connections'] -= 1
            
            logger.info(f"Client {client_id} disconnected")
    
    async def handle_client_message(self, client_id: str, message: Dict[str, Any]):
        """Handle incoming message from client"""
        try:
            # Rate limiting
            if not self.rate_limiter.is_allowed(client_id):
                await self._send_error(client_id, "Rate limit exceeded")
                return
            
            self.stats['messages_received'] += 1
            
            # Update heartbeat
            if client_id in self.connections:
                self.connections[client_id].last_heartbeat = datetime.now()
            
            # Handle different message types
            msg_type = message.get('type')
            data = message.get('data', {})
            
            if msg_type == 'subscribe':
                await self._handle_subscription(client_id, data)
            elif msg_type == 'unsubscribe':
                await self._handle_unsubscription(client_id, data)
            elif msg_type == 'heartbeat':
                await self._handle_heartbeat(client_id)
            elif msg_type == 'get_history':
                await self._handle_history_request(client_id, data)
            else:
                await self._send_error(client_id, f"Unknown message type: {msg_type}")
                
        except Exception as e:
            logger.error(f"Error handling client message: {e}")
            await self._send_error(client_id, "Internal server error")
            self.stats['errors'] += 1
    
    async def _handle_subscription(self, client_id: str, data: Dict[str, Any]):
        """Handle subscription request"""
        topic = data.get('topic')
        if not topic:
            await self._send_error(client_id, "Topic required for subscription")
            return
        
        valid_topics = ['emails', 'analytics', 'notifications', 'urgent', 'stats', 'monitoring']
        if topic not in valid_topics:
            await self._send_error(client_id, f"Invalid topic: {topic}. Valid topics: {valid_topics}")
            return
        
        self.subscription_manager.subscribe(client_id, topic)
        
        if client_id in self.connections:
            self.connections[client_id].subscriptions.add(topic)
        
        await self._send_to_client(client_id, WebSocketMessage(
            event_type=MessageType.SUBSCRIPTION_UPDATE.value,
            timestamp=datetime.now(),
            data={"action": "subscribed", "topic": topic, "available_topics": valid_topics},
            metadata={"subscription_count": len(self.connections[client_id].subscriptions) if client_id in self.connections else 0}
        ))
        
        # Send recent buffered messages for this topic
        await self._send_buffered_messages(client_id, topic)
        
        # Send welcome message with current stats for analytics subscriptions
        if topic == 'analytics':
            await self._send_welcome_analytics(client_id)
    
    async def _handle_unsubscription(self, client_id: str, data: Dict[str, Any]):
        """Handle unsubscription request"""
        topic = data.get('topic')
        if not topic:
            await self._send_error(client_id, "Topic required for unsubscription")
            return
        
        self.subscription_manager.unsubscribe(client_id, topic)
        
        if client_id in self.connections:
            self.connections[client_id].subscriptions.discard(topic)
        
        await self._send_to_client(client_id, WebSocketMessage(
            event_type=MessageType.SUBSCRIPTION_UPDATE.value,
            timestamp=datetime.now(),
            data={"action": "unsubscribed", "topic": topic},
            metadata={}
        ))
    
    async def _handle_heartbeat(self, client_id: str):
        """Handle heartbeat message"""
        await self._send_to_client(client_id, WebSocketMessage(
            event_type=MessageType.HEARTBEAT.value,
            timestamp=datetime.now(),
            data={"status": "alive"},
            metadata={}
        ))
    
    async def _handle_history_request(self, client_id: str, data: Dict[str, Any]):
        """Handle request for message history"""
        topic = data.get('topic')
        limit = min(data.get('limit', 10), 50)  # Cap at 50 messages
        
        if topic and topic in self.message_buffer:
            # Get recent messages for topic
            recent_messages = list(self.message_buffer[topic])[-limit:]
            
            for msg in recent_messages:
                await self._send_to_client(client_id, msg)
    
    async def broadcast_to_topic(self, topic: str, message: WebSocketMessage):
        """Broadcast message to all clients subscribed to a topic"""
        subscribers = self.subscription_manager.get_subscribers(topic)
        
        if subscribers:
            # Buffer message for late-joining clients
            self.message_buffer[topic].append(message)
            
            # Send to all subscribers
            tasks = []
            for client_id in subscribers:
                if client_id in self.connections:
                    tasks.append(self._send_to_client(client_id, message))
            
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
                logger.debug(f"Broadcasted message to {len(tasks)} clients on topic '{topic}'")
    
    async def broadcast_urgent_notification(self, notification: Dict[str, Any]):
        """Broadcast urgent notification to all connected clients"""
        message = WebSocketMessage(
            event_type=MessageType.URGENT_NOTIFICATION.value,
            timestamp=datetime.now(),
            data=notification,
            metadata={"priority": "urgent", "source": "email_monitor"}
        )
        
        # Send to all connected clients regardless of subscription
        tasks = []
        for client_id in self.connections:
            tasks.append(self._send_to_client(client_id, message))
        
        # Also add to urgent topic for subscribers
        await self.broadcast_to_topic('urgent', message)
        
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
            logger.info(f"Sent urgent notification to {len(tasks)} clients")
    
    async def _send_to_client(self, client_id: str, message: WebSocketMessage):
        """Send message to specific client"""
        if client_id not in self.connections:
            return
        
        connection = self.connections[client_id]
        message.client_id = client_id
        message.sequence_number = connection.get_next_sequence()
        
        try:
            # Convert message to JSON
            message_dict = {
                "event_type": message.event_type,
                "timestamp": message.timestamp.isoformat(),
                "data": message.data,
                "metadata": message.metadata,
                "sequence_number": message.sequence_number,
                "client_id": message.client_id
            }
            
            await connection.websocket.send_text(json.dumps(message_dict))
            self.stats['messages_sent'] += 1
            
        except WebSocketDisconnect:
            # Client disconnected, clean up
            await self.disconnect_client(client_id)
        except Exception as e:
            logger.error(f"Error sending message to client {client_id}: {e}")
            await self.disconnect_client(client_id)
            self.stats['errors'] += 1
    
    async def _send_error(self, client_id: str, error_message: str):
        """Send error message to client"""
        error_msg = WebSocketMessage(
            event_type=MessageType.ERROR.value,
            timestamp=datetime.now(),
            data={"error": error_message},
            metadata={}
        )
        await self._send_to_client(client_id, error_msg)
    
    async def _send_buffered_messages(self, client_id: str, topic: str):
        """Send recent buffered messages for a topic to a client"""
        if topic in self.message_buffer:
            # Send last 10 messages
            recent_messages = list(self.message_buffer[topic])[-10:]
            for message in recent_messages:
                await self._send_to_client(client_id, message)
    
    async def _send_welcome_analytics(self, client_id: str):
        """Send welcome analytics data to new subscriber"""
        welcome_message = WebSocketMessage(
            event_type=MessageType.ANALYTICS_UPDATE.value,
            timestamp=datetime.now(),
            data={
                'type': 'welcome',
                'message': 'Connected to real-time email analytics',
                'features': [
                    'Real-time email processing statistics',
                    'Live performance metrics',
                    'System health monitoring',
                    'Queue status updates'
                ]
            },
            metadata={'welcome': True, 'client_id': client_id}
        )
        await self._send_to_client(client_id, welcome_message)
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get comprehensive connection statistics"""
        return {
            **self.stats,
            'subscription_stats': {
                topic: len(subscribers) for topic, subscribers in self.subscription_manager.subscriptions.items()
            },
            'buffer_stats': {
                topic: len(buffer) for topic, buffer in self.message_buffer.items()
            },
            'client_details': [
                {
                    'client_id': client_id,
                    'connected_at': conn.connected_at.isoformat(),
                    'last_heartbeat': conn.last_heartbeat.isoformat(),
                    'subscriptions': list(conn.subscriptions),
                    'sequence_number': conn.sequence_number,
                    'connection_duration_seconds': (datetime.now() - conn.connected_at).total_seconds()
                }
                for client_id, conn in self.connections.items()
            ]
        }
    
    async def broadcast_system_stats(self, stats: Dict[str, Any]):
        """Broadcast system statistics to monitoring subscribers"""
        message = WebSocketMessage(
            event_type=MessageType.ANALYTICS_UPDATE.value,
            timestamp=datetime.now(),
            data={
                'type': 'system_stats',
                'stats': stats,
                'websocket_stats': self.get_connection_stats()
            },
            metadata={'periodic_update': True}
        )
        
        await self.broadcast_to_topic('monitoring', message)
    
    async def send_email_batch_update(self, batch_info: Dict[str, Any]):
        """Send email batch processing update"""
        message = WebSocketMessage(
            event_type=MessageType.EMAIL_UPDATE.value,
            timestamp=datetime.now(),
            data={
                'type': 'batch_processed',
                'batch_info': batch_info
            },
            metadata={'batch_processing': True}
        )
        
        await self.broadcast_to_topic('emails', message)
    
    async def start_background_tasks(self):
        """Start background maintenance tasks"""
        self._cleanup_task = asyncio.create_task(self._cleanup_stale_connections())
        self._heartbeat_task = asyncio.create_task(self._send_periodic_heartbeats())
    
    async def stop_background_tasks(self):
        """Stop background maintenance tasks"""
        if self._cleanup_task:
            self._cleanup_task.cancel()
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
    
    async def _cleanup_stale_connections(self):
        """Clean up stale connections periodically"""
        while True:
            try:
                now = datetime.now()
                stale_threshold = timedelta(minutes=5)
                
                stale_clients = [
                    client_id for client_id, conn in self.connections.items()
                    if now - conn.last_heartbeat > stale_threshold
                ]
                
                for client_id in stale_clients:
                    logger.info(f"Cleaning up stale connection: {client_id}")
                    await self.disconnect_client(client_id)
                
                await asyncio.sleep(60)  # Check every minute
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in connection cleanup: {e}")
                await asyncio.sleep(60)
    
    async def _send_periodic_heartbeats(self):
        """Send periodic heartbeat to all clients"""
        while True:
            try:
                heartbeat_msg = WebSocketMessage(
                    event_type=MessageType.HEARTBEAT.value,
                    timestamp=datetime.now(),
                    data={"status": "alive", "server_time": datetime.now().isoformat()},
                    metadata={}
                )
                
                tasks = []
                for client_id in list(self.connections.keys()):
                    tasks.append(self._send_to_client(client_id, heartbeat_msg))
                
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                
                await asyncio.sleep(30)  # Send heartbeat every 30 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in heartbeat task: {e}")
                await asyncio.sleep(30)

# Factory function for easy integration
def create_websocket_manager(max_clients: int = 100) -> WebSocketManager:
    """Create and return a WebSocket manager instance"""
    return WebSocketManager(max_clients)

def create_websocket_manager_with_email_integration(max_clients: int = 100) -> WebSocketManager:
    """Create WebSocket manager optimized for email intelligence integration"""
    manager = WebSocketManager(max_clients)
    
    # Pre-configure message buffers for email topics
    manager.message_buffer['emails'] = deque(maxlen=50)  # Larger buffer for emails
    manager.message_buffer['urgent'] = deque(maxlen=25)  # Urgent notifications
    manager.message_buffer['analytics'] = deque(maxlen=30)  # Analytics data
    manager.message_buffer['monitoring'] = deque(maxlen=20)  # System monitoring
    
    logger.info("WebSocket manager configured for email intelligence integration")
    return manager

# Example usage and testing
async def main():
    """Example usage of WebSocket manager with email integration"""
    manager = create_websocket_manager_with_email_integration()
    
    # Start background tasks
    await manager.start_background_tasks()
    
    try:
        print("🚀 WebSocket manager started with email intelligence integration")
        print("📡 Available topics: emails, analytics, notifications, urgent, stats, monitoring")
        print("🔗 WebSocket endpoint: ws://localhost:8000/ws")
        
        # Simulate some activity
        await asyncio.sleep(1)
        
        # Broadcast test email update
        test_email_message = WebSocketMessage(
            event_type=MessageType.EMAIL_UPDATE.value,
            timestamp=datetime.now(),
            data={
                "email_id": "test_123",
                "subject": "Test Email Subject",
                "sender": "test@example.com",
                "classification": "NEEDS_REPLY",
                "urgency_level": 3
            },
            metadata={"test": True}
        )
        
        await manager.broadcast_to_topic("emails", test_email_message)
        
        # Broadcast test urgent notification
        urgent_notification = {
            "email_id": "urgent_456",
            "subject": "URGENT: Action Required",
            "sender": "important@example.com",
            "urgency_level": 5,
            "action_required": True
        }
        
        await manager.broadcast_urgent_notification(urgent_notification)
        
        print("📨 Test messages broadcasted")
        print("🏃 WebSocket manager running... Press Ctrl+C to stop")
        
        # Keep running and show periodic stats
        while True:
            await asyncio.sleep(30)
            stats = manager.get_connection_stats()
            print(f"📊 Active connections: {stats['current_connections']}, "
                  f"Total messages sent: {stats['messages_sent']}")
        
    except KeyboardInterrupt:
        print("\n🛑 Stopping WebSocket manager...")
    finally:
        await manager.stop_background_tasks()
        print("✅ WebSocket manager stopped")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='WebSocket Manager for Email Intelligence')
    parser.add_argument('--max-clients', type=int, default=100, help='Maximum WebSocket clients')
    parser.add_argument('--test-mode', action='store_true', help='Run in test mode with sample data')
    
    args = parser.parse_args()
    
    if args.test_mode:
        asyncio.run(main())
    else:
        print("WebSocket manager ready for integration. Use create_websocket_manager_with_email_integration() in your application.")