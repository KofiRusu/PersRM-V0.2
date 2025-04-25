"""
Autonomy Loop Module

This module provides autonomous execution of recurring tasks without human prompting.
"""

import os
import time
import yaml
import json
import logging
import argparse
import threading
from typing import Dict, List, Any, Optional, Callable, Union, Tuple
from pathlib import Path

from .autonomy import AutonomyManager, ActionRegistry, Task, TaskResult, AutonomyLevel
from .feedback import FeedbackManager, FeedbackType, FeedbackSource
from .scheduler import ScheduleManager, Schedule, ScheduleType

# Import personalization components if available
try:
    from src.personalization import personalization_manager
    HAS_PERSONALIZATION = True
except ImportError:
    HAS_PERSONALIZATION = False

# Import memory components if available
try:
    from src.memory import Memory
    HAS_MEMORY = True
except ImportError:
    HAS_MEMORY = False

# Import agents components if available
try:
    from src.agents import AgentManager
    HAS_AGENTS = True
except ImportError:
    HAS_AGENTS = False

logger = logging.getLogger(__name__)


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Load configuration from YAML file.
    
    Args:
        config_path: Path to configuration file
        
    Returns:
        Configuration dictionary
    """
    # Default config path
    if not config_path:
        config_path = os.path.join(os.path.dirname(__file__), "config", "config.yaml")
    
    # Load configuration
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        logger.info(f"Loaded configuration from {config_path}")
        return config
    except Exception as e:
        logger.warning(f"Error loading configuration from {config_path}: {e}")
        logger.info("Using default configuration")
        return {}


class AutonomyLoop:
    """
    Autonomy loop for recurring task execution.
    
    Features:
    - Autonomous execution of recurring tasks
    - Integration with personalization, memory, and agents
    - Feedback collection and processing
    - Support for various recurring tasks (daily review, task tracking, research)
    """
    
    def __init__(
        self,
        config_path: Optional[str] = None,
        storage_dir: Optional[str] = None,
        autonomy_level: Optional[str] = None
    ):
        """
        Initialize the autonomy loop.
        
        Args:
            config_path: Path to configuration file
            storage_dir: Directory for data storage
            autonomy_level: Autonomy level override (disabled, assisted, supervised, full)
        """
        self.config = load_config(config_path)
        self.storage_dir = storage_dir or os.path.join("data", "autonomy")
        
        # Get autonomy level from arguments, config, or default
        autonomy_config = self.config.get('autonomy', {})
        if autonomy_level:
            self.autonomy_level = AutonomyLevel(autonomy_level)
        else:
            self.autonomy_level = AutonomyLevel(autonomy_config.get('default_level', 'supervised'))
        
        logger.info(f"Autonomy level: {self.autonomy_level}")
        
        # Initialize components
        self._initialize_components()
        
        # Register actions
        self._register_actions()
        
        # Load recurring tasks
        self._load_recurring_tasks()
        
        # Control flags
        self.running = False
        self.loop_thread = None
    
    def _initialize_components(self):
        """Initialize required components."""
        # Create storage directories
        os.makedirs(self.storage_dir, exist_ok=True)
        
        # Get configuration
        autonomy_config = self.config.get('autonomy', {})
        scheduler_config = self.config.get('scheduler', {})
        feedback_config = self.config.get('feedback', {})
        
        # Initialize personalization
        self.personalization = None
        if HAS_PERSONALIZATION:
            self.personalization = personalization_manager
            logger.info("Personalization system initialized")
        
        # Initialize memory
        self.memory = None
        if HAS_MEMORY:
            self.memory = Memory()
            logger.info("Memory system initialized")
        
        # Initialize agents
        self.agents = None
        if HAS_AGENTS:
            self.agents = AgentManager()
            logger.info("Agent system initialized")
        
        # Initialize action registry
        self.action_registry = ActionRegistry()
        
        # Initialize autonomy manager
        persistence_config = autonomy_config.get('persistence', {})
        persistence_dir = None
        if persistence_config.get('enable', True):
            persistence_dir = os.path.join(self.storage_dir, "tasks")
        
        self.autonomy_manager = AutonomyManager(
            autonomy_level=self.autonomy_level,
            max_concurrent_tasks=autonomy_config.get('max_concurrent_tasks', 5),
            action_registry=self.action_registry,
            approval_callback=self._approval_callback,
            completion_callback=self._completion_callback,
            persistence_dir=persistence_dir,
            safety_checks=[self._safety_check]
        )
        
        # Initialize feedback manager
        feedback_dir = None
        if feedback_config.get('storage_dir'):
            feedback_dir = feedback_config.get('storage_dir')
        else:
            feedback_dir = os.path.join(self.storage_dir, "feedback")
        
        self.feedback_manager = FeedbackManager(
            storage_dir=feedback_dir,
            auto_save=feedback_config.get('auto_save', True),
            save_interval=feedback_config.get('save_interval', 60.0)
        )
        self.feedback_manager.add_processor(self._feedback_processor)
        
        # Initialize scheduler
        scheduler_dir = None
        if scheduler_config.get('storage_dir'):
            scheduler_dir = scheduler_config.get('storage_dir')
        else:
            scheduler_dir = os.path.join(self.storage_dir, "schedules")
        
        self.schedule_manager = ScheduleManager(
            autonomy_manager=self.autonomy_manager,
            storage_dir=scheduler_dir,
            check_interval=scheduler_config.get('check_interval', 1.0),
            auto_start=False  # We'll start it manually
        )
        
        logger.info("Autonomy loop components initialized")
    
    def _register_actions(self):
        """Register available actions."""
        # Register basic actions
        self.action_registry.register(
            name="log_message",
            func=self._action_log_message,
            description="Log a message",
            parameters={
                "message": "Message to log",
                "level": "Logging level (info, warning, error)"
            }
        )
        
        self.action_registry.register(
            name="wait",
            func=self._action_wait,
            description="Wait for specified duration",
            parameters={
                "duration": "Duration to wait in seconds"
            }
        )
        
        # Register task-specific actions
        self.action_registry.register(
            name="daily_review",
            func=self._action_daily_review,
            description="Review system performance and user interactions",
            parameters={
                "timeframe": "Timeframe to review (e.g., '1 day')",
                "include_metrics": "Whether to include metrics",
                "include_feedback": "Whether to include feedback",
                "generate_report": "Whether to generate a report"
            }
        )
        
        self.action_registry.register(
            name="memory_consolidation",
            func=self._action_memory_consolidation,
            description="Consolidate and organize memory",
            parameters={
                "memory_limit": "Maximum number of memories to process"
            }
        )
        
        self.action_registry.register(
            name="news_update",
            func=self._action_news_update,
            description="Fetch and summarize latest news",
            parameters={
                "categories": "List of news categories",
                "max_articles": "Maximum number of articles to process"
            }
        )
        
        self.action_registry.register(
            name="debug_errors",
            func=self._action_debug_errors,
            description="Analyze and attempt to resolve recent errors",
            parameters={
                "max_errors": "Maximum number of errors to process",
                "auto_fix": "Whether to automatically fix errors"
            }
        )
        
        self.action_registry.register(
            name="knowledge_update",
            func=self._action_knowledge_update,
            description="Update system knowledge",
            parameters={
                "sources": "List of knowledge sources",
                "max_items": "Maximum number of items to process"
            }
        )
        
        logger.info(f"Registered {len(self.action_registry.list_actions())} actions")
    
    def _load_recurring_tasks(self):
        """Load recurring tasks from configuration."""
        scheduler_config = self.config.get('scheduler', {})
        recurring_tasks = scheduler_config.get('recurring_tasks', [])
        
        if not recurring_tasks:
            logger.info("No recurring tasks configured")
            return
        
        logger.info(f"Loading {len(recurring_tasks)} recurring tasks")
        
        for task_config in recurring_tasks:
            # Skip disabled tasks
            if not task_config.get('enabled', True):
                continue
                
            # Get task parameters
            name = task_config.get('name', 'Unnamed Task')
            description = task_config.get('description', '')
            schedule_type = task_config.get('schedule_type', 'once')
            action = task_config.get('action')
            parameters = task_config.get('parameters', {})
            
            # Skip if missing required fields
            if not action or not self.action_registry.has_action(action):
                logger.warning(f"Skipping task '{name}': Invalid action '{action}'")
                continue
            
            # Create schedule
            try:
                schedule_id = self.schedule_manager.create_schedule(
                    name=name,
                    action=action,
                    parameters=parameters,
                    schedule_type=schedule_type,
                    description=description,
                    **{k: v for k, v in task_config.items() if k not in ('name', 'description', 'schedule_type', 'action', 'parameters', 'enabled')}
                )
                logger.info(f"Created schedule for task '{name}' ({schedule_id})")
            except Exception as e:
                logger.error(f"Error creating schedule for task '{name}': {str(e)}")
    
    def _approval_callback(self, task: Task) -> bool:
        """
        Callback for task approval.
        
        Args:
            task: Task to approve
            
        Returns:
            Whether the task is approved
        """
        # Autonomy level determines approval behavior
        if self.autonomy_level == AutonomyLevel.FULL:
            # Full autonomy approves all tasks
            logger.info(f"Auto-approving task '{task.name}' (full autonomy)")
            return True
        
        elif self.autonomy_level == AutonomyLevel.SUPERVISED:
            # Supervised autonomy has conditional approval
            require_approval = self.config.get('autonomy', {}).get('require_approval', {})
            
            # Check if this is a new task
            is_new = task.metadata.get('is_new', True)
            if is_new and require_approval.get('new_tasks', True):
                logger.info(f"Requiring approval for new task '{task.name}'")
                return self._request_human_approval(task)
            
            # Check if this is a modified task
            is_modified = task.metadata.get('is_modified', False)
            if is_modified and require_approval.get('modified_tasks', True):
                logger.info(f"Requiring approval for modified task '{task.name}'")
                return self._request_human_approval(task)
            
            # Check if this is a high-risk task
            is_high_risk = task.metadata.get('is_high_risk', False) or self._is_high_risk_task(task)
            if is_high_risk and require_approval.get('high_risk', True):
                logger.info(f"Requiring approval for high-risk task '{task.name}'")
                return self._request_human_approval(task)
            
            # Otherwise, auto-approve
            logger.info(f"Auto-approving task '{task.name}' (supervised autonomy)")
            return True
            
        elif self.autonomy_level == AutonomyLevel.ASSISTED:
            # Assisted autonomy requires approval for all tasks
            logger.info(f"Requiring approval for task '{task.name}' (assisted autonomy)")
            return self._request_human_approval(task)
            
        else:  # DISABLED
            # Disabled autonomy rejects all tasks
            logger.info(f"Rejecting task '{task.name}' (autonomy disabled)")
            return False
    
    def _is_high_risk_task(self, task: Task) -> bool:
        """
        Check if a task is high-risk.
        
        Args:
            task: Task to check
            
        Returns:
            Whether the task is high-risk
        """
        # TODO: Implement more sophisticated risk assessment
        high_risk_actions = [
            "debug_errors",
            "clear_memory",
            "system_update",
            "execute_command"
        ]
        
        return task.action in high_risk_actions
    
    def _request_human_approval(self, task: Task) -> bool:
        """
        Request human approval for a task.
        
        Args:
            task: Task to approve
            
        Returns:
            Whether the task is approved
        """
        # TODO: Implement proper human approval interface
        # For now, we just auto-approve for testing
        logger.warning(f"Human approval interface not implemented, auto-approving task '{task.name}'")
        return True
    
    def _completion_callback(self, task: Task, result: TaskResult):
        """
        Callback for task completion.
        
        Args:
            task: Completed task
            result: Task result
        """
        # Log completion
        if result.success:
            logger.info(f"Task '{task.name}' completed successfully")
        else:
            logger.warning(f"Task '{task.name}' failed: {result.error}")
        
        # Store in memory if available
        if self.memory:
            memory_data = {
                "task_id": task.task_id,
                "name": task.name,
                "action": task.action,
                "parameters": task.parameters,
                "success": result.success,
                "error": result.error,
                "execution_time": result.execution_time,
                "timestamp": time.time()
            }
            
            if result.success:
                memory_data["result"] = result.result
                
            self.memory.add("task_execution", memory_data)
        
        # Add feedback
        if self.feedback_manager:
            if result.success:
                self.feedback_manager.add_feedback(
                    feedback_type=FeedbackType.LIKE,
                    content=f"Task '{task.name}' executed successfully",
                    source=FeedbackSource.SYSTEM,
                    target_id=task.task_id,
                    target_type="task",
                    context={
                        "task": task.to_dict(),
                        "result": {
                            "success": result.success,
                            "execution_time": result.execution_time
                        }
                    }
                )
            else:
                self.feedback_manager.add_feedback(
                    feedback_type=FeedbackType.DISLIKE,
                    content=f"Task '{task.name}' failed: {result.error}",
                    source=FeedbackSource.SYSTEM,
                    target_id=task.task_id,
                    target_type="task",
                    context={
                        "task": task.to_dict(),
                        "result": {
                            "success": result.success,
                            "error": result.error,
                            "execution_time": result.execution_time
                        }
                    }
                )
    
    def _safety_check(self, task: Task) -> Tuple[bool, str]:
        """
        Safety check for tasks.
        
        Args:
            task: Task to check
            
        Returns:
            Tuple of (is_safe, reason)
        """
        # Get safety configuration
        safety_config = self.config.get('autonomy', {}).get('safety', {})
        
        # Check if safety checks are enabled
        if not safety_config.get('enable_safety_checks', True):
            return True, "Safety checks disabled"
        
        # Check for restricted actions
        restricted_actions = safety_config.get('restricted_actions', [])
        if task.action in restricted_actions:
            return False, f"Action '{task.action}' is restricted"
        
        # Perform other safety checks as needed
        # ...
        
        return True, "Task passed safety checks"
    
    def _feedback_processor(self, feedback):
        """
        Process feedback for learning.
        
        Args:
            feedback: Feedback to process
        """
        # TODO: Implement feedback-based learning
        pass
    
    def start(self):
        """Start the autonomy loop."""
        if self.running:
            logger.warning("Autonomy loop already running")
            return
        
        # Start autonomy manager
        self.autonomy_manager.start()
        
        # Start scheduler
        self.schedule_manager.start()
        
        self.running = True
        logger.info("Autonomy loop started")
        
        # Start monitoring thread
        self.loop_thread = threading.Thread(
            target=self._monitor_loop,
            name="autonomy-monitor",
            daemon=True
        )
        self.loop_thread.start()
    
    def stop(self):
        """Stop the autonomy loop."""
        if not self.running:
            logger.warning("Autonomy loop not running")
            return
        
        logger.info("Stopping autonomy loop")
        
        # Stop scheduler
        self.schedule_manager.stop()
        
        # Stop autonomy manager
        self.autonomy_manager.stop()
        
        self.running = False
        
        # Wait for monitoring thread to finish
        if self.loop_thread and self.loop_thread.is_alive():
            self.loop_thread.join(timeout=5.0)
        
        logger.info("Autonomy loop stopped")
    
    def _monitor_loop(self):
        """Monitor the autonomy loop."""
        while self.running:
            try:
                # Check for issues
                # ...
                
                # Sleep for a bit
                time.sleep(10.0)
                
            except Exception as e:
                logger.error(f"Error in autonomy monitor: {str(e)}")
                time.sleep(5.0)
    
    #
    # Action implementations
    #
    
    def _action_log_message(self, message: str, level: str = "info") -> str:
        """
        Log a message.
        
        Args:
            message: Message to log
            level: Logging level
            
        Returns:
            Result message
        """
        level_func = getattr(logger, level.lower(), logger.info)
        level_func(f"[Action] {message}")
        return f"Logged message: {message}"
    
    def _action_wait(self, duration: float) -> str:
        """
        Wait for specified duration.
        
        Args:
            duration: Duration to wait in seconds
            
        Returns:
            Result message
        """
        time.sleep(duration)
        return f"Waited for {duration} seconds"
    
    def _action_daily_review(
        self,
        timeframe: str = "1 day",
        include_metrics: bool = True,
        include_feedback: bool = True,
        generate_report: bool = True
    ) -> Dict[str, Any]:
        """
        Review system performance and user interactions.
        
        Args:
            timeframe: Timeframe to review
            include_metrics: Whether to include metrics
            include_feedback: Whether to include feedback
            generate_report: Whether to generate a report
            
        Returns:
            Review results
        """
        logger.info(f"Performing daily review (timeframe: {timeframe})")
        
        # Calculate time range
        end_time = time.time()
        if timeframe == "1 day":
            start_time = end_time - 86400  # 24 hours
        elif timeframe == "1 week":
            start_time = end_time - 604800  # 7 days
        else:
            start_time = end_time - 86400  # Default to 1 day
        
        # Results storage
        results = {
            "timeframe": timeframe,
            "start_time": start_time,
            "end_time": end_time,
            "timestamp": time.time()
        }
        
        # Get metrics if requested
        if include_metrics:
            # TODO: Implement metrics collection
            results["metrics"] = {
                "interactions": 0,
                "tasks_executed": 0,
                "tasks_succeeded": 0,
                "tasks_failed": 0,
                "average_response_time": 0.0
            }
        
        # Get feedback if requested
        if include_feedback and self.feedback_manager:
            recent_feedback = self.feedback_manager.list_feedback(since=start_time)
            if recent_feedback:
                feedback_summary = {
                    "count": len(recent_feedback),
                    "positive": len([f for f in recent_feedback if f.type in (FeedbackType.LIKE, FeedbackType.SELECTED)]),
                    "negative": len([f for f in recent_feedback if f.type in (FeedbackType.DISLIKE, FeedbackType.REJECTED)]),
                    "ratings": [f.content for f in recent_feedback if f.type == FeedbackType.RATING],
                    "comments": [f.content for f in recent_feedback if f.type == FeedbackType.COMMENT][:5]  # Limit to 5 comments
                }
                
                if feedback_summary["ratings"]:
                    feedback_summary["average_rating"] = sum(feedback_summary["ratings"]) / len(feedback_summary["ratings"])
                
                results["feedback"] = feedback_summary
        
        # Generate report if requested
        if generate_report:
            report = "# Daily System Review\n\n"
            report += f"Timeframe: {timeframe}\n"
            report += f"Period: {time.ctime(start_time)} to {time.ctime(end_time)}\n\n"
            
            if include_metrics and "metrics" in results:
                report += "## Metrics\n\n"
                for key, value in results["metrics"].items():
                    report += f"- {key.replace('_', ' ').title()}: {value}\n"
                report += "\n"
            
            if include_feedback and "feedback" in results:
                report += "## Feedback\n\n"
                feedback = results["feedback"]
                report += f"- Total feedback: {feedback['count']}\n"
                report += f"- Positive feedback: {feedback['positive']}\n"
                report += f"- Negative feedback: {feedback['negative']}\n"
                
                if "average_rating" in feedback:
                    report += f"- Average rating: {feedback['average_rating']:.2f}\n"
                
                if feedback.get("comments"):
                    report += "\n### Recent Comments\n\n"
                    for comment in feedback["comments"]:
                        report += f"- {comment}\n"
            
            results["report"] = report
            
            # Save report to file
            report_dir = os.path.join(self.storage_dir, "reports")
            os.makedirs(report_dir, exist_ok=True)
            
            report_path = os.path.join(report_dir, f"daily_review_{time.strftime('%Y%m%d')}.md")
            
            try:
                with open(report_path, 'w') as f:
                    f.write(report)
                results["report_path"] = report_path
            except Exception as e:
                logger.error(f"Error saving report to {report_path}: {str(e)}")
        
        logger.info(f"Daily review completed")
        return results
    
    def _action_memory_consolidation(self, memory_limit: int = 1000) -> Dict[str, Any]:
        """
        Consolidate and organize memory.
        
        Args:
            memory_limit: Maximum number of memories to process
            
        Returns:
            Consolidation results
        """
        if not self.memory:
            return {"error": "Memory system not available"}
        
        logger.info(f"Performing memory consolidation (limit: {memory_limit})")
        
        # TODO: Implement actual memory consolidation
        # For now, just return a placeholder result
        
        return {
            "memories_processed": 0,
            "memories_consolidated": 0,
            "timestamp": time.time()
        }
    
    def _action_news_update(
        self,
        categories: List[str] = None,
        max_articles: int = 10
    ) -> Dict[str, Any]:
        """
        Fetch and summarize latest news.
        
        Args:
            categories: List of news categories
            max_articles: Maximum number of articles to process
            
        Returns:
            News update results
        """
        categories = categories or ["technology", "science", "world"]
        logger.info(f"Fetching news updates for categories: {categories}")
        
        # TODO: Implement news fetching and summarization
        # For now, just return a placeholder result
        
        return {
            "categories": categories,
            "articles_processed": 0,
            "summaries": {},
            "timestamp": time.time()
        }
    
    def _action_debug_errors(
        self,
        max_errors: int = 10,
        auto_fix: bool = False
    ) -> Dict[str, Any]:
        """
        Analyze and attempt to resolve recent errors.
        
        Args:
            max_errors: Maximum number of errors to process
            auto_fix: Whether to automatically fix errors
            
        Returns:
            Debug results
        """
        logger.info(f"Debugging recent errors (limit: {max_errors}, auto_fix: {auto_fix})")
        
        # TODO: Implement error analysis and resolution
        # For now, just return a placeholder result
        
        return {
            "errors_found": 0,
            "errors_analyzed": 0,
            "errors_fixed": 0,
            "timestamp": time.time()
        }
    
    def _action_knowledge_update(
        self,
        sources: List[str] = None,
        max_items: int = 20
    ) -> Dict[str, Any]:
        """
        Update system knowledge.
        
        Args:
            sources: List of knowledge sources
            max_items: Maximum number of items to process
            
        Returns:
            Knowledge update results
        """
        sources = sources or ["news", "research_papers", "documentation"]
        logger.info(f"Updating knowledge from sources: {sources}")
        
        # TODO: Implement knowledge update
        # For now, just return a placeholder result
        
        return {
            "sources": sources,
            "items_processed": 0,
            "knowledge_updated": False,
            "timestamp": time.time()
        }


def main():
    """Command-line interface for autonomy loop."""
    parser = argparse.ArgumentParser(description="Autonomy loop for recurring tasks")
    parser.add_argument("--config", type=str, help="Path to configuration file")
    parser.add_argument("--storage", type=str, help="Storage directory")
    parser.add_argument("--autonomy", type=str, choices=["disabled", "assisted", "supervised", "full"],
                      help="Autonomy level")
    parser.add_argument("--log-level", type=str, default="info", 
                      choices=["debug", "info", "warning", "error"], help="Logging level")
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Create and start autonomy loop
    loop = AutonomyLoop(
        config_path=args.config,
        storage_dir=args.storage,
        autonomy_level=args.autonomy
    )
    
    try:
        loop.start()
        
        # Keep running until interrupted
        while True:
            time.sleep(1.0)
            
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    finally:
        loop.stop()
    

if __name__ == "__main__":
    main() 