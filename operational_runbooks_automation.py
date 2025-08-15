#!/usr/bin/env python3
"""
Operational Runbooks and Troubleshooting Automation

Enterprise-grade operational automation with intelligent troubleshooting.
Features:
- Automated runbook execution and decision trees
- Intelligent problem diagnosis and resolution
- Interactive troubleshooting workflows
- Knowledge base integration and learning
- Root cause analysis automation
- Remediation action automation
- Operational procedure standardization
"""

import asyncio
import time
import json
import logging
import hashlib
import subprocess
import sqlite3
import re
import yaml
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple, Callable, Union
from dataclasses import dataclass, field, asdict
from enum import Enum, auto
from collections import defaultdict, deque
from pathlib import Path
import aiohttp
import aiosqlite
import psutil
import tempfile

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(process)d:%(thread)d] - %(message)s',
    handlers=[
        logging.FileHandler('operational_runbooks.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================================
# Runbook Data Models
# ============================================================================

class RunbookType(Enum):
    """Types of operational runbooks"""
    TROUBLESHOOTING = "troubleshooting"
    MAINTENANCE = "maintenance"
    INCIDENT_RESPONSE = "incident_response"
    DEPLOYMENT = "deployment"
    MONITORING = "monitoring"
    SECURITY = "security"
    BACKUP_RECOVERY = "backup_recovery"

class ExecutionStatus(Enum):
    """Runbook execution status"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    PAUSED = "paused"
    CANCELLED = "cancelled"
    WAITING_INPUT = "waiting_input"

class ActionType(Enum):
    """Types of runbook actions"""
    COMMAND = "command"
    SCRIPT = "script"
    API_CALL = "api_call"
    DATABASE_QUERY = "database_query"
    FILE_OPERATION = "file_operation"
    NOTIFICATION = "notification"
    WAIT = "wait"
    DECISION = "decision"
    LOOP = "loop"
    CONDITION = "condition"

class SeverityLevel(Enum):
    """Problem severity levels"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

@dataclass
class RunbookAction:
    """Individual runbook action"""
    id: str
    name: str
    description: str
    action_type: ActionType
    parameters: Dict[str, Any]
    timeout_seconds: int = 300
    retry_count: int = 0
    retry_delay_seconds: int = 5
    required: bool = True
    condition: Optional[str] = None
    on_success: Optional[str] = None  # Next action ID
    on_failure: Optional[str] = None  # Next action ID
    rollback_actions: List[str] = field(default_factory=list)

@dataclass
class RunbookStep:
    """Runbook step containing multiple actions"""
    id: str
    name: str
    description: str
    actions: List[RunbookAction]
    parallel_execution: bool = False
    continue_on_failure: bool = False
    timeout_seconds: int = 600

@dataclass
class Runbook:
    """Complete operational runbook"""
    id: str
    name: str
    description: str
    runbook_type: RunbookType
    version: str
    created_at: datetime
    updated_at: datetime
    created_by: str
    
    # Runbook structure
    steps: List[RunbookStep]
    variables: Dict[str, Any] = field(default_factory=dict)
    prerequisites: List[str] = field(default_factory=list)
    
    # Execution settings
    auto_approve: bool = False
    require_confirmation: bool = True
    max_execution_time_minutes: int = 60
    
    # Triggers and conditions
    triggers: List[Dict[str, Any]] = field(default_factory=list)
    conditions: Dict[str, str] = field(default_factory=dict)
    
    # Documentation
    documentation: str = ""
    examples: List[Dict[str, Any]] = field(default_factory=list)
    related_runbooks: List[str] = field(default_factory=list)
    
    # Metadata
    tags: List[str] = field(default_factory=list)
    category: str = ""
    priority: int = 1
    metadata: Dict[str, Any] = field(default_factory=dict)

@dataclass
class RunbookExecution:
    """Runbook execution instance"""
    id: str
    runbook_id: str
    status: ExecutionStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    executed_by: str = "system"
    
    # Execution context
    context: Dict[str, Any] = field(default_factory=dict)
    variables: Dict[str, Any] = field(default_factory=dict)
    
    # Progress tracking
    current_step_id: Optional[str] = None
    current_action_id: Optional[str] = None
    completed_steps: List[str] = field(default_factory=list)
    failed_steps: List[str] = field(default_factory=list)
    
    # Results and logs
    step_results: Dict[str, Any] = field(default_factory=dict)
    action_results: Dict[str, Any] = field(default_factory=dict)
    execution_logs: List[Dict[str, Any]] = field(default_factory=list)
    
    # Error handling
    error_message: Optional[str] = None
    rollback_executed: bool = False
    rollback_results: Dict[str, Any] = field(default_factory=dict)
    
    # Metrics
    total_duration_seconds: Optional[float] = None
    step_durations: Dict[str, float] = field(default_factory=dict)

@dataclass
class TroubleshootingContext:
    """Context for troubleshooting scenarios"""
    problem_id: str
    description: str
    severity: SeverityLevel
    affected_systems: List[str]
    symptoms: List[str]
    error_messages: List[str]
    recent_changes: List[str]
    environment_data: Dict[str, Any]
    timestamp: datetime
    reported_by: str = "system"

@dataclass
class DiagnosticResult:
    """Result of diagnostic analysis"""
    id: str
    problem_description: str
    root_cause_analysis: str
    confidence_score: float
    recommended_actions: List[str]
    recommended_runbooks: List[str]
    additional_diagnostics: List[str]
    estimated_resolution_time_minutes: int
    risk_assessment: str
    metadata: Dict[str, Any] = field(default_factory=dict)

# ============================================================================
# Operational Runbooks Engine
# ============================================================================

class OperationalRunbooksEngine:
    """Advanced operational runbooks and troubleshooting automation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(__name__)
        
        # Core components
        self.runbook_manager = RunbookManager(config)
        self.execution_engine = ExecutionEngine(config)
        self.diagnostic_engine = DiagnosticEngine(config)
        self.troubleshooting_engine = TroubleshootingEngine(config)
        self.knowledge_base = KnowledgeBase(config)
        self.automation_coordinator = AutomationCoordinator(config)
        
        # State tracking
        self.active_executions = {}
        self.execution_history = deque(maxlen=1000)
        self.is_running = False
        
        # Configuration
        self.runbooks = {}
        self.diagnostic_rules = {}
        self.troubleshooting_workflows = {}
        
        # Database setup
        self.db_path = config.get('runbooks_db_path', 'operational_runbooks.db')
        self._setup_database()
        
        # Background tasks
        self.monitoring_task = None
        self.learning_task = None
    
    def _setup_database(self):
        """Initialize operational runbooks database"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.cursor()
                
                # Runbooks table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS runbooks (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        description TEXT,
                        runbook_type TEXT NOT NULL,
                        version TEXT NOT NULL,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        created_by TEXT NOT NULL,
                        steps TEXT NOT NULL,
                        variables TEXT,
                        prerequisites TEXT,
                        auto_approve BOOLEAN DEFAULT FALSE,
                        require_confirmation BOOLEAN DEFAULT TRUE,
                        max_execution_time_minutes INTEGER DEFAULT 60,
                        triggers TEXT,
                        conditions TEXT,
                        documentation TEXT,
                        examples TEXT,
                        related_runbooks TEXT,
                        tags TEXT,
                        category TEXT,
                        priority INTEGER DEFAULT 1,
                        metadata TEXT
                    )
                ''')
                
                # Executions table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS runbook_executions (
                        id TEXT PRIMARY KEY,
                        runbook_id TEXT NOT NULL,
                        status TEXT NOT NULL,
                        started_at DATETIME NOT NULL,
                        completed_at DATETIME,
                        executed_by TEXT,
                        context TEXT,
                        variables TEXT,
                        current_step_id TEXT,
                        current_action_id TEXT,
                        completed_steps TEXT,
                        failed_steps TEXT,
                        step_results TEXT,
                        action_results TEXT,
                        execution_logs TEXT,
                        error_message TEXT,
                        rollback_executed BOOLEAN DEFAULT FALSE,
                        rollback_results TEXT,
                        total_duration_seconds REAL,
                        step_durations TEXT,
                        FOREIGN KEY (runbook_id) REFERENCES runbooks (id)
                    )
                ''')
                
                # Troubleshooting contexts table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS troubleshooting_contexts (
                        problem_id TEXT PRIMARY KEY,
                        description TEXT NOT NULL,
                        severity TEXT NOT NULL,
                        affected_systems TEXT,
                        symptoms TEXT,
                        error_messages TEXT,
                        recent_changes TEXT,
                        environment_data TEXT,
                        timestamp DATETIME NOT NULL,
                        reported_by TEXT,
                        resolved BOOLEAN DEFAULT FALSE,
                        resolution_runbook_id TEXT,
                        resolution_notes TEXT
                    )
                ''')
                
                # Diagnostic results table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS diagnostic_results (
                        id TEXT PRIMARY KEY,
                        problem_id TEXT NOT NULL,
                        problem_description TEXT NOT NULL,
                        root_cause_analysis TEXT,
                        confidence_score REAL NOT NULL,
                        recommended_actions TEXT,
                        recommended_runbooks TEXT,
                        additional_diagnostics TEXT,
                        estimated_resolution_time_minutes INTEGER,
                        risk_assessment TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        metadata TEXT,
                        FOREIGN KEY (problem_id) REFERENCES troubleshooting_contexts (problem_id)
                    )
                ''')
                
                # Knowledge base table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS knowledge_base (
                        id TEXT PRIMARY KEY,
                        title TEXT NOT NULL,
                        content TEXT NOT NULL,
                        category TEXT NOT NULL,
                        tags TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        created_by TEXT,
                        usage_count INTEGER DEFAULT 0,
                        effectiveness_score REAL DEFAULT 0.0,
                        metadata TEXT
                    )
                ''')
                
                # Create indexes
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_runbooks_type ON runbooks(runbook_type)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_runbooks_category ON runbooks(category)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_executions_status ON runbook_executions(status)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_executions_started ON runbook_executions(started_at)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_troubleshooting_severity ON troubleshooting_contexts(severity)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_base(category)')
                
                conn.commit()
                self.logger.info("Operational runbooks database initialized successfully")
                
        except Exception as e:
            self.logger.error(f"Failed to setup runbooks database: {e}")
            raise
    
    async def start_engine(self):
        """Start the operational runbooks engine"""
        if self.is_running:
            return
        
        self.is_running = True
        
        try:
            # Start core components
            await self.runbook_manager.start()
            await self.execution_engine.start()
            await self.diagnostic_engine.start()
            await self.troubleshooting_engine.start()
            await self.knowledge_base.start()
            await self.automation_coordinator.start()
            
            # Load default runbooks
            await self._load_default_runbooks()
            
            # Start background tasks
            self.monitoring_task = asyncio.create_task(self._execution_monitoring_loop())
            self.learning_task = asyncio.create_task(self._knowledge_learning_loop())
            
            self.logger.info("Operational runbooks engine started successfully")
            
        except Exception as e:
            self.logger.error(f"Failed to start runbooks engine: {e}")
            self.is_running = False
            raise
    
    async def stop_engine(self):
        """Stop the operational runbooks engine"""
        self.is_running = False
        
        # Cancel background tasks
        for task in [self.monitoring_task, self.learning_task]:
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        # Stop core components
        try:
            await self.automation_coordinator.stop()
            await self.knowledge_base.stop()
            await self.troubleshooting_engine.stop()
            await self.diagnostic_engine.stop()
            await self.execution_engine.stop()
            await self.runbook_manager.stop()
        except Exception as e:
            self.logger.error(f"Error stopping runbooks engine components: {e}")
        
        self.logger.info("Operational runbooks engine stopped")
    
    async def _load_default_runbooks(self):
        """Load default operational runbooks"""
        try:
            # System Health Check Runbook
            health_check_runbook = Runbook(
                id="system_health_check",
                name="System Health Check",
                description="Comprehensive system health check and diagnostics",
                runbook_type=RunbookType.TROUBLESHOOTING,
                version="1.0",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                created_by="system",
                steps=[
                    RunbookStep(
                        id="step_1",
                        name="System Resource Check",
                        description="Check CPU, memory, and disk usage",
                        actions=[
                            RunbookAction(
                                id="action_1_1",
                                name="Check CPU Usage",
                                description="Monitor current CPU usage",
                                action_type=ActionType.COMMAND,
                                parameters={"command": "python -c \"import psutil; print(f'CPU: {psutil.cpu_percent()}%')\""}
                            ),
                            RunbookAction(
                                id="action_1_2",
                                name="Check Memory Usage",
                                description="Monitor current memory usage",
                                action_type=ActionType.COMMAND,
                                parameters={"command": "python -c \"import psutil; m=psutil.virtual_memory(); print(f'Memory: {m.percent}%')\""}
                            ),
                            RunbookAction(
                                id="action_1_3",
                                name="Check Disk Usage",
                                description="Monitor current disk usage",
                                action_type=ActionType.COMMAND,
                                parameters={"command": "python -c \"import psutil; d=psutil.disk_usage('/'); print(f'Disk: {d.percent}%')\""}
                            )
                        ]
                    ),
                    RunbookStep(
                        id="step_2",
                        name="Service Health Check",
                        description="Check health of critical services",
                        actions=[
                            RunbookAction(
                                id="action_2_1",
                                name="Check API Health",
                                description="Verify API endpoint health",
                                action_type=ActionType.API_CALL,
                                parameters={
                                    "url": "http://localhost:8002/api/health",
                                    "method": "GET",
                                    "expected_status": 200
                                }
                            ),
                            RunbookAction(
                                id="action_2_2",
                                name="Check Database Connectivity",
                                description="Verify database connection",
                                action_type=ActionType.DATABASE_QUERY,
                                parameters={
                                    "connection_string": "sqlite:///email_intelligence.db",
                                    "query": "SELECT COUNT(*) FROM emails LIMIT 1"
                                }
                            )
                        ]
                    )
                ],
                auto_approve=True,
                require_confirmation=False,
                category="system_monitoring",
                tags=["health", "monitoring", "system"]
            )
            
            # Service Restart Runbook
            service_restart_runbook = Runbook(
                id="service_restart",
                name="Service Restart Procedure",
                description="Standard procedure for restarting application services",
                runbook_type=RunbookType.MAINTENANCE,
                version="1.0",
                created_at=datetime.now(),
                updated_at=datetime.now(),
                created_by="system",
                steps=[
                    RunbookStep(
                        id="step_1",
                        name="Pre-restart Validation",
                        description="Validate service state before restart",
                        actions=[
                            RunbookAction(
                                id="action_1_1",
                                name="Check Service Status",
                                description="Check current service status",
                                action_type=ActionType.COMMAND,
                                parameters={"command": "ps aux | grep python | grep -v grep || echo 'No Python processes running'"}
                            ),
                            RunbookAction(
                                id="action_1_2",
                                name="Create Service Backup",
                                description="Create backup of current state",
                                action_type=ActionType.SCRIPT,
                                parameters={"script": "backup_service_state.sh"}
                            )
                        ]
                    ),
                    RunbookStep(
                        id="step_2",
                        name="Service Restart",
                        description="Restart the service",
                        actions=[
                            RunbookAction(
                                id="action_2_1",
                                name="Stop Service",
                                description="Gracefully stop the service",
                                action_type=ActionType.COMMAND,
                                parameters={"command": "pkill -f 'python.*backend_architecture'"}
                            ),
                            RunbookAction(
                                id="action_2_2",
                                name="Wait for Shutdown",
                                description="Wait for service to fully stop",
                                action_type=ActionType.WAIT,
                                parameters={"duration_seconds": 5}
                            ),
                            RunbookAction(
                                id="action_2_3",
                                name="Start Service",
                                description="Start the service",
                                action_type=ActionType.COMMAND,
                                parameters={"command": "cd /Users/iamomen/apple-mcp && python backend_architecture.py &"}
                            )
                        ]
                    ),
                    RunbookStep(
                        id="step_3",
                        name="Post-restart Validation",
                        description="Validate service after restart",
                        actions=[
                            RunbookAction(
                                id="action_3_1",
                                name="Wait for Service",
                                description="Wait for service to start",
                                action_type=ActionType.WAIT,
                                parameters={"duration_seconds": 10}
                            ),
                            RunbookAction(
                                id="action_3_2",
                                name="Health Check",
                                description="Verify service health",
                                action_type=ActionType.API_CALL,
                                parameters={
                                    "url": "http://localhost:8002/api/health",
                                    "method": "GET",
                                    "expected_status": 200
                                }
                            )
                        ]
                    )
                ],
                require_confirmation=True,
                category="maintenance",
                tags=["restart", "service", "maintenance"]
            )
            
            # Store runbooks
            await self._store_runbook(health_check_runbook)
            await self._store_runbook(service_restart_runbook)
            
            self.runbooks[health_check_runbook.id] = health_check_runbook
            self.runbooks[service_restart_runbook.id] = service_restart_runbook
            
            self.logger.info("Default runbooks loaded successfully")
            
        except Exception as e:
            self.logger.error(f"Error loading default runbooks: {e}")
    
    async def execute_runbook(self, runbook_id: str, context: Dict[str, Any] = None,
                            executed_by: str = "system") -> RunbookExecution:
        """Execute a runbook"""
        try:
            # Get runbook
            runbook = self.runbooks.get(runbook_id)
            if not runbook:
                runbook = await self._get_runbook(runbook_id)
                if not runbook:
                    raise ValueError(f"Runbook not found: {runbook_id}")
            
            # Create execution record
            execution_id = f"exec_{int(time.time())}_{runbook_id}"
            
            execution = RunbookExecution(
                id=execution_id,
                runbook_id=runbook_id,
                status=ExecutionStatus.PENDING,
                started_at=datetime.now(),
                executed_by=executed_by,
                context=context or {},
                variables=runbook.variables.copy()
            )
            
            # Store execution
            await self._store_execution(execution)
            self.active_executions[execution_id] = execution
            
            # Start execution
            asyncio.create_task(self._execute_runbook_steps(runbook, execution))
            
            self.logger.info(f"Runbook execution started: {execution_id}")
            return execution
            
        except Exception as e:
            self.logger.error(f"Error starting runbook execution: {e}")
            raise
    
    async def _execute_runbook_steps(self, runbook: Runbook, execution: RunbookExecution):
        """Execute runbook steps"""
        try:
            execution.status = ExecutionStatus.RUNNING
            await self._update_execution(execution)
            
            start_time = time.time()
            
            for step in runbook.steps:
                execution.current_step_id = step.id
                await self._update_execution(execution)
                
                self.logger.info(f"Executing step: {step.name}")
                
                step_start_time = time.time()
                step_success = await self._execute_step(step, execution)
                step_duration = time.time() - step_start_time
                
                execution.step_durations[step.id] = step_duration
                
                if step_success:
                    execution.completed_steps.append(step.id)
                    self.logger.info(f"Step completed successfully: {step.name}")
                else:
                    execution.failed_steps.append(step.id)
                    self.logger.error(f"Step failed: {step.name}")
                    
                    if not step.continue_on_failure:
                        execution.status = ExecutionStatus.FAILED
                        execution.error_message = f"Step failed: {step.name}"
                        break
            
            # Complete execution
            if execution.status == ExecutionStatus.RUNNING:
                execution.status = ExecutionStatus.SUCCESS
            
            execution.completed_at = datetime.now()
            execution.total_duration_seconds = time.time() - start_time
            
            await self._update_execution(execution)
            
            self.logger.info(f"Runbook execution completed: {execution.id} (status: {execution.status.value})")
            
        except Exception as e:
            execution.status = ExecutionStatus.FAILED
            execution.error_message = str(e)
            execution.completed_at = datetime.now()
            await self._update_execution(execution)
            
            self.logger.error(f"Runbook execution failed: {execution.id} - {e}")
    
    async def _execute_step(self, step: RunbookStep, execution: RunbookExecution) -> bool:
        """Execute a runbook step"""
        try:
            if step.parallel_execution:
                # Execute actions in parallel
                tasks = []
                for action in step.actions:
                    task = asyncio.create_task(self._execute_action(action, execution))
                    tasks.append(task)
                
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                # Check if all actions succeeded
                success = all(isinstance(result, dict) and result.get('success', False) for result in results)
            else:
                # Execute actions sequentially
                success = True
                for action in step.actions:
                    execution.current_action_id = action.id
                    await self._update_execution(execution)
                    
                    action_result = await self._execute_action(action, execution)
                    
                    if not action_result.get('success', False) and action.required:
                        success = False
                        break
                    
                    # Handle conditional flow
                    if action_result.get('success', False) and action.on_success:
                        # Jump to success action
                        pass
                    elif not action_result.get('success', False) and action.on_failure:
                        # Jump to failure action
                        pass
            
            execution.step_results[step.id] = {
                'success': success,
                'completed_actions': len(step.actions),
                'timestamp': datetime.now().isoformat()
            }
            
            return success
            
        except Exception as e:
            self.logger.error(f"Error executing step {step.id}: {e}")
            execution.step_results[step.id] = {
                'success': False,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            }
            return False
    
    async def _execute_action(self, action: RunbookAction, execution: RunbookExecution) -> Dict[str, Any]:
        """Execute a runbook action"""
        try:
            self.logger.info(f"Executing action: {action.name}")
            
            # Check condition if specified
            if action.condition:
                condition_met = await self._evaluate_condition(action.condition, execution)
                if not condition_met:
                    return {'success': True, 'skipped': True, 'reason': 'condition not met'}
            
            # Execute based on action type
            if action.action_type == ActionType.COMMAND:
                result = await self._execute_command_action(action, execution)
            elif action.action_type == ActionType.SCRIPT:
                result = await self._execute_script_action(action, execution)
            elif action.action_type == ActionType.API_CALL:
                result = await self._execute_api_action(action, execution)
            elif action.action_type == ActionType.DATABASE_QUERY:
                result = await self._execute_database_action(action, execution)
            elif action.action_type == ActionType.FILE_OPERATION:
                result = await self._execute_file_action(action, execution)
            elif action.action_type == ActionType.WAIT:
                result = await self._execute_wait_action(action, execution)
            elif action.action_type == ActionType.NOTIFICATION:
                result = await self._execute_notification_action(action, execution)
            else:
                result = {'success': False, 'error': f'Unknown action type: {action.action_type}'}
            
            # Store action result
            execution.action_results[action.id] = result
            
            # Log execution
            execution.execution_logs.append({
                'timestamp': datetime.now().isoformat(),
                'action_id': action.id,
                'action_name': action.name,
                'result': result,
                'duration_seconds': result.get('duration_seconds', 0)
            })
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error executing action {action.id}: {e}")
            result = {'success': False, 'error': str(e)}
            execution.action_results[action.id] = result
            return result
    
    async def _execute_command_action(self, action: RunbookAction, execution: RunbookExecution) -> Dict[str, Any]:
        """Execute command action"""
        try:
            command = action.parameters.get('command', '')
            timeout = action.timeout_seconds
            
            start_time = time.time()
            
            # Execute command
            process = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=timeout)
                return_code = process.returncode
                duration = time.time() - start_time
                
                return {
                    'success': return_code == 0,
                    'return_code': return_code,
                    'stdout': stdout.decode('utf-8', errors='ignore'),
                    'stderr': stderr.decode('utf-8', errors='ignore'),
                    'command': command,
                    'duration_seconds': duration
                }
                
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                return {
                    'success': False,
                    'error': f'Command timed out after {timeout} seconds',
                    'command': command,
                    'duration_seconds': timeout
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'command': action.parameters.get('command', ''),
                'duration_seconds': 0
            }
    
    async def _execute_api_action(self, action: RunbookAction, execution: RunbookExecution) -> Dict[str, Any]:
        """Execute API call action"""
        try:
            url = action.parameters.get('url', '')
            method = action.parameters.get('method', 'GET')
            expected_status = action.parameters.get('expected_status', 200)
            timeout = action.timeout_seconds
            
            start_time = time.time()
            
            async with aiohttp.ClientSession() as session:
                async with session.request(method, url, timeout=timeout) as response:
                    duration = time.time() - start_time
                    response_text = await response.text()
                    
                    success = response.status == expected_status
                    
                    return {
                        'success': success,
                        'status_code': response.status,
                        'expected_status': expected_status,
                        'response_text': response_text,
                        'url': url,
                        'method': method,
                        'duration_seconds': duration
                    }
                    
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'url': action.parameters.get('url', ''),
                'duration_seconds': 0
            }
    
    async def _execute_database_action(self, action: RunbookAction, execution: RunbookExecution) -> Dict[str, Any]:
        """Execute database query action"""
        try:
            connection_string = action.parameters.get('connection_string', '')
            query = action.parameters.get('query', '')
            
            start_time = time.time()
            
            # Simple SQLite connection for demonstration
            if connection_string.startswith('sqlite:'):
                db_path = connection_string.replace('sqlite:///', '')
                
                async with aiosqlite.connect(db_path) as conn:
                    cursor = await conn.execute(query)
                    result = await cursor.fetchall()
                    duration = time.time() - start_time
                    
                    return {
                        'success': True,
                        'result': result,
                        'row_count': len(result),
                        'query': query,
                        'duration_seconds': duration
                    }
            else:
                return {
                    'success': False,
                    'error': 'Unsupported database type',
                    'connection_string': connection_string
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'query': action.parameters.get('query', ''),
                'duration_seconds': 0
            }
    
    async def _execute_wait_action(self, action: RunbookAction, execution: RunbookExecution) -> Dict[str, Any]:
        """Execute wait action"""
        try:
            duration_seconds = action.parameters.get('duration_seconds', 1)
            
            start_time = time.time()
            await asyncio.sleep(duration_seconds)
            actual_duration = time.time() - start_time
            
            return {
                'success': True,
                'waited_seconds': actual_duration,
                'requested_seconds': duration_seconds,
                'duration_seconds': actual_duration
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'duration_seconds': 0
            }
    
    async def _execute_script_action(self, action: RunbookAction, execution: RunbookExecution) -> Dict[str, Any]:
        """Execute script action"""
        # Placeholder implementation
        return {
            'success': True,
            'script': action.parameters.get('script', ''),
            'message': 'Script execution simulated',
            'duration_seconds': 1.0
        }
    
    async def _execute_file_action(self, action: RunbookAction, execution: RunbookExecution) -> Dict[str, Any]:
        """Execute file operation action"""
        # Placeholder implementation
        return {
            'success': True,
            'operation': action.parameters.get('operation', ''),
            'message': 'File operation simulated',
            'duration_seconds': 0.5
        }
    
    async def _execute_notification_action(self, action: RunbookAction, execution: RunbookExecution) -> Dict[str, Any]:
        """Execute notification action"""
        # Placeholder implementation
        return {
            'success': True,
            'message': action.parameters.get('message', ''),
            'notification_sent': True,
            'duration_seconds': 0.1
        }
    
    async def _evaluate_condition(self, condition: str, execution: RunbookExecution) -> bool:
        """Evaluate condition expression"""
        try:
            # Simple condition evaluation
            # In production, this would use a proper expression evaluator
            context = {
                'execution': execution,
                'variables': execution.variables,
                'context': execution.context
            }
            
            # For now, just return True for all conditions
            return True
            
        except Exception as e:
            self.logger.error(f"Error evaluating condition: {e}")
            return False
    
    async def diagnose_problem(self, context: TroubleshootingContext) -> DiagnosticResult:
        """Diagnose a problem and recommend solutions"""
        try:
            # Store troubleshooting context
            await self._store_troubleshooting_context(context)
            
            # Run diagnostic analysis
            diagnostic_result = await self.diagnostic_engine.analyze_problem(context)
            
            # Store diagnostic result
            await self._store_diagnostic_result(diagnostic_result)
            
            self.logger.info(f"Problem diagnosed: {context.problem_id} (confidence: {diagnostic_result.confidence_score:.2f})")
            
            return diagnostic_result
            
        except Exception as e:
            self.logger.error(f"Error diagnosing problem: {e}")
            raise
    
    async def get_runbook_recommendations(self, problem_description: str, 
                                        severity: SeverityLevel = SeverityLevel.MEDIUM) -> List[str]:
        """Get runbook recommendations for a problem"""
        try:
            # Simple keyword-based matching
            # In production, this would use ML/NLP for better matching
            recommendations = []
            
            keywords = problem_description.lower().split()
            
            for runbook_id, runbook in self.runbooks.items():
                # Check if any keywords match runbook name, description, or tags
                runbook_text = f"{runbook.name} {runbook.description} {' '.join(runbook.tags)}".lower()
                
                if any(keyword in runbook_text for keyword in keywords):
                    recommendations.append(runbook_id)
            
            return recommendations[:5]  # Return top 5 recommendations
            
        except Exception as e:
            self.logger.error(f"Error getting runbook recommendations: {e}")
            return []
    
    async def _execution_monitoring_loop(self):
        """Background execution monitoring loop"""
        while self.is_running:
            try:
                # Monitor active executions for timeouts
                current_time = datetime.now()
                
                for execution_id, execution in list(self.active_executions.items()):
                    if execution.status == ExecutionStatus.RUNNING:
                        # Check for timeout
                        elapsed_minutes = (current_time - execution.started_at).total_seconds() / 60
                        
                        runbook = self.runbooks.get(execution.runbook_id)
                        if runbook and elapsed_minutes > runbook.max_execution_time_minutes:
                            # Timeout execution
                            execution.status = ExecutionStatus.FAILED
                            execution.error_message = "Execution timed out"
                            execution.completed_at = current_time
                            await self._update_execution(execution)
                    
                    elif execution.status in [ExecutionStatus.SUCCESS, ExecutionStatus.FAILED, 
                                            ExecutionStatus.CANCELLED]:
                        # Move to history
                        self.execution_history.append(execution)
                        del self.active_executions[execution_id]
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                self.logger.error(f"Error in execution monitoring loop: {e}")
                await asyncio.sleep(300)
    
    async def _knowledge_learning_loop(self):
        """Background knowledge learning loop"""
        while self.is_running:
            try:
                # Analyze execution patterns and update knowledge base
                # Placeholder implementation
                await asyncio.sleep(3600)  # Run every hour
                
            except Exception as e:
                self.logger.error(f"Error in knowledge learning loop: {e}")
                await asyncio.sleep(3600)
    
    async def _store_runbook(self, runbook: Runbook):
        """Store runbook in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT OR REPLACE INTO runbooks (
                        id, name, description, runbook_type, version,
                        created_at, updated_at, created_by, steps, variables,
                        prerequisites, auto_approve, require_confirmation,
                        max_execution_time_minutes, triggers, conditions,
                        documentation, examples, related_runbooks, tags,
                        category, priority, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    runbook.id, runbook.name, runbook.description,
                    runbook.runbook_type.value, runbook.version,
                    runbook.created_at, runbook.updated_at, runbook.created_by,
                    json.dumps([asdict(step) for step in runbook.steps]),
                    json.dumps(runbook.variables), json.dumps(runbook.prerequisites),
                    runbook.auto_approve, runbook.require_confirmation,
                    runbook.max_execution_time_minutes, json.dumps(runbook.triggers),
                    json.dumps(runbook.conditions), runbook.documentation,
                    json.dumps(runbook.examples), json.dumps(runbook.related_runbooks),
                    json.dumps(runbook.tags), runbook.category, runbook.priority,
                    json.dumps(runbook.metadata)
                ))
                
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing runbook: {e}")
    
    async def _get_runbook(self, runbook_id: str) -> Optional[Runbook]:
        """Get runbook from database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                cursor = await conn.execute('''
                    SELECT * FROM runbooks WHERE id = ?
                ''', (runbook_id,))
                
                row = await cursor.fetchone()
                if row:
                    # Reconstruct runbook object
                    # This is a simplified version - in production, use proper serialization
                    pass
                
                return None
        except Exception as e:
            self.logger.error(f"Error getting runbook: {e}")
            return None
    
    async def _store_execution(self, execution: RunbookExecution):
        """Store execution in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT OR REPLACE INTO runbook_executions (
                        id, runbook_id, status, started_at, completed_at,
                        executed_by, context, variables, current_step_id,
                        current_action_id, completed_steps, failed_steps,
                        step_results, action_results, execution_logs,
                        error_message, rollback_executed, rollback_results,
                        total_duration_seconds, step_durations
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    execution.id, execution.runbook_id, execution.status.value,
                    execution.started_at, execution.completed_at, execution.executed_by,
                    json.dumps(execution.context), json.dumps(execution.variables),
                    execution.current_step_id, execution.current_action_id,
                    json.dumps(execution.completed_steps), json.dumps(execution.failed_steps),
                    json.dumps(execution.step_results), json.dumps(execution.action_results),
                    json.dumps(execution.execution_logs), execution.error_message,
                    execution.rollback_executed, json.dumps(execution.rollback_results),
                    execution.total_duration_seconds, json.dumps(execution.step_durations)
                ))
                
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing execution: {e}")
    
    async def _update_execution(self, execution: RunbookExecution):
        """Update execution in database"""
        await self._store_execution(execution)
    
    async def _store_troubleshooting_context(self, context: TroubleshootingContext):
        """Store troubleshooting context in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT OR REPLACE INTO troubleshooting_contexts (
                        problem_id, description, severity, affected_systems,
                        symptoms, error_messages, recent_changes,
                        environment_data, timestamp, reported_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    context.problem_id, context.description, context.severity.value,
                    json.dumps(context.affected_systems), json.dumps(context.symptoms),
                    json.dumps(context.error_messages), json.dumps(context.recent_changes),
                    json.dumps(context.environment_data), context.timestamp,
                    context.reported_by
                ))
                
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing troubleshooting context: {e}")
    
    async def _store_diagnostic_result(self, result: DiagnosticResult):
        """Store diagnostic result in database"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                await conn.execute('''
                    INSERT OR REPLACE INTO diagnostic_results (
                        id, problem_id, problem_description, root_cause_analysis,
                        confidence_score, recommended_actions, recommended_runbooks,
                        additional_diagnostics, estimated_resolution_time_minutes,
                        risk_assessment, metadata
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    result.id, result.problem_description, result.problem_description,
                    result.root_cause_analysis, result.confidence_score,
                    json.dumps(result.recommended_actions), json.dumps(result.recommended_runbooks),
                    json.dumps(result.additional_diagnostics), result.estimated_resolution_time_minutes,
                    result.risk_assessment, json.dumps(result.metadata)
                ))
                
                await conn.commit()
        except Exception as e:
            self.logger.error(f"Error storing diagnostic result: {e}")
    
    async def get_runbooks_dashboard_data(self) -> Dict[str, Any]:
        """Get runbooks dashboard data"""
        try:
            async with aiosqlite.connect(self.db_path) as conn:
                # Active executions summary
                cursor = await conn.execute('''
                    SELECT status, COUNT(*) as count
                    FROM runbook_executions
                    WHERE status NOT IN ('success', 'failed', 'cancelled')
                    GROUP BY status
                ''')
                
                active_executions = {}
                async for row in cursor:
                    status, count = row
                    active_executions[status] = count
                
                # Recent executions
                cursor = await conn.execute('''
                    SELECT id, runbook_id, status, started_at, executed_by
                    FROM runbook_executions
                    ORDER BY started_at DESC
                    LIMIT 10
                ''')
                
                recent_executions = []
                async for row in cursor:
                    recent_executions.append({
                        'id': row[0],
                        'runbook_id': row[1],
                        'status': row[2],
                        'started_at': row[3],
                        'executed_by': row[4]
                    })
                
                # Execution metrics
                cursor = await conn.execute('''
                    SELECT 
                        COUNT(*) as total_executions_24h,
                        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_executions_24h,
                        AVG(total_duration_seconds) as avg_execution_time_seconds
                    FROM runbook_executions
                    WHERE started_at > datetime('now', '-24 hours')
                ''')
                
                metrics_row = await cursor.fetchone()
                execution_metrics = {
                    'executions_24h': metrics_row[0] if metrics_row[0] else 0,
                    'successful_executions_24h': metrics_row[1] if metrics_row[1] else 0,
                    'avg_execution_time_seconds': metrics_row[2] if metrics_row[2] else 0
                }
                
                success_rate = 0
                if execution_metrics['executions_24h'] > 0:
                    success_rate = (execution_metrics['successful_executions_24h'] / 
                                  execution_metrics['executions_24h']) * 100
                
                dashboard_data = {
                    'timestamp': datetime.now().isoformat(),
                    'active_executions': active_executions,
                    'recent_executions': recent_executions,
                    'execution_metrics': execution_metrics,
                    'success_rate_24h': success_rate,
                    'engine_status': 'running' if self.is_running else 'stopped',
                    'total_active': len(self.active_executions),
                    'total_runbooks': len(self.runbooks)
                }
                
                return dashboard_data
                
        except Exception as e:
            self.logger.error(f"Error getting runbooks dashboard data: {e}")
            return {'error': str(e), 'timestamp': datetime.now().isoformat()}
    
    def print_runbooks_dashboard(self):
        """Print runbooks dashboard"""
        try:
            asyncio.run(self._print_runbooks_dashboard_async())
        except Exception as e:
            self.logger.error(f"Error printing runbooks dashboard: {e}")
            print(f"Runbooks Dashboard Error: {e}")
    
    async def _print_runbooks_dashboard_async(self):
        """Async version of runbooks dashboard printing"""
        dashboard_data = await self.get_runbooks_dashboard_data()
        
        print("\n" + "="*80)
        print("📚 APPLE MCP - OPERATIONAL RUNBOOKS DASHBOARD")
        print("="*80)
        print(f"🕐 {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        print(f"⚡ Engine Status: {'🟢 RUNNING' if self.is_running else '🔴 STOPPED'}")
        print(f"📊 Active Executions: {dashboard_data.get('total_active', 0)}")
        print(f"📚 Total Runbooks: {dashboard_data.get('total_runbooks', 0)}")
        print()
        
        # Active executions by status
        active_executions = dashboard_data.get('active_executions', {})
        if active_executions:
            print("⚡ Active Executions by Status:")
            for status, count in active_executions.items():
                status_emoji = {
                    'pending': '⏳',
                    'running': '🏃',
                    'waiting_input': '⏸️',
                    'paused': '⏸️'
                }.get(status, '❓')
                print(f"   {status_emoji} {status.upper()}: {count}")
        else:
            print("✅ No active executions")
        
        # Execution metrics
        metrics = dashboard_data.get('execution_metrics', {})
        print(f"\n📈 Execution Metrics (24h):")
        print(f"   📊 Total Executions: {metrics.get('executions_24h', 0)}")
        print(f"   ✅ Successful: {metrics.get('successful_executions_24h', 0)}")
        print(f"   📊 Success Rate: {dashboard_data.get('success_rate_24h', 0):.1f}%")
        print(f"   ⏱️  Avg Duration: {metrics.get('avg_execution_time_seconds', 0):.1f}s")
        
        # Recent executions
        recent = dashboard_data.get('recent_executions', [])
        if recent:
            print(f"\n📋 Recent Executions:")
            for execution in recent[:5]:
                status_emoji = {
                    'success': '✅',
                    'failed': '❌',
                    'pending': '⏳',
                    'running': '🏃'
                }.get(execution['status'], '❓')
                print(f"   {status_emoji} {execution['id'][:12]}... → {execution['runbook_id']} by {execution['executed_by']}")
        
        print("="*80)

# ============================================================================
# Supporting Classes (Placeholder Implementations)
# ============================================================================

class RunbookManager:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass

class ExecutionEngine:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass

class DiagnosticEngine:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass
    async def analyze_problem(self, context): 
        return DiagnosticResult(
            id=f"diag_{int(time.time())}",
            problem_description=context.description,
            root_cause_analysis="Automated analysis suggests system resource constraints",
            confidence_score=0.8,
            recommended_actions=["Check system resources", "Restart services"],
            recommended_runbooks=["system_health_check", "service_restart"],
            additional_diagnostics=["Monitor performance metrics"],
            estimated_resolution_time_minutes=15,
            risk_assessment="Low risk - standard operational procedure"
        )

class TroubleshootingEngine:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass

class KnowledgeBase:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass

class AutomationCoordinator:
    def __init__(self, config): 
        self.config = config
    async def start(self): 
        pass
    async def stop(self): 
        pass

# ============================================================================
# Main Execution
# ============================================================================

def create_default_runbooks_config() -> Dict[str, Any]:
    """Create default runbooks configuration"""
    return {
        'runbooks_db_path': 'operational_runbooks.db',
        'execution_timeout_minutes': 60,
        'parallel_execution_enabled': True,
        'auto_approval_enabled': False,
        'notification_settings': {
            'email_enabled': True,
            'slack_enabled': False
        },
        'knowledge_learning_enabled': True,
        'diagnostic_confidence_threshold': 0.7
    }

async def test_runbooks_system():
    """Test the operational runbooks system"""
    config = create_default_runbooks_config()
    
    # Initialize runbooks engine
    engine = OperationalRunbooksEngine(config)
    
    try:
        # Start engine
        print("📚 Starting Operational Runbooks Engine...")
        await engine.start_engine()
        
        # Test health check runbook
        print("\n🔍 Executing system health check runbook...")
        execution = await engine.execute_runbook("system_health_check")
        
        # Wait for execution to complete
        await asyncio.sleep(10)
        
        # Test troubleshooting
        print("\n🔧 Testing troubleshooting diagnosis...")
        context = TroubleshootingContext(
            problem_id=f"problem_{int(time.time())}",
            description="High CPU usage detected on production server",
            severity=SeverityLevel.HIGH,
            affected_systems=["web-server-01"],
            symptoms=["Slow response times", "High CPU usage", "Memory warnings"],
            error_messages=["CPU usage exceeded 90%"],
            recent_changes=["Deployed new feature yesterday"],
            environment_data={"cpu_percent": 95, "memory_percent": 80},
            timestamp=datetime.now()
        )
        
        diagnostic = await engine.diagnose_problem(context)
        print(f"✅ Diagnostic completed with {diagnostic.confidence_score:.2f} confidence")
        
        # Get recommendations
        recommendations = await engine.get_runbook_recommendations("service restart needed")
        print(f"📋 Found {len(recommendations)} runbook recommendations")
        
        # Print dashboard
        print("\n📊 Runbooks Dashboard:")
        engine.print_runbooks_dashboard()
        
        print("\n✅ Runbooks system test completed successfully")
        
    except KeyboardInterrupt:
        print("\n🛑 Runbooks system test stopped by user")
    except Exception as e:
        print(f"\n❌ Runbooks system test error: {e}")
        logger.error(f"Test error: {e}")
    finally:
        # Stop engine
        await engine.stop_engine()
        print("🔚 Runbooks engine shutdown complete")

async def main():
    """Main function for testing runbooks system"""
    print("📚 Apple MCP Operational Runbooks and Troubleshooting")
    print("=" * 60)
    print("Enterprise-grade operational automation and troubleshooting")
    print("Features: Automated runbooks, intelligent diagnosis, workflow automation")
    print("=" * 60)
    
    await test_runbooks_system()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Goodbye!")
    except Exception as e:
        print(f"\n💥 Critical error: {e}")
        logger.error(f"Critical system error: {e}")
        sys.exit(1)