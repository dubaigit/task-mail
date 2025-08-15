#!/usr/bin/env python3
"""
Backend Performance Monitor and Optimization Utility

Real-time monitoring of backend performance with automatic optimization recommendations
and database health checks for the Apple Mail integration.
"""

import asyncio
import time
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import psutil
import threading
from concurrent.futures import ThreadPoolExecutor
import statistics
from dataclasses import dataclass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import components
from apple_mail_db_reader import AppleMailDBReader
from email_data_connector import AppleMailConnector
from email_intelligence_engine import EmailIntelligenceEngine

@dataclass
class PerformanceMetrics:
    """Performance metrics container."""
    timestamp: datetime
    query_time: float
    memory_usage_mb: float
    cpu_percent: float
    cache_hit_rate: float
    error_count: int
    request_count: int

class PerformanceMonitor:
    """Real-time performance monitor for email backend."""
    
    def __init__(self, monitor_interval: int = 30):
        """Initialize performance monitor."""
        self.monitor_interval = monitor_interval
        self.metrics_history: List[PerformanceMetrics] = []
        self.is_monitoring = False
        self.alert_thresholds = {
            'query_time_ms': 2000,  # 2 seconds
            'memory_usage_mb': 500,  # 500 MB
            'cpu_percent': 80,  # 80%
            'error_rate': 0.05  # 5% error rate
        }
        
        # Initialize components for monitoring
        try:
            self.db_reader = AppleMailDBReader()
            self.connector = AppleMailConnector()
            self.engine = EmailIntelligenceEngine()
            logger.info("Performance monitor initialized")
        except Exception as e:
            logger.error(f"Failed to initialize performance monitor: {e}")
            raise

    def collect_metrics(self) -> PerformanceMetrics:
        """Collect current performance metrics."""
        start_time = time.time()
        
        # Test database query performance
        try:
            _ = self.db_reader.get_recent_emails(limit=10)
            query_time = (time.time() - start_time) * 1000  # Convert to milliseconds
        except Exception as e:
            logger.error(f"Query performance test failed: {e}")
            query_time = -1
        
        # Get system metrics
        process = psutil.Process()
        memory_usage = process.memory_info().rss / 1024 / 1024  # Convert to MB
        cpu_percent = process.cpu_percent()
        
        # Create metrics object
        metrics = PerformanceMetrics(
            timestamp=datetime.now(),
            query_time=query_time,
            memory_usage_mb=memory_usage,
            cpu_percent=cpu_percent,
            cache_hit_rate=0.0,  # Placeholder - would need cache implementation
            error_count=0,  # Placeholder - would need error tracking
            request_count=0  # Placeholder - would need request tracking
        )
        
        return metrics

    def analyze_performance_trends(self, window_minutes: int = 60) -> Dict[str, Any]:
        """Analyze performance trends over time window."""
        cutoff_time = datetime.now() - timedelta(minutes=window_minutes)
        recent_metrics = [m for m in self.metrics_history if m.timestamp > cutoff_time]
        
        if not recent_metrics:
            return {"error": "No recent metrics available"}
        
        query_times = [m.query_time for m in recent_metrics if m.query_time >= 0]
        memory_usage = [m.memory_usage_mb for m in recent_metrics]
        cpu_usage = [m.cpu_percent for m in recent_metrics]
        
        trends = {
            "query_performance": {
                "average_ms": statistics.mean(query_times) if query_times else 0,
                "max_ms": max(query_times) if query_times else 0,
                "min_ms": min(query_times) if query_times else 0,
                "std_dev_ms": statistics.stdev(query_times) if len(query_times) > 1 else 0
            },
            "memory_usage": {
                "average_mb": statistics.mean(memory_usage),
                "max_mb": max(memory_usage),
                "trend": "increasing" if memory_usage[-1] > memory_usage[0] else "stable"
            },
            "cpu_usage": {
                "average_percent": statistics.mean(cpu_usage),
                "max_percent": max(cpu_usage)
            },
            "data_points": len(recent_metrics),
            "time_window_minutes": window_minutes
        }
        
        return trends

    def check_health_status(self) -> Dict[str, Any]:
        """Comprehensive health check."""
        health_status = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "unknown",
            "checks": {}
        }
        
        issues = []
        
        # Database connectivity check
        try:
            start_time = time.time()
            count = self.db_reader.get_email_count()
            db_response_time = (time.time() - start_time) * 1000
            
            health_status["checks"]["database"] = {
                "status": "healthy",
                "response_time_ms": round(db_response_time, 2),
                "email_count": count
            }
            
            if db_response_time > self.alert_thresholds['query_time_ms']:
                issues.append("Database response time is slow")
                
        except Exception as e:
            health_status["checks"]["database"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            issues.append("Database connectivity issue")
        
        # Memory usage check
        memory_mb = psutil.Process().memory_info().rss / 1024 / 1024
        health_status["checks"]["memory"] = {
            "status": "healthy" if memory_mb < self.alert_thresholds['memory_usage_mb'] else "warning",
            "usage_mb": round(memory_mb, 2),
            "threshold_mb": self.alert_thresholds['memory_usage_mb']
        }
        
        if memory_mb > self.alert_thresholds['memory_usage_mb']:
            issues.append("High memory usage")
        
        # CPU usage check
        cpu_percent = psutil.Process().cpu_percent(interval=1)
        health_status["checks"]["cpu"] = {
            "status": "healthy" if cpu_percent < self.alert_thresholds['cpu_percent'] else "warning",
            "usage_percent": round(cpu_percent, 2),
            "threshold_percent": self.alert_thresholds['cpu_percent']
        }
        
        if cpu_percent > self.alert_thresholds['cpu_percent']:
            issues.append("High CPU usage")
        
        # Enhanced connector test
        try:
            start_time = time.time()
            stats = self.connector.get_mailbox_stats()
            connector_time = (time.time() - start_time) * 1000
            
            health_status["checks"]["enhanced_connector"] = {
                "status": "healthy",
                "response_time_ms": round(connector_time, 2),
                "total_messages": stats.get('total_messages', 0)
            }
            
        except Exception as e:
            health_status["checks"]["enhanced_connector"] = {
                "status": "error",
                "error": str(e)
            }
            issues.append("Enhanced connector issue")
        
        # Overall status
        if not issues:
            health_status["overall_status"] = "healthy"
        elif len(issues) <= 2:
            health_status["overall_status"] = "warning"
        else:
            health_status["overall_status"] = "critical"
        
        health_status["issues"] = issues
        health_status["issue_count"] = len(issues)
        
        return health_status

    def generate_optimization_recommendations(self) -> List[str]:
        """Generate performance optimization recommendations."""
        recommendations = []
        
        # Analyze recent performance
        if len(self.metrics_history) < 5:
            recommendations.append("Insufficient data for detailed analysis - continue monitoring")
            return recommendations
        
        recent_metrics = self.metrics_history[-10:]  # Last 10 measurements
        
        # Query performance analysis
        query_times = [m.query_time for m in recent_metrics if m.query_time >= 0]
        if query_times:
            avg_query_time = statistics.mean(query_times)
            max_query_time = max(query_times)
            
            if avg_query_time > 1000:  # > 1 second
                recommendations.append("Consider implementing query result caching to improve response times")
                recommendations.append("Review database indexes for frequently used queries")
            
            if max_query_time > 3000:  # > 3 seconds
                recommendations.append("Implement query timeout and pagination for large result sets")
        
        # Memory analysis
        memory_values = [m.memory_usage_mb for m in recent_metrics]
        if memory_values:
            avg_memory = statistics.mean(memory_values)
            memory_trend = memory_values[-1] - memory_values[0]
            
            if avg_memory > 300:
                recommendations.append("Consider implementing object pooling or connection pooling")
            
            if memory_trend > 50:  # Increasing by more than 50MB
                recommendations.append("Monitor for memory leaks - memory usage is increasing")
        
        # CPU analysis
        cpu_values = [m.cpu_percent for m in recent_metrics]
        if cpu_values:
            avg_cpu = statistics.mean(cpu_values)
            
            if avg_cpu > 50:
                recommendations.append("Consider implementing asynchronous processing for heavy operations")
                recommendations.append("Review AI analysis workload - consider batching")
        
        # General recommendations
        recommendations.extend([
            "Implement connection pooling for database access",
            "Add response compression for API endpoints",
            "Consider implementing Redis caching for frequently accessed data",
            "Set up monitoring alerts for production deployment",
            "Implement circuit breaker pattern for external dependencies"
        ])
        
        return recommendations

    def start_monitoring(self):
        """Start continuous performance monitoring."""
        logger.info(f"Starting performance monitoring (interval: {self.monitor_interval}s)")
        self.is_monitoring = True
        
        def monitor_loop():
            while self.is_monitoring:
                try:
                    metrics = self.collect_metrics()
                    self.metrics_history.append(metrics)
                    
                    # Keep only recent metrics (last 1000 data points)
                    if len(self.metrics_history) > 1000:
                        self.metrics_history = self.metrics_history[-1000:]
                    
                    # Log performance alerts
                    if metrics.query_time > self.alert_thresholds['query_time_ms']:
                        logger.warning(f"PERFORMANCE ALERT: Query time {metrics.query_time:.1f}ms exceeds threshold")
                    
                    if metrics.memory_usage_mb > self.alert_thresholds['memory_usage_mb']:
                        logger.warning(f"MEMORY ALERT: Usage {metrics.memory_usage_mb:.1f}MB exceeds threshold")
                    
                except Exception as e:
                    logger.error(f"Error during monitoring: {e}")
                
                time.sleep(self.monitor_interval)
        
        # Start monitoring in background thread
        monitor_thread = threading.Thread(target=monitor_loop, daemon=True)
        monitor_thread.start()

    def stop_monitoring(self):
        """Stop performance monitoring."""
        logger.info("Stopping performance monitoring")
        self.is_monitoring = False

    def generate_report(self) -> Dict[str, Any]:
        """Generate comprehensive performance report."""
        health = self.check_health_status()
        trends = self.analyze_performance_trends()
        recommendations = self.generate_optimization_recommendations()
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "monitoring_duration_minutes": len(self.metrics_history) * (self.monitor_interval / 60),
            "health_status": health,
            "performance_trends": trends,
            "optimization_recommendations": recommendations,
            "raw_metrics_count": len(self.metrics_history)
        }
        
        return report

    def print_status_dashboard(self):
        """Print real-time status dashboard."""
        health = self.check_health_status()
        latest_metrics = self.metrics_history[-1] if self.metrics_history else None
        
        print("\n" + "="*80)
        print("📊 APPLE MAIL BACKEND - PERFORMANCE DASHBOARD")
        print("="*80)
        print(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"🔄 Monitoring: {'ON' if self.is_monitoring else 'OFF'}")
        print(f"📈 Data Points: {len(self.metrics_history)}")
        print()
        
        # Overall health
        status_emoji = {"healthy": "✅", "warning": "⚠️", "critical": "❌", "unknown": "❓"}
        print(f"🏥 Overall Health: {status_emoji.get(health['overall_status'])} {health['overall_status'].upper()}")
        
        if health.get('issues'):
            print("⚠️  Issues:")
            for issue in health['issues']:
                print(f"   • {issue}")
        print()
        
        # Current metrics
        if latest_metrics:
            print("📊 Current Metrics:")
            print(f"   🔍 Query Time: {latest_metrics.query_time:.1f}ms")
            print(f"   💾 Memory Usage: {latest_metrics.memory_usage_mb:.1f}MB")
            print(f"   🏃 CPU Usage: {latest_metrics.cpu_percent:.1f}%")
            print()
        
        # Database status
        if 'database' in health['checks']:
            db_check = health['checks']['database']
            if db_check['status'] == 'healthy':
                print(f"🗄️  Database: ✅ {db_check['email_count']:,} emails ({db_check['response_time_ms']:.1f}ms)")
            else:
                print(f"🗄️  Database: ❌ {db_check.get('error', 'Unknown error')}")
        
        print("="*80)

