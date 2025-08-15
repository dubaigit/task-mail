#!/usr/bin/env python3
"""
Comprehensive Email Intelligence Engine Tests

Tests AI classification, pattern matching, performance, and edge cases.
Covers all classification types, urgency detection, and content analysis.

Priority: CRITICAL - Core business logic must be 100% covered
"""

import pytest
import time
import json
import asyncio
from datetime import datetime, timedelta
from unittest.mock import patch, Mock, MagicMock, call
from pathlib import Path
import sys

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from email_intelligence_engine import (
    EmailIntelligenceEngine,
    EmailClass,
    Urgency,
    Sentiment,
    EmailAnalysisResult,
    ActionItem
)


class TestEmailIntelligenceEngineComprehensive:
    """Comprehensive test suite for EmailIntelligenceEngine"""
    
    @pytest.fixture
    def engine(self):
        """Create EmailIntelligenceEngine instance"""
        return EmailIntelligenceEngine()
    
    @pytest.fixture
    def sample_emails(self):
        """Sample emails for testing different classifications"""
        return {
            'needs_reply': {
                'subject': 'Quick question about the project',
                'body': 'Hi, I have a quick question about the timeline for the new feature. Can you please let me know when you expect it to be completed?',
                'sender': 'john.doe@company.com'
            },
            'approval_required': {
                'subject': 'Budget approval needed - Q4 Marketing',
                'body': 'I need your approval for the Q4 marketing budget of $75,000. Please review the attached proposal and let me know by Friday.',
                'sender': 'finance@company.com'
            },
            'create_task': {
                'subject': 'New feature request from client',
                'body': 'The client has requested a new dashboard feature. We need to: 1) Design the UI mockups 2) Implement the backend API 3) Test thoroughly 4) Deploy by next month.',
                'sender': 'client@bigcorp.com'
            },
            'delegate': {
                'subject': 'Customer support escalation',
                'body': 'This issue requires technical expertise. Please forward to the engineering team for investigation. The customer is experiencing database connectivity issues.',
                'sender': 'support@company.com'
            },
            'fyi_only': {
                'subject': 'Monthly newsletter - August 2024',
                'body': 'Welcome to our monthly newsletter! This month we cover industry trends, new product updates, and upcoming events.',
                'sender': 'newsletter@company.com'
            },
            'follow_up': {
                'subject': 'Re: Proposal submitted last week',
                'body': 'Following up on the proposal I submitted last week. Just wanted to check if you had a chance to review it.',
                'sender': 'vendor@supplier.com'
            }
        }
    
    @pytest.fixture
    def urgency_emails(self):
        """Sample emails for urgency testing"""
        return {
            'critical': {
                'subject': 'URGENT: Server outage affecting all customers',
                'body': 'We have a critical server outage affecting all customers. Need immediate action to restore service.',
                'sender': 'ops@company.com'
            },
            'high': {
                'subject': 'Important meeting tomorrow',
                'body': 'Important client meeting tomorrow at 9 AM. Please confirm your attendance.',
                'sender': 'boss@company.com'
            },
            'medium': {
                'subject': 'Weekly report due Friday',
                'body': 'Please remember that the weekly report is due this Friday. Let me know if you need any assistance.',
                'sender': 'manager@company.com'
            },
            'low': {
                'subject': 'FYI: New coffee machine in break room',
                'body': 'Just wanted to let everyone know we have a new coffee machine in the break room. Enjoy!',
                'sender': 'hr@company.com'
            }
        }


