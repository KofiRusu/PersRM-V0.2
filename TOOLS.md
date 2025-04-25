# PersLM Tool Integration System

The PersLM tool integration system enables the model to interact with the external world by invoking tools and incorporating their results into its reasoning and responses. This document explains the tool architecture, available tools, and how to use and extend the system.

## Overview

The tool integration system in PersLM provides a flexible framework for the model to leverage external capabilities. By providing structured interfaces for tool invocation, the model can perform actions beyond text generation, such as:

- Retrieving information from the web
- Reading and writing files
- Executing shell commands
- Performing calculations
- Making API calls
- Processing structured data

Key features of the tool system:
- Modular architecture for easily adding new tools
- Parameter validation and security constraints
- Consistent result format for handling tool outputs
- Memory integration for tracking tool usage
- Support for both JSON and text-based tool invocation

## Available Tools

PersLM comes with several built-in tools:

### File Tools

#### FileReader
Reads the contents of a file.

**Parameters:**
- `path` (string, required): Path to the file to read
- `binary` (boolean, optional): Whether to read in binary mode
- `start_line` (integer, optional): Line to start reading from (0-indexed)
- `end_line` (integer, optional): Line to end reading at (inclusive, -1 for end of file)
- `encoding` (string, optional): File encoding (default: utf-8)

**Example:**
```python
result = tool_manager.run_tool("file_reader", {
    "path": "data/example.txt",
    "start_line": 10,
    "end_line": 20
})
print(result.output)  # Contents of lines 10-20
```

#### FileWriter
Writes content to a file.

**Parameters:**
- `path` (string, required): Path to the file to write
- `content` (string, required): Content to write to the file
- `binary` (boolean, optional): Whether to write in binary mode
- `append` (boolean, optional): Whether to append to the file instead of overwriting
- `encoding` (string, optional): File encoding (default: utf-8)
- `create_dirs` (boolean, optional): Whether to create parent directories if they don't exist

**Example:**
```python
result = tool_manager.run_tool("file_writer", {
    "path": "data/output.txt",
    "content": "Hello, world!",
    "append": True
})
print(result.output)  # {"message": "File appended to successfully", "path": "data/output.txt", "size": 13, "append": true}
```

### Shell Tools

#### ShellExecutor
Executes shell commands and returns their output.

**Parameters:**
- `command` (string, required): Shell command to execute
- `timeout` (number, optional): Timeout in seconds (default: 30)
- `working_dir` (string, optional): Working directory for the command
- `env` (object, optional): Environment variables to set
- `capture_stderr` (boolean, optional): Whether to capture stderr in the output

**Example:**
```python
result = tool_manager.run_tool("shell_executor", {
    "command": "ls -la",
    "working_dir": "/path/to/directory",
    "timeout": 5
})
print(result.output["stdout"])  # Directory listing
```

**Security Notes:**
- The ShellExecutor tool has built-in security constraints, including:
  - Blocked commands: By default, potentially dangerous commands like `rm -rf`, `sudo`, etc.
  - Allowed executables: Can be configured to allow only specific executables
  - Timeouts: Limits execution time to prevent hanging
  - Working directory restrictions: Prevents access to sensitive system directories

### Web Tools

#### HTTPClient
Makes HTTP requests to websites and APIs.

**Parameters:**
- `url` (string, required): URL to send the request to
- `method` (string, optional): HTTP method (GET, POST, PUT, DELETE, etc.) (default: GET)
- `headers` (object, optional): HTTP headers
- `params` (object, optional): URL parameters
- `data` (object, optional): Form data to send
- `json` (object, optional): JSON data to send
- `timeout` (number, optional): Timeout in seconds
- `parse_response` (boolean, optional): Whether to parse the response body as JSON

**Example:**
```python
result = tool_manager.run_tool("http_client", {
    "url": "https://api.example.com/data",
    "method": "POST",
    "json": {"key": "value"},
    "headers": {"Authorization": "Bearer token123"}
})
print(result.output["body"])  # Response body
```

#### WebSearchTool
Searches the web for information.

**Parameters:**
- `query` (string, required): Search query
- `num_results` (integer, optional): Number of results to return (default: 5)
- `search_engine` (string, optional): Search engine to use (default: duckduckgo)

**Example:**
```python
result = tool_manager.run_tool("web_search", {
    "query": "climate change impacts",
    "num_results": 3
})
for item in result.output["results"]:
    print(f"Title: {item['title']}")
    print(f"URL: {item['url']}")
    print(f"Snippet: {item['snippet']}")
    print()
```

### Computational Tools

#### Calculator
Performs mathematical calculations.

**Parameters:**
- `expression` (string, required): Mathematical expression to evaluate
- `variables` (object, optional): Variables to use in the expression
- `precision` (integer, optional): Number of decimal places in the result (default: 6)
- `show_steps` (boolean, optional): Whether to provide step-by-step calculation

