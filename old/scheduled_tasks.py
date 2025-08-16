#!/usr/bin/env python3
"""
Scheduled Tasks Management and Execution Engine

Task management and execution engine for email scheduling system.
Handles background task processing, recurring schedules, and workflow automation.

Features:
- Background task processing with Redis/Celery
- Recurring task scheduling with cron expressions  
- Task status tracking and monitoring
- Error handling and retry logic
- Task priority and queue management
- Integration with email scheduler
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import pickle
import time

# Task processing dependencies
import redis
from celery import Celery
from celery.schedules import crontab
import croniter

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """Task execution status"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    RETRYING = "retrying"
    SCHEDULED = "scheduled"


class TaskType(Enum):
    """Types of tasks"""
    EMAIL_SEND = "email_send"
    RECURRING = "recurring"
    AUTOMATION = "automation"
    CLEANUP = "cleanup"
    MONITORING = "monitoring"
    ANALYSIS = "analysis"


class TaskPriority(Enum):
    """Task priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    CRITICAL = 4


@dataclass
class TaskResult:
    """Task execution result"""
    task_id: str
    status: TaskStatus
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time_ms: float = 0.0
    retry_count: int = 0
    completed_at: Optional[datetime] = None


@dataclass
class ScheduledTask:
    """Scheduled task definition"""
    id: str
    name: str
    task_type: TaskType
    data: Dict[str, Any]
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.NORMAL
    scheduled_time: Optional[datetime] = None
    cron_schedule: Optional[str] = None  # For recurring tasks
    max_retries: int = 3
    retry_count: int = 0
    timeout_seconds: int = 300  # 5 minutes default
    created_at: datetime = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    last_run: Optional[datetime] = None
    next_run: Optional[datetime] = None
    error_message: Optional[str] = None
    result: Optional[Any] = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        
        # Calculate next run for recurring tasks
        if self.cron_schedule and not self.next_run:
            self._calculate_next_run()
    
    def _calculate_next_run(self):
        """Calculate next run time for recurring tasks"""
        if self.cron_schedule:
            try:
                cron = croniter.croniter(self.cron_schedule, datetime.now())
                self.next_run = cron.get_next(datetime)
            except Exception as e:
                logger.error(f"Error calculating next run for task {self.id}: {e}")


class TaskQueue:
    """Task queue management"""
    
    def __init__(self, redis_client: redis.Redis, queue_name: str = "default"):
        self.redis = redis_client
        self.queue_name = f"task_queue:{queue_name}"
        self.priority_queues = {
            TaskPriority.CRITICAL: f"{self.queue_name}:critical",
            TaskPriority.HIGH: f"{self.queue_name}:high", 
            TaskPriority.NORMAL: f"{self.queue_name}:normal",
            TaskPriority.LOW: f"{self.queue_name}:low"
        }
    
    def enqueue(self, task: ScheduledTask) -> bool:
        """Add task to appropriate priority queue"""
        try:
            queue_key = self.priority_queues[task.priority]
            task_data = pickle.dumps(task)
            
            # Add to Redis list (FIFO within priority level)
            self.redis.lpush(queue_key, task_data)
            
            # Track task in main index
            self.redis.hset("tasks", task.id, task_data)
            
            logger.debug(f"Enqueued task {task.id} to {queue_key}")
            return True
            
        except Exception as e:
            logger.error(f"Error enqueuing task {task.id}: {e}")
            return False
    
    def dequeue(self) -> Optional[ScheduledTask]:
        """Dequeue highest priority task"""
        # Check queues in priority order
        for priority in [TaskPriority.CRITICAL, TaskPriority.HIGH, 
                        TaskPriority.NORMAL, TaskPriority.LOW]:
            queue_key = self.priority_queues[priority]
            
            try:
                # Blocking pop with 1 second timeout
                result = self.redis.brpop(queue_key, timeout=1)
                if result:
                    _, task_data = result
                    task = pickle.loads(task_data)
                    logger.debug(f"Dequeued task {task.id} from {queue_key}")
                    return task
                    
            except Exception as e:
                logger.error(f"Error dequeuing from {queue_key}: {e}")
        
        return None
    
    def get_queue_sizes(self) -> Dict[str, int]:
        """Get size of each priority queue"""
        sizes = {}
        for priority, queue_key in self.priority_queues.items():
            try:
                size = self.redis.llen(queue_key)
                sizes[priority.name] = size
            except Exception as e:
                logger.error(f"Error getting size for {queue_key}: {e}")
                sizes[priority.name] = 0
        
        return sizes


class TaskExecutor:
    """Task execution engine"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.handlers: Dict[TaskType, Callable] = {}
        self.running = False
        self.worker_id = str(uuid.uuid4())[:8]
    
    def register_handler(self, task_type: TaskType, handler: Callable):
        """Register task handler function"""
        self.handlers[task_type] = handler
        logger.info(f"Registered handler for {task_type.value}")
    
    async def execute_task(self, task: ScheduledTask) -> TaskResult:
        """Execute a single task"""
        start_time = time.time()
        
        try:
            # Update task status
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.now()
            self._update_task(task)
            
            # Get handler
            handler = self.handlers.get(task.task_type)
            if not handler:
                raise ValueError(f"No handler registered for task type: {task.task_type}")
            
            # Execute with timeout
            try:
                result = await asyncio.wait_for(
                    self._run_handler(handler, task),
                    timeout=task.timeout_seconds
                )
                
                # Success
                execution_time = (time.time() - start_time) * 1000
                task.status = TaskStatus.COMPLETED
                task.completed_at = datetime.now()
                task.result = result
                
                self._update_task(task)
                
                return TaskResult(
                    task_id=task.id,
                    status=TaskStatus.COMPLETED,
                    result=result,
                    execution_time_ms=execution_time
                )
                
            except asyncio.TimeoutError:
                raise Exception(f"Task timed out after {task.timeout_seconds} seconds")
            
        except Exception as e:
            # Failure
            execution_time = (time.time() - start_time) * 1000
            task.status = TaskStatus.FAILED
            task.error_message = str(e)
            task.completed_at = datetime.now()
            
            self._update_task(task)
            
            logger.error(f"Task {task.id} failed: {e}")
            
            return TaskResult(
                task_id=task.id,
                status=TaskStatus.FAILED,
                error=str(e),
                execution_time_ms=execution_time,
                retry_count=task.retry_count
            )
    
    async def _run_handler(self, handler: Callable, task: ScheduledTask) -> Any:
        """Run task handler (async or sync)"""
        if asyncio.iscoroutinefunction(handler):
            return await handler(task)
        else:
            # Run sync handler in thread pool
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, handler, task)
    
    def _update_task(self, task: ScheduledTask):
        """Update task in Redis"""
        try:
            task_data = pickle.dumps(task)
            self.redis.hset("tasks", task.id, task_data)
        except Exception as e:
            logger.error(f"Error updating task {task.id}: {e}")


