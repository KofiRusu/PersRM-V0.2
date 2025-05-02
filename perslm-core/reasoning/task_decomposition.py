"""
Task Decomposition Module

This module implements task decomposition to break complex tasks into manageable steps.
"""

import logging
import re
from typing import Dict, List, Optional, Any, Callable, Union

from src.reasoning.reasoner import ReasoningTrace

logger = logging.getLogger(__name__)

class TaskDecomposer:
    """Task decomposer for breaking complex tasks into manageable steps."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the task decomposer.
        
        Args:
            config: Configuration for the decomposer
        """
        self.config = config or {}
        
        self.decomposition_prompt_template = self.config.get(
            "decomposition_prompt_template",
            (
                "I need to break down the following task into smaller, manageable subtasks. "
                "For each subtask, I should provide a clear description and any relevant details."
            )
        )
        
        self.execute_subtask_template = self.config.get(
            "execute_subtask_template",
            "Now I'll focus on completing subtask #{subtask_num}: {subtask_description}"
        )
        
        self.summarize_template = self.config.get(
            "summarize_template",
            (
                "I've completed all the subtasks. Here's a summary of what I've done and the overall solution."
            )
        )
        
        self.max_subtasks = self.config.get("max_subtasks", 5)
        self.execute_subtasks = self.config.get("execute_subtasks", True)
    
    def _get_decomposition_prompt(self, query: str, context: Optional[str] = None) -> str:
        """Generate a task decomposition prompt for the given query."""
        prompt = f"{self.decomposition_prompt_template}\n\nTask: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += "Task Decomposition:\n"
        return prompt
    
    def _extract_subtasks(self, decomposition_text: str) -> List[Dict[str, str]]:
        """Extract subtasks from the decomposition text."""
        subtasks = []
        
        # Try to find numbered lists like "1. Do something" or "Step 1: Do something"
        numbered_pattern = re.compile(r'(?:^|\n)(?:Step\s*)?(\d+)[\.:\)]\s*(.+?)(?=(?:\n(?:Step\s*)?(?:\d+)[\.:\)])|$)', re.DOTALL)
        matches = numbered_pattern.findall(decomposition_text)
        
        if matches:
            for num, description in matches:
                subtasks.append({
                    "id": int(num),
                    "description": description.strip()
                })
            return subtasks
        
        # If no numbered list found, try to find sections separated by double newlines
        paragraphs = [p.strip() for p in decomposition_text.split("\n\n") if p.strip()]
        
        # Filter out paragraphs that seem to be introductory or concluding text
        task_paragraphs = [
            p for p in paragraphs 
            if not any(kw in p.lower() for kw in [
                "first,", "let me", "i'll", "i will", "finally,", "in conclusion", "to summarize"
            ])
        ]
        
        if task_paragraphs:
            for i, description in enumerate(task_paragraphs):
                subtasks.append({
                    "id": i + 1,
                    "description": description
                })
            return subtasks
        
        # If all else fails, just split by newlines and hope for the best
        lines = [line.strip() for line in decomposition_text.split("\n") if line.strip()]
        for i, description in enumerate(lines):
            if len(description) > 10:  # Only consider substantial lines
                subtasks.append({
                    "id": i + 1,
                    "description": description
                })
        
        return subtasks
    
    def _get_execute_subtask_prompt(self, query: str, subtask: Dict[str, Any], context: Optional[str] = None) -> str:
        """Generate a prompt to execute a subtask."""
        prompt = f"Task: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += self.execute_subtask_template.format(
            subtask_num=subtask["id"],
            subtask_description=subtask["description"]
        )
        
        prompt += "\n\nSubtask Solution:\n"
        return prompt
    
    def _get_summarize_prompt(self, query: str, subtasks: List[Dict[str, Any]], subtask_results: List[str], context: Optional[str] = None) -> str:
        """Generate a prompt to summarize the results of all subtasks."""
        prompt = f"Task: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += "Completed Subtasks:\n\n"
        for i, (subtask, result) in enumerate(zip(subtasks, subtask_results)):
            prompt += f"Subtask {subtask['id']}: {subtask['description']}\n"
            prompt += f"Result: {result[:100]}{'...' if len(result) > 100 else ''}\n\n"
        
        prompt += f"{self.summarize_template}\n\nOverall Solution:\n"
        return prompt
    
    def reason(
        self,
        query: str,
        context: Optional[str] = None,
        trace: ReasoningTrace = None,
        model_provider: Callable = None,
        max_iterations: int = 5
    ) -> Dict[str, Any]:
        """Perform task decomposition on the given query.
        
        Args:
            query: The query to reason about
            context: Additional context to consider
            trace: Reasoning trace to append to
            model_provider: Function that generates text from the model
            max_iterations: Maximum number of subtasks to execute
            
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
        
        # Step 1: Generate task decomposition
        decomposition_prompt = self._get_decomposition_prompt(query, context)
        trace.add_step(decomposition_prompt, step_type="prompt")
        
        logger.info("Generating task decomposition")
        decomposition = model_provider(decomposition_prompt)
        trace.add_step(decomposition, step_type="decomposition")
        
        # Step 2: Extract subtasks
        subtasks = self._extract_subtasks(decomposition)
        if not subtasks:
            error_msg = "No subtasks extracted from decomposition"
            logger.error(error_msg)
            trace.add_step(error_msg, step_type="error")
            return {
                "decomposition": decomposition,
                "subtasks": [],
                "error": error_msg
            }
        
        logger.info(f"Extracted {len(subtasks)} subtasks")
        trace.add_step(
            "Extracted subtasks:\n" + "\n".join([f"{task['id']}. {task['description']}" for task in subtasks]),
            step_type="subtasks"
        )
        
        # Limit number of subtasks
        subtasks = subtasks[:min(len(subtasks), self.max_subtasks, max_iterations)]
        
        # Step 3: Execute subtasks if configured
        subtask_results = []
        if self.execute_subtasks:
            for subtask in subtasks:
                execute_prompt = self._get_execute_subtask_prompt(query, subtask, context)
                trace.add_step(execute_prompt, step_type="prompt")
                
                logger.info(f"Executing subtask {subtask['id']}")
                subtask_result = model_provider(execute_prompt)
                trace.add_step(subtask_result, step_type="subtask_result")
                subtask_results.append(subtask_result)
        
        # Step 4: Summarize results if subtasks were executed
        if self.execute_subtasks and subtask_results:
            summarize_prompt = self._get_summarize_prompt(query, subtasks, subtask_results, context)
            trace.add_step(summarize_prompt, step_type="prompt")
            
            logger.info("Generating summary")
            summary = model_provider(summarize_prompt)
            trace.add_step(summary, step_type="summary")
            
            return {
                "decomposition": decomposition,
                "subtasks": subtasks,
                "subtask_results": subtask_results,
                "summary": summary,
                "answer": summary
            }
        else:
            # If not executing subtasks, just return the decomposition
            return {
                "decomposition": decomposition,
                "subtasks": subtasks,
                "answer": decomposition
            }
    
    def evaluate(self, trace: ReasoningTrace) -> Dict[str, Any]:
        """Evaluate the quality of the task decomposition.
        
        Args:
            trace: The reasoning trace to evaluate
            
        Returns:
            Dictionary containing evaluation metrics
        """
        # Extract key components from trace
        decomposition_steps = [step for step in trace.steps if step["type"] == "decomposition"]
        subtasks_steps = [step for step in trace.steps if step["type"] == "subtasks"]
        
        if not decomposition_steps:
            return {"quality": 0, "message": "No decomposition found in trace"}
        
        decomposition = decomposition_steps[0]["content"]
        
        # Get extracted subtasks if available
        num_subtasks = 0
        if subtasks_steps:
            subtasks_text = subtasks_steps[0]["content"]
            num_subtasks = len([line for line in subtasks_text.split("\n") if line.strip()])
        else:
            # Try to extract subtasks from decomposition
            subtasks = self._extract_subtasks(decomposition)
            num_subtasks = len(subtasks)
        
        # Check for specific keywords indicating good decomposition
        has_sequence_indicators = any(kw in decomposition.lower() for kw in 
                                    ["first", "next", "then", "finally", "lastly", "step"])
        
        has_dependency_indicators = any(kw in decomposition.lower() for kw in 
                                       ["after", "before", "once", "prerequisite", "depends", "following"])
        
        # Evaluate quality based on heuristics
        if num_subtasks >= 3 and has_sequence_indicators and has_dependency_indicators:
            quality = 0.9
            message = "Excellent decomposition with clear sequence and dependencies"
        elif num_subtasks >= 3 and (has_sequence_indicators or has_dependency_indicators):
            quality = 0.7
            message = "Good decomposition with multiple subtasks and some structure"
        elif num_subtasks >= 2:
            quality = 0.5
            message = "Basic decomposition with few subtasks"
        else:
            quality = 0.2
            message = "Minimal decomposition with limited structure"
        
        return {
            "quality": quality,
            "message": message,
            "num_subtasks": num_subtasks,
            "has_sequence_indicators": has_sequence_indicators,
            "has_dependency_indicators": has_dependency_indicators
        } 