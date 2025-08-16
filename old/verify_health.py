#!/usr/bin/env python3
"""
Email Intelligence Service Health Verification
Comprehensive health check system for production deployment
Verifies all components and dependencies are working correctly
"""

import asyncio
import aiohttp
import sqlite3
import os
import sys
import time
import json
import psutil
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# Health Check Configuration
# =============================================================================

class CheckStatus(str, Enum):
    """Health check status"""
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"
    SKIP = "skip"

@dataclass
class HealthCheckResult:
    """Individual health check result"""
    name: str
    status: CheckStatus
    message: str
    details: Dict[str, Any] = None
    duration_ms: float = 0.0
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()
        if self.details is None:
            self.details = {}

@dataclass
class SystemHealth:
    """Overall system health summary"""
    status: CheckStatus
    total_checks: int
    passed: int
    warnings: int
    failures: int
    skipped: int
    duration_ms: float
    timestamp: str
    checks: List[HealthCheckResult]

# =============================================================================
# Health Check Implementation
# =============================================================================

class EmailIntelligenceHealthChecker:
    """Comprehensive health checker for Email Intelligence system"""
    
    def __init__(self, config_dir: str = "."):
        self.config_dir = Path(config_dir)
        self.logger = logging.getLogger("HealthChecker")
        
        # Load environment configuration
        self._load_config()
        
        # HTTP session for API checks
        self.session: Optional[aiohttp.ClientSession] = None
    
    def _load_config(self):
        """Load configuration from environment"""
        from dotenv import load_dotenv
        load_dotenv(self.config_dir / '.env.production', override=False)
        
        self.config = {
            'backend_port': int(os.getenv('PORT', '8000')),
            'analytics_port': int(os.getenv('ANALYTICS_PORT', '8001')),
            'ui_port': int(os.getenv('UI_PORT', '3000')),
            'database_path': os.getenv('DATABASE_PATH', 'email_intelligence_production.db'),
            'redis_url': os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
            'mongodb_url': os.getenv('MONGODB_URL', ''),
            'openai_api_key': os.getenv('OPENAI_API_KEY', ''),
            'apple_mail_db_path': os.getenv('APPLE_MAIL_DB_PATH', '').format(user=os.getenv('USER', 'unknown')),
            'log_dir': self.config_dir / 'logs',
            'pid_dir': self.config_dir / 'pids'
        }
    
    async def run_full_health_check(self) -> SystemHealth:
        """Run comprehensive health check"""
        self.logger.info("Starting comprehensive health check...")
        start_time = time.time()
        
        # Initialize HTTP session
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30)
        )
        
        checks = []
        
        try:
            # System-level checks
            checks.extend(await self._check_system_resources())
            checks.extend(await self._check_dependencies())
            checks.extend(await self._check_file_permissions())
            
            # Database checks
            checks.extend(await self._check_databases())
            
            # Service checks
            checks.extend(await self._check_services())
            
            # API endpoint checks
            checks.extend(await self._check_api_endpoints())
            
            # Integration checks
            checks.extend(await self._check_integrations())
            
            # Performance checks
            checks.extend(await self._check_performance())
            
        finally:
            if self.session:
                await self.session.close()
        
        # Calculate results
        total_time = (time.time() - start_time) * 1000
        
        passed = sum(1 for c in checks if c.status == CheckStatus.PASS)
        warnings = sum(1 for c in checks if c.status == CheckStatus.WARN)
        failures = sum(1 for c in checks if c.status == CheckStatus.FAIL)
        skipped = sum(1 for c in checks if c.status == CheckStatus.SKIP)
        
        # Determine overall status
        if failures > 0:
            overall_status = CheckStatus.FAIL
        elif warnings > 0:
            overall_status = CheckStatus.WARN
        else:
            overall_status = CheckStatus.PASS
        
        health_summary = SystemHealth(
            status=overall_status,
            total_checks=len(checks),
            passed=passed,
            warnings=warnings,
            failures=failures,
            skipped=skipped,
            duration_ms=total_time,
            timestamp=datetime.now().isoformat(),
            checks=checks
        )
        
        self.logger.info(f"Health check completed: {overall_status.value} ({total_time:.1f}ms)")
        return health_summary
    
    async def _check_system_resources(self) -> List[HealthCheckResult]:
        """Check system resource availability"""
        checks = []
        
        # CPU usage check
        start_time = time.time()
        cpu_percent = psutil.cpu_percent(interval=1)
        duration = (time.time() - start_time) * 1000
        
        if cpu_percent < 80:
            status = CheckStatus.PASS
            message = f"CPU usage normal: {cpu_percent:.1f}%"
        elif cpu_percent < 90:
            status = CheckStatus.WARN
            message = f"CPU usage high: {cpu_percent:.1f}%"
        else:
            status = CheckStatus.FAIL
            message = f"CPU usage critical: {cpu_percent:.1f}%"
        
        checks.append(HealthCheckResult(
            name="system_cpu_usage",
            status=status,
            message=message,
            details={"cpu_percent": cpu_percent},
            duration_ms=duration
        ))
        
        # Memory usage check
        start_time = time.time()
        memory = psutil.virtual_memory()
        duration = (time.time() - start_time) * 1000
        
        if memory.percent < 80:
            status = CheckStatus.PASS
            message = f"Memory usage normal: {memory.percent:.1f}%"
        elif memory.percent < 90:
            status = CheckStatus.WARN
            message = f"Memory usage high: {memory.percent:.1f}%"
        else:
            status = CheckStatus.FAIL
            message = f"Memory usage critical: {memory.percent:.1f}%"
        
        checks.append(HealthCheckResult(
            name="system_memory_usage",
            status=status,
            message=message,
            details={
                "total_gb": memory.total / 1024**3,
                "available_gb": memory.available / 1024**3,
                "percent": memory.percent
            },
            duration_ms=duration
        ))
        
        # Disk space check
        start_time = time.time()
        disk = psutil.disk_usage(str(self.config_dir))
        disk_percent = (disk.used / disk.total) * 100
        duration = (time.time() - start_time) * 1000
        
        if disk_percent < 80:
            status = CheckStatus.PASS
            message = f"Disk space normal: {disk_percent:.1f}%"
        elif disk_percent < 90:
            status = CheckStatus.WARN
            message = f"Disk space high: {disk_percent:.1f}%"
        else:
            status = CheckStatus.FAIL
            message = f"Disk space critical: {disk_percent:.1f}%"
        
        checks.append(HealthCheckResult(
            name="system_disk_space",
            status=status,
            message=message,
            details={
                "total_gb": disk.total / 1024**3,
                "free_gb": disk.free / 1024**3,
                "percent": disk_percent
            },
            duration_ms=duration
        ))
        
        return checks
    
    async def _check_dependencies(self) -> List[HealthCheckResult]:
        """Check system dependencies"""
        checks = []
        
        # Python version check
        start_time = time.time()
        python_version = sys.version_info
        duration = (time.time() - start_time) * 1000
        
        if python_version >= (3, 9):
            status = CheckStatus.PASS
            message = f"Python version OK: {python_version.major}.{python_version.minor}.{python_version.micro}"
        else:
            status = CheckStatus.FAIL
            message = f"Python version too old: {python_version.major}.{python_version.minor}.{python_version.micro} (requires 3.9+)"
        
        checks.append(HealthCheckResult(
            name="python_version",
            status=status,
            message=message,
            details={"version": f"{python_version.major}.{python_version.minor}.{python_version.micro}"},
            duration_ms=duration
        ))
        
        # Required Python packages
        required_packages = [
            'fastapi', 'uvicorn', 'pydantic', 'aiohttp', 'psutil',
            'sqlite3', 'asyncio', 'datetime', 'pathlib'
        ]
        
        for package in required_packages:
            start_time = time.time()
            try:
                __import__(package)
                status = CheckStatus.PASS
                message = f"Package {package} available"
            except ImportError:
                status = CheckStatus.FAIL
                message = f"Package {package} missing"
            
            duration = (time.time() - start_time) * 1000
            
            checks.append(HealthCheckResult(
                name=f"package_{package}",
                status=status,
                message=message,
                duration_ms=duration
            ))
        
        return checks
    
    async def _check_file_permissions(self) -> List[HealthCheckResult]:
        """Check file and directory permissions"""
        checks = []
        
        # Required directories
        required_dirs = [
            (self.config['log_dir'], "logs directory"),
            (self.config['pid_dir'], "PIDs directory"),
            (Path(self.config['database_path']).parent, "database directory")
        ]
        
        for dir_path, description in required_dirs:
            start_time = time.time()
            
            if dir_path.exists():
                if os.access(dir_path, os.R_OK | os.W_OK):
                    status = CheckStatus.PASS
                    message = f"{description} accessible"
                else:
                    status = CheckStatus.FAIL
                    message = f"{description} not writable"
            else:
                try:
                    dir_path.mkdir(parents=True, exist_ok=True)
                    status = CheckStatus.PASS
                    message = f"{description} created"
                except PermissionError:
                    status = CheckStatus.FAIL
                    message = f"Cannot create {description}"
            
            duration = (time.time() - start_time) * 1000
            
            checks.append(HealthCheckResult(
                name=f"directory_{dir_path.name}",
                status=status,
                message=message,
                details={"path": str(dir_path)},
                duration_ms=duration
            ))
        
        return checks
    
    async def _check_databases(self) -> List[HealthCheckResult]:
        """Check database connectivity and integrity"""
        checks = []
        
        # SQLite database check
        start_time = time.time()
        db_path = self.config['database_path']
        
        try:
            with sqlite3.connect(db_path, timeout=5) as conn:
                cursor = conn.cursor()
                
                # Test basic operation
                cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
                tables = cursor.fetchall()
                
                # Check if expected tables exist
                table_names = [table[0] for table in tables]
                expected_tables = ['email_analysis', 'draft_generations', 'performance_metrics']
                
                missing_tables = [t for t in expected_tables if t not in table_names]
                
                if not missing_tables:
                    status = CheckStatus.PASS
                    message = f"SQLite database OK ({len(table_names)} tables)"
                else:
                    status = CheckStatus.WARN
                    message = f"SQLite database missing tables: {missing_tables}"
                
                details = {
                    "path": db_path,
                    "tables": table_names,
                    "missing_tables": missing_tables
                }
        
        except Exception as e:
            status = CheckStatus.FAIL
            message = f"SQLite database error: {str(e)}"
            details = {"path": db_path, "error": str(e)}
        
        duration = (time.time() - start_time) * 1000
        
        checks.append(HealthCheckResult(
            name="database_sqlite",
            status=status,
            message=message,
            details=details,
            duration_ms=duration
        ))
        
        # Apple Mail database check (if path configured)
        if self.config['apple_mail_db_path']:
            start_time = time.time()
            mail_db_path = self.config['apple_mail_db_path']
            
            if os.path.exists(mail_db_path):
                try:
                    # Try to read Apple Mail database
                    with sqlite3.connect(f"file:{mail_db_path}?mode=ro", uri=True, timeout=5) as conn:
                        cursor = conn.cursor()
                        cursor.execute("SELECT COUNT(*) FROM messages LIMIT 1")
                        result = cursor.fetchone()
                        
                        status = CheckStatus.PASS
                        message = f"Apple Mail database accessible"
                        details = {"path": mail_db_path, "accessible": True}
                
                except Exception as e:
                    status = CheckStatus.WARN
                    message = f"Apple Mail database read error: {str(e)}"
                    details = {"path": mail_db_path, "error": str(e)}
            else:
                status = CheckStatus.WARN
                message = f"Apple Mail database not found"
                details = {"path": mail_db_path, "exists": False}
            
            duration = (time.time() - start_time) * 1000
            
            checks.append(HealthCheckResult(
                name="database_apple_mail",
                status=status,
                message=message,
                details=details,
                duration_ms=duration
            ))
        
        return checks
    
    async def _check_services(self) -> List[HealthCheckResult]:
        """Check running services"""
        checks = []
        
        services_to_check = [
            ("backend", self.config['pid_dir'] / "backend.pid"),
            ("realtime_monitor", self.config['pid_dir'] / "realtime_monitor.pid"),
            ("analytics", self.config['pid_dir'] / "analytics.pid"),
            ("email_scheduler", self.config['pid_dir'] / "email_scheduler.pid")
        ]
        
        for service_name, pid_file in services_to_check:
            start_time = time.time()
            
            if pid_file.exists():
                try:
                    with open(pid_file, 'r') as f:
                        pid = int(f.read().strip())
                    
                    if psutil.pid_exists(pid):
                        process = psutil.Process(pid)
                        if process.is_running():
                            status = CheckStatus.PASS
                            message = f"Service {service_name} running (PID: {pid})"
                            details = {
                                "pid": pid,
                                "status": process.status(),
                                "cpu_percent": process.cpu_percent(),
                                "memory_mb": process.memory_info().rss / 1024 / 1024
                            }
                        else:
                            status = CheckStatus.FAIL
                            message = f"Service {service_name} not running"
                            details = {"pid": pid, "running": False}
                    else:
                        status = CheckStatus.FAIL
                        message = f"Service {service_name} PID {pid} not found"
                        details = {"pid": pid, "exists": False}
                
                except (ValueError, OSError, psutil.NoSuchProcess) as e:
                    status = CheckStatus.FAIL
                    message = f"Service {service_name} check error: {str(e)}"
                    details = {"error": str(e)}
            else:
                status = CheckStatus.FAIL
                message = f"Service {service_name} PID file not found"
                details = {"pid_file": str(pid_file)}
            
            duration = (time.time() - start_time) * 1000
            
            checks.append(HealthCheckResult(
                name=f"service_{service_name}",
                status=status,
                message=message,
                details=details,
                duration_ms=duration
            ))
        
        return checks
    
    async def _check_api_endpoints(self) -> List[HealthCheckResult]:
        """Check API endpoint availability"""
        checks = []
        
        endpoints_to_check = [
            ("backend_health", f"http://localhost:{self.config['backend_port']}/health"),
            ("backend_docs", f"http://localhost:{self.config['backend_port']}/docs"),
            ("analytics_health", f"http://localhost:{self.config['analytics_port']}/health")
        ]
        
        for endpoint_name, url in endpoints_to_check:
            start_time = time.time()
            
            try:
                async with self.session.get(url) as response:
                    duration = (time.time() - start_time) * 1000
                    
                    if 200 <= response.status < 300:
                        status = CheckStatus.PASS
                        message = f"Endpoint {endpoint_name} responding ({response.status})"
                        
                        # Try to parse response
                        try:
                            if response.content_type == 'application/json':
                                response_data = await response.json()
                            else:
                                response_data = {"content_type": response.content_type}
                        except:
                            response_data = {"content_type": response.content_type}
                        
                        details = {
                            "url": url,
                            "status_code": response.status,
                            "response_time_ms": duration,
                            "content_type": response.content_type,
                            "response": response_data
                        }
                    else:
                        status = CheckStatus.FAIL
                        message = f"Endpoint {endpoint_name} error ({response.status})"
                        details = {
                            "url": url,
                            "status_code": response.status,
                            "response_time_ms": duration
                        }
            
            except asyncio.TimeoutError:
                duration = (time.time() - start_time) * 1000
                status = CheckStatus.FAIL
                message = f"Endpoint {endpoint_name} timeout"
                details = {"url": url, "error": "timeout"}
            
            except Exception as e:
                duration = (time.time() - start_time) * 1000
                status = CheckStatus.FAIL
                message = f"Endpoint {endpoint_name} connection error: {str(e)}"
                details = {"url": url, "error": str(e)}
            
            checks.append(HealthCheckResult(
                name=f"api_{endpoint_name}",
                status=status,
                message=message,
                details=details,
                duration_ms=duration
            ))
        
        return checks
    
    async def _check_integrations(self) -> List[HealthCheckResult]:
        """Check external integrations"""
        checks = []
        
        # OpenAI API key check
        start_time = time.time()
        
        if self.config['openai_api_key']:
            # Check if API key is configured (don't test actual API call in health check)
            if len(self.config['openai_api_key']) > 10:  # Basic validation
                status = CheckStatus.PASS
                message = "OpenAI API key configured"
                details = {"configured": True, "key_length": len(self.config['openai_api_key'])}
            else:
                status = CheckStatus.WARN
                message = "OpenAI API key appears invalid"
                details = {"configured": True, "key_length": len(self.config['openai_api_key'])}
        else:
            status = CheckStatus.WARN
            message = "OpenAI API key not configured"
            details = {"configured": False}
        
        duration = (time.time() - start_time) * 1000
        
        checks.append(HealthCheckResult(
            name="integration_openai",
            status=status,
            message=message,
            details=details,
            duration_ms=duration
        ))
        
        return checks
    
    async def _check_performance(self) -> List[HealthCheckResult]:
        """Check system performance indicators"""
        checks = []
        
        # Log file sizes
        start_time = time.time()
        log_dir = self.config['log_dir']
        
        if log_dir.exists():
            total_size = 0
            log_count = 0
            
            for log_file in log_dir.glob("*.log"):
                if log_file.is_file():
                    size = log_file.stat().st_size
                    total_size += size
                    log_count += 1
            
            total_size_mb = total_size / 1024 / 1024
            
            if total_size_mb < 100:
                status = CheckStatus.PASS
                message = f"Log files size OK: {total_size_mb:.1f}MB"
            elif total_size_mb < 500:
                status = CheckStatus.WARN
                message = f"Log files size high: {total_size_mb:.1f}MB"
            else:
                status = CheckStatus.FAIL
                message = f"Log files size excessive: {total_size_mb:.1f}MB"
            
            details = {
                "total_size_mb": total_size_mb,
                "log_count": log_count,
                "directory": str(log_dir)
            }
        else:
            status = CheckStatus.SKIP
            message = "Log directory not found"
            details = {"directory": str(log_dir)}
        
        duration = (time.time() - start_time) * 1000
        
        checks.append(HealthCheckResult(
            name="performance_log_size",
            status=status,
            message=message,
            details=details,
            duration_ms=duration
        ))
        
        return checks

