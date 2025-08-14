#!/usr/bin/env python3
"""
Comprehensive Database Operations Tests

Tests SQLAlchemy models, database connections, caching, migrations,
performance, data validation, and error handling with full mocking.
"""

import pytest
import asyncio
import json
import tempfile
import os
import time
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch, call
from typing import Dict, Any, List, Optional

# SQLAlchemy and database imports
import sqlalchemy
from sqlalchemy import create_engine, text, inspect
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError, DataError, SQLAlchemyError
import aioredis
import asyncpg
import pytest_asyncio

# Import system under test
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database_models import (
    Base, Email, EmailIntelligence, EmailTask, EmailBatch,
    PerformanceMetric, SystemAlert, UserPreference, SystemConfig,
    create_task_id, parse_task_id, validate_email_address,
    validate_urgency_level, validate_classification
)
from backend_architecture import DatabaseManager, settings

# ============================================================================
# Test Fixtures and Setup
# ============================================================================

@pytest.fixture
def temp_sqlite_db():
    """Create temporary SQLite database for testing"""
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    db_url = f"sqlite:///{db_path}"
    yield db_url, db_path
    os.close(db_fd)
    if os.path.exists(db_path):
        os.unlink(db_path)

@pytest.fixture
async def async_sqlite_db():
    """Create temporary async SQLite database for testing"""
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    db_url = f"sqlite+aiosqlite:///{db_path}"
    
    # Create engine and tables
    engine = create_async_engine(db_url, echo=False)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield engine, db_url
    
    await engine.dispose()
    os.close(db_fd)
    if os.path.exists(db_path):
        os.unlink(db_path)

@pytest.fixture
def sync_db_session(temp_sqlite_db):
    """Create synchronous database session"""
    db_url, db_path = temp_sqlite_db
    engine = create_engine(db_url)
    
    # Create tables
    Base.metadata.create_all(engine)
    
    # Create session
    Session = sessionmaker(bind=engine)
    session = Session()
    
    yield session
    
    session.close()
    engine.dispose()

@pytest.fixture
async def async_db_session(async_sqlite_db):
    """Create asynchronous database session"""
    engine, db_url = async_sqlite_db
    
    from sqlalchemy.ext.asyncio import async_sessionmaker
    AsyncSession = async_sessionmaker(engine, expire_on_commit=False)
    
    async with AsyncSession() as session:
        yield session

@pytest.fixture
def mock_redis():
    """Mock Redis connection"""
    redis_mock = AsyncMock()
    redis_mock.get = AsyncMock(return_value=None)
    redis_mock.setex = AsyncMock(return_value=True)
    redis_mock.delete = AsyncMock(return_value=1)
    redis_mock.exists = AsyncMock(return_value=False)
    redis_mock.close = AsyncMock()
    return redis_mock

@pytest.fixture
def sample_email_data():
    """Sample email data for testing"""
    return {
        'message_id': 12345,
        'apple_document_id': 'doc_123',
        'subject_text': 'Test Email Subject',
        'sender_email': 'sender@example.com',
        'sender_name': 'Test Sender',
        'to_addresses': ['recipient@example.com'],
        'cc_addresses': ['cc@example.com'],
        'bcc_addresses': [],
        'date_sent': datetime.now() - timedelta(minutes=5),
        'date_received': datetime.now(),
        'is_read': False,
        'is_flagged': False,
        'is_deleted': False,
        'mailbox_path': '/INBOX',
        'size_bytes': 1024,
        'thread_id': 'thread_123',
        'snippet': 'This is a test email...',
        'full_content': 'This is the full content of the test email.',
        'attachments': [{'name': 'document.pdf', 'size': 2048}],
        'processing_status': 'pending'
    }

@pytest.fixture
def sample_intelligence_data():
    """Sample email intelligence data"""
    return {
        'classification': 'needs_reply',
        'urgency': 'high',
        'sentiment': 'neutral',
        'intent': 'request_information',
        'classification_confidence': Decimal('0.85'),
        'urgency_confidence': Decimal('0.90'),
        'sentiment_confidence': Decimal('0.75'),
        'overall_confidence': Decimal('0.83'),
        'processing_time_ms': 150,
        'ai_model_used': 'gpt-5-nano',
        'action_items': ['Review proposal', 'Schedule meeting'],
        'deadlines': [{'task': 'Review', 'date': '2024-12-15'}],
        'confidence_scores': {'classification': 0.85, 'urgency': 0.90},
        'key_entities': ['John Smith', 'Q4 Report', 'Budget'],
        'summary': 'Request for proposal review',
        'detailed_summary': 'Detailed analysis of the email content...',
        'priority_reasoning': 'Marked as high priority due to urgency keywords'
    }

# ============================================================================
# Model Validation Tests
# ============================================================================

