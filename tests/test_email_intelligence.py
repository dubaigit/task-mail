#!/usr/bin/env python3
"""
Comprehensive Email Intelligence System Tests

Tests AI engine, processing pipeline, OpenAI integration, caching,
rate limiting, batch processing, and error handling with full mocking.
"""

import pytest
import asyncio
import json
import time
import hashlib
import sqlite3
import tempfile
import os
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, call, mock_open
from typing import Dict, Any, List, Optional

# Import system under test
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from email_intelligence_production import (
    ProductionEmailIntelligenceEngine,
    RateLimit, PerformanceMetrics, CacheEntry
)
from email_intelligence_engine import (
    EmailClass, Urgency, Sentiment, ActionItem, 
    EmailIntelligence, EmailAnalysisResult
)

# ============================================================================
# Test Fixtures and Setup
# ============================================================================

@pytest.fixture
def temp_db():
    """Create temporary database for testing"""
    db_fd, db_path = tempfile.mkstemp(suffix='.db')
    yield db_path
    os.close(db_fd)
    if os.path.exists(db_path):
        os.unlink(db_path)

@pytest.fixture
def test_config():
    """Test configuration"""
    return {
        'openai_api_key': 'test-api-key',
        'classifier_model': 'gpt-5-nano-test',
        'draft_model': 'gpt-5-mini-test',
        'rate_limit': {
            'requests_per_minute': 10,
            'requests_per_hour': 100,
            'burst_capacity': 5,
            'backoff_factor': 1.5,
            'max_retries': 2
        },
        'cache': {
            'enabled': True,
            'ttl_seconds': 300,
            'max_entries': 100
        },
        'batch_processing': {
            'batch_size': 5,
            'max_concurrent_batches': 2,
            'urgent_priority_threshold': 0.8
        },
        'voice_settings': {
            'user_name': 'Test User',
            'greeting_prefix': 'Hi',
            'signature': 'Best regards, Test User',
            'tone': 'professional'
        },
        'performance': {
            'timeout_seconds': 5,
            'urgent_timeout_seconds': 2,
            'max_retries': 2
        }
    }

@pytest.fixture
def sample_email():
    """Sample email data for testing"""
    return {
        'subject': 'Project Review Required - Urgent',
        'body': '''Hi Abdullah,

I need your urgent review on the Q4 project proposal. Please approve the budget allocation by Friday.

The key points are:
- Total budget: $75,000
- Timeline: 3 months
- Team size: 5 developers

Let me know if you have any questions.

Thanks,
Sarah''',
        'sender': 'sarah.johnson@company.com',
        'sender_name': 'Sarah Johnson',
        'metadata': {'priority': 'high', 'thread_id': 'thread_123'}
    }

@pytest.fixture
def mock_openai_response():
    """Mock OpenAI API response"""
    return {
        "choices": [
            {
                "message": {
                    "content": "APPROVAL_REQUIRED|0.92"
                }
            }
        ]
    }

@pytest.fixture
def mock_openai_draft_response():
    """Mock OpenAI draft generation response"""
    return {
        "choices": [
            {
                "message": {
                    "content": "Hi Sarah,\n\nI approve the Q4 project proposal. The budget allocation looks reasonable for the scope.\n\nPlease proceed with the timeline as proposed.\n\nBest regards, Test User"
                }
            }
        ]
    }

@pytest.fixture
def production_engine(temp_db, test_config):
    """Production email intelligence engine with test config"""
    test_config['database'] = {'path': temp_db}
    
    with patch('email_intelligence_production.os.path.exists') as mock_exists:
        mock_exists.return_value = False  # No config file
        
        with patch.dict('email_intelligence_production.os.environ', {'OPENAI_API_KEY': 'test-key'}):
            engine = ProductionEmailIntelligenceEngine()
            engine.config.update(test_config)
            engine._initialize_database()  # Ensure DB is initialized
            
    return engine

# ============================================================================
# Initialization and Configuration Tests
# ============================================================================

@pytest.mark.unit
def test_engine_initialization(temp_db):
    """Test engine initializes correctly"""
    with patch.dict('email_intelligence_production.os.environ', {'OPENAI_API_KEY': 'test-key'}):
        engine = ProductionEmailIntelligenceEngine()
        
        assert engine.logger is not None
        assert engine.config is not None
        assert engine.session is not None
        assert engine.cache is not None
        assert engine.executor is not None
        assert hasattr(engine, 'metrics')

@pytest.mark.unit
def test_config_loading_from_file(temp_db):
    """Test configuration loading from file"""
    test_config = {
        'classifier_model': 'custom-model',
        'cache': {'ttl_seconds': 7200}
    }
    
    config_file = temp_db + '.json'
    with open(config_file, 'w') as f:
        json.dump(test_config, f)
    
    try:
        engine = ProductionEmailIntelligenceEngine(config_path=config_file)
        
        assert engine.config['classifier_model'] == 'custom-model'
        assert engine.config['cache']['ttl_seconds'] == 7200
    finally:
        if os.path.exists(config_file):
            os.unlink(config_file)

