#!/usr/bin/env python3
"""
SLA Monitoring and Performance Reporting System

Enterprise-grade SLA monitoring with comprehensive performance reporting.
Features:
- Real-time SLA monitoring and alerting
- Performance metrics aggregation and analysis
- Automated reporting and dashboards
- SLA breach detection and escalation
- Historical trend analysis and forecasting
- Business impact assessment
- Customer-facing status pages
"""

import asyncio
import time
import json
import logging
import hashlib
import sqlite3
import statistics
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Callable, Union
from dataclasses import dataclass, field, asdict
from enum import Enum, auto
from collections import defaultdict, deque
from pathlib import Path
import aiohttp
import aiosqlite
import psutil
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import matplotlib.pyplot as plt
import seaborn as sns

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(process)d:%(thread)d] - %(message)s',
    handlers=[
        logging.FileHandler('sla_performance.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# SLA Data Models
# ============================================================================

class SLAType(Enum):
    """Types of SLA metrics"""
    AVAILABILITY = "availability"
    RESPONSE_TIME = "response_time"
    THROUGHPUT = "throughput"
    ERROR_RATE = "error_rate"
    RECOVERY_TIME = "recovery_time"
    UPTIME = "uptime"

class SLAStatus(Enum):
    """SLA compliance status"""
    MEETING = "meeting"
    AT_RISK = "at_risk"
    BREACHED = "breached"
    UNKNOWN = "unknown"

class ReportingPeriod(Enum):
    """Reporting time periods"""
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"

class BusinessImpact(Enum):
    """Business impact levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"

@dataclass
class SLADefinition:
    """SLA definition and targets"""
    id: str
    name: str
    description: str
    sla_type: SLAType
    target_value: float
    target_unit: str
    measurement_window: str  # e.g., "24h", "30d"
    calculation_method: str  # e.g., "average", "percentile_95", "minimum"
    
    # Thresholds
    warning_threshold: float
    critical_threshold: float
    
    # Business context
    business_criticality: BusinessImpact
    customer_facing: bool = True
    service_component: str = ""
    
    # Reporting
    reporting_frequency: ReportingPeriod = ReportingPeriod.DAILY
    stakeholders: List[str] = field(default_factory=list)
    
    # Configuration
    enabled: bool = True
    auto_alerting: bool = True
    escalation_rules: Dict[str, Any] = field(default_factory=dict)
    
    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SLAMeasurement:
    """Individual SLA measurement"""
    id: str
    sla_definition_id: str
    measured_value: float
    measurement_time: datetime
    measurement_period_start: datetime
    measurement_period_end: datetime
    
    # Status
    status: SLAStatus
    meets_target: bool
    deviation_percentage: float
    
    # Context
    sample_count: int = 1
    raw_data: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class SLABreach:
    """SLA breach record"""
    id: str
    sla_definition_id: str
    breach_start: datetime
    breach_end: Optional[datetime] = None
    severity: str = "medium"
    
    # Breach details
    target_value: float
    actual_value: float
    breach_duration_minutes: Optional[float] = None
    breach_percentage: float = 0.0
    
    # Impact
    business_impact: BusinessImpact = BusinessImpact.MEDIUM
    customers_affected: int = 0
    revenue_impact_usd: float = 0.0
    
    # Response
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    acknowledged_by: Optional[str] = None
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolution_notes: str = ""
    
    # Analysis
    root_cause: Optional[str] = None
    contributing_factors: List[str] = field(default_factory=list)
    prevention_actions: List[str] = field(default_factory=list)

@dataclass
class PerformanceMetric:
    """Performance metric data point"""
    id: str
    metric_name: str
    metric_value: float
    metric_unit: str
    timestamp: datetime
    
    # Source information
    source_system: str = "apple_mcp"
    source_component: str = ""
    measurement_method: str = "automatic"
    
    # Context
    tags: Dict[str, str] = field(default_factory=dict)
    dimensions: Dict[str, Any] = field(default_factory=dict)
    
    # Quality
    confidence_score: float = 1.0
    anomaly_score: float = 0.0

@dataclass
class PerformanceReport:
    """Comprehensive performance report"""
    id: str
    report_type: str
    period_start: datetime
    period_end: datetime
    generated_at: datetime
    
    # SLA Summary
    sla_summary: Dict[str, Any] = field(default_factory=dict)
    sla_breaches: List[SLABreach] = field(default_factory=list)
    
    # Performance metrics
    performance_summary: Dict[str, Any] = field(default_factory=dict)
    key_metrics: Dict[str, float] = field(default_factory=dict)
    trends: Dict[str, Any] = field(default_factory=dict)
    
    # Analysis
    insights: List[str] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    business_impact: Dict[str, Any] = field(default_factory=dict)
    
    # Metadata
    report_format: str = "json"
    recipients: List[str] = field(default_factory=list)
    
    # File paths for generated artifacts
    report_files: Dict[str, str] = field(default_factory=dict)

# ============================================================================
# SLA Monitoring Engine
# ============================================================================

class SLAMonitoringEngine:
    """Enterprise-grade SLA monitoring and performance reporting system"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Core components
        self.metrics_collector = PerformanceMetricsCollector(config)
        self.sla_calculator = SLACalculator(config)
        self.breach_detector = BreachDetector(config)
        self.report_generator = ReportGenerator(config)
        self.alerting_system = SLAAlertingSystem(config)
        self.trend_analyzer = TrendAnalyzer(config)
        
        # State tracking
        self.active_slas = {}
        self.active_breaches = {}
        self.measurements_buffer = deque(maxlen=10000)
        self.is_running = False
        
        # Configuration
        self.sla_definitions = {}
        self.measurement_cache = {}
        
        # Database setup
        self.db_path = config.get('sla_db_path', 'sla_performance.db')
        self._setup_database()
        
        # Background tasks
        self.monitoring_task = None
        self.reporting_task = None
        self.analysis_task = None
    
    def _setup_database(self):
        """Initialize SLA monitoring database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # SLA definitions table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS sla_definitions (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        sla_type TEXT NOT NULL,
                        target_value REAL NOT NULL,
                        target_unit TEXT NOT NULL,
                        measurement_window TEXT NOT NULL,
                        calculation_method TEXT NOT NULL,
                        warning_threshold REAL,
                        critical_threshold REAL,
                        business_criticality TEXT,
                        customer_facing BOOLEAN DEFAULT TRUE,
                        service_component TEXT,
                        reporting_frequency TEXT,
                        stakeholders TEXT,
                        enabled BOOLEAN DEFAULT TRUE,
                        auto_alerting BOOLEAN DEFAULT TRUE,
                        escalation_rules TEXT,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        tags TEXT,
                        metadata TEXT
                    )
                ''')
                
                # SLA measurements table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS sla_measurements (
                        id TEXT PRIMARY KEY,
                        sla_definition_id TEXT NOT NULL,
                        measured_value REAL NOT NULL,
                        measurement_time DATETIME NOT NULL,
                        measurement_period_start DATETIME NOT NULL,
                        measurement_period_end DATETIME NOT NULL,
                        status TEXT NOT NULL,
                        meets_target BOOLEAN NOT NULL,
                        deviation_percentage REAL,
                        sample_count INTEGER DEFAULT 1,
                        raw_data TEXT,
                        metadata TEXT,
                        FOREIGN KEY (sla_definition_id) REFERENCES sla_definitions (id)
                    )
                ''')
                
                # SLA breaches table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS sla_breaches (
                        id TEXT PRIMARY KEY,
                        sla_definition_id TEXT NOT NULL,
                        breach_start DATETIME NOT NULL,
                        breach_end DATETIME,
                        severity TEXT,
                        target_value REAL NOT NULL,
                        actual_value REAL NOT NULL,
                        breach_duration_minutes REAL,
                        breach_percentage REAL,
                        business_impact TEXT,
                        customers_affected INTEGER DEFAULT 0,
                        revenue_impact_usd REAL DEFAULT 0.0,
                        acknowledged BOOLEAN DEFAULT FALSE,
                        acknowledged_at DATETIME,
                        acknowledged_by TEXT,
                        resolved BOOLEAN DEFAULT FALSE,
                        resolved_at DATETIME,
                        resolution_notes TEXT,
                        root_cause TEXT,
                        contributing_factors TEXT,
                        prevention_actions TEXT,
                        FOREIGN KEY (sla_definition_id) REFERENCES sla_definitions (id)
                    )
                ''')
                
                # Performance metrics table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS performance_metrics (
                        id TEXT PRIMARY KEY,
                        metric_name TEXT NOT NULL,
                        metric_value REAL NOT NULL,
                        metric_unit TEXT NOT NULL,
                        timestamp DATETIME NOT NULL,
                        source_system TEXT,
                        source_component TEXT,
                        measurement_method TEXT,
                        tags TEXT,
                        dimensions TEXT,
                        confidence_score REAL DEFAULT 1.0,
                        anomaly_score REAL DEFAULT 0.0
                    )
                ''')
                
                # Performance reports table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS performance_reports (
                        id TEXT PRIMARY KEY,
                        report_type TEXT NOT NULL,
                        period_start DATETIME NOT NULL,
                        period_end DATETIME NOT NULL,
                        generated_at DATETIME NOT NULL,
                        sla_summary TEXT,
                        performance_summary TEXT,
                        key_metrics TEXT,
                        trends TEXT,
                        insights TEXT,
                        recommendations TEXT,
                        business_impact TEXT,
                        report_format TEXT DEFAULT 'json',
                        recipients TEXT,
                        report_files TEXT
                    )
                ''')
                
                # Create indexes for performance
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_sla_measurements_time ON sla_measurements(measurement_time)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_sla_measurements_sla ON sla_measurements(sla_definition_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_sla_breaches_start ON sla_breaches(breach_start)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_sla_breaches_sla ON sla_breaches(sla_definition_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_performance_reports_period ON performance_reports(period_start, period_end)')
                
                conn.commit()
                self.logger.info("SLA monitoring database initialized successfully")
                
        except Exception as e:
            self.logger.error(f"Failed to setup SLA database: {e}")
            raise
    
    async def start_monitoring(self):
        """Start SLA monitoring system"""
        if self.is_running:
            return
        
        self.is_running = True
        
        try:
            # Start core components
            await self.metrics_collector.start()
            await self.sla_calculator.start()
            await self.breach_detector.start()
            await self.report_generator.start()
            await self.alerting_system.start()
            await self.trend_analyzer.start()
            
            # Load SLA definitions
            await self._load_default_slas()
            
            # Start background tasks
            self.monitoring_task = asyncio.create_task(self._sla_monitoring_loop())
            self.reporting_task = asyncio.create_task(self._reporting_loop())
            self.analysis_task = asyncio.create_task(self._analysis_loop())
            
            self.logger.info("SLA monitoring system started successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to start SLA monitoring: {e}")
            self.is_running = False
            raise
    
    async def stop_monitoring(self):
        """Stop SLA monitoring system"""
        self.is_running = False
        
        # Cancel background tasks
        for task in [self.monitoring_task, self.reporting_task, self.analysis_task]:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # Stop core components
        try:
            await self.trend_analyzer.stop()
            await self.alerting_system.stop()
            await self.report_generator.stop()
            await self.breach_detector.stop()
            await self.sla_calculator.stop()
            await self.metrics_collector.stop()
        except Exception as e:
            self.logger.error(f"Error stopping SLA monitoring components: {e}")
        
        self.logger.info("SLA monitoring system stopped")
    
    async def _load_default_slas(self):
        """Load default SLA definitions"""
        try:
            # API Response Time SLA
            api_response_sla = SLADefinition(
                id="api_response_time",
                name="API Response Time",
                description="95th percentile API response time should be under 2 seconds",
                sla_type=SLAType.RESPONSE_TIME,
                target_value=2000.0,
                target_unit="milliseconds",
                measurement_window="24h",
                calculation_method="percentile_95",
                warning_threshold=1800.0,
                critical_threshold=2500.0,
                business_criticality=BusinessImpact.HIGH,
                customer_facing=True,
                service_component="api_server",
                reporting_frequency=ReportingPeriod.DAILY,
                stakeholders=["ops-team@company.com", "product-team@company.com"]
            )
            
            # System Availability SLA
            availability_sla = SLADefinition(
                id="system_availability",
                name="System Availability",
                description="System uptime should be 99.9% or higher",
                sla_type=SLAType.AVAILABILITY,
                target_value=99.9,
                target_unit="percentage",
                measurement_window="30d",
                calculation_method="average",
                warning_threshold=99.5,
                critical_threshold=99.0,
                business_criticality=BusinessImpact.CRITICAL,
                customer_facing=True,
                service_component="entire_system",
                reporting_frequency=ReportingPeriod.DAILY,
                stakeholders=["ops-team@company.com", "executive-team@company.com"]
            )
            
            # Error Rate SLA
            error_rate_sla = SLADefinition(
                id="error_rate",
                name="Error Rate",
                description="API error rate should be below 1%",
                sla_type=SLAType.ERROR_RATE,
                target_value=1.0,
                target_unit="percentage",
                measurement_window="24h",
                calculation_method="average",
                warning_threshold=0.8,
                critical_threshold=2.0,
                business_criticality=BusinessImpact.HIGH,
                customer_facing=True,
                service_component="api_server",
                reporting_frequency=ReportingPeriod.DAILY,
                stakeholders=["ops-team@company.com", "dev-team@company.com"]
            )
            
            # Throughput SLA
            throughput_sla = SLADefinition(
                id="api_throughput",
                name="API Throughput",
                description="System should handle at least 100 requests per minute",
                sla_type=SLAType.THROUGHPUT,
                target_value=100.0,
                target_unit="requests_per_minute",
                measurement_window="1h",
                calculation_method="minimum",
                warning_threshold=80.0,
                critical_threshold=50.0,
                business_criticality=BusinessImpact.MEDIUM,
                customer_facing=True,
                service_component="api_server",
                reporting_frequency=ReportingPeriod.DAILY,
                stakeholders=["ops-team@company.com"]
            )
            
            # Store SLA definitions
            for sla in [api_response_sla, availability_sla, error_rate_sla, throughput_sla]:
                await self._store_sla_definition(sla)
                self.sla_definitions[sla.id] = sla
            
            self.logger.info(f"Loaded {len(self.sla_definitions)} default SLA definitions")
            
        except Exception as e:
            self.logger.error(f"Error loading default SLAs: {e}")
    
    async def _sla_monitoring_loop(self):
        """Main SLA monitoring loop"""
        while self.is_running:
            try:
                # Collect performance metrics
                metrics = await self.metrics_collector.collect_all_metrics()
                
                # Calculate SLA measurements for each definition
                for sla_id, sla_def in self.sla_definitions.items():
                    if sla_def.enabled:
                        measurement = await self.sla_calculator.calculate_sla_measurement(sla_def, metrics)
                        
                        if measurement:
                            # Store measurement
                            await self._store_sla_measurement(measurement)
                            
                            # Check for breaches
                            if measurement.status in [SLAStatus.BREACHED, SLAStatus.AT_RISK]:
                                await self._handle_sla_issue(sla_def, measurement)
                
                # Sleep before next monitoring cycle
                await asyncio.sleep(self.config.get('monitoring_interval_seconds', 60))
                
            except Exception as e:
                self.logger.error(f"Error in SLA monitoring loop: {e}")
                await asyncio.sleep(300)
    
    async def _reporting_loop(self):
        """Background reporting loop"""
        while self.is_running:
            try:
                # Generate daily reports
                if datetime.now().hour == 8 and datetime.now().minute < 5:  # 8 AM daily
                    await self._generate_daily_report()
                
                # Generate weekly reports on Mondays
                if datetime.now().weekday() == 0 and datetime.now().hour == 9:  # Monday 9 AM
                    await self._generate_weekly_report()
                
                # Generate monthly reports on the 1st
                if datetime.now().day == 1 and datetime.now().hour == 10:  # 1st of month 10 AM
                    await self._generate_monthly_report()
                
                await asyncio.sleep(300)  # Check every 5 minutes
                
            except Exception as e:
                self.logger.error(f"Error in reporting loop: {e}")
                await asyncio.sleep(1800)
    
    async def _analysis_loop(self):
        """Background analysis loop"""
        while self.is_running:
            try:
                # Perform trend analysis
                await self.trend_analyzer.analyze_trends()
                
                # Update SLA forecasts
                await self._update_sla_forecasts()
                
                # Check for anomalies
                await self._detect_performance_anomalies()
                
                await asyncio.sleep(3600)  # Run every hour
                
            except Exception as e:
                self.logger.error(f"Error in analysis loop: {e}")
                await asyncio.sleep(3600)
    
    async def _handle_sla_issue(self, sla_def: SLADefinition, measurement: SLAMeasurement):
        """Handle SLA breach or at-risk condition"""
        try:
            if measurement.status == SLAStatus.BREACHED:
                # Create breach record
                breach = SLABreach(
                    id=f"breach_{int(time.time())}_{sla_def.id}",
                    sla_definition_id=sla_def.id,
                    breach_start=measurement.measurement_time,
                    severity="high" if sla_def.business_criticality in [BusinessImpact.CRITICAL, BusinessImpact.HIGH] else "medium",
                    target_value=sla_def.target_value,
                    actual_value=measurement.measured_value,
                    breach_percentage=abs(measurement.deviation_percentage),
                    business_impact=sla_def.business_criticality
                )
                
                # Store breach
                await self._store_sla_breach(breach)
                self.active_breaches[breach.id] = breach
                
                # Send alert
                if sla_def.auto_alerting:
                    await self.alerting_system.send_breach_alert(sla_def, breach)
                
                self.logger.warning(f"SLA breach detected: {sla_def.name} - {measurement.measured_value} vs target {sla_def.target_value}")
            
            elif measurement.status == SLAStatus.AT_RISK:
                # Send warning alert
                if sla_def.auto_alerting:
                    await self.alerting_system.send_warning_alert(sla_def, measurement)
                
                self.logger.warning(f"SLA at risk: {sla_def.name} - {measurement.measured_value} vs target {sla_def.target_value}")
                
        except Exception as e:
            self.logger.error(f"Error handling SLA issue: {e}")
    
    async def _generate_daily_report(self):
        """Generate daily SLA report"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(days=1)
            
            report = await self.report_generator.generate_report(
                "daily_sla_report",
                start_time,
                end_time
            )
            
            # Send report to stakeholders
            await self._distribute_report(report)
            
            self.logger.info(f"Daily SLA report generated: {report.id}")
            
        except Exception as e:
            self.logger.error(f"Error generating daily report: {e}")
    
    async def _generate_weekly_report(self):
        """Generate weekly SLA report"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(weeks=1)
            
            report = await self.report_generator.generate_report(
                "weekly_sla_report",
                start_time,
                end_time
            )
            
            await self._distribute_report(report)
            
            self.logger.info(f"Weekly SLA report generated: {report.id}")
            
        except Exception as e:
            self.logger.error(f"Error generating weekly report: {e}")
    
    async def _generate_monthly_report(self):
        """Generate monthly SLA report"""
        try:
            end_time = datetime.now()
            start_time = end_time - timedelta(days=30)
            
            report = await self.report_generator.generate_report(
                "monthly_sla_report",
                start_time,
                end_time
            )
            
            await self._distribute_report(report)
            
            self.logger.info(f"Monthly SLA report generated: {report.id}")
            
        except Exception as e:
            self.logger.error(f"Error generating monthly report: {e}")
    
    async def _distribute_report(self, report: PerformanceReport):
        """Distribute report to stakeholders"""
        try:
            # Email report to stakeholders
            for recipient in report.recipients:
                await self._send_report_email(recipient, report)
            
            # Store report in database
            await self._store_performance_report(report)
            
        except Exception as e:
            self.logger.error(f"Error distributing report: {e}")
    
    async def _send_report_email(self, recipient: str, report: PerformanceReport):
        """Send report via email"""
        try:
            # Placeholder implementation
            self.logger.info(f"Sending SLA report to {recipient}: {report.id}")
            
        except Exception as e:
            self.logger.error(f"Error sending report email: {e}")
    
    async def _update_sla_forecasts(self):
        """Update SLA forecasts based on trends"""
        # Placeholder implementation
        pass
    
    async def _detect_performance_anomalies(self):
        """Detect performance anomalies"""
        # Placeholder implementation
        pass
    
    async def _store_sla_definition(self, sla_def: SLADefinition):
        """Store SLA definition in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT OR REPLACE INTO sla_definitions (
                        id, name, description, sla_type, target_value, target_unit,
                        measurement_window, calculation_method, warning_threshold,
                        critical_threshold, business_criticality, customer_facing,
                        service_component, reporting_frequency, stakeholders,
                        enabled, auto_alerting, escalation_rules, created_at,
                        updated_at, tags, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    sla_def.id, sla_def.name, sla_def.description,
                    sla_def.sla_type.value, sla_def.target_value, sla_def.target_unit,
                    sla_def.measurement_window, sla_def.calculation_method,
                    sla_def.warning_threshold, sla_def.critical_threshold,
                    sla_def.business_criticality.value, sla_def.customer_facing,
                    sla_def.service_component, sla_def.reporting_frequency.value,
                    json.dumps(sla_def.stakeholders), sla_def.enabled,
                    sla_def.auto_alerting, json.dumps(sla_def.escalation_rules),
                    sla_def.created_at, sla_def.updated_at,
                    json.dumps(sla_def.tags), json.dumps(sla_def.metadata)
                ))
                
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing SLA definition: {e}")
    
    async def _store_sla_measurement(self, measurement: SLAMeasurement):
        """Store SLA measurement in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT INTO sla_measurements (
                        id, sla_definition_id, measured_value, measurement_time,
                        measurement_period_start, measurement_period_end,
                        status, meets_target, deviation_percentage,
                        sample_count, raw_data, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    measurement.id, measurement.sla_definition_id,
                    measurement.measured_value, measurement.measurement_time,
                    measurement.measurement_period_start, measurement.measurement_period_end,
                    measurement.status.value, measurement.meets_target,
                    measurement.deviation_percentage, measurement.sample_count,
                    json.dumps(measurement.raw_data), json.dumps(measurement.metadata)
                ))
                
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing SLA measurement: {e}")
    
    async def _store_sla_breach(self, breach: SLABreach):
        """Store SLA breach in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT INTO sla_breaches (
                        id, sla_definition_id, breach_start, breach_end,
                        severity, target_value, actual_value,
                        breach_duration_minutes, breach_percentage,
                        business_impact, customers_affected, revenue_impact_usd,
                        acknowledged, acknowledged_at, acknowledged_by,
                        resolved, resolved_at, resolution_notes,
                        root_cause, contributing_factors, prevention_actions
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    breach.id, breach.sla_definition_id, breach.breach_start,
                    breach.breach_end, breach.severity, breach.target_value,
                    breach.actual_value, breach.breach_duration_minutes,
                    breach.breach_percentage, breach.business_impact.value,
                    breach.customers_affected, breach.revenue_impact_usd,
                    breach.acknowledged, breach.acknowledged_at,
                    breach.acknowledged_by, breach.resolved, breach.resolved_at,
                    breach.resolution_notes, breach.root_cause,
                    json.dumps(breach.contributing_factors),
                    json.dumps(breach.prevention_actions)
                ))
                
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing SLA breach: {e}")
    
    async def _store_performance_metric(self, metric: PerformanceMetric):
        """Store performance metric in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT INTO performance_metrics (
                        id, metric_name, metric_value, metric_unit, timestamp,
                        source_system, source_component, measurement_method,
                        tags, dimensions, confidence_score, anomaly_score
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    metric.id, metric.metric_name, metric.metric_value,
                    metric.metric_unit, metric.timestamp, metric.source_system,
                    metric.source_component, metric.measurement_method,
                    json.dumps(metric.tags), json.dumps(metric.dimensions),
                    metric.confidence_score, metric.anomaly_score
                ))
                
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing performance metric: {e}")
    
    async def _store_performance_report(self, report: PerformanceReport):
        """Store performance report in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT INTO performance_reports (
                        id, report_type, period_start, period_end, generated_at,
                        sla_summary, performance_summary, key_metrics, trends,
                        insights, recommendations, business_impact,
                        report_format, recipients, report_files
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    report.id, report.report_type, report.period_start,
                    report.period_end, report.generated_at,
                    json.dumps(report.sla_summary),
                    json.dumps(report.performance_summary),
                    json.dumps(report.key_metrics), json.dumps(report.trends),
                    json.dumps(report.insights), json.dumps(report.recommendations),
                    json.dumps(report.business_impact), report.report_format,
                    json.dumps(report.recipients), json.dumps(report.report_files)
                ))
                
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing performance report: {e}")
    
    async def get_sla_dashboard_data(self) -> Dict[str, Any]:
        """Get SLA dashboard data"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                # Current SLA status
                cursor = await conn.execute('''
                    SELECT s.id, s.name, s.target_value, s.target_unit,
                           m.measured_value, m.status, m.measurement_time
                    FROM sla_definitions s
                    LEFT JOIN sla_measurements m ON s.id = m.sla_definition_id
                    WHERE s.enabled = 1
                    AND (m.measurement_time IS NULL OR m.measurement_time = (
                        SELECT MAX(measurement_time) 
                        FROM sla_measurements 
                        WHERE sla_definition_id = s.id
                    ))
                    ORDER BY s.business_criticality DESC
                ''')
                
                current_slas = []
                async for row in cursor:
                    current_slas.append({
                        'id': row[0],
                        'name': row[1],
                        'target_value': row[2],
                        'target_unit': row[3],
                        'current_value': row[4],
                        'status': row[5] if row[5] else 'unknown',
                        'last_measurement': row[6]
                    })
                
                # Active breaches
                cursor = await conn.execute('''
                    SELECT b.id, s.name, b.breach_start, b.severity,
                           b.target_value, b.actual_value, b.business_impact
                    FROM sla_breaches b
                    JOIN sla_definitions s ON b.sla_definition_id = s.id
                    WHERE b.resolved = 0
                    ORDER BY b.breach_start DESC
                ''')
                
                active_breaches = []
                async for row in cursor:
                    active_breaches.append({
                        'id': row[0],
                        'sla_name': row[1],
                        'breach_start': row[2],
                        'severity': row[3],
                        'target_value': row[4],
                        'actual_value': row[5],
                        'business_impact': row[6]
                    })
                
                # SLA compliance summary (last 30 days)
                cursor = await conn.execute('''
                    SELECT s.id, s.name,
                           COUNT(m.id) as total_measurements,
                           SUM(CASE WHEN m.meets_target = 1 THEN 1 ELSE 0 END) as successful_measurements,
                           AVG(CASE WHEN m.meets_target = 1 THEN 100.0 ELSE 0.0 END) as compliance_percentage
                    FROM sla_definitions s
                    LEFT JOIN sla_measurements m ON s.id = m.sla_definition_id
                        AND m.measurement_time > datetime('now', '-30 days')
                    WHERE s.enabled = 1
                    GROUP BY s.id, s.name
                ''')
                
                compliance_summary = []
                async for row in cursor:
                    compliance_summary.append({
                        'sla_id': row[0],
                        'sla_name': row[1],
                        'total_measurements': row[2],
                        'successful_measurements': row[3],
                        'compliance_percentage': row[4] if row[4] else 0
                    })
                
                # Recent trends (last 7 days)
                cursor = await conn.execute('''
                    SELECT DATE(measurement_time) as date,
                           AVG(CASE WHEN meets_target = 1 THEN 100.0 ELSE 0.0 END) as daily_compliance
                    FROM sla_measurements
                    WHERE measurement_time > datetime('now', '-7 days')
                    GROUP BY DATE(measurement_time)
                    ORDER BY date
                ''')
                
                trend_data = []
                async for row in cursor:
                    trend_data.append({
                        'date': row[0],
                        'compliance_percentage': row[1] if row[1] else 0
                    })
                
                dashboard_data = {
                    'timestamp': datetime.now().isoformat(),
                    'current_slas': current_slas,
                    'active_breaches': active_breaches,
                    'compliance_summary': compliance_summary,
                    'trend_data': trend_data,
                    'monitoring_status': 'running' if self.is_running else 'stopped',
                    'total_slas': len(self.sla_definitions),
                    'total_active_breaches': len(self.active_breaches)
                }
                
                return dashboard_data
                
        except Exception as e:
            self.logger.error(f"Error getting SLA dashboard data: {e}")
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}
    
    def print_sla_dashboard(self):
        """Print SLA monitoring dashboard"""
        try:
            asyncio.run(self._print_sla_dashboard_async())
        except Exception as e:
            self.logger.error(f"Error printing SLA dashboard: {e}")
            print(f"SLA Dashboard Error: {e}")
    
    async def _print_sla_dashboard_async(self):
        """Async version of SLA dashboard printing"""
        dashboard_data = await self.get_sla_dashboard_data()
        
        print("\n" + "="*80)
        print("📊 APPLE MCP - SLA MONITORING & PERFORMANCE DASHBOARD")
        print("="*80)
        print(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"⚡ Monitoring Status: {'🟢 RUNNING' if self.is_running else '🔴 STOPPED'}")
        print(f"📈 Total SLAs: {dashboard_data.get('total_slas', 0)}")
        print(f"🚨 Active Breaches: {dashboard_data.get('total_active_breaches', 0)}")
        print()
        
        # Current SLA status
        current_slas = dashboard_data.get('current_slas', [])
        if current_slas:
            print("📊 Current SLA Status:")
            for sla in current_slas:
                status_emoji = {
                    'meeting': '✅',
                    'at_risk': '⚠️',
                    'breached': '❌',
                    'unknown': '❓'
                }.get(sla['status'], '❓')
                
                current_val = sla['current_value'] if sla['current_value'] is not None else 'N/A'
                print(f"   {status_emoji} {sla['name']}: {current_val} (target: {sla['target_value']} {sla['target_unit']})")
        else:
            print("📊 No SLA data available")
        
        # Active breaches
        breaches = dashboard_data.get('active_breaches', [])
        if breaches:
            print(f"\n🚨 Active SLA Breaches:")
            for breach in breaches:
                severity_emoji = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🔵'}.get(breach['severity'], '⚪')
                print(f"   {severity_emoji} {breach['sla_name']}: {breach['actual_value']} vs {breach['target_value']}")
        else:
            print("\n✅ No active SLA breaches")
        
        # Compliance summary
        compliance = dashboard_data.get('compliance_summary', [])
        if compliance:
            print(f"\n📈 SLA Compliance (30 days):")
            for comp in compliance:
                compliance_pct = comp['compliance_percentage']
                if compliance_pct >= 99:
                    emoji = '✅'
                elif compliance_pct >= 95:
                    emoji = '⚠️'
                else:
                    emoji = '❌'
                print(f"   {emoji} {comp['sla_name']}: {compliance_pct:.1f}%")
        
        # Trend data
        trends = dashboard_data.get('trend_data', [])
        if trends:
            avg_compliance = statistics.mean([t['compliance_percentage'] for t in trends])
            print(f"\n📊 7-Day Average Compliance: {avg_compliance:.1f}%")
        
        print("="*80)

# ============================================================================
# Supporting Classes (Placeholder Implementations)
# ============================================================================

class PerformanceMetricsCollector:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass
    async def collect_all_metrics(self): 
        # Simulate collecting metrics
        return {
            'api_response_time_p95': 1800.0,  # ms
            'availability_percentage': 99.95,
            'error_rate_percentage': 0.5,
            'throughput_rpm': 120.0
        }

class SLACalculator:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass
    async def calculate_sla_measurement(self, sla_def, metrics):
        # Simulate SLA calculation
        if sla_def.id == "api_response_time":
            value = metrics.get('api_response_time_p95', 0)
        elif sla_def.id == "system_availability":
            value = metrics.get('availability_percentage', 0)
        elif sla_def.id == "error_rate":
            value = metrics.get('error_rate_percentage', 0)
        elif sla_def.id == "api_throughput":
            value = metrics.get('throughput_rpm', 0)
        else:
            return None
        
        meets_target = self._meets_target(sla_def, value)
        status = self._calculate_status(sla_def, value, meets_target)
        deviation = self._calculate_deviation(sla_def, value)
        
        return SLAMeasurement(
            id=f"measurement_{int(time.time())}_{sla_def.id}",
            sla_definition_id=sla_def.id,
            measured_value=value,
            measurement_time=datetime.now(),
            measurement_period_start=datetime.now() - timedelta(hours=1),
            measurement_period_end=datetime.now(),
            status=status,
            meets_target=meets_target,
            deviation_percentage=deviation
        )
    
    def _meets_target(self, sla_def, value):
        if sla_def.sla_type in [SLAType.RESPONSE_TIME, SLAType.ERROR_RATE]:
            return value <= sla_def.target_value
        else:
            return value >= sla_def.target_value
    
    def _calculate_status(self, sla_def, value, meets_target):
        if meets_target:
            return SLAStatus.MEETING
        elif value <= sla_def.critical_threshold:
            return SLAStatus.BREACHED
        elif value <= sla_def.warning_threshold:
            return SLAStatus.AT_RISK
        else:
            return SLAStatus.BREACHED
    
    def _calculate_deviation(self, sla_def, value):
        return ((value - sla_def.target_value) / sla_def.target_value) * 100

class BreachDetector:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass

class ReportGenerator:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass
    async def generate_report(self, report_type, start_time, end_time):
        return PerformanceReport(
            id=f"report_{int(time.time())}",
            report_type=report_type,
            period_start=start_time,
            period_end=end_time,
            generated_at=datetime.now(),
            recipients=["ops-team@company.com"]
        )

class SLAAlertingSystem:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass
    async def send_breach_alert(self, sla_def, breach): 
        pass
    async def send_warning_alert(self, sla_def, measurement): 
        pass

class TrendAnalyzer:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass
    async def analyze_trends(self): 
        pass

# ============================================================================
# Main Execution
# ============================================================================

def create_default_sla_config() -> Dict[str, Any]:
    """Create default SLA monitoring configuration"""
    return {
        'sla_db_path': 'sla_performance.db',
        'monitoring_interval_seconds': 60,
        'reporting_enabled': True,
        'alerting_enabled': True,
        'trend_analysis_enabled': True,
        'notification_settings': {
            'email_enabled': True,
            'slack_enabled': False,
            'webhook_enabled': False
        },
        'retention_days': 90,
        'report_storage_path': './reports'
    }

async def test_sla_monitoring():
    """Test the SLA monitoring system"""
    config = create_default_sla_config()
    
    # Initialize SLA monitoring engine
    engine = SLAMonitoringEngine(config)
    
    try:
        # Start monitoring
        print("📊 Starting SLA Monitoring System...")
        await engine.start_monitoring()
        
        # Let it run for a bit to collect data
        print("\n📈 Collecting SLA metrics...")
        await asyncio.sleep(10)
        
        # Print dashboard
        print("\n📊 SLA Monitoring Dashboard:")
        engine.print_sla_dashboard()
        
        print("\n✅ SLA monitoring test completed successfully")
        
    except KeyboardInterrupt:
        print("\n🛑 SLA monitoring test stopped by user")
    except Exception as e:
        print(f"\n❌ SLA monitoring test error: {e}")
        logger.error(f"Test error: {e}")
    finally:
        # Stop monitoring
        await engine.stop_monitoring()
        print("🔚 SLA monitoring system shutdown complete")

async def main():
    """Main function for testing SLA monitoring"""
    print("📊 Apple MCP SLA Monitoring & Performance Reporting")
    print("=" * 60)
    print("Enterprise-grade SLA monitoring with comprehensive reporting")
    print("Features: Real-time monitoring, breach detection, trend analysis")
    print("=" * 60)
    
    await test_sla_monitoring()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"\n💥 Critical error: {e}")
        logger.error(f"Critical system error: {e}")
        sys.exit(1)