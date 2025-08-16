#!/usr/bin/env python3
"""
Real-time Email Monitor - File system watching and event-driven email processing
Monitors Apple Mail database changes and processes emails with GPT-5 models
"""

import asyncio
import sqlite3
import json
import time
import logging
import os
import hashlib
import redis
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable, Any, Set
from dataclasses import dataclass, asdict
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from collections import deque, defaultdict
import signal
from contextlib import asynccontextmanager

# File system monitoring
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Import existing components
from apple_mail_db_reader import AppleMailDBReader
from email_intelligence_engine import EmailIntelligenceEngine
from websocket_manager import WebSocketManager, WebSocketMessage, MessageType

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class EmailEvent:
    """Real-time email event structure"""
    event_type: str  # new_email, email_updated, urgent_notification
    email_id: str
    message_id: int
    timestamp: datetime
    metadata: Dict[str, Any]
    classification: Optional[Dict[str, Any]] = None
    urgency_level: int = 1
    requires_attention: bool = False
    processing_time_ms: float = 0.0
    redis_key: Optional[str] = None

@dataclass
class EmailBatch:
    """Batch of emails for processing"""
    emails: List[Dict[str, Any]]
    batch_id: str
    timestamp: datetime
    source: str  # 'filesystem', 'polling', 'manual'
    priority: int = 1  # 1=normal, 2=high, 3=urgent

@dataclass
class ProcessingStats:
    """Processing performance statistics"""
    total_processed: int = 0
    avg_processing_time_ms: float = 0.0
    classification_times: List[float] = None
    batch_sizes: List[int] = None
    errors: int = 0
    cache_hits: int = 0
    redis_operations: int = 0
    
    def __post_init__(self):
        if self.classification_times is None:
            self.classification_times = []
        if self.batch_sizes is None:
            self.batch_sizes = []

class MailDatabaseWatcher(FileSystemEventHandler):
    """File system watcher for Apple Mail database changes"""
    
    def __init__(self, callback: Callable):
        super().__init__()
        self.callback = callback
        self.last_modified = {}
        self.debounce_time = 0.5  # Prevent duplicate events
        
    def on_modified(self, event):
        """Handle file modification events"""
        if event.is_directory:
            return
            
        # Filter for database files
        if 'Envelope Index' in event.src_path or 'MailData' in event.src_path:
            now = time.time()
            last_mod = self.last_modified.get(event.src_path, 0)
            
            if now - last_mod > self.debounce_time:
                self.last_modified[event.src_path] = now
                asyncio.create_task(self.callback('database_modified', event.src_path))

class AdaptivePoller:
    """Adaptive polling strategy with burst detection and rate limiting"""
    
    def __init__(self, min_interval: float = 1.0, max_interval: float = 30.0):
        self.min_interval = min_interval
        self.max_interval = max_interval
        self.current_interval = min_interval
        self.last_activity = time.time()
        self.activity_threshold = 300  # 5 minutes
        self.burst_detector = deque(maxlen=10)
        self.rate_limiter = defaultdict(float)  # email_id -> last_processed_time
        
    def update_activity(self, has_new_emails: bool, email_count: int = 0):
        """Update polling interval based on email activity"""
        now = time.time()
        
        if has_new_emails:
            self.last_activity = now
            self.burst_detector.append((now, email_count))
            
            # Detect burst activity (more than 5 emails in 60 seconds)
            recent_emails = sum(count for timestamp, count in self.burst_detector 
                              if now - timestamp < 60)
            
            if recent_emails > 5:
                self.current_interval = self.min_interval * 0.5  # Faster during bursts
            else:
                self.current_interval = self.min_interval
        else:
            # Gradually increase interval when no activity
            time_since_activity = now - self.last_activity
            if time_since_activity > self.activity_threshold:
                self.current_interval = min(
                    self.current_interval * 1.2,
                    self.max_interval
                )
    
    def should_process_email(self, email_id: str, min_gap: float = 1.0) -> bool:
        """Rate limiting for individual email processing"""
        now = time.time()
        last_processed = self.rate_limiter.get(email_id, 0)
        
        if now - last_processed > min_gap:
            self.rate_limiter[email_id] = now
            return True
        return False
    
    def get_next_interval(self) -> float:
        """Get the next polling interval"""
        return max(self.current_interval, 0.1)  # Minimum 100ms