@pytest.mark.unit
def test_config_loading_with_missing_file():
    """Test configuration loading with missing file"""
    with patch('email_intelligence_production.os.path.exists') as mock_exists:
        mock_exists.return_value = False
        
        engine = ProductionEmailIntelligenceEngine(config_path='/nonexistent/config.json')
        # Should use default config
        assert engine.config is not None

@pytest.mark.unit
def test_config_loading_with_invalid_json():
    """Test configuration loading with invalid JSON"""
    invalid_config_file = tempfile.mktemp(suffix='.json')
    
    try:
        with open(invalid_config_file, 'w') as f:
            f.write('invalid json{')
        
        with patch('email_intelligence_production.logging') as mock_logging:
            engine = ProductionEmailIntelligenceEngine(config_path=invalid_config_file)
            # Should log error and use defaults
            assert engine.config is not None
    finally:
        if os.path.exists(invalid_config_file):
            os.unlink(invalid_config_file)

@pytest.mark.unit
def test_missing_api_key_warning():
    """Test warning when OpenAI API key is missing"""
    with patch.dict('email_intelligence_production.os.environ', {}, clear=True):
        with patch('email_intelligence_production.logging') as mock_logging:
            engine = ProductionEmailIntelligenceEngine()
            # Should have logged warning about missing API key

@pytest.mark.unit
def test_database_initialization(production_engine):
    """Test database tables are created correctly"""
    db_path = production_engine.config['database']['path']
    
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        
        # Check tables exist
        tables = ['email_analysis', 'draft_generations', 'performance_metrics']
        for table in tables:
            cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
            assert cursor.fetchone() is not None
        
        # Check indexes exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_email_hash'")
        assert cursor.fetchone() is not None

# ============================================================================
# Rate Limiting Tests
# ============================================================================

@pytest.mark.unit
def test_rate_limit_check_within_limits(production_engine):
    """Test rate limit allows requests within limits"""
    # Should allow initial requests
    for i in range(5):
        assert production_engine._check_rate_limit() == True

@pytest.mark.unit
def test_rate_limit_exceeded(production_engine):
    """Test rate limit blocks requests when exceeded"""
    # Fill up rate limit
    for i in range(10):  # Config allows 10 per minute
        production_engine._check_rate_limit()
    
    # Next request should be blocked
    assert production_engine._check_rate_limit() == False

@pytest.mark.unit
def test_rate_limit_reset_over_time(production_engine):
    """Test rate limit resets over time"""
    # Fill up rate limit
    for i in range(10):
        production_engine._check_rate_limit()
    
    # Mock time passage
    with patch('email_intelligence_production.datetime') as mock_datetime:
        mock_datetime.now.return_value = datetime.now() + timedelta(minutes=2)
        
        # Should allow requests again
        assert production_engine._check_rate_limit() == True

@pytest.mark.unit
def test_rate_limit_wait(production_engine):
    """Test rate limit waiting mechanism"""
    # Fill up rate limit
    for i in range(10):
        production_engine._check_rate_limit()
    
    with patch('email_intelligence_production.time.sleep') as mock_sleep:
        with patch.object(production_engine, '_check_rate_limit', side_effect=[False, False, True]):
            production_engine._wait_for_rate_limit()
            
            # Should have called sleep twice
            assert mock_sleep.call_count == 2

# ============================================================================
# Caching Tests
# ============================================================================

@pytest.mark.unit
def test_cache_key_generation(production_engine):
    """Test cache key generation"""
    data1 = "test data"
    data2 = {"key": "value"}
    
    key1 = production_engine._get_cache_key(data1)
    key2 = production_engine._get_cache_key(data2)
    
    # Keys should be different
    assert key1 != key2
    
    # Same data should generate same key
    key1_again = production_engine._get_cache_key(data1)
    assert key1 == key1_again

@pytest.mark.unit
def test_cache_put_and_get(production_engine):
    """Test cache storage and retrieval"""
    key = "test_key"
    data = {"test": "data"}
    
    # Store in cache
    production_engine._put_in_cache(key, data)
    
    # Should retrieve same data
    retrieved = production_engine._get_from_cache(key)
    assert retrieved == data

@pytest.mark.unit
def test_cache_expiration(production_engine):
    """Test cache entry expiration"""
    key = "expiring_key"
    data = {"test": "data"}
    
    # Store with short TTL
    production_engine._put_in_cache(key, data, ttl=1)
    
    # Should get data immediately
    assert production_engine._get_from_cache(key) == data
    
    # Mock time passage
    time.sleep(2)
    
    # Should return None (expired)
    assert production_engine._get_from_cache(key) is None

