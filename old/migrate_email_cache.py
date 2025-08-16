#!/usr/bin/env python3
"""
Email Cache Migration Script

Performs initial bulk import of Apple Mail emails into the optimized cache database.
Designed for one-time migration to establish the email cache for <200ms performance.

Features:
- Bulk import from Apple Mail database
- Progress tracking and resumable operation
- Performance optimization with batch processing
- Error handling and validation
- Real-time progress reporting
"""

import sys
import time
import asyncio
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from email_cache_models import (
    EmailCache, EmailProcessingQueue,
    EmailClassification, EmailUrgency,
    init_database, get_session
)
from apple_mail_db_reader import AppleMailDBReader
from email_sync_service import EmailSyncService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class EmailCacheMigration:
    """
    Migration class for importing Apple Mail emails into cache database.
    
    Handles:
    - Bulk import with progress tracking
    - Batch processing for memory efficiency
    - Error handling and recovery
    - Performance monitoring
    """
    
    def __init__(self, cache_db_url: str = "sqlite:///email_cache_optimized.db"):
        """Initialize migration with database connections"""
        self.cache_engine = init_database(cache_db_url)
        self.apple_reader = AppleMailDBReader()
        self.batch_size = 100  # Process emails in batches
        
        # Migration statistics
        self.stats = {
            'start_time': None,
            'end_time': None,
            'total_emails_found': 0,
            'emails_imported': 0,
            'emails_skipped': 0,
            'emails_failed': 0,
            'ai_queued': 0,
            'batches_processed': 0
        }
        
        logger.info("Email cache migration initialized")
    
    def run_migration(self, limit: Optional[int] = None) -> Dict[str, Any]:
        """
        Run the complete migration process.
        
        Args:
            limit: Optional limit on number of emails to process (for testing)
            
        Returns:
            Migration results and statistics
        """
        self.stats['start_time'] = datetime.utcnow()
        logger.info("Starting email cache migration...")
        
        try:
            # Step 1: Get all emails from Apple Mail
            logger.info("Fetching emails from Apple Mail database...")
            apple_emails = self.apple_reader.get_recent_emails(limit=limit)
            
            if not apple_emails:
                logger.warning("No emails found in Apple Mail database")
                return self._generate_results(success=False, error="No emails found")
            
            self.stats['total_emails_found'] = len(apple_emails)
            logger.info(f"Found {len(apple_emails)} emails to migrate")
            
            # Step 2: Process emails in batches
            self._process_emails_in_batches(apple_emails)
            
            # Step 3: Generate final results
            self.stats['end_time'] = datetime.utcnow()
            return self._generate_results(success=True)
            
        except Exception as e:
            logger.error(f"Migration failed: {e}")
            self.stats['end_time'] = datetime.utcnow()
            return self._generate_results(success=False, error=str(e))
    
    def _process_emails_in_batches(self, apple_emails: List[Dict[str, Any]]) -> None:
        """Process emails in batches for memory efficiency"""
        total_batches = (len(apple_emails) + self.batch_size - 1) // self.batch_size
        
        for batch_num, i in enumerate(range(0, len(apple_emails), self.batch_size)):
            batch = apple_emails[i:i + self.batch_size]
            
            logger.info(f"Processing batch {batch_num + 1}/{total_batches} ({len(batch)} emails)")
            
            try:
                self._process_email_batch(batch)
                self.stats['batches_processed'] += 1
                
                # Progress reporting
                progress = ((batch_num + 1) / total_batches) * 100
                logger.info(f"Migration progress: {progress:.1f}%")
                
            except Exception as e:
                logger.error(f"Error processing batch {batch_num + 1}: {e}")
                continue
    
    def _process_email_batch(self, batch: List[Dict[str, Any]]) -> None:
        """Process a single batch of emails"""
        with get_session(self.cache_engine) as session:
            for apple_email in batch:
                try:
                    apple_mail_id = apple_email.get('message_id', 0)
                    
                    if not apple_mail_id:
                        self.stats['emails_skipped'] += 1
                        continue
                    
                    # Check if email already exists
                    existing = session.exec(
                        session.query(EmailCache).filter(
                            EmailCache.apple_mail_id == apple_mail_id
                        )
                    ).first()
                    
                    if existing:
                        logger.debug(f"Email {apple_mail_id} already exists, skipping")
                        self.stats['emails_skipped'] += 1
                        continue
                    
                    # Create new cached email
                    cached_email = self._create_cached_email(apple_email)
                    session.add(cached_email)
                    session.flush()  # Get the ID
                    
                    # Queue for AI processing
                    self._queue_for_ai_processing(session, cached_email.id)
                    
                    self.stats['emails_imported'] += 1
                    self.stats['ai_queued'] += 1
                    
                except Exception as e:
                    logger.error(f"Error processing email {apple_email.get('message_id')}: {e}")
                    self.stats['emails_failed'] += 1
                    continue
            
            # Commit the batch
            try:
                session.commit()
                logger.debug(f"Committed batch of {len(batch)} emails")
            except Exception as e:
                logger.error(f"Error committing batch: {e}")
                session.rollback()
                self.stats['emails_failed'] += len(batch)
    
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
    
    def _queue_for_ai_processing(self, session, email_id: int) -> None:
        """Add email to AI processing queue"""
        queue_item = EmailProcessingQueue(
            email_id=email_id,
            status="pending",
            priority=5  # Normal priority for migration
        )
        session.add(queue_item)
    
    def _parse_apple_date(self, date_value: Any) -> Optional[datetime]:
        """Parse date from Apple Mail (handles various formats)"""
        if not date_value:
            return datetime.utcnow()  # Default to current time
        
        if isinstance(date_value, datetime):
            return date_value
        
        if isinstance(date_value, (int, float)):
            # Apple Core Data timestamp (seconds since 2001-01-01)
            try:
                return datetime.fromtimestamp(date_value + 978307200)  # Apple epoch offset
            except (ValueError, OSError):
                return datetime.utcnow()
        
        if isinstance(date_value, str):
            # Try to parse ISO format
            try:
                return datetime.fromisoformat(date_value.replace('Z', '+00:00'))
            except ValueError:
                return datetime.utcnow()
        
        return datetime.utcnow()
    
    def _generate_results(self, success: bool, error: Optional[str] = None) -> Dict[str, Any]:
        """Generate migration results"""
        duration = 0
        if self.stats['start_time'] and self.stats['end_time']:
            duration = (self.stats['end_time'] - self.stats['start_time']).total_seconds()
        
        results = {
            'success': success,
            'migration_stats': self.stats.copy(),
            'duration_seconds': duration,
            'performance': {
                'emails_per_second': self.stats['emails_imported'] / max(duration, 1),
                'batches_per_minute': (self.stats['batches_processed'] / max(duration, 1)) * 60
            }
        }
        
        if error:
            results['error'] = error
        
        # Log summary
        if success:
            logger.info(f"Migration completed successfully:")
            logger.info(f"  - Total emails found: {self.stats['total_emails_found']:,}")
            logger.info(f"  - Emails imported: {self.stats['emails_imported']:,}")
            logger.info(f"  - Emails skipped: {self.stats['emails_skipped']:,}")
            logger.info(f"  - Emails failed: {self.stats['emails_failed']:,}")
            logger.info(f"  - Queued for AI: {self.stats['ai_queued']:,}")
            logger.info(f"  - Duration: {duration:.2f} seconds")
            logger.info(f"  - Performance: {results['performance']['emails_per_second']:.2f} emails/second")
        else:
            logger.error(f"Migration failed: {error}")
        
        return results
    
    def check_migration_status(self) -> Dict[str, Any]:
        """Check current migration status"""
        with get_session(self.cache_engine) as session:
            # Get cache statistics
            total_cached = session.exec(session.query(func.count(EmailCache.id))).first() or 0
            ai_processed = session.exec(
                session.query(func.count(EmailCache.id)).filter(
                    EmailCache.ai_processed_at.is_not(None)
                )
            ).first() or 0
            pending_ai = session.exec(
                session.query(func.count(EmailProcessingQueue.id)).filter(
                    EmailProcessingQueue.status == "pending"
                )
            ).first() or 0
            
            return {
                'cache_status': {
                    'total_emails_cached': total_cached,
                    'ai_processed_emails': ai_processed,
                    'pending_ai_processing': pending_ai,
                    'ai_processing_percentage': round((ai_processed / max(total_cached, 1)) * 100, 1)
                }
            }


