#!/usr/bin/env python3
"""
GPT-5 Powered Email Processing System
====================================

Advanced email analysis and processing system using GPT-5 models:
- gpt-5-nano-2025-08-07 for fast classification
- gpt-5-mini-2025-08-07 for draft generation

Features:
- Email classification (REPLY/NO_REPLY/TASK/DELEGATE/FYI_ONLY)
- Draft generation in user's writing style
- Task extraction and prioritization
- Smart tagging and categorization
- Action item identification
- Learning from user corrections
- Context understanding and email threading
"""

import os
import re
import json
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import unicodedata
from pathlib import Path

# External dependencies
try:
    import requests
    import aiohttp
    import numpy as np
    from email_intelligence_engine import EmailIntelligenceEngine, EmailClass, Urgency, Sentiment
except ImportError as e:
    print(f"Import error: {e}. Please install required dependencies.")
    raise

# Enhanced email classification for GPT-5 system
class GPT5EmailClass(Enum):
    """Enhanced classification categories for GPT-5 system"""
    REPLY = "REPLY"              # Requires direct response
    NO_REPLY = "NO_REPLY"        # No response needed
    TASK = "TASK"                # Contains actionable tasks
    DELEGATE = "DELEGATE"        # Should be delegated
    FYI_ONLY = "FYI_ONLY"       # Information only
    APPROVAL = "APPROVAL"        # Requires approval/sign-off
    FOLLOW_UP = "FOLLOW_UP"     # Needs follow-up action
    URGENT = "URGENT"           # Urgent attention required

class TaskPriority(Enum):
    """Task priority levels"""
    CRITICAL = "CRITICAL"        # Must be done today
    HIGH = "HIGH"               # This week
    MEDIUM = "MEDIUM"           # Next 2 weeks
    LOW = "LOW"                 # When possible

@dataclass
class EmailTask:
    """Extracted task with full context"""
    description: str
    priority: TaskPriority
    deadline: Optional[datetime] = None
    assignee: Optional[str] = None
    estimated_hours: Optional[float] = None
    dependencies: List[str] = None
    context: str = ""
    confidence: float = 0.0

    def __post_init__(self):
        if self.dependencies is None:
            self.dependencies = []

@dataclass 
class EmailAnalysis:
    """Complete GPT-5 email analysis result"""
    classification: GPT5EmailClass
    confidence: float
    urgency: Urgency
    sentiment: Sentiment
    intent: str
    summary: str
    key_points: List[str]
    tasks: List[EmailTask]
    action_items: List[str]
    deadlines: List[Tuple[datetime, str]]
    people_mentioned: List[str]
    tags: List[str]
    context_thread: str
    suggested_reply_type: str
    processing_time_ms: float
    ai_reasoning: str

@dataclass
class DraftReply:
    """Generated draft reply with metadata"""
    content: str
    tone: str
    confidence: float
    key_points_addressed: List[str]
    suggested_actions: List[str]
    estimated_send_time: Optional[datetime] = None
    requires_review: bool = False

