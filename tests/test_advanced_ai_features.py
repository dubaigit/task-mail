#!/usr/bin/env python3
"""
Comprehensive Test Suite for Advanced AI Features

Tests all advanced AI automation and intelligence features including:
- Advanced AI automation engine
- Intelligent automation rules
- ML model optimization
- Email insights and analytics
- Pattern mining and learning
"""

import pytest
import asyncio
import json
import tempfile
import sqlite3
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from typing import Dict, List, Any

# Import modules under test
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from advanced_ai_automation_engine import (
    AdvancedAIAutomationEngine, MLModelOptimizer, EmailInsightsEngine,
    InsightType, AutomationAction, AIInsight, ProcessingMetrics
)
from intelligent_automation_rules import (
    IntelligentAutomationEngine, RulePatternMiner, IntelligentRule,
    AutomationCondition, RuleAction, TriggerCondition, ActionType, RuleType
)


class TestMLModelOptimizer:
    """Test suite for ML model optimization features"""
    
    @pytest.fixture
    def optimizer(self):
        """Create ML optimizer instance for testing"""
        config = {
            'performance_tracking_enabled': True,
            'auto_optimization': True,
            'trend_analysis_days': 7
        }
        return MLModelOptimizer(config)
    
    @pytest.fixture
    def sample_predictions(self):
        """Sample prediction data for testing"""
        return [
            {'classification': 'NEEDS_REPLY', 'confidence': 0.9, 'processing_time_ms': 150},
            {'classification': 'APPROVAL_REQUIRED', 'confidence': 0.85, 'processing_time_ms': 200},
            {'classification': 'FYI_ONLY', 'confidence': 0.95, 'processing_time_ms': 100},
            {'classification': 'CREATE_TASK', 'confidence': 0.8, 'processing_time_ms': 180},
            {'classification': 'NEEDS_REPLY', 'confidence': 0.88, 'processing_time_ms': 160}
        ]
    
    @pytest.fixture
    def sample_actuals(self):
        """Sample actual data for testing"""
        return [
            {'classification': 'NEEDS_REPLY'},
            {'classification': 'APPROVAL_REQUIRED'},
            {'classification': 'FYI_ONLY'},
            {'classification': 'CREATE_TASK'},
            {'classification': 'DELEGATE'}  # Misclassification
        ]
    
    def test_analyze_model_performance(self, optimizer, sample_predictions, sample_actuals):
        """Test model performance analysis"""
        
        report = optimizer.analyze_model_performance(sample_predictions, sample_actuals)
        
        # Check basic structure
        assert 'accuracy' in report
        assert 'average_confidence' in report
        assert 'recommendations' in report
        assert 'performance_grade' in report
        
        # Check accuracy calculation (4/5 = 0.8)
        assert report['accuracy'] == 0.8
        
        # Check confidence calculation
        expected_confidence = sum(p['confidence'] for p in sample_predictions) / len(sample_predictions)
        assert abs(report['average_confidence'] - expected_confidence) < 0.01
        
        # Check recommendations exist
        assert len(report['recommendations']) > 0
        assert isinstance(report['recommendations'], list)
    
    def test_performance_grading(self, optimizer):
        """Test performance grade calculation"""
        
        # High performance case
        high_perf_preds = [{'classification': 'A', 'confidence': 0.95, 'processing_time_ms': 50}] * 10
        high_perf_actuals = [{'classification': 'A'}] * 10
        
        report = optimizer.analyze_model_performance(high_perf_preds, high_perf_actuals)
        assert report['performance_grade'] in ['A', 'B']
        
        # Low performance case
        low_perf_preds = [{'classification': 'A', 'confidence': 0.3, 'processing_time_ms': 5000}] * 10
        low_perf_actuals = [{'classification': 'B'}] * 10
        
        report = optimizer.analyze_model_performance(low_perf_preds, low_perf_actuals)
        assert report['performance_grade'] in ['D', 'F']
    
    def test_trend_analysis(self, optimizer):
        """Test trend analysis functionality"""
        
        # Add some historical data
        for i in range(10):
            sample_data = [
                {'classification': 'A', 'confidence': 0.8 + i*0.01, 'processing_time_ms': 200 - i*10}
            ] * 5
            actuals = [{'classification': 'A'}] * 5
            optimizer.analyze_model_performance(sample_data, actuals)
        
        # Get trend analysis
        trends = optimizer.get_trend_analysis(days=30)
        
        assert 'accuracy_trend' in trends
        assert 'confidence_trend' in trends
        assert 'performance_trend' in trends
        
        # Check trend directions
        assert trends['confidence_trend']['trend_direction'] == 'improving'


