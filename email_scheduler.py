#!/usr/bin/env python3
"""
Email Scheduling and Automation System

Main scheduling service with background tasks for automated email composition,
sending, and workflow automation based on AI classification results.

Features:
- Schedule email composition and sending for future dates/times
- Automated responses based on AI classification
- Recurring email patterns and workflow automation
- Background task processing with Redis/Celery
- Template management for common response types
- Integration with FastAPI backend for scheduling API endpoints
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, asdict
from enum import Enum
import pickle
from pathlib import Path

# Core dependencies
import redis
from celery import Celery
from celery.schedules import crontab
from pydantic import BaseModel, Field
from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.responses import JSONResponse
import croniter

# Internal imports
from email_intelligence_engine import (
    EmailIntelligenceEngine, 
    EmailClass, 
    Urgency, 
    Sentiment,
    EmailIntelligence
)
from applescript_integration import AppleScriptMailer
from scheduled_tasks import TaskManager, ScheduledTask, TaskStatus, TaskType


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ScheduleType(Enum):
    """Types of email scheduling"""
    ONE_TIME = "one_time"
    RECURRING = "recurring" 
    CONDITIONAL = "conditional"  # Based on AI classification results
    TEMPLATE_BASED = "template_based"


class AutomationTrigger(Enum):
    """Triggers for automated email responses"""
    CLASSIFICATION = "classification"  # Based on email classification
    URGENCY = "urgency"  # Based on urgency level
    SENTIMENT = "sentiment"  # Based on sentiment analysis
    KEYWORD = "keyword"  # Based on keyword matching
    TIME_BASED = "time_based"  # Time-based triggers
    FOLLOW_UP = "follow_up"  # Follow-up reminders


@dataclass
class EmailTemplate:
    """Email template with placeholders"""
    id: str
    name: str
    subject_template: str
    body_template: str
    classification: Optional[EmailClass] = None
    urgency: Optional[Urgency] = None
    tags: List[str] = None
    created_at: datetime = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.created_at is None:
            self.created_at = datetime.now()


@dataclass
class ScheduledEmail:
    """Scheduled email with all parameters"""
    id: str
    to: str
    subject: str
    body: str
    scheduled_time: datetime
    schedule_type: ScheduleType
    status: str = "pending"  # pending, sent, failed, cancelled
    cc: Optional[str] = None
    bcc: Optional[str] = None
    template_id: Optional[str] = None
    created_at: datetime = None
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()


@dataclass 
class AutomationRule:
    """Automation rule for conditional email responses"""
    id: str
    name: str
    trigger: AutomationTrigger
    conditions: Dict[str, Any]  # Trigger-specific conditions
    template_id: str
    enabled: bool = True
    delay_minutes: int = 0  # Delay before sending response
    max_daily_sends: int = 10  # Rate limiting
    daily_send_count: int = 0
    last_reset_date: Optional[datetime] = None
    created_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.last_reset_date is None:
            self.last_reset_date = datetime.now().date()


class EmailSchedulerConfig:
    """Configuration for email scheduler"""
    def __init__(self):
        # Redis configuration
        self.redis_host = os.getenv("REDIS_HOST", "localhost")
        self.redis_port = int(os.getenv("REDIS_PORT", 6379))
        self.redis_db = int(os.getenv("REDIS_DB", 0))
        self.redis_password = os.getenv("REDIS_PASSWORD")
        
        # Celery configuration
        self.celery_broker = f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"
        self.celery_backend = self.celery_broker
        
        # OpenAI configuration (EXACT models as specified)
        self.openai_api_key = os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_APIKEY")
        self.classifier_model = "gpt-5-nano-2025-08-07"  # For email classification
        self.draft_model = "gpt-5-mini-2025-08-07"  # For draft generation
        
        # File paths
        self.data_dir = Path(os.getenv("EMAIL_SCHEDULER_DATA_DIR", "./scheduler_data"))
        self.templates_file = self.data_dir / "templates.json"
        self.rules_file = self.data_dir / "automation_rules.json"
        self.schedules_file = self.data_dir / "scheduled_emails.json"
        
        # Ensure data directory exists
        self.data_dir.mkdir(exist_ok=True)


class EmailScheduler:
    """
    Main email scheduling and automation service
    
    Integrates with EmailIntelligenceEngine for AI classification,
    AppleScriptMailer for email sending, and Celery for background task processing.
    """
    
    def __init__(self, config: Optional[EmailSchedulerConfig] = None):
        self.config = config or EmailSchedulerConfig()
        
        # Initialize components
        self.redis_client = self._init_redis()
        self.celery_app = self._init_celery()
        self.task_manager = TaskManager(redis_client=self.redis_client)
        self.ai_engine = EmailIntelligenceEngine()
        self.mailer = AppleScriptMailer()
        
        # In-memory caches (backed by Redis)
        self.templates: Dict[str, EmailTemplate] = {}
        self.automation_rules: Dict[str, AutomationRule] = {}
        self.scheduled_emails: Dict[str, ScheduledEmail] = {}
        
        # Load persistent data
        self._load_templates()
        self._load_automation_rules()
        self._load_scheduled_emails()
        
        logger.info("EmailScheduler initialized successfully")
    
    def _init_redis(self) -> redis.Redis:
        """Initialize Redis connection"""
        try:
            client = redis.Redis(
                host=self.config.redis_host,
                port=self.config.redis_port,
                db=self.config.redis_db,
                password=self.config.redis_password,
                decode_responses=True
            )
            # Test connection
            client.ping()
            logger.info("Redis connection established")
            return client
        except Exception as e:
            logger.warning(f"Redis not available, using fallback: {e}")
            # Return mock Redis for development
            return MockRedis()
    
    def _init_celery(self) -> Celery:
        """Initialize Celery app"""
        app = Celery(
            'email_scheduler',
            broker=self.config.celery_broker,
            backend=self.config.celery_backend
        )
        
        app.conf.update(
            task_serializer='json',
            accept_content=['json'],
            result_serializer='json',
            timezone='UTC',
            enable_utc=True,
            task_track_started=True,
            task_time_limit=300,  # 5 minutes
            task_soft_time_limit=240,  # 4 minutes
            worker_prefetch_multiplier=1,
            task_acks_late=True,
            worker_disable_rate_limits=False,
            task_compression='gzip',
        )
        
        # Register tasks
        self._register_celery_tasks(app)
        
        return app
    
    def _register_celery_tasks(self, app: Celery):
        """Register Celery tasks"""
        
        @app.task(bind=True, max_retries=3)
        def send_scheduled_email(self, email_id: str):
            """Celery task to send a scheduled email"""
            try:
                logger.info(f"Processing scheduled email: {email_id}")
                
                # Get scheduled email
                email = self.scheduled_emails.get(email_id)
                if not email:
                    logger.error(f"Scheduled email not found: {email_id}")
                    return {"status": "error", "message": "Email not found"}
                
                if email.status != "pending":
                    logger.warning(f"Email {email_id} already processed: {email.status}")
                    return {"status": "skipped", "message": f"Already {email.status}"}
                
                # Send email using AppleScript
                success = self.mailer.send_email(
                    to=email.to,
                    subject=email.subject,
                    body=email.body,
                    cc=email.cc,
                    bcc=email.bcc
                )
                
                # Update status
                if success:
                    email.status = "sent"
                    email.sent_at = datetime.now()
                    logger.info(f"Email {email_id} sent successfully")
                else:
                    email.status = "failed"
                    email.error_message = "AppleScript send failed"
                    logger.error(f"Failed to send email {email_id}")
                
                # Update storage
                self._save_scheduled_emails()
                
                return {
                    "status": "sent" if success else "failed",
                    "email_id": email_id,
                    "sent_at": email.sent_at.isoformat() if email.sent_at else None
                }
                
            except Exception as exc:
                logger.error(f"Error sending scheduled email {email_id}: {exc}")
                email.status = "failed"
                email.error_message = str(exc)
                self._save_scheduled_emails()
                
                # Retry logic
                if self.request.retries < 3:
                    logger.info(f"Retrying email {email_id} in 60 seconds")
                    raise self.retry(countdown=60, exc=exc)
                
                return {"status": "failed", "error": str(exc)}
        
        @app.task
        def process_automation_rules():
            """Celery task to process automation rules"""
            try:
                logger.info("Processing automation rules")
                processed_count = 0
                
                for rule_id, rule in self.automation_rules.items():
                    if not rule.enabled:
                        continue
                    
                    # Reset daily count if needed
                    today = datetime.now().date()
                    if rule.last_reset_date != today:
                        rule.daily_send_count = 0
                        rule.last_reset_date = today
                        
                    # Check rate limiting
                    if rule.daily_send_count >= rule.max_daily_sends:
                        continue
                    
                    # Process rule based on trigger type
                    if rule.trigger == AutomationTrigger.TIME_BASED:
                        self._process_time_based_rule(rule)
                        processed_count += 1
                
                self._save_automation_rules()
                return {"processed_rules": processed_count}
                
            except Exception as e:
                logger.error(f"Error processing automation rules: {e}")
                return {"error": str(e)}
        
        # Store tasks in instance for access
        self.celery_tasks = {
            'send_scheduled_email': send_scheduled_email,
            'process_automation_rules': process_automation_rules
        }
    
    # ==================== TEMPLATE MANAGEMENT ====================
    
    def create_template(self, name: str, subject_template: str, body_template: str,
                       classification: Optional[EmailClass] = None,
                       urgency: Optional[Urgency] = None,
                       tags: Optional[List[str]] = None) -> str:
        """Create a new email template"""
        template_id = str(uuid.uuid4())
        template = EmailTemplate(
            id=template_id,
            name=name,
            subject_template=subject_template,
            body_template=body_template,
            classification=classification,
            urgency=urgency,
            tags=tags or []
        )
        
        self.templates[template_id] = template
        self._save_templates()
        
        logger.info(f"Created template: {name} ({template_id})")
        return template_id
    
    def get_template(self, template_id: str) -> Optional[EmailTemplate]:
        """Get template by ID"""
        return self.templates.get(template_id)
    
    def list_templates(self, classification: Optional[EmailClass] = None,
                      tags: Optional[List[str]] = None) -> List[EmailTemplate]:
        """List templates with optional filtering"""
        templates = list(self.templates.values())
        
        if classification:
            templates = [t for t in templates if t.classification == classification]
        
        if tags:
            templates = [t for t in templates if any(tag in t.tags for tag in tags)]
        
        return templates
    
    def render_template(self, template_id: str, variables: Dict[str, str]) -> Dict[str, str]:
        """Render template with variables"""
        template = self.get_template(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")
        
        subject = template.subject_template
        body = template.body_template
        
        # Simple variable substitution
        for key, value in variables.items():
            placeholder = f"{{{key}}}"
            subject = subject.replace(placeholder, value)
            body = body.replace(placeholder, value)
        
        return {"subject": subject, "body": body}
    
    # ==================== EMAIL SCHEDULING ====================
    
    def schedule_email(self, to: str, subject: str, body: str,
                      scheduled_time: datetime,
                      schedule_type: ScheduleType = ScheduleType.ONE_TIME,
                      cc: Optional[str] = None,
                      bcc: Optional[str] = None,
                      template_id: Optional[str] = None) -> str:
        """Schedule an email for future sending"""
        
        # Validate scheduled time
        if scheduled_time <= datetime.now():
            raise ValueError("Scheduled time must be in the future")
        
        email_id = str(uuid.uuid4())
        scheduled_email = ScheduledEmail(
            id=email_id,
            to=to,
            subject=subject,
            body=body,
            scheduled_time=scheduled_time,
            schedule_type=schedule_type,
            cc=cc,
            bcc=bcc,
            template_id=template_id
        )
        
        self.scheduled_emails[email_id] = scheduled_email
        self._save_scheduled_emails()
        
        # Schedule Celery task
        eta = scheduled_time
        self.celery_tasks['send_scheduled_email'].apply_async(
            args=[email_id],
            eta=eta,
            task_id=f"email_{email_id}"
        )
        
        logger.info(f"Scheduled email {email_id} for {scheduled_time}")
        return email_id
    
    def schedule_template_email(self, template_id: str, to: str,
                              variables: Dict[str, str],
                              scheduled_time: datetime,
                              cc: Optional[str] = None,
                              bcc: Optional[str] = None) -> str:
        """Schedule an email using a template"""
        
        rendered = self.render_template(template_id, variables)
        
        return self.schedule_email(
            to=to,
            subject=rendered["subject"],
            body=rendered["body"],
            scheduled_time=scheduled_time,
            schedule_type=ScheduleType.TEMPLATE_BASED,
            cc=cc,
            bcc=bcc,
            template_id=template_id
        )
    
    def cancel_scheduled_email(self, email_id: str) -> bool:
        """Cancel a scheduled email"""
        email = self.scheduled_emails.get(email_id)
        if not email:
            return False
        
        if email.status != "pending":
            return False
        
        # Cancel Celery task
        self.celery_app.control.revoke(f"email_{email_id}", terminate=True)
        
        # Update status
        email.status = "cancelled"
        self._save_scheduled_emails()
        
        logger.info(f"Cancelled scheduled email: {email_id}")
        return True
    
    def get_scheduled_emails(self, status: Optional[str] = None) -> List[ScheduledEmail]:
        """Get scheduled emails with optional status filtering"""
        emails = list(self.scheduled_emails.values())
        
        if status:
            emails = [e for e in emails if e.status == status]
        
        # Sort by scheduled time
        emails.sort(key=lambda x: x.scheduled_time)
        return emails
    
    # ==================== AUTOMATION RULES ====================
    
    def create_automation_rule(self, name: str, trigger: AutomationTrigger,
                             conditions: Dict[str, Any], template_id: str,
                             delay_minutes: int = 0,
                             max_daily_sends: int = 10) -> str:
        """Create a new automation rule"""
        
        # Validate template exists
        if not self.get_template(template_id):
            raise ValueError(f"Template not found: {template_id}")
        
        rule_id = str(uuid.uuid4())
        rule = AutomationRule(
            id=rule_id,
            name=name,
            trigger=trigger,
            conditions=conditions,
            template_id=template_id,
            delay_minutes=delay_minutes,
            max_daily_sends=max_daily_sends
        )
        
        self.automation_rules[rule_id] = rule
        self._save_automation_rules()
        
        logger.info(f"Created automation rule: {name} ({rule_id})")
        return rule_id
    
    def trigger_automation(self, email_data: Dict[str, Any],
                          analysis: EmailIntelligence) -> List[str]:
        """Trigger automation rules based on email analysis"""
        triggered_rules = []
        
        for rule_id, rule in self.automation_rules.items():
            if not rule.enabled:
                continue
            
            # Check rate limiting
            today = datetime.now().date()
            if rule.last_reset_date != today:
                rule.daily_send_count = 0
                rule.last_reset_date = today
            
            if rule.daily_send_count >= rule.max_daily_sends:
                continue
            
            # Check if rule conditions are met
            if self._rule_matches(rule, email_data, analysis):
                # Generate automated response
                response_id = self._generate_automated_response(
                    rule, email_data, analysis
                )
                if response_id:
                    triggered_rules.append(response_id)
                    rule.daily_send_count += 1
        
        if triggered_rules:
            self._save_automation_rules()
            logger.info(f"Triggered {len(triggered_rules)} automation rules")
        
        return triggered_rules
    
    def _rule_matches(self, rule: AutomationRule, email_data: Dict[str, Any],
                     analysis: EmailIntelligence) -> bool:
        """Check if automation rule conditions are met"""
        
        if rule.trigger == AutomationTrigger.CLASSIFICATION:
            target_class = EmailClass(rule.conditions.get("classification"))
            return analysis.classification == target_class
        
        elif rule.trigger == AutomationTrigger.URGENCY:
            target_urgency = Urgency(rule.conditions.get("urgency"))
            return analysis.urgency == target_urgency
        
        elif rule.trigger == AutomationTrigger.SENTIMENT:
            target_sentiment = Sentiment(rule.conditions.get("sentiment"))
            return analysis.sentiment == target_sentiment
        
        elif rule.trigger == AutomationTrigger.KEYWORD:
            keywords = rule.conditions.get("keywords", [])
            email_text = f"{email_data.get('subject', '')} {email_data.get('body', '')}"
            return any(keyword.lower() in email_text.lower() for keyword in keywords)
        
        elif rule.trigger == AutomationTrigger.FOLLOW_UP:
            # Check if this is a follow-up situation
            return analysis.classification == EmailClass.FOLLOW_UP
        
        return False
    
    def _generate_automated_response(self, rule: AutomationRule,
                                   email_data: Dict[str, Any],
                                   analysis: EmailIntelligence) -> Optional[str]:
        """Generate and schedule automated response"""
        try:
            # Prepare template variables
            variables = {
                "sender_name": email_data.get("sender_name", "there"),
                "subject": email_data.get("subject", ""),
                "classification": analysis.classification.value,
                "urgency": analysis.urgency.value,
                "sentiment": analysis.sentiment.value,
                "current_date": datetime.now().strftime("%Y-%m-%d"),
                "current_time": datetime.now().strftime("%H:%M")
            }
            
            # Add action items if available
            if analysis.action_items:
                variables["first_action"] = analysis.action_items[0].text
                variables["action_count"] = str(len(analysis.action_items))
            else:
                variables["first_action"] = "No specific actions identified"
                variables["action_count"] = "0"
            
            # Calculate send time
            send_time = datetime.now() + timedelta(minutes=rule.delay_minutes)
            
            # Schedule template email
            response_id = self.schedule_template_email(
                template_id=rule.template_id,
                to=email_data.get("sender", ""),
                variables=variables,
                scheduled_time=send_time
            )
            
            logger.info(f"Scheduled automated response {response_id} using rule {rule.name}")
            return response_id
            
        except Exception as e:
            logger.error(f"Error generating automated response: {e}")
            return None
    
    # ==================== RECURRING SCHEDULES ====================
    
    def create_recurring_schedule(self, cron_expression: str, template_id: str,
                                to: str, variables: Dict[str, str]) -> str:
        """Create a recurring email schedule using cron expression"""
        
        # Validate cron expression
        try:
            croniter.croniter(cron_expression)
        except ValueError as e:
            raise ValueError(f"Invalid cron expression: {e}")
        
        # Create scheduled task
        task_id = self.task_manager.create_task(
            name=f"recurring_email_{template_id}",
            task_type=TaskType.RECURRING,
            data={
                "template_id": template_id,
                "to": to,
                "variables": variables,
                "cron_expression": cron_expression
            },
            cron_schedule=cron_expression
        )
        
        logger.info(f"Created recurring schedule: {task_id} with cron '{cron_expression}'")
        return task_id
    
    def _process_time_based_rule(self, rule: AutomationRule):
        """Process time-based automation rule"""
        # This is called by the periodic Celery task
        # Implementation depends on specific time-based conditions
        pass
    
    # ==================== PERSISTENCE METHODS ====================
    
    def _save_templates(self):
        """Save templates to disk"""
        try:
            data = {
                template_id: {
                    **asdict(template),
                    'classification': template.classification.value if template.classification else None,
                    'urgency': template.urgency.value if template.urgency else None,
                    'created_at': template.created_at.isoformat()
                }
                for template_id, template in self.templates.items()
            }
            
            with open(self.config.templates_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logger.error(f"Error saving templates: {e}")
    
    def _load_templates(self):
        """Load templates from disk"""
        try:
            if self.config.templates_file.exists():
                with open(self.config.templates_file, 'r') as f:
                    data = json.load(f)
                
                for template_id, template_data in data.items():
                    # Convert back to objects
                    if template_data.get('classification'):
                        template_data['classification'] = EmailClass(template_data['classification'])
                    if template_data.get('urgency'):
                        template_data['urgency'] = Urgency(template_data['urgency'])
                    if template_data.get('created_at'):
                        template_data['created_at'] = datetime.fromisoformat(template_data['created_at'])
                    
                    self.templates[template_id] = EmailTemplate(**template_data)
                
                logger.info(f"Loaded {len(self.templates)} templates")
                
        except Exception as e:
            logger.error(f"Error loading templates: {e}")
    
    def _save_automation_rules(self):
        """Save automation rules to disk"""
        try:
            data = {
                rule_id: {
                    **asdict(rule),
                    'trigger': rule.trigger.value,
                    'created_at': rule.created_at.isoformat(),
                    'last_reset_date': rule.last_reset_date.isoformat() if rule.last_reset_date else None
                }
                for rule_id, rule in self.automation_rules.items()
            }
            
            with open(self.config.rules_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logger.error(f"Error saving automation rules: {e}")
    
    def _load_automation_rules(self):
        """Load automation rules from disk"""
        try:
            if self.config.rules_file.exists():
                with open(self.config.rules_file, 'r') as f:
                    data = json.load(f)
                
                for rule_id, rule_data in data.items():
                    # Convert back to objects
                    rule_data['trigger'] = AutomationTrigger(rule_data['trigger'])
                    if rule_data.get('created_at'):
                        rule_data['created_at'] = datetime.fromisoformat(rule_data['created_at'])
                    if rule_data.get('last_reset_date'):
                        rule_data['last_reset_date'] = datetime.fromisoformat(rule_data['last_reset_date']).date()
                    
                    self.automation_rules[rule_id] = AutomationRule(**rule_data)
                
                logger.info(f"Loaded {len(self.automation_rules)} automation rules")
                
        except Exception as e:
            logger.error(f"Error loading automation rules: {e}")
    
    def _save_scheduled_emails(self):
        """Save scheduled emails to disk"""
        try:
            data = {
                email_id: {
                    **asdict(email),
                    'schedule_type': email.schedule_type.value,
                    'scheduled_time': email.scheduled_time.isoformat(),
                    'created_at': email.created_at.isoformat(),
                    'sent_at': email.sent_at.isoformat() if email.sent_at else None
                }
                for email_id, email in self.scheduled_emails.items()
            }
            
            with open(self.config.schedules_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            logger.error(f"Error saving scheduled emails: {e}")
    
    def _load_scheduled_emails(self):
        """Load scheduled emails from disk"""
        try:
            if self.config.schedules_file.exists():
                with open(self.config.schedules_file, 'r') as f:
                    data = json.load(f)
                
                for email_id, email_data in data.items():
                    # Convert back to objects
                    email_data['schedule_type'] = ScheduleType(email_data['schedule_type'])
                    email_data['scheduled_time'] = datetime.fromisoformat(email_data['scheduled_time'])
                    if email_data.get('created_at'):
                        email_data['created_at'] = datetime.fromisoformat(email_data['created_at'])
                    if email_data.get('sent_at'):
                        email_data['sent_at'] = datetime.fromisoformat(email_data['sent_at'])
                    
                    self.scheduled_emails[email_id] = ScheduledEmail(**email_data)
                
                logger.info(f"Loaded {len(self.scheduled_emails)} scheduled emails")
                
        except Exception as e:
            logger.error(f"Error loading scheduled emails: {e}")
    
    # ==================== STATUS AND MONITORING ====================
    
    def get_stats(self) -> Dict[str, Any]:
        """Get scheduler statistics"""
        pending_emails = len([e for e in self.scheduled_emails.values() if e.status == "pending"])
        sent_emails = len([e for e in self.scheduled_emails.values() if e.status == "sent"])
        failed_emails = len([e for e in self.scheduled_emails.values() if e.status == "failed"])
        
        active_rules = len([r for r in self.automation_rules.values() if r.enabled])
        
        return {
            "templates": len(self.templates),
            "automation_rules": len(self.automation_rules),
            "active_rules": active_rules,
            "scheduled_emails": {
                "total": len(self.scheduled_emails),
                "pending": pending_emails,
                "sent": sent_emails,
                "failed": failed_emails
            },
            "celery_active_tasks": len(self.celery_app.control.inspect().active() or {}),
            "redis_connected": self._test_redis_connection()
        }
    
    def _test_redis_connection(self) -> bool:
        """Test Redis connection"""
        try:
            self.redis_client.ping()
            return True
        except:
            return False


class MockRedis:
    """Mock Redis client for development when Redis is not available"""
    
    def __init__(self):
        self.data = {}
    
    def ping(self):
        return True
    
    def set(self, key, value, ex=None):
        self.data[key] = value
        return True
    
    def get(self, key):
        return self.data.get(key)
    
    def delete(self, key):
        return self.data.pop(key, None) is not None
    
    def exists(self, key):
        return key in self.data
    
    def keys(self, pattern="*"):
        return list(self.data.keys())


# ==================== PYDANTIC MODELS FOR API ====================

class TemplateCreateRequest(BaseModel):
    name: str = Field(..., description="Template name")
    subject_template: str = Field(..., description="Subject template with {variables}")
    body_template: str = Field(..., description="Body template with {variables}")
    classification: Optional[str] = Field(None, description="Associated email classification")
    urgency: Optional[str] = Field(None, description="Associated urgency level")
    tags: Optional[List[str]] = Field(default_factory=list, description="Template tags")


class EmailScheduleRequest(BaseModel):
    to: str = Field(..., description="Recipient email address")
    subject: str = Field(..., description="Email subject")
    body: str = Field(..., description="Email body")
    scheduled_time: datetime = Field(..., description="When to send the email")
    cc: Optional[str] = Field(None, description="CC email address")
    bcc: Optional[str] = Field(None, description="BCC email address")


class TemplateEmailScheduleRequest(BaseModel):
    template_id: str = Field(..., description="Template ID to use")
    to: str = Field(..., description="Recipient email address")
    variables: Dict[str, str] = Field(..., description="Template variables")
    scheduled_time: datetime = Field(..., description="When to send the email")
    cc: Optional[str] = Field(None, description="CC email address")
    bcc: Optional[str] = Field(None, description="BCC email address")


class AutomationRuleRequest(BaseModel):
    name: str = Field(..., description="Rule name")
    trigger: str = Field(..., description="Trigger type")
    conditions: Dict[str, Any] = Field(..., description="Rule conditions")
    template_id: str = Field(..., description="Template to use for responses")
    delay_minutes: int = Field(0, description="Delay before sending response")
    max_daily_sends: int = Field(10, description="Maximum daily sends")


# Global scheduler instance
scheduler = None


def get_scheduler() -> EmailScheduler:
    """Get global scheduler instance"""
    global scheduler
    if scheduler is None:
        scheduler = EmailScheduler()
    return scheduler


# ==================== DEFAULT TEMPLATES ====================

def create_default_templates(scheduler: EmailScheduler):
    """Create default email templates"""
    
    default_templates = [
        {
            "name": "Quick Acknowledgment",
            "subject_template": "Re: {subject}",
            "body_template": "Hi {sender_name},\n\nThanks for your email. I've received it and will respond shortly.\n\nBest regards,\nYour Assistant",
            "classification": EmailClass.NEEDS_REPLY,
            "tags": ["acknowledgment", "quick"]
        },
        {
            "name": "Approval Granted", 
            "subject_template": "Re: {subject} - Approved",
            "body_template": "Hi {sender_name},\n\nI approve the request outlined in your email. Please proceed as proposed.\n\nBest regards,\nYour Assistant",
            "classification": EmailClass.APPROVAL_REQUIRED,
            "tags": ["approval", "granted"]
        },
        {
            "name": "Task Acknowledged",
            "subject_template": "Re: {subject} - Task Received",
            "body_template": "Hi {sender_name},\n\nI've noted the task: {first_action}\n\nI'll update you on progress soon.\n\nBest regards,\nYour Assistant",
            "classification": EmailClass.CREATE_TASK,
            "tags": ["task", "acknowledgment"]
        },
        {
            "name": "Delegation Response",
            "subject_template": "Re: {subject} - Delegating",
            "body_template": "Hi {sender_name},\n\nI'll have the appropriate team member handle this and follow up with you on timing.\n\nBest regards,\nYour Assistant",
            "classification": EmailClass.DELEGATE,
            "tags": ["delegation", "team"]
        },
        {
            "name": "Follow-up Update",
            "subject_template": "Re: {subject} - Update",
            "body_template": "Hi {sender_name},\n\nThanks for following up. Here's the current status:\n\n[Status details will be added here]\n\nBest regards,\nYour Assistant",
            "classification": EmailClass.FOLLOW_UP,
            "tags": ["follow-up", "status"]
        }
    ]
    
    created_count = 0
    for template_data in default_templates:
        # Check if template already exists
        existing = [t for t in scheduler.templates.values() if t.name == template_data["name"]]
        if not existing:
            scheduler.create_template(**template_data)
            created_count += 1
    
    if created_count > 0:
        logger.info(f"Created {created_count} default templates")


if __name__ == "__main__":
    # Demo usage
    config = EmailSchedulerConfig()
    scheduler = EmailScheduler(config)
    
    # Create default templates
    create_default_templates(scheduler)
    
    # Demo scheduling an email
    email_id = scheduler.schedule_email(
        to="test@example.com",
        subject="Test Scheduled Email",
        body="This is a test of the email scheduling system.",
        scheduled_time=datetime.now() + timedelta(minutes=1)
    )
    
    print(f"Scheduled email: {email_id}")
    print("Scheduler stats:", scheduler.get_stats())