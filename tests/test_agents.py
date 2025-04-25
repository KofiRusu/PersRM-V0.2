"""
Integration tests for the Multi-Agent Coordination system.

This module tests the functionality of the PersLM multi-agent system,
including the coordinator, individual agents, and task routing.
"""

import unittest
import logging
from typing import Dict, List, Any, Optional
from unittest.mock import MagicMock

from src.agents.base import Agent, AgentTask, AgentResult
from src.agents.coordinator import Coordinator, TaskRouter
from src.agents.research_agent import ResearchAgent
from src.agents.code_agent import CodeAgent
from src.agents.planning_agent import PlanningAgent
from src.agents.reasoning_agent import ReasoningAgent
from src.memory import Memory


class MockModelProvider:
    """Mock model provider for testing."""
    
    def __call__(self, prompt: str) -> str:
        """Generate mock response based on the prompt."""
        # Generate simple responses based on prompt content
        if "code" in prompt.lower():
            return "def example_function():\n    return 'Hello World!'"
            
        if "research" in prompt.lower():
            return "Research findings: This is a sample research result."
            
        if "plan" in prompt.lower():
            return "1. First step\n2. Second step\n3. Third step"
            
        if "reason" in prompt.lower() or "analyze" in prompt.lower():
            return "Analysis: The key factors to consider are X, Y, and Z."
            
        return f"Response to: {prompt[:50]}..."


