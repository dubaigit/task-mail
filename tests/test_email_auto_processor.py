#!/usr/bin/env python3
"""
Test suite for EmailAutoProcessor background AI processing pipeline
"""

import pytest
import asyncio
import time
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import Dict, List, Any

# Import test target
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from email_auto_processor import (
    EmailAutoProcessor, 
    ProcessingStatus, 
    ProcessingResult,
    get_auto_processor,
    start_auto_processing,
    stop_auto_processing
)

@pytest.fixture
def mock_mail_connector():
    """Mock Apple Mail connector"""
    connector = Mock()
    connector.get_recent_emails.return_value = [
        {
            'message_id': 1,
            'subject_text': 'Urgent: Please review proposal',
            'snippet': 'Need your feedback on the attached proposal by EOD',
            'sender_email': 'client@company.com',
            'is_read': False
        },
        {
            'message_id': 2,
            'subject_text': 'Re: Meeting follow-up',
            'snippet': 'Thanks for the meeting, here are the action items',
            'sender_email': 'colleague@company.com',
            'is_read': False
        }
    ]
    connector.get_email_by_id.return_value = {
        'message_id': 1,
        'subject_text': 'Test email',
        'snippet': 'Test content',
        'sender_email': 'test@example.com'
    }
    return connector

@pytest.fixture
def mock_intelligence_engine():
    """Mock email intelligence engine"""
    engine = Mock()
    
    # Mock analysis result
    analysis_result = Mock()
    analysis_result.classification = Mock()
    analysis_result.classification.__str__ = Mock(return_value="EmailClassification.NEEDS_REPLY")
    analysis_result.urgency = Mock()
    analysis_result.urgency.__str__ = Mock(return_value="EmailUrgency.HIGH")
    analysis_result.confidence = 0.85
    
    engine.analyze_email.return_value = analysis_result
    engine.generate_draft_reply.return_value = "Thank you for your email. I will review and respond shortly."
    
    return engine

@pytest.fixture
def mock_websocket_manager():
    """Mock WebSocket manager"""
    manager = AsyncMock()
    manager.broadcast = AsyncMock()
    return manager

@pytest.fixture
def auto_processor(mock_mail_connector, mock_intelligence_engine, mock_websocket_manager):
    """Create EmailAutoProcessor instance with mocked dependencies"""
    processor = EmailAutoProcessor(
        mail_connector=mock_mail_connector,
        intelligence_engine=mock_intelligence_engine,
        websocket_manager=mock_websocket_manager
    )
    return processor