class RecurringTaskScheduler:
    """Manages recurring tasks based on cron schedules"""
    
    def __init__(self, task_manager):
        self.task_manager = task_manager
        self.running = False
        self.check_interval = 60  # Check every minute
    
    async def start(self):
        """Start the recurring task scheduler"""
        self.running = True
        logger.info("Starting recurring task scheduler")
        
        while self.running:
            try:
                await self._check_recurring_tasks()
                await asyncio.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Error in recurring task scheduler: {e}")
                await asyncio.sleep(5)  # Short delay on error
    
    def stop(self):
        """Stop the recurring task scheduler"""
        self.running = False
        logger.info("Stopping recurring task scheduler")
    
    async def _check_recurring_tasks(self):
        """Check for recurring tasks that need to run"""
        now = datetime.now()
        
        # Get all tasks
        tasks = self.task_manager.get_all_tasks()
        
        for task in tasks:
            if (task.cron_schedule and 
                task.status != TaskStatus.RUNNING and
                task.next_run and 
                task.next_run <= now):
                
                # Create new task instance for this run
                new_task = ScheduledTask(
                    id=str(uuid.uuid4()),
                    name=f"{task.name}_run_{now.strftime('%Y%m%d_%H%M%S')}",
                    task_type=task.task_type,
                    data=task.data.copy(),
                    priority=task.priority,
                    scheduled_time=now,
                    max_retries=task.max_retries,
                    timeout_seconds=task.timeout_seconds
                )
                
                # Enqueue the new task
                success = self.task_manager.enqueue_task(new_task)
                
                if success:
                    # Update original task's last_run and calculate next_run
                    task.last_run = now
                    task._calculate_next_run()
                    self.task_manager.update_task(task)
                    
                    logger.info(f"Scheduled recurring task: {new_task.id}")


