#!/usr/bin/env python3
"""
Optimized Email Intelligence Engine with AI Caching and Batch Processing

Preserves exact OpenAI models specified by user:
- gpt-5-nano-2025-08-07 (for email classification)
- gpt-5-mini-2025-08-07 (for draft generation)

Features:
- Smart caching strategy that preserves model-specific results
- Batch processing with exact GPT-5 models 
- Async API calls using specified models
- Cost optimization while maintaining exact model names
- Fallback patterns with user's specified models
"""

import re
import os
import json
import logging
import hashlib
import asyncio
import aiohttp
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import unicodedata
from concurrent.futures import ThreadPoolExecutor
import time

# Lightweight ML dependencies - prefer built-in or lightweight libraries
try:
    import numpy as np
except ImportError:
    np = None

# Email classification classes (reuse from original)
class EmailClass(Enum):
    NEEDS_REPLY = "NEEDS_REPLY"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    CREATE_TASK = "CREATE_TASK"
    DELEGATE = "DELEGATE"
    FYI_ONLY = "FYI_ONLY"
    FOLLOW_UP = "FOLLOW_UP"

class Urgency(Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class Sentiment(Enum):
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"
    FRUSTRATED = "FRUSTRATED"

@dataclass
class ActionItem:
    """Extracted action item with context"""
    text: str
    assignee: Optional[str] = None
    deadline: Optional[datetime] = None
    confidence: float = 0.0

@dataclass
class EmailIntelligence:
    """Complete email analysis result"""
    classification: EmailClass
    confidence: float
    urgency: Urgency
    sentiment: Sentiment
    intent: str
    action_items: List[ActionItem]
    deadlines: List[Tuple[datetime, str]]  # (deadline, context)
    confidence_scores: Dict[str, float]
    processing_time_ms: float
    
    # Optimization metadata
    cached: bool = False
    ai_used: bool = False
    model_used: Optional[str] = None

@dataclass
class CacheEntry:
    """Cache entry with metadata"""
    result: EmailIntelligence
    created_at: datetime
    model_used: str
    content_hash: str
    hits: int = 0

class AIClassificationCache:
    """In-memory cache optimized for AI classification results"""
    
    def __init__(self, max_size: int = 10000, ttl_hours: int = 24):
        self.cache: Dict[str, CacheEntry] = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_hours * 3600
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'ai_calls_saved': 0,
            'cost_saved_estimate': 0.0
        }
        
    def _generate_key(self, content: str, model: str) -> str:
        """Generate cache key from content and model"""
        # Include model in hash to differentiate results by model
        combined = f"{model}:{content}"
        return hashlib.sha256(combined.encode()).hexdigest()[:32]
    
    def get(self, content: str, model: str) -> Optional[EmailIntelligence]:
        """Get cached result if available and fresh"""
        key = self._generate_key(content, model)
        
        if key in self.cache:
            entry = self.cache[key]
            
            # Check TTL
            if (datetime.now() - entry.created_at).total_seconds() > self.ttl_seconds:
                del self.cache[key]
                return None
                
            # Update hit count and stats
            entry.hits += 1
            self.stats['hits'] += 1
            self.stats['ai_calls_saved'] += 1
            
            # Mark as cached for metadata
            result = entry.result
            result.cached = True
            result.model_used = entry.model_used
            
            return result
        
        self.stats['misses'] += 1
        return None
    
    def set(self, content: str, model: str, result: EmailIntelligence) -> None:
        """Cache result with eviction if needed"""
        key = self._generate_key(content, model)
        
        # Evict oldest entries if cache is full
        if len(self.cache) >= self.max_size:
            self._evict_oldest()
            
        # Store entry
        content_hash = hashlib.md5(content.encode()).hexdigest()[:16]
        entry = CacheEntry(
            result=result,
            created_at=datetime.now(),
            model_used=model,
            content_hash=content_hash
        )
        
        self.cache[key] = entry
    
    def _evict_oldest(self) -> None:
        """Evict least recently used entries"""
        if not self.cache:
            return
            
        # Sort by creation time and remove oldest 10%
        sorted_items = sorted(
            self.cache.items(),
            key=lambda x: (x[1].created_at, x[1].hits)
        )
        
        evict_count = max(1, len(sorted_items) // 10)
        for i in range(evict_count):
            key, _ = sorted_items[i]
            del self.cache[key]
            self.stats['evictions'] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache performance statistics"""
        total_requests = self.stats['hits'] + self.stats['misses']
        hit_rate = (self.stats['hits'] / total_requests * 100) if total_requests > 0 else 0
        
        # Estimate cost savings (rough calculation)
        # Assume ~$0.0001 per classification call
        cost_saved = self.stats['ai_calls_saved'] * 0.0001
        
        return {
            'cache_size': len(self.cache),
            'hit_rate_percent': round(hit_rate, 2),
            'total_hits': self.stats['hits'],
            'total_misses': self.stats['misses'],
            'ai_calls_saved': self.stats['ai_calls_saved'],
            'estimated_cost_saved_usd': round(cost_saved, 4),
            'evictions': self.stats['evictions'],
            'memory_entries': len(self.cache)
        }

class OptimizedEmailIntelligenceEngine:
    """
    Optimized Email Intelligence Engine with AI caching and batch processing.
    
    Preserves exact model names as specified:
    - gpt-5-nano-2025-08-07 for classification
    - gpt-5-mini-2025-08-07 for draft generation
    
    Features:
    - Smart caching for AI results
    - Batch processing for efficiency
    - Async API calls
    - Cost optimization
    - Fallback patterns
    """
    
    def __init__(self, 
                 cache_size: int = 10000, 
                 cache_ttl_hours: int = 24,
                 max_concurrent_requests: int = 10):
        
        self.logger = logging.getLogger(__name__)
        
        # AI Configuration - EXACT models as specified by user
        self.openai_api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_APIKEY")
        self.classifier_model = "gpt-5-nano-2025-08-07"  # EXACT model for classification
        self.draft_model = "gpt-5-mini-2025-08-07"       # EXACT model for draft generation
        
        # Cache system
        self.cache = AIClassificationCache(max_size=cache_size, ttl_hours=cache_ttl_hours)
        
        # Concurrency control
        self.semaphore = asyncio.Semaphore(max_concurrent_requests)
        self.session = None  # Will be initialized async
        
        # Performance tracking
        self.stats = {
            'total_analyzed': 0,
            'ai_classifications': 0,
            'fallback_classifications': 0,
            'batch_processed': 0,
            'avg_processing_time_ms': 0.0,
            'errors': 0
        }
        
        # Initialize patterns (reuse from original engine)
        self._initialize_patterns()
        
        self.logger.info(f"Initialized OptimizedEmailIntelligenceEngine")
        self.logger.info(f"Classification model: {self.classifier_model}")
        self.logger.info(f"Draft model: {self.draft_model}")
        self.logger.info(f"Cache size: {cache_size}, TTL: {cache_ttl_hours}h")
    
    async def __aenter__(self):
        """Async context manager entry"""
        if not self.session:
            timeout = aiohttp.ClientTimeout(total=30, connect=10)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
            self.session = None
    
    def _initialize_patterns(self):
        """Initialize regex patterns for feature extraction (from original engine)"""
        
        # Classification patterns with confidence weights
        self.classification_patterns = {
            EmailClass.NEEDS_REPLY: {
                'patterns': [
                    (r'\b(please\s+(?:reply|respond|confirm|let\s+me\s+know))\b', 0.9),
                    (r'\b(waiting\s+for\s+your\s+(?:response|reply))\b', 0.85),
                    (r'\b(could\s+you\s+please)\b', 0.8),
                    (r'\b(can\s+you\s+please)\b', 0.8),
                    (r'\b(need\s+your\s+(?:input|feedback|thoughts))\b', 0.8),
                    (r'\?[^?]*$', 0.6),  # Ends with question
                    (r'\b(what\s+do\s+you\s+think)\b', 0.7),
                    (r'\b(quick\s+question)\b', 0.75),
                    (r'\b(feedback\s+needed)\b', 0.8),
                    (r'\b(review\s+(?:the|this))\b', 0.7),
                ],
                'negative': [
                    (r'\b(fyi|for\s+your\s+information|just\s+to\s+let\s+you\s+know)\b', -0.5),
                ]
            },
            
            EmailClass.APPROVAL_REQUIRED: {
                'patterns': [
                    (r'\b(please\s+(?:approve|sign\s+off|authorize))\b', 0.95),
                    (r'\b(need\s+(?:approval|authorization|sign-off))\b', 0.9),
                    (r'\b(waiting\s+for\s+approval)\b', 0.85),
                    (r'\b(budget\s+approval)\b', 0.9),
                    (r'\b(requires?\s+your\s+approval)\b', 0.9),
                ],
                'negative': []
            },
            
            EmailClass.CREATE_TASK: {
                'patterns': [
                    (r'\b(create\s+(?:task|ticket|issue))\b', 0.9),
                    (r'\b(need\s+to\s+(?:do|complete|finish|implement))\b', 0.7),
                    (r'\b(action\s+item)\b', 0.8),
                    (r'\b(todo|to-do)\b', 0.75),
                    (r'\b(deliverable)\b', 0.8),
                    (r'\b(milestone)\b', 0.7),
                ],
                'negative': []
            },
            
            EmailClass.DELEGATE: {
                'patterns': [
                    (r'\b(can\s+you\s+(?:handle|take\s+care\s+of))\b', 0.85),
                    (r'\b(please\s+(?:assign|delegate))\b', 0.9),
                    (r'\b(pass\s+this\s+to)\b', 0.85),
                    (r'\b(forward\s+to)\b', 0.7),
                    (r'\b(assign\s+(?:this|to))\b', 0.85),
                ],
                'negative': []
            },
            
            EmailClass.FYI_ONLY: {
                'patterns': [
                    (r'\b(fyi|for\s+your\s+information)\b', 0.9),
                    (r'\b(just\s+to\s+let\s+you\s+know)\b', 0.85),
                    (r'\b(heads\s+up)\b', 0.8),
                    (r'\b(update|status\s+update)\b', 0.7),
                    (r'\b(no\s+action\s+required)\b', 0.95),
                ],
                'negative': [
                    (r'\?[^?]*$', -0.6),  # Contains questions
                ]
            },
            
            EmailClass.FOLLOW_UP: {
                'patterns': [
                    (r'\b(follow\s+up)\b', 0.9),
                    (r'\b(checking\s+in)\b', 0.8),
                    (r'\b(any\s+update)\b', 0.8),
                    (r'\b(reminder)\b', 0.75),
                    (r'\b(following\s+up\s+on)\b', 0.85),
                ],
                'negative': []
            }
        }
        
        # Urgency patterns
        self.urgency_patterns = {
            Urgency.CRITICAL: [
                (r'\b(urgent|asap|immediately|critical|emergency)\b', 0.95),
                (r'\b(today|right\s+now|this\s+morning)\b', 0.8),
            ],
            Urgency.HIGH: [
                (r'\b(high\s+priority|important|soon)\b', 0.8),
                (r'\b(this\s+week|by\s+friday)\b', 0.7),
            ],
            Urgency.MEDIUM: [
                (r'\b(when\s+you\s+can|at\s+your\s+convenience)\b', 0.7),
                (r'\b(next\s+week)\b', 0.6),
            ],
            Urgency.LOW: [
                (r'\b(no\s+rush|whenever)\b', 0.8),
                (r'\b(low\s+priority)\b', 0.9),
            ]
        }
        
        # Sentiment patterns
        self.sentiment_patterns = {
            Sentiment.POSITIVE: [
                (r'\b(thanks?|thank\s+you|appreciate|great|excellent|perfect)\b', 0.8),
                (r'\b(good\s+(?:job|work)|well\s+done)\b', 0.85),
            ],
            Sentiment.NEGATIVE: [
                (r'\b(disappointed|concerned|issue|problem|error)\b', 0.7),
                (r'\b(not\s+(?:working|good|right))\b', 0.75),
            ],
            Sentiment.FRUSTRATED: [
                (r'\b(frustrated|annoyed|ridiculous|unacceptable)\b', 0.9),
                (r'\b(how\s+many\s+times|repeatedly|again\s+and\s+again)\b', 0.8),
            ]
        }
    
    async def analyze_email_async(self, 
                                 subject: str, 
                                 body: str, 
                                 sender: str = "", 
                                 metadata: Optional[Dict] = None) -> EmailIntelligence:
        """
        Async email analysis with caching and AI optimization.
        Uses exact models: gpt-5-nano-2025-08-07 for classification
        """
        start_time = datetime.now()
        
        # Preprocess text
        full_text = self._preprocess_text(f"{subject} {body}")
        
        # Try cache first
        cached_result = self.cache.get(full_text, self.classifier_model)
        if cached_result:
            self.logger.debug("Cache hit for email analysis")
            return cached_result
        
        # Classification with AI (async)
        classification, class_confidence, ai_used = await self._classify_email_async(
            full_text, subject, sender
        )
        
        # Extract other features (non-AI, fast)
        urgency = self._extract_urgency(full_text)
        sentiment = self._extract_sentiment(full_text)
        intent = self._extract_intent(full_text, classification)
        action_items = self._extract_action_items(full_text)
        deadlines = self._extract_deadlines(full_text)
        
        # Confidence scores for all predictions
        confidence_scores = {
            'classification': class_confidence,
            'urgency': self._calculate_confidence(urgency, full_text, self.urgency_patterns),
            'sentiment': self._calculate_confidence(sentiment, full_text, self.sentiment_patterns),
            'action_items': np.mean([item.confidence for item in action_items]) if action_items and np else 0.0,
            'deadlines': 0.8 if deadlines else 0.0
        }
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Create result
        result = EmailIntelligence(
            classification=classification,
            confidence=class_confidence,
            urgency=urgency,
            sentiment=sentiment,
            intent=intent,
            action_items=action_items,
            deadlines=deadlines,
            confidence_scores=confidence_scores,
            processing_time_ms=processing_time,
            cached=False,
            ai_used=ai_used,
            model_used=self.classifier_model if ai_used else "pattern_based"
        )
        
        # Cache the result
        self.cache.set(full_text, self.classifier_model, result)
        
        # Update stats
        self.stats['total_analyzed'] += 1
        if ai_used:
            self.stats['ai_classifications'] += 1
        else:
            self.stats['fallback_classifications'] += 1
        
        return result
    
    async def batch_analyze_async(self, 
                                 emails: List[Dict],
                                 max_concurrent: int = 5) -> List[EmailIntelligence]:
        """
        Batch analyze emails with controlled concurrency.
        Optimized for cost and performance with caching.
        """
        start_time = datetime.now()
        
        # Create semaphore for concurrency control
        semaphore = asyncio.Semaphore(max_concurrent)
        
        async def analyze_single(email: Dict) -> EmailIntelligence:
            async with semaphore:
                try:
                    return await self.analyze_email_async(
                        subject=email.get('subject', ''),
                        body=email.get('body', ''),
                        sender=email.get('sender', ''),
                        metadata=email.get('metadata', {})
                    )
                except Exception as e:
                    self.logger.error(f"Error analyzing email: {e}")
                    self.stats['errors'] += 1
                    # Return fallback result
                    return EmailIntelligence(
                        classification=EmailClass.FYI_ONLY,
                        confidence=0.0,
                        urgency=Urgency.MEDIUM,
                        sentiment=Sentiment.NEUTRAL,
                        intent="unknown",
                        action_items=[],
                        deadlines=[],
                        confidence_scores={},
                        processing_time_ms=0.0,
                        cached=False,
                        ai_used=False,
                        model_used="error_fallback"
                    )
        
        # Process all emails concurrently
        self.logger.info(f"Starting batch analysis of {len(emails)} emails")
        
        tasks = [analyze_single(email) for email in emails]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter out exceptions and convert to EmailIntelligence objects
        valid_results = []
        for result in results:
            if isinstance(result, EmailIntelligence):
                valid_results.append(result)
            else:
                self.logger.error(f"Batch analysis error: {result}")
                self.stats['errors'] += 1
        
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        self.stats['batch_processed'] += len(valid_results)
        
        # Update average processing time
        if self.stats['total_analyzed'] > 0:
            self.stats['avg_processing_time_ms'] = (
                self.stats['avg_processing_time_ms'] + processing_time
            ) / 2
        else:
            self.stats['avg_processing_time_ms'] = processing_time
        
        self.logger.info(f"Batch analysis completed: {len(valid_results)} emails in {processing_time:.0f}ms")
        
        return valid_results
    
    async def _classify_email_async(self, 
                                  text: str, 
                                  subject: str, 
                                  sender: str) -> Tuple[EmailClass, float, bool]:
        """
        Async AI classification using exact model: gpt-5-nano-2025-08-07
        Returns (classification, confidence, ai_used)
        """
        
        # Try AI classification first if configured and session available
        if self.openai_api_key and self.session:
            try:
                ai_result = await self._classify_with_ai_async(text, subject, sender)
                if ai_result:
                    classification, confidence = ai_result
                    return classification, confidence, True
            except Exception as e:
                self.logger.warning(f"AI classification failed, using pattern matching. Error: {e}")
        
        # Fallback to pattern-based classification
        classification, confidence = self._classify_with_patterns(text, subject, sender)
        return classification, confidence, False
    
    async def _classify_with_ai_async(self, 
                                    text: str, 
                                    subject: str, 
                                    sender: str) -> Optional[Tuple[EmailClass, float]]:
        """
        Use OpenAI API async to classify email (uses exact gpt-5-nano-2025-08-07 model)
        """
        
        async with self.semaphore:  # Rate limiting
            try:
                system_prompt = (
                    "You are an email classification expert. Classify emails into one of these categories:\n"
                    "- NEEDS_REPLY: Requires a response from the recipient\n"
                    "- APPROVAL_REQUIRED: Requires approval or sign-off\n"
                    "- CREATE_TASK: Contains action items or tasks to complete\n"
                    "- DELEGATE: Should be delegated to someone else\n"
                    "- FYI_ONLY: Informational only, no action needed\n"
                    "- FOLLOW_UP: Requires follow-up or check-in\n\n"
                    "Respond with ONLY the category name and a confidence score (0-1) separated by a pipe, e.g.: NEEDS_REPLY|0.95"
                )
                
                user_prompt = (
                    f"Subject: {subject}\n"
                    f"From: {sender}\n\n"
                    f"Email content:\n{text[:1000]}"  # Limit for efficiency
                )
                
                headers = {
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json",
                }
                
                payload = {
                    "model": self.classifier_model,  # EXACT model as specified
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.1,  # Low temperature for consistent classification
                    "max_tokens": 50,
                }
                
                async with self.session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    response.raise_for_status()
                    data = await response.json()
                    
                    result = (
                        data.get("choices", [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                    )
                    
                    if result and "|" in result:
                        parts = result.split("|")
                        class_name = parts[0].strip()
                        confidence = float(parts[1].strip())
                        
                        # Map string to enum
                        for email_class in EmailClass:
                            if email_class.value == class_name:
                                return email_class, confidence
                
                return None
                
            except Exception as e:
                self.logger.debug(f"AI classification error: {e}")
                raise  # Re-raise to trigger fallback
    
    def _classify_with_patterns(self, 
                              text: str, 
                              subject: str, 
                              sender: str) -> Tuple[EmailClass, float]:
        """Pattern-based classification fallback (from original engine)"""
        
        class_scores = {}
        
        for email_class, patterns_data in self.classification_patterns.items():
            score = 0.0
            
            # Positive patterns
            for pattern, weight in patterns_data['patterns']:
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches * weight
            
            # Negative patterns (reduce score)
            for pattern, weight in patterns_data.get('negative', []):
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches * weight  # weight is negative
            
            class_scores[email_class] = max(0.0, score)
        
        # Apply business rules
        class_scores = self._apply_classification_rules(class_scores, text, subject, sender)
        
        # Get top classification
        if not class_scores or max(class_scores.values()) == 0:
            return EmailClass.FYI_ONLY, 0.5  # Default fallback
            
        best_class = max(class_scores.items(), key=lambda x: x[1])
        
        # Normalize confidence to 0-1 range  
        max_score = max(class_scores.values())
        if max_score > 0:
            confidence = min(best_class[1] / (max_score + 1.0), 1.0)
        else:
            confidence = 0.5
        
        return best_class[0], confidence
    
    async def generate_draft_reply_async(self, 
                                       email: Dict[str, Any], 
                                       analysis: EmailIntelligence) -> str:
        """
        Generate a draft reply using exact model: gpt-5-mini-2025-08-07
        """
        subject = email.get('subject', '')
        sender_name = email.get('sender_name') or email.get('sender') or 'there'
        content = email.get('content', '')

        # If OpenAI is configured and session available, try external model
        if self.openai_api_key and self.session:
            try:
                async with self.semaphore:  # Rate limiting
                    system_prompt = (
                        "You are an executive email drafting assistant. Write concise, polite replies "
                        "that match a professional business tone. Keep to 3-7 sentences. Do not add placeholders."
                    )

                    # Include analysis context to guide the model
                    action_summaries = []
                    for item in analysis.action_items:
                        action_line = f"- {item.text}"
                        if item.deadline:
                            action_line += f" (deadline: {item.deadline.strftime('%Y-%m-%d')})"
                        if item.assignee:
                            action_line += f" (assignee: {item.assignee})"
                        action_summaries.append(action_line)

                    user_prompt = (
                        f"Subject: {subject}\n"
                        f"From: {sender_name}\n\n"
                        f"Email content:\n{content}\n\n"
                        f"Analysis:\n"
                        f"- classification: {analysis.classification.value}\n"
                        f"- urgency: {analysis.urgency.value}\n"
                        f"- sentiment: {analysis.sentiment.value}\n"
                        f"- intent: {analysis.intent}\n"
                        f"- action items:\n{os.linesep.join(action_summaries) if action_summaries else '- none'}\n\n"
                        "Write a direct reply in first person that addresses the sender appropriately, "
                        "acknowledges key points, answers questions, and proposes next steps if relevant."
                    )

                    headers = {
                        "Authorization": f"Bearer {self.openai_api_key}",
                        "Content-Type": "application/json",
                    }
                    
                    payload = {
                        "model": self.draft_model,  # EXACT model as specified
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.3,
                    }

                    async with self.session.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers=headers,
                        json=payload
                    ) as response:
                        response.raise_for_status()
                        data = await response.json()
                        
                        draft = (
                            data.get("choices", [{}])[0]
                            .get("message", {})
                            .get("content", "")
                            .strip()
                        )
                        
                        if draft:
                            return draft
                            
            except Exception as e:
                self.logger.warning(f"AI draft generation failed, using fallback. Error: {e}")

        # Fallback template (same as original)
        return self._generate_template_draft(sender_name, analysis)
    
    def _generate_template_draft(self, sender_name: str, analysis: EmailIntelligence) -> str:
        """Generate template-based draft (fallback)"""
        greeting_name = sender_name.split(" ")[0].strip(",:")
        greeting = f"Hi {greeting_name},"

        body_lines: List[str] = []
        cls = analysis.classification
        
        if cls == EmailClass.NEEDS_REPLY:
            body_lines.append("Thanks for reaching out. I've reviewed your note below.")
            body_lines.append("Here's my response:")
        elif cls == EmailClass.APPROVAL_REQUIRED:
            body_lines.append("Thanks for the details. I approve proceeding as proposed.")
        elif cls == EmailClass.CREATE_TASK:
            body_lines.append("Thanks for the context. I'll track this as a task and update you on progress.")
        elif cls == EmailClass.DELEGATE:
            body_lines.append("Thanks — I'll have the right person pick this up and follow back with timing.")
        elif cls == EmailClass.FOLLOW_UP:
            body_lines.append("Appreciate the follow‑up. Sharing a quick update below.")
        else:  # FYI_ONLY or default
            body_lines.append("Thanks for the update — noted.")

        # Include first action if present
        if analysis.action_items:
            first_action = analysis.action_items[0]
            action_text = first_action.text.rstrip(".")
            due = f" by {first_action.deadline.strftime('%Y-%m-%d')}" if first_action.deadline else ""
            body_lines.append(f"I'll take the action: {action_text}{due}.")

        closing = "Best regards,\nYour Assistant"
        return "\n\n".join([greeting, *body_lines, closing])
    
    # ==================== UTILITY METHODS (from original) ====================
    
    def _preprocess_text(self, text: str) -> str:
        """Normalize and clean text for analysis"""
        text = unicodedata.normalize('NFKD', text)
        text = text.lower()
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'--\s*\n.*', '', text, flags=re.DOTALL)
        return text
    
    def _apply_classification_rules(self, scores: Dict, text: str, subject: str, sender: str) -> Dict:
        """Apply business rules and context to improve classification"""
        
        # Rule: Emails with questions likely need replies
        question_count = len(re.findall(r'\?', text))
        if question_count > 0:
            scores[EmailClass.NEEDS_REPLY] += question_count * 0.3
        
        # Rule: Subject line indicators
        if re.search(r'\b(re:|fwd:)\b', subject.lower()):
            scores[EmailClass.FOLLOW_UP] += 0.2
            
        if re.search(r'\b(urgent|asap)\b', subject.lower()):
            scores[EmailClass.NEEDS_REPLY] += 0.3
        
        # Rule: Automated emails are usually FYI
        if re.search(r'\b(no-?reply|donotreply|automated)\b', sender.lower()):
            scores[EmailClass.FYI_ONLY] += 0.5
            
        return scores
    
    def _extract_urgency(self, text: str) -> Urgency:
        """Extract urgency level from text"""
        urgency_scores = {}
        
        for urgency, patterns in self.urgency_patterns.items():
            score = 0.0
            for pattern, weight in patterns:
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches * weight
            urgency_scores[urgency] = score
        
        if not urgency_scores or max(urgency_scores.values()) == 0:
            return Urgency.MEDIUM
            
        return max(urgency_scores.items(), key=lambda x: x[1])[0]
    
    def _extract_sentiment(self, text: str) -> Sentiment:
        """Extract sentiment from text"""
        sentiment_scores = {}
        
        for sentiment, patterns in self.sentiment_patterns.items():
            score = 0.0
            for pattern, weight in patterns:
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches * weight
            sentiment_scores[sentiment] = score
        
        if not sentiment_scores or max(sentiment_scores.values()) == 0:
            return Sentiment.NEUTRAL
            
        return max(sentiment_scores.items(), key=lambda x: x[1])[0]
    
    def _extract_intent(self, text: str, classification: EmailClass) -> str:
        """Extract high-level intent from email"""
        
        intent_patterns = {
            'request_information': r'\b(need\s+(?:info|information|details)|what\s+is|can\s+you\s+tell\s+me)\b',
            'schedule_meeting': r'\b(schedule|meet|meeting|call|appointment)\b',
            'report_issue': r'\b(issue|problem|bug|error|not\s+working)\b',
            'provide_update': r'\b(update|status|progress|report)\b',
            'request_approval': r'\b(approve|approval|sign-?off|authorize)\b',
            'delegate_task': r'\b(can\s+you|please\s+handle|assign|delegate)\b',
            'follow_up': r'\b(follow\s+up|checking\s+in|reminder)\b',
        }
        
        intent_scores = {}
        for intent, pattern in intent_patterns.items():
            matches = len(re.findall(pattern, text, re.IGNORECASE))
            intent_scores[intent] = matches
        
        if not intent_scores or max(intent_scores.values()) == 0:
            return classification.value.lower().replace('_', ' ')
        
        return max(intent_scores.items(), key=lambda x: x[1])[0]
    
    def _extract_action_items(self, text: str) -> List[ActionItem]:
        """Extract action items from email text"""
        action_patterns = [
            (r'\b(please\s+(?:\w+\s+){0,3}\w+)', 0.8),
            (r'\b(need\s+to\s+(?:\w+\s+){0,3}\w+)', 0.7),
            (r'\b(action\s+item:?\s+(.+))', 0.9),
            (r'\b(todo:?\s+(.+))', 0.85),
            (r'\b(deliverable:?\s+(.+))', 0.8),
        ]
        
        action_items = []
        for pattern, confidence in action_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                action_text = match.group(1) if match.groups() else match.group(0)
                action_text = action_text.strip()
                
                if len(action_text) > 10:
                    action_items.append(ActionItem(
                        text=action_text,
                        confidence=confidence
                    ))
        
        return action_items[:5]  # Limit to top 5 actions
    
    def _extract_deadlines(self, text: str) -> List[Tuple[datetime, str]]:
        """Extract deadlines from email text"""
        deadline_patterns = [
            (r'\b(by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b', 0.9),
            (r'\b(due\s+(?:date|by)?:?\s*([^.!?\n]+))', 0.85),
            (r'\b(deadline:?\s*([^.!?\n]+))', 0.9),
            (r'\b(before\s+([^.!?\n]+))', 0.7),
            (r'\b(by\s+friday)\b', 0.9),
            (r'\b(by\s+tomorrow)\b', 0.95),
        ]
        
        deadlines = []
        for pattern, confidence in deadline_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                deadline_text = match.group(1) if match.groups() else match.group(0)
                deadline_date = self._parse_deadline_date(deadline_text)
                
                if deadline_date:
                    deadlines.append((deadline_date, deadline_text.strip()))
        
        return sorted(list(set(deadlines)), key=lambda x: x[0])[:3]
    
    def _parse_deadline_date(self, deadline_text: str) -> Optional[datetime]:
        """Parse deadline text into datetime object"""
        now = datetime.now()
        deadline_text = deadline_text.lower().strip()
        
        if 'today' in deadline_text:
            return now.replace(hour=17, minute=0, second=0, microsecond=0)
        elif 'tomorrow' in deadline_text:
            return (now + timedelta(days=1)).replace(hour=17, minute=0, second=0, microsecond=0)
        elif 'this week' in deadline_text or 'by friday' in deadline_text:
            days_until_friday = (4 - now.weekday()) % 7
            if days_until_friday == 0:
                days_until_friday = 7
            return (now + timedelta(days=days_until_friday)).replace(hour=17, minute=0, second=0, microsecond=0)
        
        return None
    
    def _calculate_confidence(self, prediction: Any, text: str, patterns: Dict) -> float:
        """Calculate confidence score for predictions"""
        if prediction in patterns:
            score = 0.0
            for pattern, weight in patterns[prediction]:
                matches = len(re.findall(pattern, text, re.IGNORECASE))
                score += matches * weight
            return min(score, 1.0)
        return 0.5
    
    # ==================== PERFORMANCE AND STATS ====================
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get comprehensive performance statistics"""
        cache_stats = self.cache.get_stats()
        
        return {
            'engine_stats': self.stats,
            'cache_stats': cache_stats,
            'model_config': {
                'classifier_model': self.classifier_model,
                'draft_model': self.draft_model,
                'api_key_configured': bool(self.openai_api_key)
            },
            'optimization_features': {
                'caching_enabled': True,
                'async_processing': True,
                'batch_processing': True,
                'concurrency_control': True,
                'cost_optimization': True
            }
        }
    
    async def warmup_cache(self, sample_emails: List[Dict]) -> Dict[str, Any]:
        """Warm up cache with sample emails"""
        self.logger.info(f"Warming up cache with {len(sample_emails)} sample emails")
        
        start_time = datetime.now()
        
        # Ensure session is available
        if not self.session:
            await self.__aenter__()
        
        try:
            results = await self.batch_analyze_async(sample_emails, max_concurrent=3)
            
            warmup_time = (datetime.now() - start_time).total_seconds()
            
            return {
                'emails_processed': len(results),
                'warmup_time_seconds': warmup_time,
                'cache_entries_created': len(results),
                'cache_stats': self.cache.get_stats()
            }
        except Exception as e:
            self.logger.error(f"Cache warmup error: {e}")
            return {'error': str(e)}

# Sync wrapper for backward compatibility
class OptimizedEmailIntelligenceEngineSync:
    """Synchronous wrapper for the async optimized engine"""
    
    def __init__(self, **kwargs):
        self.async_engine = OptimizedEmailIntelligenceEngine(**kwargs)
        self.loop = None
    
    def _get_loop(self):
        """Get or create event loop"""
        try:
            return asyncio.get_running_loop()
        except RuntimeError:
            if self.loop is None:
                self.loop = asyncio.new_event_loop()
                asyncio.set_event_loop(self.loop)
            return self.loop
    
    def analyze_email(self, subject: str, body: str, sender: str = "", metadata: Optional[Dict] = None) -> EmailIntelligence:
        """Sync wrapper for email analysis"""
        async def _analyze():
            async with self.async_engine:
                return await self.async_engine.analyze_email_async(subject, body, sender, metadata)
        
        loop = self._get_loop()
        return loop.run_until_complete(_analyze())
    
    def batch_analyze(self, emails: List[Dict], max_concurrent: int = 5) -> List[EmailIntelligence]:
        """Sync wrapper for batch analysis"""
        async def _batch_analyze():
            async with self.async_engine:
                return await self.async_engine.batch_analyze_async(emails, max_concurrent)
        
        loop = self._get_loop()
        return loop.run_until_complete(_batch_analyze())
    
    def generate_draft_reply(self, email: Dict[str, Any], analysis: EmailIntelligence) -> str:
        """Sync wrapper for draft generation"""
        async def _generate_draft():
            async with self.async_engine:
                return await self.async_engine.generate_draft_reply_async(email, analysis)
        
        loop = self._get_loop()
        return loop.run_until_complete(_generate_draft())
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics"""
        return self.async_engine.get_performance_stats()

# Main function for testing
async def main():
    """Demo and testing function for optimized engine"""
    
    # Test emails
    test_emails = [
        {
            'subject': 'URGENT: Please approve budget for Q4 marketing',
            'body': 'Hi team, I need your approval for the Q4 marketing budget by end of this week. The amount is $50,000. Please let me know if you have any questions.',
            'sender': 'john.doe@company.com'
        },
        {
            'subject': 'FYI: Server maintenance scheduled',
            'body': 'Just to let you know that we have scheduled server maintenance for this weekend. No action required from your side.',
            'sender': 'it-team@company.com'
        },
        {
            'subject': 'Can you help with the presentation?',
            'body': 'Hi Sarah, could you please help me with the slides for tomorrow\'s client presentation? I need someone to review the financial projections section.',
            'sender': 'mike.wilson@company.com'
        }
    ]
    
    print("=" * 70)
    print("OPTIMIZED EMAIL INTELLIGENCE ENGINE DEMO")
    print("=" * 70)
    
    # Initialize optimized engine
    async with OptimizedEmailIntelligenceEngine(cache_size=1000, cache_ttl_hours=24) as engine:
        
        print(f"\n✓ Initialized with models:")
        print(f"  - Classification: {engine.classifier_model}")
        print(f"  - Draft generation: {engine.draft_model}")
        print(f"  - Cache size: {engine.cache.max_size}")
        print(f"  - API key configured: {bool(engine.openai_api_key)}")
        
        # Single email analysis
        print(f"\n{'='*50}")
        print("SINGLE EMAIL ANALYSIS")
        print(f"{'='*50}")
        
        email = test_emails[0]
        print(f"Subject: {email['subject']}")
        
        start = datetime.now()
        result = await engine.analyze_email_async(
            subject=email['subject'],
            body=email['body'],
            sender=email['sender']
        )
        elapsed = (datetime.now() - start).total_seconds() * 1000
        
        print(f"\n✓ Analysis completed in {elapsed:.0f}ms")
        print(f"Classification: {result.classification.value} (confidence: {result.confidence:.2%})")
        print(f"Cached: {result.cached}, AI used: {result.ai_used}")
        print(f"Model used: {result.model_used}")
        
        # Test cache by analyzing same email again
        print(f"\n--- Testing cache (same email) ---")
        start = datetime.now()
        result2 = await engine.analyze_email_async(
            subject=email['subject'],
            body=email['body'],
            sender=email['sender']
        )
        elapsed2 = (datetime.now() - start).total_seconds() * 1000
        
        print(f"✓ Second analysis in {elapsed2:.0f}ms")
        print(f"Cached: {result2.cached} (should be True)")
        
        # Batch analysis
        print(f"\n{'='*50}")
        print("BATCH ANALYSIS")
        print(f"{'='*50}")
        
        start = datetime.now()
        batch_results = await engine.batch_analyze_async(test_emails, max_concurrent=3)
        elapsed = (datetime.now() - start).total_seconds() * 1000
        
        print(f"\n✓ Batch analysis of {len(test_emails)} emails in {elapsed:.0f}ms")
        print(f"Average per email: {elapsed/len(test_emails):.0f}ms")
        
        for i, result in enumerate(batch_results):
            print(f"  {i+1}. {result.classification.value} (AI: {result.ai_used}, Cached: {result.cached})")
        
        # Draft generation
        print(f"\n{'='*50}")
        print("DRAFT GENERATION")
        print(f"{'='*50}")
        
        analysis = batch_results[0]  # Use first email's analysis
        email_for_draft = {
            'subject': test_emails[0]['subject'],
            'sender_name': 'John Doe',
            'content': test_emails[0]['body']
        }
        
        start = datetime.now()
        draft = await engine.generate_draft_reply_async(email_for_draft, analysis)
        elapsed = (datetime.now() - start).total_seconds() * 1000
        
        print(f"\n✓ Draft generated in {elapsed:.0f}ms")
        print(f"\nDraft Reply:\n{'-'*40}")
        print(draft)
        print('-'*40)
        
        # Performance stats
        print(f"\n{'='*50}")
        print("PERFORMANCE STATISTICS")
        print(f"{'='*50}")
        
        stats = engine.get_performance_stats()
        print(json.dumps(stats, indent=2, default=str))

if __name__ == "__main__":
    asyncio.run(main())