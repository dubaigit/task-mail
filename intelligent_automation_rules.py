#!/usr/bin/env python3
"""
Intelligent Automation Rules Engine

Advanced rule-based automation system that learns from user behavior and
email patterns to create intelligent automation rules for:
- Smart email categorization
- Automated action suggestions
- Predictive routing and prioritization
- Context-aware workflow automation
"""

import asyncio
import logging
import json
import hashlib
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Set
from dataclasses import dataclass, asdict, field
from enum import Enum
from collections import defaultdict, Counter
import re

# Setup logging
logger = logging.getLogger(__name__)

class RuleType(Enum):
    """Types of automation rules"""
    CATEGORIZATION = "CATEGORIZATION"
    PRIORITIZATION = "PRIORITIZATION"
    ROUTING = "ROUTING"
    ACTION_SUGGESTION = "ACTION_SUGGESTION"
    WORKFLOW_TRIGGER = "WORKFLOW_TRIGGER"
    NOTIFICATION = "NOTIFICATION"

class TriggerCondition(Enum):
    """Trigger condition types"""
    SENDER_MATCHES = "SENDER_MATCHES"
    SUBJECT_CONTAINS = "SUBJECT_CONTAINS"
    BODY_CONTAINS = "BODY_CONTAINS"
    TIME_RANGE = "TIME_RANGE"
    CLASSIFICATION = "CLASSIFICATION"
    URGENCY_LEVEL = "URGENCY_LEVEL"
    SENDER_DOMAIN = "SENDER_DOMAIN"
    EMAIL_VOLUME = "EMAIL_VOLUME"
    PATTERN_DETECTED = "PATTERN_DETECTED"

class ActionType(Enum):
    """Types of actions that can be automated"""
    SET_CATEGORY = "SET_CATEGORY"
    SET_PRIORITY = "SET_PRIORITY"
    ROUTE_TO_TEAM = "ROUTE_TO_TEAM"
    GENERATE_DRAFT = "GENERATE_DRAFT"
    CREATE_TASK = "CREATE_TASK"
    SCHEDULE_FOLLOWUP = "SCHEDULE_FOLLOWUP"
    SEND_NOTIFICATION = "SEND_NOTIFICATION"
    ARCHIVE_EMAIL = "ARCHIVE_EMAIL"
    FLAG_FOR_REVIEW = "FLAG_FOR_REVIEW"

@dataclass
class AutomationCondition:
    """Individual condition for automation rule"""
    condition_type: TriggerCondition
    field: str
    operator: str  # 'equals', 'contains', 'matches', 'greater_than', etc.
    value: Any
    weight: float = 1.0  # Importance weight for this condition

@dataclass
class RuleAction:
    """Action to be executed when rule conditions are met"""
    action_type: ActionType
    parameters: Dict[str, Any]
    confidence_threshold: float = 0.8

@dataclass
class IntelligentRule:
    """Intelligent automation rule with learning capabilities"""
    rule_id: str
    name: str
    description: str
    rule_type: RuleType
    conditions: List[AutomationCondition]
    actions: List[RuleAction]
    
    # Performance tracking
    confidence: float
    success_rate: float
    usage_count: int
    created_at: datetime
    last_used: Optional[datetime] = None
    
    # Learning parameters
    learning_enabled: bool = True
    auto_adjust_threshold: bool = True
    min_confidence: float = 0.7
    
    # Lifecycle
    created_by: str = "system"
    is_active: bool = True
    is_verified: bool = False

@dataclass
class RuleExecution:
    """Record of rule execution for learning and analysis"""
    execution_id: str
    rule_id: str
    email_id: str
    executed_at: datetime
    conditions_met: List[str]
    actions_taken: List[str]
    confidence_score: float
    user_feedback: Optional[str] = None
    was_successful: Optional[bool] = None

