#!/usr/bin/env python3
"""
Advanced Draft Generator with Voice Matching

Intelligent email draft generation system that learns and matches the user's writing voice,
style, and communication patterns. Generates consistent, personalized draft replies
that maintain the user's unique voice across all communications.
"""

import re
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict
from enum import Enum
import sqlite3
from collections import defaultdict, Counter
import statistics

# Text analysis
import string
from difflib import SequenceMatcher

class CommunicationStyle(Enum):
    """Communication style preferences"""
    FORMAL = "FORMAL"
    PROFESSIONAL = "PROFESSIONAL"
    CASUAL = "CASUAL"
    FRIENDLY = "FRIENDLY"
    DIRECT = "DIRECT"
    DIPLOMATIC = "DIPLOMATIC"

class ResponseTone(Enum):
    """Response tone options"""
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    ASSERTIVE = "ASSERTIVE"
    EMPATHETIC = "EMPATHETIC"
    URGENT = "URGENT"
    COLLABORATIVE = "COLLABORATIVE"

@dataclass
class VoiceSignature:
    """User's voice signature and patterns"""
    greeting_patterns: List[str]
    closing_patterns: List[str]
    common_phrases: List[str]
    sentence_length_avg: float
    formality_level: float  # 0.0 = casual, 1.0 = formal
    directness_level: float  # 0.0 = diplomatic, 1.0 = direct
    personal_pronouns_ratio: float
    question_frequency: float
    exclamation_frequency: float
    abbreviation_patterns: List[str]
    signature_style: str

@dataclass
class ContextualResponse:
    """Contextual response based on email analysis"""
    response_type: str  # acknowledge, answer, approve, delegate, etc.
    key_points_to_address: List[str]
    questions_to_answer: List[str]
    action_items_to_confirm: List[str]
    tone_adjustment: ResponseTone
    urgency_level: str

@dataclass
class DraftTemplate:
    """Template for draft generation"""
    template_id: str
    name: str
    structure: List[str]  # ['greeting', 'acknowledgment', 'response', 'action', 'closing']
    use_cases: List[str]
    style: CommunicationStyle
    confidence: float = 0.0

