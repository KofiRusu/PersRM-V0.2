"""
Autonomy Loop for PersLM

This module implements an autonomous execution loop that allows PersLM to
perform tasks, reason about its actions, and improve itself without direct
human supervision.
"""

import os
import sys
import time
import json
import yaml
import logging
import threading
import datetime
import tempfile
import importlib
import traceback
from typing import Optional, Dict, Any, List, Union, Tuple, Callable
from pathlib import Path
from enum import Enum
from dataclasses import dataclass, field

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Import PersLM modules
from loop.feedback_logger import FeedbackLogger, FeedbackCategory
try:
    from src.memory import Memory
except ImportError:
    # Create a stub if not available
    class Memory:
        def add(self, *args, **kwargs): pass
        def query(self, *args, **kwargs): return []
        def save(self, *args, **kwargs): pass

try:
    from src.personalization import PersonalizationManager
except ImportError:
    # Create a stub if not available
    class PersonalizationManager:
        def __init__(self, *args, **kwargs): pass
        def get_profile(self, *args, **kwargs): return {}
        def update_profile(self, *args, **kwargs): pass

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """Status of an autonomous task."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(Enum):
    """Priority levels for tasks."""
    LOW = 0
    MEDIUM = 1
    HIGH = 2
    CRITICAL = 3


@dataclass
class Task:
    """
    A task to be executed autonomously by the system.
    """
    id: str  # Unique task identifier
    name: str  # Task name
    description: str  # Detailed description
    priority: TaskPriority = TaskPriority.MEDIUM  # Task priority
    status: TaskStatus = TaskStatus.PENDING  # Current status
    created_at: float = field(default_factory=time.time)  # Creation timestamp
    scheduled_at: Optional[float] = None  # When to execute (None = ASAP)
    deadline: Optional[float] = None  # Deadline timestamp (None = no deadline)
    dependencies: List[str] = field(default_factory=list)  # IDs of tasks this depends on
    tags: List[str] = field(default_factory=list)  # For categorization
    data: Dict[str, Any] = field(default_factory=dict)  # Task-specific data
    handler: Optional[str] = None  # Task handler name
    result: Optional[Dict[str, Any]] = None  # Task result
    error: Optional[str] = None  # Error message if failed
    started_at: Optional[float] = None  # When execution started
    completed_at: Optional[float] = None  # When execution completed
    owner: str = "system"  # Who/what created the task
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "priority": self.priority.value if isinstance(self.priority, TaskPriority) else self.priority,
            "status": self.status.value if isinstance(self.status, TaskStatus) else self.status,
            "created_at": self.created_at,
            "scheduled_at": self.scheduled_at,
            "deadline": self.deadline,
            "dependencies": self.dependencies,
            "tags": self.tags,
            "data": self.data,
            "handler": self.handler,
            "result": self.result,
            "error": self.error,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "owner": self.owner
        }
        
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Task':
        """Create Task from dictionary."""
        # Convert status and priority strings to enums if needed
        status = data.get("status", "pending")
        if isinstance(status, str):
            status = TaskStatus(status)
            
        priority = data.get("priority", 1)
        if isinstance(priority, int):
            for p in TaskPriority:
                if p.value == priority:
                    priority = p
                    break
        
        return Task(
            id=data["id"],
            name=data["name"],
            description=data["description"],
            priority=priority,
            status=status,
            created_at=data.get("created_at", time.time()),
            scheduled_at=data.get("scheduled_at"),
            deadline=data.get("deadline"),
            dependencies=data.get("dependencies", []),
            tags=data.get("tags", []),
            data=data.get("data", {}),
            handler=data.get("handler"),
            result=data.get("result"),
            error=data.get("error"),
            started_at=data.get("started_at"),
            completed_at=data.get("completed_at"),
            owner=data.get("owner", "system")
        )


class ReflectionType(Enum):
    """Types of system reflection."""
    PERFORMANCE = "performance"  # Evaluate task performance
    PLANNING = "planning"  # Reflect on planning and prioritization
    IMPROVEMENT = "improvement"  # Identify improvement opportunities
    ERROR = "error"  # Analyze errors and failures


@dataclass
class Reflection:
    """
    A system reflection capturing insights and improvements.
    """
    id: str  # Unique reflection identifier
    reflection_type: ReflectionType  # Type of reflection
    content: str  # Reflection content
    insights: List[str] = field(default_factory=list)  # Key insights
    action_items: List[str] = field(default_factory=list)  # Action items
    created_at: float = field(default_factory=time.time)  # Creation timestamp
    task_id: Optional[str] = None  # Related task ID if applicable
    metrics: Dict[str, Any] = field(default_factory=dict)  # Related metrics
    tags: List[str] = field(default_factory=list)  # For categorization
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "id": self.id,
            "reflection_type": self.reflection_type.value if isinstance(self.reflection_type, ReflectionType) else self.reflection_type,
            "content": self.content,
            "insights": self.insights,
            "action_items": self.action_items,
            "created_at": self.created_at,
            "task_id": self.task_id,
            "metrics": self.metrics,
            "tags": self.tags
        }
        
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'Reflection':
        """Create Reflection from dictionary."""
        reflection_type = data.get("reflection_type", "performance")
        if isinstance(reflection_type, str):
            try:
                reflection_type = ReflectionType(reflection_type)
            except ValueError:
                reflection_type = ReflectionType.PERFORMANCE
                
        return Reflection(
            id=data["id"],
            reflection_type=reflection_type,
            content=data["content"],
            insights=data.get("insights", []),
            action_items=data.get("action_items", []),
            created_at=data.get("created_at", time.time()),
            task_id=data.get("task_id"),
            metrics=data.get("metrics", {}),
            tags=data.get("tags", [])
        )


class TaskScheduler:
    """
    Schedules and manages autonomous tasks.
    """
    
    def __init__(
        self,
        task_dir: Optional[str] = None,
        memory: Optional[Memory] = None,
        log_level: str = "INFO",
        config: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize task scheduler.
        
        Args:
            task_dir: Directory to store task data
            memory: Memory instance for storage
            log_level: Logging level
            config: Configuration dictionary
        """
        # Set up logging
        numeric_level = getattr(logging, log_level.upper(), None)
        if not isinstance(numeric_level, int):
            numeric_level = logging.INFO
        logger.setLevel(numeric_level)
        
        # Set up task storage
        if task_dir:
            self.task_dir = Path(task_dir)
        else:
            self.task_dir = Path("data/tasks")
            
        os.makedirs(self.task_dir, exist_ok=True)
        
        # Store memory instance
        self.memory = memory
        
        # Use provided config or defaults
        self.config = config or {}
        
        # Task handlers registry
        self.task_handlers: Dict[str, Callable[[Task], Dict[str, Any]]] = {}
        
        # Tasks
        self.tasks: Dict[str, Task] = {}  # All tasks by ID
        self.running_tasks: Dict[str, Task] = {}  # Currently running tasks
        self.pending_tasks: List[Task] = []  # Tasks ready to run
        self.scheduled_tasks: List[Task] = []  # Future scheduled tasks
        
        # Lock for thread safety
        self.task_lock = threading.RLock()
        
        # Load existing tasks
        self.load_tasks()
        
        logger.info(f"Task scheduler initialized (task_dir={self.task_dir})")
        
    def register_handler(
        self, 
        name: str, 
        handler: Callable[[Task], Dict[str, Any]]
    ) -> None:
        """
        Register a task handler function.
        
        Args:
            name: Handler name
            handler: Handler function that takes a Task and returns a result dict
        """
        self.task_handlers[name] = handler
        logger.debug(f"Registered task handler: {name}")
        
    def load_tasks(self) -> None:
        """Load tasks from storage."""
        # Try loading from task directory
        task_files = list(self.task_dir.glob("task_*.json"))
        
        loaded_count = 0
        for task_file in task_files:
            try:
                with open(task_file, 'r') as f:
                    task_data = json.load(f)
                    
                task = Task.from_dict(task_data)
                self.tasks[task.id] = task
                
                # Add to appropriate list based on status
                if task.status == TaskStatus.PENDING:
                    if task.scheduled_at and task.scheduled_at > time.time():
                        self.scheduled_tasks.append(task)
                    else:
                        self.pending_tasks.append(task)
                elif task.status == TaskStatus.RUNNING:
                    # Tasks shouldn't be running after restart
                    task.status = TaskStatus.PENDING
                    self.pending_tasks.append(task)
                    
                loaded_count += 1
                
            except Exception as e:
                logger.error(f"Error loading task from {task_file}: {e}")
                
        # Sort pending tasks by priority (highest first)
        self.pending_tasks.sort(key=lambda t: t.priority.value if isinstance(t.priority, TaskPriority) else t.priority, reverse=True)
        
        # Sort scheduled tasks by scheduled time (earliest first)
        self.scheduled_tasks.sort(key=lambda t: t.scheduled_at or float('inf'))
        
        logger.info(f"Loaded {loaded_count} tasks from storage")
        
    def save_task(self, task: Task) -> None:
        """Save task to storage."""
        task_file = self.task_dir / f"task_{task.id}.json"
        
        try:
            with open(task_file, 'w') as f:
                json.dump(task.to_dict(), f, indent=2)
                
            logger.debug(f"Saved task {task.id} to {task_file}")
                
            # Also save to memory if available
            if self.memory:
                self.memory.add(
                    content=f"Task: {task.name} - {task.description}",
                    metadata=task.to_dict(),
                    tags=["task"] + task.tags
                )
                
        except Exception as e:
            logger.error(f"Error saving task {task.id}: {e}")
            
    def add_task(
        self,
        name: str,
        description: str,
        priority: Union[TaskPriority, int] = TaskPriority.MEDIUM,
        scheduled_at: Optional[float] = None,
        deadline: Optional[float] = None,
        dependencies: Optional[List[str]] = None,
        tags: Optional[List[str]] = None,
        data: Optional[Dict[str, Any]] = None,
        handler: Optional[str] = None,
        owner: str = "system"
    ) -> Task:
        """
        Add a new task to the scheduler.
        
        Args:
            name: Task name
            description: Task description
            priority: Task priority
            scheduled_at: When to execute (None = ASAP)
            deadline: Deadline timestamp (None = no deadline)
            dependencies: IDs of tasks this depends on
            tags: Tags for categorization
            data: Task-specific data
            handler: Task handler name
            owner: Who/what created the task
            
        Returns:
            The created task
        """
        with self.task_lock:
            # Generate a unique ID
            task_id = f"{int(time.time())}_{hash(name) % 10000:04d}"
            
            # Convert priority to enum if needed
            if isinstance(priority, int):
                for p in TaskPriority:
                    if p.value == priority:
                        priority = p
                        break
            
            # Create task
            task = Task(
                id=task_id,
                name=name,
                description=description,
                priority=priority,
                status=TaskStatus.PENDING,
                created_at=time.time(),
                scheduled_at=scheduled_at,
                deadline=deadline,
                dependencies=dependencies or [],
                tags=tags or [],
                data=data or {},
                handler=handler,
                owner=owner
            )
            
            # Add to task registry
            self.tasks[task_id] = task
            
            # Add to appropriate list
            if scheduled_at and scheduled_at > time.time():
                self.scheduled_tasks.append(task)
                # Sort scheduled tasks by time
                self.scheduled_tasks.sort(key=lambda t: t.scheduled_at or float('inf'))
            else:
                self.pending_tasks.append(task)
                # Sort pending tasks by priority
                self.pending_tasks.sort(key=lambda t: t.priority.value if isinstance(t.priority, TaskPriority) else t.priority, reverse=True)
            
            # Save task
            self.save_task(task)
            
            logger.info(f"Added task {task_id}: {name} (priority={priority})")
            return task
            
    def get_task(self, task_id: str) -> Optional[Task]:
        """
        Get a task by ID.
        
        Args:
            task_id: Task ID
            
        Returns:
            Task or None if not found
        """
        return self.tasks.get(task_id)
        
    def get_tasks(
        self,
        status: Optional[Union[TaskStatus, str]] = None,
        priority: Optional[Union[TaskPriority, int]] = None,
        tags: Optional[List[str]] = None,
        owner: Optional[str] = None,
        handler: Optional[str] = None
    ) -> List[Task]:
        """
        Get tasks matching criteria.
        
        Args:
            status: Filter by status
            priority: Filter by priority
            tags: Filter by tags (task must have ALL these tags)
            owner: Filter by owner
            handler: Filter by handler
            
        Returns:
            List of matching tasks
        """
        # Convert status string to enum if needed
        if isinstance(status, str):
            try:
                status = TaskStatus(status)
            except ValueError:
                pass
                
        # Convert priority to enum if needed
        if isinstance(priority, int):
            for p in TaskPriority:
                if p.value == priority:
                    priority = p
                    break
        
        # Filter tasks
        filtered_tasks = list(self.tasks.values())
        
        if status is not None:
            if isinstance(status, TaskStatus):
                filtered_tasks = [t for t in filtered_tasks if t.status == status]
            else:
                filtered_tasks = [t for t in filtered_tasks if t.status.value == status]
                
        if priority is not None:
            if isinstance(priority, TaskPriority):
                filtered_tasks = [t for t in filtered_tasks if t.priority == priority]
            else:
                filtered_tasks = [t for t in filtered_tasks if t.priority.value == priority]
                
        if tags:
            filtered_tasks = [t for t in filtered_tasks if all(tag in t.tags for tag in tags)]
            
        if owner is not None:
            filtered_tasks = [t for t in filtered_tasks if t.owner == owner]
            
        if handler is not None:
            filtered_tasks = [t for t in filtered_tasks if t.handler == handler]
            
        return filtered_tasks
        
    def update_task_status(
        self,
        task_id: str,
        status: TaskStatus,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ) -> Optional[Task]:
        """
        Update a task's status.
        
        Args:
            task_id: Task ID
            status: New status
            result: Task result (if completed)
            error: Error message (if failed)
            
        Returns:
            Updated task or None if not found
        """
        with self.task_lock:
            task = self.get_task(task_id)
            if not task:
                logger.warning(f"Task not found: {task_id}")
                return None
                
            prev_status = task.status
            task.status = status
            
            # Update timestamps
            if status == TaskStatus.RUNNING and task.started_at is None:
                task.started_at = time.time()
                
            if status in (TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED) and task.completed_at is None:
                task.completed_at = time.time()
                
            # Update result/error
            if result is not None:
                task.result = result
                
            if error is not None:
                task.error = error
                
            # Update lists
            if prev_status != status:
                # Remove from previous list
                if prev_status == TaskStatus.PENDING:
                    if task in self.pending_tasks:
                        self.pending_tasks.remove(task)
                elif prev_status == TaskStatus.RUNNING:
                    if task_id in self.running_tasks:
                        del self.running_tasks[task_id]
                        
                # Add to new list if needed
                if status == TaskStatus.RUNNING:
                    self.running_tasks[task_id] = task
                    
            # Save task
            self.save_task(task)
            
            logger.info(f"Updated task {task_id} status: {prev_status} -> {status}")
            return task
            
    def cancel_task(self, task_id: str, reason: Optional[str] = None) -> Optional[Task]:
        """
        Cancel a task.
        
        Args:
            task_id: Task ID
            reason: Cancellation reason
            
        Returns:
            Cancelled task or None if not found
        """
        with self.task_lock:
            task = self.get_task(task_id)
            if not task:
                logger.warning(f"Task not found: {task_id}")
                return None
                
            # Only cancel if pending or running
            if task.status not in (TaskStatus.PENDING, TaskStatus.RUNNING):
                logger.warning(f"Task {task_id} is not pending or running, cannot cancel")
                return task
                
            # Update status
            task.status = TaskStatus.CANCELLED
            task.completed_at = time.time()
            task.error = reason
            
            # Remove from lists
            if task in self.pending_tasks:
                self.pending_tasks.remove(task)
            elif task in self.scheduled_tasks:
                self.scheduled_tasks.remove(task)
            elif task_id in self.running_tasks:
                del self.running_tasks[task_id]
                
            # Save task
            self.save_task(task)
            
            logger.info(f"Cancelled task {task_id}: {reason or 'No reason given'}")
            return task
            
    def execute_task(self, task: Task) -> Dict[str, Any]:
        """
        Execute a task using its handler.
        
        Args:
            task: Task to execute
            
        Returns:
            Task result
            
        Raises:
            ValueError: If task has no handler or handler not found
            Exception: If task execution fails
        """
        if not task.handler:
            raise ValueError(f"Task {task.id} has no handler")
            
        handler = self.task_handlers.get(task.handler)
        if not handler:
            raise ValueError(f"Handler '{task.handler}' not found")
            
        # Mark task as running
        self.update_task_status(task.id, TaskStatus.RUNNING)
        
        try:
            # Execute handler
            result = handler(task)
            
            # Mark task as completed
            self.update_task_status(task.id, TaskStatus.COMPLETED, result=result)
            
            return result
        except Exception as e:
            # Get traceback
            error_details = traceback.format_exc()
            
            # Mark task as failed
            self.update_task_status(task.id, TaskStatus.FAILED, error=f"{str(e)}\n{error_details}")
            
            # Re-raise
            raise
            
    def get_next_task(self) -> Optional[Task]:
        """
        Get the next task to execute.
        
        Returns:
            Next task or None if no tasks are ready
        """
        with self.task_lock:
            # Check scheduled tasks that are due
            current_time = time.time()
            due_tasks = []
            
            for task in self.scheduled_tasks[:]:  # Copy to avoid modification during iteration
                if task.scheduled_at and task.scheduled_at <= current_time:
                    due_tasks.append(task)
                    self.scheduled_tasks.remove(task)
                    self.pending_tasks.append(task)
            
            # Sort pending tasks by priority (highest first)
            if due_tasks:
                self.pending_tasks.sort(key=lambda t: t.priority.value if isinstance(t.priority, TaskPriority) else t.priority, reverse=True)
            
            # Check for tasks that are ready to run (no pending dependencies)
            for task in self.pending_tasks:
                # Check dependencies
                if task.dependencies:
                    dependencies_met = True
                    for dep_id in task.dependencies:
                        dep_task = self.get_task(dep_id)
                        if not dep_task or dep_task.status != TaskStatus.COMPLETED:
                            dependencies_met = False
                            break
                            
                    if not dependencies_met:
                        continue
                
                # This task is ready
                return task
                
            # No tasks ready
            return None
            
    def run_next_task(self) -> Optional[Dict[str, Any]]:
        """
        Run the next available task.
        
        Returns:
            Task result or None if no tasks were executed
        """
        # Get next task
        task = self.get_next_task()
        if not task:
            return None
            
        # Remove from pending list
        with self.task_lock:
            if task in self.pending_tasks:
                self.pending_tasks.remove(task)
        
        try:
            # Execute task
            result = self.execute_task(task)
            return result
        except Exception as e:
            logger.error(f"Error executing task {task.id}: {e}")
            return None
            
    def run_task_loop(
        self,
        max_tasks: Optional[int] = None,
        max_runtime: Optional[float] = None,
        stop_event: Optional[threading.Event] = None
    ) -> int:
        """
        Run tasks in a loop until stopped.
        
        Args:
            max_tasks: Maximum number of tasks to run (None = unlimited)
            max_runtime: Maximum runtime in seconds (None = unlimited)
            stop_event: Event to signal stopping
            
        Returns:
            Number of tasks executed
        """
        task_count = 0
        start_time = time.time()
        
        logger.info("Starting task execution loop")
        
        while True:
            # Check stop conditions
            if stop_event and stop_event.is_set():
                logger.info("Stop event received, exiting task loop")
                break
                
            if max_tasks is not None and task_count >= max_tasks:
                logger.info(f"Reached maximum task count ({max_tasks}), exiting task loop")
                break
                
            if max_runtime is not None and time.time() - start_time >= max_runtime:
                logger.info(f"Reached maximum runtime ({max_runtime}s), exiting task loop")
                break
                
            # Run next task
            result = self.run_next_task()
            
            if result is not None:
                task_count += 1
            else:
                # No tasks to run, wait a bit
                time.sleep(1.0)
                
        logger.info(f"Task loop completed, executed {task_count} tasks")
        return task_count 


