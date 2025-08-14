#!/usr/bin/env python3
"""
Email Intelligence System - Dual Model Architecture
Uses GPT-5-nano for real-time classification and GPT-5-mini for detailed processing
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
import hashlib
from collections import defaultdict
import re
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
import sqlite3
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# Data Models
# ============================================================================

class EmailCategory(Enum):
    """Email categories for classification"""
    NEEDS_REPLY = "needs_reply"
    TASK = "task"
    DELEGATE = "delegate"
    FYI = "fyi"
    NEWSLETTER = "newsletter"
    PROMOTIONAL = "promotional"
    AUTOMATED = "automated"
    URGENT = "urgent"
    MEETING = "meeting"
    PROJECT = "project"
    PERSONAL = "personal"
    SPAM = "spam"

class Urgency(Enum):
    """Urgency levels"""
    CRITICAL = 5  # Immediate action required
    HIGH = 4      # Within 2 hours
    MEDIUM = 3    # Within 24 hours
    LOW = 2       # Within 3 days
    NONE = 1      # No urgency

class Sentiment(Enum):
    """Basic sentiment categories"""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    CONCERNED = "concerned"
    EXCITED = "excited"
    FRUSTRATED = "frustrated"

@dataclass
class EmailMetadata:
    """Email metadata structure"""
    id: str
    from_address: str
    to_addresses: List[str]
    cc_addresses: List[str] = field(default_factory=list)
    subject: str = ""
    date: datetime = field(default_factory=datetime.now)
    thread_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    attachments: List[str] = field(default_factory=list)
    size_bytes: int = 0

@dataclass
class NanoClassification:
    """Fast classification results from nano model"""
    category: EmailCategory
    urgency: Urgency
    sentiment: Sentiment
    action_items: List[str]
    key_entities: List[str]  # People, companies, dates mentioned
    confidence: float
    processing_time_ms: float
    needs_detailed_analysis: bool
    summary: str  # One-line summary

@dataclass
class MiniAnalysis:
    """Detailed analysis from mini model"""
    detailed_summary: str
    context_analysis: str
    suggested_response: Optional[str]
    extracted_tasks: List[Dict[str, Any]]
    meeting_details: Optional[Dict[str, Any]]
    decision_points: List[str]
    follow_up_items: List[Dict[str, Any]]
    tone_analysis: Dict[str, float]
    relationship_context: str
    priority_reasoning: str
    processing_time_ms: float

@dataclass
class ProcessedEmail:
    """Complete processed email with both analyses"""
    metadata: EmailMetadata
    content: str
    nano_classification: NanoClassification
    mini_analysis: Optional[MiniAnalysis]
    processed_at: datetime = field(default_factory=datetime.now)
    total_processing_time_ms: float = 0

# ============================================================================
# Model Interfaces
# ============================================================================

class GPT5NanoProcessor:
    """Fast email processor using GPT-5-nano for real-time classification"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.cache = {}  # Simple in-memory cache
        self.performance_stats = defaultdict(list)
    
    async def classify_email(self, email_content: str, metadata: EmailMetadata) -> NanoClassification:
        """
        Fast classification of email (<100ms target)
        """
        start_time = time.time()
        
        # Check cache first
        cache_key = self._generate_cache_key(email_content)
        if cache_key in self.cache:
            cached = self.cache[cache_key]
            cached.processing_time_ms = 0  # Indicate cache hit
            return cached
        
        # Prepare optimized prompt for nano
        prompt = self._build_nano_prompt(email_content, metadata)
        
        # Simulate API call (replace with actual implementation)
        classification = await self._call_nano_api(prompt)
        
        processing_time = (time.time() - start_time) * 1000
        classification.processing_time_ms = processing_time
        
        # Update cache and stats
        self.cache[cache_key] = classification
        self.performance_stats['classification_times'].append(processing_time)
        
        # Determine if detailed analysis is needed
        classification.needs_detailed_analysis = self._needs_detailed_analysis(
            classification, email_content
        )
        
        return classification
    
    def _build_nano_prompt(self, content: str, metadata: EmailMetadata) -> str:
        """Build optimized prompt for nano model"""
        # Truncate content for speed (nano processes first 500 chars for classification)
        truncated_content = content[:500] if len(content) > 500 else content
        
        prompt = f"""CLASSIFY EMAIL (respond in JSON):
From: {metadata.from_address}
Subject: {metadata.subject}
Content: {truncated_content}

Return:
{{
  "category": "needs_reply|task|delegate|fyi|newsletter|promotional|automated|urgent|meeting|project|personal|spam",
  "urgency": 1-5,
  "sentiment": "positive|negative|neutral|concerned|excited|frustrated",
  "action_items": ["item1", "item2"],
  "key_entities": ["person/company/date"],
  "confidence": 0.0-1.0,
  "summary": "one line summary"
}}"""
        return prompt
    
    async def _call_nano_api(self, prompt: str) -> NanoClassification:
        """Simulate nano API call - replace with actual implementation"""
        # This would be your actual API call to gpt-5-nano
        await asyncio.sleep(0.05)  # Simulate 50ms API latency
        
        # Mock response - replace with actual API parsing
        return NanoClassification(
            category=EmailCategory.NEEDS_REPLY,
            urgency=Urgency.MEDIUM,
            sentiment=Sentiment.NEUTRAL,
            action_items=["Review proposal", "Send feedback"],
            key_entities=["John Doe", "Acme Corp", "Friday"],
            confidence=0.92,
            processing_time_ms=50,
            needs_detailed_analysis=True,
            summary="Proposal review request from John at Acme Corp"
        )
    
    def _generate_cache_key(self, content: str) -> str:
        """Generate cache key for content"""
        return hashlib.md5(content.encode()).hexdigest()
    
    def _needs_detailed_analysis(self, classification: NanoClassification, content: str) -> bool:
        """Determine if email needs detailed mini model analysis"""
        # Criteria for detailed analysis
        if classification.category in [EmailCategory.NEEDS_REPLY, EmailCategory.TASK, 
                                       EmailCategory.URGENT, EmailCategory.PROJECT]:
            return True
        if classification.urgency.value >= 4:
            return True
        if len(classification.action_items) > 2:
            return True
        if len(content) > 1000:  # Long emails likely need detailed analysis
            return True
        if classification.confidence < 0.8:  # Low confidence needs second opinion
            return True
        return False