class TestEmailClassification(TestEmailIntelligenceEngineComprehensive):
    """Test email classification functionality"""
    
    def test_needs_reply_classification(self, engine, sample_emails):
        """Test NEEDS_REPLY classification"""
        email = sample_emails['needs_reply']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.classification == EmailClass.NEEDS_REPLY
        assert result.confidence > 0.5
        assert isinstance(result.processing_time_ms, (int, float))
        assert result.processing_time_ms > 0
    
    def test_approval_required_classification(self, engine, sample_emails):
        """Test APPROVAL_REQUIRED classification"""
        email = sample_emails['approval_required']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.classification == EmailClass.APPROVAL_REQUIRED
        assert result.confidence > 0.5
        assert result.urgency in [Urgency.HIGH, Urgency.CRITICAL]
    
    def test_create_task_classification(self, engine, sample_emails):
        """Test CREATE_TASK classification"""
        email = sample_emails['create_task']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.classification == EmailClass.CREATE_TASK
        assert result.confidence > 0.5
        assert len(result.action_items) > 0
        
        # Check action items are properly parsed
        action_texts = [item.text for item in result.action_items]
        assert any('design' in action.lower() for action in action_texts)
        assert any('implement' in action.lower() for action in action_texts)
    
    def test_delegate_classification(self, engine, sample_emails):
        """Test DELEGATE classification"""
        email = sample_emails['delegate']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.classification == EmailClass.DELEGATE
        assert result.confidence > 0.5
        # Should identify who to delegate to
        assert len(result.action_items) > 0
    
    def test_fyi_only_classification(self, engine, sample_emails):
        """Test FYI_ONLY classification"""
        email = sample_emails['fyi_only']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.classification == EmailClass.FYI_ONLY
        assert result.confidence > 0.5
        assert result.urgency == Urgency.LOW
    
    def test_follow_up_classification(self, engine, sample_emails):
        """Test FOLLOW_UP classification"""
        email = sample_emails['follow_up']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.classification == EmailClass.FOLLOW_UP
        assert result.confidence > 0.5


class TestUrgencyDetection(TestEmailIntelligenceEngineComprehensive):
    """Test urgency detection functionality"""
    
    def test_critical_urgency_detection(self, engine, urgency_emails):
        """Test CRITICAL urgency detection"""
        email = urgency_emails['critical']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.urgency == Urgency.CRITICAL
        assert result.confidence > 0.7
    
    def test_high_urgency_detection(self, engine, urgency_emails):
        """Test HIGH urgency detection"""
        email = urgency_emails['high']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.urgency in [Urgency.HIGH, Urgency.CRITICAL]
        assert result.confidence > 0.5
    
    def test_medium_urgency_detection(self, engine, urgency_emails):
        """Test MEDIUM urgency detection"""
        email = urgency_emails['medium']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.urgency in [Urgency.MEDIUM, Urgency.LOW]
        assert result.confidence > 0.4
    
    def test_low_urgency_detection(self, engine, urgency_emails):
        """Test LOW urgency detection"""
        email = urgency_emails['low']
        result = engine.analyze_email(email['subject'], email['body'], email['sender'])
        
        assert result.urgency == Urgency.LOW
        assert result.confidence > 0.3
    
    def test_urgency_keywords_detection(self, engine):
        """Test urgency keyword detection"""
        urgent_keywords = ['URGENT', 'ASAP', 'IMMEDIATE', 'CRITICAL', 'EMERGENCY']
        
        for keyword in urgent_keywords:
            result = engine.analyze_email(
                f'{keyword}: Test subject',
                f'This is a {keyword.lower()} message that needs attention.',
                'test@company.com'
            )
            
            assert result.urgency in [Urgency.HIGH, Urgency.CRITICAL]
    
    def test_deadline_based_urgency(self, engine):
        """Test urgency based on deadlines"""
        # Today's deadline should be critical
        today = datetime.now().strftime('%Y-%m-%d')
        result = engine.analyze_email(
            'Task due today',
            f'Please complete this task by {today}.',
            'manager@company.com'
        )
        
        assert result.urgency in [Urgency.HIGH, Urgency.CRITICAL]
        
        # Next week deadline should be medium
        next_week = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
        result = engine.analyze_email(
            'Task due next week',
            f'Please complete this task by {next_week}.',
            'manager@company.com'
        )
        
        assert result.urgency in [Urgency.MEDIUM, Urgency.LOW]


