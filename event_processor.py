#!/usr/bin/env python3
"""
Event Processor - Asynchronous event processing pipeline for Email Intelligence System
Handles queued processing of email events with retry logic and dead letter queues
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, asdict
from collections import deque, defaultdict
from enum import Enum
import uuid

# Configure logging
logger = logging.getLogger(__name__)

class EventType(Enum):
    """Event types for processing"""
    NEW_EMAIL = "new_email"
    EMAIL_PROCESSED = "email_processed"
    URGENT_NOTIFICATION = "urgent_notification"
    ANALYTICS_UPDATE = "analytics_update"
    BATCH_COMPLETE = "batch_complete"
    SYSTEM_ALERT = "system_alert"

class Priority(Enum):
    """Event priority levels"""
    CRITICAL = 1  # Process immediately
    HIGH = 2      # Process within 5 seconds
    NORMAL = 3    # Process within 30 seconds
    LOW = 4       # Process when convenient

@dataclass
class Event:
    """Base event structure"""
    id: str
    event_type: EventType
    priority: Priority
    created_at: datetime
    data: Dict[str, Any]
    metadata: Dict[str, Any]
    retry_count: int = 0
    max_retries: int = 3
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None

class EventQueue:
    """Priority-based event queue with retry mechanism"""
    
    def __init__(self, max_size: int = 10000):
        self.max_size = max_size
        self.queues: Dict[Priority, deque] = {
            Priority.CRITICAL: deque(),
            Priority.HIGH: deque(),
            Priority.NORMAL: deque(),
            Priority.LOW: deque()
        }
        self.processing: Dict[str, Event] = {}  # Events currently being processed
        self.dead_letters: deque = deque(maxlen=1000)  # Failed events
        self.stats = {
            'total_enqueued': 0,
            'total_processed': 0,
            'total_failed': 0,
            'current_size': 0,
            'processing_count': 0
        }
    
    def enqueue(self, event: Event) -> bool:
        """Add event to appropriate priority queue"""
        if self.stats['current_size'] >= self.max_size:
            logger.warning("Event queue is full, dropping event")
            return False
        
        self.queues[event.priority].append(event)
        self.stats['total_enqueued'] += 1
        self.stats['current_size'] += 1
        
        logger.debug(f"Enqueued {event.event_type.value} event with priority {event.priority.name}")
        return True
    
    def dequeue(self) -> Optional[Event]:
        """Get next event based on priority"""
        # Check priority queues in order
        for priority in Priority:
            if self.queues[priority]:
                event = self.queues[priority].popleft()
                self.processing[event.id] = event
                self.stats['current_size'] -= 1
                self.stats['processing_count'] += 1
                return event
        return None
    
    def mark_completed(self, event_id: str):
        """Mark event as successfully processed"""
        if event_id in self.processing:
            event = self.processing.pop(event_id)
            event.processed_at = datetime.now()
            self.stats['total_processed'] += 1
            self.stats['processing_count'] -= 1
            logger.debug(f"Event {event_id} completed successfully")
    
    def mark_failed(self, event_id: str, error_message: str) -> bool:
        """Mark event as failed and handle retry logic"""
        if event_id not in self.processing:
            return False
        
        event = self.processing[event_id]
        event.retry_count += 1
        event.error_message = error_message
        
        if event.retry_count <= event.max_retries:
            # Re-queue for retry
            logger.warning(f"Event {event_id} failed, retrying ({event.retry_count}/{event.max_retries})")
            del self.processing[event_id]
            self.stats['processing_count'] -= 1
            
            # Add delay before retry based on attempt count
            retry_delay = min(2 ** event.retry_count, 60)  # Exponential backoff, max 60 seconds
            event.metadata['retry_delay'] = retry_delay
            
            return self.enqueue(event)
        else:
            # Move to dead letter queue
            logger.error(f"Event {event_id} failed permanently after {event.retry_count} attempts")
            del self.processing[event_id]
            self.dead_letters.append(event)
            self.stats['total_failed'] += 1
            self.stats['processing_count'] -= 1
            return False
    
    def get_size(self) -> int:
        """Get total queue size"""
        return self.stats['current_size']
    
    def get_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        queue_sizes = {priority.name: len(queue) for priority, queue in self.queues.items()}
        return {
            **self.stats,
            'queue_sizes': queue_sizes,
            'dead_letter_count': len(self.dead_letters)
        }

class EventProcessor:
    """
    Main event processing engine with worker pools and handlers
    Processes events asynchronously with configurable concurrency
    """
    
    def __init__(self, max_workers: int = 10):
        self.max_workers = max_workers
        self.queue = EventQueue()
        self.handlers: Dict[EventType, Callable] = {}
        self.workers: List[asyncio.Task] = []
        self.is_running = False
        
        # Processing statistics
        self.stats = {
            'workers_active': 0,
            'events_per_second': 0,
            'avg_processing_time_ms': 0,
            'last_processing_times': deque(maxlen=100)
        }
        
        # Rate limiting
        self.rate_limiter = defaultdict(lambda: deque(maxlen=100))
    
    def register_handler(self, event_type: EventType, handler: Callable):
        """Register an event handler function"""
        self.handlers[event_type] = handler
        logger.info(f"Registered handler for {event_type.value}")
    
    async def start(self):
        """Start the event processing workers"""
        if self.is_running:
            logger.warning("Event processor is already running")
            return
        
        self.is_running = True
        logger.info(f"Starting event processor with {self.max_workers} workers")
        
        # Create worker tasks
        for i in range(self.max_workers):
            worker = asyncio.create_task(self._worker(f"worker-{i}"))
            self.workers.append(worker)
        
        # Start monitoring task
        asyncio.create_task(self._monitor_performance())
    
    async def stop(self):
        """Stop the event processor"""
        if not self.is_running:
            return
        
        self.is_running = False
        logger.info("Stopping event processor")
        
        # Cancel all workers
        for worker in self.workers:
            worker.cancel()
        
        # Wait for workers to finish
        await asyncio.gather(*self.workers, return_exceptions=True)
        self.workers.clear()
        
        logger.info("Event processor stopped")
    
    async def submit_event(self, event_type: EventType, data: Dict[str, Any], 
                          priority: Priority = Priority.NORMAL, 
                          metadata: Optional[Dict[str, Any]] = None) -> str:
        """Submit an event for processing"""
        event_id = str(uuid.uuid4())
        
        event = Event(
            id=event_id,
            event_type=event_type,
            priority=priority,
            created_at=datetime.now(),
            data=data,
            metadata=metadata or {}
        )
        
        if self.queue.enqueue(event):
            logger.debug(f"Submitted event {event_id} for processing")
            return event_id
        else:
            logger.error(f"Failed to enqueue event {event_id}")
            raise Exception("Event queue is full")
    
    async def submit_email_event(self, email_data: Dict[str, Any], 
                                intelligence_data: Optional[Dict[str, Any]] = None) -> str:
        """Convenience method for submitting email events"""
        # Determine priority based on email urgency
        priority = Priority.NORMAL
        if intelligence_data:
            urgency = intelligence_data.get('nano_classification', {}).get('urgency', {})
            if isinstance(urgency, dict):
                urgency_value = urgency.get('value', 1)
            else:
                urgency_value = 1
            
            if urgency_value >= 5:
                priority = Priority.CRITICAL
            elif urgency_value >= 4:
                priority = Priority.HIGH
        
        return await self.submit_event(
            EventType.NEW_EMAIL,
            {
                'email': email_data,
                'intelligence': intelligence_data
            },
            priority,
            {
                'source': 'email_monitor',
                'urgency_level': intelligence_data.get('nano_classification', {}).get('urgency', {}).get('value', 1) if intelligence_data else 1
            }
        )
    
    async def _worker(self, worker_name: str):
        """Worker coroutine that processes events"""
        logger.info(f"Worker {worker_name} started")
        self.stats['workers_active'] += 1
        
        try:
            while self.is_running:
                # Get next event
                event = self.queue.dequeue()
                
                if event is None:
                    # No events to process, wait a bit
                    await asyncio.sleep(0.1)
                    continue
                
                # Handle retry delay
                if 'retry_delay' in event.metadata:
                    await asyncio.sleep(event.metadata['retry_delay'])
                    del event.metadata['retry_delay']
                
                # Process the event
                start_time = time.time()
                success = await self._process_event(event, worker_name)
                processing_time = (time.time() - start_time) * 1000
                
                # Update statistics
                self.stats['last_processing_times'].append(processing_time)
                
                if success:
                    self.queue.mark_completed(event.id)
                else:
                    self.queue.mark_failed(event.id, "Processing failed")
                
        except asyncio.CancelledError:
            logger.info(f"Worker {worker_name} cancelled")
        except Exception as e:
            logger.error(f"Worker {worker_name} error: {e}")
        finally:
            self.stats['workers_active'] -= 1
            logger.info(f"Worker {worker_name} stopped")
    
    async def _process_event(self, event: Event, worker_name: str) -> bool:
        """Process a single event"""
        try:
            logger.debug(f"Worker {worker_name} processing event {event.id} ({event.event_type.value})")
            
            # Check if handler is registered
            if event.event_type not in self.handlers:
                logger.warning(f"No handler registered for event type {event.event_type.value}")
                return False
            
            # Call the handler
            handler = self.handlers[event.event_type]
            
            # Handle both sync and async handlers
            if asyncio.iscoroutinefunction(handler):
                result = await handler(event)
            else:
                result = handler(event)
            
            # Handler should return True for success, False for failure
            return result if isinstance(result, bool) else True
            
        except Exception as e:
            logger.error(f"Error processing event {event.id}: {e}")
            return False
    
    async def _monitor_performance(self):
        """Monitor processing performance and update statistics"""
        last_processed = self.queue.stats['total_processed']
        last_time = time.time()
        
        while self.is_running:
            try:
                await asyncio.sleep(10)  # Update every 10 seconds
                
                current_time = time.time()
                current_processed = self.queue.stats['total_processed']
                
                # Calculate events per second
                time_diff = current_time - last_time
                events_diff = current_processed - last_processed
                
                if time_diff > 0:
                    self.stats['events_per_second'] = events_diff / time_diff
                
                # Calculate average processing time
                if self.stats['last_processing_times']:
                    self.stats['avg_processing_time_ms'] = sum(self.stats['last_processing_times']) / len(self.stats['last_processing_times'])
                
                last_processed = current_processed
                last_time = current_time
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in performance monitoring: {e}")
    
    def get_comprehensive_stats(self) -> Dict[str, Any]:
        """Get comprehensive processing statistics"""
        return {
            'processor': self.stats,
            'queue': self.queue.get_stats(),
            'handlers': list(self.handlers.keys()),
            'is_running': self.is_running
        }

# Default event handlers
async def default_email_handler(event: Event) -> bool:
    """Default handler for email events"""
    try:
        email_data = event.data.get('email', {})
        intelligence_data = event.data.get('intelligence', {})
        
        logger.info(f"Processing email: {email_data.get('subject_text', 'No Subject')}")
        
        # Here you would integrate with other systems:
        # - Update database
        # - Send notifications
        # - Trigger workflows
        # - Update analytics
        
        # Simulate processing time
        await asyncio.sleep(0.1)
        
        return True
    except Exception as e:
        logger.error(f"Error in email handler: {e}")
        return False

async def default_analytics_handler(event: Event) -> bool:
    """Default handler for analytics events"""
    try:
        analytics_data = event.data
        logger.debug(f"Processing analytics update: {analytics_data}")
        
        # Update analytics database/cache
        # Trigger dashboard updates
        # Calculate real-time metrics
        
        return True
    except Exception as e:
        logger.error(f"Error in analytics handler: {e}")
        return False

async def default_urgent_handler(event: Event) -> bool:
    """Default handler for urgent notifications"""
    try:
        notification_data = event.data
        logger.warning(f"URGENT: {notification_data}")
        
        # Send immediate notifications
        # Alert relevant users
        # Escalate if needed
        
        return True
    except Exception as e:
        logger.error(f"Error in urgent handler: {e}")
        return False

# Factory function for easy setup
def create_event_processor(max_workers: int = 10, register_defaults: bool = True) -> EventProcessor:
    """Create and configure an event processor"""
    processor = EventProcessor(max_workers)
    
    if register_defaults:
        processor.register_handler(EventType.NEW_EMAIL, default_email_handler)
        processor.register_handler(EventType.ANALYTICS_UPDATE, default_analytics_handler)
        processor.register_handler(EventType.URGENT_NOTIFICATION, default_urgent_handler)
    
    return processor

# Example usage
async def main():
    """Example usage of the event processor"""
    processor = create_event_processor()
    
    try:
        # Start processing
        await processor.start()
        
        # Submit some test events
        await processor.submit_event(
            EventType.NEW_EMAIL,
            {"test": "data"},
            Priority.HIGH
        )
        
        await processor.submit_event(
            EventType.ANALYTICS_UPDATE,
            {"metric": "email_count", "value": 100},
            Priority.NORMAL
        )
        
        # Let it process for a while
        await asyncio.sleep(5)
        
        # Get statistics
        stats = processor.get_comprehensive_stats()
        print(f"Processing stats: {json.dumps(stats, indent=2, default=str)}")
        
    except KeyboardInterrupt:
        print("Stopping processor...")
    finally:
        await processor.stop()

if __name__ == "__main__":
    asyncio.run(main())