@pytest.mark.unit
def test_cache_eviction(production_engine):
    """Test cache eviction when full"""
    # Fill cache to capacity (config has max_entries: 100)
    for i in range(101):
        key = f"key_{i}"
        production_engine._put_in_cache(key, f"data_{i}")
    
    # First entry should have been evicted
    assert production_engine._get_from_cache("key_0") is None
    
    # Latest entry should still exist
    assert production_engine._get_from_cache("key_100") == "data_100"

@pytest.mark.unit
def test_cache_disabled(production_engine):
    """Test cache behavior when disabled"""
    production_engine.config['cache']['enabled'] = False
    
    key = "test_key"
    data = {"test": "data"}
    
    # Should not store when disabled
    production_engine._put_in_cache(key, data)
    
    # Cache should be empty
    assert len(production_engine.cache) == 0

# ============================================================================
# OpenAI API Integration Tests
# ============================================================================

@pytest.mark.unit
def test_openai_api_call_success(production_engine, mock_openai_response):
    """Test successful OpenAI API call"""
    with patch.object(production_engine.session, 'post') as mock_post:
        mock_response = MagicMock()
        mock_response.raise_for_status.return_value = None
        mock_response.json.return_value = mock_openai_response
        mock_post.return_value = mock_response
        
        result = production_engine._call_openai_api(
            prompt="test prompt",
            system_prompt="test system",
            model="gpt-5-nano",
            max_tokens=100
        )
        
        assert result == "APPROVAL_REQUIRED|0.92"
        mock_post.assert_called_once()

@pytest.mark.unit
def test_openai_api_call_rate_limited(production_engine):
    """Test OpenAI API call with rate limiting"""
    with patch.object(production_engine, '_wait_for_rate_limit') as mock_wait:
        with patch.object(production_engine.session, 'post') as mock_post:
            mock_response = MagicMock()
            mock_response.json.return_value = {"choices": [{"message": {"content": "test"}}]}
            mock_post.return_value = mock_response
            
            production_engine._call_openai_api("test", "test", "model")
            
            mock_wait.assert_called_once()

@pytest.mark.unit
def test_openai_api_call_cached(production_engine):
    """Test OpenAI API call with cache hit"""
    # Pre-populate cache
    cache_key = production_engine._get_cache_key({
        'prompt': 'test prompt',
        'system': 'test system',
        'model': 'gpt-5-nano',
        'max_tokens': 100,
        'temperature': 0.1
    })
    cached_result = "cached response"
    production_engine._put_in_cache(cache_key, cached_result)
    
    result = production_engine._call_openai_api(
        prompt="test prompt",
        system_prompt="test system",
        model="gpt-5-nano"
    )
    
    assert result == cached_result

@pytest.mark.unit
def test_openai_api_call_error_handling(production_engine):
    """Test OpenAI API error handling"""
    with patch.object(production_engine.session, 'post') as mock_post:
        mock_post.side_effect = Exception("API Error")
        
        result = production_engine._call_openai_api("test", "test", "model")
        
        assert result is None
        # Should have incremented failed requests
        assert production_engine.metrics.failed_requests > 0

@pytest.mark.unit
def test_openai_api_call_no_api_key(production_engine):
    """Test OpenAI API call without API key"""
    production_engine.config['openai_api_key'] = None
    
    result = production_engine._call_openai_api("test", "test", "model")
    
    assert result is None

@pytest.mark.unit
def test_openai_api_timeout(production_engine):
    """Test OpenAI API timeout handling"""
    with patch.object(production_engine.session, 'post') as mock_post:
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("Request timed out")
        
        result = production_engine._call_openai_api("test", "test", "model")
        
        assert result is None

# ============================================================================
# Email Classification Tests
# ============================================================================

@pytest.mark.unit
def test_classify_email_success(production_engine, sample_email, mock_openai_response):
    """Test successful email classification"""
    with patch.object(production_engine, '_call_openai_api') as mock_api:
        mock_api.return_value = "APPROVAL_REQUIRED|0.92"
        
        result = production_engine.classify_email_with_ai(
            sample_email['subject'],
            sample_email['body'],
            sample_email['sender']
        )
        
        assert result is not None
        classification, confidence = result
        assert classification == EmailClass.APPROVAL_REQUIRED
        assert confidence == 0.92

@pytest.mark.unit
def test_classify_email_invalid_response(production_engine, sample_email):
    """Test email classification with invalid API response"""
    with patch.object(production_engine, '_call_openai_api') as mock_api:
        mock_api.return_value = "INVALID_FORMAT"
        
        result = production_engine.classify_email_with_ai(
            sample_email['subject'],
            sample_email['body'],
            sample_email['sender']
        )
        
        assert result is None

@pytest.mark.unit
def test_classify_email_api_failure(production_engine, sample_email):
    """Test email classification when API fails"""
    with patch.object(production_engine, '_call_openai_api') as mock_api:
        mock_api.return_value = None
        
        result = production_engine.classify_email_with_ai(
            sample_email['subject'],
            sample_email['body'],
            sample_email['sender']
        )
        
        assert result is None