class TestEmailInsightsEngine:
    """Test suite for email insights and analytics"""
    
    @pytest.fixture
    def temp_db(self):
        """Create temporary database for testing"""
        fd, path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        yield path
        os.unlink(path)
    
    @pytest.fixture
    def insights_engine(self, temp_db):
        """Create insights engine with temp database"""
        config = {'insights_db_path': temp_db}
        return EmailInsightsEngine(config)
    
    @pytest.fixture
    def sample_email_data(self):
        """Sample email data for pattern analysis"""
        base_time = datetime.now()
        return [
            {
                'id': 1,
                'sender': 'marketing@company.com',
                'subject': 'Campaign approval needed',
                'classification': 'APPROVAL_REQUIRED',
                'urgency': 'HIGH',
                'received_at': base_time.isoformat()
            },
            {
                'id': 2,
                'sender': 'marketing@company.com',
                'subject': 'Budget approval required',
                'classification': 'APPROVAL_REQUIRED',
                'urgency': 'HIGH',
                'received_at': (base_time - timedelta(hours=1)).isoformat()
            },
            {
                'id': 3,
                'sender': 'support@company.com',
                'subject': 'Bug report submitted',
                'classification': 'CREATE_TASK',
                'urgency': 'MEDIUM',
                'received_at': (base_time - timedelta(hours=2)).isoformat()
            },
            {
                'id': 4,
                'sender': 'hr@company.com',
                'subject': 'Policy update',
                'classification': 'FYI_ONLY',
                'urgency': 'LOW',
                'received_at': (base_time - timedelta(hours=3)).isoformat()
            }
        ]
    
    def test_database_setup(self, insights_engine):
        """Test database initialization"""
        
        # Check that tables exist
        with sqlite3.connect(insights_engine.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in cursor.fetchall()]
        
        expected_tables = ['email_patterns', 'ai_insights', 'automation_rules']
        for table in expected_tables:
            assert table in tables
    
    def test_sender_pattern_analysis(self, insights_engine, sample_email_data):
        """Test sender pattern analysis"""
        
        insights = insights_engine.analyze_email_patterns(sample_email_data)
        
        # Should detect marketing sender pattern
        sender_insights = [i for i in insights if i.insight_type == InsightType.SENDER_PATTERN]
        assert len(sender_insights) > 0
        
        # Check insight structure
        insight = sender_insights[0]
        assert hasattr(insight, 'confidence')
        assert hasattr(insight, 'evidence')
        assert hasattr(insight, 'recommendations')
        assert insight.confidence > 0.5
    
    def test_time_pattern_analysis(self, insights_engine):
        """Test time-based pattern analysis"""
        
        # Create data with clear time pattern
        base_time = datetime.now().replace(hour=10, minute=0, second=0)
        email_data = []
        
        # Create peak at 10 AM
        for i in range(20):
            email_data.append({
                'id': i,
                'sender': f'user{i}@company.com',
                'received_at': (base_time + timedelta(minutes=i)).isoformat(),
                'classification': 'NEEDS_REPLY'
            })
        
        # Add some data at other times
        for i in range(5):
            email_data.append({
                'id': i + 20,
                'sender': f'user{i+20}@company.com',
                'received_at': (base_time + timedelta(hours=2, minutes=i)).isoformat(),
                'classification': 'NEEDS_REPLY'
            })
        
        insights = insights_engine.analyze_email_patterns(email_data)
        
        # Should detect time pattern
        time_insights = [i for i in insights if i.insight_type == InsightType.TIME_PATTERN]
        assert len(time_insights) > 0
    
    def test_insight_storage_and_retrieval(self, insights_engine):
        """Test storing and retrieving insights"""
        
        # Create test insight
        insight = AIInsight(
            insight_id="test_insight_1",
            insight_type=InsightType.SENDER_PATTERN,
            confidence=0.85,
            title="Test Insight",
            description="Test description",
            evidence={'test': 'data'},
            recommendations=['Test recommendation'],
            impact_score=75.0,
            created_at=datetime.now()
        )
        
        # Store insight
        insights_engine._store_insight(insight)
        
        # Retrieve insights
        retrieved = insights_engine.get_recent_insights(limit=5)
        
        assert len(retrieved) >= 1
        assert any(i.insight_id == "test_insight_1" for i in retrieved)


