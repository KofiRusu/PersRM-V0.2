"""
Feedback Logger for PersLM

This module tracks system performance, manages self-assessments,
and stores feedback for continuous improvement.
"""

import os
import json
import time
import logging
import datetime
from typing import Optional, Dict, Any, List, Union, Tuple
from pathlib import Path
from enum import Enum
from dataclasses import dataclass, field

# Add parent directory to path for imports
import sys
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Import PersLM modules
try:
    from src.memory import Memory
except ImportError:
    # Create a stub if not available
    class Memory:
        def add(self, *args, **kwargs): pass
        def query(self, *args, **kwargs): return []
        def save(self, *args, **kwargs): pass

logger = logging.getLogger(__name__)


class FeedbackType(Enum):
    """Types of feedback that can be logged."""
    USER = "user"  # Explicit user feedback
    SELF = "self"  # Self-assessment
    AUTO = "auto"  # Automatically derived
    EXTERNAL = "external"  # External evaluation


class FeedbackCategory(Enum):
    """Categories of feedback metrics."""
    ACCURACY = "accuracy"  # Factual accuracy
    RELEVANCE = "relevance"  # Response relevance
    CLARITY = "clarity"  # Communication clarity
    HELPFULNESS = "helpfulness"  # Overall helpfulness
    SAFETY = "safety"  # Safety alignment
    LATENCY = "latency"  # Response time
    PERSONALIZATION = "personalization"  # Personalization quality
    OTHER = "other"  # Other metrics


@dataclass
class FeedbackEntry:
    """
    A feedback entry containing evaluation data.
    """
    timestamp: float = field(default_factory=time.time)
    feedback_type: str = "self"  # Type of feedback
    category: str = "other"  # Feedback category
    score: Optional[float] = None  # Numerical score (0.0 to 1.0)
    rating: Optional[str] = None  # String rating (excellent, good, fair, poor)
    notes: Optional[str] = None  # Notes or comments
    session_id: Optional[str] = None  # ID of the session being evaluated
    user_id: str = "system"  # ID of user who provided feedback
    interaction_id: Optional[str] = None  # ID of specific interaction
    metrics: Dict[str, Any] = field(default_factory=dict)  # Additional metrics
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        return {
            "timestamp": self.timestamp,
            "feedback_type": self.feedback_type,
            "category": self.category,
            "score": self.score,
            "rating": self.rating,
            "notes": self.notes,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "interaction_id": self.interaction_id,
            "metrics": self.metrics
        }
        
    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'FeedbackEntry':
        """Create FeedbackEntry from dictionary."""
        return FeedbackEntry(
            timestamp=data.get("timestamp", time.time()),
            feedback_type=data.get("feedback_type", "self"),
            category=data.get("category", "other"),
            score=data.get("score"),
            rating=data.get("rating"),
            notes=data.get("notes"),
            session_id=data.get("session_id"),
            user_id=data.get("user_id", "system"),
            interaction_id=data.get("interaction_id"),
            metrics=data.get("metrics", {})
        )