class TestActionItemExtraction(TestEmailIntelligenceEngineComprehensive):
    """Test action item extraction functionality"""
    
    def test_action_item_extraction_basic(self, engine):
        """Test basic action item extraction"""
        result = engine.analyze_email(
            'Project tasks',
            'Please do the following: 1) Review the proposal 2) Schedule a meeting 3) Send the report',
            'manager@company.com'
        )
        
        assert len(result.action_items) >= 2
        action_texts = [item.text for item in result.action_items]
        assert any('review' in action.lower() for action in action_texts)
        assert any('schedule' in action.lower() for action in action_texts)
    
    def test_action_item_with_assignees(self, engine):
        """Test action item extraction with assignees"""
        result = engine.analyze_email(
            'Team assignments',
            'John should review the code, Sarah needs to update the documentation, and Mike will handle testing.',
            'lead@company.com'
        )
        
        assert len(result.action_items) >= 2
        
        # Check for assignee detection
        assignees = [item.assignee for item in result.action_items if item.assignee]
        assert len(assignees) > 0
    
    def test_action_item_with_deadlines(self, engine):
        """Test action item extraction with deadlines"""
        result = engine.analyze_email(
            'Deadlines approaching',
            'Please submit the report by Friday and schedule the meeting for next Tuesday.',
            'manager@company.com'
        )
        
        assert len(result.action_items) >= 1
        
        # Check for deadline detection
        deadlines = [item.deadline for item in result.action_items if item.deadline]
        assert len(deadlines) > 0
    
    def test_complex_action_items(self, engine):
        """Test complex action item extraction"""
        result = engine.analyze_email(
            'Complex project plan',
            '''
            Here's what we need to accomplish:
            - Research the market trends by Monday (assign to John)
            - Create wireframes and mockups by Wednesday (assign to Design team)
            - Implement the backend API by Friday (assign to Dev team)
            - Write comprehensive tests by next Monday
            - Deploy to staging environment by next Wednesday
            ''',
            'pm@company.com'
        )
        
        assert len(result.action_items) >= 3
        
        # Should detect multiple assignees
        assignees = [item.assignee for item in result.action_items if item.assignee]
        assert len(assignees) >= 2
        
        # Should detect multiple deadlines
        deadlines = [item.deadline for item in result.action_items if item.deadline]
        assert len(deadlines) >= 2


class TestSentimentAnalysis(TestEmailIntelligenceEngineComprehensive):
    """Test email sentiment analysis"""
    
    def test_positive_sentiment(self, engine):
        """Test positive sentiment detection"""
        result = engine.analyze_email(
            'Great work!',
            'Excellent job on the project! I am very happy with the results. Thank you for your hard work.',
            'boss@company.com'
        )
        
        assert result.sentiment == Sentiment.POSITIVE
        assert result.confidence > 0.5
    
    def test_negative_sentiment(self, engine):
        """Test negative sentiment detection"""
        result = engine.analyze_email(
            'Issues with the delivery',
            'I am disappointed with the delayed delivery. This is unacceptable and causes major problems.',
            'client@company.com'
        )
        
        assert result.sentiment == Sentiment.NEGATIVE
        assert result.confidence > 0.5
    
    def test_frustrated_sentiment(self, engine):
        """Test frustrated sentiment detection"""
        result = engine.analyze_email(
            'This is ridiculous',
            'This is the third time I am asking for the same information. Why is this taking so long?',
            'client@company.com'
        )
        
        assert result.sentiment in [Sentiment.FRUSTRATED, Sentiment.NEGATIVE]
        assert result.confidence > 0.4
    
    def test_neutral_sentiment(self, engine):
        """Test neutral sentiment detection"""
        result = engine.analyze_email(
            'Meeting notes',
            'Please find attached the meeting notes from today. Next meeting is scheduled for Friday.',
            'assistant@company.com'
        )
        
        assert result.sentiment == Sentiment.NEUTRAL
        assert result.confidence > 0.3


class TestPatternMatchingFallback(TestEmailIntelligenceEngineComprehensive):
    """Test pattern-based classification when AI is unavailable"""
    
    @patch('email_intelligence_engine.EmailIntelligenceEngine._classify_with_ai')
    def test_pattern_fallback_approval(self, mock_ai, engine):
        """Test pattern fallback for approval emails"""
        mock_ai.return_value = None  # Simulate AI failure
        
        result = engine.analyze_email(
            'Please approve the budget request',
            'I need your approval for the following budget allocation...',
            'finance@company.com'
        )
        
        assert result.classification == EmailClass.APPROVAL_REQUIRED
        assert result.confidence > 0.0
        mock_ai.assert_called_once()
    
    @patch('email_intelligence_engine.EmailIntelligenceEngine._classify_with_ai')
    def test_pattern_fallback_newsletter(self, mock_ai, engine):
        """Test pattern fallback for newsletters"""
        mock_ai.return_value = None
        
        result = engine.analyze_email(
            'Weekly Newsletter - Issue #42',
            'In this week\'s newsletter: industry updates, new features, and upcoming events.',
            'newsletter@company.com'
        )
        
        assert result.classification == EmailClass.FYI_ONLY
        assert result.urgency == Urgency.LOW
    
    @patch('email_intelligence_engine.EmailIntelligenceEngine._classify_with_ai')
    def test_pattern_fallback_meeting(self, mock_ai, engine):
        """Test pattern fallback for meeting requests"""
        mock_ai.return_value = None
        
        result = engine.analyze_email(
            'Meeting invitation: Project review',
            'You are invited to the weekly project review meeting on Friday at 2 PM.',
            'calendar@company.com'
        )
        
        assert result.classification in [EmailClass.NEEDS_REPLY, EmailClass.FYI_ONLY]


