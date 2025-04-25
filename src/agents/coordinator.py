"""
Agent Coordinator

This module implements the Coordinator for the multi-agent system, which
manages task routing, agent selection, and collaboration between agents.
"""

import logging
import time
import queue
from typing import Dict, List, Optional, Any, Set, Tuple, Callable, Union
from collections import defaultdict

from src.agents.base import Agent, AgentTask, AgentResult
from src.memory import MemoryManager

logger = logging.getLogger(__name__)

class TaskRouter:
    """Routes tasks to appropriate agents based on task type and agent capabilities."""
    
    def __init__(self, agents: Dict[str, Agent]):
        """Initialize the task router.
        
        Args:
            agents: Dictionary of agent_id to Agent instances
        """
        self.agents = agents
        self.task_type_map = defaultdict(list)
        self.capability_map = defaultdict(list)
        
        # Build routing maps
        self._rebuild_maps()
    
    def _rebuild_maps(self):
        """Rebuild the routing maps."""
        self.task_type_map.clear()
        self.capability_map.clear()
        
        for agent_id, agent in self.agents.items():
            # Map task types to agents
            for task_type in agent.task_types:
                self.task_type_map[task_type].append(agent_id)
            
            # Map capabilities to agents
            for capability in agent.capabilities:
                self.capability_map[capability].append(agent_id)
    
    def add_agent(self, agent: Agent) -> None:
        """Add an agent to the router.
        
        Args:
            agent: Agent to add
        """
        self.agents[agent.agent_id] = agent
        self._rebuild_maps()
    
    def remove_agent(self, agent_id: str) -> None:
        """Remove an agent from the router.
        
        Args:
            agent_id: ID of the agent to remove
        """
        if agent_id in self.agents:
            del self.agents[agent_id]
            self._rebuild_maps()
    
    def find_agents_for_task(self, task: AgentTask) -> List[str]:
        """Find agents that can handle a specific task.
        
        Args:
            task: Task to route
            
        Returns:
            List of agent IDs that can handle the task
        """
        candidates = set()
        
        # First, check task type
        if task.type in self.task_type_map:
            candidates.update(self.task_type_map[task.type])
        
        # If general type is accepted, add those agents too
        if task.type != "general" and "general" in self.task_type_map:
            candidates.update(self.task_type_map["general"])
        
        # Check for specific capabilities in metadata
        required_capabilities = task.metadata.get("required_capabilities", [])
        if required_capabilities:
            capable_agents = set()
            for capability in required_capabilities:
                if capability in self.capability_map:
                    capable_agents.update(self.capability_map[capability])
            
            # If we have capability requirements, intersect with candidates
            if capable_agents:
                candidates &= capable_agents
        
        # Filter to agents that actually can handle the task
        result = []
        for agent_id in candidates:
            if self.agents[agent_id].can_handle_task(task):
                result.append(agent_id)
        
        return result
    
    def get_best_agent_for_task(self, task: AgentTask) -> Optional[str]:
        """Get the best agent for a specific task.
        
        Args:
            task: Task to route
            
        Returns:
            Agent ID of the best agent, or None if no suitable agent is found
        """
        candidates = self.find_agents_for_task(task)
        
        if not candidates:
            return None
        
        # If only one candidate, return it
        if len(candidates) == 1:
            return candidates[0]
        
        # TODO: Implement more sophisticated agent selection
        # For now, just return the first candidate
        return candidates[0]