class FeedbackLogger:
    """
    Manages and stores system feedback and performance metrics.
    
    Features:
    - Log feedback from users, system, and external sources
    - Track performance metrics over time
    - Generate reports and summaries
    - Store data for future improvement
    """
    
    def __init__(
        self,
        storage_dir: Optional[str] = None,
        memory: Optional[Memory] = None,
        auto_save: bool = True,
        log_level: str = "INFO"
    ):
        """
        Initialize feedback logger.
        
        Args:
            storage_dir: Directory to store feedback logs
            memory: Memory instance for storage
            auto_save: Whether to automatically save logs
            log_level: Logging level
        """
        self.auto_save = auto_save
        
        # Set up logging
        numeric_level = getattr(logging, log_level.upper(), None)
        if not isinstance(numeric_level, int):
            numeric_level = logging.INFO
        logger.setLevel(numeric_level)
        
        # Set up storage
        if storage_dir:
            self.storage_dir = Path(storage_dir)
        else:
            self.storage_dir = Path("data/feedback")
            
        os.makedirs(self.storage_dir, exist_ok=True)
        
        # Use provided memory or create a file-backed store
        self.memory = memory
        
        # Initialize feedback entries
        self.entries: List[FeedbackEntry] = []
        self.load_entries()
        
        logger.info(f"Feedback logger initialized (storage_dir={self.storage_dir})")
        
    def load_entries(self) -> None:
        """Load feedback entries from storage."""
        # Try loading from file
        feedback_file = self.storage_dir / "feedback_log.json"
        
        if feedback_file.exists():
            try:
                with open(feedback_file, 'r') as f:
                    data = json.load(f)
                    
                # Convert dict entries to FeedbackEntry objects
                self.entries = [FeedbackEntry.from_dict(entry) for entry in data]
                logger.info(f"Loaded {len(self.entries)} feedback entries from file")
                
            except Exception as e:
                logger.error(f"Error loading feedback entries: {e}")
        
        # If no file or loading failed, try memory if available
        elif self.memory:
            try:
                # Query memory for feedback entries
                results = self.memory.query(
                    "type:feedback",
                    limit=1000
                )
                
                # Convert to FeedbackEntry objects
                for item in results:
                    if 'metadata' in item and isinstance(item['metadata'], dict):
                        entry = FeedbackEntry.from_dict(item['metadata'])
                        self.entries.append(entry)
                        
                logger.info(f"Loaded {len(self.entries)} feedback entries from memory")
                
            except Exception as e:
                logger.error(f"Error querying memory for feedback entries: {e}")
        
    def save_entries(self) -> None:
        """Save feedback entries to storage."""
        if not self.entries:
            return
            
        # Save to file
        feedback_file = self.storage_dir / "feedback_log.json"
        
        try:
            with open(feedback_file, 'w') as f:
                # Convert FeedbackEntry objects to dicts
                data = [entry.to_dict() for entry in self.entries]
                json.dump(data, f, indent=2)
                
            logger.debug(f"Saved {len(self.entries)} feedback entries to file")
            
        except Exception as e:
            logger.error(f"Error saving feedback entries to file: {e}")
            
        # Save to memory if available
        if self.memory:
            try:
                # Batch add entries to memory
                for entry in self.entries:
                    if not hasattr(entry, '_saved_to_memory') or not entry._saved_to_memory:
                        self.memory.add(
                            content=entry.notes or f"Feedback: {entry.category} - {entry.rating or entry.score}",
                            metadata=entry.to_dict(),
                            tags=["feedback", entry.feedback_type, entry.category]
                        )
                        # Mark as saved to avoid duplicates
                        entry._saved_to_memory = True
                        
                logger.debug(f"Saved feedback entries to memory")
                
            except Exception as e:
                logger.error(f"Error saving feedback entries to memory: {e}")
    
    def log_feedback(
        self,
        feedback_type: Union[str, FeedbackType],
        category: Union[str, FeedbackCategory],
        score: Optional[float] = None,
        rating: Optional[str] = None,
        notes: Optional[str] = None,
        session_id: Optional[str] = None,
        user_id: str = "system",
        interaction_id: Optional[str] = None,
        metrics: Optional[Dict[str, Any]] = None
    ) -> FeedbackEntry:
        """
        Log a feedback entry.
        
        Args:
            feedback_type: Type of feedback
            category: Feedback category
            score: Numerical score (0.0 to 1.0)
            rating: String rating (excellent, good, fair, poor)
            notes: Notes or comments
            session_id: ID of the session being evaluated
            user_id: ID of user who provided feedback
            interaction_id: ID of specific interaction
            metrics: Additional metrics
            
        Returns:
            The created feedback entry
        """
        # Convert enums to strings if needed
        if isinstance(feedback_type, FeedbackType):
            feedback_type = feedback_type.value
            
        if isinstance(category, FeedbackCategory):
            category = category.value
            
        # Create feedback entry
        entry = FeedbackEntry(
            timestamp=time.time(),
            feedback_type=feedback_type,
            category=category,
            score=score,
            rating=rating,
            notes=notes,
            session_id=session_id,
            user_id=user_id,
            interaction_id=interaction_id,
            metrics=metrics or {}
        )
        
        # Add to entries
        self.entries.append(entry)
        
        # Auto-save if enabled
        if self.auto_save:
            self.save_entries()
            
        logger.info(f"Logged {feedback_type} feedback for category {category}: " + 
                   f"{rating or score or 'unrated'}")
        
        return entry
    
    def log_user_feedback(
        self,
        category: Union[str, FeedbackCategory],
        rating: Optional[str] = None,
        score: Optional[float] = None,
        notes: Optional[str] = None,
        user_id: str = "user",
        **kwargs
    ) -> FeedbackEntry:
        """
        Log feedback provided by a user.
        
        Args:
            category: Feedback category
            rating: String rating (excellent, good, fair, poor)
            score: Numerical score (0.0 to 1.0)
            notes: Notes or comments
            user_id: ID of user who provided feedback
            **kwargs: Additional parameters for log_feedback
            
        Returns:
            The created feedback entry
        """
        return self.log_feedback(
            feedback_type=FeedbackType.USER.value,
            category=category,
            rating=rating,
            score=score,
            notes=notes,
            user_id=user_id,
            **kwargs
        )
    
    def log_self_assessment(
        self,
        category: Union[str, FeedbackCategory],
        score: float,
        reasoning: Optional[str] = None,
        **kwargs
    ) -> FeedbackEntry:
        """
        Log a self-assessment by the system.
        
        Args:
            category: Assessment category
            score: Self-assessment score (0.0 to 1.0)
            reasoning: Reasoning behind the assessment
            **kwargs: Additional parameters for log_feedback
            
        Returns:
            The created feedback entry
        """
        return self.log_feedback(
            feedback_type=FeedbackType.SELF.value,
            category=category,
            score=score,
            notes=reasoning,
            **kwargs
        )
    
    def log_auto_metric(
        self,
        category: Union[str, FeedbackCategory],
        value: float,
        description: Optional[str] = None,
        **kwargs
    ) -> FeedbackEntry:
        """
        Log an automatically measured metric.
        
        Args:
            category: Metric category
            value: Metric value
            description: Description of the metric
            **kwargs: Additional parameters for log_feedback
            
        Returns:
            The created feedback entry
        """
        return self.log_feedback(
            feedback_type=FeedbackType.AUTO.value,
            category=category,
            score=value,
            notes=description,
            **kwargs
        )
    
    def get_entries(
        self,
        feedback_type: Optional[Union[str, FeedbackType]] = None,
        category: Optional[Union[str, FeedbackCategory]] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        min_timestamp: Optional[float] = None,
        max_timestamp: Optional[float] = None,
        min_score: Optional[float] = None,
        max_score: Optional[float] = None
    ) -> List[FeedbackEntry]:
        """
        Get feedback entries matching criteria.
        
        Args:
            feedback_type: Filter by feedback type
            category: Filter by category
            user_id: Filter by user ID
            session_id: Filter by session ID
            min_timestamp: Minimum timestamp
            max_timestamp: Maximum timestamp
            min_score: Minimum score
            max_score: Maximum score
            
        Returns:
            List of matching feedback entries
        """
        # Convert enums to strings if needed
        if isinstance(feedback_type, FeedbackType):
            feedback_type = feedback_type.value
            
        if isinstance(category, FeedbackCategory):
            category = category.value
            
        # Filter entries
        filtered = self.entries
        
        if feedback_type is not None:
            filtered = [e for e in filtered if e.feedback_type == feedback_type]
            
        if category is not None:
            filtered = [e for e in filtered if e.category == category]
            
        if user_id is not None:
            filtered = [e for e in filtered if e.user_id == user_id]
            
        if session_id is not None:
            filtered = [e for e in filtered if e.session_id == session_id]
            
        if min_timestamp is not None:
            filtered = [e for e in filtered if e.timestamp >= min_timestamp]
            
        if max_timestamp is not None:
            filtered = [e for e in filtered if e.timestamp <= max_timestamp]
            
        if min_score is not None:
            filtered = [e for e in filtered if e.score is not None and e.score >= min_score]
            
        if max_score is not None:
            filtered = [e for e in filtered if e.score is not None and e.score <= max_score]
            
        # Sort by timestamp (newest first)
        return sorted(filtered, key=lambda e: e.timestamp, reverse=True)
    
    def get_average_score(
        self,
        category: Optional[Union[str, FeedbackCategory]] = None,
        feedback_type: Optional[Union[str, FeedbackType]] = None,
        user_id: Optional[str] = None,
        session_id: Optional[str] = None,
        days: Optional[int] = None
    ) -> Optional[float]:
        """
        Get average score for entries matching criteria.
        
        Args:
            category: Filter by category
            feedback_type: Filter by feedback type
            user_id: Filter by user ID
            session_id: Filter by session ID
            days: Number of past days to include, or None for all
            
        Returns:
            Average score or None if no matching entries
        """
        # Set time range if days specified
        min_timestamp = None
        if days is not None:
            min_timestamp = time.time() - (days * 86400)
            
        # Get matching entries
        entries = self.get_entries(
            category=category,
            feedback_type=feedback_type,
            user_id=user_id,
            session_id=session_id,
            min_timestamp=min_timestamp
        )
        
        # Filter entries with scores
        scored_entries = [e for e in entries if e.score is not None]
        
        if not scored_entries:
            return None
            
        # Calculate average
        return sum(e.score for e in scored_entries) / len(scored_entries)
    
    def get_score_trend(
        self,
        category: Union[str, FeedbackCategory],
        feedback_type: Optional[Union[str, FeedbackType]] = None,
        period: str = "day",  # day, week, month
        num_periods: int = 7
    ) -> List[Tuple[str, float, int]]:
        """
        Get trend of scores over time.
        
        Args:
            category: Score category
            feedback_type: Filter by feedback type
            period: Time period for grouping (day, week, month)
            num_periods: Number of periods to include
            
        Returns:
            List of (period_label, average_score, count) tuples
        """
        # Convert enums to strings if needed
        if isinstance(category, FeedbackCategory):
            category = category.value
            
        if isinstance(feedback_type, FeedbackType):
            feedback_type = feedback_type.value
            
        # Get relevant entries
        entries = self.get_entries(
            category=category,
            feedback_type=feedback_type
        )
        
        # Filter entries with scores
        scored_entries = [e for e in entries if e.score is not None]
        
        if not scored_entries:
            return []
            
        # Determine period length in seconds
        if period == "day":
            period_seconds = 86400
            format_str = "%Y-%m-%d"
        elif period == "week":
            period_seconds = 604800
            format_str = "%Y-W%W"
        elif period == "month":
            period_seconds = 2592000
            format_str = "%Y-%m"
        else:
            raise ValueError(f"Invalid period: {period}")
            
        # Calculate start time
        end_time = time.time()
        start_time = end_time - (num_periods * period_seconds)
        
        # Group entries by period
        period_scores: Dict[str, List[float]] = {}
        
        for entry in scored_entries:
            if entry.timestamp < start_time:
                continue
                
            # Calculate period label
            period_time = datetime.datetime.fromtimestamp(entry.timestamp)
            period_label = period_time.strftime(format_str)
            
            if period_label not in period_scores:
                period_scores[period_label] = []
                
            period_scores[period_label].append(entry.score)
            
        # Generate all period labels
        all_periods = []
        current_time = datetime.datetime.fromtimestamp(start_time)
        end_datetime = datetime.datetime.fromtimestamp(end_time)
        
        while current_time <= end_datetime:
            all_periods.append(current_time.strftime(format_str))
            
            if period == "day":
                current_time += datetime.timedelta(days=1)
            elif period == "week":
                current_time += datetime.timedelta(weeks=1)
            elif period == "month":
                # Add one month (approximately)
                if current_time.month == 12:
                    current_time = current_time.replace(year=current_time.year + 1, month=1)
                else:
                    current_time = current_time.replace(month=current_time.month + 1)
        
        # Calculate average scores and counts
        trend = []
        
        for period_label in all_periods:
            scores = period_scores.get(period_label, [])
            count = len(scores)
            
            if count > 0:
                avg_score = sum(scores) / count
            else:
                avg_score = 0.0
                
            trend.append((period_label, avg_score, count))
            
        return trend
    
    def generate_summary_report(
        self,
        days: int = 30,
        include_categories: Optional[List[Union[str, FeedbackCategory]]] = None
    ) -> Dict[str, Any]:
        """
        Generate a summary report of feedback.
        
        Args:
            days: Number of past days to include
            include_categories: Categories to include, or None for all
            
        Returns:
            Summary report as a dictionary
        """
        # Convert category enums to strings if needed
        if include_categories:
            include_categories = [
                c.value if isinstance(c, FeedbackCategory) else c
                for c in include_categories
            ]
            
        # Set time range
        min_timestamp = time.time() - (days * 86400)
        
        # Get entries in time range
        entries = self.get_entries(min_timestamp=min_timestamp)
        
        if not entries:
            return {
                "period_days": days,
                "total_entries": 0,
                "categories": {},
                "feedback_types": {},
                "recent_entries": []
            }
            
        # Get available categories
        if include_categories:
            categories = include_categories
        else:
            categories = set(e.category for e in entries)
            
        # Calculate stats by category
        category_stats = {}
        
        for category in categories:
            category_entries = [e for e in entries if e.category == category]
            
            if not category_entries:
                continue
                
            # Calculate average scores by feedback type
            type_scores = {}
            for feedback_type in FeedbackType:
                type_entries = [e for e in category_entries 
                               if e.feedback_type == feedback_type.value 
                               and e.score is not None]
                
                if type_entries:
                    avg_score = sum(e.score for e in type_entries) / len(type_entries)
                    type_scores[feedback_type.value] = {
                        "average_score": avg_score,
                        "count": len(type_entries)
                    }
            
            # Count by rating
            rating_counts = {}
            for e in category_entries:
                if e.rating:
                    rating_counts[e.rating] = rating_counts.get(e.rating, 0) + 1
            
            # Overall average
            scored_entries = [e for e in category_entries if e.score is not None]
            if scored_entries:
                avg_score = sum(e.score for e in scored_entries) / len(scored_entries)
            else:
                avg_score = None
            
            category_stats[category] = {
                "count": len(category_entries),
                "average_score": avg_score,
                "by_type": type_scores,
                "rating_counts": rating_counts
            }
        
        # Count by feedback type
        type_counts = {}
        for feedback_type in FeedbackType:
            count = len([e for e in entries if e.feedback_type == feedback_type.value])
            if count > 0:
                type_counts[feedback_type.value] = count
        
        # Get recent entries
        recent_entries = self.get_entries(
            min_timestamp=min_timestamp,
            max_timestamp=time.time()
        )[:10]  # Last 10 entries
        
        recent_entries_data = []
        for entry in recent_entries:
            recent_entries_data.append({
                "timestamp": entry.timestamp,
                "feedback_type": entry.feedback_type,
                "category": entry.category,
                "score": entry.score,
                "rating": entry.rating,
                "notes": entry.notes,
                "user_id": entry.user_id
            })
        
        # Create summary report
        return {
            "period_days": days,
            "total_entries": len(entries),
            "categories": category_stats,
            "feedback_types": type_counts,
            "recent_entries": recent_entries_data
        }
    
    def clear_entries(
        self,
        older_than_days: Optional[int] = None,
        feedback_type: Optional[Union[str, FeedbackType]] = None,
        category: Optional[Union[str, FeedbackCategory]] = None
    ) -> int:
        """
        Clear feedback entries matching criteria.
        
        Args:
            older_than_days: Clear entries older than this many days
            feedback_type: Clear entries of this type
            category: Clear entries in this category
            
        Returns:
            Number of entries cleared
        """
        # Convert enums to strings if needed
        if isinstance(feedback_type, FeedbackType):
            feedback_type = feedback_type.value
            
        if isinstance(category, FeedbackCategory):
            category = category.value
            
        # Set time threshold if specified
        min_timestamp = None
        if older_than_days is not None:
            min_timestamp = time.time() - (older_than_days * 86400)
            
        # Get entries to keep
        if feedback_type is None and category is None and min_timestamp is None:
            # Clear all entries
            count = len(self.entries)
            self.entries = []
        else:
            # Filter entries to keep
            before_count = len(self.entries)
            
            self.entries = [
                e for e in self.entries 
                if (feedback_type is not None and e.feedback_type != feedback_type) or
                   (category is not None and e.category != category) or
                   (min_timestamp is not None and e.timestamp >= min_timestamp)
            ]
            
            count = before_count - len(self.entries)
        
        # Save changes
        if count > 0 and self.auto_save:
            self.save_entries()
            
        logger.info(f"Cleared {count} feedback entries")
        return count