class GPT5MiniProcessor:
    """Detailed email processor using GPT-5-mini for thorough analysis"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.user_style_profile = {}
        self.relationship_history = {}
        self.performance_stats = defaultdict(list)
    
    async def analyze_email(self, 
                           email_content: str, 
                           metadata: EmailMetadata,
                           nano_classification: NanoClassification) -> MiniAnalysis:
        """
        Detailed analysis of email including response generation
        """
        start_time = time.time()
        
        # Build comprehensive prompt for mini
        prompt = self._build_mini_prompt(email_content, metadata, nano_classification)
        
        # Call mini API (simulated)
        analysis = await self._call_mini_api(prompt)
        
        # Learn user style from sent emails
        if metadata.from_address in self.user_style_profile:
            analysis.suggested_response = self._apply_user_style(
                analysis.suggested_response
            )
        
        processing_time = (time.time() - start_time) * 1000
        analysis.processing_time_ms = processing_time
        self.performance_stats['analysis_times'].append(processing_time)
        
        return analysis
    
    def _build_mini_prompt(self, 
                          content: str, 
                          metadata: EmailMetadata,
                          nano_classification: NanoClassification) -> str:
        """Build comprehensive prompt for mini model"""
        
        # Include nano's initial classification for context
        prompt = f"""DETAILED EMAIL ANALYSIS:

Email Metadata:
- From: {metadata.from_address}
- Subject: {metadata.subject}
- Date: {metadata.date}
- Thread: {metadata.thread_id or 'New conversation'}

Initial Classification:
- Category: {nano_classification.category.value}
- Urgency: {nano_classification.urgency.name}
- Sentiment: {nano_classification.sentiment.value}

