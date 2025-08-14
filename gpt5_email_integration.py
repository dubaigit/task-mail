#!/usr/bin/env python3
"""
GPT-5 Email Integration Module
=============================

Integration layer connecting GPT-5 email processor with the existing email management system.
Provides seamless integration with mail tools, database storage, and real-time processing.
"""

import asyncio
import json
import logging
import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any
import traceback

# Import existing components
try:
    from email_processor_gpt5 import GPT5EmailProcessor, GPT5EmailClass, TaskPriority
    from email_intelligence_engine import EmailIntelligenceEngine
    from mail_tool import MailTool
    from performance_cache import PerformanceCache
except ImportError as e:
    print(f"Import warning: {e}")
    print("Some features may not be available")

class GPT5EmailIntegration:
    """
    Integration layer for GPT-5 email processing with existing systems.
    
    Features:
    - Seamless integration with existing mail tools
    - Database storage for analysis results
    - Real-time processing pipeline
    - Performance caching
    - Batch processing capabilities
    - User preference learning
    """
    
    def __init__(self, config_file: Optional[str] = None):
        self.config = self._load_config(config_file)
        self.logger = self._setup_logging()
        
        # Initialize components
        self.gpt5_processor = GPT5EmailProcessor(self.config.get('gpt5_settings', {}))
        self.mail_tool = None
        self.cache = PerformanceCache() if 'PerformanceCache' in globals() else None
        
        # Database setup
        self.db_path = self.config.get('database_path', 'gpt5_email_analysis.db')
        self._setup_database()
        
        # Processing queue
        self.processing_queue = asyncio.Queue()
        self.is_processing = False
        
        # Statistics
        self.stats = {
            'emails_processed': 0,
            'drafts_generated': 0,
            'tasks_extracted': 0,
            'avg_processing_time': 0.0,
            'last_processed': None
        }
        
        self.logger.info("GPT-5 Email Integration initialized")
    
    def _load_config(self, config_file: Optional[str]) -> Dict[str, Any]:
        """Load configuration from file or defaults"""
        default_config = {
            'gpt5_settings': {
                'user_name': 'Abdullah',
                'signature': 'Regards Abdullah',
                'greeting_prefix': 'D'
            },
            'database_path': 'gpt5_email_analysis.db',
            'batch_size': 10,
            'auto_process': True,
            'draft_auto_generate': True,
            'cache_enabled': True,
            'logging_level': 'INFO'
        }
        
        if config_file and Path(config_file).exists():
            try:
                with open(config_file, 'r') as f:
                    user_config = json.load(f)
                    default_config.update(user_config)
            except Exception as e:
                print(f"Warning: Could not load config file {config_file}: {e}")
        
        return default_config
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging for integration module"""
        logger = logging.getLogger("GPT5Integration")
        level = getattr(logging, self.config.get('logging_level', 'INFO'))
        logger.setLevel(level)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _setup_database(self):
        """Setup SQLite database for storing analysis results"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create tables
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS email_analysis (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email_id TEXT UNIQUE,
                    subject TEXT,
                    sender TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    classification TEXT,
                    confidence REAL,
                    urgency TEXT,
                    sentiment TEXT,
                    intent TEXT,
                    summary TEXT,
                    key_points TEXT,
                    tasks TEXT,
                    action_items TEXT,
                    deadlines TEXT,
                    tags TEXT,
                    processing_time_ms REAL,
                    ai_reasoning TEXT,
                    raw_analysis TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS draft_replies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email_id TEXT,
                    draft_content TEXT,
                    tone TEXT,
                    confidence REAL,
                    key_points_addressed TEXT,
                    suggested_actions TEXT,
                    requires_review BOOLEAN,
                    generated_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                    user_feedback TEXT,
                    FOREIGN KEY (email_id) REFERENCES email_analysis (email_id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS processing_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date DATE DEFAULT CURRENT_DATE,
                    emails_processed INTEGER DEFAULT 0,
                    drafts_generated INTEGER DEFAULT 0,
                    avg_processing_time REAL DEFAULT 0.0,
                    classification_accuracy REAL DEFAULT 0.0,
                    user_corrections INTEGER DEFAULT 0
                )
            ''')
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Database setup failed: {e}")
            raise
    
    async def process_email(self, email_data: Dict[str, Any], generate_draft: bool = True) -> Dict[str, Any]:
        """
        Process a single email with GPT-5 analysis and optional draft generation.
        
        Args:
            email_data: Email data with subject, body, sender, etc.
            generate_draft: Whether to generate a draft reply
            
        Returns:
            Complete processing result with analysis and optional draft
        """
        start_time = datetime.now()
        email_id = email_data.get('id', f"email_{int(start_time.timestamp())}")
        
        try:
            # Check cache first
            if self.cache:
                cached_result = self.cache.get(f"analysis_{email_id}")
                if cached_result:
                    self.logger.info(f"Using cached analysis for {email_id}")
                    return cached_result
            
            # Analyze email with GPT-5
            self.logger.info(f"Processing email {email_id} with GPT-5")
            analysis = await self.gpt5_processor.analyze_email_async(email_data)
            
            # Generate draft if requested
            draft = None
            if generate_draft and analysis.classification in [
                GPT5EmailClass.REPLY, 
                GPT5EmailClass.TASK, 
                GPT5EmailClass.APPROVAL,
                GPT5EmailClass.FOLLOW_UP
            ]:
                draft = await self.gpt5_processor.generate_draft_reply_gpt5(email_data, analysis)
            
            # Store in database
            await self._store_analysis(email_id, email_data, analysis, draft)
            
            # Update statistics
            self._update_stats(analysis.processing_time_ms, draft is not None)
            
            # Prepare result
            result = {
                'email_id': email_id,
                'analysis': {
                    'classification': analysis.classification.value,
                    'confidence': analysis.confidence,
                    'urgency': analysis.urgency.value,
                    'sentiment': analysis.sentiment.value,
                    'intent': analysis.intent,
                    'summary': analysis.summary,
                    'key_points': analysis.key_points,
                    'tasks': [
                        {
                            'description': task.description,
                            'priority': task.priority.value,
                            'deadline': task.deadline.isoformat() if task.deadline else None,
                            'assignee': task.assignee,
                            'estimated_hours': task.estimated_hours,
                            'context': task.context
                        } for task in analysis.tasks
                    ],
                    'action_items': analysis.action_items,
                    'deadlines': [
                        {'date': dt.isoformat(), 'context': ctx} 
                        for dt, ctx in analysis.deadlines
                    ],
                    'tags': analysis.tags,
                    'processing_time_ms': analysis.processing_time_ms,
                    'ai_reasoning': analysis.ai_reasoning
                },
                'draft': {
                    'content': draft.content,
                    'tone': draft.tone,
                    'confidence': draft.confidence,
                    'requires_review': draft.requires_review,
                    'key_points_addressed': draft.key_points_addressed,
                    'suggested_actions': draft.suggested_actions
                } if draft else None,
                'processing_metadata': {
                    'processed_at': start_time.isoformat(),
                    'processing_time_total_ms': (datetime.now() - start_time).total_seconds() * 1000,
                    'gpt5_models_used': {
                        'classifier': self.gpt5_processor.classifier_model,
                        'draft_generator': self.gpt5_processor.draft_model
                    }
                }
            }
            
            # Cache result
            if self.cache:
                self.cache.set(f"analysis_{email_id}", result, ttl=3600)  # 1 hour TTL
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error processing email {email_id}: {e}")
            self.logger.error(traceback.format_exc())
            
            # Return error result
            return {
                'email_id': email_id,
                'error': str(e),
                'processing_metadata': {
                    'processed_at': start_time.isoformat(),
                    'error_occurred': True
                }
            }
    
    async def process_email_batch(self, emails: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Process multiple emails in batch"""
        self.logger.info(f"Processing batch of {len(emails)} emails")
        
        batch_size = self.config.get('batch_size', 10)
        results = []
        
        # Process in chunks to avoid overwhelming the API
        for i in range(0, len(emails), batch_size):
            chunk = emails[i:i + batch_size]
            
            # Process chunk concurrently
            chunk_tasks = [
                self.process_email(email, generate_draft=False)  # Skip drafts in batch for speed
                for email in chunk
            ]
            
            chunk_results = await asyncio.gather(*chunk_tasks, return_exceptions=True)
            
            for result in chunk_results:
                if isinstance(result, Exception):
                    self.logger.error(f"Batch processing error: {result}")
                    results.append({'error': str(result)})
                else:
                    results.append(result)
            
            # Small delay between chunks to be API-friendly
            if i + batch_size < len(emails):
                await asyncio.sleep(0.5)
        
        return results
    
    async def _store_analysis(self, email_id: str, email_data: Dict, analysis, draft):
        """Store analysis results in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Store analysis
            cursor.execute('''
                INSERT OR REPLACE INTO email_analysis (
                    email_id, subject, sender, classification, confidence,
                    urgency, sentiment, intent, summary, key_points,
                    tasks, action_items, deadlines, tags,
                    processing_time_ms, ai_reasoning, raw_analysis
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                email_id,
                email_data.get('subject', ''),
                email_data.get('sender', ''),
                analysis.classification.value,
                analysis.confidence,
                analysis.urgency.value,
                analysis.sentiment.value,
                analysis.intent,
                analysis.summary,
                json.dumps(analysis.key_points),
                json.dumps([{
                    'description': t.description,
                    'priority': t.priority.value,
                    'deadline': t.deadline.isoformat() if t.deadline else None,
                    'assignee': t.assignee,
                    'context': t.context
                } for t in analysis.tasks]),
                json.dumps(analysis.action_items),
                json.dumps([{'date': dt.isoformat(), 'context': ctx} for dt, ctx in analysis.deadlines]),
                json.dumps(analysis.tags),
                analysis.processing_time_ms,
                analysis.ai_reasoning,
                json.dumps(analysis.__dict__, default=str)
            ))
            
            # Store draft if generated
            if draft:
                cursor.execute('''
                    INSERT INTO draft_replies (
                        email_id, draft_content, tone, confidence,
                        key_points_addressed, suggested_actions, requires_review
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    email_id,
                    draft.content,
                    draft.tone,
                    draft.confidence,
                    json.dumps(draft.key_points_addressed),
                    json.dumps(draft.suggested_actions),
                    draft.requires_review
                ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Database storage error: {e}")
    
    def _update_stats(self, processing_time: float, draft_generated: bool):
        """Update processing statistics"""
        self.stats['emails_processed'] += 1
        if draft_generated:
            self.stats['drafts_generated'] += 1
        
        # Update average processing time
        if self.stats['avg_processing_time'] == 0:
            self.stats['avg_processing_time'] = processing_time
        else:
            self.stats['avg_processing_time'] = (
                self.stats['avg_processing_time'] * 0.9 + processing_time * 0.1
            )
        
        self.stats['last_processed'] = datetime.now().isoformat()
    
    async def get_email_analysis(self, email_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve stored analysis for an email"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM email_analysis WHERE email_id = ?
            ''', (email_id,))
            
            row = cursor.fetchone()
            if row:
                columns = [desc[0] for desc in cursor.description]
                result = dict(zip(columns, row))
                
                # Parse JSON fields
                for field in ['key_points', 'tasks', 'action_items', 'deadlines', 'tags']:
                    if result[field]:
                        try:
                            result[field] = json.loads(result[field])
                        except json.JSONDecodeError:
                            result[field] = []
                
                conn.close()
                return result
            
            conn.close()
            return None
            
        except Exception as e:
            self.logger.error(f"Error retrieving analysis: {e}")
            return None
    
    async def get_draft_reply(self, email_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve stored draft reply for an email"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM draft_replies WHERE email_id = ? 
                ORDER BY generated_timestamp DESC LIMIT 1
            ''', (email_id,))
            
            row = cursor.fetchone()
            if row:
                columns = [desc[0] for desc in cursor.description]
                result = dict(zip(columns, row))
                
                # Parse JSON fields
                for field in ['key_points_addressed', 'suggested_actions']:
                    if result[field]:
                        try:
                            result[field] = json.loads(result[field])
                        except json.JSONDecodeError:
                            result[field] = []
                
                conn.close()
                return result
            
            conn.close()
            return None
            
        except Exception as e:
            self.logger.error(f"Error retrieving draft: {e}")
            return None
    
    def get_integration_stats(self) -> Dict[str, Any]:
        """Get comprehensive integration statistics"""
        return {
            'integration_stats': self.stats,
            'gpt5_processor_stats': self.gpt5_processor.get_processing_stats(),
            'database_path': self.db_path,
            'cache_enabled': self.cache is not None,
            'config': self.config
        }
    
    async def learn_from_user_feedback(self, email_id: str, feedback: Dict[str, Any]):
        """Learn from user corrections and feedback"""
        try:
            # Get original analysis
            analysis_data = await self.get_email_analysis(email_id)
            if not analysis_data:
                self.logger.warning(f"No analysis found for email {email_id}")
                return
            
            # Create correction data for GPT-5 processor
            correction_data = {
                'classification': feedback.get('corrected_classification'),
                'confidence_adjustment': feedback.get('confidence_adjustment'),
                'subject_keywords': feedback.get('subject_keywords', []),
                'body_keywords': feedback.get('body_keywords', []),
                'sender_domain': feedback.get('sender_domain', '')
            }
            
            # Pass to GPT-5 processor for learning
            original_analysis = await self.gpt5_processor.analyze_email_async({
                'subject': analysis_data['subject'],
                'sender': analysis_data['sender']
            })
            
            self.gpt5_processor.learn_from_correction(original_analysis, correction_data)
            
            # Store feedback in database
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE draft_replies SET user_feedback = ? 
                WHERE email_id = ?
            ''', (json.dumps(feedback), email_id))
            
            conn.commit()
            conn.close()
            
            self.logger.info(f"Learned from user feedback for email {email_id}")
            
        except Exception as e:
            self.logger.error(f"Error processing user feedback: {e}")
    
    async def start_background_processing(self):
        """Start background processing of queued emails"""
        self.is_processing = True
        
        while self.is_processing:
            try:
                # Wait for email to process
                email_data = await asyncio.wait_for(
                    self.processing_queue.get(), 
                    timeout=1.0
                )
                
                # Process the email
                result = await self.process_email(email_data)
                
                # Mark task as done
                self.processing_queue.task_done()
                
                self.logger.info(f"Background processed email: {result.get('email_id')}")
                
            except asyncio.TimeoutError:
                # No emails in queue, continue waiting
                continue
            except Exception as e:
                self.logger.error(f"Background processing error: {e}")
    
    def stop_background_processing(self):
        """Stop background processing"""
        self.is_processing = False
    
    async def queue_email_for_processing(self, email_data: Dict[str, Any]):
        """Add email to processing queue"""
        await self.processing_queue.put(email_data)


