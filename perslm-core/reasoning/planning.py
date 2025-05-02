"""
Planning Module

This module implements planning capabilities to create and execute plans
for solving complex problems.
"""

import logging
import re
from typing import Dict, List, Optional, Any, Callable, Union

from src.reasoning.reasoner import ReasoningTrace

logger = logging.getLogger(__name__)

class Planner:
    """Planner for creating and executing strategic plans."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the planner.
        
        Args:
            config: Configuration for the planner
        """
        self.config = config or {}
        
        self.planning_prompt_template = self.config.get(
            "planning_prompt_template",
            (
                "I need to develop a plan to address the following problem. "
                "I should outline the key steps, consider potential challenges, "
                "and identify the resources or information needed."
            )
        )
        
        self.execution_prompt_template = self.config.get(
            "execution_prompt_template",
            (
                "Now I'll execute my plan step-by-step. "
                "For each step, I'll describe what I'm doing and adjust as needed."
            )
        )
        
        self.evaluation_prompt_template = self.config.get(
            "evaluation_prompt_template",
            (
                "I'll now evaluate my plan and its execution. "
                "Did I achieve the goal? What worked well? What could be improved?"
            )
        )
        
        self.max_steps = self.config.get("max_steps", 5)
        self.execute_plan = self.config.get("execute_plan", True)
    
    def _get_planning_prompt(self, query: str, context: Optional[str] = None) -> str:
        """Generate a planning prompt for the given query."""
        prompt = f"{self.planning_prompt_template}\n\nProblem: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += "Strategic Plan:\n"
        return prompt
    
    def _parse_plan(self, plan_text: str) -> List[Dict[str, str]]:
        """Parse the plan text into structured steps."""
        steps = []
        
        # Try to find numbered steps (e.g., "1. Do this" or "Step 1: Do this")
        step_pattern = re.compile(r'(?:^|\n)(?:Step\s*)?(\d+)[\.:\)]\s*(.+?)(?=(?:\n(?:Step\s*)?(?:\d+)[\.:\)])|$)', re.DOTALL)
        matches = step_pattern.findall(plan_text)
        
        if matches:
            for num, description in matches:
                steps.append({
                    "id": int(num),
                    "description": description.strip()
                })
            return steps
        
        # If no numbered steps, look for sections with headings
        sections = re.split(r'\n(?=[A-Z][a-zA-Z\s]+:)', plan_text)
        if len(sections) > 1:
            for i, section in enumerate(sections):
                if ":" in section:
                    heading, content = section.split(":", 1)
                    steps.append({
                        "id": i + 1,
                        "heading": heading.strip(),
                        "description": content.strip()
                    })
                else:
                    steps.append({
                        "id": i + 1,
                        "description": section.strip()
                    })
            return steps
        
        # If all else fails, split by paragraphs
        paragraphs = [p.strip() for p in plan_text.split("\n\n") if p.strip()]
        
        # Filter out paragraphs that seem to be introductory or concluding text
        # (similar to TaskDecomposer)
        plan_paragraphs = [
            p for p in paragraphs 
            if not any(kw in p.lower()[:30] for kw in [
                "here's a plan", "to solve this", "the plan", "i will", "in conclusion", "to summarize"
            ])
        ]
        
        if plan_paragraphs:
            for i, description in enumerate(plan_paragraphs):
                steps.append({
                    "id": i + 1,
                    "description": description
                })
            return steps
        
        # If we still couldn't parse steps, use the whole text as a single step
        steps.append({
            "id": 1,
            "description": plan_text.strip()
        })
        
        return steps
    
    def _get_execution_prompt(self, query: str, plan_steps: List[Dict[str, str]], context: Optional[str] = None) -> str:
        """Generate a prompt to execute the plan."""
        prompt = f"Problem: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += "My Strategic Plan:\n"
        for step in plan_steps:
            if "heading" in step:
                prompt += f"{step['id']}. {step['heading']}: {step['description']}\n"
            else:
                prompt += f"{step['id']}. {step['description']}\n"
        
        prompt += f"\n{self.execution_prompt_template}\n\nPlan Execution:\n"
        return prompt
    
    def _get_evaluation_prompt(self, query: str, plan_steps: List[Dict[str, str]], execution_text: str, context: Optional[str] = None) -> str:
        """Generate a prompt to evaluate the plan execution."""
        prompt = f"Problem: {query}\n\n"
        
        if context:
            prompt += f"Context: {context}\n\n"
        
        prompt += "My Strategic Plan:\n"
        for step in plan_steps:
            if "heading" in step:
                prompt += f"{step['id']}. {step['heading']}: {step['description']}\n"
            else:
                prompt += f"{step['id']}. {step['description']}\n"
        
        prompt += f"\nPlan Execution Summary:\n{execution_text[:300]}...\n\n"
        prompt += f"{self.evaluation_prompt_template}\n\nEvaluation:\n"
        return prompt
    
    def reason(
        self,
        query: str,
        context: Optional[str] = None,
        trace: ReasoningTrace = None,
        model_provider: Callable = None,
        max_iterations: int = 3
    ) -> Dict[str, Any]:
        """Create and execute a plan for the given query.
        
        Args:
            query: The query to plan for
            context: Additional context to consider
            trace: Reasoning trace to append to
            model_provider: Function that generates text from the model
            max_iterations: Maximum number of planning steps to execute
            
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
        
        # Step 1: Generate the plan
        planning_prompt = self._get_planning_prompt(query, context)
        trace.add_step(planning_prompt, step_type="prompt")
        
        logger.info("Generating plan")
        plan_text = model_provider(planning_prompt)
        trace.add_step(plan_text, step_type="plan")
        
        # Step 2: Parse the plan into steps
        plan_steps = self._parse_plan(plan_text)
        if not plan_steps:
            error_msg = "Failed to parse plan steps"
            logger.error(error_msg)
            trace.add_step(error_msg, step_type="error")
            return {
                "plan": plan_text,
                "error": error_msg
            }
        
        plan_steps_text = "\n".join([f"{step['id']}. {step.get('heading', '')} {step['description']}" for step in plan_steps])
        trace.add_step(plan_steps_text, step_type="plan_steps")
        
        # Step 3: Execute the plan if configured
        if self.execute_plan:
            execution_prompt = self._get_execution_prompt(query, plan_steps, context)
            trace.add_step(execution_prompt, step_type="prompt")
            
            logger.info("Executing plan")
            execution_text = model_provider(execution_prompt)
            trace.add_step(execution_text, step_type="execution")
            
            # Step 4: Evaluate the plan execution
            evaluation_prompt = self._get_evaluation_prompt(query, plan_steps, execution_text, context)
            trace.add_step(evaluation_prompt, step_type="prompt")
            
            logger.info("Evaluating plan execution")
            evaluation_text = model_provider(evaluation_prompt)
            trace.add_step(evaluation_text, step_type="evaluation")
            
            return {
                "plan": plan_text,
                "plan_steps": plan_steps,
                "execution": execution_text,
                "evaluation": evaluation_text,
                "answer": evaluation_text
            }
        else:
            # If not executing the plan, return just the plan
            return {
                "plan": plan_text,
                "plan_steps": plan_steps,
                "answer": plan_text
            }
    
    def evaluate(self, trace: ReasoningTrace) -> Dict[str, Any]:
        """Evaluate the quality of the planning and execution.
        
        Args:
            trace: The reasoning trace to evaluate
            
        Returns:
            Dictionary containing evaluation metrics
        """
        # Extract key components from trace
        plan_steps = [step for step in trace.steps if step["type"] == "plan_steps"]
        execution_steps = [step for step in trace.steps if step["type"] == "execution"]
        evaluation_steps = [step for step in trace.steps if step["type"] == "evaluation"]
        
        if not plan_steps:
            return {"quality": 0, "message": "No plan steps found in trace"}
        
        plan_steps_text = plan_steps[0]["content"]
        num_steps = len([line for line in plan_steps_text.split("\n") if line.strip()])
        
        # Evaluate the plan based on the number of steps
        if num_steps >= 4:
            plan_quality = 0.8
            plan_message = "Comprehensive plan with multiple steps"
        elif num_steps >= 2:
            plan_quality = 0.5
            plan_message = "Basic plan with a few steps"
        else:
            plan_quality = 0.2
            plan_message = "Minimal plan with limited detail"
        
        # If execution was performed, evaluate it too
        execution_quality = 0.0
        execution_message = "No execution found"
        
        if execution_steps:
            execution_text = execution_steps[0]["content"]
            
            # Check if execution addresses each step
            steps_addressed = True
            for i in range(1, num_steps + 1):
                if not re.search(rf"(?:step|{i}).*?:", execution_text, re.IGNORECASE):
                    steps_addressed = False
                    break
            
            if steps_addressed and len(execution_text) > 500:
                execution_quality = 0.8
                execution_message = "Thorough execution addressing all plan steps"
            elif steps_addressed:
                execution_quality = 0.6
                execution_message = "Execution addresses all plan steps"
            else:
                execution_quality = 0.3
                execution_message = "Execution does not clearly address all plan steps"
        
        # If evaluation was performed, include it
        evaluation_quality = 0.0
        evaluation_message = "No evaluation found"
        
        if evaluation_steps:
            evaluation_text = evaluation_steps[0]["content"]
            
            has_success_assessment = any(kw in evaluation_text.lower() for kw in 
                                        ["success", "achieve", "accomplish", "complete", "goal"])
            
            has_improvement_ideas = any(kw in evaluation_text.lower() for kw in 
                                       ["improve", "better", "enhance", "modify", "adjust", "next time"])
            
            if has_success_assessment and has_improvement_ideas:
                evaluation_quality = 0.9
                evaluation_message = "Comprehensive evaluation with success assessment and improvement ideas"
            elif has_success_assessment:
                evaluation_quality = 0.6
                evaluation_message = "Basic evaluation with success assessment"
            elif has_improvement_ideas:
                evaluation_quality = 0.5
                evaluation_message = "Basic evaluation with improvement ideas"
            else:
                evaluation_quality = 0.3
                evaluation_message = "Minimal evaluation without clear assessment"
        
        # Calculate overall quality as a weighted average
        weights = {"plan": 0.4, "execution": 0.3, "evaluation": 0.3}
        overall_quality = (
            plan_quality * weights["plan"] +
            execution_quality * weights["execution"] +
            evaluation_quality * weights["evaluation"]
        )
        
        return {
            "quality": overall_quality,
            "plan_quality": plan_quality,
            "plan_message": plan_message,
            "execution_quality": execution_quality,
            "execution_message": execution_message,
            "evaluation_quality": evaluation_quality,
            "evaluation_message": evaluation_message,
            "num_steps": num_steps
        } 