# =============================================================================
# CLI Interface and Reporting
# =============================================================================

def print_health_report(health: SystemHealth, verbose: bool = False):
    """Print formatted health report"""
    
    # Status colors
    status_colors = {
        CheckStatus.PASS: "\033[92m",  # Green
        CheckStatus.WARN: "\033[93m",  # Yellow
        CheckStatus.FAIL: "\033[91m",  # Red
        CheckStatus.SKIP: "\033[94m",  # Blue
    }
    reset_color = "\033[0m"
    
    # Header
    overall_color = status_colors.get(health.status, "")
    print(f"\n{'='*60}")
    print(f"Email Intelligence System Health Check")
    print(f"{'='*60}")
    print(f"Overall Status: {overall_color}{health.status.value.upper()}{reset_color}")
    print(f"Timestamp: {health.timestamp}")
    print(f"Duration: {health.duration_ms:.1f}ms")
    print(f"Total Checks: {health.total_checks}")
    print(f"  ✓ Passed: {health.passed}")
    print(f"  ⚠ Warnings: {health.warnings}")
    print(f"  ✗ Failures: {health.failures}")
    print(f"  ○ Skipped: {health.skipped}")
    print()
    
    # Group checks by category
    categories = {}
    for check in health.checks:
        category = check.name.split('_')[0]
        if category not in categories:
            categories[category] = []
        categories[category].append(check)
    
    # Print results by category
    for category, checks in categories.items():
        print(f"{category.title()} Checks:")
        print("-" * 20)
        
        for check in checks:
            color = status_colors.get(check.status, "")
            status_icon = {
                CheckStatus.PASS: "✓",
                CheckStatus.WARN: "⚠",
                CheckStatus.FAIL: "✗",
                CheckStatus.SKIP: "○"
            }.get(check.status, "?")
            
            print(f"  {color}{status_icon} {check.name}: {check.message}{reset_color}")
            
            if verbose and check.details:
                for key, value in check.details.items():
                    print(f"    {key}: {value}")
            
            if verbose:
                print(f"    Duration: {check.duration_ms:.1f}ms")
        
        print()

