"""
Reasoning Module for PersLM

This package implements various reasoning capabilities for PersLM, enabling
autonomous problem-solving, planning, and reflection.

Key components:
- Chain-of-Thought: Step-by-step reasoning for complex problems
- Self-Reflection: Evaluating and improving generated solutions
- Task Decomposition: Breaking complex tasks into manageable steps
- Planning: Creating and executing plans to achieve goals
"""

from src.reasoning.chain_of_thought import ChainOfThoughtReasoner
from src.reasoning.self_reflection import SelfReflectionReasoner
from src.reasoning.task_decomposition import TaskDecomposer
from src.reasoning.planning import Planner
from src.reasoning.reasoner import ReasoningManager 