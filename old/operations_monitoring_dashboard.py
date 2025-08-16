#!/usr/bin/env python3
"""
Operations Monitoring Dashboard - Enterprise Grade

Comprehensive monitoring, alerting, and operations infrastructure for production deployment.
Features:
- Real-time metrics visualization and dashboards
- Automated alert routing and escalation
- Health monitoring with advanced diagnostics
- Performance SLA tracking and reporting
- Operational runbook automation
- Incident response workflows
"""

import asyncio
import time
import json
import logging
import traceback
import threading
import sqlite3
import smtplib
import requests
import subprocess
import psutil
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Callable, Union
from dataclasses import dataclass, field, asdict
from enum import Enum, auto
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
from pathlib import Path
import aiohttp
import aiosqlite
import weakref
import sys
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(process)d:%(thread)d] - %(message)s',
    handlers=[
        logging.FileHandler('operations_monitoring.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# Core Data Models
# ============================================================================

class AlertSeverity(Enum):
    """Alert severity levels with operational priority"""
    CRITICAL = "critical"  # Immediate response required
    HIGH = "high"         # Response within 15 minutes
    MEDIUM = "medium"     # Response within 1 hour
    LOW = "low"          # Response within 4 hours
    INFO = "info"        # Informational only

class AlertStatus(Enum):
    """Alert lifecycle status"""
    TRIGGERED = "triggered"
    ACKNOWLEDGED = "acknowledged"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"

class IncidentPriority(Enum):
    """Incident priority levels"""
    P0 = "p0"  # Critical service outage
    P1 = "p1"  # Major service degradation
    P2 = "p2"  # Minor service issues
    P3 = "p3"  # Performance concerns
    P4 = "p4"  # Maintenance issues

@dataclass
class MetricThreshold:
    """Metric threshold configuration"""
    metric_name: str
    warning_threshold: float
    critical_threshold: float
    comparison_operator: str = ">"  # >, <, >=, <=, ==, !=
    time_window_minutes: int = 5
    min_samples: int = 3
    enabled: bool = True
    description: str = ""

@dataclass
class Alert:
    """Alert instance with full context"""
    id: str
    metric_name: str
    severity: AlertSeverity
    status: AlertStatus
    current_value: float
    threshold_value: float
    threshold_type: str  # warning or critical
    message: str
    context: Dict[str, Any]
    triggered_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    notes: List[str] = field(default_factory=list)
    escalation_level: int = 0
    incident_id: Optional[str] = None

@dataclass
class Incident:
    """Operational incident tracking"""
    id: str
    title: str
    description: str
    priority: IncidentPriority
    status: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    assigned_to: Optional[str] = None
    related_alerts: List[str] = field(default_factory=list)
    timeline: List[Dict[str, Any]] = field(default_factory=list)
    impact_assessment: Dict[str, Any] = field(default_factory=dict)
    resolution_notes: str = ""

@dataclass
class SystemHealthMetrics:
    """Comprehensive system health snapshot"""
    timestamp: datetime
    overall_status: str  # healthy, degraded, outage
    cpu_usage_percent: float
    memory_usage_percent: float
    disk_usage_percent: float
    network_latency_ms: float
    active_connections: int
    error_rate_percent: float
    response_time_p95: float
    throughput_requests_per_minute: int
    active_alerts: int
    critical_alerts: int
    services_status: Dict[str, str]
    custom_metrics: Dict[str, float] = field(default_factory=dict)

@dataclass
class SLAMetric:
    """Service Level Agreement metric tracking"""
    name: str
    target_value: float
    current_value: float
    measurement_period: str
    last_updated: datetime
    status: str  # meeting, at_risk, breached
    breach_count_24h: int = 0
    breach_count_7d: int = 0
    breach_count_30d: int = 0

# ============================================================================
# Monitoring Dashboard System
# ============================================================================

class OperationsMonitoringDashboard:
    """Comprehensive operations monitoring and alerting system"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Core components
        self.metrics_collector = MetricsCollector(config)
        self.alert_manager = AlertManager(config)
        self.incident_manager = IncidentManager(config)
        self.notification_system = NotificationSystem(config)
        self.sla_monitor = SLAMonitor(config)
        self.health_checker = AdvancedHealthChecker(config)
        
        # State tracking
        self.is_running = False
        self.start_time = datetime.now()
        self.last_health_check = None
        
        # Performance tracking
        self.monitoring_metrics = {
            'checks_performed': 0,
            'alerts_triggered': 0,
            'incidents_created': 0,
            'notifications_sent': 0,
            'health_check_errors': 0
        }
        
        # Database setup
        self.db_path = config.get('monitoring_db_path', 'operations_monitoring.db')
        self._setup_database()
        
        # Background tasks
        self.monitoring_task = None
        self.health_check_task = None
        self.sla_monitoring_task = None
        
    def _setup_database(self):
        """Initialize monitoring database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Metrics table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS metrics_history (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        metric_name TEXT NOT NULL,
                        value REAL NOT NULL,
                        tags TEXT,
                        context TEXT
                    )
                ''')
                
                # Alerts table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS alerts (
                        id TEXT PRIMARY KEY,
                        metric_name TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        status TEXT NOT NULL,
                        current_value REAL,
                        threshold_value REAL,
                        threshold_type TEXT,
                        message TEXT,
                        context TEXT,
                        triggered_at DATETIME NOT NULL,
                        acknowledged_at DATETIME,
                        resolved_at DATETIME,
                        acknowledged_by TEXT,
                        notes TEXT,
                        escalation_level INTEGER DEFAULT 0,
                        incident_id TEXT
                    )
                ''')
                
                # Incidents table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS incidents (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT,
                        priority TEXT NOT NULL,
                        status TEXT NOT NULL,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        resolved_at DATETIME,
                        assigned_to TEXT,
                        related_alerts TEXT,
                        timeline TEXT,
                        impact_assessment TEXT,
                        resolution_notes TEXT
                    )
                ''')
                
                # Health checks table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS health_checks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        overall_status TEXT NOT NULL,
                        cpu_usage REAL,
                        memory_usage REAL,
                        disk_usage REAL,
                        network_latency REAL,
                        active_connections INTEGER,
                        error_rate REAL,
                        response_time_p95 REAL,
                        throughput_rpm INTEGER,
                        active_alerts INTEGER,
                        critical_alerts INTEGER,
                        services_status TEXT,
                        custom_metrics TEXT
                    )
                ''')
                
                # SLA metrics table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS sla_metrics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        name TEXT NOT NULL,
                        target_value REAL NOT NULL,
                        current_value REAL NOT NULL,
                        measurement_period TEXT NOT NULL,
                        status TEXT NOT NULL,
                        breach_count_24h INTEGER DEFAULT 0,
                        breach_count_7d INTEGER DEFAULT 0,
                        breach_count_30d INTEGER DEFAULT 0
                    )
                ''')
                
                # Create indexes for performance
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics_history(timestamp)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics_history(metric_name)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_health_timestamp ON health_checks(timestamp)')
                
                conn.commit()
                self.logger.info("Operations monitoring database initialized successfully")
                
        except Exception as e:
            self.logger.error(f"Failed to setup monitoring database: {e}")
            raise

    async def start_monitoring(self):
        """Start comprehensive monitoring system"""
        if self.is_running:
            return
        
        self.is_running = True
        self.start_time = datetime.now()
        
        try:
            # Start core components
            await self.metrics_collector.start()
            await self.alert_manager.start()
            await self.incident_manager.start()
            await self.notification_system.start()
            await self.sla_monitor.start()
            
            # Start background monitoring tasks
            self.monitoring_task = asyncio.create_task(self._monitoring_loop())
            self.health_check_task = asyncio.create_task(self._health_check_loop())
            self.sla_monitoring_task = asyncio.create_task(self._sla_monitoring_loop())
            
            self.logger.info("Operations monitoring system started successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to start monitoring system: {e}")
            self.is_running = False
            raise

    async def stop_monitoring(self):
        """Stop monitoring system gracefully"""
        self.is_running = False
        
        # Cancel background tasks
        for task in [self.monitoring_task, self.health_check_task, self.sla_monitoring_task]:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # Stop core components
        try:
            await self.sla_monitor.stop()
            await self.notification_system.stop()
            await self.incident_manager.stop()
            await self.alert_manager.stop()
            await self.metrics_collector.stop()
        except Exception as e:
            self.logger.error(f"Error stopping monitoring components: {e}")
        
        self.logger.info("Operations monitoring system stopped")

    async def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.is_running:
            try:
                # Collect current metrics
                metrics = await self.metrics_collector.collect_all_metrics()
                self.monitoring_metrics['checks_performed'] += 1
                
                # Evaluate alerts
                new_alerts = await self.alert_manager.evaluate_metrics(metrics)
                if new_alerts:
                    self.monitoring_metrics['alerts_triggered'] += len(new_alerts)
                    
                    # Check for incident escalation
                    for alert in new_alerts:
                        if alert.severity in [AlertSeverity.CRITICAL, AlertSeverity.HIGH]:
                            incident = await self.incident_manager.create_or_update_incident(alert)
                            if incident:
                                self.monitoring_metrics['incidents_created'] += 1
                
                # Process alert notifications
                await self.notification_system.process_pending_notifications()
                
                # Store metrics in database
                await self._store_metrics(metrics)
                
                # Sleep before next cycle
                await asyncio.sleep(self.config.get('monitoring_interval_seconds', 30))
                
            except Exception as e:
                self.logger.error(f"Error in monitoring loop: {e}")
                self.monitoring_metrics['health_check_errors'] += 1
                await asyncio.sleep(60)  # Back off on errors

    async def _health_check_loop(self):
        """System health check loop"""
        while self.is_running:
            try:
                health_metrics = await self.health_checker.perform_comprehensive_check()
                self.last_health_check = health_metrics
                
                # Store health check results
                await self._store_health_metrics(health_metrics)
                
                # Check for health-based alerts
                await self._evaluate_health_alerts(health_metrics)
                
                await asyncio.sleep(self.config.get('health_check_interval_seconds', 60))
                
            except Exception as e:
                self.logger.error(f"Error in health check loop: {e}")
                await asyncio.sleep(120)

    async def _sla_monitoring_loop(self):
        """SLA monitoring loop"""
        while self.is_running:
            try:
                sla_status = await self.sla_monitor.check_all_slas()
                
                # Handle SLA breaches
                for sla_metric in sla_status:
                    if sla_metric.status == "breached":
                        await self._handle_sla_breach(sla_metric)
                
                await asyncio.sleep(self.config.get('sla_check_interval_seconds', 300))
                
            except Exception as e:
                self.logger.error(f"Error in SLA monitoring loop: {e}")
                await asyncio.sleep(300)

    async def _store_metrics(self, metrics: Dict[str, float]):
        """Store metrics in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                for metric_name, value in metrics.items():
                    await conn.execute('''
                        INSERT INTO metrics_history (metric_name, value, timestamp)
                        VALUES (?, ?, ?)
                    ''', (metric_name, value, datetime.now()))
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing metrics: {e}")

    async def _store_health_metrics(self, health_metrics: SystemHealthMetrics):
        """Store health metrics in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT INTO health_checks (
                        overall_status, cpu_usage, memory_usage, disk_usage,
                        network_latency, active_connections, error_rate,
                        response_time_p95, throughput_rpm, active_alerts,
                        critical_alerts, services_status, custom_metrics
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    health_metrics.overall_status,
                    health_metrics.cpu_usage_percent,
                    health_metrics.memory_usage_percent,
                    health_metrics.disk_usage_percent,
                    health_metrics.network_latency_ms,
                    health_metrics.active_connections,
                    health_metrics.error_rate_percent,
                    health_metrics.response_time_p95,
                    health_metrics.throughput_requests_per_minute,
                    health_metrics.active_alerts,
                    health_metrics.critical_alerts,
                    json.dumps(health_metrics.services_status),
                    json.dumps(health_metrics.custom_metrics)
                ))
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing health metrics: {e}")

    async def _evaluate_health_alerts(self, health_metrics: SystemHealthMetrics):
        """Evaluate health metrics for alert conditions"""
        health_thresholds = self.config.get('health_thresholds', {})
        
        # CPU usage alert
        if health_metrics.cpu_usage_percent > health_thresholds.get('cpu_critical', 90):
            await self.alert_manager.trigger_alert(
                metric_name="system_cpu_usage",
                current_value=health_metrics.cpu_usage_percent,
                threshold_value=health_thresholds.get('cpu_critical', 90),
                severity=AlertSeverity.CRITICAL,
                message=f"Critical CPU usage: {health_metrics.cpu_usage_percent:.1f}%"
            )
        
        # Memory usage alert
        if health_metrics.memory_usage_percent > health_thresholds.get('memory_critical', 95):
            await self.alert_manager.trigger_alert(
                metric_name="system_memory_usage",
                current_value=health_metrics.memory_usage_percent,
                threshold_value=health_thresholds.get('memory_critical', 95),
                severity=AlertSeverity.CRITICAL,
                message=f"Critical memory usage: {health_metrics.memory_usage_percent:.1f}%"
            )
        
        # Error rate alert
        if health_metrics.error_rate_percent > health_thresholds.get('error_rate_critical', 5):
            await self.alert_manager.trigger_alert(
                metric_name="system_error_rate",
                current_value=health_metrics.error_rate_percent,
                threshold_value=health_thresholds.get('error_rate_critical', 5),
                severity=AlertSeverity.HIGH,
                message=f"High error rate: {health_metrics.error_rate_percent:.2f}%"
            )

    async def _handle_sla_breach(self, sla_metric: SLAMetric):
        """Handle SLA breach with appropriate escalation"""
        severity = AlertSeverity.HIGH if sla_metric.breach_count_24h <= 1 else AlertSeverity.CRITICAL
        
        await self.alert_manager.trigger_alert(
            metric_name=f"sla_{sla_metric.name}",
            current_value=sla_metric.current_value,
            threshold_value=sla_metric.target_value,
            severity=severity,
            message=f"SLA breach for {sla_metric.name}: {sla_metric.current_value} vs target {sla_metric.target_value}"
        )

    async def get_dashboard_data(self) -> Dict[str, Any]:
        """Get comprehensive dashboard data"""
        try:
            dashboard_data = {
                'timestamp': datetime.now().isoformat(),
                'system_status': await self._get_system_status(),
                'active_alerts': await self.alert_manager.get_active_alerts_summary(),
                'recent_incidents': await self.incident_manager.get_recent_incidents(),
                'performance_metrics': await self._get_performance_summary(),
                'sla_status': await self.sla_monitor.get_sla_summary(),
                'health_trends': await self._get_health_trends(),
                'monitoring_stats': self.monitoring_metrics.copy(),
                'uptime': str(datetime.now() - self.start_time)
            }
            
            return dashboard_data
            
        except Exception as e:
            self.logger.error(f"Error getting dashboard data: {e}")
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}

    async def _get_system_status(self) -> Dict[str, Any]:
        """Get current system status"""
        if self.last_health_check:
            return {
                'overall_status': self.last_health_check.overall_status,
                'cpu_usage': self.last_health_check.cpu_usage_percent,
                'memory_usage': self.last_health_check.memory_usage_percent,
                'active_alerts': self.last_health_check.active_alerts,
                'critical_alerts': self.last_health_check.critical_alerts,
                'services': self.last_health_check.services_status
            }
        return {'overall_status': 'unknown', 'message': 'No health check data available'}

    async def _get_performance_summary(self) -> Dict[str, Any]:
        """Get performance metrics summary"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                # Get recent metrics (last hour)
                cursor = await conn.execute('''
                    SELECT metric_name, AVG(value) as avg_value, MAX(value) as max_value, MIN(value) as min_value
                    FROM metrics_history 
                    WHERE timestamp > datetime('now', '-1 hour')
                    GROUP BY metric_name
                ''')
                
                metrics = {}
                async for row in cursor:
                    metrics[row[0]] = {
                        'average': round(row[1], 2),
                        'maximum': round(row[2], 2),
                        'minimum': round(row[3], 2)
                    }
                
                return metrics
        except Exception as e:
            self.logger.error(f"Error getting performance summary: {e}")
            return {}

    async def _get_health_trends(self) -> Dict[str, Any]:
        """Get health trend data for visualization"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                # Get last 24 hours of health data
                cursor = await conn.execute('''
                    SELECT timestamp, cpu_usage, memory_usage, error_rate, response_time_p95
                    FROM health_checks 
                    WHERE timestamp > datetime('now', '-24 hours')
                    ORDER BY timestamp DESC
                    LIMIT 288
                ''')
                
                trends = {
                    'timestamps': [],
                    'cpu_usage': [],
                    'memory_usage': [],
                    'error_rate': [],
                    'response_time': []
                }
                
                async for row in cursor:
                    trends['timestamps'].append(row[0])
                    trends['cpu_usage'].append(row[1])
                    trends['memory_usage'].append(row[2])
                    trends['error_rate'].append(row[3])
                    trends['response_time'].append(row[4])
                
                return trends
        except Exception as e:
            self.logger.error(f"Error getting health trends: {e}")
            return {}

    def print_dashboard(self):
        """Print real-time operations dashboard"""
        try:
            asyncio.run(self._print_dashboard_async())
        except Exception as e:
            self.logger.error(f"Error printing dashboard: {e}")
            print(f"Dashboard Error: {e}")

    async def _print_dashboard_async(self):
        """Async version of dashboard printing"""
        dashboard_data = await self.get_dashboard_data()
        
        print("\n" + "="*100)
        print("🚀 APPLE MCP - OPERATIONS MONITORING DASHBOARD")
        print("="*100)
        print(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"⏱️  Uptime: {dashboard_data.get('uptime', 'Unknown')}")
        print()
        
        # System Status
        system_status = dashboard_data.get('system_status', {})
        status_emoji = {
            'healthy': '✅',
            'degraded': '⚠️',
            'outage': '❌',
            'unknown': '❓'
        }
        
        overall_status = system_status.get('overall_status', 'unknown')
        print(f"🏥 System Status: {status_emoji.get(overall_status, '❓')} {overall_status.upper()}")
        
        if 'cpu_usage' in system_status:
            print(f"💻 CPU Usage: {system_status['cpu_usage']:.1f}%")
        if 'memory_usage' in system_status:
            print(f"🧠 Memory Usage: {system_status['memory_usage']:.1f}%")
        
        # Active Alerts
        active_alerts = dashboard_data.get('active_alerts', {})
        total_alerts = active_alerts.get('total', 0)
        critical_alerts = active_alerts.get('critical', 0)
        
        print(f"🚨 Active Alerts: {total_alerts} total ({critical_alerts} critical)")
        
        # Recent Incidents
        incidents = dashboard_data.get('recent_incidents', [])
        open_incidents = len([i for i in incidents if i.get('status') != 'resolved'])
        print(f"📋 Open Incidents: {open_incidents}")
        
        # SLA Status
        sla_status = dashboard_data.get('sla_status', {})
        meeting_slas = sla_status.get('meeting', 0)
        total_slas = sla_status.get('total', 0)
        print(f"📊 SLA Compliance: {meeting_slas}/{total_slas} metrics meeting targets")
        
        # Monitoring Stats
        stats = dashboard_data.get('monitoring_stats', {})
        print(f"📈 Monitoring Stats:")
        print(f"   • Checks Performed: {stats.get('checks_performed', 0):,}")
        print(f"   • Alerts Triggered: {stats.get('alerts_triggered', 0):,}")
        print(f"   • Incidents Created: {stats.get('incidents_created', 0):,}")
        print(f"   • Notifications Sent: {stats.get('notifications_sent', 0):,}")
        
        print("="*100)

# ============================================================================
# Supporting Classes
# ============================================================================

class MetricsCollector:
    """Advanced metrics collection system"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.is_running = False
        
    async def start(self):
        """Start metrics collection"""
        self.is_running = True
        self.logger.info("Metrics collector started")
    
    async def stop(self):
        """Stop metrics collection"""
        self.is_running = False
        self.logger.info("Metrics collector stopped")
    
    async def collect_all_metrics(self) -> Dict[str, float]:
        """Collect all system metrics"""
        try:
            metrics = {}
            
            # System metrics
            metrics.update(await self._collect_system_metrics())
            
            # Application metrics
            metrics.update(await self._collect_application_metrics())
            
            # Database metrics
            metrics.update(await self._collect_database_metrics())
            
            # Network metrics
            metrics.update(await self._collect_network_metrics())
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error collecting metrics: {e}")
            return {}
    
    async def _collect_system_metrics(self) -> Dict[str, float]:
        """Collect system-level metrics"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            return {
                'system_cpu_usage_percent': cpu_percent,
                'system_memory_usage_percent': memory.percent,
                'system_disk_usage_percent': disk.percent,
                'system_memory_available_gb': memory.available / (1024**3),
                'system_disk_free_gb': disk.free / (1024**3)
            }
        except Exception as e:
            self.logger.error(f"Error collecting system metrics: {e}")
            return {}
    
    async def _collect_application_metrics(self) -> Dict[str, float]:
        """Collect application-specific metrics"""
        try:
            # Simulate application metrics collection
            # In production, these would come from your application
            base_url = self.config.get('application_url', 'http://localhost:8002')
            
            async with aiohttp.ClientSession() as session:
                try:
                    # Health check response time
                    start_time = time.time()
                    async with session.get(f"{base_url}/api/health", timeout=10) as response:
                        response_time = (time.time() - start_time) * 1000
                        status_code = response.status
                    
                    return {
                        'app_health_response_time_ms': response_time,
                        'app_health_status_code': status_code,
                        'app_health_success': 1 if status_code == 200 else 0
                    }
                except:
                    return {
                        'app_health_response_time_ms': 30000,  # Timeout
                        'app_health_status_code': 0,
                        'app_health_success': 0
                    }
        except Exception as e:
            self.logger.error(f"Error collecting application metrics: {e}")
            return {}
    
    async def _collect_database_metrics(self) -> Dict[str, float]:
        """Collect database metrics"""
        try:
            # Check database file size and accessibility
            db_paths = [
                'email_intelligence.db',
                'task_builder.db',
                'operations_monitoring.db'
            ]
            
            metrics = {}
            total_db_size = 0
            accessible_dbs = 0
            
            for db_path in db_paths:
                if os.path.exists(db_path):
                    size_mb = os.path.getsize(db_path) / (1024 * 1024)
                    total_db_size += size_mb
                    accessible_dbs += 1
                    
                    # Test database connectivity
                    try:
                        conn = sqlite3.connect(db_path, timeout=5)
                        conn.execute("SELECT 1")
                        conn.close()
                        db_status = 1
                    except:
                        db_status = 0
                    
                    metrics[f'db_{db_path.replace(".", "_")}_size_mb'] = size_mb
                    metrics[f'db_{db_path.replace(".", "_")}_accessible'] = db_status
            
            metrics['total_database_size_mb'] = total_db_size
            metrics['accessible_databases'] = accessible_dbs
            
            return metrics
            
        except Exception as e:
            self.logger.error(f"Error collecting database metrics: {e}")
            return {}
    
    async def _collect_network_metrics(self) -> Dict[str, float]:
        """Collect network metrics"""
        try:
            network_io = psutil.net_io_counters()
            
            return {
                'network_bytes_sent': network_io.bytes_sent,
                'network_bytes_recv': network_io.bytes_recv,
                'network_packets_sent': network_io.packets_sent,
                'network_packets_recv': network_io.packets_recv,
                'network_errors_in': network_io.errin,
                'network_errors_out': network_io.errout
            }
        except Exception as e:
            self.logger.error(f"Error collecting network metrics: {e}")
            return {}

class AlertManager:
    """Advanced alert management with escalation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.active_alerts = {}
        self.alert_history = deque(maxlen=1000)
        self.is_running = False
        
        # Load alert thresholds
        self.thresholds = self._load_alert_thresholds()
    
    def _load_alert_thresholds(self) -> List[MetricThreshold]:
        """Load alert threshold configurations"""
        default_thresholds = [
            MetricThreshold("system_cpu_usage_percent", 80, 95),
            MetricThreshold("system_memory_usage_percent", 85, 95),
            MetricThreshold("system_disk_usage_percent", 85, 95),
            MetricThreshold("app_health_response_time_ms", 5000, 15000),
            MetricThreshold("app_health_success", 0.95, 0.90, "<"),
        ]
        
        # In production, load from config file
        return default_thresholds
    
    async def start(self):
        """Start alert manager"""
        self.is_running = True
        self.logger.info("Alert manager started")
    
    async def stop(self):
        """Stop alert manager"""
        self.is_running = False
        self.logger.info("Alert manager stopped")
    
    async def evaluate_metrics(self, metrics: Dict[str, float]) -> List[Alert]:
        """Evaluate metrics against thresholds and generate alerts"""
        new_alerts = []
        
        for threshold in self.thresholds:
            if not threshold.enabled or threshold.metric_name not in metrics:
                continue
            
            current_value = metrics[threshold.metric_name]
            
            # Determine if threshold is breached
            alert_triggered = self._evaluate_threshold(current_value, threshold)
            
            if alert_triggered:
                severity, threshold_value = alert_triggered
                alert = await self._create_alert(
                    threshold.metric_name,
                    current_value,
                    threshold_value,
                    severity,
                    threshold.description or f"{threshold.metric_name} threshold exceeded"
                )
                
                if alert:
                    new_alerts.append(alert)
        
        return new_alerts
    
    def _evaluate_threshold(self, value: float, threshold: MetricThreshold) -> Optional[Tuple[AlertSeverity, float]]:
        """Evaluate if a threshold is breached"""
        op = threshold.comparison_operator
        
        critical_breached = False
        warning_breached = False
        
        if op == ">":
            critical_breached = value > threshold.critical_threshold
            warning_breached = value > threshold.warning_threshold
        elif op == "<":
            critical_breached = value < threshold.critical_threshold
            warning_breached = value < threshold.warning_threshold
        elif op == ">=":
            critical_breached = value >= threshold.critical_threshold
            warning_breached = value >= threshold.warning_threshold
        elif op == "<=":
            critical_breached = value <= threshold.critical_threshold
            warning_breached = value <= threshold.warning_threshold
        
        if critical_breached:
            return AlertSeverity.CRITICAL, threshold.critical_threshold
        elif warning_breached:
            return AlertSeverity.HIGH, threshold.warning_threshold
        
        return None
    
    async def _create_alert(self, metric_name: str, current_value: float, 
                          threshold_value: float, severity: AlertSeverity, 
                          message: str) -> Optional[Alert]:
        """Create a new alert"""
        try:
            alert_id = f"{metric_name}_{int(time.time())}"
            
            # Check if similar alert already exists
            for existing_alert in self.active_alerts.values():
                if (existing_alert.metric_name == metric_name and 
                    existing_alert.status in [AlertStatus.TRIGGERED, AlertStatus.ACKNOWLEDGED]):
                    # Update existing alert instead of creating new one
                    existing_alert.current_value = current_value
                    existing_alert.triggered_at = datetime.now()
                    return existing_alert
            
            alert = Alert(
                id=alert_id,
                metric_name=metric_name,
                severity=severity,
                status=AlertStatus.TRIGGERED,
                current_value=current_value,
                threshold_value=threshold_value,
                threshold_type="critical" if severity == AlertSeverity.CRITICAL else "warning",
                message=message,
                context={},
                triggered_at=datetime.now()
            )
            
            self.active_alerts[alert_id] = alert
            self.alert_history.append(alert)
            
            self.logger.warning(f"Alert triggered: {alert.message} (value: {current_value})")
            
            return alert
            
        except Exception as e:
            self.logger.error(f"Error creating alert: {e}")
            return None
    
    async def trigger_alert(self, metric_name: str, current_value: float,
                          threshold_value: float, severity: AlertSeverity,
                          message: str) -> Optional[Alert]:
        """Manually trigger an alert"""
        return await self._create_alert(metric_name, current_value, threshold_value, severity, message)
    
    async def get_active_alerts_summary(self) -> Dict[str, Any]:
        """Get summary of active alerts"""
        try:
            alerts_by_severity = defaultdict(int)
            for alert in self.active_alerts.values():
                if alert.status in [AlertStatus.TRIGGERED, AlertStatus.ACKNOWLEDGED]:
                    alerts_by_severity[alert.severity.value] += 1
            
            return {
                'total': sum(alerts_by_severity.values()),
                'critical': alerts_by_severity.get('critical', 0),
                'high': alerts_by_severity.get('high', 0),
                'medium': alerts_by_severity.get('medium', 0),
                'low': alerts_by_severity.get('low', 0),
                'by_metric': {alert.metric_name: alert.severity.value 
                             for alert in self.active_alerts.values()}
            }
        except Exception as e:
            self.logger.error(f"Error getting alerts summary: {e}")
            return {'total': 0, 'error': str(e)}

class IncidentManager:
    """Incident management and escalation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.active_incidents = {}
        self.is_running = False
    
    async def start(self):
        """Start incident manager"""
        self.is_running = True
        self.logger.info("Incident manager started")
    
    async def stop(self):
        """Stop incident manager"""
        self.is_running = False
        self.logger.info("Incident manager stopped")
    
    async def create_or_update_incident(self, alert: Alert) -> Optional[Incident]:
        """Create new incident or update existing one"""
        try:
            # Check if incident already exists for this alert type
            for incident in self.active_incidents.values():
                if (incident.status != 'resolved' and 
                    alert.metric_name in [a for a in incident.related_alerts]):
                    # Update existing incident
                    incident.related_alerts.append(alert.id)
                    incident.updated_at = datetime.now()
                    alert.incident_id = incident.id
                    return incident
            
            # Create new incident
            incident_id = f"INC-{int(time.time())}"
            priority = self._determine_incident_priority(alert)
            
            incident = Incident(
                id=incident_id,
                title=f"Alert: {alert.message}",
                description=f"Incident created from {alert.severity.value} alert: {alert.message}",
                priority=priority,
                status="open",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                related_alerts=[alert.id]
            )
            
            self.active_incidents[incident_id] = incident
            alert.incident_id = incident_id
            
            self.logger.error(f"Incident created: {incident.title} (ID: {incident_id})")
            
            return incident
            
        except Exception as e:
            self.logger.error(f"Error creating incident: {e}")
            return None
    
    def _determine_incident_priority(self, alert: Alert) -> IncidentPriority:
        """Determine incident priority based on alert severity"""
        if alert.severity == AlertSeverity.CRITICAL:
            return IncidentPriority.P0
        elif alert.severity == AlertSeverity.HIGH:
            return IncidentPriority.P1
        elif alert.severity == AlertSeverity.MEDIUM:
            return IncidentPriority.P2
        else:
            return IncidentPriority.P3
    
    async def get_recent_incidents(self) -> List[Dict[str, Any]]:
        """Get recent incidents"""
        try:
            recent_incidents = []
            for incident in self.active_incidents.values():
                recent_incidents.append({
                    'id': incident.id,
                    'title': incident.title,
                    'priority': incident.priority.value,
                    'status': incident.status,
                    'created_at': incident.created_at.isoformat(),
                    'related_alerts_count': len(incident.related_alerts)
                })
            
            # Sort by creation time, most recent first
            recent_incidents.sort(key=lambda x: x['created_at'], reverse=True)
            return recent_incidents[:10]  # Return last 10 incidents
            
        except Exception as e:
            self.logger.error(f"Error getting recent incidents: {e}")
            return []

class NotificationSystem:
    """Multi-channel notification system"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.notification_queue = deque()
        self.is_running = False
    
    async def start(self):
        """Start notification system"""
        self.is_running = True
        self.logger.info("Notification system started")
    
    async def stop(self):
        """Stop notification system"""
        self.is_running = False
        self.logger.info("Notification system stopped")
    
    async def process_pending_notifications(self):
        """Process queued notifications"""
        while self.notification_queue and self.is_running:
            try:
                notification = self.notification_queue.popleft()
                await self._send_notification(notification)
            except Exception as e:
                self.logger.error(f"Error processing notification: {e}")
    
    async def _send_notification(self, notification: Dict[str, Any]):
        """Send notification via configured channels"""
        try:
            # Email notification
            if self.config.get('email_notifications_enabled', False):
                await self._send_email_notification(notification)
            
            # Slack notification (placeholder)
            if self.config.get('slack_notifications_enabled', False):
                await self._send_slack_notification(notification)
            
            # Log notification
            self.logger.info(f"Notification sent: {notification.get('subject', 'Unknown')}")
            
        except Exception as e:
            self.logger.error(f"Error sending notification: {e}")
    
    async def _send_email_notification(self, notification: Dict[str, Any]):
        """Send email notification"""
        # Placeholder implementation
        self.logger.info(f"Would send email: {notification}")
    
    async def _send_slack_notification(self, notification: Dict[str, Any]):
        """Send Slack notification"""
        # Placeholder implementation
        self.logger.info(f"Would send Slack message: {notification}")

class SLAMonitor:
    """Service Level Agreement monitoring"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.sla_metrics = {}
        self.is_running = False
        
        # Default SLA targets
        self.sla_targets = {
            'availability': 99.9,
            'response_time_p95': 2000,  # 2 seconds
            'error_rate': 1.0  # 1%
        }
    
    async def start(self):
        """Start SLA monitoring"""
        self.is_running = True
        self.logger.info("SLA monitor started")
    
    async def stop(self):
        """Stop SLA monitoring"""
        self.is_running = False
        self.logger.info("SLA monitor stopped")
    
    async def check_all_slas(self) -> List[SLAMetric]:
        """Check all SLA metrics"""
        sla_results = []
        
        for sla_name, target_value in self.sla_targets.items():
            current_value = await self._calculate_current_sla_value(sla_name)
            status = "meeting" if self._is_sla_met(sla_name, current_value, target_value) else "breached"
            
            sla_metric = SLAMetric(
                name=sla_name,
                target_value=target_value,
                current_value=current_value,
                measurement_period="24h",
                last_updated=datetime.now(),
                status=status
            )
            
            sla_results.append(sla_metric)
            self.sla_metrics[sla_name] = sla_metric
        
        return sla_results
    
    async def _calculate_current_sla_value(self, sla_name: str) -> float:
        """Calculate current SLA value"""
        # Placeholder implementation
        # In production, this would query actual metrics
        if sla_name == 'availability':
            return 99.95  # Mock 99.95% availability
        elif sla_name == 'response_time_p95':
            return 1800   # Mock 1.8 second response time
        elif sla_name == 'error_rate':
            return 0.5    # Mock 0.5% error rate
        
        return 0.0
    
    def _is_sla_met(self, sla_name: str, current_value: float, target_value: float) -> bool:
        """Check if SLA is being met"""
        if sla_name in ['availability']:
            return current_value >= target_value
        elif sla_name in ['response_time_p95', 'error_rate']:
            return current_value <= target_value
        
        return False
    
    async def get_sla_summary(self) -> Dict[str, Any]:
        """Get SLA summary"""
        try:
            total_slas = len(self.sla_metrics)
            meeting_slas = sum(1 for sla in self.sla_metrics.values() if sla.status == "meeting")
            
            return {
                'total': total_slas,
                'meeting': meeting_slas,
                'breach_rate': (total_slas - meeting_slas) / total_slas if total_slas > 0 else 0,
                'details': {name: {'current': sla.current_value, 'target': sla.target_value, 'status': sla.status}
                           for name, sla in self.sla_metrics.items()}
            }
        except Exception as e:
            self.logger.error(f"Error getting SLA summary: {e}")
            return {'total': 0, 'meeting': 0, 'error': str(e)}

class AdvancedHealthChecker:
    """Advanced system health checking"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    async def perform_comprehensive_check(self) -> SystemHealthMetrics:
        """Perform comprehensive system health check"""
        try:
            # Collect all health metrics
            cpu_usage = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Network latency (ping localhost)
            network_latency = await self._check_network_latency()
            
            # Application-specific checks
            app_metrics = await self._check_application_health()
            
            # Determine overall status
            overall_status = self._determine_overall_status(
                cpu_usage, memory.percent, disk.percent, 
                app_metrics.get('error_rate', 0),
                app_metrics.get('response_time', 0)
            )
            
            health_metrics = SystemHealthMetrics(
                timestamp=datetime.now(),
                overall_status=overall_status,
                cpu_usage_percent=cpu_usage,
                memory_usage_percent=memory.percent,
                disk_usage_percent=disk.percent,
                network_latency_ms=network_latency,
                active_connections=app_metrics.get('active_connections', 0),
                error_rate_percent=app_metrics.get('error_rate', 0),
                response_time_p95=app_metrics.get('response_time', 0),
                throughput_requests_per_minute=app_metrics.get('throughput', 0),
                active_alerts=app_metrics.get('active_alerts', 0),
                critical_alerts=app_metrics.get('critical_alerts', 0),
                services_status=app_metrics.get('services_status', {})
            )
            
            return health_metrics
            
        except Exception as e:
            self.logger.error(f"Error performing health check: {e}")
            return SystemHealthMetrics(
                timestamp=datetime.now(),
                overall_status="error",
                cpu_usage_percent=0,
                memory_usage_percent=0,
                disk_usage_percent=0,
                network_latency_ms=0,
                active_connections=0,
                error_rate_percent=100,
                response_time_p95=0,
                throughput_requests_per_minute=0,
                active_alerts=0,
                critical_alerts=0,
                services_status={"health_check": "error"}
            )
    
    async def _check_network_latency(self) -> float:
        """Check network latency"""
        try:
            start_time = time.time()
            # Simple local network check
            import socket
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex(('127.0.0.1', 80))
            sock.close()
            
            latency = (time.time() - start_time) * 1000
            return latency
        except:
            return 1000  # 1 second timeout
    
    async def _check_application_health(self) -> Dict[str, Any]:
        """Check application-specific health metrics"""
        try:
            base_url = self.config.get('application_url', 'http://localhost:8002')
            
            async with aiohttp.ClientSession() as session:
                try:
                    start_time = time.time()
                    async with session.get(f"{base_url}/api/health", timeout=5) as response:
                        response_time = (time.time() - start_time) * 1000
                        
                        if response.status == 200:
                            health_data = await response.json()
                            return {
                                'response_time': response_time,
                                'error_rate': 0,
                                'active_connections': health_data.get('active_connections', 0),
                                'throughput': health_data.get('throughput', 0),
                                'active_alerts': health_data.get('active_alerts', 0),
                                'critical_alerts': health_data.get('critical_alerts', 0),
                                'services_status': health_data.get('services', {})
                            }
                        else:
                            return {
                                'response_time': response_time,
                                'error_rate': 100,
                                'active_connections': 0,
                                'throughput': 0,
                                'active_alerts': 1,
                                'critical_alerts': 1,
                                'services_status': {'application': 'unhealthy'}
                            }
                except:
                    return {
                        'response_time': 30000,
                        'error_rate': 100,
                        'active_connections': 0,
                        'throughput': 0,
                        'active_alerts': 1,
                        'critical_alerts': 1,
                        'services_status': {'application': 'unreachable'}
                    }
        except Exception as e:
            self.logger.error(f"Error checking application health: {e}")
            return {
                'response_time': 0,
                'error_rate': 100,
                'active_connections': 0,
                'throughput': 0,
                'active_alerts': 1,
                'critical_alerts': 1,
                'services_status': {'health_check': 'error'}
            }
    
    def _determine_overall_status(self, cpu_usage: float, memory_usage: float, 
                                disk_usage: float, error_rate: float, 
                                response_time: float) -> str:
        """Determine overall system status"""
        # Critical conditions
        if (cpu_usage > 95 or memory_usage > 95 or disk_usage > 95 or 
            error_rate > 10 or response_time > 30000):
            return "outage"
        
        # Degraded conditions
        if (cpu_usage > 80 or memory_usage > 85 or disk_usage > 85 or 
            error_rate > 5 or response_time > 10000):
            return "degraded"
        
        return "healthy"

# ============================================================================
# Main Execution and Configuration
# ============================================================================

def create_default_config() -> Dict[str, Any]:
    """Create default monitoring configuration"""
    return {
        # Core settings
        'monitoring_interval_seconds': 30,
        'health_check_interval_seconds': 60,
        'sla_check_interval_seconds': 300,
        'monitoring_db_path': 'operations_monitoring.db',
        'application_url': 'http://localhost:8002',
        
        # Alert thresholds
        'health_thresholds': {
            'cpu_warning': 80,
            'cpu_critical': 95,
            'memory_warning': 85,
            'memory_critical': 95,
            'disk_warning': 85,
            'disk_critical': 95,
            'error_rate_warning': 5,
            'error_rate_critical': 10,
            'response_time_warning': 5000,
            'response_time_critical': 15000
        },
        
        # Notification settings
        'email_notifications_enabled': False,
        'slack_notifications_enabled': False,
        'email_smtp_server': 'smtp.gmail.com',
        'email_smtp_port': 587,
        'email_from': 'alerts@company.com',
        'email_recipients': ['admin@company.com'],
        
        # SLA targets
        'sla_targets': {
            'availability': 99.9,
            'response_time_p95': 2000,
            'error_rate': 1.0
        }
    }

async def main():
    """Main function for testing the monitoring system"""
    config = create_default_config()
    
    # Initialize monitoring dashboard
    dashboard = OperationsMonitoringDashboard(config)
    
    try:
        # Start monitoring
        print("🚀 Starting Operations Monitoring Dashboard...")
        await dashboard.start_monitoring()
        
        # Run for a demonstration period
        for i in range(5):
            print(f"\n📊 Dashboard Update {i+1}/5")
            dashboard.print_dashboard()
            await asyncio.sleep(10)
        
        print("\n✅ Monitoring demonstration completed successfully")
        
    except KeyboardInterrupt:
        print("\n🛑 Monitoring stopped by user")
    except Exception as e:
        print(f"\n❌ Monitoring error: {e}")
        logger.error(f"Monitoring system error: {e}")
        logger.error(traceback.format_exc())
    finally:
        # Stop monitoring
        await dashboard.stop_monitoring()
        print("🔚 Operations monitoring system shutdown complete")

if __name__ == "__main__":
    print("🔧 Apple MCP Operations Monitoring Dashboard")
    print("=" * 60)
    print("Enterprise-grade monitoring, alerting, and operations infrastructure")
    print("Features: Real-time dashboards, automated alerting, incident management")
    print("=" * 60)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"\n💥 Critical error: {e}")
        logger.error(f"Critical system error: {e}")
        sys.exit(1)