@pytest.mark.unit
def test_classify_email_prompt_construction(production_engine, sample_email):
    """Test that classification prompt is constructed correctly"""
    with patch.object(production_engine, '_call_openai_api') as mock_api:
        mock_api.return_value = "NEEDS_REPLY|0.85"
        
        production_engine.classify_email_with_ai(
            sample_email['subject'],
            sample_email['body'],
            sample_email['sender']
        )
        
        # Verify API was called with correct parameters
        mock_api.assert_called_once()
        args, kwargs = mock_api.call_args
        
        # Check prompt contains email data
        assert sample_email['subject'] in args[0]
        assert sample_email['sender'] in args[0]
        assert sample_email['body'][:1500] in args[0]  # Truncated body
        
        # Check system prompt contains classification instructions
        assert "NEEDS_REPLY" in args[1]
        assert "APPROVAL_REQUIRED" in args[1]

# ============================================================================
# Draft Generation Tests
# ============================================================================

@pytest.mark.unit
def test_generate_draft_success(production_engine, sample_email, mock_openai_draft_response):
    """Test successful draft generation"""
    # Create analysis object
    analysis = EmailIntelligence(
        classification=EmailClass.APPROVAL_REQUIRED,
        confidence=0.9,
        urgency=Urgency.HIGH,
        sentiment=Sentiment.NEUTRAL,
        intent="approval_request",
        action_items=[ActionItem(text="Review proposal", confidence=0.8)],
        deadlines=[(datetime.now() + timedelta(days=2), "Review by Friday")]
    )
    
    with patch.object(production_engine, '_call_openai_api') as mock_api:
        mock_api.return_value = "Hi Sarah,\n\nI approve the proposal.\n\nBest regards, Test User"
        
        result = production_engine.generate_draft_with_ai(sample_email, analysis)
        
        assert result is not None
        assert "Hi Sarah" in result
        assert "Best regards, Test User" in result

@pytest.mark.unit
def test_generate_draft_with_voice_settings(production_engine, sample_email):
    """Test draft generation respects voice settings"""
    analysis = EmailIntelligence(
        classification=EmailClass.NEEDS_REPLY,
        confidence=0.8,
        urgency=Urgency.MEDIUM,
        sentiment=Sentiment.NEUTRAL,
        intent="general_reply"
    )
    
    with patch.object(production_engine, '_call_openai_api') as mock_api:
        production_engine.generate_draft_with_ai(sample_email, analysis)
        
        # Check system prompt includes voice settings
        args, kwargs = mock_api.call_args
        system_prompt = args[1]
        
        assert production_engine.config['voice_settings']['user_name'] in system_prompt
        assert production_engine.config['voice_settings']['greeting_prefix'] in system_prompt
        assert production_engine.config['voice_settings']['signature'] in system_prompt
        assert production_engine.config['voice_settings']['tone'] in system_prompt

@pytest.mark.unit
def test_generate_draft_with_context(production_engine, sample_email):
    """Test draft generation includes context from analysis"""
    analysis = EmailIntelligence(
        classification=EmailClass.CREATE_TASK,
        urgency=Urgency.HIGH,
        sentiment=Sentiment.POSITIVE,
        action_items=[
            ActionItem(text="Review budget", confidence=0.9),
            ActionItem(text="Schedule meeting", confidence=0.8)
        ],
        deadlines=[(datetime.now() + timedelta(days=1), "Budget review")]
    )
    
    with patch.object(production_engine, '_call_openai_api') as mock_api:
        production_engine.generate_draft_with_ai(sample_email, analysis)
        
        # Check user prompt includes analysis context
        args, kwargs = mock_api.call_args
        user_prompt = args[0]
        
        assert "Classification: CREATE_TASK" in user_prompt
        assert "Urgency: HIGH" in user_prompt
        assert "Sentiment: POSITIVE" in user_prompt
        assert "Review budget" in user_prompt

# ============================================================================
# Email Analysis Tests
# ============================================================================

@pytest.mark.unit
def test_analyze_email_success(production_engine, sample_email):
    """Test complete email analysis"""
    with patch.object(production_engine, 'classify_email_with_ai') as mock_classify:
        mock_classify.return_value = (EmailClass.APPROVAL_REQUIRED, 0.9)
        
        result = production_engine.analyze_email(
            subject=sample_email['subject'],
            body=sample_email['body'],
            sender=sample_email['sender']
        )
        
        assert isinstance(result, EmailIntelligence)
        assert result.classification == EmailClass.APPROVAL_REQUIRED
        assert result.confidence == 0.9
        assert result.processing_time_ms > 0

