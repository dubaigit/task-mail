#!/usr/bin/env python3
"""
Natural Language Refinement Processor
====================================

Advanced natural language processing system for interpreting and executing
user refinement instructions on AI-generated drafts.

Features:
- Natural language instruction parsing and intent recognition
- Context-aware refinement execution
- Multiple refinement strategies (rule-based and AI-powered)
- Instruction validation and suggestion
- Batch refinement operations
- Refinement history and rollback capabilities
- Learning from user preferences and patterns
"""

import os
import re
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict
from enum import Enum
import unicodedata

try:
    import requests
    from difflib import SequenceMatcher
except ImportError as e:
    print(f"Warning: Some dependencies not available: {e}")

class RefinementType(Enum):
    """Types of refinement operations"""
    TONE_ADJUSTMENT = "tone_adjustment"
    LENGTH_MODIFICATION = "length_modification"
    CONTENT_ADDITION = "content_addition"
    CONTENT_REMOVAL = "content_removal"
    STRUCTURE_CHANGE = "structure_change"
    FORMALITY_CHANGE = "formality_change"
    URGENCY_ADJUSTMENT = "urgency_adjustment"
    STYLE_MODIFICATION = "style_modification"
    GRAMMAR_CORRECTION = "grammar_correction"
    VOCABULARY_CHANGE = "vocabulary_change"

class RefinementStrategy(Enum):
    """Refinement execution strategies"""
    RULE_BASED = "rule_based"
    AI_POWERED = "ai_powered"
    HYBRID = "hybrid"
    TEMPLATE_BASED = "template_based"

@dataclass
class RefinementInstruction:
    """Parsed refinement instruction"""
    original_text: str
    intent: RefinementType
    confidence: float
    parameters: Dict[str, Any]
    target_sections: List[str]
    strategy: RefinementStrategy
    priority: int = 1
    
@dataclass
class RefinementPlan:
    """Complete refinement execution plan"""
    instructions: List[RefinementInstruction]
    execution_order: List[int]
    estimated_difficulty: float
    use_ai: bool
    fallback_strategy: RefinementStrategy
    validation_checks: List[str]

@dataclass
class RefinementResult:
    """Result of refinement operation"""
    success: bool
    refined_content: str
    changes_made: List[str]
    confidence: float
    execution_time: float
    strategy_used: RefinementStrategy
    original_instruction: str
    metadata: Dict[str, Any]