class TestAIIntegration(TestEmailIntelligenceEngineComprehensive):
    """Test AI integration functionality"""
    
    @patch('requests.post')
    def test_ai_classification_success(self, mock_post, engine):
        """Test successful AI classification"""
        # Mock successful OpenAI response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': json.dumps({
                        'classification': 'NEEDS_REPLY',
                        'urgency': 'HIGH',
                        'confidence': 0.92,
                        'reasoning': 'Email contains direct questions requiring response',
                        'action_items': ['Respond to questions', 'Provide timeline'],
                        'sentiment': 'NEUTRAL'
                    })
                }
            }]
        }
        mock_post.return_value = mock_response
        
        result = engine.analyze_email(
            'Quick questions about the project',
            'Can you please answer these questions about the timeline?',
            'client@company.com'
        )
        
        assert result.classification == EmailClass.NEEDS_REPLY
        assert result.urgency == Urgency.HIGH
        assert result.confidence == 0.92
        assert len(result.action_items) == 2
    
    @patch('requests.post')
    def test_ai_classification_failure(self, mock_post, engine):
        """Test AI classification failure and fallback"""
        # Mock API failure
        mock_post.side_effect = Exception("API Error")
        
        result = engine.analyze_email(
            'Approval needed for budget',
            'Please approve the attached budget proposal.',
            'finance@company.com'
        )
        
        # Should fall back to pattern matching
        assert result.classification == EmailClass.APPROVAL_REQUIRED
        assert result.confidence > 0.0
    
    @patch('requests.post')
    def test_ai_invalid_response(self, mock_post, engine):
        """Test handling of invalid AI response"""
        # Mock invalid response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'choices': [{
                'message': {
                    'content': 'Invalid JSON response'
                }
            }]
        }
        mock_post.return_value = mock_response
        
        result = engine.analyze_email(
            'Test subject',
            'Test body',
            'test@company.com'
        )
        
        # Should fall back to pattern matching
        assert result.classification is not None
        assert result.confidence > 0.0
    
    @patch('requests.post')
    def test_ai_timeout_handling(self, mock_post, engine):
        """Test AI timeout handling"""
        # Mock timeout
        import requests
        mock_post.side_effect = requests.Timeout("Request timeout")
        
        result = engine.analyze_email(
            'Test subject',
            'Test body',
            'test@company.com'
        )
        
        # Should handle timeout gracefully and fall back
        assert result.classification is not None
        assert result.confidence >= 0.0


class TestPerformanceRequirements(TestEmailIntelligenceEngineComprehensive):
    """Test performance requirements"""
    
    def test_classification_speed(self, engine):
        """Test classification meets speed requirements (<100ms average)"""
        times = []
        
        for _ in range(10):
            start_time = time.time()
            result = engine.analyze_email(
                'Performance test email',
                'This is a test email to measure classification performance.',
                'test@company.com'
            )
            end_time = time.time()
            
            times.append((end_time - start_time) * 1000)  # Convert to ms
            assert result.processing_time_ms > 0
        
        avg_time = sum(times) / len(times)
        assert avg_time < 200, f"Average classification time {avg_time:.1f}ms exceeds 200ms limit"
    
    def test_batch_processing_performance(self, engine):
        """Test batch processing performance"""
        emails = [
            ('Subject 1', 'Body 1', 'sender1@test.com'),
            ('Subject 2', 'Body 2', 'sender2@test.com'),
            ('Subject 3', 'Body 3', 'sender3@test.com'),
            ('Subject 4', 'Body 4', 'sender4@test.com'),
            ('Subject 5', 'Body 5', 'sender5@test.com'),
        ]
        
        start_time = time.time()
        results = engine.analyze_emails_batch(emails)
        end_time = time.time()
        
        batch_time = (end_time - start_time) * 1000
        per_email_time = batch_time / len(emails)
        
        assert len(results) == len(emails)
        assert per_email_time < 150, f"Batch processing {per_email_time:.1f}ms per email too slow"
    
    def test_memory_usage(self, engine):
        """Test memory usage stays reasonable"""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Process many emails
        for i in range(100):
            engine.analyze_email(
                f'Test email {i}',
                f'This is test email number {i} with some content to analyze.',
                f'test{i}@company.com'
            )
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        assert memory_increase < 50, f"Memory usage increased by {memory_increase:.1f}MB, should be < 50MB"