class RulePatternMiner:
    """Mines patterns from email data to suggest new automation rules"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.min_pattern_frequency = config.get('min_pattern_frequency', 5)
        self.min_pattern_confidence = config.get('min_pattern_confidence', 0.75)
        self.logger = logging.getLogger(__name__)
    
    def mine_categorization_patterns(self, 
                                   email_history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Mine patterns for automatic categorization rules"""
        
        patterns = []
        
        # Group emails by classification
        classification_groups = defaultdict(list)
        for email in email_history:
            if 'classification' in email and 'sender' in email:
                classification_groups[email['classification']].append(email)
        
        # Analyze sender patterns
        for classification, emails in classification_groups.items():
            if len(emails) < self.min_pattern_frequency:
                continue
            
            # Sender domain patterns
            sender_domains = defaultdict(int)
            for email in emails:
                domain = email['sender'].split('@')[-1].lower()
                sender_domains[domain] += 1
            
            total_emails = len(emails)
            for domain, count in sender_domains.items():
                confidence = count / total_emails
                if confidence >= self.min_pattern_confidence:
                    patterns.append({
                        'pattern_type': 'sender_domain_classification',
                        'trigger': {
                            'condition': TriggerCondition.SENDER_DOMAIN,
                            'value': domain
                        },
                        'action': {
                            'type': ActionType.SET_CATEGORY,
                            'value': classification
                        },
                        'confidence': confidence,
                        'evidence_count': count,
                        'total_emails': total_emails
                    })
        
        # Subject keyword patterns
        for classification, emails in classification_groups.items():
            if len(emails) < self.min_pattern_frequency:
                continue
            
            # Extract common keywords from subjects
            subject_words = defaultdict(int)
            for email in emails:
                subject = email.get('subject', '').lower()
                # Simple keyword extraction (could be enhanced with NLP)
                words = re.findall(r'\b\w{3,}\b', subject)
                for word in words:
                    if word not in ['the', 'and', 'for', 'with', 'from']:  # Basic stopwords
                        subject_words[word] += 1
            
            total_emails = len(emails)
            for word, count in subject_words.items():
                confidence = count / total_emails
                if confidence >= self.min_pattern_confidence and count >= self.min_pattern_frequency:
                    patterns.append({
                        'pattern_type': 'subject_keyword_classification',
                        'trigger': {
                            'condition': TriggerCondition.SUBJECT_CONTAINS,
                            'value': word
                        },
                        'action': {
                            'type': ActionType.SET_CATEGORY,
                            'value': classification
                        },
                        'confidence': confidence,
                        'evidence_count': count,
                        'total_emails': total_emails
                    })
        
        return patterns
    
    def mine_time_based_patterns(self, 
                               email_history: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Mine time-based automation patterns"""
        
        patterns = []
        
        # Group emails by hour and classification
        hour_classifications = defaultdict(lambda: defaultdict(int))
        total_by_hour = defaultdict(int)
        
        for email in email_history:
            if 'received_at' in email and 'urgency' in email:
                try:
                    received_time = datetime.fromisoformat(email['received_at'])
                    hour = received_time.hour
                    urgency = email['urgency']
                    
                    hour_classifications[hour][urgency] += 1
                    total_by_hour[hour] += 1
                except:
                    continue
        
        # Find patterns where specific hours have high urgency rates
        for hour, urgency_counts in hour_classifications.items():
            total_for_hour = total_by_hour[hour]
            if total_for_hour < self.min_pattern_frequency:
                continue
            
            high_urgency_count = urgency_counts.get('HIGH', 0) + urgency_counts.get('CRITICAL', 0)
            urgency_rate = high_urgency_count / total_for_hour
            
            if urgency_rate >= self.min_pattern_confidence:
                patterns.append({
                    'pattern_type': 'time_based_prioritization',
                    'trigger': {
                        'condition': TriggerCondition.TIME_RANGE,
                        'value': {'start_hour': hour, 'end_hour': hour}
                    },
                    'action': {
                        'type': ActionType.SET_PRIORITY,
                        'value': 'HIGH'
                    },
                    'confidence': urgency_rate,
                    'evidence_count': high_urgency_count,
                    'total_emails': total_for_hour
                })
        
        return patterns
    
    def suggest_automation_rules(self, 
                               email_history: List[Dict[str, Any]]) -> List[IntelligentRule]:
        """Generate automation rule suggestions based on mined patterns"""
        
        suggested_rules = []
        
        # Mine different types of patterns
        categorization_patterns = self.mine_categorization_patterns(email_history)
        time_patterns = self.mine_time_based_patterns(email_history)
        
        all_patterns = categorization_patterns + time_patterns
        
        # Convert patterns to automation rules
        for i, pattern in enumerate(all_patterns):
            if pattern['confidence'] >= self.min_pattern_confidence:
                
                # Create condition
                trigger = pattern['trigger']
                condition = AutomationCondition(
                    condition_type=trigger['condition'],
                    field=self._get_field_for_condition(trigger['condition']),
                    operator='contains' if 'contains' in pattern['pattern_type'] else 'equals',
                    value=trigger['value'],
                    weight=pattern['confidence']
                )
                
                # Create action
                action_info = pattern['action']
                action = RuleAction(
                    action_type=action_info['type'],
                    parameters={'value': action_info['value']},
                    confidence_threshold=pattern['confidence']
                )
                
                # Create rule
                rule = IntelligentRule(
                    rule_id=f"suggested_{pattern['pattern_type']}_{i}",
                    name=f"Auto-{pattern['pattern_type'].replace('_', ' ').title()}",
                    description=f"Automatically {action_info['type'].value.lower()} based on {pattern['pattern_type']} pattern",
                    rule_type=self._get_rule_type_for_action(action_info['type']),
                    conditions=[condition],
                    actions=[action],
                    confidence=pattern['confidence'],
                    success_rate=pattern['confidence'],  # Initial estimate
                    usage_count=0,
                    last_used=None,
                    created_at=datetime.now(),
                    created_by="pattern_miner",
                    is_verified=False  # Requires user verification
                )
                
                suggested_rules.append(rule)
        
        return suggested_rules
    
    def _get_field_for_condition(self, condition_type: TriggerCondition) -> str:
        """Get the email field for a condition type"""
        mapping = {
            TriggerCondition.SENDER_MATCHES: 'sender',
            TriggerCondition.SENDER_DOMAIN: 'sender',
            TriggerCondition.SUBJECT_CONTAINS: 'subject',
            TriggerCondition.BODY_CONTAINS: 'body',
            TriggerCondition.TIME_RANGE: 'received_at',
            TriggerCondition.CLASSIFICATION: 'classification',
            TriggerCondition.URGENCY_LEVEL: 'urgency'
        }
        return mapping.get(condition_type, 'unknown')
    
    def _get_rule_type_for_action(self, action_type: ActionType) -> RuleType:
        """Get the rule type for an action type"""
        mapping = {
            ActionType.SET_CATEGORY: RuleType.CATEGORIZATION,
            ActionType.SET_PRIORITY: RuleType.PRIORITIZATION,
            ActionType.ROUTE_TO_TEAM: RuleType.ROUTING,
            ActionType.GENERATE_DRAFT: RuleType.ACTION_SUGGESTION,
            ActionType.CREATE_TASK: RuleType.WORKFLOW_TRIGGER,
            ActionType.SEND_NOTIFICATION: RuleType.NOTIFICATION
        }
        return mapping.get(action_type, RuleType.ACTION_SUGGESTION)

class IntelligentAutomationEngine:
    """Main engine for intelligent automation rules with learning capabilities"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the intelligent automation engine"""
        self.config = self._load_config(config)
        self.db_path = self.config.get('automation_db_path', 'intelligent_automation.db')
        
        # Components
        self.pattern_miner = RulePatternMiner(self.config.get('pattern_mining', {}))
        
        # State
        self.rules: Dict[str, IntelligentRule] = {}
        self.execution_history: List[RuleExecution] = []
        
        # Learning parameters
        self.learning_enabled = self.config.get('learning_enabled', True)
        self.auto_optimize = self.config.get('auto_optimize', True)
        
        self.logger = logging.getLogger(__name__)
        
        # Initialize database and load rules
        self._setup_database()
        self._load_rules()
    
    def _load_config(self, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Load configuration with defaults"""
        default_config = {
            'automation_db_path': 'intelligent_automation.db',
            'learning_enabled': True,
            'auto_optimize': True,
            'pattern_mining': {
                'min_pattern_frequency': 5,
                'min_pattern_confidence': 0.75
            },
            'execution': {
                'max_execution_history': 10000,
                'confidence_adjustment_rate': 0.05,
                'success_rate_threshold': 0.8
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
    
    def _serialize_condition(self, condition: AutomationCondition) -> Dict[str, Any]:
        """Serialize automation condition for JSON storage"""
        return {
            'condition_type': condition.condition_type.value,
            'field': condition.field,
            'operator': condition.operator,
            'value': condition.value,
            'weight': condition.weight
        }
    
    def _deserialize_condition(self, data: Dict[str, Any]) -> AutomationCondition:
        """Deserialize automation condition from JSON storage"""
        return AutomationCondition(
            condition_type=TriggerCondition(data['condition_type']),
            field=data['field'],
            operator=data['operator'],
            value=data['value'],
            weight=data['weight']
        )
    
    def _serialize_action(self, action: RuleAction) -> Dict[str, Any]:
        """Serialize automation action for JSON storage"""
        return {
            'action_type': action.action_type.value,
            'parameters': action.parameters,
            'confidence_threshold': action.confidence_threshold
        }
    
    def _deserialize_action(self, data: Dict[str, Any]) -> RuleAction:
        """Deserialize automation action from JSON storage"""
        return RuleAction(
            action_type=ActionType(data['action_type']),
            parameters=data['parameters'],
            confidence_threshold=data['confidence_threshold']
        )
    
    def _setup_database(self):
        """Initialize automation rules database"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Automation rules table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS automation_rules (
                    rule_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT,
                    rule_type TEXT NOT NULL,
                    conditions TEXT NOT NULL,
                    actions TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    success_rate REAL DEFAULT 0.0,
                    usage_count INTEGER DEFAULT 0,
                    last_used DATETIME,
                    learning_enabled BOOLEAN DEFAULT 1,
                    auto_adjust_threshold BOOLEAN DEFAULT 1,
                    min_confidence REAL DEFAULT 0.7,
                    created_at DATETIME NOT NULL,
                    created_by TEXT DEFAULT 'system',
                    is_active BOOLEAN DEFAULT 1,
                    is_verified BOOLEAN DEFAULT 0
                )
            ''')
            
            # Rule execution history table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS rule_executions (
                    execution_id TEXT PRIMARY KEY,
                    rule_id TEXT NOT NULL,
                    email_id TEXT NOT NULL,
                    executed_at DATETIME NOT NULL,
                    conditions_met TEXT NOT NULL,
                    actions_taken TEXT NOT NULL,
                    confidence_score REAL NOT NULL,
                    user_feedback TEXT,
                    was_successful BOOLEAN,
                    FOREIGN KEY (rule_id) REFERENCES automation_rules (rule_id)
                )
            ''')
            
            # Pattern suggestions table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS pattern_suggestions (
                    suggestion_id TEXT PRIMARY KEY,
                    pattern_type TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    evidence_count INTEGER NOT NULL,
                    pattern_data TEXT NOT NULL,
                    suggested_rule_data TEXT NOT NULL,
                    created_at DATETIME NOT NULL,
                    reviewed BOOLEAN DEFAULT 0,
                    approved BOOLEAN DEFAULT 0
                )
            ''')
            
            conn.commit()
    
    def _load_rules(self):
        """Load automation rules from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM automation_rules WHERE is_active = 1')
                rows = cursor.fetchall()
                
                for row in rows:
                    # Parse stored data
                    conditions = [
                        self._deserialize_condition(cond) 
                        for cond in json.loads(row[4])
                    ]
                    actions = [
                        self._deserialize_action(act) 
                        for act in json.loads(row[5])
                    ]
                    
                    rule = IntelligentRule(
                        rule_id=row[0],
                        name=row[1],
                        description=row[2],
                        rule_type=RuleType(row[3]),
                        conditions=conditions,
                        actions=actions,
                        confidence=row[6],
                        success_rate=row[7],
                        usage_count=row[8],
                        last_used=datetime.fromisoformat(row[9]) if row[9] else None,
                        learning_enabled=bool(row[10]),
                        auto_adjust_threshold=bool(row[11]),
                        min_confidence=row[12],
                        created_at=datetime.fromisoformat(row[13]),
                        created_by=row[14],
                        is_active=bool(row[15]),
                        is_verified=bool(row[16])
                    )
                    
                    self.rules[rule.rule_id] = rule
                
                self.logger.info(f"Loaded {len(self.rules)} automation rules")
        
        except Exception as e:
            self.logger.error(f"Error loading rules: {e}")
    
    def add_rule(self, rule: IntelligentRule) -> bool:
        """Add a new automation rule"""
        try:
            # Store in database
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO automation_rules 
                    (rule_id, name, description, rule_type, conditions, actions, confidence,
                     success_rate, usage_count, last_used, learning_enabled, auto_adjust_threshold,
                     min_confidence, created_at, created_by, is_active, is_verified)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    rule.rule_id, rule.name, rule.description, rule.rule_type.value,
                    json.dumps([self._serialize_condition(cond) for cond in rule.conditions]),
                    json.dumps([self._serialize_action(act) for act in rule.actions]),
                    rule.confidence, rule.success_rate, rule.usage_count,
                    rule.last_used.isoformat() if rule.last_used else None,
                    rule.learning_enabled, rule.auto_adjust_threshold, rule.min_confidence,
                    rule.created_at.isoformat(), rule.created_by,
                    rule.is_active, rule.is_verified
                ))
                conn.commit()
            
            # Store in memory
            self.rules[rule.rule_id] = rule
            
            self.logger.info(f"Added automation rule: {rule.name}")
            return True
        
        except Exception as e:
            self.logger.error(f"Error adding rule: {e}")
            return False
    
    async def evaluate_email(self, email: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Evaluate email against all automation rules and return applicable actions"""
        
        applicable_actions = []
        
        for rule_id, rule in self.rules.items():
            if not rule.is_active:
                continue
            
            # Check if rule conditions are met
            conditions_met, confidence_score = self._evaluate_rule_conditions(email, rule)
            
            if conditions_met and confidence_score >= rule.min_confidence:
                
                # Execute rule actions
                actions_taken = await self._execute_rule_actions(email, rule, confidence_score)
                
                # Record execution
                execution = RuleExecution(
                    execution_id=f"{rule_id}_{email.get('id', 'unknown')}_{int(datetime.now().timestamp())}",
                    rule_id=rule_id,
                    email_id=str(email.get('id', 'unknown')),
                    executed_at=datetime.now(),
                    conditions_met=[cond.condition_type.value for cond in rule.conditions],
                    actions_taken=[act.action_type.value for act in rule.actions],
                    confidence_score=confidence_score
                )
                
                self._record_execution(execution)
                
                # Update rule usage
                rule.usage_count += 1
                rule.last_used = datetime.now()
                
                applicable_actions.append({
                    'rule_id': rule_id,
                    'rule_name': rule.name,
                    'confidence': confidence_score,
                    'actions': actions_taken,
                    'execution_id': execution.execution_id
                })
                
                self.logger.debug(f"Applied rule '{rule.name}' to email {email.get('id')} with confidence {confidence_score:.2f}")
        
        return applicable_actions
    
    def _evaluate_rule_conditions(self, 
                                 email: Dict[str, Any], 
                                 rule: IntelligentRule) -> Tuple[bool, float]:
        """Evaluate if email meets rule conditions"""
        
        if not rule.conditions:
            return False, 0.0
        
        total_weight = sum(cond.weight for cond in rule.conditions)
        weighted_score = 0.0
        conditions_met = 0
        
        for condition in rule.conditions:
            if self._check_single_condition(email, condition):
                weighted_score += condition.weight
                conditions_met += 1
        
        # All conditions must be met for rule to apply
        all_conditions_met = (conditions_met == len(rule.conditions))
        confidence_score = weighted_score / total_weight if total_weight > 0 else 0.0
        
        return all_conditions_met, confidence_score
    
    def _check_single_condition(self, 
                               email: Dict[str, Any], 
                               condition: AutomationCondition) -> bool:
        """Check if a single condition is met"""
        
        field_value = email.get(condition.field, '')
        
        if condition.condition_type == TriggerCondition.SENDER_MATCHES:
            return condition.operator == 'equals' and field_value.lower() == condition.value.lower()
        
        elif condition.condition_type == TriggerCondition.SENDER_DOMAIN:
            sender_domain = field_value.split('@')[-1].lower() if '@' in field_value else ''
            return sender_domain == condition.value.lower()
        
        elif condition.condition_type == TriggerCondition.SUBJECT_CONTAINS:
            return condition.value.lower() in str(field_value).lower()
        
        elif condition.condition_type == TriggerCondition.BODY_CONTAINS:
            return condition.value.lower() in str(field_value).lower()
        
        elif condition.condition_type == TriggerCondition.CLASSIFICATION:
            return field_value == condition.value
        
        elif condition.condition_type == TriggerCondition.URGENCY_LEVEL:
            return field_value == condition.value
        
        elif condition.condition_type == TriggerCondition.TIME_RANGE:
            if 'received_at' in email:
                try:
                    received_time = datetime.fromisoformat(email['received_at'])
                    hour = received_time.hour
                    time_range = condition.value
                    return time_range['start_hour'] <= hour <= time_range['end_hour']
                except:
                    return False
        
        return False
    
    async def _execute_rule_actions(self, 
                                   email: Dict[str, Any], 
                                   rule: IntelligentRule, 
                                   confidence: float) -> List[Dict[str, Any]]:
        """Execute the actions specified by a rule"""
        
        actions_taken = []
        
        for action in rule.actions:
            if confidence >= action.confidence_threshold:
                
                action_result = await self._execute_single_action(email, action, confidence)
                
                actions_taken.append({
                    'action_type': action.action_type.value,
                    'parameters': action.parameters,
                    'result': action_result,
                    'confidence': confidence
                })
        
        return actions_taken
    
    async def _execute_single_action(self, 
                                    email: Dict[str, Any], 
                                    action: RuleAction, 
                                    confidence: float) -> Dict[str, Any]:
        """Execute a single automation action"""
        
        if action.action_type == ActionType.SET_CATEGORY:
            return {
                'action': 'category_set',
                'category': action.parameters.get('value'),
                'confidence': confidence
            }
        
        elif action.action_type == ActionType.SET_PRIORITY:
            return {
                'action': 'priority_set',
                'priority': action.parameters.get('value'),
                'confidence': confidence
            }
        
        elif action.action_type == ActionType.ROUTE_TO_TEAM:
            return {
                'action': 'routed',
                'team': action.parameters.get('value'),
                'confidence': confidence
            }
        
        elif action.action_type == ActionType.GENERATE_DRAFT:
            return {
                'action': 'draft_generated',
                'draft_type': action.parameters.get('template', 'standard'),
                'confidence': confidence
            }
        
        elif action.action_type == ActionType.CREATE_TASK:
            return {
                'action': 'task_created',
                'task_type': action.parameters.get('type', 'general'),
                'confidence': confidence
            }
        
        elif action.action_type == ActionType.FLAG_FOR_REVIEW:
            return {
                'action': 'flagged_for_review',
                'reason': action.parameters.get('reason', 'automation_triggered'),
                'confidence': confidence
            }
        
        else:
            return {
                'action': 'unknown',
                'parameters': action.parameters,
                'confidence': confidence
            }
    
    def _record_execution(self, execution: RuleExecution):
        """Record rule execution in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO rule_executions 
                    (execution_id, rule_id, email_id, executed_at, conditions_met, 
                     actions_taken, confidence_score, user_feedback, was_successful)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    execution.execution_id, execution.rule_id, execution.email_id,
                    execution.executed_at.isoformat(),
                    json.dumps(execution.conditions_met),
                    json.dumps(execution.actions_taken),
                    execution.confidence_score,
                    execution.user_feedback,
                    execution.was_successful
                ))
                conn.commit()
            
            # Keep execution history in memory (limited size)
            self.execution_history.append(execution)
            max_history = self.config['execution']['max_execution_history']
            if len(self.execution_history) > max_history:
                self.execution_history = self.execution_history[-max_history:]
        
        except Exception as e:
            self.logger.error(f"Error recording execution: {e}")
    
    def provide_feedback(self, execution_id: str, was_successful: bool, feedback: str = None):
        """Provide feedback on rule execution for learning"""
        
        if not self.learning_enabled:
            return
        
        # Update execution record
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE rule_executions 
                    SET was_successful = ?, user_feedback = ?
                    WHERE execution_id = ?
                ''', (was_successful, feedback, execution_id))
                conn.commit()
            
            # Find execution in memory
            execution = None
            for exec_record in self.execution_history:
                if exec_record.execution_id == execution_id:
                    exec_record.was_successful = was_successful
                    exec_record.user_feedback = feedback
                    execution = exec_record
                    break
            
            if execution:
                # Update rule performance
                rule = self.rules.get(execution.rule_id)
                if rule and rule.learning_enabled:
                    self._update_rule_performance(rule, was_successful)
                    
                    self.logger.info(f"Updated rule '{rule.name}' based on feedback: {'positive' if was_successful else 'negative'}")
        
        except Exception as e:
            self.logger.error(f"Error providing feedback: {e}")
    
    def _update_rule_performance(self, rule: IntelligentRule, was_successful: bool):
        """Update rule performance based on feedback"""
        
        # Calculate new success rate
        total_feedback = 0
        successful_feedback = 0
        
        for execution in self.execution_history:
            if (execution.rule_id == rule.rule_id and 
                execution.was_successful is not None):
                total_feedback += 1
                if execution.was_successful:
                    successful_feedback += 1
        
        if total_feedback > 0:
            rule.success_rate = successful_feedback / total_feedback
        
        # Adjust confidence if auto-adjustment is enabled
        if rule.auto_adjust_threshold and total_feedback >= 5:
            adjustment_rate = self.config['execution']['confidence_adjustment_rate']
            
            if was_successful and rule.confidence < 0.95:
                rule.confidence = min(0.95, rule.confidence + adjustment_rate)
            elif not was_successful and rule.confidence > rule.min_confidence:
                rule.confidence = max(rule.min_confidence, rule.confidence - adjustment_rate)
        
        # Deactivate rule if success rate is consistently low
        success_threshold = self.config['execution']['success_rate_threshold']
        if (rule.success_rate < success_threshold and 
            total_feedback >= 10):
            rule.is_active = False
            self.logger.warning(f"Deactivated rule '{rule.name}' due to low success rate: {rule.success_rate:.2f}")
        
        # Update in database
        self._save_rule_updates(rule)
    
    def _save_rule_updates(self, rule: IntelligentRule):
        """Save rule updates to database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    UPDATE automation_rules 
                    SET confidence = ?, success_rate = ?, usage_count = ?, 
                        last_used = ?, is_active = ?
                    WHERE rule_id = ?
                ''', (
                    rule.confidence, rule.success_rate, rule.usage_count,
                    rule.last_used.isoformat() if rule.last_used else None,
                    rule.is_active, rule.rule_id
                ))
                conn.commit()
        
        except Exception as e:
            self.logger.error(f"Error saving rule updates: {e}")
    
    def suggest_new_rules(self, email_history: List[Dict[str, Any]]) -> List[IntelligentRule]:
        """Suggest new automation rules based on email patterns"""
        
        if not email_history:
            return []
        
        suggested_rules = self.pattern_miner.suggest_automation_rules(email_history)
        
        # Store suggestions in database for review
        for rule in suggested_rules:
            self._store_rule_suggestion(rule)
        
        self.logger.info(f"Generated {len(suggested_rules)} automation rule suggestions")
        
        return suggested_rules
    
    def _store_rule_suggestion(self, rule: IntelligentRule):
        """Store rule suggestion for review"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT INTO pattern_suggestions 
                    (suggestion_id, pattern_type, confidence, evidence_count, 
                     pattern_data, suggested_rule_data, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    rule.rule_id,
                    rule.rule_type.value,
                    rule.confidence,
                    rule.usage_count,  # Using usage_count as evidence_count
                    json.dumps({'rule_type': rule.rule_type.value}),
                    json.dumps(asdict(rule)),
                    rule.created_at.isoformat()
                ))
                conn.commit()
        
        except Exception as e:
            self.logger.error(f"Error storing rule suggestion: {e}")
    
    def get_rule_performance_report(self) -> Dict[str, Any]:
        """Generate comprehensive rule performance report"""
        
        total_rules = len(self.rules)
        active_rules = sum(1 for rule in self.rules.values() if rule.is_active)
        verified_rules = sum(1 for rule in self.rules.values() if rule.is_verified)
        
        # Calculate average performance metrics
        avg_confidence = sum(rule.confidence for rule in self.rules.values()) / max(total_rules, 1)
        avg_success_rate = sum(rule.success_rate for rule in self.rules.values()) / max(total_rules, 1)
        total_usage = sum(rule.usage_count for rule in self.rules.values())
        
        # Recent execution statistics
        recent_executions = [
            exec for exec in self.execution_history 
            if exec.executed_at > datetime.now() - timedelta(days=7)
        ]
        
        recent_success_count = sum(
            1 for exec in recent_executions 
            if exec.was_successful is True
        )
        
        recent_success_rate = (
            recent_success_count / max(len(recent_executions), 1)
        )
        
        # Rule type distribution
        rule_type_counts = defaultdict(int)
        for rule in self.rules.values():
            rule_type_counts[rule.rule_type.value] += 1
        
        return {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total_rules': total_rules,
                'active_rules': active_rules,
                'verified_rules': verified_rules,
                'average_confidence': avg_confidence,
                'average_success_rate': avg_success_rate,
                'total_usage_count': total_usage
            },
            'recent_performance': {
                'executions_last_7_days': len(recent_executions),
                'success_rate_last_7_days': recent_success_rate,
                'success_count': recent_success_count
            },
            'rule_distribution': dict(rule_type_counts),
            'top_performing_rules': [
                {
                    'rule_id': rule.rule_id,
                    'name': rule.name,
                    'success_rate': rule.success_rate,
                    'usage_count': rule.usage_count,
                    'confidence': rule.confidence
                }
                for rule in sorted(
                    self.rules.values(), 
                    key=lambda r: (r.success_rate, r.usage_count), 
                    reverse=True
                )[:10]
            ]
        }