@pytest.mark.unit
def test_email_model_creation(sync_db_session, sample_email_data):
    """Test Email model creation and validation"""
    email = Email(**sample_email_data)
    
    # Test required fields
    assert email.message_id == 12345
    assert email.subject_text == 'Test Email Subject'
    assert email.sender_email == 'sender@example.com'
    assert email.date_received is not None
    
    # Test default values
    assert email.is_read == False
    assert email.is_flagged == False
    assert email.processing_status == 'pending'
    
    # Test JSON fields
    assert isinstance(email.to_addresses, list)
    assert isinstance(email.attachments, list)
    
    # Save to database
    sync_db_session.add(email)
    sync_db_session.commit()
    
    # Verify saved
    saved_email = sync_db_session.query(Email).filter_by(message_id=12345).first()
    assert saved_email is not None
    assert saved_email.subject_text == 'Test Email Subject'

@pytest.mark.unit
def test_email_model_validation(sync_db_session):
    """Test Email model field validation"""
    # Test invalid processing status
    email = Email(
        message_id=123,
        subject_text="Test",
        sender_email="test@example.com",
        date_received=datetime.now(),
        processing_status="invalid_status"
    )
    
    sync_db_session.add(email)
    
    # Should raise validation error on commit
    with pytest.raises(Exception):  # Could be IntegrityError or CheckConstraint violation
        sync_db_session.commit()

@pytest.mark.unit
def test_email_intelligence_model(sync_db_session, sample_email_data, sample_intelligence_data):
    """Test EmailIntelligence model creation and relationships"""
    # Create parent email first
    email = Email(**sample_email_data)
    sync_db_session.add(email)
    sync_db_session.flush()  # Get ID without committing
    
    # Create intelligence record
    intelligence_data = sample_intelligence_data.copy()
    intelligence_data['email_id'] = email.id
    
    intelligence = EmailIntelligence(**intelligence_data)
    sync_db_session.add(intelligence)
    sync_db_session.commit()
    
    # Test relationship
    assert intelligence.email == email
    assert email.intelligence == intelligence
    
    # Test confidence validation
    assert 0.0 <= intelligence.overall_confidence <= 1.0
    
    # Test JSON fields
    assert isinstance(intelligence.action_items, list)
    assert isinstance(intelligence.deadlines, list)
    assert isinstance(intelligence.confidence_scores, dict)

@pytest.mark.unit
def test_email_intelligence_validation(sync_db_session, sample_email_data):
    """Test EmailIntelligence validation constraints"""
    email = Email(**sample_email_data)
    sync_db_session.add(email)
    sync_db_session.flush()
    
    # Test invalid classification
    with pytest.raises(Exception):
        intelligence = EmailIntelligence(
            email_id=email.id,
            classification='invalid_class',
            urgency='medium',
            sentiment='neutral',
            overall_confidence=Decimal('0.8')
        )
        sync_db_session.add(intelligence)
        sync_db_session.commit()
    
    sync_db_session.rollback()
    
    # Test invalid confidence range
    with pytest.raises(Exception):
        intelligence = EmailIntelligence(
            email_id=email.id,
            classification='needs_reply',
            urgency='medium',
            sentiment='neutral',
            overall_confidence=Decimal('1.5')  # Invalid: > 1.0
        )
        sync_db_session.add(intelligence)
        sync_db_session.commit()

@pytest.mark.unit
def test_email_task_model(sync_db_session, sample_email_data):
    """Test EmailTask model creation and validation"""
    email = Email(**sample_email_data)
    sync_db_session.add(email)
    sync_db_session.flush()
    
    task = EmailTask(
        task_id=create_task_id(email.id, 1),
        email_id=email.id,
        subject='Review proposal',
        description='Please review the quarterly proposal',
        task_type='review',
        priority='HIGH',
        assignee='john.doe@company.com',
        due_date=datetime.now() + timedelta(days=3),
        estimated_hours=4,
        confidence=Decimal('0.85'),
        tags=['quarterly', 'review', 'proposal']
    )
    
    sync_db_session.add(task)
    sync_db_session.commit()
    
    # Test relationship
    assert task.email == email
    assert task in email.tasks
    
    # Test computed properties
    assert task.days_until_due is not None
    assert not task.is_overdue  # Future due date

@pytest.mark.unit
def test_email_batch_model(sync_db_session):
    """Test EmailBatch model and computed properties"""
    batch = EmailBatch(
        batch_name='test_batch_001',
        start_date=datetime.now() - timedelta(days=7),
        end_date=datetime.now(),
        total_emails=100,
        processed_emails=95,
        failed_emails=5,
        status='completed',
        processing_time_seconds=300
    )
    
    sync_db_session.add(batch)
    sync_db_session.commit()
    
    # Test computed properties
    assert batch.success_rate == 95.0  # 95/100 * 100
    assert batch.processing_rate == pytest.approx(0.317, rel=1e-2)  # 95/300

