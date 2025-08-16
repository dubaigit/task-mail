#!/usr/bin/env python3
"""
Email Intelligence Performance Monitor

Comprehensive performance monitoring system to verify <200ms email loading targets
and track optimization effectiveness.

Features:
- Real-time API response time tracking
- Database query performance monitoring
- Cache hit/miss ratio analysis
- Background processing metrics
- Performance alerts and reporting
- Bottleneck identification
"""

import time
import asyncio
import logging
import statistics
from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from contextlib import asynccontextmanager
import psutil
import threading
from collections import deque, defaultdict
import json
from pathlib import Path

from sqlmodel import Session, select, func
from email_cache_models import EmailCache, get_session


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PerformanceMetric:
    """Individual performance measurement"""
    timestamp: datetime
    operation: str
    duration_ms: float
    success: bool
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PerformanceStats:
    """Aggregated performance statistics"""
    operation: str
    count: int
    avg_ms: float
    median_ms: float
    p95_ms: float
    p99_ms: float
    min_ms: float
    max_ms: float
    success_rate: float
    errors: int


class PerformanceMonitor:
    """
    Comprehensive performance monitoring system for email intelligence.
    
    Tracks:
    - API endpoint response times
    - Database query performance
    - Cache effectiveness
    - Background processing metrics
    - System resource usage
    """
    
    def __init__(self, max_metrics: int = 10000, alert_threshold_ms: float = 200.0):
        """
        Initialize performance monitor.
        
        Args:
            max_metrics: Maximum number of metrics to keep in memory
            alert_threshold_ms: Alert threshold for slow operations
        """
        self.max_metrics = max_metrics
        self.alert_threshold_ms = alert_threshold_ms
        
        # Metric storage (thread-safe deques)
        self.metrics: deque = deque(maxlen=max_metrics)
        self.recent_metrics: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        
        # Aggregated statistics
        self.stats_cache: Dict[str, PerformanceStats] = {}
        self.last_stats_update = datetime.utcnow()
        self.stats_update_interval = timedelta(minutes=1)
        
        # Alert tracking
        self.alert_callbacks: List[Callable] = []
        self.alert_history: deque = deque(maxlen=100)
        
        # System monitoring
        self.system_metrics: Dict[str, Any] = {}
        self.monitoring_active = False
        
        # Lock for thread safety
        self._lock = threading.Lock()
        
        logger.info("Performance monitor initialized")
    
    def start_monitoring(self) -> None:
        """Start background system monitoring"""
        if self.monitoring_active:
            return
        
        self.monitoring_active = True
        monitoring_thread = threading.Thread(target=self._system_monitoring_loop, daemon=True)
        monitoring_thread.start()
        logger.info("Background system monitoring started")
    
    def stop_monitoring(self) -> None:
        """Stop background monitoring"""
        self.monitoring_active = False
        logger.info("Performance monitoring stopped")
    
    def record_metric(self, operation: str, duration_ms: float, success: bool = True, 
                     metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Record a performance metric.
        
        Args:
            operation: Name of the operation (e.g., 'get_emails', 'db_query')
            duration_ms: Duration in milliseconds
            success: Whether the operation succeeded
            metadata: Additional metadata about the operation
        """
        metric = PerformanceMetric(
            timestamp=datetime.utcnow(),
            operation=operation,
            duration_ms=duration_ms,
            success=success,
            metadata=metadata or {}
        )
        
        with self._lock:
            self.metrics.append(metric)
            self.recent_metrics[operation].append(metric)
        
        # Check for performance alerts
        if duration_ms > self.alert_threshold_ms:
            self._trigger_alert(f"Slow operation: {operation} took {duration_ms:.2f}ms", metric)
        
        # Update stats cache if needed
        if datetime.utcnow() - self.last_stats_update > self.stats_update_interval:
            self._update_stats_cache()
    
    @asynccontextmanager
    async def measure_async(self, operation: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Async context manager for measuring operation performance.
        
        Usage:
            async with monitor.measure_async('api_call'):
                result = await some_async_operation()
        """
        start_time = time.time()
        success = True
        error = None
        
        try:
            yield
        except Exception as e:
            success = False
            error = str(e)
            raise
        finally:
            duration_ms = (time.time() - start_time) * 1000
            final_metadata = metadata or {}
            if error:
                final_metadata['error'] = error
            
            self.record_metric(operation, duration_ms, success, final_metadata)
    
    def measure_sync(self, operation: str, metadata: Optional[Dict[str, Any]] = None):
        """
        Sync context manager for measuring operation performance.
        
        Usage:
            with monitor.measure_sync('db_query'):
                result = some_sync_operation()
        """
        return self._SyncMeasureContext(self, operation, metadata)
    
    class _SyncMeasureContext:
        def __init__(self, monitor, operation: str, metadata: Optional[Dict[str, Any]]):
            self.monitor = monitor
            self.operation = operation
            self.metadata = metadata
            self.start_time = None
        
        def __enter__(self):
            self.start_time = time.time()
            return self
        
        def __exit__(self, exc_type, exc_val, exc_tb):
            duration_ms = (time.time() - self.start_time) * 1000
            success = exc_type is None
            final_metadata = self.metadata or {}
            if exc_val:
                final_metadata['error'] = str(exc_val)
            
            self.monitor.record_metric(self.operation, duration_ms, success, final_metadata)
    
    def get_stats(self, operation: Optional[str] = None, 
                  time_range: Optional[timedelta] = None) -> Dict[str, PerformanceStats]:
        """
        Get performance statistics.
        
        Args:
            operation: Specific operation to get stats for (None for all)
            time_range: Time range to consider (None for all time)
        
        Returns:
            Dictionary of operation name to PerformanceStats
        """
        cutoff_time = None
        if time_range:
            cutoff_time = datetime.utcnow() - time_range
        
        # Filter metrics
        filtered_metrics = []
        with self._lock:
            for metric in self.metrics:
                if cutoff_time and metric.timestamp < cutoff_time:
                    continue
                if operation and metric.operation != operation:
                    continue
                filtered_metrics.append(metric)
        
        # Group by operation
        operation_metrics = defaultdict(list)
        for metric in filtered_metrics:
            operation_metrics[metric.operation].append(metric)
        
        # Calculate stats for each operation
        stats = {}
        for op_name, metrics_list in operation_metrics.items():
            stats[op_name] = self._calculate_stats(op_name, metrics_list)
        
        return stats
    
    def get_real_time_stats(self) -> Dict[str, Any]:
        """Get real-time performance dashboard data"""
        # Update stats cache
        self._update_stats_cache()
        
        # Get recent metrics (last 5 minutes)
        recent_stats = self.get_stats(time_range=timedelta(minutes=5))
        
        # System metrics
        system_info = {
            'cpu_percent': psutil.cpu_percent(interval=None),
            'memory_percent': psutil.virtual_memory().percent,
            'memory_used_mb': psutil.Process().memory_info().rss / 1024 / 1024,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Performance summary
        email_loading_stats = recent_stats.get('get_emails')
        performance_summary = {
            'target_ms': self.alert_threshold_ms,
            'email_loading': {
                'avg_ms': email_loading_stats.avg_ms if email_loading_stats else 0,
                'success_rate': email_loading_stats.success_rate if email_loading_stats else 1.0,
                'meets_target': (email_loading_stats.avg_ms < self.alert_threshold_ms) if email_loading_stats else True
            },
            'total_operations': len(self.metrics),
            'operations_last_5min': sum(len(metrics) for metrics in self.recent_metrics.values())
        }
        
        return {
            'timestamp': datetime.utcnow().isoformat(),
            'performance_summary': performance_summary,
            'operation_stats': {name: self._stats_to_dict(stats) for name, stats in recent_stats.items()},
            'system_metrics': system_info,
            'recent_alerts': [self._alert_to_dict(alert) for alert in list(self.alert_history)[-10:]]
        }
    
    def get_database_performance(self, engine) -> Dict[str, Any]:
        """Get database-specific performance metrics"""
        with self.measure_sync('db_health_check'):
            with get_session(engine) as session:
                # Basic counts
                total_emails = session.exec(select(func.count(EmailCache.id))).first() or 0
                ai_processed = session.exec(
                    select(func.count(EmailCache.id)).where(EmailCache.ai_processed_at.is_not(None))
                ).first() or 0
                
                # Query performance test
                query_start = time.time()
                recent_emails = session.exec(
                    select(EmailCache).order_by(EmailCache.date_received.desc()).limit(50)
                ).all()
                query_time_ms = (time.time() - query_start) * 1000
                
                return {
                    'total_emails': total_emails,
                    'ai_processed_emails': ai_processed,
                    'ai_processing_percentage': round((ai_processed / max(total_emails, 1)) * 100, 1),
                    'sample_query_time_ms': round(query_time_ms, 2),
                    'sample_query_meets_target': query_time_ms < self.alert_threshold_ms,
                    'database_size_mb': self._get_database_size_mb(engine)
                }
    
    def add_alert_callback(self, callback: Callable[[str, PerformanceMetric], None]) -> None:
        """Add callback for performance alerts"""
        self.alert_callbacks.append(callback)
    
    def export_metrics(self, file_path: Path, time_range: Optional[timedelta] = None) -> None:
        """Export metrics to JSON file for analysis"""
        stats = self.get_stats(time_range=time_range)
        real_time_data = self.get_real_time_stats()
        
        export_data = {
            'export_timestamp': datetime.utcnow().isoformat(),
            'time_range_hours': time_range.total_seconds() / 3600 if time_range else 'all',
            'performance_stats': {name: self._stats_to_dict(stats_obj) for name, stats_obj in stats.items()},
            'real_time_dashboard': real_time_data,
            'alert_threshold_ms': self.alert_threshold_ms
        }
        
        with open(file_path, 'w') as f:
            json.dump(export_data, f, indent=2, default=str)
        
        logger.info(f"Performance metrics exported to {file_path}")
    
    def _calculate_stats(self, operation: str, metrics_list: List[PerformanceMetric]) -> PerformanceStats:
        """Calculate statistics for a list of metrics"""
        if not metrics_list:
            return PerformanceStats(
                operation=operation, count=0, avg_ms=0, median_ms=0, p95_ms=0, p99_ms=0,
                min_ms=0, max_ms=0, success_rate=1.0, errors=0
            )
        
        durations = [m.duration_ms for m in metrics_list]
        successes = [m.success for m in metrics_list]
        
        durations.sort()
        count = len(durations)
        
        return PerformanceStats(
            operation=operation,
            count=count,
            avg_ms=round(statistics.mean(durations), 2),
            median_ms=round(statistics.median(durations), 2),
            p95_ms=round(durations[int(0.95 * count)] if count > 1 else durations[0], 2),
            p99_ms=round(durations[int(0.99 * count)] if count > 1 else durations[0], 2),
            min_ms=round(min(durations), 2),
            max_ms=round(max(durations), 2),
            success_rate=round(sum(successes) / len(successes), 3),
            errors=len([s for s in successes if not s])
        )
    
    def _update_stats_cache(self) -> None:
        """Update the cached statistics"""
        self.stats_cache = self.get_stats(time_range=timedelta(hours=1))
        self.last_stats_update = datetime.utcnow()
    
    def _trigger_alert(self, message: str, metric: PerformanceMetric) -> None:
        """Trigger a performance alert"""
        alert = {
            'timestamp': datetime.utcnow(),
            'message': message,
            'operation': metric.operation,
            'duration_ms': metric.duration_ms,
            'metadata': metric.metadata
        }
        
        with self._lock:
            self.alert_history.append(alert)
        
        # Call alert callbacks
        for callback in self.alert_callbacks:
            try:
                callback(message, metric)
            except Exception as e:
                logger.error(f"Alert callback error: {e}")
        
        logger.warning(f"Performance Alert: {message}")
    
    def _system_monitoring_loop(self) -> None:
        """Background loop for system monitoring"""
        while self.monitoring_active:
            try:
                self.system_metrics = {
                    'timestamp': datetime.utcnow(),
                    'cpu_percent': psutil.cpu_percent(interval=1),
                    'memory_percent': psutil.virtual_memory().percent,
                    'memory_used_mb': psutil.Process().memory_info().rss / 1024 / 1024,
                    'disk_usage_percent': psutil.disk_usage('/').percent,
                    'network_connections': len(psutil.net_connections())
                }
                
                # Record system metrics
                self.record_metric('system_cpu', self.system_metrics['cpu_percent'])
                self.record_metric('system_memory', self.system_metrics['memory_percent'])
                
                time.sleep(10)  # Update every 10 seconds
                
            except Exception as e:
                logger.error(f"System monitoring error: {e}")
                time.sleep(30)
    
    def _get_database_size_mb(self, engine) -> float:
        """Get database file size in MB"""
        try:
            db_url = str(engine.url)
            if 'sqlite' in db_url:
                # Extract file path from SQLite URL
                file_path = db_url.replace('sqlite:///', '')
                if Path(file_path).exists():
                    return round(Path(file_path).stat().st_size / 1024 / 1024, 2)
            return 0.0
        except Exception:
            return 0.0
    
    def _stats_to_dict(self, stats: PerformanceStats) -> Dict[str, Any]:
        """Convert PerformanceStats to dictionary"""
        return {
            'operation': stats.operation,
            'count': stats.count,
            'avg_ms': stats.avg_ms,
            'median_ms': stats.median_ms,
            'p95_ms': stats.p95_ms,
            'p99_ms': stats.p99_ms,
            'min_ms': stats.min_ms,
            'max_ms': stats.max_ms,
            'success_rate': stats.success_rate,
            'errors': stats.errors,
            'meets_target': stats.avg_ms < self.alert_threshold_ms
        }
    
    def _alert_to_dict(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        """Convert alert to dictionary for JSON serialization"""
        return {
            'timestamp': alert['timestamp'].isoformat(),
            'message': alert['message'],
            'operation': alert['operation'],
            'duration_ms': alert['duration_ms'],
            'metadata': alert['metadata']
        }


# Global performance monitor instance
performance_monitor = PerformanceMonitor()


def log_performance_alert(message: str, metric: PerformanceMetric) -> None:
    """Default alert callback that logs to console"""
    logger.warning(f"PERFORMANCE ALERT: {message} (Operation: {metric.operation})")


# Add default alert callback
performance_monitor.add_alert_callback(log_performance_alert)


if __name__ == "__main__":
    # Example usage and testing
    import asyncio
    
    async def test_performance_monitor():
        """Test the performance monitoring system"""
        print("Testing Performance Monitor...")
        
        # Start monitoring
        performance_monitor.start_monitoring()
        
        # Simulate some operations
        for i in range(10):
            # Simulate fast operation
            with performance_monitor.measure_sync('fast_operation'):
                time.sleep(0.05)  # 50ms
            
            # Simulate slow operation (should trigger alert)
            if i == 5:
                with performance_monitor.measure_sync('slow_operation'):
                    time.sleep(0.25)  # 250ms - should trigger alert
            
            # Async operation
            async with performance_monitor.measure_async('async_operation'):
                await asyncio.sleep(0.1)  # 100ms
        
        # Get stats
        print("\nPerformance Statistics:")
        stats = performance_monitor.get_stats()
        for operation, stat in stats.items():
            print(f"  {operation}: avg={stat.avg_ms:.1f}ms, p95={stat.p95_ms:.1f}ms, success_rate={stat.success_rate:.1%}")
        
        # Get real-time dashboard
        print("\nReal-time Dashboard:")
        dashboard = performance_monitor.get_real_time_stats()
        print(f"  Email loading avg: {dashboard['performance_summary']['email_loading']['avg_ms']:.1f}ms")
        print(f"  Meets target: {dashboard['performance_summary']['email_loading']['meets_target']}")
        print(f"  Total operations: {dashboard['performance_summary']['total_operations']}")
        
        # Export metrics
        export_path = Path("performance_metrics_test.json")
        performance_monitor.export_metrics(export_path, time_range=timedelta(minutes=10))
        print(f"\nMetrics exported to: {export_path}")
        
        # Stop monitoring
        performance_monitor.stop_monitoring()
        print("\nPerformance monitoring test completed!")
    
    # Run the test
    asyncio.run(test_performance_monitor())