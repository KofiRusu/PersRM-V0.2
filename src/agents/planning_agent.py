"""
Planning Agent

This module implements the Planning Agent, which specializes in task decomposition,
strategic planning, and sequencing multi-step tasks.
"""

import logging
import json
import re
from typing import Dict, List, Optional, Any, Callable, Tuple

from src.agents.base import Agent, AgentTask, AgentResult
from src.reasoning import ReasoningManager, ReasoningMode
from src.memory import MemoryManager

logger = logging.getLogger(__name__)

class PlanningAgent(Agent):
    """Agent specializing in planning and task decomposition."""
    
    def __init__(
        self,
        agent_id: str,
        model_provider: Callable,
        reasoning_manager: Optional[ReasoningManager] = None,
        memory_manager: Optional[MemoryManager] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the planning agent.
        
        Args:
            agent_id: Unique identifier for the agent
            model_provider: Function to generate text from the model
            reasoning_manager: Reasoning manager for structured planning
            memory_manager: Memory manager for storing plans
            config: Configuration for the agent
        """
        super().__init__(
            agent_id=agent_id,
            name="Planning Agent",
            description="Specializes in task decomposition and strategic planning",
            model_provider=model_provider,
            memory_manager=memory_manager,
            config=config
        )
        
        self.reasoning_manager = reasoning_manager
        
        # Default configurations
        self.max_subtasks = config.get("max_subtasks", 10)
        self.adaptive_planning = config.get("adaptive_planning", True)
        self.preferred_reasoning_mode = ReasoningMode.PLANNING
    
    @property
    def task_types(self) -> List[str]:
        """Get the task types this agent can handle."""
        return ["planning", "decomposition", "strategy", "organization"]
    
    @property
    def capabilities(self) -> List[str]:
        """Get the capabilities of this agent."""
        return [
            "task-decomposition", 
            "strategic-planning", 
            "workflow-design", 
            "resource-allocation",
            "subtask-creation"
        ]
    
    def execute(self, task: AgentTask) -> AgentResult:
        """Execute a planning task.
        
        Args:
            task: Planning task to execute
            
        Returns:
            Result of the planning
        """
        logger.info(f"Executing planning task: {task.query}")
        
        # Determine the planning approach
        if self.reasoning_manager:
            # Use reasoning manager for structured planning
            planning_result = self._plan_with_reasoning_manager(task)
        else:
            # Use direct model calls for planning
            planning_result = self._plan_with_direct_model(task)
        
        # Extract and structure the plan
        structured_plan = self._structure_plan(planning_result)
        
        # Create subtasks based on the plan
        subtasks = self._create_subtasks(task, structured_plan)
        
        # Save plan to memory if available
        if self.memory_manager:
            plan_content = self._format_plan_for_memory(structured_plan)
            self.memory_manager.add(plan_content, long_term=True, metadata={
                "type": "plan",
                "task_id": task.id,
                "agent_id": self.agent_id,
                "subtask_count": len(subtasks)
            })
        
        # Create result
        result = {
            "plan": structured_plan,
            "subtasks": [subtask.to_dict() for subtask in subtasks]
        }
        
        return AgentResult(
            task_id=task.id,
            agent_id=self.agent_id,
            success=True,
            result=result
        )
    
    def _plan_with_reasoning_manager(self, task: AgentTask) -> Dict[str, Any]:
        """Generate a plan using the reasoning manager.
        
        Args:
            task: Planning task
            
        Returns:
            Planning result
        """
        # Select appropriate reasoning mode based on task
        reasoning_mode = self._select_reasoning_mode(task)
        
        # Run reasoning process
        reasoning_result = self.reasoning_manager.reason(
            query=task.query,
            context=task.context,
            mode=reasoning_mode
        )
        
        # Check if reasoning was successful
        if not reasoning_result.get("success", False):
            logger.warning(f"Reasoning failed for task {task.id}")
            # Fallback to direct model
            return self._plan_with_direct_model(task)
        
        return reasoning_result.get("result", {})
    
    def _select_reasoning_mode(self, task: AgentTask) -> ReasoningMode:
        """Select the appropriate reasoning mode for the task.
        
        Args:
            task: Planning task
            
        Returns:
            Selected reasoning mode
        """
        query_lower = task.query.lower()
        
        # Check for specific keywords to determine the best reasoning mode
        if any(kw in query_lower for kw in ["decompose", "break down", "subtasks"]):
            return ReasoningMode.TASK_DECOMPOSITION
        elif any(kw in query_lower for kw in ["steps", "process", "procedure"]):
            return ReasoningMode.PLANNING
        
        # Default to preferred mode
        return self.preferred_reasoning_mode
    
    def _plan_with_direct_model(self, task: AgentTask) -> Dict[str, Any]:
        """Generate a plan using direct model calls.
        
        Args:
            task: Planning task
            
        Returns:
            Planning result
        """
        # Create planning prompt
        prompt = f"""
Task: {task.query}

Create a detailed plan for this task. Your plan should include:
1. A clear breakdown of the task into subtasks
2. For each subtask, specify:
   - A descriptive name
   - The type of task (research, writing, coding, design, etc.)
   - Any dependencies on other subtasks
   - Estimated complexity (low, medium, high)
3. A logical sequence for task execution
4. Any additional considerations or resources needed

Format your plan in a clear structure with numbered steps.
"""
        
        if task.context:
            prompt += f"\nContext: {task.context}\n"
        
        # Generate plan
        plan_text = self.model_provider(prompt)
        
        # Extract structured data from the plan
        return {
            "plan": plan_text,
            "task_decomposition": True
        }
    
    def _structure_plan(self, planning_result: Dict[str, Any]) -> Dict[str, Any]:
        """Convert planning result to a structured plan.
        
        Args:
            planning_result: Result from planning
            
        Returns:
            Structured plan
        """
        # Check if we already have a structured plan
        if "plan_steps" in planning_result:
            # Already structured by reasoning manager
            return {
                "steps": planning_result.get("plan_steps", []),
                "raw_plan": planning_result.get("plan", "")
            }
        
        # Extract plan from result
        plan_text = planning_result.get("plan", "")
        
        # Parse the plan into structured steps
        steps = self._parse_plan_steps(plan_text)
        
        return {
            "steps": steps,
            "raw_plan": plan_text
        }
    
    def _parse_plan_steps(self, plan_text: str) -> List[Dict[str, Any]]:
        """Parse plan text into structured steps.
        
        Args:
            plan_text: Raw plan text
            
        Returns:
            List of structured steps
        """
        steps = []
        
        # Look for numbered steps (e.g., "1. Do this" or "Step 1: Do this")
        step_pattern = re.compile(r'(?:^|\n)(?:Step\s*)?(\d+)[\.:\)]\s*(.+?)(?=(?:\n(?:Step\s*)?(?:\d+)[\.:\)])|$)', re.DOTALL)
        matches = step_pattern.findall(plan_text)
        
        if matches:
            for num, content in matches:
                step_id = int(num)
                
                # Try to extract task type from content
                task_type = self._extract_task_type(content)
                
                # Try to extract dependencies
                dependencies = self._extract_dependencies(content)
                
                # Extract complexity
                complexity = self._extract_complexity(content)
                
                steps.append({
                    "id": step_id,
                    "description": content.strip(),
                    "type": task_type,
                    "dependencies": dependencies,
                    "complexity": complexity
                })
        else:
            # Fall back to paragraph-based splitting
            paragraphs = [p.strip() for p in plan_text.split("\n\n") if p.strip()]
            
            for i, paragraph in enumerate(paragraphs):
                # Skip if it seems to be an introduction or conclusion
                if i == 0 and not re.search(r'^\d+[\.\)]', paragraph) and any(kw in paragraph.lower() for kw in ["plan", "approach", "strategy", "summary"]):
                    continue
                
                if i == len(paragraphs) - 1 and any(kw in paragraph.lower() for kw in ["conclusion", "summary", "finally"]):
                    continue
                
                # Try to extract task type from content
                task_type = self._extract_task_type(paragraph)
                
                # Add as a step
                steps.append({
                    "id": i + 1,
                    "description": paragraph,
                    "type": task_type,
                    "dependencies": [],
                    "complexity": "medium"
                })
        
        return steps
    
    def _extract_task_type(self, content: str) -> str:
        """Extract task type from step content.
        
        Args:
            content: Step content
            
        Returns:
            Task type
        """
        content_lower = content.lower()
        
        # Define task type keywords
        type_keywords = {
            "research": ["research", "investigate", "find", "search", "gather information"],
            "code": ["code", "program", "implement", "develop", "script", "function"],
            "writing": ["write", "document", "draft", "create text", "compose"],
            "design": ["design", "sketch", "prototype", "layout", "wireframe"],
            "analysis": ["analyze", "evaluate", "assess", "review"],
            "testing": ["test", "verify", "validate", "check"],
            "deployment": ["deploy", "release", "publish", "launch"],
            "communication": ["communicate", "present", "share", "discuss"]
        }
        
        # Check for type indicators
        for task_type, keywords in type_keywords.items():
            if any(kw in content_lower for kw in keywords):
                return task_type
        
        # Check for explicit type labeling (e.g., "[TYPE: Research]")
        type_match = re.search(r'\[(?:TYPE|Task)[:\s]+([^\]]+)\]', content, re.IGNORECASE)
        if type_match:
            return type_match.group(1).lower()
        
        # Default type
        return "general"
    
    def _extract_dependencies(self, content: str) -> List[int]:
        """Extract step dependencies from content.
        
        Args:
            content: Step content
            
        Returns:
            List of dependency step IDs
        """
        dependencies = []
        
        # Look for dependency markers
        dependency_patterns = [
            r"(?:depends on|after|following|requires) (?:step|task)s?\s+(\d+(?:\s*,\s*\d+)*)",
            r"(?:dependencies|prerequisite)s?:\s*(\d+(?:\s*,\s*\d+)*)"
        ]
        
        for pattern in dependency_patterns:
            matches = re.search(pattern, content, re.IGNORECASE)
            if matches:
                deps_str = matches.group(1)
                for dep in re.findall(r'\d+', deps_str):
                    dependencies.append(int(dep))
        
        return dependencies
    
    def _extract_complexity(self, content: str) -> str:
        """Extract complexity from step content.
        
        Args:
            content: Step content
            
        Returns:
            Complexity level (low, medium, high)
        """
        content_lower = content.lower()
        
        # Look for explicit complexity markers
        complexity_match = re.search(r'(?:complexity|difficulty):\s*(low|medium|high)', content_lower)
        if complexity_match:
            return complexity_match.group(1)
        
        # Estimate based on keywords
        if any(kw in content_lower for kw in ["simple", "easy", "straightforward", "quick"]):
            return "low"
        elif any(kw in content_lower for kw in ["complex", "difficult", "challenging", "time-consuming"]):
            return "high"
        
        # Default complexity
        return "medium"
    
    def _create_subtasks(self, parent_task: AgentTask, structured_plan: Dict[str, Any]) -> List[AgentTask]:
        """Create subtasks based on the structured plan.
        
        Args:
            parent_task: Parent task
            structured_plan: Structured plan
            
        Returns:
            List of subtasks
        """
        subtasks = []
        steps = structured_plan.get("steps", [])
        
        # Limit number of subtasks
        steps = steps[:self.max_subtasks]
        
        for step in steps:
            # Create subtask
            subtask = AgentTask(
                query=step.get("description", ""),
                type=step.get("type", "general"),
                parent_id=parent_task.id,
                context=parent_task.context,
                metadata={
                    "plan_step_id": step.get("id"),
                    "dependencies": step.get("dependencies", []),
                    "complexity": step.get("complexity", "medium")
                }
            )
            
            subtasks.append(subtask)
        
        return subtasks
    
    def _format_plan_for_memory(self, structured_plan: Dict[str, Any]) -> str:
        """Format the plan for storage in memory.
        
        Args:
            structured_plan: Structured plan
            
        Returns:
            Formatted plan text
        """
        steps = structured_plan.get("steps", [])
        if not steps:
            return structured_plan.get("raw_plan", "No plan available")
        
        plan_text = "# Strategic Plan\n\n"
        
        for step in steps:
            plan_text += f"## Step {step.get('id')}: {step.get('type', 'general').title()}\n\n"
            plan_text += f"{step.get('description', '')}\n\n"
            
            if step.get("dependencies"):
                deps_str = ", ".join([f"Step {d}" for d in step.get("dependencies")])
                plan_text += f"Dependencies: {deps_str}\n"
            
            plan_text += f"Complexity: {step.get('complexity', 'medium').title()}\n\n"
        
        return plan_text 