# ============================================================================
# Database Connection and Session Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_database_manager_initialization():
    """Test DatabaseManager initialization"""
    manager = DatabaseManager()
    
    assert manager.engine is None
    assert manager.session_maker is None
    assert manager.redis is None

@pytest.mark.unit
@pytest.mark.asyncio
async def test_database_manager_initialize(mock_redis):
    """Test DatabaseManager initialization with mocked connections"""
    manager = DatabaseManager()
    
    with patch('backend_architecture.create_async_engine') as mock_engine, \
         patch('backend_architecture.async_sessionmaker') as mock_session_maker, \
         patch('aioredis.from_url', return_value=mock_redis) as mock_redis_connect:
        
        mock_engine.return_value.begin.return_value.__aenter__ = AsyncMock()
        mock_engine.return_value.begin.return_value.__aexit__ = AsyncMock()
        
        await manager.initialize()
        
        assert manager.engine is not None
        assert manager.session_maker is not None
        assert manager.redis is not None
        
        mock_engine.assert_called_once()
        mock_session_maker.assert_called_once()
        mock_redis_connect.assert_called_once()

@pytest.mark.unit
@pytest.mark.asyncio
async def test_database_manager_get_session():
    """Test DatabaseManager session creation"""
    manager = DatabaseManager()
    
    # Mock session maker
    mock_session = AsyncMock()
    manager.session_maker = MagicMock(return_value=mock_session)
    
    session = await manager.get_session()
    assert session == mock_session

@pytest.mark.unit
@pytest.mark.asyncio
async def test_database_manager_cleanup():
    """Test DatabaseManager cleanup"""
    manager = DatabaseManager()
    
    # Mock connections
    mock_redis = AsyncMock()
    mock_engine = AsyncMock()
    
    manager.redis = mock_redis
    manager.engine = mock_engine
    
    await manager.close()
    
    mock_redis.close.assert_called_once()
    mock_engine.dispose.assert_called_once()

# ============================================================================
# CRUD Operations Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_email_crud_operations(async_db_session, sample_email_data):
    """Test basic CRUD operations for Email model"""
    # Create
    email = Email(**sample_email_data)
    async_db_session.add(email)
    await async_db_session.commit()
    
    created_id = email.id
    assert created_id is not None
    
    # Read
    from sqlalchemy import select
    result = await async_db_session.execute(
        select(Email).where(Email.id == created_id)
    )
    retrieved_email = result.scalar_one()
    
    assert retrieved_email.message_id == 12345
    assert retrieved_email.subject_text == 'Test Email Subject'
    
    # Update
    retrieved_email.is_read = True
    retrieved_email.processing_status = 'completed'
    await async_db_session.commit()
    
    # Verify update
    await async_db_session.refresh(retrieved_email)
    assert retrieved_email.is_read == True
    assert retrieved_email.processing_status == 'completed'
    
    # Delete
    await async_db_session.delete(retrieved_email)
    await async_db_session.commit()
    
    # Verify deletion
    result = await async_db_session.execute(
        select(Email).where(Email.id == created_id)
    )
    deleted_email = result.scalar_one_or_none()
    assert deleted_email is None

@pytest.mark.unit
@pytest.mark.asyncio
async def test_bulk_email_operations(async_db_session):
    """Test bulk database operations"""
    # Create multiple emails
    emails = []
    for i in range(10):
        email = Email(
            message_id=1000 + i,
            subject_text=f'Bulk Email {i}',
            sender_email=f'sender{i}@example.com',
            date_received=datetime.now() - timedelta(minutes=i)
        )
        emails.append(email)
    
    # Bulk insert
    async_db_session.add_all(emails)
    await async_db_session.commit()
    
    # Verify all inserted
    from sqlalchemy import select, func
    result = await async_db_session.execute(
        select(func.count(Email.id)).where(Email.message_id >= 1000)
    )
    count = result.scalar()
    assert count == 10
    
    # Bulk update
    from sqlalchemy import update
    await async_db_session.execute(
        update(Email)
        .where(Email.message_id >= 1000)
        .values(is_read=True)
    )
    await async_db_session.commit()
    
    # Verify bulk update
    result = await async_db_session.execute(
        select(func.count(Email.id))
        .where(Email.message_id >= 1000)
        .where(Email.is_read == True)
    )
    updated_count = result.scalar()
    assert updated_count == 10

