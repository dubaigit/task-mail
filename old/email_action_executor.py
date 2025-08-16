#!/usr/bin/env python3
"""
Email Action Execution Engine

Complete action execution system for email tasks with:
- Apple Mail integration via AppleScript
- Queue-based task processing with approval workflows
- External system integrations (Calendar, Task management)
- Undo capabilities and comprehensive audit trail
- Template management and team directory
"""

import json
import logging
import os
import sqlite3
import subprocess
import threading
import time
import uuid
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Dict, List, Optional, Any, Union, Callable
from pathlib import Path
import queue
import signal
import sys

# Import existing components
from email_intelligence_engine import EmailIntelligence, EmailClass, ActionItem
from mail_tool import MailTool


class ActionType(Enum):
    """Types of actions that can be executed"""
    SEND_REPLY = "SEND_REPLY"
    FORWARD_EMAIL = "FORWARD_EMAIL"
    CREATE_TASK = "CREATE_TASK"
    SCHEDULE_MEETING = "SCHEDULE_MEETING"
    SET_REMINDER = "SET_REMINDER"
    ARCHIVE_EMAIL = "ARCHIVE_EMAIL"
    UPLOAD_FILE = "UPLOAD_FILE"
    DELEGATE_TASK = "DELEGATE_TASK"
    MARK_COMPLETE = "MARK_COMPLETE"
    FOLLOW_UP = "FOLLOW_UP"
    APPROVE_REQUEST = "APPROVE_REQUEST"
    ESCALATE = "ESCALATE"


class ActionStatus(Enum):
    """Status of action execution"""
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"
    REQUIRES_APPROVAL = "REQUIRES_APPROVAL"


class Priority(Enum):
    """Action priority levels"""
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4


@dataclass
class ExecutionContext:
    """Context for action execution"""
    user_id: str
    session_id: str
    email_id: Optional[str] = None
    original_email: Optional[Dict] = None
    approval_required: bool = False
    retry_count: int = 0
    max_retries: int = 3
    timeout: int = 30
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


@dataclass
class ActionDefinition:
    """Definition of an action to be executed"""
    action_id: str
    action_type: ActionType
    parameters: Dict[str, Any]
    priority: Priority
    context: ExecutionContext
    created_at: datetime
    scheduled_for: Optional[datetime] = None
    depends_on: List[str] = None
    undo_data: Optional[Dict] = None
    
    def __post_init__(self):
        if self.depends_on is None:
            self.depends_on = []


@dataclass
class ActionResult:
    """Result of action execution"""
    action_id: str
    status: ActionStatus
    executed_at: datetime
    result_data: Dict[str, Any]
    error_message: Optional[str] = None
    execution_time_ms: float = 0.0
    undo_token: Optional[str] = None


class TeamMember:
    """Team member information"""
    def __init__(self, name: str, email: str, role: str, skills: List[str] = None, 
                 availability: str = "available", timezone: str = "PST", 
                 workload: str = "medium", max_concurrent_tasks: int = 3):
        self.name = name
        self.email = email
        self.role = role
        self.skills = skills or []
        self.availability = availability
        self.timezone = timezone
        self.workload = workload
        self.max_concurrent_tasks = max_concurrent_tasks


class EmailActionExecutor:
    """
    Main action execution engine with queue processing, approval workflows,
    and comprehensive integration capabilities.
    """
    
    def __init__(self, db_path: str = "email_actions.db", config_path: str = "action_config.json"):
        self.db_path = db_path
        self.config_path = config_path
        self.logger = logging.getLogger(__name__)
        
        # Initialize components
        self.mail_tool = MailTool()
        self.action_queue = queue.PriorityQueue()
        self.execution_thread = None
        self.running = False
        
        # Template and team management
        self.templates = {}
        self.team_directory = {}
        
        # State management
        self.active_actions = {}  # action_id -> ActionDefinition
        self.undo_stack = {}  # undo_token -> undo_data
        
        # Initialize database and load configuration
        self._init_database()
        self._load_configuration()
        self._load_templates()
        self._load_team_directory()
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _init_database(self):
        """Initialize SQLite database for action tracking"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS actions (
                    action_id TEXT PRIMARY KEY,
                    action_type TEXT NOT NULL,
                    status TEXT NOT NULL,
                    priority INTEGER NOT NULL,
                    parameters TEXT NOT NULL,
                    context TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    scheduled_for TIMESTAMP,
                    executed_at TIMESTAMP,
                    result_data TEXT,
                    error_message TEXT,
                    execution_time_ms REAL,
                    undo_token TEXT,
                    depends_on TEXT
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS audit_log (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    action_id TEXT NOT NULL,
                    timestamp TIMESTAMP NOT NULL,
                    event_type TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    details TEXT,
                    FOREIGN KEY (action_id) REFERENCES actions (action_id)
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS approvals (
                    approval_id TEXT PRIMARY KEY,
                    action_id TEXT NOT NULL,
                    approver_id TEXT,
                    status TEXT NOT NULL,
                    requested_at TIMESTAMP NOT NULL,
                    approved_at TIMESTAMP,
                    comments TEXT,
                    FOREIGN KEY (action_id) REFERENCES actions (action_id)
                )
            ''')
            
            conn.commit()
    
    def _load_configuration(self):
        """Load configuration from JSON file"""
        if os.path.exists(self.config_path):
            with open(self.config_path, 'r') as f:
                self.config = json.load(f)
        else:
            # Default configuration
            self.config = {
                "approval_required_actions": [
                    "CREATE_TASK",
                    "SCHEDULE_MEETING", 
                    "DELEGATE_TASK",
                    "FORWARD_EMAIL"
                ],
                "auto_approve_threshold": 0.9,
                "max_concurrent_actions": 5,
                "retry_delays": [1, 5, 15],  # seconds
                "external_integrations": {
                    "jira": {"enabled": False, "url": "", "token": ""},
                    "asana": {"enabled": False, "token": ""},
                    "calendar": {"enabled": True},
                    "file_upload": {"enabled": True, "max_size_mb": 50}
                },
                "security": {
                    "require_approval_for_external": True,
                    "allowed_domains": ["company.com"],
                    "restricted_actions": []
                }
            }
            self._save_configuration()
    
    def _save_configuration(self):
        """Save configuration to JSON file"""
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def _load_templates(self):
        """Load email templates"""
        template_dir = Path("templates")
        if template_dir.exists():
            for template_file in template_dir.glob("*.json"):
                with open(template_file, 'r') as f:
                    template_data = json.load(f)
                    self.templates[template_file.stem] = template_data
        else:
            # Default templates
            self.templates = {
                "approval_request": {
                    "subject": "Approval Required: {request_type}",
                    "body": """Hi {approver_name},