class GPT5EmailProcessor:
    """
    GPT-5 powered email processing system with advanced intelligence.
    
    Uses cutting-edge GPT-5 models for:
    - Ultra-fast classification with nano model
    - High-quality draft generation with mini model
    - Context-aware analysis
    - Learning from user patterns
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.logger = self._setup_logging()
        
        # GPT-5 model configuration
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_APIKEY")
        if not self.api_key:
            self.logger.warning("No OpenAI API key found. Falling back to pattern-based analysis.")
        
        # Exact models as specified
        self.classifier_model = "gpt-5-nano-2025-08-07"
        self.draft_model = "gpt-5-mini-2025-08-07"
        
        # User style configuration
        self.user_name = self.config.get("user_name", "Abdullah")
        self.signature_style = self.config.get("signature", "Regards Abdullah")
        self.greeting_style = self.config.get("greeting_prefix", "D")  # "D [name]..."
        
        # Initialize components
        self.base_engine = EmailIntelligenceEngine()
        self.user_patterns = self._load_user_patterns()
        self.context_cache = {}
        
        # Performance metrics
        self.metrics = {
            "total_processed": 0,
            "classification_accuracy": 0.0,
            "avg_processing_time": 0.0,
            "ai_success_rate": 0.0,
            "user_corrections": 0
        }
        
        self.logger.info("GPT-5 Email Processor initialized")
    
    def _setup_logging(self) -> logging.Logger:
        """Setup detailed logging"""
        logger = logging.getLogger("GPT5EmailProcessor")
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _load_user_patterns(self) -> Dict:
        """Load user's writing patterns and preferences"""
        patterns_file = Path("user_email_patterns.json")
        
        default_patterns = {
            "greeting_style": "professional_warm",
            "tone_preference": "concise_friendly",
            "common_phrases": [
                "Thanks for reaching out",
                "I'll review and get back to you", 
                "Let me know if you have questions",
                "Happy to discuss further"
            ],
            "signature_preferences": {
                "formal": "Regards Abdullah",
                "semi_formal": "Best regards,\nAbdullah",
                "casual": "Thanks,\nAbdullah"
            },
            "response_patterns": {
                "quick_confirm": "Confirmed - will handle this.",
                "need_more_info": "Thanks for this. Could you provide more details on [specific_point]?",
                "delegate_response": "Thanks - I'll have [team/person] handle this and follow up.",
                "timeline_request": "Thanks for the request. I can get this done by [date]. Does that work?"
            }
        }
        
        if patterns_file.exists():
            try:
                with open(patterns_file, 'r') as f:
                    user_patterns = json.load(f)
                    # Merge with defaults
                    for key, value in default_patterns.items():
                        if key not in user_patterns:
                            user_patterns[key] = value
                    return user_patterns
            except Exception as e:
                self.logger.warning(f"Could not load user patterns: {e}")
        
        return default_patterns
    
    async def analyze_email_async(self, email_data: Dict[str, Any]) -> EmailAnalysis:
        """Asynchronously analyze email with full GPT-5 intelligence"""
        start_time = datetime.now()
        
        subject = email_data.get('subject', '')
        body = email_data.get('body', '')
        sender = email_data.get('sender', '')
        thread_context = email_data.get('thread_context', '')
        
        # Build context for analysis
        full_context = self._build_email_context(email_data)
        
        try:
            # Use GPT-5 nano for fast classification
            classification_result = await self._classify_with_gpt5_nano(full_context)
            
            # Extract detailed information
            tasks = await self._extract_tasks_gpt5(full_context)
            people_mentioned = self._extract_people(body)
            key_points = await self._extract_key_points_gpt5(full_context)
            tags = await self._generate_smart_tags_gpt5(full_context)
            
            # Fallback analysis with base engine
            base_analysis = self.base_engine.analyze_email(subject, body, sender)
            
            processing_time = (datetime.now() - start_time).total_seconds() * 1000
            
            analysis = EmailAnalysis(
                classification=classification_result.get('classification', GPT5EmailClass.FYI_ONLY),
                confidence=classification_result.get('confidence', 0.5),
                urgency=base_analysis.urgency,
                sentiment=base_analysis.sentiment,
                intent=classification_result.get('intent', base_analysis.intent),
                summary=classification_result.get('summary', ''),
                key_points=key_points,
                tasks=tasks,
                action_items=classification_result.get('action_items', []),
                deadlines=base_analysis.deadlines,
                people_mentioned=people_mentioned,
                tags=tags,
                context_thread=thread_context,
                suggested_reply_type=classification_result.get('reply_type', 'standard'),
                processing_time_ms=processing_time,
                ai_reasoning=classification_result.get('reasoning', '')
            )
            
            # Update metrics
            self.metrics["total_processed"] += 1
            self._update_processing_metrics(processing_time)
            
            return analysis
            
        except Exception as e:
            self.logger.error(f"Error in GPT-5 analysis: {e}")
            # Fallback to base engine
            return await self._fallback_analysis(email_data, start_time)
    
    def analyze_email(self, email_data: Dict[str, Any]) -> EmailAnalysis:
        """Synchronous wrapper for email analysis"""
        return asyncio.run(self.analyze_email_async(email_data))
    
    async def _classify_with_gpt5_nano(self, context: str) -> Dict[str, Any]:
        """Use GPT-5 nano model for ultra-fast classification"""
        if not self.api_key:
            return self._fallback_classification(context)
        
        system_prompt = """You are an expert email classification system. Analyze emails and provide:

CLASSIFICATION (choose one):
- REPLY: Requires direct response from recipient
- NO_REPLY: No response needed
- TASK: Contains actionable tasks to complete
- DELEGATE: Should be delegated to someone else  
- FYI_ONLY: Information only, no action needed
- APPROVAL: Requires approval or sign-off
- FOLLOW_UP: Needs follow-up action
- URGENT: Urgent attention required immediately

Respond in JSON format:
{
  "classification": "REPLY|NO_REPLY|TASK|DELEGATE|FYI_ONLY|APPROVAL|FOLLOW_UP|URGENT",
  "confidence": 0.95,
  "intent": "brief description of what sender wants",
  "summary": "one sentence summary",
  "action_items": ["item1", "item2"],
  "reply_type": "quick_confirm|detailed_response|delegate|schedule_meeting|request_info",
  "reasoning": "why this classification was chosen"
}"""

        user_prompt = f"Email to analyze:\n\n{context[:2000]}"  # Limit for nano model
        
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": self.classifier_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.1,  # Low temperature for consistent classification
                    "max_tokens": 300,
                    "response_format": {"type": "json_object"}
                }
                
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=15
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        content = data["choices"][0]["message"]["content"]
                        result = json.loads(content)
                        
                        # Convert string classification to enum
                        class_str = result.get("classification", "FYI_ONLY")
                        result["classification"] = GPT5EmailClass(class_str)
                        
                        self.metrics["ai_success_rate"] = (
                            self.metrics["ai_success_rate"] * 0.9 + 0.1
                        )
                        
                        return result
                    else:
                        self.logger.warning(f"GPT-5 nano API error: {response.status}")
                        return self._fallback_classification(context)
                        
        except Exception as e:
            self.logger.warning(f"GPT-5 nano classification failed: {e}")
            return self._fallback_classification(context)
    
    async def generate_draft_reply_gpt5(self, email_data: Dict[str, Any], analysis: EmailAnalysis) -> DraftReply:
        """Generate draft reply using GPT-5 mini model with user's style"""
        
        if not self.api_key:
            return self._generate_template_reply(email_data, analysis)
        
        # Extract sender name for personalized greeting
        sender_name = self._extract_sender_name(email_data.get('sender', ''))
        
        # Build user style context
        style_context = self._build_style_context(analysis)
        
        system_prompt = f"""You are an executive assistant drafting emails for {self.user_name}. 

WRITING STYLE REQUIREMENTS:
- Start with: "{self.greeting_style} {sender_name}," (e.g., "D John,")
- End with: "{self.signature_style}"
- Tone: Professional but warm, concise and direct
- Length: 3-7 sentences maximum
- Address key points from the original email
- Propose clear next steps when appropriate

USER'S TYPICAL PHRASES:
{json.dumps(self.user_patterns.get('common_phrases', []), indent=2)}

RESPONSE TYPE: {analysis.suggested_reply_type}

Generate a draft that sounds natural and matches the user's communication style."""

        # Build context for draft generation
        email_context = f"""
Original Email:
Subject: {email_data.get('subject', '')}
From: {email_data.get('sender', '')}
Content: {email_data.get('body', '')[:1500]}

Analysis Context:
- Classification: {analysis.classification.value}
- Intent: {analysis.intent}
- Key Points: {', '.join(analysis.key_points[:3])}
- Action Items: {', '.join(analysis.action_items[:3])}
- Urgency: {analysis.urgency.value}
- Sentiment: {analysis.sentiment.value}

{style_context}
"""

        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": self.draft_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": email_context}
                    ],
                    "temperature": 0.3,  # Some creativity but consistent
                    "max_tokens": 500
                }
                
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=30
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        draft_content = data["choices"][0]["message"]["content"].strip()
                        
                        # Ensure proper formatting
                        draft_content = self._ensure_proper_formatting(draft_content, sender_name)
                        
                        return DraftReply(
                            content=draft_content,
                            tone="professional_warm",
                            confidence=0.85,
                            key_points_addressed=analysis.key_points[:3],
                            suggested_actions=analysis.action_items[:2],
                            requires_review=analysis.classification in [GPT5EmailClass.URGENT, GPT5EmailClass.APPROVAL]
                        )
                    else:
                        self.logger.warning(f"GPT-5 mini API error: {response.status}")
                        return self._generate_template_reply(email_data, analysis)
                        
        except Exception as e:
            self.logger.warning(f"GPT-5 mini draft generation failed: {e}")
            return self._generate_template_reply(email_data, analysis)
    
    def generate_draft_reply(self, email_data: Dict[str, Any], analysis: EmailAnalysis) -> DraftReply:
        """Synchronous wrapper for draft generation"""
        return asyncio.run(self.generate_draft_reply_gpt5(email_data, analysis))
    
    async def _extract_tasks_gpt5(self, context: str) -> List[EmailTask]:
        """Extract detailed tasks using GPT-5 analysis"""
        if not self.api_key:
            return self._extract_tasks_pattern_based(context)
        
        system_prompt = """Extract actionable tasks from this email. For each task, provide:

Respond in JSON format:
{
  "tasks": [
    {
      "description": "clear task description",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "deadline": "YYYY-MM-DD" or null,
      "assignee": "person name" or null,
      "estimated_hours": 2.5 or null,
      "dependencies": ["task1", "task2"],
      "context": "why this task is needed"
    }
  ]
}"""

        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": self.classifier_model,  # Use nano for fast extraction
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": context[:1500]}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 400,
                    "response_format": {"type": "json_object"}
                }
                
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=15
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        content = data["choices"][0]["message"]["content"]
                        result = json.loads(content)
                        
                        tasks = []
                        for task_data in result.get("tasks", []):
                            deadline = None
                            if task_data.get("deadline"):
                                try:
                                    deadline = datetime.strptime(task_data["deadline"], "%Y-%m-%d")
                                except:
                                    pass
                            
                            tasks.append(EmailTask(
                                description=task_data.get("description", ""),
                                priority=TaskPriority(task_data.get("priority", "MEDIUM")),
                                deadline=deadline,
                                assignee=task_data.get("assignee"),
                                estimated_hours=task_data.get("estimated_hours"),
                                dependencies=task_data.get("dependencies", []),
                                context=task_data.get("context", ""),
                                confidence=0.8
                            ))
                        
                        return tasks[:5]  # Limit to 5 tasks
                        
        except Exception as e:
            self.logger.warning(f"GPT-5 task extraction failed: {e}")
            
        return self._extract_tasks_pattern_based(context)
    
    async def _extract_key_points_gpt5(self, context: str) -> List[str]:
        """Extract key points using GPT-5"""
        if not self.api_key:
            return self._extract_key_points_pattern_based(context)
        
        system_prompt = """Extract the 3-5 most important key points from this email. Be concise and specific.

Respond in JSON format:
{
  "key_points": ["point 1", "point 2", "point 3"]
}"""

        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": self.classifier_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": context[:1000]}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 200,
                    "response_format": {"type": "json_object"}
                }
                
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=10
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        content = data["choices"][0]["message"]["content"]
                        result = json.loads(content)
                        return result.get("key_points", [])[:5]
                        
        except Exception as e:
            self.logger.warning(f"GPT-5 key points extraction failed: {e}")
        
        return self._extract_key_points_pattern_based(context)
    
    async def _generate_smart_tags_gpt5(self, context: str) -> List[str]:
        """Generate smart tags using GPT-5"""
        if not self.api_key:
            return self._generate_tags_pattern_based(context)
        
        system_prompt = """Generate 3-7 relevant tags for this email to help with organization and search.

Categories: project names, departments, urgency levels, action types, people, topics.

Respond in JSON format:
{
  "tags": ["tag1", "tag2", "tag3"]
}"""

        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                }
                
                payload = {
                    "model": self.classifier_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": context[:800]}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 100,
                    "response_format": {"type": "json_object"}
                }
                
                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=10
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        content = data["choices"][0]["message"]["content"]
                        result = json.loads(content)
                        return result.get("tags", [])[:7]
                        
        except Exception as e:
            self.logger.warning(f"GPT-5 tag generation failed: {e}")
        
        return self._generate_tags_pattern_based(context)
    
    def learn_from_correction(self, original_analysis: EmailAnalysis, corrected_data: Dict[str, Any]):
        """Learn from user corrections to improve future analysis"""
        self.metrics["user_corrections"] += 1
        
        # Store correction patterns
        correction_log = {
            "timestamp": datetime.now().isoformat(),
            "original_classification": original_analysis.classification.value,
            "corrected_classification": corrected_data.get("classification"),
            "original_confidence": original_analysis.confidence,
            "email_features": {
                "subject_keywords": corrected_data.get("subject_keywords", []),
                "body_keywords": corrected_data.get("body_keywords", []),
                "sender_domain": corrected_data.get("sender_domain", "")
            }
        }
        
        # Append to learning log
        learning_file = Path("gpt5_learning_log.jsonl")
        with open(learning_file, "a") as f:
            f.write(json.dumps(correction_log) + "\n")
        
        self.logger.info(f"Learned from user correction: {original_analysis.classification.value} -> {corrected_data.get('classification')}")
    
    def get_processing_stats(self) -> Dict[str, Any]:
        """Get comprehensive processing statistics"""
        return {
            "total_emails_processed": self.metrics["total_processed"],
            "average_processing_time_ms": self.metrics["avg_processing_time"],
            "ai_success_rate": self.metrics["ai_success_rate"],
            "user_corrections": self.metrics["user_corrections"],
            "models_used": {
                "classifier": self.classifier_model,
                "draft_generator": self.draft_model
            },
            "accuracy_estimate": max(0.7, 1.0 - (self.metrics["user_corrections"] / max(1, self.metrics["total_processed"]))),
            "system_health": "operational" if self.api_key else "limited_functionality"
        }
    
    # Helper methods
    def _build_email_context(self, email_data: Dict[str, Any]) -> str:
        """Build comprehensive context for analysis"""
        context_parts = []
        
        # Subject
        if email_data.get('subject'):
            context_parts.append(f"Subject: {email_data['subject']}")
        
        # Sender info
        if email_data.get('sender'):
            context_parts.append(f"From: {email_data['sender']}")
        
        # Body content
        if email_data.get('body'):
            context_parts.append(f"Content:\n{email_data['body']}")
        
        # Thread context if available
        if email_data.get('thread_context'):
            context_parts.append(f"Thread Context:\n{email_data['thread_context']}")
        
        # Metadata
        if email_data.get('timestamp'):
            context_parts.append(f"Received: {email_data['timestamp']}")
        
        return "\n\n".join(context_parts)
    
    def _extract_sender_name(self, sender: str) -> str:
        """Extract clean sender name for greeting"""
        # Handle "Name <email>" format
        name_match = re.search(r'^([^<]+)', sender.strip())
        if name_match:
            name = name_match.group(1).strip()
            # Get first name
            first_name = name.split()[0].strip(',')
            return first_name
        
        # Handle email only
        if '@' in sender:
            local_part = sender.split('@')[0]
            # Clean up common patterns
            clean_name = re.sub(r'[._-]', ' ', local_part).title()
            return clean_name.split()[0] if clean_name else 'there'
        
        return 'there'
    
    def _build_style_context(self, analysis: EmailAnalysis) -> str:
        """Build context about user's preferred response style"""
        style_notes = []
        
        # Based on classification
        if analysis.classification == GPT5EmailClass.URGENT:
            style_notes.append("- Acknowledge urgency and provide timeline")
        elif analysis.classification == GPT5EmailClass.TASK:
            style_notes.append("- Confirm understanding and next steps")
        elif analysis.classification == GPT5EmailClass.DELEGATE:
            style_notes.append("- Indicate who will handle and when they'll follow up")
        
        # Based on sentiment
        if analysis.sentiment == Sentiment.FRUSTRATED:
            style_notes.append("- Address concerns with empathy")
        elif analysis.sentiment == Sentiment.POSITIVE:
            style_notes.append("- Match positive tone")
        
        return "Style Context:\n" + "\n".join(style_notes) if style_notes else ""
    
    def _ensure_proper_formatting(self, draft: str, sender_name: str) -> str:
        """Ensure draft follows proper formatting"""
        lines = draft.strip().split('\n')
        
        # Ensure proper greeting
        greeting_pattern = f"{self.greeting_style} {sender_name},"
        if not lines[0].startswith(self.greeting_style):
            lines[0] = greeting_pattern
        
        # Ensure proper signature
        if not draft.endswith(self.signature_style):
            if not lines[-1].strip():
                lines = lines[:-1]  # Remove empty line
            lines.append("")
            lines.append(self.signature_style)
        
        return '\n'.join(lines)
    
    def _extract_people(self, text: str) -> List[str]:
        """Extract people mentioned in email"""
        # Simple pattern-based extraction
        people = []
        
        # Look for capitalized names
        name_pattern = r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b'
        matches = re.findall(name_pattern, text)
        
        # Filter out common false positives
        false_positives = {'Subject', 'From', 'To', 'Dear', 'Thanks', 'Best', 'Regards', 'Please'}
        
        for match in matches:
            if match not in false_positives and len(match) > 2:
                people.append(match)
        
        return list(set(people))[:5]  # Limit and deduplicate
    
    def _update_processing_metrics(self, processing_time: float):
        """Update processing time metrics"""
        if self.metrics["avg_processing_time"] == 0:
            self.metrics["avg_processing_time"] = processing_time
        else:
            # Exponential moving average
            self.metrics["avg_processing_time"] = (
                self.metrics["avg_processing_time"] * 0.9 + processing_time * 0.1
            )
    
    # Fallback methods for when GPT-5 is unavailable
    def _fallback_classification(self, context: str) -> Dict[str, Any]:
        """Fallback classification using pattern matching"""
        # Use base engine for classification
        lines = context.split('\n')
        subject = ""
        body = ""
        
        for i, line in enumerate(lines):
            if line.startswith("Subject:"):
                subject = line[8:].strip()
            elif line.startswith("Content:"):
                body = '\n'.join(lines[i+1:])
                break
        
        base_result = self.base_engine.analyze_email(subject, body)
        
        # Map to GPT5 classification
        classification_mapping = {
            EmailClass.NEEDS_REPLY: GPT5EmailClass.REPLY,
            EmailClass.APPROVAL_REQUIRED: GPT5EmailClass.APPROVAL,
            EmailClass.CREATE_TASK: GPT5EmailClass.TASK,
            EmailClass.DELEGATE: GPT5EmailClass.DELEGATE,
            EmailClass.FYI_ONLY: GPT5EmailClass.FYI_ONLY,
            EmailClass.FOLLOW_UP: GPT5EmailClass.FOLLOW_UP
        }
        
        return {
            "classification": classification_mapping.get(base_result.classification, GPT5EmailClass.FYI_ONLY),
            "confidence": base_result.confidence,
            "intent": base_result.intent,
            "summary": f"Pattern-based analysis: {base_result.classification.value}",
            "action_items": [item.text for item in base_result.action_items],
            "reply_type": "standard",
            "reasoning": "Pattern-based fallback analysis"
        }
    
    async def _fallback_analysis(self, email_data: Dict[str, Any], start_time: datetime) -> EmailAnalysis:
        """Complete fallback analysis when GPT-5 fails"""
        subject = email_data.get('subject', '')
        body = email_data.get('body', '')
        sender = email_data.get('sender', '')
        
        base_result = self.base_engine.analyze_email(subject, body, sender)
        processing_time = (datetime.now() - start_time).total_seconds() * 1000
        
        # Map to GPT5 format
        classification_mapping = {
            EmailClass.NEEDS_REPLY: GPT5EmailClass.REPLY,
            EmailClass.APPROVAL_REQUIRED: GPT5EmailClass.APPROVAL,
            EmailClass.CREATE_TASK: GPT5EmailClass.TASK,
            EmailClass.DELEGATE: GPT5EmailClass.DELEGATE,
            EmailClass.FYI_ONLY: GPT5EmailClass.FYI_ONLY,
            EmailClass.FOLLOW_UP: GPT5EmailClass.FOLLOW_UP
        }
        
        return EmailAnalysis(
            classification=classification_mapping.get(base_result.classification, GPT5EmailClass.FYI_ONLY),
            confidence=base_result.confidence,
            urgency=base_result.urgency,
            sentiment=base_result.sentiment,
            intent=base_result.intent,
            summary=f"Subject: {subject[:50]}..." if subject else "No subject",
            key_points=self._extract_key_points_pattern_based(body),
            tasks=self._extract_tasks_pattern_based(body),
            action_items=[item.text for item in base_result.action_items],
            deadlines=base_result.deadlines,
            people_mentioned=self._extract_people(body),
            tags=self._generate_tags_pattern_based(f"{subject} {body}"),
            context_thread="",
            suggested_reply_type="standard",
            processing_time_ms=processing_time,
            ai_reasoning="Fallback pattern-based analysis"
        )
    
    def _extract_tasks_pattern_based(self, text: str) -> List[EmailTask]:
        """Pattern-based task extraction"""
        tasks = []
        
        task_patterns = [
            r'need to ([\w\s]+)',
            r'should ([\w\s]+)',
            r'must ([\w\s]+)',
            r'please ([\w\s]+)',
            r'action item:?\s*([\w\s]+)',
            r'todo:?\s*([\w\s]+)'
        ]
        
        for pattern in task_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                task_text = match.group(1).strip()
                if len(task_text) > 5:  # Filter very short tasks
                    tasks.append(EmailTask(
                        description=task_text,
                        priority=TaskPriority.MEDIUM,
                        confidence=0.6
                    ))
        
        return tasks[:3]  # Limit to 3 tasks
    
    def _extract_key_points_pattern_based(self, text: str) -> List[str]:
        """Pattern-based key points extraction"""
        sentences = re.split(r'[.!?]+', text)
        key_points = []
        
        # Look for sentences with important indicators
        important_indicators = [
            'important', 'critical', 'urgent', 'deadline', 'due',
            'please', 'need', 'required', 'must', 'should'
        ]
        
        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) > 20:  # Skip very short sentences
                for indicator in important_indicators:
                    if indicator in sentence.lower():
                        key_points.append(sentence[:100] + "..." if len(sentence) > 100 else sentence)
                        break
        
        return key_points[:5]
    
    def _generate_tags_pattern_based(self, text: str) -> List[str]:
        """Pattern-based tag generation"""
        tags = []
        
        # Common tag patterns
        tag_patterns = {
            'urgent': r'\b(urgent|asap|immediately|critical)\b',
            'meeting': r'\b(meeting|call|appointment|schedule)\b',
            'approval': r'\b(approve|approval|sign-off)\b',
            'deadline': r'\b(deadline|due|by\s+\w+)\b',
            'project': r'\b(project|initiative|program)\b',
            'budget': r'\b(budget|cost|expense|financial)\b',
            'technical': r'\b(technical|system|software|hardware)\b'
        }
        
        for tag, pattern in tag_patterns.items():
            if re.search(pattern, text, re.IGNORECASE):
                tags.append(tag)
        
        return tags
    
    def _generate_template_reply(self, email_data: Dict[str, Any], analysis: EmailAnalysis) -> DraftReply:
        """Generate template-based reply when GPT-5 is unavailable"""
        sender_name = self._extract_sender_name(email_data.get('sender', ''))
        
        # Template responses based on classification
        templates = {
            GPT5EmailClass.REPLY: f"{self.greeting_style} {sender_name},\n\nThanks for reaching out. I've reviewed your email and will get back to you with a detailed response shortly.\n\n{self.signature_style}",
            GPT5EmailClass.TASK: f"{self.greeting_style} {sender_name},\n\nThanks for the details. I'll track this as a task and update you on progress.\n\n{self.signature_style}",
            GPT5EmailClass.APPROVAL: f"{self.greeting_style} {sender_name},\n\nThanks for sending this over. I approve proceeding as proposed.\n\n{self.signature_style}",
            GPT5EmailClass.DELEGATE: f"{self.greeting_style} {sender_name},\n\nThanks for this. I'll have the appropriate team member handle this and follow up with you.\n\n{self.signature_style}",
            GPT5EmailClass.FYI_ONLY: f"{self.greeting_style} {sender_name},\n\nThanks for the update - noted.\n\n{self.signature_style}"
        }
        
        content = templates.get(analysis.classification, templates[GPT5EmailClass.FYI_ONLY])
        
        return DraftReply(
            content=content,
            tone="professional_template",
            confidence=0.7,
            key_points_addressed=analysis.key_points[:2],
            suggested_actions=[],
            requires_review=True
        )


