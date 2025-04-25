"""
Task Scheduler Module

This module provides scheduling of tasks for future execution.
"""

import os
import time
import json
import uuid
import logging
import threading
import heapq
from typing import Dict, List, Callable, Any, Optional, Union
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum

# Import autonomy components if available
try:
    from .autonomy import AutonomyManager, Task, TaskResult
    HAS_AUTONOMY = True
except ImportError:
    HAS_AUTONOMY = False

logger = logging.getLogger(__name__)


class ScheduleType(str, Enum):
    """Types of schedules."""
    ONCE = "once"  # Run once at a specific time
    INTERVAL = "interval"  # Run repeatedly at a fixed interval
    DAILY = "daily"  # Run once a day at a specific time
    WEEKLY = "weekly"  # Run once a week on specific days
    MONTHLY = "monthly"  # Run once a month on a specific day
    CRON = "cron"  # Run according to cron schedule


@dataclass
class Schedule:
    """Schedule for task execution."""
    schedule_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    schedule_type: ScheduleType = ScheduleType.ONCE
    enabled: bool = True
    
    # Task information
    action: str = ""  # Action to perform
    parameters: Dict[str, Any] = field(default_factory=dict)
    
    # Schedule parameters
    start_time: Optional[float] = None  # When to start executing
    end_time: Optional[float] = None  # When to stop executing (for repeating tasks)
    interval: Optional[float] = None  # Seconds between executions (for INTERVAL)
    days: List[int] = field(default_factory=list)  # Days for WEEKLY (0-6, 0=Monday) or day of month for MONTHLY
    time_of_day: Optional[str] = None  # Time of day for DAILY/WEEKLY/MONTHLY (HH:MM)
    cron_expression: Optional[str] = None  # Cron expression for CRON
    
    # Execution tracking
    last_run: Optional[float] = None
    next_run: Optional[float] = None
    run_count: int = 0
    max_runs: Optional[int] = None  # Maximum number of executions (or None for unlimited)
    
    # Miscellaneous
    created_at: float = field(default_factory=time.time)
    tags: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "schedule_id": self.schedule_id,
            "name": self.name,
            "description": self.description,
            "schedule_type": self.schedule_type,
            "enabled": self.enabled,
            "action": self.action,
            "parameters": self.parameters,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "interval": self.interval,
            "days": self.days,
            "time_of_day": self.time_of_day,
            "cron_expression": self.cron_expression,
            "last_run": self.last_run,
            "next_run": self.next_run,
            "run_count": self.run_count,
            "max_runs": self.max_runs,
            "created_at": self.created_at,
            "tags": self.tags,
            "metadata": self.metadata,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Schedule':
        """Create from dictionary."""
        return cls(**data)