# Example usage and testing
async def main():
    """Example usage of Intelligent Automation Rules Engine"""
    
    # Configuration
    config = {
        'learning_enabled': True,
        'auto_optimize': True,
        'pattern_mining': {
            'min_pattern_frequency': 3,  # Lower for demo
            'min_pattern_confidence': 0.6  # Lower for demo
        }
    }
    
    # Initialize engine
    engine = IntelligentAutomationEngine(config)
    
    # Sample email history for pattern mining
    email_history = [
        {'id': 1, 'sender': 'support@company.com', 'subject': 'bug report', 'classification': 'CREATE_TASK', 'urgency': 'HIGH'},
        {'id': 2, 'sender': 'support@company.com', 'subject': 'feature request', 'classification': 'CREATE_TASK', 'urgency': 'MEDIUM'},
        {'id': 3, 'sender': 'marketing@company.com', 'subject': 'approval needed', 'classification': 'APPROVAL_REQUIRED', 'urgency': 'HIGH'},
        {'id': 4, 'sender': 'marketing@company.com', 'subject': 'budget approval', 'classification': 'APPROVAL_REQUIRED', 'urgency': 'HIGH'},
        {'id': 5, 'sender': 'hr@company.com', 'subject': 'policy update', 'classification': 'FYI_ONLY', 'urgency': 'LOW'},
        {'id': 6, 'sender': 'hr@company.com', 'subject': 'benefits update', 'classification': 'FYI_ONLY', 'urgency': 'LOW'},
    ]
    
    print("\n=== Intelligent Automation Rules Engine Demo ===")
    
    # Suggest new rules based on patterns
    print("\n📊 Mining patterns and suggesting rules...")
    suggested_rules = engine.suggest_new_rules(email_history)
    
    print(f"Generated {len(suggested_rules)} rule suggestions:")
    for rule in suggested_rules[:3]:  # Show first 3
        print(f"   • {rule.name} (confidence: {rule.confidence:.2f})")
        print(f"     Type: {rule.rule_type.value}")
        print(f"     Conditions: {len(rule.conditions)}, Actions: {len(rule.actions)}")
    
    # Add a sample rule
    sample_rule = IntelligentRule(
        rule_id="demo_support_rule",
        name="Auto-categorize Support Emails",
        description="Automatically categorize emails from support domain as tasks",
        rule_type=RuleType.CATEGORIZATION,
        conditions=[
            AutomationCondition(
                condition_type=TriggerCondition.SENDER_DOMAIN,
                field="sender",
                operator="equals",
                value="support.company.com",
                weight=1.0
            )
        ],
        actions=[
            AutomationAction(
                action_type=ActionType.SET_CATEGORY,
                parameters={"value": "TASK"},
                confidence_threshold=0.7
            )
        ],
        confidence=0.85,
        success_rate=0.0,
        usage_count=0,
        last_used=None,
        created_at=datetime.now(),
        is_verified=True
    )
    
    engine.add_rule(sample_rule)
    print(f"\n✅ Added sample rule: {sample_rule.name}")
    
    # Test rule evaluation
    test_email = {
        'id': 'test_123',
        'sender': 'user@support.company.com',
        'subject': 'Bug in login system',
        'body': 'There is a bug in the login system that needs to be fixed.',
        'received_at': datetime.now().isoformat()
    }
    
    print(f"\n🔍 Evaluating test email...")
    actions = await engine.evaluate_email(test_email)
    
    print(f"Applied {len(actions)} automation actions:")
    for action in actions:
        print(f"   • Rule: {action['rule_name']} (confidence: {action['confidence']:.2f})")
        print(f"     Actions: {len(action['actions'])} taken")
    
    # Provide feedback
    if actions:
        execution_id = actions[0]['execution_id']
        engine.provide_feedback(execution_id, was_successful=True, feedback="Correctly categorized")
        print(f"\n✅ Provided positive feedback for execution {execution_id}")
    
    # Generate performance report
    report = engine.get_rule_performance_report()
    
    print(f"\n📈 Automation Performance Report:")
    print(f"   Total rules: {report['summary']['total_rules']}")
    print(f"   Active rules: {report['summary']['active_rules']}")
    print(f"   Average confidence: {report['summary']['average_confidence']:.2f}")
    print(f"   Recent executions: {report['recent_performance']['executions_last_7_days']}")
    
    print("\nIntelligent Automation Rules Engine demo completed.")


if __name__ == "__main__":
    asyncio.run(main())