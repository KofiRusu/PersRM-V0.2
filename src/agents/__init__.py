"""
Agents Module for PersLM

This package implements the multi-agent coordination system, enabling
specialized agents to handle different types of tasks and collaborate
to solve complex problems.

Key components:
- Agent: Base class for all agents
- Coordinator: Manages agent selection and task routing
- Specialized agents for different domains (Research, Code, Planning, etc.)
"""

from src.agents.base import Agent, AgentTask, AgentResult
from src.agents.coordinator import Coordinator, TaskRouter
from src.agents.research_agent import ResearchAgent
from src.agents.code_agent import CodeAgent
from src.agents.planning_agent import PlanningAgent
from src.agents.reasoning_agent import ReasoningAgent 