def main():
    """Main monitoring application."""
    print("🚀 Starting Apple Mail Backend Performance Monitor")
    
    try:
        monitor = PerformanceMonitor(monitor_interval=10)  # 10-second intervals for demo
        
        # Start monitoring
        monitor.start_monitoring()
        
        print("📊 Collecting performance data...")
        print("Press Ctrl+C to stop monitoring and generate report")
        
        # Monitor for a period or until interrupted
        try:
            for i in range(18):  # Monitor for 3 minutes (18 * 10 seconds)
                time.sleep(10)
                monitor.print_status_dashboard()
                
                if i % 6 == 5:  # Every minute
                    print("\n📈 Performance Trends:")
                    trends = monitor.analyze_performance_trends(window_minutes=5)
                    if 'query_performance' in trends:
                        qp = trends['query_performance']
                        print(f"   Query Avg: {qp['average_ms']:.1f}ms, Max: {qp['max_ms']:.1f}ms")
                    print()
                
        except KeyboardInterrupt:
            print("\n🛑 Monitoring stopped by user")
        
        # Generate final report
        monitor.stop_monitoring()
        
        print("\n📋 Generating comprehensive performance report...")
        report = monitor.generate_report()
        
        # Save report
        report_file = f"performance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        print(f"📄 Performance report saved to: {report_file}")
        
        # Print summary
        print("\n" + "="*80)
        print("📊 PERFORMANCE MONITORING SUMMARY")
        print("="*80)
        
        health = report['health_status']
        print(f"Overall Health: {health['overall_status'].upper()}")
        print(f"Monitoring Duration: {report['monitoring_duration_minutes']:.1f} minutes")
        print(f"Issues Found: {health['issue_count']}")
        
        if 'performance_trends' in report:
            trends = report['performance_trends']
            if 'query_performance' in trends:
                qp = trends['query_performance']
                print(f"Average Query Time: {qp['average_ms']:.1f}ms")
        
        print("\n🔧 Top Recommendations:")
        for i, rec in enumerate(report['optimization_recommendations'][:5], 1):
            print(f"  {i}. {rec}")
        
        print("\n✅ Performance monitoring completed successfully!")
        
    except Exception as e:
        logger.error(f"Performance monitoring failed: {e}")
        print(f"❌ Error: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    import sys
    exit_code = main()
    sys.exit(exit_code)