**Example:**
```python
result = tool_manager.run_tool("calculator", {
    "expression": "sin(pi/4) + 5*x",
    "variables": {"x": 2},
    "precision": 4
})
print(result.output["formatted_result"])  # "10.7071"
print(result.output["steps"])  # Step-by-step calculation
```

## Using the Tool System

### Basic Usage

To use the tool system, you need to:

1. Initialize the tool manager
2. Register the desired tools
3. Call the `run_tool` method with the tool name and parameters

Example:
```python
from src.tools import ToolManager
from src.tools.calculator import Calculator

# Initialize tool manager
tool_manager = ToolManager()

# Register tools
tool_manager.register_tool(Calculator())

# Run a tool
result = tool_manager.run_tool("calculator", {
    "expression": "2 + 2 * 3"
})

# Check if the tool execution was successful
if result.success:
    print(f"Result: {result.output['result']}")  # 8
else:
    print(f"Error: {result.error_message}")
```

### Handling Tool Results

Tool execution results are returned as `ToolResult` objects with the following properties:

- `tool_name`: Name of the tool that was executed
- `success`: Whether the execution was successful
- `output`: Output of the tool (type depends on the tool)
- `error_message`: Error message if execution failed
- `execution_time`: Time taken to execute the tool
- `metadata`: Additional metadata about the execution

Example:
```python
result = tool_manager.run_tool("http_client", {
    "url": "https://api.github.com/users/octocat"
})

if result.success:
    print(f"Status Code: {result.output['status_code']}")
    print(f"Response: {result.output['body']}")
    print(f"Execution Time: {result.execution_time} seconds")
else:
    print(f"Error: {result.error_message}")
```

### Parsing Tool Calls

The tool system can parse tool calls in different formats:

#### JSON Format
```json
{
  "name": "calculator",
  "parameters": {
    "expression": "1 + 1"
  }
}
```

#### Text Format
```
calculator(expression="1 + 1")
```

Example:
```python
# Parse and run a tool call
result = tool_manager.parse_and_run_tool('calculator(expression="2 + 2")')
```

## Memory Integration

The tool system can be integrated with the memory system to track tool usage:

```python
# Set up memory callback
def memory_callback(tool_name, parameters, result):
    memory_content = f"Tool: {tool_name}\nParameters: {json.dumps(parameters)}\nResult: {result.to_text()}"
    memory_manager.add(memory_content, long_term=True, metadata={
        "type": "tool_usage",
        "tool_name": tool_name,
        "success": result.success
    })

tool_manager.set_memory_callback(memory_callback)
```

## Creating Custom Tools

To create a custom tool:

1. Create a class that inherits from the `Tool` base class
2. Implement the required methods: `_get_parameter_schema` and `execute`
3. Register the tool with the tool manager

Example:
```python
from src.tools.base import Tool, ToolError

class WeatherTool(Tool):
    def __init__(self, config=None):
        super().__init__(
            name="weather",
            description="Get current weather for a location",
            config=config
        )
        
    def _get_parameter_schema(self):
        return {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": "Location to get weather for"
                },
                "units": {
                    "type": "string",
                    "enum": ["metric", "imperial"],
                    "description": "Units to use (metric or imperial)",
                    "default": "metric"
                }
            },
            "required": ["location"]
        }
        
    def execute(self, location, units="metric"):
        try:
            # In a real implementation, this would call a weather API
            # This is just a placeholder
            if units == "metric":
                return {
                    "location": location,
                    "temperature": 22,
                    "units": "Celsius",
                    "conditions": "Partly Cloudy"
                }
            else:
                return {
                    "location": location,
                    "temperature": 72,
                    "units": "Fahrenheit",
                    "conditions": "Partly Cloudy"
                }
        except Exception as e:
            raise ToolError(f"Failed to get weather: {str(e)}")
```

## Tool Safety and Security

The tool system includes several safety features:

1. **Parameter Validation**: Tools validate parameter types and required parameters
2. **Timeout Limits**: Tools can set execution timeouts to prevent hanging
3. **Domain Restrictions**: HTTP tools can restrict which domains are allowed
4. **Command Filtering**: Shell tools can block dangerous commands
5. **Resource Limits**: Tools can limit resource usage (e.g., file size limits)

## Best Practices

1. **Tool Selection**: Choose the right tool for the task
2. **Error Handling**: Always check for errors in tool results
3. **Security**: Apply appropriate security constraints for tools that interact with the system
4. **Timeouts**: Set reasonable timeouts for tools that might take a long time
5. **Memory**: Use the memory system to track tool usage and learn from past interactions

## Future Developments

Future enhancements to the tool system include:
- **Tool Chaining**: Composing multiple tools into pipelines
- **Tool Discovery**: Allowing the model to discover available tools dynamically
- **Sandboxing**: More robust isolation for potentially dangerous tools
- **Tool-Specific Memory**: Specialized memory for tool usage patterns
- **Learning from Usage**: Improving tool usage based on past interactions 