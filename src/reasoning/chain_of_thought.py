"""
Chain of Thought Reasoning Module

This module implements chain of thought reasoning to solve problems step by step.
"""

import logging
from typing import Dict, List, Optional, Any, Callable, Union

from src.reasoning.reasoner import ReasoningTrace

logger = logging.getLogger(__name__)

class ChainOfThoughtReasoner:
    """Chain of thought reasoner for step-by-step problem solving."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the chain of thought reasoner.
        
        Args:
            config: Configuration for the reasoner
        """
        self.config = config or {}
        self.instruction_template = self.config.get(
            "instruction_template",
            "Think through this problem step-by-step to find the correct answer."
        )
        self.max_steps = self.config.get("max_steps", 5)
    
    def _get_cot_prompt(self, query: str, context: Optional[str] = None) -> str:
        """Generate a chain of thought prompt for the given query."""
        prompt = f"{self.instruction_template}\n\nQuestion: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += "Let me think through this step by step:\n"
        return prompt
    
    def _extract_final_answer(self, reasoning_text: str) -> str:
        """Extract the final answer from the reasoning text."""
        # Check for explicit "Answer:" or "Therefore," markers
        if "Answer:" in reasoning_text:
            return reasoning_text.split("Answer:")[-1].strip()
        elif "Therefore," in reasoning_text:
            return reasoning_text.split("Therefore,")[-1].strip()
        elif "Thus," in reasoning_text:
            return reasoning_text.split("Thus,")[-1].strip()
        elif "So," in reasoning_text:
            return reasoning_text.split("So,")[-1].strip()
        
        # If no explicit marker, use the last paragraph
        paragraphs = reasoning_text.split("\n\n")
        if paragraphs:
            return paragraphs[-1].strip()
        
        return reasoning_text.strip()
    
    def reason(
        self,
        query: str,
        context: Optional[str] = None,
        trace: ReasoningTrace = None,
        model_provider: Callable = None,
        max_iterations: int = 5
    ) -> Dict[str, Any]:
        """Perform chain of thought reasoning on the given query.
        
        Args:
            query: The query to reason about
            context: Additional context to consider
            trace: Reasoning trace to append to
            model_provider: Function that generates text from the model
            max_iterations: Maximum number of iterations (not used in CoT)
            
        Returns:
            Dictionary containing the reasoning result
        """
        if not trace:
            trace = ReasoningTrace()
        
        # Generate the prompt
        prompt = self._get_cot_prompt(query, context)
        trace.add_step(prompt, step_type="prompt")
        
        # Get model response for chain of thought
        if not model_provider:
            error_msg = "No model provider specified"
            logger.error(error_msg)
            trace.add_step(error_msg, step_type="error")
            return {"error": error_msg}
        
        logger.info("Generating chain of thought reasoning")
        reasoning = model_provider(prompt)
        trace.add_step(reasoning, step_type="reasoning")
        
        # Extract final answer
        final_answer = self._extract_final_answer(reasoning)
        trace.add_step(final_answer, step_type="answer")
        
        return {
            "reasoning": reasoning,
            "answer": final_answer
        }
    
    def evaluate(self, trace: ReasoningTrace) -> Dict[str, Any]:
        """Evaluate the quality of the reasoning trace.
        
        This can be used to assess how well the reasoner performed.
        
        Args:
            trace: The reasoning trace to evaluate
            
        Returns:
            Dictionary containing evaluation metrics
        """
        # Count the steps in the reasoning
        reasoning_steps = [step for step in trace.steps if step["type"] == "reasoning"]
        
        # Simple evaluation: check if reasoning has multiple paragraphs/steps
        if not reasoning_steps:
            return {"quality": 0, "message": "No reasoning steps found"}
        
        reasoning_text = reasoning_steps[0]["content"]
        paragraphs = [p for p in reasoning_text.split("\n\n") if p.strip()]
        
        # Check for numerical calculations
        has_calculations = any("=" in p for p in paragraphs)
        
        # Check for step numbering patterns
        has_steps = any(p.strip().startswith(("Step", "1.", "1)", "First")) for p in paragraphs)
        
        # Evaluate quality based on heuristics
        if len(paragraphs) >= 3 and (has_calculations or has_steps):
            quality = 0.8
            message = "Good reasoning with multiple steps and calculations"
        elif len(paragraphs) >= 2:
            quality = 0.5
            message = "Basic reasoning with some steps"
        else:
            quality = 0.2
            message = "Minimal reasoning with few steps"
        
        return {
            "quality": quality,
            "message": message,
            "steps": len(paragraphs),
            "has_calculations": has_calculations,
            "has_explicit_steps": has_steps
        } 