"""
Autonomy Module

This module provides capabilities for autonomous execution and self-invocation.
"""

import os
import time
import json
import logging
import threading
import queue
import uuid
import traceback
from enum import Enum
from typing import Dict, List, Any, Optional, Callable, Union, Tuple
from dataclasses import dataclass, field
import concurrent.futures

logger = logging.getLogger(__name__)


class AutonomyLevel(str, Enum):
    """Levels of system autonomy."""
    DISABLED = "disabled"  # No autonomous actions
    ASSISTED = "assisted"  # Suggest actions but require approval
    SUPERVISED = "supervised"  # Execute actions with oversight
    FULL = "full"  # Full autonomy with minimal oversight


class ExecutionStatus(str, Enum):
    """Status of task execution."""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Task:
    """A task for autonomous execution."""
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    action: str = ""  # Action to perform
    parameters: Dict[str, Any] = field(default_factory=dict)
    priority: int = 0  # Higher numbers = higher priority
    dependencies: List[str] = field(default_factory=list)  # List of task IDs this task depends on
    max_retries: int = 3
    retry_delay: float = 5.0  # Seconds between retries
    timeout: Optional[float] = None  # Maximum execution time
    created_at: float = field(default_factory=time.time)
    scheduled_at: Optional[float] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    status: ExecutionStatus = ExecutionStatus.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    retry_count: int = 0
    parent_id: Optional[str] = None  # ID of parent task if this is a subtask
    subtasks: List[str] = field(default_factory=list)  # IDs of child tasks
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "task_id": self.task_id,
            "name": self.name,
            "description": self.description,
            "action": self.action,
            "parameters": self.parameters,
            "priority": self.priority,
            "dependencies": self.dependencies,
            "max_retries": self.max_retries,
            "retry_delay": self.retry_delay,
            "timeout": self.timeout,
            "created_at": self.created_at,
            "scheduled_at": self.scheduled_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "status": self.status,
            "retry_count": self.retry_count,
            "parent_id": self.parent_id,
            "subtasks": self.subtasks,
            "metadata": self.metadata,
        }
        
        # Handle result (if serializable)
        if self.result is not None:
            try:
                json.dumps(self.result)
                result["result"] = self.result
            except (TypeError, OverflowError):
                result["result"] = str(self.result)
        
        # Handle error
        if self.error is not None:
            result["error"] = self.error
            
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Task':
        """Create from dictionary."""
        return cls(**data)


@dataclass
class TaskResult:
    """Result of a task execution."""
    task_id: str
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    execution_time: float = 0.0
    subtask_results: List['TaskResult'] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class ActionRegistry:
    """Registry of available actions."""
    
    def __init__(self):
        """Initialize the action registry."""
        self._actions: Dict[str, Callable] = {}
        self._descriptions: Dict[str, str] = {}
        self._parameters: Dict[str, Dict[str, Any]] = {}
    
    def register(
        self, 
        name: str, 
        func: Callable, 
        description: str = "", 
        parameters: Optional[Dict[str, Any]] = None
    ):
        """
        Register an action.
        
        Args:
            name: Action name
            func: Action function
            description: Action description
            parameters: Parameter descriptions
        """
        self._actions[name] = func
        self._descriptions[name] = description
        self._parameters[name] = parameters or {}
        logger.debug(f"Registered action: {name}")
    
    def get(self, name: str) -> Optional[Callable]:
        """Get an action by name."""
        return self._actions.get(name)
    
    def list_actions(self) -> Dict[str, Dict[str, Any]]:
        """List all registered actions with descriptions."""
        result = {}
        for name in self._actions:
            result[name] = {
                "description": self._descriptions.get(name, ""),
                "parameters": self._parameters.get(name, {})
            }
        return result
    
    def has_action(self, name: str) -> bool:
        """Check if an action is registered."""
        return name in self._actions