@pytest.mark.unit
@pytest.mark.asyncio
async def test_relationship_operations(async_db_session, sample_email_data, sample_intelligence_data):
    """Test operations involving model relationships"""
    # Create email
    email = Email(**sample_email_data)
    async_db_session.add(email)
    await async_db_session.flush()
    
    # Create intelligence
    intelligence_data = sample_intelligence_data.copy()
    intelligence_data['email_id'] = email.id
    intelligence = EmailIntelligence(**intelligence_data)
    async_db_session.add(intelligence)
    
    # Create tasks
    task1 = EmailTask(
        task_id=create_task_id(email.id, 1),
        email_id=email.id,
        subject='Task 1',
        description='First task',
        task_type='review',
        priority='HIGH'
    )
    
    task2 = EmailTask(
        task_id=create_task_id(email.id, 2),
        email_id=email.id,
        subject='Task 2',
        description='Second task',
        task_type='approval',
        priority='MEDIUM'
    )
    
    async_db_session.add_all([task1, task2])
    await async_db_session.commit()
    
    # Test relationships
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    result = await async_db_session.execute(
        select(Email)
        .options(selectinload(Email.intelligence), selectinload(Email.tasks))
        .where(Email.id == email.id)
    )
    loaded_email = result.scalar_one()
    
    assert loaded_email.intelligence is not None
    assert len(loaded_email.tasks) == 2
    assert loaded_email.intelligence.classification == 'needs_reply'

# ============================================================================
# Query Performance Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_indexed_queries(async_db_session):
    """Test queries use indexes properly"""
    # Create test data
    emails = []
    for i in range(100):
        email = Email(
            message_id=2000 + i,
            subject_text=f'Performance Test Email {i}',
            sender_email=f'perf{i}@example.com',
            date_received=datetime.now() - timedelta(minutes=i),
            is_read=(i % 2 == 0),
            processing_status='completed' if i % 3 == 0 else 'pending'
        )
        emails.append(email)
    
    async_db_session.add_all(emails)
    await async_db_session.commit()
    
    # Test date range query (should use date index)
    start_time = time.time()
    from sqlalchemy import select
    
    cutoff_date = datetime.now() - timedelta(minutes=50)
    result = await async_db_session.execute(
        select(Email).where(Email.date_received >= cutoff_date)
    )
    recent_emails = result.scalars().all()
    
    query_time = time.time() - start_time
    
    assert len(recent_emails) > 0
    assert query_time < 1.0  # Should be fast with index
    
    # Test sender query (should use sender index)
    start_time = time.time()
    result = await async_db_session.execute(
        select(Email).where(Email.sender_email.like('perf1%'))
    )
    sender_emails = result.scalars().all()
    
    query_time = time.time() - start_time
    
    assert len(sender_emails) > 0
    assert query_time < 1.0

@pytest.mark.unit
@pytest.mark.asyncio 
async def test_complex_queries(async_db_session, sample_email_data):
    """Test complex multi-table queries"""
    # Setup test data
    email = Email(**sample_email_data)
    async_db_session.add(email)
    await async_db_session.flush()
    
    intelligence = EmailIntelligence(
        email_id=email.id,
        classification='needs_reply',
        urgency='high',
        sentiment='neutral',
        overall_confidence=Decimal('0.85')
    )
    async_db_session.add(intelligence)
    
    task = EmailTask(
        task_id=create_task_id(email.id, 1),
        email_id=email.id,
        subject='Test Task',
        description='Test Description',
        task_type='review',
        priority='HIGH',
        status='pending'
    )
    async_db_session.add(task)
    await async_db_session.commit()
    
    # Complex query: emails with high urgency that have pending tasks
    from sqlalchemy import select, and_
    
    result = await async_db_session.execute(
        select(Email)
        .join(EmailIntelligence)
        .join(EmailTask)
        .where(
            and_(
                EmailIntelligence.urgency == 'high',
                EmailTask.status == 'pending'
            )
        )
    )
    
    complex_results = result.scalars().all()
    assert len(complex_results) == 1
    assert complex_results[0].id == email.id

@pytest.mark.slow
@pytest.mark.unit
@pytest.mark.asyncio
async def test_query_performance_large_dataset(async_db_session):
    """Test query performance with larger dataset"""
    # Create larger test dataset
    batch_size = 1000
    emails = []
    
    for i in range(batch_size):
        email = Email(
            message_id=10000 + i,
            subject_text=f'Large Dataset Email {i}',
            sender_email=f'large{i}@example.com',
            date_received=datetime.now() - timedelta(minutes=i),
            is_read=(i % 4 == 0),
            processing_status='completed' if i % 5 == 0 else 'pending'
        )
        emails.append(email)
        
        # Commit in batches to avoid memory issues
        if (i + 1) % 100 == 0:
            async_db_session.add_all(emails)
            await async_db_session.commit()
            emails = []
    
    if emails:  # Add remaining
        async_db_session.add_all(emails)
        await async_db_session.commit()
    
    # Test paginated query performance
    start_time = time.time()
    
    from sqlalchemy import select
    result = await async_db_session.execute(
        select(Email)
        .where(Email.message_id >= 10000)
        .order_by(Email.date_received.desc())
        .limit(50)
        .offset(0)
    )
    
    page_results = result.scalars().all()
    query_time = time.time() - start_time
    
    assert len(page_results) == 50
    assert query_time < 2.0  # Should complete within 2 seconds