class AutonomyLoop:
    """
    Main controller for autonomous execution, reflection, and improvement.
    
    Orchestrates:
    1. Task scheduling and execution
    2. Periodic reflection and learning
    3. Self-improvement through feedback
    """
    
    def __init__(
        self,
        config_path: Optional[str] = None,
        memory: Optional[Memory] = None,
        personalization_manager: Optional[PersonalizationManager] = None,
        log_level: str = "INFO"
    ):
        """
        Initialize autonomy loop.
        
        Args:
            config_path: Path to configuration file
            memory: Memory instance to use
            personalization_manager: Personalization manager to use
            log_level: Logging level
        """
        # Set up logging
        numeric_level = getattr(logging, log_level.upper(), None)
        if not isinstance(numeric_level, int):
            numeric_level = logging.INFO
        logger.setLevel(numeric_level)
        
        # Load configuration
        self.config = self._load_config(config_path)
        
        # Set up directories
        self.data_dir = Path(self.config.get("data_dir", "data"))
        os.makedirs(self.data_dir, exist_ok=True)
        
        # Initialize memory if not provided
        self.memory = memory or Memory()
        
        # Initialize personalization manager if not provided
        self.personalization = personalization_manager
        if not self.personalization:
            try:
                self.personalization = PersonalizationManager(memory=self.memory)
            except Exception as e:
                logger.warning(f"Error initializing personalization manager: {e}")
                self.personalization = None
        
        # Initialize task scheduler
        self.scheduler = TaskScheduler(
            task_dir=os.path.join(self.data_dir, "tasks"),
            memory=self.memory,
            log_level=log_level,
            config=self.config.get("task_scheduler", {})
        )
        
        # Initialize feedback logger
        self.feedback = FeedbackLogger(
            storage_dir=os.path.join(self.data_dir, "feedback"),
            memory=self.memory,
            log_level=log_level
        )
        
        # Register task handlers
        self._register_task_handlers()
        
        # Event handlers
        self.event_handlers: Dict[str, List[Callable]] = {
            "task_completed": [],
            "task_failed": [],
            "reflection_created": [],
            "feedback_logged": []
        }
        
        # Reflection storage
        self.reflections_dir = Path(os.path.join(self.data_dir, "reflections"))
        os.makedirs(self.reflections_dir, exist_ok=True)
        self.reflections: Dict[str, Reflection] = {}
        self._load_reflections()
        
        # Control flags
        self.running = False
        self.stop_event = threading.Event()
        
        # Stats
        self.stats = {
            "tasks_completed": 0,
            "tasks_failed": 0,
            "reflections_created": 0,
            "feedback_entries": 0,
            "start_time": time.time()
        }
        
        logger.info(f"Autonomy loop initialized with config: {config_path or 'default'}")
        
    def _load_config(self, config_path: Optional[str] = None) -> Dict[str, Any]:
        """Load configuration from file or use defaults."""
        default_config = {
            "data_dir": "data",
            "safety": {
                "enable_safety_checks": True,
                "min_score_threshold": 0.7,
                "sensitive_actions_require_approval": True
            },
            "reflection": {
                "enable_reflection": True,
                "reflection_interval": 3600,  # 1 hour
                "reflection_after_n_tasks": 5,
                "min_feedback_for_reflection": 3
            },
            "task_scheduler": {
                "max_concurrent_tasks": 3,
                "default_handler": "default"
            },
            "daily_planning": {
                "enable": True,
                "planning_time": "04:00",  # 4 AM
                "plan_days_ahead": 1
            }
        }
        
        if not config_path:
            # Use module default config
            module_dir = os.path.dirname(os.path.abspath(__file__))
            config_path = os.path.join(module_dir, "config.yaml")
            
        config = default_config.copy()
        
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    file_config = yaml.safe_load(f)
                    
                # Deep merge configs
                self._merge_configs(config, file_config)
                logger.info(f"Loaded configuration from {config_path}")
                
            except Exception as e:
                logger.error(f"Error loading config from {config_path}: {e}")
                
        return config
        
    def _merge_configs(self, base: Dict[str, Any], override: Dict[str, Any]) -> None:
        """Recursively merge override config into base config."""
        for key, value in override.items():
            if key in base and isinstance(base[key], dict) and isinstance(value, dict):
                self._merge_configs(base[key], value)
            else:
                base[key] = value
                
    def _register_task_handlers(self) -> None:
        """Register built-in task handlers."""
        # Register built-in handlers
        self.scheduler.register_handler("default", self._default_task_handler)
        self.scheduler.register_handler("reflection", self._reflection_task_handler)
        self.scheduler.register_handler("planning", self._planning_task_handler)
        self.scheduler.register_handler("feedback", self._feedback_task_handler)
        
        # Register handlers from config
        handlers_config = self.config.get("task_handlers", {})
        for name, handler_info in handlers_config.items():
            if isinstance(handler_info, str):
                # Just a module.function_name string
                self._register_external_handler(name, handler_info)
            elif isinstance(handler_info, dict) and "path" in handler_info:
                # Dict with more info
                self._register_external_handler(
                    name, 
                    handler_info["path"],
                    handler_info.get("args", {})
                )
                
    def _register_external_handler(
        self, 
        name: str, 
        handler_path: str,
        default_args: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Register an external task handler from a module.
        
        Args:
            name: Handler name
            handler_path: Path to handler function (module.function_name)
            default_args: Default arguments to pass to handler
        """
        try:
            module_name, function_name = handler_path.rsplit(".", 1)
            module = importlib.import_module(module_name)
            handler_func = getattr(module, function_name)
            
            # Create wrapper that includes default args
            if default_args:
                def wrapped_handler(task: Task) -> Dict[str, Any]:
                    # Merge task data with default args, task data taking precedence
                    args = default_args.copy()
                    args.update(task.data)
                    task.data = args
                    return handler_func(task)
                    
                self.scheduler.register_handler(name, wrapped_handler)
            else:
                self.scheduler.register_handler(name, handler_func)
                
            logger.info(f"Registered external handler '{name}' from {handler_path}")
            
        except Exception as e:
            logger.error(f"Error registering external handler '{name}': {e}")
            
    def _default_task_handler(self, task: Task) -> Dict[str, Any]:
        """
        Default task handler that uses the LLM to process tasks.
        
        Args:
            task: Task to handle
            
        Returns:
            Task result
        """
        # This would typically use the LLM to process the task based on its description
        logger.info(f"Processing task with default handler: {task.name}")
        
        # Get task instructions and context
        instructions = task.description
        context = task.data.get("context", "")
        
        # Simple task execution for now - in a real system this would use the LLM
        result = {
            "status": "completed",
            "message": f"Processed task: {task.name}",
            "details": "This is a placeholder implementation. In a real system, this would use the LLM to process the task."
        }
        
        return result
        
    def _reflection_task_handler(self, task: Task) -> Dict[str, Any]:
        """
        Handler for reflection tasks.
        
        Args:
            task: Task to handle
            
        Returns:
            Task result with reflection
        """
        reflection_type = task.data.get("reflection_type", "performance")
        if isinstance(reflection_type, str):
            try:
                reflection_type = ReflectionType(reflection_type)
            except ValueError:
                reflection_type = ReflectionType.PERFORMANCE
                
        related_task_id = task.data.get("task_id")
        
        logger.info(f"Performing {reflection_type.value} reflection" + 
                   (f" for task {related_task_id}" if related_task_id else ""))
        
        # Create reflection ID
        reflection_id = f"reflection_{int(time.time())}_{hash(reflection_type.value) % 10000:04d}"
        
        # Get context for reflection
        context = self._get_reflection_context(reflection_type, related_task_id)
        
        # In a real system, this would use the LLM to generate the reflection
        reflection_content = f"Reflection on {reflection_type.value}.\n\n"
        if related_task_id:
            reflection_content += f"This reflection relates to task {related_task_id}.\n\n"
            
        reflection_content += "This is a placeholder implementation. In a real system, this would be generated by the LLM."
        
        # Create insights and action items (placeholder)
        insights = ["Example insight 1", "Example insight 2"]
        action_items = ["Example action item 1", "Example action item 2"]
        
        # Create reflection object
        reflection = Reflection(
            id=reflection_id,
            reflection_type=reflection_type,
            content=reflection_content,
            insights=insights,
            action_items=action_items,
            task_id=related_task_id,
            metrics={"placeholder": True}
        )
        
        # Save reflection
        self._save_reflection(reflection)
        
        # Create tasks from action items if needed
        if task.data.get("create_tasks_from_actions", True):
            for i, action in enumerate(action_items):
                self.scheduler.add_task(
                    name=f"Action from reflection {reflection_id}",
                    description=action,
                    priority=TaskPriority.MEDIUM,
                    tags=["reflection_action", reflection_type.value],
                    data={"reflection_id": reflection_id},
                    handler="default"
                )
        
        # Trigger event
        self._trigger_event("reflection_created", reflection)
        
        # Update stats
        self.stats["reflections_created"] += 1
        
        return {
            "reflection_id": reflection_id,
            "reflection_type": reflection_type.value,
            "insights": insights,
            "action_items": action_items
        }
        
    def _planning_task_handler(self, task: Task) -> Dict[str, Any]:
        """
        Handler for planning tasks.
        
        Args:
            task: Task to handle
            
        Returns:
            Task result with planning outcome
        """
        plan_type = task.data.get("plan_type", "daily")
        days_ahead = task.data.get("days_ahead", 1)
        
        logger.info(f"Creating {plan_type} plan for {days_ahead} day(s) ahead")
        
        # In a real system, this would use the LLM to generate the plan
        
        # Generate tasks based on plan (placeholder)
        planned_tasks = []
        for i in range(3):  # Create 3 example tasks
            tomorrow = time.time() + (86400 * days_ahead)
            task = self.scheduler.add_task(
                name=f"Planned task {i+1} for {datetime.datetime.fromtimestamp(tomorrow).strftime('%Y-%m-%d')}",
                description=f"This is a planned task created by the {plan_type} planner.",
                priority=TaskPriority.MEDIUM,
                scheduled_at=tomorrow,
                tags=["planned", plan_type],
                handler="default"
            )
            planned_tasks.append(task.id)
            
        return {
            "plan_type": plan_type,
            "days_ahead": days_ahead,
            "planned_tasks": planned_tasks
        }
        
    def _feedback_task_handler(self, task: Task) -> Dict[str, Any]:
        """
        Handler for feedback processing tasks.
        
        Args:
            task: Task to handle
            
        Returns:
            Task result with feedback processing outcome
        """
        # Get feedback entries to process
        days = task.data.get("days", 7)
        category = task.data.get("category")
        
        logger.info(f"Processing feedback for the past {days} days" + 
                   (f" in category {category}" if category else ""))
        
        # Generate summary report
        report = self.feedback.generate_summary_report(
            days=days,
            include_categories=[category] if category else None
        )
        
        # In a real system, this would use the LLM to analyze the feedback
        
        # If self-improvement is enabled, create a reflection task
        if task.data.get("create_reflection", True):
            reflection_task = self.scheduler.add_task(
                name="Reflection on feedback",
                description=f"Reflect on feedback from the past {days} days and identify improvement opportunities.",
                priority=TaskPriority.MEDIUM,
                tags=["reflection", "feedback"],
                data={
                    "reflection_type": ReflectionType.IMPROVEMENT.value,
                    "feedback_report": report
                },
                handler="reflection"
            )
            
        return {
            "report": report,
            "entries_processed": report["total_entries"]
        }
        
    def _load_reflections(self) -> None:
        """Load reflections from storage."""
        reflection_files = list(self.reflections_dir.glob("reflection_*.json"))
        
        loaded_count = 0
        for refl_file in reflection_files:
            try:
                with open(refl_file, 'r') as f:
                    data = json.load(f)
                    
                reflection = Reflection.from_dict(data)
                self.reflections[reflection.id] = reflection
                loaded_count += 1
                
            except Exception as e:
                logger.error(f"Error loading reflection from {refl_file}: {e}")
                
        logger.info(f"Loaded {loaded_count} reflections from storage")
        
    def _save_reflection(self, reflection: Reflection) -> None:
        """Save a reflection to storage."""
        # Add to reflections dict
        self.reflections[reflection.id] = reflection
        
        # Save to file
        refl_file = self.reflections_dir / f"reflection_{reflection.id}.json"
        
        try:
            with open(refl_file, 'w') as f:
                json.dump(reflection.to_dict(), f, indent=2)
                
            # Also save to memory if available
            if self.memory:
                self.memory.add(
                    content=reflection.content,
                    metadata=reflection.to_dict(),
                    tags=["reflection", reflection.reflection_type.value] + reflection.tags
                )
                
            logger.debug(f"Saved reflection {reflection.id}")
                
        except Exception as e:
            logger.error(f"Error saving reflection {reflection.id}: {e}")
            
    def _get_reflection_context(
        self, 
        reflection_type: ReflectionType,
        task_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get context for a reflection.
        
        Args:
            reflection_type: Type of reflection
            task_id: Related task ID
            
        Returns:
            Context information
        """
        context = {
            "reflection_type": reflection_type.value,
            "task_id": task_id
        }
        
        # Add task info if available
        if task_id:
            task = self.scheduler.get_task(task_id)
            if task:
                context["task"] = task.to_dict()
                
        # Add recent tasks
        recent_tasks = self.scheduler.get_tasks(status=TaskStatus.COMPLETED)
        recent_tasks.sort(key=lambda t: t.completed_at or 0, reverse=True)
        context["recent_tasks"] = [t.to_dict() for t in recent_tasks[:5]]
        
        # Add feedback based on reflection type
        if reflection_type == ReflectionType.PERFORMANCE:
            # Get recent performance feedback
            entries = self.feedback.get_entries(
                category=FeedbackCategory.HELPFULNESS.value,
                min_timestamp=time.time() - (7 * 86400)  # Last 7 days
            )
            context["performance_feedback"] = [e.to_dict() for e in entries[:10]]
            
        elif reflection_type == ReflectionType.IMPROVEMENT:
            # Get all types of feedback for improvement
            categories = [c.value for c in FeedbackCategory]
            entries = []
            
            for category in categories:
                category_entries = self.feedback.get_entries(
                    category=category,
                    min_timestamp=time.time() - (30 * 86400)  # Last 30 days
                )
                entries.extend(category_entries[:5])
                
            context["improvement_feedback"] = [e.to_dict() for e in entries]
            
        elif reflection_type == ReflectionType.ERROR:
            # Get error details if task failed
            if task_id:
                task = self.scheduler.get_task(task_id)
                if task and task.error:
                    context["error_details"] = task.error
            
        return context
        
    def _trigger_event(self, event_type: str, data: Any) -> None:
        """
        Trigger an event and call registered handlers.
        
        Args:
            event_type: Event type
            data: Event data
        """
        handlers = self.event_handlers.get(event_type, [])
        for handler in handlers:
            try:
                handler(data)
            except Exception as e:
                logger.error(f"Error in {event_type} event handler: {e}")
                
    def on_event(self, event_type: str, handler: Callable) -> None:
        """
        Register an event handler.
        
        Args:
            event_type: Event type
            handler: Handler function
        """
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
            
        self.event_handlers[event_type].append(handler)
        
    def schedule_reflection_tasks(self) -> None:
        """Schedule periodic reflection tasks."""
        reflection_config = self.config.get("reflection", {})
        if not reflection_config.get("enable_reflection", True):
            logger.info("Reflection is disabled in config, not scheduling reflection tasks")
            return
            
        # Schedule performance reflection
        self.scheduler.add_task(
            name="Periodic performance reflection",
            description="Reflect on recent performance and identify improvement opportunities.",
            priority=TaskPriority.LOW,
            scheduled_at=time.time() + reflection_config.get("reflection_interval", 3600),
            tags=["reflection", "periodic"],
            data={"reflection_type": ReflectionType.PERFORMANCE.value},
            handler="reflection"
        )
        
        # Schedule feedback processing
        self.scheduler.add_task(
            name="Process feedback",
            description="Analyze recent feedback and generate insights.",
            priority=TaskPriority.LOW,
            scheduled_at=time.time() + reflection_config.get("reflection_interval", 3600) / 2,
            tags=["feedback", "periodic"],
            handler="feedback"
        )
        
    def schedule_planning_tasks(self) -> None:
        """Schedule planning tasks."""
        planning_config = self.config.get("daily_planning", {})
        if not planning_config.get("enable", True):
            logger.info("Daily planning is disabled in config, not scheduling planning tasks")
            return
            
        # Parse planning time
        planning_time_str = planning_config.get("planning_time", "04:00")
        try:
            planning_hour, planning_minute = map(int, planning_time_str.split(":"))
        except Exception:
            planning_hour, planning_minute = 4, 0
            
        # Calculate next planning time
        now = datetime.datetime.now()
        planning_time = datetime.datetime(
            now.year, now.month, now.day, 
            planning_hour, planning_minute
        )
        
        # If planning time already passed today, schedule for tomorrow
        if planning_time <= now:
            planning_time += datetime.timedelta(days=1)
            
        # Schedule daily planning task
        self.scheduler.add_task(
            name="Daily planning",
            description="Create a plan for the next day's activities.",
            priority=TaskPriority.MEDIUM,
            scheduled_at=planning_time.timestamp(),
            tags=["planning", "daily"],
            data={
                "plan_type": "daily",
                "days_ahead": planning_config.get("plan_days_ahead", 1)
            },
            handler="planning"
        )
        
    def start(self) -> None:
        """Start the autonomy loop."""
        if self.running:
            logger.warning("Autonomy loop already running")
            return
            
        logger.info("Starting autonomy loop")
        self.running = True
        self.stop_event.clear()
        
        # Schedule initial reflection and planning tasks
        self.schedule_reflection_tasks()
        self.schedule_planning_tasks()
        
        # Start task execution in a separate thread
        self.task_thread = threading.Thread(target=self._task_loop)
        self.task_thread.daemon = True
        self.task_thread.start()
        
    def stop(self) -> None:
        """Stop the autonomy loop."""
        if not self.running:
            return
            
        logger.info("Stopping autonomy loop")
        self.stop_event.set()
        self.running = False
        
        # Wait for task thread to finish
        if hasattr(self, 'task_thread') and self.task_thread.is_alive():
            self.task_thread.join(timeout=2.0)
            
    def _task_loop(self) -> None:
        """Main task execution loop."""
        # Set up task completion/failure handlers
        def on_task_completed(task: Task) -> None:
            self.stats["tasks_completed"] += 1
            
            # Schedule reflection if needed
            reflection_config = self.config.get("reflection", {})
            tasks_before_reflection = reflection_config.get("reflection_after_n_tasks", 5)
            
            if self.stats["tasks_completed"] % tasks_before_reflection == 0:
                self.schedule_reflection_tasks()
                
            # Schedule planning if needed
            planning_config = self.config.get("daily_planning", {})
            if planning_config.get("enable", True):
                # Check if we need to schedule planning
                now = datetime.datetime.now()
                if now.hour == 0 and now.minute < 5:  # Around midnight
                    self.schedule_planning_tasks()
                    
        def on_task_failed(task: Task) -> None:
            self.stats["tasks_failed"] += 1
            
            # If error reflection is enabled, create a reflection task
            reflection_config = self.config.get("reflection", {})
            if reflection_config.get("enable_error_reflection", True):
                self.scheduler.add_task(
                    name=f"Reflection on error in task {task.id}",
                    description=f"Analyze the error in task '{task.name}' and identify improvements.",
                    priority=TaskPriority.HIGH,
                    tags=["reflection", "error"],
                    data={
                        "reflection_type": ReflectionType.ERROR.value,
                        "task_id": task.id
                    },
                    handler="reflection"
                )
                
        # Register handlers
        self.on_event("task_completed", on_task_completed)
        self.on_event("task_failed", on_task_failed)
        
        # Run task loop until stopped
        self.scheduler.run_task_loop(stop_event=self.stop_event)
        
    def get_stats(self) -> Dict[str, Any]:
        """Get system statistics."""
        stats = self.stats.copy()
        stats["uptime"] = time.time() - stats["start_time"]
        
        # Add task stats
        stats["pending_tasks"] = len(self.scheduler.pending_tasks)
        stats["scheduled_tasks"] = len(self.scheduler.scheduled_tasks)
        stats["running_tasks"] = len(self.scheduler.running_tasks)
        
        stats["total_reflections"] = len(self.reflections)
        
        return stats
        
    def get_reflections(
        self,
        reflection_type: Optional[Union[ReflectionType, str]] = None,
        limit: int = 10
    ) -> List[Reflection]:
        """
        Get reflections matching criteria.
        
        Args:
            reflection_type: Filter by reflection type
            limit: Maximum number of reflections to return
            
        Returns:
            List of matching reflections
        """
        if isinstance(reflection_type, str):
            try:
                reflection_type = ReflectionType(reflection_type)
            except ValueError:
                pass
                
        filtered = list(self.reflections.values())
        
        if reflection_type:
            if isinstance(reflection_type, ReflectionType):
                filtered = [r for r in filtered if r.reflection_type == reflection_type]
            else:
                filtered = [r for r in filtered if r.reflection_type.value == reflection_type]
                
        # Sort by creation time (newest first)
        filtered.sort(key=lambda r: r.created_at, reverse=True)
        
        return filtered[:limit]


# CLI interface
def main():
    """Command-line interface for autonomy loop."""
    import argparse
    
    parser = argparse.ArgumentParser(description="PersLM Autonomy Loop")
    parser.add_argument("--config", help="Configuration file path")
    parser.add_argument("--log-level", default="INFO", 
                      choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
                      help="Logging level")
    parser.add_argument("--data-dir", help="Data directory")
    parser.add_argument("--stop-after", type=int, help="Stop after N seconds")
    parser.add_argument("--task", help="Run a specific task and exit")
    parser.add_argument("--disable-planning", action="store_true", 
                      help="Disable daily planning")
    parser.add_argument("--disable-reflection", action="store_true",
                      help="Disable reflection and self-improvement")
    
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    )
    
    # Create autonomy loop
    loop = AutonomyLoop(
        config_path=args.config,
        log_level=args.log_level
    )
    
    # Apply command-line overrides
    if args.data_dir:
        loop.data_dir = Path(args.data_dir)
        
    if args.disable_planning:
        loop.config["daily_planning"]["enable"] = False
        
    if args.disable_reflection:
        loop.config["reflection"]["enable_reflection"] = False
    
    try:
        if args.task:
            # Run a specific task
            task = loop.scheduler.add_task(
                name="CLI task",
                description=args.task,
                priority=TaskPriority.HIGH,
                handler="default"
            )
            
            print(f"Running task: {args.task}")
            result = loop.scheduler.execute_task(task)
            print(f"Task result: {json.dumps(result, indent=2)}")
            
        else:
            # Start the loop
            loop.start()
            
            # Sleep until stop time if specified
            if args.stop_after:
                print(f"Running for {args.stop_after} seconds...")
                time.sleep(args.stop_after)
                loop.stop()
            else:
                # Wait for Ctrl+C
                print("Autonomy loop running. Press Ctrl+C to stop.")
                try:
                    while loop.running:
                        time.sleep(1)
                except KeyboardInterrupt:
                    pass
                    
    finally:
        # Make sure loop is stopped
        loop.stop()
        
        # Print stats
        stats = loop.get_stats()
        print("\nAutonomy Loop Statistics:")
        print(f"Uptime: {stats['uptime']:.1f} seconds")
        print(f"Tasks: {stats['tasks_completed']} completed, {stats['tasks_failed']} failed")
        print(f"Reflections: {stats['reflections_created']}")


if __name__ == "__main__":
    main() 