# CLI interface
def main():
    """Command-line interface for feedback logger."""
    import argparse
    
    parser = argparse.ArgumentParser(description="PersLM Feedback Logger")
    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    
    # Log feedback command
    log_parser = subparsers.add_parser("log", help="Log feedback")
    log_parser.add_argument("--type", choices=[t.value for t in FeedbackType], 
                          default="self", help="Feedback type")
    log_parser.add_argument("--category", choices=[c.value for c in FeedbackCategory], 
                          required=True, help="Feedback category")
    log_parser.add_argument("--score", type=float, help="Numerical score (0.0 to 1.0)")
    log_parser.add_argument("--rating", choices=["excellent", "good", "fair", "poor"], 
                          help="String rating")
    log_parser.add_argument("--notes", help="Notes or comments")
    log_parser.add_argument("--user-id", default="cli", help="User ID")
    log_parser.add_argument("--session-id", help="Session ID")
    log_parser.add_argument("--storage-dir", default="data/feedback", 
                          help="Storage directory")
    
    # Report command
    report_parser = subparsers.add_parser("report", help="Generate feedback report")
    report_parser.add_argument("--days", type=int, default=30, 
                             help="Number of days to include")
    report_parser.add_argument("--category", choices=[c.value for c in FeedbackCategory], 
                             help="Filter by category")
    report_parser.add_argument("--type", choices=[t.value for t in FeedbackType], 
                             help="Filter by feedback type")
    report_parser.add_argument("--output", help="Output file path (default: stdout)")
    report_parser.add_argument("--storage-dir", default="data/feedback", 
                             help="Storage directory")
    
    # Trend command
    trend_parser = subparsers.add_parser("trend", help="Show score trends")
    trend_parser.add_argument("--category", choices=[c.value for c in FeedbackCategory], 
                            required=True, help="Score category")
    trend_parser.add_argument("--type", choices=[t.value for t in FeedbackType], 
                            help="Filter by feedback type")
    trend_parser.add_argument("--period", choices=["day", "week", "month"], 
                            default="day", help="Time period for grouping")
    trend_parser.add_argument("--periods", type=int, default=7, 
                            help="Number of periods to include")
    trend_parser.add_argument("--storage-dir", default="data/feedback", 
                            help="Storage directory")
    
    # Clear command
    clear_parser = subparsers.add_parser("clear", help="Clear feedback entries")
    clear_parser.add_argument("--older-than", type=int, 
                            help="Clear entries older than this many days")
    clear_parser.add_argument("--type", choices=[t.value for t in FeedbackType], 
                            help="Clear entries of this type")
    clear_parser.add_argument("--category", choices=[c.value for c in FeedbackCategory], 
                            help="Clear entries in this category")
    clear_parser.add_argument("--storage-dir", default="data/feedback", 
                            help="Storage directory")
    clear_parser.add_argument("--confirm", action="store_true", 
                            help="Confirm clearing without prompting")
    
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    )
    
    if not args.command:
        parser.print_help()
        return
        
    # Create feedback logger
    logger = FeedbackLogger(storage_dir=args.storage_dir)
    
    if args.command == "log":
        # Validate score and rating
        if args.score is None and args.rating is None:
            print("Error: Either --score or --rating must be provided.")
            return
            
        if args.score is not None and (args.score < 0.0 or args.score > 1.0):
            print("Error: Score must be between 0.0 and 1.0.")
            return
            
        # Log feedback
        entry = logger.log_feedback(
            feedback_type=args.type,
            category=args.category,
            score=args.score,
            rating=args.rating,
            notes=args.notes,
            user_id=args.user_id,
            session_id=args.session_id
        )
        
        print(f"Logged feedback: {entry.category} - {entry.rating or entry.score}")
        
    elif args.command == "report":
        # Generate report
        if args.category:
            categories = [args.category]
        else:
            categories = None
            
        report = logger.generate_summary_report(
            days=args.days,
            include_categories=categories
        )
        
        # Format report as JSON
        report_json = json.dumps(report, indent=2)
        
        # Output report
        if args.output:
            with open(args.output, 'w') as f:
                f.write(report_json)
            print(f"Report saved to {args.output}")
        else:
            print(report_json)
            
    elif args.command == "trend":
        # Show trend
        trend = logger.get_score_trend(
            category=args.category,
            feedback_type=args.type,
            period=args.period,
            num_periods=args.periods
        )
        
        if not trend:
            print(f"No data available for {args.category}.")
            return
            
        # Print trend
        print(f"Score trend for {args.category} ({args.period}ly):")
        print(f"{'Period':<12} {'Score':<8} {'Count':<8}")
        print("-" * 30)
        
        for period, score, count in trend:
            print(f"{period:<12} {score:.2f if score else 'N/A':<8} {count:<8}")
            
    elif args.command == "clear":
        # Confirm clearing
        if not args.confirm:
            if args.older_than:
                prompt = f"Clear entries older than {args.older_than} days"
            elif args.type and args.category:
                prompt = f"Clear all {args.type} entries in category {args.category}"
            elif args.type:
                prompt = f"Clear all {args.type} entries"
            elif args.category:
                prompt = f"Clear all entries in category {args.category}"
            else:
                prompt = "Clear ALL entries"
                
            confirm = input(f"{prompt}? (y/n): ")
            if confirm.lower() != 'y':
                print("Operation cancelled.")
                return
                
        # Clear entries
        count = logger.clear_entries(
            older_than_days=args.older_than,
            feedback_type=args.type,
            category=args.category
        )
        
        print(f"Cleared {count} entries.")


if __name__ == "__main__":
    main() 