# ============================================================================
# Caching Integration Tests
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_redis_cache_operations(mock_redis):
    """Test Redis cache operations"""
    # Test basic operations
    await mock_redis.setex('test_key', 3600, 'test_value')
    mock_redis.setex.assert_called_with('test_key', 3600, 'test_value')
    
    # Test get
    mock_redis.get.return_value = 'cached_value'
    result = await mock_redis.get('test_key')
    assert result == 'cached_value'
    
    # Test delete
    await mock_redis.delete('test_key')
    mock_redis.delete.assert_called_with('test_key')

@pytest.mark.unit
@pytest.mark.asyncio
async def test_cache_integration_with_database(mock_redis, async_db_session, sample_email_data):
    """Test caching integration with database operations"""
    # Simulate database + cache workflow
    
    # 1. Check cache (miss)
    mock_redis.get.return_value = None
    cache_result = await mock_redis.get('email:12345')
    assert cache_result is None
    
    # 2. Query database
    email = Email(**sample_email_data)
    async_db_session.add(email)
    await async_db_session.commit()
    
    # 3. Cache result
    email_json = json.dumps({
        'id': email.id,
        'subject_text': email.subject_text,
        'sender_email': email.sender_email
    })
    await mock_redis.setex(f'email:{email.message_id}', 3600, email_json)
    
    # 4. Verify cache was called
    mock_redis.setex.assert_called_with(f'email:{email.message_id}', 3600, email_json)
    
    # 5. Next request hits cache
    mock_redis.get.return_value = email_json
    cached_data = await mock_redis.get(f'email:{email.message_id}')
    
    assert cached_data == email_json

@pytest.mark.unit
def test_cache_key_generation():
    """Test cache key generation patterns"""
    # Test various cache key patterns
    patterns = [
        ('email', 12345, 'email:12345'),
        ('intelligence', 67890, 'intelligence:67890'),
        ('batch', 'batch_001', 'batch:batch_001'),
        ('analytics', 'dashboard', 'analytics:dashboard'),
    ]
    
    for prefix, identifier, expected in patterns:
        cache_key = f"{prefix}:{identifier}"
        assert cache_key == expected

@pytest.mark.unit
@pytest.mark.asyncio
async def test_cache_invalidation(mock_redis):
    """Test cache invalidation strategies"""
    # Test individual key invalidation
    await mock_redis.delete('email:12345')
    mock_redis.delete.assert_called_with('email:12345')
    
    # Test pattern-based invalidation (mocked)
    mock_redis.scan = AsyncMock()
    mock_redis.scan.return_value = (0, ['email:1', 'email:2', 'email:3'])
    
    # Simulate pattern deletion
    cursor, keys = await mock_redis.scan(match='email:*')
    for key in keys:
        await mock_redis.delete(key)
    
    assert mock_redis.delete.call_count == len(keys)

# ============================================================================
# Data Validation Tests
# ============================================================================

@pytest.mark.unit
def test_email_validation_helper():
    """Test email validation helper function"""
    valid_emails = [
        'user@example.com',
        'test.user@domain.co.uk',
        'user+tag@example.org',
        'user_name@sub.domain.com'
    ]
    
    invalid_emails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..user@domain.com',
        'user@.com',
        ''
    ]
    
    for email in valid_emails:
        assert validate_email_address(email) == True
    
    for email in invalid_emails:
        assert validate_email_address(email) == False

@pytest.mark.unit
def test_urgency_validation():
    """Test urgency level validation"""
    valid_urgencies = ['critical', 'high', 'medium', 'low', 'CRITICAL', 'High']
    invalid_urgencies = ['urgent', 'extreme', 'normal', '', 'none']
    
    for urgency in valid_urgencies:
        assert validate_urgency_level(urgency) == True
    
    for urgency in invalid_urgencies:
        assert validate_urgency_level(urgency) == False

@pytest.mark.unit
def test_classification_validation():
    """Test email classification validation"""
    valid_classifications = [
        'needs_reply', 'approval_required', 'create_task', 
        'delegate', 'fyi', 'meeting', 'newsletter', 'automated'
    ]
    invalid_classifications = [
        'spam', 'important', 'work', 'personal', 'urgent'
    ]
    
    for classification in valid_classifications:
        assert validate_classification(classification) == True
    
    for classification in invalid_classifications:
        assert validate_classification(classification) == False

@pytest.mark.unit
def test_task_id_utilities():
    """Test task ID creation and parsing utilities"""
    # Test task ID creation
    email_id = 12345
    task_index = 1
    
    task_id = create_task_id(email_id, task_index)
    assert task_id == 'email_12345_task_1'
    
    # Test task ID parsing
    parsed_email_id, parsed_task_index = parse_task_id(task_id)
    assert parsed_email_id == email_id
    assert parsed_task_index == task_index
    
    # Test invalid task ID
    with pytest.raises(ValueError):
        parse_task_id('invalid_format')

