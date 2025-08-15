#!/usr/bin/env python3
"""
Advanced Performance Monitoring and Auto-Scaling System

Comprehensive monitoring solution for email intelligence system with:
- Real-time performance metrics collection
- Intelligent alerting with thresholds and escalation
- Auto-scaling recommendations and triggers
- Resource utilization tracking
- SLA monitoring and reporting
- Predictive performance analysis
- Integration with AI processing optimizer
- WebSocket connection monitoring
- Database performance tracking

Designed to maintain system performance under high load and
provide actionable insights for optimization.
"""

import asyncio
import logging
import time
import json
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any, Callable, Union
from dataclasses import dataclass, asdict
from enum import Enum
from collections import defaultdict, deque
import threading
import os
import sqlite3
from concurrent.futures import ThreadPoolExecutor

# Performance monitoring
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

# Redis for metrics storage
try:
    import redis.asyncio as aioredis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

# Setup logging
logger = logging.getLogger(__name__)

class AlertSeverity(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class MetricType(Enum):
    """Types of metrics tracked"""
    COUNTER = "counter"        # Incrementing values
    GAUGE = "gauge"            # Point-in-time values
    HISTOGRAM = "histogram"    # Distribution of values
    TIMER = "timer"            # Duration measurements
    RATE = "rate"              # Rate of change

class ThresholdCondition(Enum):
    """Threshold condition types"""
    GREATER_THAN = "gt"
    LESS_THAN = "lt"
    EQUALS = "eq"
    GREATER_THAN_OR_EQUAL = "gte"
    LESS_THAN_OR_EQUAL = "lte"
    CHANGE_RATE = "change_rate"

@dataclass
class MetricPoint:
    """Individual metric data point"""
    timestamp: datetime
    value: float
    tags: Dict[str, str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = {}

@dataclass
class Metric:
    """Metric definition and data"""
    name: str
    metric_type: MetricType
    description: str
    unit: str
    data_points: deque = None
    max_data_points: int = 1000
    
    def __post_init__(self):
        if self.data_points is None:
            self.data_points = deque(maxlen=self.max_data_points)
    
    def add_point(self, value: float, timestamp: Optional[datetime] = None, tags: Optional[Dict[str, str]] = None):
        """Add a data point to the metric"""
        if timestamp is None:
            timestamp = datetime.now()
        
        point = MetricPoint(timestamp=timestamp, value=value, tags=tags or {})
        self.data_points.append(point)
    
    def get_latest_value(self) -> Optional[float]:
        """Get the most recent value"""
        if self.data_points:
            return self.data_points[-1].value
        return None
    
    def get_values_in_window(self, window_seconds: int) -> List[float]:
        """Get values within a time window"""
        cutoff_time = datetime.now() - timedelta(seconds=window_seconds)
        return [
            point.value for point in self.data_points
            if point.timestamp >= cutoff_time
        ]
    
    def calculate_statistics(self, window_seconds: int = 300) -> Dict[str, float]:
        """Calculate statistics for the metric"""
        values = self.get_values_in_window(window_seconds)
        
        if not values:
            return {}
        
        stats = {
            'count': len(values),
            'min': min(values),
            'max': max(values),
            'mean': statistics.mean(values),
            'current': values[-1] if values else 0
        }
        
        if len(values) > 1:
            stats['median'] = statistics.median(values)
            stats['stdev'] = statistics.stdev(values)
            stats['change_rate'] = (values[-1] - values[0]) / len(values)
        
        return stats

@dataclass
class AlertThreshold:
    """Alert threshold configuration"""
    metric_name: str
    condition: ThresholdCondition
    value: float
    severity: AlertSeverity
    window_seconds: int = 300
    consecutive_violations: int = 1
    cooldown_seconds: int = 300
    description: str = ""
    enabled: bool = True
    
    # State tracking
    violation_count: int = 0
    last_violation_time: Optional[datetime] = None
    last_alert_time: Optional[datetime] = None

@dataclass
class Alert:
    """Performance alert"""
    id: str
    metric_name: str
    severity: AlertSeverity
    message: str
    current_value: float
    threshold_value: float
    condition: ThresholdCondition
    timestamp: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    tags: Dict[str, str] = None
    
    def __post_init__(self):
        if self.tags is None:
            self.tags = {}

@dataclass
class PerformanceReport:
    """Comprehensive performance report"""
    timestamp: datetime
    report_period_hours: float
    system_health_score: float
    active_alerts: List[Alert]
    metric_summaries: Dict[str, Dict[str, float]]
    sla_compliance: Dict[str, float]
    resource_utilization: Dict[str, float]
    performance_trends: Dict[str, str]
    optimization_recommendations: List[str]
    scaling_recommendations: Dict[str, Any]

class MetricsCollector:
    """Collects and manages performance metrics"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.metrics: Dict[str, Metric] = {}
        self.metrics_lock = threading.RLock()
        self.collection_interval = config.get('collection_interval_seconds', 30)
        self.is_collecting = False
        self.collection_task = None
        
        # Initialize system metrics
        self._initialize_system_metrics()
    
    def _initialize_system_metrics(self):
        """Initialize standard system metrics"""
        system_metrics = [
            Metric("cpu_usage_percent", MetricType.GAUGE, "CPU utilization percentage", "%"),
            Metric("memory_usage_percent", MetricType.GAUGE, "Memory utilization percentage", "%"),
            Metric("memory_usage_mb", MetricType.GAUGE, "Memory usage in MB", "MB"),
            Metric("disk_usage_percent", MetricType.GAUGE, "Disk utilization percentage", "%"),
            Metric("network_io_bytes_per_sec", MetricType.RATE, "Network I/O rate", "bytes/s"),
            Metric("disk_io_bytes_per_sec", MetricType.RATE, "Disk I/O rate", "bytes/s"),
            
            # Application metrics
            Metric("active_websocket_connections", MetricType.GAUGE, "Active WebSocket connections", "count"),
            Metric("ai_requests_per_minute", MetricType.RATE, "AI processing requests per minute", "req/min"),
            Metric("ai_response_time_ms", MetricType.TIMER, "AI response time", "ms"),
            Metric("cache_hit_rate_percent", MetricType.GAUGE, "Cache hit rate", "%"),
            Metric("queue_depth", MetricType.GAUGE, "Processing queue depth", "count"),
            Metric("database_query_time_ms", MetricType.TIMER, "Database query time", "ms"),
            Metric("error_rate_percent", MetricType.GAUGE, "Error rate percentage", "%"),
            Metric("throughput_requests_per_sec", MetricType.RATE, "Request throughput", "req/s"),
        ]
        
        for metric in system_metrics:
            self.metrics[metric.name] = metric
    
    def register_metric(self, metric: Metric):
        """Register a custom metric"""
        with self.metrics_lock:
            self.metrics[metric.name] = metric
    
    def record_value(self, metric_name: str, value: float, tags: Optional[Dict[str, str]] = None):
        """Record a metric value"""
        with self.metrics_lock:
            if metric_name in self.metrics:
                self.metrics[metric_name].add_point(value, tags=tags)
            else:
                logger.warning(f"Unknown metric: {metric_name}")
    
    def get_metric(self, metric_name: str) -> Optional[Metric]:
        """Get metric by name"""
        with self.metrics_lock:
            return self.metrics.get(metric_name)
    
    def get_all_metrics(self) -> Dict[str, Metric]:
        """Get all metrics"""
        with self.metrics_lock:
            return dict(self.metrics)
    
    async def start_collection(self):
        """Start automatic metrics collection"""
        if self.is_collecting:
            return
        
        self.is_collecting = True
        self.collection_task = asyncio.create_task(self._collection_loop())
        logger.info("Metrics collection started")
    
    async def stop_collection(self):
        """Stop automatic metrics collection"""
        self.is_collecting = False
        if self.collection_task:
            self.collection_task.cancel()
            try:
                await self.collection_task
            except asyncio.CancelledError:
                pass
        logger.info("Metrics collection stopped")
    
    async def _collection_loop(self):
        """Main metrics collection loop"""
        while self.is_collecting:
            try:
                await self._collect_system_metrics()
                await asyncio.sleep(self.collection_interval)
            except Exception as e:
                logger.error(f"Metrics collection error: {e}")
                await asyncio.sleep(30)
    
    async def _collect_system_metrics(self):
        """Collect system resource metrics"""
        if not PSUTIL_AVAILABLE:
            return
        
        try:
            # CPU metrics
            cpu_percent = psutil.cpu_percent(interval=1)
            self.record_value("cpu_usage_percent", cpu_percent)
            
            # Memory metrics
            memory = psutil.virtual_memory()
            self.record_value("memory_usage_percent", memory.percent)
            self.record_value("memory_usage_mb", memory.used / (1024 * 1024))
            
            # Disk metrics
            disk = psutil.disk_usage('/')
            self.record_value("disk_usage_percent", disk.percent)
            
            # Network I/O
            net_io = psutil.net_io_counters()
            if hasattr(self, '_last_net_io'):
                time_delta = time.time() - self._last_net_time
                bytes_sent_rate = (net_io.bytes_sent - self._last_net_io.bytes_sent) / time_delta
                bytes_recv_rate = (net_io.bytes_recv - self._last_net_io.bytes_recv) / time_delta
                total_rate = bytes_sent_rate + bytes_recv_rate
                self.record_value("network_io_bytes_per_sec", total_rate)
            
            self._last_net_io = net_io
            self._last_net_time = time.time()
            
            # Disk I/O
            disk_io = psutil.disk_io_counters()
            if hasattr(self, '_last_disk_io'):
                time_delta = time.time() - self._last_disk_time
                read_rate = (disk_io.read_bytes - self._last_disk_io.read_bytes) / time_delta
                write_rate = (disk_io.write_bytes - self._last_disk_io.write_bytes) / time_delta
                total_rate = read_rate + write_rate
                self.record_value("disk_io_bytes_per_sec", total_rate)
            
            self._last_disk_io = disk_io
            self._last_disk_time = time.time()
            
        except Exception as e:
            logger.error(f"System metrics collection error: {e}")

class AlertManager:
    """Manages performance alerts and notifications"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.thresholds: Dict[str, AlertThreshold] = {}
        self.active_alerts: Dict[str, Alert] = {}
        self.alert_history: deque = deque(maxlen=1000)
        self.alert_callbacks: List[Callable[[Alert], None]] = []
        self.alerts_lock = threading.RLock()
        
        # Initialize default thresholds
        self._initialize_default_thresholds()
    
    def _initialize_default_thresholds(self):
        """Initialize default alert thresholds"""
        default_thresholds = [
            AlertThreshold(
                metric_name="cpu_usage_percent",
                condition=ThresholdCondition.GREATER_THAN,
                value=80.0,
                severity=AlertSeverity.WARNING,
                description="High CPU usage"
            ),
            AlertThreshold(
                metric_name="cpu_usage_percent",
                condition=ThresholdCondition.GREATER_THAN,
                value=95.0,
                severity=AlertSeverity.CRITICAL,
                description="Critical CPU usage"
            ),
            AlertThreshold(
                metric_name="memory_usage_percent",
                condition=ThresholdCondition.GREATER_THAN,
                value=85.0,
                severity=AlertSeverity.WARNING,
                description="High memory usage"
            ),
            AlertThreshold(
                metric_name="memory_usage_percent",
                condition=ThresholdCondition.GREATER_THAN,
                value=95.0,
                severity=AlertSeverity.CRITICAL,
                description="Critical memory usage"
            ),
            AlertThreshold(
                metric_name="error_rate_percent",
                condition=ThresholdCondition.GREATER_THAN,
                value=5.0,
                severity=AlertSeverity.WARNING,
                description="High error rate"
            ),
            AlertThreshold(
                metric_name="error_rate_percent",
                condition=ThresholdCondition.GREATER_THAN,
                value=15.0,
                severity=AlertSeverity.CRITICAL,
                description="Critical error rate"
            ),
            AlertThreshold(
                metric_name="ai_response_time_ms",
                condition=ThresholdCondition.GREATER_THAN,
                value=10000.0,  # 10 seconds
                severity=AlertSeverity.WARNING,
                description="Slow AI response time"
            ),
            AlertThreshold(
                metric_name="queue_depth",
                condition=ThresholdCondition.GREATER_THAN,
                value=100.0,
                severity=AlertSeverity.WARNING,
                description="High processing queue depth"
            ),
            AlertThreshold(
                metric_name="active_websocket_connections",
                condition=ThresholdCondition.GREATER_THAN,
                value=400.0,
                severity=AlertSeverity.WARNING,
                description="High WebSocket connection count"
            ),
            AlertThreshold(
                metric_name="cache_hit_rate_percent",
                condition=ThresholdCondition.LESS_THAN,
                value=50.0,
                severity=AlertSeverity.WARNING,
                description="Low cache hit rate"
            ),
        ]
        
        for threshold in default_thresholds:
            self.thresholds[f"{threshold.metric_name}_{threshold.condition.value}_{threshold.value}"] = threshold
    
    def add_threshold(self, threshold: AlertThreshold) -> str:
        """Add alert threshold"""
        threshold_id = f"{threshold.metric_name}_{threshold.condition.value}_{threshold.value}"
        with self.alerts_lock:
            self.thresholds[threshold_id] = threshold
        return threshold_id
    
    def remove_threshold(self, threshold_id: str):
        """Remove alert threshold"""
        with self.alerts_lock:
            if threshold_id in self.thresholds:
                del self.thresholds[threshold_id]
    
    def add_alert_callback(self, callback: Callable[[Alert], None]):
        """Add callback for alert notifications"""
        self.alert_callbacks.append(callback)
    
    def evaluate_thresholds(self, metrics_collector: MetricsCollector):
        """Evaluate all thresholds against current metrics"""
        with self.alerts_lock:
            for threshold_id, threshold in self.thresholds.items():
                if not threshold.enabled:
                    continue
                
                self._evaluate_threshold(threshold, metrics_collector)
    
    def _evaluate_threshold(self, threshold: AlertThreshold, metrics_collector: MetricsCollector):
        """Evaluate individual threshold"""
        metric = metrics_collector.get_metric(threshold.metric_name)
        if not metric:
            return
        
        current_value = metric.get_latest_value()
        if current_value is None:
            return
        
        # Check threshold condition
        violation = self._check_condition(current_value, threshold.condition, threshold.value)
        
        now = datetime.now()
        
        if violation:
            threshold.violation_count += 1
            threshold.last_violation_time = now
            
            # Check if we should trigger an alert
            should_alert = (
                threshold.violation_count >= threshold.consecutive_violations and
                (
                    threshold.last_alert_time is None or
                    (now - threshold.last_alert_time).total_seconds() >= threshold.cooldown_seconds
                )
            )
            
            if should_alert:
                self._trigger_alert(threshold, current_value)
        else:
            # Reset violation count if condition is not met
            if threshold.violation_count > 0:
                threshold.violation_count = 0
                
                # Check if we should resolve an existing alert
                alert_id = f"{threshold.metric_name}_{threshold.condition.value}_{threshold.value}"
                if alert_id in self.active_alerts:
                    self._resolve_alert(alert_id)
    
    def _check_condition(self, value: float, condition: ThresholdCondition, threshold_value: float) -> bool:
        """Check if threshold condition is met"""
        if condition == ThresholdCondition.GREATER_THAN:
            return value > threshold_value
        elif condition == ThresholdCondition.LESS_THAN:
            return value < threshold_value
        elif condition == ThresholdCondition.EQUALS:
            return abs(value - threshold_value) < 0.001
        elif condition == ThresholdCondition.GREATER_THAN_OR_EQUAL:
            return value >= threshold_value
        elif condition == ThresholdCondition.LESS_THAN_OR_EQUAL:
            return value <= threshold_value
        else:
            return False
    
    def _trigger_alert(self, threshold: AlertThreshold, current_value: float):
        """Trigger an alert"""
        alert_id = f"{threshold.metric_name}_{threshold.condition.value}_{threshold.value}"
        
        # Don't create duplicate active alerts
        if alert_id in self.active_alerts:
            return
        
        alert = Alert(
            id=alert_id,
            metric_name=threshold.metric_name,
            severity=threshold.severity,
            message=threshold.description or f"{threshold.metric_name} {threshold.condition.value} {threshold.value}",
            current_value=current_value,
            threshold_value=threshold.value,
            condition=threshold.condition,
            timestamp=datetime.now()
        )
        
        self.active_alerts[alert_id] = alert
        self.alert_history.append(alert)
        threshold.last_alert_time = datetime.now()
        
        # Notify callbacks
        for callback in self.alert_callbacks:
            try:
                callback(alert)
            except Exception as e:
                logger.error(f"Alert callback error: {e}")
        
        logger.warning(f"Alert triggered: {alert.message} (current: {current_value:.2f})")
    
    def _resolve_alert(self, alert_id: str):
        """Resolve an active alert"""
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            alert.resolved = True
            alert.resolved_at = datetime.now()
            
            del self.active_alerts[alert_id]
            
            logger.info(f"Alert resolved: {alert.message}")
    
    def get_active_alerts(self) -> List[Alert]:
        """Get all active alerts"""
        with self.alerts_lock:
            return list(self.active_alerts.values())
    
    def get_alert_history(self, hours: int = 24) -> List[Alert]:
        """Get alert history for specified hours"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        return [
            alert for alert in self.alert_history
            if alert.timestamp >= cutoff_time
        ]

class AutoScaler:
    """Provides auto-scaling recommendations based on metrics"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.scaling_history: List[Dict[str, Any]] = []
        
    def analyze_scaling_needs(self, metrics_collector: MetricsCollector) -> Dict[str, Any]:
        """Analyze current metrics and provide scaling recommendations"""
        recommendations = {
            'timestamp': datetime.now().isoformat(),
            'recommendations': [],
            'current_load': {},
            'predicted_load': {},
            'scaling_actions': []
        }
        
        # Analyze key metrics
        cpu_metric = metrics_collector.get_metric("cpu_usage_percent")
        memory_metric = metrics_collector.get_metric("memory_usage_percent")
        connections_metric = metrics_collector.get_metric("active_websocket_connections")
        queue_metric = metrics_collector.get_metric("queue_depth")
        response_time_metric = metrics_collector.get_metric("ai_response_time_ms")
        
        # Current load assessment
        recommendations['current_load'] = {
            'cpu': cpu_metric.get_latest_value() if cpu_metric else 0,
            'memory': memory_metric.get_latest_value() if memory_metric else 0,
            'connections': connections_metric.get_latest_value() if connections_metric else 0,
            'queue_depth': queue_metric.get_latest_value() if queue_metric else 0,
            'response_time': response_time_metric.get_latest_value() if response_time_metric else 0
        }
        
        # Scale up recommendations
        if cpu_metric and cpu_metric.get_latest_value() > 70:
            recommendations['recommendations'].append({
                'type': 'scale_up',
                'component': 'cpu',
                'reason': f"CPU usage at {cpu_metric.get_latest_value():.1f}%",
                'priority': 'high' if cpu_metric.get_latest_value() > 85 else 'medium'
            })
        
        if memory_metric and memory_metric.get_latest_value() > 80:
            recommendations['recommendations'].append({
                'type': 'scale_up',
                'component': 'memory',
                'reason': f"Memory usage at {memory_metric.get_latest_value():.1f}%",
                'priority': 'high' if memory_metric.get_latest_value() > 90 else 'medium'
            })
        
        if connections_metric and connections_metric.get_latest_value() > 300:
            recommendations['recommendations'].append({
                'type': 'scale_up',
                'component': 'websocket_workers',
                'reason': f"WebSocket connections at {connections_metric.get_latest_value():.0f}",
                'priority': 'medium'
            })
        
        if queue_metric and queue_metric.get_latest_value() > 50:
            recommendations['recommendations'].append({
                'type': 'scale_up',
                'component': 'ai_workers',
                'reason': f"Processing queue depth at {queue_metric.get_latest_value():.0f}",
                'priority': 'high' if queue_metric.get_latest_value() > 100 else 'medium'
            })
        
        # Scale down recommendations (if load is consistently low)
        if self._check_consistent_low_load(metrics_collector):
            recommendations['recommendations'].append({
                'type': 'scale_down',
                'component': 'workers',
                'reason': "Consistently low resource utilization",
                'priority': 'low'
            })
        
        return recommendations
    
    def _check_consistent_low_load(self, metrics_collector: MetricsCollector) -> bool:
        """Check if system has been under low load for extended period"""
        window_minutes = 30
        
        cpu_metric = metrics_collector.get_metric("cpu_usage_percent")
        memory_metric = metrics_collector.get_metric("memory_usage_percent")
        
        if not cpu_metric or not memory_metric:
            return False
        
        cpu_values = cpu_metric.get_values_in_window(window_minutes * 60)
        memory_values = memory_metric.get_values_in_window(window_minutes * 60)
        
        if len(cpu_values) < 10 or len(memory_values) < 10:
            return False
        
        # Check if consistently below thresholds
        avg_cpu = statistics.mean(cpu_values)
        avg_memory = statistics.mean(memory_values)
        
        return avg_cpu < 30 and avg_memory < 50

class PerformanceMonitor:
    """Main performance monitoring system"""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the performance monitor"""
        self.config = self._load_config(config)
        self.logger = logging.getLogger(__name__)
        
        # Components
        self.metrics_collector = MetricsCollector(self.config)
        self.alert_manager = AlertManager(self.config)
        self.auto_scaler = AutoScaler(self.config)
        
        # Background tasks
        self.is_running = False
        self.monitoring_task = None
        self.alert_task = None
        
        # Performance database for historical data
        self.db_path = self.config.get('db_path', 'performance_metrics.db')
        self._initialize_database()
        
        # Redis for metrics sharing (optional)
        self.redis_client = None
        if REDIS_AVAILABLE and self.config.get('redis_enabled', False):
            asyncio.create_task(self._initialize_redis())
        
        # Add alert callback for logging
        self.alert_manager.add_alert_callback(self._log_alert)
        
        self.logger.info("Performance Monitor initialized")
    
    def _load_config(self, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Load configuration with defaults"""
        default_config = {
            'collection_interval_seconds': 30,
            'alert_evaluation_interval_seconds': 60,
            'db_path': 'performance_metrics.db',
            'redis_enabled': False,
            'redis_host': 'localhost',
            'redis_port': 6379,
            'redis_db': 2,
            'retention_days': 30
        }
        
        if config:
            default_config.update(config)
        
        return default_config
    
    def _initialize_database(self):
        """Initialize SQLite database for historical metrics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Create tables
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS metrics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    metric_name TEXT NOT NULL,
                    value REAL NOT NULL,
                    tags TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS alerts (
                    id TEXT PRIMARY KEY,
                    metric_name TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    message TEXT NOT NULL,
                    current_value REAL NOT NULL,
                    threshold_value REAL NOT NULL,
                    timestamp TEXT NOT NULL,
                    resolved INTEGER DEFAULT 0,
                    resolved_at TEXT
                )
            ''')
            
            # Create indexes
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp)')
            
            conn.commit()
            conn.close()
            
            self.logger.info(f"Performance database initialized: {self.db_path}")
            
        except Exception as e:
            self.logger.error(f"Database initialization error: {e}")
    
    async def _initialize_redis(self):
        """Initialize Redis for metrics sharing"""
        try:
            self.redis_client = aioredis.Redis(
                host=self.config['redis_host'],
                port=self.config['redis_port'],
                db=self.config['redis_db'],
                decode_responses=True
            )
            
            await self.redis_client.ping()
            self.logger.info("Redis connection established for performance metrics")
            
        except Exception as e:
            self.logger.error(f"Redis initialization failed: {e}")
            self.redis_client = None
    
    def _log_alert(self, alert: Alert):
        """Log alert to database and external systems"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO alerts 
                (id, metric_name, severity, message, current_value, threshold_value, timestamp, resolved, resolved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                alert.id, alert.metric_name, alert.severity.value, alert.message,
                alert.current_value, alert.threshold_value, alert.timestamp.isoformat(),
                1 if alert.resolved else 0, alert.resolved_at.isoformat() if alert.resolved_at else None
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Error logging alert to database: {e}")
    
    async def start_monitoring(self):
        """Start performance monitoring"""
        if self.is_running:
            return
        
        self.is_running = True
        
        # Start metrics collection
        await self.metrics_collector.start_collection()
        
        # Start monitoring tasks
        self.alert_task = asyncio.create_task(self._alert_evaluation_loop())
        
        self.logger.info("Performance monitoring started")
    
    async def stop_monitoring(self):
        """Stop performance monitoring"""
        self.is_running = False
        
        # Stop metrics collection
        await self.metrics_collector.stop_collection()
        
        # Cancel tasks
        if self.alert_task:
            self.alert_task.cancel()
            try:
                await self.alert_task
            except asyncio.CancelledError:
                pass
        
        # Close Redis connection
        if self.redis_client:
            await self.redis_client.close()
        
        self.logger.info("Performance monitoring stopped")
    
    async def _alert_evaluation_loop(self):
        """Background alert evaluation loop"""
        while self.is_running:
            try:
                self.alert_manager.evaluate_thresholds(self.metrics_collector)
                await asyncio.sleep(self.config['alert_evaluation_interval_seconds'])
            except Exception as e:
                self.logger.error(f"Alert evaluation error: {e}")
                await asyncio.sleep(60)
    
    def record_metric(self, metric_name: str, value: float, tags: Optional[Dict[str, str]] = None):
        """Record a metric value"""
        self.metrics_collector.record_value(metric_name, value, tags)
        
        # Optionally store in database for historical analysis
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO metrics (timestamp, metric_name, value, tags)
                VALUES (?, ?, ?, ?)
            ''', (
                datetime.now().isoformat(),
                metric_name,
                value,
                json.dumps(tags) if tags else None
            ))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            self.logger.error(f"Error storing metric to database: {e}")
    
    async def generate_performance_report(self, hours: int = 24) -> PerformanceReport:
        """Generate comprehensive performance report"""
        cutoff_time = datetime.now() - timedelta(hours=hours)
        
        # Get metric summaries
        metric_summaries = {}
        for name, metric in self.metrics_collector.get_all_metrics().items():
            stats = metric.calculate_statistics(window_seconds=hours * 3600)
            if stats:
                metric_summaries[name] = stats
        
        # Calculate system health score
        health_score = self._calculate_system_health_score(metric_summaries)
        
        # Get active alerts
        active_alerts = self.alert_manager.get_active_alerts()
        
        # SLA compliance calculation
        sla_compliance = self._calculate_sla_compliance(metric_summaries)
        
        # Resource utilization summary
        resource_utilization = {
            'cpu': metric_summaries.get('cpu_usage_percent', {}).get('mean', 0),
            'memory': metric_summaries.get('memory_usage_percent', {}).get('mean', 0),
            'disk': metric_summaries.get('disk_usage_percent', {}).get('mean', 0),
            'network': metric_summaries.get('network_io_bytes_per_sec', {}).get('mean', 0)
        }
        
        # Performance trends
        performance_trends = self._analyze_performance_trends(metric_summaries)
        
        # Optimization recommendations
        optimization_recommendations = self._generate_optimization_recommendations(
            metric_summaries, active_alerts
        )
        
        # Scaling recommendations
        scaling_recommendations = self.auto_scaler.analyze_scaling_needs(self.metrics_collector)
        
        return PerformanceReport(
            timestamp=datetime.now(),
            report_period_hours=hours,
            system_health_score=health_score,
            active_alerts=active_alerts,
            metric_summaries=metric_summaries,
            sla_compliance=sla_compliance,
            resource_utilization=resource_utilization,
            performance_trends=performance_trends,
            optimization_recommendations=optimization_recommendations,
            scaling_recommendations=scaling_recommendations
        )
    
    def _calculate_system_health_score(self, metric_summaries: Dict[str, Dict[str, float]]) -> float:
        """Calculate overall system health score (0-100)"""
        score = 100.0
        
        # CPU health
        if 'cpu_usage_percent' in metric_summaries:
            cpu_avg = metric_summaries['cpu_usage_percent'].get('mean', 0)
            if cpu_avg > 80:
                score -= 20
            elif cpu_avg > 60:
                score -= 10
        
        # Memory health
        if 'memory_usage_percent' in metric_summaries:
            memory_avg = metric_summaries['memory_usage_percent'].get('mean', 0)
            if memory_avg > 85:
                score -= 25
            elif memory_avg > 70:
                score -= 15
        
        # Error rate health
        if 'error_rate_percent' in metric_summaries:
            error_rate = metric_summaries['error_rate_percent'].get('mean', 0)
            if error_rate > 10:
                score -= 30
            elif error_rate > 5:
                score -= 15
        
        # Response time health
        if 'ai_response_time_ms' in metric_summaries:
            response_time = metric_summaries['ai_response_time_ms'].get('mean', 0)
            if response_time > 10000:  # 10 seconds
                score -= 20
            elif response_time > 5000:  # 5 seconds
                score -= 10
        
        # Cache efficiency health
        if 'cache_hit_rate_percent' in metric_summaries:
            hit_rate = metric_summaries['cache_hit_rate_percent'].get('mean', 100)
            if hit_rate < 50:
                score -= 15
            elif hit_rate < 70:
                score -= 10
        
        return max(score, 0)
    
    def _calculate_sla_compliance(self, metric_summaries: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        """Calculate SLA compliance percentages"""
        sla_targets = {
            'response_time_sla': 5000,  # 5 seconds
            'uptime_sla': 99.9,
            'error_rate_sla': 1.0,  # 1%
            'cache_hit_rate_sla': 80.0  # 80%
        }
        
        compliance = {}
        
        # Response time SLA
        if 'ai_response_time_ms' in metric_summaries:
            avg_response_time = metric_summaries['ai_response_time_ms'].get('mean', 0)
            compliance['response_time'] = max(0, 100 - (avg_response_time / sla_targets['response_time_sla']) * 100)
        
        # Error rate SLA
        if 'error_rate_percent' in metric_summaries:
            error_rate = metric_summaries['error_rate_percent'].get('mean', 0)
            compliance['error_rate'] = max(0, 100 - (error_rate / sla_targets['error_rate_sla']) * 100)
        
        # Cache hit rate SLA
        if 'cache_hit_rate_percent' in metric_summaries:
            hit_rate = metric_summaries['cache_hit_rate_percent'].get('mean', 0)
            compliance['cache_performance'] = min(100, (hit_rate / sla_targets['cache_hit_rate_sla']) * 100)
        
        return compliance
    
    def _analyze_performance_trends(self, metric_summaries: Dict[str, Dict[str, float]]) -> Dict[str, str]:
        """Analyze performance trends"""
        trends = {}
        
        for metric_name, stats in metric_summaries.items():
            change_rate = stats.get('change_rate', 0)
            
            if abs(change_rate) < 0.1:
                trend = 'stable'
            elif change_rate > 0:
                trend = 'increasing'
            else:
                trend = 'decreasing'
            
            trends[metric_name] = trend
        
        return trends
    
    def _generate_optimization_recommendations(self, metric_summaries: Dict[str, Dict[str, float]], active_alerts: List[Alert]) -> List[str]:
        """Generate optimization recommendations"""
        recommendations = []
        
        # CPU optimization
        if 'cpu_usage_percent' in metric_summaries:
            cpu_avg = metric_summaries['cpu_usage_percent'].get('mean', 0)
            if cpu_avg > 70:
                recommendations.append("Consider optimizing CPU-intensive operations or scaling horizontally")
        
        # Memory optimization
        if 'memory_usage_percent' in metric_summaries:
            memory_avg = metric_summaries['memory_usage_percent'].get('mean', 0)
            if memory_avg > 80:
                recommendations.append("Implement memory optimization or increase available memory")
        
        # Cache optimization
        if 'cache_hit_rate_percent' in metric_summaries:
            hit_rate = metric_summaries['cache_hit_rate_percent'].get('mean', 100)
            if hit_rate < 70:
                recommendations.append("Optimize caching strategy - increase cache size or adjust TTL values")
        
        # Queue optimization
        if 'queue_depth' in metric_summaries:
            queue_depth = metric_summaries['queue_depth'].get('mean', 0)
            if queue_depth > 20:
                recommendations.append("Increase AI processing workers or optimize batch processing")
        
        # Response time optimization
        if 'ai_response_time_ms' in metric_summaries:
            response_time = metric_summaries['ai_response_time_ms'].get('mean', 0)
            if response_time > 5000:
                recommendations.append("Optimize AI processing pipeline or implement request prioritization")
        
        # Alert-based recommendations
        for alert in active_alerts:
            if alert.severity == AlertSeverity.CRITICAL:
                recommendations.append(f"URGENT: Address {alert.message} immediately")
        
        return recommendations
    
    async def get_metrics_summary(self) -> Dict[str, Any]:
        """Get current metrics summary"""
        summary = {
            'timestamp': datetime.now().isoformat(),
            'metrics': {},
            'active_alerts': len(self.alert_manager.get_active_alerts()),
            'system_health': 'unknown'
        }
        
        for name, metric in self.metrics_collector.get_all_metrics().items():
            latest_value = metric.get_latest_value()
            if latest_value is not None:
                summary['metrics'][name] = {
                    'current': latest_value,
                    'unit': metric.unit
                }
        
        # Calculate basic health status
        cpu = summary['metrics'].get('cpu_usage_percent', {}).get('current', 0)
        memory = summary['metrics'].get('memory_usage_percent', {}).get('current', 0)
        
        if cpu < 50 and memory < 60:
            summary['system_health'] = 'healthy'
        elif cpu < 80 and memory < 80:
            summary['system_health'] = 'moderate'
        else:
            summary['system_health'] = 'stressed'
        
        return summary


# Example usage and testing
async def demo_performance_monitor():
    """Demonstrate the performance monitoring system"""
    
    # Configuration
    config = {
        'collection_interval_seconds': 5,
        'alert_evaluation_interval_seconds': 10,
        'db_path': 'demo_performance.db',
        'redis_enabled': False
    }
    
    # Initialize monitor
    monitor = PerformanceMonitor(config)
    
    try:
        # Start monitoring
        await monitor.start_monitoring()
        
        print("\n=== Performance Monitor Demo ===")
        
        # Simulate some metrics
        print("\nSimulating performance metrics...")
        
        for i in range(20):
            # Simulate varying CPU usage
            cpu_usage = 30 + (i * 3) + (i % 5) * 10
            monitor.record_metric("cpu_usage_percent", cpu_usage)
            
            # Simulate memory usage
            memory_usage = 40 + (i * 2)
            monitor.record_metric("memory_usage_percent", memory_usage)
            
            # Simulate AI response times
            response_time = 2000 + (i * 200) + (i % 3) * 1000
            monitor.record_metric("ai_response_time_ms", response_time)
            
            # Simulate error rate
            error_rate = (i % 7) * 2
            monitor.record_metric("error_rate_percent", error_rate)
            
            # Simulate cache hit rate
            cache_hit_rate = 95 - (i % 10) * 8
            monitor.record_metric("cache_hit_rate_percent", cache_hit_rate)
            
            await asyncio.sleep(0.5)
        
        # Wait for alert evaluation
        await asyncio.sleep(2)
        
        # Get current status
        print("\n=== Current Status ===")
        summary = await monitor.get_metrics_summary()
        print(f"System Health: {summary['system_health']}")
        print(f"Active Alerts: {summary['active_alerts']}")
        print(f"CPU Usage: {summary['metrics'].get('cpu_usage_percent', {}).get('current', 0):.1f}%")
        print(f"Memory Usage: {summary['metrics'].get('memory_usage_percent', {}).get('current', 0):.1f}%")
        print(f"AI Response Time: {summary['metrics'].get('ai_response_time_ms', {}).get('current', 0):.0f}ms")
        
        # Show active alerts
        active_alerts = monitor.alert_manager.get_active_alerts()
        if active_alerts:
            print("\n=== Active Alerts ===")
            for alert in active_alerts:
                print(f"[{alert.severity.value.upper()}] {alert.message} (current: {alert.current_value:.1f})")
        
        # Generate performance report
        print("\n=== Performance Report ===")
        report = await monitor.generate_performance_report(hours=1)
        
        print(f"Health Score: {report.system_health_score:.1f}/100")
        print(f"SLA Compliance: {report.sla_compliance}")
        
        if report.optimization_recommendations:
            print("\nOptimization Recommendations:")
            for rec in report.optimization_recommendations[:3]:
                print(f"  - {rec}")
        
        # Scaling recommendations
        scaling = report.scaling_recommendations
        if scaling['recommendations']:
            print("\nScaling Recommendations:")
            for rec in scaling['recommendations'][:3]:
                print(f"  - {rec['type']}: {rec['component']} ({rec['reason']})")
    
    finally:
        # Cleanup
        await monitor.stop_monitoring()
        print("\nDemo completed and monitoring stopped.")


if __name__ == "__main__":
    asyncio.run(demo_performance_monitor())