class TaskManager:
    """Main task management system"""
    
    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client
        self.task_queue = TaskQueue(redis_client)
        self.executor = TaskExecutor(redis_client)
        self.recurring_scheduler = RecurringTaskScheduler(self)
        
        # Task registry
        self.tasks: Dict[str, ScheduledTask] = {}
        
        # Load existing tasks from Redis
        self._load_tasks()
    
    def create_task(self, name: str, task_type: TaskType, data: Dict[str, Any],
                   priority: TaskPriority = TaskPriority.NORMAL,
                   scheduled_time: Optional[datetime] = None,
                   cron_schedule: Optional[str] = None,
                   max_retries: int = 3,
                   timeout_seconds: int = 300) -> str:
        """Create a new task"""
        
        task_id = str(uuid.uuid4())
        task = ScheduledTask(
            id=task_id,
            name=name,
            task_type=task_type,
            data=data,
            priority=priority,
            scheduled_time=scheduled_time,
            cron_schedule=cron_schedule,
            max_retries=max_retries,
            timeout_seconds=timeout_seconds
        )
        
        self.tasks[task_id] = task
        self._save_task(task)
        
        # If it's a one-time task scheduled for the future, set status
        if scheduled_time and scheduled_time > datetime.now():
            task.status = TaskStatus.SCHEDULED
        
        logger.info(f"Created task: {name} ({task_id})")
        return task_id
    
    def enqueue_task(self, task: ScheduledTask) -> bool:
        """Add task to execution queue"""
        return self.task_queue.enqueue(task)
    
    def schedule_task(self, task_id: str) -> bool:
        """Schedule a task for execution"""
        task = self.get_task(task_id)
        if not task:
            return False
        
        # Check if it's time to run
        now = datetime.now()
        if task.scheduled_time and task.scheduled_time > now:
            # Not yet time to run
            return False
        
        return self.enqueue_task(task)
    
    def cancel_task(self, task_id: str) -> bool:
        """Cancel a pending task"""
        task = self.get_task(task_id)
        if not task:
            return False
        
        if task.status in [TaskStatus.RUNNING, TaskStatus.COMPLETED]:
            return False  # Cannot cancel running or completed tasks
        
        task.status = TaskStatus.CANCELLED
        self.update_task(task)
        
        logger.info(f"Cancelled task: {task_id}")
        return True
    
    def get_task(self, task_id: str) -> Optional[ScheduledTask]:
        """Get task by ID"""
        if task_id in self.tasks:
            return self.tasks[task_id]
        
        # Try loading from Redis
        try:
            task_data = self.redis.hget("tasks", task_id)
            if task_data:
                task = pickle.loads(task_data)
                self.tasks[task_id] = task
                return task
        except Exception as e:
            logger.error(f"Error loading task {task_id}: {e}")
        
        return None
    
    def get_all_tasks(self) -> List[ScheduledTask]:
        """Get all tasks"""
        # Load any tasks not in memory
        try:
            task_keys = self.redis.hkeys("tasks")
            for task_id in task_keys:
                if task_id not in self.tasks:
                    self.get_task(task_id)
        except Exception as e:
            logger.error(f"Error loading tasks: {e}")
        
        return list(self.tasks.values())
    
    def update_task(self, task: ScheduledTask):
        """Update task in memory and Redis"""
        self.tasks[task.id] = task
        self._save_task(task)
    
    def delete_task(self, task_id: str) -> bool:
        """Delete a task"""
        if task_id in self.tasks:
            del self.tasks[task_id]
        
        try:
            self.redis.hdel("tasks", task_id)
            logger.info(f"Deleted task: {task_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting task {task_id}: {e}")
            return False
    
    def get_tasks_by_status(self, status: TaskStatus) -> List[ScheduledTask]:
        """Get tasks by status"""
        return [task for task in self.get_all_tasks() if task.status == status]
    
    def get_tasks_by_type(self, task_type: TaskType) -> List[ScheduledTask]:
        """Get tasks by type"""
        return [task for task in self.get_all_tasks() if task.task_type == task_type]
    
    def get_overdue_tasks(self) -> List[ScheduledTask]:
        """Get tasks that are overdue"""
        now = datetime.now()
        return [
            task for task in self.get_all_tasks()
            if (task.scheduled_time and 
                task.scheduled_time < now and 
                task.status in [TaskStatus.PENDING, TaskStatus.SCHEDULED])
        ]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get task management statistics"""
        all_tasks = self.get_all_tasks()
        
        status_counts = {}
        for status in TaskStatus:
            status_counts[status.value] = len([t for t in all_tasks if t.status == status])
        
        type_counts = {}
        for task_type in TaskType:
            type_counts[task_type.value] = len([t for t in all_tasks if t.task_type == task_type])
        
        queue_sizes = self.task_queue.get_queue_sizes()
        
        # Calculate some performance metrics
        completed_tasks = [t for t in all_tasks if t.status == TaskStatus.COMPLETED]
        avg_execution_time = 0
        if completed_tasks:
            total_time = sum(
                (t.completed_at - t.started_at).total_seconds() 
                for t in completed_tasks 
                if t.started_at and t.completed_at
            )
            avg_execution_time = total_time / len(completed_tasks)
        
        return {
            "total_tasks": len(all_tasks),
            "status_counts": status_counts,
            "type_counts": type_counts,
            "queue_sizes": queue_sizes,
            "overdue_tasks": len(self.get_overdue_tasks()),
            "avg_execution_time_seconds": avg_execution_time,
            "recurring_tasks": len([t for t in all_tasks if t.cron_schedule])
        }
    
    def cleanup_old_tasks(self, days_old: int = 30):
        """Clean up old completed/failed tasks"""
        cutoff_date = datetime.now() - timedelta(days=days_old)
        cleaned_count = 0
        
        for task in self.get_all_tasks():
            if (task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED] and
                task.completed_at and task.completed_at < cutoff_date):
                
                self.delete_task(task.id)
                cleaned_count += 1
        
        logger.info(f"Cleaned up {cleaned_count} old tasks")
        return cleaned_count
    
    def register_task_handler(self, task_type: TaskType, handler: Callable):
        """Register a task handler"""
        self.executor.register_handler(task_type, handler)
    
    async def start_worker(self):
        """Start task worker to process queued tasks"""
        logger.info("Starting task worker")
        
        while True:
            try:
                # Get next task from queue
                task = self.task_queue.dequeue()
                if task:
                    # Execute the task
                    result = await self.executor.execute_task(task)
                    
                    # Handle retry logic
                    if (result.status == TaskStatus.FAILED and 
                        task.retry_count < task.max_retries):
                        
                        task.retry_count += 1
                        task.status = TaskStatus.RETRYING
                        
                        # Re-enqueue with delay
                        await asyncio.sleep(min(60 * task.retry_count, 300))  # Exponential backoff, max 5 min
                        self.enqueue_task(task)
                        
                        logger.info(f"Retrying task {task.id} (attempt {task.retry_count})")
                
                else:
                    # No tasks available, short sleep
                    await asyncio.sleep(1)
                    
            except Exception as e:
                logger.error(f"Error in task worker: {e}")
                await asyncio.sleep(5)  # Short delay on error
    
    async def start_scheduler(self):
        """Start scheduled task processor"""
        logger.info("Starting scheduled task processor")
        
        while True:
            try:
                # Check for tasks that need to be scheduled
                now = datetime.now()
                scheduled_tasks = self.get_tasks_by_status(TaskStatus.SCHEDULED)
                
                for task in scheduled_tasks:
                    if task.scheduled_time and task.scheduled_time <= now:
                        success = self.enqueue_task(task)
                        if success:
                            logger.info(f"Enqueued scheduled task: {task.id}")
                
                # Check for overdue tasks
                overdue_tasks = self.get_overdue_tasks()
                for task in overdue_tasks:
                    logger.warning(f"Task {task.id} is overdue by {now - task.scheduled_time}")
                    # Could implement overdue handling logic here
                
                await asyncio.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.error(f"Error in scheduled task processor: {e}")
                await asyncio.sleep(5)
    
    async def start_recurring_scheduler(self):
        """Start recurring task scheduler"""
        await self.recurring_scheduler.start()
    
    def _save_task(self, task: ScheduledTask):
        """Save task to Redis"""
        try:
            task_data = pickle.dumps(task)
            self.redis.hset("tasks", task.id, task_data)
        except Exception as e:
            logger.error(f"Error saving task {task.id}: {e}")
    
    def _load_tasks(self):
        """Load all tasks from Redis"""
        try:
            task_data = self.redis.hgetall("tasks")
            for task_id, data in task_data.items():
                try:
                    task = pickle.loads(data)
                    self.tasks[task_id] = task
                except Exception as e:
                    logger.error(f"Error loading task {task_id}: {e}")
            
            logger.info(f"Loaded {len(self.tasks)} tasks from Redis")
            
        except Exception as e:
            logger.error(f"Error loading tasks: {e}")


# ==================== DEFAULT TASK HANDLERS ====================

async def email_send_handler(task: ScheduledTask) -> Dict[str, Any]:
    """Handler for email sending tasks"""
    from applescript_integration import AppleScriptMailer
    
    mailer = AppleScriptMailer()
    data = task.data
    
    success = mailer.send_email(
        to=data.get("to"),
        subject=data.get("subject"),
        body=data.get("body"),
        cc=data.get("cc"),
        bcc=data.get("bcc")
    )
    
    return {
        "success": success,
        "sent_at": datetime.now().isoformat(),
        "recipient": data.get("to")
    }


def cleanup_handler(task: ScheduledTask) -> Dict[str, Any]:
    """Handler for cleanup tasks"""
    data = task.data
    days_old = data.get("days_old", 30)
    
    # This would be called with the task manager instance
    # In practice, you'd pass the task manager to the handler
    cleaned_count = 0  # Placeholder
    
    return {
        "cleaned_count": cleaned_count,
        "days_old": days_old
    }


def monitoring_handler(task: ScheduledTask) -> Dict[str, Any]:
    """Handler for monitoring tasks"""
    # Collect system metrics, check health, etc.
    import psutil
    
    return {
        "cpu_percent": psutil.cpu_percent(),
        "memory_percent": psutil.virtual_memory().percent,
        "disk_usage": psutil.disk_usage('/').percent,
        "timestamp": datetime.now().isoformat()
    }


# ==================== UTILITY FUNCTIONS ====================

def create_email_task(task_manager: TaskManager, to: str, subject: str, body: str,
                     scheduled_time: Optional[datetime] = None,
                     priority: TaskPriority = TaskPriority.NORMAL,
                     cc: Optional[str] = None, bcc: Optional[str] = None) -> str:
    """Helper function to create an email sending task"""
    
    data = {
        "to": to,
        "subject": subject,
        "body": body,
        "cc": cc,
        "bcc": bcc
    }
    
    return task_manager.create_task(
        name=f"Send email to {to}",
        task_type=TaskType.EMAIL_SEND,
        data=data,
        priority=priority,
        scheduled_time=scheduled_time
    )


def create_recurring_cleanup_task(task_manager: TaskManager, 
                                 cron_schedule: str = "0 2 * * *",  # Daily at 2 AM
                                 days_old: int = 30) -> str:
    """Helper function to create a recurring cleanup task"""
    
    data = {"days_old": days_old}
    
    return task_manager.create_task(
        name="Daily cleanup",
        task_type=TaskType.CLEANUP,
        data=data,
        cron_schedule=cron_schedule,
        priority=TaskPriority.LOW
    )


def create_monitoring_task(task_manager: TaskManager,
                          cron_schedule: str = "*/5 * * * *") -> str:  # Every 5 minutes
    """Helper function to create a recurring monitoring task"""
    
    return task_manager.create_task(
        name="System monitoring",
        task_type=TaskType.MONITORING,
        data={},
        cron_schedule=cron_schedule,
        priority=TaskPriority.LOW
    )


# ==================== TESTING AND DEMO ====================

async def demo_task_manager():
    """Demo the task management system"""
    
    # Mock Redis for demo
    from email_scheduler import MockRedis
    redis_client = MockRedis()
    
    # Create task manager
    task_manager = TaskManager(redis_client)
    
    # Register handlers
    task_manager.register_task_handler(TaskType.EMAIL_SEND, email_send_handler)
    task_manager.register_task_handler(TaskType.CLEANUP, cleanup_handler)
    task_manager.register_task_handler(TaskType.MONITORING, monitoring_handler)
    
    # Create some test tasks
    email_task_id = create_email_task(
        task_manager,
        to="test@example.com",
        subject="Test Email",
        body="This is a test email from the task manager",
        scheduled_time=datetime.now() + timedelta(seconds=5)
    )
    
    cleanup_task_id = create_recurring_cleanup_task(task_manager)
    monitoring_task_id = create_monitoring_task(task_manager)
    
    print(f"Created tasks:")
    print(f"  Email: {email_task_id}")
    print(f"  Cleanup: {cleanup_task_id}")
    print(f"  Monitoring: {monitoring_task_id}")
    
    # Show stats
    stats = task_manager.get_stats()
    print(f"\nTask Manager Stats:")
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    # Start workers (in practice, these would run in separate processes)
    print("\nStarting workers...")
    
    # For demo, just process one task
    task = task_manager.get_task(email_task_id)
    if task and task.scheduled_time <= datetime.now():
        result = await task_manager.executor.execute_task(task)
        print(f"Task result: {result}")


if __name__ == "__main__":
    asyncio.run(demo_task_manager())