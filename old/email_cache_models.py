#!/usr/bin/env python3
"""
Email Cache Database Models

SQLModel-based models for high-performance email caching with background AI processing.
Optimized for <200ms API responses with background intelligence.

Architecture:
- Apple Mail DB (read-only) → SQLite Cache → Fast API responses
- Background sync every 5 minutes
- Background AI processing queue
- Email actions sync back to Apple Mail
"""

from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import json

from sqlmodel import SQLModel, Field, create_engine, Session, Column, DateTime, JSON
from sqlalchemy import Index, event
from sqlalchemy.sql import func


class EmailClassification(str, Enum):
    """Email classification types"""
    PERSONAL = "PERSONAL"
    WORK = "WORK"
    PROMOTIONAL = "PROMOTIONAL"
    SOCIAL = "SOCIAL"
    UPDATES = "UPDATES"
    FORUMS = "FORUMS"
    SPAM = "SPAM"
    NEEDS_REPLY = "NEEDS_REPLY"
    APPROVAL_REQUIRED = "APPROVAL_REQUIRED"
    CREATE_TASK = "CREATE_TASK"
    FOLLOW_UP = "FOLLOW_UP"
    INFORMATION_ONLY = "INFORMATION_ONLY"


class EmailUrgency(str, Enum):
    """Email urgency levels"""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class EmailActionType(str, Enum):
    """Email action types for sync back to Apple Mail"""
    SEND = "send"
    DRAFT = "draft"
    DELETE = "delete"
    ARCHIVE = "archive"
    MARK_READ = "mark_read"
    MARK_UNREAD = "mark_unread"
    FLAG = "flag"
    UNFLAG = "unflag"


class EmailCache(SQLModel, table=True):
    """
    High-performance email cache table with AI analysis results.
    
    Optimized for:
    - <200ms query performance
    - Background AI processing
    - Apple Mail sync
    """
    __tablename__ = "emails"
    
    # Primary Key
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Apple Mail References
    apple_mail_id: int = Field(unique=True, index=True, description="Original Apple Mail ROWID")
    apple_document_id: Optional[str] = Field(default=None, index=True, description="Apple Mail document ID")
    
    # Email Content
    subject_text: str = Field(index=True, description="Email subject line")
    sender_email: str = Field(index=True, description="Sender email address")
    sender_name: Optional[str] = Field(default=None, description="Sender display name")
    date_received: datetime = Field(index=True, description="When email was received")
    date_sent: Optional[datetime] = Field(default=None, description="When email was sent")
    content_snippet: Optional[str] = Field(default=None, description="Email content preview")
    size_bytes: Optional[int] = Field(default=None, description="Email size in bytes")
    mailbox_path: Optional[str] = Field(default=None, index=True, description="Mailbox folder path")
    
    # Email Status
    is_read: bool = Field(default=False, index=True, description="Read status")
    is_flagged: bool = Field(default=False, index=True, description="Flagged status")
    is_deleted: bool = Field(default=False, index=True, description="Deleted status")
    
    # AI Analysis Results (cached for performance)
    classification: Optional[EmailClassification] = Field(default=None, index=True, description="AI classification")
    urgency: Optional[EmailUrgency] = Field(default=None, index=True, description="AI urgency assessment")
    confidence: Optional[float] = Field(default=None, description="AI confidence score 0.0-1.0")
    action_items: Optional[str] = Field(default=None, description="JSON array of action items")
    ai_processed_at: Optional[datetime] = Field(default=None, index=True, description="When AI processing completed")
    
    # Sync Management
    last_synced_from_apple: datetime = Field(
        default_factory=datetime.utcnow, 
        index=True,
        description="Last sync from Apple Mail"
    )
    needs_apple_sync: bool = Field(default=False, index=True, description="Needs sync back to Apple Mail")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    updated_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    
    def get_action_items_list(self) -> List[str]:
        """Parse action items JSON to list"""
        if not self.action_items:
            return []
        try:
            return json.loads(self.action_items)
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_action_items_list(self, items: List[str]) -> None:
        """Set action items from list"""
        self.action_items = json.dumps(items) if items else None