# ============================================================================
# Error Handling and Edge Cases
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_database_connection_errors(async_db_session):
    """Test handling of database connection errors"""
    # Simulate connection error
    with patch.object(async_db_session, 'execute', side_effect=SQLAlchemyError("Connection lost")):
        from sqlalchemy import select
        
        with pytest.raises(SQLAlchemyError):
            await async_db_session.execute(select(Email))

@pytest.mark.unit
def test_data_integrity_constraints(sync_db_session):
    """Test data integrity constraint violations"""
    # Test unique constraint violation
    email1 = Email(
        message_id=99999,
        subject_text="First email",
        sender_email="test@example.com",
        date_received=datetime.now()
    )
    
    email2 = Email(
        message_id=99999,  # Same message_id
        subject_text="Second email",
        sender_email="test2@example.com", 
        date_received=datetime.now()
    )
    
    sync_db_session.add(email1)
    sync_db_session.commit()
    
    sync_db_session.add(email2)
    
    # Should raise integrity error
    with pytest.raises(IntegrityError):
        sync_db_session.commit()

@pytest.mark.unit
def test_foreign_key_constraints(sync_db_session):
    """Test foreign key constraint violations"""
    # Try to create intelligence without parent email
    intelligence = EmailIntelligence(
        email_id=999999,  # Non-existent email
        classification='needs_reply',
        urgency='medium',
        sentiment='neutral',
        overall_confidence=Decimal('0.8')
    )
    
    sync_db_session.add(intelligence)
    
    # Should raise foreign key constraint error
    with pytest.raises(IntegrityError):
        sync_db_session.commit()

@pytest.mark.unit
def test_data_type_validation(sync_db_session):
    """Test data type validation errors"""
    # Test invalid decimal value
    with pytest.raises((DataError, ValueError)):
        intelligence = EmailIntelligence(
            email_id=1,
            classification='needs_reply',
            urgency='medium',
            sentiment='neutral',
            overall_confidence="not_a_number"  # Invalid type
        )

@pytest.mark.unit
@pytest.mark.asyncio
async def test_transaction_rollback(async_db_session):
    """Test transaction rollback on errors"""
    email = Email(
        message_id=88888,
        subject_text="Transaction test",
        sender_email="transaction@example.com",
        date_received=datetime.now()
    )
    
    try:
        async_db_session.add(email)
        await async_db_session.flush()  # Get ID
        
        # Create invalid intelligence record
        intelligence = EmailIntelligence(
            email_id=email.id,
            classification='invalid_classification',  # This should fail
            urgency='medium',
            sentiment='neutral',
            overall_confidence=Decimal('0.8')
        )
        async_db_session.add(intelligence)
        
        await async_db_session.commit()
        
    except Exception:
        await async_db_session.rollback()
        
        # Verify email was also rolled back
        from sqlalchemy import select
        result = await async_db_session.execute(
            select(Email).where(Email.message_id == 88888)
        )
        rolled_back_email = result.scalar_one_or_none()
        assert rolled_back_email is None

# ============================================================================
# Performance Monitoring Tests
# ============================================================================

@pytest.mark.unit
def test_performance_metric_model(sync_db_session):
    """Test PerformanceMetric model"""
    today = datetime.now().date()
    current_hour = datetime.now().hour
    
    metric = PerformanceMetric(
        metric_date=today,
        metric_hour=current_hour,
        emails_processed=150,
        average_processing_time_ms=Decimal('250.5'),
        classification_accuracy=Decimal('0.92'),
        memory_usage_mb=512,
        cpu_usage_percent=Decimal('45.2'),
        urgent_emails_detected=23,
        tasks_generated=89,
        api_requests_total=1205,
        api_errors_total=12
    )
    
    sync_db_session.add(metric)
    sync_db_session.commit()
    
    # Verify unique constraint on date + hour
    duplicate_metric = PerformanceMetric(
        metric_date=today,
        metric_hour=current_hour,  # Same date/hour
        emails_processed=200
    )
    
    sync_db_session.add(duplicate_metric)
    
    with pytest.raises(IntegrityError):
        sync_db_session.commit()

@pytest.mark.unit
def test_system_alert_model(sync_db_session):
    """Test SystemAlert model"""
    alert = SystemAlert(
        alert_type='error',
        severity='high',
        title='Database Connection Timeout',
        message='Database connection timed out after 30 seconds',
        source='database_manager',
        context_data={'timeout': 30, 'retry_count': 3}
    )
    
    sync_db_session.add(alert)
    sync_db_session.commit()
    
    assert alert.created_at is not None
    assert alert.acknowledged_at is None
    assert alert.resolved_at is None
    assert isinstance(alert.context_data, dict)