# CLI Interface
async def main():
    """CLI interface for testing GPT-5 email processor"""
    import argparse
    
    parser = argparse.ArgumentParser(description="GPT-5 Email Processor")
    parser.add_argument("--email-file", help="Path to email file (JSON)")
    parser.add_argument("--subject", help="Email subject")
    parser.add_argument("--body", help="Email body")
    parser.add_argument("--sender", help="Email sender")
    parser.add_argument("--generate-draft", action="store_true", help="Generate draft reply")
    parser.add_argument("--stats", action="store_true", help="Show processing stats")
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = GPT5EmailProcessor()
    
    if args.stats:
        stats = processor.get_processing_stats()
        print("GPT-5 Email Processor Statistics:")
        print(json.dumps(stats, indent=2))
        return
    
    # Test email
    if args.email_file:
        with open(args.email_file, 'r') as f:
            email_data = json.load(f)
    else:
        email_data = {
            "subject": args.subject or "Test email",
            "body": args.body or "This is a test email to demonstrate the GPT-5 processor.",
            "sender": args.sender or "test@example.com"
        }
    
    print("Analyzing email with GPT-5 processor...")
    print("=" * 50)
    
    # Analyze email
    analysis = await processor.analyze_email_async(email_data)
    
    print(f"Subject: {email_data['subject']}")
    print(f"From: {email_data['sender']}")
    print(f"Classification: {analysis.classification.value}")
    print(f"Confidence: {analysis.confidence:.2f}")
    print(f"Urgency: {analysis.urgency.value}")
    print(f"Sentiment: {analysis.sentiment.value}")
    print(f"Intent: {analysis.intent}")
    print(f"Summary: {analysis.summary}")
    print(f"Processing Time: {analysis.processing_time_ms:.1f}ms")
    
    if analysis.key_points:
        print(f"\nKey Points:")
        for point in analysis.key_points:
            print(f"  • {point}")
    
    if analysis.tasks:
        print(f"\nTasks:")
        for task in analysis.tasks:
            print(f"  • {task.description} (Priority: {task.priority.value})")
    
    if analysis.tags:
        print(f"\nTags: {', '.join(analysis.tags)}")
    
    if args.generate_draft:
        print(f"\nGenerating draft reply...")
        draft = await processor.generate_draft_reply_gpt5(email_data, analysis)
        print(f"Draft Reply:")
        print("-" * 30)
        print(draft.content)
        print("-" * 30)
        print(f"Confidence: {draft.confidence:.2f}")
        print(f"Requires Review: {draft.requires_review}")


if __name__ == "__main__":
    asyncio.run(main())