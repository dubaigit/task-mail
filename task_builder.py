#!/usr/bin/env python3
"""
Intelligent Task Builder System

Advanced task extraction, categorization, and prioritization system for email intelligence.
Converts email content into structured, actionable tasks with smart priority detection,
deadline analysis, and assignee recommendations.
"""

import re
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict
from enum import Enum
import sqlite3
from collections import defaultdict

# NLP and date parsing
from dateutil import parser as date_parser
import dateutil.relativedelta as relativedelta

class TaskPriority(Enum):
    """Task priority levels"""
    CRITICAL = "CRITICAL"  # Urgent with tight deadline
    HIGH = "HIGH"         # Important, time-sensitive
    MEDIUM = "MEDIUM"     # Normal priority
    LOW = "LOW"           # Can be delayed
    DEFERRED = "DEFERRED" # Postponed

class TaskCategory(Enum):
    """Task categories for organization"""
    APPROVAL = "APPROVAL"
    DEVELOPMENT = "DEVELOPMENT"  
    REVIEW = "REVIEW"
    MEETING = "MEETING"
    COMMUNICATION = "COMMUNICATION"
    RESEARCH = "RESEARCH"
    ADMINISTRATIVE = "ADMINISTRATIVE"
    STRATEGIC = "STRATEGIC"
    OPERATIONAL = "OPERATIONAL"

class TaskStatus(Enum):
    """Task status tracking"""
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    BLOCKED = "BLOCKED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

@dataclass
class TaskDeadline:
    """Task deadline with context"""
    date: datetime
    type: str  # 'hard', 'soft', 'estimated'
    source_text: str
    confidence: float = 0.0

@dataclass
class TaskAssignee:
    """Task assignee information"""
    name: str
    email: Optional[str] = None
    role: Optional[str] = None
    confidence: float = 0.0
    reasoning: Optional[str] = None

@dataclass
class TaskDependency:
    """Task dependency tracking"""
    depends_on: str  # Task ID or description
    type: str  # 'blocks', 'requires', 'follows'
    critical: bool = False

@dataclass
class IntelligentTask:
    """Comprehensive task representation"""
    id: str
    title: str
    description: str
    category: TaskCategory
    priority: TaskPriority
    status: TaskStatus = TaskStatus.PENDING
    
    # Timing
    deadline: Optional[TaskDeadline] = None
    estimated_duration: Optional[timedelta] = None
    created_at: datetime = None
    
    # Assignment
    assignee: Optional[TaskAssignee] = None
    requester: Optional[str] = None
    
    # Context
    source_email_hash: Optional[str] = None
    context: Dict[str, Any] = None
    keywords: List[str] = None
    
    # Relationships
    dependencies: List[TaskDependency] = None
    related_tasks: List[str] = None
    
    # Metadata
    confidence_score: float = 0.0
    extraction_method: str = "pattern"  # 'pattern', 'ai', 'hybrid'
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.context is None:
            self.context = {}
        if self.keywords is None:
            self.keywords = []
        if self.dependencies is None:
            self.dependencies = []
        if self.related_tasks is None:
            self.related_tasks = []