class TestRulePatternMiner:
    """Test suite for rule pattern mining"""
    
    @pytest.fixture
    def pattern_miner(self):
        """Create pattern miner for testing"""
        config = {
            'min_pattern_frequency': 3,
            'min_pattern_confidence': 0.6
        }
        return RulePatternMiner(config)
    
    @pytest.fixture
    def classification_data(self):
        """Sample data for classification pattern mining"""
        return [
            {'sender': 'user1@marketing.com', 'classification': 'APPROVAL_REQUIRED', 'subject': 'Budget approval'},
            {'sender': 'user2@marketing.com', 'classification': 'APPROVAL_REQUIRED', 'subject': 'Campaign approval'},
            {'sender': 'user3@marketing.com', 'classification': 'APPROVAL_REQUIRED', 'subject': 'Resource approval'},
            {'sender': 'user1@support.com', 'classification': 'CREATE_TASK', 'subject': 'Bug report'},
            {'sender': 'user2@support.com', 'classification': 'CREATE_TASK', 'subject': 'Feature request'},
            {'sender': 'user3@support.com', 'classification': 'CREATE_TASK', 'subject': 'Issue tracking'},
        ]
    
    def test_categorization_pattern_mining(self, pattern_miner, classification_data):
        """Test mining categorization patterns"""
        
        patterns = pattern_miner.mine_categorization_patterns(classification_data)
        
        # Should find domain patterns
        domain_patterns = [p for p in patterns if p['pattern_type'] == 'sender_domain_classification']
        assert len(domain_patterns) >= 2  # marketing.com and support.com
        
        # Check pattern structure
        pattern = domain_patterns[0]
        assert 'confidence' in pattern
        assert 'evidence_count' in pattern
        assert pattern['confidence'] >= 0.6
    
    def test_time_pattern_mining(self, pattern_miner):
        """Test mining time-based patterns"""
        
        # Create time-based test data
        base_time = datetime.now()
        time_data = []
        
        # High urgency emails in morning
        for i in range(5):
            time_data.append({
                'received_at': base_time.replace(hour=9).isoformat(),
                'urgency': 'HIGH'
            })
        
        # Low urgency emails in afternoon
        for i in range(3):
            time_data.append({
                'received_at': base_time.replace(hour=15).isoformat(),
                'urgency': 'LOW'
            })
        
        patterns = pattern_miner.mine_time_based_patterns(time_data)
        
        # Should find time pattern for high urgency
        time_patterns = [p for p in patterns if p['pattern_type'] == 'time_based_prioritization']
        assert len(time_patterns) >= 1
    
    def test_rule_suggestion_generation(self, pattern_miner, classification_data):
        """Test generation of automation rule suggestions"""
        
        suggested_rules = pattern_miner.suggest_automation_rules(classification_data)
        
        assert len(suggested_rules) > 0
        
        # Check rule structure
        rule = suggested_rules[0]
        assert hasattr(rule, 'rule_id')
        assert hasattr(rule, 'conditions')
        assert hasattr(rule, 'actions')
        assert len(rule.conditions) > 0
        assert len(rule.actions) > 0