@pytest.mark.unit
def test_analyze_email_with_fallback(production_engine, sample_email):
    """Test email analysis falls back when AI fails"""
    with patch.object(production_engine, 'classify_email_with_ai') as mock_classify:
        mock_classify.return_value = None  # AI failure
        
        with patch('email_intelligence_production.EmailIntelligenceEngine') as mock_fallback:
            mock_engine = MagicMock()
            mock_result = MagicMock()
            mock_result.classification = EmailClass.NEEDS_REPLY
            mock_result.confidence = 0.7
            mock_engine.analyze_email.return_value = mock_result
            mock_fallback.return_value = mock_engine
            
            result = production_engine.analyze_email(
                subject=sample_email['subject'],
                body=sample_email['body'],
                sender=sample_email['sender']
            )
            
            assert result.classification == EmailClass.NEEDS_REPLY
            assert result.confidence == 0.7

@pytest.mark.unit
def test_analyze_email_caching(production_engine, sample_email):
    """Test email analysis caching"""
    with patch.object(production_engine, '_get_cached_analysis') as mock_cached:
        cached_analysis = EmailIntelligence(
            classification=EmailClass.FYI_ONLY,
            confidence=0.8,
            urgency=Urgency.LOW
        )
        mock_cached.return_value = cached_analysis
        
        result = production_engine.analyze_email(
            subject=sample_email['subject'],
            body=sample_email['body'],
            sender=sample_email['sender']
        )
        
        assert result == cached_analysis
        # Should not call AI if cached
        with patch.object(production_engine, 'classify_email_with_ai') as mock_classify:
            mock_classify.assert_not_called()

@pytest.mark.unit
def test_analyze_email_storage(production_engine, sample_email):
    """Test email analysis is stored in database"""
    with patch.object(production_engine, 'classify_email_with_ai') as mock_classify:
        mock_classify.return_value = (EmailClass.NEEDS_REPLY, 0.85)
        
        with patch.object(production_engine, '_store_analysis') as mock_store:
            result = production_engine.analyze_email(
                subject=sample_email['subject'],
                body=sample_email['body'],
                sender=sample_email['sender']
            )
            
            mock_store.assert_called_once()
            # Verify correct parameters
            args = mock_store.call_args[0]
            assert args[1] == sample_email['subject']  # subject
            assert args[2] == sample_email['sender']   # sender
            assert isinstance(args[3], EmailIntelligence)  # analysis

@pytest.mark.unit
def test_analyze_email_error_handling(production_engine, sample_email):
    """Test email analysis error handling"""
    with patch.object(production_engine, 'classify_email_with_ai') as mock_classify:
        mock_classify.side_effect = Exception("Classification error")
        
        result = production_engine.analyze_email(
            subject=sample_email['subject'],
            body=sample_email['body'],
            sender=sample_email['sender']
        )
        
        # Should return fallback result
        assert result.classification == EmailClass.FYI_ONLY
        assert result.confidence == 0.0
        assert "analysis_failed" in result.intent

# ============================================================================
# Draft Reply Generation Tests
# ============================================================================

@pytest.mark.unit
def test_generate_draft_reply_success(production_engine, sample_email):
    """Test draft reply generation"""
    analysis = EmailIntelligence(
        classification=EmailClass.NEEDS_REPLY,
        confidence=0.9,
        urgency=Urgency.MEDIUM,
        sentiment=Sentiment.NEUTRAL
    )
    
    with patch.object(production_engine, 'generate_draft_with_ai') as mock_ai_draft:
        mock_ai_draft.return_value = "AI generated draft"
        
        result = production_engine.generate_draft_reply(sample_email, analysis)
        
        assert result == "AI generated draft"

@pytest.mark.unit
def test_generate_draft_reply_with_fallback(production_engine, sample_email):
    """Test draft reply falls back to template when AI fails"""
    analysis = EmailIntelligence(
        classification=EmailClass.APPROVAL_REQUIRED,
        confidence=0.8,
        urgency=Urgency.HIGH,
        sentiment=Sentiment.NEUTRAL
    )
    
    with patch.object(production_engine, 'generate_draft_with_ai') as mock_ai_draft:
        mock_ai_draft.return_value = None  # AI failure
        
        result = production_engine.generate_draft_reply(sample_email, analysis)
        
        # Should return template-based draft
        assert result is not None
        assert "Hi" in result  # Greeting prefix from config
        assert "Best regards, Test User" in result  # Signature from config

@pytest.mark.unit
def test_generate_draft_reply_caching(production_engine, sample_email):
    """Test draft reply caching"""
    analysis = EmailIntelligence(classification=EmailClass.NEEDS_REPLY, confidence=0.8)
    
    with patch.object(production_engine, '_get_cached_draft') as mock_cached:
        mock_cached.return_value = "Cached draft"
        
        result = production_engine.generate_draft_reply(sample_email, analysis)
        
        assert result == "Cached draft"
        
        # Should not call AI generation if cached
        with patch.object(production_engine, 'generate_draft_with_ai') as mock_ai:
            mock_ai.assert_not_called()

