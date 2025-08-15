#!/usr/bin/env python3
"""
Advanced AI Automation Engine for Email Intelligence

Implements sophisticated AI features and automation enhancements including:
- Intelligent batch processing with adaptive prioritization
- AI-powered email insights and analytics
- Automated categorization with context awareness  
- Machine learning model improvement recommendations
- Advanced email intelligence with pattern learning
- Predictive email classification and routing
"""

import asyncio
import logging
import time
import json
import hashlib
import pickle
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Union, Set
from dataclasses import dataclass, asdict, field
from enum import Enum
from collections import deque, defaultdict, Counter
import threading
import os
import sqlite3
from concurrent.futures import ThreadPoolExecutor
import numpy as np

# Import existing components
from email_intelligence_engine import EmailIntelligenceEngine, EmailClass, Urgency, Sentiment, ActionItem
from ai_processing_optimizer import AIProcessingOptimizer, ProcessingRequest, ProcessingPriority

# Setup logging
logger = logging.getLogger(__name__)

class InsightType(Enum):
    """Types of AI-generated insights"""
    SENDER_PATTERN = "SENDER_PATTERN"
    TIME_PATTERN = "TIME_PATTERN"
    VOLUME_ANOMALY = "VOLUME_ANOMALY"
    PRIORITY_TREND = "PRIORITY_TREND"
    RESPONSE_TIME = "RESPONSE_TIME"
    WORKFLOW_OPTIMIZATION = "WORKFLOW_OPTIMIZATION"
    AUTOMATION_OPPORTUNITY = "AUTOMATION_OPPORTUNITY"

class AutomationAction(Enum):
    """Types of automated actions"""
    AUTO_CLASSIFY = "AUTO_CLASSIFY"
    AUTO_PRIORITIZE = "AUTO_PRIORITIZE"
    AUTO_ROUTE = "AUTO_ROUTE"
    AUTO_DRAFT = "AUTO_DRAFT"
    AUTO_SCHEDULE = "AUTO_SCHEDULE"
    AUTO_DELEGATE = "AUTO_DELEGATE"
    AUTO_ARCHIVE = "AUTO_ARCHIVE"

@dataclass
class AIInsight:
    """AI-generated insight about email patterns or behavior"""
    insight_id: str
    insight_type: InsightType
    confidence: float
    title: str
    description: str
    evidence: Dict[str, Any]
    recommendations: List[str]
    impact_score: float  # 0-100
    created_at: datetime
    expires_at: Optional[datetime] = None

@dataclass
class AutomationRule:
    """Intelligent automation rule learned from patterns"""
    rule_id: str
    trigger_conditions: Dict[str, Any]
    action: AutomationAction
    confidence: float
    success_rate: float
    last_used: datetime
    usage_count: int
    created_at: datetime
    is_active: bool = True

@dataclass
class EmailPattern:
    """Learned pattern from historical email data"""
    pattern_id: str
    pattern_type: str  # sender, subject, time, classification
    pattern_data: Dict[str, Any]
    frequency: int
    accuracy: float
    last_seen: datetime
    created_at: datetime

@dataclass
class ProcessingMetrics:
    """Advanced metrics for AI processing performance"""
    total_processed: int = 0
    ai_assisted: int = 0
    auto_classified: int = 0
    auto_routed: int = 0
    accuracy_score: float = 0.0
    throughput_per_hour: float = 0.0
    cost_efficiency: float = 0.0
    user_satisfaction: float = 0.0
    last_updated: datetime = field(default_factory=datetime.now)