class TestEmailAutoProcessor:
    """Test EmailAutoProcessor functionality"""
    
    def test_initialization(self, auto_processor):
        """Test processor initialization"""
        assert auto_processor is not None
        assert not auto_processor.is_running
        assert auto_processor.batch_size == 10
        assert auto_processor.processing_interval == 30
        assert auto_processor.max_retries == 3
        assert auto_processor.stats["emails_processed"] == 0

    def test_requires_action(self, auto_processor):
        """Test action requirement detection"""
        assert auto_processor._requires_action("NEEDS_REPLY")
        assert auto_processor._requires_action("APPROVAL_REQUIRED")
        assert auto_processor._requires_action("CREATE_TASK")
        assert auto_processor._requires_action("URGENT")
        assert not auto_processor._requires_action("FYI_ONLY")
        assert not auto_processor._requires_action("NEWSLETTER")

    def test_calculate_due_date(self, auto_processor):
        """Test due date calculation"""
        now = datetime.now()
        
        critical_due = auto_processor._calculate_due_date("CRITICAL")
        assert critical_due > now
        assert critical_due <= now + timedelta(hours=3)
        
        high_due = auto_processor._calculate_due_date("HIGH")
        assert high_due > now + timedelta(hours=6)
        assert high_due <= now + timedelta(hours=10)
        
        medium_due = auto_processor._calculate_due_date("MEDIUM")
        assert medium_due > now + timedelta(hours=20)
        assert medium_due <= now + timedelta(days=2)
        
        low_due = auto_processor._calculate_due_date("LOW")
        assert low_due > now + timedelta(days=2)
        assert low_due <= now + timedelta(days=4)

    @pytest.mark.asyncio
    async def test_get_unprocessed_emails(self, auto_processor, mock_mail_connector):
        """Test getting unprocessed emails"""
        emails = await auto_processor._get_unprocessed_emails()
        
        assert len(emails) == 2
        assert emails[0]['message_id'] == 1
        assert emails[1]['message_id'] == 2
        mock_mail_connector.get_recent_emails.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_email_success(self, auto_processor):
        """Test successful email processing"""
        test_email = {
            'message_id': 1,
            'subject_text': 'Urgent: Please review',
            'snippet': 'Need your feedback',
            'sender_email': 'test@example.com'
        }
        
        result = await auto_processor._process_email(test_email)
        
        assert result.email_id == 1
        assert result.classification == "NEEDS_REPLY"
        assert result.urgency == "HIGH"
        assert result.confidence == 0.85
        assert result.status == ProcessingStatus.COMPLETED
        assert result.processing_time_ms > 0
        assert len(result.tasks_generated) == 1
        assert len(result.drafts_generated) == 1

    @pytest.mark.asyncio
    async def test_process_email_failure(self, auto_processor, mock_intelligence_engine):
        """Test email processing failure handling"""
        # Make the intelligence engine throw an exception
        mock_intelligence_engine.analyze_email.side_effect = Exception("AI service unavailable")
        
        test_email = {
            'message_id': 1,
            'subject_text': 'Test email',
            'snippet': 'Test content',
            'sender_email': 'test@example.com'
        }
        
        result = await auto_processor._process_email(test_email)
        
        assert result.email_id == 1
        assert result.status == ProcessingStatus.FAILED
        assert result.error_message == "AI service unavailable"
        assert len(result.tasks_generated) == 0
        assert len(result.drafts_generated) == 0

    @pytest.mark.asyncio
    async def test_generate_task(self, auto_processor, mock_intelligence_engine):
        """Test task generation from email"""
        test_email = {
            'message_id': 1,
            'subject_text': 'Project approval needed',
            'sender_email': 'manager@company.com'
        }
        
        analysis = mock_intelligence_engine.analyze_email.return_value
        task = await auto_processor._generate_task(test_email, analysis)
        
        assert task is not None
        assert task['email_id'] == 1
        assert 'Project approval needed' in task['subject']
        assert task['task_type'] == 'NEEDS_REPLY'
        assert task['priority'] == 'HIGH'
        assert task['status'] == 'pending'
        assert task['confidence'] == 0.85

    @pytest.mark.asyncio
    async def test_generate_draft(self, auto_processor, mock_intelligence_engine):
        """Test draft generation from email"""
        test_email = {
            'message_id': 1,
            'subject_text': 'Meeting request',
            'snippet': 'Can we schedule a meeting?',
            'sender_email': 'colleague@company.com'
        }
        
        analysis = mock_intelligence_engine.analyze_email.return_value
        draft = await auto_processor._generate_draft(test_email, analysis)
        
        assert draft is not None
        assert draft['email_id'] == 1
        assert draft['to'] == 'colleague@company.com'
        assert 'Re: Meeting request' in draft['subject']
        assert 'Thank you for your email' in draft['content']
        assert draft['confidence'] == 0.85
        assert draft['status'] == 'draft'

    @pytest.mark.asyncio
    async def test_send_websocket_update(self, auto_processor, mock_websocket_manager):
        """Test WebSocket update sending"""
        result = ProcessingResult(
            email_id=1,
            classification="NEEDS_REPLY",
            urgency="HIGH",
            confidence=0.85,
            tasks_generated=[{"id": "task_1"}],
            drafts_generated=[{"id": "draft_1"}],
            processing_time_ms=150.0,
            status=ProcessingStatus.COMPLETED
        )
        
        await auto_processor._send_websocket_update(result)
        
        mock_websocket_manager.broadcast.assert_called_once()
        call_args = mock_websocket_manager.broadcast.call_args[0][0]
        assert call_args['type'] == 'auto_processing_complete'
        assert call_args['data']['email_id'] == 1
        assert call_args['data']['tasks_count'] == 1
        assert call_args['data']['drafts_count'] == 1

    def test_update_stats(self, auto_processor):
        """Test statistics updating"""
        result = ProcessingResult(
            email_id=1,
            classification="NEEDS_REPLY",
            urgency="HIGH",
            confidence=0.85,
            tasks_generated=[{"id": "task_1"}],
            drafts_generated=[{"id": "draft_1"}],
            processing_time_ms=100.0,
            status=ProcessingStatus.COMPLETED
        )
        
        initial_processed = auto_processor.stats["emails_processed"]
        auto_processor._update_stats(result)
        
        assert auto_processor.stats["emails_processed"] == initial_processed + 1
        assert auto_processor.stats["tasks_generated"] == 1
        assert auto_processor.stats["drafts_generated"] == 1
        assert auto_processor.stats["average_processing_time"] == 100.0

    @pytest.mark.asyncio
    async def test_process_email_manually(self, auto_processor, mock_mail_connector):
        """Test manual email processing"""
        email_id = 1
        result = await auto_processor.process_email_manually(email_id)
        
        assert result.email_id == email_id
        assert result.status == ProcessingStatus.COMPLETED
        assert email_id in auto_processor.processed_emails
        mock_mail_connector.get_email_by_id.assert_called_once_with(email_id)

    @pytest.mark.asyncio
    async def test_process_email_manually_not_found(self, auto_processor, mock_mail_connector):
        """Test manual processing of non-existent email"""
        mock_mail_connector.get_email_by_id.return_value = None
        
        result = await auto_processor.process_email_manually(999)
        
        assert result.email_id == 999
        assert result.status == ProcessingStatus.FAILED
        assert "not found" in result.error_message

    def test_get_processing_stats(self, auto_processor):
        """Test getting processing statistics"""
        stats = auto_processor.get_processing_stats()
        
        assert "emails_processed" in stats
        assert "tasks_generated" in stats
        assert "drafts_generated" in stats
        assert "processing_errors" in stats
        assert "average_processing_time" in stats
        assert "is_running" in stats
        assert "queue_size" in stats
        assert "retry_queue_size" in stats
        assert "processed_emails_count" in stats

    def test_get_health_status(self, auto_processor):
        """Test getting health status"""
        health = auto_processor.get_health_status()
        
        assert "status" in health
        assert "uptime_seconds" in health
        assert "last_processing_time" in health
        assert "error_rate" in health
        assert health["status"] == "stopped"  # Not running initially

    @pytest.mark.asyncio
    async def test_background_processing_lifecycle(self, auto_processor):
        """Test starting and stopping background processing"""
        assert not auto_processor.is_running
        
        # Start processing (but cancel quickly to avoid infinite loop)
        task = asyncio.create_task(auto_processor.start_background_processing())
        await asyncio.sleep(0.1)  # Let it start
        
        assert auto_processor.is_running
        
        # Stop processing
        await auto_processor.stop_background_processing()
        task.cancel()
        
        try:
            await task
        except asyncio.CancelledError:
            pass
        
        assert not auto_processor.is_running