class ScheduleManager:
    """
    Manager for task scheduling.
    
    Features:
    - Scheduling tasks for future execution
    - Recurring task scheduling
    - Schedule persistence
    - Integration with autonomy system
    """
    
    def __init__(
        self,
        autonomy_manager: Optional[Any] = None,
        executor: Optional[Callable[[str, Dict[str, Any]], Any]] = None,
        storage_dir: Optional[str] = None,
        check_interval: float = 1.0,  # Seconds between schedule checks
        auto_start: bool = True
    ):
        """
        Initialize the schedule manager.
        
        Args:
            autonomy_manager: AutonomyManager for task execution
            executor: Function to execute tasks (if autonomy_manager not provided)
            storage_dir: Directory for schedule storage
            check_interval: Interval between schedule checks
            auto_start: Whether to automatically start the scheduler
        """
        self.autonomy_manager = autonomy_manager
        self.executor = executor
        self.storage_dir = storage_dir
        self.check_interval = check_interval
        
        # Create storage directory if needed
        if self.storage_dir:
            os.makedirs(self.storage_dir, exist_ok=True)
        
        # Schedule storage
        self._schedules: Dict[str, Schedule] = {}
        self._schedule_queue: List[tuple] = []  # Priority queue for upcoming schedules
        
        # Control flags
        self._running = False
        self._scheduler_thread = None
        
        # Start scheduler if requested
        if auto_start:
            self.start()
    
    def start(self):
        """Start the scheduler."""
        if self._running:
            logger.warning("Scheduler already running")
            return
            
        # Load schedules
        self._load_schedules()
        
        # Update next run times and build queue
        self._rebuild_queue()
        
        # Start scheduler thread
        self._running = True
        self._scheduler_thread = threading.Thread(
            target=self._scheduler_worker,
            name="schedule-worker",
            daemon=True
        )
        self._scheduler_thread.start()
        
        logger.info("Schedule manager started")
    
    def stop(self):
        """Stop the scheduler."""
        if not self._running:
            logger.warning("Scheduler not running")
            return
            
        logger.info("Stopping schedule manager")
        self._running = False
        
        # Wait for scheduler thread to finish
        if self._scheduler_thread and self._scheduler_thread.is_alive():
            self._scheduler_thread.join(timeout=5.0)
        
        # Save schedules
        self._save_schedules()
        
        logger.info("Schedule manager stopped")
    
    def create_schedule(
        self,
        name: str,
        action: str,
        parameters: Dict[str, Any],
        schedule_type: Union[ScheduleType, str] = ScheduleType.ONCE,
        **kwargs
    ) -> str:
        """
        Create a new schedule.
        
        Args:
            name: Schedule name
            action: Action to perform
            parameters: Action parameters
            schedule_type: Type of schedule
            **kwargs: Additional schedule parameters
            
        Returns:
            Schedule ID
        """
        # Convert string type to enum
        if isinstance(schedule_type, str):
            schedule_type = ScheduleType(schedule_type)
        
        # Create schedule
        schedule = Schedule(
            name=name,
            action=action,
            parameters=parameters,
            schedule_type=schedule_type,
            **kwargs
        )
        
        # Calculate initial next_run time
        schedule.next_run = self._calculate_next_run(schedule)
        
        # Store schedule
        self._schedules[schedule.schedule_id] = schedule
        
        # Update queue
        self._add_to_queue(schedule)
        
        # Save schedules
        self._save_schedules()
        
        logger.info(f"Created {schedule_type} schedule {schedule.schedule_id} ({name})")
        return schedule.schedule_id
    
    def get_schedule(self, schedule_id: str) -> Optional[Schedule]:
        """Get a schedule by ID."""
        return self._schedules.get(schedule_id)
    
    def update_schedule(self, schedule_id: str, **kwargs) -> bool:
        """
        Update a schedule.
        
        Args:
            schedule_id: Schedule ID
            **kwargs: Schedule properties to update
            
        Returns:
            Whether the schedule was updated
        """
        if schedule_id not in self._schedules:
            logger.warning(f"Schedule {schedule_id} not found")
            return False
        
        schedule = self._schedules[schedule_id]
        
        # Update special fields
        if "schedule_type" in kwargs:
            # Convert string type to enum
            if isinstance(kwargs["schedule_type"], str):
                kwargs["schedule_type"] = ScheduleType(kwargs["schedule_type"])
        
        # Update schedule properties
        for key, value in kwargs.items():
            if hasattr(schedule, key):
                setattr(schedule, key, value)
        
        # Recalculate next run time
        schedule.next_run = self._calculate_next_run(schedule)
        
        # Rebuild queue
        self._rebuild_queue()
        
        # Save schedules
        self._save_schedules()
        
        logger.info(f"Updated schedule {schedule_id}")
        return True
    
    def delete_schedule(self, schedule_id: str) -> bool:
        """
        Delete a schedule.
        
        Args:
            schedule_id: Schedule ID
            
        Returns:
            Whether the schedule was deleted
        """
        if schedule_id not in self._schedules:
            logger.warning(f"Schedule {schedule_id} not found")
            return False
        
        # Remove from schedules
        del self._schedules[schedule_id]
        
        # Rebuild queue
        self._rebuild_queue()
        
        # Save schedules
        self._save_schedules()
        
        logger.info(f"Deleted schedule {schedule_id}")
        return True
    
    def list_schedules(
        self,
        enabled: Optional[bool] = None,
        schedule_type: Optional[Union[ScheduleType, str, List[Union[ScheduleType, str]]]] = None,
        tags: Optional[List[str]] = None
    ) -> List[Schedule]:
        """
        List schedules, optionally filtered.
        
        Args:
            enabled: Filter by enabled status
            schedule_type: Filter by schedule type(s)
            tags: Filter by tags (all specified tags must be present)
            
        Returns:
            List of matching schedules
        """
        result = []
        
        # Convert single type to list
        if schedule_type is not None and not isinstance(schedule_type, list):
            schedule_type = [schedule_type]
        
        # Convert string types to enums
        if schedule_type:
            schedule_type = [
                ScheduleType(t) if isinstance(t, str) else t
                for t in schedule_type
            ]
        
        # Filter schedules
        for schedule in self._schedules.values():
            # Filter by enabled status
            if enabled is not None and schedule.enabled != enabled:
                continue
            
            # Filter by schedule type
            if schedule_type and schedule.schedule_type not in schedule_type:
                continue
            
            # Filter by tags
            if tags and not all(tag in schedule.tags for tag in tags):
                continue
            
            result.append(schedule)
        
        return result
    
    def enable_schedule(self, schedule_id: str) -> bool:
        """
        Enable a schedule.
        
        Args:
            schedule_id: Schedule ID
            
        Returns:
            Whether the schedule was enabled
        """
        if schedule_id not in self._schedules:
            logger.warning(f"Schedule {schedule_id} not found")
            return False
        
        schedule = self._schedules[schedule_id]
        
        # Skip if already enabled
        if schedule.enabled:
            return True
        
        # Enable schedule
        schedule.enabled = True
        
        # Recalculate next run time
        schedule.next_run = self._calculate_next_run(schedule)
        
        # Rebuild queue
        self._rebuild_queue()
        
        # Save schedules
        self._save_schedules()
        
        logger.info(f"Enabled schedule {schedule_id}")
        return True
    
    def disable_schedule(self, schedule_id: str) -> bool:
        """
        Disable a schedule.
        
        Args:
            schedule_id: Schedule ID
            
        Returns:
            Whether the schedule was disabled
        """
        if schedule_id not in self._schedules:
            logger.warning(f"Schedule {schedule_id} not found")
            return False
        
        schedule = self._schedules[schedule_id]
        
        # Skip if already disabled
        if not schedule.enabled:
            return True
        
        # Disable schedule
        schedule.enabled = False
        
        # Rebuild queue
        self._rebuild_queue()
        
        # Save schedules
        self._save_schedules()
        
        logger.info(f"Disabled schedule {schedule_id}")
        return True
    
    def run_now(self, schedule_id: str) -> bool:
        """
        Run a schedule immediately.
        
        Args:
            schedule_id: Schedule ID
            
        Returns:
            Whether the schedule was executed
        """
        if schedule_id not in self._schedules:
            logger.warning(f"Schedule {schedule_id} not found")
            return False
        
        schedule = self._schedules[schedule_id]
        
        # Execute schedule
        self._execute_schedule(schedule)
        
        return True
    
    def _scheduler_worker(self):
        """Worker thread for schedule execution."""
        logger.info("Scheduler worker started")
        
        while self._running:
            try:
                # Check if there are any schedules to run
                now = time.time()
                
                while self._schedule_queue and self._schedule_queue[0][0] <= now:
                    # Get the next schedule
                    _, schedule_id = heapq.heappop(self._schedule_queue)
                    
                    # Check if schedule still exists and is enabled
                    if (schedule_id in self._schedules and 
                        self._schedules[schedule_id].enabled):
                        
                        schedule = self._schedules[schedule_id]
                        
                        # Execute schedule
                        self._execute_schedule(schedule)
                        
                        # Update next run time for recurring schedules
                        if schedule.schedule_type != ScheduleType.ONCE:
                            schedule.next_run = self._calculate_next_run(schedule)
                            
                            # Add back to queue if not completed
                            if (schedule.next_run is not None and 
                                (schedule.max_runs is None or schedule.run_count < schedule.max_runs)):
                                self._add_to_queue(schedule)
                    
                # Sleep until next check
                time.sleep(self.check_interval)
                
            except Exception as e:
                logger.error(f"Error in scheduler worker: {str(e)}")
                import traceback
                logger.debug(traceback.format_exc())
                time.sleep(1.0)
        
        logger.info("Scheduler worker stopped")
    
    def _execute_schedule(self, schedule: Schedule):
        """
        Execute a schedule.
        
        Args:
            schedule: Schedule to execute
        """
        logger.info(f"Executing schedule {schedule.schedule_id} ({schedule.name})")
        
        # Update execution tracking
        schedule.last_run = time.time()
        schedule.run_count += 1
        
        # Execute action
        try:
            if self.autonomy_manager and HAS_AUTONOMY:
                # Execute using autonomy manager
                task_id = self.autonomy_manager.create_task(
                    action=schedule.action,
                    parameters=schedule.parameters,
                    name=f"Scheduled: {schedule.name}",
                    description=f"Scheduled task from {schedule.schedule_id}",
                    metadata={
                        "scheduled": True,
                        "schedule_id": schedule.schedule_id,
                        "schedule_type": schedule.schedule_type,
                        "run_count": schedule.run_count
                    }
                )
                logger.info(f"Created autonomy task {task_id} for schedule {schedule.schedule_id}")
                
            elif self.executor:
                # Execute using custom executor
                result = self.executor(schedule.action, schedule.parameters)
                logger.info(f"Executed schedule {schedule.schedule_id} with result: {result}")
                
            else:
                logger.warning(f"No executor available for schedule {schedule.schedule_id}")
                
        except Exception as e:
            logger.error(f"Error executing schedule {schedule.schedule_id}: {str(e)}")
            import traceback
            logger.debug(traceback.format_exc())
        
        # Save schedules
        self._save_schedules()
    
    def _add_to_queue(self, schedule: Schedule):
        """
        Add a schedule to the priority queue.
        
        Args:
            schedule: Schedule to add
        """
        if not schedule.enabled or schedule.next_run is None:
            return
            
        heapq.heappush(self._schedule_queue, (schedule.next_run, schedule.schedule_id))
    
    def _rebuild_queue(self):
        """Rebuild the priority queue of schedules."""
        # Clear queue
        self._schedule_queue.clear()
        
        # Add all enabled schedules with a next_run time
        for schedule in self._schedules.values():
            if schedule.enabled and schedule.next_run is not None:
                heapq.heappush(self._schedule_queue, (schedule.next_run, schedule.schedule_id))
    
    def _calculate_next_run(self, schedule: Schedule) -> Optional[float]:
        """
        Calculate the next run time for a schedule.
        
        Args:
            schedule: Schedule to calculate for
            
        Returns:
            Next run time (timestamp) or None if no more runs
        """
        # If schedule is disabled, no next run
        if not schedule.enabled:
            return None
            
        # If max runs reached, no next run
        if schedule.max_runs is not None and schedule.run_count >= schedule.max_runs:
            return None
            
        # Get current time
        now = time.time()
        
        # Check start time
        if schedule.start_time is not None and now < schedule.start_time:
            # First run hasn't happened yet
            return schedule.start_time
            
        # Check end time
        if schedule.end_time is not None and now >= schedule.end_time:
            # Past end time, no more runs
            return None
            
        # Handle different schedule types
        if schedule.schedule_type == ScheduleType.ONCE:
            # One-time schedule
            if schedule.start_time is not None and schedule.run_count == 0:
                return schedule.start_time
            else:
                return None
                
        elif schedule.schedule_type == ScheduleType.INTERVAL:
            # Interval schedule
            if schedule.interval is None:
                logger.warning(f"Interval not specified for schedule {schedule.schedule_id}")
                return None
                
            if schedule.last_run is None:
                # First run
                return now
            else:
                # Next run is last run + interval
                return schedule.last_run + schedule.interval
                
        elif schedule.schedule_type == ScheduleType.DAILY:
            # Daily schedule
            if schedule.time_of_day is None:
                logger.warning(f"Time of day not specified for schedule {schedule.schedule_id}")
                return None
                
            # Parse time of day
            try:
                hour, minute = map(int, schedule.time_of_day.split(':'))
                
                # Create next run time
                now_dt = datetime.fromtimestamp(now)
                run_dt = datetime(
                    year=now_dt.year,
                    month=now_dt.month,
                    day=now_dt.day,
                    hour=hour,
                    minute=minute
                )
                
                # If time already passed today, use tomorrow
                if run_dt.timestamp() <= now:
                    run_dt += timedelta(days=1)
                    
                return run_dt.timestamp()
                
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid time of day for schedule {schedule.schedule_id}: {str(e)}")
                return None
                
        elif schedule.schedule_type == ScheduleType.WEEKLY:
            # Weekly schedule
            if not schedule.days:
                logger.warning(f"Days not specified for schedule {schedule.schedule_id}")
                return None
                
            if schedule.time_of_day is None:
                logger.warning(f"Time of day not specified for schedule {schedule.schedule_id}")
                return None
                
            try:
                # Parse time of day
                hour, minute = map(int, schedule.time_of_day.split(':'))
                
                # Get current weekday (0-6, where 0 is Monday)
                now_dt = datetime.fromtimestamp(now)
                current_weekday = now_dt.weekday()
                
                # Find next weekday in the list
                days_until_next = None
                for day in sorted(schedule.days):
                    if day == current_weekday and now_dt.hour < hour or (now_dt.hour == hour and now_dt.minute < minute):
                        # Today is in the list and the time hasn't passed yet
                        days_until_next = 0
                        break
                    elif day > current_weekday:
                        # Next occurrence is later this week
                        days_until_next = day - current_weekday
                        break
                
                # If no day found, wrap around to next week
                if days_until_next is None:
                    days_until_next = 7 - current_weekday + min(schedule.days)
                
                # Create next run time
                run_dt = datetime(
                    year=now_dt.year,
                    month=now_dt.month,
                    day=now_dt.day,
                    hour=hour,
                    minute=minute
                ) + timedelta(days=days_until_next)
                
                return run_dt.timestamp()
                
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid time specification for schedule {schedule.schedule_id}: {str(e)}")
                return None
                
        elif schedule.schedule_type == ScheduleType.MONTHLY:
            # Monthly schedule
            if not schedule.days:
                logger.warning(f"Day of month not specified for schedule {schedule.schedule_id}")
                return None
                
            if schedule.time_of_day is None:
                logger.warning(f"Time of day not specified for schedule {schedule.schedule_id}")
                return None
                
            try:
                # Parse time of day
                hour, minute = map(int, schedule.time_of_day.split(':'))
                
                # Get current date/time
                now_dt = datetime.fromtimestamp(now)
                
                # Get day of month (use first day in list)
                day_of_month = schedule.days[0]
                
                # Create next run time
                try:
                    # Try this month
                    run_dt = datetime(
                        year=now_dt.year,
                        month=now_dt.month,
                        day=day_of_month,
                        hour=hour,
                        minute=minute
                    )
                    
                    # If time already passed this month, use next month
                    if run_dt.timestamp() <= now:
                        if now_dt.month == 12:
                            run_dt = datetime(
                                year=now_dt.year + 1,
                                month=1,
                                day=day_of_month,
                                hour=hour,
                                minute=minute
                            )
                        else:
                            run_dt = datetime(
                                year=now_dt.year,
                                month=now_dt.month + 1,
                                day=day_of_month,
                                hour=hour,
                                minute=minute
                            )
                except ValueError:
                    # Handle invalid day for month (e.g., February 30)
                    if now_dt.month == 12:
                        next_month = 1
                        next_year = now_dt.year + 1
                    else:
                        next_month = now_dt.month + 1
                        next_year = now_dt.year
                        
                    # Find last day of next month
                    if day_of_month > 28:
                        if next_month == 2:
                            # February
                            if (next_year % 4 == 0 and next_year % 100 != 0) or (next_year % 400 == 0):
                                # Leap year
                                day = min(day_of_month, 29)
                            else:
                                day = min(day_of_month, 28)
                        elif next_month in (4, 6, 9, 11):
                            # 30-day month
                            day = min(day_of_month, 30)
                        else:
                            # 31-day month
                            day = day_of_month
                    else:
                        day = day_of_month
                        
                    run_dt = datetime(
                        year=next_year,
                        month=next_month,
                        day=day,
                        hour=hour,
                        minute=minute
                    )
                
                return run_dt.timestamp()
                
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid time specification for schedule {schedule.schedule_id}: {str(e)}")
                return None
                
        elif schedule.schedule_type == ScheduleType.CRON:
            # Cron schedule
            if schedule.cron_expression is None:
                logger.warning(f"Cron expression not specified for schedule {schedule.schedule_id}")
                return None
                
            try:
                import croniter
                
                # Create croniter
                cron = croniter.croniter(schedule.cron_expression, datetime.fromtimestamp(now))
                
                # Get next run time
                next_dt = cron.get_next(datetime)
                
                return next_dt.timestamp()
                
            except ImportError:
                logger.warning("Croniter not installed. Install with: pip install croniter")
                return None
                
            except Exception as e:
                logger.warning(f"Invalid cron expression for schedule {schedule.schedule_id}: {str(e)}")
                return None
                
        else:
            logger.warning(f"Unknown schedule type: {schedule.schedule_type}")
            return None
    
    def _save_schedules(self):
        """Save schedules to storage."""
        if not self.storage_dir:
            return
            
        try:
            # Convert schedules to dictionaries
            schedules_data = {
                schedule_id: schedule.to_dict()
                for schedule_id, schedule in self._schedules.items()
            }
            
            # Create data to save
            data = {
                "schedules": schedules_data,
                "timestamp": time.time()
            }
            
            # Save to file
            file_path = os.path.join(self.storage_dir, "schedules.json")
            
            # Create a temporary file first
            temp_path = file_path + ".tmp"
            with open(temp_path, "w") as f:
                json.dump(data, f, indent=2)
                
            # Rename to final file (atomic operation)
            os.replace(temp_path, file_path)
            
            logger.debug(f"Saved {len(schedules_data)} schedules to {file_path}")
            
        except Exception as e:
            logger.error(f"Error saving schedules: {str(e)}")
    
    def _load_schedules(self):
        """Load schedules from storage."""
        if not self.storage_dir:
            return
            
        file_path = os.path.join(self.storage_dir, "schedules.json")
        if not os.path.exists(file_path):
            return
            
        try:
            # Load from file
            with open(file_path, "r") as f:
                data = json.load(f)
                
            # Get schedules data
            schedules_data = data.get("schedules", {})
            
            # Clear existing data
            self._schedules.clear()
            
            # Convert to schedules
            for schedule_id, item_data in schedules_data.items():
                try:
                    # Convert schedule type from string to enum
                    if "schedule_type" in item_data and isinstance(item_data["schedule_type"], str):
                        item_data["schedule_type"] = ScheduleType(item_data["schedule_type"])
                        
                    schedule = Schedule.from_dict(item_data)
                    
                    # Update next run time
                    schedule.next_run = self._calculate_next_run(schedule)
                    
                    self._schedules[schedule_id] = schedule
                except Exception as e:
                    logger.error(f"Error loading schedule {schedule_id}: {str(e)}")
            
            logger.info(f"Loaded {len(schedules_data)} schedules from {file_path}")
            
        except Exception as e:
            logger.error(f"Error loading schedules: {str(e)}")


