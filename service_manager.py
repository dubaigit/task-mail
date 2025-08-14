#!/usr/bin/env python3
"""
Email Intelligence Service Manager
Advanced process management and monitoring for production deployment
Handles service lifecycle, health monitoring, and automatic recovery
"""

import os
import sys
import time
import signal
import psutil
import asyncio
import logging
import threading
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, field
from enum import Enum
import json
import requests
from concurrent.futures import ThreadPoolExecutor
import argparse

# Setup structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/service_manager.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# =============================================================================
# Service Definitions and States
# =============================================================================

class ServiceState(str, Enum):
    """Service state enumeration"""
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    STOPPING = "stopping"
    FAILED = "failed"
    RESTARTING = "restarting"
    UNKNOWN = "unknown"

class ServiceType(str, Enum):
    """Service type enumeration"""
    API = "api"
    WORKER = "worker"
    MONITOR = "monitor"
    SCHEDULER = "scheduler"
    ANALYTICS = "analytics"

@dataclass
class HealthCheck:
    """Health check configuration"""
    endpoint: Optional[str] = None
    command: Optional[str] = None
    interval: int = 30
    timeout: int = 10
    retries: int = 3
    success_threshold: int = 1
    failure_threshold: int = 3

@dataclass
class ServiceDefinition:
    """Service definition with all configuration"""
    name: str
    command: str
    service_type: ServiceType
    port: Optional[int] = None
    working_dir: str = "."
    env_vars: Dict[str, str] = field(default_factory=dict)
    health_check: Optional[HealthCheck] = None
    auto_restart: bool = True
    restart_delay: int = 5
    max_restarts: int = 5
    restart_window: int = 300  # 5 minutes
    dependencies: List[str] = field(default_factory=list)
    stop_timeout: int = 30
    kill_timeout: int = 10
    log_file: Optional[str] = None
    pid_file: Optional[str] = None

@dataclass
class ServiceStatus:
    """Service runtime status"""
    name: str
    state: ServiceState = ServiceState.STOPPED
    pid: Optional[int] = None
    start_time: Optional[datetime] = None
    restart_count: int = 0
    last_restart: Optional[datetime] = None
    health_status: str = "unknown"
    cpu_percent: float = 0.0
    memory_mb: float = 0.0
    last_error: Optional[str] = None
    uptime_seconds: int = 0

# =============================================================================
# Process Management
# =============================================================================

class ProcessManager:
    """Advanced process management with monitoring"""
    
    def __init__(self, service_def: ServiceDefinition):
        self.service_def = service_def
        self.process: Optional[psutil.Popen] = None
        self.logger = logging.getLogger(f"ProcessManager.{service_def.name}")
        
    def start(self) -> bool:
        """Start the service process"""
        if self.is_running():
            self.logger.warning(f"Service {self.service_def.name} is already running")
            return True
            
        try:
            # Prepare environment
            env = os.environ.copy()
            env.update(self.service_def.env_vars)
            
            # Prepare command
            if isinstance(self.service_def.command, str):
                cmd = self.service_def.command.split()
            else:
                cmd = self.service_def.command
            
            # Setup logging
            log_file = None
            if self.service_def.log_file:
                os.makedirs(os.path.dirname(self.service_def.log_file), exist_ok=True)
                log_file = open(self.service_def.log_file, 'a')
            
            # Start process
            self.process = psutil.Popen(
                cmd,
                cwd=self.service_def.working_dir,
                env=env,
                stdout=log_file,
                stderr=log_file,
                start_new_session=True
            )
            
            # Write PID file
            if self.service_def.pid_file:
                os.makedirs(os.path.dirname(self.service_def.pid_file), exist_ok=True)
                with open(self.service_def.pid_file, 'w') as f:
                    f.write(str(self.process.pid))
            
            self.logger.info(f"Started {self.service_def.name} with PID {self.process.pid}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to start {self.service_def.name}: {e}")
            return False
    
    def stop(self, graceful: bool = True) -> bool:
        """Stop the service process"""
        if not self.is_running():
            return True
            
        try:
            if graceful:
                # Graceful shutdown
                self.process.terminate()
                
                # Wait for graceful shutdown
                try:
                    self.process.wait(timeout=self.service_def.stop_timeout)
                except psutil.TimeoutExpired:
                    self.logger.warning(f"Graceful shutdown timeout for {self.service_def.name}")
                    # Force kill
                    self.process.kill()
                    try:
                        self.process.wait(timeout=self.service_def.kill_timeout)
                    except psutil.TimeoutExpired:
                        self.logger.error(f"Force kill timeout for {self.service_def.name}")
                        return False
            else:
                # Force kill immediately
                self.process.kill()
                self.process.wait(timeout=self.service_def.kill_timeout)
            
            # Cleanup PID file
            if self.service_def.pid_file and os.path.exists(self.service_def.pid_file):
                os.remove(self.service_def.pid_file)
            
            self.logger.info(f"Stopped {self.service_def.name}")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to stop {self.service_def.name}: {e}")
            return False
    
    def is_running(self) -> bool:
        """Check if process is running"""
        if self.process is None:
            return False
        
        try:
            return self.process.is_running() and self.process.status() != psutil.STATUS_ZOMBIE
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return False
    
    def get_status(self) -> Dict[str, Any]:
        """Get detailed process status"""
        if not self.is_running():
            return {"running": False}
        
        try:
            with self.process.oneshot():
                return {
                    "running": True,
                    "pid": self.process.pid,
                    "status": self.process.status(),
                    "cpu_percent": self.process.cpu_percent(),
                    "memory_mb": self.process.memory_info().rss / 1024 / 1024,
                    "create_time": datetime.fromtimestamp(self.process.create_time()),
                    "cmdline": " ".join(self.process.cmdline())
                }
        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            return {"running": False, "error": str(e)}