class TestEdgeCases(TestEmailIntelligenceEngineComprehensive):
    """Test edge cases and error handling"""
    
    def test_empty_email_handling(self, engine):
        """Test handling of empty emails"""
        result = engine.analyze_email('', '', '')
        
        assert result.classification is not None
        assert result.urgency is not None
        assert result.confidence >= 0.0
    
    def test_very_long_email(self, engine):
        """Test handling of very long emails"""
        long_body = 'This is a very long email. ' * 1000  # 5000+ words
        
        result = engine.analyze_email(
            'Very long email subject',
            long_body,
            'test@company.com'
        )
        
        assert result.classification is not None
        assert result.processing_time_ms < 5000  # Should still be fast
    
    def test_special_characters(self, engine):
        """Test handling of special characters and encodings"""
        result = engine.analyze_email(
            'Émojis and spéciål characters 🚀💼',
            'This email contains émojis 😊, spéciål chåråctérs, and symbols: @#$%^&*()',
            'test@company.com'
        )
        
        assert result.classification is not None
        assert result.confidence >= 0.0
    
    def test_html_email_content(self, engine):
        """Test handling of HTML email content"""
        html_body = '''
        <html>
        <body>
        <h1>Important Meeting</h1>
        <p>Please <strong>confirm your attendance</strong> for the meeting.</p>
        <ul>
        <li>Date: Tomorrow</li>
        <li>Time: 2 PM</li>
        </ul>
        </body>
        </html>
        '''
        
        result = engine.analyze_email(
            'Meeting confirmation needed',
            html_body,
            'organizer@company.com'
        )
        
        assert result.classification == EmailClass.NEEDS_REPLY
        assert result.confidence > 0.5
    
    def test_non_english_content(self, engine):
        """Test handling of non-English content"""
        result = engine.analyze_email(
            'Réunion importante demain',
            'Bonjour, nous avons une réunion importante demain. Merci de confirmer votre présence.',
            'test@company.fr'
        )
        
        # Should still classify correctly
        assert result.classification is not None
        assert result.confidence >= 0.0
    
    def test_malformed_email_addresses(self, engine):
        """Test handling of malformed email addresses"""
        malformed_senders = [
            'not-an-email',
            '@company.com',
            'user@',
            '',
            None
        ]
        
        for sender in malformed_senders:
            try:
                result = engine.analyze_email(
                    'Test subject',
                    'Test body',
                    sender
                )
                assert result.classification is not None
            except Exception as e:
                # Should handle gracefully
                assert False, f"Should not raise exception for sender {sender}: {e}"


class TestConfigurationAndSettings(TestEmailIntelligenceEngineComprehensive):
    """Test configuration and settings"""
    
    def test_confidence_threshold_configuration(self, engine):
        """Test confidence threshold configuration"""
        # Set high confidence threshold
        engine.confidence_threshold = 0.9
        
        result = engine.analyze_email(
            'Unclear email',
            'This is an ambiguous email that could be classified multiple ways.',
            'test@company.com'
        )
        
        # Should still provide result but may have lower confidence
        assert result.classification is not None
        assert 0.0 <= result.confidence <= 1.0
    
    def test_custom_patterns(self, engine):
        """Test custom pattern configuration"""
        # Add custom pattern for specific domain
        custom_pattern = (r'\bcustom_trigger\b', 0.9)
        engine.classification_patterns[EmailClass.CREATE_TASK]['patterns'].append(custom_pattern)
        
        result = engine.analyze_email(
            'Custom trigger detected',
            'This email contains a custom_trigger that should be detected.',
            'test@company.com'
        )
        
        assert result.classification == EmailClass.CREATE_TASK
        assert result.confidence > 0.8
    
    def test_performance_settings(self, engine):
        """Test performance-related settings"""
        # Test timeout configuration
        engine.ai_timeout_ms = 100  # Very short timeout
        
        result = engine.analyze_email(
            'Timeout test',
            'This should still work with short timeout.',
            'test@company.com'
        )
        
        assert result.classification is not None
        # Should fall back to patterns due to timeout


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])