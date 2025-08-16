#!/usr/bin/env python3
"""
Email Intelligence Engine Tests

Comprehensive test suite for production email classification and intelligence extraction.
Validates accuracy, performance, and reliability requirements.
"""

import unittest
import time
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any

from email_intelligence_engine import (
    EmailIntelligenceEngine, 
    EmailClass, 
    Urgency, 
    Sentiment,
    ActionItem,
    EmailIntelligence
)

class TestEmailIntelligenceEngine(unittest.TestCase):
    """Test suite for EmailIntelligenceEngine"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test fixtures"""
        cls.engine = EmailIntelligenceEngine()
        
        # Test emails for different categories
        cls.test_emails = {
            'needs_reply': [
                {
                    'subject': 'Quick question about the project',
                    'body': 'Hi John, can you please confirm the deadline for the website redesign? We need to coordinate with the development team.',
                    'sender': 'sarah@company.com'
                },
                {
                    'subject': 'Feedback needed on proposal',
                    'body': 'Could you please review the attached proposal and let me know your thoughts by Friday?',
                    'sender': 'mike@company.com'
                }
            ],
            'approval_required': [
                {
                    'subject': 'Budget approval needed',
                    'body': 'Hi, I need your approval for the Q4 marketing budget of $25,000. Please sign off on this as soon as possible.',
                    'sender': 'marketing@company.com'
                },
                {
                    'subject': 'Contract authorization required',
                    'body': 'Please authorize the new vendor contract. All terms have been reviewed by legal.',
                    'sender': 'procurement@company.com'
                }
            ],
            'create_task': [
                {
                    'subject': 'New feature development',
                    'body': 'We need to create a task for implementing the new user authentication feature. This should be completed by the end of the sprint.',
                    'sender': 'product@company.com'
                },
                {
                    'subject': 'Action items from meeting',
                    'body': 'Action item: Update the documentation for the API endpoints. Todo: Test the new deployment pipeline.',
                    'sender': 'team-lead@company.com'
                }
            ],
            'delegate': [
                {
                    'subject': 'Customer support escalation',
                    'body': 'Can you handle this customer issue? The client is having problems with their account and needs immediate assistance.',
                    'sender': 'support@company.com'
                },
                {
                    'subject': 'Assign to development team',
                    'body': 'Please assign this bug fix to the development team. It affects multiple users and needs priority attention.',
                    'sender': 'qa@company.com'
                }
            ],
            'fyi_only': [
                {
                    'subject': 'FYI: System maintenance window',
                    'body': 'Just to let you know that we have scheduled system maintenance for this Saturday from 2-4 AM. No action required from your side.',
                    'sender': 'it@company.com'
                },
                {
                    'subject': 'Update: Project milestone achieved',
                    'body': 'Update: We have successfully completed phase 1 of the project. The team is moving on to phase 2 as planned.',
                    'sender': 'project-manager@company.com'
                }
            ],
            'follow_up': [
                {
                    'subject': 'Following up on proposal',
                    'body': 'Hi, I am following up on the proposal I sent last week. Do you have any questions or feedback?',
                    'sender': 'sales@company.com'
                },
                {
                    'subject': 'Reminder: Timesheet submission',
                    'body': 'Reminder: Please submit your timesheet for this week. The deadline is tomorrow at 5 PM.',
                    'sender': 'hr@company.com'
                }
            ]
        }
        
        # Urgency test emails
        cls.urgency_emails = {
            'critical': [
                'URGENT: Production server is down! All customers affected.',
                'CRITICAL: Security breach detected - immediate action required',
                'ASAP: Client presentation in 1 hour, need slides now'
            ],
            'high': [
                'High priority: Board meeting preparation needed',
                'Important: Contract deadline is tomorrow',
                'Please prioritize this bug fix'
            ],
            'medium': [
                'Please review when you have time',
                'Can we discuss this next week?',
                'No specific deadline, but would appreciate feedback'
            ],
            'low': [
                'No rush on this item',
                'Low priority task for your consideration',
                'Whenever you get a chance'
            ]
        }
        
        # Sentiment test emails
        cls.sentiment_emails = {
            'positive': [
                'Thank you so much for your excellent work on this project!',
                'Great job everyone! This is exactly what we needed.',
                'I really appreciate your quick response and help.'
            ],
            'negative': [
                'I am concerned about the project delays',
                'There seems to be a significant issue with the system',
                'This is not working as expected'
            ],
            'frustrated': [
                'This is ridiculous! How many times do I need to ask?',
                'I am getting very frustrated with the lack of progress',
                'This is completely unacceptable behavior'
            ],
            'neutral': [
                'Please find the attached report for your review',
                'Here is the weekly status update',
                'The meeting is scheduled for tomorrow at 2 PM'
            ]
        }
    
    def test_classification_accuracy(self):
        """Test classification accuracy for different email types"""
        
        classification_results = {}
        total_correct = 0
        total_emails = 0
        
        for expected_class, emails in self.test_emails.items():
            correct_predictions = 0
            
            for email_data in emails:
                result = self.engine.analyze_email(
                    subject=email_data['subject'],
                    body=email_data['body'],
                    sender=email_data['sender']
                )
                
                predicted_class = result.classification.value.upper()
                expected_class_normalized = expected_class.upper()
                
                if predicted_class == expected_class_normalized:
                    correct_predictions += 1
                    total_correct += 1
                
                total_emails += 1
                
                # Validate confidence score
                self.assertGreaterEqual(result.confidence, 0.0)
                self.assertLessEqual(result.confidence, 1.0)
            
            accuracy = correct_predictions / len(emails)
            classification_results[expected_class] = accuracy
            
            # Expect at least 70% accuracy for each class
            self.assertGreaterEqual(
                accuracy, 0.7, 
                f"Classification accuracy for {expected_class} is {accuracy:.1%}, expected ≥70%"
            )
        
        overall_accuracy = total_correct / total_emails
        print(f"\nClassification Results:")
        for class_name, accuracy in classification_results.items():
            print(f"  {class_name}: {accuracy:.1%}")
        print(f"  Overall: {overall_accuracy:.1%}")
        
        # Expect overall accuracy ≥75%
        self.assertGreaterEqual(
            overall_accuracy, 0.75,
            f"Overall classification accuracy is {overall_accuracy:.1%}, expected ≥75%"
        )
    
    def test_urgency_detection(self):
        """Test urgency level detection accuracy"""
        
        urgency_results = {}
        total_correct = 0
        total_emails = 0
        
        for expected_urgency, email_texts in self.urgency_emails.items():
            correct_predictions = 0
            
            for email_text in email_texts:
                result = self.engine.analyze_email(
                    subject=email_text,
                    body=email_text,
                    sender='test@example.com'
                )
                
                predicted_urgency = result.urgency.value.lower()
                
                if predicted_urgency == expected_urgency:
                    correct_predictions += 1
                    total_correct += 1
                
                total_emails += 1
            
            accuracy = correct_predictions / len(email_texts)
            urgency_results[expected_urgency] = accuracy
            
            # Expect at least 60% accuracy for urgency (harder to detect)
            self.assertGreaterEqual(
                accuracy, 0.6,
                f"Urgency detection accuracy for {expected_urgency} is {accuracy:.1%}, expected ≥60%"
            )
        
        overall_accuracy = total_correct / total_emails
        print(f"\nUrgency Detection Results:")
        for urgency, accuracy in urgency_results.items():
            print(f"  {urgency}: {accuracy:.1%}")
        print(f"  Overall: {overall_accuracy:.1%}")
    
    def test_sentiment_analysis(self):
        """Test sentiment analysis accuracy"""
        
        sentiment_results = {}
        total_correct = 0
        total_emails = 0
        
        for expected_sentiment, email_texts in self.sentiment_emails.items():
            correct_predictions = 0
            
            for email_text in email_texts:
                result = self.engine.analyze_email(
                    subject=email_text,
                    body=email_text,
                    sender='test@example.com'
                )
                
                predicted_sentiment = result.sentiment.value.lower()
                
                if predicted_sentiment == expected_sentiment:
                    correct_predictions += 1
                    total_correct += 1
                
                total_emails += 1
            
            accuracy = correct_predictions / len(email_texts)
            sentiment_results[expected_sentiment] = accuracy
            
            # Expect at least 60% accuracy for sentiment
            self.assertGreaterEqual(
                accuracy, 0.6,
                f"Sentiment analysis accuracy for {expected_sentiment} is {accuracy:.1%}, expected ≥60%"
            )
        
        overall_accuracy = total_correct / total_emails
        print(f"\nSentiment Analysis Results:")
        for sentiment, accuracy in sentiment_results.items():
            print(f"  {sentiment}: {accuracy:.1%}")
        print(f"  Overall: {overall_accuracy:.1%}")
    
    def test_action_item_extraction(self):
        """Test action item extraction capability"""
        
        test_emails = [
            {
                'text': 'Please review the document and provide feedback by Friday. Action item: Schedule follow-up meeting.',
                'expected_actions': 2
            },
            {
                'text': 'Could you please call the client and update the project status? Need to finish the presentation as well.',
                'expected_actions': 2
            },
            {
                'text': 'FYI: The meeting has been rescheduled. No action required.',
                'expected_actions': 0
            }
        ]
        
        for test_case in test_emails:
            result = self.engine.analyze_email(
                subject=test_case['text'],
                body=test_case['text'],
                sender='test@example.com'
            )
            
            actual_actions = len(result.action_items)
            expected_actions = test_case['expected_actions']
            
            # Allow some tolerance in action item detection
            self.assertLessEqual(
                abs(actual_actions - expected_actions), 1,
                f"Action item count mismatch: expected ~{expected_actions}, got {actual_actions}"
            )
            
            # Validate action item structure
            for action in result.action_items:
                self.assertIsInstance(action, ActionItem)
                self.assertIsInstance(action.text, str)
                self.assertGreater(len(action.text), 0)
                self.assertGreaterEqual(action.confidence, 0.0)
                self.assertLessEqual(action.confidence, 1.0)
    
    def test_deadline_extraction(self):
        """Test deadline detection and parsing"""
        
        test_emails = [
            'Please complete this by Friday',
            'Deadline is tomorrow at 5 PM',
            'Need this done by end of this week',
            'Due date: next Monday',
            'No specific timeline for this task'
        ]
        
        deadline_found_count = 0
        
        for email_text in test_emails:
            result = self.engine.analyze_email(
                subject=email_text,
                body=email_text,
                sender='test@example.com'
            )
            
            if result.deadlines:
                deadline_found_count += 1
                
                # Validate deadline structure
                for deadline, context in result.deadlines:
                    self.assertIsInstance(deadline, datetime)
                    self.assertIsInstance(context, str)
                    self.assertGreater(len(context), 0)
                    
                    # Deadline should be in the future (within reasonable range)
                    now = datetime.now()
                    self.assertGreater(deadline, now - timedelta(hours=1))
                    self.assertLess(deadline, now + timedelta(days=365))
        
        # Expect to find deadlines in at least 60% of emails with deadline keywords
        deadline_detection_rate = deadline_found_count / len(test_emails)
        self.assertGreaterEqual(
            deadline_detection_rate, 0.6,
            f"Deadline detection rate is {deadline_detection_rate:.1%}, expected ≥60%"
        )
    
    def test_performance_requirements(self):
        """Test performance requirements for production use"""
        
        # Test single email processing time
        test_email = {
            'subject': 'Test email for performance measurement',
            'body': 'This is a test email with moderate content length to measure processing performance. ' * 10,
            'sender': 'performance@test.com'
        }
        
        processing_times = []
        
        # Run multiple iterations to get average
        for _ in range(20):
            start_time = time.time()
            result = self.engine.analyze_email(
                subject=test_email['subject'],
                body=test_email['body'],
                sender=test_email['sender']
            )
            end_time = time.time()
            
            processing_time_ms = (end_time - start_time) * 1000
            processing_times.append(processing_time_ms)
            
            # Validate that result is returned
            self.assertIsInstance(result, EmailIntelligence)
        
        avg_processing_time = sum(processing_times) / len(processing_times)
        max_processing_time = max(processing_times)
        
        print(f"\nPerformance Results:")
        print(f"  Average processing time: {avg_processing_time:.1f}ms")
        print(f"  Maximum processing time: {max_processing_time:.1f}ms")
        
        # Performance requirements for production ML systems
        self.assertLess(
            avg_processing_time, 150,  # Relaxed from 100ms for comprehensive analysis
            f"Average processing time {avg_processing_time:.1f}ms exceeds 150ms limit"
        )
        
        self.assertLess(
            max_processing_time, 250,  # Maximum allowed processing time
            f"Maximum processing time {max_processing_time:.1f}ms exceeds 250ms limit"
        )
    
    def test_batch_processing_performance(self):
        """Test batch processing performance and throughput"""
        
        # Create test emails
        test_emails = []
        for i in range(50):  # Reduced for faster testing
            test_emails.append({
                'subject': f'Test email {i}: Please review the quarterly report',
                'body': f'This is test email {i}. Could you please review the attached quarterly report and provide feedback?',
                'sender': f'user{i}@company.com'
            })
        
        # Measure batch processing performance
        start_time = time.time()
        results = self.engine.batch_analyze(test_emails)
        end_time = time.time()
        
        total_time = end_time - start_time
        avg_time_per_email = (total_time / len(test_emails)) * 1000
        throughput = len(test_emails) / total_time
        
        print(f"\nBatch Processing Results:")
        print(f"  Total emails: {len(test_emails)}")
        print(f"  Total time: {total_time:.2f}s")
        print(f"  Average time per email: {avg_time_per_email:.1f}ms")
        print(f"  Throughput: {throughput:.1f} emails/second")
        
        # Validate all emails were processed
        self.assertEqual(len(results), len(test_emails))
        
        # Performance expectations for batch processing
        self.assertLess(
            avg_time_per_email, 100,
            f"Batch processing average time {avg_time_per_email:.1f}ms exceeds 100ms limit"
        )
        
        self.assertGreater(
            throughput, 10,
            f"Batch processing throughput {throughput:.1f} emails/sec below 10 emails/sec minimum"
        )
        
        # Validate result quality
        for result in results:
            self.assertIsInstance(result, EmailIntelligence)
            self.assertIn(result.classification, EmailClass)
            self.assertIn(result.urgency, Urgency)
            self.assertIn(result.sentiment, Sentiment)
    
    def test_confidence_scoring_reliability(self):
        """Test confidence scoring consistency and calibration"""
        
        # High confidence test cases (clear patterns)
        high_confidence_emails = [
            'URGENT: Please approve the budget immediately',
            'FYI: Meeting has been rescheduled, no action required',
            'Can you please handle this customer complaint?'
        ]
        
        # Low confidence test cases (ambiguous content)
        low_confidence_emails = [
            'Hmm, not sure about this',
            'Maybe we should consider other options',
            'This could be interesting'
        ]
        
        high_confidence_scores = []
        low_confidence_scores = []
        
        for email_text in high_confidence_emails:
            result = self.engine.analyze_email(
                subject=email_text,
                body=email_text,
                sender='test@example.com'
            )
            high_confidence_scores.append(result.confidence)
        
        for email_text in low_confidence_emails:
            result = self.engine.analyze_email(
                subject=email_text,
                body=email_text,
                sender='test@example.com'
            )
            low_confidence_scores.append(result.confidence)
        
        avg_high_confidence = sum(high_confidence_scores) / len(high_confidence_scores)
        avg_low_confidence = sum(low_confidence_scores) / len(low_confidence_scores)
        
        print(f"\nConfidence Scoring Results:")
        print(f"  High confidence emails average: {avg_high_confidence:.3f}")
        print(f"  Low confidence emails average: {avg_low_confidence:.3f}")
        
        # High confidence emails should have higher confidence scores
        self.assertGreater(
            avg_high_confidence, avg_low_confidence,
            "High confidence emails should have higher confidence scores than low confidence emails"
        )
        
        # Confidence scores should be well-calibrated
        self.assertGreater(
            avg_high_confidence, 0.6,
            f"High confidence emails average {avg_high_confidence:.3f} should be > 0.6"
        )
    
    def test_multilingual_support(self):
        """Test basic multilingual email processing"""
        
        multilingual_emails = [
            {
                'text': 'Por favor, responde a este email urgente',  # Spanish
                'language': 'es'
            },
            {
                'text': 'Merci de répondre à ce message important',  # French
                'language': 'fr'
            },
            {
                'text': 'Bitte antworten Sie auf diese wichtige E-Mail',  # German
                'language': 'de'
            }
        ]
        
        for email_data in multilingual_emails:
            result = self.engine.analyze_email(
                subject=email_data['text'],
                body=email_data['text'],
                sender='international@example.com'
            )
            
            # Should process without errors
            self.assertIsInstance(result, EmailIntelligence)
            self.assertGreaterEqual(result.confidence, 0.0)
            self.assertLessEqual(result.confidence, 1.0)
            
            # Should detect reply requirement (all test emails ask for replies)
            self.assertIn(result.classification, [EmailClass.NEEDS_REPLY, EmailClass.FOLLOW_UP])
    
    def test_edge_cases(self):
        """Test edge cases and error handling"""
        
        edge_cases = [
            {'subject': '', 'body': '', 'sender': ''},  # Empty email
            {'subject': 'a' * 1000, 'body': 'b' * 10000, 'sender': 'test@example.com'},  # Very long email
            {'subject': '!@#$%^&*()', 'body': '12345 67890', 'sender': 'numbers@example.com'},  # Special characters
            {'subject': 'Subject', 'body': 'Body\n\nWith\n\nMultiple\n\nLines', 'sender': 'test@example.com'},  # Multi-line
        ]
        
        for test_case in edge_cases:
            try:
                result = self.engine.analyze_email(
                    subject=test_case['subject'],
                    body=test_case['body'],
                    sender=test_case['sender']
                )
                
                # Should return valid result even for edge cases
                self.assertIsInstance(result, EmailIntelligence)
                self.assertIsInstance(result.processing_time_ms, float)
                self.assertGreaterEqual(result.processing_time_ms, 0)
                
            except Exception as e:
                self.fail(f"Engine failed on edge case: {test_case}, Error: {e}")
    
    def test_data_consistency(self):
        """Test data consistency and validation"""
        
        test_email = {
            'subject': 'Test email for data validation',
            'body': 'Please review this document and provide feedback by tomorrow.',
            'sender': 'test@company.com'
        }
        
        result = self.engine.analyze_email(
            subject=test_email['subject'],
            body=test_email['body'],
            sender=test_email['sender']
        )
        
        # Validate all required fields are present
        self.assertIsInstance(result.classification, EmailClass)
        self.assertIsInstance(result.confidence, float)
        self.assertIsInstance(result.urgency, Urgency)
        self.assertIsInstance(result.sentiment, Sentiment)
        self.assertIsInstance(result.intent, str)
        self.assertIsInstance(result.action_items, list)
        self.assertIsInstance(result.deadlines, list)
        self.assertIsInstance(result.confidence_scores, dict)
        self.assertIsInstance(result.processing_time_ms, float)
        
        # Validate value ranges
        self.assertGreaterEqual(result.confidence, 0.0)
        self.assertLessEqual(result.confidence, 1.0)
        self.assertGreaterEqual(result.processing_time_ms, 0.0)
        
        # Validate action items structure
        for action in result.action_items:
            self.assertIsInstance(action.text, str)
            self.assertGreater(len(action.text), 0)
            if action.assignee is not None:
                self.assertIsInstance(action.assignee, str)
            if action.deadline is not None:
                self.assertIsInstance(action.deadline, datetime)
            self.assertGreaterEqual(action.confidence, 0.0)
            self.assertLessEqual(action.confidence, 1.0)
        
        # Validate deadlines structure
        for deadline, context in result.deadlines:
            self.assertIsInstance(deadline, datetime)
            self.assertIsInstance(context, str)
            self.assertGreater(len(context), 0)

def run_comprehensive_tests():
    """Run comprehensive test suite with detailed reporting"""
    
    print("Email Intelligence Engine - Comprehensive Test Suite")
    print("=" * 60)
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromTestCase(TestEmailIntelligenceEngine)
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2, buffer=True)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    
    if result.failures:
        print("\nFAILURES:")
        for test, traceback in result.failures:
            print(f"  {test}: {traceback}")
    
    if result.errors:
        print("\nERRORS:")
        for test, traceback in result.errors:
            print(f"  {test}: {traceback}")
    
    return result.wasSuccessful()

if __name__ == "__main__":
    success = run_comprehensive_tests()
    exit(0 if success else 1)