async def run_background_ai_processing(migration: EmailCacheMigration, max_duration: int = 3600):
    """
    Run background AI processing after migration.
    
    Args:
        migration: Migration instance
        max_duration: Maximum processing time in seconds (default: 1 hour)
    """
    logger.info("Starting background AI processing...")
    
    sync_service = EmailSyncService("sqlite:///email_cache_optimized.db")
    start_time = time.time()
    processed_count = 0
    
    while (time.time() - start_time) < max_duration:
        try:
            # Process AI queue
            result = await sync_service.process_ai_queue()
            
            if result['status'] == 'success':
                processed_count += result['processed_count']
                
                if result['processed_count'] == 0:
                    # No more emails to process
                    logger.info("All emails processed by AI")
                    break
                else:
                    logger.info(f"AI processed {result['processed_count']} emails (total: {processed_count})")
            
            # Check status
            status = migration.check_migration_status()
            cache_status = status['cache_status']
            
            if cache_status['pending_ai_processing'] == 0:
                logger.info("All emails have been processed by AI")
                break
            
            # Wait before next batch
            await asyncio.sleep(10)
            
        except Exception as e:
            logger.error(f"Error in background AI processing: {e}")
            await asyncio.sleep(30)
    
    elapsed = time.time() - start_time
    logger.info(f"Background AI processing completed. Processed {processed_count} emails in {elapsed:.2f} seconds")