class RefinementProcessor:
    """
    Advanced natural language processor for interpreting and executing
    draft refinement instructions.
    """
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.logger = self._setup_logging()
        
        # AI model configuration
        self.api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_APIKEY")
        self.refinement_model = "gpt-5-mini-2025-08-07"
        
        # Intent recognition patterns
        self.intent_patterns = self._load_intent_patterns()
        
        # Refinement rules and strategies
        self.refinement_rules = self._load_refinement_rules()
        
        # Performance tracking
        self.metrics = {
            "instructions_processed": 0,
            "success_rate": 0.0,
            "avg_confidence": 0.0,
            "strategy_usage": defaultdict(int)
        }
        
        self.logger.info("Refinement processor initialized")
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging for refinement processor"""
        logger = logging.getLogger("RefinementProcessor")
        logger.setLevel(logging.INFO)
        
        if not logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            logger.addHandler(handler)
        
        return logger
    
    def _load_intent_patterns(self) -> Dict[str, List[Dict]]:
        """Load natural language intent recognition patterns"""
        return {
            "tone_adjustment": [
                {
                    "patterns": [
                        r"\b(make|change|adjust|turn)\s+(.*?\s+)?(more|less|very)\s+(formal|casual|friendly|professional|direct|polite)",
                        r"\b(increase|decrease|add|reduce)\s+(formality|friendliness|directness|politeness)",
                        r"\b(tone\s+down|soften|strengthen|make\s+warmer|make\s+colder)",
                        r"\b(be\s+more|be\s+less|sound\s+more|sound\s+less)\s+(formal|casual|friendly|professional)"
                    ],
                    "intent": RefinementType.TONE_ADJUSTMENT,
                    "confidence": 0.9
                }
            ],
            "length_modification": [
                {
                    "patterns": [
                        r"\b(make|keep|write)\s+(.*?\s+)?(shorter|longer|brief|concise|detailed|elaborate)",
                        r"\b(shorten|lengthen|expand|condense|summarize)",
                        r"\b(add\s+more\s+detail|remove\s+details|be\s+more\s+concise)",
                        r"\b(cut\s+down|trim|expand\s+on)"
                    ],
                    "intent": RefinementType.LENGTH_MODIFICATION,
                    "confidence": 0.95
                }
            ],
            "content_addition": [
                {
                    "patterns": [
                        r"\b(add|include|mention|insert|put\s+in)\s+(.+)",
                        r"\b(also\s+say|also\s+mention|don't\s+forget\s+to\s+mention)",
                        r"\b(please\s+add|need\s+to\s+add|should\s+include)",
                        r"\b(attach|reference|cite|bring\s+up)"
                    ],
                    "intent": RefinementType.CONTENT_ADDITION,
                    "confidence": 0.85
                }
            ],
            "content_removal": [
                {
                    "patterns": [
                        r"\b(remove|delete|take\s+out|eliminate|cut)\s+(.+)",
                        r"\b(don't\s+mention|skip|omit|leave\s+out)",
                        r"\b(get\s+rid\s+of|no\s+need\s+for)"
                    ],
                    "intent": RefinementType.CONTENT_REMOVAL,
                    "confidence": 0.9
                }
            ],
            "urgency_adjustment": [
                {
                    "patterns": [
                        r"\b(add|include|mention)\s+(.*?\s+)?(deadline|urgency|priority|asap|immediately)",
                        r"\b(make\s+it\s+urgent|add\s+urgency|time\s+sensitive)",
                        r"\b(by\s+\w+day|needs?\s+to\s+be\s+done|due\s+date)"
                    ],
                    "intent": RefinementType.URGENCY_ADJUSTMENT,
                    "confidence": 0.8
                }
            ],
            "formality_change": [
                {
                    "patterns": [
                        r"\b(make\s+it\s+more|make\s+it\s+less)\s+(formal|informal|business-like|casual)",
                        r"\b(use\s+formal\s+language|use\s+casual\s+language)",
                        r"\b(be\s+more\s+professional|be\s+more\s+relaxed)"
                    ],
                    "intent": RefinementType.FORMALITY_CHANGE,
                    "confidence": 0.9
                }
            ],
            "structure_change": [
                {
                    "patterns": [
                        r"\b(reorganize|restructure|reorder|rearrange)",
                        r"\b(move\s+.*?\s+to|put\s+.*?\s+first|start\s+with)",
                        r"\b(bullet\s+points|numbered\s+list|paragraphs)"
                    ],
                    "intent": RefinementType.STRUCTURE_CHANGE,
                    "confidence": 0.7
                }
            ]
        }
    
    def _load_refinement_rules(self) -> Dict[str, Dict]:
        """Load refinement execution rules"""
        return {
            "tone_adjustment": {
                "more_formal": {
                    "replacements": {
                        r"\bhi\b": "Dear",
                        r"\bthanks\b": "Thank you",
                        r"\bbye\b": "Best regards",
                        r"\bokay\b": "understood",
                        r"\bgreat\b": "excellent"
                    },
                    "additions": {
                        "greeting": "I hope this email finds you well.",
                        "closing": "I look forward to your response."
                    }
                },
                "less_formal": {
                    "replacements": {
                        r"\bDear\b": "Hi",
                        r"\bThank you very much\b": "Thanks",
                        r"\bBest regards\b": "Best",
                        r"\bI would appreciate\b": "I'd appreciate"
                    }
                },
                "more_friendly": {
                    "additions": {
                        "warmth": ["I hope you're doing well", "Hope you're having a great day"],
                        "enthusiasm": ["Great to hear from you", "Thanks for reaching out"]
                    }
                },
                "more_direct": {
                    "replacements": {
                        r"\bI was wondering if\b": "Please",
                        r"\bIt would be great if\b": "Please",
                        r"\bCould you possibly\b": "Can you",
                        r"\bIf possible\b": ""
                    }
                }
            },
            "length_modification": {
                "shorter": {
                    "actions": ["remove_redundancy", "combine_sentences", "remove_filler_words"],
                    "target_reduction": 0.3
                },
                "longer": {
                    "actions": ["add_context", "expand_points", "add_examples"],
                    "target_expansion": 0.5
                }
            },
            "urgency_adjustment": {
                "add_urgency": {
                    "phrases": [
                        "This is time-sensitive",
                        "Please prioritize this request",
                        "I would appreciate a prompt response",
                        "Due to the urgent nature of this matter"
                    ],
                    "replacements": {
                        r"\bwhen you have time\b": "as soon as possible",
                        r"\bat your convenience\b": "urgently",
                        r"\bwhenever\b": "as soon as possible"
                    }
                }
            }
        }
    
    async def process_instruction(self, 
                                instruction: str, 
                                current_content: str,
                                email_context: Any = None) -> RefinementPlan:
        """
        Process a natural language refinement instruction and create execution plan
        
        Args:
            instruction: Natural language instruction from user
            current_content: Current draft content to be refined
            email_context: Optional email context for better understanding
            
        Returns:
            RefinementPlan with parsed instructions and execution strategy
        """
        
        start_time = datetime.now()
        
        try:
            # Parse instruction to identify intent and parameters
            parsed_instructions = await self._parse_instruction(instruction)
            
            # Validate and enhance instructions
            validated_instructions = await self._validate_instructions(
                parsed_instructions, current_content
            )
            
            # Determine execution strategy
            strategy = await self._determine_strategy(validated_instructions, current_content)
            
            # Create execution plan
            plan = RefinementPlan(
                instructions=validated_instructions,
                execution_order=self._determine_execution_order(validated_instructions),
                estimated_difficulty=self._estimate_difficulty(validated_instructions),
                use_ai=strategy in [RefinementStrategy.AI_POWERED, RefinementStrategy.HYBRID],
                fallback_strategy=RefinementStrategy.RULE_BASED,
                validation_checks=self._get_validation_checks(validated_instructions)
            )
            
            processing_time = (datetime.now() - start_time).total_seconds()
            
            self.logger.info(
                f"Processed instruction '{instruction}' in {processing_time:.2f}s, "
                f"found {len(validated_instructions)} operations"
            )
            
            return plan
            
        except Exception as e:
            self.logger.error(f"Failed to process instruction: {e}")
            
            # Return fallback plan
            return RefinementPlan(
                instructions=[],
                execution_order=[],
                estimated_difficulty=1.0,
                use_ai=False,
                fallback_strategy=RefinementStrategy.RULE_BASED,
                validation_checks=[]
            )
    
    async def execute_refinement(self, 
                               plan: RefinementPlan, 
                               content: str,
                               email_context: Any = None) -> RefinementResult:
        """
        Execute a refinement plan on the given content
        
        Args:
            plan: RefinementPlan to execute
            content: Content to refine
            email_context: Optional email context
            
        Returns:
            RefinementResult with refined content and metadata
        """
        
        start_time = datetime.now()
        
        if not plan.instructions:
            return RefinementResult(
                success=False,
                refined_content=content,
                changes_made=[],
                confidence=0.0,
                execution_time=0.0,
                strategy_used=RefinementStrategy.RULE_BASED,
                original_instruction="",
                metadata={"error": "No valid instructions in plan"}
            )
        
        try:
            refined_content = content
            changes_made = []
            overall_confidence = 0.0
            
            # Execute instructions in order
            for instruction_index in plan.execution_order:
                if instruction_index >= len(plan.instructions):
                    continue
                    
                instruction = plan.instructions[instruction_index]
                
                if plan.use_ai and instruction.strategy == RefinementStrategy.AI_POWERED:
                    result = await self._execute_ai_refinement(
                        instruction, refined_content, email_context
                    )
                else:
                    result = await self._execute_rule_based_refinement(
                        instruction, refined_content
                    )
                
                if result["success"]:
                    refined_content = result["content"]
                    changes_made.extend(result["changes"])
                    overall_confidence = max(overall_confidence, result["confidence"])
            
            # Validate final result
            validation_passed = await self._validate_refinement_result(
                content, refined_content, plan.validation_checks
            )
            
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Update metrics
            self._update_metrics(plan, validation_passed, overall_confidence)
            
            return RefinementResult(
                success=validation_passed and len(changes_made) > 0,
                refined_content=refined_content,
                changes_made=changes_made,
                confidence=overall_confidence,
                execution_time=execution_time,
                strategy_used=plan.instructions[0].strategy if plan.instructions else RefinementStrategy.RULE_BASED,
                original_instruction=plan.instructions[0].original_text if plan.instructions else "",
                metadata={
                    "instructions_executed": len(plan.execution_order),
                    "validation_passed": validation_passed,
                    "difficulty": plan.estimated_difficulty
                }
            )
            
        except Exception as e:
            self.logger.error(f"Refinement execution failed: {e}")
            
            return RefinementResult(
                success=False,
                refined_content=content,
                changes_made=[],
                confidence=0.0,
                execution_time=(datetime.now() - start_time).total_seconds(),
                strategy_used=RefinementStrategy.RULE_BASED,
                original_instruction="",
                metadata={"error": str(e)}
            )
    
    async def _parse_instruction(self, instruction: str) -> List[RefinementInstruction]:
        """Parse natural language instruction into structured commands"""
        
        instruction = instruction.lower().strip()
        parsed_instructions = []
        
        # Try to match against known patterns
        for intent_category, patterns in self.intent_patterns.items():
            for pattern_group in patterns:
                for pattern in pattern_group["patterns"]:
                    match = re.search(pattern, instruction, re.IGNORECASE)
                    if match:
                        # Extract parameters from the match
                        parameters = self._extract_parameters(match, pattern_group["intent"])
                        
                        # Determine target sections
                        target_sections = self._identify_target_sections(instruction, match)
                        
                        # Determine strategy
                        strategy = self._suggest_strategy(pattern_group["intent"], parameters)
                        
                        parsed_instruction = RefinementInstruction(
                            original_text=instruction,
                            intent=pattern_group["intent"],
                            confidence=pattern_group["confidence"],
                            parameters=parameters,
                            target_sections=target_sections,
                            strategy=strategy
                        )
                        
                        parsed_instructions.append(parsed_instruction)
                        break
        
        # If no patterns matched, try AI-based parsing (if available)
        if not parsed_instructions and self.api_key:
            ai_parsed = await self._ai_parse_instruction(instruction)
            if ai_parsed:
                parsed_instructions.extend(ai_parsed)
        
        # Fallback: treat as general content modification
        if not parsed_instructions:
            parsed_instructions.append(RefinementInstruction(
                original_text=instruction,
                intent=RefinementType.CONTENT_ADDITION,
                confidence=0.3,
                parameters={"content": instruction},
                target_sections=["body"],
                strategy=RefinementStrategy.RULE_BASED
            ))
        
        return parsed_instructions
    
    def _extract_parameters(self, match: re.Match, intent: RefinementType) -> Dict[str, Any]:
        """Extract parameters from regex match based on intent"""
        
        parameters = {}
        groups = match.groups()
        
        if intent == RefinementType.TONE_ADJUSTMENT:
            # Look for tone descriptors
            tone_words = ["formal", "casual", "friendly", "professional", "direct", "polite"]
            direction_words = ["more", "less", "very"]
            
            for group in groups:
                if group:
                    for word in tone_words:
                        if word in group.lower():
                            parameters["target_tone"] = word
                    for word in direction_words:
                        if word in group.lower():
                            parameters["direction"] = word
        
        elif intent == RefinementType.LENGTH_MODIFICATION:
            # Look for length descriptors
            length_words = ["shorter", "longer", "brief", "concise", "detailed", "elaborate"]
            
            for group in groups:
                if group:
                    for word in length_words:
                        if word in group.lower():
                            parameters["target_length"] = word
        
        elif intent == RefinementType.CONTENT_ADDITION:
            # Extract content to add
            full_text = match.string
            content_start = match.end()
            if content_start < len(full_text):
                parameters["content"] = full_text[content_start:].strip()
            else:
                # Look for content in the groups
                for group in groups:
                    if group and len(group.strip()) > 3:
                        parameters["content"] = group.strip()
                        break
        
        elif intent == RefinementType.URGENCY_ADJUSTMENT:
            parameters["add_urgency"] = True
            
            # Look for specific deadline information
            deadline_match = re.search(r'\b(by\s+\w+day|due\s+\w+|\d+\s+days?)\b', match.string, re.IGNORECASE)
            if deadline_match:
                parameters["deadline"] = deadline_match.group()
        
        return parameters
    
    def _identify_target_sections(self, instruction: str, match: re.Match) -> List[str]:
        """Identify which sections of the email to target"""
        
        sections = []
        
        # Default to body for most operations
        sections.append("body")
        
        # Check for specific section mentions
        if re.search(r'\b(beginning|start|opening|greeting)\b', instruction, re.IGNORECASE):
            sections.append("greeting")
        
        if re.search(r'\b(end|ending|closing|signature)\b', instruction, re.IGNORECASE):
            sections.append("closing")
        
        if re.search(r'\b(subject|title)\b', instruction, re.IGNORECASE):
            sections.append("subject")
        
        return sections if len(sections) > 1 else ["body"]
    
    def _suggest_strategy(self, intent: RefinementType, parameters: Dict[str, Any]) -> RefinementStrategy:
        """Suggest execution strategy based on intent and complexity"""
        
        # Simple heuristics for strategy selection
        if intent in [RefinementType.TONE_ADJUSTMENT, RefinementType.STYLE_MODIFICATION]:
            return RefinementStrategy.AI_POWERED if self.api_key else RefinementStrategy.RULE_BASED
        
        elif intent in [RefinementType.LENGTH_MODIFICATION, RefinementType.CONTENT_ADDITION]:
            return RefinementStrategy.HYBRID if self.api_key else RefinementStrategy.RULE_BASED
        
        elif intent in [RefinementType.FORMALITY_CHANGE, RefinementType.URGENCY_ADJUSTMENT]:
            return RefinementStrategy.RULE_BASED
        
        else:
            return RefinementStrategy.AI_POWERED if self.api_key else RefinementStrategy.RULE_BASED
    
    async def _ai_parse_instruction(self, instruction: str) -> List[RefinementInstruction]:
        """Use AI to parse complex instructions"""
        
        if not self.api_key:
            return []
        
        system_prompt = """You are an AI assistant that parses email refinement instructions. 
        