# Helper functions for schedule creation

def create_daily_schedule(
    scheduler: ScheduleManager,
    name: str,
    action: str,
    parameters: Dict[str, Any],
    time_of_day: str,  # HH:MM
    **kwargs
) -> str:
    """
    Create a daily schedule.
    
    Args:
        scheduler: Schedule manager
        name: Schedule name
        action: Action to perform
        parameters: Action parameters
        time_of_day: Time of day to run (HH:MM)
        **kwargs: Additional schedule parameters
        
    Returns:
        Schedule ID
    """
    return scheduler.create_schedule(
        name=name,
        action=action,
        parameters=parameters,
        schedule_type=ScheduleType.DAILY,
        time_of_day=time_of_day,
        **kwargs
    )


def create_weekly_schedule(
    scheduler: ScheduleManager,
    name: str,
    action: str,
    parameters: Dict[str, Any],
    days: List[int],  # 0-6, where 0 is Monday
    time_of_day: str,  # HH:MM
    **kwargs
) -> str:
    """
    Create a weekly schedule.
    
    Args:
        scheduler: Schedule manager
        name: Schedule name
        action: Action to perform
        parameters: Action parameters
        days: Days of week to run (0-6, where 0 is Monday)
        time_of_day: Time of day to run (HH:MM)
        **kwargs: Additional schedule parameters
        
    Returns:
        Schedule ID
    """
    return scheduler.create_schedule(
        name=name,
        action=action,
        parameters=parameters,
        schedule_type=ScheduleType.WEEKLY,
        days=days,
        time_of_day=time_of_day,
        **kwargs
    )