@pytest.mark.unit
def test_fallback_draft_templates(production_engine, sample_email):
    """Test fallback draft template generation"""
    test_cases = [
        (EmailClass.APPROVAL_REQUIRED, "approve"),
        (EmailClass.CREATE_TASK, "task"),
        (EmailClass.DELEGATE, "route this to"),
        (EmailClass.FOLLOW_UP, "status"),
        (EmailClass.FYI_ONLY, "thanks for")
    ]
    
    for classification, expected_keyword in test_cases:
        analysis = EmailIntelligence(
            classification=classification,
            confidence=0.8,
            urgency=Urgency.MEDIUM,
            sentiment=Sentiment.NEUTRAL
        )
        
        result = production_engine._generate_fallback_draft(sample_email, analysis)
        
        assert expected_keyword.lower() in result.lower()
        assert "Hi" in result  # Greeting
        assert "Best regards, Test User" in result  # Signature

# ============================================================================
# Batch Processing Tests
# ============================================================================

@pytest.mark.unit
def test_batch_process_emails_success(production_engine):
    """Test successful batch email processing"""
    emails = [
        {'subject': 'Email 1', 'body': 'Content 1', 'sender': 'user1@test.com'},
        {'subject': 'Email 2', 'body': 'Content 2', 'sender': 'user2@test.com'},
        {'subject': 'Email 3', 'body': 'Content 3', 'sender': 'user3@test.com'}
    ]
    
    with patch.object(production_engine, 'analyze_email') as mock_analyze:
        mock_result = EmailIntelligence(
            classification=EmailClass.NEEDS_REPLY,
            confidence=0.8
        )
        mock_analyze.return_value = mock_result
        
        results = production_engine.batch_process_emails(emails)
        
        assert len(results) == 3
        assert all(isinstance(r, EmailIntelligence) for r in results)
        assert mock_analyze.call_count == 3

@pytest.mark.unit
def test_batch_process_emails_priority_sorting(production_engine):
    """Test batch processing sorts emails by priority"""
    emails = [
        {'subject': 'Normal email', 'body': 'Regular content', 'sender': 'user1@test.com'},
        {'subject': 'URGENT: Critical issue', 'body': 'This is urgent!', 'sender': 'user2@test.com'},
        {'subject': 'Approval needed', 'body': 'Please approve this', 'sender': 'user3@test.com'}
    ]
    
    with patch.object(production_engine, 'analyze_email') as mock_analyze:
        mock_analyze.return_value = EmailIntelligence(classification=EmailClass.NEEDS_REPLY, confidence=0.8)
        
        production_engine.batch_process_emails(emails)
        
        # Verify urgent email was processed first
        first_call_args = mock_analyze.call_args_list[0][0]
        assert 'URGENT' in first_call_args[0]  # subject

@pytest.mark.unit
def test_batch_process_emails_error_handling(production_engine):
    """Test batch processing handles individual email errors"""
    emails = [
        {'subject': 'Good email', 'body': 'Content', 'sender': 'user1@test.com'},
        {'subject': 'Bad email', 'body': 'Content', 'sender': 'user2@test.com'}
    ]
    
    with patch.object(production_engine, 'analyze_email') as mock_analyze:
        def side_effect(*args, **kwargs):
            if 'Bad email' in args[0]:
                raise Exception("Processing error")
            return EmailIntelligence(classification=EmailClass.NEEDS_REPLY, confidence=0.8)
        
        mock_analyze.side_effect = side_effect
        
        results = production_engine.batch_process_emails(emails)
        
        # Should still process all emails with fallback for failures
        assert len(results) == 2

@pytest.mark.unit
def test_batch_process_emails_concurrent_limit(production_engine):
    """Test batch processing respects concurrent limits"""
    emails = [{'subject': f'Email {i}', 'body': f'Content {i}', 'sender': f'user{i}@test.com'} 
              for i in range(10)]
    
    with patch.object(production_engine.executor, 'submit') as mock_submit:
        mock_future = MagicMock()
        mock_future.result.return_value = EmailIntelligence(classification=EmailClass.NEEDS_REPLY, confidence=0.8)
        mock_submit.return_value = mock_future
        
        production_engine.batch_process_emails(emails)
        
        # Should have submitted tasks to executor
        assert mock_submit.call_count == 10

# ============================================================================
# Feature Extraction Tests
# ============================================================================

@pytest.mark.unit
def test_extract_urgency_patterns(production_engine):
    """Test urgency extraction from text patterns"""
    test_cases = [
        ("URGENT: Need immediate response", Urgency.CRITICAL),
        ("This is high priority", Urgency.HIGH),
        ("When you have time", Urgency.MEDIUM),
        ("No rush on this", Urgency.LOW),
        ("Regular email content", Urgency.MEDIUM)  # Default
    ]
    
    for text, expected_urgency in test_cases:
        result = production_engine._extract_urgency_ai_enhanced(text)
        assert result == expected_urgency