class TestGlobalFunctions:
    """Test global auto processor functions"""
    
    def test_get_auto_processor_singleton(self):
        """Test that get_auto_processor returns singleton"""
        processor1 = get_auto_processor()
        processor2 = get_auto_processor()
        
        assert processor1 is processor2

    @pytest.mark.asyncio
    async def test_start_stop_auto_processing(self):
        """Test global start/stop functions"""
        processor = get_auto_processor()
        
        # Start processing
        task = asyncio.create_task(start_auto_processing())
        await asyncio.sleep(0.1)
        
        assert processor.is_running
        
        # Stop processing
        await stop_auto_processing()
        task.cancel()
        
        try:
            await task
        except asyncio.CancelledError:
            pass
        
        assert not processor.is_running

class TestIntegration:
    """Integration tests for complete workflows"""
    
    @pytest.mark.asyncio
    async def test_complete_processing_workflow(self, auto_processor):
        """Test complete email processing workflow"""
        # Simulate processing workflow
        emails = await auto_processor._get_unprocessed_emails()
        assert len(emails) > 0
        
        # Process first email
        result = await auto_processor._process_email(emails[0])
        
        # Verify processing completed successfully
        assert result.status == ProcessingStatus.COMPLETED
        assert result.confidence > 0
        
        # Check that tasks and drafts were generated for actionable email
        if auto_processor._requires_action(result.classification):
            assert len(result.tasks_generated) > 0
        
        if result.classification == "NEEDS_REPLY" and result.confidence > 0.7:
            assert len(result.drafts_generated) > 0
        
        # Verify stats were updated
        stats = auto_processor.get_processing_stats()
        assert stats["emails_processed"] > 0

if __name__ == "__main__":
    pytest.main([__file__, "-v"])