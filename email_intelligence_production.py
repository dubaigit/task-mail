#!/usr/bin/env python3
"""
Production Email Intelligence Engine with GPT-5 Integration

High-performance, production-ready email classification and draft generation system
with real OpenAI GPT-5 API integration, rate limiting, caching, and batch processing.

Features:
- Real GPT-5 API integration (gpt-5-nano for classification, gpt-5-mini for drafts)
- Intelligent rate limiting and retry logic
- Performance caching and batch optimization
- Voice-matched draft generation
- Comprehensive error handling and fallbacks
- Production logging and monitoring
"""

import asyncio
import logging
import time
import json
import hashlib
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
from concurrent.futures import ThreadPoolExecutor
import threading
import os
import re

# HTTP client for OpenAI API
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Cache and performance
import functools
import pickle
from collections import deque

# Import base classes from existing engine
from email_intelligence_engine import (
    EmailClass, Urgency, Sentiment, ActionItem, 
    EmailIntelligence, EmailAnalysisResult
)

# Rate Limiting and Performance Classes
@dataclass
class RateLimit:
    """Rate limiting configuration"""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    burst_capacity: int = 10
    backoff_factor: float = 2.0
    max_retries: int = 3

@dataclass
class PerformanceMetrics:
    """Performance tracking metrics"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    avg_response_time_ms: float = 0.0
    last_reset: datetime = None
    
    def __post_init__(self):
        if self.last_reset is None:
            self.last_reset = datetime.now()

@dataclass
class CacheEntry:
    """Cache entry with TTL"""
    data: Any
    timestamp: datetime
    ttl_seconds: int = 3600
    
    @property
    def is_expired(self) -> bool:
        return (datetime.now() - self.timestamp).total_seconds() > self.ttl_seconds

class ProductionEmailIntelligenceEngine:
    """
    Production-grade email intelligence engine with GPT-5 integration.
    
    Optimized for processing 10k+ emails with:
    - Real OpenAI GPT-5 API integration
    - Intelligent rate limiting and retries
    - Performance caching
    - Batch processing optimization
    - Voice-matched draft generation
    - Comprehensive error handling
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """Initialize the production engine"""
        self.logger = self._setup_logging()
        self._load_configuration(config_path)
        self._initialize_http_client()
        self._initialize_cache()
        self._initialize_database()
        self._initialize_rate_limiter()
        self._initialize_performance_tracker()
        
        # Thread pool for concurrent processing
        self.executor = ThreadPoolExecutor(
            max_workers=self.config.get('concurrent_limit', 5)
        )
        
        self.logger.info("Production Email Intelligence Engine initialized")

    def _setup_logging(self) -> logging.Logger:
        """Setup production logging"""
        logger = logging.getLogger('email_intelligence_production')
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            # File handler
            handler = logging.FileHandler('email_intelligence_production.log')
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
            
            # Console handler for critical errors
            console_handler = logging.StreamHandler()
            console_handler.setLevel(logging.ERROR)
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)
        
        return logger

    def _load_configuration(self, config_path: Optional[str]):
        """Load configuration from file or environment"""
        default_config = {
            'openai_api_key': os.getenv('OPENAI_API_KEY'),
            'classifier_model': 'gpt-5-nano-2025-08-07',
            'draft_model': 'gpt-5-mini-2025-08-07',
            'rate_limit': {
                'requests_per_minute': 60,
                'requests_per_hour': 1000,
                'burst_capacity': 10,
                'backoff_factor': 2.0,
                'max_retries': 3
            },
            'cache': {
                'enabled': True,
                'ttl_seconds': 3600,
                'max_entries': 10000
            },
            'batch_processing': {
                'batch_size': 10,
                'max_concurrent_batches': 3,
                'urgent_priority_threshold': 0.85
            },
            'voice_settings': {
                'user_name': 'Abdullah',
                'greeting_prefix': 'D',
                'signature': 'Regards Abdullah',
                'tone': 'professional_warm'
            },
            'performance': {
                'timeout_seconds': 30,
                'urgent_timeout_seconds': 10,
                'max_retries': 3
            },
            'database': {
                'path': 'email_intelligence_production.db'
            }
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    file_config = json.load(f)
                self._deep_update(default_config, file_config)
            except Exception as e:
                self.logger.error(f"Failed to load config from {config_path}: {e}")
        
        self.config = default_config
        
        if not self.config['openai_api_key']:
            self.logger.warning("OpenAI API key not configured - AI features will be disabled")

    def _deep_update(self, base_dict: dict, update_dict: dict):
        """Deep update dictionary"""
        for key, value in update_dict.items():
            if isinstance(value, dict) and key in base_dict:
                self._deep_update(base_dict[key], value)
            else:
                base_dict[key] = value

    def _initialize_http_client(self):
        """Initialize HTTP client with retries and timeouts"""
        self.session = requests.Session()
        
        # Configure retries
        retry_strategy = Retry(
            total=self.config['rate_limit']['max_retries'],
            backoff_factor=self.config['rate_limit']['backoff_factor'],
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def _initialize_cache(self):
        """Initialize in-memory cache"""
        self.cache: Dict[str, CacheEntry] = {}
        self.cache_lock = threading.Lock()
        self.max_cache_entries = self.config['cache']['max_entries']

    def _initialize_database(self):
        """Initialize SQLite database for persistence"""
        self.db_path = self.config['database']['path']
        
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS email_analysis (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email_hash TEXT UNIQUE,
                    subject TEXT,
                    sender TEXT,
                    classification TEXT,
                    urgency TEXT,
                    confidence REAL,
                    analysis_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS draft_generations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email_hash TEXT,
                    draft_content TEXT,
                    generation_method TEXT,
                    model_used TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS performance_metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    metric_name TEXT,
                    metric_value REAL,
                    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_email_hash ON email_analysis(email_hash);
                CREATE INDEX IF NOT EXISTS idx_created_at ON email_analysis(created_at);
            """)

    def _initialize_rate_limiter(self):
        """Initialize rate limiting"""
        self.rate_limit_config = RateLimit(**self.config['rate_limit'])
        self.request_timestamps = deque()
        self.rate_limit_lock = threading.Lock()

    def _initialize_performance_tracker(self):
        """Initialize performance tracking"""
        self.metrics = PerformanceMetrics()
        self.metrics_lock = threading.Lock()

    def _check_rate_limit(self) -> bool:
        """Check if request is within rate limits"""
        with self.rate_limit_lock:
            now = datetime.now()
            
            # Remove old timestamps
            cutoff_minute = now - timedelta(minutes=1)
            cutoff_hour = now - timedelta(hours=1)
            
            while (self.request_timestamps and 
                   self.request_timestamps[0] < cutoff_hour):
                self.request_timestamps.popleft()
            
            # Count recent requests
            minute_requests = sum(1 for ts in self.request_timestamps if ts > cutoff_minute)
            hour_requests = len(self.request_timestamps)
            
            # Check limits
            if (minute_requests >= self.rate_limit_config.requests_per_minute or
                hour_requests >= self.rate_limit_config.requests_per_hour):
                return False
            
            # Add current request
            self.request_timestamps.append(now)
            return True

    def _wait_for_rate_limit(self):
        """Wait until rate limit allows next request"""
        while not self._check_rate_limit():
            time.sleep(1)

    def _get_cache_key(self, data: Union[str, Dict]) -> str:
        """Generate cache key for data"""
        if isinstance(data, dict):
            data = json.dumps(data, sort_keys=True)
        return hashlib.md5(data.encode()).hexdigest()

    def _get_from_cache(self, key: str) -> Optional[Any]:
        """Get item from cache"""
        with self.cache_lock:
            entry = self.cache.get(key)
            if entry and not entry.is_expired:
                with self.metrics_lock:
                    self.metrics.cache_hits += 1
                return entry.data
            elif entry:
                # Remove expired entry
                del self.cache[key]
        
        with self.metrics_lock:
            self.metrics.cache_misses += 1
        return None

    def _put_in_cache(self, key: str, data: Any, ttl: int = None):
        """Put item in cache"""
        if not self.config['cache']['enabled']:
            return
            
        ttl = ttl or self.config['cache']['ttl_seconds']
        
        with self.cache_lock:
            # Evict oldest entries if cache is full
            if len(self.cache) >= self.max_cache_entries:
                oldest_key = min(self.cache.keys(), 
                               key=lambda k: self.cache[k].timestamp)
                del self.cache[oldest_key]
            
            self.cache[key] = CacheEntry(
                data=data,
                timestamp=datetime.now(),
                ttl_seconds=ttl
            )

    def _call_openai_api(self, prompt: str, system_prompt: str, 
                        model: str, max_tokens: int = 150,
                        temperature: float = 0.1) -> Optional[str]:
        """Call OpenAI API with error handling and retries"""
        if not self.config['openai_api_key']:
            return None
        
        # Check rate limit
        self._wait_for_rate_limit()
        
        # Check cache
        cache_key = self._get_cache_key({
            'prompt': prompt,
            'system': system_prompt,
            'model': model,
            'max_tokens': max_tokens,
            'temperature': temperature
        })
        
        cached_result = self._get_from_cache(cache_key)
        if cached_result:
            return cached_result
        
        start_time = time.time()
        
        try:
            headers = {
                "Authorization": f"Bearer {self.config['openai_api_key']}",
                "Content-Type": "application/json",
            }
            
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            
            response = self.session.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=self.config['performance']['timeout_seconds']
            )
            
            response.raise_for_status()
            data = response.json()
            
            result = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            
            # Update metrics
            response_time = (time.time() - start_time) * 1000
            with self.metrics_lock:
                self.metrics.total_requests += 1
                self.metrics.successful_requests += 1
                self.metrics.avg_response_time_ms = (
                    (self.metrics.avg_response_time_ms * (self.metrics.successful_requests - 1) + 
                     response_time) / self.metrics.successful_requests
                )
            
            # Cache result
            self._put_in_cache(cache_key, result)
            
            return result
            
        except Exception as e:
            with self.metrics_lock:
                self.metrics.total_requests += 1
                self.metrics.failed_requests += 1
            
            self.logger.error(f"OpenAI API call failed: {e}")
            return None

    def classify_email_with_ai(self, subject: str, body: str, 
                              sender: str) -> Optional[Tuple[EmailClass, float]]:
        """Classify email using GPT-5 nano model"""
        system_prompt = (
            "You are an expert email classifier. Classify emails into exactly one category:\n"
            "- NEEDS_REPLY: Requires a response from the recipient\n"
            "- APPROVAL_REQUIRED: Requires approval or authorization\n" 
            "- CREATE_TASK: Contains action items or tasks to complete\n"
            "- DELEGATE: Should be assigned to someone else\n"
            "- FYI_ONLY: Informational only, no action needed\n"
            "- FOLLOW_UP: Requires follow-up or status check\n\n"
            "Respond with ONLY: CATEGORY|CONFIDENCE_SCORE\n"
            "Example: NEEDS_REPLY|0.92"
        )
        
        user_prompt = (
            f"Subject: {subject}\n"
            f"From: {sender}\n\n"
            f"Content:\n{body[:1500]}"  # Limit content for faster processing
        )
        
        result = self._call_openai_api(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=self.config['classifier_model'],
            max_tokens=20,  # Very short response expected
            temperature=0.1
        )
        
        if result and "|" in result:
            try:
                parts = result.split("|")
                class_name = parts[0].strip()
                confidence = float(parts[1].strip())
                
                # Map to EmailClass enum
                for email_class in EmailClass:
                    if email_class.value == class_name:
                        return email_class, confidence
            except (ValueError, IndexError) as e:
                self.logger.warning(f"Failed to parse classification result: {result}, error: {e}")
        
        return None

    def generate_draft_with_ai(self, email_data: Dict, 
                             analysis: EmailIntelligence) -> Optional[str]:
        """Generate draft reply using GPT-5 mini model"""
        voice_config = self.config['voice_settings']
        
        system_prompt = (
            f"You are an executive assistant writing on behalf of {voice_config['user_name']}. "
            f"Write professional email replies that match this voice and style:\n"
            f"- Start with '{voice_config['greeting_prefix']} [firstname],' for greetings\n"
            f"- Use a {voice_config['tone']} tone\n"
            f"- End with '{voice_config['signature']}'\n"
            f"- Keep replies concise but complete (3-7 sentences)\n"
            f"- Address all key points and questions\n"
            f"- Propose next steps when appropriate\n"
            f"- Do not use placeholders or brackets\n\n"
            "Generate only the email content, no subject line."
        )
        
        # Extract sender first name
        sender_name = email_data.get('sender_name', email_data.get('sender', ''))
        first_name = sender_name.split()[0].strip(',: ') if sender_name else 'there'
        
        # Build context from analysis
        context_parts = [
            f"Classification: {analysis.classification.value}",
            f"Urgency: {analysis.urgency.value}",
            f"Sentiment: {analysis.sentiment.value}"
        ]
        
        if analysis.action_items:
            context_parts.append("Action items:")
            for action in analysis.action_items[:3]:  # Limit to top 3
                context_parts.append(f"- {action.text}")
        
        if analysis.deadlines:
            context_parts.append("Deadlines:")
            for deadline, desc in analysis.deadlines[:2]:  # Limit to top 2
                context_parts.append(f"- {deadline.strftime('%Y-%m-%d')}: {desc}")
        
        user_prompt = (
            f"Original email:\n"
            f"Subject: {email_data.get('subject', '')}\n"
            f"From: {sender_name}\n"
            f"Content: {email_data.get('content', email_data.get('body', ''))[:1000]}\n\n"
            f"Analysis context:\n{chr(10).join(context_parts)}\n\n"
            f"Write a reply to {first_name} that addresses their message appropriately."
        )
        
        result = self._call_openai_api(
            prompt=user_prompt,
            system_prompt=system_prompt,
            model=self.config['draft_model'],
            max_tokens=300,
            temperature=0.3
        )
        
        return result

    def analyze_email(self, subject: str, body: str, sender: str = "",
                     metadata: Optional[Dict] = None,
                     priority: bool = False) -> EmailIntelligence:
        """
        Analyze email with production optimizations
        
        Args:
            subject: Email subject line
            body: Email body content
            sender: Sender email/name
            metadata: Additional metadata
            priority: If True, use shorter timeout for urgent processing
            
        Returns:
            EmailIntelligence with complete analysis
        """
        start_time = time.time()
        
        # Generate email hash for caching/database
        email_content = f"{subject}|{sender}|{body}"
        email_hash = self._get_cache_key(email_content)
        
        # Check database first
        cached_analysis = self._get_cached_analysis(email_hash)
        if cached_analysis:
            return cached_analysis
        
        try:
            # AI-powered classification (primary method)
            ai_classification = self.classify_email_with_ai(subject, body, sender)
            
            if ai_classification:
                classification, confidence = ai_classification
            else:
                # Fallback to pattern-based classification
                self.logger.info("Using fallback classification")
                from email_intelligence_engine import EmailIntelligenceEngine
                fallback_engine = EmailIntelligenceEngine()
                fallback_result = fallback_engine.analyze_email(subject, body, sender)
                classification = fallback_result.classification
                confidence = fallback_result.confidence
            
            # Extract other features (could also be AI-enhanced)
            urgency = self._extract_urgency_ai_enhanced(f"{subject} {body}")
            sentiment = self._extract_sentiment_ai_enhanced(f"{subject} {body}")
            intent = self._extract_intent(f"{subject} {body}", classification)
            action_items = self._extract_action_items(f"{subject} {body}")
            deadlines = self._extract_deadlines(f"{subject} {body}")
            
            # Build confidence scores
            confidence_scores = {
                'classification': confidence,
                'urgency': 0.8,  # Could be AI-enhanced
                'sentiment': 0.7,  # Could be AI-enhanced
                'action_items': sum(a.confidence for a in action_items) / len(action_items) if action_items else 0.0,
                'deadlines': 0.8 if deadlines else 0.0
            }
            
            processing_time = (time.time() - start_time) * 1000
            
            result = EmailIntelligence(
                classification=classification,
                confidence=confidence,
                urgency=urgency,
                sentiment=sentiment,
                intent=intent,
                action_items=action_items,
                deadlines=deadlines,
                confidence_scores=confidence_scores,
                processing_time_ms=processing_time
            )
            
            # Store in database
            self._store_analysis(email_hash, subject, sender, result)
            
            return result
            
        except Exception as e:
            self.logger.error(f"Analysis failed for email {email_hash}: {e}")
            
            # Return basic fallback result
            return EmailIntelligence(
                classification=EmailClass.FYI_ONLY,
                confidence=0.0,
                urgency=Urgency.MEDIUM,
                sentiment=Sentiment.NEUTRAL,
                intent="analysis_failed",
                action_items=[],
                deadlines=[],
                confidence_scores={},
                processing_time_ms=(time.time() - start_time) * 1000
            )

    def generate_draft_reply(self, email_data: Dict, 
                           analysis: EmailIntelligence) -> str:
        """Generate production-quality draft reply"""
        email_hash = self._get_cache_key(json.dumps(email_data, sort_keys=True))
        
        # Check for cached draft
        cached_draft = self._get_cached_draft(email_hash)
        if cached_draft:
            return cached_draft
        
        # Try AI generation first
        ai_draft = self.generate_draft_with_ai(email_data, analysis)
        
        if ai_draft:
            self._store_draft(email_hash, ai_draft, 'ai', self.config['draft_model'])
            return ai_draft
        
        # Fallback to template-based generation
        fallback_draft = self._generate_fallback_draft(email_data, analysis)
        self._store_draft(email_hash, fallback_draft, 'template', 'fallback')
        return fallback_draft

    def _generate_fallback_draft(self, email_data: Dict, 
                                analysis: EmailIntelligence) -> str:
        """Generate fallback draft using templates"""
        voice_config = self.config['voice_settings']
        sender_name = email_data.get('sender_name', email_data.get('sender', ''))
        first_name = sender_name.split()[0].strip(',: ') if sender_name else 'there'
        
        greeting = f"{voice_config['greeting_prefix']} {first_name},"
        
        # Classification-based response templates
        templates = {
            EmailClass.NEEDS_REPLY: [
                "Thank you for your email. I've reviewed your message and here's my response:",
                "Let me address your questions:"
            ],
            EmailClass.APPROVAL_REQUIRED: [
                "Thank you for sending this for review. I approve proceeding as outlined.",
                "This looks good to proceed. You have my approval."
            ],
            EmailClass.CREATE_TASK: [
                "Thanks for the context. I'll create a task to track this and update you on progress.",
                "I'll get this organized as an action item and keep you posted on status."
            ],
            EmailClass.DELEGATE: [
                "I'll have the appropriate team member handle this and follow up with you directly.",
                "Thanks - I'll route this to the right person and ensure you get a proper response."
            ],
            EmailClass.FOLLOW_UP: [
                "Thanks for the follow-up. Here's the current status:",
                "Appreciate you checking in. Let me give you an update:"
            ],
            EmailClass.FYI_ONLY: [
                "Thanks for keeping me informed.",
                "Noted - thanks for the update."
            ]
        }
        
        body_options = templates.get(analysis.classification, templates[EmailClass.FYI_ONLY])
        body = body_options[0]  # Use first option for consistency
        
        # Add action items if present
        if analysis.action_items and analysis.classification != EmailClass.FYI_ONLY:
            first_action = analysis.action_items[0]
            deadline_text = (f" by {first_action.deadline.strftime('%B %d')}" 
                           if first_action.deadline else "")
            body += f" I'll handle: {first_action.text.rstrip('.')}{deadline_text}."
        
        return f"{greeting}\n\n{body}\n\n{voice_config['signature']}"

    def batch_process_emails(self, emails: List[Dict], 
                           max_concurrent: int = None) -> List[EmailIntelligence]:
        """Process multiple emails with batch optimization"""
        max_concurrent = max_concurrent or self.config['batch_processing']['max_concurrent_batches']
        batch_size = self.config['batch_processing']['batch_size']
        
        results = []
        
        # Sort emails by urgency indicators for priority processing
        urgent_threshold = self.config['batch_processing']['urgent_priority_threshold']
        sorted_emails = self._sort_emails_by_priority(emails)
        
        # Process in batches
        for i in range(0, len(sorted_emails), batch_size):
            batch = sorted_emails[i:i + batch_size]
            
            # Use ThreadPoolExecutor for concurrent processing within batch
            batch_futures = []
            for email in batch:
                future = self.executor.submit(
                    self.analyze_email,
                    email.get('subject', ''),
                    email.get('body', email.get('content', '')),
                    email.get('sender', ''),
                    email.get('metadata', {}),
                    email.get('priority', False)
                )
                batch_futures.append(future)
            
            # Collect results
            for future in batch_futures:
                try:
                    result = future.result(timeout=self.config['performance']['timeout_seconds'])
                    results.append(result)
                except Exception as e:
                    self.logger.error(f"Batch processing failed for email: {e}")
                    # Add fallback result
                    results.append(EmailIntelligence(
                        classification=EmailClass.FYI_ONLY,
                        confidence=0.0,
                        urgency=Urgency.MEDIUM,
                        sentiment=Sentiment.NEUTRAL,
                        intent="batch_processing_failed",
                        action_items=[],
                        deadlines=[],
                        confidence_scores={},
                        processing_time_ms=0.0
                    ))
        
        self.logger.info(f"Batch processed {len(emails)} emails successfully")
        return results

    def _sort_emails_by_priority(self, emails: List[Dict]) -> List[Dict]:
        """Sort emails by priority for processing order"""
        def get_priority_score(email):
            subject = email.get('subject', '').lower()
            body = email.get('body', email.get('content', '')).lower()
            
            # Urgent keywords get highest priority
            urgent_keywords = ['urgent', 'asap', 'critical', 'emergency', 'immediate']
            for keyword in urgent_keywords:
                if keyword in subject or keyword in body:
                    return 100
            
            # Approval requests get high priority
            approval_keywords = ['approve', 'approval', 'authorize', 'sign-off']
            for keyword in approval_keywords:
                if keyword in subject or keyword in body:
                    return 80
            
            # Questions get medium-high priority
            if '?' in subject or '?' in body:
                return 60
            
            return 0
        
        return sorted(emails, key=get_priority_score, reverse=True)

    # Helper methods for feature extraction (could be AI-enhanced)
    def _extract_urgency_ai_enhanced(self, text: str) -> Urgency:
        """Extract urgency with potential AI enhancement"""
        # For now, use pattern-based (could be replaced with AI call)
        urgent_patterns = [
            (r'\b(urgent|asap|immediately|critical|emergency)\b', Urgency.CRITICAL),
            (r'\b(high\s+priority|important|soon)\b', Urgency.HIGH),
            (r'\b(when\s+you\s+can|at\s+your\s+convenience)\b', Urgency.MEDIUM),
            (r'\b(no\s+rush|whenever)\b', Urgency.LOW),
        ]
        
        text = text.lower()
        for pattern, urgency in urgent_patterns:
            if re.search(pattern, text):
                return urgency
        
        return Urgency.MEDIUM

    def _extract_sentiment_ai_enhanced(self, text: str) -> Sentiment:
        """Extract sentiment with potential AI enhancement"""
        # Pattern-based for now (could be AI-enhanced)
        positive_patterns = r'\b(thanks?|thank\s+you|appreciate|great|excellent)\b'
        negative_patterns = r'\b(disappointed|concerned|issue|problem|error)\b'
        frustrated_patterns = r'\b(frustrated|annoyed|ridiculous|unacceptable)\b'
        
        text = text.lower()
        if re.search(frustrated_patterns, text):
            return Sentiment.FRUSTRATED
        elif re.search(negative_patterns, text):
            return Sentiment.NEGATIVE
        elif re.search(positive_patterns, text):
            return Sentiment.POSITIVE
        
        return Sentiment.NEUTRAL

    def _extract_intent(self, text: str, classification: EmailClass) -> str:
        """Extract email intent"""
        intent_patterns = {
            'request_information': r'\b(need\s+(?:info|information|details)|what\s+is)\b',
            'schedule_meeting': r'\b(schedule|meet|meeting|call)\b',
            'report_issue': r'\b(issue|problem|bug|error)\b',
            'request_approval': r'\b(approve|approval|authorize)\b',
            'delegate_task': r'\b(can\s+you|please\s+handle)\b',
        }
        
        text = text.lower()
        for intent, pattern in intent_patterns.items():
            if re.search(pattern, text):
                return intent
        
        return classification.value.lower().replace('_', ' ')

    def _extract_action_items(self, text: str) -> List[ActionItem]:
        """Extract action items from email text"""
        action_patterns = [
            (r'\b(please\s+(?:\w+\s+){1,4}\w+)', 0.8),
            (r'\b(need\s+to\s+(?:\w+\s+){1,4}\w+)', 0.7),
            (r'\b(action\s+item:?\s+(.+))', 0.9),
            (r'\b(todo:?\s+(.+))', 0.85),
        ]
        
        action_items = []
        for pattern, confidence in action_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                action_text = match.group(1).strip()
                if len(action_text) > 10:  # Filter out very short matches
                    action_items.append(ActionItem(
                        text=action_text,
                        confidence=confidence
                    ))
        
        return action_items[:5]  # Limit to top 5

    def _extract_deadlines(self, text: str) -> List[Tuple[datetime, str]]:
        """Extract deadlines from email text"""
        deadline_patterns = [
            (r'\b(by\s+(?:monday|tuesday|wednesday|thursday|friday))\b', 0.9),
            (r'\b(due\s+(?:by\s+)?([^.!?\n]+))', 0.8),
            (r'\b(deadline:?\s*([^.!?\n]+))', 0.9),
        ]
        
        deadlines = []
        for pattern, confidence in deadline_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                deadline_text = match.group(1)
                # Simple date parsing (could be enhanced)
                if 'friday' in deadline_text.lower():
                    # Calculate next Friday
                    now = datetime.now()
                    days_ahead = 4 - now.weekday()  # Friday is 4
                    if days_ahead <= 0:
                        days_ahead += 7
                    deadline_date = now + timedelta(days_ahead)
                    deadlines.append((deadline_date, deadline_text))
        
        return deadlines[:3]

    # Database methods
    def _get_cached_analysis(self, email_hash: str) -> Optional[EmailIntelligence]:
        """Get cached analysis from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT analysis_data FROM email_analysis WHERE email_hash = ?",
                    (email_hash,)
                )
                result = cursor.fetchone()
                
                if result:
                    analysis_data = json.loads(result[0])
                    # Convert back to EmailIntelligence (simplified)
                    return EmailIntelligence(**analysis_data)
        except Exception as e:
            self.logger.warning(f"Failed to get cached analysis: {e}")
        
        return None

    def _store_analysis(self, email_hash: str, subject: str, sender: str, 
                       analysis: EmailIntelligence):
        """Store analysis in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT OR REPLACE INTO email_analysis 
                    (email_hash, subject, sender, classification, urgency, confidence, analysis_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    email_hash,
                    subject,
                    sender,
                    analysis.classification.value,
                    analysis.urgency.value,
                    analysis.confidence,
                    json.dumps(asdict(analysis), default=str)
                ))
        except Exception as e:
            self.logger.error(f"Failed to store analysis: {e}")

    def _get_cached_draft(self, email_hash: str) -> Optional[str]:
        """Get cached draft from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT draft_content FROM draft_generations WHERE email_hash = ? ORDER BY created_at DESC LIMIT 1",
                    (email_hash,)
                )
                result = cursor.fetchone()
                return result[0] if result else None
        except Exception as e:
            self.logger.warning(f"Failed to get cached draft: {e}")
        return None

    def _store_draft(self, email_hash: str, draft_content: str, 
                    generation_method: str, model_used: str):
        """Store draft in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO draft_generations 
                    (email_hash, draft_content, generation_method, model_used)
                    VALUES (?, ?, ?, ?)
                """, (email_hash, draft_content, generation_method, model_used))
        except Exception as e:
            self.logger.error(f"Failed to store draft: {e}")

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get comprehensive performance metrics"""
        with self.metrics_lock:
            return {
                'requests': {
                    'total': self.metrics.total_requests,
                    'successful': self.metrics.successful_requests,
                    'failed': self.metrics.failed_requests,
                    'success_rate': (
                        self.metrics.successful_requests / self.metrics.total_requests 
                        if self.metrics.total_requests > 0 else 0
                    )
                },
                'cache': {
                    'hits': self.metrics.cache_hits,
                    'misses': self.metrics.cache_misses,
                    'hit_rate': (
                        self.metrics.cache_hits / (self.metrics.cache_hits + self.metrics.cache_misses)
                        if (self.metrics.cache_hits + self.metrics.cache_misses) > 0 else 0
                    ),
                    'current_size': len(self.cache)
                },
                'performance': {
                    'avg_response_time_ms': self.metrics.avg_response_time_ms,
                    'rate_limit_status': 'active',
                    'concurrent_limit': self.config['concurrent_limit']
                },
                'configuration': {
                    'ai_enabled': bool(self.config['openai_api_key']),
                    'classifier_model': self.config['classifier_model'],
                    'draft_model': self.config['draft_model'],
                    'cache_enabled': self.config['cache']['enabled']
                }
            }

    def cleanup(self):
        """Cleanup resources"""
        if hasattr(self, 'executor'):
            self.executor.shutdown(wait=True)
        self.session.close()
        self.logger.info("Production Email Intelligence Engine cleaned up")


# Example usage and testing
def main():
    """Demo the production email intelligence engine"""
    # Initialize engine
    engine = ProductionEmailIntelligenceEngine()
    
    # Test email
    test_email = {
        'subject': 'URGENT: Budget approval needed for Q4 project',
        'body': 'Hi Abdullah, I need your approval for the Q4 marketing budget of $75,000 by Friday. Please let me know if you have any questions about the allocation breakdown.',
        'sender': 'sarah.johnson@company.com',
        'sender_name': 'Sarah Johnson'
    }
    
    print("Production Email Intelligence Engine Demo")
    print("=" * 60)
    
    # Single email analysis
    print(f"\nAnalyzing email: {test_email['subject']}")
    result = engine.analyze_email(
        subject=test_email['subject'],
        body=test_email['body'],
        sender=test_email['sender']
    )
    
    print(f"\nClassification: {result.classification.value} (confidence: {result.confidence:.2f})")
    print(f"Urgency: {result.urgency.value}")
    print(f"Sentiment: {result.sentiment.value}")
    print(f"Processing time: {result.processing_time_ms:.1f}ms")
    
    # Draft generation
    print(f"\nGenerating draft reply...")
    draft = engine.generate_draft_reply(test_email, result)
    print(f"Generated draft:\n{draft}")
    
    # Performance metrics
    print(f"\nPerformance metrics:")
    metrics = engine.get_performance_metrics()
    print(json.dumps(metrics, indent=2))
    
    # Cleanup
    engine.cleanup()


if __name__ == "__main__":
    main()