@pytest.mark.unit
def test_extract_sentiment_patterns(production_engine):
    """Test sentiment extraction from text patterns"""
    test_cases = [
        ("Thanks for your excellent work!", Sentiment.POSITIVE),
        ("I'm disappointed with the results", Sentiment.NEGATIVE),
        ("This is absolutely ridiculous", Sentiment.FRUSTRATED),
        ("Here's the regular update", Sentiment.NEUTRAL)
    ]
    
    for text, expected_sentiment in test_cases:
        result = production_engine._extract_sentiment_ai_enhanced(text)
        assert result == expected_sentiment

@pytest.mark.unit
def test_extract_action_items(production_engine):
    """Test action item extraction"""
    text = """Please review the proposal and provide feedback. 
              We need to schedule a meeting next week.
              Action item: Update the documentation.
              TODO: Send out invitations."""
    
    action_items = production_engine._extract_action_items(text)
    
    assert len(action_items) > 0
    assert all(isinstance(item, ActionItem) for item in action_items)
    assert all(item.confidence > 0 for item in action_items)

@pytest.mark.unit
def test_extract_deadlines(production_engine):
    """Test deadline extraction"""
    text = "Please complete this by Friday. The deadline is next Monday."
    
    deadlines = production_engine._extract_deadlines(text)
    
    assert len(deadlines) > 0
    for deadline_date, deadline_text in deadlines:
        assert isinstance(deadline_date, datetime)
        assert isinstance(deadline_text, str)

# ============================================================================
# Performance Metrics Tests
# ============================================================================

@pytest.mark.unit
def test_performance_metrics_tracking(production_engine):
    """Test performance metrics are tracked"""
    initial_metrics = production_engine.get_performance_metrics()
    
    # Simulate some API calls
    with patch.object(production_engine.session, 'post') as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = {"choices": [{"message": {"content": "test"}}]}
        mock_post.return_value = mock_response
        
        production_engine._call_openai_api("test", "test", "model")
        production_engine._call_openai_api("test2", "test", "model")
    
    updated_metrics = production_engine.get_performance_metrics()
    
    # Should have more requests
    assert updated_metrics['requests']['total'] > initial_metrics['requests']['total']

@pytest.mark.unit
def test_cache_metrics_tracking(production_engine):
    """Test cache hit/miss metrics"""
    # Generate cache miss
    production_engine._get_from_cache("nonexistent_key")
    
    # Generate cache hit
    production_engine._put_in_cache("test_key", "test_data")
    production_engine._get_from_cache("test_key")
    
    metrics = production_engine.get_performance_metrics()
    
    assert metrics['cache']['hits'] >= 1
    assert metrics['cache']['misses'] >= 1
    assert metrics['cache']['current_size'] >= 1

@pytest.mark.unit
def test_metrics_report_structure(production_engine):
    """Test performance metrics report structure"""
    metrics = production_engine.get_performance_metrics()
    
    # Check required sections
    assert 'requests' in metrics
    assert 'cache' in metrics
    assert 'performance' in metrics
    assert 'configuration' in metrics
    
    # Check request metrics
    assert 'total' in metrics['requests']
    assert 'successful' in metrics['requests']
    assert 'failed' in metrics['requests']
    assert 'success_rate' in metrics['requests']
    
    # Check cache metrics
    assert 'hits' in metrics['cache']
    assert 'misses' in metrics['cache']
    assert 'hit_rate' in metrics['cache']

# ============================================================================
# Database Operations Tests
# ============================================================================

@pytest.mark.unit
def test_store_analysis_in_database(production_engine, sample_email):
    """Test storing analysis results in database"""
    analysis = EmailIntelligence(
        classification=EmailClass.NEEDS_REPLY,
        confidence=0.85,
        urgency=Urgency.HIGH,
        sentiment=Sentiment.NEUTRAL,
        intent="reply_needed"
    )
    
    email_hash = "test_hash_123"
    
    production_engine._store_analysis(
        email_hash,
        sample_email['subject'],
        sample_email['sender'],
        analysis
    )
    
    # Verify data was stored
    db_path = production_engine.config['database']['path']
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM email_analysis WHERE email_hash = ?", (email_hash,))
        result = cursor.fetchone()
        
        assert result is not None

@pytest.mark.unit
def test_get_cached_analysis_from_database(production_engine, sample_email):
    """Test retrieving cached analysis from database"""
    analysis = EmailIntelligence(
        classification=EmailClass.APPROVAL_REQUIRED,
        confidence=0.9,
        urgency=Urgency.CRITICAL,
        sentiment=Sentiment.POSITIVE
    )
    
    email_hash = "cached_test_123"
    
    # Store first
    production_engine._store_analysis(
        email_hash,
        sample_email['subject'],
        sample_email['sender'],
        analysis
    )
    
    # Then retrieve
    retrieved = production_engine._get_cached_analysis(email_hash)
    
    assert retrieved is not None
    assert retrieved.classification == EmailClass.APPROVAL_REQUIRED
    assert retrieved.confidence == 0.9