class IntelligentTaskBuilder:
    """
    Advanced task extraction and building system.
    
    Features:
    - Multi-pattern task extraction
    - Smart priority calculation
    - Deadline parsing and validation
    - Assignee detection and recommendation
    - Task categorization
    - Dependency analysis
    - Context preservation
    """
    
    def __init__(self, config: Optional[Dict] = None):
        """Initialize the task builder"""
        self.logger = logging.getLogger(__name__)
        self.config = self._load_config(config)
        self._initialize_patterns()
        self._initialize_database()
        
        # Task tracking
        self.task_counter = 0
        self.active_tasks: Dict[str, IntelligentTask] = {}
        
    def _load_config(self, config: Optional[Dict]) -> Dict:
        """Load task builder configuration"""
        default_config = {
            'database_path': 'task_builder.db',
            'priority_weights': {
                'urgency_keywords': 0.3,
                'deadline_proximity': 0.4,
                'requester_importance': 0.2,
                'complexity': 0.1
            },
            'deadline_parsing': {
                'default_time': '17:00',  # 5 PM
                'business_hours': (9, 17),
                'weekend_adjustment': True
            },
            'assignee_detection': {
                'department_keywords': {
                    'development': ['dev', 'development', 'engineering', 'code', 'technical'],
                    'design': ['design', 'ui', 'ux', 'visual', 'creative'],
                    'marketing': ['marketing', 'promotion', 'campaign', 'social'],
                    'finance': ['budget', 'finance', 'accounting', 'cost', 'payment'],
                    'legal': ['legal', 'contract', 'compliance', 'terms'],
                    'hr': ['hr', 'human resources', 'hiring', 'recruitment']
                }
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
    
    def _initialize_patterns(self):
        """Initialize extraction patterns"""
        
        # Task extraction patterns with confidence scores
        self.task_patterns = [
            # Direct action requests
            (r'please\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.9, TaskCategory.COMMUNICATION),
            (r'need\s+(?:you\s+)?to\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.85, TaskCategory.OPERATIONAL),
            (r'can\s+you\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.8, TaskCategory.COMMUNICATION),
            (r'should\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.75, TaskCategory.OPERATIONAL),
            (r'must\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.9, TaskCategory.OPERATIONAL),
            
            # Approval tasks
            (r'(?:need|require)s?\s+(?:your\s+)?(?:approval|authorization|sign-?off)\s+(?:for|on)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.95, TaskCategory.APPROVAL),
            (r'please\s+(?:approve|authorize|sign-?off)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.9, TaskCategory.APPROVAL),
            
            # Review tasks
            (r'(?:please\s+)?(?:review|check|examine|look\s+at)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.85, TaskCategory.REVIEW),
            (r'feedback\s+(?:needed\s+)?(?:on|for)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.8, TaskCategory.REVIEW),
            
            # Development tasks
            (r'(?:develop|create|build|implement)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.85, TaskCategory.DEVELOPMENT),
            (r'(?:fix|debug|resolve)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.9, TaskCategory.DEVELOPMENT),
            
            # Meeting/Communication tasks
            (r'(?:schedule|arrange|set\s+up)\s+(?:a\s+)?(?:meeting|call|discussion)\s+(?:about|for|regarding)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.85, TaskCategory.MEETING),
            (r'(?:discuss|talk\s+about)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.7, TaskCategory.COMMUNICATION),
            
            # Research tasks
            (r'(?:research|investigate|explore|analyze)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.8, TaskCategory.RESEARCH),
            (r'find\s+out\s+(?:about\s+)?((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.75, TaskCategory.RESEARCH),
            
            # Administrative tasks
            (r'(?:update|maintain|organize)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.7, TaskCategory.ADMINISTRATIVE),
            (r'(?:prepare|draft|write)\s+((?:[^.!?]|\.(?!\s*[A-Z]))*)', 0.75, TaskCategory.ADMINISTRATIVE),
        ]
        
        # Priority indicators
        self.priority_indicators = {
            TaskPriority.CRITICAL: [
                'urgent', 'asap', 'immediately', 'emergency', 'critical', 'crisis',
                'fire', 'blocker', 'blocking', 'deadline today', 'due today'
            ],
            TaskPriority.HIGH: [
                'important', 'priority', 'soon', 'this week', 'high priority',
                'time sensitive', 'deadline this week', 'by friday'
            ],
            TaskPriority.MEDIUM: [
                'when you can', 'at your convenience', 'next week', 'medium priority',
                'normal priority', 'standard'
            ],
            TaskPriority.LOW: [
                'no rush', 'low priority', 'whenever', 'eventually', 'someday',
                'nice to have', 'future consideration'
            ]
        }
        
        # Deadline patterns with types
        self.deadline_patterns = [
            # Specific dates/times
            (r'(?:by|due|before|deadline)\s+(?:is\s+)?([A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?)', 'hard', 0.9),
            (r'(?:by|due|before)\s+(\d{1,2}[/:]\d{1,2}(?:[/:]\d{2,4})?)', 'hard', 0.85),
            
            # Relative dates  
            (r'(?:by|due|before|deadline)\s+(today|tomorrow|this\s+week|next\s+week)', 'hard', 0.9),
            (r'(?:by|due|before)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)', 'hard', 0.85),
            (r'(?:by|due|before)\s+(?:end\s+of\s+)?(?:this\s+)?(week|month|quarter|year)', 'soft', 0.8),
            
            # Time-based
            (r'(?:by|due|before)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))', 'hard', 0.85),
            (r'(?:within|in)\s+(\d+\s+(?:hours?|days?|weeks?))', 'soft', 0.75),
            
            # Contextual
            (r'asap', 'hard', 0.9),
            (r'urgent', 'soft', 0.7),
        ]
        
        # Assignee patterns
        self.assignee_patterns = [
            (r'(?:assign|delegate|give)\s+(?:this\s+)?(?:to\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', 0.9),
            (r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:can|should|will|needs?\s+to)\s+', 0.8),
            (r'(?:have|ask|tell)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:to\s+)?', 0.85),
            (r'(?:cc|@)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', 0.7),
        ]
        
        # Department/role patterns
        self.department_patterns = [
            (r'(?:dev|development|engineering)\s+team', 'development'),
            (r'(?:design|ui/ux)\s+team', 'design'),
            (r'(?:marketing|pr)\s+team', 'marketing'),
            (r'(?:finance|accounting)\s+team', 'finance'),
            (r'(?:legal|compliance)\s+team', 'legal'),
            (r'(?:hr|human\s+resources)\s+team', 'hr'),
            (r'(?:ops|operations)\s+team', 'operations'),
        ]

    def _initialize_database(self):
        """Initialize SQLite database for task storage"""
        self.db_path = self.config['database_path']
        
        with sqlite3.connect(self.db_path) as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    category TEXT,
                    priority TEXT,
                    status TEXT,
                    deadline_date TEXT,
                    deadline_type TEXT,
                    assignee_name TEXT,
                    assignee_email TEXT,
                    requester TEXT,
                    source_email_hash TEXT,
                    context TEXT,
                    keywords TEXT,
                    confidence_score REAL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                
                CREATE TABLE IF NOT EXISTS task_dependencies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT,
                    depends_on TEXT,
                    dependency_type TEXT,
                    critical BOOLEAN,
                    FOREIGN KEY (task_id) REFERENCES tasks (id)
                );
                
                CREATE TABLE IF NOT EXISTS task_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id TEXT,
                    action TEXT,
                    old_value TEXT,
                    new_value TEXT,
                    changed_by TEXT,
                    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (task_id) REFERENCES tasks (id)
                );
                
                CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
                CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
                CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline_date);
                CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_name);
            """)

    def extract_tasks_from_email(self, subject: str, body: str, sender: str,
                                email_hash: Optional[str] = None,
                                metadata: Optional[Dict] = None) -> List[IntelligentTask]:
        """
        Extract intelligent tasks from email content.
        
        Args:
            subject: Email subject line
            body: Email body content  
            sender: Email sender
            email_hash: Unique email identifier
            metadata: Additional email metadata
            
        Returns:
            List of IntelligentTask objects
        """
        full_text = f"{subject}\n\n{body}"
        tasks = []
        
        # Extract raw tasks using patterns
        raw_tasks = self._extract_raw_tasks(full_text)
        
        for raw_task in raw_tasks:
            # Build comprehensive task
            task = self._build_intelligent_task(
                raw_task, full_text, sender, email_hash, metadata
            )
            
            if task:
                tasks.append(task)
        
        # Post-process tasks
        tasks = self._post_process_tasks(tasks, full_text)
        
        # Store in database
        for task in tasks:
            self._store_task(task)
        
        self.logger.info(f"Extracted {len(tasks)} tasks from email")
        return tasks

    def _extract_raw_tasks(self, text: str) -> List[Dict]:
        """Extract raw task candidates using pattern matching"""
        raw_tasks = []
        text_lower = text.lower()
        
        for pattern, confidence, category in self.task_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE)
            
            for match in matches:
                task_text = match.group(1).strip()
                
                # Filter out very short or generic matches
                if len(task_text) < 5 or self._is_generic_match(task_text):
                    continue
                
                raw_tasks.append({
                    'text': task_text,
                    'full_match': match.group(0),
                    'confidence': confidence,
                    'category': category,
                    'start': match.start(),
                    'end': match.end()
                })
        
        # Remove duplicates and overlapping matches
        return self._deduplicate_raw_tasks(raw_tasks)

    def _is_generic_match(self, text: str) -> bool:
        """Check if match is too generic to be a useful task"""
        generic_patterns = [
            r'^(it|this|that|the|a|an)$',
            r'^(me|you|us|them)$',
            r'^(help|work|thing|stuff|item)$',
            r'^\w{1,3}$',  # Very short words
        ]
        
        text_lower = text.lower().strip()
        
        for pattern in generic_patterns:
            if re.match(pattern, text_lower):
                return True
        
        return False

    def _deduplicate_raw_tasks(self, raw_tasks: List[Dict]) -> List[Dict]:
        """Remove duplicate and overlapping raw tasks"""
        # Sort by position in text
        sorted_tasks = sorted(raw_tasks, key=lambda x: x['start'])
        
        deduplicated = []
        for task in sorted_tasks:
            # Check for overlaps with existing tasks
            overlaps = False
            for existing in deduplicated:
                if (task['start'] < existing['end'] and task['end'] > existing['start']):
                    # Keep the one with higher confidence
                    if task['confidence'] > existing['confidence']:
                        deduplicated.remove(existing)
                        deduplicated.append(task)
                    overlaps = True
                    break
            
            if not overlaps:
                deduplicated.append(task)
        
        return deduplicated

    def _build_intelligent_task(self, raw_task: Dict, full_text: str, 
                               sender: str, email_hash: Optional[str],
                               metadata: Optional[Dict]) -> Optional[IntelligentTask]:
        """Build a comprehensive IntelligentTask from raw extraction"""
        
        try:
            # Generate task ID
            self.task_counter += 1
            task_id = f"TASK-{datetime.now().strftime('%Y%m%d')}-{self.task_counter:04d}"
            
            # Build title and description
            title = self._generate_task_title(raw_task['text'])
            description = self._generate_task_description(raw_task, full_text)
            
            # Determine priority
            priority = self._calculate_task_priority(raw_task, full_text, sender)
            
            # Extract deadline
            deadline = self._extract_task_deadline(raw_task, full_text)
            
            # Detect assignee
            assignee = self._detect_assignee(raw_task, full_text, sender)
            
            # Extract keywords
            keywords = self._extract_keywords(raw_task['text'])
            
            # Estimate duration
            estimated_duration = self._estimate_task_duration(raw_task)
            
            # Build context
            context = {
                'source_text': raw_task['full_match'],
                'extraction_confidence': raw_task['confidence'],
                'text_position': (raw_task['start'], raw_task['end']),
                'email_metadata': metadata or {}
            }
            
            # Create task
            task = IntelligentTask(
                id=task_id,
                title=title,
                description=description,
                category=raw_task['category'],
                priority=priority,
                deadline=deadline,
                estimated_duration=estimated_duration,
                assignee=assignee,
                requester=sender,
                source_email_hash=email_hash,
                context=context,
                keywords=keywords,
                confidence_score=raw_task['confidence']
            )
            
            return task
            
        except Exception as e:
            self.logger.error(f"Failed to build task from raw extraction: {e}")
            return None

    def _generate_task_title(self, task_text: str) -> str:
        """Generate a concise task title"""
        # Clean up text
        title = task_text.strip()
        
        # Remove common prefixes
        prefixes_to_remove = [
            r'^(?:please\s+)?(?:can\s+you\s+)?',
            r'^(?:need\s+(?:you\s+)?to\s+)?',
            r'^(?:should\s+)?',
        ]
        
        for prefix in prefixes_to_remove:
            title = re.sub(prefix, '', title, flags=re.IGNORECASE)
        
        # Capitalize first letter
        title = title.strip()
        if title:
            title = title[0].upper() + title[1:]
        
        # Limit length
        if len(title) > 100:
            title = title[:97] + "..."
        
        return title

    def _generate_task_description(self, raw_task: Dict, full_text: str) -> str:
        """Generate detailed task description with context"""
        description_parts = []
        
        # Main task text
        description_parts.append(f"Task: {raw_task['text']}")
        
        # Add surrounding context (±50 characters)
        context_start = max(0, raw_task['start'] - 50)
        context_end = min(len(full_text), raw_task['end'] + 50)
        context = full_text[context_start:context_end].strip()
        
        if context != raw_task['text']:
            description_parts.append(f"Context: ...{context}...")
        
        # Add category and confidence info
        description_parts.append(f"Category: {raw_task['category'].value}")
        description_parts.append(f"Extraction confidence: {raw_task['confidence']:.2f}")
        
        return "\n\n".join(description_parts)

    def _calculate_task_priority(self, raw_task: Dict, full_text: str, 
                                sender: str) -> TaskPriority:
        """Calculate intelligent task priority"""
        priority_score = 0.0
        weights = self.config['priority_weights']
        
        full_text_lower = full_text.lower()
        task_text_lower = raw_task['text'].lower()
        
        # 1. Urgency keywords
        urgency_score = 0.0
        for priority, keywords in self.priority_indicators.items():
            for keyword in keywords:
                if keyword in task_text_lower or keyword in full_text_lower:
                    if priority == TaskPriority.CRITICAL:
                        urgency_score = max(urgency_score, 1.0)
                    elif priority == TaskPriority.HIGH:
                        urgency_score = max(urgency_score, 0.8)
                    elif priority == TaskPriority.MEDIUM:
                        urgency_score = max(urgency_score, 0.5)
                    elif priority == TaskPriority.LOW:
                        urgency_score = max(urgency_score, 0.2)
        
        priority_score += urgency_score * weights['urgency_keywords']
        
        # 2. Deadline proximity (if deadline found)
        deadline_score = 0.0
        deadline_match = self._find_deadline_in_text(full_text)
        if deadline_match:
            # Simple heuristic: closer deadlines = higher priority
            if 'today' in deadline_match or 'asap' in deadline_match:
                deadline_score = 1.0
            elif 'tomorrow' in deadline_match or 'this week' in deadline_match:
                deadline_score = 0.8
            elif 'next week' in deadline_match:
                deadline_score = 0.6
            else:
                deadline_score = 0.4
        
        priority_score += deadline_score * weights['deadline_proximity']
        
        # 3. Requester importance (simplified - could use directory lookup)
        requester_score = 0.5  # Default
        if 'ceo' in sender.lower() or 'president' in sender.lower():
            requester_score = 1.0
        elif 'manager' in sender.lower() or 'director' in sender.lower():
            requester_score = 0.8
        
        priority_score += requester_score * weights['requester_importance']
        
        # 4. Task complexity (length and category-based)
        complexity_score = 0.0
        if raw_task['category'] in [TaskCategory.APPROVAL, TaskCategory.STRATEGIC]:
            complexity_score = 0.8
        elif raw_task['category'] in [TaskCategory.DEVELOPMENT, TaskCategory.RESEARCH]:
            complexity_score = 0.7
        else:
            complexity_score = 0.5
        
        # Adjust by text length (longer = more complex)
        if len(raw_task['text']) > 100:
            complexity_score += 0.2
        
        priority_score += complexity_score * weights['complexity']
        
        # Map score to priority enum
        if priority_score >= 0.8:
            return TaskPriority.CRITICAL
        elif priority_score >= 0.6:
            return TaskPriority.HIGH
        elif priority_score >= 0.4:
            return TaskPriority.MEDIUM
        else:
            return TaskPriority.LOW

    def _extract_task_deadline(self, raw_task: Dict, full_text: str) -> Optional[TaskDeadline]:
        """Extract and parse task deadlines"""
        # Look for deadline patterns around the task
        task_area = full_text[max(0, raw_task['start']-100):raw_task['end']+100]
        
        for pattern, deadline_type, confidence in self.deadline_patterns:
            match = re.search(pattern, task_area, re.IGNORECASE)
            if match:
                deadline_text = match.group(1) if match.groups() else match.group(0)
                parsed_date = self._parse_deadline_text(deadline_text)
                
                if parsed_date:
                    return TaskDeadline(
                        date=parsed_date,
                        type=deadline_type,
                        source_text=match.group(0),
                        confidence=confidence
                    )
        
        return None

    def _parse_deadline_text(self, deadline_text: str) -> Optional[datetime]:
        """Parse deadline text into datetime object"""
        deadline_text = deadline_text.lower().strip()
        now = datetime.now()
        
        # Handle relative dates
        if deadline_text == 'today':
            return now.replace(hour=17, minute=0, second=0, microsecond=0)
        elif deadline_text == 'tomorrow':
            return (now + timedelta(days=1)).replace(hour=17, minute=0, second=0, microsecond=0)
        elif deadline_text == 'this week':
            # End of this week (Friday)
            days_until_friday = (4 - now.weekday()) % 7
            if days_until_friday == 0:  # Today is Friday
                days_until_friday = 7
            return (now + timedelta(days=days_until_friday)).replace(hour=17, minute=0, second=0, microsecond=0)
        elif deadline_text == 'next week':
            # End of next week
            days_until_next_friday = 7 - now.weekday() + 4
            return (now + timedelta(days=days_until_next_friday)).replace(hour=17, minute=0, second=0, microsecond=0)
        
        # Handle day names
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        for i, day in enumerate(days):
            if day in deadline_text:
                days_ahead = (i - now.weekday()) % 7
                if days_ahead == 0:  # Today
                    days_ahead = 7  # Next week
                target_date = now + timedelta(days=days_ahead)
                return target_date.replace(hour=17, minute=0, second=0, microsecond=0)
        
        # Try to parse with dateutil
        try:
            # Common date formats
            for fmt in ['%m/%d/%Y', '%m-%d-%Y', '%Y-%m-%d', '%B %d', '%b %d']:
                try:
                    parsed = datetime.strptime(deadline_text, fmt)
                    # If no year specified, assume current year
                    if parsed.year == 1900:  # Default year for strptime
                        parsed = parsed.replace(year=now.year)
                    return parsed
                except ValueError:
                    continue
            
            # Use dateutil as last resort
            return date_parser.parse(deadline_text, default=now)
        except:
            return None

    def _detect_assignee(self, raw_task: Dict, full_text: str, 
                        sender: str) -> Optional[TaskAssignee]:
        """Detect who should be assigned to the task"""
        
        # Look for explicit assignee mentions
        task_area = full_text[max(0, raw_task['start']-100):raw_task['end']+100]
        
        for pattern, confidence in self.assignee_patterns:
            match = re.search(pattern, task_area, re.IGNORECASE)
            if match:
                assignee_name = match.group(1).strip()
                return TaskAssignee(
                    name=assignee_name,
                    confidence=confidence,
                    reasoning=f"Explicitly mentioned: '{match.group(0)}'"
                )
        
        # Look for department/team mentions
        for pattern, department in self.department_patterns:
            if re.search(pattern, task_area, re.IGNORECASE):
                return TaskAssignee(
                    name=f"{department.title()} Team",
                    role=department,
                    confidence=0.7,
                    reasoning=f"Department mentioned: {department}"
                )
        
        # Suggest based on task category
        category_assignments = {
            TaskCategory.DEVELOPMENT: "Development Team",
            TaskCategory.REVIEW: "Review Team", 
            TaskCategory.APPROVAL: "Approval Authority",
            TaskCategory.RESEARCH: "Research Team",
            TaskCategory.ADMINISTRATIVE: "Admin Team"
        }
        
        if raw_task['category'] in category_assignments:
            return TaskAssignee(
                name=category_assignments[raw_task['category']],
                confidence=0.5,
                reasoning=f"Suggested based on category: {raw_task['category'].value}"
            )
        
        return None

    def _extract_keywords(self, task_text: str) -> List[str]:
        """Extract keywords from task text"""
        # Simple keyword extraction (could be enhanced with NLP)
        keywords = []
        
        # Remove common words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'}
        
        words = re.findall(r'\b\w{3,}\b', task_text.lower())
        keywords = [word for word in words if word not in stop_words]
        
        # Keep only unique keywords, max 10
        return list(dict.fromkeys(keywords))[:10]

    def _estimate_task_duration(self, raw_task: Dict) -> Optional[timedelta]:
        """Estimate task duration based on category and complexity"""
        
        # Base durations by category (in hours)
        base_durations = {
            TaskCategory.APPROVAL: 0.5,
            TaskCategory.REVIEW: 2.0,
            TaskCategory.COMMUNICATION: 1.0,
            TaskCategory.ADMINISTRATIVE: 1.5,
            TaskCategory.RESEARCH: 4.0,
            TaskCategory.DEVELOPMENT: 8.0,
            TaskCategory.STRATEGIC: 6.0,
            TaskCategory.OPERATIONAL: 3.0,
            TaskCategory.MEETING: 1.0
        }
        
        base_hours = base_durations.get(raw_task['category'], 2.0)
        
        # Adjust based on text length (rough complexity indicator)
        text_length = len(raw_task['text'])
        if text_length > 200:
            multiplier = 2.0
        elif text_length > 100:
            multiplier = 1.5
        elif text_length < 30:
            multiplier = 0.5
        else:
            multiplier = 1.0
        
        estimated_hours = base_hours * multiplier
        return timedelta(hours=estimated_hours)

    def _find_deadline_in_text(self, text: str) -> Optional[str]:
        """Find any deadline mentions in text"""
        for pattern, _, _ in self.deadline_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0).lower()
        return None

    def _post_process_tasks(self, tasks: List[IntelligentTask], 
                           full_text: str) -> List[IntelligentTask]:
        """Post-process extracted tasks for quality and relationships"""
        
        # Remove very similar tasks
        deduplicated_tasks = self._remove_similar_tasks(tasks)
        
        # Add task relationships
        for task in deduplicated_tasks:
            task.related_tasks = self._find_related_tasks(task, deduplicated_tasks)
            task.dependencies = self._detect_dependencies(task, full_text)
        
        return deduplicated_tasks

    def _remove_similar_tasks(self, tasks: List[IntelligentTask]) -> List[IntelligentTask]:
        """Remove tasks that are too similar"""
        unique_tasks = []
        
        for task in tasks:
            is_similar = False
            for existing in unique_tasks:
                # Simple similarity check based on title words
                task_words = set(task.title.lower().split())
                existing_words = set(existing.title.lower().split())
                overlap = len(task_words & existing_words)
                total = len(task_words | existing_words)
                
                if total > 0 and overlap / total > 0.7:
                    # Keep the one with higher confidence
                    if task.confidence_score > existing.confidence_score:
                        unique_tasks.remove(existing)
                        unique_tasks.append(task)
                    is_similar = True
                    break
            
            if not is_similar:
                unique_tasks.append(task)
        
        return unique_tasks

    def _find_related_tasks(self, current_task: IntelligentTask, 
                           all_tasks: List[IntelligentTask]) -> List[str]:
        """Find tasks related to the current task"""
        related = []
        current_keywords = set(current_task.keywords)
        
        for task in all_tasks:
            if task.id == current_task.id:
                continue
            
            # Check keyword overlap
            task_keywords = set(task.keywords)
            overlap = len(current_keywords & task_keywords)
            
            if overlap >= 2:  # At least 2 common keywords
                related.append(task.id)
        
        return related[:5]  # Limit to top 5 related tasks

    def _detect_dependencies(self, task: IntelligentTask, 
                           full_text: str) -> List[TaskDependency]:
        """Detect task dependencies"""
        dependencies = []
        
        # Look for dependency keywords around the task
        dependency_patterns = [
            (r'(?:after|once|when)\s+([^.!?]+)', 'follows'),
            (r'(?:requires?|needs?|depends?\s+on)\s+([^.!?]+)', 'requires'),
            (r'(?:blocks?|blocking|prevented\s+by)\s+([^.!?]+)', 'blocks'),
        ]
        
        task_context = task.context.get('source_text', '')
        
        for pattern, dep_type in dependency_patterns:
            matches = re.finditer(pattern, task_context, re.IGNORECASE)
            for match in matches:
                dependency_text = match.group(1).strip()
                dependencies.append(TaskDependency(
                    depends_on=dependency_text,
                    type=dep_type,
                    critical=(dep_type == 'blocks')
                ))
        
        return dependencies

    def _store_task(self, task: IntelligentTask):
        """Store task in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Store main task
                cursor.execute("""
                    INSERT OR REPLACE INTO tasks 
                    (id, title, description, category, priority, status, 
                     deadline_date, deadline_type, assignee_name, assignee_email,
                     requester, source_email_hash, context, keywords, confidence_score)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    task.id,
                    task.title,
                    task.description,
                    task.category.value,
                    task.priority.value,
                    task.status.value,
                    task.deadline.date.isoformat() if task.deadline else None,
                    task.deadline.type if task.deadline else None,
                    task.assignee.name if task.assignee else None,
                    task.assignee.email if task.assignee else None,
                    task.requester,
                    task.source_email_hash,
                    json.dumps(task.context),
                    json.dumps(task.keywords),
                    task.confidence_score
                ))
                
                # Store dependencies
                for dep in task.dependencies:
                    cursor.execute("""
                        INSERT INTO task_dependencies (task_id, depends_on, dependency_type, critical)
                        VALUES (?, ?, ?, ?)
                    """, (task.id, dep.depends_on, dep.type, dep.critical))
                
                # Store in active tasks
                self.active_tasks[task.id] = task
                
        except Exception as e:
            self.logger.error(f"Failed to store task {task.id}: {e}")

    def get_tasks_by_priority(self, priority: TaskPriority) -> List[IntelligentTask]:
        """Get tasks filtered by priority"""
        return [task for task in self.active_tasks.values() if task.priority == priority]

    def get_tasks_by_deadline(self, days_ahead: int = 7) -> List[IntelligentTask]:
        """Get tasks due within specified days"""
        cutoff_date = datetime.now() + timedelta(days=days_ahead)
        
        return [
            task for task in self.active_tasks.values()
            if task.deadline and task.deadline.date <= cutoff_date
        ]

    def get_overdue_tasks(self) -> List[IntelligentTask]:
        """Get overdue tasks"""
        now = datetime.now()
        
        return [
            task for task in self.active_tasks.values()
            if (task.deadline and task.deadline.date < now and 
                task.status != TaskStatus.COMPLETED)
        ]

    def update_task_status(self, task_id: str, new_status: TaskStatus, 
                          updated_by: str = "system"):
        """Update task status with history tracking"""
        if task_id in self.active_tasks:
            task = self.active_tasks[task_id]
            old_status = task.status
            task.status = new_status
            
            # Update in database
            try:
                with sqlite3.connect(self.db_path) as conn:
                    cursor = conn.cursor()
                    
                    # Update task
                    cursor.execute(
                        "UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (new_status.value, task_id)
                    )
                    
                    # Log history
                    cursor.execute("""
                        INSERT INTO task_history (task_id, action, old_value, new_value, changed_by)
                        VALUES (?, ?, ?, ?, ?)
                    """, (task_id, 'status_change', old_status.value, new_status.value, updated_by))
                    
                    self.logger.info(f"Updated task {task_id} status: {old_status.value} → {new_status.value}")
                    
            except Exception as e:
                self.logger.error(f"Failed to update task status: {e}")

    def get_task_summary_report(self) -> Dict[str, Any]:
        """Generate comprehensive task summary report"""
        tasks = list(self.active_tasks.values())
        
        # Status distribution
        status_counts = defaultdict(int)
        for task in tasks:
            status_counts[task.status.value] += 1
        
        # Priority distribution  
        priority_counts = defaultdict(int)
        for task in tasks:
            priority_counts[task.priority.value] += 1
        
        # Category distribution
        category_counts = defaultdict(int)
        for task in tasks:
            category_counts[task.category.value] += 1
        
        # Deadline analysis
        overdue_count = len(self.get_overdue_tasks())
        due_soon_count = len(self.get_tasks_by_deadline(3))  # Due in 3 days
        
        # Assignee distribution
        assignee_counts = defaultdict(int)
        for task in tasks:
            assignee = task.assignee.name if task.assignee else "Unassigned"
            assignee_counts[assignee] += 1
        
        return {
            'total_tasks': len(tasks),
            'status_distribution': dict(status_counts),
            'priority_distribution': dict(priority_counts),
            'category_distribution': dict(category_counts),
            'deadline_analysis': {
                'overdue': overdue_count,
                'due_within_3_days': due_soon_count,
            },
            'assignee_distribution': dict(assignee_counts),
            'high_priority_tasks': len([t for t in tasks if t.priority == TaskPriority.CRITICAL]),
            'avg_confidence_score': sum(t.confidence_score for t in tasks) / len(tasks) if tasks else 0
        }


def main():
    """Demo the intelligent task builder"""
    builder = IntelligentTaskBuilder()
    
    # Test email content
    test_subject = "Project Review and Budget Approval Needed"
    test_body = """
    Hi Abdullah,

    I need your help with a few urgent items:

    1. Please review the Q4 project proposal by Friday - it's critical for our timeline
    2. Can you approve the marketing budget of $50,000 for the new campaign? 
    3. We need to schedule a meeting with the development team to discuss the API integration
    4. The legal team should review the new vendor contracts before we proceed

    Also, Sarah mentioned that the design team needs feedback on the UI mockups by tomorrow.

    Thanks!
    Mike
    """
    
    print("Intelligent Task Builder Demo")
    print("=" * 50)
    
    # Extract tasks
    tasks = builder.extract_tasks_from_email(
        subject=test_subject,
        body=test_body,
        sender="mike.johnson@company.com",
        email_hash="test-email-123"
    )
    
    print(f"\nExtracted {len(tasks)} tasks:\n")
    
    for task in tasks:
        print(f"Task ID: {task.id}")
        print(f"Title: {task.title}")
        print(f"Category: {task.category.value}")
        print(f"Priority: {task.priority.value}")
        print(f"Confidence: {task.confidence_score:.2f}")
        
        if task.deadline:
            print(f"Deadline: {task.deadline.date.strftime('%Y-%m-%d %H:%M')} ({task.deadline.type})")
        
        if task.assignee:
            print(f"Assignee: {task.assignee.name} (confidence: {task.assignee.confidence:.2f})")
        
        if task.keywords:
            print(f"Keywords: {', '.join(task.keywords)}")
        
        print(f"Description: {task.description}")
        print("-" * 40)
    
    # Generate summary report
    print("\nTask Summary Report:")
    report = builder.get_task_summary_report()
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()