"""
Reasoning Manager for PersLM

This module implements the core reasoning manager that coordinates
different reasoning strategies and integrates with the model and memory system.
"""

import logging
from typing import Dict, List, Optional, Any, Callable, Union
import json
from enum import Enum

from src.memory import MemoryManager

logger = logging.getLogger(__name__)

class ReasoningMode(Enum):
    """Enum for different reasoning modes."""
    CHAIN_OF_THOUGHT = "chain_of_thought"
    SELF_REFLECTION = "self_reflection"
    TASK_DECOMPOSITION = "task_decomposition"
    PLANNING = "planning"
    AUTO = "auto"  # Automatically select the most appropriate reasoning mode

class ReasoningTrace:
    """Class for storing and managing reasoning traces."""
    
    def __init__(self):
        self.steps = []
        self.mode = None
        self.current_step = 0
        self.metadata = {}
        
    def add_step(self, content: str, step_type: str = "thought", metadata: Dict[str, Any] = None):
        """Add a step to the reasoning trace."""
        step = {
            "step_id": self.current_step,
            "type": step_type,
            "content": content,
            "metadata": metadata or {}
        }
        self.steps.append(step)
        self.current_step += 1
        return self.current_step - 1
    
    def get_full_trace(self) -> str:
        """Get the full reasoning trace as a formatted string."""
        trace_str = ""
        for step in self.steps:
            if step["type"] == "thought":
                trace_str += f"Thought: {step['content']}\n\n"
            elif step["type"] == "action":
                trace_str += f"Action: {step['content']}\n\n"
            elif step["type"] == "observation":
                trace_str += f"Observation: {step['content']}\n\n"
            else:
                trace_str += f"{step['type'].capitalize()}: {step['content']}\n\n"
        return trace_str
    
    def get_last_step(self) -> Optional[Dict[str, Any]]:
        """Get the last step in the reasoning trace."""
        if not self.steps:
            return None
        return self.steps[-1]
    
    def to_json(self) -> str:
        """Convert the reasoning trace to JSON."""
        return json.dumps({
            "steps": self.steps,
            "mode": self.mode.value if self.mode else None,
            "metadata": self.metadata
        }, indent=2)
    
    @classmethod
    def from_json(cls, json_str: str) -> 'ReasoningTrace':
        """Create a reasoning trace from JSON."""
        data = json.loads(json_str)
        trace = cls()
        trace.steps = data["steps"]
        trace.mode = ReasoningMode(data["mode"]) if data.get("mode") else None
        trace.metadata = data.get("metadata", {})
        trace.current_step = len(trace.steps)
        return trace
    
    def save_to_memory(self, memory_manager: MemoryManager, long_term: bool = True):
        """Save the reasoning trace to memory."""
        content = self.get_full_trace()
        metadata = {
            "type": "reasoning_trace",
            "mode": self.mode.value if self.mode else None,
            "steps": len(self.steps),
            **self.metadata
        }
        memory_manager.add(content, long_term=long_term, metadata=metadata)