# =============================================================================
# Health Check System
# =============================================================================

class HealthChecker:
    """Service health checking system"""
    
    def __init__(self):
        self.logger = logging.getLogger("HealthChecker")
    
    async def check_service(self, service_def: ServiceDefinition, 
                          status: ServiceStatus) -> Dict[str, Any]:
        """Perform comprehensive health check"""
        if not service_def.health_check:
            return {"status": "no_check", "healthy": True}
        
        checks = []
        
        # HTTP endpoint check
        if service_def.health_check.endpoint:
            http_result = await self._check_http_endpoint(
                service_def.health_check.endpoint,
                service_def.health_check.timeout
            )
            checks.append(("http", http_result))
        
        # Command-based check
        if service_def.health_check.command:
            cmd_result = await self._check_command(
                service_def.health_check.command,
                service_def.health_check.timeout
            )
            checks.append(("command", cmd_result))
        
        # Process health check
        if status.pid:
            process_result = self._check_process_health(status.pid)
            checks.append(("process", process_result))
        
        # Aggregate results
        healthy = all(result["healthy"] for _, result in checks)
        
        return {
            "status": "checked",
            "healthy": healthy,
            "checks": dict(checks),
            "timestamp": datetime.now().isoformat()
        }
    
    async def _check_http_endpoint(self, endpoint: str, timeout: int) -> Dict[str, Any]:
        """Check HTTP endpoint health"""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(endpoint, timeout=timeout) as response:
                    healthy = 200 <= response.status < 400
                    return {
                        "healthy": healthy,
                        "status_code": response.status,
                        "response_time_ms": 0  # Simplified for now
                    }
        except Exception as e:
            return {"healthy": False, "error": str(e)}
    
    async def _check_command(self, command: str, timeout: int) -> Dict[str, Any]:
        """Check service with custom command"""
        try:
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=timeout
                )
                
                return {
                    "healthy": process.returncode == 0,
                    "exit_code": process.returncode,
                    "stdout": stdout.decode() if stdout else "",
                    "stderr": stderr.decode() if stderr else ""
                }
            except asyncio.TimeoutError:
                process.kill()
                return {"healthy": False, "error": "timeout"}
                
        except Exception as e:
            return {"healthy": False, "error": str(e)}
    
    def _check_process_health(self, pid: int) -> Dict[str, Any]:
        """Check process-level health indicators"""
        try:
            process = psutil.Process(pid)
            
            with process.oneshot():
                cpu_percent = process.cpu_percent()
                memory_info = process.memory_info()
                memory_mb = memory_info.rss / 1024 / 1024
                
                # Simple health heuristics
                healthy = (
                    cpu_percent < 95.0 and  # Not maxed out CPU
                    memory_mb < 2048 and    # Not using excessive memory
                    process.status() != psutil.STATUS_ZOMBIE
                )
                
                return {
                    "healthy": healthy,
                    "cpu_percent": cpu_percent,
                    "memory_mb": memory_mb,
                    "status": process.status(),
                    "num_threads": process.num_threads()
                }
                
        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            return {"healthy": False, "error": str(e)}

# =============================================================================
# Main Service Manager
# =============================================================================

