#!/usr/bin/env python3
"""
User Writing Style Learning Module
=================================

Advanced machine learning system for analyzing and learning user writing patterns,
communication preferences, and style characteristics to improve AI draft generation.

Features:
- Automatic style analysis from sent emails and drafts
- Communication pattern recognition
- Tone and formality preference learning
- Vocabulary and phrase pattern extraction
- Relationship-based style adaptation
- Continuous learning from user feedback
- Style profile persistence and versioning
"""

import os
import re
import json
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict
from collections import defaultdict, Counter
from pathlib import Path
import statistics

try:
    import numpy as np
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    from sklearn.metrics.pairwise import cosine_similarity
except ImportError:
    print("Warning: scikit-learn not available. Style learning will use basic analysis.")
    np = None

@dataclass
class StyleCharacteristics:
    """User's writing style characteristics"""
    avg_sentence_length: float = 0.0
    avg_paragraph_length: float = 0.0
    formality_score: float = 0.5
    directness_score: float = 0.5
    warmth_score: float = 0.5
    technical_level: float = 0.5
    urgency_style: str = "balanced"
    preferred_greetings: List[str] = None
    preferred_closings: List[str] = None
    common_phrases: List[str] = None
    vocabulary_complexity: float = 0.5
    punctuation_style: Dict[str, float] = None
    
    def __post_init__(self):
        if self.preferred_greetings is None:
            self.preferred_greetings = []
        if self.preferred_closings is None:
            self.preferred_closings = []
        if self.common_phrases is None:
            self.common_phrases = []
        if self.punctuation_style is None:
            self.punctuation_style = {}

@dataclass
class CommunicationContext:
    """Context for communication style adaptation"""
    recipient_type: str = "unknown"  # colleague, client, manager, subordinate
    relationship_level: str = "professional"  # formal, professional, casual, personal
    urgency_level: str = "medium"  # low, medium, high
    email_type: str = "general"  # reply, request, update, meeting, approval
    department: Optional[str] = None
    previous_interactions: int = 0

@dataclass
class StyleProfile:
    """Complete user style profile"""
    user_id: str
    characteristics: StyleCharacteristics
    context_adaptations: Dict[str, StyleCharacteristics]
    learning_metadata: Dict[str, Any]
    version: int = 1
    created_at: str = None
    updated_at: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()
        if self.updated_at is None:
            self.updated_at = datetime.now().isoformat()