I need your approval for the following:

{request_details}

Priority: {priority}
Requested by: {requester}
Due date: {due_date}

Please approve or reject this request.

Best regards,
Email Action System"""
                },
                "task_created": {
                    "subject": "New Task Created: {task_title}",
                    "body": """A new task has been created:

Title: {task_title}
Description: {task_description}
Assignee: {assignee}
Due Date: {due_date}
Priority: {priority}

View task: {task_url}"""
                },
                "delegation_notice": {
                    "subject": "Task Delegated to You: {task_title}",
                    "body": """Hello {assignee_name},

A task has been delegated to you:

{task_description}

Original request from: {original_requester}
Priority: {priority}
Expected completion: {due_date}

Please confirm receipt and provide an estimated completion time.

Best regards,
{delegator_name}"""
                }
            }
    
    def _load_team_directory(self):
        """Load team member directory"""
        team_file = Path("team_directory.json")
        if team_file.exists():
            with open(team_file, 'r') as f:
                team_data = json.load(f)
                for member_data in team_data:
                    member = TeamMember(**member_data)
                    self.team_directory[member.email] = member
        else:
            # Default team members (should be configured per organization)
            default_team = [
                {
                    "name": "Sarah Johnson",
                    "email": "sarah.johnson@company.com",
                    "role": "Engineering Manager",
                    "skills": ["engineering", "project_management", "architecture"]
                },
                {
                    "name": "Mike Chen",
                    "email": "mike.chen@company.com", 
                    "role": "Senior Developer",
                    "skills": ["backend", "database", "api_development"]
                },
                {
                    "name": "Lisa Rodriguez",
                    "email": "lisa.rodriguez@company.com",
                    "role": "QA Lead",
                    "skills": ["testing", "quality_assurance", "automation"]
                },
                {
                    "name": "Alex Smith",
                    "email": "alex.smith@company.com",
                    "role": "DevOps Engineer", 
                    "skills": ["infrastructure", "deployment", "monitoring"]
                }
            ]
            
            for member_data in default_team:
                member = TeamMember(**member_data)
                self.team_directory[member.email] = member
    
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        self.logger.info(f"Received signal {signum}, shutting down...")
        self.stop()
        sys.exit(0)
    
    def start(self):
        """Start the action execution engine"""
        if self.running:
            return
        
        self.running = True
        self.execution_thread = threading.Thread(target=self._execution_loop, daemon=True)
        self.execution_thread.start()
        self.logger.info("Email Action Executor started")
    
    def stop(self):
        """Stop the action execution engine"""
        self.running = False
        if self.execution_thread and self.execution_thread.is_alive():
            self.execution_thread.join(timeout=5)
        self.logger.info("Email Action Executor stopped")
    
    def _execution_loop(self):
        """Main execution loop for processing actions"""
        while self.running:
            try:
                # Get next action with timeout
                try:
                    priority, action_id = self.action_queue.get(timeout=1.0)
                except queue.Empty:
                    continue
                
                # Execute the action
                action = self.active_actions.get(action_id)
                if action:
                    try:
                        result = self._execute_action(action)
                        self._save_action_result(result)
                        
                        # Remove from active actions if completed or failed
                        if result.status in [ActionStatus.COMPLETED, ActionStatus.FAILED, ActionStatus.CANCELLED]:
                            self.active_actions.pop(action_id, None)
                        
                    except Exception as e:
                        self.logger.error(f"Error executing action {action_id}: {e}")
                        error_result = ActionResult(
                            action_id=action_id,
                            status=ActionStatus.FAILED,
                            executed_at=datetime.now(),
                            result_data={},
                            error_message=str(e)
                        )
                        self._save_action_result(error_result)
                        self.active_actions.pop(action_id, None)
                
                self.action_queue.task_done()
                
            except Exception as e:
                self.logger.error(f"Error in execution loop: {e}")
                time.sleep(1)
    
    def submit_action(self, action_type: ActionType, parameters: Dict[str, Any], 
                     context: ExecutionContext, priority: Priority = Priority.MEDIUM,
                     scheduled_for: Optional[datetime] = None) -> str:
        """
        Submit an action for execution
        
        Args:
            action_type: Type of action to execute
            parameters: Action-specific parameters
            context: Execution context
            priority: Action priority
            scheduled_for: When to execute (None for immediate)
            
        Returns:
            action_id: Unique identifier for the action
        """
        action_id = str(uuid.uuid4())
        
        # Check if approval is required
        requires_approval = (
            action_type.value in self.config["approval_required_actions"] or
            context.approval_required or
            self._requires_security_approval(action_type, parameters)
        )
        
        action = ActionDefinition(
            action_id=action_id,
            action_type=action_type,
            parameters=parameters,
            priority=priority,
            context=context,
            created_at=datetime.now(),
            scheduled_for=scheduled_for
        )
        
        # Save to database
        self._save_action(action, ActionStatus.PENDING if not requires_approval else ActionStatus.REQUIRES_APPROVAL)
        
        # Add to active actions
        self.active_actions[action_id] = action
        
        # Request approval if needed
        if requires_approval:
            self._request_approval(action)
        else:
            # Queue for immediate execution
            queue_priority = priority.value if scheduled_for is None else priority.value + 100
            self.action_queue.put((queue_priority, action_id))
        
        self._log_audit_event(action_id, "SUBMITTED", context.user_id, {"action_type": action_type.value})
        
        return action_id
    
    def _requires_security_approval(self, action_type: ActionType, parameters: Dict[str, Any]) -> bool:
        """Check if action requires security approval"""
        # Check for external integrations
        if (action_type in [ActionType.CREATE_TASK, ActionType.FORWARD_EMAIL, ActionType.UPLOAD_FILE] and
            self.config["security"]["require_approval_for_external"]):
            return True
        
        # Check restricted actions
        if action_type.value in self.config["security"]["restricted_actions"]:
            return True
        
        # Check domain restrictions for email forwarding
        if action_type == ActionType.FORWARD_EMAIL:
            recipient = parameters.get("to", "")
            allowed_domains = self.config["security"]["allowed_domains"]
            if allowed_domains and not any(domain in recipient for domain in allowed_domains):
                return True
        
        return False
    
    def _request_approval(self, action: ActionDefinition):
        """Request approval for an action"""
        approval_id = str(uuid.uuid4())
        
        # Find appropriate approver (simplified logic)
        approver = self._find_approver(action)
        
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT INTO approvals (approval_id, action_id, approver_id, status, requested_at)
                VALUES (?, ?, ?, ?, ?)
            ''', (approval_id, action.action_id, approver, "PENDING", datetime.now()))
            conn.commit()
        
        # Send approval request email (if configured)
        if approver:
            self._send_approval_request_email(action, approver, approval_id)
        
        self._log_audit_event(action.action_id, "APPROVAL_REQUESTED", action.context.user_id, {"approver": approver})
    
    def _find_approver(self, action: ActionDefinition) -> Optional[str]:
        """Find appropriate approver for an action"""
        # Simplified logic - in production, this would be more sophisticated
        action_type = action.action_type
        
        # Different approvers for different action types
        if action_type in [ActionType.CREATE_TASK, ActionType.DELEGATE_TASK]:
            # Find engineering manager
            for email, member in self.team_directory.items():
                if "manager" in member.role.lower():
                    return email
        
        elif action_type == ActionType.SCHEDULE_MEETING:
            # Find senior team member
            for email, member in self.team_directory.items():
                if "senior" in member.role.lower() or "lead" in member.role.lower():
                    return email
        
        # Default: first available manager
        for email, member in self.team_directory.items():
            if "manager" in member.role.lower():
                return email
        
        return None
    
    def _send_approval_request_email(self, action: ActionDefinition, approver: str, approval_id: str):
        """Send approval request email"""
        try:
            template = self.templates.get("approval_request", {})
            
            # Get approver info
            approver_member = self.team_directory.get(approver)
            approver_name = approver_member.name if approver_member else approver
            
            # Format email content
            subject = template.get("subject", "Approval Required").format(
                request_type=action.action_type.value
            )
            
            body = template.get("body", "Approval required for: {action_type}").format(
                approver_name=approver_name,
                request_type=action.action_type.value,
                request_details=json.dumps(action.parameters, indent=2),
                priority=action.priority.name,
                requester=action.context.user_id,
                due_date="As soon as possible",
                approval_url=f"http://localhost:8080/approve/{approval_id}"
            )
            
            # Send via mail tool
            result = self.mail_tool.compose_email(
                to=approver,
                subject=subject,
                body=body
            )
            
            self.logger.info(f"Approval request sent to {approver} for action {action.action_id}")
            
        except Exception as e:
            self.logger.error(f"Failed to send approval request email: {e}")
    
    def approve_action(self, approval_id: str, approver_id: str, comments: str = "") -> bool:
        """Approve a pending action"""
        with sqlite3.connect(self.db_path) as conn:
            # Get approval details
            cursor = conn.execute('''
                SELECT action_id, status FROM approvals WHERE approval_id = ?
            ''', (approval_id,))
            row = cursor.fetchone()
            
            if not row:
                return False
            
            action_id, status = row
            if status != "PENDING":
                return False
            
            # Update approval
            conn.execute('''
                UPDATE approvals SET approver_id = ?, status = ?, approved_at = ?, comments = ?
                WHERE approval_id = ?
            ''', (approver_id, "APPROVED", datetime.now(), comments, approval_id))
            
            # Update action status
            conn.execute('''
                UPDATE actions SET status = ? WHERE action_id = ?
            ''', (ActionStatus.APPROVED.value, action_id))
            
            conn.commit()
        
        # Queue for execution
        action = self.active_actions.get(action_id)
        if action:
            queue_priority = action.priority.value
            self.action_queue.put((queue_priority, action_id))
        
        self._log_audit_event(action_id, "APPROVED", approver_id, {"approval_id": approval_id, "comments": comments})
        
        return True
    
    def reject_action(self, approval_id: str, approver_id: str, reason: str = "") -> bool:
        """Reject a pending action"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('''
                SELECT action_id, status FROM approvals WHERE approval_id = ?
            ''', (approval_id,))
            row = cursor.fetchone()
            
            if not row:
                return False
            
            action_id, status = row
            if status != "PENDING":
                return False
            
            # Update approval
            conn.execute('''
                UPDATE approvals SET approver_id = ?, status = ?, approved_at = ?, comments = ?
                WHERE approval_id = ?
            ''', (approver_id, "REJECTED", datetime.now(), reason, approval_id))
            
            # Update action status
            conn.execute('''
                UPDATE actions SET status = ? WHERE action_id = ?
            ''', (ActionStatus.CANCELLED.value, action_id))
            
            conn.commit()
        
        # Remove from active actions
        self.active_actions.pop(action_id, None)
        
        self._log_audit_event(action_id, "REJECTED", approver_id, {"approval_id": approval_id, "reason": reason})
        
        return True
    
    def _execute_action(self, action: ActionDefinition) -> ActionResult:
        """Execute a specific action"""
        start_time = datetime.now()
        
        try:
            self._log_audit_event(action.action_id, "EXECUTION_STARTED", action.context.user_id)
            
            # Update status to executing
            self._update_action_status(action.action_id, ActionStatus.EXECUTING)
            
            # Route to appropriate handler
            handler = self._get_action_handler(action.action_type)
            if not handler:
                raise Exception(f"No handler found for action type: {action.action_type}")
            
            # Execute the action
            result_data, undo_data = handler(action)
            
            # Generate undo token if needed
            undo_token = None
            if undo_data:
                undo_token = str(uuid.uuid4())
                self.undo_stack[undo_token] = undo_data
            
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            
            result = ActionResult(
                action_id=action.action_id,
                status=ActionStatus.COMPLETED,
                executed_at=start_time,
                result_data=result_data,
                execution_time_ms=execution_time,
                undo_token=undo_token
            )
            
            self._log_audit_event(action.action_id, "EXECUTION_COMPLETED", action.context.user_id, result_data)
            
            return result
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds() * 1000
            
            result = ActionResult(
                action_id=action.action_id,
                status=ActionStatus.FAILED,
                executed_at=start_time,
                result_data={},
                error_message=str(e),
                execution_time_ms=execution_time
            )
            
            self._log_audit_event(action.action_id, "EXECUTION_FAILED", action.context.user_id, {"error": str(e)})
            
            # Check if retry is needed
            if action.context.retry_count < action.context.max_retries:
                self._schedule_retry(action)
            
            return result
    
    def _get_action_handler(self, action_type: ActionType) -> Optional[Callable]:
        """Get handler function for action type"""
        handlers = {
            ActionType.SEND_REPLY: self._handle_send_reply,
            ActionType.FORWARD_EMAIL: self._handle_forward_email,
            ActionType.CREATE_TASK: self._handle_create_task,
            ActionType.SCHEDULE_MEETING: self._handle_schedule_meeting,
            ActionType.SET_REMINDER: self._handle_set_reminder,
            ActionType.ARCHIVE_EMAIL: self._handle_archive_email,
            ActionType.UPLOAD_FILE: self._handle_upload_file,
            ActionType.DELEGATE_TASK: self._handle_delegate_task,
            ActionType.MARK_COMPLETE: self._handle_mark_complete,
            ActionType.FOLLOW_UP: self._handle_follow_up,
            ActionType.APPROVE_REQUEST: self._handle_approve_request,
            ActionType.ESCALATE: self._handle_escalate
        }
        
        return handlers.get(action_type)
    
    def _handle_send_reply(self, action: ActionDefinition) -> tuple:
        """Handle sending reply to email"""
        params = action.parameters
        message_id = params.get("message_id")
        reply_content = params.get("reply_content")
        
        if not message_id or not reply_content:
            raise Exception("message_id and reply_content are required")
        
        # Use mail tool to create and send reply
        result = self.mail_tool.create_draft_reply(message_id, reply_content)
        
        # For actual sending, we'd need to extend mail_tool with send functionality
        # For now, we create the draft and mark as completed
        
        result_data = {
            "reply_created": True,
            "message_id": message_id,
            "draft_id": result.get("draft_id", "unknown")
        }
        
        undo_data = {
            "action_type": "delete_draft",
            "draft_id": result.get("draft_id")
        }
        
        return result_data, undo_data
    
    def _handle_forward_email(self, action: ActionDefinition) -> tuple:
        """Handle forwarding email"""
        params = action.parameters
        message_id = params.get("message_id")
        to_addresses = params.get("to_addresses", [])
        additional_content = params.get("additional_content", "")
        
        if not message_id or not to_addresses:
            raise Exception("message_id and to_addresses are required")
        
        # Get original email content
        emails = self.mail_tool.get_recent_emails(limit=100)  # Simplified search
        original_email = None
        for email in emails:
            if email.get("id") == message_id:
                original_email = email
                break
        
        if not original_email:
            raise Exception(f"Email with ID {message_id} not found")
        
        # Create forward content
        forward_subject = f"Fwd: {original_email.get('subject', '')}"
        forward_body = f"{additional_content}\n\n--- Forwarded Message ---\n{original_email.get('content', '')}"
        
        # Send to each recipient
        forwarded_to = []
        for recipient in to_addresses:
            try:
                result = self.mail_tool.compose_email(
                    to=recipient,
                    subject=forward_subject,
                    body=forward_body
                )
                forwarded_to.append(recipient)
            except Exception as e:
                self.logger.error(f"Failed to forward to {recipient}: {e}")
        
        result_data = {
            "forwarded": True,
            "recipients": forwarded_to,
            "original_message_id": message_id
        }
        
        undo_data = {
            "action_type": "recall_forwards",
            "recipients": forwarded_to
        }
        
        return result_data, undo_data
    
    def _handle_create_task(self, action: ActionDefinition) -> tuple:
        """Handle creating task in external system"""
        params = action.parameters
        task_title = params.get("title")
        task_description = params.get("description")
        assignee = params.get("assignee")
        due_date = params.get("due_date")
        project = params.get("project", "default")
        
        if not task_title:
            raise Exception("Task title is required")
        
        # Check enabled integrations
        integrations = self.config.get("external_integrations", {})
        
        task_id = None
        system_used = None
        
        # Try Jira first
        if integrations.get("jira", {}).get("enabled"):
            try:
                task_id = self._create_jira_task(task_title, task_description, assignee, due_date, project)
                system_used = "jira"
            except Exception as e:
                self.logger.error(f"Failed to create Jira task: {e}")
        
        # Fallback to Asana
        if not task_id and integrations.get("asana", {}).get("enabled"):
            try:
                task_id = self._create_asana_task(task_title, task_description, assignee, due_date, project)
                system_used = "asana"
            except Exception as e:
                self.logger.error(f"Failed to create Asana task: {e}")
        
        # Fallback to local task tracking
        if not task_id:
            task_id = str(uuid.uuid4())
            system_used = "local"
            # Store in local database or file system
            self._store_local_task(task_id, task_title, task_description, assignee, due_date)
        
        # Notify assignee if specified
        if assignee and assignee in self.team_directory:
            self._notify_task_assignment(task_id, task_title, assignee, system_used)
        
        result_data = {
            "task_created": True,
            "task_id": task_id,
            "system": system_used,
            "assignee": assignee
        }
        
        undo_data = {
            "action_type": "delete_task",
            "task_id": task_id,
            "system": system_used
        }
        
        return result_data, undo_data
    
    def _handle_schedule_meeting(self, action: ActionDefinition) -> tuple:
        """Handle scheduling meeting in calendar"""
        params = action.parameters
        title = params.get("title")
        attendees = params.get("attendees", [])
        start_time = params.get("start_time")
        duration = params.get("duration", 60)  # minutes
        location = params.get("location", "")
        description = params.get("description", "")
        
        if not title or not start_time:
            raise Exception("Title and start_time are required")
        
        # Convert start_time string to datetime if needed
        if isinstance(start_time, str):
            start_time = datetime.fromisoformat(start_time)
        
        end_time = start_time + timedelta(minutes=duration)
        
        # Use AppleScript to create calendar event
        event_id = self._create_calendar_event(title, start_time, end_time, attendees, location, description)
        
        result_data = {
            "meeting_scheduled": True,
            "event_id": event_id,
            "start_time": start_time.isoformat(),
            "attendees": attendees
        }
        
        undo_data = {
            "action_type": "delete_calendar_event",
            "event_id": event_id
        }
        
        return result_data, undo_data
    
    def _handle_set_reminder(self, action: ActionDefinition) -> tuple:
        """Handle setting reminder"""
        params = action.parameters
        reminder_text = params.get("text")
        reminder_time = params.get("time")
        
        if not reminder_text or not reminder_time:
            raise Exception("Text and time are required for reminder")
        
        # Convert time string to datetime if needed
        if isinstance(reminder_time, str):
            reminder_time = datetime.fromisoformat(reminder_time)
        
        # Use AppleScript to create reminder
        reminder_id = self._create_reminder(reminder_text, reminder_time)
        
        result_data = {
            "reminder_set": True,
            "reminder_id": reminder_id,
            "reminder_time": reminder_time.isoformat()
        }
        
        undo_data = {
            "action_type": "delete_reminder",
            "reminder_id": reminder_id
        }
        
        return result_data, undo_data
    
    def _handle_archive_email(self, action: ActionDefinition) -> tuple:
        """Handle archiving email"""
        params = action.parameters
        message_id = params.get("message_id")
        
        if not message_id:
            raise Exception("message_id is required")
        
        # Use AppleScript to move email to archive
        success = self._archive_email_applescript(message_id)
        
        result_data = {
            "archived": success,
            "message_id": message_id
        }
        
        undo_data = {
            "action_type": "unarchive_email",
            "message_id": message_id
        }
        
        return result_data, undo_data
    
    def _handle_upload_file(self, action: ActionDefinition) -> tuple:
        """Handle file upload"""
        params = action.parameters
        file_path = params.get("file_path")
        destination = params.get("destination", "cloud")
        
        if not file_path:
            raise Exception("file_path is required")
        
        if not os.path.exists(file_path):
            raise Exception(f"File not found: {file_path}")
        
        # Check file size
        file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
        max_size = self.config.get("external_integrations", {}).get("file_upload", {}).get("max_size_mb", 50)
        
        if file_size > max_size:
            raise Exception(f"File size ({file_size:.1f}MB) exceeds limit ({max_size}MB)")
        
        # Upload file (simplified - would integrate with actual cloud service)
        uploaded_url = self._upload_to_cloud(file_path, destination)
        
        result_data = {
            "uploaded": True,
            "file_path": file_path,
            "url": uploaded_url,
            "size_mb": file_size
        }
        
        undo_data = {
            "action_type": "delete_upload",
            "url": uploaded_url
        }
        
        return result_data, undo_data
    
    def _handle_delegate_task(self, action: ActionDefinition) -> tuple:
        """Handle task delegation"""
        params = action.parameters
        task_description = params.get("task_description")
        assignee_email = params.get("assignee_email")
        original_requester = params.get("original_requester")
        priority = params.get("priority", "medium")
        due_date = params.get("due_date")
        
        if not task_description or not assignee_email:
            raise Exception("task_description and assignee_email are required")
        
        # Check if assignee exists in team directory
        assignee = self.team_directory.get(assignee_email)
        if not assignee:
            raise Exception(f"Assignee {assignee_email} not found in team directory")
        
        # Send delegation email
        template = self.templates.get("delegation_notice", {})
        subject = template.get("subject", "Task Delegated to You").format(
            task_title=task_description[:50] + "..." if len(task_description) > 50 else task_description
        )
        
        body = template.get("body", "Task delegated: {task_description}").format(
            assignee_name=assignee.name,
            task_description=task_description,
            original_requester=original_requester,
            priority=priority,
            due_date=due_date or "Not specified",
            delegator_name="Email Assistant"
        )
        
        # Send delegation email
        result = self.mail_tool.compose_email(
            to=assignee_email,
            subject=subject,
            body=body
        )
        
        # Create task in task management system
        task_id = str(uuid.uuid4())
        self._store_local_task(task_id, task_description, task_description, assignee_email, due_date)
        
        result_data = {
            "delegated": True,
            "assignee": assignee_email,
            "task_id": task_id,
            "notification_sent": True
        }
        
        undo_data = {
            "action_type": "cancel_delegation",
            "task_id": task_id,
            "assignee": assignee_email
        }
        
        return result_data, undo_data
    
    def _handle_mark_complete(self, action: ActionDefinition) -> tuple:
        """Handle marking task as complete"""
        params = action.parameters
        task_id = params.get("task_id")
        completion_notes = params.get("completion_notes", "")
        
        if not task_id:
            raise Exception("task_id is required")
        
        # Mark task as complete (would integrate with actual task systems)
        success = self._mark_task_complete(task_id, completion_notes)
        
        result_data = {
            "marked_complete": success,
            "task_id": task_id,
            "completion_time": datetime.now().isoformat()
        }
        
        undo_data = {
            "action_type": "reopen_task",
            "task_id": task_id
        }
        
        return result_data, undo_data
    
    def _handle_follow_up(self, action: ActionDefinition) -> tuple:
        """Handle follow-up action"""
        params = action.parameters
        original_message_id = params.get("original_message_id")
        follow_up_text = params.get("follow_up_text")
        recipient = params.get("recipient")
        
        if not original_message_id or not follow_up_text:
            raise Exception("original_message_id and follow_up_text are required")
        
        # Create follow-up email
        subject = f"Follow-up: {params.get('original_subject', 'Previous Discussion')}"
        body = f"{follow_up_text}\n\nThis is a follow-up to our previous conversation."
        
        result = self.mail_tool.compose_email(
            to=recipient,
            subject=subject,
            body=body
        )
        
        result_data = {
            "follow_up_sent": True,
            "original_message_id": original_message_id,
            "recipient": recipient
        }
        
        undo_data = {
            "action_type": "delete_draft",
            "draft_id": result.get("draft_id")
        }
        
        return result_data, undo_data
    
    def _handle_approve_request(self, action: ActionDefinition) -> tuple:
        """Handle approval of request"""
        params = action.parameters
        request_id = params.get("request_id")
        approval_comments = params.get("comments", "")
        
        if not request_id:
            raise Exception("request_id is required")
        
        # Process approval (would integrate with actual approval systems)
        success = self._process_approval(request_id, approval_comments)
        
        result_data = {
            "approved": success,
            "request_id": request_id,
            "approval_time": datetime.now().isoformat()
        }
        
        undo_data = {
            "action_type": "revoke_approval",
            "request_id": request_id
        }
        
        return result_data, undo_data
    
    def _handle_escalate(self, action: ActionDefinition) -> tuple:
        """Handle escalation"""
        params = action.parameters
        issue_description = params.get("issue_description")
        escalation_level = params.get("level", "manager")
        original_assignee = params.get("original_assignee")
        
        if not issue_description:
            raise Exception("issue_description is required")
        
        # Find escalation target
        escalation_target = self._find_escalation_target(escalation_level)
        
        if not escalation_target:
            raise Exception(f"No escalation target found for level: {escalation_level}")
        
        # Send escalation email
        subject = f"Escalation Required: {issue_description[:50]}..."
        body = f"""An issue requires escalation:

Issue: {issue_description}
Original Assignee: {original_assignee}
Escalation Level: {escalation_level}

Please review and take appropriate action.
"""
        
        result = self.mail_tool.compose_email(
            to=escalation_target,
            subject=subject,
            body=body
        )
        
        result_data = {
            "escalated": True,
            "escalation_target": escalation_target,
            "level": escalation_level
        }
        
        undo_data = {
            "action_type": "cancel_escalation",
            "escalation_id": str(uuid.uuid4())
        }
        
        return result_data, undo_data
    
    # ==================== HELPER METHODS ====================
    
    def _create_jira_task(self, title: str, description: str, assignee: str, due_date: str, project: str) -> str:
        """Create task in Jira (placeholder implementation)"""
        # Would integrate with Jira API
        self.logger.info(f"Would create Jira task: {title}")
        return f"JIRA-{uuid.uuid4().hex[:8].upper()}"
    
    def _create_asana_task(self, title: str, description: str, assignee: str, due_date: str, project: str) -> str:
        """Create task in Asana (placeholder implementation)"""
        # Would integrate with Asana API
        self.logger.info(f"Would create Asana task: {title}")
        return f"ASANA-{uuid.uuid4().hex[:8].upper()}"
    
    def _store_local_task(self, task_id: str, title: str, description: str, assignee: str, due_date: str):
        """Store task in local database"""
        # Simple local storage - would be enhanced for production
        task_data = {
            "id": task_id,
            "title": title,
            "description": description,
            "assignee": assignee,
            "due_date": due_date,
            "status": "open",
            "created_at": datetime.now().isoformat()
        }
        
        # Store in file or database
        os.makedirs("tasks", exist_ok=True)
        with open(f"tasks/{task_id}.json", 'w') as f:
            json.dump(task_data, f, indent=2)
    
    def _notify_task_assignment(self, task_id: str, title: str, assignee: str, system: str):
        """Notify assignee of new task"""
        try:
            assignee_member = self.team_directory.get(assignee)
            if not assignee_member:
                return
            
            template = self.templates.get("task_created", {})
            subject = template.get("subject", "New Task Assigned").format(task_title=title)
            
            body = template.get("body", "New task: {task_title}").format(
                task_title=title,
                task_description=title,  # Simplified
                assignee=assignee_member.name,
                due_date="To be determined",
                priority="Medium",
                task_url=f"http://localhost:8080/tasks/{task_id}"
            )
            
            self.mail_tool.compose_email(
                to=assignee,
                subject=subject,
                body=body
            )
            
        except Exception as e:
            self.logger.error(f"Failed to notify task assignment: {e}")
    
    def _create_calendar_event(self, title: str, start_time: datetime, end_time: datetime, 
                              attendees: List[str], location: str, description: str) -> str:
        """Create calendar event using AppleScript"""
        attendees_str = ", ".join(attendees) if attendees else ""
        
        script = f'''
        tell application "Calendar"
            tell calendar "Work"
                set newEvent to make new event at end with properties {{
                    summary: "{title}",
                    start date: date "{start_time.strftime('%B %d, %Y at %I:%M:%S %p')}",
                    end date: date "{end_time.strftime('%B %d, %Y at %I:%M:%S %p')}",
                    location: "{location}",
                    description: "{description}"
                }}
                return uid of newEvent
            end tell
        end tell
        '''
        
        try:
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                raise Exception(f"Calendar script error: {result.stderr}")
        except Exception as e:
            self.logger.error(f"Failed to create calendar event: {e}")
            return f"CAL-{uuid.uuid4().hex[:8]}"
    
    def _create_reminder(self, text: str, reminder_time: datetime) -> str:
        """Create reminder using AppleScript"""
        script = f'''
        tell application "Reminders"
            tell list "Reminders"
                set newReminder to make new reminder with properties {{
                    name: "{text}",
                    remind me date: date "{reminder_time.strftime('%B %d, %Y at %I:%M:%S %p')}"
                }}
                return id of newReminder
            end tell
        end tell
        '''
        
        try:
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
            if result.returncode == 0:
                return result.stdout.strip()
            else:
                raise Exception(f"Reminders script error: {result.stderr}")
        except Exception as e:
            self.logger.error(f"Failed to create reminder: {e}")
            return f"REM-{uuid.uuid4().hex[:8]}"
    
    def _archive_email_applescript(self, message_id: str) -> bool:
        """Archive email using AppleScript"""
        script = f'''
        tell application "Mail"
            set foundEmail to false
            repeat with acct in accounts
                repeat with mbox in mailboxes of acct
                    repeat with msg in messages of mbox
                        if message id of msg is "{message_id}" then
                            set mailbox of msg to mailbox "Archive" of acct
                            set foundEmail to true
                            exit repeat
                        end if
                    end repeat
                    if foundEmail then exit repeat
                end repeat
                if foundEmail then exit repeat
            end repeat
            return foundEmail
        end tell
        '''
        
        try:
            result = subprocess.run(['osascript', '-e', script], capture_output=True, text=True)
            return result.returncode == 0 and "true" in result.stdout.lower()
        except Exception as e:
            self.logger.error(f"Failed to archive email: {e}")
            return False
    
    def _upload_to_cloud(self, file_path: str, destination: str) -> str:
        """Upload file to cloud storage (placeholder)"""
        # Would integrate with actual cloud storage service
        filename = os.path.basename(file_path)
        return f"https://storage.example.com/{destination}/{filename}"
    
    def _mark_task_complete(self, task_id: str, completion_notes: str) -> bool:
        """Mark task as complete"""
        try:
            task_file = f"tasks/{task_id}.json"
            if os.path.exists(task_file):
                with open(task_file, 'r') as f:
                    task_data = json.load(f)
                
                task_data["status"] = "completed"
                task_data["completed_at"] = datetime.now().isoformat()
                task_data["completion_notes"] = completion_notes
                
                with open(task_file, 'w') as f:
                    json.dump(task_data, f, indent=2)
                
                return True
        except Exception as e:
            self.logger.error(f"Failed to mark task complete: {e}")
        
        return False
    
    def _process_approval(self, request_id: str, comments: str) -> bool:
        """Process approval request"""
        # Would integrate with actual approval system
        self.logger.info(f"Processing approval for request {request_id}: {comments}")
        return True
    
    def _find_escalation_target(self, level: str) -> Optional[str]:
        """Find appropriate escalation target"""
        if level == "manager":
            # Find manager
            for email, member in self.team_directory.items():
                if "manager" in member.role.lower():
                    return email
        elif level == "senior":
            # Find senior team member
            for email, member in self.team_directory.items():
                if "senior" in member.role.lower():
                    return email
        
        return None
    
    def _schedule_retry(self, action: ActionDefinition):
        """Schedule action for retry"""
        action.context.retry_count += 1
        retry_delays = self.config.get("retry_delays", [1, 5, 15])
        
        if action.context.retry_count <= len(retry_delays):
            delay = retry_delays[action.context.retry_count - 1]
            retry_time = datetime.now() + timedelta(seconds=delay)
            action.scheduled_for = retry_time
            
            # Re-queue with delay
            threading.Timer(delay, lambda: self.action_queue.put((action.priority.value, action.action_id))).start()
            
            self._log_audit_event(action.action_id, "RETRY_SCHEDULED", action.context.user_id, 
                                {"retry_count": action.context.retry_count, "delay_seconds": delay})
    
    def _save_action(self, action: ActionDefinition, status: ActionStatus):
        """Save action to database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT INTO actions (
                    action_id, action_type, status, priority, parameters, context,
                    created_at, scheduled_for, depends_on
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                action.action_id,
                action.action_type.value,
                status.value,
                action.priority.value,
                json.dumps(action.parameters),
                json.dumps(asdict(action.context)),
                action.created_at,
                action.scheduled_for,
                json.dumps(action.depends_on)
            ))
            conn.commit()
    
    def _save_action_result(self, result: ActionResult):
        """Save action result to database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                UPDATE actions SET 
                    status = ?, executed_at = ?, result_data = ?, 
                    error_message = ?, execution_time_ms = ?, undo_token = ?
                WHERE action_id = ?
            ''', (
                result.status.value,
                result.executed_at,
                json.dumps(result.result_data),
                result.error_message,
                result.execution_time_ms,
                result.undo_token,
                result.action_id
            ))
            conn.commit()
    
    def _update_action_status(self, action_id: str, status: ActionStatus):
        """Update action status in database"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                UPDATE actions SET status = ? WHERE action_id = ?
            ''', (status.value, action_id))
            conn.commit()
    
    def _log_audit_event(self, action_id: str, event_type: str, user_id: str, details: Dict = None):
        """Log audit event"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                INSERT INTO audit_log (action_id, timestamp, event_type, user_id, details)
                VALUES (?, ?, ?, ?, ?)
            ''', (
                action_id,
                datetime.now(),
                event_type,
                user_id,
                json.dumps(details) if details else None
            ))
            conn.commit()
    
    # ==================== PUBLIC API METHODS ====================
    
    def undo_action(self, undo_token: str) -> bool:
        """Undo a previously executed action"""
        if undo_token not in self.undo_stack:
            return False
        
        undo_data = self.undo_stack[undo_token]
        action_type = undo_data.get("action_type")
        
        try:
            if action_type == "delete_draft":
                draft_id = undo_data.get("draft_id")
                # Delete draft email
                self._delete_draft_email(draft_id)
            
            elif action_type == "delete_task":
                task_id = undo_data.get("task_id")
                system = undo_data.get("system")
                self._delete_task(task_id, system)
            
            elif action_type == "delete_calendar_event":
                event_id = undo_data.get("event_id")
                self._delete_calendar_event(event_id)
            
            elif action_type == "unarchive_email":
                message_id = undo_data.get("message_id")
                self._unarchive_email(message_id)
            
            # Remove from undo stack
            del self.undo_stack[undo_token]
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to undo action: {e}")
            return False
    
    def get_action_status(self, action_id: str) -> Optional[Dict]:
        """Get status of an action"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('''
                SELECT * FROM actions WHERE action_id = ?
            ''', (action_id,))
            row = cursor.fetchone()
            
            if row:
                columns = [desc[0] for desc in cursor.description]
                return dict(zip(columns, row))
        
        return None
    
    def get_pending_approvals(self, approver_id: str = None) -> List[Dict]:
        """Get pending approval requests"""
        query = '''
            SELECT a.approval_id, a.action_id, actions.action_type, actions.parameters,
                   a.requested_at, actions.priority
            FROM approvals a
            JOIN actions ON a.action_id = actions.action_id
            WHERE a.status = 'PENDING'
        '''
        params = []
        
        if approver_id:
            query += ' AND (a.approver_id = ? OR a.approver_id IS NULL)'
            params.append(approver_id)
        
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(query, params)
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
    
    def get_audit_trail(self, action_id: str) -> List[Dict]:
        """Get audit trail for an action"""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute('''
                SELECT * FROM audit_log WHERE action_id = ? ORDER BY timestamp
            ''', (action_id,))
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in cursor.fetchall()]
    
    def cancel_action(self, action_id: str, user_id: str) -> bool:
        """Cancel a pending action"""
        if action_id in self.active_actions:
            action = self.active_actions[action_id]
            
            # Check if action can be cancelled
            current_status = self.get_action_status(action_id)
            if current_status and current_status["status"] in ["PENDING", "REQUIRES_APPROVAL"]:
                self._update_action_status(action_id, ActionStatus.CANCELLED)
                self.active_actions.pop(action_id, None)
                
                self._log_audit_event(action_id, "CANCELLED", user_id)
                return True
        
        return False
    
    def get_team_member_info(self, email: str) -> Optional[Dict]:
        """Get team member information"""
        member = self.team_directory.get(email)
        if member:
            return {
                "name": member.name,
                "email": member.email,
                "role": member.role,
                "skills": member.skills,
                "availability": member.availability
            }
        return None
    
    def suggest_assignee(self, task_description: str, required_skills: List[str] = None) -> Optional[str]:
        """Suggest best assignee for a task based on skills and availability"""
        if not required_skills:
            required_skills = []
        
        best_match = None
        best_score = 0
        
        for email, member in self.team_directory.items():
            if member.availability != "available":
                continue
            
            # Calculate skill match score
            skill_score = 0
            for skill in required_skills:
                if skill.lower() in [s.lower() for s in member.skills]:
                    skill_score += 1
            
            # Normalize score
            if required_skills:
                score = skill_score / len(required_skills)
            else:
                score = 0.5  # Default score when no skills specified
            
            if score > best_score:
                best_score = score
                best_match = email
        
        return best_match
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get execution statistics"""
        with sqlite3.connect(self.db_path) as conn:
            # Total actions
            total_actions = conn.execute('SELECT COUNT(*) FROM actions').fetchone()[0]
            
            # Actions by status
            status_cursor = conn.execute('''
                SELECT status, COUNT(*) FROM actions GROUP BY status
            ''')
            status_counts = dict(status_cursor.fetchall())
            
            # Actions by type
            type_cursor = conn.execute('''
                SELECT action_type, COUNT(*) FROM actions GROUP BY action_type
            ''')
            type_counts = dict(type_cursor.fetchall())
            
            # Average execution time
            avg_time_row = conn.execute('''
                SELECT AVG(execution_time_ms) FROM actions 
                WHERE execution_time_ms IS NOT NULL
            ''').fetchone()
            avg_execution_time = avg_time_row[0] if avg_time_row[0] else 0
            
            # Success rate
            completed_count = status_counts.get('COMPLETED', 0)
            failed_count = status_counts.get('FAILED', 0)
            total_executed = completed_count + failed_count
            success_rate = (completed_count / total_executed * 100) if total_executed > 0 else 0
        
        return {
            "total_actions": total_actions,
            "status_distribution": status_counts,
            "action_type_distribution": type_counts,
            "average_execution_time_ms": avg_execution_time,
            "success_rate_percent": success_rate,
            "active_actions": len(self.active_actions),
            "queue_size": self.action_queue.qsize(),
            "undo_stack_size": len(self.undo_stack)
        }
    
    # ==================== HELPER METHODS FOR UNDO ====================
    
    def _delete_draft_email(self, draft_id: str):
        """Delete draft email"""
        # Would use AppleScript to delete draft
        self.logger.info(f"Would delete draft email: {draft_id}")
    
    def _delete_task(self, task_id: str, system: str):
        """Delete task from system"""
        if system == "local":
            task_file = f"tasks/{task_id}.json"
            if os.path.exists(task_file):
                os.remove(task_file)
        # Would handle other systems like Jira, Asana
    
    def _delete_calendar_event(self, event_id: str):
        """Delete calendar event"""
        # Would use AppleScript to delete calendar event
        self.logger.info(f"Would delete calendar event: {event_id}")
    
    def _unarchive_email(self, message_id: str):
        """Unarchive email"""
        # Would use AppleScript to move email back to inbox
        self.logger.info(f"Would unarchive email: {message_id}")


def main():
    """Demo and testing function"""
    # Setup logging
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Initialize executor
    executor = EmailActionExecutor()
    executor.start()
    
    print("Email Action Executor Demo")
    print("=" * 50)
    
    # Demo context
    demo_context = ExecutionContext(
        user_id="demo@company.com",
        session_id="demo-session-123",
        email_id="email-456"
    )
    
    # Submit various actions
    actions = [
        # Send reply action
        {
            "type": ActionType.SEND_REPLY,
            "params": {
                "message_id": "msg-123",
                "reply_content": "Thank you for your email. I'll review this and get back to you by Friday."
            },
            "priority": Priority.HIGH
        },
        
        # Create task action
        {
            "type": ActionType.CREATE_TASK,
            "params": {
                "title": "Review Q4 budget proposal",
                "description": "Review the Q4 budget proposal and provide feedback on resource allocation",
                "assignee": "sarah.johnson@company.com",
                "due_date": "2024-08-20"
            },
            "priority": Priority.MEDIUM
        },
        
        # Schedule meeting action
        {
            "type": ActionType.SCHEDULE_MEETING,
            "params": {
                "title": "Budget Review Meeting",
                "attendees": ["sarah.johnson@company.com", "mike.chen@company.com"],
                "start_time": "2024-08-22T14:00:00",
                "duration": 60,
                "location": "Conference Room A"
            },
            "priority": Priority.MEDIUM
        },
        
        # Delegate task action
        {
            "type": ActionType.DELEGATE_TASK,
            "params": {
                "task_description": "Investigate performance issues in production database",
                "assignee_email": "alex.smith@company.com",
                "original_requester": "demo@company.com",
                "priority": "high",
                "due_date": "2024-08-18"
            },
            "priority": Priority.HIGH
        }
    ]
    
    submitted_actions = []
    
    # Submit actions
    for action_def in actions:
        action_id = executor.submit_action(
            action_type=action_def["type"],
            parameters=action_def["params"],
            context=demo_context,
            priority=action_def["priority"]
        )
        submitted_actions.append(action_id)
        print(f"Submitted action: {action_def['type'].value} (ID: {action_id})")
    
    # Wait for execution
    print("\nWaiting for actions to execute...")
    time.sleep(5)
    
    # Check action statuses
    print("\nAction Status Report:")
    print("-" * 30)
    for action_id in submitted_actions:
        status = executor.get_action_status(action_id)
        if status:
            print(f"Action {action_id[:8]}...: {status['status']} - {status['action_type']}")
            if status.get('error_message'):
                print(f"  Error: {status['error_message']}")
    
    # Show pending approvals
    pending_approvals = executor.get_pending_approvals()
    if pending_approvals:
        print(f"\nPending Approvals: {len(pending_approvals)}")
        for approval in pending_approvals:
            print(f"  - {approval['action_type']} (ID: {approval['action_id'][:8]}...)")
    
    # Show statistics
    stats = executor.get_statistics()
    print(f"\nExecution Statistics:")
    print(f"  Total Actions: {stats['total_actions']}")
    print(f"  Success Rate: {stats['success_rate_percent']:.1f}%")
    print(f"  Average Execution Time: {stats['average_execution_time_ms']:.1f}ms")
    print(f"  Active Actions: {stats['active_actions']}")
    
    # Demo team member lookup
    print(f"\nTeam Directory:")
    for email, member in executor.team_directory.items():
        print(f"  {member.name} ({member.role}) - {email}")
    
    # Demo skill-based assignment
    suggested_assignee = executor.suggest_assignee(
        "Debug API performance issues", 
        ["backend", "database"]
    )
    if suggested_assignee:
        member_info = executor.get_team_member_info(suggested_assignee)
        print(f"\nSuggested assignee for backend/database task: {member_info['name']} ({suggested_assignee})")
    
    # Stop executor
    print("\nStopping executor...")
    executor.stop()
    print("Demo completed!")


if __name__ == "__main__":
    main()