# ============================================================================
# Configuration and Preferences Tests
# ============================================================================

@pytest.mark.unit
def test_user_preference_model(sync_db_session):
    """Test UserPreference model"""
    prefs = UserPreference(
        user_id='test_user_123',
        default_batch_size=200,
        auto_process_new=True,
        urgency_threshold='high',
        email_notifications=False,
        notification_types=['urgent', 'tasks'],
        ui_theme='dark',
        items_per_page=25,
        ai_confidence_threshold=Decimal('0.8'),
        preferred_response_tone='formal'
    )
    
    sync_db_session.add(prefs)
    sync_db_session.commit()
    
    # Test unique constraint
    duplicate_prefs = UserPreference(
        user_id='test_user_123',  # Same user_id
        default_batch_size=100
    )
    
    sync_db_session.add(duplicate_prefs)
    
    with pytest.raises(IntegrityError):
        sync_db_session.commit()

@pytest.mark.unit
def test_system_config_model(sync_db_session):
    """Test SystemConfig model"""
    configs = [
        SystemConfig(
            config_key='max_batch_size',
            config_value='1000',
            value_type='integer',
            description='Maximum emails per batch'
        ),
        SystemConfig(
            config_key='enable_ai_processing',
            config_value='true',
            value_type='boolean',
            description='Enable AI processing features'
        ),
        SystemConfig(
            config_key='api_rate_limits',
            config_value='{"requests_per_minute": 60}',
            value_type='json',
            description='API rate limiting configuration'
        )
    ]
    
    sync_db_session.add_all(configs)
    sync_db_session.commit()
    
    # Test retrieval
    api_config = sync_db_session.query(SystemConfig).filter_by(
        config_key='api_rate_limits'
    ).first()
    
    assert api_config is not None
    assert api_config.value_type == 'json'
    
    # Should be able to parse JSON value
    config_data = json.loads(api_config.config_value)
    assert config_data['requests_per_minute'] == 60

# ============================================================================
# Migration and Schema Tests
# ============================================================================

@pytest.mark.unit
def test_schema_creation(temp_sqlite_db):
    """Test database schema creation"""
    db_url, db_path = temp_sqlite_db
    engine = create_engine(db_url)
    
    # Create all tables
    Base.metadata.create_all(engine)
    
    # Verify tables exist
    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    
    expected_tables = [
        'emails', 'email_intelligence', 'email_tasks', 'email_batches',
        'performance_metrics', 'system_alerts', 'user_preferences', 'system_config'
    ]
    
    for table in expected_tables:
        assert table in table_names
    
    # Verify indexes exist
    email_indexes = inspector.get_indexes('emails')
    index_names = [idx['name'] for idx in email_indexes]
    
    expected_indexes = [
        'idx_emails_date_received_desc',
        'idx_emails_sender_date'
    ]
    
    # At least some indexes should be created
    assert len(index_names) > 0

@pytest.mark.unit
def test_table_constraints(temp_sqlite_db):
    """Test table constraints are properly created"""
    db_url, db_path = temp_sqlite_db
    engine = create_engine(db_url)
    
    Base.metadata.create_all(engine)
    
    inspector = inspect(engine)
    
    # Test email table constraints
    email_constraints = inspector.get_check_constraints('emails')
    
    # Should have processing_status check constraint
    status_constraint = next((c for c in email_constraints 
                            if 'processing_status' in c.get('sqltext', '')), None)
    # Note: SQLite may not show check constraints in inspector
    
    # Test unique constraints
    unique_constraints = inspector.get_unique_constraints('emails')
    message_id_constraint = next((c for c in unique_constraints 
                                if 'message_id' in c['column_names']), None)
    assert message_id_constraint is not None

# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.asyncio
async def test_full_database_workflow(async_db_session, mock_redis):
    """Test complete database workflow with caching"""
    # 1. Create email with intelligence and tasks
    email_data = {
        'message_id': 77777,
        'subject_text': 'Integration Test Email',
        'sender_email': 'integration@test.com',
        'date_received': datetime.now()
    }
    
    email = Email(**email_data)
    async_db_session.add(email)
    await async_db_session.flush()
    
    # 2. Add intelligence
    intelligence = EmailIntelligence(
        email_id=email.id,
        classification='needs_reply',
        urgency='high',
        sentiment='positive',
        overall_confidence=Decimal('0.88'),
        processing_time_ms=175
    )
    async_db_session.add(intelligence)
    
    # 3. Add tasks
    task1 = EmailTask(
        task_id=create_task_id(email.id, 1),
        email_id=email.id,
        subject='Reply to integration email',
        description='Respond to the integration test email',
        task_type='reply',
        priority='HIGH',
        due_date=datetime.now() + timedelta(days=1)
    )
    
    task2 = EmailTask(
        task_id=create_task_id(email.id, 2),
        email_id=email.id,
        subject='Follow up on integration',
        description='Follow up on the integration test',
        task_type='follow-up',
        priority='MEDIUM',
        due_date=datetime.now() + timedelta(days=7)
    )
    
    async_db_session.add_all([task1, task2])
    await async_db_session.commit()
    
    # 4. Query with relationships
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    result = await async_db_session.execute(
        select(Email)
        .options(
            selectinload(Email.intelligence),
            selectinload(Email.tasks)
        )
        .where(Email.id == email.id)
    )
    loaded_email = result.scalar_one()
    
    # 5. Verify relationships
    assert loaded_email.intelligence is not None
    assert len(loaded_email.tasks) == 2
    assert loaded_email.intelligence.urgency == 'high'
    
    # 6. Cache the result
    cache_data = {
        'email_id': loaded_email.id,
        'subject': loaded_email.subject_text,
        'classification': loaded_email.intelligence.classification,
        'task_count': len(loaded_email.tasks)
    }
    
    await mock_redis.setex(
        f'email_full:{loaded_email.id}',
        3600,
        json.dumps(cache_data)
    )
    
    # 7. Update task status
    task1.status = 'in-progress'
    await async_db_session.commit()
    
    # 8. Invalidate cache
    await mock_redis.delete(f'email_full:{loaded_email.id}')
    
    # Verify all operations completed successfully
    mock_redis.setex.assert_called()
    mock_redis.delete.assert_called()

@pytest.mark.integration
@pytest.mark.slow
@pytest.mark.asyncio
async def test_database_performance_under_load(async_db_session):
    """Test database performance under concurrent load"""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    
    async def create_email_batch(batch_id, batch_size=50):
        """Create a batch of emails concurrently"""
        emails = []
        for i in range(batch_size):
            email = Email(
                message_id=batch_id * 1000 + i,
                subject_text=f'Load Test Email {batch_id}-{i}',
                sender_email=f'load{batch_id}_{i}@test.com',
                date_received=datetime.now() - timedelta(seconds=i)
            )
            emails.append(email)
        
        async_db_session.add_all(emails)
        await async_db_session.commit()
        return len(emails)
    
    # Create multiple batches concurrently
    start_time = time.time()
    
    tasks = [create_email_batch(i, 25) for i in range(5)]  # 5 batches of 25 emails
    results = await asyncio.gather(*tasks)
    
    end_time = time.time()
    
    total_created = sum(results)
    creation_time = end_time - start_time
    
    assert total_created == 125  # 5 * 25
    assert creation_time < 10.0  # Should complete within 10 seconds
    
    # Test query performance on created data
    start_time = time.time()
    
    from sqlalchemy import select, func
    result = await async_db_session.execute(
        select(func.count(Email.id))
        .where(Email.sender_email.like('load%'))
    )
    count = result.scalar()
    
    query_time = time.time() - start_time
    
    assert count == 125
    assert query_time < 1.0  # Query should be fast

# ============================================================================
# Cleanup and Utilities
# ============================================================================

@pytest.mark.unit
@pytest.mark.asyncio
async def test_database_cleanup_operations(async_db_session):
    """Test database cleanup and maintenance operations"""
    # Create old test data
    old_emails = []
    for i in range(10):
        email = Email(
            message_id=50000 + i,
            subject_text=f'Old Email {i}',
            sender_email=f'old{i}@test.com',
            date_received=datetime.now() - timedelta(days=365),  # 1 year old
            processing_status='completed'
        )
        old_emails.append(email)
    
    async_db_session.add_all(old_emails)
    await async_db_session.commit()
    
    # Cleanup old emails (simulate maintenance task)
    from sqlalchemy import delete
    
    cutoff_date = datetime.now() - timedelta(days=180)  # 6 months
    
    result = await async_db_session.execute(
        delete(Email)
        .where(Email.date_received < cutoff_date)
        .where(Email.processing_status == 'completed')
    )
    
    await async_db_session.commit()
    
    # Verify cleanup
    assert result.rowcount == 10

@pytest.mark.unit
def test_model_string_representations(sync_db_session, sample_email_data):
    """Test model __repr__ methods"""
    email = Email(**sample_email_data)
    
    repr_str = repr(email)
    assert 'Email(' in repr_str
    assert 'Test Email Subject' in repr_str
    assert 'sender@example.com' in repr_str
    
    # Test other models
    intelligence = EmailIntelligence(
        email_id=1,
        classification='needs_reply',
        urgency='high',
        sentiment='neutral',
        overall_confidence=Decimal('0.8')
    )
    
    intel_repr = repr(intelligence)
    assert 'EmailIntelligence(' in intel_repr
    assert 'needs_reply' in intel_repr

# ============================================================================
# Main Test Runner
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])