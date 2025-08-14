#!/usr/bin/env python3
"""
Email Batch Processor for Production Email Intelligence System
Optimized for processing 10k+ emails from Apple Mail DB with 2-month default timeframe
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any, Tuple, AsyncIterator
from pathlib import Path
import json
import sqlite3
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import hashlib

# Database and async
import asyncpg
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy import select, and_, or_, func, text
from sqlalchemy.dialects.postgresql import insert

# Models
from database_models import Email, EmailIntelligence, EmailTask, EmailBatch, PerformanceMetric

# Email reading
from apple_mail_db_reader import AppleMailDBReader

# AI processing (mock implementation for now)
import aiohttp
import structlog

logger = structlog.get_logger(__name__)

# ============================================================================
# Configuration
# ============================================================================

@dataclass
class ProcessingConfig:
    """Configuration for email processing"""
    batch_size: int = 100
    max_workers: int = 10
    ai_timeout: int = 30
    retry_attempts: int = 3
    cache_ttl: int = 3600
    
    # AI model settings
    nano_model: str = "gpt-5-nano"
    mini_model: str = "gpt-5-mini"
    confidence_threshold: float = 0.7
    
    # Processing limits
    max_content_length: int = 50000  # Max characters to process
    max_emails_per_batch: int = 5000  # Safety limit
    
    # Apple Mail settings
    apple_mail_db_timeout: int = 30
    default_months_back: int = 2

# ============================================================================
# Apple Mail Database Reader (Enhanced)
# ============================================================================

class EnhancedAppleMailReader(AppleMailDBReader):
    """Enhanced Apple Mail reader optimized for batch processing"""
    
    def __init__(self, config: ProcessingConfig = None):
        super().__init__()
        self.config = config or ProcessingConfig()
        self.processed_cache = set()  # Cache of processed message IDs
    
    async def get_emails_in_date_range(self, 
                                     start_date: datetime, 
                                     end_date: datetime,
                                     limit: Optional[int] = None) -> AsyncIterator[Dict[str, Any]]:
        """
        Efficiently stream emails from Apple Mail DB in date range
        """
        logger.info(f"Reading emails from {start_date} to {end_date}")
        
        try:
            # Convert to Apple Mail timestamp format (seconds since 2001-01-01)
            apple_epoch = datetime(2001, 1, 1)
            start_timestamp = (start_date - apple_epoch).total_seconds()
            end_timestamp = (end_date - apple_epoch).total_seconds()
            
            conn = self._get_connection()
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            # Optimized query for batch processing
            query = """
            SELECT 
                m.ROWID as id,
                m.message_id,
                m.document_id,
                COALESCE(s.subject, '') as subject_text,
                COALESCE(sender_add.address, '') as sender_email,
                COALESCE(sender_add.comment, '') as sender_name,
                m.date_sent,
                m.date_received,
                m.read,
                m.flagged,
                m.deleted,
                m.size,
                COALESCE(mb.url, '') as mailbox_path,
                -- Get message body preview
                COALESCE(mp.string_data, '') as snippet
            FROM messages m
            LEFT JOIN subjects s ON m.subject = s.ROWID
            LEFT JOIN addresses sender_add ON m.sender = sender_add.ROWID
            LEFT JOIN mailboxes mb ON m.mailbox = mb.ROWID
            LEFT JOIN message_parts mp ON m.ROWID = mp.message AND mp.type = 'text/plain'
            WHERE m.deleted = 0
              AND m.date_received >= ?
              AND m.date_received <= ?
            ORDER BY m.date_received DESC
            """
            
            if limit:
                query += f" LIMIT {limit}"
            
            cursor.execute(query, (start_timestamp, end_timestamp))
            
            batch_count = 0
            while True:
                rows = cursor.fetchmany(self.config.batch_size)
                if not rows:
                    break
                
                for row in rows:
                    email_data = dict(row)
                    # Skip if already processed
                    if email_data['message_id'] in self.processed_cache:
                        continue
                    
                    # Convert timestamps
                    email_data['date_received'] = self._convert_timestamp(email_data['date_received'])
                    email_data['date_sent'] = self._convert_timestamp(email_data['date_sent'])
                    
                    # Convert boolean flags
                    email_data['is_read'] = bool(email_data['read'])
                    email_data['is_flagged'] = bool(email_data['flagged'])
                    
                    # Truncate snippet for performance
                    if email_data['snippet']:
                        email_data['snippet'] = email_data['snippet'][:500]
                    
                    yield email_data
                    batch_count += 1
                
                # Yield control periodically
                if batch_count % 1000 == 0:
                    await asyncio.sleep(0.1)
            
            conn.close()
            logger.info(f"Successfully read {batch_count} emails from Apple Mail DB")
            
        except Exception as e:
            logger.error(f"Error reading Apple Mail DB: {e}")
            raise
    
    async def get_full_email_content(self, message_id: int) -> Optional[str]:
        """Get full email content for a specific message"""
        try:
            conn = self._get_connection()
            cursor = conn.cursor()
            
            # Get full message content
            query = """
            SELECT mp.string_data
            FROM message_parts mp
            JOIN messages m ON mp.message = m.ROWID
            WHERE m.message_id = ? AND mp.type IN ('text/plain', 'text/html')
            ORDER BY mp.part_number
            """
            
            cursor.execute(query, (message_id,))
            parts = cursor.fetchall()
            
            if parts:
                # Combine all text parts
                content = '\n'.join([part[0] for part in parts if part[0]])
                return content[:self.config.max_content_length]  # Limit content length
            
            conn.close()
            return None
            
        except Exception as e:
            logger.error(f"Error getting full content for message {message_id}: {e}")
            return None

# ============================================================================
# AI Processing Services
# ============================================================================

class MockAIProcessor:
    """Mock AI processor for development/testing - replace with real AI calls"""
    
    def __init__(self, config: ProcessingConfig):
        self.config = config
        self.session = None
    
    async def initialize(self):
        """Initialize HTTP session for AI API calls"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.config.ai_timeout)
        )
    
    async def close(self):
        """Close HTTP session"""
        if self.session:
            await self.session.close()
    
    async def classify_email_nano(self, email_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fast classification using nano model (mock implementation)"""
        start_time = time.time()
        
        # Simulate API call delay
        await asyncio.sleep(0.05)  # 50ms
        
        # Mock classification logic based on email content
        subject = email_data.get('subject_text', '').lower()
        sender = email_data.get('sender_email', '').lower()
        
        classification = 'fyi'
        urgency = 'medium'
        confidence = 0.85
        
        # Simple rule-based classification for demo
        if any(word in subject for word in ['urgent', 'asap', 'immediate']):
            urgency = 'critical'
            classification = 'needs_reply'
            confidence = 0.95
        elif any(word in subject for word in ['meeting', 'schedule', 'appointment']):
            classification = 'meeting'
            urgency = 'high'
        elif any(word in subject for word in ['approval', 'approve', 'sign']):
            classification = 'approval_required'
            urgency = 'high'
        elif any(word in subject for word in ['task', 'todo', 'action']):
            classification = 'create_task'
        elif 'noreply' in sender or 'newsletter' in subject:
            classification = 'newsletter'
            urgency = 'low'
        
        processing_time = (time.time() - start_time) * 1000
        
        return {
            'classification': classification,
            'urgency': urgency,
            'sentiment': 'neutral',
            'confidence': confidence,
            'processing_time_ms': processing_time,
            'action_items': self._extract_action_items(subject),
            'key_entities': self._extract_entities(email_data),
            'summary': self._generate_summary(email_data)
        }
    
    async def analyze_email_mini(self, email_data: Dict[str, Any], 
                               nano_result: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Detailed analysis using mini model (mock implementation)"""
        start_time = time.time()
        
        # Only do detailed analysis for important emails
        if nano_result['urgency'] in ['low'] and nano_result['classification'] in ['newsletter', 'fyi']:
            return None
        
        # Simulate longer processing for detailed analysis
        await asyncio.sleep(0.2)  # 200ms
        
        processing_time = (time.time() - start_time) * 1000
        
        return {
            'detailed_summary': f"Detailed analysis of email from {email_data.get('sender_name', 'Unknown')}",
            'context_analysis': "Business communication with established contact",
            'suggested_response': self._generate_response(email_data, nano_result),
            'extracted_tasks': self._extract_tasks(email_data, nano_result),
            'priority_reasoning': f"Classified as {nano_result['urgency']} due to content indicators",
            'processing_time_ms': processing_time
        }
    
    def _extract_action_items(self, subject: str) -> List[str]:
        """Extract action items from subject"""
        items = []
        subject_lower = subject.lower()
        
        if 'review' in subject_lower:
            items.append('Review document/proposal')
        if 'meeting' in subject_lower:
            items.append('Schedule or attend meeting')
        if 'approval' in subject_lower:
            items.append('Provide approval or feedback')
        if 'urgent' in subject_lower:
            items.append('Take immediate action')
        
        return items[:3]  # Limit to 3 items
    
    def _extract_entities(self, email_data: Dict[str, Any]) -> List[str]:
        """Extract key entities"""
        entities = []
        
        sender_name = email_data.get('sender_name', '')
        if sender_name:
            entities.append(sender_name)
        
        # Extract company from email domain
        sender_email = email_data.get('sender_email', '')
        if '@' in sender_email:
            domain = sender_email.split('@')[1]
            if domain not in ['gmail.com', 'yahoo.com', 'hotmail.com']:
                entities.append(domain.split('.')[0].title())
        
        return entities[:5]  # Limit to 5 entities
    
    def _generate_summary(self, email_data: Dict[str, Any]) -> str:
        """Generate one-line summary"""
        sender_name = email_data.get('sender_name') or email_data.get('sender_email', 'Unknown')
        subject = email_data.get('subject_text', 'No subject')
        
        return f"Email from {sender_name}: {subject[:50]}{'...' if len(subject) > 50 else ''}"
    
    def _generate_response(self, email_data: Dict[str, Any], 
                          nano_result: Dict[str, Any]) -> str:
        """Generate suggested response"""
        sender_name = email_data.get('sender_name', 'there')
        
        if nano_result['classification'] == 'meeting':
            return f"Hi {sender_name},\n\nThank you for the meeting invitation. I'll check my calendar and get back to you shortly.\n\nBest regards"
        elif nano_result['classification'] == 'approval_required':
            return f"Hi {sender_name},\n\nI've received your request. I'll review it and provide my feedback by end of day.\n\nThanks"
        else:
            return f"Hi {sender_name},\n\nThank you for your email. I'll review this and get back to you soon.\n\nBest regards"
    
    def _extract_tasks(self, email_data: Dict[str, Any], 
                      nano_result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extract structured tasks"""
        tasks = []
        
        for i, action_item in enumerate(nano_result.get('action_items', [])):
            task = {
                'subject': action_item,
                'description': f"Task extracted from email: {email_data.get('subject_text', '')}",
                'task_type': self._determine_task_type(nano_result['classification']),
                'priority': nano_result['urgency'].upper(),
                'due_date': self._estimate_due_date(nano_result['urgency']),
                'confidence': nano_result['confidence']
            }
            tasks.append(task)
        
        return tasks
    
    def _determine_task_type(self, classification: str) -> str:
        """Map classification to task type"""
        mapping = {
            'needs_reply': 'reply',
            'approval_required': 'approval',
            'create_task': 'development',
            'delegate': 'delegation',
            'meeting': 'meeting'
        }
        return mapping.get(classification, 'follow-up')
    
    def _estimate_due_date(self, urgency: str) -> Optional[str]:
        """Estimate due date based on urgency"""
        now = datetime.now()
        
        if urgency == 'critical':
            due_date = now + timedelta(hours=2)
        elif urgency == 'high':
            due_date = now + timedelta(days=1)
        elif urgency == 'medium':
            due_date = now + timedelta(days=3)
        else:
            due_date = now + timedelta(days=7)
        
        return due_date.isoformat()

# ============================================================================
# Main Email Batch Processor
# ============================================================================

class EmailBatchProcessor:
    """Main batch processor for email intelligence"""
    
    def __init__(self, database_url: str = None, config: ProcessingConfig = None):
        self.database_url = database_url or "postgresql+asyncpg://localhost/email_intelligence"
        self.config = config or ProcessingConfig()
        self.engine = None
        self.ai_processor = MockAIProcessor(self.config)
        self.mail_reader = EnhancedAppleMailReader(self.config)
        self.stats = {
            'processed': 0,
            'failed': 0,
            'skipped': 0,
            'start_time': None,
            'errors': []
        }
    
    async def initialize(self):
        """Initialize database connection and AI processor"""
        logger.info("Initializing email batch processor")
        
        self.engine = create_async_engine(
            self.database_url,
            pool_size=20,
            max_overflow=30,
            pool_pre_ping=True
        )
        
        await self.ai_processor.initialize()
        logger.info("Email batch processor initialized")
    
    async def close(self):
        """Clean up resources"""
        if self.ai_processor:
            await self.ai_processor.close()
        if self.engine:
            await self.engine.dispose()
    
    async def process_date_range(self, 
                               start_date: datetime, 
                               end_date: datetime,
                               batch_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Process all emails in the specified date range
        """
        self.stats['start_time'] = time.time()
        logger.info(f"Starting batch processing: {start_date} to {end_date}")
        
        try:
            # Update batch status to processing
            if batch_id:
                await self._update_batch_status(batch_id, 'processing')
            
            # Process emails in chunks
            async for email_batch in self._get_email_batches(start_date, end_date):
                await self._process_email_batch(email_batch, batch_id)
            
            # Final batch update
            if batch_id:
                await self._update_batch_status(batch_id, 'completed')
            
            # Update performance metrics
            await self._update_performance_metrics()
            
            processing_time = time.time() - self.stats['start_time']
            
            result = {
                'status': 'completed',
                'processed_emails': self.stats['processed'],
                'failed_emails': self.stats['failed'],
                'skipped_emails': self.stats['skipped'],
                'processing_time_seconds': processing_time,
                'emails_per_second': self.stats['processed'] / processing_time if processing_time > 0 else 0,
                'errors': self.stats['errors'][:10]  # Return first 10 errors
            }
            
            logger.info(f"Batch processing completed: {result}")
            return result
            
        except Exception as e:
            logger.error(f"Batch processing failed: {e}")
            if batch_id:
                await self._update_batch_status(batch_id, 'failed', str(e))
            raise
    
    async def _get_email_batches(self, start_date: datetime, 
                               end_date: datetime) -> AsyncIterator[List[Dict[str, Any]]]:
        """Get emails in batches for processing"""
        current_batch = []
        
        async for email_data in self.mail_reader.get_emails_in_date_range(start_date, end_date):
            current_batch.append(email_data)
            
            if len(current_batch) >= self.config.batch_size:
                yield current_batch
                current_batch = []
        
        # Yield remaining emails
        if current_batch:
            yield current_batch
    
    async def _process_email_batch(self, email_batch: List[Dict[str, Any]], 
                                 batch_id: Optional[int] = None):
        """Process a batch of emails concurrently"""
        logger.info(f"Processing batch of {len(email_batch)} emails")
        
        # Create semaphore to limit concurrent processing
        semaphore = asyncio.Semaphore(self.config.max_workers)
        
        # Process emails concurrently
        tasks = [
            self._process_single_email_with_semaphore(semaphore, email_data)
            for email_data in email_batch
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Update statistics
        for result in results:
            if isinstance(result, Exception):
                self.stats['failed'] += 1
                self.stats['errors'].append(str(result))
            elif result:
                self.stats['processed'] += 1
            else:
                self.stats['skipped'] += 1
        
        # Update batch progress
        if batch_id:
            await self._update_batch_progress(batch_id, len(email_batch))
    
    async def _process_single_email_with_semaphore(self, semaphore: asyncio.Semaphore,
                                                 email_data: Dict[str, Any]) -> bool:
        """Process single email with concurrency control"""
        async with semaphore:
            return await self._process_single_email(email_data)
    
    async def _process_single_email(self, email_data: Dict[str, Any]) -> bool:
        """Process a single email through the AI pipeline"""
        try:
            # Check if email already processed
            async with AsyncSession(self.engine) as session:
                existing = await session.execute(
                    select(Email).where(Email.message_id == email_data['message_id'])
                )
                if existing.scalar_one_or_none():
                    return False  # Skip already processed
            
            # Step 1: Fast classification with nano
            nano_result = await self.ai_processor.classify_email_nano(email_data)
            
            # Step 2: Conditional detailed analysis with mini
            mini_result = None
            if nano_result['urgency'] in ['critical', 'high'] or \
               nano_result['classification'] in ['needs_reply', 'approval_required', 'create_task']:
                mini_result = await self.ai_processor.analyze_email_mini(email_data, nano_result)
            
            # Step 3: Store in database
            await self._store_processed_email(email_data, nano_result, mini_result)
            
            return True
            
        except Exception as e:
            logger.error(f"Error processing email {email_data.get('message_id', 'unknown')}: {e}")
            raise
    
    async def _store_processed_email(self, email_data: Dict[str, Any],
                                   nano_result: Dict[str, Any],
                                   mini_result: Optional[Dict[str, Any]]):
        """Store processed email and intelligence in database"""
        async with AsyncSession(self.engine) as session:
            try:
                # Create email record
                email = Email(
                    message_id=email_data['message_id'],
                    apple_document_id=email_data.get('document_id'),
                    subject_text=email_data.get('subject_text', ''),
                    sender_email=email_data.get('sender_email', ''),
                    sender_name=email_data.get('sender_name', ''),
                    date_sent=datetime.fromisoformat(email_data['date_sent']) if email_data.get('date_sent') else None,
                    date_received=datetime.fromisoformat(email_data['date_received']),
                    is_read=email_data.get('is_read', False),
                    is_flagged=email_data.get('is_flagged', False),
                    mailbox_path=email_data.get('mailbox_path', ''),
                    size_bytes=email_data.get('size', 0),
                    snippet=email_data.get('snippet', ''),
                    processing_status='completed',
                    processed_at=datetime.now()
                )
                
                session.add(email)
                await session.flush()  # Get the email ID
                
                # Create intelligence record
                intelligence = EmailIntelligence(
                    email_id=email.id,
                    classification=nano_result['classification'],
                    urgency=nano_result['urgency'],
                    sentiment=nano_result['sentiment'],
                    overall_confidence=nano_result['confidence'],
                    processing_time_ms=nano_result['processing_time_ms'],
                    action_items=nano_result.get('action_items', []),
                    key_entities=nano_result.get('key_entities', []),
                    summary=nano_result.get('summary', ''),
                    ai_model_used=self.config.nano_model
                )
                
                # Add mini analysis if available
                if mini_result:
                    intelligence.detailed_summary = mini_result.get('detailed_summary')
                    intelligence.context_analysis = mini_result.get('context_analysis')
                    intelligence.draft_reply = mini_result.get('suggested_response')
                    intelligence.priority_reasoning = mini_result.get('priority_reasoning')
                    intelligence.processing_time_ms += mini_result.get('processing_time_ms', 0)
                
                session.add(intelligence)
                
                # Create tasks if any
                if mini_result and mini_result.get('extracted_tasks'):
                    for i, task_data in enumerate(mini_result['extracted_tasks']):
                        task = EmailTask(
                            task_id=f"email_{email.id}_task_{i}",
                            email_id=email.id,
                            subject=task_data['subject'],
                            description=task_data['description'],
                            task_type=task_data['task_type'],
                            priority=task_data['priority'],
                            due_date=datetime.fromisoformat(task_data['due_date']) if task_data.get('due_date') else None,
                            confidence=task_data.get('confidence', nano_result['confidence']),
                            extracted_from_action_item=i
                        )
                        session.add(task)
                
                await session.commit()
                
            except Exception as e:
                await session.rollback()
                logger.error(f"Error storing email {email_data.get('message_id')}: {e}")
                raise
    
    async def _update_batch_status(self, batch_id: int, status: str, error_msg: str = None):
        """Update batch processing status"""
        async with AsyncSession(self.engine) as session:
            batch = await session.get(EmailBatch, batch_id)
            if batch:
                batch.status = status
                if status == 'completed':
                    batch.completed_at = datetime.now()
                    batch.processing_time_seconds = int(time.time() - self.stats['start_time'])
                elif status == 'failed' and error_msg:
                    batch.last_error = error_msg
                    batch.error_count += 1
                
                await session.commit()
    
    async def _update_batch_progress(self, batch_id: int, processed_count: int):
        """Update batch processing progress"""
        async with AsyncSession(self.engine) as session:
            batch = await session.get(EmailBatch, batch_id)
            if batch:
                batch.processed_emails += processed_count
                await session.commit()
    
    async def _update_performance_metrics(self):
        """Update system performance metrics"""
        current_hour = datetime.now().hour
        current_date = datetime.now().date()
        
        async with AsyncSession(self.engine) as session:
            # Upsert performance metrics
            stmt = insert(PerformanceMetric).values(
                metric_date=current_date,
                metric_hour=current_hour,
                emails_processed=self.stats['processed'],
                average_processing_time_ms=self._calculate_avg_processing_time()
            )
            
            stmt = stmt.on_conflict_do_update(
                index_elements=['metric_date', 'metric_hour'],
                set_=dict(
                    emails_processed=PerformanceMetric.emails_processed + self.stats['processed'],
                    average_processing_time_ms=stmt.excluded.average_processing_time_ms
                )
            )
            
            await session.execute(stmt)
            await session.commit()
    
    def _calculate_avg_processing_time(self) -> float:
        """Calculate average processing time per email"""
        if self.stats['processed'] > 0:
            total_time = (time.time() - self.stats['start_time']) * 1000  # Convert to ms
            return total_time / self.stats['processed']
        return 0.0

# ============================================================================
# CLI Interface
# ============================================================================

async def main():
    """Main CLI interface for batch processing"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Email Intelligence Batch Processor")
    parser.add_argument("--start-date", type=str, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, help="End date (YYYY-MM-DD)")
    parser.add_argument("--months", type=int, default=2, help="Months back from now (default: 2)")
    parser.add_argument("--batch-size", type=int, default=100, help="Batch size (default: 100)")
    parser.add_argument("--workers", type=int, default=10, help="Max workers (default: 10)")
    parser.add_argument("--database-url", type=str, help="Database URL")
    
    args = parser.parse_args()
    
    # Calculate date range
    if args.start_date and args.end_date:
        start_date = datetime.fromisoformat(args.start_date)
        end_date = datetime.fromisoformat(args.end_date)
    else:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=args.months * 30)
    
    # Create config
    config = ProcessingConfig(
        batch_size=args.batch_size,
        max_workers=args.workers
    )
    
    # Initialize and run processor
    processor = EmailBatchProcessor(
        database_url=args.database_url,
        config=config
    )
    
    try:
        await processor.initialize()
        result = await processor.process_date_range(start_date, end_date)
        
        print("\n" + "="*60)
        print("EMAIL BATCH PROCESSING RESULTS")
        print("="*60)
        print(f"Date Range: {start_date.date()} to {end_date.date()}")
        print(f"Processed: {result['processed_emails']} emails")
        print(f"Failed: {result['failed_emails']} emails")
        print(f"Processing Time: {result['processing_time_seconds']:.2f} seconds")
        print(f"Rate: {result['emails_per_second']:.2f} emails/second")
        
        if result['errors']:
            print(f"\nFirst {len(result['errors'])} errors:")
            for error in result['errors']:
                print(f"  - {error}")
        
    except Exception as e:
        logger.error(f"Batch processing failed: {e}")
        return 1
    finally:
        await processor.close()
    
    return 0

if __name__ == "__main__":
    import sys
    sys.exit(asyncio.run(main()))