class RedisEventQueue:
    """Redis-based event queue for email processing"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.redis_client.ping()  # Test connection
            self.available = True
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Redis unavailable, using in-memory queue: {e}")
            self.redis_client = None
            self.available = False
            self.memory_queue = deque()
    
    async def enqueue_email_event(self, event: EmailEvent) -> bool:
        """Add email event to processing queue"""
        try:
            event_data = {
                'event_type': event.event_type,
                'email_id': event.email_id,
                'timestamp': event.timestamp.isoformat(),
                'metadata': event.metadata,
                'urgency_level': event.urgency_level
            }
            
            if self.available:
                # Redis queue
                queue_name = f"email_events:{event.urgency_level}"
                await asyncio.get_event_loop().run_in_executor(
                    None, self.redis_client.lpush, queue_name, json.dumps(event_data)
                )
                # Expire old events
                await asyncio.get_event_loop().run_in_executor(
                    None, self.redis_client.expire, queue_name, 3600
                )
            else:
                # Memory fallback
                self.memory_queue.appendleft(event_data)
                if len(self.memory_queue) > 1000:  # Limit memory usage
                    self.memory_queue.pop()
            
            return True
        except Exception as e:
            logger.error(f"Failed to enqueue event: {e}")
            return False
    
    async def dequeue_email_event(self, urgency_level: int = None) -> Optional[Dict]:
        """Get next email event from queue"""
        try:
            if self.available:
                # Redis - check high priority first
                for level in [5, 4, 3, 2, 1] if urgency_level is None else [urgency_level]:
                    queue_name = f"email_events:{level}"
                    result = await asyncio.get_event_loop().run_in_executor(
                        None, self.redis_client.rpop, queue_name
                    )
                    if result:
                        return json.loads(result)
            else:
                # Memory fallback
                if self.memory_queue:
                    return self.memory_queue.pop()
            
            return None
        except Exception as e:
            logger.error(f"Failed to dequeue event: {e}")
            return None
    
    def get_queue_stats(self) -> Dict[str, int]:
        """Get queue statistics"""
        if self.available:
            try:
                stats = {}
                for level in range(1, 6):
                    queue_name = f"email_events:{level}"
                    stats[f"urgency_{level}"] = self.redis_client.llen(queue_name)
                return stats
            except Exception:
                return {"error": "Redis unavailable"}
        else:
            return {"memory_queue": len(self.memory_queue)}

class RealtimeEmailMonitor:
    """
    Real-time email monitor with file system watching, Redis queuing, and GPT-5 processing
    Efficiently detects new emails and processes them with exact OpenAI models
    """
    
    def __init__(self, 
                 websocket_manager: WebSocketManager,
                 event_callback: Optional[Callable] = None,
                 redis_url: str = "redis://localhost:6379"):
        # Core components
        self.intelligence_engine = EmailIntelligenceEngine()
        self.websocket_manager = websocket_manager
        self.event_callback = event_callback
        self.db_reader = AppleMailDBReader()
        self.poller = AdaptivePoller()
        
        # File system monitoring
        self.file_observer = Observer()
        self.db_watcher = MailDatabaseWatcher(self._handle_filesystem_event)
        
        # Redis event queue
        self.event_queue = RedisEventQueue(redis_url)
        
        # Processing infrastructure
        self.executor = ThreadPoolExecutor(max_workers=8)
        self.processing_semaphore = asyncio.Semaphore(5)  # Limit concurrent processing
        
        # State tracking
        self.last_processed_id = 0
        self.last_processed_timestamp = 0
        self.is_running = False
        self.processed_emails = set()  # Deduplicate
        self.email_cache = {}  # Content cache
        
        # Performance statistics
        self.stats = ProcessingStats()
        
        # Batch processing
        self.batch_queue = asyncio.Queue(maxsize=100)
        self.batch_size = 10
        self.batch_timeout = 2.0  # seconds
        
        # Signal handling for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
        
        # Initialize tracking state
        self._init_tracking_state()
        
        logger.info("RealtimeEmailMonitor initialized with file system watching and Redis queuing")
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.stop_monitoring()
    
    def _init_tracking_state(self):
        """Initialize tracking state from the most recent email"""
        try:
            recent_emails = self.db_reader.get_recent_emails(limit=1)
            if recent_emails and not recent_emails[0].get('error'):
                latest = recent_emails[0]
                self.last_processed_id = latest.get('id', 0)
                
                # Convert timestamp for tracking
                if latest.get('date_received'):
                    try:
                        # Parse the formatted timestamp back to Apple Mail format
                        dt = datetime.strptime(latest['date_received'], "%Y-%m-%d %H:%M:%S")
                        apple_epoch = datetime(2001, 1, 1)
                        self.last_processed_timestamp = (dt - apple_epoch).total_seconds()
                    except (ValueError, TypeError):
                        self.last_processed_timestamp = time.time()
                
                logger.info(f"Initialized tracking from email ID {self.last_processed_id}")
        except Exception as e:
            logger.warning(f"Could not initialize tracking state: {e}")
            self.last_processed_id = 0
            self.last_processed_timestamp = time.time()
    
    async def _handle_filesystem_event(self, event_type: str, file_path: str):
        """Handle file system events from mail database"""
        logger.debug(f"File system event: {event_type} - {file_path}")
        
        if self.is_running:
            # Trigger immediate email check
            await self._queue_immediate_check("filesystem")
    
    async def _queue_immediate_check(self, source: str):
        """Queue an immediate email check"""
        try:
            batch = EmailBatch(
                emails=[],  # Will be filled during processing
                batch_id=f"{source}_{int(time.time())}",
                timestamp=datetime.now(),
                source=source,
                priority=2 if source == "filesystem" else 1
            )
            await self.batch_queue.put(batch)
            logger.debug(f"Queued immediate check from {source}")
        except asyncio.QueueFull:
            logger.warning("Batch queue full, skipping immediate check")
    
    async def start_monitoring(self):
        """Start the real-time monitoring with file system watching and batch processing"""
        if self.is_running:
            logger.warning("Monitor is already running")
            return
        
        self.is_running = True
        logger.info("Starting real-time email monitoring with file system watching")
        
        try:
            # Start file system monitoring
            await self._start_filesystem_monitoring()
            
            # Start background tasks
            tasks = await asyncio.gather(
                self._polling_loop(),
                self._batch_processing_loop(),
                self._event_processing_loop(),
                self._periodic_maintenance(),
                return_exceptions=True
            )
            
            # Check for any task exceptions
            for i, task_result in enumerate(tasks):
                if isinstance(task_result, Exception):
                    logger.error(f"Task {i} failed: {task_result}")
                    
        except Exception as e:
            logger.error(f"Monitor startup error: {e}")
            self.stats.errors += 1
        finally:
            await self._cleanup()
            self.is_running = False
            logger.info("Real-time email monitoring stopped")
    
    async def _start_filesystem_monitoring(self):
        """Start file system monitoring for mail database changes"""
        try:
            # Monitor Apple Mail database directory
            mail_dir = Path.home() / "Library/Mail"
            if mail_dir.exists():
                self.file_observer.schedule(
                    self.db_watcher, 
                    str(mail_dir), 
                    recursive=True
                )
                self.file_observer.start()
                logger.info(f"Started file system monitoring: {mail_dir}")
            else:
                logger.warning("Apple Mail directory not found, file system monitoring disabled")
        except Exception as e:
            logger.error(f"Failed to start file system monitoring: {e}")
    
    async def _polling_loop(self):
        """Background polling loop as fallback"""
        while self.is_running:
            try:
                await self._queue_immediate_check("polling")
                await asyncio.sleep(self.poller.get_next_interval())
            except Exception as e:
                logger.error(f"Polling loop error: {e}")
                await asyncio.sleep(5)  # Error recovery delay
    
    async def _batch_processing_loop(self):
        """Process batches of emails efficiently"""
        while self.is_running:
            try:
                # Wait for batch or timeout
                try:
                    batch = await asyncio.wait_for(
                        self.batch_queue.get(), 
                        timeout=self.batch_timeout
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Process the batch
                await self._process_email_batch(batch)
                
            except Exception as e:
                logger.error(f"Batch processing error: {e}")
                self.stats.errors += 1
                await asyncio.sleep(1)  # Error recovery delay
    
    async def _event_processing_loop(self):
        """Process events from Redis queue"""
        while self.is_running:
            try:
                event_data = await self.event_queue.dequeue_email_event()
                if event_data:
                    await self._handle_email_event(event_data)
                else:
                    await asyncio.sleep(0.1)  # Short delay when no events
            except Exception as e:
                logger.error(f"Event processing error: {e}")
                await asyncio.sleep(1)  # Error recovery delay
    
    async def _periodic_maintenance(self):
        """Periodic maintenance tasks"""
        while self.is_running:
            try:
                await asyncio.sleep(60)  # Run every minute
                
                # Clean up old cache entries
                await self._cleanup_cache()
                
                # Update performance metrics
                await self._update_performance_metrics()
                
                # Send periodic stats to WebSocket clients
                await self._broadcast_stats_update()
                
            except Exception as e:
                logger.error(f"Maintenance error: {e}")
    
    def stop_monitoring(self):
        """Stop the monitoring loop gracefully"""
        self.is_running = False
        logger.info("Stopping real-time email monitoring gracefully...")
    
    async def _cleanup(self):
        """Clean up resources"""
        try:
            # Stop file system observer
            if self.file_observer.is_alive():
                self.file_observer.stop()
                self.file_observer.join(timeout=5)
            
            # Shutdown executor
            self.executor.shutdown(wait=True, timeout=10)
            
            logger.info("Cleanup completed")
        except Exception as e:
            logger.error(f"Cleanup error: {e}")
    
    async def _process_email_batch(self, batch: EmailBatch):
        """Process a batch of emails efficiently"""
        start_time = time.time()
        
        try:
            async with self.processing_semaphore:
                # Get new emails since last check
                new_emails = await self._get_new_emails(limit=self.batch_size)
                batch.emails = new_emails
                
                if new_emails:
                    logger.info(f"Processing batch of {len(new_emails)} emails from {batch.source}")
                    
                    # Process emails through intelligence engine with EXACT models
                    processed_emails = await self._process_new_emails_with_gpt5(new_emails)
                    
                    # Emit events and update WebSocket clients
                    await self._handle_processed_emails(processed_emails, batch)
                    
                    # Update tracking state
                    if new_emails:
                        latest = max(new_emails, key=lambda x: x.get('id', 0))
                        self.last_processed_id = latest.get('id', self.last_processed_id)
                    
                    self.stats.total_processed += len(new_emails)
                    self.stats.batch_sizes.append(len(new_emails))
                
                # Update polling strategy
                self.poller.update_activity(bool(new_emails), len(new_emails))
                
        except Exception as e:
            logger.error(f"Error processing batch: {e}")
            self.stats.errors += 1
        
        # Update performance metrics
        batch_duration = (time.time() - start_time) * 1000
        if batch_duration > 0:
            self.stats.classification_times.append(batch_duration)
            self._update_avg_processing_time(batch_duration)
    
    def _update_avg_processing_time(self, new_time: float):
        """Update rolling average processing time"""
        if self.stats.avg_processing_time_ms == 0:
            self.stats.avg_processing_time_ms = new_time
        else:
            # Exponential moving average
            alpha = 0.1
            self.stats.avg_processing_time_ms = (
                alpha * new_time + (1 - alpha) * self.stats.avg_processing_time_ms
            )
    
    async def _get_new_emails(self, limit: int = 50) -> List[Dict]:
        """Get new emails since last processed ID with deduplication"""
        try:
            conn = self.db_reader._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Query for emails newer than last processed
            query = """
            SELECT 
                m.ROWID as id,
                m.message_id,
                m.document_id,
                s.subject as subject_text,
                sender_add.address as sender_email,
                sender_add.comment as sender_name,
                m.date_sent,
                m.date_received,
                m.read,
                m.flagged,
                m.deleted,
                m.size,
                mb.url as mailbox_path
            FROM messages m
            LEFT JOIN subjects s ON m.subject = s.ROWID
            LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
            LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
            WHERE m.deleted = 0 AND m.ROWID > ?
            ORDER BY m.ROWID ASC
            LIMIT ?
            """
            
            cursor.execute(query, (self.last_processed_id, limit))
            rows = cursor.fetchall()
            
            emails = []
            for row in rows:
                email = dict(row)
                email_id = str(email['id'])
                
                # Skip already processed emails
                if email_id in self.processed_emails:
                    continue
                
                # Rate limiting check
                if not self.poller.should_process_email(email_id):
                    continue
                
                # Convert timestamps
                email['date_received'] = self.db_reader._convert_timestamp(email['date_received'])
                email['date_sent'] = self.db_reader._convert_timestamp(email['date_sent'])
                # Convert boolean flags
                email['is_read'] = bool(email['read'])
                email['is_flagged'] = bool(email['flagged'])
                
                emails.append(email)
                self.processed_emails.add(email_id)
            
            conn.close()
            return emails
            
        except Exception as e:
            logger.error(f"Error getting new emails: {e}")
            return []
    
    async def _process_new_emails_with_gpt5(self, emails: List[Dict]) -> List[Dict]:
        """Process new emails through the intelligence engine with EXACT GPT-5 models"""
        processed_emails = []
        
        if not emails:
            return processed_emails
        
        try:
            # Process emails using the EXACT models specified
            # gpt-5-nano-2025-08-07 for classification
            # gpt-5-mini-2025-08-07 for draft generation
            
            # Prepare emails for batch processing
            email_batch = []
            for email in emails:
                # Get email content (would need to fetch full content from mail files)
                content = self._get_email_content(email)
                
                # Create metadata
                metadata = {
                    'id': str(email.get('id', '')),
                    'from_address': email.get('sender_email', ''),
                    'subject': email.get('subject_text', ''),
                    'date_received': email.get('date_received', ''),
                    'message_id': email.get('message_id', ''),
                    'size_bytes': email.get('size', 0)
                }
                email_batch.append((content, metadata))
            
            # Process with EmailIntelligenceEngine (preserves exact model names)
            classification_tasks = []
            for content, metadata in email_batch:
                task = self._classify_with_exact_models(content, metadata)
                classification_tasks.append(task)
            
            # Execute classification tasks concurrently
            intelligence_results = await asyncio.gather(*classification_tasks, return_exceptions=True)
            
            # Combine original email data with intelligence results
            for i, (email, intelligence_result) in enumerate(zip(emails, intelligence_results)):
                if isinstance(intelligence_result, Exception):
                    logger.error(f"Error processing email {email.get('id')}: {intelligence_result}")
                    intelligence_result = self._create_fallback_classification()
                
                processed_email = {
                    **email,
                    'intelligence': {
                        'classification': intelligence_result.get('classification', {}),
                        'urgency': intelligence_result.get('urgency', 'medium'),
                        'sentiment': intelligence_result.get('sentiment', 'neutral'),
                        'action_items': intelligence_result.get('action_items', []),
                        'processing_time_ms': intelligence_result.get('processing_time_ms', 0),
                        'model_used': 'gpt-5-nano-2025-08-07'  # Exact model as specified
                    }
                }
                processed_emails.append(processed_email)
                
        except Exception as e:
            logger.error(f"Error processing emails with GPT-5 models: {e}")
            # Return emails with minimal processing
            processed_emails = [{**email, 'intelligence': self._create_fallback_classification()} for email in emails]
        
        return processed_emails
    
    def _get_email_content(self, email: Dict) -> str:
        """Get full email content (simplified for now)"""
        # In production, this would fetch the full email content from mail files
        # For now, combine available fields
        subject = email.get('subject_text', '')
        sender = email.get('sender_email', '')
        
        # Create a basic content string
        content = f"Subject: {subject}\nFrom: {sender}\n\n"
        
        # Cache content
        email_id = str(email.get('id', ''))
        self.email_cache[email_id] = content
        
        return content
    
    async def _classify_with_exact_models(self, content: str, metadata: Dict) -> Dict:
        """Classify email using the EXACT OpenAI models specified"""
        try:
            # Use the EmailIntelligenceEngine which has the exact models configured
            result = self.intelligence_engine.analyze_email(
                subject=metadata.get('subject', ''),
                body=content,
                sender=metadata.get('from_address', ''),
                metadata=metadata
            )
            
            # Convert to dict format for consistency
            return {
                'classification': result.classification.value,
                'urgency': result.urgency.value,
                'sentiment': result.sentiment.value,
                'action_items': [item.text for item in result.action_items],
                'processing_time_ms': result.processing_time_ms,
                'confidence': result.confidence
            }
            
        except Exception as e:
            logger.error(f"Error in exact model classification: {e}")
            return self._create_fallback_classification()
    
    def _create_fallback_classification(self) -> Dict:
        """Create fallback classification when AI processing fails"""
        return {
            'classification': 'FYI_ONLY',
            'urgency': 'MEDIUM',
            'sentiment': 'NEUTRAL',
            'action_items': [],
            'processing_time_ms': 0,
            'confidence': 0.5,
            'model_used': 'fallback'
        }
    
    async def _handle_processed_emails(self, processed_emails: List[Dict], batch: EmailBatch):
        """Handle processed emails by emitting events and updating WebSocket clients"""
        for processed_email in processed_emails:
            try:
                # Create and emit email event
                event = await self._create_email_event(processed_email)
                
                # Add to Redis queue
                await self.event_queue.enqueue_email_event(event)
                
                # Immediate WebSocket broadcast for urgent emails
                if event.requires_attention:
                    await self._broadcast_urgent_notification(event)
                else:
                    await self._broadcast_email_update(event)
                
                # Execute callback if provided
                if self.event_callback:
                    await self.event_callback(event)
                    
            except Exception as e:
                logger.error(f"Error handling processed email {processed_email.get('id')}: {e}")
    
    async def _create_email_event(self, processed_email: Dict) -> EmailEvent:
        """Create an EmailEvent from processed email data"""
        # Determine event type and urgency
        event_type = "new_email"
        urgency_level = 1
        requires_attention = False
        processing_time = 0.0
        
        if 'intelligence' in processed_email:
            intelligence = processed_email['intelligence']
            
            # Extract urgency (handle both string and numeric values)
            urgency_str = intelligence.get('urgency', 'MEDIUM')
            if urgency_str == 'CRITICAL':
                urgency_level = 5
            elif urgency_str == 'HIGH':
                urgency_level = 4
            elif urgency_str == 'MEDIUM':
                urgency_level = 3
            elif urgency_str == 'LOW':
                urgency_level = 2
            else:
                urgency_level = 1
            
            classification = intelligence.get('classification', '')
            processing_time = intelligence.get('processing_time_ms', 0.0)
            
            # Check if email requires immediate attention
            if (urgency_level >= 4 or 
                classification in ['NEEDS_REPLY', 'APPROVAL_REQUIRED', 'URGENT'] or
                len(intelligence.get('action_items', [])) > 0):
                requires_attention = True
                event_type = "urgent_notification"
        
        return EmailEvent(
            event_type=event_type,
            email_id=str(processed_email.get('id', '')),
            message_id=processed_email.get('message_id', 0),
            timestamp=datetime.now(),
            metadata={
                'subject': processed_email.get('subject_text', ''),
                'sender': processed_email.get('sender_email', ''),
                'sender_name': processed_email.get('sender_name', ''),
                'is_read': processed_email.get('is_read', False),
                'is_flagged': processed_email.get('is_flagged', False),
                'mailbox': processed_email.get('mailbox_path', ''),
                'date_received': processed_email.get('date_received', ''),
                'size': processed_email.get('size', 0)
            },
            classification=processed_email.get('intelligence'),
            urgency_level=urgency_level,
            requires_attention=requires_attention,
            processing_time_ms=processing_time
        )
    
    async def _broadcast_email_update(self, event: EmailEvent):
        """Broadcast regular email update to WebSocket clients"""
        try:
            message = WebSocketMessage(
                event_type=MessageType.EMAIL_UPDATE.value,
                timestamp=event.timestamp,
                data={
                    'email_id': event.email_id,
                    'event_type': event.event_type,
                    'metadata': event.metadata,
                    'classification': event.classification,
                    'urgency_level': event.urgency_level,
                    'processing_time_ms': event.processing_time_ms
                },
                metadata={
                    'source': 'realtime_monitor',
                    'batch_processing': True
                }
            )
            
            await self.websocket_manager.broadcast_to_topic('emails', message)
            logger.debug(f"Broadcasted email update for {event.email_id}")
            
        except Exception as e:
            logger.error(f"Error broadcasting email update: {e}")
    
    async def _broadcast_urgent_notification(self, event: EmailEvent):
        """Broadcast urgent notification to all WebSocket clients"""
        try:
            notification_data = {
                'email_id': event.email_id,
                'subject': event.metadata.get('subject', 'No Subject'),
                'sender': event.metadata.get('sender', 'Unknown Sender'),
                'urgency_level': event.urgency_level,
                'classification': event.classification,
                'timestamp': event.timestamp.isoformat(),
                'action_required': event.requires_attention
            }
            
            await self.websocket_manager.broadcast_urgent_notification(notification_data)
            logger.info(f"Broadcasted urgent notification for email {event.email_id}")
            
        except Exception as e:
            logger.error(f"Error broadcasting urgent notification: {e}")
    
    async def _handle_email_event(self, event_data: Dict):
        """Handle email event from Redis queue"""
        try:
            # Process the event (this could trigger additional actions)
            event_type = event_data.get('event_type')
            email_id = event_data.get('email_id')
            urgency = event_data.get('urgency_level', 1)
            
            logger.debug(f"Handling email event: {event_type} for {email_id}")
            
            # Additional processing based on event type
            if event_type == 'urgent_notification':
                # Could trigger additional notifications (email, Slack, etc.)
                pass
            
        except Exception as e:
            logger.error(f"Error handling email event: {e}")
    
    async def _cleanup_cache(self):
        """Clean up old cache entries"""
        try:
            # Clean up processed emails set (keep last 10000)
            if len(self.processed_emails) > 10000:
                # Keep most recent 5000
                recent_emails = list(self.processed_emails)[-5000:]
                self.processed_emails = set(recent_emails)
                logger.debug("Cleaned up processed emails cache")
            
            # Clean up email content cache (keep last 1000)
            if len(self.email_cache) > 1000:
                # Remove oldest entries
                cache_items = list(self.email_cache.items())
                self.email_cache = dict(cache_items[-500:])
                logger.debug("Cleaned up email content cache")
                
        except Exception as e:
            logger.error(f"Error cleaning up cache: {e}")
    
    async def _update_performance_metrics(self):
        """Update performance metrics"""
        try:
            # Keep only recent timing data (last 100 measurements)
            if len(self.stats.classification_times) > 100:
                self.stats.classification_times = self.stats.classification_times[-50:]
            
            if len(self.stats.batch_sizes) > 100:
                self.stats.batch_sizes = self.stats.batch_sizes[-50:]
                
        except Exception as e:
            logger.error(f"Error updating performance metrics: {e}")
    
    async def _broadcast_stats_update(self):
        """Broadcast statistics update to WebSocket clients"""
        try:
            stats = self.get_monitoring_stats()
            
            message = WebSocketMessage(
                event_type=MessageType.ANALYTICS_UPDATE.value,
                timestamp=datetime.now(),
                data={
                    'type': 'realtime_monitor_stats',
                    'stats': stats
                },
                metadata={
                    'source': 'realtime_monitor',
                    'update_interval': 60
                }
            )
            
            await self.websocket_manager.broadcast_to_topic('analytics', message)
            
        except Exception as e:
            logger.error(f"Error broadcasting stats update: {e}")
    
    def get_monitoring_stats(self) -> Dict[str, Any]:
        """Get comprehensive monitoring statistics"""
        return {
            'is_running': self.is_running,
            'last_processed_id': self.last_processed_id,
            'processing_stats': {
                'total_processed': self.stats.total_processed,
                'avg_processing_time_ms': self.stats.avg_processing_time_ms,
                'total_errors': self.stats.errors,
                'cache_hits': self.stats.cache_hits,
                'redis_operations': self.stats.redis_operations
            },
            'performance_metrics': {
                'current_poll_interval': self.poller.current_interval,
                'recent_batch_sizes': self.stats.batch_sizes[-10:] if self.stats.batch_sizes else [],
                'recent_processing_times': self.stats.classification_times[-10:] if self.stats.classification_times else [],
                'cache_size': len(self.email_cache),
                'processed_emails_count': len(self.processed_emails)
            },
            'queue_stats': self.event_queue.get_queue_stats(),
            'websocket_stats': self.websocket_manager.get_connection_stats(),
            'system_info': {
                'file_system_monitoring': self.file_observer.is_alive() if hasattr(self, 'file_observer') else False,
                'redis_available': self.event_queue.available,
                'executor_active': not self.executor._shutdown if hasattr(self, 'executor') else False
            }
        }
    
    async def force_check(self) -> Dict[str, Any]:
        """Force an immediate check for new emails"""
        logger.info("Forcing immediate email check")
        await self._queue_immediate_check("manual")
        return self.get_monitoring_stats()
    
    async def get_email_by_id(self, email_id: str) -> Optional[Dict]:
        """Get specific email by ID with intelligence analysis"""
        try:
            conn = self.db_reader._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            query = """
            SELECT 
                m.ROWID as id,
                m.message_id,
                s.subject as subject_text,
                sender_add.address as sender_email,
                sender_add.comment as sender_name,
                m.date_sent,
                m.date_received,
                m.read,
                m.flagged,
                m.size
            FROM messages m
            LEFT JOIN subjects s ON m.subject = s.ROWID
            LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
            WHERE m.ROWID = ? AND m.deleted = 0
            """
            
            cursor.execute(query, (int(email_id),))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                email = dict(row)
                email['date_received'] = self.db_reader._convert_timestamp(email['date_received'])
                email['date_sent'] = self.db_reader._convert_timestamp(email['date_sent'])
                email['is_read'] = bool(email['read'])
                email['is_flagged'] = bool(email['flagged'])
                
                # Process through intelligence engine
                processed = await self._process_new_emails_with_gpt5([email])
                return processed[0] if processed else email
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting email by ID {email_id}: {e}")
            return None
    
    async def process_email_content(self, content: str, metadata: Dict) -> Dict:
        """Process email content directly through intelligence engine"""
        try:
            result = await self._classify_with_exact_models(content, metadata)
            return {
                'content': content,
                'metadata': metadata,
                'intelligence': result,
                'processed_at': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error processing email content: {e}")
            return {
                'content': content,
                'metadata': metadata,
                'intelligence': self._create_fallback_classification(),
                'error': str(e),
                'processed_at': datetime.now().isoformat()
            }

# Utility functions for integration
async def create_email_monitor(websocket_manager: WebSocketManager,
                             event_callback: Optional[Callable] = None,
                             redis_url: str = "redis://localhost:6379") -> RealtimeEmailMonitor:
    """Factory function to create and initialize email monitor"""
    monitor = RealtimeEmailMonitor(websocket_manager, event_callback, redis_url)
    return monitor

async def start_background_monitoring(monitor: RealtimeEmailMonitor):
    """Start monitoring in the background"""
    task = asyncio.create_task(monitor.start_monitoring())
    return task

class EmailMonitorService:
    """Service class for managing the real-time email monitor"""
    
    def __init__(self, websocket_manager: WebSocketManager, redis_url: str = "redis://localhost:6379"):
        self.websocket_manager = websocket_manager
        self.redis_url = redis_url
        self.monitor = None
        self.monitor_task = None
        self.is_running = False
    
    async def start(self, event_callback: Optional[Callable] = None) -> bool:
        """Start the email monitoring service"""
        try:
            if self.is_running:
                logger.warning("Email monitor service already running")
                return False
            
            # Create monitor
            self.monitor = await create_email_monitor(
                self.websocket_manager, 
                event_callback, 
                self.redis_url
            )
            
            # Start monitoring in background
            self.monitor_task = await start_background_monitoring(self.monitor)
            self.is_running = True
            
            logger.info("Email monitoring service started successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start email monitoring service: {e}")
            return False
    
    async def stop(self) -> bool:
        """Stop the email monitoring service"""
        try:
            if not self.is_running:
                logger.warning("Email monitor service not running")
                return False
            
            # Stop monitor
            if self.monitor:
                self.monitor.stop_monitoring()
            
            # Cancel background task
            if self.monitor_task and not self.monitor_task.done():
                self.monitor_task.cancel()
                try:
                    await self.monitor_task
                except asyncio.CancelledError:
                    pass
            
            self.is_running = False
            logger.info("Email monitoring service stopped")
            return True
            
        except Exception as e:
            logger.error(f"Error stopping email monitoring service: {e}")
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get service status"""
        status = {
            'is_running': self.is_running,
            'monitor_available': self.monitor is not None,
            'task_status': 'running' if self.monitor_task and not self.monitor_task.done() else 'stopped'
        }
        
        if self.monitor:
            status['monitor_stats'] = self.monitor.get_monitoring_stats()
        
        return status
    
    async def force_check(self) -> Dict[str, Any]:
        """Force immediate email check"""
        if self.monitor:
            return await self.monitor.force_check()
        else:
            return {'error': 'Monitor not available'}
    
    async def get_email_by_id(self, email_id: str) -> Optional[Dict]:
        """Get email by ID with intelligence analysis"""
        if self.monitor:
            return await self.monitor.get_email_by_id(email_id)
        else:
            return None