# CLI interface for testing and management
async def main():
    """CLI interface for GPT-5 integration"""
    import argparse
    
    parser = argparse.ArgumentParser(description="GPT-5 Email Integration")
    parser.add_argument("--config", help="Configuration file path")
    parser.add_argument("--test", action="store_true", help="Run integration test")
    parser.add_argument("--stats", action="store_true", help="Show integration stats")
    parser.add_argument("--process-sample", action="store_true", help="Process sample email")
    parser.add_argument("--email-file", help="Process email from JSON file")
    
    args = parser.parse_args()
    
    # Initialize integration
    integration = GPT5EmailIntegration(args.config)
    
    if args.stats:
        stats = integration.get_integration_stats()
        print("GPT-5 Email Integration Statistics:")
        print(json.dumps(stats, indent=2))
        return
    
    if args.test:
        print("🧪 Running integration test...")
        
        test_email = {
            'id': 'test_email_001',
            'subject': 'URGENT: Budget approval needed for Q4',
            'body': 'Hi Abdullah,\n\nI need urgent approval for the Q4 marketing budget of $50,000. Please confirm by EOD today.\n\nThanks,\nMarketing Team',
            'sender': 'marketing@company.com',
            'timestamp': datetime.now().isoformat()
        }
        
        result = await integration.process_email(test_email, generate_draft=True)
        
        print("Test Results:")
        print(json.dumps(result, indent=2))
        return
    
    if args.process_sample:
        print("📧 Processing sample email...")
        
        sample_email = {
            'id': f'sample_{int(datetime.now().timestamp())}',
            'subject': 'Project deadline extension request',
            'body': 'Hi Abdullah,\n\nDue to unexpected technical challenges, we need to extend the project deadline by 2 weeks. The new completion date would be March 15th.\n\nPlease approve this extension.\n\nBest regards,\nProject Team',
            'sender': 'project-team@company.com',
            'timestamp': datetime.now().isoformat()
        }
        
        result = await integration.process_email(sample_email, generate_draft=True)
        
        print("Sample Email Processing Result:")
        print(f"Classification: {result['analysis']['classification']}")
        print(f"Confidence: {result['analysis']['confidence']:.2f}")
        print(f"Summary: {result['analysis']['summary']}")
        
        if result.get('draft'):
            print(f"\nGenerated Draft:")
            print("-" * 40)
            print(result['draft']['content'])
            print("-" * 40)
        
        return
    
    if args.email_file:
        print(f"📁 Processing email from file: {args.email_file}")
        
        with open(args.email_file, 'r') as f:
            email_data = json.load(f)
        
        result = await integration.process_email(email_data, generate_draft=True)
        
        print("File Email Processing Result:")
        print(json.dumps(result, indent=2))
        return
    
    print("GPT-5 Email Integration")
    print("Use --help for available options")


if __name__ == "__main__":
    asyncio.run(main())