class StyleLearner:
    """
    Advanced writing style learning system that analyzes user communication
    patterns and adapts draft generation accordingly.
    """
    
    def __init__(self, user_id: str = "default", db_path: str = "user_styles.db"):
        self.user_id = user_id
        self.db_path = db_path
        self.logger = self._setup_logging()
        
        # Initialize database
        self._init_database()
        
        # Style analysis components
        self.sentence_patterns = defaultdict(list)
        self.phrase_frequency = Counter()
        self.context_styles = defaultdict(list)
        
        # Learning parameters
        self.min_samples_for_learning = 5
        self.confidence_threshold = 0.7
        self.adaptation_rate = 0.1
        
        # Current style profile
        self.current_profile = self._load_or_create_profile()
        
        self.logger.info(f"Style learner initialized for user {user_id}")
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging for style learner"""
        logger = logging.getLogger("StyleLearner")
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _init_database(self):
        """Initialize SQLite database for style persistence"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS style_profiles (
                        user_id TEXT PRIMARY KEY,
                        profile_data TEXT,
                        version INTEGER,
                        created_at TEXT,
                        updated_at TEXT
                    )
                """)
                
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS style_samples (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT,
                        content TEXT,
                        context TEXT,
                        analysis_data TEXT,
                        feedback_score REAL,
                        created_at TEXT,
                        FOREIGN KEY (user_id) REFERENCES style_profiles (user_id)
                    )
                """)
                
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS style_adaptations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id TEXT,
                        context_type TEXT,
                        adaptation_data TEXT,
                        confidence_score REAL,
                        usage_count INTEGER DEFAULT 0,
                        created_at TEXT,
                        FOREIGN KEY (user_id) REFERENCES style_profiles (user_id)
                    )
                """)
                
                conn.commit()
                
        except Exception as e:
            self.logger.error(f"Database initialization failed: {e}")
    
    def _load_or_create_profile(self) -> StyleProfile:
        """Load existing profile or create new one"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT profile_data, version FROM style_profiles WHERE user_id = ?",
                    (self.user_id,)
                )
                row = cursor.fetchone()
                
                if row:
                    profile_data = json.loads(row[0])
                    profile = StyleProfile(**profile_data)
                    self.logger.info(f"Loaded existing style profile version {profile.version}")
                    return profile
        
        except Exception as e:
            self.logger.warning(f"Failed to load profile: {e}")
        
        # Create new profile with defaults
        profile = StyleProfile(
            user_id=self.user_id,
            characteristics=StyleCharacteristics(),
            context_adaptations={},
            learning_metadata={
                "samples_analyzed": 0,
                "last_learning_update": None,
                "confidence_level": 0.0,
                "primary_contexts": []
            }
        )
        
        self._save_profile(profile)
        self.logger.info("Created new style profile")
        return profile
    
    def _save_profile(self, profile: StyleProfile):
        """Save style profile to database"""
        try:
            profile.updated_at = datetime.now().isoformat()
            profile_data = asdict(profile)
            
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT OR REPLACE INTO style_profiles 
                    (user_id, profile_data, version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    self.user_id,
                    json.dumps(profile_data),
                    profile.version,
                    profile.created_at,
                    profile.updated_at
                ))
                conn.commit()
                
        except Exception as e:
            self.logger.error(f"Failed to save profile: {e}")
    
    async def analyze_writing_sample(self, 
                                   content: str, 
                                   context: CommunicationContext = None) -> Dict[str, Any]:
        """
        Analyze a writing sample and extract style characteristics
        
        Args:
            content: Email or draft content to analyze
            context: Communication context for the sample
            
        Returns:
            Dictionary with analyzed style characteristics
        """
        if not content or len(content.strip()) < 10:
            return {"error": "Content too short for analysis"}
        
        analysis = {}
        
        # Basic text statistics
        analysis.update(self._analyze_basic_metrics(content))
        
        # Linguistic patterns
        analysis.update(self._analyze_linguistic_patterns(content))
        
        # Style characteristics
        analysis.update(self._analyze_style_characteristics(content))
        
        # Communication patterns
        analysis.update(self._analyze_communication_patterns(content))
        
        # Context-specific analysis
        if context:
            analysis.update(self._analyze_contextual_style(content, context))
        
        # Store sample for learning
        await self._store_sample(content, context, analysis)
        
        return analysis
    
    def _analyze_basic_metrics(self, content: str) -> Dict[str, Any]:
        """Analyze basic text metrics"""
        sentences = re.split(r'[.!?]+', content)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
        words = content.split()
        
        return {
            "word_count": len(words),
            "sentence_count": len(sentences),
            "paragraph_count": len(paragraphs),
            "avg_sentence_length": sum(len(s.split()) for s in sentences) / max(1, len(sentences)),
            "avg_paragraph_length": len(sentences) / max(1, len(paragraphs)),
            "avg_word_length": sum(len(word) for word in words) / max(1, len(words))
        }
    
    def _analyze_linguistic_patterns(self, content: str) -> Dict[str, Any]:
        """Analyze linguistic patterns and vocabulary"""
        
        # Greeting patterns
        greetings = re.findall(r'^(Dear|Hi|Hello|Hey|Good\s+\w+)', content, re.IGNORECASE | re.MULTILINE)
        
        # Closing patterns
        closings = re.findall(r'(Best\s+regards|Sincerely|Thanks?|Best|Cheers|Regards)', content, re.IGNORECASE)
        
        # Question patterns
        questions = len(re.findall(r'\?', content))
        
        # Exclamation patterns
        exclamations = len(re.findall(r'!', content))
        
        # Comma usage
        comma_frequency = content.count(',') / max(1, len(content.split()))
        
        # Semicolon and colon usage
        semicolon_frequency = content.count(';') / max(1, len(content.split()))
        colon_frequency = content.count(':') / max(1, len(content.split()))
        
        return {
            "greetings_used": greetings,
            "closings_used": closings,
            "question_frequency": questions / max(1, len(content.split('.'))),
            "exclamation_frequency": exclamations / max(1, len(content.split('.'))),
            "comma_frequency": comma_frequency,
            "semicolon_frequency": semicolon_frequency,
            "colon_frequency": colon_frequency,
            "punctuation_style": {
                "comma": comma_frequency,
                "semicolon": semicolon_frequency,
                "colon": colon_frequency,
                "question": questions,
                "exclamation": exclamations
            }
        }
    
    def _analyze_style_characteristics(self, content: str) -> Dict[str, Any]:
        """Analyze style characteristics like formality and tone"""
        
        # Formality indicators
        formal_words = len(re.findall(
            r'\b(Dear|Sincerely|Furthermore|Moreover|However|Nevertheless|Respectfully)\b',
            content, re.IGNORECASE
        ))
        
        casual_words = len(re.findall(
            r'\b(Hi|Hey|Thanks|Cool|Great|Awesome|Let me know|Talk soon)\b',
            content, re.IGNORECASE
        ))
        
        # Directness indicators
        direct_phrases = len(re.findall(
            r'\b(Please|I need|You must|Required|Mandatory|Immediately)\b',
            content, re.IGNORECASE
        ))
        
        polite_phrases = len(re.findall(
            r'\b(Could you|Would you|If possible|When convenient|Please consider)\b',
            content, re.IGNORECASE
        ))
        
        # Warmth indicators
        warm_phrases = len(re.findall(
            r'\b(Hope|Thank you|Appreciate|Grateful|Kind|Wonderful|Great)\b',
            content, re.IGNORECASE
        ))
        
        # Technical complexity
        technical_words = len(re.findall(
            r'\b(implement|configure|analyze|optimize|integrate|framework|architecture)\b',
            content, re.IGNORECASE
        ))
        
        word_count = len(content.split())
        
        return {
            "formality_score": self._calculate_score(formal_words, casual_words, word_count),
            "directness_score": self._calculate_score(direct_phrases, polite_phrases, word_count),
            "warmth_score": warm_phrases / max(1, word_count / 20),
            "technical_level": technical_words / max(1, word_count / 30),
            "vocabulary_complexity": self._calculate_vocabulary_complexity(content)
        }
    
    def _analyze_communication_patterns(self, content: str) -> Dict[str, Any]:
        """Analyze communication patterns and preferences"""
        
        # Call to action patterns
        cta_patterns = re.findall(
            r'\b(Please\s+\w+|Let me know|Feel free|Don\'t hesitate|Contact me)\b',
            content, re.IGNORECASE
        )
        
        # Time references
        time_urgency = len(re.findall(
            r'\b(urgent|asap|immediately|quickly|soon|deadline|by\s+\w+day)\b',
            content, re.IGNORECASE
        ))
        
        # Follow-up patterns
        follow_up = len(re.findall(
            r'\b(follow.?up|will\s+contact|get\s+back|touch\s+base)\b',
            content, re.IGNORECASE
        ))
        
        # Collaborative language
        collaborative = len(re.findall(
            r'\b(we|us|our|together|collaborate|team|partnership)\b',
            content, re.IGNORECASE
        ))
        
        return {
            "call_to_action_style": cta_patterns,
            "urgency_indicators": time_urgency,
            "follow_up_style": follow_up > 0,
            "collaborative_language": collaborative / max(1, len(content.split()) / 20)
        }
    
    def _analyze_contextual_style(self, content: str, context: CommunicationContext) -> Dict[str, Any]:
        """Analyze style in specific communication context"""
        
        context_key = f"{context.recipient_type}_{context.relationship_level}_{context.email_type}"
        
        # Store context-specific patterns
        self.context_styles[context_key].append({
            "content_length": len(content.split()),
            "formality": self._get_formality_from_content(content),
            "directness": self._get_directness_from_content(content),
            "greeting_style": self._extract_greeting_style(content),
            "closing_style": self._extract_closing_style(content)
        })
        
        return {
            "context_key": context_key,
            "context_adaptations": self._get_context_adaptations(context_key)
        }
    
    async def record_successful_draft(self, 
                                    content: str, 
                                    email_context: Any, 
                                    options: Any,
                                    feedback_score: float = 1.0):
        """Record a successful draft for learning"""
        
        context = CommunicationContext(
            recipient_type=self._infer_recipient_type(email_context),
            relationship_level=self._infer_relationship_level(email_context),
            urgency_level=email_context.urgency.lower() if hasattr(email_context, 'urgency') else "medium",
            email_type=self._infer_email_type(email_context)
        )
        
        # Analyze the successful draft
        analysis = await self.analyze_writing_sample(content, context)
        
        # Update learning with positive feedback
        await self._update_learning(content, context, analysis, feedback_score)
    
    async def record_user_correction(self, 
                                   original_draft: str, 
                                   corrected_draft: str,
                                   context: CommunicationContext = None):
        """Learn from user corrections to improve future drafts"""
        
        # Analyze differences between original and corrected drafts
        correction_analysis = self._analyze_corrections(original_draft, corrected_draft)
        
        # Update style preferences based on corrections
        await self._apply_correction_learning(correction_analysis, context)
        
        self.logger.info("Learned from user correction")
    
    async def get_user_style_profile(self) -> Dict[str, Any]:
        """Get current user style profile for draft generation"""
        
        profile = self.current_profile
        
        return {
            "style_description": self._generate_style_description(profile.characteristics),
            "greeting_style": self._get_preferred_greeting_style(profile.characteristics),
            "closing_style": self._get_preferred_closing_style(profile.characteristics),
            "formality_preference": profile.characteristics.formality_score,
            "directness_preference": profile.characteristics.directness_score,
            "warmth_preference": profile.characteristics.warmth_score,
            "typical_length": self._get_typical_length_preference(profile.characteristics),
            "vocabulary_level": profile.characteristics.vocabulary_complexity,
            "context_adaptations": profile.context_adaptations,
            "confidence_level": profile.learning_metadata.get("confidence_level", 0.0)
        }
    
    async def get_context_specific_style(self, context: CommunicationContext) -> Dict[str, Any]:
        """Get style recommendations for specific context"""
        
        context_key = f"{context.recipient_type}_{context.relationship_level}_{context.email_type}"
        
        # Check if we have context-specific adaptations
        if context_key in self.current_profile.context_adaptations:
            adapted_characteristics = self.current_profile.context_adaptations[context_key]
            return {
                "adapted_style": True,
                "context_key": context_key,
                "formality_adjustment": adapted_characteristics.formality_score,
                "directness_adjustment": adapted_characteristics.directness_score,
                "preferred_greetings": adapted_characteristics.preferred_greetings,
                "preferred_closings": adapted_characteristics.preferred_closings
            }
        
        # Use base style with context hints
        base_style = await self.get_user_style_profile()
        
        # Apply context-based adjustments
        adjustments = self._get_contextual_adjustments(context)
        
        return {
            "adapted_style": False,
            "context_key": context_key,
            "base_style": base_style,
            "suggested_adjustments": adjustments
        }
    
    def _calculate_score(self, positive_indicators: int, negative_indicators: int, total_words: int) -> float:
        """Calculate a normalized score between 0 and 1"""
        if total_words == 0:
            return 0.5
        
        positive_ratio = positive_indicators / (total_words / 20)
        negative_ratio = negative_indicators / (total_words / 20)
        
        # Normalize to 0-1 scale
        score = (positive_ratio - negative_ratio + 1) / 2
        return max(0.0, min(1.0, score))
    
    def _calculate_vocabulary_complexity(self, content: str) -> float:
        """Calculate vocabulary complexity score"""
        words = re.findall(r'\b\w+\b', content.lower())
        
        if not words:
            return 0.5
        
        # Count unique words
        unique_words = set(words)
        vocabulary_diversity = len(unique_words) / len(words)
        
        # Count complex words (>6 characters)
        complex_words = [w for w in words if len(w) > 6]
        complexity_ratio = len(complex_words) / len(words)
        
        # Combine metrics
        complexity_score = (vocabulary_diversity * 0.4 + complexity_ratio * 0.6)
        return min(1.0, complexity_score * 2)  # Scale to make it more sensitive
    
    def _get_formality_from_content(self, content: str) -> float:
        """Extract formality score from content"""
        formal_indicators = len(re.findall(
            r'\b(Dear|Sincerely|Respectfully|Furthermore|Moreover)\b',
            content, re.IGNORECASE
        ))
        casual_indicators = len(re.findall(
            r'\b(Hi|Hey|Thanks|Cool|Great)\b',
            content, re.IGNORECASE
        ))
        
        total_words = len(content.split())
        return self._calculate_score(formal_indicators, casual_indicators, total_words)
    
    def _get_directness_from_content(self, content: str) -> float:
        """Extract directness score from content"""
        direct_indicators = len(re.findall(
            r'\b(Please|I need|You must|Required)\b',
            content, re.IGNORECASE
        ))
        indirect_indicators = len(re.findall(
            r'\b(Could you|Would you|If possible|When convenient)\b',
            content, re.IGNORECASE
        ))
        
        total_words = len(content.split())
        return self._calculate_score(direct_indicators, indirect_indicators, total_words)
    
    def _extract_greeting_style(self, content: str) -> str:
        """Extract greeting style from content"""
        if re.search(r'^Dear\s+\w+', content, re.IGNORECASE):
            return "formal"
        elif re.search(r'^Hi\s+\w+', content, re.IGNORECASE):
            return "friendly"
        elif re.search(r'^Hello\s+\w+', content, re.IGNORECASE):
            return "professional"
        else:
            return "casual"
    
    def _extract_closing_style(self, content: str) -> str:
        """Extract closing style from content"""
        if re.search(r'Best\s+regards', content, re.IGNORECASE):
            return "formal"
        elif re.search(r'Thanks', content, re.IGNORECASE):
            return "casual"
        elif re.search(r'Sincerely', content, re.IGNORECASE):
            return "very_formal"
        elif re.search(r'Best', content, re.IGNORECASE):
            return "professional"
        else:
            return "minimal"
    
    async def _store_sample(self, content: str, context: CommunicationContext, analysis: Dict):
        """Store analyzed sample in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("""
                    INSERT INTO style_samples 
                    (user_id, content, context, analysis_data, feedback_score, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    self.user_id,
                    content[:1000],  # Truncate content for storage
                    json.dumps(asdict(context)) if context else None,
                    json.dumps(analysis),
                    1.0,  # Default positive feedback
                    datetime.now().isoformat()
                ))
                conn.commit()
        except Exception as e:
            self.logger.error(f"Failed to store sample: {e}")
    
    async def _update_learning(self, content: str, context: CommunicationContext, 
                             analysis: Dict, feedback_score: float):
        """Update learning model with new data"""
        
        # Update sample count
        self.current_profile.learning_metadata["samples_analyzed"] += 1
        
        # Update characteristics with exponential moving average
        self._update_characteristics_with_ema(analysis, feedback_score)
        
        # Update context-specific adaptations
        if context:
            self._update_context_adaptations(context, analysis, feedback_score)
        
        # Update confidence based on sample count and consistency
        self._update_confidence_level()
        
        # Save updated profile
        self.current_profile.version += 1
        self.current_profile.learning_metadata["last_learning_update"] = datetime.now().isoformat()
        self._save_profile(self.current_profile)
    
    def _update_characteristics_with_ema(self, analysis: Dict, feedback_score: float):
        """Update characteristics using exponential moving average"""
        
        alpha = self.adaptation_rate * feedback_score  # Weight by feedback
        chars = self.current_profile.characteristics
        
        # Update numeric characteristics
        if "avg_sentence_length" in analysis:
            chars.avg_sentence_length = (1 - alpha) * chars.avg_sentence_length + alpha * analysis["avg_sentence_length"]
        
        if "formality_score" in analysis:
            chars.formality_score = (1 - alpha) * chars.formality_score + alpha * analysis["formality_score"]
        
        if "directness_score" in analysis:
            chars.directness_score = (1 - alpha) * chars.directness_score + alpha * analysis["directness_score"]
        
        if "warmth_score" in analysis:
            chars.warmth_score = (1 - alpha) * chars.warmth_score + alpha * analysis["warmth_score"]
        
        if "technical_level" in analysis:
            chars.technical_level = (1 - alpha) * chars.technical_level + alpha * analysis["technical_level"]
        
        # Update categorical preferences
        if "greetings_used" in analysis and analysis["greetings_used"]:
            for greeting in analysis["greetings_used"]:
                if greeting not in chars.preferred_greetings:
                    chars.preferred_greetings.append(greeting)
        
        if "closings_used" in analysis and analysis["closings_used"]:
            for closing in analysis["closings_used"]:
                if closing not in chars.preferred_closings:
                    chars.preferred_closings.append(closing)
    
    def _update_context_adaptations(self, context: CommunicationContext, 
                                  analysis: Dict, feedback_score: float):
        """Update context-specific style adaptations"""
        
        context_key = f"{context.recipient_type}_{context.relationship_level}_{context.email_type}"
        
        if context_key not in self.current_profile.context_adaptations:
            self.current_profile.context_adaptations[context_key] = StyleCharacteristics()
        
        # Update context-specific characteristics
        context_chars = self.current_profile.context_adaptations[context_key]
        alpha = self.adaptation_rate * feedback_score
        
        if "formality_score" in analysis:
            context_chars.formality_score = (1 - alpha) * context_chars.formality_score + alpha * analysis["formality_score"]
        
        if "directness_score" in analysis:
            context_chars.directness_score = (1 - alpha) * context_chars.directness_score + alpha * analysis["directness_score"]
    
    def _update_confidence_level(self):
        """Update confidence level based on learning progress"""
        samples = self.current_profile.learning_metadata["samples_analyzed"]
        
        # Confidence increases with more samples, asymptotically approaching 1.0
        confidence = min(0.95, samples / (samples + 10))
        
        self.current_profile.learning_metadata["confidence_level"] = confidence
    
    def _generate_style_description(self, characteristics: StyleCharacteristics) -> str:
        """Generate human-readable style description"""
        
        formality = "formal" if characteristics.formality_score > 0.7 else "casual" if characteristics.formality_score < 0.3 else "professional"
        directness = "direct" if characteristics.directness_score > 0.7 else "diplomatic" if characteristics.directness_score < 0.3 else "balanced"
        warmth = "warm" if characteristics.warmth_score > 0.7 else "neutral" if characteristics.warmth_score < 0.3 else "professional"
        
        return f"{formality} and {directness} communication style with {warmth} tone"
    
    def _get_preferred_greeting_style(self, characteristics: StyleCharacteristics) -> str:
        """Get preferred greeting style"""
        if characteristics.preferred_greetings:
            most_common = Counter(characteristics.preferred_greetings).most_common(1)[0][0]
            return most_common.lower()
        
        return "professional" if characteristics.formality_score > 0.6 else "casual"
    
    def _get_preferred_closing_style(self, characteristics: StyleCharacteristics) -> str:
        """Get preferred closing style"""
        if characteristics.preferred_closings:
            most_common = Counter(characteristics.preferred_closings).most_common(1)[0][0]
            return most_common.lower()
        
        return "professional" if characteristics.formality_score > 0.6 else "casual"
    
    def _get_typical_length_preference(self, characteristics: StyleCharacteristics) -> str:
        """Get typical email length preference"""
        if characteristics.avg_sentence_length > 20:
            return "detailed"
        elif characteristics.avg_sentence_length < 10:
            return "brief"
        else:
            return "standard"
    
    def _get_context_adaptations(self, context_key: str) -> Dict[str, Any]:
        """Get adaptations for specific context"""
        if context_key in self.current_profile.context_adaptations:
            return asdict(self.current_profile.context_adaptations[context_key])
        return {}
    
    def _get_contextual_adjustments(self, context: CommunicationContext) -> Dict[str, str]:
        """Get suggested adjustments based on context"""
        adjustments = {}
        
        # Formality adjustments
        if context.relationship_level == "formal":
            adjustments["formality"] = "increase"
        elif context.relationship_level == "casual":
            adjustments["formality"] = "decrease"
        
        # Urgency adjustments
        if context.urgency_level == "high":
            adjustments["directness"] = "increase"
            adjustments["length"] = "brief"
        
        # Recipient type adjustments
        if context.recipient_type == "client":
            adjustments["professionalism"] = "increase"
        elif context.recipient_type == "colleague":
            adjustments["warmth"] = "increase"
        
        return adjustments
    
    def _infer_recipient_type(self, email_context: Any) -> str:
        """Infer recipient type from email context"""
        # Simple heuristics - in production this would be more sophisticated
        sender = getattr(email_context, 'sender', '').lower()
        
        if any(word in sender for word in ['client', 'customer', 'external']):
            return "client"
        elif any(word in sender for word in ['manager', 'director', 'ceo']):
            return "manager"
        elif any(word in sender for word in ['team', 'colleague']):
            return "colleague"
        else:
            return "unknown"
    
    def _infer_relationship_level(self, email_context: Any) -> str:
        """Infer relationship level from email context"""
        classification = getattr(email_context, 'classification', '')
        
        if classification in ['APPROVAL_REQUIRED']:
            return "formal"
        elif classification in ['FYI_ONLY']:
            return "professional"
        else:
            return "professional"
    
    def _infer_email_type(self, email_context: Any) -> str:
        """Infer email type from email context"""
        classification = getattr(email_context, 'classification', '')
        
        mapping = {
            'NEEDS_REPLY': 'reply',
            'APPROVAL_REQUIRED': 'approval',
            'DELEGATE': 'delegation',
            'CREATE_TASK': 'request',
            'FYI_ONLY': 'update',
            'FOLLOW_UP': 'follow_up'
        }
        
        return mapping.get(classification, 'general')
    
    def _analyze_corrections(self, original: str, corrected: str) -> Dict[str, Any]:
        """Analyze differences between original and corrected drafts"""
        # Simple diff analysis - in production would use more sophisticated NLP
        
        original_words = set(original.lower().split())
        corrected_words = set(corrected.lower().split())
        
        added_words = corrected_words - original_words
        removed_words = original_words - corrected_words
        
        # Analyze length changes
        length_change = len(corrected.split()) - len(original.split())
        
        # Analyze formality changes
        original_formality = self._get_formality_from_content(original)
        corrected_formality = self._get_formality_from_content(corrected)
        formality_change = corrected_formality - original_formality
        
        return {
            "added_words": list(added_words),
            "removed_words": list(removed_words),
            "length_change": length_change,
            "formality_change": formality_change,
            "correction_patterns": self._identify_correction_patterns(original, corrected)
        }
    
    def _identify_correction_patterns(self, original: str, corrected: str) -> List[str]:
        """Identify common correction patterns"""
        patterns = []
        
        # Check for greeting changes
        orig_greeting = self._extract_greeting_style(original)
        corr_greeting = self._extract_greeting_style(corrected)
        if orig_greeting != corr_greeting:
            patterns.append(f"greeting_change:{orig_greeting}_to_{corr_greeting}")
        
        # Check for closing changes
        orig_closing = self._extract_closing_style(original)
        corr_closing = self._extract_closing_style(corrected)
        if orig_closing != corr_closing:
            patterns.append(f"closing_change:{orig_closing}_to_{corr_closing}")
        
        # Check for length adjustments
        if len(corrected.split()) > len(original.split()) * 1.2:
            patterns.append("length_increase")
        elif len(corrected.split()) < len(original.split()) * 0.8:
            patterns.append("length_decrease")
        
        return patterns
    
    async def _apply_correction_learning(self, correction_analysis: Dict, context: CommunicationContext):
        """Apply learning from user corrections"""
        
        # Update preferences based on corrections
        if correction_analysis["formality_change"] > 0.2:
            self.current_profile.characteristics.formality_score += 0.1
        elif correction_analysis["formality_change"] < -0.2:
            self.current_profile.characteristics.formality_score -= 0.1
        
        # Learn from correction patterns
        for pattern in correction_analysis["correction_patterns"]:
            if "greeting_change" in pattern:
                # Update greeting preferences
                new_greeting = pattern.split("_to_")[-1]
                if new_greeting not in self.current_profile.characteristics.preferred_greetings:
                    self.current_profile.characteristics.preferred_greetings.append(new_greeting)
        
        # Save updated profile
        self.current_profile.version += 1
        self._save_profile(self.current_profile)

# Export main class
__all__ = ['StyleLearner', 'StyleCharacteristics', 'CommunicationContext', 'StyleProfile']