class AdvancedDraftGenerator:
    """
    Advanced email draft generator with voice matching and learning capabilities.
    
    Features:
    - Voice pattern learning from user's sent emails
    - Context-aware draft generation
    - Style consistency maintenance
    - Personalized phrase usage
    - Adaptive tone matching
    - Template-based generation with customization
    """
    
    def __init__(self, config: Optional[Dict] = None, user_profile: Optional[Dict] = None):
        """Initialize the draft generator"""
        self.logger = logging.getLogger(__name__)
        self.config = self._load_config(config)
        self.user_profile = user_profile or {}
        
        self._initialize_database()
        self._load_user_voice_signature()
        self._initialize_templates()
        self._load_phrase_library()
        
        # Learning and adaptation
        self.voice_learning_enabled = True
        self.adaptation_rate = 0.1  # How quickly to adapt to new patterns
        
    def _load_config(self, config: Optional[Dict]) -> Dict:
        """Load draft generator configuration"""
        default_config = {
            'database_path': 'draft_generator.db',
            'voice_learning': {
                'min_samples': 10,  # Minimum emails to establish voice signature
                'adaptation_rate': 0.1,
                'pattern_confidence_threshold': 0.7
            },
            'generation_settings': {
                'max_draft_length': 500,  # words
                'include_context_hints': True,
                'preserve_original_tone': True,
                'add_action_confirmations': True
            },
            'personalization': {
                'user_name': 'Abdullah',
                'greeting_prefix': 'D',
                'signature': 'Regards Abdullah',
                'default_style': 'PROFESSIONAL',
                'timezone': 'UTC+4'
            },
            'ai_integration': {
                'openai_api_key': None,  # Set from environment
                'model': 'gpt-5-mini-2025-08-07',
                'use_ai_enhancement': True,
                'fallback_to_templates': True
            }
        }
        
        if config:
            self._deep_update(default_config, config)
        
        return default_config
    
    def _deep_update(self, base: dict, update: dict):
        """Deep update dictionary"""
        for key, value in update.items():
            if isinstance(value, dict) and key in base:
                self._deep_update(base[key], value)
            else:
                base[key] = value

    def _initialize_database(self):
        """Initialize SQLite database for voice learning and templates"""
        self.db_path = self.config['database_path']
        
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS user_emails (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email_hash TEXT UNIQUE,
                    subject TEXT,
                    body TEXT,
                    recipient TEXT,
                    sent_date TIMESTAMP,
                    analysis_data TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS voice_patterns (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    pattern_type TEXT,
                    pattern_value TEXT,
                    frequency INTEGER DEFAULT 1,
                    confidence REAL DEFAULT 0.0,
                    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    context TEXT
                );
                
                CREATE TABLE IF NOT EXISTS draft_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    draft_id TEXT,
                    original_email_hash TEXT,
                    generated_draft TEXT,
                    template_used TEXT,
                    user_modifications TEXT,
                    accepted BOOLEAN DEFAULT FALSE,
                    feedback_score INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS phrase_library (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    phrase TEXT,
                    category TEXT,
                    context TEXT,
                    usage_count INTEGER DEFAULT 0,
                    effectiveness_score REAL DEFAULT 0.0,
                    last_used TIMESTAMP
                );
                
                CREATE INDEX IF NOT EXISTS idx_voice_patterns_type ON voice_patterns(pattern_type);
                CREATE INDEX IF NOT EXISTS idx_draft_history_accepted ON draft_history(accepted);
                CREATE INDEX IF NOT EXISTS idx_phrase_category ON phrase_library(category);
            """)

    def _load_user_voice_signature(self):
        """Load or initialize user's voice signature"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Load existing patterns
                cursor.execute("""
                    SELECT pattern_type, pattern_value, frequency, confidence
                    FROM voice_patterns
                    ORDER BY frequency DESC
                """)
                
                patterns = defaultdict(list)
                for pattern_type, pattern_value, frequency, confidence in cursor.fetchall():
                    patterns[pattern_type].append({
                        'value': pattern_value,
                        'frequency': frequency,
                        'confidence': confidence
                    })
                
                # Build voice signature
                self.voice_signature = VoiceSignature(
                    greeting_patterns=self._extract_pattern_values(patterns.get('greeting', [])),
                    closing_patterns=self._extract_pattern_values(patterns.get('closing', [])),
                    common_phrases=self._extract_pattern_values(patterns.get('phrase', [])),
                    sentence_length_avg=self._get_numeric_pattern(patterns, 'sentence_length', 15.0),
                    formality_level=self._get_numeric_pattern(patterns, 'formality', 0.7),
                    directness_level=self._get_numeric_pattern(patterns, 'directness', 0.6),
                    personal_pronouns_ratio=self._get_numeric_pattern(patterns, 'pronouns_ratio', 0.1),
                    question_frequency=self._get_numeric_pattern(patterns, 'question_freq', 0.2),
                    exclamation_frequency=self._get_numeric_pattern(patterns, 'exclamation_freq', 0.05),
                    abbreviation_patterns=self._extract_pattern_values(patterns.get('abbreviation', [])),
                    signature_style=self.config['personalization']['signature']
                )
                
        except Exception as e:
            self.logger.warning(f"Could not load voice signature, using defaults: {e}")
            self._initialize_default_voice_signature()

    def _extract_pattern_values(self, pattern_list: List[Dict]) -> List[str]:
        """Extract pattern values from database results"""
        return [p['value'] for p in pattern_list if p['confidence'] > 0.5]

    def _get_numeric_pattern(self, patterns: Dict, pattern_type: str, default: float) -> float:
        """Get numeric pattern value with fallback"""
        pattern_data = patterns.get(pattern_type, [])
        if pattern_data:
            return float(pattern_data[0]['value'])
        return default

    def _initialize_default_voice_signature(self):
        """Initialize default voice signature"""
        personalization = self.config['personalization']
        
        self.voice_signature = VoiceSignature(
            greeting_patterns=[
                f"{personalization['greeting_prefix']} {{firstname}},",
                "Hi {{firstname}},",
                "Hello {{firstname}},"
            ],
            closing_patterns=[
                personalization['signature'],
                "Best regards,\n" + personalization['user_name'],
                "Thanks,\n" + personalization['user_name']
            ],
            common_phrases=[
                "Thanks for reaching out",
                "I'll take care of this",
                "Let me know if you have questions",
                "I'll keep you posted",
                "Thanks for the update"
            ],
            sentence_length_avg=15.0,
            formality_level=0.7,
            directness_level=0.6,
            personal_pronouns_ratio=0.1,
            question_frequency=0.2,
            exclamation_frequency=0.05,
            abbreviation_patterns=["etc", "vs", "i.e.", "e.g."],
            signature_style=personalization['signature']
        )

    def _initialize_templates(self):
        """Initialize draft templates"""
        self.templates = {
            'acknowledgment': DraftTemplate(
                template_id='ack_001',
                name='Simple Acknowledgment',
                structure=['greeting', 'acknowledgment', 'closing'],
                use_cases=['FYI_ONLY', 'simple_update'],
                style=CommunicationStyle.PROFESSIONAL
            ),
            'approval': DraftTemplate(
                template_id='app_001',
                name='Approval Response',
                structure=['greeting', 'approval_statement', 'conditions', 'closing'],
                use_cases=['APPROVAL_REQUIRED'],
                style=CommunicationStyle.PROFESSIONAL
            ),
            'task_confirmation': DraftTemplate(
                template_id='task_001',
                name='Task Confirmation',
                structure=['greeting', 'task_acknowledgment', 'timeline', 'closing'],
                use_cases=['CREATE_TASK', 'delegation'],
                style=CommunicationStyle.PROFESSIONAL
            ),
            'question_response': DraftTemplate(
                template_id='qr_001',
                name='Question Response',
                structure=['greeting', 'question_acknowledgment', 'answers', 'follow_up', 'closing'],
                use_cases=['NEEDS_REPLY', 'questions'],
                style=CommunicationStyle.PROFESSIONAL
            ),
            'delegation': DraftTemplate(
                template_id='del_001',
                name='Delegation Response',
                structure=['greeting', 'delegation_acknowledgment', 'assignment', 'timeline', 'closing'],
                use_cases=['DELEGATE'],
                style=CommunicationStyle.PROFESSIONAL
            )
        }

    def _load_phrase_library(self):
        """Load phrase library from database"""
        self.phrase_library = defaultdict(list)
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT phrase, category, usage_count, effectiveness_score
                    FROM phrase_library
                    ORDER BY effectiveness_score DESC, usage_count DESC
                """)
                
                for phrase, category, usage_count, effectiveness_score in cursor.fetchall():
                    self.phrase_library[category].append({
                        'text': phrase,
                        'usage_count': usage_count,
                        'effectiveness': effectiveness_score
                    })
        except Exception as e:
            self.logger.warning(f"Could not load phrase library: {e}")
            self._initialize_default_phrases()

    def _initialize_default_phrases(self):
        """Initialize default phrase library"""
        default_phrases = {
            'greeting': [
                "Thanks for reaching out",
                "I hope you're doing well",
                "Thanks for the update",
                "I appreciate you following up"
            ],
            'acknowledgment': [
                "I've reviewed your message",
                "I understand the situation",
                "I've noted your request",
                "Thanks for bringing this to my attention"
            ],
            'approval': [
                "I approve proceeding as outlined",
                "This looks good to move forward",
                "You have my approval for this",
                "I'm comfortable with this approach"
            ],
            'task_acceptance': [
                "I'll take care of this",
                "I'll handle this right away",
                "I'll get this sorted out",
                "I'll make sure this gets done"
            ],
            'timeline': [
                "I'll update you by [deadline]",
                "Expect to hear back from me by [date]",
                "I'll have this completed by [timeline]",
                "I'll circle back with updates"
            ],
            'questions': [
                "Let me address your questions",
                "Here are the answers you're looking for",
                "I can help clarify this",
                "Let me break this down"
            ],
            'closing': [
                "Let me know if you need anything else",
                "Feel free to reach out with questions",
                "I'll keep you posted on progress",
                "Thanks for your patience"
            ]
        }
        
        self.phrase_library = {
            category: [{'text': phrase, 'usage_count': 0, 'effectiveness': 0.5}
                      for phrase in phrases]
            for category, phrases in default_phrases.items()
        }

    def generate_draft(self, email_data: Dict, analysis_result: Any,
                      task_analysis: Optional[List] = None,
                      context: Optional[Dict] = None) -> str:
        """
        Generate a voice-matched draft reply.
        
        Args:
            email_data: Original email data (subject, body, sender, etc.)
            analysis_result: Email intelligence analysis result
            task_analysis: Optional task analysis from task builder
            context: Additional context for generation
            
        Returns:
            Generated draft reply matching user's voice
        """
        try:
            # Extract contextual information
            contextual_response = self._analyze_response_context(email_data, analysis_result)
            
            # Select appropriate template
            template = self._select_template(analysis_result, contextual_response)
            
            # Generate draft content
            if self.config['ai_integration']['use_ai_enhancement']:
                draft = self._generate_ai_enhanced_draft(
                    email_data, analysis_result, contextual_response, template
                )
            else:
                draft = self._generate_template_based_draft(
                    email_data, analysis_result, contextual_response, template
                )
            
            # Apply voice matching
            final_draft = self._apply_voice_matching(draft, email_data, contextual_response)
            
            # Store for learning
            self._store_draft_for_learning(email_data, final_draft, template.template_id)
            
            return final_draft
            
        except Exception as e:
            self.logger.error(f"Draft generation failed: {e}")
            return self._generate_fallback_draft(email_data, analysis_result)

    def _analyze_response_context(self, email_data: Dict, analysis_result: Any) -> ContextualResponse:
        """Analyze email context to determine appropriate response approach"""
        
        # Extract key information
        subject = email_data.get('subject', '')
        body = email_data.get('body', email_data.get('content', ''))
        sender = email_data.get('sender_name', email_data.get('sender', ''))
        
        # Determine response type based on classification
        classification = analysis_result.classification.value
        response_type_map = {
            'NEEDS_REPLY': 'answer',
            'APPROVAL_REQUIRED': 'approve',
            'CREATE_TASK': 'acknowledge_task',
            'DELEGATE': 'delegate',
            'FYI_ONLY': 'acknowledge',
            'FOLLOW_UP': 'update'
        }
        
        response_type = response_type_map.get(classification, 'acknowledge')
        
        # Extract key points to address
        key_points = self._extract_key_points(body)
        
        # Extract questions
        questions = self._extract_questions(body)
        
        # Extract action items
        action_items = [item.text for item in analysis_result.action_items]
        
        # Determine tone adjustment
        tone = self._determine_response_tone(analysis_result, email_data)
        
        return ContextualResponse(
            response_type=response_type,
            key_points_to_address=key_points,
            questions_to_answer=questions,
            action_items_to_confirm=action_items,
            tone_adjustment=tone,
            urgency_level=analysis_result.urgency.value
        )

    def _extract_key_points(self, text: str) -> List[str]:
        """Extract key points that should be addressed in response"""
        key_points = []
        
        # Look for numbered/bulleted lists
        list_patterns = [
            r'(?:^|\n)\s*(?:\d+\.|\*|-|\•)\s*([^\n]+)',
            r'(?:^|\n)\s*(?:[a-z]\))\s*([^\n]+)',
        ]
        
        for pattern in list_patterns:
            matches = re.findall(pattern, text, re.MULTILINE)
            key_points.extend([match.strip() for match in matches])
        
        # Look for emphasized text (ALL CAPS, "important", etc.)
        emphasis_pattern = r'\b(?:IMPORTANT|URGENT|NOTE|PLEASE|REQUIRED):\s*([^\n.!?]+)'
        emphasized = re.findall(emphasis_pattern, text, re.IGNORECASE)
        key_points.extend(emphasized)
        
        # Limit and clean
        return [point for point in key_points[:5] if len(point) > 10]

    def _extract_questions(self, text: str) -> List[str]:
        """Extract questions that need answers"""
        # Find sentences ending with question marks
        questions = re.findall(r'([^.!?]*\?)', text)
        
        # Clean and filter
        cleaned_questions = []
        for q in questions:
            q = q.strip()
            if len(q) > 10 and not q.lower().startswith('what if'):  # Filter out hypotheticals
                cleaned_questions.append(q + '?')
        
        return cleaned_questions[:3]  # Limit to top 3 questions

    def _determine_response_tone(self, analysis_result: Any, email_data: Dict) -> ResponseTone:
        """Determine appropriate response tone"""
        
        # Base tone on urgency and sentiment
        urgency = analysis_result.urgency.value
        sentiment = analysis_result.sentiment.value
        
        if urgency == 'CRITICAL':
            return ResponseTone.URGENT
        elif sentiment == 'NEGATIVE' or sentiment == 'FRUSTRATED':
            return ResponseTone.EMPATHETIC
        elif sentiment == 'POSITIVE':
            return ResponseTone.POSITIVE
        elif analysis_result.classification.value in ['CREATE_TASK', 'DELEGATE']:
            return ResponseTone.COLLABORATIVE
        else:
            return ResponseTone.NEUTRAL

    def _select_template(self, analysis_result: Any, contextual_response: ContextualResponse) -> DraftTemplate:
        """Select the most appropriate template"""
        
        classification = analysis_result.classification.value
        response_type = contextual_response.response_type
        
        # Template selection logic
        if response_type == 'approve':
            return self.templates['approval']
        elif response_type == 'acknowledge_task':
            return self.templates['task_confirmation']
        elif response_type == 'delegate':
            return self.templates['delegation']
        elif len(contextual_response.questions_to_answer) > 0:
            return self.templates['question_response']
        else:
            return self.templates['acknowledgment']

    def _generate_ai_enhanced_draft(self, email_data: Dict, analysis_result: Any,
                                   contextual_response: ContextualResponse,
                                   template: DraftTemplate) -> str:
        """Generate draft using AI with voice pattern guidance"""
        
        # Build voice guidance prompt
        voice_guidance = self._build_voice_guidance_prompt()
        
        # Build context prompt
        context_prompt = self._build_context_prompt(email_data, analysis_result, contextual_response)
        
        # System prompt for AI
        system_prompt = f"""You are an executive assistant writing on behalf of {self.config['personalization']['user_name']}. 

VOICE GUIDELINES:
{voice_guidance}

RESPONSE REQUIREMENTS:
- Address all key points and questions
- Match the tone and urgency of the situation
- Use the specified greeting and closing patterns
- Keep response concise but complete (3-7 sentences)
- Confirm action items where appropriate

Generate ONLY the email content, no subject line."""

        user_prompt = f"""
EMAIL TO RESPOND TO:
Subject: {email_data.get('subject', '')}
From: {email_data.get('sender_name', email_data.get('sender', ''))}
Content: {email_data.get('body', email_data.get('content', ''))}

ANALYSIS CONTEXT:
{context_prompt}

Write a response that addresses the sender appropriately and handles all the key points."""

        # Call AI (placeholder - would integrate with OpenAI)
        # For now, fall back to template-based generation
        return self._generate_template_based_draft(email_data, analysis_result, contextual_response, template)

    def _build_voice_guidance_prompt(self) -> str:
        """Build voice guidance for AI generation"""
        signature = self.voice_signature
        
        guidance_parts = []
        
        # Greeting patterns
        if signature.greeting_patterns:
            guidance_parts.append(f"Greetings: Use patterns like {', '.join(signature.greeting_patterns[:3])}")
        
        # Closing patterns
        if signature.closing_patterns:
            guidance_parts.append(f"Closings: Use patterns like {', '.join(signature.closing_patterns[:2])}")
        
        # Common phrases
        if signature.common_phrases:
            guidance_parts.append(f"Preferred phrases: {', '.join(signature.common_phrases[:5])}")
        
        # Style indicators
        formality = "formal" if signature.formality_level > 0.7 else "casual" if signature.formality_level < 0.4 else "professional"
        directness = "direct" if signature.directness_level > 0.7 else "diplomatic" if signature.directness_level < 0.4 else "balanced"
        
        guidance_parts.append(f"Style: {formality} and {directness}")
        guidance_parts.append(f"Average sentence length: {signature.sentence_length_avg:.0f} words")
        
        return "\n".join(guidance_parts)

    def _build_context_prompt(self, email_data: Dict, analysis_result: Any,
                             contextual_response: ContextualResponse) -> str:
        """Build context prompt for AI generation"""
        context_parts = []
        
        context_parts.append(f"Classification: {analysis_result.classification.value}")
        context_parts.append(f"Urgency: {analysis_result.urgency.value}")
        context_parts.append(f"Sentiment: {analysis_result.sentiment.value}")
        context_parts.append(f"Response type: {contextual_response.response_type}")
        
        if contextual_response.key_points_to_address:
            context_parts.append(f"Key points to address: {'; '.join(contextual_response.key_points_to_address)}")
        
        if contextual_response.questions_to_answer:
            context_parts.append(f"Questions to answer: {'; '.join(contextual_response.questions_to_answer)}")
        
        if contextual_response.action_items_to_confirm:
            context_parts.append(f"Action items: {'; '.join(contextual_response.action_items_to_confirm)}")
        
        return "\n".join(context_parts)

    def _generate_template_based_draft(self, email_data: Dict, analysis_result: Any,
                                      contextual_response: ContextualResponse,
                                      template: DraftTemplate) -> str:
        """Generate draft using template-based approach"""
        
        draft_parts = []
        
        # Extract sender info
        sender_name = email_data.get('sender_name', email_data.get('sender', ''))
        first_name = sender_name.split()[0].strip(',: ') if sender_name else 'there'
        
        # Build each section according to template structure
        for section in template.structure:
            section_content = self._generate_section_content(
                section, first_name, email_data, analysis_result, contextual_response
            )
            if section_content:
                draft_parts.append(section_content)
        
        return '\n\n'.join(draft_parts)

    def _generate_section_content(self, section: str, first_name: str,
                                 email_data: Dict, analysis_result: Any,
                                 contextual_response: ContextualResponse) -> str:
        """Generate content for a specific section"""
        
        if section == 'greeting':
            return self._generate_greeting(first_name)
        
        elif section == 'acknowledgment':
            return self._generate_acknowledgment(contextual_response)
        
        elif section == 'approval_statement':
            return self._generate_approval_statement(contextual_response)
        
        elif section == 'task_acknowledgment':
            return self._generate_task_acknowledgment(contextual_response)
        
        elif section == 'question_acknowledgment':
            return self._generate_question_acknowledgment(contextual_response)
        
        elif section == 'answers':
            return self._generate_answers(contextual_response)
        
        elif section == 'delegation_acknowledgment':
            return self._generate_delegation_acknowledgment(contextual_response)
        
        elif section == 'assignment':
            return self._generate_assignment(contextual_response)
        
        elif section == 'timeline':
            return self._generate_timeline(analysis_result, contextual_response)
        
        elif section == 'conditions':
            return self._generate_conditions(contextual_response)
        
        elif section == 'follow_up':
            return self._generate_follow_up(contextual_response)
        
        elif section == 'closing':
            return self._generate_closing()
        
        return ""

    def _generate_greeting(self, first_name: str) -> str:
        """Generate personalized greeting"""
        if self.voice_signature.greeting_patterns:
            pattern = self.voice_signature.greeting_patterns[0]
            return pattern.replace('{firstname}', first_name)
        else:
            prefix = self.config['personalization']['greeting_prefix']
            return f"{prefix} {first_name},"

    def _generate_acknowledgment(self, contextual_response: ContextualResponse) -> str:
        """Generate acknowledgment content"""
        phrases = self.phrase_library.get('acknowledgment', [])
        if phrases:
            base_phrase = phrases[0]['text']
        else:
            base_phrase = "Thanks for your email."
        
        # Add context-specific acknowledgment
        if contextual_response.urgency_level == 'CRITICAL':
            return f"{base_phrase} I understand this is urgent."
        elif len(contextual_response.key_points_to_address) > 0:
            return f"{base_phrase} I've reviewed the details you've shared."
        else:
            return base_phrase

    def _generate_approval_statement(self, contextual_response: ContextualResponse) -> str:
        """Generate approval statement"""
        phrases = self.phrase_library.get('approval', [])
        if phrases:
            return phrases[0]['text']
        else:
            return "I approve proceeding as outlined."

    def _generate_task_acknowledgment(self, contextual_response: ContextualResponse) -> str:
        """Generate task acknowledgment"""
        phrases = self.phrase_library.get('task_acceptance', [])
        base_phrase = phrases[0]['text'] if phrases else "I'll take care of this."
        
        if len(contextual_response.action_items_to_confirm) > 0:
            first_action = contextual_response.action_items_to_confirm[0]
            return f"{base_phrase} Specifically, I'll handle: {first_action.lower()}."
        else:
            return base_phrase

    def _generate_question_acknowledgment(self, contextual_response: ContextualResponse) -> str:
        """Generate question acknowledgment"""
        phrases = self.phrase_library.get('questions', [])
        if phrases:
            return phrases[0]['text']
        else:
            question_count = len(contextual_response.questions_to_answer)
            if question_count > 1:
                return "Let me address your questions:"
            else:
                return "Here's the answer to your question:"

    def _generate_answers(self, contextual_response: ContextualResponse) -> str:
        """Generate answers to questions"""
        if not contextual_response.questions_to_answer:
            return ""
        
        # For template-based generation, provide structure for answers
        answers = []
        for i, question in enumerate(contextual_response.questions_to_answer[:3], 1):
            # Simple question type detection
            if 'when' in question.lower():
                answers.append(f"{i}. Timeline: I'll get back to you with specific dates.")
            elif 'how' in question.lower():
                answers.append(f"{i}. Process: I'll outline the approach we'll take.")
            elif 'what' in question.lower():
                answers.append(f"{i}. Details: I'll provide the information you need.")
            elif 'who' in question.lower():
                answers.append(f"{i}. Assignment: I'll confirm who will handle this.")
            else:
                answers.append(f"{i}. I'll provide a detailed response to this.")
        
        return '\n'.join(answers)

    def _generate_delegation_acknowledgment(self, contextual_response: ContextualResponse) -> str:
        """Generate delegation acknowledgment"""
        return "I'll have the right person handle this and ensure you get a proper response."

    def _generate_assignment(self, contextual_response: ContextualResponse) -> str:
        """Generate assignment details"""
        if contextual_response.action_items_to_confirm:
            return f"I'll route this to the appropriate team member for: {contextual_response.action_items_to_confirm[0]}."
        else:
            return "I'll make sure this gets assigned to the right person."

    def _generate_timeline(self, analysis_result: Any, contextual_response: ContextualResponse) -> str:
        """Generate timeline information"""
        phrases = self.phrase_library.get('timeline', [])
        
        # Check if there are existing deadlines
        if analysis_result.deadlines:
            deadline = analysis_result.deadlines[0][0]  # First deadline
            deadline_str = deadline.strftime('%B %d')
            return f"I'll have this completed by {deadline_str}."
        elif contextual_response.urgency_level == 'CRITICAL':
            return "I'll handle this today and update you shortly."
        elif contextual_response.urgency_level == 'HIGH':
            return "I'll take care of this by end of week."
        else:
            return phrases[0]['text'].replace('[timeline]', 'early next week') if phrases else "I'll update you on progress."

    def _generate_conditions(self, contextual_response: ContextualResponse) -> str:
        """Generate any conditions or requirements"""
        if contextual_response.urgency_level == 'CRITICAL':
            return "I'll need to review the details before final approval."
        else:
            return ""

    def _generate_follow_up(self, contextual_response: ContextualResponse) -> str:
        """Generate follow-up information"""
        if len(contextual_response.questions_to_answer) > 3:
            return "I'll address your remaining questions in a follow-up email."
        elif len(contextual_response.action_items_to_confirm) > 1:
            return "I'll confirm completion of each item as we progress."
        else:
            return ""

    def _generate_closing(self) -> str:
        """Generate closing with signature"""
        closing_phrases = self.phrase_library.get('closing', [])
        
        # Select closing phrase
        if closing_phrases:
            closing_phrase = closing_phrases[0]['text']
        else:
            closing_phrase = "Let me know if you need anything else."
        
        # Add signature
        signature = self.voice_signature.signature_style
        
        return f"{closing_phrase}\n\n{signature}"

    def _apply_voice_matching(self, draft: str, email_data: Dict,
                             contextual_response: ContextualResponse) -> str:
        """Apply voice matching to ensure consistency with user's style"""
        
        # Apply sentence length adjustment
        draft = self._adjust_sentence_length(draft)
        
        # Apply formality level
        draft = self._adjust_formality(draft)
        
        # Apply directness level
        draft = self._adjust_directness(draft, contextual_response)
        
        # Apply personal touches
        draft = self._add_personal_touches(draft)
        
        return draft

    def _adjust_sentence_length(self, draft: str) -> str:
        """Adjust sentence length to match user's average"""
        target_length = self.voice_signature.sentence_length_avg
        sentences = re.split(r'[.!?]+', draft)
        
        adjusted_sentences = []
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            words = sentence.split()
            current_length = len(words)
            
            # If sentence is much longer than target, try to split
            if current_length > target_length * 1.5:
                # Look for natural break points
                if ' and ' in sentence:
                    parts = sentence.split(' and ', 1)
                    adjusted_sentences.append(parts[0] + '.')
                    adjusted_sentences.append('And ' + parts[1])
                else:
                    adjusted_sentences.append(sentence)
            # If sentence is much shorter, try to combine with next
            elif current_length < target_length * 0.7 and len(adjusted_sentences) > 0:
                # Combine with previous sentence if it makes sense
                prev_sentence = adjusted_sentences[-1]
                if not prev_sentence.endswith('.'):
                    adjusted_sentences[-1] = prev_sentence + ', ' + sentence.lower()
                else:
                    adjusted_sentences.append(sentence)
            else:
                adjusted_sentences.append(sentence)
        
        return '. '.join(adjusted_sentences) + '.'

    def _adjust_formality(self, draft: str) -> str:
        """Adjust formality level to match user's style"""
        formality_level = self.voice_signature.formality_level
        
        # If user is more casual (< 0.5), make adjustments
        if formality_level < 0.5:
            # Replace formal phrases with casual ones
            casual_replacements = {
                r'\bI would like to\b': "I'd like to",
                r'\bI will\b': "I'll",
                r'\bI would\b': "I'd",
                r'\byou will\b': "you'll",
                r'\bdo not\b': "don't",
                r'\bcannot\b': "can't",
                r'\bshould not\b': "shouldn't"
            }
            
            for formal, casual in casual_replacements.items():
                draft = re.sub(formal, casual, draft, flags=re.IGNORECASE)
        
        # If user is very formal (> 0.8), avoid contractions
        elif formality_level > 0.8:
            formal_replacements = {
                r"\bI'll\b": "I will",
                r"\bI'd\b": "I would",
                r"\byou'll\b": "you will",
                r"\bdon't\b": "do not",
                r"\bcan't\b": "cannot",
                r"\bshouldn't\b": "should not"
            }
            
            for casual, formal in formal_replacements.items():
                draft = re.sub(casual, formal, draft, flags=re.IGNORECASE)
        
        return draft

    def _adjust_directness(self, draft: str, contextual_response: ContextualResponse) -> str:
        """Adjust directness level based on user's style and context"""
        directness_level = self.voice_signature.directness_level
        
        # If user is very direct (> 0.8), remove hedging language
        if directness_level > 0.8:
            hedging_patterns = [
                r'\bI think that\b',
                r'\bperhaps\b',
                r'\bmaybe\b',
                r'\bif possible\b',
                r'\bmight be able to\b'
            ]
            
            for pattern in hedging_patterns:
                draft = re.sub(pattern, '', draft, flags=re.IGNORECASE)
                draft = re.sub(r'\s+', ' ', draft)  # Clean up extra spaces
        
        # If user is diplomatic (< 0.4), add softening language
        elif directness_level < 0.4:
            # Add hedging to direct statements
            direct_patterns = [
                (r'\bI will\b', 'I plan to'),
                (r'\bYou need to\b', 'Could you please'),
                (r'\bThis is\b', 'This appears to be')
            ]
            
            for direct, diplomatic in direct_patterns:
                draft = re.sub(direct, diplomatic, draft, flags=re.IGNORECASE)
        
        return draft

    def _add_personal_touches(self, draft: str) -> str:
        """Add personal touches from user's common phrases"""
        
        # Add common phrases if appropriate
        common_phrases = self.voice_signature.common_phrases
        
        if common_phrases and 'thanks for' not in draft.lower():
            # Add a common phrase if it fits the context
            for phrase in common_phrases:
                if 'thanks' in phrase.lower() and not re.search(r'\bthanks?\b', draft, re.IGNORECASE):
                    # Insert thank you phrase at beginning
                    sentences = draft.split('. ')
                    if len(sentences) > 1:
                        sentences.insert(1, phrase)
                        draft = '. '.join(sentences)
                    break
        
        return draft

    def _generate_fallback_draft(self, email_data: Dict, analysis_result: Any) -> str:
        """Generate basic fallback draft when other methods fail"""
        sender_name = email_data.get('sender_name', email_data.get('sender', ''))
        first_name = sender_name.split()[0].strip(',: ') if sender_name else 'there'
        
        greeting = f"D {first_name},"
        
        # Simple response based on classification
        classification = analysis_result.classification.value
        if classification == 'APPROVAL_REQUIRED':
            body = "Thanks for sending this for review. I approve proceeding as outlined."
        elif classification == 'CREATE_TASK':
            body = "Thanks for the context. I'll track this as a task and update you on progress."
        elif classification == 'DELEGATE':
            body = "I'll have the appropriate team member handle this and follow up with you."
        elif classification == 'NEEDS_REPLY':
            body = "Thanks for reaching out. I've reviewed your message and will get back to you with details."
        else:
            body = "Thanks for the update — noted."
        
        signature = self.config['personalization']['signature']
        
        return f"{greeting}\n\n{body}\n\n{signature}"

    def _store_draft_for_learning(self, email_data: Dict, draft: str, template_id: str):
        """Store draft for learning and improvement"""
        try:
            email_hash = email_data.get('email_hash', 'unknown')
            draft_id = f"DRAFT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO draft_history 
                    (draft_id, original_email_hash, generated_draft, template_used)
                    VALUES (?, ?, ?, ?)
                """, (draft_id, email_hash, draft, template_id))
                
        except Exception as e:
            self.logger.error(f"Failed to store draft for learning: {e}")

    def learn_from_user_email(self, email_content: str, recipient: str, context: str = ""):
        """Learn from user's sent emails to improve voice matching"""
        if not self.voice_learning_enabled:
            return
        
        try:
            # Analyze email patterns
            patterns = self._analyze_email_patterns(email_content)
            
            # Update voice signature
            self._update_voice_patterns(patterns, context)
            
            # Store email for future analysis
            self._store_user_email(email_content, recipient, context)
            
        except Exception as e:
            self.logger.error(f"Failed to learn from user email: {e}")

    def _analyze_email_patterns(self, email_content: str) -> Dict[str, Any]:
        """Analyze patterns in user's email"""
        patterns = {}
        
        # Extract greeting patterns
        greeting_match = re.match(r'^([^,\n]+,)', email_content.strip())
        if greeting_match:
            patterns['greeting'] = greeting_match.group(1)
        
        # Extract closing patterns
        lines = email_content.strip().split('\n')
        if len(lines) >= 2:
            potential_closing = '\n'.join(lines[-2:])
            patterns['closing'] = potential_closing
        
        # Calculate metrics
        sentences = re.split(r'[.!?]+', email_content)
        word_counts = [len(sentence.split()) for sentence in sentences if sentence.strip()]
        
        if word_counts:
            patterns['sentence_length_avg'] = statistics.mean(word_counts)
        
        # Formality indicators
        formal_indicators = ['I would like', 'I am writing', 'please find', 'I would appreciate']
        casual_indicators = ["I'll", "don't", "can't", "let's", "thanks"]
        
        formal_count = sum(1 for indicator in formal_indicators if indicator in email_content)
        casual_count = sum(1 for indicator in casual_indicators if indicator in email_content)
        
        total_indicators = formal_count + casual_count
        if total_indicators > 0:
            patterns['formality_level'] = formal_count / total_indicators
        
        # Directness indicators
        direct_indicators = ['I need', 'you must', 'please do', 'immediately']
        diplomatic_indicators = ['could you', 'if possible', 'when convenient', 'perhaps']
        
        direct_count = sum(1 for indicator in direct_indicators if indicator in email_content)
        diplomatic_count = sum(1 for indicator in diplomatic_indicators if indicator in email_content)
        
        total_directness = direct_count + diplomatic_count
        if total_directness > 0:
            patterns['directness_level'] = direct_count / total_directness
        
        return patterns

    def _update_voice_patterns(self, patterns: Dict[str, Any], context: str):
        """Update voice patterns in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                for pattern_type, pattern_value in patterns.items():
                    # Check if pattern exists
                    cursor.execute("""
                        SELECT frequency, confidence FROM voice_patterns 
                        WHERE pattern_type = ? AND pattern_value = ?
                    """, (pattern_type, str(pattern_value)))
                    
                    existing = cursor.fetchone()
                    
                    if existing:
                        # Update existing pattern
                        new_frequency = existing[0] + 1
                        new_confidence = min(existing[1] + self.adaptation_rate, 1.0)
                        
                        cursor.execute("""
                            UPDATE voice_patterns 
                            SET frequency = ?, confidence = ?, last_seen = CURRENT_TIMESTAMP
                            WHERE pattern_type = ? AND pattern_value = ?
                        """, (new_frequency, new_confidence, pattern_type, str(pattern_value)))
                    else:
                        # Insert new pattern
                        cursor.execute("""
                            INSERT INTO voice_patterns (pattern_type, pattern_value, confidence, context)
                            VALUES (?, ?, ?, ?)
                        """, (pattern_type, str(pattern_value), 0.5, context))
                
                # Reload voice signature with updated patterns
                self._load_user_voice_signature()
                
        except Exception as e:
            self.logger.error(f"Failed to update voice patterns: {e}")

    def _store_user_email(self, email_content: str, recipient: str, context: str):
        """Store user email for analysis"""
        try:
            import hashlib
            email_hash = hashlib.md5(email_content.encode()).hexdigest()
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT OR IGNORE INTO user_emails 
                    (email_hash, body, recipient, analysis_data)
                    VALUES (?, ?, ?, ?)
                """, (email_hash, email_content, recipient, json.dumps({'context': context})))
                
        except Exception as e:
            self.logger.error(f"Failed to store user email: {e}")

    def get_voice_summary(self) -> Dict[str, Any]:
        """Get summary of learned voice patterns"""
        signature = self.voice_signature
        
        return {
            'greeting_patterns': signature.greeting_patterns[:3],
            'closing_patterns': signature.closing_patterns[:2], 
            'common_phrases': signature.common_phrases[:5],
            'style_metrics': {
                'sentence_length_avg': signature.sentence_length_avg,
                'formality_level': signature.formality_level,
                'directness_level': signature.directness_level,
                'personal_pronouns_ratio': signature.personal_pronouns_ratio,
                'question_frequency': signature.question_frequency
            },
            'learning_status': {
                'voice_learning_enabled': self.voice_learning_enabled,
                'adaptation_rate': self.adaptation_rate,
                'total_patterns_learned': len(self.phrase_library)
            }
        }


