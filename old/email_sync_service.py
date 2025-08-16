#!/usr/bin/env python3
"""
Email Background Sync Service

High-performance background service for syncing emails between Apple Mail and cache database.
Designed for <200ms API responses with background intelligence processing.

Features:
- Incremental sync every 5 minutes
- Bulk import for initial setup
- Conflict resolution with Apple Mail as source of truth
- Performance monitoring and error handling
- Background AI processing queue management
"""

import asyncio
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import json
from pathlib import Path

from sqlmodel import Session, select, and_, or_
from sqlalchemy import func

from email_cache_models import (
    EmailCache, EmailAction, EmailProcessingQueue,
    EmailClassification, EmailUrgency, EmailActionType,
    init_database, get_session
)
from apple_mail_db_reader import AppleMailDBReader
from email_intelligence_engine import EmailIntelligenceEngine


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EmailSyncService:
    """
    Background service for syncing emails between Apple Mail and cache database.
    
    Responsibilities:
    1. Import new/updated emails from Apple Mail
    2. Queue emails for AI processing
    3. Apply cached email actions back to Apple Mail
    4. Maintain sync status and conflict resolution
    """
    
    def __init__(self, cache_db_url: str = "sqlite:///email_cache.db"):
        """Initialize the sync service"""
        self.cache_engine = init_database(cache_db_url)
        self.apple_reader = AppleMailDBReader()
        self.ai_engine = EmailIntelligenceEngine()
        
        # Sync configuration
        self.sync_interval = 300  # 5 minutes
        self.batch_size = 100  # Process emails in batches
        self.max_ai_processing_threads = 3
        
        # Performance metrics
        self.metrics = {
            'last_sync_time': None,
            'emails_synced': 0,
            'ai_processed': 0,
            'sync_errors': 0,
            'average_sync_time': 0
        }
        
        logger.info("Email Sync Service initialized")
    
    async def start_background_sync(self) -> None:
        """Start the background sync process"""
        logger.info("Starting background email sync service...")
        
        # Run initial sync
        await self.full_sync()
        
        # Start periodic sync loop
        while True:
            try:
                await asyncio.sleep(self.sync_interval)
                await self.incremental_sync()
            except KeyboardInterrupt:
                logger.info("Shutting down sync service...")
                break
            except Exception as e:
                logger.error(f"Sync service error: {e}")
                self.metrics['sync_errors'] += 1
                await asyncio.sleep(60)  # Wait before retrying
    
    async def full_sync(self) -> Dict[str, Any]:
        """
        Perform full sync of all emails from Apple Mail to cache.
        Used for initial setup or major sync recovery.
        """
        start_time = time.time()
        logger.info("Starting full email sync...")
        
        try:
            # Get all emails from Apple Mail
            apple_emails = self.apple_reader.get_recent_emails(limit=None)  # All emails
            logger.info(f"Found {len(apple_emails)} emails in Apple Mail")
            
            synced_count = 0
            queued_for_ai = 0
            
            with get_session(self.cache_engine) as session:
                # Process emails in batches for memory efficiency
                for i in range(0, len(apple_emails), self.batch_size):
                    batch = apple_emails[i:i + self.batch_size]
                    
                    for apple_email in batch:
                        try:
                            # Check if email already exists in cache
                            existing = session.exec(
                                select(EmailCache).where(
                                    EmailCache.apple_mail_id == apple_email.get('message_id', 0)
                                )
                            ).first()
                            
                            if existing:
                                # Update existing email if needed
                                if self._should_update_email(existing, apple_email):
                                    self._update_cached_email(existing, apple_email)
                                    session.add(existing)
                            else:
                                # Create new cached email
                                cached_email = self._create_cached_email(apple_email)
                                session.add(cached_email)
                                synced_count += 1
                                
                                # Queue for AI processing if not already processed
                                if not cached_email.ai_processed_at:
                                    self._queue_for_ai_processing(session, cached_email.id)
                                    queued_for_ai += 1
                        
                        except Exception as e:
                            logger.error(f"Error processing email {apple_email.get('message_id')}: {e}")
                            continue
                    
                    # Commit batch
                    session.commit()
                    logger.debug(f"Processed batch {i//self.batch_size + 1}")
            
            # Update metrics
            sync_time = time.time() - start_time
            self.metrics.update({
                'last_sync_time': datetime.utcnow(),
                'emails_synced': synced_count,
                'average_sync_time': sync_time
            })
            
            result = {
                'status': 'success',
                'emails_synced': synced_count,
                'queued_for_ai': queued_for_ai,
                'sync_time_seconds': sync_time
            }
            
            logger.info(f"Full sync completed: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Full sync failed: {e}")
            self.metrics['sync_errors'] += 1
            return {
                'status': 'error',
                'error': str(e),
                'sync_time_seconds': time.time() - start_time
            }
    
    async def incremental_sync(self) -> Dict[str, Any]:
        """
        Perform incremental sync of recent emails.
        Only syncs emails modified since last sync.
        """
        start_time = time.time()
        logger.debug("Starting incremental email sync...")
        
        try:
            # Get last sync time
            with get_session(self.cache_engine) as session:
                last_sync = session.exec(
                    select(func.max(EmailCache.last_synced_from_apple))
                ).first()
                
                # Get recent emails from Apple Mail (last 24 hours to be safe)
                since_date = datetime.utcnow() - timedelta(hours=24)
                if last_sync:
                    since_date = max(since_date, last_sync - timedelta(minutes=10))  # 10 min overlap
            
            # Query Apple Mail for recent emails
            apple_emails = self.apple_reader.get_recent_emails(limit=500)  # Recent emails only
            
            synced_count = 0
            queued_for_ai = 0
            
            with get_session(self.cache_engine) as session:
                for apple_email in apple_emails:
                    try:
                        apple_mail_id = apple_email.get('message_id', 0)
                        
                        # Check if email exists in cache
                        existing = session.exec(
                            select(EmailCache).where(EmailCache.apple_mail_id == apple_mail_id)
                        ).first()
                        
                        if existing:
                            # Update if Apple Mail version is newer
                            if self._should_update_email(existing, apple_email):
                                self._update_cached_email(existing, apple_email)
                                session.add(existing)
                                synced_count += 1
                        else:
                            # New email - add to cache
                            cached_email = self._create_cached_email(apple_email)
                            session.add(cached_email)
                            session.flush()  # Get the ID
                            
                            # Queue for AI processing
                            self._queue_for_ai_processing(session, cached_email.id)
                            synced_count += 1
                            queued_for_ai += 1
                    
                    except Exception as e:
                        logger.error(f"Error processing email {apple_email.get('message_id')}: {e}")
                        continue
                
                session.commit()
            
            # Update metrics
            sync_time = time.time() - start_time
            self.metrics.update({
                'last_sync_time': datetime.utcnow(),
                'emails_synced': self.metrics['emails_synced'] + synced_count,
                'average_sync_time': (self.metrics['average_sync_time'] + sync_time) / 2
            })
            
            result = {
                'status': 'success',
                'emails_synced': synced_count,
                'queued_for_ai': queued_for_ai,
                'sync_time_seconds': sync_time
            }
            
            if synced_count > 0:
                logger.info(f"Incremental sync completed: {result}")
            else:
                logger.debug(f"Incremental sync completed: {result}")
            
            return result
            
        except Exception as e:
            logger.error(f"Incremental sync failed: {e}")
            self.metrics['sync_errors'] += 1
            return {
                'status': 'error',
                'error': str(e),
                'sync_time_seconds': time.time() - start_time
            }
    
    def _create_cached_email(self, apple_email: Dict[str, Any]) -> EmailCache:
        """Convert Apple Mail email to cached email object"""
        return EmailCache(
            apple_mail_id=apple_email.get('message_id', 0),
            apple_document_id=apple_email.get('document_id'),
            subject_text=apple_email.get('subject_text', 'No Subject'),
            sender_email=apple_email.get('sender_email', 'unknown@email.com'),
            sender_name=apple_email.get('sender_name'),
            date_received=self._parse_apple_date(apple_email.get('date_received')),
            date_sent=self._parse_apple_date(apple_email.get('date_sent')),
            content_snippet=apple_email.get('snippet', '')[:500],  # Limit snippet size
            size_bytes=apple_email.get('size_bytes'),
            mailbox_path=apple_email.get('mailbox_path'),
            is_read=bool(apple_email.get('is_read', 0)),
            is_flagged=bool(apple_email.get('is_flagged', 0)),
            is_deleted=bool(apple_email.get('is_deleted', 0)),
            last_synced_from_apple=datetime.utcnow()
        )
    
    def _update_cached_email(self, cached_email: EmailCache, apple_email: Dict[str, Any]) -> None:
        """Update cached email with data from Apple Mail"""
        cached_email.subject_text = apple_email.get('subject_text', cached_email.subject_text)
        cached_email.sender_email = apple_email.get('sender_email', cached_email.sender_email)
        cached_email.sender_name = apple_email.get('sender_name', cached_email.sender_name)
        cached_email.content_snippet = apple_email.get('snippet', cached_email.content_snippet or '')[:500]
        cached_email.is_read = bool(apple_email.get('is_read', 0))
        cached_email.is_flagged = bool(apple_email.get('is_flagged', 0))
        cached_email.is_deleted = bool(apple_email.get('is_deleted', 0))
        cached_email.last_synced_from_apple = datetime.utcnow()
    
    def _should_update_email(self, cached_email: EmailCache, apple_email: Dict[str, Any]) -> bool:
        """Determine if cached email should be updated from Apple Mail"""
        # Always update read/flag status
        apple_read = bool(apple_email.get('is_read', 0))
        apple_flagged = bool(apple_email.get('is_flagged', 0))
        
        return (
            cached_email.is_read != apple_read or
            cached_email.is_flagged != apple_flagged or
            cached_email.last_synced_from_apple < datetime.utcnow() - timedelta(hours=24)
        )
    
    def _queue_for_ai_processing(self, session: Session, email_id: int) -> None:
        """Add email to AI processing queue"""
        # Check if already queued
        existing_queue = session.exec(
            select(EmailProcessingQueue).where(EmailProcessingQueue.email_id == email_id)
        ).first()
        
        if not existing_queue:
            queue_item = EmailProcessingQueue(
                email_id=email_id,
                status="pending",
                priority=5  # Normal priority
            )
            session.add(queue_item)
    
    def _parse_apple_date(self, date_value: Any) -> Optional[datetime]:
        """Parse date from Apple Mail (handles various formats)"""
        if not date_value:
            return None
        
        if isinstance(date_value, datetime):
            return date_value
        
        if isinstance(date_value, (int, float)):
            # Apple Core Data timestamp (seconds since 2001-01-01)
            try:
                return datetime.fromtimestamp(date_value + 978307200)  # Apple epoch offset
            except (ValueError, OSError):
                return None
        
        if isinstance(date_value, str):
            # Try to parse ISO format
            try:
                return datetime.fromisoformat(date_value.replace('Z', '+00:00'))
            except ValueError:
                return None
        
        return None
    
    async def process_ai_queue(self) -> Dict[str, Any]:
        """
        Process emails in the AI processing queue.
        Runs in background to avoid blocking API responses.
        """
        start_time = time.time()
        processed_count = 0
        error_count = 0
        
        try:
            with get_session(self.cache_engine) as session:
                # Get pending emails from queue
                pending_items = session.exec(
                    select(EmailProcessingQueue)
                    .where(
                        and_(
                            EmailProcessingQueue.status == "pending",
                            EmailProcessingQueue.attempts < EmailProcessingQueue.max_attempts,
                            or_(
                                EmailProcessingQueue.next_retry_after.is_(None),
                                EmailProcessingQueue.next_retry_after <= datetime.utcnow()
                            )
                        )
                    )
                    .order_by(EmailProcessingQueue.priority, EmailProcessingQueue.created_at)
                    .limit(10)  # Process 10 at a time
                ).all()
                
                for queue_item in pending_items:
                    try:
                        # Mark as processing
                        queue_item.status = "processing"
                        queue_item.started_at = datetime.utcnow()
                        queue_item.attempts += 1
                        session.add(queue_item)
                        session.commit()
                        
                        # Get the email
                        email = session.exec(
                            select(EmailCache).where(EmailCache.id == queue_item.email_id)
                        ).first()
                        
                        if not email:
                            queue_item.status = "failed"
                            queue_item.last_error = "Email not found"
                            session.add(queue_item)
                            continue
                        
                        # Process with AI engine
                        result = self.ai_engine.analyze_email(
                            email.subject_text,
                            email.content_snippet or '',
                            email.sender_email
                        )
                        
                        # Update email with AI results
                        email.classification = EmailClassification(str(result.classification).split('.')[-1])
                        email.urgency = EmailUrgency(str(result.urgency).split('.')[-1])
                        email.confidence = result.confidence
                        
                        # Handle action items
                        if hasattr(result, 'action_items') and result.action_items:
                            action_items = [item.text for item in result.action_items]
                            email.set_action_items_list(action_items)
                        
                        email.ai_processed_at = datetime.utcnow()
                        
                        # Mark queue item as completed
                        queue_item.status = "completed"
                        queue_item.completed_at = datetime.utcnow()
                        
                        session.add(email)
                        session.add(queue_item)
                        session.commit()
                        
                        processed_count += 1
                        
                    except Exception as e:
                        logger.error(f"AI processing error for email {queue_item.email_id}: {e}")
                        
                        # Mark as failed or retry later
                        queue_item.status = "failed" if queue_item.attempts >= queue_item.max_attempts else "pending"
                        queue_item.last_error = str(e)
                        
                        if queue_item.attempts < queue_item.max_attempts:
                            # Exponential backoff for retries
                            retry_delay = min(2 ** queue_item.attempts * 60, 3600)  # Max 1 hour
                            queue_item.next_retry_after = datetime.utcnow() + timedelta(seconds=retry_delay)
                        
                        session.add(queue_item)
                        session.commit()
                        error_count += 1
            
            # Update metrics
            process_time = time.time() - start_time
            self.metrics['ai_processed'] += processed_count
            
            result = {
                'status': 'success',
                'processed_count': processed_count,
                'error_count': error_count,
                'process_time_seconds': process_time
            }
            
            if processed_count > 0:
                logger.info(f"AI processing completed: {result}")
            
            return result
            
        except Exception as e:
            logger.error(f"AI queue processing failed: {e}")
            return {
                'status': 'error',
                'error': str(e),
                'process_time_seconds': time.time() - start_time
            }
    
    def get_sync_status(self) -> Dict[str, Any]:
        """Get current sync service status and metrics"""
        with get_session(self.cache_engine) as session:
            # Get database statistics
            total_emails = session.exec(select(func.count(EmailCache.id))).first()
            ai_processed = session.exec(
                select(func.count(EmailCache.id)).where(EmailCache.ai_processed_at.is_not(None))
            ).first()
            pending_ai = session.exec(
                select(func.count(EmailProcessingQueue.id)).where(EmailProcessingQueue.status == "pending")
            ).first()
            
            return {
                'service_status': 'running',
                'last_sync': self.metrics['last_sync_time'].isoformat() if self.metrics['last_sync_time'] else None,
                'total_emails_cached': total_emails or 0,
                'ai_processed_emails': ai_processed or 0,
                'pending_ai_processing': pending_ai or 0,
                'sync_metrics': self.metrics
            }


async def main():
    """Main function for running the sync service"""
    sync_service = EmailSyncService()
    
    # Start background processing tasks
    tasks = [
        sync_service.start_background_sync(),
        background_ai_processor(sync_service),
    ]
    
    try:
        await asyncio.gather(*tasks)
    except KeyboardInterrupt:
        logger.info("Sync service stopped by user")


async def background_ai_processor(sync_service: EmailSyncService):
    """Background task for processing AI queue"""
    while True:
        try:
            await sync_service.process_ai_queue()
            await asyncio.sleep(30)  # Process AI queue every 30 seconds
        except Exception as e:
            logger.error(f"Background AI processor error: {e}")
            await asyncio.sleep(60)


if __name__ == "__main__":
    # Run the sync service
    asyncio.run(main())