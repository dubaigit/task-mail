#!/usr/bin/env python3
"""
EmailAutoProcessor - Background AI Processing Pipeline
Automatic task and draft generation for NEEDS_REPLY emails with WebSocket updates
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Set
from dataclasses import dataclass
from enum import Enum
import json

# Import core components
from email_data_connector import AppleMailConnector, Email as AppleEmail
from email_intelligence_engine import EmailIntelligenceEngine, EmailClassification, EmailUrgency

# Configure logging
logger = logging.getLogger(__name__)

class ProcessingStatus(Enum):
    """Processing status enumeration"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"

@dataclass
class ProcessingResult:
    """Result of email processing operation"""
    email_id: int
    classification: str
    urgency: str
    confidence: float
    tasks_generated: List[Dict[str, Any]]
    drafts_generated: List[Dict[str, Any]]
    processing_time_ms: float
    status: ProcessingStatus
    error_message: Optional[str] = None

class EmailAutoProcessor:
    """Background AI processing pipeline for automatic task/draft generation"""
    
    def __init__(self, 
                 mail_connector: Optional[AppleMailConnector] = None,
                 intelligence_engine: Optional[EmailIntelligenceEngine] = None,
                 websocket_manager: Optional[Any] = None):
        """Initialize the auto processor
        
        Args:
            mail_connector: Apple Mail database connector
            intelligence_engine: AI intelligence engine for classification
            websocket_manager: WebSocket manager for real-time updates
        """
        self.mail_connector = mail_connector or AppleMailConnector()
        self.intelligence_engine = intelligence_engine or EmailIntelligenceEngine()
        self.websocket_manager = websocket_manager
        
        # Processing state
        self.is_running = False
        self.processed_emails: Set[int] = set()
        self.processing_queue: asyncio.Queue = asyncio.Queue()
        self.retry_queue: asyncio.Queue = asyncio.Queue()
        
        # Configuration
        self.batch_size = 10
        self.processing_interval = 30  # seconds
        self.max_retries = 3
        self.retry_delay = 60  # seconds
        
        # Performance tracking
        self.stats = {
            "emails_processed": 0,
            "tasks_generated": 0,
            "drafts_generated": 0,
            "processing_errors": 0,
            "average_processing_time": 0.0
        }
        
        logger.info("EmailAutoProcessor initialized")

    async def start_background_processing(self) -> None:
        """Start the background processing pipeline"""
        if self.is_running:
            logger.warning("Background processing already running")
            return
            
        self.is_running = True
        logger.info("Starting background AI processing pipeline")
        
        # Start concurrent tasks
        await asyncio.gather(
            self._email_monitor_loop(),
            self._processing_worker(),
            self._retry_worker(),
            return_exceptions=True
        )

    async def stop_background_processing(self) -> None:
        """Stop the background processing pipeline"""
        self.is_running = False
        logger.info("Stopping background AI processing pipeline")

    async def _email_monitor_loop(self) -> None:
        """Monitor for new emails requiring processing"""
        logger.info("Starting email monitor loop")
        
        while self.is_running:
            try:
                # Get recent unread emails
                recent_emails = await self._get_unprocessed_emails()
                
                for email in recent_emails:
                    if email.get('message_id') not in self.processed_emails:
                        await self.processing_queue.put(email)
                        logger.debug(f"Queued email {email.get('message_id')} for processing")
                
                # Wait before next check
                await asyncio.sleep(self.processing_interval)
                
            except Exception as e:
                logger.error(f"Error in email monitor loop: {e}")
                await asyncio.sleep(10)  # Brief pause on error

    async def _processing_worker(self) -> None:
        """Main processing worker for emails"""
        logger.info("Starting processing worker")
        
        while self.is_running:
            try:
                # Get email from queue with timeout
                try:
                    email = await asyncio.wait_for(
                        self.processing_queue.get(), 
                        timeout=5.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                # Process the email
                result = await self._process_email(email)
                
                # Update statistics
                self._update_stats(result)
                
                # Send WebSocket update
                if self.websocket_manager and result.status == ProcessingStatus.COMPLETED:
                    await self._send_websocket_update(result)
                
                # Mark as processed
                self.processed_emails.add(result.email_id)
                
                logger.info(f"Processed email {result.email_id} - Status: {result.status.value}")
                
            except Exception as e:
                logger.error(f"Error in processing worker: {e}")
                await asyncio.sleep(1)

    async def _retry_worker(self) -> None:
        """Worker for retrying failed processing"""
        logger.info("Starting retry worker")
        
        while self.is_running:
            try:
                # Get failed email from retry queue
                try:
                    retry_data = await asyncio.wait_for(
                        self.retry_queue.get(),
                        timeout=10.0
                    )
                except asyncio.TimeoutError:
                    continue
                
                email, attempt = retry_data
                
                if attempt < self.max_retries:
                    logger.info(f"Retrying email {email.get('message_id')} (attempt {attempt + 1})")
                    
                    # Wait before retry
                    await asyncio.sleep(self.retry_delay)
                    
                    # Retry processing
                    result = await self._process_email(email)
                    
                    if result.status == ProcessingStatus.FAILED:
                        # Queue for another retry
                        await self.retry_queue.put((email, attempt + 1))
                    else:
                        # Success, update stats and notify
                        self._update_stats(result)
                        if self.websocket_manager:
                            await self._send_websocket_update(result)
                        self.processed_emails.add(result.email_id)
                else:
                    logger.error(f"Max retries exceeded for email {email.get('message_id')}")
                    self.stats["processing_errors"] += 1
                    
            except Exception as e:
                logger.error(f"Error in retry worker: {e}")
                await asyncio.sleep(5)

    async def _get_unprocessed_emails(self) -> List[Dict[str, Any]]:
        """Get emails that need processing"""
        try:
            # Get recent emails (last 24 hours)
            cutoff_date = datetime.now() - timedelta(hours=24)
            emails = self.mail_connector.get_recent_emails(
                limit=self.batch_size * 2,
                since_date=cutoff_date
            )
            
            # Filter out already processed emails
            unprocessed = [
                email for email in emails
                if email.get('message_id') not in self.processed_emails
            ]
            
            return unprocessed[:self.batch_size]
            
        except Exception as e:
            logger.error(f"Error getting unprocessed emails: {e}")
            return []

    async def _process_email(self, email: Dict[str, Any]) -> ProcessingResult:
        """Process a single email for task/draft generation"""
        start_time = time.time()
        email_id = email.get('message_id', 0)
        
        try:
            # Analyze email with AI
            analysis_result = self.intelligence_engine.analyze_email(
                subject=email.get('subject_text', ''),
                content=email.get('snippet', ''),
                sender=email.get('sender_email', '')
            )
            
            classification = str(analysis_result.classification).split('.')[-1]
            urgency = str(analysis_result.urgency).split('.')[-1]
            confidence = analysis_result.confidence
            
            tasks_generated = []
            drafts_generated = []
            
            # Generate tasks for actionable emails
            if self._requires_action(classification):
                task = await self._generate_task(email, analysis_result)
                if task:
                    tasks_generated.append(task)
            
            # Generate drafts for emails needing replies
            if classification == 'NEEDS_REPLY' and confidence > 0.7:
                draft = await self._generate_draft(email, analysis_result)
                if draft:
                    drafts_generated.append(draft)
            
            processing_time = (time.time() - start_time) * 1000
            
            return ProcessingResult(
                email_id=email_id,
                classification=classification,
                urgency=urgency,
                confidence=confidence,
                tasks_generated=tasks_generated,
                drafts_generated=drafts_generated,
                processing_time_ms=processing_time,
                status=ProcessingStatus.COMPLETED
            )
            
        except Exception as e:
            logger.error(f"Error processing email {email_id}: {e}")
            processing_time = (time.time() - start_time) * 1000
            
            return ProcessingResult(
                email_id=email_id,
                classification="UNKNOWN",
                urgency="LOW",
                confidence=0.0,
                tasks_generated=[],
                drafts_generated=[],
                processing_time_ms=processing_time,
                status=ProcessingStatus.FAILED,
                error_message=str(e)
            )

    def _requires_action(self, classification: str) -> bool:
        """Check if email classification requires action"""
        actionable_classifications = [
            'NEEDS_REPLY', 'APPROVAL_REQUIRED', 'CREATE_TASK', 
            'FOLLOW_UP', 'DELEGATE', 'URGENT'
        ]
        return classification in actionable_classifications

    async def _generate_task(self, email: Dict[str, Any], analysis: Any) -> Optional[Dict[str, Any]]:
        """Generate a task from email analysis"""
        try:
            classification = str(analysis.classification).split('.')[-1]
            urgency = str(analysis.urgency).split('.')[-1]
            
            # Calculate due date based on urgency
            due_date = self._calculate_due_date(urgency)
            
            task = {
                "id": f"auto_task_{email.get('message_id')}_{int(time.time())}",
                "email_id": email.get('message_id'),
                "subject": f"Action required: {email.get('subject_text', 'No Subject')}",
                "task_type": classification,
                "priority": urgency,
                "due_date": due_date.isoformat() if due_date else None,
                "description": f"Auto-generated task for email from {email.get('sender_email', 'Unknown sender')}",
                "assignee": "current_user",
                "status": "pending",
                "confidence": analysis.confidence,
                "created_at": datetime.now().isoformat(),
                "source": "auto_processor"
            }
            
            return task
            
        except Exception as e:
            logger.error(f"Error generating task: {e}")
            return None

    async def _generate_draft(self, email: Dict[str, Any], analysis: Any) -> Optional[Dict[str, Any]]:
        """Generate a draft reply from email analysis"""
        try:
            # Use intelligence engine to generate draft
            draft_content = self.intelligence_engine.generate_draft_reply(
                original_subject=email.get('subject_text', ''),
                original_content=email.get('snippet', ''),
                sender_email=email.get('sender_email', ''),
                classification=str(analysis.classification).split('.')[-1]
            )
            
            draft = {
                "id": f"auto_draft_{email.get('message_id')}_{int(time.time())}",
                "email_id": email.get('message_id'),
                "to": email.get('sender_email', ''),
                "subject": f"Re: {email.get('subject_text', 'No Subject')}",
                "content": draft_content,
                "confidence": analysis.confidence,
                "status": "draft",
                "created_at": datetime.now().isoformat(),
                "source": "auto_processor"
            }
            
            return draft
            
        except Exception as e:
            logger.error(f"Error generating draft: {e}")
            return None

    def _calculate_due_date(self, urgency: str) -> Optional[datetime]:
        """Calculate due date based on urgency level"""
        now = datetime.now()
        
        urgency_mapping = {
            'CRITICAL': timedelta(hours=2),
            'HIGH': timedelta(hours=8),
            'MEDIUM': timedelta(days=1),
            'LOW': timedelta(days=3)
        }
        
        delta = urgency_mapping.get(urgency, timedelta(days=1))
        return now + delta

    async def _send_websocket_update(self, result: ProcessingResult) -> None:
        """Send WebSocket update for processed email"""
        try:
            message = {
                "type": "auto_processing_complete",
                "data": {
                    "email_id": result.email_id,
                    "classification": result.classification,
                    "urgency": result.urgency,
                    "confidence": result.confidence,
                    "tasks_count": len(result.tasks_generated),
                    "drafts_count": len(result.drafts_generated),
                    "processing_time_ms": result.processing_time_ms,
                    "timestamp": datetime.now().isoformat()
                }
            }
            
            if hasattr(self.websocket_manager, 'broadcast'):
                await self.websocket_manager.broadcast(message)
            
        except Exception as e:
            logger.error(f"Error sending WebSocket update: {e}")

    def _update_stats(self, result: ProcessingResult) -> None:
        """Update processing statistics"""
        self.stats["emails_processed"] += 1
        self.stats["tasks_generated"] += len(result.tasks_generated)
        self.stats["drafts_generated"] += len(result.drafts_generated)
        
        if result.status == ProcessingStatus.FAILED:
            self.stats["processing_errors"] += 1
        
        # Update average processing time
        current_avg = self.stats["average_processing_time"]
        count = self.stats["emails_processed"]
        self.stats["average_processing_time"] = (
            (current_avg * (count - 1) + result.processing_time_ms) / count
        )

    async def process_email_manually(self, email_id: int) -> ProcessingResult:
        """Manually process a specific email"""
        try:
            # Get email by ID
            email = self.mail_connector.get_email_by_id(email_id)
            if not email:
                raise ValueError(f"Email {email_id} not found")
            
            # Process immediately
            result = await self._process_email(email)
            
            # Update stats and notify
            self._update_stats(result)
            if self.websocket_manager and result.status == ProcessingStatus.COMPLETED:
                await self._send_websocket_update(result)
            
            self.processed_emails.add(email_id)
            return result
            
        except Exception as e:
            logger.error(f"Error manually processing email {email_id}: {e}")
            return ProcessingResult(
                email_id=email_id,
                classification="UNKNOWN",
                urgency="LOW",
                confidence=0.0,
                tasks_generated=[],
                drafts_generated=[],
                processing_time_ms=0.0,
                status=ProcessingStatus.FAILED,
                error_message=str(e)
            )

    def get_processing_stats(self) -> Dict[str, Any]:
        """Get current processing statistics"""
        return {
            **self.stats,
            "is_running": self.is_running,
            "queue_size": self.processing_queue.qsize(),
            "retry_queue_size": self.retry_queue.qsize(),
            "processed_emails_count": len(self.processed_emails)
        }

    def get_health_status(self) -> Dict[str, Any]:
        """Get processor health status"""
        return {
            "status": "healthy" if self.is_running else "stopped",
            "uptime_seconds": time.time() - getattr(self, '_start_time', time.time()),
            "last_processing_time": self.stats.get("average_processing_time", 0),
            "error_rate": (
                self.stats["processing_errors"] / max(self.stats["emails_processed"], 1)
            ) * 100
        }

# Global instance for background processing
_auto_processor_instance: Optional[EmailAutoProcessor] = None

def get_auto_processor() -> EmailAutoProcessor:
    """Get the global auto processor instance"""
    global _auto_processor_instance
    if _auto_processor_instance is None:
        _auto_processor_instance = EmailAutoProcessor()
    return _auto_processor_instance

async def start_auto_processing() -> None:
    """Start the background auto processing"""
    processor = get_auto_processor()
    await processor.start_background_processing()

async def stop_auto_processing() -> None:
    """Stop the background auto processing"""
    processor = get_auto_processor()
    await processor.stop_background_processing()