Given a natural language instruction for modifying an email draft, identify:
1. The type of modification (tone, length, content, formality, urgency, structure)
2. Specific parameters for the modification
3. Which parts of the email to target (greeting, body, closing)
4. Confidence level (0-1)

Return your analysis as JSON."""
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.refinement_model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Parse this instruction: '{instruction}'"}
                ],
                "temperature": 0.3,
                "max_tokens": 300
            }
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                ai_response = result["choices"][0]["message"]["content"]
                
                # Parse the JSON response
                try:
                    parsed_data = json.loads(ai_response)
                    return self._convert_ai_parse_to_instructions(parsed_data, instruction)
                except json.JSONDecodeError:
                    self.logger.warning("AI parsing returned invalid JSON")
                    return []
            
        except Exception as e:
            self.logger.error(f"AI parsing failed: {e}")
        
        return []
    
    def _convert_ai_parse_to_instructions(self, parsed_data: Dict, original_instruction: str) -> List[RefinementInstruction]:
        """Convert AI parsing result to RefinementInstruction objects"""
        
        instructions = []
        
        # Map AI response to our data structures
        intent_mapping = {
            "tone": RefinementType.TONE_ADJUSTMENT,
            "length": RefinementType.LENGTH_MODIFICATION,
            "content": RefinementType.CONTENT_ADDITION,
            "formality": RefinementType.FORMALITY_CHANGE,
            "urgency": RefinementType.URGENCY_ADJUSTMENT,
            "structure": RefinementType.STRUCTURE_CHANGE
        }
        
        modification_type = parsed_data.get("type", "content")
        intent = intent_mapping.get(modification_type, RefinementType.CONTENT_ADDITION)
        
        instruction = RefinementInstruction(
            original_text=original_instruction,
            intent=intent,
            confidence=parsed_data.get("confidence", 0.5),
            parameters=parsed_data.get("parameters", {}),
            target_sections=parsed_data.get("target_sections", ["body"]),
            strategy=RefinementStrategy.AI_POWERED
        )
        
        instructions.append(instruction)
        return instructions
    
    async def _validate_instructions(self, 
                                   instructions: List[RefinementInstruction], 
                                   content: str) -> List[RefinementInstruction]:
        """Validate and enhance parsed instructions"""
        
        validated = []
        
        for instruction in instructions:
            # Check if instruction is applicable to the content
            if self._is_instruction_applicable(instruction, content):
                # Enhance parameters if needed
                enhanced_instruction = self._enhance_instruction_parameters(instruction, content)
                validated.append(enhanced_instruction)
        
        return validated
    
    def _is_instruction_applicable(self, instruction: RefinementInstruction, content: str) -> bool:
        """Check if instruction can be applied to the content"""
        
        # Basic checks
        if not content or len(content.strip()) < 10:
            return False
        
        # Intent-specific checks
        if instruction.intent == RefinementType.CONTENT_REMOVAL:
            # Check if content to remove exists
            content_to_remove = instruction.parameters.get("content", "")
            return content_to_remove.lower() in content.lower()
        
        elif instruction.intent == RefinementType.LENGTH_MODIFICATION:
            # Check if length modification makes sense
            target_length = instruction.parameters.get("target_length", "")
            current_word_count = len(content.split())
            
            if target_length == "shorter" and current_word_count < 20:
                return False
            elif target_length == "longer" and current_word_count > 500:
                return False
        
        return True
    
    def _enhance_instruction_parameters(self, 
                                      instruction: RefinementInstruction, 
                                      content: str) -> RefinementInstruction:
        """Enhance instruction parameters based on content analysis"""
        
        enhanced_params = instruction.parameters.copy()
        
        # Add context-aware enhancements
        if instruction.intent == RefinementType.TONE_ADJUSTMENT:
            current_tone = self._analyze_current_tone(content)
            enhanced_params["current_tone"] = current_tone
        
        elif instruction.intent == RefinementType.LENGTH_MODIFICATION:
            current_length = len(content.split())
            enhanced_params["current_word_count"] = current_length
            
            # Suggest specific target lengths
            target_length = instruction.parameters.get("target_length", "")
            if target_length == "shorter":
                enhanced_params["target_word_count"] = max(current_length // 2, 20)
            elif target_length == "longer":
                enhanced_params["target_word_count"] = current_length * 2
        
        # Create enhanced instruction
        enhanced_instruction = RefinementInstruction(
            original_text=instruction.original_text,
            intent=instruction.intent,
            confidence=instruction.confidence,
            parameters=enhanced_params,
            target_sections=instruction.target_sections,
            strategy=instruction.strategy,
            priority=instruction.priority
        )
        
        return enhanced_instruction
    
    async def _determine_strategy(self, 
                                instructions: List[RefinementInstruction], 
                                content: str) -> RefinementStrategy:
        """Determine optimal execution strategy"""
        
        if not instructions:
            return RefinementStrategy.RULE_BASED
        
        # Count strategy preferences
        ai_preferred = sum(1 for inst in instructions if inst.strategy == RefinementStrategy.AI_POWERED)
        rule_preferred = sum(1 for inst in instructions if inst.strategy == RefinementStrategy.RULE_BASED)
        
        # Consider complexity
        avg_confidence = sum(inst.confidence for inst in instructions) / len(instructions)
        content_complexity = self._assess_content_complexity(content)
        
        # Decision logic
        if self.api_key and (ai_preferred > rule_preferred or avg_confidence < 0.7 or content_complexity > 0.7):
            return RefinementStrategy.AI_POWERED
        elif self.api_key and ai_preferred > 0:
            return RefinementStrategy.HYBRID
        else:
            return RefinementStrategy.RULE_BASED
    
    def _determine_execution_order(self, instructions: List[RefinementInstruction]) -> List[int]:
        """Determine optimal execution order for instructions"""
        
        if not instructions:
            return []
        
        # Sort by priority and dependency
        indexed_instructions = [(i, inst) for i, inst in enumerate(instructions)]
        
        # Define dependency order (some operations should happen before others)
        order_priority = {
            RefinementType.STRUCTURE_CHANGE: 1,
            RefinementType.CONTENT_ADDITION: 2,
            RefinementType.CONTENT_REMOVAL: 3,
            RefinementType.LENGTH_MODIFICATION: 4,
            RefinementType.TONE_ADJUSTMENT: 5,
            RefinementType.FORMALITY_CHANGE: 6,
            RefinementType.URGENCY_ADJUSTMENT: 7,
            RefinementType.STYLE_MODIFICATION: 8,
            RefinementType.GRAMMAR_CORRECTION: 9,
            RefinementType.VOCABULARY_CHANGE: 10
        }
        
        # Sort by priority, then by confidence
        indexed_instructions.sort(
            key=lambda x: (
                order_priority.get(x[1].intent, 5),
                -x[1].confidence,
                x[1].priority
            )
        )
        
        return [i for i, _ in indexed_instructions]
    
    def _estimate_difficulty(self, instructions: List[RefinementInstruction]) -> float:
        """Estimate difficulty of executing the instruction set"""
        
        if not instructions:
            return 0.0
        
        difficulty_weights = {
            RefinementType.CONTENT_ADDITION: 0.3,
            RefinementType.CONTENT_REMOVAL: 0.4,
            RefinementType.TONE_ADJUSTMENT: 0.7,
            RefinementType.LENGTH_MODIFICATION: 0.5,
            RefinementType.STRUCTURE_CHANGE: 0.9,
            RefinementType.FORMALITY_CHANGE: 0.6,
            RefinementType.URGENCY_ADJUSTMENT: 0.3,
            RefinementType.STYLE_MODIFICATION: 0.8,
            RefinementType.GRAMMAR_CORRECTION: 0.4,
            RefinementType.VOCABULARY_CHANGE: 0.6
        }
        
        total_difficulty = 0.0
        for instruction in instructions:
            base_difficulty = difficulty_weights.get(instruction.intent, 0.5)
            confidence_factor = 1.0 - instruction.confidence  # Lower confidence = higher difficulty
            total_difficulty += base_difficulty * (1.0 + confidence_factor)
        
        return min(1.0, total_difficulty / len(instructions))
    
    def _get_validation_checks(self, instructions: List[RefinementInstruction]) -> List[str]:
        """Get validation checks needed for the instruction set"""
        
        checks = ["length_reasonable", "grammar_check", "tone_consistency"]
        
        for instruction in instructions:
            if instruction.intent == RefinementType.TONE_ADJUSTMENT:
                checks.append("tone_verification")
            elif instruction.intent == RefinementType.FORMALITY_CHANGE:
                checks.append("formality_verification")
            elif instruction.intent == RefinementType.URGENCY_ADJUSTMENT:
                checks.append("urgency_verification")
            elif instruction.intent == RefinementType.STRUCTURE_CHANGE:
                checks.append("structure_verification")
        
        return list(set(checks))  # Remove duplicates
    
    async def _execute_ai_refinement(self, 
                                   instruction: RefinementInstruction, 
                                   content: str,
                                   email_context: Any = None) -> Dict[str, Any]:
        """Execute refinement using AI model"""
        
        if not self.api_key:
            return {"success": False, "content": content, "changes": [], "confidence": 0.0}
        
        # Build refinement prompt
        refinement_prompt = self._build_refinement_prompt(instruction, content, email_context)
        
        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "model": self.refinement_model,
                "messages": [
                    {"role": "system", "content": "You are an expert email editor. Refine the given email according to the specific instruction while maintaining professional quality."},
                    {"role": "user", "content": refinement_prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 800
            }
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                refined_content = result["choices"][0]["message"]["content"].strip()
                
                # Analyze changes made
                changes = self._analyze_changes(content, refined_content)
                
                return {
                    "success": True,
                    "content": refined_content,
                    "changes": changes,
                    "confidence": instruction.confidence * 0.9  # Slight confidence reduction for AI uncertainty
                }
            else:
                self.logger.error(f"AI refinement API error: {response.status_code}")
                return {"success": False, "content": content, "changes": [], "confidence": 0.0}
                
        except Exception as e:
            self.logger.error(f"AI refinement failed: {e}")
            return {"success": False, "content": content, "changes": [], "confidence": 0.0}
    
    async def _execute_rule_based_refinement(self, 
                                           instruction: RefinementInstruction, 
                                           content: str) -> Dict[str, Any]:
        """Execute refinement using rule-based approach"""
        
        refined_content = content
        changes = []
        
        try:
            intent_type = instruction.intent.value
            rules = self.refinement_rules.get(intent_type, {})
            parameters = instruction.parameters
            
            if instruction.intent == RefinementType.TONE_ADJUSTMENT:
                refined_content, tone_changes = self._apply_tone_rules(content, parameters, rules)
                changes.extend(tone_changes)
            
            elif instruction.intent == RefinementType.LENGTH_MODIFICATION:
                refined_content, length_changes = self._apply_length_rules(content, parameters, rules)
                changes.extend(length_changes)
            
            elif instruction.intent == RefinementType.CONTENT_ADDITION:
                refined_content, add_changes = self._apply_content_addition_rules(content, parameters)
                changes.extend(add_changes)
            
            elif instruction.intent == RefinementType.CONTENT_REMOVAL:
                refined_content, remove_changes = self._apply_content_removal_rules(content, parameters)
                changes.extend(remove_changes)
            
            elif instruction.intent == RefinementType.URGENCY_ADJUSTMENT:
                refined_content, urgency_changes = self._apply_urgency_rules(content, parameters, rules)
                changes.extend(urgency_changes)
            
            elif instruction.intent == RefinementType.FORMALITY_CHANGE:
                refined_content, formality_changes = self._apply_formality_rules(content, parameters)
                changes.extend(formality_changes)
            
            return {
                "success": len(changes) > 0,
                "content": refined_content,
                "changes": changes,
                "confidence": instruction.confidence
            }
            
        except Exception as e:
            self.logger.error(f"Rule-based refinement failed: {e}")
            return {"success": False, "content": content, "changes": [], "confidence": 0.0}
    
    def _build_refinement_prompt(self, 
                               instruction: RefinementInstruction, 
                               content: str,
                               email_context: Any = None) -> str:
        """Build prompt for AI refinement"""
        
        context_info = ""
        if email_context:
            context_info = f"""