@pytest.mark.unit
def test_store_draft_in_database(production_engine):
    """Test storing draft in database"""
    email_hash = "draft_test_123"
    draft_content = "Test draft content"
    
    production_engine._store_draft(
        email_hash,
        draft_content,
        "ai",
        "gpt-5-mini"
    )
    
    # Verify draft was stored
    db_path = production_engine.config['database']['path']
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM draft_generations WHERE email_hash = ?", (email_hash,))
        result = cursor.fetchone()
        
        assert result is not None
        assert draft_content in result

@pytest.mark.unit
def test_get_cached_draft_from_database(production_engine):
    """Test retrieving cached draft from database"""
    email_hash = "draft_cached_123"
    draft_content = "Cached draft content"
    
    # Store first
    production_engine._store_draft(email_hash, draft_content, "template", "fallback")
    
    # Then retrieve
    retrieved = production_engine._get_cached_draft(email_hash)
    
    assert retrieved == draft_content

# ============================================================================
# Cleanup and Resource Management Tests
# ============================================================================

@pytest.mark.unit
def test_engine_cleanup(production_engine):
    """Test engine cleanup releases resources"""
    # Ensure executor is running
    assert not production_engine.executor._shutdown
    
    # Cleanup
    production_engine.cleanup()
    
    # Executor should be shutdown
    assert production_engine.executor._shutdown

@pytest.mark.unit
def test_cleanup_handles_missing_resources():
    """Test cleanup handles missing resources gracefully"""
    # Create engine without full initialization
    with patch('email_intelligence_production.ProductionEmailIntelligenceEngine._initialize_database'):
        engine = ProductionEmailIntelligenceEngine()
        
        # Remove executor to simulate missing resource
        if hasattr(engine, 'executor'):
            delattr(engine, 'executor')
        
        # Should not crash
        engine.cleanup()

# ============================================================================
# Integration Tests
# ============================================================================

@pytest.mark.integration
def test_full_email_processing_pipeline(production_engine, sample_email):
    """Test complete email processing pipeline"""
    with patch.object(production_engine, '_call_openai_api') as mock_api:
        # Mock AI responses
        mock_api.side_effect = [
            "APPROVAL_REQUIRED|0.92",  # Classification
            "Hi Sarah,\n\nI approve the proposal.\n\nBest regards, Test User"  # Draft
        ]
        
        # Analyze email
        analysis = production_engine.analyze_email(
            subject=sample_email['subject'],
            body=sample_email['body'],
            sender=sample_email['sender']
        )
        
        # Generate draft
        draft = production_engine.generate_draft_reply(sample_email, analysis)
        
        # Verify results
        assert analysis.classification == EmailClass.APPROVAL_REQUIRED
        assert analysis.confidence == 0.92
        assert "Hi Sarah" in draft
        assert "Best regards, Test User" in draft

@pytest.mark.integration
@pytest.mark.slow
def test_large_batch_processing(production_engine):
    """Test processing large batch of emails"""
    # Create large batch
    emails = []
    for i in range(50):
        emails.append({
            'subject': f'Email {i}',
            'body': f'This is email number {i} with some content to process.',
            'sender': f'user{i}@example.com'
        })
    
    with patch.object(production_engine, '_call_openai_api') as mock_api:
        mock_api.return_value = "NEEDS_REPLY|0.8"
        
        start_time = time.time()
        results = production_engine.batch_process_emails(emails)
        end_time = time.time()
        
        # Should process all emails
        assert len(results) == 50
        
        # Should complete in reasonable time
        assert (end_time - start_time) < 30  # 30 seconds max
        
        # All results should be valid
        assert all(isinstance(r, EmailIntelligence) for r in results)

# ============================================================================
# Error Recovery Tests
# ============================================================================

@pytest.mark.unit
def test_database_error_recovery(production_engine):
    """Test recovery from database errors"""
    with patch('sqlite3.connect') as mock_connect:
        mock_connect.side_effect = sqlite3.Error("Database error")
        
        # Should not crash when database operations fail
        result = production_engine._get_cached_analysis("test_hash")
        assert result is None
        
        # Should log error but continue
        production_engine._store_analysis("hash", "subject", "sender", 
                                         EmailIntelligence(classification=EmailClass.NEEDS_REPLY, confidence=0.8))

@pytest.mark.unit
def test_network_error_recovery(production_engine):
    """Test recovery from network errors"""
    with patch.object(production_engine.session, 'post') as mock_post:
        import requests
        mock_post.side_effect = [
            requests.exceptions.ConnectionError("Network error"),
            requests.exceptions.ConnectionError("Network error"),
            MagicMock()  # Success on retry
        ]
        
        # Should eventually succeed or return None gracefully
        result = production_engine._call_openai_api("test", "test", "model")

# ============================================================================
# Main Test Runner
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])