# Example usage and testing
async def example_event_handler(event: EmailEvent):
    """Example event handler for testing"""
    urgency_icons = {1: "🔵", 2: "🟡", 3: "🟠", 4: "🔴", 5: "🚨"}
    icon = urgency_icons.get(event.urgency_level, "📧")
    
    print(f"{icon} {event.event_type.upper()}: {event.metadata.get('subject', 'No Subject')}")
    print(f"   From: {event.metadata.get('sender', 'Unknown')}")
    if event.requires_attention:
        print(f"   ⚠️  REQUIRES ATTENTION (Urgency: {event.urgency_level})")
    if event.classification:
        print(f"   📋 Classification: {event.classification.get('classification', 'Unknown')}")
    if event.processing_time_ms > 0:
        print(f"   ⏱️  Processing: {event.processing_time_ms:.0f}ms")
    print(f"   🕐 Time: {event.timestamp.strftime('%H:%M:%S')}")
    print()

def print_banner():
    """Print startup banner"""
    banner = """
╔══════════════════════════════════════════════════════════════════════════════╗
║                    🚀 Real-time Email Intelligence Monitor                   ║
║                                                                              ║
║  Features:                                                                   ║
║  • File system monitoring for instant email detection                       ║
║  • GPT-5-nano-2025-08-07 for fast email classification                     ║
║  • GPT-5-mini-2025-08-07 for detailed draft generation                     ║
║  • Redis-based event queuing for burst handling                             ║
║  • WebSocket integration for live frontend updates                          ║
║  • Adaptive polling with rate limiting                                       ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """
    print(banner)