class TestMultiAgentSystem(unittest.TestCase):
    """Test the multi-agent coordination system."""
    
    def setUp(self):
        """Set up test environment."""
        # Create mock model provider
        self.model_provider = MockModelProvider()
        
        # Create memory system
        self.memory = Memory()
        
        # Create coordinator
        self.coordinator = Coordinator(
            memory_manager=self.memory,
            model_provider=self.model_provider
        )
        
        # Create and register agents
        self.research_agent = ResearchAgent(
            agent_id="research_agent",
            model_provider=self.model_provider,
            memory_manager=self.memory
        )
        
        self.code_agent = CodeAgent(
            agent_id="code_agent",
            model_provider=self.model_provider,
            memory_manager=self.memory
        )
        
        self.planning_agent = PlanningAgent(
            agent_id="planning_agent",
            model_provider=self.model_provider,
            memory_manager=self.memory
        )
        
        self.reasoning_agent = ReasoningAgent(
            agent_id="reasoning_agent",
            model_provider=self.model_provider,
            memory_manager=self.memory
        )
        
        # Register agents
        self.coordinator.register_agent(self.research_agent)
        self.coordinator.register_agent(self.code_agent)
        self.coordinator.register_agent(self.planning_agent)
        self.coordinator.register_agent(self.reasoning_agent)
    
    def test_task_routing(self):
        """Test task routing to the appropriate agent."""
        # Create tasks for different agent types
        research_task = AgentTask(
            query="Research the latest developments in quantum computing",
            type="research"
        )
        
        code_task = AgentTask(
            query="Write a Python function to calculate factorial",
            type="code"
        )
        
        planning_task = AgentTask(
            query="Create a project plan for developing a web application",
            type="planning"
        )
        
        reasoning_task = AgentTask(
            query="Analyze the pros and cons of remote work",
            type="reasoning"
        )
        
        # Test routing
        router = self.coordinator.router
        
        # Research task should route to research agent
        research_agents = router.find_agents_for_task(research_task)
        self.assertIn("research_agent", research_agents)
        
        # Code task should route to code agent
        code_agents = router.find_agents_for_task(code_task)
        self.assertIn("code_agent", code_agents)
        
        # Planning task should route to planning agent
        planning_agents = router.find_agents_for_task(planning_task)
        self.assertIn("planning_agent", planning_agents)
        
        # Reasoning task should route to reasoning agent
        reasoning_agents = router.find_agents_for_task(reasoning_task)
        self.assertIn("reasoning_agent", reasoning_agents)
    
    def test_task_execution(self):
        """Test execution of tasks by agents."""
        # Create a research task
        research_task = AgentTask(
            query="Research quantum computing advances",
            type="research"
        )
        
        # Submit task to coordinator
        task_id = self.coordinator.submit_task(research_task)
        
        # Execute task
        result = self.coordinator.execute_task(task_id)
        
        # Check result
        self.assertIsNotNone(result)
        self.assertTrue(result.success)
        self.assertEqual(result.agent_id, "research_agent")
        self.assertIn("research", str(result.result).lower())
        
        # Create a code task
        code_task = AgentTask(
            query="Write a Python function to calculate factorial",
            type="code"
        )
        
        # Submit and execute
        task_id = self.coordinator.submit_task(code_task)
        result = self.coordinator.execute_task(task_id)
        
        # Check result
        self.assertTrue(result.success)
        self.assertEqual(result.agent_id, "code_agent")
        self.assertIn("def", str(result.result).lower())
    
    def test_complex_task(self):
        """Test handling of complex tasks that require decomposition."""
        # Create a complex task
        complex_task = AgentTask(
            query="Analyze the performance implications of this code and suggest optimizations",
            type="analysis",
            metadata={
                "required_capabilities": ["reasoning", "code"]
            }
        )
        
        # Enable task decomposition by adding planning agent
        self.coordinator.task_decomposer = self.planning_agent
        
        # Execute complex task
        result = self.coordinator.execute_complex_task(
            query="Analyze the performance implications of this code and suggest optimizations",
            task_type="analysis"
        )
        
        # Check result
        self.assertIsNotNone(result)
        self.assertTrue(result.success)
        # Complex tasks should have subtask results
        self.assertGreaterEqual(len(result.subtask_results), 1)
    
    def test_agent_capabilities(self):
        """Test agent capability declarations and matching."""
        # Check research agent capabilities
        self.assertIn("research", self.research_agent.capabilities)
        self.assertIn("information-retrieval", self.research_agent.capabilities)
        
        # Check code agent capabilities
        self.assertIn("code-generation", self.code_agent.capabilities)
        self.assertIn("debugging", self.code_agent.capabilities)
        
        # Check planning agent capabilities
        self.assertIn("planning", self.planning_agent.capabilities)
        self.assertIn("task-decomposition", self.planning_agent.capabilities)
        
        # Check reasoning agent capabilities
        self.assertIn("reasoning", self.reasoning_agent.capabilities)
        self.assertIn("analysis", self.reasoning_agent.capabilities)
        
        # Test capability-based routing
        task = AgentTask(
            query="Analyze this code",
            type="general",
            metadata={
                "required_capabilities": ["code-analysis", "debugging"]
            }
        )
        
        agents = self.coordinator.router.find_agents_for_task(task)
        self.assertIn("code_agent", agents)
    
    def test_task_priority(self):
        """Test task prioritization."""
        # Create tasks with different priorities
        high_priority_task = AgentTask(
            query="High priority task",
            type="general",
            priority=10
        )
        
        medium_priority_task = AgentTask(
            query="Medium priority task",
            type="general",
            priority=5
        )
        
        low_priority_task = AgentTask(
            query="Low priority task",
            type="general",
            priority=1
        )
        
        # Submit tasks in reverse priority order
        self.coordinator.submit_task(low_priority_task)
        self.coordinator.submit_task(medium_priority_task)
        self.coordinator.submit_task(high_priority_task)
        
        # Process the next task - should be high priority
        result = self.coordinator.process_next_task()
        self.assertIsNotNone(result)
        self.assertIn("high priority", result.task_id.lower())
        
        # Process the next task - should be medium priority
        result = self.coordinator.process_next_task()
        self.assertIsNotNone(result)
        self.assertIn("medium priority", result.task_id.lower())
        
        # Process the next task - should be low priority
        result = self.coordinator.process_next_task()
        self.assertIsNotNone(result)
        self.assertIn("low priority", result.task_id.lower())
    
    def test_agent_memory_integration(self):
        """Test integration with memory system."""
        # Create a task
        task = AgentTask(
            query="Remember this information: The capital of France is Paris",
            type="general"
        )
        
        # Submit and execute
        task_id = self.coordinator.submit_task(task)
        self.coordinator.execute_task(task_id)
        
        # Check if information was stored in memory
        memories = self.memory.retrieve_relevant("capital of France")
        self.assertGreaterEqual(len(memories), 1)
        found = False
        for memory in memories:
            if "paris" in memory.get("content", "").lower():
                found = True
                break
        
        self.assertTrue(found, "Memory should contain information about Paris")
    
    def test_agent_unregistration(self):
        """Test unregistering agents."""
        # Unregister the research agent
        self.coordinator.unregister_agent("research_agent")
        
        # Create a research task
        research_task = AgentTask(
            query="Research quantum computing",
            type="research"
        )
        
        # Check routing - should not find research agent
        agents = self.coordinator.router.find_agents_for_task(research_task)
        self.assertNotIn("research_agent", agents)
        
        # Submit task - should use a different agent or fail gracefully
        task_id = self.coordinator.submit_task(research_task)
        result = self.coordinator.execute_task(task_id)
        
        # Check result - should either have an alternative agent or error
        if result.success:
            self.assertNotEqual(result.agent_id, "research_agent")
        else:
            self.assertIsNotNone(result.error)


