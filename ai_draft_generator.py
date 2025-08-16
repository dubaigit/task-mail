#!/usr/bin/env python3
"""
AI-Powered Draft Generation System
=================================

Advanced draft generation using GPT-5 models with context-aware analysis,
user style learning, and conversational refinement capabilities.

Features:
- Context-aware draft generation using email thread analysis
- Tone matching based on sender relationship and communication history
- User writing style learning and adaptation
- Template integration and customization
- Real-time refinement through natural language instructions
- Version history and rollback capabilities
- Confidence scoring and quality assessment
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
    from email_intelligence_engine import EmailIntelligenceEngine
    from style_learner import StyleLearner
    from refinement_processor import RefinementProcessor
except ImportError as e:
    print(f"Import error: {e}. Some features may be limited.")

class DraftTone(Enum):
    """Draft tone options"""
    PROFESSIONAL = "professional"
    FRIENDLY = "friendly"
    FORMAL = "formal"
    CASUAL = "casual"
    URGENT = "urgent"
    DIPLOMATIC = "diplomatic"

class DraftLength(Enum):
    """Draft length options"""
    BRIEF = "brief"
    STANDARD = "standard"
    DETAILED = "detailed"

class DraftType(Enum):
    """Types of drafts"""
    REPLY = "reply"
    FORWARD = "forward"
    NEW_EMAIL = "new_email"
    FOLLOW_UP = "follow_up"
    DELEGATION = "delegation"
    APPROVAL_REQUEST = "approval_request"

@dataclass
class DraftOptions:
    """Configuration options for draft generation"""
    tone: DraftTone = DraftTone.PROFESSIONAL
    length: DraftLength = DraftLength.STANDARD
    include_signature: bool = True
    urgency_level: str = "medium"
    template_id: Optional[str] = None
    custom_instructions: Optional[str] = None
    preserve_formatting: bool = True
    include_thread_context: bool = True
    max_words: Optional[int] = None

@dataclass
class EmailContext:
    """Email context for draft generation"""
    email_id: int
    subject: str
    sender: str
    sender_email: str
    content: str
    classification: str
    urgency: str
    thread_history: List[Dict] = None
    attachments: List[str] = None
    recipients: List[str] = None
    original_date: Optional[str] = None

@dataclass
class DraftResult:
    """Result of draft generation"""
    id: str
    email_id: int
    content: str
    confidence: float
    tone_analysis: Dict[str, float]
    generation_metadata: Dict[str, Any]
    template_used: Optional[str] = None
    refinement_history: List[Dict] = None
    version: int = 1
    created_at: str = None
    word_count: int = 0
    estimated_reading_time: int = 0

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        self.word_count = len(self.content.split()) if self.content else 0
        self.estimated_reading_time = max(1, self.word_count // 200)  # 200 WPM

class AIDraftGenerator:
    """
    AI-powered draft generation system with advanced context awareness
    and user style learning capabilities.
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.logger = self._setup_logging()
        
        # GPT-5 model configuration
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_APIKEY")
        if not self.api_key:
            self.logger.warning("No OpenAI API key found. Falling back to template-based generation.")
        
        # Use GPT-5 mini for high-quality draft generation
        self.draft_model = "gpt-5-mini-2025-08-07"
        
        # Initialize components
        self.style_learner = StyleLearner()
        self.refinement_processor = RefinementProcessor()
        self.templates = self._load_templates()
        
        # User preferences
        self.user_name = self.config.get("user_name", "Abdullah")
        self.signature_style = self.config.get("signature", "Regards Abdullah")
        self.default_tone = DraftTone(self.config.get("default_tone", "professional"))
        
        # Performance metrics
        self.metrics = {
            "drafts_generated": 0,
            "avg_generation_time": 0.0,
            "avg_confidence": 0.0,
            "refinements_applied": 0,
            "user_satisfaction": 0.0
        }
        
        self.logger.info("AI Draft Generator initialized with GPT-5 integration")
    
    def _setup_logging(self) -> logging.Logger:
        """Setup detailed logging"""
        logger = logging.getLogger("AIDraftGenerator")
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _load_templates(self) -> Dict[str, Dict]:
        """Load email templates"""
        templates_file = Path("templates/email_templates.json")
        
        if templates_file.exists():
            try:
                with open(templates_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                self.logger.warning(f"Failed to load templates: {e}")
        
        # Default templates
        return {
            "professional_reply": {
                "name": "Professional Reply",
                "template": """Dear {sender_name},

Thank you for your email regarding {subject_context}.

{main_content}

{call_to_action}

Best regards,
{user_name}""",
                "suitable_for": ["NEEDS_REPLY", "APPROVAL_REQUIRED"],
                "tone": "professional"
            },
            "friendly_response": {
                "name": "Friendly Response",
                "template": """Hi {sender_name},

Thanks for reaching out about {subject_context}.

{main_content}

{call_to_action}

Best,
{user_name}""",
                "suitable_for": ["NEEDS_REPLY", "FYI_ONLY"],
                "tone": "friendly"
            },
            "delegation_request": {
                "name": "Task Delegation",
                "template": """Hi {sender_name},

I hope this email finds you well.

{delegation_context}

{task_details}

Please let me know if you have any questions or need additional resources.

Thanks,
{user_name}""",
                "suitable_for": ["DELEGATE", "CREATE_TASK"],
                "tone": "professional"
            }
        }
    
    async def generate_draft(self, 
                           email_context: EmailContext, 
                           options: DraftOptions = None) -> DraftResult:
        """
        Generate an AI-powered draft response
        
        Args:
            email_context: Email context and metadata
            options: Draft generation options
            
        Returns:
            DraftResult with generated content and metadata
        """
        start_time = datetime.now()
        
        if options is None:
            options = DraftOptions()
        
        try:
            # Analyze email context and determine optimal approach
            draft_strategy = await self._analyze_draft_strategy(email_context, options)
            
            # Generate draft content using appropriate method
            if self.api_key and draft_strategy.use_ai:
                draft_content = await self._generate_ai_draft(email_context, options, draft_strategy)
            else:
                draft_content = await self._generate_template_draft(email_context, options, draft_strategy)
            
            # Post-process and refine
            refined_content = await self._post_process_draft(draft_content, email_context, options)
            
            # Calculate confidence score
            confidence = await self._calculate_confidence(refined_content, email_context, options)
            
            # Analyze tone
            tone_analysis = await self._analyze_tone(refined_content)
            
            # Create result
            result = DraftResult(
                id=f"draft_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{email_context.email_id}",
                email_id=email_context.email_id,
                content=refined_content,
                confidence=confidence,
                tone_analysis=tone_analysis,
                generation_metadata={
                    "strategy": draft_strategy.strategy_type,
                    "model_used": self.draft_model if draft_strategy.use_ai else "template",
                    "template_id": options.template_id,
                    "generation_time": (datetime.now() - start_time).total_seconds(),
                    "options": asdict(options),
                    "user_style_applied": draft_strategy.apply_user_style
                },
                template_used=draft_strategy.template_id
            )
            
            # Update metrics
            self._update_metrics(result)
            
            # Learn from generation
            await self._learn_from_generation(email_context, result, options)
            
            self.logger.info(f"Draft generated for email {email_context.email_id} with {confidence:.2f} confidence")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Draft generation failed: {e}")
            # Return fallback draft
            return await self._generate_fallback_draft(email_context, options)
    
    async def refine_draft(self, 
                          draft_result: DraftResult, 
                          instruction: str,
                          email_context: EmailContext = None) -> DraftResult:
        """
        Refine an existing draft based on natural language instruction
        
        Args:
            draft_result: Original draft to refine
            instruction: Natural language refinement instruction
            email_context: Optional email context for additional refinement
            
        Returns:
            New DraftResult with refined content
        """
        start_time = datetime.now()
        
        try:
            # Process refinement instruction
            refinement_plan = await self.refinement_processor.process_instruction(
                instruction, draft_result.content, email_context
            )
            
            # Apply refinements
            if self.api_key and refinement_plan.use_ai:
                refined_content = await self._apply_ai_refinement(
                    draft_result.content, refinement_plan, email_context
                )
            else:
                refined_content = await self._apply_rule_based_refinement(
                    draft_result.content, refinement_plan
                )
            
            # Calculate new confidence
            confidence = await self._calculate_confidence(
                refined_content, email_context, DraftOptions()
            )
            
            # Analyze tone
            tone_analysis = await self._analyze_tone(refined_content)
            
            # Create new version
            new_version = DraftResult(
                id=f"draft_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{draft_result.email_id}",
                email_id=draft_result.email_id,
                content=refined_content,
                confidence=confidence,
                tone_analysis=tone_analysis,
                generation_metadata={
                    "strategy": "refinement",
                    "original_draft_id": draft_result.id,
                    "refinement_instruction": instruction,
                    "refinement_time": (datetime.now() - start_time).total_seconds(),
                    "refinement_plan": asdict(refinement_plan)
                },
                template_used=draft_result.template_used,
                refinement_history=(draft_result.refinement_history or []) + [{
                    "instruction": instruction,
                    "timestamp": datetime.now().isoformat(),
                    "confidence_before": draft_result.confidence,
                    "confidence_after": confidence
                }],
                version=draft_result.version + 1
            )
            
            # Update metrics
            self.metrics["refinements_applied"] += 1
            
            self.logger.info(f"Draft refined with instruction: {instruction}")
            
            return new_version
            
        except Exception as e:
            self.logger.error(f"Draft refinement failed: {e}")
            return draft_result  # Return original if refinement fails
    
    async def _analyze_draft_strategy(self, 
                                    email_context: EmailContext, 
                                    options: DraftOptions) -> 'DraftStrategy':
        """Analyze email context to determine optimal draft generation strategy"""
        
        @dataclass
        class DraftStrategy:
            strategy_type: str
            use_ai: bool
            template_id: Optional[str]
            apply_user_style: bool
            confidence_threshold: float
        
        # Determine if AI should be used
        use_ai = bool(self.api_key)
        
        # Select appropriate template
        template_id = options.template_id
        if not template_id:
            template_id = self._select_best_template(email_context, options)
        
        # Determine strategy based on classification and complexity
        if email_context.classification in ["APPROVAL_REQUIRED", "DELEGATE"]:
            strategy_type = "structured_response"
            confidence_threshold = 0.8
        elif email_context.classification == "NEEDS_REPLY":
            strategy_type = "contextual_reply"
            confidence_threshold = 0.7
        elif email_context.urgency == "HIGH":
            strategy_type = "urgent_response"
            confidence_threshold = 0.75
        else:
            strategy_type = "standard_response"
            confidence_threshold = 0.65
        
        return DraftStrategy(
            strategy_type=strategy_type,
            use_ai=use_ai,
            template_id=template_id,
            apply_user_style=True,
            confidence_threshold=confidence_threshold
        )
    
    async def _generate_ai_draft(self, 
                               email_context: EmailContext, 
                               options: DraftOptions,
                               strategy: 'DraftStrategy') -> str:
        """Generate draft using GPT-5 AI model"""
        
        # Build context prompt
        context_prompt = self._build_context_prompt(email_context, options, strategy)
        
        # Prepare API request
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Get user style preferences
        user_style = await self.style_learner.get_user_style_profile()
        
        # Build system prompt
        system_prompt = f"""You are an AI assistant helping to write professional email responses.

User Profile:
- Name: {self.user_name}
- Writing Style: {user_style.get('style_description', 'Professional and clear')}
- Typical Greeting: {user_style.get('greeting_style', 'Professional')}
- Signature Style: {self.signature_style}

Instructions:
- Generate a response that matches the user's writing style
- Use appropriate tone: {options.tone.value}
- Keep length: {options.length.value}
- Include signature if requested: {options.include_signature}
- Be contextually appropriate for the email classification: {email_context.classification}
- Maintain professional standards while matching user style

Template Context: {strategy.template_id if strategy.template_id else 'None'}
"""
        
        payload = {
            "model": self.draft_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": context_prompt}
            ],
            "temperature": 0.7,
            "max_tokens": self._get_max_tokens(options.length),
            "top_p": 0.9
        }
        
        try:
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                draft_content = result["choices"][0]["message"]["content"].strip()
                self.logger.info("AI draft generation successful")
                return draft_content
            else:
                self.logger.error(f"AI API error: {response.status_code} - {response.text}")
                raise Exception(f"API error: {response.status_code}")
                
        except Exception as e:
            self.logger.error(f"AI draft generation failed: {e}")
            raise
    
    async def _generate_template_draft(self, 
                                     email_context: EmailContext, 
                                     options: DraftOptions,
                                     strategy: 'DraftStrategy') -> str:
        """Generate draft using template-based approach"""
        
        template_id = strategy.template_id or "professional_reply"
        template = self.templates.get(template_id, self.templates["professional_reply"])
        
        # Extract sender name
        sender_name = self._extract_sender_name(email_context.sender)
        
        # Build template variables
        template_vars = {
            "sender_name": sender_name,
            "user_name": self.user_name,
            "subject_context": self._extract_subject_context(email_context.subject),
            "main_content": self._generate_main_content(email_context, options),
            "call_to_action": self._generate_call_to_action(email_context, options),
            "delegation_context": self._generate_delegation_context(email_context) if "delegate" in template_id else "",
            "task_details": self._generate_task_details(email_context) if "delegate" in template_id else ""
        }
        
        # Apply template
        draft_content = template["template"].format(**template_vars)
        
        # Apply user style if available
        if strategy.apply_user_style:
            user_style = await self.style_learner.get_user_style_profile()
            draft_content = await self._apply_user_style(draft_content, user_style)
        
        return draft_content
    
    def _build_context_prompt(self, 
                            email_context: EmailContext, 
                            options: DraftOptions,
                            strategy: 'DraftStrategy') -> str:
        """Build context prompt for AI generation"""
        
        prompt = f"""Generate a professional email response based on the following context:

ORIGINAL EMAIL:
From: {email_context.sender} <{email_context.sender_email}>
Subject: {email_context.subject}
Classification: {email_context.classification}
Urgency: {email_context.urgency}

Content:
{email_context.content[:1000]}...

RESPONSE REQUIREMENTS:
- Tone: {options.tone.value}
- Length: {options.length.value}
- Include signature: {options.include_signature}
- Classification requires: {self._get_classification_requirements(email_context.classification)}

THREAD CONTEXT:
{self._format_thread_context(email_context.thread_history) if email_context.thread_history else 'No previous thread context'}

CUSTOM INSTRUCTIONS:
{options.custom_instructions or 'None'}

Please generate an appropriate response that:
1. Addresses the main points from the original email
2. Uses the requested tone and length
3. Follows professional email etiquette
4. Includes appropriate call-to-action if needed
5. Matches the user's communication style
"""
        
        return prompt
    
    async def _post_process_draft(self, 
                                draft_content: str, 
                                email_context: EmailContext, 
                                options: DraftOptions) -> str:
        """Post-process generated draft for quality and consistency"""
        
        # Clean up formatting
        processed = re.sub(r'\n{3,}', '\n\n', draft_content.strip())
        
        # Ensure proper signature
        if options.include_signature and not processed.endswith(self.signature_style):
            if not processed.endswith('\n'):
                processed += '\n\n'
            processed += self.signature_style
        
        # Apply length constraints
        if options.max_words:
            words = processed.split()
            if len(words) > options.max_words:
                processed = ' '.join(words[:options.max_words]) + "..."
        
        # Ensure professional formatting
        processed = self._ensure_professional_formatting(processed)
        
        return processed
    
    async def _calculate_confidence(self, 
                                  draft_content: str, 
                                  email_context: EmailContext, 
                                  options: DraftOptions) -> float:
        """Calculate confidence score for generated draft"""
        
        confidence_factors = []
        
        # Length appropriateness
        word_count = len(draft_content.split())
        if options.length == DraftLength.BRIEF and 50 <= word_count <= 150:
            confidence_factors.append(0.9)
        elif options.length == DraftLength.STANDARD and 100 <= word_count <= 300:
            confidence_factors.append(0.85)
        elif options.length == DraftLength.DETAILED and 200 <= word_count <= 500:
            confidence_factors.append(0.8)
        else:
            confidence_factors.append(0.6)
        
        # Content completeness
        if self._addresses_main_points(draft_content, email_context):
            confidence_factors.append(0.85)
        else:
            confidence_factors.append(0.6)
        
        # Professional tone
        if self._has_professional_tone(draft_content):
            confidence_factors.append(0.8)
        else:
            confidence_factors.append(0.65)
        
        # Proper structure
        if self._has_proper_structure(draft_content):
            confidence_factors.append(0.75)
        else:
            confidence_factors.append(0.5)
        
        # Template match (if used)
        if options.template_id and self._matches_template_expectations(draft_content, options.template_id):
            confidence_factors.append(0.8)
        
        return min(0.99, sum(confidence_factors) / len(confidence_factors))
    
    async def _analyze_tone(self, draft_content: str) -> Dict[str, float]:
        """Analyze tone characteristics of the draft"""
        
        # Simple rule-based tone analysis
        # In production, this could use more sophisticated NLP
        
        formal_indicators = len(re.findall(r'\b(Dear|Sincerely|Respectfully|Please|Thank you)\b', draft_content, re.IGNORECASE))
        casual_indicators = len(re.findall(r'\b(Hi|Hey|Thanks|Let me know|Talk soon)\b', draft_content, re.IGNORECASE))
        urgent_indicators = len(re.findall(r'\b(urgent|asap|immediately|quickly|priority)\b', draft_content, re.IGNORECASE))
        positive_indicators = len(re.findall(r'\b(great|excellent|pleased|happy|excited)\b', draft_content, re.IGNORECASE))
        
        total_words = len(draft_content.split())
        
        return {
            "formality": min(1.0, formal_indicators / max(1, total_words / 20)),
            "casualness": min(1.0, casual_indicators / max(1, total_words / 20)),
            "urgency": min(1.0, urgent_indicators / max(1, total_words / 30)),
            "positivity": min(1.0, positive_indicators / max(1, total_words / 25)),
            "professionalism": 0.8  # Default professional baseline
        }
    
    def _get_max_tokens(self, length: DraftLength) -> int:
        """Get max tokens based on desired length"""
        if length == DraftLength.BRIEF:
            return 200
        elif length == DraftLength.STANDARD:
            return 400
        else:  # DETAILED
            return 600
    
    def _select_best_template(self, email_context: EmailContext, options: DraftOptions) -> str:
        """Select the most appropriate template based on context"""
        
        for template_id, template in self.templates.items():
            if email_context.classification in template.get("suitable_for", []):
                if template.get("tone") == options.tone.value:
                    return template_id
        
        # Fallback selection
        if options.tone == DraftTone.FRIENDLY:
            return "friendly_response"
        elif email_context.classification == "DELEGATE":
            return "delegation_request"
        else:
            return "professional_reply"
    
    def _extract_sender_name(self, sender: str) -> str:
        """Extract clean sender name from email sender"""
        # Remove email address if present
        name = re.sub(r'<.*?>', '', sender).strip()
        # Clean up common email artifacts
        name = re.sub(r'["\']', '', name)
        return name or "there"
    
    def _extract_subject_context(self, subject: str) -> str:
        """Extract meaningful context from email subject"""
        # Remove common prefixes
        subject = re.sub(r'^(RE:|FW:|FWD:)\s*', '', subject, flags=re.IGNORECASE)
        return subject.strip()
    
    def _generate_main_content(self, email_context: EmailContext, options: DraftOptions) -> str:
        """Generate main content based on email context"""
        
        if email_context.classification == "APPROVAL_REQUIRED":
            return "I have reviewed your request and approve the proposed approach. Please proceed as outlined."
        elif email_context.classification == "NEEDS_REPLY":
            return "Thank you for bringing this to my attention. I will review the details and get back to you shortly."
        elif email_context.classification == "FYI_ONLY":
            return "Thank you for keeping me informed. I appreciate the update."
        else:
            return "I acknowledge your email and will take appropriate action."
    
    def _generate_call_to_action(self, email_context: EmailContext, options: DraftOptions) -> str:
        """Generate appropriate call to action"""
        
        if email_context.urgency == "HIGH":
            return "Please let me know if you need any immediate assistance."
        elif email_context.classification == "APPROVAL_REQUIRED":
            return "Feel free to reach out if you need any clarification on the approval."
        else:
            return "Please don't hesitate to contact me if you have any questions."
    
    async def _generate_fallback_draft(self, email_context: EmailContext, options: DraftOptions) -> DraftResult:
        """Generate a basic fallback draft when AI generation fails"""
        
        sender_name = self._extract_sender_name(email_context.sender)
        
        fallback_content = f"""Dear {sender_name},

Thank you for your email regarding {self._extract_subject_context(email_context.subject)}.

I have received your message and will review it carefully. I will get back to you with a response shortly.

Best regards,
{self.user_name}"""
        
        return DraftResult(
            id=f"fallback_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{email_context.email_id}",
            email_id=email_context.email_id,
            content=fallback_content,
            confidence=0.5,
            tone_analysis={"formality": 0.8, "professionalism": 0.9},
            generation_metadata={
                "strategy": "fallback",
                "reason": "AI generation failed",
                "fallback_method": "template"
            }
        )
    
    def _update_metrics(self, result: DraftResult):
        """Update performance metrics"""
        self.metrics["drafts_generated"] += 1
        self.metrics["avg_confidence"] = (
            (self.metrics["avg_confidence"] * (self.metrics["drafts_generated"] - 1) + result.confidence) /
            self.metrics["drafts_generated"]
        )
        
        generation_time = result.generation_metadata.get("generation_time", 0)
        self.metrics["avg_generation_time"] = (
            (self.metrics["avg_generation_time"] * (self.metrics["drafts_generated"] - 1) + generation_time) /
            self.metrics["drafts_generated"]
        )
    
    async def _learn_from_generation(self, 
                                   email_context: EmailContext, 
                                   result: DraftResult, 
                                   options: DraftOptions):
        """Learn from successful draft generation for future improvements"""
        
        # Update style learner with successful patterns
        if result.confidence > 0.8:
            await self.style_learner.record_successful_draft(
                result.content, email_context, options
            )
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        return self.metrics.copy()
    
    # Helper methods for content analysis
    def _addresses_main_points(self, draft_content: str, email_context: EmailContext) -> bool:
        """Check if draft addresses main points from original email"""
        # Simple keyword overlap analysis
        original_keywords = set(re.findall(r'\b\w{4,}\b', email_context.content.lower()))
        draft_keywords = set(re.findall(r'\b\w{4,}\b', draft_content.lower()))
        
        overlap = len(original_keywords.intersection(draft_keywords))
        return overlap >= min(5, len(original_keywords) * 0.3)
    
    def _has_professional_tone(self, draft_content: str) -> bool:
        """Check if draft maintains professional tone"""
        professional_indicators = len(re.findall(
            r'\b(Dear|Thank you|Best regards|Sincerely|Please|Kindly)\b', 
            draft_content, re.IGNORECASE
        ))
        return professional_indicators >= 2
    
    def _has_proper_structure(self, draft_content: str) -> bool:
        """Check if draft has proper email structure"""
        has_greeting = bool(re.search(r'^(Dear|Hi|Hello)', draft_content.strip(), re.IGNORECASE))
        has_closing = bool(re.search(r'(Best regards|Sincerely|Thanks|Best)', draft_content, re.IGNORECASE))
        return has_greeting and has_closing
    
    def _matches_template_expectations(self, draft_content: str, template_id: str) -> bool:
        """Check if draft matches template expectations"""
        template = self.templates.get(template_id, {})
        expected_elements = template.get("expected_elements", [])
        
        found_elements = 0
        for element in expected_elements:
            if element.lower() in draft_content.lower():
                found_elements += 1
        
        return found_elements >= len(expected_elements) * 0.7
    
    def _ensure_professional_formatting(self, content: str) -> str:
        """Ensure professional email formatting"""
        # Fix common formatting issues
        content = re.sub(r'\n{3,}', '\n\n', content)  # Max 2 line breaks
        content = re.sub(r' {2,}', ' ', content)      # Max 1 space
        content = content.strip()
        
        # Ensure proper line endings
        if not content.endswith('.') and not content.endswith('!') and not content.endswith('?'):
            content += '.'
        
        return content
    
    def _get_classification_requirements(self, classification: str) -> str:
        """Get requirements based on email classification"""
        requirements = {
            "NEEDS_REPLY": "Provide a direct response to the sender's questions or requests",
            "APPROVAL_REQUIRED": "Provide clear approval or rejection with reasoning",
            "DELEGATE": "Delegate tasks with clear instructions and expectations",
            "CREATE_TASK": "Acknowledge task creation and provide next steps",
            "FYI_ONLY": "Acknowledge receipt and understanding",
            "FOLLOW_UP": "Address follow-up items and provide status updates"
        }
        return requirements.get(classification, "Provide appropriate response based on content")
    
    def _format_thread_context(self, thread_history: List[Dict]) -> str:
        """Format email thread history for context"""
        if not thread_history:
            return "No previous thread context"
        
        context_parts = []
        for email in thread_history[-3:]:  # Last 3 emails for context
            context_parts.append(f"Previous: {email.get('sender', 'Unknown')} - {email.get('subject', 'No subject')}")
        
        return "\n".join(context_parts)
    
    def _generate_delegation_context(self, email_context: EmailContext) -> str:
        """Generate context for delegation emails"""
        return f"I would like to delegate the following task related to {email_context.subject}:"
    
    def _generate_task_details(self, email_context: EmailContext) -> str:
        """Generate task details for delegation"""
        return """Task Details:
• Objective: [Please specify the objective]
• Deadline: [Please specify deadline]
• Resources: [Any resources or support needed]
• Expected Outcome: [What should be delivered]"""
    
    async def _apply_user_style(self, content: str, user_style: Dict) -> str:
        """Apply user writing style to content"""
        # Simple style application - in production this would be more sophisticated
        if user_style.get("greeting_style") == "casual":
            content = re.sub(r'^Dear\s+(\w+)', r'Hi \1', content)
        
        if user_style.get("closing_style") == "casual":
            content = re.sub(r'Best regards,', 'Best,', content)
            content = re.sub(r'Sincerely,', 'Thanks,', content)
        
        return content

# Export main class
__all__ = ['AIDraftGenerator', 'DraftOptions', 'EmailContext', 'DraftResult', 'DraftTone', 'DraftLength', 'DraftType']