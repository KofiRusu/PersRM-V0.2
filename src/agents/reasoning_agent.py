"""
Reasoning Agent

This module implements the Reasoning Agent, which specializes in applying
various reasoning strategies to solve complex problems.
"""

import logging
from typing import Dict, List, Optional, Any, Callable

from src.agents.base import Agent, AgentTask, AgentResult
from src.reasoning import ReasoningManager, ReasoningMode, ReasoningTrace
from src.memory import MemoryManager

logger = logging.getLogger(__name__)

class ReasoningAgent(Agent):
    """Agent specializing in applying reasoning strategies."""
    
    def __init__(
        self,
        agent_id: str,
        model_provider: Callable,
        reasoning_manager: ReasoningManager,  # Required
        memory_manager: Optional[MemoryManager] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the reasoning agent.
        
        Args:
            agent_id: Unique identifier for the agent
            model_provider: Function to generate text from the model
            reasoning_manager: Reasoning manager for applying reasoning strategies
            memory_manager: Memory manager for storing reasoning traces
            config: Configuration for the agent
        """
        super().__init__(
            agent_id=agent_id,
            name="Reasoning Agent",
            description="Specializes in applying reasoning strategies to solve problems",
            model_provider=model_provider,
            memory_manager=memory_manager,
            config=config
        )
        
        self.reasoning_manager = reasoning_manager
        
        # Default configurations
        self.auto_select_mode = config.get("auto_select_mode", True)
        self.default_mode = ReasoningMode.CHAIN_OF_THOUGHT
        self.fallback_enabled = config.get("fallback_enabled", True)
    
    @property
    def task_types(self) -> List[str]:
        """Get the task types this agent can handle."""
        return [
            "reasoning", "problem-solving", "complex-query", "explanation",
            "analysis", "decision-making"
        ]
    
    @property
    def capabilities(self) -> List[str]:
        """Get the capabilities of this agent."""
        capabilities = ["reasoning", "problem-solving", "critical-thinking"]
        
        # Add mode-specific capabilities
        capabilities.extend([
            "chain-of-thought",
            "self-reflection",
            "task-decomposition",
            "strategic-planning"
        ])
        
        return capabilities
    
    def execute(self, task: AgentTask) -> AgentResult:
        """Execute a reasoning task.
        
        Args:
            task: Reasoning task to execute
            
        Returns:
            Result of the reasoning
        """
        logger.info(f"Executing reasoning task: {task.query}")
        
        # Determine the reasoning mode to use
        if self.auto_select_mode:
            # Automatically select mode
            mode = self._select_reasoning_mode(task)
        else:
            # Use default or specified mode
            mode = self._get_specified_mode(task) or self.default_mode
        
        logger.info(f"Selected reasoning mode: {mode.value}")
        
        # Apply the reasoning
        reasoning_result = self._apply_reasoning(task, mode)
        
        # Check if reasoning was successful
        if not reasoning_result.get("success", False) and self.fallback_enabled:
            # Try with a different mode as fallback
            logger.warning(f"Reasoning with {mode.value} failed, trying fallback")
            fallback_mode = self._get_fallback_mode(mode)
            reasoning_result = self._apply_reasoning(task, fallback_mode)
        
        # Create result
        result = {
            "mode": reasoning_result.get("mode", mode.value),
            "answer": reasoning_result.get("result", {}).get("answer", ""),
            "reasoning": reasoning_result.get("result", {}).get("reasoning", ""),
            "success": reasoning_result.get("success", False)
        }
        
        # If available, add the full reasoning trace
        if "trace" in reasoning_result:
            result["trace"] = reasoning_result["trace"].to_dict()
        
        return AgentResult(
            task_id=task.id,
            agent_id=self.agent_id,
            success=reasoning_result.get("success", False),
            result=result
        )
    
    def _select_reasoning_mode(self, task: AgentTask) -> ReasoningMode:
        """Select the appropriate reasoning mode for the task.
        
        Args:
            task: Reasoning task
            
        Returns:
            Selected reasoning mode
        """
        query_lower = task.query.lower()
        
        # Check for math/logic problems (Chain of Thought)
        if any(kw in query_lower for kw in ["calculate", "solve", "compute", "math", "logic", "proof"]):
            return ReasoningMode.CHAIN_OF_THOUGHT
            
        # Check for improvement/reflection tasks (Self Reflection)
        elif any(kw in query_lower for kw in ["improve", "reflect", "review", "critique", "better"]):
            return ReasoningMode.SELF_REFLECTION
            
        # Check for complex tasks needing breakdown (Task Decomposition)
        elif any(kw in query_lower for kw in ["complex", "steps", "procedure", "process", "how to"]):
            return ReasoningMode.TASK_DECOMPOSITION
            
        # Check for planning/strategy (Planning)
        elif any(kw in query_lower for kw in ["plan", "strategy", "approach", "method"]):
            return ReasoningMode.PLANNING
        
        # Use Auto mode if no clear indicators
        else:
            return ReasoningMode.AUTO
    
    def _get_specified_mode(self, task: AgentTask) -> Optional[ReasoningMode]:
        """Get the specified reasoning mode from task metadata.
        
        Args:
            task: Reasoning task
            
        Returns:
            Specified reasoning mode, or None if not specified
        """
        # Check metadata for specified mode
        mode_str = task.metadata.get("reasoning_mode")
        if not mode_str:
            return None
        
        # Convert to enum
        try:
            return ReasoningMode[mode_str.upper()]
        except (KeyError, AttributeError):
            logger.warning(f"Invalid reasoning mode specified: {mode_str}")
            return None
    
    def _get_fallback_mode(self, current_mode: ReasoningMode) -> ReasoningMode:
        """Get a fallback reasoning mode.
        
        Args:
            current_mode: Current reasoning mode that failed
            
        Returns:
            Fallback reasoning mode
        """
        # Define fallback preferences
        fallbacks = {
            ReasoningMode.CHAIN_OF_THOUGHT: ReasoningMode.SELF_REFLECTION,
            ReasoningMode.SELF_REFLECTION: ReasoningMode.TASK_DECOMPOSITION,
            ReasoningMode.TASK_DECOMPOSITION: ReasoningMode.PLANNING,
            ReasoningMode.PLANNING: ReasoningMode.CHAIN_OF_THOUGHT,
            ReasoningMode.AUTO: ReasoningMode.CHAIN_OF_THOUGHT
        }
        
        return fallbacks.get(current_mode, ReasoningMode.CHAIN_OF_THOUGHT)
    
    def _apply_reasoning(self, task: AgentTask, mode: ReasoningMode) -> Dict[str, Any]:
        """Apply a reasoning strategy to solve the task.
        
        Args:
            task: Reasoning task
            mode: Reasoning mode to use
            
        Returns:
            Reasoning result
        """
        try:
            # Execute reasoning with the reasoning manager
            reasoning_result = self.reasoning_manager.reason(
                query=task.query,
                context=task.context,
                mode=mode
            )
            
            # Save reasoning trace to memory if successful
            if reasoning_result.get("success", False) and self.memory_manager:
                trace = reasoning_result.get("trace")
                if trace:
                    trace_text = trace.get_full_trace()
                    self.memory_manager.add(trace_text, long_term=True, metadata={
                        "type": "reasoning_trace",
                        "task_id": task.id,
                        "agent_id": self.agent_id,
                        "reasoning_mode": mode.value,
                        "success": True
                    })
            
            return reasoning_result
            
        except Exception as e:
            logger.exception(f"Error applying reasoning mode {mode.value}")
            
            # Create error result
            error_result = {
                "success": False,
                "mode": mode.value,
                "error": str(e),
                "result": {
                    "answer": f"Error while reasoning: {str(e)}",
                    "reasoning": ""
                }
            }
            
            # Create an error trace
            error_trace = ReasoningTrace()
            error_trace.add_step(f"Error while reasoning with {mode.value}: {str(e)}", "error")
            error_result["trace"] = error_trace
            
            return error_result
    
    def evaluate_reasoning(self, trace: ReasoningTrace) -> Dict[str, Any]:
        """Evaluate the quality of a reasoning trace.
        
        Args:
            trace: Reasoning trace to evaluate
            
        Returns:
            Evaluation metrics
        """
        # Get the mode from the trace
        mode = trace.mode
        
        # Get the appropriate reasoner for this mode
        if mode and mode in self.reasoning_manager.reasoners:
            reasoner = self.reasoning_manager.reasoners[mode]
            if hasattr(reasoner, "evaluate"):
                return reasoner.evaluate(trace)
        
        # Default evaluation if no specific evaluation is available
        return self._default_evaluation(trace)
    
    def _default_evaluation(self, trace: ReasoningTrace) -> Dict[str, Any]:
        """Default evaluation when no specific evaluation is available.
        
        Args:
            trace: Reasoning trace to evaluate
            
        Returns:
            Default evaluation metrics
        """
        # Count the number of steps
        step_count = len(trace.steps)
        
        # Check for error steps
        error_steps = [step for step in trace.steps if step["type"] == "error"]
        
        # Simple evaluation based on step count and errors
        if error_steps:
            return {
                "quality": 0.0,
                "message": "Reasoning contains errors",
                "step_count": step_count,
                "error_count": len(error_steps)
            }
        elif step_count > 5:
            return {
                "quality": 0.8,
                "message": "Detailed reasoning with multiple steps",
                "step_count": step_count
            }
        elif step_count > 2:
            return {
                "quality": 0.5,
                "message": "Basic reasoning with few steps",
                "step_count": step_count
            }
        else:
            return {
                "quality": 0.2,
                "message": "Minimal reasoning",
                "step_count": step_count
            } 