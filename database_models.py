#!/usr/bin/env python3
"""
SQLAlchemy Database Models for Email Intelligence System
Production-ready models optimized for 10k+ email processing
"""

from datetime import datetime, date
from typing import List, Optional, Dict, Any
import json

from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime, Date, Boolean, 
    Numeric, JSON, ForeignKey, Index, UniqueConstraint, CheckConstraint,
    func, text
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property

# Base class for all models
Base = declarative_base()

# ============================================================================
# Core Email Models
# ============================================================================

class Email(Base):
    """Main emails table - stores core email data"""
    __tablename__ = 'emails'
    
    # Primary identifiers
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    message_id = Column(BigInteger, unique=True, nullable=False, index=True)
    apple_document_id = Column(String(255), index=True)
    
    # Core email fields
    subject_text = Column(Text, nullable=False, default='')
    sender_email = Column(String(255), nullable=False, index=True)
    sender_name = Column(String(255), default='')
    
    # Recipients (stored as JSON for flexibility)
    to_addresses = Column(JSONB, default=list)
    cc_addresses = Column(JSONB, default=list)
    bcc_addresses = Column(JSONB, default=list)
    
    # Timestamps - critical for performance
    date_sent = Column(DateTime(timezone=True))
    date_received = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    # Status flags
    is_read = Column(Boolean, default=False, index=True)
    is_flagged = Column(Boolean, default=False, index=True)
    is_deleted = Column(Boolean, default=False, index=True)
    
    # Email metadata
    mailbox_path = Column(Text)
    size_bytes = Column(Integer, default=0)
    thread_id = Column(String(255), index=True)
    in_reply_to = Column(String(255))
    
    # Content fields
    snippet = Column(Text)  # First 500 chars for preview
    full_content = Column(Text)
    attachments = Column(JSONB, default=list)  # List of attachment info
    
    # Processing status
    processing_status = Column(
        String(20), 
        default='pending',
        index=True
    )
    processed_at = Column(DateTime(timezone=True))
    
    # Partitioning helper (for PostgreSQL partitioning)
    date_partition = Column(Date, index=True)
    
    # Relationships
    intelligence = relationship("EmailIntelligence", back_populates="email", uselist=False)
    tasks = relationship("EmailTask", back_populates="email")
    
    # Indexes for common queries
    __table_args__ = (
        Index('idx_emails_date_received_desc', 'date_received', postgresql_using='btree'),
        Index('idx_emails_sender_date', 'sender_email', 'date_received'),
        Index('idx_emails_unread', 'is_read', postgresql_where=text('is_read = false')),
        Index('idx_emails_processing_pending', 'processing_status', 
              postgresql_where=text("processing_status != 'completed'")),
        Index('idx_emails_subject_gin', func.to_tsvector('english', 'subject_text'), 
              postgresql_using='gin'),
        CheckConstraint("processing_status IN ('pending', 'processing', 'completed', 'failed')",
                       name='check_processing_status'),
    )
    
    @validates('processing_status')
    def validate_processing_status(self, key, status):
        valid_statuses = ['pending', 'processing', 'completed', 'failed']
        if status not in valid_statuses:
            raise ValueError(f"Invalid processing status: {status}")
        return status
    
    @hybrid_property
    def days_since_received(self):
        """Days since email was received"""
        if self.date_received:
            return (datetime.now() - self.date_received).days
        return None
    
    def __repr__(self):
        return f"<Email(id={self.id}, subject='{self.subject_text[:50]}...', from='{self.sender_email}')>"