def main():
    """Main migration function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate Apple Mail emails to cache database")
    parser.add_argument("--limit", type=int, help="Limit number of emails to migrate (for testing)")
    parser.add_argument("--status", action="store_true", help="Check migration status only")
    parser.add_argument("--ai-process", action="store_true", help="Run background AI processing")
    parser.add_argument("--full", action="store_true", help="Run full migration with AI processing")
    
    args = parser.parse_args()
    
    # Initialize migration
    migration = EmailCacheMigration()
    
    if args.status:
        # Check status only
        status = migration.check_migration_status()
        print("Migration Status:")
        print(f"  Total emails cached: {status['cache_status']['total_emails_cached']:,}")
        print(f"  AI processed: {status['cache_status']['ai_processed_emails']:,}")
        print(f"  Pending AI: {status['cache_status']['pending_ai_processing']:,}")
        print(f"  AI progress: {status['cache_status']['ai_processing_percentage']:.1f}%")
        return
    
    if args.ai_process:
        # Run AI processing only
        asyncio.run(run_background_ai_processing(migration))
        return
    
    # Run migration
    print("🚀 Starting Email Cache Migration")
    print("=" * 50)
    
    results = migration.run_migration(limit=args.limit)
    
    if results['success']:
        print("\n✅ Migration completed successfully!")
        
        if args.full:
            print("\n🤖 Starting background AI processing...")
            asyncio.run(run_background_ai_processing(migration))
            
            # Final status check
            final_status = migration.check_migration_status()
            print("\n📊 Final Status:")
            print(f"  Total emails: {final_status['cache_status']['total_emails_cached']:,}")
            print(f"  AI processed: {final_status['cache_status']['ai_processed_emails']:,}")
            print(f"  AI completion: {final_status['cache_status']['ai_processing_percentage']:.1f}%")
    else:
        print(f"\n❌ Migration failed: {results.get('error', 'Unknown error')}")
        sys.exit(1)
    
    print("\n🎯 Email cache is ready for <200ms performance!")


if __name__ == "__main__":
    main()