class EmailAction(SQLModel, table=True):
    """
    Email actions to be synced back to Apple Mail.
    
    Handles all email operations that need to be applied to Apple Mail:
    - Draft creation/updates
    - Send operations
    - Read/flag status changes
    - Delete/archive operations
    """
    __tablename__ = "email_actions"
    
    # Primary Key
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Email Reference
    email_id: int = Field(foreign_key="emails.id", index=True, description="Reference to cached email")
    
    # Action Details
    action_type: EmailActionType = Field(index=True, description="Type of action to perform")
    action_data: Optional[str] = Field(default=None, description="JSON data for the action")
    
    # Sync Status
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    synced_to_apple: bool = Field(default=False, index=True, description="Successfully synced to Apple Mail")
    sync_attempts: int = Field(default=0, description="Number of sync attempts")
    last_sync_attempt: Optional[datetime] = Field(default=None, description="Last sync attempt timestamp")
    sync_error: Optional[str] = Field(default=None, description="Last sync error message")
    
    def get_action_data_dict(self) -> Dict[str, Any]:
        """Parse action data JSON to dict"""
        if not self.action_data:
            return {}
        try:
            return json.loads(self.action_data)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_action_data_dict(self, data: Dict[str, Any]) -> None:
        """Set action data from dict"""
        self.action_data = json.dumps(data) if data else None


class EmailProcessingQueue(SQLModel, table=True):
    """
    Queue for background AI processing of emails.
    
    Ensures emails are processed efficiently without blocking API responses.
    """
    __tablename__ = "email_processing_queue"
    
    # Primary Key
    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Email Reference
    email_id: int = Field(foreign_key="emails.id", index=True, unique=True, description="Email to process")
    
    # Processing Status
    status: str = Field(default="pending", index=True, description="pending, processing, completed, failed")
    priority: int = Field(default=5, index=True, description="Processing priority (1=highest, 10=lowest)")
    
    # Processing Attempts
    attempts: int = Field(default=0, description="Number of processing attempts")
    max_attempts: int = Field(default=3, description="Maximum processing attempts")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    started_at: Optional[datetime] = Field(default=None, description="When processing started")
    completed_at: Optional[datetime] = Field(default=None, description="When processing completed")
    
    # Error Handling
    last_error: Optional[str] = Field(default=None, description="Last processing error")
    next_retry_after: Optional[datetime] = Field(default=None, index=True, description="When to retry processing")


# Database Configuration and Optimization
def create_optimized_engine(database_url: str = "sqlite:///email_cache.db") -> "Engine":
    """
    Create optimized SQLite engine with performance configurations.
    
    Optimizations:
    - WAL mode for better concurrency
    - Background checkpoints
    - Optimized cache sizes
    - Multi-threading support
    """
    from sqlalchemy import create_engine as sa_create_engine
    from sqlalchemy.pool import StaticPool
    
    # Connection arguments for SQLite optimization
    connect_args = {
        "check_same_thread": False,  # Allow multi-threading
        "timeout": 30,  # Connection timeout
    }
    
    # Create engine with optimizations
    engine = sa_create_engine(
        database_url,
        connect_args=connect_args,
        poolclass=StaticPool,  # Better for SQLite
        pool_pre_ping=True,  # Verify connections
        echo=False,  # Set to True for debugging
    )
    
    # Configure SQLite optimizations
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        """Set SQLite pragmas for optimal performance"""
        cursor = dbapi_connection.cursor()
        
        # WAL mode for better concurrency (can reduce overhead from 30ms+ to <1ms)
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=normal")
        cursor.execute("PRAGMA journal_size_limit=6144000")  # 6MB WAL limit
        
        # Performance optimizations
        cursor.execute("PRAGMA cache_size=10000")  # 10MB cache
        cursor.execute("PRAGMA temp_store=memory")  # Use memory for temp tables
        cursor.execute("PRAGMA mmap_size=134217728")  # 128MB memory map
        
        # Optimize for reads
        cursor.execute("PRAGMA query_only=false")  # Allow writes
        cursor.execute("PRAGMA read_uncommitted=true")  # Faster reads
        
        cursor.close()
    
    return engine