Full Content:
{content}

Provide detailed analysis:
1. Comprehensive summary (2-3 sentences)
2. Context analysis (relationship, history, importance)
3. Suggested response matching user's style
4. Extract all tasks with deadlines
5. Meeting details if applicable
6. Decision points requiring attention
7. Follow-up items with suggested dates
8. Tone analysis (professional, casual, formal, urgent)
9. Priority reasoning

Return as structured JSON."""
        return prompt
    
    async def _call_mini_api(self, prompt: str) -> MiniAnalysis:
        """Simulate mini API call - replace with actual implementation"""
        # This would be your actual API call to gpt-5-mini
        await asyncio.sleep(0.2)  # Simulate 200ms API latency
        
        # Mock response - replace with actual API parsing
        return MiniAnalysis(
            detailed_summary="John from Acme Corp is requesting review of Q4 proposal by Friday. "
                           "The proposal includes three pricing tiers and timeline adjustments.",
            context_analysis="Regular business partner, previous positive interactions, "
                           "typically responds within 24 hours",
            suggested_response="Hi John,\n\nThank you for sending the Q4 proposal. "
                             "I'll review it today and send my feedback by Thursday.\n\n"
                             "Best regards",
            extracted_tasks=[
                {"task": "Review Q4 proposal", "deadline": "Friday", "priority": "high"},
                {"task": "Send feedback to John", "deadline": "Thursday", "priority": "high"}
            ],
            meeting_details=None,
            decision_points=["Approve pricing tier 2 or 3", "Confirm timeline feasibility"],
            follow_up_items=[
                {"item": "Schedule call if questions", "suggested_date": "Thursday PM"}
            ],
            tone_analysis={"professional": 0.8, "urgent": 0.3, "friendly": 0.6},
            relationship_context="Established business partner, 15 previous interactions",
            priority_reasoning="High priority due to Friday deadline and business importance",
            processing_time_ms=200
        )
    
    def _apply_user_style(self, response: str) -> str:
        """Apply learned user style to suggested response"""
        # This would apply learned patterns from user's sent emails
        # For now, return as-is
        return response
    
    def learn_user_style(self, sent_emails: List[str]):
        """Learn user's writing style from sent emails"""
        # Analyze patterns in user's sent emails
        # - Greeting style
        # - Closing style
        # - Formality level
        # - Common phrases
        # This would be implemented with mini model analysis
        pass

# ============================================================================
# Email Processing Pipeline
# ============================================================================