Email Context:
- Classification: {getattr(email_context, 'classification', 'Unknown')}
- Urgency: {getattr(email_context, 'urgency', 'Unknown')}
- Sender: {getattr(email_context, 'sender', 'Unknown')}
"""
        
        prompt = f"""Please refine the following email according to this specific instruction:

INSTRUCTION: {instruction.original_text}

{context_info}

CURRENT EMAIL:
{content}

REFINEMENT REQUIREMENTS:
- Intent: {instruction.intent.value}
- Parameters: {json.dumps(instruction.parameters)}
- Target sections: {', '.join(instruction.target_sections)}

Please provide the refined email content, maintaining professional email structure and etiquette while precisely following the instruction."""
        
        return prompt
    
    def _apply_tone_rules(self, content: str, parameters: Dict, rules: Dict) -> Tuple[str, List[str]]:
        """Apply tone adjustment rules"""
        
        refined_content = content
        changes = []
        
        target_tone = parameters.get("target_tone", "")
        direction = parameters.get("direction", "more")
        
        tone_key = f"{direction}_{target_tone}" if direction != "very" else f"more_{target_tone}"
        tone_rules = rules.get(tone_key, {})
        
        # Apply replacements
        replacements = tone_rules.get("replacements", {})
        for pattern, replacement in replacements.items():
            old_content = refined_content
            refined_content = re.sub(pattern, replacement, refined_content, flags=re.IGNORECASE)
            if old_content != refined_content:
                changes.append(f"Replaced pattern for {target_tone} tone")
        
        # Apply additions
        additions = tone_rules.get("additions", {})
        for section, addition_text in additions.items():
            if section == "greeting" and not re.search(r'hope.*well', refined_content, re.IGNORECASE):
                # Add after greeting
                refined_content = re.sub(
                    r'(Dear|Hi|Hello)\s+[^,\n]+[,\n]',
                    f'\\g<0>\n\n{addition_text}\n',
                    refined_content
                )
                changes.append(f"Added {section} for {target_tone} tone")
        
        return refined_content, changes
    
    def _apply_length_rules(self, content: str, parameters: Dict, rules: Dict) -> Tuple[str, List[str]]:
        """Apply length modification rules"""
        
        refined_content = content
        changes = []
        
        target_length = parameters.get("target_length", "")
        
        if target_length in ["shorter", "brief", "concise"]:
            # Apply shortening rules
            # Remove redundant phrases
            redundant_patterns = [
                r'\bI hope this email finds you well\.\s*',
                r'\bPlease let me know if you have any questions\.\s*',
                r'\bThank you for your time and consideration\.\s*'
            ]
            
            for pattern in redundant_patterns:
                old_content = refined_content
                refined_content = re.sub(pattern, '', refined_content, flags=re.IGNORECASE)
                if old_content != refined_content:
                    changes.append("Removed redundant phrase for brevity")
            
            # Combine sentences
            refined_content = re.sub(r'\.\s+I\s+', '. I ', refined_content)
            
            changes.append("Applied shortening techniques")
        
        elif target_length in ["longer", "detailed", "elaborate"]:
            # Apply lengthening rules
            # Add contextual phrases
            if not re.search(r'hope.*well', refined_content, re.IGNORECASE):
                refined_content = re.sub(
                    r'(Dear|Hi|Hello)\s+[^,\n]+[,\n]',
                    '\\g<0>\n\nI hope this email finds you well.\n',
                    refined_content
                )
                changes.append("Added greeting context for detail")
            
            if not re.search(r'please let me know', refined_content, re.IGNORECASE):
                refined_content += "\n\nPlease let me know if you need any additional information."
                changes.append("Added closing context for detail")
        
        return refined_content, changes
    
    def _apply_content_addition_rules(self, content: str, parameters: Dict) -> Tuple[str, List[str]]:
        """Apply content addition rules"""
        
        refined_content = content
        changes = []
        
        content_to_add = parameters.get("content", "")
        if content_to_add:
            # Find appropriate insertion point (usually before closing)
            if re.search(r'(Best regards|Sincerely|Thanks)', refined_content, re.IGNORECASE):
                # Insert before closing
                refined_content = re.sub(
                    r'(\n\n)(Best regards|Sincerely|Thanks)',
                    f'\\1{content_to_add}\\1\\2',
                    refined_content,
                    flags=re.IGNORECASE
                )
            else:
                # Append to end
                refined_content += f"\n\n{content_to_add}"
            
            changes.append(f"Added content: {content_to_add[:50]}...")
        
        return refined_content, changes
    
    def _apply_content_removal_rules(self, content: str, parameters: Dict) -> Tuple[str, List[str]]:
        """Apply content removal rules"""
        
        refined_content = content
        changes = []
        
        content_to_remove = parameters.get("content", "")
        if content_to_remove:
            # Remove specified content
            old_content = refined_content
            refined_content = refined_content.replace(content_to_remove, "")
            
            if old_content != refined_content:
                changes.append(f"Removed content: {content_to_remove[:50]}...")
        
        return refined_content, changes
    
    def _apply_urgency_rules(self, content: str, parameters: Dict, rules: Dict) -> Tuple[str, List[str]]:
        """Apply urgency adjustment rules"""
        
        refined_content = content
        changes = []
        
        if parameters.get("add_urgency", False):
            urgency_rules = rules.get("add_urgency", {})
            
            # Add urgency phrases
            urgency_phrases = urgency_rules.get("phrases", [])
            if urgency_phrases:
                urgency_phrase = urgency_phrases[0]  # Use first phrase
                
                # Insert urgency at beginning of body
                refined_content = re.sub(
                    r'(Dear|Hi|Hello)\s+[^,\n]+[,\n]\s*',
                    f'\\g<0>\n{urgency_phrase}\n\n',
                    refined_content
                )
                changes.append("Added urgency indicator")
            
            # Apply urgency replacements
            replacements = urgency_rules.get("replacements", {})
            for pattern, replacement in replacements.items():
                old_content = refined_content
                refined_content = re.sub(pattern, replacement, refined_content, flags=re.IGNORECASE)
                if old_content != refined_content:
                    changes.append("Replaced phrases for urgency")
        
        return refined_content, changes
    
    def _apply_formality_rules(self, content: str, parameters: Dict) -> Tuple[str, List[str]]:
        """Apply formality change rules"""
        
        refined_content = content
        changes = []
        
        target_formality = parameters.get("target_formality", "")
        direction = parameters.get("direction", "more")
        
        if direction == "more" or target_formality == "formal":
            # Make more formal
            formal_replacements = {
                r'\bhi\b': 'Dear',
                r'\bthanks\b': 'Thank you',
                r'\bokay\b': 'understood',
                r'\bbye\b': 'Best regards'
            }
            
            for pattern, replacement in formal_replacements.items():
                old_content = refined_content
                refined_content = re.sub(pattern, replacement, refined_content, flags=re.IGNORECASE)
                if old_content != refined_content:
                    changes.append("Increased formality")
        
        elif direction == "less" or target_formality == "casual":
            # Make less formal
            casual_replacements = {
                r'\bDear\b': 'Hi',
                r'\bThank you very much\b': 'Thanks',
                r'\bBest regards\b': 'Best'
            }
            
            for pattern, replacement in casual_replacements.items():
                old_content = refined_content
                refined_content = re.sub(pattern, replacement, refined_content, flags=re.IGNORECASE)
                if old_content != refined_content:
                    changes.append("Decreased formality")
        
        return refined_content, changes
    
    def _analyze_changes(self, original: str, refined: str) -> List[str]:
        """Analyze changes between original and refined content"""
        
        changes = []
        
        # Basic difference analysis
        if len(refined.split()) > len(original.split()) * 1.1:
            changes.append("Increased content length")
        elif len(refined.split()) < len(original.split()) * 0.9:
            changes.append("Decreased content length")
        
        # Word-level changes
        original_words = set(original.lower().split())
        refined_words = set(refined.lower().split())
        
        added_words = refined_words - original_words
        removed_words = original_words - refined_words
        
        if added_words:
            changes.append(f"Added words: {', '.join(list(added_words)[:5])}")
        
        if removed_words:
            changes.append(f"Removed words: {', '.join(list(removed_words)[:5])}")
        
        # Structure changes
        original_lines = original.split('\n')
        refined_lines = refined.split('\n')
        
        if len(refined_lines) != len(original_lines):
            changes.append("Modified structure/formatting")
        
        return changes
    
    async def _validate_refinement_result(self, 
                                        original: str, 
                                        refined: str, 
                                        validation_checks: List[str]) -> bool:
        """Validate the refinement result"""
        
        # Basic validation
        if not refined or len(refined.strip()) < 10:
            return False
        
        # Length validation
        if "length_reasonable" in validation_checks:
            original_length = len(original.split())
            refined_length = len(refined.split())
            
            # Ensure length change is reasonable (not more than 10x change)
            if refined_length > original_length * 10 or refined_length < original_length * 0.1:
                return False
        
        # Structure validation
        if "structure_verification" in validation_checks:
            # Ensure basic email structure is maintained
            has_greeting = bool(re.search(r'^(Dear|Hi|Hello)', refined.strip(), re.IGNORECASE))
            has_body = len(refined.split('\n')) >= 3
            
            if not (has_greeting and has_body):
                return False
        
        # Tone consistency validation
        if "tone_verification" in validation_checks:
            # Basic tone consistency check
            tone_consistency = self._check_tone_consistency(refined)
            if tone_consistency < 0.5:
                return False
        
        return True
    
    def _check_tone_consistency(self, content: str) -> float:
        """Check tone consistency in content"""
        
        # Simple tone consistency check
        formal_indicators = len(re.findall(r'\b(Dear|Sincerely|Respectfully)\b', content, re.IGNORECASE))
        casual_indicators = len(re.findall(r'\b(Hi|Hey|Thanks|Cool)\b', content, re.IGNORECASE))
        
        total_indicators = formal_indicators + casual_indicators
        
        if total_indicators == 0:
            return 0.7  # Neutral tone is acceptable
        
        # Calculate consistency (higher score if tone is consistent)
        dominant_tone = max(formal_indicators, casual_indicators)
        consistency = dominant_tone / total_indicators
        
        return consistency
    
    def _analyze_current_tone(self, content: str) -> str:
        """Analyze current tone of content"""
        
        formal_score = len(re.findall(r'\b(Dear|Sincerely|Respectfully|Furthermore)\b', content, re.IGNORECASE))
        casual_score = len(re.findall(r'\b(Hi|Hey|Thanks|Cool|Great)\b', content, re.IGNORECASE))
        
        if formal_score > casual_score:
            return "formal"
        elif casual_score > formal_score:
            return "casual"
        else:
            return "neutral"
    
    def _assess_content_complexity(self, content: str) -> float:
        """Assess complexity of content for strategy selection"""
        
        # Simple complexity metrics
        word_count = len(content.split())
        sentence_count = len(re.split(r'[.!?]+', content))
        avg_sentence_length = word_count / max(1, sentence_count)
        
        # Complex words (>6 characters)
        complex_words = len([w for w in content.split() if len(w) > 6])
        complexity_ratio = complex_words / max(1, word_count)
        
        # Combine metrics (normalized 0-1)
        length_factor = min(1.0, word_count / 500)  # 500+ words = complex
        sentence_factor = min(1.0, avg_sentence_length / 25)  # 25+ words/sentence = complex
        vocabulary_factor = complexity_ratio * 2  # Scale vocabulary complexity
        
        return (length_factor + sentence_factor + vocabulary_factor) / 3
    
    def _update_metrics(self, plan: RefinementPlan, success: bool, confidence: float):
        """Update performance metrics"""
        
        self.metrics["instructions_processed"] += 1
        
        # Update success rate
        current_successes = self.metrics["success_rate"] * (self.metrics["instructions_processed"] - 1)
        new_successes = current_successes + (1 if success else 0)
        self.metrics["success_rate"] = new_successes / self.metrics["instructions_processed"]
        
        # Update average confidence
        current_avg = self.metrics["avg_confidence"]
        self.metrics["avg_confidence"] = (
            (current_avg * (self.metrics["instructions_processed"] - 1) + confidence) /
            self.metrics["instructions_processed"]
        )
        
        # Update strategy usage
        if plan.instructions:
            strategy = plan.instructions[0].strategy.value
            self.metrics["strategy_usage"][strategy] += 1
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get current performance metrics"""
        return dict(self.metrics)

# Helper imports for defaultdict
from collections import defaultdict

# Export main class
__all__ = ['RefinementProcessor', 'RefinementInstruction', 'RefinementPlan', 'RefinementResult', 'RefinementType', 'RefinementStrategy']