def save_health_report(health: SystemHealth, output_file: str):
    """Save health report to JSON file"""
    with open(output_file, 'w') as f:
        json.dump(asdict(health), f, indent=2, default=str)

async def main():
    """Main CLI interface"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Email Intelligence Health Checker")
    parser.add_argument("--config-dir", default=".", help="Configuration directory")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--output", "-o", help="Save report to JSON file")
    parser.add_argument("--quiet", "-q", action="store_true", help="Quiet mode (errors only)")
    
    args = parser.parse_args()
    
    if args.quiet:
        logging.getLogger().setLevel(logging.ERROR)
    
    try:
        # Run health check
        checker = EmailIntelligenceHealthChecker(args.config_dir)
        health = await checker.run_full_health_check()
        
        # Output results
        if not args.quiet:
            print_health_report(health, verbose=args.verbose)
        
        # Save to file if requested
        if args.output:
            save_health_report(health, args.output)
            if not args.quiet:
                print(f"Health report saved to: {args.output}")
        
        # Exit with appropriate code
        if health.status == CheckStatus.FAIL:
            sys.exit(1)
        elif health.status == CheckStatus.WARN:
            sys.exit(2)
        else:
            sys.exit(0)
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        sys.exit(3)

if __name__ == "__main__":
    asyncio.run(main())