def create_database_indexes(engine: "Engine") -> None:
    """
    Create additional performance indexes beyond SQLModel defaults.
    
    These indexes are optimized for common query patterns:
    - Email listing by date
    - Search by sender/subject
    - AI classification filtering
    - Sync status queries
    """
    with engine.connect() as conn:
        # Composite indexes for common query patterns
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_emails_classification_urgency 
            ON emails(classification, urgency) WHERE classification IS NOT NULL
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_emails_date_received_read 
            ON emails(date_received DESC, is_read)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_emails_sender_date 
            ON emails(sender_email, date_received DESC)
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_emails_sync_status 
            ON emails(needs_apple_sync, last_synced_from_apple) WHERE needs_apple_sync = true
        """)
        
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_emails_ai_processing 
            ON emails(ai_processed_at, classification) WHERE ai_processed_at IS NULL
        """)
        
        # Full-text search index for email content
        conn.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS email_search USING fts5(
                subject_text, 
                sender_email, 
                sender_name, 
                content_snippet,
                content_id UNINDEXED  -- Reference to emails.id
            )
        """)
        
        # Action queue optimization
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_actions_sync_status 
            ON email_actions(synced_to_apple, created_at) WHERE synced_to_apple = false
        """)
        
        # Processing queue optimization
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_processing_queue_status 
            ON email_processing_queue(status, priority, created_at) WHERE status = 'pending'
        """)
        
        conn.commit()


def init_database(database_url: str = "sqlite:///email_cache.db") -> "Engine":
    """
    Initialize the email cache database with all optimizations.
    
    Returns:
        Configured and optimized SQLAlchemy engine
    """
    # Create optimized engine
    engine = create_optimized_engine(database_url)
    
    # Create all tables
    SQLModel.metadata.create_all(engine)
    
    # Create performance indexes
    create_database_indexes(engine)
    
    return engine


# Utility Functions
def get_session(engine: "Engine") -> Session:
    """Get a database session with proper configuration"""
    return Session(engine)


def update_email_timestamp(mapper, connection, target):
    """Update the updated_at timestamp on email changes"""
    target.updated_at = datetime.utcnow()


# Configure automatic timestamp updates
event.listen(EmailCache, 'before_update', update_email_timestamp)


if __name__ == "__main__":
    # Example usage and testing
    print("Initializing email cache database...")
    engine = init_database()
    
    print("Database initialized successfully!")
    print("Tables created:")
    for table_name in SQLModel.metadata.tables.keys():
        print(f"  - {table_name}")
    
    # Test basic operations
    with get_session(engine) as session:
        # Test email cache insertion
        test_email = EmailCache(
            apple_mail_id=12345,
            subject_text="Test Email",
            sender_email="test@example.com",
            date_received=datetime.utcnow(),
            classification=EmailClassification.WORK,
            urgency=EmailUrgency.MEDIUM,
            confidence=0.85
        )
        
        session.add(test_email)
        session.commit()
        session.refresh(test_email)
        
        print(f"Test email created with ID: {test_email.id}")
        
        # Test query performance
        import time
        start_time = time.time()
        
        emails = session.query(EmailCache).filter(
            EmailCache.classification == EmailClassification.WORK
        ).limit(10).all()
        
        query_time = (time.time() - start_time) * 1000  # Convert to ms
        print(f"Query completed in {query_time:.2f}ms")
        print(f"Found {len(emails)} work emails")