class MLModelOptimizer:
    """Machine learning model optimization and recommendation engine"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.performance_history = deque(maxlen=10000)
        self.model_metrics = {}
        self.optimization_suggestions = []
        self.logger = logging.getLogger(__name__)
    
    def analyze_model_performance(self, 
                                 predictions: List[Dict[str, Any]], 
                                 actuals: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze model performance and generate optimization recommendations"""
        
        if len(predictions) != len(actuals):
            raise ValueError("Predictions and actuals must have same length")
        
        # Calculate accuracy metrics
        total_samples = len(predictions)
        correct_classifications = 0
        confidence_scores = []
        processing_times = []
        
        classification_confusion = defaultdict(lambda: defaultdict(int))
        
        for pred, actual in zip(predictions, actuals):
            # Classification accuracy
            if pred.get('classification') == actual.get('classification'):
                correct_classifications += 1
            
            # Track confusion matrix
            pred_class = pred.get('classification', 'UNKNOWN')
            actual_class = actual.get('classification', 'UNKNOWN')
            classification_confusion[actual_class][pred_class] += 1
            
            # Collect confidence and timing data
            confidence_scores.append(pred.get('confidence', 0.0))
            processing_times.append(pred.get('processing_time_ms', 0.0))
        
        accuracy = correct_classifications / total_samples if total_samples > 0 else 0.0
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0
        avg_processing_time = sum(processing_times) / len(processing_times) if processing_times else 0.0
        
        # Generate optimization recommendations
        recommendations = self._generate_optimization_recommendations(
            accuracy, avg_confidence, avg_processing_time, classification_confusion
        )
        
        performance_report = {
            'timestamp': datetime.now().isoformat(),
            'total_samples': total_samples,
            'accuracy': accuracy,
            'average_confidence': avg_confidence,
            'average_processing_time_ms': avg_processing_time,
            'confusion_matrix': dict(classification_confusion),
            'recommendations': recommendations,
            'performance_grade': self._calculate_performance_grade(accuracy, avg_confidence, avg_processing_time)
        }
        
        # Store in history
        self.performance_history.append(performance_report)
        
        return performance_report
    
    def _generate_optimization_recommendations(self, 
                                            accuracy: float, 
                                            confidence: float, 
                                            processing_time: float,
                                            confusion_matrix: Dict) -> List[str]:
        """Generate specific optimization recommendations"""
        recommendations = []
        
        # Accuracy-based recommendations
        if accuracy < 0.85:
            recommendations.append("Consider fine-tuning the classification model with more domain-specific training data")
            if accuracy < 0.70:
                recommendations.append("CRITICAL: Model accuracy is below acceptable threshold - review training data quality")
        
        # Confidence-based recommendations
        if confidence < 0.80:
            recommendations.append("Low confidence scores detected - consider ensemble methods or calibration")
        
        # Performance-based recommendations
        if processing_time > 2000:  # 2 seconds
            recommendations.append("High processing time detected - consider model quantization or caching optimization")
        
        # Confusion matrix analysis
        for actual_class, predictions in confusion_matrix.items():
            total_for_class = sum(predictions.values())
            if total_for_class > 0:
                correct = predictions.get(actual_class, 0)
                class_accuracy = correct / total_for_class
                
                if class_accuracy < 0.70:
                    most_confused = max(predictions.items(), key=lambda x: x[1] if x[0] != actual_class else 0)
                    recommendations.append(
                        f"Poor classification for {actual_class} (often confused with {most_confused[0]}) - "
                        f"consider adding more training examples or feature engineering"
                    )
        
        # Cost optimization
        recommendations.append("Monitor API costs and consider fallback to pattern-based classification for simple emails")
        
        # Data quality recommendations
        recommendations.append("Implement active learning to identify and label edge cases for model improvement")
        
        return recommendations
    
    def _calculate_performance_grade(self, accuracy: float, confidence: float, processing_time: float) -> str:
        """Calculate overall performance grade"""
        
        # Weighted scoring
        accuracy_score = accuracy * 50  # 50% weight
        confidence_score = confidence * 30  # 30% weight
        
        # Processing time score (inverse - faster is better)
        time_score = max(0, 20 - (processing_time / 100))  # 20% weight
        
        total_score = accuracy_score + confidence_score + time_score
        
        if total_score >= 90:
            return "A"
        elif total_score >= 80:
            return "B"
        elif total_score >= 70:
            return "C"
        elif total_score >= 60:
            return "D"
        else:
            return "F"
    
    def get_trend_analysis(self, days: int = 30) -> Dict[str, Any]:
        """Analyze performance trends over time"""
        
        cutoff_time = datetime.now() - timedelta(days=days)
        recent_history = [
            entry for entry in self.performance_history
            if datetime.fromisoformat(entry['timestamp']) > cutoff_time
        ]
        
        if not recent_history:
            return {"error": "Insufficient data for trend analysis"}
        
        # Calculate trends
        accuracy_trend = [entry['accuracy'] for entry in recent_history]
        confidence_trend = [entry['average_confidence'] for entry in recent_history]
        time_trend = [entry['average_processing_time_ms'] for entry in recent_history]
        
        return {
            'period_days': days,
            'data_points': len(recent_history),
            'accuracy_trend': {
                'current': accuracy_trend[-1] if accuracy_trend else 0,
                'average': sum(accuracy_trend) / len(accuracy_trend) if accuracy_trend else 0,
                'trend_direction': 'improving' if len(accuracy_trend) > 1 and accuracy_trend[-1] > accuracy_trend[0] else 'declining'
            },
            'confidence_trend': {
                'current': confidence_trend[-1] if confidence_trend else 0,
                'average': sum(confidence_trend) / len(confidence_trend) if confidence_trend else 0,
                'trend_direction': 'improving' if len(confidence_trend) > 1 and confidence_trend[-1] > confidence_trend[0] else 'declining'
            },
            'performance_trend': {
                'current': time_trend[-1] if time_trend else 0,
                'average': sum(time_trend) / len(time_trend) if time_trend else 0,
                'trend_direction': 'improving' if len(time_trend) > 1 and time_trend[-1] < time_trend[0] else 'declining'
            }
        }