class EmailIntelligence(Base):
    """AI analysis results for emails"""
    __tablename__ = 'email_intelligence'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    email_id = Column(BigInteger, ForeignKey('emails.id', ondelete='CASCADE'), 
                     nullable=False, unique=True)
    
    # AI Classification Results
    classification = Column(String(50), nullable=False, index=True)
    urgency = Column(String(20), nullable=False, index=True)
    sentiment = Column(String(20), nullable=False)
    intent = Column(Text)
    
    # Confidence scores (0.0 to 1.0)
    classification_confidence = Column(Numeric(5, 4), nullable=False, default=0.5)
    urgency_confidence = Column(Numeric(5, 4), default=0.5)
    sentiment_confidence = Column(Numeric(5, 4), default=0.5)
    overall_confidence = Column(Numeric(5, 4), default=0.5, index=True)
    
    # Processing metadata
    processing_time_ms = Column(Integer, default=0)
    ai_model_used = Column(String(100))
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    # Structured data fields
    action_items = Column(JSONB, default=list)  # ["Review proposal", "Schedule meeting"]
    deadlines = Column(JSONB, default=list)     # [{"task": "Review", "date": "2024-12-15"}]
    confidence_scores = Column(JSONB, default=dict)  # Detailed breakdown
    key_entities = Column(JSONB, default=list)  # People, companies, dates
    
    # Generated responses
    draft_reply = Column(Text)
    draft_generated_at = Column(DateTime(timezone=True))
    
    # AI model outputs
    summary = Column(Text)  # One-line summary
    detailed_summary = Column(Text)  # Comprehensive summary
    context_analysis = Column(Text)  # Relationship and history context
    priority_reasoning = Column(Text)  # Why this priority was assigned
    
    # Relationship
    email = relationship("Email", back_populates="intelligence")
    
    __table_args__ = (
        Index('idx_intelligence_classification', 'classification'),
        Index('idx_intelligence_urgency', 'urgency'),
        Index('idx_intelligence_confidence_desc', 'overall_confidence', postgresql_using='btree'),
        Index('idx_intelligence_created_desc', 'created_at', postgresql_using='btree'),
        CheckConstraint("classification IN ('needs_reply', 'approval_required', 'create_task', "
                       "'delegate', 'fyi', 'meeting', 'newsletter', 'automated')",
                       name='check_classification'),
        CheckConstraint("urgency IN ('critical', 'high', 'medium', 'low')",
                       name='check_urgency'),
        CheckConstraint("sentiment IN ('positive', 'negative', 'neutral', 'concerned', "
                       "'excited', 'frustrated')", name='check_sentiment'),
        CheckConstraint("overall_confidence >= 0.0 AND overall_confidence <= 1.0",
                       name='check_confidence_range'),
    )
    
    @validates('action_items', 'deadlines', 'key_entities')
    def validate_json_lists(self, key, value):
        """Ensure JSON fields are lists"""
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError(f"{key} must be a list")
        return value
    
    @validates('confidence_scores')
    def validate_confidence_scores(self, key, value):
        """Ensure confidence_scores is a dict"""
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise ValueError("confidence_scores must be a dictionary")
        return value
    
    def __repr__(self):
        return (f"<EmailIntelligence(email_id={self.email_id}, "
                f"classification='{self.classification}', urgency='{self.urgency}')>")

# ============================================================================
# Task Management Models
# ============================================================================

