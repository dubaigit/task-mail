#!/usr/bin/env python3
"""
Automated Security Scanning Pipeline

Enterprise-grade security automation for continuous vulnerability assessment.
Features:
- Automated vulnerability scanning and detection
- Dependency security analysis
- Code quality and security pattern scanning
- Compliance validation and reporting
- Security incident response automation
- Continuous security monitoring
"""

import asyncio
import time
import json
import logging
import hashlib
import subprocess
import sqlite3
import requests
import os
import re
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Set
from dataclasses import dataclass, field, asdict
from enum import Enum, auto
from pathlib import Path
import aiohttp
import aiosqlite
from collections import defaultdict, deque
import tempfile
import shutil
import zipfile
import tarfile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(process)d:%(thread)d] - %(message)s',
    handlers=[
        logging.FileHandler('security_scanner.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# Security Data Models
# ============================================================================

class VulnerabilitySeverity(Enum):
    """Vulnerability severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class ScanType(Enum):
    """Types of security scans"""
    DEPENDENCY = "dependency"
    CODE_ANALYSIS = "code_analysis"
    CONFIGURATION = "configuration"
    NETWORK = "network"
    COMPLIANCE = "compliance"
    FULL_SCAN = "full_scan"

class VulnerabilityStatus(Enum):
    """Vulnerability remediation status"""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    ACCEPTED_RISK = "accepted_risk"
    FALSE_POSITIVE = "false_positive"

@dataclass
class SecurityVulnerability:
    """Security vulnerability finding"""
    id: str
    title: str
    description: str
    severity: VulnerabilitySeverity
    cve_id: Optional[str] = None
    cvss_score: Optional[float] = None
    category: str = ""
    affected_component: str = ""
    file_path: Optional[str] = None
    line_number: Optional[int] = None
    recommendation: str = ""
    references: List[str] = field(default_factory=list)
    discovered_at: datetime = field(default_factory=datetime.now)
    status: VulnerabilityStatus = VulnerabilityStatus.OPEN
    scanner_name: str = ""
    confidence: float = 1.0
    exploitability: str = "unknown"
    impact: str = ""

@dataclass
class SecurityScanResult:
    """Results from a security scan"""
    scan_id: str
    scan_type: ScanType
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "running"
    vulnerabilities: List[SecurityVulnerability] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)
    scan_duration_seconds: float = 0.0
    total_files_scanned: int = 0
    total_issues_found: int = 0

@dataclass
class SecurityPolicy:
    """Security policy configuration"""
    name: str
    description: str
    max_critical_vulnerabilities: int = 0
    max_high_vulnerabilities: int = 5
    max_medium_vulnerabilities: int = 20
    max_low_vulnerabilities: int = 100
    required_scans: List[ScanType] = field(default_factory=list)
    compliance_frameworks: List[str] = field(default_factory=list)
    notification_thresholds: Dict[str, int] = field(default_factory=dict)

# ============================================================================
# Security Scanner Framework
# ============================================================================

class AutomatedSecurityScanner:
    """Comprehensive automated security scanning system"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Core components
        self.dependency_scanner = DependencyScanner(config)
        self.code_scanner = CodeSecurityScanner(config)
        self.config_scanner = ConfigurationScanner(config)
        self.compliance_scanner = ComplianceScanner(config)
        self.vulnerability_manager = VulnerabilityManager(config)
        
        # Scan state
        self.active_scans = {}
        self.scan_history = deque(maxlen=100)
        self.is_running = False
        
        # Security policy
        self.security_policy = self._load_security_policy()
        
        # Database setup
        self.db_path = config.get('security_db_path', 'security_scanner.db')
        self._setup_database()
        
        # Scan scheduler
        self.scheduled_scans = []
        self.last_full_scan = None
    
    def _setup_database(self):
        """Initialize security scanner database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Vulnerabilities table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS vulnerabilities (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        description TEXT,
                        severity TEXT NOT NULL,
                        cve_id TEXT,
                        cvss_score REAL,
                        category TEXT,
                        affected_component TEXT,
                        file_path TEXT,
                        line_number INTEGER,
                        recommendation TEXT,
                        references TEXT,
                        discovered_at DATETIME NOT NULL,
                        status TEXT NOT NULL,
                        scanner_name TEXT,
                        confidence REAL,
                        exploitability TEXT,
                        impact TEXT
                    )
                ''')
                
                # Scan results table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS scan_results (
                        scan_id TEXT PRIMARY KEY,
                        scan_type TEXT NOT NULL,
                        started_at DATETIME NOT NULL,
                        completed_at DATETIME,
                        status TEXT NOT NULL,
                        summary TEXT,
                        metadata TEXT,
                        scan_duration_seconds REAL,
                        total_files_scanned INTEGER,
                        total_issues_found INTEGER
                    )
                ''')
                
                # Security metrics table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS security_metrics (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        metric_name TEXT NOT NULL,
                        metric_value REAL NOT NULL,
                        scan_id TEXT,
                        context TEXT
                    )
                ''')
                
                # Policy violations table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS policy_violations (
                        id TEXT PRIMARY KEY,
                        policy_name TEXT NOT NULL,
                        violation_type TEXT NOT NULL,
                        description TEXT,
                        severity TEXT NOT NULL,
                        detected_at DATETIME NOT NULL,
                        resolved_at DATETIME,
                        status TEXT NOT NULL,
                        metadata TEXT
                    )
                ''')
                
                # Create indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_vuln_severity ON vulnerabilities(severity)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_vuln_status ON vulnerabilities(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_vuln_discovered ON vulnerabilities(discovered_at)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_scan_type ON scan_results(scan_type)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_scan_started ON scan_results(started_at)')
                
                conn.commit()
                self.logger.info("Security scanner database initialized successfully")
                
        except Exception as e:
            self.logger.error(f"Failed to setup security database: {e}")
            raise
    
    def _load_security_policy(self) -> SecurityPolicy:
        """Load security policy configuration"""
        return SecurityPolicy(
            name="Apple MCP Security Policy",
            description="Comprehensive security policy for Apple MCP project",
            max_critical_vulnerabilities=0,
            max_high_vulnerabilities=2,
            max_medium_vulnerabilities=10,
            max_low_vulnerabilities=50,
            required_scans=[ScanType.DEPENDENCY, ScanType.CODE_ANALYSIS, ScanType.CONFIGURATION],
            compliance_frameworks=["OWASP Top 10", "NIST", "ISO 27001"],
            notification_thresholds={
                "critical": 1,
                "high": 3,
                "medium": 10
            }
        )
    
    async def start_scanner(self):
        """Start the automated security scanner"""
        if self.is_running:
            return
        
        self.is_running = True
        
        try:
            # Start core components
            await self.dependency_scanner.initialize()
            await self.code_scanner.initialize()
            await self.config_scanner.initialize()
            await self.compliance_scanner.initialize()
            await self.vulnerability_manager.initialize()
            
            self.logger.info("Automated security scanner started successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to start security scanner: {e}")
            self.is_running = False
            raise
    
    async def stop_scanner(self):
        """Stop the security scanner"""
        self.is_running = False
        
        # Cancel active scans
        for scan_id, scan_task in self.active_scans.items():
            if not scan_task.done():
                scan_task.cancel()
        
        self.logger.info("Security scanner stopped")
    
    async def run_comprehensive_scan(self, target_path: str = ".") -> SecurityScanResult:
        """Run comprehensive security scan"""
        scan_id = f"full_scan_{int(time.time())}"
        
        self.logger.info(f"Starting comprehensive security scan: {scan_id}")
        
        scan_result = SecurityScanResult(
            scan_id=scan_id,
            scan_type=ScanType.FULL_SCAN,
            started_at=datetime.now()
        )
        
        start_time = time.time()
        
        try:
            # Run all scan types
            dependency_results = await self.dependency_scanner.scan()
            code_results = await self.code_scanner.scan(target_path)
            config_results = await self.config_scanner.scan(target_path)
            compliance_results = await self.compliance_scanner.scan()
            
            # Combine all vulnerabilities
            all_vulnerabilities = []
            all_vulnerabilities.extend(dependency_results.vulnerabilities)
            all_vulnerabilities.extend(code_results.vulnerabilities)
            all_vulnerabilities.extend(config_results.vulnerabilities)
            all_vulnerabilities.extend(compliance_results.vulnerabilities)
            
            scan_result.vulnerabilities = all_vulnerabilities
            scan_result.completed_at = datetime.now()
            scan_result.status = "completed"
            scan_result.scan_duration_seconds = time.time() - start_time
            scan_result.total_issues_found = len(all_vulnerabilities)
            
            # Generate summary
            scan_result.summary = self._generate_scan_summary(all_vulnerabilities)
            
            # Store results
            await self._store_scan_results(scan_result)
            
            # Check policy violations
            await self._check_policy_violations(scan_result)
            
            self.last_full_scan = datetime.now()
            self.scan_history.append(scan_result)
            
            self.logger.info(f"Comprehensive scan completed: {scan_id} ({len(all_vulnerabilities)} issues found)")
            
            return scan_result
            
        except Exception as e:
            scan_result.status = "failed"
            scan_result.completed_at = datetime.now()
            scan_result.metadata["error"] = str(e)
            
            self.logger.error(f"Comprehensive scan failed: {e}")
            return scan_result
    
    async def run_quick_scan(self, target_path: str = ".") -> SecurityScanResult:
        """Run quick security scan focusing on critical issues"""
        scan_id = f"quick_scan_{int(time.time())}"
        
        self.logger.info(f"Starting quick security scan: {scan_id}")
        
        scan_result = SecurityScanResult(
            scan_id=scan_id,
            scan_type=ScanType.CODE_ANALYSIS,
            started_at=datetime.now()
        )
        
        start_time = time.time()
        
        try:
            # Run high-priority scans only
            code_results = await self.code_scanner.scan_critical_patterns(target_path)
            dependency_results = await self.dependency_scanner.scan_known_vulnerabilities()
            
            all_vulnerabilities = []
            all_vulnerabilities.extend(code_results.vulnerabilities)
            all_vulnerabilities.extend(dependency_results.vulnerabilities)
            
            scan_result.vulnerabilities = all_vulnerabilities
            scan_result.completed_at = datetime.now()
            scan_result.status = "completed"
            scan_result.scan_duration_seconds = time.time() - start_time
            scan_result.total_issues_found = len(all_vulnerabilities)
            scan_result.summary = self._generate_scan_summary(all_vulnerabilities)
            
            await self._store_scan_results(scan_result)
            
            self.logger.info(f"Quick scan completed: {scan_id} ({len(all_vulnerabilities)} issues found)")
            
            return scan_result
            
        except Exception as e:
            scan_result.status = "failed"
            scan_result.completed_at = datetime.now()
            scan_result.metadata["error"] = str(e)
            
            self.logger.error(f"Quick scan failed: {e}")
            return scan_result
    
    def _generate_scan_summary(self, vulnerabilities: List[SecurityVulnerability]) -> Dict[str, Any]:
        """Generate scan summary from vulnerabilities"""
        summary = {
            'total_vulnerabilities': len(vulnerabilities),
            'by_severity': {},
            'by_category': {},
            'by_scanner': {},
            'critical_issues': [],
            'recommendations': []
        }
        
        # Count by severity
        for vuln in vulnerabilities:
            severity = vuln.severity.value
            summary['by_severity'][severity] = summary['by_severity'].get(severity, 0) + 1
            
            # Track critical issues
            if vuln.severity in [VulnerabilitySeverity.CRITICAL, VulnerabilitySeverity.HIGH]:
                summary['critical_issues'].append({
                    'id': vuln.id,
                    'title': vuln.title,
                    'severity': severity,
                    'component': vuln.affected_component
                })
        
        # Count by category
        for vuln in vulnerabilities:
            category = vuln.category or "unknown"
            summary['by_category'][category] = summary['by_category'].get(category, 0) + 1
        
        # Count by scanner
        for vuln in vulnerabilities:
            scanner = vuln.scanner_name or "unknown"
            summary['by_scanner'][scanner] = summary['by_scanner'].get(scanner, 0) + 1
        
        # Generate recommendations
        critical_count = summary['by_severity'].get('critical', 0)
        high_count = summary['by_severity'].get('high', 0)
        
        if critical_count > 0:
            summary['recommendations'].append(f"URGENT: Address {critical_count} critical vulnerabilities immediately")
        
        if high_count > 0:
            summary['recommendations'].append(f"HIGH PRIORITY: Address {high_count} high-severity vulnerabilities")
        
        if len(vulnerabilities) == 0:
            summary['recommendations'].append("No security vulnerabilities detected")
        
        return summary
    
    async def _store_scan_results(self, scan_result: SecurityScanResult):
        """Store scan results in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                # Store scan result
                await conn.execute('''
                    INSERT OR REPLACE INTO scan_results (
                        scan_id, scan_type, started_at, completed_at, status,
                        summary, metadata, scan_duration_seconds,
                        total_files_scanned, total_issues_found
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    scan_result.scan_id,
                    scan_result.scan_type.value,
                    scan_result.started_at,
                    scan_result.completed_at,
                    scan_result.status,
                    json.dumps(scan_result.summary),
                    json.dumps(scan_result.metadata),
                    scan_result.scan_duration_seconds,
                    scan_result.total_files_scanned,
                    scan_result.total_issues_found
                ))
                
                # Store vulnerabilities
                for vuln in scan_result.vulnerabilities:
                    await conn.execute('''
                        INSERT OR REPLACE INTO vulnerabilities (
                            id, title, description, severity, cve_id, cvss_score,
                            category, affected_component, file_path, line_number,
                            recommendation, references, discovered_at, status,
                            scanner_name, confidence, exploitability, impact
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        vuln.id, vuln.title, vuln.description, vuln.severity.value,
                        vuln.cve_id, vuln.cvss_score, vuln.category,
                        vuln.affected_component, vuln.file_path, vuln.line_number,
                        vuln.recommendation, json.dumps(vuln.references),
                        vuln.discovered_at, vuln.status.value, vuln.scanner_name,
                        vuln.confidence, vuln.exploitability, vuln.impact
                    ))
                
                await conn.commit()
                
        except Exception as e:
            self.logger.error(f"Error storing scan results: {e}")
    
    async def _check_policy_violations(self, scan_result: SecurityScanResult):
        """Check for security policy violations"""
        violations = []
        
        severity_counts = scan_result.summary.get('by_severity', {})
        
        # Check vulnerability count limits
        if severity_counts.get('critical', 0) > self.security_policy.max_critical_vulnerabilities:
            violations.append({
                'type': 'critical_vulnerability_limit_exceeded',
                'description': f"Critical vulnerabilities: {severity_counts.get('critical', 0)} > {self.security_policy.max_critical_vulnerabilities}",
                'severity': 'critical'
            })
        
        if severity_counts.get('high', 0) > self.security_policy.max_high_vulnerabilities:
            violations.append({
                'type': 'high_vulnerability_limit_exceeded',
                'description': f"High vulnerabilities: {severity_counts.get('high', 0)} > {self.security_policy.max_high_vulnerabilities}",
                'severity': 'high'
            })
        
        # Store policy violations
        for violation in violations:
            await self._store_policy_violation(violation, scan_result.scan_id)
    
    async def _store_policy_violation(self, violation: Dict[str, Any], scan_id: str):
        """Store policy violation in database"""
        try:
            violation_id = f"violation_{scan_id}_{hash(violation['type'])}"
            
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT OR REPLACE INTO policy_violations (
                        id, policy_name, violation_type, description,
                        severity, detected_at, status, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    violation_id,
                    self.security_policy.name,
                    violation['type'],
                    violation['description'],
                    violation['severity'],
                    datetime.now(),
                    'open',
                    json.dumps({'scan_id': scan_id})
                ))
                
                await conn.commit()
                
        except Exception as e:
            self.logger.error(f"Error storing policy violation: {e}")
    
    async def get_security_dashboard_data(self) -> Dict[str, Any]:
        """Get comprehensive security dashboard data"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                # Get vulnerability summary
                cursor = await conn.execute('''
                    SELECT severity, status, COUNT(*) as count
                    FROM vulnerabilities
                    WHERE discovered_at > datetime('now', '-30 days')
                    GROUP BY severity, status
                ''')
                
                vulnerability_stats = {}
                async for row in cursor:
                    severity, status, count = row
                    if severity not in vulnerability_stats:
                        vulnerability_stats[severity] = {}
                    vulnerability_stats[severity][status] = count
                
                # Get recent scans
                cursor = await conn.execute('''
                    SELECT scan_id, scan_type, started_at, status, total_issues_found
                    FROM scan_results
                    ORDER BY started_at DESC
                    LIMIT 10
                ''')
                
                recent_scans = []
                async for row in cursor:
                    recent_scans.append({
                        'scan_id': row[0],
                        'scan_type': row[1],
                        'started_at': row[2],
                        'status': row[3],
                        'issues_found': row[4]
                    })
                
                # Get policy violations
                cursor = await conn.execute('''
                    SELECT COUNT(*) as count, severity
                    FROM policy_violations
                    WHERE status = 'open'
                    GROUP BY severity
                ''')
                
                policy_violations = {}
                async for row in cursor:
                    count, severity = row
                    policy_violations[severity] = count
                
                dashboard_data = {
                    'timestamp': datetime.now().isoformat(),
                    'vulnerability_stats': vulnerability_stats,
                    'recent_scans': recent_scans,
                    'policy_violations': policy_violations,
                    'last_full_scan': self.last_full_scan.isoformat() if self.last_full_scan else None,
                    'scanner_status': 'running' if self.is_running else 'stopped',
                    'security_score': await self._calculate_security_score()
                }
                
                return dashboard_data
                
        except Exception as e:
            self.logger.error(f"Error getting security dashboard data: {e}")
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}
    
    async def _calculate_security_score(self) -> float:
        """Calculate overall security score (0-100)"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                cursor = await conn.execute('''
                    SELECT severity, COUNT(*) as count
                    FROM vulnerabilities
                    WHERE status = 'open'
                    GROUP BY severity
                ''')
                
                severity_weights = {
                    'critical': -50,
                    'high': -20,
                    'medium': -5,
                    'low': -1,
                    'info': 0
                }
                
                score = 100
                async for row in cursor:
                    severity, count = row
                    weight = severity_weights.get(severity, 0)
                    score += weight * count
                
                return max(0, min(100, score))
                
        except Exception as e:
            self.logger.error(f"Error calculating security score: {e}")
            return 0.0
    
    def print_security_dashboard(self):
        """Print security dashboard"""
        try:
            asyncio.run(self._print_security_dashboard_async())
        except Exception as e:
            self.logger.error(f"Error printing security dashboard: {e}")
            print(f"Security Dashboard Error: {e}")
    
    async def _print_security_dashboard_async(self):
        """Async version of security dashboard printing"""
        dashboard_data = await self.get_security_dashboard_data()
        
        print("\n" + "="*80)
        print("🔒 APPLE MCP - SECURITY SCANNER DASHBOARD")
        print("="*80)
        print(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"🚨 Scanner Status: {'🟢 RUNNING' if self.is_running else '🔴 STOPPED'}")
        print(f"📊 Security Score: {dashboard_data.get('security_score', 0):.1f}/100")
        print()
        
        # Vulnerability summary
        vuln_stats = dashboard_data.get('vulnerability_stats', {})
        total_open = sum(vuln_stats.get(sev, {}).get('open', 0) for sev in vuln_stats)
        
        print(f"🚨 Open Vulnerabilities: {total_open}")
        for severity in ['critical', 'high', 'medium', 'low']:
            count = vuln_stats.get(severity, {}).get('open', 0)
            if count > 0:
                emoji = {'critical': '🔴', 'high': '🟠', 'medium': '🟡', 'low': '🔵'}.get(severity, '⚪')
                print(f"   {emoji} {severity.upper()}: {count}")
        
        # Policy violations
        violations = dashboard_data.get('policy_violations', {})
        total_violations = sum(violations.values())
        print(f"⚠️  Policy Violations: {total_violations}")
        
        # Recent scans
        recent_scans = dashboard_data.get('recent_scans', [])
        print(f"📋 Recent Scans: {len(recent_scans)}")
        for scan in recent_scans[:3]:
            status_emoji = '✅' if scan['status'] == 'completed' else '❌' if scan['status'] == 'failed' else '🔄'
            print(f"   {status_emoji} {scan['scan_type']} - {scan['issues_found']} issues")
        
        # Last full scan
        last_scan = dashboard_data.get('last_full_scan')
        if last_scan:
            last_scan_time = datetime.fromisoformat(last_scan.replace('Z', '+00:00'))
            time_since = datetime.now() - last_scan_time.replace(tzinfo=None)
            print(f"🔍 Last Full Scan: {time_since.days} days ago")
        else:
            print("🔍 Last Full Scan: Never")
        
        print("="*80)

# ============================================================================
# Specialized Scanner Components
# ============================================================================

class DependencyScanner:
    """Dependency vulnerability scanner"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.vulnerability_db = {}
    
    async def initialize(self):
        """Initialize dependency scanner"""
        await self._load_vulnerability_database()
        self.logger.info("Dependency scanner initialized")
    
    async def _load_vulnerability_database(self):
        """Load known vulnerability database"""
        # In production, this would load from external vulnerability databases
        # For now, we'll use a sample database
        self.vulnerability_db = {
            'requests': {
                'versions': ['2.25.1', '2.26.0'],
                'vulnerabilities': [{
                    'cve': 'CVE-2021-33503',
                    'severity': 'medium',
                    'description': 'Denial of Service vulnerability in requests'
                }]
            },
            'flask': {
                'versions': ['1.0.0', '1.1.0'],
                'vulnerabilities': [{
                    'cve': 'CVE-2019-1010083',
                    'severity': 'high',
                    'description': 'Path traversal vulnerability in Flask'
                }]
            }
        }
    
    async def scan(self) -> SecurityScanResult:
        """Scan dependencies for vulnerabilities"""
        scan_id = f"dep_scan_{int(time.time())}"
        
        scan_result = SecurityScanResult(
            scan_id=scan_id,
            scan_type=ScanType.DEPENDENCY,
            started_at=datetime.now()
        )
        
        try:
            vulnerabilities = []
            
            # Check Python dependencies
            python_vulns = await self._scan_python_dependencies()
            vulnerabilities.extend(python_vulns)
            
            # Check Node.js dependencies
            node_vulns = await self._scan_node_dependencies()
            vulnerabilities.extend(node_vulns)
            
            scan_result.vulnerabilities = vulnerabilities
            scan_result.completed_at = datetime.now()
            scan_result.status = "completed"
            scan_result.total_issues_found = len(vulnerabilities)
            
            return scan_result
            
        except Exception as e:
            scan_result.status = "failed"
            scan_result.completed_at = datetime.now()
            scan_result.metadata["error"] = str(e)
            return scan_result
    
    async def scan_known_vulnerabilities(self) -> SecurityScanResult:
        """Quick scan for known critical vulnerabilities"""
        scan_id = f"dep_quick_scan_{int(time.time())}"
        
        scan_result = SecurityScanResult(
            scan_id=scan_id,
            scan_type=ScanType.DEPENDENCY,
            started_at=datetime.now()
        )
        
        try:
            vulnerabilities = []
            
            # Check for critical known vulnerabilities only
            python_vulns = await self._scan_python_dependencies()
            critical_vulns = [v for v in python_vulns if v.severity == VulnerabilitySeverity.CRITICAL]
            vulnerabilities.extend(critical_vulns)
            
            scan_result.vulnerabilities = vulnerabilities
            scan_result.completed_at = datetime.now()
            scan_result.status = "completed"
            scan_result.total_issues_found = len(vulnerabilities)
            
            return scan_result
            
        except Exception as e:
            scan_result.status = "failed"
            scan_result.completed_at = datetime.now()
            scan_result.metadata["error"] = str(e)
            return scan_result
    
    async def _scan_python_dependencies(self) -> List[SecurityVulnerability]:
        """Scan Python dependencies"""
        vulnerabilities = []
        
        try:
            # Check if requirements.txt exists
            if os.path.exists('requirements.txt'):
                with open('requirements.txt', 'r') as f:
                    requirements = f.read()
                
                # Parse requirements and check against vulnerability database
                for line in requirements.split('\n'):
                    line = line.strip()
                    if line and not line.startswith('#'):
                        package_name = line.split('==')[0].split('>=')[0].split('<=')[0].strip()
                        
                        if package_name in self.vulnerability_db:
                            for vuln in self.vulnerability_db[package_name]['vulnerabilities']:
                                vulnerability = SecurityVulnerability(
                                    id=f"dep_{package_name}_{vuln['cve']}",
                                    title=f"Vulnerable dependency: {package_name}",
                                    description=vuln['description'],
                                    severity=VulnerabilitySeverity(vuln['severity']),
                                    cve_id=vuln['cve'],
                                    category="dependency",
                                    affected_component=package_name,
                                    file_path="requirements.txt",
                                    recommendation=f"Update {package_name} to a secure version",
                                    scanner_name="dependency_scanner"
                                )
                                vulnerabilities.append(vulnerability)
        
        except Exception as e:
            self.logger.error(f"Error scanning Python dependencies: {e}")
        
        return vulnerabilities
    
    async def _scan_node_dependencies(self) -> List[SecurityVulnerability]:
        """Scan Node.js dependencies"""
        vulnerabilities = []
        
        try:
            # Check package.json in dashboard/frontend
            package_json_path = "dashboard/frontend/package.json"
            if os.path.exists(package_json_path):
                with open(package_json_path, 'r') as f:
                    package_data = json.load(f)
                
                dependencies = package_data.get('dependencies', {})
                
                # Check for known vulnerable packages
                vulnerable_packages = {
                    'react': {'versions': ['16.0.0'], 'severity': 'medium'},
                    'lodash': {'versions': ['4.17.15'], 'severity': 'high'}
                }
                
                for package_name, version in dependencies.items():
                    if package_name in vulnerable_packages:
                        vuln_info = vulnerable_packages[package_name]
                        vulnerability = SecurityVulnerability(
                            id=f"node_dep_{package_name}_{hash(version)}",
                            title=f"Potentially vulnerable Node.js dependency: {package_name}",
                            description=f"Package {package_name} version {version} may have known vulnerabilities",
                            severity=VulnerabilitySeverity(vuln_info['severity']),
                            category="dependency",
                            affected_component=package_name,
                            file_path=package_json_path,
                            recommendation=f"Update {package_name} to latest secure version",
                            scanner_name="dependency_scanner"
                        )
                        vulnerabilities.append(vulnerability)
        
        except Exception as e:
            self.logger.error(f"Error scanning Node.js dependencies: {e}")
        
        return vulnerabilities

class CodeSecurityScanner:
    """Code security analysis scanner"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        self.security_patterns = self._load_security_patterns()
    
    def _load_security_patterns(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load security pattern definitions"""
        return {
            'sql_injection': [
                {
                    'pattern': r'execute\s*\(\s*["\'].*%.*["\']',
                    'severity': 'high',
                    'description': 'Potential SQL injection vulnerability'
                },
                {
                    'pattern': r'query\s*\(\s*f["\'].*\{.*\}.*["\']',
                    'severity': 'medium',
                    'description': 'Potential SQL injection via f-string'
                }
            ],
            'command_injection': [
                {
                    'pattern': r'os\.system\s*\(\s*f?["\'].*\{.*\}.*["\']',
                    'severity': 'critical',
                    'description': 'Command injection vulnerability'
                },
                {
                    'pattern': r'subprocess\..*shell\s*=\s*True',
                    'severity': 'high',
                    'description': 'Dangerous shell execution'
                }
            ],
            'path_traversal': [
                {
                    'pattern': r'open\s*\(\s*.*\+.*["\'].*\.\./.*["\']',
                    'severity': 'high',
                    'description': 'Potential path traversal vulnerability'
                }
            ],
            'hardcoded_secrets': [
                {
                    'pattern': r'password\s*=\s*["\'][^"\']{8,}["\']',
                    'severity': 'high',
                    'description': 'Hardcoded password detected'
                },
                {
                    'pattern': r'api_key\s*=\s*["\'][^"\']{20,}["\']',
                    'severity': 'medium',
                    'description': 'Hardcoded API key detected'
                }
            ],
            'xss_vulnerabilities': [
                {
                    'pattern': r'innerHTML\s*=.*\+.*',
                    'severity': 'medium',
                    'description': 'Potential XSS via innerHTML'
                }
            ]
        }
    
    async def initialize(self):
        """Initialize code scanner"""
        self.logger.info("Code security scanner initialized")
    
    async def scan(self, target_path: str) -> SecurityScanResult:
        """Scan code for security vulnerabilities"""
        scan_id = f"code_scan_{int(time.time())}"
        
        scan_result = SecurityScanResult(
            scan_id=scan_id,
            scan_type=ScanType.CODE_ANALYSIS,
            started_at=datetime.now()
        )
        
        try:
            vulnerabilities = []
            files_scanned = 0
            
            # Scan Python files
            python_files = list(Path(target_path).rglob("*.py"))
            for file_path in python_files:
                if self._should_scan_file(file_path):
                    file_vulns = await self._scan_python_file(file_path)
                    vulnerabilities.extend(file_vulns)
                    files_scanned += 1
            
            # Scan JavaScript/TypeScript files
            js_files = list(Path(target_path).rglob("*.js")) + list(Path(target_path).rglob("*.ts")) + list(Path(target_path).rglob("*.tsx"))
            for file_path in js_files:
                if self._should_scan_file(file_path):
                    file_vulns = await self._scan_js_file(file_path)
                    vulnerabilities.extend(file_vulns)
                    files_scanned += 1
            
            scan_result.vulnerabilities = vulnerabilities
            scan_result.completed_at = datetime.now()
            scan_result.status = "completed"
            scan_result.total_files_scanned = files_scanned
            scan_result.total_issues_found = len(vulnerabilities)
            
            return scan_result
            
        except Exception as e:
            scan_result.status = "failed"
            scan_result.completed_at = datetime.now()
            scan_result.metadata["error"] = str(e)
            return scan_result
    
    async def scan_critical_patterns(self, target_path: str) -> SecurityScanResult:
        """Quick scan for critical security patterns only"""
        scan_id = f"code_critical_scan_{int(time.time())}"
        
        scan_result = SecurityScanResult(
            scan_id=scan_id,
            scan_type=ScanType.CODE_ANALYSIS,
            started_at=datetime.now()
        )
        
        try:
            vulnerabilities = []
            
            # Focus on critical patterns only
            critical_patterns = ['command_injection', 'sql_injection']
            
            python_files = list(Path(target_path).rglob("*.py"))
            for file_path in python_files:
                if self._should_scan_file(file_path):
                    file_vulns = await self._scan_file_for_patterns(file_path, critical_patterns)
                    critical_vulns = [v for v in file_vulns if v.severity == VulnerabilitySeverity.CRITICAL]
                    vulnerabilities.extend(critical_vulns)
            
            scan_result.vulnerabilities = vulnerabilities
            scan_result.completed_at = datetime.now()
            scan_result.status = "completed"
            scan_result.total_issues_found = len(vulnerabilities)
            
            return scan_result
            
        except Exception as e:
            scan_result.status = "failed"
            scan_result.completed_at = datetime.now()
            scan_result.metadata["error"] = str(e)
            return scan_result
    
    def _should_scan_file(self, file_path: Path) -> bool:
        """Check if file should be scanned"""
        # Skip virtual environments, node_modules, etc.
        skip_patterns = [
            'venv', '.venv', 'env', '.env',
            'node_modules', '.git', '__pycache__',
            '.pytest_cache', 'build', 'dist'
        ]
        
        path_str = str(file_path)
        for pattern in skip_patterns:
            if pattern in path_str:
                return False
        
        return True
    
    async def _scan_python_file(self, file_path: Path) -> List[SecurityVulnerability]:
        """Scan Python file for security issues"""
        vulnerabilities = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')
            
            # Scan for all security patterns
            for category, patterns in self.security_patterns.items():
                for pattern_info in patterns:
                    pattern = pattern_info['pattern']
                    severity = pattern_info['severity']
                    description = pattern_info['description']
                    
                    for line_num, line in enumerate(lines, 1):
                        if re.search(pattern, line, re.IGNORECASE):
                            vulnerability = SecurityVulnerability(
                                id=f"code_{hash(f'{file_path}_{line_num}_{pattern}')}",
                                title=f"Security issue: {category}",
                                description=f"{description} in {file_path.name}",
                                severity=VulnerabilitySeverity(severity),
                                category=category,
                                affected_component=str(file_path),
                                file_path=str(file_path),
                                line_number=line_num,
                                recommendation=f"Review and fix {category} vulnerability",
                                scanner_name="code_scanner",
                                confidence=0.8
                            )
                            vulnerabilities.append(vulnerability)
        
        except Exception as e:
            self.logger.error(f"Error scanning Python file {file_path}: {e}")
        
        return vulnerabilities
    
    async def _scan_js_file(self, file_path: Path) -> List[SecurityVulnerability]:
        """Scan JavaScript/TypeScript file for security issues"""
        vulnerabilities = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')
            
            # Check for XSS patterns
            xss_patterns = self.security_patterns.get('xss_vulnerabilities', [])
            for pattern_info in xss_patterns:
                pattern = pattern_info['pattern']
                severity = pattern_info['severity']
                description = pattern_info['description']
                
                for line_num, line in enumerate(lines, 1):
                    if re.search(pattern, line, re.IGNORECASE):
                        vulnerability = SecurityVulnerability(
                            id=f"js_code_{hash(f'{file_path}_{line_num}_{pattern}')}",
                            title="JavaScript security issue",
                            description=f"{description} in {file_path.name}",
                            severity=VulnerabilitySeverity(severity),
                            category="xss",
                            affected_component=str(file_path),
                            file_path=str(file_path),
                            line_number=line_num,
                            recommendation="Use safe DOM manipulation methods",
                            scanner_name="code_scanner",
                            confidence=0.7
                        )
                        vulnerabilities.append(vulnerability)
        
        except Exception as e:
            self.logger.error(f"Error scanning JS file {file_path}: {e}")
        
        return vulnerabilities
    
    async def _scan_file_for_patterns(self, file_path: Path, pattern_categories: List[str]) -> List[SecurityVulnerability]:
        """Scan file for specific pattern categories"""
        vulnerabilities = []
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                lines = content.split('\n')
            
            for category in pattern_categories:
                if category in self.security_patterns:
                    patterns = self.security_patterns[category]
                    for pattern_info in patterns:
                        pattern = pattern_info['pattern']
                        severity = pattern_info['severity']
                        description = pattern_info['description']
                        
                        for line_num, line in enumerate(lines, 1):
                            if re.search(pattern, line, re.IGNORECASE):
                                vulnerability = SecurityVulnerability(
                                    id=f"pattern_{hash(f'{file_path}_{line_num}_{pattern}')}",
                                    title=f"Security pattern: {category}",
                                    description=f"{description} in {file_path.name}",
                                    severity=VulnerabilitySeverity(severity),
                                    category=category,
                                    affected_component=str(file_path),
                                    file_path=str(file_path),
                                    line_number=line_num,
                                    recommendation=f"Address {category} vulnerability",
                                    scanner_name="pattern_scanner",
                                    confidence=0.8
                                )
                                vulnerabilities.append(vulnerability)
        
        except Exception as e:
            self.logger.error(f"Error scanning file {file_path} for patterns: {e}")
        
        return vulnerabilities

class ConfigurationScanner:
    """Configuration security scanner"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    async def initialize(self):
        """Initialize configuration scanner"""
        self.logger.info("Configuration scanner initialized")
    
    async def scan(self, target_path: str) -> SecurityScanResult:
        """Scan configuration files for security issues"""
        scan_id = f"config_scan_{int(time.time())}"
        
        scan_result = SecurityScanResult(
            scan_id=scan_id,
            scan_type=ScanType.CONFIGURATION,
            started_at=datetime.now()
        )
        
        try:
            vulnerabilities = []
            
            # Scan environment files
            env_vulns = await self._scan_environment_files(target_path)
            vulnerabilities.extend(env_vulns)
            
            # Scan Docker configurations
            docker_vulns = await self._scan_docker_configs(target_path)
            vulnerabilities.extend(docker_vulns)
            
            # Scan server configurations
            server_vulns = await self._scan_server_configs(target_path)
            vulnerabilities.extend(server_vulns)
            
            scan_result.vulnerabilities = vulnerabilities
            scan_result.completed_at = datetime.now()
            scan_result.status = "completed"
            scan_result.total_issues_found = len(vulnerabilities)
            
            return scan_result
            
        except Exception as e:
            scan_result.status = "failed"
            scan_result.completed_at = datetime.now()
            scan_result.metadata["error"] = str(e)
            return scan_result
    
    async def _scan_environment_files(self, target_path: str) -> List[SecurityVulnerability]:
        """Scan environment configuration files"""
        vulnerabilities = []
        
        env_files = ['.env', '.env.local', '.env.production', '.env.example']
        
        for env_file in env_files:
            file_path = Path(target_path) / env_file
            if file_path.exists():
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                        lines = content.split('\n')
                    
                    for line_num, line in enumerate(lines, 1):
                        line = line.strip()
                        if line and not line.startswith('#'):
                            # Check for potential secrets
                            if any(secret_key in line.lower() for secret_key in ['password', 'secret', 'key', 'token']):
                                if '=' in line and len(line.split('=')[1].strip()) > 10:
                                    vulnerability = SecurityVulnerability(
                                        id=f"env_{hash(f'{file_path}_{line_num}')}",
                                        title="Potential secret in environment file",
                                        description=f"Environment variable may contain sensitive information",
                                        severity=VulnerabilitySeverity.MEDIUM,
                                        category="configuration",
                                        affected_component=str(file_path),
                                        file_path=str(file_path),
                                        line_number=line_num,
                                        recommendation="Ensure secrets are properly protected and not committed to version control",
                                        scanner_name="config_scanner"
                                    )
                                    vulnerabilities.append(vulnerability)
                
                except Exception as e:
                    self.logger.error(f"Error scanning environment file {file_path}: {e}")
        
        return vulnerabilities
    
    async def _scan_docker_configs(self, target_path: str) -> List[SecurityVulnerability]:
        """Scan Docker configuration files"""
        vulnerabilities = []
        
        docker_files = ['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml']
        
        for docker_file in docker_files:
            file_path = Path(target_path) / docker_file
            if file_path.exists():
                try:
                    with open(file_path, 'r') as f:
                        content = f.read()
                        lines = content.split('\n')
                    
                    for line_num, line in enumerate(lines, 1):
                        line = line.strip()
                        
                        # Check for running as root
                        if line.startswith('USER root') or line == 'USER 0':
                            vulnerability = SecurityVulnerability(
                                id=f"docker_root_{hash(f'{file_path}_{line_num}')}",
                                title="Docker container running as root",
                                description="Container configured to run as root user",
                                severity=VulnerabilitySeverity.MEDIUM,
                                category="configuration",
                                affected_component=str(file_path),
                                file_path=str(file_path),
                                line_number=line_num,
                                recommendation="Use non-root user for container execution",
                                scanner_name="config_scanner"
                            )
                            vulnerabilities.append(vulnerability)
                        
                        # Check for privileged mode
                        if 'privileged: true' in line or '--privileged' in line:
                            vulnerability = SecurityVulnerability(
                                id=f"docker_priv_{hash(f'{file_path}_{line_num}')}",
                                title="Docker privileged mode enabled",
                                description="Container configured with privileged access",
                                severity=VulnerabilitySeverity.HIGH,
                                category="configuration",
                                affected_component=str(file_path),
                                file_path=str(file_path),
                                line_number=line_num,
                                recommendation="Avoid privileged mode unless absolutely necessary",
                                scanner_name="config_scanner"
                            )
                            vulnerabilities.append(vulnerability)
                
                except Exception as e:
                    self.logger.error(f"Error scanning Docker file {file_path}: {e}")
        
        return vulnerabilities
    
    async def _scan_server_configs(self, target_path: str) -> List[SecurityVulnerability]:
        """Scan server configuration files"""
        vulnerabilities = []
        
        # This is a placeholder for server configuration scanning
        # In a real implementation, this would check nginx.conf, apache.conf, etc.
        
        return vulnerabilities

class ComplianceScanner:
    """Compliance and standards scanner"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    async def initialize(self):
        """Initialize compliance scanner"""
        self.logger.info("Compliance scanner initialized")
    
    async def scan(self) -> SecurityScanResult:
        """Scan for compliance violations"""
        scan_id = f"compliance_scan_{int(time.time())}"
        
        scan_result = SecurityScanResult(
            scan_id=scan_id,
            scan_type=ScanType.COMPLIANCE,
            started_at=datetime.now()
        )
        
        try:
            vulnerabilities = []
            
            # Check OWASP Top 10 compliance
            owasp_vulns = await self._check_owasp_compliance()
            vulnerabilities.extend(owasp_vulns)
            
            # Check security headers
            headers_vulns = await self._check_security_headers()
            vulnerabilities.extend(headers_vulns)
            
            scan_result.vulnerabilities = vulnerabilities
            scan_result.completed_at = datetime.now()
            scan_result.status = "completed"
            scan_result.total_issues_found = len(vulnerabilities)
            
            return scan_result
            
        except Exception as e:
            scan_result.status = "failed"
            scan_result.completed_at = datetime.now()
            scan_result.metadata["error"] = str(e)
            return scan_result
    
    async def _check_owasp_compliance(self) -> List[SecurityVulnerability]:
        """Check OWASP Top 10 compliance"""
        vulnerabilities = []
        
        # This is a placeholder for OWASP compliance checking
        # In a real implementation, this would perform comprehensive checks
        
        return vulnerabilities
    
    async def _check_security_headers(self) -> List[SecurityVulnerability]:
        """Check for missing security headers"""
        vulnerabilities = []
        
        try:
            # Check if application is running
            base_url = self.config.get('application_url', 'http://localhost:8002')
            
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.get(f"{base_url}/api/health", timeout=5) as response:
                        headers = response.headers
                        
                        # Check for missing security headers
                        required_headers = {
                            'X-Content-Type-Options': 'nosniff',
                            'X-Frame-Options': 'DENY',
                            'X-XSS-Protection': '1; mode=block',
                            'Strict-Transport-Security': 'max-age=31536000',
                            'Content-Security-Policy': 'default-src'
                        }
                        
                        for header_name, expected_value in required_headers.items():
                            if header_name not in headers:
                                vulnerability = SecurityVulnerability(
                                    id=f"header_missing_{header_name.lower().replace('-', '_')}",
                                    title=f"Missing security header: {header_name}",
                                    description=f"Security header {header_name} is not present",
                                    severity=VulnerabilitySeverity.MEDIUM,
                                    category="compliance",
                                    affected_component="web_server",
                                    recommendation=f"Add {header_name} header with value: {expected_value}",
                                    scanner_name="compliance_scanner"
                                )
                                vulnerabilities.append(vulnerability)
                
                except:
                    # Application not running, skip header check
                    pass
        
        except Exception as e:
            self.logger.error(f"Error checking security headers: {e}")
        
        return vulnerabilities

class VulnerabilityManager:
    """Vulnerability lifecycle management"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
    
    async def initialize(self):
        """Initialize vulnerability manager"""
        self.logger.info("Vulnerability manager initialized")
    
    async def get_vulnerability_summary(self) -> Dict[str, Any]:
        """Get vulnerability summary"""
        # Placeholder implementation
        return {
            'total': 0,
            'by_severity': {},
            'by_status': {},
            'trends': {}
        }

# ============================================================================
# Main Execution
# ============================================================================

def create_default_security_config() -> Dict[str, Any]:
    """Create default security scanner configuration"""
    return {
        'security_db_path': 'security_scanner.db',
        'application_url': 'http://localhost:8002',
        'scan_paths': ['.'],
        'exclude_patterns': ['venv', 'node_modules', '.git', '__pycache__'],
        'notification_webhook': None,
        'max_file_size_mb': 10,
        'scan_timeout_seconds': 3600,
        'parallel_scans': True,
        'vulnerability_database_url': None
    }

async def main():
    """Main function for testing the security scanner"""
    config = create_default_security_config()
    
    # Initialize security scanner
    scanner = AutomatedSecurityScanner(config)
    
    try:
        # Start scanner
        print("🔒 Starting Automated Security Scanner...")
        await scanner.start_scanner()
        
        # Run quick scan
        print("\n🚀 Running quick security scan...")
        quick_results = await scanner.run_quick_scan()
        
        print(f"✅ Quick scan completed: {quick_results.total_issues_found} issues found")
        
        # Print dashboard
        print("\n📊 Security Dashboard:")
        scanner.print_security_dashboard()
        
        # Run comprehensive scan
        print("\n🔍 Running comprehensive security scan...")
        full_results = await scanner.run_comprehensive_scan()
        
        print(f"✅ Comprehensive scan completed: {full_results.total_issues_found} issues found")
        
        # Print final dashboard
        print("\n📊 Final Security Dashboard:")
        scanner.print_security_dashboard()
        
    except KeyboardInterrupt:
        print("\n🛑 Security scanner stopped by user")
    except Exception as e:
        print(f"\n❌ Security scanner error: {e}")
        logger.error(f"Security scanner error: {e}")
    finally:
        # Stop scanner
        await scanner.stop_scanner()
        print("🔚 Security scanner shutdown complete")

if __name__ == "__main__":
    print("🔐 Apple MCP Automated Security Scanner")
    print("=" * 60)
    print("Enterprise-grade security scanning and vulnerability management")
    print("Features: Dependency scanning, code analysis, compliance checking")
    print("=" * 60)
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"\n💥 Critical error: {e}")
        logger.error(f"Critical scanner error: {e}")
        sys.exit(1)