def main():
    """Demo the advanced draft generator"""
    generator = AdvancedDraftGenerator()
    
    # Test email data
    test_email = {
        'subject': 'Budget Approval for Q4 Marketing Campaign',
        'body': 'Hi Abdullah, I need your approval for the Q4 marketing budget of $75,000. The campaign includes social media ads, content creation, and influencer partnerships. Can you approve this by Friday? Also, do you want to review the detailed breakdown first? Thanks, Sarah',
        'sender': 'sarah.johnson@company.com',
        'sender_name': 'Sarah Johnson',
        'email_hash': 'test-email-456'
    }
    
    # Mock analysis result
    from email_intelligence_engine import EmailClass, Urgency, Sentiment, ActionItem, EmailIntelligence
    
    mock_analysis = EmailIntelligence(
        classification=EmailClass.APPROVAL_REQUIRED,
        confidence=0.9,
        urgency=Urgency.HIGH,
        sentiment=Sentiment.NEUTRAL,
        intent="request_approval",
        action_items=[
            ActionItem(text="approve marketing budget", confidence=0.9),
            ActionItem(text="review detailed breakdown", confidence=0.7)
        ],
        deadlines=[(datetime.now() + timedelta(days=3), "by Friday")],
        confidence_scores={'classification': 0.9},
        processing_time_ms=150.0
    )
    
    print("Advanced Draft Generator Demo")
    print("=" * 50)
    
    # Generate draft
    print(f"Original email: {test_email['subject']}")
    print(f"From: {test_email['sender_name']}")
    print(f"Classification: {mock_analysis.classification.value}")
    print(f"Urgency: {mock_analysis.urgency.value}")
    
    draft = generator.generate_draft(test_email, mock_analysis)
    
    print(f"\nGenerated draft:")
    print("-" * 30)
    print(draft)
    print("-" * 30)
    
    # Show voice summary
    print(f"\nVoice Summary:")
    voice_summary = generator.get_voice_summary()
    print(json.dumps(voice_summary, indent=2))


if __name__ == "__main__":
    main()