class EmailIntelligenceEngine:
    """Main orchestrator for dual-model email processing"""
    
    def __init__(self, nano_api_key: str = None, mini_api_key: str = None):
        self.nano_processor = GPT5NanoProcessor(nano_api_key)
        self.mini_processor = GPT5MiniProcessor(mini_api_key)
        self.db_path = Path("email_intelligence.db")
        self.batch_size = 50
        self.executor = ThreadPoolExecutor(max_workers=10)
        self._init_database()
    
    def _init_database(self):
        """Initialize SQLite database for storing processed emails"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS processed_emails (
                id TEXT PRIMARY KEY,
                metadata TEXT,
                content TEXT,
                nano_classification TEXT,
                mini_analysis TEXT,
                processed_at TIMESTAMP,
                total_processing_time_ms REAL
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS email_stats (
                date DATE PRIMARY KEY,
                total_processed INTEGER,
                avg_nano_time_ms REAL,
                avg_mini_time_ms REAL,
                categories TEXT
            )
        """)
        
        conn.commit()
        conn.close()
    
    async def process_email(self, 
                          email_content: str, 
                          metadata: EmailMetadata,
                          force_detailed: bool = False) -> ProcessedEmail:
        """
        Process single email through the pipeline
        """
        start_time = time.time()
        
        # Step 1: Fast classification with nano
        nano_result = await self.nano_processor.classify_email(email_content, metadata)
        
        # Step 2: Conditional detailed analysis with mini
        mini_result = None
        if nano_result.needs_detailed_analysis or force_detailed:
            mini_result = await self.mini_processor.analyze_email(
                email_content, metadata, nano_result
            )
        
        total_time = (time.time() - start_time) * 1000
        
        processed = ProcessedEmail(
            metadata=metadata,
            content=email_content,
            nano_classification=nano_result,
            mini_analysis=mini_result,
            total_processing_time_ms=total_time
        )
        
        # Store in database
        self._store_processed_email(processed)
        
        return processed
    
    async def process_batch(self, emails: List[Tuple[str, EmailMetadata]]) -> List[ProcessedEmail]:
        """
        Process batch of emails efficiently
        """
        # Process all emails through nano first (fast)
        nano_tasks = [
            self.nano_processor.classify_email(content, metadata)
            for content, metadata in emails
        ]
        nano_results = await asyncio.gather(*nano_tasks)
        
        # Identify which need detailed analysis
        detailed_indices = [
            i for i, result in enumerate(nano_results)
            if result.needs_detailed_analysis
        ]
        
        # Process subset through mini (slower)
        mini_tasks = [
            self.mini_processor.analyze_email(
                emails[i][0], emails[i][1], nano_results[i]
            )
            for i in detailed_indices
        ]
        mini_results = await asyncio.gather(*mini_tasks) if mini_tasks else []
        
        # Combine results
        processed_emails = []
        mini_index = 0
        for i, (content, metadata) in enumerate(emails):
            mini_analysis = None
            if i in detailed_indices:
                mini_analysis = mini_results[mini_index]
                mini_index += 1
            
            processed_emails.append(ProcessedEmail(
                metadata=metadata,
                content=content,
                nano_classification=nano_results[i],
                mini_analysis=mini_analysis,
                total_processing_time_ms=(
                    nano_results[i].processing_time_ms + 
                    (mini_analysis.processing_time_ms if mini_analysis else 0)
                )
            ))
        
        # Batch store in database
        self._batch_store_emails(processed_emails)
        
        return processed_emails
    
    def _store_processed_email(self, email: ProcessedEmail):
        """Store single processed email in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT OR REPLACE INTO processed_emails 
            (id, metadata, content, nano_classification, mini_analysis, 
             processed_at, total_processing_time_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            email.metadata.id,
            json.dumps(asdict(email.metadata), default=str),
            email.content,
            json.dumps(asdict(email.nano_classification), default=str),
            json.dumps(asdict(email.mini_analysis), default=str) if email.mini_analysis else None,
            email.processed_at,
            email.total_processing_time_ms
        ))
        
        conn.commit()
        conn.close()
    
    def _batch_store_emails(self, emails: List[ProcessedEmail]):
        """Batch store processed emails"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        data = [
            (
                email.metadata.id,
                json.dumps(asdict(email.metadata), default=str),
                email.content,
                json.dumps(asdict(email.nano_classification), default=str),
                json.dumps(asdict(email.mini_analysis), default=str) if email.mini_analysis else None,
                email.processed_at,
                email.total_processing_time_ms
            )
            for email in emails
        ]
        
        cursor.executemany("""
            INSERT OR REPLACE INTO processed_emails 
            (id, metadata, content, nano_classification, mini_analysis, 
             processed_at, total_processing_time_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, data)
        
        conn.commit()
        conn.close()
    
    def get_email_statistics(self) -> Dict[str, Any]:
        """Get processing statistics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get overall stats
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                AVG(total_processing_time_ms) as avg_time,
                MIN(total_processing_time_ms) as min_time,
                MAX(total_processing_time_ms) as max_time
            FROM processed_emails
            WHERE processed_at > datetime('now', '-24 hours')
        """)
        
        stats = cursor.fetchone()
        
        # Get category distribution
        cursor.execute("""
            SELECT nano_classification
            FROM processed_emails
            WHERE processed_at > datetime('now', '-24 hours')
        """)
        
        categories = defaultdict(int)
        urgencies = defaultdict(int)
        
        for row in cursor.fetchall():
            if row[0]:
                classification = json.loads(row[0])
                categories[classification.get('category', 'unknown')] += 1
                urgencies[classification.get('urgency', 'unknown')] += 1
        
        conn.close()
        
        return {
            'total_processed_24h': stats[0] if stats else 0,
            'avg_processing_time_ms': stats[1] if stats else 0,
            'min_processing_time_ms': stats[2] if stats else 0,
            'max_processing_time_ms': stats[3] if stats else 0,
            'category_distribution': dict(categories),
            'urgency_distribution': dict(urgencies),
            'nano_performance': self.nano_processor.performance_stats,
            'mini_performance': self.mini_processor.performance_stats
        }

# ============================================================================
# Real-time Processing Features
# ============================================================================

class RealtimeEmailMonitor:
    """Monitor for real-time email processing"""
    
    def __init__(self, engine: EmailIntelligenceEngine):
        self.engine = engine
        self.notification_queue = asyncio.Queue()
        self.priority_threshold = Urgency.HIGH
    
    async def monitor_inbox(self, check_interval: int = 30):
        """
        Monitor inbox for new emails and process them
        """
        while True:
            try:
                # Fetch new emails (implementation depends on email provider)
                new_emails = await self._fetch_new_emails()
                
                if new_emails:
                    # Process new emails
                    processed = await self.engine.process_batch(new_emails)
                    
                    # Check for high-priority items
                    for email in processed:
                        if email.nano_classification.urgency.value >= self.priority_threshold.value:
                            await self.notification_queue.put(email)
                
                await asyncio.sleep(check_interval)
                
            except Exception as e:
                logger.error(f"Error in email monitoring: {e}")
                await asyncio.sleep(check_interval)
    
    async def _fetch_new_emails(self) -> List[Tuple[str, EmailMetadata]]:
        """Fetch new emails from provider"""
        # Implementation would connect to email provider
        # For now, return empty list
        return []
    
    async def process_notifications(self):
        """Process high-priority notifications"""
        while True:
            email = await self.notification_queue.get()
            logger.info(f"High priority email: {email.metadata.subject}")
            # Send notification (implementation depends on notification system)
            await self._send_notification(email)
    
    async def _send_notification(self, email: ProcessedEmail):
        """Send notification for high-priority email"""
        # Implementation would send actual notification
        pass

# ============================================================================
# Smart Response Generator
# ============================================================================

class SmartResponseGenerator:
    """Generate context-aware responses using mini model"""
    
    def __init__(self, mini_processor: GPT5MiniProcessor):
        self.mini_processor = mini_processor
        self.response_templates = self._load_templates()
        self.user_preferences = {}
    
    def _load_templates(self) -> Dict[str, str]:
        """Load response templates"""
        return {
            'accept_meeting': "I'll be happy to attend the meeting on {date}.",
            'decline_meeting': "Unfortunately, I won't be able to attend due to a prior commitment.",
            'request_info': "Could you please provide more information about {topic}?",
            'acknowledge': "Thank you for your email. I've received it and will review shortly.",
            'delegate': "I'm forwarding this to {person} who can better assist with this matter."
        }
    
    async def generate_response(self, 
                               email: ProcessedEmail,
                               response_type: str = 'auto') -> str:
        """
        Generate appropriate response based on email analysis
        """
        if not email.mini_analysis:
            # If no detailed analysis, use templates
            return self._get_template_response(email.nano_classification)
        
        # Use mini's suggested response as base
        base_response = email.mini_analysis.suggested_response
        
        # Apply user preferences and style
        personalized = self._personalize_response(base_response, email.metadata.from_address)
        
        return personalized
    
    def _get_template_response(self, classification: NanoClassification) -> str:
        """Get template response based on classification"""
        if classification.category == EmailCategory.MEETING:
            return self.response_templates['acknowledge']
        elif classification.urgency == Urgency.CRITICAL:
            return "I'll address this immediately and get back to you shortly."
        else:
            return self.response_templates['acknowledge']
    
    def _personalize_response(self, response: str, recipient: str) -> str:
        """Personalize response based on recipient and preferences"""
        # Apply user-specific modifications
        if recipient in self.user_preferences:
            prefs = self.user_preferences[recipient]
            # Apply preferences (formality, greeting style, etc.)
        
        return response
    
    def learn_from_feedback(self, original: str, edited: str, recipient: str):
        """Learn from user's edits to responses"""
        # Store patterns of changes for future use
        if recipient not in self.user_preferences:
            self.user_preferences[recipient] = {}
        
        # Analyze differences and store preferences
        # This would use mini model to understand the changes

# ============================================================================
# Example Usage
# ============================================================================

async def main():
    """Example usage of the email intelligence system"""
    
    # Initialize the engine
    engine = EmailIntelligenceEngine()
    
    # Example email
    email_content = """
    Hi Team,
    
    I wanted to follow up on our discussion from yesterday's meeting about the Q4 product launch.
    
    We need to finalize the following by Friday:
    1. Marketing campaign budget approval
    2. Technical specifications review
    3. Launch date confirmation
    
    Please review the attached proposal and send your feedback by Thursday afternoon.
    This is urgent as we need to present to the board on Monday.
    
    Best regards,
    John Doe
    CEO, Acme Corp
    """
    
    metadata = EmailMetadata(
        id="email_001",
        from_address="john.doe@acme.com",
        to_addresses=["team@company.com"],
        subject="Urgent: Q4 Product Launch - Action Required",
        date=datetime.now()
    )
    
    # Process the email
    processed = await engine.process_email(email_content, metadata, force_detailed=True)
    
    # Display results
    print(f"\n{'='*60}")
    print("EMAIL INTELLIGENCE ANALYSIS")
    print(f"{'='*60}")
    
    print(f"\n📧 Email: {metadata.subject}")
    print(f"From: {metadata.from_address}")
    
    print(f"\n⚡ FAST CLASSIFICATION (Nano - {processed.nano_classification.processing_time_ms:.0f}ms)")
    print(f"├─ Category: {processed.nano_classification.category.value}")
    print(f"├─ Urgency: {processed.nano_classification.urgency.name}")
    print(f"├─ Sentiment: {processed.nano_classification.sentiment.value}")
    print(f"├─ Summary: {processed.nano_classification.summary}")
    print(f"└─ Confidence: {processed.nano_classification.confidence:.0%}")
    
    if processed.nano_classification.action_items:
        print(f"\n📌 Quick Action Items:")
        for item in processed.nano_classification.action_items:
            print(f"  • {item}")
    
    if processed.mini_analysis:
        print(f"\n🔍 DETAILED ANALYSIS (Mini - {processed.mini_analysis.processing_time_ms:.0f}ms)")
        print(f"├─ Summary: {processed.mini_analysis.detailed_summary}")
        print(f"├─ Context: {processed.mini_analysis.context_analysis}")
        print(f"└─ Priority: {processed.mini_analysis.priority_reasoning}")
        
        if processed.mini_analysis.extracted_tasks:
            print(f"\n✅ Extracted Tasks:")
            for task in processed.mini_analysis.extracted_tasks:
                print(f"  • {task['task']} (by {task['deadline']}) - {task['priority']}")
        
        if processed.mini_analysis.decision_points:
            print(f"\n🎯 Decision Points:")
            for point in processed.mini_analysis.decision_points:
                print(f"  • {point}")
        
        if processed.mini_analysis.suggested_response:
            print(f"\n💬 Suggested Response:")
            print(f"{processed.mini_analysis.suggested_response}")
    
    print(f"\n⏱️  Total Processing Time: {processed.total_processing_time_ms:.0f}ms")
    
    # Get statistics
    stats = engine.get_email_statistics()
    print(f"\n📊 System Statistics (Last 24h):")
    print(f"├─ Emails Processed: {stats['total_processed_24h']}")
    print(f"├─ Avg Processing Time: {stats['avg_processing_time_ms']:.0f}ms")
    print(f"└─ Category Distribution: {stats['category_distribution']}")

if __name__ == "__main__":
    asyncio.run(main())