"""
Self-Reflection Reasoning Module

This module implements self-reflection reasoning to evaluate and improve solutions.
"""

import logging
from typing import Dict, List, Optional, Any, Callable, Union

from src.reasoning.reasoner import ReasoningTrace

logger = logging.getLogger(__name__)

class SelfReflectionReasoner:
    """Self-reflection reasoner for evaluating and improving solutions."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the self-reflection reasoner.
        
        Args:
            config: Configuration for the reasoner
        """
        self.config = config or {}
        
        self.initial_prompt_template = self.config.get(
            "initial_prompt_template",
            "Please provide an initial response to the following question."
        )
        
        self.reflection_prompt_template = self.config.get(
            "reflection_prompt_template",
            (
                "Let me reflect on my previous answer to see if it's correct and complete.\n"
                "I should check for errors, consider different perspectives, and ensure my answer is comprehensive."
            )
        )
        
        self.revision_prompt_template = self.config.get(
            "revision_prompt_template",
            (
                "Based on my reflection, here's an improved answer that addresses the issues I identified."
            )
        )
        
        self.max_reflections = self.config.get("max_reflections", 1)
    
    def _get_initial_prompt(self, query: str, context: Optional[str] = None) -> str:
        """Generate the initial prompt for the given query."""
        prompt = f"{self.initial_prompt_template}\n\nQuestion: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += "Initial response:\n"
        return prompt
    
    def _get_reflection_prompt(self, query: str, initial_response: str, context: Optional[str] = None) -> str:
        """Generate a reflection prompt based on the initial response."""
        prompt = f"Question: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += f"My initial response:\n{initial_response}\n\n"
        prompt += f"{self.reflection_prompt_template}\n\nReflection:\n"
        return prompt
    
    def _get_revision_prompt(self, query: str, initial_response: str, reflection: str, context: Optional[str] = None) -> str:
        """Generate a revision prompt based on the reflection."""
        prompt = f"Question: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += f"My initial response:\n{initial_response}\n\n"
        prompt += f"My reflection:\n{reflection}\n\n"
        prompt += f"{self.revision_prompt_template}\n\nImproved answer:\n"
        return prompt
    
    def reason(
        self,
        query: str,
        context: Optional[str] = None,
        trace: ReasoningTrace = None,
        model_provider: Callable = None,
        max_iterations: int = 2
    ) -> Dict[str, Any]:
        """Perform self-reflection reasoning on the given query.
        
        Args:
            query: The query to reason about
            context: Additional context to consider
            trace: Reasoning trace to append to
            model_provider: Function that generates text from the model
            max_iterations: Maximum number of reflection iterations
            
        Returns:
            Dictionary containing the reasoning result
        """
        if not trace:
            trace = ReasoningTrace()
        
        # Check model provider
        if not model_provider:
            error_msg = "No model provider specified"
            logger.error(error_msg)
            trace.add_step(error_msg, step_type="error")
            return {"error": error_msg}
        
        # Step 1: Generate initial response
        initial_prompt = self._get_initial_prompt(query, context)
        trace.add_step(initial_prompt, step_type="prompt")
        
        logger.info("Generating initial response")
        initial_response = model_provider(initial_prompt)
        trace.add_step(initial_response, step_type="initial_response")
        
        # Cap iterations to configured maximum
        iterations = min(max_iterations, self.max_reflections)
        
        # Step 2: Generate reflection on the initial response
        reflection_prompt = self._get_reflection_prompt(query, initial_response, context)
        trace.add_step(reflection_prompt, step_type="prompt")
        
        logger.info("Generating reflection")
        reflection = model_provider(reflection_prompt)
        trace.add_step(reflection, step_type="reflection")
        
        # Step 3: Generate improved answer based on reflection
        revision_prompt = self._get_revision_prompt(query, initial_response, reflection, context)
        trace.add_step(revision_prompt, step_type="prompt")
        
        logger.info("Generating improved answer")
        improved_answer = model_provider(revision_prompt)
        trace.add_step(improved_answer, step_type="improved_answer")
        
        # Return results
        return {
            "initial_response": initial_response,
            "reflection": reflection,
            "improved_answer": improved_answer,
            "answer": improved_answer  # Final answer is the improved version
        }
    
    def evaluate(self, trace: ReasoningTrace) -> Dict[str, Any]:
        """Evaluate the quality of the self-reflection.
        
        Args:
            trace: The reasoning trace to evaluate
            
        Returns:
            Dictionary containing evaluation metrics
        """
        # Extract key components from trace
        initial_steps = [step for step in trace.steps if step["type"] == "initial_response"]
        reflection_steps = [step for step in trace.steps if step["type"] == "reflection"]
        improved_steps = [step for step in trace.steps if step["type"] == "improved_answer"]
        
        if not initial_steps or not reflection_steps or not improved_steps:
            return {"quality": 0, "message": "Missing key steps in self-reflection trace"}
        
        initial_response = initial_steps[0]["content"]
        reflection = reflection_steps[0]["content"]
        improved_answer = improved_steps[0]["content"]
        
        # Check if reflection identified issues
        identified_issues = any(kw in reflection.lower() for kw in 
                               ["issue", "problem", "error", "mistake", "incorrect", 
                                "could be better", "improve", "enhance", "missing"])
        
        # Check if improved answer is different from initial
        # Simple diff: check if at least 20% different in length
        length_diff_ratio = abs(len(improved_answer) - len(initial_response)) / max(len(initial_response), 1)
        significant_change = length_diff_ratio > 0.2
        
        # Check for specific reflection patterns
        has_structured_reflection = any(p in reflection.lower() for p in 
                                      ["first,", "secondly", "lastly", "in addition", "moreover", 
                                       "however", "on the other hand", "alternatively"])
        
        # Evaluate quality
        if identified_issues and significant_change and has_structured_reflection:
            quality = 0.9
            message = "Excellent self-reflection with clear improvements"
        elif identified_issues and (significant_change or has_structured_reflection):
            quality = 0.7
            message = "Good self-reflection with some improvements"
        elif identified_issues or significant_change:
            quality = 0.4
            message = "Basic self-reflection with minor improvements"
        else:
            quality = 0.2
            message = "Minimal self-reflection with little change"
        
        return {
            "quality": quality,
            "message": message,
            "identified_issues": identified_issues,
            "significant_change": significant_change,
            "has_structured_reflection": has_structured_reflection,
            "length_diff_ratio": length_diff_ratio
        } 