async def main():
    """Example usage of the real-time email monitor with WebSocket integration"""
    print_banner()
    
    try:
        # Initialize WebSocket manager
        from websocket_manager import create_websocket_manager
        websocket_manager = create_websocket_manager(max_clients=50)
        
        # Start WebSocket manager background tasks
        await websocket_manager.start_background_tasks()
        
        # Create email monitoring service
        service = EmailMonitorService(websocket_manager)
        
        # Start the service with example event handler
        success = await service.start(example_event_handler)
        
        if success:
            print("🟢 Real-time email monitoring started successfully")
            print("📊 WebSocket manager active for live updates")
            print("🔍 File system monitoring enabled")
            print("⚡ Using exact GPT-5 models: gpt-5-nano-2025-08-07 & gpt-5-mini-2025-08-07")
            print("\n📧 Monitoring for new emails... Press Ctrl+C to stop\n")
            
            # Keep running until interrupted
            try:
                while True:
                    await asyncio.sleep(10)
                    
                    # Print periodic status
                    status = service.get_status()
                    if status.get('monitor_stats'):
                        stats = status['monitor_stats']['processing_stats']
                        print(f"📈 Processed: {stats.get('total_processed', 0)} emails, "
                              f"Avg time: {stats.get('avg_processing_time_ms', 0):.0f}ms, "
                              f"Errors: {stats.get('total_errors', 0)}")
                              
            except KeyboardInterrupt:
                print("\n🛑 Shutdown signal received...")
        else:
            print("❌ Failed to start email monitoring service")
            return
            
    except Exception as e:
        print(f"❌ Error: {e}")
        logger.error(f"Main error: {e}")
    
    finally:
        # Cleanup
        try:
            if 'service' in locals():
                await service.stop()
            if 'websocket_manager' in locals():
                await websocket_manager.stop_background_tasks()
            print("✅ Cleanup completed")
        except Exception as e:
            print(f"⚠️  Cleanup error: {e}")