class Coordinator:
    """Coordinates tasks between multiple agents."""
    
    def __init__(
        self,
        memory_manager: Optional[MemoryManager] = None,
        model_provider: Optional[Callable] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the coordinator.
        
        Args:
            memory_manager: Memory manager for storing coordination context
            model_provider: Function to generate text from the model
            config: Configuration for the coordinator
        """
        self.memory_manager = memory_manager
        self.model_provider = model_provider
        self.config = config or {}
        
        # Initialize agents
        self.agents: Dict[str, Agent] = {}
        
        # Initialize task router
        self.router = TaskRouter(self.agents)
        
        # Initialize task queue and history
        self.task_queue = queue.PriorityQueue()
        self.task_history: Dict[str, AgentTask] = {}
        self.result_history: Dict[str, AgentResult] = {}
        
        # Execution statistics
        self.stats = {
            "tasks_received": 0,
            "tasks_completed": 0,
            "tasks_failed": 0
        }
    
    def register_agent(self, agent: Agent) -> None:
        """Register an agent with the coordinator.
        
        Args:
            agent: Agent to register
        """
        self.agents[agent.agent_id] = agent
        self.router.add_agent(agent)
        logger.info(f"Registered agent: {agent.name} ({agent.agent_id})")
    
    def unregister_agent(self, agent_id: str) -> None:
        """Unregister an agent from the coordinator.
        
        Args:
            agent_id: ID of the agent to unregister
        """
        if agent_id in self.agents:
            agent = self.agents[agent_id]
            del self.agents[agent_id]
            self.router.remove_agent(agent_id)
            logger.info(f"Unregistered agent: {agent.name} ({agent_id})")
    
    def submit_task(self, task: AgentTask) -> str:
        """Submit a task to the coordinator.
        
        Args:
            task: Task to submit
            
        Returns:
            Task ID
        """
        # Store task in history
        self.task_history[task.id] = task
        
        # Add to queue with priority
        self.task_queue.put((-task.priority, task.created_at, task))
        
        # Update statistics
        self.stats["tasks_received"] += 1
        
        # Store in memory if available
        if self.memory_manager:
            content = f"Task submitted: {task.id}\nQuery: {task.query}\nType: {task.type}"
            self.memory_manager.add(content, long_term=False, metadata={
                "type": "task_submission",
                "task_id": task.id,
                "task_type": task.type
            })
        
        logger.info(f"Task submitted: {task.id} (type: {task.type}, priority: {task.priority})")
        return task.id
    
    def execute_task(self, task_id: str) -> Optional[AgentResult]:
        """Execute a specific task.
        
        Args:
            task_id: ID of the task to execute
            
        Returns:
            Result of the task execution, or None if the task was not found
        """
        if task_id not in self.task_history:
            logger.warning(f"Task not found: {task_id}")
            return None
        
        task = self.task_history[task_id]
        return self._execute_task(task)
    
    def _execute_task(self, task: AgentTask) -> AgentResult:
        """Execute a task using the appropriate agent.
        
        Args:
            task: Task to execute
            
        Returns:
            Result of the task execution
        """
        # Find the best agent for the task
        agent_id = self.router.get_best_agent_for_task(task)
        
        if not agent_id:
            # No suitable agent found
            result = AgentResult(
                task_id=task.id,
                agent_id="coordinator",
                success=False,
                result=None,
                error=f"No suitable agent found for task type {task.type}"
            )
            self.result_history[task.id] = result
            self.stats["tasks_failed"] += 1
            return result
        
        # Execute task with selected agent
        agent = self.agents[agent_id]
        logger.info(f"Executing task {task.id} with agent {agent.name}")
        
        # Run the task
        result = agent.run(task)
        
        # Store result
        self.result_history[task.id] = result
        
        # Update statistics
        if result.success:
            self.stats["tasks_completed"] += 1
        else:
            self.stats["tasks_failed"] += 1
        
        # Process subtasks if needed
        if task.subtasks:
            subtask_results = []
            for subtask in task.subtasks:
                subtask_result = self._execute_task(subtask)
                subtask_results.append(subtask_result)
            
            # Add subtask results
            result.subtask_results = subtask_results
        
        return result
    
    def process_next_task(self) -> Optional[AgentResult]:
        """Process the next task in the queue.
        
        Returns:
            Result of the task execution, or None if the queue is empty
        """
        if self.task_queue.empty():
            return None
        
        # Get the next task
        _, _, task = self.task_queue.get()
        
        # Execute the task
        result = self._execute_task(task)
        
        # Mark task as done
        self.task_queue.task_done()
        
        return result
    
    def process_all_tasks(self) -> List[AgentResult]:
        """Process all tasks in the queue.
        
        Returns:
            List of results from task executions
        """
        results = []
        
        while not self.task_queue.empty():
            result = self.process_next_task()
            if result:
                results.append(result)
        
        return results
    
    def get_result(self, task_id: str) -> Optional[AgentResult]:
        """Get the result of a task.
        
        Args:
            task_id: ID of the task
            
        Returns:
            Result of the task, or None if not found
        """
        return self.result_history.get(task_id)
    
    def decompose_task(self, task: AgentTask) -> AgentTask:
        """Decompose a complex task into subtasks.
        
        Args:
            task: Task to decompose
            
        Returns:
            Task with subtasks added
        """
        # If we have a planning agent, use it to decompose the task
        planning_agents = self.router.find_agents_for_task(AgentTask(type="planning"))
        
        if planning_agents and self.model_provider:
            # Create a planning task
            planning_task = AgentTask(
                query=f"Decompose the following task into subtasks: {task.query}",
                type="planning",
                context=task.context,
                metadata={"parent_task_id": task.id}
            )
            
            # Execute the planning task
            planning_agent = self.agents[planning_agents[0]]
            planning_result = planning_agent.run(planning_task)
            
            if planning_result.success:
                # Parse the result to extract subtasks
                subtasks_data = planning_result.result.get("subtasks", [])
                
                for subtask_data in subtasks_data:
                    subtask = AgentTask(
                        query=subtask_data.get("description", ""),
                        type=subtask_data.get("type", "general"),
                        parent_id=task.id,
                        context=task.context,
                        metadata={"decomposed": True}
                    )
                    task.subtasks.append(subtask)
        
        # If no planning agent or decomposition failed, return the original task
        return task
    
    def execute_complex_task(self, query: str, task_type: str = "general", context: Optional[str] = None) -> AgentResult:
        """Execute a complex task by decomposing it and running subtasks.
        
        Args:
            query: Task query/description
            task_type: Type of the task
            context: Additional context for the task
            
        Returns:
            Result of the complex task execution
        """
        # Create main task
        main_task = AgentTask(
            query=query,
            type=task_type,
            context=context,
            metadata={"complex": True}
        )
        
        # Decompose the task
        main_task = self.decompose_task(main_task)
        
        # Submit the task
        self.submit_task(main_task)
        
        # Execute the task
        result = self.execute_task(main_task.id)
        
        return result if result else AgentResult(
            task_id=main_task.id,
            agent_id="coordinator",
            success=False,
            result=None,
            error="Failed to execute task"
        ) 