class AutonomyManager:
    """
    Manager for autonomous task execution.
    
    Features:
    - Task scheduling and execution
    - Dependency resolution
    - Retry handling
    - Subtask management
    - Safety checks and rollbacks
    """
    
    def __init__(
        self, 
        autonomy_level: AutonomyLevel = AutonomyLevel.SUPERVISED,
        max_concurrent_tasks: int = 5,
        action_registry: Optional[ActionRegistry] = None,
        approval_callback: Optional[Callable[[Task], bool]] = None,
        completion_callback: Optional[Callable[[Task, TaskResult], None]] = None,
        persistence_dir: Optional[str] = None,
        safety_checks: Optional[List[Callable[[Task], Tuple[bool, str]]]] = None
    ):
        """
        Initialize the autonomy manager.
        
        Args:
            autonomy_level: Default autonomy level
            max_concurrent_tasks: Maximum concurrent tasks
            action_registry: Registry of available actions
            approval_callback: Function to call for task approval
            completion_callback: Function to call when tasks complete
            persistence_dir: Directory for task persistence
            safety_checks: List of safety check functions
        """
        self.autonomy_level = autonomy_level
        self.max_concurrent_tasks = max_concurrent_tasks
        self.action_registry = action_registry or ActionRegistry()
        self.approval_callback = approval_callback
        self.completion_callback = completion_callback
        self.persistence_dir = persistence_dir
        self.safety_checks = safety_checks or []
        
        # Create persistence directory if needed
        if self.persistence_dir:
            os.makedirs(self.persistence_dir, exist_ok=True)
        
        # Task storage
        self._tasks: Dict[str, Task] = {}
        self._task_queue = queue.PriorityQueue()
        
        # Task execution
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=max_concurrent_tasks,
            thread_name_prefix="autonomy-"
        )
        self._running_tasks: Dict[str, concurrent.futures.Future] = {}
        self._task_results: Dict[str, TaskResult] = {}
        
        # Control flags
        self._running = False
        self._shutdown = False
        self._processing_thread = None
    
    def start(self):
        """Start processing tasks."""
        if self._running:
            logger.warning("Already running")
            return
            
        self._running = True
        self._shutdown = False
        
        # Load any persisted tasks
        self._load_tasks()
        
        # Start processing thread
        self._processing_thread = threading.Thread(
            target=self._process_tasks,
            name="autonomy-processor",
            daemon=True
        )
        self._processing_thread.start()
        
        logger.info(f"Autonomy manager started (level: {self.autonomy_level})")
    
    def stop(self, wait: bool = True, timeout: float = 30.0):
        """
        Stop processing tasks.
        
        Args:
            wait: Whether to wait for running tasks
            timeout: Maximum wait time
        """
        if not self._running:
            logger.warning("Not running")
            return
            
        logger.info("Stopping autonomy manager")
        self._running = False
        
        if wait:
            # Wait for processing thread
            if self._processing_thread and self._processing_thread.is_alive():
                self._processing_thread.join(timeout=timeout)
            
            # Wait for running tasks
            if self._running_tasks:
                logger.info(f"Waiting for {len(self._running_tasks)} running tasks to complete")
                concurrent.futures.wait(
                    list(self._running_tasks.values()),
                    timeout=timeout
                )
        
        # Save tasks
        self._save_tasks()
        
        # Shutdown executor
        self._shutdown = True
        self._executor.shutdown(wait=wait, cancel_futures=not wait)
        
        logger.info("Autonomy manager stopped")
    
    def create_task(
        self,
        action: str,
        parameters: Dict[str, Any] = None,
        name: str = "",
        description: str = "",
        priority: int = 0,
        dependencies: List[str] = None,
        scheduled_at: Optional[float] = None,
        parent_id: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Create a new task.
        
        Args:
            action: Action to perform
            parameters: Action parameters
            name: Task name
            description: Task description
            priority: Task priority
            dependencies: Task dependencies
            scheduled_at: When to run the task
            parent_id: Parent task ID
            metadata: Additional metadata
            
        Returns:
            Task ID
        """
        # Check if action exists
        if not self.action_registry.has_action(action):
            raise ValueError(f"Unknown action: {action}")
        
        # Create task
        task = Task(
            name=name or action,
            description=description,
            action=action,
            parameters=parameters or {},
            priority=priority,
            dependencies=dependencies or [],
            scheduled_at=scheduled_at,
            parent_id=parent_id,
            metadata=metadata or {}
        )
        
        # Add to storage
        self._tasks[task.task_id] = task
        
        # Add to parent's subtasks if needed
        if parent_id and parent_id in self._tasks:
            self._tasks[parent_id].subtasks.append(task.task_id)
        
        # Add to queue if ready
        if self._is_task_ready(task):
            self._enqueue_task(task)
        
        # Save tasks
        self._save_tasks()
        
        logger.info(f"Created task {task.task_id} ({task.name})")
        return task.task_id
    
    def create_chain(
        self,
        tasks: List[Dict[str, Any]],
        name: str = "",
        description: str = "",
        metadata: Dict[str, Any] = None
    ) -> str:
        """
        Create a chain of tasks with dependencies.
        
        Args:
            tasks: List of task definitions
            name: Chain name
            description: Chain description
            metadata: Additional metadata
            
        Returns:
            Parent task ID
        """
        if not tasks:
            raise ValueError("No tasks provided")
        
        # Create a parent coordinator task
        parent_id = self.create_task(
            action="chain_coordinator",
            name=name or "Task Chain",
            description=description or f"Chain of {len(tasks)} tasks",
            metadata=metadata or {}
        )
        
        # Create the tasks in the chain with dependencies
        previous_id = None
        for i, task_def in enumerate(tasks):
            # Add to dependencies if not the first task
            dependencies = task_def.get("dependencies", [])
            if previous_id:
                dependencies.append(previous_id)
            
            # Create subtask
            task_id = self.create_task(
                action=task_def["action"],
                parameters=task_def.get("parameters", {}),
                name=task_def.get("name", f"Step {i+1}"),
                description=task_def.get("description", ""),
                priority=task_def.get("priority", 0),
                dependencies=dependencies,
                parent_id=parent_id,
                metadata=task_def.get("metadata", {})
            )
            
            previous_id = task_id
        
        return parent_id
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID."""
        return self._tasks.get(task_id)
    
    def get_task_result(self, task_id: str) -> Optional[TaskResult]:
        """Get a task result by ID."""
        return self._task_results.get(task_id)
    
    def wait_for_task(self, task_id: str, timeout: Optional[float] = None) -> Optional[TaskResult]:
        """
        Wait for a task to complete.
        
        Args:
            task_id: Task ID
            timeout: Maximum wait time
            
        Returns:
            Task result or None if timed out
        """
        if task_id not in self._tasks:
            logger.warning(f"Task {task_id} not found")
            return None
        
        # If already completed, return result
        if task_id in self._task_results:
            return self._task_results[task_id]
        
        # If running, wait for it
        if task_id in self._running_tasks:
            try:
                future = self._running_tasks[task_id]
                result = future.result(timeout=timeout)
                return result
            except concurrent.futures.TimeoutError:
                logger.warning(f"Timeout waiting for task {task_id}")
                return None
        
        # If not running, wait for it to start and complete
        start_time = time.time()
        while (timeout is None or (time.time() - start_time) < timeout):
            # Check if completed
            if task_id in self._task_results:
                return self._task_results[task_id]
            
            # Check if running
            if task_id in self._running_tasks:
                remaining_timeout = None
                if timeout is not None:
                    remaining_timeout = timeout - (time.time() - start_time)
                    if remaining_timeout <= 0:
                        return None
                
                # Wait for completion
                try:
                    future = self._running_tasks[task_id]
                    result = future.result(timeout=remaining_timeout)
                    return result
                except concurrent.futures.TimeoutError:
                    logger.warning(f"Timeout waiting for task {task_id}")
                    return None
            
            # Sleep briefly
            time.sleep(0.1)
        
        # Timed out
        return None
    
    def cancel_task(self, task_id: str) -> bool:
        """
        Cancel a task.
        
        Args:
            task_id: Task ID
            
        Returns:
            Whether the task was cancelled
        """
        if task_id not in self._tasks:
            logger.warning(f"Task {task_id} not found")
            return False
        
        task = self._tasks[task_id]
        
        # Check if already completed
        if task.status in (ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED):
            logger.warning(f"Task {task_id} already {task.status}")
            return False
        
        # Cancel if running
        if task_id in self._running_tasks:
            future = self._running_tasks[task_id]
            cancelled = future.cancel()
            if cancelled:
                logger.info(f"Cancelled running task {task_id}")
                task.status = ExecutionStatus.CANCELLED
                self._save_tasks()
                return True
            else:
                logger.warning(f"Failed to cancel running task {task_id}")
                return False
        
        # Mark as cancelled if not running
        logger.info(f"Cancelled pending task {task_id}")
        task.status = ExecutionStatus.CANCELLED
        self._save_tasks()
        
        # Cancel subtasks
        for subtask_id in task.subtasks:
            self.cancel_task(subtask_id)
        
        return True
    
    def list_tasks(
        self, 
        status: Optional[Union[ExecutionStatus, List[ExecutionStatus]]] = None,
        parent_id: Optional[str] = None
    ) -> List[Task]:
        """
        List tasks, optionally filtered by status and/or parent.
        
        Args:
            status: Status(es) to filter by
            parent_id: Parent task ID to filter by
            
        Returns:
            List of matching tasks
        """
        result = []
        
        # Convert single status to list
        status_list = []
        if status is not None:
            if isinstance(status, list):
                status_list = status
            else:
                status_list = [status]
        
        # Filter tasks
        for task in self._tasks.values():
            # Filter by status if specified
            if status_list and task.status not in status_list:
                continue
                
            # Filter by parent if specified
            if parent_id is not None and task.parent_id != parent_id:
                continue
                
            result.append(task)
        
        return result
    
    def _process_tasks(self):
        """Process tasks from the queue."""
        logger.info("Task processor started")
        
        while self._running:
            try:
                # Check for available task slots
                if len(self._running_tasks) >= self.max_concurrent_tasks:
                    time.sleep(0.1)
                    continue
                
                # Check for ready tasks
                self._check_ready_tasks()
                
                # Get next task from queue
                try:
                    _, task_id = self._task_queue.get(timeout=0.5)
                except queue.Empty:
                    continue
                
                # Check if task exists
                if task_id not in self._tasks:
                    logger.warning(f"Task {task_id} not found in storage")
                    continue
                
                task = self._tasks[task_id]
                
                # Check if task was cancelled or already completed
                if task.status in (
                    ExecutionStatus.COMPLETED, 
                    ExecutionStatus.FAILED,
                    ExecutionStatus.CANCELLED
                ):
                    logger.debug(f"Skipping task {task_id} with status {task.status}")
                    continue
                
                # Check if task is ready to run
                if not self._is_task_ready(task):
                    logger.debug(f"Task {task_id} not ready to run")
                    continue
                
                # Check if scheduled time has arrived
                if task.scheduled_at is not None and task.scheduled_at > time.time():
                    # Re-enqueue with priority based on scheduled time
                    self._enqueue_task(task)
                    continue
                
                # Check safety
                safe, message = self._check_safety(task)
                if not safe:
                    logger.warning(f"Safety check failed for task {task_id}: {message}")
                    task.status = ExecutionStatus.FAILED
                    task.error = f"Safety check failed: {message}"
                    self._save_tasks()
                    continue
                
                # Get approval if needed
                if not self._get_approval(task):
                    logger.info(f"Task {task_id} not approved")
                    task.status = ExecutionStatus.CANCELLED
                    task.error = "Not approved"
                    self._save_tasks()
                    continue
                
                # Execute task
                logger.info(f"Executing task {task_id} ({task.name})")
                task.status = ExecutionStatus.RUNNING
                task.started_at = time.time()
                self._save_tasks()
                
                # Submit to executor
                future = self._executor.submit(self._execute_task, task)
                self._running_tasks[task_id] = future
                
                # Add completion callback
                future.add_done_callback(lambda f, tid=task_id: self._handle_task_completion(tid, f))
                
            except Exception as e:
                logger.error(f"Error in task processor: {str(e)}")
                logger.debug(traceback.format_exc())
                time.sleep(1.0)
        
        logger.info("Task processor stopped")
    
    def _execute_task(self, task: Task) -> TaskResult:
        """
        Execute a task.
        
        Args:
            task: Task to execute
            
        Returns:
            Task result
        """
        start_time = time.time()
        
        try:
            # Get action function
            action_func = self.action_registry.get(task.action)
            if not action_func:
                raise ValueError(f"Unknown action: {task.action}")
            
            # Execute action
            result = action_func(**task.parameters)
            
            # Create result
            task_result = TaskResult(
                task_id=task.task_id,
                success=True,
                result=result,
                execution_time=time.time() - start_time
            )
            
            # Add subtask results if any
            for subtask_id in task.subtasks:
                if subtask_id in self._task_results:
                    task_result.subtask_results.append(self._task_results[subtask_id])
            
            return task_result
            
        except Exception as e:
            logger.error(f"Error executing task {task.task_id}: {str(e)}")
            logger.debug(traceback.format_exc())
            
            # Check if should retry
            if task.retry_count < task.max_retries:
                task.retry_count += 1
                task.status = ExecutionStatus.PENDING
                task.error = f"Error: {str(e)} (retry {task.retry_count}/{task.max_retries})"
                logger.info(f"Retrying task {task.task_id} after error ({task.retry_count}/{task.max_retries})")
                
                # Re-enqueue with delay
                if task.retry_delay > 0:
                    task.scheduled_at = time.time() + task.retry_delay
                
                self._enqueue_task(task)
                
                # Return failure result
                return TaskResult(
                    task_id=task.task_id,
                    success=False,
                    error=str(e),
                    execution_time=time.time() - start_time
                )
            else:
                # Return final failure result
                return TaskResult(
                    task_id=task.task_id,
                    success=False,
                    error=f"Error: {str(e)} (max retries exceeded)",
                    execution_time=time.time() - start_time
                )
    
    def _handle_task_completion(self, task_id: str, future: concurrent.futures.Future):
        """
        Handle task completion.
        
        Args:
            task_id: Task ID
            future: Future object
        """
        # Remove from running tasks
        if task_id in self._running_tasks:
            del self._running_tasks[task_id]
        
        # Check if task exists
        if task_id not in self._tasks:
            logger.warning(f"Task {task_id} not found in storage")
            return
        
        task = self._tasks[task_id]
        
        # Check if future was cancelled
        if future.cancelled():
            logger.info(f"Task {task_id} was cancelled")
            task.status = ExecutionStatus.CANCELLED
            self._save_tasks()
            return
        
        try:
            # Get result
            result = future.result()
            
            # Update task status
            if result.success:
                task.status = ExecutionStatus.COMPLETED
                task.result = result.result
                task.error = None
            else:
                task.status = ExecutionStatus.FAILED
                task.error = result.error
            
            task.completed_at = time.time()
            
            # Save result
            self._task_results[task_id] = result
            
            # Save tasks
            self._save_tasks()
            
            # Call completion callback if provided
            if self.completion_callback:
                try:
                    self.completion_callback(task, result)
                except Exception as e:
                    logger.error(f"Error in completion callback: {str(e)}")
            
            # Check if parent task is complete
            if task.parent_id:
                self._check_parent_completion(task.parent_id)
            
            # Update dependent tasks
            self._check_ready_tasks()
            
            logger.info(f"Task {task_id} completed with status {task.status}")
            
        except Exception as e:
            logger.error(f"Error handling task completion: {str(e)}")
            logger.debug(traceback.format_exc())
            
            # Mark as failed
            task.status = ExecutionStatus.FAILED
            task.error = f"Error in completion handling: {str(e)}"
            task.completed_at = time.time()
            self._save_tasks()
    
    def _check_parent_completion(self, parent_id: str):
        """
        Check if a parent task is complete based on subtasks.
        
        Args:
            parent_id: Parent task ID
        """
        if parent_id not in self._tasks:
            return
        
        parent = self._tasks[parent_id]
        
        # Skip if not running
        if parent.status != ExecutionStatus.RUNNING:
            return
        
        # Check if all subtasks are complete
        all_complete = True
        all_success = True
        failed_subtasks = []
        
        for subtask_id in parent.subtasks:
            if subtask_id not in self._tasks:
                continue
                
            subtask = self._tasks[subtask_id]
            
            # If any subtask is not complete, parent is not complete
            if subtask.status not in (
                ExecutionStatus.COMPLETED, 
                ExecutionStatus.FAILED,
                ExecutionStatus.CANCELLED
            ):
                all_complete = False
                break
                
            # Track failures
            if subtask.status != ExecutionStatus.COMPLETED:
                all_success = False
                failed_subtasks.append(subtask_id)
        
        # If all subtasks are complete, mark parent as complete
        if all_complete:
            parent.completed_at = time.time()
            
            if all_success:
                parent.status = ExecutionStatus.COMPLETED
                parent.result = {
                    "subtasks_completed": len(parent.subtasks),
                    "subtasks_failed": 0
                }
            else:
                parent.status = ExecutionStatus.FAILED
                parent.error = f"Failed subtasks: {', '.join(failed_subtasks)}"
                parent.result = {
                    "subtasks_completed": len(parent.subtasks) - len(failed_subtasks),
                    "subtasks_failed": len(failed_subtasks),
                    "failed_subtasks": failed_subtasks
                }
            
            # Save tasks
            self._save_tasks()
            
            logger.info(f"Parent task {parent_id} marked as {parent.status}")
    
    def _check_ready_tasks(self):
        """Check for tasks that are ready to run and enqueue them."""
        for task in self._tasks.values():
            # Skip if not pending
            if task.status != ExecutionStatus.PENDING:
                continue
                
            # Check if ready
            if self._is_task_ready(task):
                self._enqueue_task(task)
    
    def _is_task_ready(self, task: Task) -> bool:
        """
        Check if a task is ready to run.
        
        Args:
            task: Task to check
            
        Returns:
            Whether the task is ready
        """
        # Skip if not pending
        if task.status != ExecutionStatus.PENDING:
            return False
        
        # Check dependencies
        for dep_id in task.dependencies:
            # Skip missing dependencies
            if dep_id not in self._tasks:
                continue
                
            dep = self._tasks[dep_id]
            
            # If dependency is not completed, task is not ready
            if dep.status != ExecutionStatus.COMPLETED:
                return False
        
        return True
    
    def _enqueue_task(self, task: Task):
        """
        Enqueue a task for execution.
        
        Args:
            task: Task to enqueue
        """
        # Calculate priority
        # Lower value = higher priority
        if task.scheduled_at is not None and task.scheduled_at > time.time():
            # For scheduled tasks, priority is based on scheduled time
            priority = task.scheduled_at
        else:
            # For immediate tasks, priority is based on task priority
            # Negate task priority so higher values have higher priority
            priority = -task.priority
        
        # Add to queue
        self._task_queue.put((priority, task.task_id))
    
    def _check_safety(self, task: Task) -> Tuple[bool, str]:
        """
        Check if a task is safe to execute.
        
        Args:
            task: Task to check
            
        Returns:
            (is_safe, message)
        """
        # Skip if no safety checks
        if not self.safety_checks:
            return True, "No safety checks configured"
        
        # Run all safety checks
        for check in self.safety_checks:
            try:
                is_safe, message = check(task)
                if not is_safe:
                    return False, message
            except Exception as e:
                logger.error(f"Error in safety check: {str(e)}")
                return False, f"Safety check error: {str(e)}"
        
        return True, "All safety checks passed"
    
    def _get_approval(self, task: Task) -> bool:
        """
        Get approval for task execution.
        
        Args:
            task: Task to approve
            
        Returns:
            Whether the task is approved
        """
        # Skip approval if disabled or assisted mode
        if self.autonomy_level == AutonomyLevel.DISABLED:
            return False
            
        if self.autonomy_level == AutonomyLevel.FULL:
            return True
        
        # For supervised mode, check if approval callback exists
        if self.autonomy_level == AutonomyLevel.SUPERVISED:
            if not self.approval_callback:
                # Default to approved if no callback
                return True
                
            # Call approval callback
            try:
                return self.approval_callback(task)
            except Exception as e:
                logger.error(f"Error in approval callback: {str(e)}")
                return False
        
        # For assisted mode, require explicit approval
        if self.autonomy_level == AutonomyLevel.ASSISTED:
            if not self.approval_callback:
                # Default to not approved if no callback
                return False
                
            # Call approval callback
            try:
                return self.approval_callback(task)
            except Exception as e:
                logger.error(f"Error in approval callback: {str(e)}")
                return False
        
        # Default to not approved
        return False
    
    def _save_tasks(self):
        """Save tasks to persistence directory."""
        if not self.persistence_dir:
            return
            
        try:
            # Convert tasks to dictionaries
            tasks_data = {
                task_id: task.to_dict()
                for task_id, task in self._tasks.items()
            }
            
            # Create data to save
            data = {
                "tasks": tasks_data,
                "timestamp": time.time()
            }
            
            # Save to file
            file_path = os.path.join(self.persistence_dir, "tasks.json")
            
            # Create a temporary file first
            temp_path = file_path + ".tmp"
            with open(temp_path, "w") as f:
                json.dump(data, f, indent=2)
                
            # Rename to final file (atomic operation)
            os.replace(temp_path, file_path)
            
        except Exception as e:
            logger.error(f"Error saving tasks: {str(e)}")
    
    def _load_tasks(self):
        """Load tasks from persistence directory."""
        if not self.persistence_dir:
            return
            
        file_path = os.path.join(self.persistence_dir, "tasks.json")
        if not os.path.exists(file_path):
            return
            
        try:
            # Load from file
            with open(file_path, "r") as f:
                data = json.load(f)
                
            # Get tasks data
            tasks_data = data.get("tasks", {})
            
            # Convert to tasks
            for task_id, task_data in tasks_data.items():
                try:
                    task = Task.from_dict(task_data)
                    self._tasks[task_id] = task
                    
                    # Enqueue if ready
                    if self._is_task_ready(task):
                        self._enqueue_task(task)
                        
                except Exception as e:
                    logger.error(f"Error loading task {task_id}: {str(e)}")
            
            logger.info(f"Loaded {len(tasks_data)} tasks from persistence")
            
        except Exception as e:
            logger.error(f"Error loading tasks: {str(e)}")


# Default action to provide a chain coordinator
def chain_coordinator(**kwargs):
    """Coordinator for task chains."""
    return {
        "status": "chain_completed",
        "kwargs": kwargs
    }


# Command-line interface for testing
def main():
    """Command-line interface for testing autonomy."""
    import argparse
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Test autonomy")
    parser.add_argument(
        "--level", 
        choices=["disabled", "assisted", "supervised", "full"],
        default="supervised", 
        help="Autonomy level"
    )
    
    args = parser.parse_args()
    
    # Create action registry
    registry = ActionRegistry()
    
    # Register some test actions
    registry.register(
        name="print_message",
        func=lambda message="Hello": print(f"Message: {message}"),
        description="Print a message",
        parameters={"message": "Message to print"}
    )
    
    registry.register(
        name="add_numbers",
        func=lambda a=0, b=0: a + b,
        description="Add two numbers",
        parameters={"a": "First number", "b": "Second number"}
    )
    
    registry.register(
        name="chain_coordinator",
        func=chain_coordinator,
        description="Coordinator for task chains"
    )
    
    # Mock approval callback
    def approval_callback(task):
        # Auto-approve for testing
        print(f"Task approval requested: {task.name} ({task.action})")
        return True
    
    # Create autonomy manager
    autonomy = AutonomyManager(
        autonomy_level=AutonomyLevel(args.level),
        action_registry=registry,
        approval_callback=approval_callback,
        persistence_dir="cache/autonomy"
    )
    
    # Start manager
    autonomy.start()
    
    try:
        # Create a simple task
        task_id = autonomy.create_task(
            action="print_message",
            parameters={"message": "This is a test task"},
            name="Test Task"
        )
        print(f"Created task: {task_id}")
        
        # Create a task chain
        chain_id = autonomy.create_chain(
            tasks=[
                {
                    "action": "add_numbers",
                    "parameters": {"a": 1, "b": 2},
                    "name": "Add 1+2"
                },
                {
                    "action": "add_numbers",
                    "parameters": {"a": 3, "b": 4},
                    "name": "Add 3+4"
                }
            ],
            name="Addition Chain"
        )
        print(f"Created task chain: {chain_id}")
        
        # Wait for completion
        print("Waiting for tasks to complete...")
        result = autonomy.wait_for_task(task_id)
        print(f"Task {task_id} result: {result.success}")
        
        chain_result = autonomy.wait_for_task(chain_id)
        print(f"Chain {chain_id} result: {chain_result.success}")
        
        # List completed tasks
        completed_tasks = autonomy.list_tasks(status=ExecutionStatus.COMPLETED)
        print(f"Completed tasks: {len(completed_tasks)}")
        for task in completed_tasks:
            print(f"  {task.task_id}: {task.name} - {task.result}")
        
        # Keep running for a while
        print("Running for 10 seconds...")
        time.sleep(10)
        
    finally:
        # Stop manager
        autonomy.stop()
        print("Autonomy manager stopped")


if __name__ == "__main__":
    main() 