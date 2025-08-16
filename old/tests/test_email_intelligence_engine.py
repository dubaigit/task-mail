#!/usr/bin/env python3
"""
Unit tests for EmailIntelligenceEngine
Tests AI classification, draft generation, and performance metrics
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
from freezegun import freeze_time
import json

# Import the module to test
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from email_intelligence_engine import (
    EmailIntelligenceEngine,
    EmailClassification,
    EmailUrgency,
    EmailAnalysisResult
)


class TestEmailIntelligenceEngine:
    """Test suite for EmailIntelligenceEngine"""
    
    @pytest.fixture
    def engine(self):
        """Create an engine instance for testing"""
        with patch.dict(os.environ, {
            'OPENAI_API_KEY': 'test-key-123',
            'EMAIL_AI_CLASSIFY_MODEL': 'gpt-5-nano-2025-08-07',
            'EMAIL_AI_DRAFT_MODEL': 'gpt-5-mini-2025-08-07'
        }):
            return EmailIntelligenceEngine()
    
    @pytest.fixture
    def sample_email(self):
        """Sample email data for testing"""
        return {
            'subject': 'Urgent: Production Server Down',
            'body': 'The production server is experiencing critical issues and needs immediate attention.',
            'sender': 'ops@company.com'
        }
    
    def test_initialization(self, engine):
        """Test engine initialization with environment variables"""
        assert engine.api_key == 'test-key-123'
        assert engine.classifier_model == 'gpt-5-nano-2025-08-07'
        assert engine.draft_model == 'gpt-5-mini-2025-08-07'
        assert engine.ai_enabled == True
        assert isinstance(engine.stats, dict)
    
    def test_initialization_without_api_key(self):
        """Test fallback to pattern matching when no API key"""
        with patch.dict(os.environ, {}, clear=True):
            engine = EmailIntelligenceEngine()
            assert engine.ai_enabled == False
            assert engine.api_key is None
    
    @patch('requests.post')
    def test_classify_with_ai_success(self, mock_post, engine, sample_email):
        """Test successful AI classification"""
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': json.dumps({
                        'classification': 'APPROVAL_REQUIRED',
                        'urgency': 'HIGH',
                        'confidence': 0.95
                    })
                }
            }]
        }
        mock_post.return_value = mock_response
        
        result = engine._classify_with_ai(
            sample_email['subject'],
            sample_email['body'],
            sample_email['sender']
        )
        
        assert result.classification == EmailClassification.APPROVAL_REQUIRED
        assert result.urgency == EmailUrgency.HIGH
        assert result.confidence == 0.95
        
        # Verify API call
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert 'https://api.openai.com/v1/chat/completions' in call_args[0]
        assert 'gpt-5-nano-2025-08-07' in str(call_args)
    
    @patch('requests.post')
    def test_classify_with_ai_fallback(self, mock_post, engine, sample_email):
        """Test fallback to pattern matching when AI fails"""
        # Mock API failure
        mock_post.side_effect = Exception("API Error")
        
        result = engine._classify_with_ai(
            sample_email['subject'],
            sample_email['body'],
            sample_email['sender']
        )
        
        # Should fallback to pattern matching
        assert result is None
    
    def test_classify_with_patterns_urgent(self, engine):
        """Test pattern-based classification for urgent emails"""
        result = engine._classify_with_patterns(
            subject="URGENT: Server is down!",
            body="Critical production issue needs immediate attention",
            sender="alerts@monitoring.com"
        )
        
        assert result.classification == EmailClassification.APPROVAL_REQUIRED
        assert result.urgency == EmailUrgency.HIGH
        assert result.confidence >= 0.8
    
    def test_classify_with_patterns_invoice(self, engine):
        """Test pattern-based classification for invoices"""
        result = engine._classify_with_patterns(
            subject="Invoice #12345 for your review",
            body="Please find attached the invoice for last month's services",
            sender="billing@vendor.com"
        )
        
        assert result.classification == EmailClassification.APPROVAL_REQUIRED
        assert result.urgency == EmailUrgency.MEDIUM
    
    def test_classify_with_patterns_meeting(self, engine):
        """Test pattern-based classification for meeting requests"""
        result = engine._classify_with_patterns(
            subject="Meeting request: Project sync",
            body="Can we schedule a meeting to discuss the project status?",
            sender="colleague@company.com"
        )
        
        assert result.classification == EmailClassification.CREATE_TASK
        assert result.urgency == EmailUrgency.MEDIUM
    
    def test_classify_with_patterns_newsletter(self, engine):
        """Test pattern-based classification for newsletters"""
        result = engine._classify_with_patterns(
            subject="Monthly Newsletter - January Edition",
            body="Here's what's new this month in our newsletter",
            sender="newsletter@company.com"
        )
        
        assert result.classification == EmailClassification.FYI_ONLY
        assert result.urgency == EmailUrgency.LOW
    
    @patch('email_intelligence_engine.EmailIntelligenceEngine._classify_with_ai')
    @patch('email_intelligence_engine.EmailIntelligenceEngine._classify_with_patterns')
    def test_analyze_email_ai_priority(self, mock_patterns, mock_ai, engine, sample_email):
        """Test that AI classification is attempted first"""
        # Mock successful AI classification
        ai_result = EmailAnalysisResult(
            classification=EmailClassification.APPROVAL_REQUIRED,
            urgency=EmailUrgency.HIGH,
            confidence=0.95
        )
        mock_ai.return_value = ai_result
        
        result = engine.analyze_email(
            sample_email['subject'],
            sample_email['body'],
            sample_email['sender']
        )
        
        assert result == ai_result
        mock_ai.assert_called_once()
        mock_patterns.assert_not_called()  # Pattern matching should not be called
    
    @patch('email_intelligence_engine.EmailIntelligenceEngine._classify_with_ai')
    @patch('email_intelligence_engine.EmailIntelligenceEngine._classify_with_patterns')
    def test_analyze_email_fallback_to_patterns(self, mock_patterns, mock_ai, engine, sample_email):
        """Test fallback to pattern matching when AI fails"""
        # Mock AI failure
        mock_ai.return_value = None
        
        # Mock pattern result
        pattern_result = EmailAnalysisResult(
            classification=EmailClassification.NEEDS_REPLY,
            urgency=EmailUrgency.MEDIUM,
            confidence=0.7
        )
        mock_patterns.return_value = pattern_result
        
        result = engine.analyze_email(
            sample_email['subject'],
            sample_email['body'],
            sample_email['sender']
        )
        
        assert result == pattern_result
        mock_ai.assert_called_once()
        mock_patterns.assert_called_once()
    
    @patch('requests.post')
    def test_generate_draft_reply_approval(self, mock_post, engine):
        """Test draft generation for approval required emails"""
        # Mock OpenAI response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': 'Thank you for your email. I have reviewed the request and approve.'
                }
            }]
        }
        mock_post.return_value = mock_response
        
        email_data = {
            'subject': 'Budget Approval Request',
            'sender_name': 'John Doe',
            'content': 'Please approve the Q1 budget.'
        }
        analysis = EmailAnalysisResult(
            classification=EmailClassification.APPROVAL_REQUIRED,
            urgency=EmailUrgency.HIGH,
            confidence=0.9
        )
        
        draft = engine.generate_draft_reply(email_data, analysis)
        
        assert 'approve' in draft.lower() or 'review' in draft.lower()
        mock_post.assert_called_once()
    
    def test_generate_draft_reply_fallback(self, engine):
        """Test draft generation fallback when AI is disabled"""
        engine.ai_enabled = False
        
        email_data = {
            'subject': 'Meeting Request',
            'sender_name': 'Jane Smith',
            'content': 'Can we meet tomorrow?'
        }
        analysis = EmailAnalysisResult(
            classification=EmailClassification.CREATE_TASK,
            urgency=EmailUrgency.MEDIUM,
            confidence=0.7
        )
        
        draft = engine.generate_draft_reply(email_data, analysis)
        
        assert 'Jane Smith' in draft
        assert 'Meeting Request' in draft
    
    @freeze_time("2024-01-15 10:30:00")
    def test_get_performance_metrics(self, engine):
        """Test performance metrics tracking"""
        # Simulate some processing
        engine.stats['total_processed'] = 100
        engine.stats['ai_classifications'] = 80
        engine.stats['pattern_classifications'] = 20
        engine.stats['avg_confidence'] = 0.85
        
        metrics = engine.get_performance_metrics()
        
        assert metrics['total_processed'] == 100
        assert metrics['ai_success_rate'] == 0.8
        assert metrics['avg_confidence'] == 0.85
        assert 'uptime_hours' in metrics
    
    def test_email_classification_enum(self):
        """Test EmailClassification enum values"""
        assert EmailClassification.NEEDS_REPLY.value == "NEEDS_REPLY"
        assert EmailClassification.APPROVAL_REQUIRED.value == "APPROVAL_REQUIRED"
        assert EmailClassification.CREATE_TASK.value == "CREATE_TASK"
        assert EmailClassification.DELEGATE.value == "DELEGATE"
        assert EmailClassification.FYI_ONLY.value == "FYI_ONLY"
        assert EmailClassification.FOLLOW_UP.value == "FOLLOW_UP"
    
    def test_email_urgency_enum(self):
        """Test EmailUrgency enum values"""
        assert EmailUrgency.HIGH.value == "HIGH"
        assert EmailUrgency.MEDIUM.value == "MEDIUM"
        assert EmailUrgency.LOW.value == "LOW"
    
    def test_email_analysis_result_dataclass(self):
        """Test EmailAnalysisResult dataclass"""
        result = EmailAnalysisResult(
            classification=EmailClassification.NEEDS_REPLY,
            urgency=EmailUrgency.HIGH,
            confidence=0.95
        )
        
        assert result.classification == EmailClassification.NEEDS_REPLY
        assert result.urgency == EmailUrgency.HIGH
        assert result.confidence == 0.95
    
    def test_stats_tracking(self, engine):
        """Test that stats are properly tracked"""
        with patch.object(engine, '_classify_with_ai') as mock_ai:
            mock_ai.return_value = EmailAnalysisResult(
                classification=EmailClassification.NEEDS_REPLY,
                urgency=EmailUrgency.MEDIUM,
                confidence=0.9
            )
            
            # Process multiple emails
            for _ in range(5):
                engine.analyze_email("Test", "Body", "sender@example.com")
            
            assert engine.stats['total_processed'] == 5
            assert engine.stats['ai_classifications'] == 5
    
    def test_error_handling_in_analysis(self, engine):
        """Test graceful error handling in email analysis"""
        # Test with None values
        result = engine.analyze_email(None, None, None)
        assert isinstance(result, EmailAnalysisResult)
        
        # Test with empty strings
        result = engine.analyze_email("", "", "")
        assert isinstance(result, EmailAnalysisResult)
        
        # Test with very long input
        long_text = "x" * 10000
        result = engine.analyze_email(long_text, long_text, "sender@example.com")
        assert isinstance(result, EmailAnalysisResult)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--cov=email_intelligence_engine"])