class TestIntelligentAutomationEngine:
    """Test suite for intelligent automation engine"""
    
    @pytest.fixture
    def temp_db(self):
        """Create temporary database for testing"""
        fd, path = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        yield path
        os.unlink(path)
    
    @pytest.fixture
    def automation_engine(self, temp_db):
        """Create automation engine with temp database"""
        config = {
            'automation_db_path': temp_db,
            'learning_enabled': True,
            'auto_optimize': True
        }
        return IntelligentAutomationEngine(config)
    
    @pytest.fixture
    def sample_rule(self):
        """Create sample automation rule"""
        return IntelligentRule(
            rule_id="test_rule_1",
            name="Test Marketing Rule",
            description="Auto-categorize marketing emails",
            rule_type=RuleType.CATEGORIZATION,
            conditions=[
                AutomationCondition(
                    condition_type=TriggerCondition.SENDER_DOMAIN,
                    field="sender",
                    operator="equals",
                    value="marketing.com",
                    weight=1.0
                )
            ],
            actions=[
                RuleAction(
                    action_type=ActionType.SET_CATEGORY,
                    parameters={"value": "MARKETING"},
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
    
    def test_database_initialization(self, automation_engine):
        """Test database setup"""
        
        with sqlite3.connect(automation_engine.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = [row[0] for row in cursor.fetchall()]
        
        expected_tables = ['automation_rules', 'rule_executions', 'pattern_suggestions']
        for table in expected_tables:
            assert table in tables
    
    def test_add_rule(self, automation_engine, sample_rule):
        """Test adding automation rule"""
        
        success = automation_engine.add_rule(sample_rule)
        assert success
        
        # Check rule is stored
        assert sample_rule.rule_id in automation_engine.rules
        stored_rule = automation_engine.rules[sample_rule.rule_id]
        assert stored_rule.name == sample_rule.name
    
    @pytest.mark.asyncio
    async def test_rule_evaluation(self, automation_engine, sample_rule):
        """Test rule evaluation against email"""
        
        # Add rule first
        automation_engine.add_rule(sample_rule)
        
        # Test email that should match
        test_email = {
            'id': 'test_email_1',
            'sender': 'user@marketing.com',
            'subject': 'Test subject',
            'body': 'Test body'
        }
        
        actions = await automation_engine.evaluate_email(test_email)
        
        assert len(actions) > 0
        action = actions[0]
        assert action['rule_id'] == sample_rule.rule_id
        assert action['confidence'] > 0.7
    
    @pytest.mark.asyncio
    async def test_rule_condition_checking(self, automation_engine):
        """Test individual condition checking"""
        
        # Test sender domain condition
        email = {'sender': 'user@marketing.com'}
        condition = AutomationCondition(
            condition_type=TriggerCondition.SENDER_DOMAIN,
            field="sender",
            operator="equals",
            value="marketing.com",
            weight=1.0
        )
        
        result = automation_engine._check_single_condition(email, condition)
        assert result is True
        
        # Test subject contains condition
        email = {'subject': 'Bug report: Login issue'}
        condition = AutomationCondition(
            condition_type=TriggerCondition.SUBJECT_CONTAINS,
            field="subject",
            operator="contains",
            value="bug",
            weight=1.0
        )
        
        result = automation_engine._check_single_condition(email, condition)
        assert result is True
    
    def test_feedback_processing(self, automation_engine, sample_rule):
        """Test feedback processing and learning"""
        
        # Add rule and simulate execution
        automation_engine.add_rule(sample_rule)
        
        # Create mock execution
        from intelligent_automation_rules import RuleExecution
        execution = RuleExecution(
            execution_id="test_exec_1",
            rule_id=sample_rule.rule_id,
            email_id="test_email_1",
            executed_at=datetime.now(),
            conditions_met=["SENDER_DOMAIN"],
            actions_taken=["SET_CATEGORY"],
            confidence_score=0.85
        )
        
        automation_engine._record_execution(execution)
        
        # Provide positive feedback
        automation_engine.provide_feedback("test_exec_1", was_successful=True)
        
        # Check rule performance updated
        rule = automation_engine.rules[sample_rule.rule_id]
        assert rule.success_rate > 0.0
    
    def test_performance_reporting(self, automation_engine, sample_rule):
        """Test performance report generation"""
        
        automation_engine.add_rule(sample_rule)
        
        report = automation_engine.get_rule_performance_report()
        
        assert 'summary' in report
        assert 'recent_performance' in report
        assert 'rule_distribution' in report
        assert 'top_performing_rules' in report
        
        assert report['summary']['total_rules'] >= 1


class TestAdvancedAIAutomationEngine:
    """Test suite for advanced AI automation engine"""
    
    @pytest.fixture
    def temp_dirs(self):
        """Create temporary directories for testing"""
        import tempfile
        temp_dir = tempfile.mkdtemp()
        
        config = {
            'ai_optimizer': {
                'num_workers': 2,
                'max_queue_size': 100
            },
            'insights': {
                'insights_db_path': os.path.join(temp_dir, 'insights.db'),
                'pattern_learning_enabled': True
            },
            'ml_optimizer': {
                'performance_tracking_enabled': True
            }
        }
        
        yield config
        
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
    
    @pytest.fixture
    async def automation_engine(self, temp_dirs):
        """Create advanced automation engine"""
        
        # Mock the AI optimizer to avoid Redis dependency
        with patch('advanced_ai_automation_engine.AIProcessingOptimizer') as mock_optimizer:
            mock_instance = Mock()
            mock_instance.start_workers = AsyncMock()
            mock_instance.stop_workers = AsyncMock()
            mock_instance.cleanup = AsyncMock()
            mock_instance.get_performance_report = AsyncMock(return_value={
                'performance_metrics': {'total_requests': 0}
            })
            mock_optimizer.return_value = mock_instance
            
            engine = AdvancedAIAutomationEngine(temp_dirs)
            yield engine
            
            await engine.cleanup()
    
    @pytest.fixture
    def sample_emails(self):
        """Sample emails for batch processing"""
        return [
            {
                'id': 1,
                'subject': 'Budget approval needed',
                'body': 'Please approve the marketing budget.',
                'sender': 'marketing@company.com',
                'received_at': datetime.now().isoformat()
            },
            {
                'id': 2,
                'subject': 'Bug report',
                'body': 'Found a bug in the login system.',
                'sender': 'support@company.com',
                'received_at': datetime.now().isoformat()
            }
        ]
    
    @pytest.mark.asyncio
    async def test_engine_initialization(self, automation_engine):
        """Test engine initialization"""
        
        assert automation_engine.config is not None
        assert automation_engine.intelligence_engine is not None
        assert automation_engine.insights_engine is not None
        assert automation_engine.ml_optimizer is not None
    
    @pytest.mark.asyncio
    async def test_engine_lifecycle(self, automation_engine):
        """Test engine start/stop lifecycle"""
        
        # Start engine
        await automation_engine.start_engine()
        assert automation_engine.is_running
        
        # Stop engine
        await automation_engine.stop_engine()
        assert not automation_engine.is_running
    
    @pytest.mark.asyncio
    async def test_batch_processing(self, automation_engine, sample_emails):
        """Test advanced batch processing"""
        
        # Mock intelligence engine
        with patch.object(automation_engine.intelligence_engine, 'analyze_email') as mock_analyze:
            mock_result = Mock()
            mock_result.classification.value = 'NEEDS_REPLY'
            mock_result.urgency.value = 'HIGH'
            mock_result.sentiment.value = 'NEUTRAL'
            mock_result.confidence = 0.85
            mock_analyze.return_value = mock_result
            
            results = await automation_engine.process_email_batch_advanced(
                sample_emails,
                enable_insights=True,
                enable_automation=True
            )
            
            assert 'processed_count' in results
            assert 'ai_assisted_count' in results
            assert results['processed_count'] == len(sample_emails)
            assert len(results['results']) == len(sample_emails)
    
    @pytest.mark.asyncio
    async def test_comprehensive_reporting(self, automation_engine):
        """Test comprehensive report generation"""
        
        report = await automation_engine.get_comprehensive_report()
        
        assert 'timestamp' in report
        assert 'advanced_metrics' in report
        assert 'base_ai_performance' in report
        
        # Check advanced metrics structure
        advanced_metrics = report['advanced_metrics']
        assert 'total_emails_processed' in advanced_metrics
        assert 'ai_assistance_rate' in advanced_metrics
        assert 'automation_efficiency' in advanced_metrics
    
    def test_feedback_recording(self, automation_engine):
        """Test recording actual results for learning"""
        
        # Record feedback
        automation_engine.record_actual_result(
            email_id="test_123",
            actual_classification="NEEDS_REPLY",
            user_feedback={"satisfaction": "high"}
        )
        
        # Check feedback is stored
        assert len(automation_engine.actual_results) > 0
        feedback = automation_engine.actual_results[-1]
        assert feedback['email_id'] == "test_123"
        assert feedback['classification'] == "NEEDS_REPLY"


class TestIntegration:
    """Integration tests for advanced AI features"""
    
    @pytest.mark.asyncio
    async def test_end_to_end_automation_workflow(self):
        """Test complete automation workflow"""
        
        # Create temporary database
        fd, temp_db = tempfile.mkstemp(suffix='.db')
        os.close(fd)
        
        try:
            # Setup automation engine
            config = {
                'automation_db_path': temp_db,
                'learning_enabled': True
            }
            
            automation_engine = IntelligentAutomationEngine(config)
            
            # Create and add rule
            rule = IntelligentRule(
                rule_id="integration_test_rule",
                name="Support Email Rule",
                description="Auto-categorize support emails",
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
                    RuleAction(
                        action_type=ActionType.SET_CATEGORY,
                        parameters={"value": "SUPPORT_TICKET"},
                        confidence_threshold=0.8
                    )
                ],
                confidence=0.9,
                success_rate=0.0,
                usage_count=0,
                last_used=None,
                created_at=datetime.now(),
                is_verified=True
            )
            
            automation_engine.add_rule(rule)
            
            # Test email
            test_email = {
                'id': 'integration_test',
                'sender': 'user@support.company.com',
                'subject': 'Need help with login',
                'body': 'I cannot log into my account',
                'received_at': datetime.now().isoformat()
            }
            
            # Evaluate email
            actions = await automation_engine.evaluate_email(test_email)
            
            # Verify automation worked
            assert len(actions) > 0
            assert actions[0]['rule_id'] == rule.rule_id
            
            # Provide feedback
            automation_engine.provide_feedback(
                actions[0]['execution_id'],
                was_successful=True,
                feedback="Correctly categorized"
            )
            
            # Generate report
            report = automation_engine.get_rule_performance_report()
            
            assert report['summary']['total_rules'] >= 1
            assert report['recent_performance']['executions_last_7_days'] >= 1
        
        finally:
            # Cleanup
            os.unlink(temp_db)
    
    @pytest.mark.asyncio
    async def test_pattern_mining_integration(self):
        """Test pattern mining and rule generation integration"""
        
        # Create pattern miner
        config = {
            'min_pattern_frequency': 2,
            'min_pattern_confidence': 0.5
        }
        miner = RulePatternMiner(config)
        
        # Sample email history with clear patterns
        email_history = [
            {'sender': 'marketing@company.com', 'classification': 'APPROVAL_REQUIRED', 'subject': 'approval 1'},
            {'sender': 'marketing@company.com', 'classification': 'APPROVAL_REQUIRED', 'subject': 'approval 2'},
            {'sender': 'marketing@company.com', 'classification': 'APPROVAL_REQUIRED', 'subject': 'approval 3'},
            {'sender': 'support@company.com', 'classification': 'CREATE_TASK', 'subject': 'bug 1'},
            {'sender': 'support@company.com', 'classification': 'CREATE_TASK', 'subject': 'bug 2'},
            {'sender': 'support@company.com', 'classification': 'CREATE_TASK', 'subject': 'bug 3'},
        ]
        
        # Mine patterns and generate rules
        suggested_rules = miner.suggest_automation_rules(email_history)
        
        # Verify rules were generated
        assert len(suggested_rules) > 0
        
        # Check rule quality
        for rule in suggested_rules:
            assert rule.confidence >= 0.5
            assert len(rule.conditions) > 0
            assert len(rule.actions) > 0


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])