"""
Feedback Logger Module

This module implements automatic feedback collection and logging for model performance.
"""

import os
import time
import json
import logging
import threading
from typing import Dict, List, Any, Optional, Union, Callable
from enum import Enum

from .feedback import FeedbackManager, FeedbackType, FeedbackSource, Feedback

logger = logging.getLogger(__name__)


class FeedbackCategory(str, Enum):
    """Categories of automated feedback."""
    RESPONSE_QUALITY = "response_quality"
    REASONING_QUALITY = "reasoning_quality"
    HALLUCINATION = "hallucination"
    TOOL_USAGE = "tool_usage"
    TASK_COMPLETION = "task_completion"
    PERFORMANCE = "performance"


class FeedbackSeverity(str, Enum):
    """Severity levels for feedback."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FeedbackLogger:
    """
    Automated feedback collection and logging system.
    
    Features:
    - Automatic feedback collection for various aspects of model behavior
    - Response quality assessment
    - Hallucination detection
    - Reasoning quality evaluation
    - Tool usage monitoring
    - Performance metrics tracking
    """
    
    def __init__(
        self,
        feedback_manager: Optional[FeedbackManager] = None,
        config: Optional[Dict[str, Any]] = None,
        storage_dir: Optional[str] = None,
        auto_save: bool = True,
        save_interval: float = 300.0  # 5 minutes
    ):
        """
        Initialize the feedback logger.
        
        Args:
            feedback_manager: FeedbackManager to use
            config: Configuration dictionary
            storage_dir: Directory for saving feedback logs
            auto_save: Whether to automatically save logs
            save_interval: Interval between auto-saves
        """
        self.config = config or {}
        self.storage_dir = storage_dir
        self.auto_save = auto_save
        self.save_interval = save_interval
        
        # Use provided feedback manager or create one
        if feedback_manager:
            self.feedback_manager = feedback_manager
        else:
            from .feedback import FeedbackManager
            self.feedback_manager = FeedbackManager(
                storage_dir=storage_dir,
                auto_save=auto_save,
                save_interval=save_interval
            )
        
        # Create storage directory if needed
        if self.storage_dir:
            os.makedirs(self.storage_dir, exist_ok=True)
        
        # Initialize metrics
        self._metrics = {
            "response_quality": {
                "count": 0,
                "sum": 0.0,
                "high_quality_count": 0
            },
            "hallucination": {
                "count": 0,
                "detected_count": 0,
                "severity_sum": 0.0
            },
            "reasoning_quality": {
                "count": 0,
                "sum": 0.0,
                "high_quality_count": 0,
                "invalid_steps_count": 0
            },
            "tool_usage": {
                "count": 0,
                "appropriate_count": 0,
                "successful_count": 0,
                "failed_count": 0
            },
            "task_completion": {
                "count": 0,
                "successful_count": 0,
                "failed_count": 0
            },
            "performance": {
                "response_times": [],
                "token_counts": [],
                "memory_usage": []
            }
        }
        
        # Tracking
        self._last_save_time = time.time()
        self._save_thread = None
        self._running = False
        
        # Start auto-save thread if enabled
        if self.auto_save:
            self._start_auto_save()
    
    def _start_auto_save(self):
        """Start the auto-save thread."""
        if self._save_thread and self._save_thread.is_alive():
            return
            
        self._running = True
        self._save_thread = threading.Thread(
            target=self._auto_save_worker,
            name="feedback-logger-saver",
            daemon=True
        )
        self._save_thread.start()
        
        logger.debug("Auto-save thread started")
    
    def _auto_save_worker(self):
        """Auto-save worker thread."""
        while self._running:
            try:
                # Sleep until next save time
                time.sleep(1.0)
                
                # Check if it's time to save
                if (time.time() - self._last_save_time) >= self.save_interval:
                    self.save_metrics()
                    self._last_save_time = time.time()
                    
            except Exception as e:
                logger.error(f"Error in auto-save worker: {str(e)}")
                time.sleep(5.0)
    
    def save_metrics(self):
        """Save metrics to file."""
        if not self.storage_dir:
            logger.warning("No storage directory configured, metrics not saved")
            return
        
        # Create metrics file path
        metrics_path = os.path.join(self.storage_dir, "metrics.json")
        
        # Calculate derived metrics
        metrics = self._get_derived_metrics()
        
        # Save metrics
        try:
            with open(metrics_path, 'w') as f:
                json.dump(metrics, f, indent=2)
            logger.debug(f"Metrics saved to {metrics_path}")
        except Exception as e:
            logger.error(f"Error saving metrics to {metrics_path}: {str(e)}")
    
    def _get_derived_metrics(self) -> Dict[str, Any]:
        """
        Calculate derived metrics from raw data.
        
        Returns:
            Dictionary of metrics
        """
        metrics = {
            "timestamp": time.time(),
            "response_quality": {},
            "hallucination": {},
            "reasoning_quality": {},
            "tool_usage": {},
            "task_completion": {},
            "performance": {}
        }
        
        # Response quality metrics
        rq = self._metrics["response_quality"]
        if rq["count"] > 0:
            metrics["response_quality"] = {
                "count": rq["count"],
                "average_score": rq["sum"] / rq["count"],
                "high_quality_percentage": (rq["high_quality_count"] / rq["count"]) * 100
            }
        
        # Hallucination metrics
        h = self._metrics["hallucination"]
        if h["count"] > 0:
            metrics["hallucination"] = {
                "count": h["count"],
                "detection_rate": (h["detected_count"] / h["count"]) * 100,
                "average_severity": h["severity_sum"] / max(1, h["detected_count"])
            }
        
        # Reasoning quality metrics
        rq = self._metrics["reasoning_quality"]
        if rq["count"] > 0:
            metrics["reasoning_quality"] = {
                "count": rq["count"],
                "average_score": rq["sum"] / rq["count"],
                "high_quality_percentage": (rq["high_quality_count"] / rq["count"]) * 100,
                "invalid_steps_rate": (rq["invalid_steps_count"] / rq["count"]) * 100
            }
        
        # Tool usage metrics
        tu = self._metrics["tool_usage"]
        if tu["count"] > 0:
            metrics["tool_usage"] = {
                "count": tu["count"],
                "appropriate_usage_rate": (tu["appropriate_count"] / tu["count"]) * 100,
                "success_rate": (tu["successful_count"] / max(1, tu["appropriate_count"])) * 100,
                "failure_rate": (tu["failed_count"] / max(1, tu["appropriate_count"])) * 100
            }
        
        # Task completion metrics
        tc = self._metrics["task_completion"]
        if tc["count"] > 0:
            metrics["task_completion"] = {
                "count": tc["count"],
                "success_rate": (tc["successful_count"] / tc["count"]) * 100,
                "failure_rate": (tc["failed_count"] / tc["count"]) * 100
            }
        
        # Performance metrics
        p = self._metrics["performance"]
        if p["response_times"]:
            metrics["performance"] = {
                "average_response_time": sum(p["response_times"]) / len(p["response_times"]),
                "average_token_count": sum(p["token_counts"]) / len(p["token_counts"]) if p["token_counts"] else None,
                "average_memory_usage": sum(p["memory_usage"]) / len(p["memory_usage"]) if p["memory_usage"] else None
            }
        
        return metrics
    
    def log_response_quality(
        self,
        response: str,
        query: str,
        score: float,
        is_high_quality: bool,
        target_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log response quality feedback.
        
        Args:
            response: Model response
            query: User query
            score: Quality score (0-1)
            is_high_quality: Whether response is high quality
            target_id: ID of the response
            context: Additional context
            
        Returns:
            Feedback ID
        """
        # Update metrics
        self._metrics["response_quality"]["count"] += 1
        self._metrics["response_quality"]["sum"] += score
        if is_high_quality:
            self._metrics["response_quality"]["high_quality_count"] += 1
        
        # Add feedback
        feedback_type = FeedbackType.RATING
        content = score
        
        # Prepare context
        feedback_context = {
            "category": FeedbackCategory.RESPONSE_QUALITY,
            "query": query,
            "response": response,
            "is_high_quality": is_high_quality
        }
        
        if context:
            feedback_context.update(context)
        
        # Add feedback
        feedback_id = self.feedback_manager.add_feedback(
            feedback_type=feedback_type,
            content=content,
            source=FeedbackSource.SYSTEM,
            target_id=target_id,
            target_type="response",
            context=feedback_context
        )
        
        return feedback_id
    
    def log_hallucination(
        self,
        response: str,
        query: str,
        hallucination_detected: bool,
        severity: Optional[Union[float, FeedbackSeverity]] = None,
        hallucinated_span: Optional[str] = None,
        target_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log hallucination detection feedback.
        
        Args:
            response: Model response
            query: User query
            hallucination_detected: Whether hallucination was detected
            severity: Severity of hallucination (0-1 or FeedbackSeverity)
            hallucinated_span: The hallucinated text span
            target_id: ID of the response
            context: Additional context
            
        Returns:
            Feedback ID
        """
        # Update metrics
        self._metrics["hallucination"]["count"] += 1
        
        if hallucination_detected:
            self._metrics["hallucination"]["detected_count"] += 1
            
            # Convert severity to float if needed
            severity_score = 0.5  # Default medium severity
            if severity is not None:
                if isinstance(severity, float):
                    severity_score = severity
                elif isinstance(severity, FeedbackSeverity):
                    severity_map = {
                        FeedbackSeverity.LOW: 0.25,
                        FeedbackSeverity.MEDIUM: 0.5,
                        FeedbackSeverity.HIGH: 0.75,
                        FeedbackSeverity.CRITICAL: 1.0
                    }
                    severity_score = severity_map[severity]
            
            self._metrics["hallucination"]["severity_sum"] += severity_score
        
        # Add feedback
        feedback_type = FeedbackType.DISLIKE if hallucination_detected else FeedbackType.LIKE
        content = "Hallucination detected" if hallucination_detected else "No hallucination detected"
        
        # Prepare context
        feedback_context = {
            "category": FeedbackCategory.HALLUCINATION,
            "query": query,
            "response": response,
            "hallucination_detected": hallucination_detected
        }
        
        if hallucination_detected:
            if severity is not None:
                feedback_context["severity"] = severity
            if hallucinated_span:
                feedback_context["hallucinated_span"] = hallucinated_span
        
        if context:
            feedback_context.update(context)
        
        # Add feedback
        feedback_id = self.feedback_manager.add_feedback(
            feedback_type=feedback_type,
            content=content,
            source=FeedbackSource.SYSTEM,
            target_id=target_id,
            target_type="response",
            context=feedback_context
        )
        
        return feedback_id
    
    def log_reasoning_quality(
        self,
        reasoning_trace: str,
        query: str,
        score: float,
        is_high_quality: bool,
        invalid_steps: Optional[List[str]] = None,
        target_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log reasoning quality feedback.
        
        Args:
            reasoning_trace: Reasoning trace
            query: User query
            score: Quality score (0-1)
            is_high_quality: Whether reasoning is high quality
            invalid_steps: List of invalid reasoning steps
            target_id: ID of the reasoning trace
            context: Additional context
            
        Returns:
            Feedback ID
        """
        # Update metrics
        self._metrics["reasoning_quality"]["count"] += 1
        self._metrics["reasoning_quality"]["sum"] += score
        
        if is_high_quality:
            self._metrics["reasoning_quality"]["high_quality_count"] += 1
        
        if invalid_steps:
            self._metrics["reasoning_quality"]["invalid_steps_count"] += 1
        
        # Add feedback
        feedback_type = FeedbackType.RATING
        content = score
        
        # Prepare context
        feedback_context = {
            "category": FeedbackCategory.REASONING_QUALITY,
            "query": query,
            "reasoning_trace": reasoning_trace,
            "is_high_quality": is_high_quality
        }
        
        if invalid_steps:
            feedback_context["invalid_steps"] = invalid_steps
        
        if context:
            feedback_context.update(context)
        
        # Add feedback
        feedback_id = self.feedback_manager.add_feedback(
            feedback_type=feedback_type,
            content=content,
            source=FeedbackSource.SYSTEM,
            target_id=target_id,
            target_type="reasoning",
            context=feedback_context
        )
        
        return feedback_id
    
    def log_tool_usage(
        self,
        tool_name: str,
        tool_input: Any,
        tool_output: Any,
        query: str,
        is_appropriate: bool,
        is_successful: bool,
        error: Optional[str] = None,
        target_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log tool usage feedback.
        
        Args:
            tool_name: Name of the tool
            tool_input: Input to the tool
            tool_output: Output from the tool
            query: User query
            is_appropriate: Whether tool usage was appropriate
            is_successful: Whether tool usage was successful
            error: Error message if unsuccessful
            target_id: ID of the tool usage
            context: Additional context
            
        Returns:
            Feedback ID
        """
        # Update metrics
        self._metrics["tool_usage"]["count"] += 1
        
        if is_appropriate:
            self._metrics["tool_usage"]["appropriate_count"] += 1
            
            if is_successful:
                self._metrics["tool_usage"]["successful_count"] += 1
            else:
                self._metrics["tool_usage"]["failed_count"] += 1
        
        # Add feedback
        if is_appropriate and is_successful:
            feedback_type = FeedbackType.LIKE
            content = f"Appropriate and successful use of {tool_name}"
        elif is_appropriate and not is_successful:
            feedback_type = FeedbackType.IMPROVEMENT
            content = f"Appropriate but unsuccessful use of {tool_name}"
        else:
            feedback_type = FeedbackType.DISLIKE
            content = f"Inappropriate use of {tool_name}"
        
        # Prepare context
        feedback_context = {
            "category": FeedbackCategory.TOOL_USAGE,
            "query": query,
            "tool_name": tool_name,
            "is_appropriate": is_appropriate,
            "is_successful": is_successful
        }
        
        # Include sanitized/truncated tool input and output
        try:
            feedback_context["tool_input"] = str(tool_input)[:500]  # Limit size
        except:
            feedback_context["tool_input"] = "Unable to serialize tool input"
            
        try:
            feedback_context["tool_output"] = str(tool_output)[:500]  # Limit size
        except:
            feedback_context["tool_output"] = "Unable to serialize tool output"
        
        if error:
            feedback_context["error"] = error
        
        if context:
            feedback_context.update(context)
        
        # Add feedback
        feedback_id = self.feedback_manager.add_feedback(
            feedback_type=feedback_type,
            content=content,
            source=FeedbackSource.SYSTEM,
            target_id=target_id,
            target_type="tool_usage",
            context=feedback_context
        )
        
        return feedback_id
    
    def log_task_completion(
        self,
        task_name: str,
        task_id: str,
        is_successful: bool,
        execution_time: float,
        error: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log task completion feedback.
        
        Args:
            task_name: Name of the task
            task_id: ID of the task
            is_successful: Whether task completed successfully
            execution_time: Time taken to execute task (seconds)
            error: Error message if unsuccessful
            context: Additional context
            
        Returns:
            Feedback ID
        """
        # Update metrics
        self._metrics["task_completion"]["count"] += 1
        
        if is_successful:
            self._metrics["task_completion"]["successful_count"] += 1
        else:
            self._metrics["task_completion"]["failed_count"] += 1
        
        # Add feedback
        feedback_type = FeedbackType.LIKE if is_successful else FeedbackType.DISLIKE
        content = f"Task '{task_name}' {'completed successfully' if is_successful else 'failed'}"
        
        # Prepare context
        feedback_context = {
            "category": FeedbackCategory.TASK_COMPLETION,
            "task_name": task_name,
            "execution_time": execution_time,
            "is_successful": is_successful
        }
        
        if error:
            feedback_context["error"] = error
        
        if context:
            feedback_context.update(context)
        
        # Add feedback
        feedback_id = self.feedback_manager.add_feedback(
            feedback_type=feedback_type,
            content=content,
            source=FeedbackSource.SYSTEM,
            target_id=task_id,
            target_type="task",
            context=feedback_context
        )
        
        return feedback_id
    
    def log_performance(
        self,
        response_time: float,
        token_count: Optional[int] = None,
        memory_usage: Optional[float] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Log performance metrics.
        
        Args:
            response_time: Response time in seconds
            token_count: Number of tokens generated
            memory_usage: Memory usage in MB
            context: Additional context
            
        Returns:
            Feedback ID
        """
        # Update metrics
        self._metrics["performance"]["response_times"].append(response_time)
        
        if token_count is not None:
            self._metrics["performance"]["token_counts"].append(token_count)
        
        if memory_usage is not None:
            self._metrics["performance"]["memory_usage"].append(memory_usage)
        
        # Limit array sizes to prevent excessive memory usage
        max_samples = 1000
        if len(self._metrics["performance"]["response_times"]) > max_samples:
            self._metrics["performance"]["response_times"] = self._metrics["performance"]["response_times"][-max_samples:]
        
        if len(self._metrics["performance"]["token_counts"]) > max_samples:
            self._metrics["performance"]["token_counts"] = self._metrics["performance"]["token_counts"][-max_samples:]
        
        if len(self._metrics["performance"]["memory_usage"]) > max_samples:
            self._metrics["performance"]["memory_usage"] = self._metrics["performance"]["memory_usage"][-max_samples:]
        
        # Add feedback
        feedback_type = FeedbackType.COMMENT
        content = f"Response time: {response_time:.3f}s"
        
        # Prepare context
        feedback_context = {
            "category": FeedbackCategory.PERFORMANCE,
            "response_time": response_time
        }
        
        if token_count is not None:
            feedback_context["token_count"] = token_count
            content += f", {token_count} tokens"
        
        if memory_usage is not None:
            feedback_context["memory_usage"] = memory_usage
            content += f", {memory_usage:.2f}MB"
        
        if context:
            feedback_context.update(context)
        
        # Add feedback
        feedback_id = self.feedback_manager.add_feedback(
            feedback_type=feedback_type,
            content=content,
            source=FeedbackSource.SYSTEM,
            target_id=None,
            target_type="performance",
            context=feedback_context
        )
        
        return feedback_id
    
    def get_metrics(self) -> Dict[str, Any]:
        """
        Get current metrics.
        
        Returns:
            Dictionary of metrics
        """
        return self._get_derived_metrics()
    
    def clear_metrics(self):
        """Reset all metrics."""
        self._metrics = {
            "response_quality": {
                "count": 0,
                "sum": 0.0,
                "high_quality_count": 0
            },
            "hallucination": {
                "count": 0,
                "detected_count": 0,
                "severity_sum": 0.0
            },
            "reasoning_quality": {
                "count": 0,
                "sum": 0.0,
                "high_quality_count": 0,
                "invalid_steps_count": 0
            },
            "tool_usage": {
                "count": 0,
                "appropriate_count": 0,
                "successful_count": 0,
                "failed_count": 0
            },
            "task_completion": {
                "count": 0,
                "successful_count": 0,
                "failed_count": 0
            },
            "performance": {
                "response_times": [],
                "token_counts": [],
                "memory_usage": []
            }
        }
        
        logger.info("Metrics cleared")
    
    def stop(self):
        """Stop the feedback logger."""
        self._running = False
        
        # Wait for save thread to finish
        if self._save_thread and self._save_thread.is_alive():
            self._save_thread.join(timeout=5.0)
        
        # Save metrics
        self.save_metrics()
        
        logger.info("Feedback logger stopped") 