class EmailIntelligenceServiceManager:
    """Main service manager for Email Intelligence system"""
    
    def __init__(self, config_dir: str = "."):
        self.config_dir = Path(config_dir)
        self.services: Dict[str, ServiceDefinition] = {}
        self.status: Dict[str, ServiceStatus] = {}
        self.process_managers: Dict[str, ProcessManager] = {}
        self.health_checker = HealthChecker()
        self.running = False
        self.monitor_thread: Optional[threading.Thread] = None
        self.executor = ThreadPoolExecutor(max_workers=10)
        
        self.logger = logging.getLogger("ServiceManager")
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        # Initialize services
        self._initialize_services()
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        self.logger.info(f"Received signal {signum}, shutting down...")
        self.stop_all_services()
        sys.exit(0)
    
    def _initialize_services(self):
        """Initialize service definitions"""
        # Load environment variables
        from dotenv import load_dotenv
        load_dotenv(self.config_dir / '.env.production')
        
        # Backend API Service
        self.services["backend"] = ServiceDefinition(
            name="backend",
            command="python3 -m uvicorn backend_architecture:app --host 0.0.0.0 --port 8000 --workers 4",
            service_type=ServiceType.API,
            port=8000,
            working_dir=str(self.config_dir),
            health_check=HealthCheck(
                endpoint="http://localhost:8000/health",
                interval=30,
                timeout=10
            ),
            log_file="logs/backend.log",
            pid_file="pids/backend.pid"
        )
        
        # Real-time Email Monitor
        self.services["realtime_monitor"] = ServiceDefinition(
            name="realtime_monitor",
            command="python3 realtime_email_monitor.py",
            service_type=ServiceType.MONITOR,
            working_dir=str(self.config_dir),
            health_check=HealthCheck(
                command="python3 -c 'import psutil; exit(0)'",
                interval=60
            ),
            log_file="logs/realtime_monitor.log",
            pid_file="pids/realtime_monitor.pid"
        )
        
        # Analytics Service
        self.services["analytics"] = ServiceDefinition(
            name="analytics",
            command="python3 realtime_analytics.py --port 8001",
            service_type=ServiceType.ANALYTICS,
            port=8001,
            working_dir=str(self.config_dir),
            health_check=HealthCheck(
                endpoint="http://localhost:8001/health",
                interval=30
            ),
            log_file="logs/analytics.log",
            pid_file="pids/analytics.pid"
        )
        
        # Email Scheduler
        self.services["email_scheduler"] = ServiceDefinition(
            name="email_scheduler",
            command="python3 email_scheduler.py",
            service_type=ServiceType.SCHEDULER,
            working_dir=str(self.config_dir),
            health_check=HealthCheck(
                command="python3 -c 'import email_scheduler; exit(0)'",
                interval=120
            ),
            log_file="logs/email_scheduler.log",
            pid_file="pids/email_scheduler.pid",
            dependencies=["backend"]  # Depends on backend API
        )
        
        # Initialize status tracking
        for service_name in self.services:
            self.status[service_name] = ServiceStatus(name=service_name)
            self.process_managers[service_name] = ProcessManager(self.services[service_name])
    
    def start_service(self, service_name: str, wait_for_health: bool = True) -> bool:
        """Start a specific service"""
        if service_name not in self.services:
            self.logger.error(f"Unknown service: {service_name}")
            return False
        
        service_def = self.services[service_name]
        service_status = self.status[service_name]
        process_manager = self.process_managers[service_name]
        
        # Check dependencies
        for dep in service_def.dependencies:
            if self.status[dep].state != ServiceState.RUNNING:
                self.logger.error(f"Dependency {dep} not running for {service_name}")
                return False
        
        # Update status
        service_status.state = ServiceState.STARTING
        
        # Start process
        if not process_manager.start():
            service_status.state = ServiceState.FAILED
            return False
        
        # Update status
        service_status.state = ServiceState.RUNNING
        service_status.start_time = datetime.now()
        service_status.pid = process_manager.process.pid
        
        self.logger.info(f"Started service: {service_name}")
        
        # Wait for health check if requested
        if wait_for_health and service_def.health_check:
            self.logger.info(f"Waiting for {service_name} to become healthy...")
            if not self._wait_for_health(service_name, timeout=60):
                self.logger.warning(f"Service {service_name} started but failed health check")
        
        return True
    
    def stop_service(self, service_name: str, graceful: bool = True) -> bool:
        """Stop a specific service"""
        if service_name not in self.services:
            self.logger.error(f"Unknown service: {service_name}")
            return False
        
        service_status = self.status[service_name]
        process_manager = self.process_managers[service_name]
        
        service_status.state = ServiceState.STOPPING
        
        if process_manager.stop(graceful):
            service_status.state = ServiceState.STOPPED
            service_status.pid = None
            service_status.start_time = None
            self.logger.info(f"Stopped service: {service_name}")
            return True
        else:
            service_status.state = ServiceState.FAILED
            return False
    
    def restart_service(self, service_name: str) -> bool:
        """Restart a specific service"""
        if service_name not in self.services:
            self.logger.error(f"Unknown service: {service_name}")
            return False
        
        service_status = self.status[service_name]
        service_status.state = ServiceState.RESTARTING
        service_status.restart_count += 1
        service_status.last_restart = datetime.now()
        
        # Stop then start
        if self.stop_service(service_name):
            time.sleep(self.services[service_name].restart_delay)
            return self.start_service(service_name)
        
        return False
    
    def start_all_services(self) -> bool:
        """Start all services in dependency order"""
        self.logger.info("Starting all services...")
        
        # Topological sort for dependency order
        start_order = self._get_start_order()
        
        for service_name in start_order:
            if not self.start_service(service_name):
                self.logger.error(f"Failed to start {service_name}")
                return False
            time.sleep(2)  # Brief pause between starts
        
        self.logger.info("All services started successfully")
        return True
    
    def stop_all_services(self) -> bool:
        """Stop all services in reverse dependency order"""
        self.logger.info("Stopping all services...")
        
        # Stop in reverse order
        start_order = self._get_start_order()
        stop_order = list(reversed(start_order))
        
        success = True
        for service_name in stop_order:
            if not self.stop_service(service_name):
                self.logger.error(f"Failed to stop {service_name}")
                success = False
            time.sleep(1)
        
        return success
    
    def get_service_status(self, service_name: str) -> Optional[ServiceStatus]:
        """Get status of a specific service"""
        return self.status.get(service_name)
    
    def get_all_status(self) -> Dict[str, ServiceStatus]:
        """Get status of all services"""
        return self.status.copy()
    
    async def run_health_checks(self) -> Dict[str, Dict[str, Any]]:
        """Run health checks for all services"""
        results = {}
        
        for service_name, service_def in self.services.items():
            service_status = self.status[service_name]
            health_result = await self.health_checker.check_service(service_def, service_status)
            
            # Update service status
            service_status.health_status = "healthy" if health_result["healthy"] else "unhealthy"
            
            results[service_name] = health_result
        
        return results
    
    def start_monitoring(self):
        """Start background monitoring thread"""
        if self.monitor_thread and self.monitor_thread.is_alive():
            return
        
        self.running = True
        self.monitor_thread = threading.Thread(target=self._monitoring_loop, daemon=True)
        self.monitor_thread.start()
        self.logger.info("Started service monitoring")
    
    def stop_monitoring(self):
        """Stop background monitoring"""
        self.running = False
        if self.monitor_thread:
            self.monitor_thread.join(timeout=10)
    
    def _monitoring_loop(self):
        """Main monitoring loop"""
        while self.running:
            try:
                # Update service statuses
                self._update_service_statuses()
                
                # Check for failed services and restart if needed
                self._handle_failed_services()
                
                # Run health checks periodically
                if int(time.time()) % 60 == 0:  # Every minute
                    asyncio.run(self.run_health_checks())
                
                time.sleep(10)  # Check every 10 seconds
                
            except Exception as e:
                self.logger.error(f"Monitoring loop error: {e}")
                time.sleep(30)  # Wait longer on error
    
    def _update_service_statuses(self):
        """Update runtime status for all services"""
        for service_name, process_manager in self.process_managers.items():
            service_status = self.status[service_name]
            
            if process_manager.is_running():
                process_status = process_manager.get_status()
                if process_status["running"]:
                    service_status.pid = process_status["pid"]
                    service_status.cpu_percent = process_status.get("cpu_percent", 0.0)
                    service_status.memory_mb = process_status.get("memory_mb", 0.0)
                    
                    if service_status.start_time:
                        service_status.uptime_seconds = int(
                            (datetime.now() - service_status.start_time).total_seconds()
                        )
                else:
                    service_status.state = ServiceState.FAILED
            else:
                if service_status.state == ServiceState.RUNNING:
                    service_status.state = ServiceState.FAILED
    
    def _handle_failed_services(self):
        """Handle failed services with auto-restart logic"""
        for service_name, service_def in self.services.items():
            service_status = self.status[service_name]
            
            if (service_status.state == ServiceState.FAILED and 
                service_def.auto_restart):
                
                # Check restart limits
                if service_status.restart_count < service_def.max_restarts:
                    # Check restart window
                    if (not service_status.last_restart or 
                        (datetime.now() - service_status.last_restart).total_seconds() > service_def.restart_window):
                        
                        self.logger.warning(f"Auto-restarting failed service: {service_name}")
                        self.restart_service(service_name)
                else:
                    self.logger.error(f"Service {service_name} exceeded max restart count")
    
    def _get_start_order(self) -> List[str]:
        """Get service start order based on dependencies"""
        # Simple topological sort
        order = []
        visited = set()
        
        def visit(service_name: str):
            if service_name in visited:
                return
            
            visited.add(service_name)
            
            # Visit dependencies first
            for dep in self.services[service_name].dependencies:
                if dep in self.services:
                    visit(dep)
            
            order.append(service_name)
        
        for service_name in self.services:
            visit(service_name)
        
        return order
    
    def _wait_for_health(self, service_name: str, timeout: int = 60) -> bool:
        """Wait for service to become healthy"""
        start_time = time.time()
        
        while time.time() - start_time < timeout:
            try:
                health_result = asyncio.run(
                    self.health_checker.check_service(
                        self.services[service_name],
                        self.status[service_name]
                    )
                )
                
                if health_result["healthy"]:
                    return True
                    
            except Exception as e:
                self.logger.debug(f"Health check error for {service_name}: {e}")
            
            time.sleep(5)
        
        return False

