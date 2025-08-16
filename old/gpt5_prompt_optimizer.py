#!/usr/bin/env python3
"""
GPT-5 Prompt Optimizer
======================

Advanced prompt engineering for GPT-5 models with:
- Few-shot learning examples
- Structured output templates
- Context window optimization
- Prompt injection protection
- Dynamic prompt selection based on email type
"""

import json
import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import hashlib

class PromptType(Enum):
    """Different prompt strategies based on use case"""
    CLASSIFICATION = "classification"
    TASK_EXTRACTION = "task_extraction"
    DRAFT_GENERATION = "draft_generation"
    SUMMARIZATION = "summarization"
    SENTIMENT_ANALYSIS = "sentiment_analysis"
    KEY_POINTS = "key_points"
    ACTION_ITEMS = "action_items"

@dataclass
class PromptTemplate:
    """Structured prompt template with metadata"""
    type: PromptType
    system_prompt: str
    user_prompt_template: str
    few_shot_examples: List[Dict[str, Any]]
    output_schema: Dict[str, Any]
    max_tokens: int
    temperature: float
    version: str
    
class GPT5PromptOptimizer:
    """
    Advanced prompt optimization for GPT-5 models.
    Implements best practices for production scale systems.
    """
    
    def __init__(self):
        self.templates = self._load_prompt_templates()
        self.few_shot_cache = {}
        self.prompt_history = []
        self.MAX_CONTEXT_TOKENS = 8000  # GPT-5 nano context limit
        self.SAFETY_MARGIN = 500  # Reserve tokens for response
        
    def _load_prompt_templates(self) -> Dict[PromptType, PromptTemplate]:
        """Load optimized prompt templates for each use case"""
        
        templates = {
            PromptType.CLASSIFICATION: PromptTemplate(
                type=PromptType.CLASSIFICATION,
                system_prompt="""You are an expert email classification system optimized for executive workflows.

CLASSIFICATION CATEGORIES:
- REPLY: Requires direct response from recipient
- NO_REPLY: Information only, no response needed
- TASK: Contains actionable tasks to complete
- DELEGATE: Should be delegated to team member
- FYI_ONLY: For information only
- APPROVAL: Requires approval or sign-off
- FOLLOW_UP: Needs follow-up action
- URGENT: Requires immediate attention

ANALYSIS REQUIREMENTS:
1. Analyze sender intent and email context
2. Identify key action items and deadlines
3. Assess urgency and priority level
4. Extract decision points
5. Provide confidence score (0.0-1.0)

OUTPUT FORMAT:
Return ONLY valid JSON matching the schema. No additional text.""",
                
                user_prompt_template="""Analyze this email and classify it:

Subject: {subject}
From: {sender}
Date: {date}
Body: {body}

{few_shot_context}

Classification:""",
                
                few_shot_examples=[
                    {
                        "input": {
                            "subject": "Q4 Budget Approval Required",
                            "sender": "cfo@company.com",
                            "body": "Please review and approve the attached Q4 budget by EOD Friday."
                        },
                        "output": {
                            "classification": "APPROVAL",
                            "confidence": 0.95,
                            "intent": "Requesting budget approval with deadline",
                            "summary": "CFO requests Q4 budget approval by EOD Friday",
                            "action_items": ["Review Q4 budget", "Provide approval by EOD Friday"],
                            "reply_type": "approval_confirmation",
                            "reasoning": "Contains explicit approval request with clear deadline"
                        }
                    },
                    {
                        "input": {
                            "subject": "FYI: Server maintenance this weekend",
                            "sender": "it@company.com",
                            "body": "Servers will be down for maintenance Saturday 2-4 AM. No action required."
                        },
                        "output": {
                            "classification": "FYI_ONLY",
                            "confidence": 0.92,
                            "intent": "Informing about scheduled maintenance",
                            "summary": "IT announces server maintenance Saturday 2-4 AM",
                            "action_items": [],
                            "reply_type": "no_reply_needed",
                            "reasoning": "Explicitly states no action required, purely informational"
                        }
                    },
                    {
                        "input": {
                            "subject": "Can you handle the client presentation?",
                            "sender": "manager@company.com",
                            "body": "I'm double-booked Thursday. Can you take over the 3 PM client presentation?"
                        },
                        "output": {
                            "classification": "DELEGATE",
                            "confidence": 0.88,
                            "intent": "Requesting coverage for client presentation",
                            "summary": "Manager needs coverage for Thursday 3 PM client presentation",
                            "action_items": ["Confirm availability for Thursday 3 PM", "Prepare for client presentation"],
                            "reply_type": "confirmation_required",
                            "reasoning": "Request to take over responsibility, requires confirmation"
                        }
                    }
                ],
                
                output_schema={
                    "type": "object",
                    "properties": {
                        "classification": {
                            "type": "string",
                            "enum": ["REPLY", "NO_REPLY", "TASK", "DELEGATE", "FYI_ONLY", "APPROVAL", "FOLLOW_UP", "URGENT"]
                        },
                        "confidence": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 1
                        },
                        "intent": {"type": "string"},
                        "summary": {"type": "string"},
                        "action_items": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "reply_type": {
                            "type": "string",
                            "enum": ["quick_confirm", "detailed_response", "delegate", "schedule_meeting", "request_info", "approval_confirmation", "no_reply_needed", "confirmation_required"]
                        },
                        "reasoning": {"type": "string"}
                    },
                    "required": ["classification", "confidence", "intent", "summary", "action_items", "reply_type", "reasoning"]
                },
                
                max_tokens=400,
                temperature=0.1,
                version="1.0.0"
            ),
            
            PromptType.TASK_EXTRACTION: PromptTemplate(
                type=PromptType.TASK_EXTRACTION,
                system_prompt="""You are an expert task extraction system. Extract actionable tasks with complete context.

TASK PRIORITIES:
- CRITICAL: Must be done immediately/today
- HIGH: This week
- MEDIUM: Next 2 weeks  
- LOW: When possible

EXTRACTION RULES:
1. Only extract concrete, actionable tasks
2. Include context and rationale
3. Identify dependencies between tasks
4. Estimate time requirements when possible
5. Assign to specific people if mentioned

Return ONLY valid JSON matching the schema.""",
                
                user_prompt_template="""Extract all actionable tasks from this email:

{email_content}

{few_shot_context}

Tasks:""",
                
                few_shot_examples=[
                    {
                        "input": "Please review the contract, get legal approval, and send to the client by Friday. John from legal should prioritize this.",
                        "output": {
                            "tasks": [
                                {
                                    "description": "Review contract document",
                                    "priority": "HIGH",
                                    "deadline": "This week",
                                    "assignee": null,
                                    "estimated_hours": 1.0,
                                    "dependencies": [],
                                    "context": "Initial review before legal approval"
                                },
                                {
                                    "description": "Get legal approval for contract",
                                    "priority": "HIGH",
                                    "deadline": "Before Friday",
                                    "assignee": "John from legal",
                                    "estimated_hours": 2.0,
                                    "dependencies": ["Review contract document"],
                                    "context": "Legal review required before client submission"
                                },
                                {
                                    "description": "Send approved contract to client",
                                    "priority": "HIGH",
                                    "deadline": "Friday",
                                    "assignee": null,
                                    "estimated_hours": 0.5,
                                    "dependencies": ["Get legal approval for contract"],
                                    "context": "Final step after legal approval"
                                }
                            ]
                        }
                    }
                ],
                
                output_schema={
                    "type": "object",
                    "properties": {
                        "tasks": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "description": {"type": "string"},
                                    "priority": {
                                        "type": "string",
                                        "enum": ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
                                    },
                                    "deadline": {"type": ["string", "null"]},
                                    "assignee": {"type": ["string", "null"]},
                                    "estimated_hours": {"type": ["number", "null"]},
                                    "dependencies": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    },
                                    "context": {"type": "string"}
                                },
                                "required": ["description", "priority", "context"]
                            }
                        }
                    },
                    "required": ["tasks"]
                },
                
                max_tokens=600,
                temperature=0.1,
                version="1.0.0"
            ),
            
            PromptType.DRAFT_GENERATION: PromptTemplate(
                type=PromptType.DRAFT_GENERATION,
                system_prompt="""You are an executive assistant drafting professional email responses.

WRITING STYLE:
- Professional yet warm tone
- Concise and direct (3-7 sentences)
- Action-oriented language
- Clear next steps

STRUCTURE:
1. Greeting: "{greeting_prefix} {name},"
2. Acknowledgment/Opening
3. Main response addressing key points
4. Next steps or closing
5. Sign-off: "{signature}"

TONE VARIATIONS:
- Approval: Confident, decisive
- Delegation: Clear expectations, supportive
- Information request: Specific, polite
- Urgent response: Immediate acknowledgment, timeline

Generate natural, contextually appropriate responses.""",
                
                user_prompt_template="""Draft a response to this email:

Original Email:
Subject: {subject}
From: {sender}
Body: {body}

Context:
- Classification: {classification}
- Key Points: {key_points}
- Action Items: {action_items}
- Urgency: {urgency}
- User Name: {user_name}
- Greeting Style: {greeting_prefix}
- Signature: {signature}

{few_shot_context}

Draft Response:""",
                
                few_shot_examples=[
                    {
                        "input": {
                            "subject": "Project timeline concerns",
                            "sender": "Sarah Johnson <sarah@company.com>",
                            "body": "I'm worried about meeting the Q1 deadline with current resources.",
                            "classification": "REPLY",
                            "urgency": "HIGH"
                        },
                        "output": "D Sarah,\n\nThanks for flagging this concern. Let's discuss resource allocation in tomorrow's standup to ensure we stay on track for Q1.\n\nI'll review the project plan beforehand and come with specific recommendations.\n\nRegards Abdullah"
                    }
                ],
                
                output_schema={
                    "type": "object",
                    "properties": {
                        "draft": {"type": "string"},
                        "tone": {"type": "string"},
                        "key_points_addressed": {
                            "type": "array",
                            "items": {"type": "string"}
                        }
                    },
                    "required": ["draft"]
                },
                
                max_tokens=500,
                temperature=0.3,
                version="1.0.0"
            ),
            
            PromptType.KEY_POINTS: PromptTemplate(
                type=PromptType.KEY_POINTS,
                system_prompt="""Extract the 3-5 most important key points from emails. Focus on:
- Action items
- Decisions needed
- Important information
- Deadlines
- Problems/concerns

Be specific and concise. Return JSON only.""",
                
                user_prompt_template="""Extract key points from:

{content}

Key points:""",
                
                few_shot_examples=[],
                
                output_schema={
                    "type": "object",
                    "properties": {
                        "key_points": {
                            "type": "array",
                            "items": {"type": "string"},
                            "minItems": 1,
                            "maxItems": 5
                        }
                    },
                    "required": ["key_points"]
                },
                
                max_tokens=200,
                temperature=0.1,
                version="1.0.0"
            )
        }
        
        return templates
    
    def optimize_prompt(
        self,
        prompt_type: PromptType,
        context: Dict[str, Any],
        include_few_shot: bool = True,
        dynamic_examples: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Generate optimized prompt for GPT-5 with context management.
        
        Args:
            prompt_type: Type of prompt to generate
            context: Context data for the prompt
            include_few_shot: Whether to include few-shot examples
            dynamic_examples: Additional examples based on recent corrections
            
        Returns:
            Optimized prompt configuration for API call
        """
        
        template = self.templates.get(prompt_type)
        if not template:
            raise ValueError(f"Unknown prompt type: {prompt_type}")
        
        # Build few-shot context
        few_shot_context = ""
        if include_few_shot:
            few_shot_context = self._build_few_shot_context(
                template.few_shot_examples,
                dynamic_examples
            )
        
        # Add few-shot context to user context
        context['few_shot_context'] = few_shot_context
        
        # Fill user prompt template
        user_prompt = self._safe_format(template.user_prompt_template, context)
        
        # Optimize for context window
        user_prompt = self._optimize_context_window(user_prompt, template.max_tokens)
        
        # Protect against prompt injection
        user_prompt = self._sanitize_prompt(user_prompt)
        
        # Build final configuration
        config = {
            "messages": [
                {"role": "system", "content": template.system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": template.temperature,
            "max_tokens": template.max_tokens,
            "response_format": {"type": "json_object"},
            "metadata": {
                "prompt_type": prompt_type.value,
                "template_version": template.version,
                "context_size": len(user_prompt),
                "few_shot_included": include_few_shot
            }
        }
        
        # Track prompt for analysis
        self._track_prompt(prompt_type, config)
        
        return config
    
    def _build_few_shot_context(
        self,
        static_examples: List[Dict],
        dynamic_examples: Optional[List[Dict]] = None
    ) -> str:
        """Build few-shot learning context from examples"""
        
        examples = []
        
        # Add static examples
        for example in static_examples[:2]:  # Limit to 2 static examples
            examples.append(self._format_example(example))
        
        # Add dynamic examples from learning
        if dynamic_examples:
            for example in dynamic_examples[:1]:  # Add 1 dynamic example
                examples.append(self._format_example(example))
        
        if not examples:
            return ""
        
        return "\n\nEXAMPLES:\n" + "\n---\n".join(examples)
    
    def _format_example(self, example: Dict) -> str:
        """Format a single example for few-shot learning"""
        
        input_str = json.dumps(example.get("input", {}), indent=2)
        output_str = json.dumps(example.get("output", {}), indent=2)
        
        return f"Input:\n{input_str}\n\nOutput:\n{output_str}"
    
    def _optimize_context_window(self, prompt: str, max_response_tokens: int) -> str:
        """Optimize prompt to fit within context window"""
        
        # Rough token estimation (1 token ≈ 4 characters)
        estimated_tokens = len(prompt) // 4
        available_tokens = self.MAX_CONTEXT_TOKENS - max_response_tokens - self.SAFETY_MARGIN
        
        if estimated_tokens <= available_tokens:
            return prompt
        
        # Truncate intelligently
        lines = prompt.split('\n')
        
        # Priority: Keep structure, truncate content
        if 'Body:' in prompt:
            # Find and truncate email body
            for i, line in enumerate(lines):
                if line.startswith('Body:'):
                    # Calculate how much to keep
                    chars_to_keep = (available_tokens * 4) - len('\n'.join(lines[:i+1]))
                    if i + 1 < len(lines):
                        body_content = '\n'.join(lines[i+1:])
                        truncated_body = body_content[:chars_to_keep] + "...[truncated]"
                        lines = lines[:i+1] + [truncated_body]
                    break
        
        truncated = '\n'.join(lines)
        
        # Final check
        if len(truncated) // 4 > available_tokens:
            # Hard truncate as last resort
            max_chars = available_tokens * 4
            truncated = truncated[:max_chars] + "...[truncated]"
        
        return truncated
    
    def _sanitize_prompt(self, prompt: str) -> str:
        """Sanitize prompt to prevent injection attacks"""
        
        # Remove potential command injections
        dangerous_patterns = [
            r'```[a-z]*\n',  # Code blocks
            r'<script.*?>.*?</script>',  # Scripts
            r'system:',  # System role attempts
            r'assistant:',  # Assistant role attempts
            r'\{\{.*?\}\}',  # Template injections
            r'<\|.*?\|>',  # Special tokens
        ]
        
        sanitized = prompt
        for pattern in dangerous_patterns:
            sanitized = re.sub(pattern, '', sanitized, flags=re.IGNORECASE | re.DOTALL)
        
        # Escape special characters that might affect JSON
        sanitized = sanitized.replace('\\', '\\\\')
        sanitized = sanitized.replace('\x00', '')  # Remove null bytes
        
        # Limit consecutive newlines
        sanitized = re.sub(r'\n{3,}', '\n\n', sanitized)
        
        return sanitized
    
    def _safe_format(self, template: str, context: Dict[str, Any]) -> str:
        """Safely format template with context, handling missing keys"""
        
        # Create a safe context with defaults
        safe_context = {
            'subject': '',
            'sender': '',
            'body': '',
            'date': '',
            'classification': '',
            'key_points': [],
            'action_items': [],
            'urgency': '',
            'user_name': 'User',
            'greeting_prefix': 'Hello',
            'signature': 'Best regards',
            'few_shot_context': ''
        }
        
        # Update with provided context
        safe_context.update(context)
        
        # Convert lists to strings for formatting
        if isinstance(safe_context.get('key_points'), list):
            safe_context['key_points'] = ', '.join(safe_context['key_points'])
        if isinstance(safe_context.get('action_items'), list):
            safe_context['action_items'] = ', '.join(safe_context['action_items'])
        
        try:
            return template.format(**safe_context)
        except KeyError as e:
            # Log missing key and use template as-is
            print(f"Warning: Missing template key {e}")
            return template
    
    def _track_prompt(self, prompt_type: PromptType, config: Dict):
        """Track prompts for analysis and optimization"""
        
        tracking_data = {
            "timestamp": json.dumps({"timestamp": "2024-01-01T00:00:00Z"}),
            "type": prompt_type.value,
            "config_hash": hashlib.md5(
                json.dumps(config, sort_keys=True).encode()
            ).hexdigest(),
            "token_estimate": len(config["messages"][1]["content"]) // 4
        }
        
        self.prompt_history.append(tracking_data)
        
        # Keep only last 100 prompts
        if len(self.prompt_history) > 100:
            self.prompt_history = self.prompt_history[-100:]
    
    def get_prompt_stats(self) -> Dict[str, Any]:
        """Get statistics about prompt usage"""
        
        if not self.prompt_history:
            return {"total_prompts": 0}
        
        stats = {
            "total_prompts": len(self.prompt_history),
            "by_type": {},
            "avg_token_estimate": 0
        }
        
        type_counts = {}
        total_tokens = 0
        
        for entry in self.prompt_history:
            prompt_type = entry["type"]
            type_counts[prompt_type] = type_counts.get(prompt_type, 0) + 1
            total_tokens += entry["token_estimate"]
        
        stats["by_type"] = type_counts
        stats["avg_token_estimate"] = total_tokens / len(self.prompt_history) if self.prompt_history else 0
        
        return stats
    
    def validate_response(self, response: str, prompt_type: PromptType) -> Tuple[bool, Optional[Dict]]:
        """
        Validate that response matches expected schema.
        
        Returns:
            Tuple of (is_valid, parsed_response or None)
        """
        
        template = self.templates.get(prompt_type)
        if not template:
            return False, None
        
        try:
            # Parse JSON response
            parsed = json.loads(response)
            
            # Validate against schema
            required_fields = template.output_schema.get("required", [])
            properties = template.output_schema.get("properties", {})
            
            # Check required fields
            for field in required_fields:
                if field not in parsed:
                    return False, None
            
            # Validate field types
            for field, schema in properties.items():
                if field in parsed:
                    value = parsed[field]
                    expected_type = schema.get("type")
                    
                    if expected_type == "string" and not isinstance(value, str):
                        return False, None
                    elif expected_type == "number" and not isinstance(value, (int, float)):
                        return False, None
                    elif expected_type == "array" and not isinstance(value, list):
                        return False, None
                    elif expected_type == "object" and not isinstance(value, dict):
                        return False, None
                    
                    # Check enum values
                    if "enum" in schema and value not in schema["enum"]:
                        return False, None
            
            return True, parsed
            
        except json.JSONDecodeError:
            return False, None
    
    def update_few_shot_examples(
        self,
        prompt_type: PromptType,
        new_example: Dict[str, Any]
    ):
        """Add new few-shot example based on user corrections"""
        
        cache_key = f"{prompt_type.value}_dynamic"
        
        if cache_key not in self.few_shot_cache:
            self.few_shot_cache[cache_key] = []
        
        # Add new example
        self.few_shot_cache[cache_key].append(new_example)
        
        # Keep only recent examples (last 10)
        self.few_shot_cache[cache_key] = self.few_shot_cache[cache_key][-10:]


# Export prompt templates for external use
def get_prompt_templates() -> Dict[str, Any]:
    """Export prompt templates as JSON for storage/versioning"""
    
    optimizer = GPT5PromptOptimizer()
    templates = {}
    
    for prompt_type, template in optimizer.templates.items():
        templates[prompt_type.value] = {
            "system_prompt": template.system_prompt,
            "user_prompt_template": template.user_prompt_template,
            "few_shot_examples": template.few_shot_examples,
            "output_schema": template.output_schema,
            "max_tokens": template.max_tokens,
            "temperature": template.temperature,
            "version": template.version
        }
    
    return templates


if __name__ == "__main__":
    # Test the optimizer
    optimizer = GPT5PromptOptimizer()
    
    # Test classification prompt
    context = {
        "subject": "Urgent: Budget approval needed",
        "sender": "john@company.com",
        "body": "Please approve the Q4 marketing budget of $50,000 by EOD.",
        "date": "2024-01-15"
    }
    
    config = optimizer.optimize_prompt(PromptType.CLASSIFICATION, context)
    
    print("Classification Prompt Configuration:")
    print(json.dumps(config["metadata"], indent=2))
    print("\nSystem Prompt Length:", len(config["messages"][0]["content"]))
    print("User Prompt Length:", len(config["messages"][1]["content"]))
    
    # Get stats
    stats = optimizer.get_prompt_stats()
    print("\nPrompt Statistics:")
    print(json.dumps(stats, indent=2))