def create_interval_schedule(
    scheduler: ScheduleManager,
    name: str,
    action: str,
    parameters: Dict[str, Any],
    interval: float,  # Seconds between runs
    **kwargs
) -> str:
    """
    Create an interval schedule.
    
    Args:
        scheduler: Schedule manager
        name: Schedule name
        action: Action to perform
        parameters: Action parameters
        interval: Seconds between runs
        **kwargs: Additional schedule parameters
        
    Returns:
        Schedule ID
    """
    return scheduler.create_schedule(
        name=name,
        action=action,
        parameters=parameters,
        schedule_type=ScheduleType.INTERVAL,
        interval=interval,
        **kwargs
    )


# Command-line interface for testing
def main():
    """Command-line interface for testing scheduler."""
    import argparse
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Test scheduler")
    parser.add_argument("--storage", help="Storage directory", default="cache/scheduler")
    
    args = parser.parse_args()
    
    # Create test task executor
    def execute_task(action, parameters):
        print(f"Executing task: {action}")
        print(f"Parameters: {parameters}")
        return {"status": "success", "action": action}
    
    # Create scheduler
    scheduler = ScheduleManager(
        storage_dir=args.storage,
        executor=execute_task,
        check_interval=1.0,
        auto_start=False
    )
    
    # Load schedules
    scheduler._load_schedules()
    
    # Create a test schedule
    def create_test_schedule():
        # Create once schedule (runs immediately)
        once_id = scheduler.create_schedule(
            name="Test Once Schedule",
            action="test_action",
            parameters={"test": True, "type": "once"},
            schedule_type=ScheduleType.ONCE,
            start_time=time.time() + 5  # Run 5 seconds from now
        )
        print(f"Created once schedule: {once_id}")
        
        # Create interval schedule (runs every 10 seconds)
        interval_id = scheduler.create_schedule(
            name="Test Interval Schedule",
            action="test_action",
            parameters={"test": True, "type": "interval"},
            schedule_type=ScheduleType.INTERVAL,
            interval=10.0,
            max_runs=3  # Run 3 times
        )
        print(f"Created interval schedule: {interval_id}")
    
    # Create test schedules if none exist
    if not scheduler._schedules:
        create_test_schedule()
    
    # Start scheduler
    scheduler.start()
    
    try:
        print("Scheduler running. Press Ctrl+C to exit.")
        print(f"Active schedules: {len(scheduler._schedules)}")
        
        # Wait for schedules to run
        while True:
            time.sleep(1.0)
            
    except KeyboardInterrupt:
        print("\nStopping scheduler...")
        
    finally:
        # Stop scheduler
        scheduler.stop()
        print("Scheduler stopped")


if __name__ == "__main__":
    main() 