# =============================================================================
# CLI Interface
# =============================================================================

def main():
    """Main CLI interface"""
    parser = argparse.ArgumentParser(description="Email Intelligence Service Manager")
    parser.add_argument("command", choices=[
        "start", "stop", "restart", "status", "health", "monitor"
    ], help="Command to execute")
    parser.add_argument("--service", help="Specific service name")
    parser.add_argument("--config-dir", default=".", help="Configuration directory")
    
    args = parser.parse_args()
    
    # Initialize service manager
    manager = EmailIntelligenceServiceManager(args.config_dir)
    
    try:
        if args.command == "start":
            if args.service:
                success = manager.start_service(args.service)
            else:
                success = manager.start_all_services()
            sys.exit(0 if success else 1)
            
        elif args.command == "stop":
            if args.service:
                success = manager.stop_service(args.service)
            else:
                success = manager.stop_all_services()
            sys.exit(0 if success else 1)
            
        elif args.command == "restart":
            if args.service:
                success = manager.restart_service(args.service)
            else:
                manager.stop_all_services()
                success = manager.start_all_services()
            sys.exit(0 if success else 1)
            
        elif args.command == "status":
            statuses = manager.get_all_status()
            
            print("\nEmail Intelligence Service Status")
            print("=" * 50)
            
            for service_name, status in statuses.items():
                state_color = {
                    ServiceState.RUNNING: "\033[92m",  # Green
                    ServiceState.STOPPED: "\033[91m",  # Red
                    ServiceState.FAILED: "\033[91m",   # Red
                    ServiceState.STARTING: "\033[93m", # Yellow
                }.get(status.state, "\033[0m")  # Default
                
                print(f"  {service_name}: {state_color}{status.state.value}\033[0m", end="")
                
                if status.pid:
                    print(f" (PID: {status.pid})", end="")
                if status.uptime_seconds > 0:
                    print(f" - Uptime: {status.uptime_seconds}s", end="")
                if status.restart_count > 0:
                    print(f" - Restarts: {status.restart_count}", end="")
                
                print()
            
            print()
            
        elif args.command == "health":
            health_results = asyncio.run(manager.run_health_checks())
            
            print("\nHealth Check Results")
            print("=" * 30)
            
            for service_name, result in health_results.items():
                status_icon = "✓" if result["healthy"] else "✗"
                print(f"  {status_icon} {service_name}: {'Healthy' if result['healthy'] else 'Unhealthy'}")
                
                if "checks" in result:
                    for check_type, check_result in result["checks"].items():
                        sub_icon = "✓" if check_result["healthy"] else "✗"
                        print(f"    {sub_icon} {check_type}")
            
            print()
            
        elif args.command == "monitor":
            print("Starting service monitoring (Ctrl+C to stop)...")
            manager.start_monitoring()
            
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\nStopping monitoring...")
                manager.stop_monitoring()
    
    except KeyboardInterrupt:
        print("\nShutting down...")
        manager.stop_all_services()
    except Exception as e:
        logger.error(f"Service manager error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()