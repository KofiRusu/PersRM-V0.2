"""
Base Agent Interface

This module defines the base Agent class and related data structures for the
multi-agent coordination system in PersLM.
"""

import logging
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Callable, Union, Type

from src.memory import MemoryManager

logger = logging.getLogger(__name__)

@dataclass
class AgentTask:
    """A task for an agent to perform."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    query: str = ""
    context: Optional[str] = None
    type: str = "general"
    subtasks: List["AgentTask"] = field(default_factory=list)
    parent_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    priority: int = 1  # Higher is more important
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert task to dictionary."""
        return {
            "id": self.id,
            "query": self.query,
            "context": self.context,
            "type": self.type,
            "subtasks": [subtask.to_dict() for subtask in self.subtasks],
            "parent_id": self.parent_id,
            "metadata": self.metadata,
            "created_at": self.created_at,
            "priority": self.priority
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentTask":
        """Create a task from dictionary."""
        task = cls(
            id=data.get("id", str(uuid.uuid4())),
            query=data.get("query", ""),
            context=data.get("context"),
            type=data.get("type", "general"),
            parent_id=data.get("parent_id"),
            metadata=data.get("metadata", {}),
            created_at=data.get("created_at", time.time()),
            priority=data.get("priority", 1)
        )
        
        # Create subtasks
        subtasks_data = data.get("subtasks", [])
        for subtask_data in subtasks_data:
            task.subtasks.append(cls.from_dict(subtask_data))
        
        return task

@dataclass
class AgentResult:
    """Result of an agent task."""
    task_id: str
    agent_id: str
    success: bool
    result: Any
    error: Optional[str] = None
    execution_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    subtask_results: List["AgentResult"] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary."""
        return {
            "task_id": self.task_id,
            "agent_id": self.agent_id,
            "success": self.success,
            "result": self.result,
            "error": self.error,
            "execution_time": self.execution_time,
            "metadata": self.metadata,
            "subtask_results": [subtask.to_dict() for subtask in self.subtask_results]
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AgentResult":
        """Create a result from dictionary."""
        result = cls(
            task_id=data.get("task_id", ""),
            agent_id=data.get("agent_id", ""),
            success=data.get("success", False),
            result=data.get("result"),
            error=data.get("error"),
            execution_time=data.get("execution_time", 0.0),
            metadata=data.get("metadata", {})
        )
        
        # Create subtask results
        subtask_results_data = data.get("subtask_results", [])
        for subtask_data in subtask_results_data:
            result.subtask_results.append(cls.from_dict(subtask_data))
        
        return result


class Agent(ABC):
    """Base class for all agents in the multi-agent system."""
    
    def __init__(
        self, 
        agent_id: str, 
        name: str, 
        description: str,
        model_provider: Callable,
        memory_manager: Optional[MemoryManager] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the agent.
        
        Args:
            agent_id: Unique identifier for the agent
            name: Human-readable name for the agent
            description: Description of the agent's capabilities
            model_provider: Function to generate text from the model
            memory_manager: Memory manager for storing agent context
            config: Configuration for the agent
        """
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.model_provider = model_provider
        self.memory_manager = memory_manager
        self.config = config or {}
        
        # Agent-specific memory
        self.memory_namespace = f"agent:{agent_id}"
        
        # Initialize task history
        self.task_history: List[AgentTask] = []
        self.result_history: Dict[str, AgentResult] = {}
    
    @property
    def capabilities(self) -> List[str]:
        """Get the capabilities of this agent."""
        return self.config.get("capabilities", [])
    
    @property
    def task_types(self) -> List[str]:
        """Get the task types this agent can handle."""
        return self.config.get("task_types", ["general"])
    
    def can_handle_task(self, task: AgentTask) -> bool:
        """Check if this agent can handle a specific task.
        
        Args:
            task: Task to check
            
        Returns:
            True if the agent can handle the task, False otherwise
        """
        # Check if task type is supported
        if task.type not in self.task_types and "general" not in self.task_types:
            return False
        
        # Additional checks can be implemented in subclasses
        return True
    
    def save_result(self, result: AgentResult) -> None:
        """Save the result of a task.
        
        Args:
            result: Result to save
        """
        self.result_history[result.task_id] = result
        
        # Save to memory if available
        if self.memory_manager:
            content = f"Task: {result.task_id}\nSuccess: {result.success}\nResult: {result.result}"
            if result.error:
                content += f"\nError: {result.error}"
            
            self.memory_manager.add(content, long_term=True, metadata={
                "type": "agent_result",
                "agent_id": self.agent_id,
                "task_id": result.task_id,
                "success": result.success,
                "namespace": self.memory_namespace
            })
    
    @abstractmethod
    def execute(self, task: AgentTask) -> AgentResult:
        """Execute a task.
        
        This method must be implemented by all agents.
        
        Args:
            task: Task to execute
            
        Returns:
            Result of task execution
        """
        pass
    
    def run(self, task: AgentTask) -> AgentResult:
        """Run a task with pre/post processing and error handling.
        
        Args:
            task: Task to run
            
        Returns:
            Result of task execution
        """
        if not self.can_handle_task(task):
            return AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=False,
                result=None,
                error=f"Agent {self.name} cannot handle task type {task.type}"
            )
        
        # Add task to history
        self.task_history.append(task)
        
        # Start timer
        start_time = time.time()
        
        try:
            # Execute the task
            result = self.execute(task)
            
            # Calculate execution time
            result.execution_time = time.time() - start_time
            
            # Save result
            self.save_result(result)
            
            return result
            
        except Exception as e:
            logger.exception(f"Error in agent {self.name} executing task {task.id}")
            
            # Create error result
            error_result = AgentResult(
                task_id=task.id,
                agent_id=self.agent_id,
                success=False,
                result=None,
                error=str(e),
                execution_time=time.time() - start_time
            )
            
            # Save error result
            self.save_result(error_result)
            
            return error_result 