class EmailTask(Base):
    """Tasks extracted from emails"""
    __tablename__ = 'email_tasks'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    task_id = Column(String(100), unique=True, nullable=False)  # email_id + task_index
    email_id = Column(BigInteger, ForeignKey('emails.id', ondelete='CASCADE'), 
                     nullable=False, index=True)
    
    # Task details
    subject = Column(Text, nullable=False)
    description = Column(Text, nullable=False)
    task_type = Column(String(50), nullable=False, index=True)  # reply, approval, development, etc.
    priority = Column(String(20), nullable=False, index=True)   # CRITICAL, HIGH, MEDIUM, LOW
    
    # Assignment and scheduling
    assignee = Column(String(255), index=True)
    due_date = Column(DateTime(timezone=True), index=True)
    estimated_hours = Column(Integer)
    
    # Status tracking
    status = Column(String(20), default='pending', index=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    # Task metadata
    confidence = Column(Numeric(5, 4), default=0.5)
    extracted_from_action_item = Column(Integer)  # Index in action_items array
    dependencies = Column(JSONB, default=list)   # Task dependencies
    tags = Column(JSONB, default=list)           # Categorization tags
    
    # Relationship
    email = relationship("Email", back_populates="tasks")
    
    __table_args__ = (
        Index('idx_tasks_status_pending', 'status', 
              postgresql_where=text("status IN ('pending', 'in-progress')")),
        Index('idx_tasks_priority_due', 'priority', 'due_date',
              postgresql_where=text("status != 'completed'")),
        Index('idx_tasks_assignee', 'assignee', 
              postgresql_where=text('assignee IS NOT NULL')),
        CheckConstraint("task_type IN ('reply', 'approval', 'development', 'delegation', "
                       "'follow-up', 'meeting', 'review')", name='check_task_type'),
        CheckConstraint("priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')",
                       name='check_priority'),
        CheckConstraint("status IN ('pending', 'in-progress', 'completed', 'cancelled', 'archived')",
                       name='check_task_status'),
    )
    
    @hybrid_property
    def is_overdue(self):
        """Check if task is overdue"""
        return (self.due_date and self.due_date < datetime.now() 
                and self.status not in ['completed', 'cancelled'])
    
    @hybrid_property
    def days_until_due(self):
        """Days until due date"""
        if self.due_date:
            return (self.due_date - datetime.now()).days
        return None
    
    def __repr__(self):
        return (f"<EmailTask(id={self.id}, subject='{self.subject[:30]}...', "
                f"priority='{self.priority}', status='{self.status}')>")

# ============================================================================
# Batch Processing Models
# ============================================================================

class EmailBatch(Base):
    """Batch processing tracking"""
    __tablename__ = 'email_batches'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    batch_name = Column(String(100), nullable=False)
    
    # Batch scope
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    
    # Processing metrics
    total_emails = Column(Integer, default=0)
    processed_emails = Column(Integer, default=0)
    failed_emails = Column(Integer, default=0)
    skipped_emails = Column(Integer, default=0)
    
    # Status and timing
    status = Column(String(20), default='pending', index=True)
    started_at = Column(DateTime(timezone=True), default=func.now())
    completed_at = Column(DateTime(timezone=True))
    processing_time_seconds = Column(Integer)
    
    # Error tracking
    error_count = Column(Integer, default=0)
    last_error = Column(Text)
    error_details = Column(JSONB, default=list)  # List of error descriptions
    
    # Configuration used
    config = Column(JSONB, default=dict)
    
    __table_args__ = (
        Index('idx_batches_status_started', 'status', 'started_at'),
        Index('idx_batches_date_range', 'start_date', 'end_date'),
        CheckConstraint("status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')",
                       name='check_batch_status'),
        CheckConstraint('end_date >= start_date', name='check_date_range'),
    )
    
    @hybrid_property
    def success_rate(self):
        """Calculate batch success rate"""
        if self.total_emails > 0:
            return (self.processed_emails / self.total_emails) * 100
        return 0.0
    
    @hybrid_property
    def processing_rate(self):
        """Emails processed per second"""
        if self.processing_time_seconds and self.processing_time_seconds > 0:
            return self.processed_emails / self.processing_time_seconds
        return 0.0
    
    def __repr__(self):
        return (f"<EmailBatch(id={self.id}, name='{self.batch_name}', "
                f"status='{self.status}', emails={self.processed_emails}/{self.total_emails})>")

# ============================================================================
# Performance and Monitoring Models
# ============================================================================

class PerformanceMetric(Base):
    """System performance monitoring"""
    __tablename__ = 'performance_metrics'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    metric_date = Column(Date, nullable=False, index=True)
    metric_hour = Column(Integer, nullable=False)  # 0-23 for hourly granularity
    
    # Processing metrics
    emails_processed = Column(Integer, default=0)
    average_processing_time_ms = Column(Numeric(8, 2), default=0)
    classification_accuracy = Column(Numeric(5, 4))
    
    # System metrics
    memory_usage_mb = Column(Integer)
    cpu_usage_percent = Column(Numeric(5, 2))
    disk_usage_gb = Column(Numeric(8, 2))
    
    # Business metrics
    urgent_emails_detected = Column(Integer, default=0)
    tasks_generated = Column(Integer, default=0)
    drafts_generated = Column(Integer, default=0)
    
    # API metrics
    api_requests_total = Column(Integer, default=0)
    api_errors_total = Column(Integer, default=0)
    websocket_connections = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    
    __table_args__ = (
        UniqueConstraint('metric_date', 'metric_hour', name='uq_metric_time'),
        Index('idx_metrics_date_hour_desc', 'metric_date', 'metric_hour', postgresql_using='btree'),
        CheckConstraint('metric_hour >= 0 AND metric_hour <= 23', name='check_hour_range'),
    )
    
    def __repr__(self):
        return (f"<PerformanceMetric(date={self.metric_date}, hour={self.metric_hour}, "
                f"emails={self.emails_processed})>")

class SystemAlert(Base):
    """System alerts and notifications"""
    __tablename__ = 'system_alerts'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    alert_type = Column(String(50), nullable=False, index=True)  # error, warning, info
    severity = Column(String(20), nullable=False, index=True)    # critical, high, medium, low
    
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    source = Column(String(100))  # component that generated the alert
    
    # Alert metadata
    created_at = Column(DateTime(timezone=True), default=func.now())
    acknowledged_at = Column(DateTime(timezone=True))
    resolved_at = Column(DateTime(timezone=True))
    
    # Additional context
    context_data = Column(JSONB, default=dict)
    
    __table_args__ = (
        Index('idx_alerts_type_severity', 'alert_type', 'severity'),
        Index('idx_alerts_unresolved', 'resolved_at', 
              postgresql_where=text('resolved_at IS NULL')),
        CheckConstraint("alert_type IN ('error', 'warning', 'info')", name='check_alert_type'),
        CheckConstraint("severity IN ('critical', 'high', 'medium', 'low')", 
                       name='check_severity'),
    )

# ============================================================================
# User and Configuration Models
# ============================================================================

class UserPreference(Base):
    """User preferences and settings"""
    __tablename__ = 'user_preferences'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(String(100), nullable=False, unique=True)
    
    # Email processing preferences
    default_batch_size = Column(Integer, default=100)
    auto_process_new = Column(Boolean, default=True)
    urgency_threshold = Column(String(20), default='medium')
    
    # Notification preferences
    email_notifications = Column(Boolean, default=True)
    websocket_notifications = Column(Boolean, default=True)
    notification_types = Column(JSONB, default=list)  # ['urgent', 'tasks', 'failures']
    
    # UI preferences
    ui_theme = Column(String(20), default='light')
    items_per_page = Column(Integer, default=50)
    default_email_view = Column(String(20), default='list')  # list, cards, compact
    
    # AI preferences
    ai_confidence_threshold = Column(Numeric(3, 2), default=0.7)
    auto_generate_responses = Column(Boolean, default=False)
    preferred_response_tone = Column(String(20), default='professional')
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<UserPreference(user_id='{self.user_id}')>"

class SystemConfig(Base):
    """System-wide configuration"""
    __tablename__ = 'system_config'
    
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    config_key = Column(String(100), nullable=False, unique=True)
    config_value = Column(Text, nullable=False)
    value_type = Column(String(20), default='string')  # string, integer, boolean, json
    description = Column(Text)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    def __repr__(self):
        return f"<SystemConfig(key='{self.config_key}', value='{self.config_value[:50]}...')>"

# ============================================================================
# Views and Virtual Tables
# ============================================================================

# These would be created as database views, but defined here for reference

class EmailSummaryView:
    """Virtual view for email summaries (created as DB view)"""
    # This represents the view created in the SQL schema
    # Used for documentation and type hints
    pass

class TaskSummaryView:
    """Virtual view for task summaries (created as DB view)"""
    # This represents the view created in the SQL schema
    pass

class DailyStatsView:
    """Virtual view for daily statistics (created as DB view)"""
    # This represents the view created in the SQL schema
    pass

# ============================================================================
# Helper Functions
# ============================================================================

def create_task_id(email_id: int, task_index: int) -> str:
    """Generate unique task ID"""
    return f"email_{email_id}_task_{task_index}"

def parse_task_id(task_id: str) -> tuple:
    """Parse task ID to get email_id and task_index"""
    parts = task_id.split('_')
    if len(parts) >= 4:
        email_id = int(parts[1])
        task_index = int(parts[3])
        return email_id, task_index
    raise ValueError(f"Invalid task_id format: {task_id}")

# ============================================================================
# Model Validation and Constraints
# ============================================================================

# Additional model-level validations can be added here
# These complement the database constraints

def validate_email_address(email: str) -> bool:
    """Basic email validation"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_urgency_level(urgency: str) -> bool:
    """Validate urgency level"""
    valid_levels = ['critical', 'high', 'medium', 'low']
    return urgency.lower() in valid_levels

def validate_classification(classification: str) -> bool:
    """Validate email classification"""
    valid_classifications = [
        'needs_reply', 'approval_required', 'create_task', 'delegate',
        'fyi', 'meeting', 'newsletter', 'automated'
    ]
    return classification.lower() in valid_classifications