class EmailInsightsEngine:
    """AI-powered email insights and analytics engine"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.db_path = config.get('insights_db_path', 'email_insights.db')
        self.pattern_cache = {}
        self.insights_cache = {}
        self.logger = logging.getLogger(__name__)
        
        # Initialize database
        self._setup_database()
        
        # Load existing patterns
        self._load_patterns()
    
    def _setup_database(self):
        """Initialize insights database"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            
            # Email patterns table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS email_patterns (
                    pattern_id TEXT PRIMARY KEY,
                    pattern_type TEXT NOT NULL,
                    pattern_data TEXT NOT NULL,
                    frequency INTEGER DEFAULT 1,
                    accuracy REAL DEFAULT 0.0,
                    last_seen DATETIME NOT NULL,
                    created_at DATETIME NOT NULL
                )
            ''')
            
            # AI insights table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS ai_insights (
                    insight_id TEXT PRIMARY KEY,
                    insight_type TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    evidence TEXT NOT NULL,
                    recommendations TEXT NOT NULL,
                    impact_score REAL NOT NULL,
                    created_at DATETIME NOT NULL,
                    expires_at DATETIME
                )
            ''')
            
            # Automation rules table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS automation_rules (
                    rule_id TEXT PRIMARY KEY,
                    trigger_conditions TEXT NOT NULL,
                    action TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    success_rate REAL DEFAULT 0.0,
                    last_used DATETIME,
                    usage_count INTEGER DEFAULT 0,
                    created_at DATETIME NOT NULL,
                    is_active BOOLEAN DEFAULT 1
                )
            ''')
            
            conn.commit()
    
    def _load_patterns(self):
        """Load existing patterns from database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM email_patterns')
                rows = cursor.fetchall()
                
                for row in rows:
                    pattern = EmailPattern(
                        pattern_id=row[0],
                        pattern_type=row[1],
                        pattern_data=json.loads(row[2]),
                        frequency=row[3],
                        accuracy=row[4],
                        last_seen=datetime.fromisoformat(row[5]),
                        created_at=datetime.fromisoformat(row[6])
                    )
                    self.pattern_cache[pattern.pattern_id] = pattern
                
                logger.info(f"Loaded {len(self.pattern_cache)} email patterns")
        
        except Exception as e:
            logger.error(f"Error loading patterns: {e}")
    
    def analyze_email_patterns(self, email_data: List[Dict[str, Any]]) -> List[AIInsight]:
        """Analyze email data to generate insights and patterns"""
        
        insights = []
        
        # Analyze sender patterns
        sender_insights = self._analyze_sender_patterns(email_data)
        insights.extend(sender_insights)
        
        # Analyze time patterns
        time_insights = self._analyze_time_patterns(email_data)
        insights.extend(time_insights)
        
        # Analyze volume anomalies
        volume_insights = self._analyze_volume_anomalies(email_data)
        insights.extend(volume_insights)
        
        # Analyze priority trends
        priority_insights = self._analyze_priority_trends(email_data)
        insights.extend(priority_insights)
        
        # Store insights
        for insight in insights:
            self._store_insight(insight)
        
        return insights
    
    def _analyze_sender_patterns(self, email_data: List[Dict[str, Any]]) -> List[AIInsight]:
        """Analyze patterns in email senders"""
        insights = []
        
        # Count emails by sender
        sender_counts = Counter()
        sender_classifications = defaultdict(Counter)
        sender_response_times = defaultdict(list)
        
        for email in email_data:
            sender = email.get('sender', '').lower()
            classification = email.get('classification', 'UNKNOWN')
            
            sender_counts[sender] += 1
            sender_classifications[sender][classification] += 1
            
            # Track response times if available
            if 'response_time_hours' in email:
                sender_response_times[sender].append(email['response_time_hours'])
        
        # Identify high-volume senders
        for sender, count in sender_counts.most_common(10):
            if count > 10:  # Significant volume
                
                # Analyze classification patterns
                classifications = sender_classifications[sender]
                most_common_class = classifications.most_common(1)[0]
                classification_consistency = most_common_class[1] / count
                
                if classification_consistency > 0.8:  # High consistency
                    insights.append(AIInsight(
                        insight_id=f"sender_pattern_{hashlib.md5(sender.encode()).hexdigest()[:8]}",
                        insight_type=InsightType.SENDER_PATTERN,
                        confidence=classification_consistency,
                        title=f"Consistent pattern detected for {sender}",
                        description=f"Emails from {sender} are {most_common_class[0]} {classification_consistency:.0%} of the time",
                        evidence={
                            'sender': sender,
                            'total_emails': count,
                            'primary_classification': most_common_class[0],
                            'consistency_rate': classification_consistency
                        },
                        recommendations=[
                            f"Consider auto-classifying emails from {sender} as {most_common_class[0]}",
                            "Create automation rule for this sender pattern"
                        ],
                        impact_score=min(count * classification_consistency, 100),
                        created_at=datetime.now()
                    ))
        
        return insights
    
    def _analyze_time_patterns(self, email_data: List[Dict[str, Any]]) -> List[AIInsight]:
        """Analyze temporal patterns in email activity"""
        insights = []
        
        # Group emails by hour of day
        hour_counts = defaultdict(int)
        hour_urgency = defaultdict(list)
        
        for email in email_data:
            if 'received_at' in email:
                try:
                    received_time = datetime.fromisoformat(email['received_at'])
                    hour = received_time.hour
                    hour_counts[hour] += 1
                    
                    urgency = email.get('urgency', 'MEDIUM')
                    hour_urgency[hour].append(urgency)
                except:
                    continue
        
        # Find peak hours
        if hour_counts:
            peak_hour = max(hour_counts.items(), key=lambda x: x[1])
            avg_volume = sum(hour_counts.values()) / len(hour_counts)
            
            if peak_hour[1] > avg_volume * 1.5:  # 50% above average
                insights.append(AIInsight(
                    insight_id=f"time_pattern_{peak_hour[0]}",
                    insight_type=InsightType.TIME_PATTERN,
                    confidence=0.85,
                    title=f"Peak email activity at {peak_hour[0]:02d}:00",
                    description=f"Email volume peaks at {peak_hour[0]:02d}:00 with {peak_hour[1]} emails ({peak_hour[1]/sum(hour_counts.values()):.1%} of daily volume)",
                    evidence={
                        'peak_hour': peak_hour[0],
                        'peak_volume': peak_hour[1],
                        'percentage_of_total': peak_hour[1] / sum(hour_counts.values()),
                        'hour_distribution': dict(hour_counts)
                    },
                    recommendations=[
                        f"Schedule automated processing during low-activity hours",
                        f"Allocate more resources during {peak_hour[0]:02d}:00 peak period"
                    ],
                    impact_score=peak_hour[1] / sum(hour_counts.values()) * 100,
                    created_at=datetime.now()
                ))
        
        return insights
    
    def _analyze_volume_anomalies(self, email_data: List[Dict[str, Any]]) -> List[AIInsight]:
        """Detect volume anomalies in email patterns"""
        insights = []
        
        # Group emails by date
        daily_counts = defaultdict(int)
        
        for email in email_data:
            if 'received_at' in email:
                try:
                    received_time = datetime.fromisoformat(email['received_at'])
                    date_key = received_time.date()
                    daily_counts[date_key] += 1
                except:
                    continue
        
        if len(daily_counts) > 7:  # Need at least a week of data
            volumes = list(daily_counts.values())
            avg_volume = sum(volumes) / len(volumes)
            std_volume = np.std(volumes) if len(volumes) > 1 else 0
            
            # Detect anomalies (more than 2 standard deviations from mean)
            for date, volume in daily_counts.items():
                if std_volume > 0 and abs(volume - avg_volume) > 2 * std_volume:
                    anomaly_type = "spike" if volume > avg_volume else "drop"
                    severity = abs(volume - avg_volume) / std_volume
                    
                    insights.append(AIInsight(
                        insight_id=f"volume_anomaly_{date}",
                        insight_type=InsightType.VOLUME_ANOMALY,
                        confidence=min(severity / 3, 1.0),  # Cap at 1.0
                        title=f"Volume {anomaly_type} detected on {date}",
                        description=f"Email volume on {date} was {volume} ({volume/avg_volume:.1f}x normal volume)",
                        evidence={
                            'date': date.isoformat(),
                            'volume': volume,
                            'average_volume': avg_volume,
                            'deviation_factor': volume / avg_volume,
                            'anomaly_type': anomaly_type
                        },
                        recommendations=[
                            f"Investigate cause of volume {anomaly_type} on {date}",
                            "Monitor for similar patterns in future",
                            "Consider adjusting resource allocation for similar events"
                        ],
                        impact_score=min(abs(volume - avg_volume) / avg_volume * 100, 100),
                        created_at=datetime.now()
                    ))
        
        return insights
    
    def _analyze_priority_trends(self, email_data: List[Dict[str, Any]]) -> List[AIInsight]:
        """Analyze trends in email priority and urgency"""
        insights = []
        
        # Track priority over time
        priority_by_date = defaultdict(Counter)
        
        for email in email_data:
            if 'received_at' in email and 'urgency' in email:
                try:
                    received_time = datetime.fromisoformat(email['received_at'])
                    date_key = received_time.date()
                    urgency = email['urgency']
                    priority_by_date[date_key][urgency] += 1
                except:
                    continue
        
        # Calculate priority trends
        if len(priority_by_date) > 5:  # Need sufficient data
            dates = sorted(priority_by_date.keys())
            
            # Calculate percentage of high/critical emails over time
            high_priority_trend = []
            for date in dates:
                total = sum(priority_by_date[date].values())
                high_priority = priority_by_date[date]['HIGH'] + priority_by_date[date]['CRITICAL']
                high_priority_trend.append(high_priority / total if total > 0 else 0)
            
            # Check for increasing trend
            if len(high_priority_trend) > 1:
                recent_avg = sum(high_priority_trend[-3:]) / min(3, len(high_priority_trend))
                early_avg = sum(high_priority_trend[:3]) / min(3, len(high_priority_trend))
                
                if recent_avg > early_avg * 1.2:  # 20% increase
                    insights.append(AIInsight(
                        insight_id=f"priority_trend_{dates[-1]}",
                        insight_type=InsightType.PRIORITY_TREND,
                        confidence=0.8,
                        title="Increasing high-priority email trend",
                        description=f"High-priority emails increased from {early_avg:.1%} to {recent_avg:.1%}",
                        evidence={
                            'early_period_percentage': early_avg,
                            'recent_period_percentage': recent_avg,
                            'increase_factor': recent_avg / early_avg if early_avg > 0 else float('inf'),
                            'trend_data': high_priority_trend
                        },
                        recommendations=[
                            "Investigate causes of increasing high-priority emails",
                            "Consider adjusting priority classification thresholds",
                            "Implement proactive measures to reduce urgent requests"
                        ],
                        impact_score=(recent_avg - early_avg) * 100,
                        created_at=datetime.now()
                    ))
        
        return insights
    
    def _store_insight(self, insight: AIInsight):
        """Store insight in database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    INSERT OR REPLACE INTO ai_insights 
                    (insight_id, insight_type, confidence, title, description, evidence, 
                     recommendations, impact_score, created_at, expires_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    insight.insight_id,
                    insight.insight_type.value,
                    insight.confidence,
                    insight.title,
                    insight.description,
                    json.dumps(insight.evidence),
                    json.dumps(insight.recommendations),
                    insight.impact_score,
                    insight.created_at.isoformat(),
                    insight.expires_at.isoformat() if insight.expires_at else None
                ))
                conn.commit()
        
        except Exception as e:
            logger.error(f"Error storing insight: {e}")
    
    def get_recent_insights(self, limit: int = 10) -> List[AIInsight]:
        """Get recent AI insights"""
        insights = []
        
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT * FROM ai_insights 
                    WHERE expires_at IS NULL OR expires_at > ?
                    ORDER BY created_at DESC 
                    LIMIT ?
                ''', (datetime.now().isoformat(), limit))
                
                rows = cursor.fetchall()
                
                for row in rows:
                    insight = AIInsight(
                        insight_id=row[0],
                        insight_type=InsightType(row[1]),
                        confidence=row[2],
                        title=row[3],
                        description=row[4],
                        evidence=json.loads(row[5]),
                        recommendations=json.loads(row[6]),
                        impact_score=row[7],
                        created_at=datetime.fromisoformat(row[8]),
                        expires_at=datetime.fromisoformat(row[9]) if row[9] else None
                    )
                    insights.append(insight)
        
        except Exception as e:
            logger.error(f"Error retrieving insights: {e}")
        
        return insights