class TestTaskRouter(unittest.TestCase):
    """Test the task router functionality."""
    
    def setUp(self):
        """Set up test environment."""
        # Create mock agents
        self.agents = {
            "agent1": MagicMock(spec=Agent),
            "agent2": MagicMock(spec=Agent),
            "agent3": MagicMock(spec=Agent)
        }
        
        # Set up capabilities and task types
        self.agents["agent1"].task_types = ["type1", "type2"]
        self.agents["agent1"].capabilities = ["cap1", "cap2"]
        self.agents["agent1"].can_handle_task.return_value = True
        
        self.agents["agent2"].task_types = ["type2", "type3"]
        self.agents["agent2"].capabilities = ["cap2", "cap3"]
        self.agents["agent2"].can_handle_task.return_value = True
        
        self.agents["agent3"].task_types = ["type3", "general"]
        self.agents["agent3"].capabilities = ["cap3", "cap4"]
        self.agents["agent3"].can_handle_task.return_value = True
        
        # Create router
        self.router = TaskRouter(self.agents)
    
    def test_find_agents_by_task_type(self):
        """Test finding agents by task type."""
        # Create tasks
        task1 = AgentTask(query="Task 1", type="type1")
        task2 = AgentTask(query="Task 2", type="type2")
        task3 = AgentTask(query="Task 3", type="type3")
        task4 = AgentTask(query="Task 4", type="type4")
        
        # Test routing
        self.assertEqual(self.router.find_agents_for_task(task1), ["agent1"])
        self.assertEqual(set(self.router.find_agents_for_task(task2)), {"agent1", "agent2"})
        self.assertEqual(set(self.router.find_agents_for_task(task3)), {"agent2", "agent3"})
        
        # Task4 should match agent3 due to "general" type
        self.assertEqual(self.router.find_agents_for_task(task4), ["agent3"])
    
    def test_find_agents_by_capability(self):
        """Test finding agents by required capabilities."""
        # Create tasks with capability requirements
        task1 = AgentTask(
            query="Task with capability 1",
            type="general",
            metadata={"required_capabilities": ["cap1"]}
        )
        
        task2 = AgentTask(
            query="Task with capabilities 2 and 3",
            type="general",
            metadata={"required_capabilities": ["cap2", "cap3"]}
        )
        
        # Test routing
        self.assertEqual(self.router.find_agents_for_task(task1), ["agent1"])
        self.assertEqual(self.router.find_agents_for_task(task2), ["agent2"])
    
    def test_best_agent_selection(self):
        """Test selection of the best agent for a task."""
        # Create a task that multiple agents can handle
        task = AgentTask(query="Shared task", type="type2")
        
        # Get best agent (should be deterministic for this test)
        best_agent = self.router.get_best_agent_for_task(task)
        
        # Should return one of the capable agents
        self.assertIn(best_agent, ["agent1", "agent2"])


if __name__ == "__main__":
    unittest.main() 