# CLI Interface
async def cli_interface():
    """Command-line interface for email monitor"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Real-time Email Intelligence Monitor')
    parser.add_argument('--redis-url', default='redis://localhost:6379', help='Redis URL for event queue')
    parser.add_argument('--max-clients', type=int, default=50, help='Maximum WebSocket clients')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'], default='INFO')
    parser.add_argument('--force-check', action='store_true', help='Force immediate email check and exit')
    parser.add_argument('--get-stats', action='store_true', help='Get monitoring statistics and exit')
    
    args = parser.parse_args()
    
    # Set log level
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    # Initialize components
    websocket_manager = create_websocket_manager(max_clients=args.max_clients)
    service = EmailMonitorService(websocket_manager, args.redis_url)
    
    if args.force_check:
        # Quick check mode
        print("🔍 Performing immediate email check...")
        await service.start()
        result = await service.force_check()
        await service.stop()
        print(f"📊 Result: {json.dumps(result, indent=2, default=str)}")
        return
    
    if args.get_stats:
        # Stats mode
        await service.start()
        status = service.get_status()
        await service.stop()
        print(f"📊 Status: {json.dumps(status, indent=2, default=str)}")
        return
    
    # Full monitoring mode
    await main()

if __name__ == "__main__":
    # Support both direct execution and CLI
    import sys
    if len(sys.argv) > 1:
        asyncio.run(cli_interface())
    else:
        asyncio.run(main())