class AdvancedAIAutomationEngine:
    """Main advanced AI automation engine orchestrating all enhanced features"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the advanced AI automation engine"""
        self.config = self._load_config(config)
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.ai_optimizer = AIProcessingOptimizer(self.config.get('ai_optimizer', {}))
        self.intelligence_engine = EmailIntelligenceEngine()
        self.insights_engine = EmailInsightsEngine(self.config.get('insights', {}))
        self.ml_optimizer = MLModelOptimizer(self.config.get('ml_optimizer', {}))
        
        # Processing state
        self.is_running = False
        self.processing_metrics = ProcessingMetrics()
        self.automation_rules = {}
        
        # Performance tracking
        self.prediction_history = deque(maxlen=10000)
        self.actual_results = deque(maxlen=10000)
        
        self.logger.info("Advanced AI Automation Engine initialized")
    
    def _load_config(self, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Load configuration with defaults"""
        default_config = {
            'ai_optimizer': {
                'num_workers': 6,
                'max_queue_size': 15000,
                'cache': {'redis_host': 'localhost', 'redis_port': 6379}
            },
            'insights': {
                'insights_db_path': 'advanced_email_insights.db',
                'pattern_learning_enabled': True,
                'auto_rule_generation': True
            },
            'ml_optimizer': {
                'performance_tracking_enabled': True,
                'auto_optimization': True,
                'trend_analysis_days': 30
            },
            'automation': {
                'auto_classification_threshold': 0.85,
                'auto_routing_enabled': True,
                'learning_mode': True
            }
        }
        
        if config:
            self._deep_update(default_config, config)
        
        return default_config
    
    def _deep_update(self, base: dict, update: dict):
        """Deep update dictionary"""
        for key, value in update.items():
            if isinstance(value, dict) and key in base:
                self._deep_update(base[key], value)
            else:
                base[key] = value
    
    async def start_engine(self):
        """Start the advanced AI automation engine"""
        if self.is_running:
            return
        
        self.is_running = True
        
        try:
            # Start AI processing optimizer
            await self.ai_optimizer.start_workers()
            
            # Start background tasks
            self.analytics_task = asyncio.create_task(self._analytics_loop())
            self.optimization_task = asyncio.create_task(self._optimization_loop())
            
            self.logger.info("Advanced AI Automation Engine started successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to start automation engine: {e}")
            self.is_running = False
            raise
    
    async def stop_engine(self):
        """Stop the advanced AI automation engine"""
        self.is_running = False
        
        # Stop AI optimizer
        await self.ai_optimizer.stop_workers()
        
        # Cancel background tasks
        for task_name in ['analytics_task', 'optimization_task']:
            if hasattr(self, task_name):
                task = getattr(self, task_name)
                if task and not task.done():
                    task.cancel()
                    try:
                        await task
                    except asyncio.CancelledError:
                        pass
        
        self.logger.info("Advanced AI Automation Engine stopped")
    
    async def process_email_batch_advanced(self, 
                                         emails: List[Dict[str, Any]], 
                                         enable_insights: bool = True,
                                         enable_automation: bool = True) -> Dict[str, Any]:
        """Process email batch with advanced AI features"""
        
        start_time = time.time()
        results = {
            'processed_count': 0,
            'ai_assisted_count': 0,
            'auto_classified_count': 0,
            'auto_routed_count': 0,
            'insights_generated': 0,
            'automation_rules_triggered': 0,
            'processing_time_ms': 0,
            'results': []
        }
        
        try:
            # Process emails with AI optimization
            processed_emails = []
            
            for email in emails:
                # Enhanced email processing
                result = await self._process_single_email_advanced(email, enable_automation)
                processed_emails.append(result)
                results['results'].append(result)
                
                # Update counters
                results['processed_count'] += 1
                if result.get('ai_assisted'):
                    results['ai_assisted_count'] += 1
                if result.get('auto_classified'):
                    results['auto_classified_count'] += 1
                if result.get('auto_routed'):
                    results['auto_routed_count'] += 1
                if result.get('automation_triggered'):
                    results['automation_rules_triggered'] += 1
            
            # Generate insights if enabled
            if enable_insights and processed_emails:
                insights = self.insights_engine.analyze_email_patterns(processed_emails)
                results['insights_generated'] = len(insights)
                results['insights'] = [asdict(insight) for insight in insights]
            
            # Update performance metrics
            self.processing_metrics.total_processed += results['processed_count']
            self.processing_metrics.ai_assisted += results['ai_assisted_count']
            self.processing_metrics.auto_classified += results['auto_classified_count']
            self.processing_metrics.auto_routed += results['auto_routed_count']
            
            processing_time = (time.time() - start_time) * 1000
            results['processing_time_ms'] = processing_time
            
            # Update throughput metrics
            self.processing_metrics.throughput_per_hour = (
                self.processing_metrics.total_processed / 
                max((datetime.now() - self.processing_metrics.last_updated).total_seconds() / 3600, 0.001)
            )
            
            self.logger.info(
                f"Advanced batch processing completed: {results['processed_count']} emails in {processing_time:.1f}ms"
            )
            
            return results
            
        except Exception as e:
            self.logger.error(f"Error in advanced batch processing: {e}")
            raise
    
    async def _process_single_email_advanced(self, 
                                           email: Dict[str, Any], 
                                           enable_automation: bool = True) -> Dict[str, Any]:
        """Process single email with advanced AI features"""
        
        result = {
            'email_id': email.get('id'),
            'ai_assisted': False,
            'auto_classified': False,
            'auto_routed': False,
            'automation_triggered': False,
            'confidence': 0.0,
            'processing_time_ms': 0,
            'recommendations': []
        }
        
        start_time = time.time()
        
        try:
            # Check for automation rules first
            if enable_automation:
                automation_result = await self._apply_automation_rules(email)
                if automation_result:
                    result.update(automation_result)
                    result['automation_triggered'] = True
                    return result
            
            # Use AI intelligence engine for classification
            analysis = self.intelligence_engine.analyze_email(
                subject=email.get('subject', ''),
                body=email.get('body', ''),
                sender=email.get('sender', '')
            )
            
            result.update({
                'classification': analysis.classification.value,
                'urgency': analysis.urgency.value,
                'sentiment': analysis.sentiment.value,
                'confidence': analysis.confidence,
                'ai_assisted': True,
                'processing_time_ms': (time.time() - start_time) * 1000
            })
            
            # Auto-classify if confidence is high enough
            auto_threshold = self.config['automation']['auto_classification_threshold']
            if analysis.confidence >= auto_threshold:
                result['auto_classified'] = True
            
            # Generate action recommendations
            recommendations = self._generate_action_recommendations(email, analysis)
            result['recommendations'] = recommendations
            
            # Store prediction for learning
            self.prediction_history.append({
                'email_id': email.get('id'),
                'classification': analysis.classification.value,
                'confidence': analysis.confidence,
                'timestamp': datetime.now(),
                'model_used': 'intelligence_engine'
            })
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error processing email {email.get('id')}: {e}")
            result['error'] = str(e)
            return result
    
    async def _apply_automation_rules(self, email: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Apply learned automation rules to email"""
        
        for rule_id, rule in self.automation_rules.items():
            if not rule.is_active:
                continue
            
            # Check if rule conditions match
            if self._check_rule_conditions(email, rule.trigger_conditions):
                
                # Apply automation action
                action_result = await self._execute_automation_action(email, rule.action)
                
                # Update rule usage
                rule.last_used = datetime.now()
                rule.usage_count += 1
                
                self.logger.info(f"Applied automation rule {rule_id} to email {email.get('id')}")
                
                return {
                    'automation_rule_id': rule_id,
                    'action_taken': rule.action.value,
                    'confidence': rule.confidence,
                    **action_result
                }
        
        return None
    
    def _check_rule_conditions(self, email: Dict[str, Any], conditions: Dict[str, Any]) -> bool:
        """Check if email matches automation rule conditions"""
        
        for condition_type, condition_value in conditions.items():
            if condition_type == 'sender_contains':
                if condition_value.lower() not in email.get('sender', '').lower():
                    return False
            elif condition_type == 'subject_contains':
                if condition_value.lower() not in email.get('subject', '').lower():
                    return False
            elif condition_type == 'body_contains':
                if condition_value.lower() not in email.get('body', '').lower():
                    return False
            elif condition_type == 'classification':
                # Would need previous classification
                pass
        
        return True
    
    async def _execute_automation_action(self, 
                                       email: Dict[str, Any], 
                                       action: AutomationAction) -> Dict[str, Any]:
        """Execute automation action on email"""
        
        if action == AutomationAction.AUTO_CLASSIFY:
            # Auto-classify based on patterns
            return {'auto_classified': True, 'classification': 'AUTO_DETERMINED'}
        
        elif action == AutomationAction.AUTO_PRIORITIZE:
            # Auto-prioritize based on sender/content
            return {'auto_prioritized': True, 'priority': 'HIGH'}
        
        elif action == AutomationAction.AUTO_ROUTE:
            # Auto-route to specific team/person
            return {'auto_routed': True, 'routed_to': 'auto_determined_team'}
        
        elif action == AutomationAction.AUTO_DRAFT:
            # Auto-generate draft response
            draft = self.intelligence_engine.generate_draft_reply(email, None)
            return {'auto_draft_generated': True, 'draft_content': draft}
        
        else:
            return {'action_executed': action.value}
    
    def _generate_action_recommendations(self, 
                                       email: Dict[str, Any], 
                                       analysis) -> List[str]:
        """Generate intelligent action recommendations"""
        
        recommendations = []
        
        # Classification-based recommendations
        if analysis.classification == EmailClass.NEEDS_REPLY:
            recommendations.append("Generate AI draft response")
            if analysis.urgency in [Urgency.HIGH, Urgency.CRITICAL]:
                recommendations.append("Priority response needed - schedule within 2 hours")
        
        elif analysis.classification == EmailClass.APPROVAL_REQUIRED:
            recommendations.append("Route to approval workflow")
            recommendations.append("Set reminder for approval deadline")
        
        elif analysis.classification == EmailClass.CREATE_TASK:
            recommendations.append("Create task in project management system")
            recommendations.append("Assign based on content analysis")
        
        elif analysis.classification == EmailClass.DELEGATE:
            recommendations.append("Identify appropriate team member for delegation")
            recommendations.append("Add to delegation queue")
        
        elif analysis.classification == EmailClass.FYI_ONLY:
            recommendations.append("Archive after reading")
            recommendations.append("Add to weekly digest if relevant")
        
        # Urgency-based recommendations
        if analysis.urgency == Urgency.CRITICAL:
            recommendations.append("URGENT: Immediate attention required")
        elif analysis.urgency == Urgency.HIGH:
            recommendations.append("High priority - handle today")
        
        # Sentiment-based recommendations
        if analysis.sentiment == Sentiment.FRUSTRATED:
            recommendations.append("Handle with care - customer appears frustrated")
            recommendations.append("Consider escalating to senior team member")
        elif analysis.sentiment == Sentiment.POSITIVE:
            recommendations.append("Positive sentiment - good opportunity for engagement")
        
        return recommendations
    
    async def _analytics_loop(self):
        """Background analytics and insights generation loop"""
        while self.is_running:
            try:
                # Generate insights every 30 minutes
                await asyncio.sleep(1800)
                
                if len(self.prediction_history) > 50:
                    # Trigger insights analysis
                    recent_emails = list(self.prediction_history)[-100:]
                    await self._generate_periodic_insights(recent_emails)
                
            except Exception as e:
                self.logger.error(f"Analytics loop error: {e}")
                await asyncio.sleep(60)
    
    async def _optimization_loop(self):
        """Background ML model optimization loop"""
        while self.is_running:
            try:
                # Run optimization every hour
                await asyncio.sleep(3600)
                
                if len(self.prediction_history) > 100 and len(self.actual_results) > 100:
                    # Perform model optimization analysis
                    await self._perform_model_optimization()
                
            except Exception as e:
                self.logger.error(f"Optimization loop error: {e}")
                await asyncio.sleep(300)
    
    async def _generate_periodic_insights(self, recent_emails: List[Dict[str, Any]]):
        """Generate periodic insights from recent email data"""
        try:
            insights = self.insights_engine.analyze_email_patterns(recent_emails)
            
            self.logger.info(f"Generated {len(insights)} new insights from recent email patterns")
            
            # Log high-impact insights
            for insight in insights:
                if insight.impact_score > 70:
                    self.logger.info(f"High-impact insight: {insight.title} (impact: {insight.impact_score:.1f})")
        
        except Exception as e:
            self.logger.error(f"Error generating periodic insights: {e}")
    
    async def _perform_model_optimization(self):
        """Perform model optimization analysis"""
        try:
            # Convert recent predictions and actuals for analysis
            recent_predictions = list(self.prediction_history)[-500:]
            recent_actuals = list(self.actual_results)[-500:]
            
            if len(recent_predictions) == len(recent_actuals):
                # Perform optimization analysis
                optimization_report = self.ml_optimizer.analyze_model_performance(
                    recent_predictions, recent_actuals
                )
                
                self.logger.info(f"Model optimization analysis completed - Grade: {optimization_report['performance_grade']}")
                
                # Log critical recommendations
                for recommendation in optimization_report['recommendations']:
                    if 'CRITICAL' in recommendation:
                        self.logger.warning(f"Critical optimization needed: {recommendation}")
        
        except Exception as e:
            self.logger.error(f"Error in model optimization: {e}")
    
    async def get_comprehensive_report(self) -> Dict[str, Any]:
        """Generate comprehensive advanced AI automation report"""
        
        # Get base performance report from AI optimizer
        base_report = await self.ai_optimizer.get_performance_report()
        
        # Get recent insights
        insights = self.insights_engine.get_recent_insights(limit=20)
        
        # Get ML optimization trends
        ml_trends = self.ml_optimizer.get_trend_analysis(days=30)
        
        # Calculate advanced metrics
        automation_efficiency = (
            self.processing_metrics.auto_classified / 
            max(self.processing_metrics.total_processed, 1)
        )
        
        ai_assistance_rate = (
            self.processing_metrics.ai_assisted / 
            max(self.processing_metrics.total_processed, 1)
        )
        
        return {
            'timestamp': datetime.now().isoformat(),
            'advanced_metrics': {
                'total_emails_processed': self.processing_metrics.total_processed,
                'ai_assistance_rate': ai_assistance_rate,
                'automation_efficiency': automation_efficiency,
                'throughput_per_hour': self.processing_metrics.throughput_per_hour,
                'automation_rules_count': len(self.automation_rules),
                'active_rules_count': sum(1 for rule in self.automation_rules.values() if rule.is_active)
            },
            'base_ai_performance': base_report,
            'recent_insights': [asdict(insight) for insight in insights],
            'ml_optimization_trends': ml_trends,
            'automation_rules': {
                rule_id: {
                    'action': rule.action.value,
                    'confidence': rule.confidence,
                    'success_rate': rule.success_rate,
                    'usage_count': rule.usage_count,
                    'is_active': rule.is_active
                }
                for rule_id, rule in self.automation_rules.items()
            }
        }
    
    def record_actual_result(self, email_id: str, actual_classification: str, user_feedback: Dict[str, Any]):
        """Record actual results for model learning"""
        
        self.actual_results.append({
            'email_id': email_id,
            'classification': actual_classification,
            'user_feedback': user_feedback,
            'timestamp': datetime.now()
        })
        
        # Update model accuracy metrics
        self.processing_metrics.last_updated = datetime.now()
        
        self.logger.debug(f"Recorded actual result for email {email_id}: {actual_classification}")
    
    async def cleanup(self):
        """Cleanup resources"""
        await self.stop_engine()
        await self.ai_optimizer.cleanup()
        self.logger.info("Advanced AI Automation Engine cleaned up")


# Example usage and testing
async def main():
    """Example usage of Advanced AI Automation Engine"""
    
    # Configuration
    config = {
        'ai_optimizer': {
            'num_workers': 6,
            'max_queue_size': 15000
        },
        'insights': {
            'pattern_learning_enabled': True,
            'auto_rule_generation': True
        },
        'automation': {
            'auto_classification_threshold': 0.85,
            'learning_mode': True
        }
    }
    
    # Initialize engine
    engine = AdvancedAIAutomationEngine(config)
    
    try:
        # Start engine
        await engine.start_engine()
        
        # Sample email data for testing
        sample_emails = [
            {
                'id': 1,
                'subject': 'Budget Approval Required for Q1 Marketing',
                'body': 'Please approve the Q1 marketing budget of $50,000. Need approval by Friday.',
                'sender': 'marketing@company.com',
                'received_at': datetime.now().isoformat()
            },
            {
                'id': 2,
                'subject': 'FYI: Server Maintenance Tonight',
                'body': 'Just wanted to let you know we have scheduled server maintenance tonight.',
                'sender': 'it@company.com',
                'received_at': datetime.now().isoformat()
            },
            {
                'id': 3,
                'subject': 'Quick question about the project',
                'body': 'Can you please clarify the timeline for the new feature development?',
                'sender': 'client@external.com',
                'received_at': datetime.now().isoformat()
            }
        ]
        
        print("\n=== Advanced AI Automation Engine Demo ===")
        
        # Process emails with advanced features
        results = await engine.process_email_batch_advanced(
            sample_emails, 
            enable_insights=True, 
            enable_automation=True
        )
        
        print(f"\n📊 Advanced Processing Results:")
        print(f"   Emails processed: {results['processed_count']}")
        print(f"   AI assisted: {results['ai_assisted_count']}")
        print(f"   Auto-classified: {results['auto_classified_count']}")
        print(f"   Insights generated: {results['insights_generated']}")
        print(f"   Processing time: {results['processing_time_ms']:.1f}ms")
        
        # Show individual results
        for i, result in enumerate(results['results']):
            email = sample_emails[i]
            print(f"\n   Email {email['id']}: {email['subject'][:50]}...")
            print(f"      Classification: {result.get('classification', 'N/A')}")
            print(f"      Confidence: {result.get('confidence', 0):.2%}")
            print(f"      AI Assisted: {result.get('ai_assisted', False)}")
            if result.get('recommendations'):
                print(f"      Recommendations: {len(result['recommendations'])} actions")
        
        # Generate comprehensive report
        print(f"\n📈 Generating comprehensive report...")
        report = await engine.get_comprehensive_report()
        
        print(f"\n=== Advanced AI Automation Report ===")
        advanced_metrics = report['advanced_metrics']
        print(f"AI Assistance Rate: {advanced_metrics['ai_assistance_rate']:.1%}")
        print(f"Automation Efficiency: {advanced_metrics['automation_efficiency']:.1%}")
        print(f"Throughput: {advanced_metrics['throughput_per_hour']:.1f} emails/hour")
        print(f"Active Automation Rules: {advanced_metrics['active_rules_count']}")
        
        if 'recent_insights' in report and report['recent_insights']:
            print(f"\n🔍 Recent Insights ({len(report['recent_insights'])}):")
            for insight in report['recent_insights'][:3]:  # Show top 3
                print(f"   • {insight['title']} (impact: {insight['impact_score']:.1f})")
    
    finally:
        # Cleanup
        await engine.cleanup()
        print("\nAdvanced AI Automation Engine demo completed.")


if __name__ == "__main__":
    asyncio.run(main())