"""
Feedback Module

This module implements feedback collection and processing for continuous improvement.
"""

import os
import time
import json
import logging
import uuid
import threading
from typing import Dict, List, Any, Optional, Callable, Union
from enum import Enum
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


class FeedbackType(str, Enum):
    """Types of feedback."""
    LIKE = "like"  # Positive feedback
    DISLIKE = "dislike"  # Negative feedback
    RATING = "rating"  # Numerical rating
    CORRECTION = "correction"  # Correction of output
    IMPROVEMENT = "improvement"  # Suggested improvement
    COMMENT = "comment"  # General comment
    SELECTED = "selected"  # Selected from alternatives
    REJECTED = "rejected"  # Rejected from alternatives


class FeedbackSource(str, Enum):
    """Sources of feedback."""
    USER = "user"  # Direct user feedback
    SYSTEM = "system"  # Automated system feedback
    AGENT = "agent"  # Feedback from another agent
    METRIC = "metric"  # Feedback from metrics


@dataclass
class Feedback:
    """Feedback instance."""
    feedback_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: FeedbackType = FeedbackType.COMMENT
    source: FeedbackSource = FeedbackSource.USER
    content: Any = None  # Feedback content
    context: Dict[str, Any] = field(default_factory=dict)  # Context of the feedback
    target_id: Optional[str] = None  # ID of target (response, task, etc.)
    target_type: Optional[str] = None  # Type of target
    created_at: float = field(default_factory=time.time)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            "feedback_id": self.feedback_id,
            "type": self.type,
            "source": self.source,
            "context": self.context,
            "target_id": self.target_id,
            "target_type": self.target_type,
            "created_at": self.created_at,
            "metadata": self.metadata,
        }
        
        # Handle content (if serializable)
        if self.content is not None:
            try:
                json.dumps(self.content)
                result["content"] = self.content
            except (TypeError, OverflowError):
                result["content"] = str(self.content)
        
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Feedback':
        """Create from dictionary."""
        return cls(**data)


@dataclass
class FeedbackSummary:
    """Summary of feedback."""
    target_id: str
    target_type: str
    count: int = 0
    positive_count: int = 0
    negative_count: int = 0
    average_rating: Optional[float] = None
    latest_feedback: Optional[Feedback] = None
    feedback_ids: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