class ReasoningManager:
    """Manager for coordinating different reasoning strategies."""
    
    def __init__(
        self, 
        model_provider: Callable,
        memory_manager: Optional[MemoryManager] = None,
        default_mode: ReasoningMode = ReasoningMode.AUTO,
        config: Dict[str, Any] = None
    ):
        """Initialize the reasoning manager.
        
        Args:
            model_provider: Function that generates text from the model
            memory_manager: Memory manager for storing and retrieving reasoning traces
            default_mode: Default reasoning mode to use
            config: Configuration for the reasoning manager
        """
        self.model_provider = model_provider
        self.memory_manager = memory_manager
        self.default_mode = default_mode
        self.config = config or {}
        self.reasoners = {}  # Will be populated with reasoner instances
        
        # Initialize reasoning trace
        self.current_trace = ReasoningTrace()
    
    def register_reasoner(self, mode: ReasoningMode, reasoner: Any):
        """Register a reasoner for a specific mode."""
        self.reasoners[mode] = reasoner
    
    def _select_reasoning_mode(self, query: str, context: Optional[str] = None) -> ReasoningMode:
        """Select the appropriate reasoning mode based on the query and context."""
        if self.default_mode != ReasoningMode.AUTO:
            return self.default_mode
        
        # Simple heuristic-based selection (to be improved with more sophisticated logic)
        query_lower = query.lower()
        
        if any(kw in query_lower for kw in ["step by step", "solve", "calculate", "math"]):
            return ReasoningMode.CHAIN_OF_THOUGHT
        
        if any(kw in query_lower for kw in ["plan", "strategy", "approach", "steps to"]):
            return ReasoningMode.PLANNING
        
        if any(kw in query_lower for kw in ["break down", "subtasks", "components"]):
            return ReasoningMode.TASK_DECOMPOSITION
        
        if any(kw in query_lower for kw in ["review", "improve", "critique", "reflect"]):
            return ReasoningMode.SELF_REFLECTION
        
        # Default to chain of thought if no clear match
        return ReasoningMode.CHAIN_OF_THOUGHT
    
    def reason(
        self, 
        query: str, 
        context: Optional[str] = None,
        mode: Optional[ReasoningMode] = None,
        max_iterations: int = 5,
        save_to_memory: bool = True
    ) -> Dict[str, Any]:
        """Perform reasoning on the given query.
        
        Args:
            query: The query to reason about
            context: Additional context to consider
            mode: Reasoning mode to use (overrides default)
            max_iterations: Maximum number of reasoning iterations
            save_to_memory: Whether to save the reasoning trace to memory
            
        Returns:
            Dictionary containing the reasoning result and trace
        """
        # Select reasoning mode
        selected_mode = mode or self._select_reasoning_mode(query, context)
        
        # Initialize reasoning trace
        self.current_trace = ReasoningTrace()
        self.current_trace.mode = selected_mode
        self.current_trace.metadata["query"] = query
        
        # Log the selected reasoning mode
        logger.info(f"Selected reasoning mode: {selected_mode.value}")
        self.current_trace.add_step(f"Selected reasoning mode: {selected_mode.value}", step_type="metadata")
        
        # Get the appropriate reasoner
        if selected_mode not in self.reasoners:
            error_msg = f"No reasoner registered for mode: {selected_mode.value}"
            logger.error(error_msg)
            self.current_trace.add_step(error_msg, step_type="error")
            return {
                "success": False,
                "error": error_msg,
                "trace": self.current_trace
            }
        
        reasoner = self.reasoners[selected_mode]
        
        # Perform reasoning
        try:
            result = reasoner.reason(
                query=query,
                context=context,
                trace=self.current_trace,
                model_provider=self.model_provider,
                max_iterations=max_iterations
            )
            
            # Save reasoning trace to memory if enabled
            if save_to_memory and self.memory_manager:
                self.current_trace.save_to_memory(self.memory_manager)
            
            return {
                "success": True,
                "result": result,
                "trace": self.current_trace,
                "mode": selected_mode.value
            }
            
        except Exception as e:
            error_msg = f"Error during reasoning: {str(e)}"
            logger.error(error_msg)
            self.current_trace.add_step(error_msg, step_type="error")
            
            # Save reasoning trace to memory even if failed
            if save_to_memory and self.memory_manager:
                self.current_trace.save_to_memory(self.memory_manager)
            
            return {
                "success": False,
                "error": error_msg,
                "trace": self.current_trace,
                "mode": selected_mode.value
            }
    
    def get_reasoning_prompt(self, mode: ReasoningMode, query: str, context: Optional[str] = None) -> str:
        """Get a reasoning prompt for the selected mode."""
        base_prompt = f"Query: {query}\n\n"
        
        if context:
            base_prompt += f"Context: {context}\n\n"
        
        if mode == ReasoningMode.CHAIN_OF_THOUGHT:
            base_prompt += "Let's solve this step-by-step:\n\n"
        elif mode == ReasoningMode.SELF_REFLECTION:
            base_prompt += "Let me first generate an answer, then reflect on it:\n\n"
        elif mode == ReasoningMode.TASK_DECOMPOSITION:
            base_prompt += "Let me break down this task into smaller components:\n\n"
        elif mode == ReasoningMode.PLANNING:
            base_prompt += "Let me create a plan to address this:\n\n"
        
        return base_prompt 