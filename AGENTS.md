# Multi-Agent Coordination System

This document describes the Multi-Agent Coordination system in PersLM, which enables specialized agents to collaborate on complex tasks.

## Overview

The multi-agent system consists of a coordinator that manages specialized agents, each with different capabilities:

- **ResearchAgent**: Information retrieval, research, and synthesis
- **CodeAgent**: Code generation, debugging, and explanation
- **PlanningAgent**: Task decomposition and strategic planning
- **ReasoningAgent**: In-depth analysis and logical reasoning

The system allows for:
- Task delegation to the most suitable agent
- Decomposition of complex tasks into subtasks
- Parallel or sequential execution of related tasks
- Aggregation of results from multiple agents

## Architecture

### Core Components

1. **Base Agent**: Abstract class defining the interface for all agents
2. **Coordinator**: Central manager for routing tasks and aggregating results
3. **Task Router**: Routes tasks to the most suitable agent(s)
4. **Specialized Agents**: Purpose-built agents for specific tasks

### Data Structures

1. **AgentTask**: Represents a task for an agent to perform
   - ID, query, context, task type, subtasks, metadata

2. **AgentResult**: Result of a task execution
   - Task ID, agent ID, success status, result data, execution time, subtask results

## Agent Interfaces

All agents implement the following core interfaces:

```python
# Core execution method - must be implemented by all agents
def execute(self, task: AgentTask) -> AgentResult:
    """Execute a task."""
    pass

# Optional planning method
def plan(self, task: AgentTask) -> Dict[str, Any]:
    """Plan how to approach a task."""
    pass

# Optional summarization method
def summarize(self, results: List[AgentResult]) -> str:
    """Summarize multiple results."""
    pass
```

## Specialized Agents

### ResearchAgent

**Capabilities**:
- Web search and information retrieval
- Content synthesis and summarization
- Source evaluation and citation
- Information extraction from structured data

**Task Types**: `research`, `search`, `retrieval`, `information`

**Key Methods**:
- `_plan_research`: Creates a research plan with key questions and search terms
- `_retrieve_information`: Fetches information from various sources
- `_synthesize_findings`: Combines information into coherent output

### CodeAgent

**Capabilities**:
- Code generation in multiple languages
- Code review and debugging
- Code explanation and documentation
- Repository analysis

**Task Types**: `code`, `programming`, `debugging`, `explanation`

**Key Methods**:
- `_analyze_requirements`: Interprets coding requirements
- `_generate_code`: Produces code matching specifications
- `_review_code`: Checks code for issues
- `_explain_code`: Generates explanations of code functionality

### PlanningAgent

**Capabilities**:
- Task decomposition into subtasks
- Dependency management between tasks
- Timeline and milestone creation
- Resource allocation recommendations

**Task Types**: `planning`, `decomposition`, `organization`

**Key Methods**:
- `_analyze_task`: Breaks down high-level tasks
- `_create_subtasks`: Generates subtask definitions
- `_determine_dependencies`: Identifies relationships between subtasks
- `_schedule_execution`: Plans execution sequence

### ReasoningAgent

**Capabilities**:
- Logical analysis and deduction
- Argument evaluation
- Hypothesis generation and testing
- Critical thinking and evaluation

**Task Types**: `reasoning`, `analysis`, `logic`, `evaluation`

**Key Methods**:
- `_analyze_problem`: Breaks down complex reasoning problems
- `_generate_hypotheses`: Creates potential explanations or solutions
- `_evaluate_evidence`: Assesses supporting evidence
- `_draw_conclusions`: Forms reasoned conclusions

## Coordinator

The Coordinator is the central hub of the multi-agent system, responsible for:

1. **Task Management**: Receiving, storing, and tracking tasks
2. **Agent Selection**: Finding the best agent(s) for each task
3. **Task Execution**: Running tasks and managing results
4. **Complex Task Handling**: Decomposing complex tasks into subtasks
5. **Result Aggregation**: Combining results from multiple agents

**Key Methods**:
- `submit_task`: Submits a new task to the system
- `execute_task`: Executes a specific task
- `decompose_task`: Breaks down a complex task into subtasks
- `execute_complex_task`: Handles end-to-end execution of complex tasks

## Task Router

The TaskRouter determines which agent(s) should handle a specific task based on:

1. Task type compatibility
2. Required capabilities
3. Agent availability
4. Task priority

## Memory Integration

Agents have access to:
1. **Personal Memory**: Agent-specific context and knowledge
2. **Shared Memory**: Information accessible to all agents
3. **Task History**: Record of past tasks and results

## Extension Guidelines

### Creating a New Agent

1. Inherit from the `Agent` base class:

```python
from src.agents.base import Agent, AgentTask, AgentResult

class MySpecializedAgent(Agent):
    def __init__(self, agent_id: str, model_provider: Callable, **kwargs):
        super().__init__(
            agent_id=agent_id,
            name="My Specialized Agent",
            description="Specializes in specific tasks",
            model_provider=model_provider,
            **kwargs
        )
    
    @property
    def task_types(self) -> List[str]:
        return ["my_task_type", "another_type"]
    
    @property
    def capabilities(self) -> List[str]:
        return ["capability1", "capability2"]
    
    def execute(self, task: AgentTask) -> AgentResult:
        # Implementation
        pass
```

2. Register with the Coordinator:

```python
coordinator.register_agent(MySpecializedAgent(
    agent_id="my_agent",
    model_provider=model_provider
))
```

### Best Practices

1. **Clear Specialization**: Each agent should have a well-defined domain
2. **Capability Declaration**: Agents should explicitly declare their capabilities
3. **Task Type Support**: Define which task types the agent can handle
4. **Error Handling**: Properly handle errors and return appropriate results
5. **Memory Usage**: Use the memory system for continuity
6. **Tracing**: Leave detailed traces for debugging and learning

## Usage Examples

### Basic Task Execution

```python
# Create a task
task = AgentTask(
    query="Research the latest developments in quantum computing",
    type="research"
)

# Submit to coordinator
task_id = coordinator.submit_task(task)

# Execute the task
result = coordinator.execute_task(task_id)

# Access the result
if result.success:
    print(result.result["synthesis"])
else:
    print(f"Error: {result.error}")
```

### Complex Task Execution

```python
# Execute a complex task that might involve multiple agents
result = coordinator.execute_complex_task(
    query="Analyze the performance implications of this code and suggest optimizations",
    task_type="analysis"
)

# The result might contain subtask results from multiple agents
print(f"Main result: {result.result}")
for subtask_result in result.subtask_results:
    print(f"Subtask by {subtask_result.agent_id}: {subtask_result.result}")
```

## Future Enhancements

1. **Collaborative Planning**: Agents collaboratively planning task execution
2. **Dynamic Agent Creation**: Creating specialized agents on demand
3. **Learning from Execution**: Improving routing based on past performance
4. **Hierarchical Organization**: Multiple layers of coordination
5. **Agent Negotiation**: Agents negotiating task allocation and execution strategy 