class FeedbackManager:
    """
    Manager for feedback collection and processing.
    
    Features:
    - Feedback collection and storage
    - Feedback processing and summarization
    - Feedback-based learning signals
    """
    
    def __init__(
        self,
        storage_dir: Optional[str] = None,
        processors: Optional[List[Callable[[Feedback], None]]] = None,
        auto_save: bool = True,
        save_interval: float = 60.0  # Seconds between auto-saves
    ):
        """
        Initialize the feedback manager.
        
        Args:
            storage_dir: Directory for feedback storage
            processors: Feedback processors to run on new feedback
            auto_save: Whether to automatically save feedback
            save_interval: Interval between auto-saves
        """
        self.storage_dir = storage_dir
        self.processors = processors or []
        self.auto_save = auto_save
        self.save_interval = save_interval
        
        # Create storage directory if needed
        if self.storage_dir:
            os.makedirs(self.storage_dir, exist_ok=True)
        
        # Feedback storage
        self._feedback: Dict[str, Feedback] = {}
        self._feedback_by_target: Dict[str, List[str]] = {}  # target_id -> list of feedback_ids
        self._summaries: Dict[str, FeedbackSummary] = {}  # target_id -> summary
        
        # Control flags
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
            name="feedback-saver",
            daemon=True
        )
        self._save_thread.start()
        
        logger.debug("Auto-save thread started")
    
    def _auto_save_worker(self):
        """Auto-save worker thread."""
        while self._running:
            try:
                # Sleep until next save time
                time.sleep(0.5)
                
                # Check if it's time to save
                if (time.time() - self._last_save_time) >= self.save_interval:
                    self.save()
                    self._last_save_time = time.time()
                    
            except Exception as e:
                logger.error(f"Error in auto-save worker: {str(e)}")
                time.sleep(1.0)
    
    def add_feedback(
        self,
        feedback_type: Union[FeedbackType, str],
        content: Any,
        source: Union[FeedbackSource, str] = FeedbackSource.USER,
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add feedback.
        
        Args:
            feedback_type: Type of feedback
            content: Feedback content
            source: Source of feedback
            target_id: ID of target
            target_type: Type of target
            context: Context of the feedback
            metadata: Additional metadata
            
        Returns:
            Feedback ID
        """
        # Convert string types to enums
        if isinstance(feedback_type, str):
            feedback_type = FeedbackType(feedback_type)
        
        if isinstance(source, str):
            source = FeedbackSource(source)
        
        # Create feedback
        feedback = Feedback(
            type=feedback_type,
            content=content,
            source=source,
            target_id=target_id,
            target_type=target_type,
            context=context or {},
            metadata=metadata or {}
        )
        
        # Store feedback
        self._feedback[feedback.feedback_id] = feedback
        
        # Update target index
        if target_id:
            if target_id not in self._feedback_by_target:
                self._feedback_by_target[target_id] = []
            self._feedback_by_target[target_id].append(feedback.feedback_id)
            
            # Update summary
            self._update_summary(target_id, target_type or "unknown", feedback)
        
        # Process feedback
        self._process_feedback(feedback)
        
        # Save if auto-save is disabled
        if not self.auto_save:
            self.save()
        
        logger.info(f"Added {feedback_type} feedback ({feedback.feedback_id})")
        return feedback.feedback_id
    
    def get_feedback(self, feedback_id: str) -> Optional[Feedback]:
        """Get feedback by ID."""
        return self._feedback.get(feedback_id)
    
    def get_feedback_for_target(self, target_id: str) -> List[Feedback]:
        """Get all feedback for a target."""
        if target_id not in self._feedback_by_target:
            return []
            
        return [
            self._feedback[feedback_id]
            for feedback_id in self._feedback_by_target[target_id]
            if feedback_id in self._feedback
        ]
    
    def get_summary(self, target_id: str) -> Optional[FeedbackSummary]:
        """Get feedback summary for a target."""
        return self._summaries.get(target_id)
    
    def list_feedback(
        self,
        feedback_type: Optional[Union[FeedbackType, str, List[Union[FeedbackType, str]]]] = None,
        source: Optional[Union[FeedbackSource, str, List[Union[FeedbackSource, str]]]] = None,
        target_type: Optional[Union[str, List[str]]] = None,
        since: Optional[float] = None,
        until: Optional[float] = None,
        limit: Optional[int] = None
    ) -> List[Feedback]:
        """
        List feedback, optionally filtered.
        
        Args:
            feedback_type: Filter by feedback type(s)
            source: Filter by source(s)
            target_type: Filter by target type(s)
            since: Filter by creation time (>= since)
            until: Filter by creation time (<= until)
            limit: Maximum number of feedback to return
            
        Returns:
            List of filtered feedback
        """
        result = []
        
        # Convert single values to lists
        if feedback_type is not None and not isinstance(feedback_type, list):
            feedback_type = [feedback_type]
        
        if source is not None and not isinstance(source, list):
            source = [source]
        
        if target_type is not None and not isinstance(target_type, list):
            target_type = [target_type]
        
        # Convert string types to enums
        if feedback_type:
            feedback_type = [
                FeedbackType(t) if isinstance(t, str) else t
                for t in feedback_type
            ]
            
        if source:
            source = [
                FeedbackSource(s) if isinstance(s, str) else s
                for s in source
            ]
            
        # Iterate through all feedback
        for feedback in self._feedback.values():
            # Apply filters
            if feedback_type and feedback.type not in feedback_type:
                continue
                
            if source and feedback.source not in source:
                continue
                
            if target_type and feedback.target_type not in target_type:
                continue
                
            if since is not None and feedback.created_at < since:
                continue
                
            if until is not None and feedback.created_at > until:
                continue
                
            result.append(feedback)
            
            # Check limit
            if limit is not None and len(result) >= limit:
                break
        
        # Sort by creation time (newest first)
        result.sort(key=lambda f: f.created_at, reverse=True)
        
        return result
    
    def clear_feedback(self):
        """Clear all feedback."""
        self._feedback.clear()
        self._feedback_by_target.clear()
        self._summaries.clear()
        
        # Save if auto-save is disabled
        if not self.auto_save:
            self.save()
            
        logger.info("Cleared all feedback")
    
    def add_processor(self, processor: Callable[[Feedback], None]):
        """
        Add a feedback processor.
        
        Args:
            processor: Function to process feedback
        """
        self.processors.append(processor)
    
    def save(self):
        """Save feedback to storage."""
        if not self.storage_dir:
            return
            
        try:
            # Convert feedback to dictionaries
            feedback_data = {
                feedback_id: feedback.to_dict()
                for feedback_id, feedback in self._feedback.items()
            }
            
            # Convert summaries to dictionaries
            summary_data = {}
            for target_id, summary in self._summaries.items():
                summary_dict = {
                    "target_id": summary.target_id,
                    "target_type": summary.target_type,
                    "count": summary.count,
                    "positive_count": summary.positive_count,
                    "negative_count": summary.negative_count,
                    "average_rating": summary.average_rating,
                    "feedback_ids": summary.feedback_ids,
                    "metadata": summary.metadata
                }
                
                # Add latest feedback if available
                if summary.latest_feedback:
                    summary_dict["latest_feedback_id"] = summary.latest_feedback.feedback_id
                    
                summary_data[target_id] = summary_dict
            
            # Create data to save
            data = {
                "feedback": feedback_data,
                "summaries": summary_data,
                "timestamp": time.time()
            }
            
            # Save to file
            file_path = os.path.join(self.storage_dir, "feedback.json")
            
            # Create a temporary file first
            temp_path = file_path + ".tmp"
            with open(temp_path, "w") as f:
                json.dump(data, f, indent=2)
                
            # Rename to final file (atomic operation)
            os.replace(temp_path, file_path)
            
            logger.debug(f"Saved {len(feedback_data)} feedback items to {file_path}")
            
        except Exception as e:
            logger.error(f"Error saving feedback: {str(e)}")
    
    def load(self):
        """Load feedback from storage."""
        if not self.storage_dir:
            return
            
        file_path = os.path.join(self.storage_dir, "feedback.json")
        if not os.path.exists(file_path):
            return
            
        try:
            # Load from file
            with open(file_path, "r") as f:
                data = json.load(f)
                
            # Get feedback data
            feedback_data = data.get("feedback", {})
            
            # Clear existing data
            self._feedback.clear()
            self._feedback_by_target.clear()
            self._summaries.clear()
            
            # Convert to feedback
            for feedback_id, item_data in feedback_data.items():
                try:
                    feedback = Feedback.from_dict(item_data)
                    self._feedback[feedback_id] = feedback
                    
                    # Update target index
                    if feedback.target_id:
                        if feedback.target_id not in self._feedback_by_target:
                            self._feedback_by_target[feedback.target_id] = []
                        self._feedback_by_target[feedback.target_id].append(feedback_id)
                        
                except Exception as e:
                    logger.error(f"Error loading feedback {feedback_id}: {str(e)}")
            
            # Get summary data
            summary_data = data.get("summaries", {})
            
            # Recreate summaries
            for target_id, summary_dict in summary_data.items():
                # Create basic summary
                summary = FeedbackSummary(
                    target_id=summary_dict["target_id"],
                    target_type=summary_dict["target_type"],
                    count=summary_dict["count"],
                    positive_count=summary_dict["positive_count"],
                    negative_count=summary_dict["negative_count"],
                    average_rating=summary_dict["average_rating"],
                    feedback_ids=summary_dict["feedback_ids"],
                    metadata=summary_dict["metadata"]
                )
                
                # Add latest feedback if available
                latest_feedback_id = summary_dict.get("latest_feedback_id")
                if latest_feedback_id and latest_feedback_id in self._feedback:
                    summary.latest_feedback = self._feedback[latest_feedback_id]
                    
                self._summaries[target_id] = summary
            
            logger.info(f"Loaded {len(feedback_data)} feedback items from {file_path}")
            
        except Exception as e:
            logger.error(f"Error loading feedback: {str(e)}")
    
    def _process_feedback(self, feedback: Feedback):
        """
        Process new feedback.
        
        Args:
            feedback: Feedback to process
        """
        # Run processors
        for processor in self.processors:
            try:
                processor(feedback)
            except Exception as e:
                logger.error(f"Error in feedback processor: {str(e)}")
    
    def _update_summary(self, target_id: str, target_type: str, feedback: Feedback):
        """
        Update summary for a target.
        
        Args:
            target_id: Target ID
            target_type: Target type
            feedback: New feedback
        """
        # Get or create summary
        summary = self._summaries.get(target_id)
        if not summary:
            summary = FeedbackSummary(
                target_id=target_id,
                target_type=target_type
            )
            self._summaries[target_id] = summary
        
        # Update summary
        summary.count += 1
        summary.feedback_ids.append(feedback.feedback_id)
        summary.latest_feedback = feedback
        
        # Update counts based on feedback type
        if feedback.type in (FeedbackType.LIKE, FeedbackType.SELECTED):
            summary.positive_count += 1
        elif feedback.type in (FeedbackType.DISLIKE, FeedbackType.REJECTED):
            summary.negative_count += 1
        
        # Update average rating if applicable
        if feedback.type == FeedbackType.RATING and isinstance(feedback.content, (int, float)):
            # Calculate new average
            if summary.average_rating is None:
                summary.average_rating = feedback.content
            else:
                # Compute a running average
                summary.average_rating = (
                    (summary.average_rating * (summary.count - 1) + feedback.content) /
                    summary.count
                )


class FeedbackCollector:
    """
    Helper for collecting user feedback with different mechanisms.
    
    Features:
    - Convenience methods for different feedback types
    - Context tracking
    - Target tracking
    """
    
    def __init__(
        self,
        feedback_manager: FeedbackManager,
        default_target_type: str = "response",
        default_source: FeedbackSource = FeedbackSource.USER,
        context_provider: Optional[Callable[[], Dict[str, Any]]] = None
    ):
        """
        Initialize the feedback collector.
        
        Args:
            feedback_manager: Feedback manager to use
            default_target_type: Default target type
            default_source: Default feedback source
            context_provider: Function to provide context
        """
        self.feedback_manager = feedback_manager
        self.default_target_type = default_target_type
        self.default_source = default_source
        self.context_provider = context_provider
        
        # Current context
        self._context: Dict[str, Any] = {}
        self._target_id: Optional[str] = None
        self._target_type: Optional[str] = None
    
    def set_target(self, target_id: str, target_type: Optional[str] = None):
        """
        Set the current target.
        
        Args:
            target_id: Target ID
            target_type: Target type (or None for default)
        """
        self._target_id = target_id
        self._target_type = target_type or self.default_target_type
    
    def set_context(self, context: Dict[str, Any]):
        """
        Set the current context.
        
        Args:
            context: Context dictionary
        """
        self._context = context.copy()
    
    def update_context(self, **kwargs):
        """
        Update the current context.
        
        Args:
            **kwargs: Context values to update
        """
        self._context.update(kwargs)
    
    def clear_context(self):
        """Clear the current context."""
        self._context.clear()
    
    def _get_context(self) -> Dict[str, Any]:
        """
        Get the current context.
        
        Returns:
            Context dictionary
        """
        # Start with current context
        context = self._context.copy()
        
        # Add context from provider if available
        if self.context_provider:
            try:
                provider_context = self.context_provider()
                if provider_context:
                    context.update(provider_context)
            except Exception as e:
                logger.error(f"Error getting context from provider: {str(e)}")
        
        return context
    
    def like(
        self,
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add like feedback.
        
        Args:
            target_id: Target ID (or None for current)
            target_type: Target type (or None for current/default)
            context: Additional context (or None for current)
            metadata: Additional metadata
            
        Returns:
            Feedback ID
        """
        return self.feedback_manager.add_feedback(
            feedback_type=FeedbackType.LIKE,
            content=True,
            source=self.default_source,
            target_id=target_id or self._target_id,
            target_type=target_type or self._target_type or self.default_target_type,
            context=self._merge_context(context),
            metadata=metadata
        )
    
    def dislike(
        self,
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add dislike feedback.
        
        Args:
            target_id: Target ID (or None for current)
            target_type: Target type (or None for current/default)
            context: Additional context (or None for current)
            metadata: Additional metadata
            
        Returns:
            Feedback ID
        """
        return self.feedback_manager.add_feedback(
            feedback_type=FeedbackType.DISLIKE,
            content=False,
            source=self.default_source,
            target_id=target_id or self._target_id,
            target_type=target_type or self._target_type or self.default_target_type,
            context=self._merge_context(context),
            metadata=metadata
        )
    
    def rate(
        self,
        rating: Union[int, float],
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add rating feedback.
        
        Args:
            rating: Numerical rating
            target_id: Target ID (or None for current)
            target_type: Target type (or None for current/default)
            context: Additional context (or None for current)
            metadata: Additional metadata
            
        Returns:
            Feedback ID
        """
        return self.feedback_manager.add_feedback(
            feedback_type=FeedbackType.RATING,
            content=rating,
            source=self.default_source,
            target_id=target_id or self._target_id,
            target_type=target_type or self._target_type or self.default_target_type,
            context=self._merge_context(context),
            metadata=metadata
        )
    
    def correct(
        self,
        correction: str,
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add correction feedback.
        
        Args:
            correction: Corrected text
            target_id: Target ID (or None for current)
            target_type: Target type (or None for current/default)
            context: Additional context (or None for current)
            metadata: Additional metadata
            
        Returns:
            Feedback ID
        """
        return self.feedback_manager.add_feedback(
            feedback_type=FeedbackType.CORRECTION,
            content=correction,
            source=self.default_source,
            target_id=target_id or self._target_id,
            target_type=target_type or self._target_type or self.default_target_type,
            context=self._merge_context(context),
            metadata=metadata
        )
    
    def improve(
        self,
        improvement: str,
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add improvement feedback.
        
        Args:
            improvement: Improvement suggestion
            target_id: Target ID (or None for current)
            target_type: Target type (or None for current/default)
            context: Additional context (or None for current)
            metadata: Additional metadata
            
        Returns:
            Feedback ID
        """
        return self.feedback_manager.add_feedback(
            feedback_type=FeedbackType.IMPROVEMENT,
            content=improvement,
            source=self.default_source,
            target_id=target_id or self._target_id,
            target_type=target_type or self._target_type or self.default_target_type,
            context=self._merge_context(context),
            metadata=metadata
        )
    
    def comment(
        self,
        text: str,
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add comment feedback.
        
        Args:
            text: Comment text
            target_id: Target ID (or None for current)
            target_type: Target type (or None for current/default)
            context: Additional context (or None for current)
            metadata: Additional metadata
            
        Returns:
            Feedback ID
        """
        return self.feedback_manager.add_feedback(
            feedback_type=FeedbackType.COMMENT,
            content=text,
            source=self.default_source,
            target_id=target_id or self._target_id,
            target_type=target_type or self._target_type or self.default_target_type,
            context=self._merge_context(context),
            metadata=metadata
        )
    
    def select(
        self,
        selected: Any,
        alternatives: Optional[List[Any]] = None,
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add selection feedback.
        
        Args:
            selected: Selected item
            alternatives: Alternative items (optional)
            target_id: Target ID (or None for current)
            target_type: Target type (or None for current/default)
            context: Additional context (or None for current)
            metadata: Additional metadata
            
        Returns:
            Feedback ID
        """
        content = {
            "selected": selected
        }
        
        if alternatives:
            content["alternatives"] = alternatives
            
        return self.feedback_manager.add_feedback(
            feedback_type=FeedbackType.SELECTED,
            content=content,
            source=self.default_source,
            target_id=target_id or self._target_id,
            target_type=target_type or self._target_type or self.default_target_type,
            context=self._merge_context(context),
            metadata=metadata
        )
    
    def reject(
        self,
        rejected: Any,
        alternatives: Optional[List[Any]] = None,
        target_id: Optional[str] = None,
        target_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Add rejection feedback.
        
        Args:
            rejected: Rejected item
            alternatives: Alternative items (optional)
            target_id: Target ID (or None for current)
            target_type: Target type (or None for current/default)
            context: Additional context (or None for current)
            metadata: Additional metadata
            
        Returns:
            Feedback ID
        """
        content = {
            "rejected": rejected
        }
        
        if alternatives:
            content["alternatives"] = alternatives
            
        return self.feedback_manager.add_feedback(
            feedback_type=FeedbackType.REJECTED,
            content=content,
            source=self.default_source,
            target_id=target_id or self._target_id,
            target_type=target_type or self._target_type or self.default_target_type,
            context=self._merge_context(context),
            metadata=metadata
        )
    
    def _merge_context(self, context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Merge provided context with current context.
        
        Args:
            context: Context to merge (or None)
            
        Returns:
            Merged context
        """
        result = self._get_context()
        
        if context:
            result.update(context)
            
        return result


# Some example feedback processors

def log_feedback_processor(feedback: Feedback):
    """Log feedback to console."""
    target_info = f"on {feedback.target_type} {feedback.target_id}" if feedback.target_id else ""
    logger.info(f"Received {feedback.type} feedback from {feedback.source} {target_info}")


def feedback_metrics_processor(feedback: Feedback):
    """Update metrics based on feedback."""
    # This is a placeholder for metrics tracking
    pass


# Command-line interface for testing
def main():
    """Command-line interface for testing feedback."""
    import argparse
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    parser = argparse.ArgumentParser(description="Test feedback")
    parser.add_argument("--storage", help="Storage directory", default="cache/feedback")
    
    args = parser.parse_args()
    
    # Create feedback manager
    manager = FeedbackManager(
        storage_dir=args.storage,
        processors=[log_feedback_processor]
    )
    
    # Try to load existing feedback
    manager.load()
    
    # Create feedback collector
    collector = FeedbackCollector(manager)
    
    # Add some test feedback
    target_id = str(uuid.uuid4())
    collector.set_target(target_id, "test_response")
    collector.set_context({"test": True, "mode": "cli"})
    
    collector.like()
    collector.comment("This is a test comment")
    collector.rate(4.5)
    
    # Show summary
    summary = manager.get_summary(target_id)
    print(f"Feedback summary for {target_id}:")
    print(f"  Count: {summary.count}")
    print(f"  Positive: {summary.positive_count}")
    print(f"  Negative: {summary.negative_count}")
    print(f"  Rating: {summary.average_rating}")
    
    # Save feedback
    manager.save()
    print("Feedback saved to storage")


if __name__ == "__main__":
    main() 