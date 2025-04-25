"""
Base Tool Interface

This module defines the base classes and interfaces for tools in PersLM.
"""

import logging
import time
import json
import uuid
from typing import Dict, List, Optional, Any, Callable, Union, Type
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)

@dataclass
class ToolResult:
    """Result of a tool execution."""
    tool_name: str
    success: bool
    output: Any
    error_message: Optional[str] = None
    execution_time: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary."""
        return asdict(self)
    
    def to_json(self) -> str:
        """Convert result to JSON."""
        return json.dumps(self.to_dict(), indent=2)
    
    def to_text(self) -> str:
        """Convert result to human-readable text."""
        if not self.success:
            return f"Error: {self.error_message}"
        
        if isinstance(self.output, (dict, list)):
            try:
                return json.dumps(self.output, indent=2)
            except:
                return str(self.output)
        
        return str(self.output)


class ToolError(Exception):
    """Exception raised for tool execution errors."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class Tool(ABC):
    """Base class for all tools.
    
    All tools must inherit from this class and implement the execute method.
    """
    
    def __init__(self, name: str, description: str, config: Dict[str, Any] = None):
        """Initialize the tool.
        
        Args:
            name: Name of the tool
            description: Description of what the tool does
            config: Configuration for the tool
        """
        self.name = name
        self.description = description
        self.config = config or {}
        
        # Optional schema for parameters
        self.parameter_schema = self._get_parameter_schema()
    
    def _get_parameter_schema(self) -> Dict[str, Any]:
        """Get the parameter schema for this tool.
        
        This should be overridden by subclasses to define their parameters.
        
        Returns:
            JSON schema for parameters
        """
        return {}
    
    @abstractmethod
    def execute(self, **kwargs) -> Any:
        """Execute the tool with the given parameters.
        
        Args:
            **kwargs: Parameters for the tool
            
        Returns:
            Result of the tool execution
            
        Raises:
            ToolError: If the tool execution fails
        """
        pass
    
    def run(self, **kwargs) -> ToolResult:
        """Run the tool and wrap the result in a ToolResult.
        
        Args:
            **kwargs: Parameters for the tool
            
        Returns:
            ToolResult with the execution result
        """
        start_time = time.time()
        
        try:
            # Validate parameters against schema
            self._validate_parameters(kwargs)
            
            # Execute the tool
            result = self.execute(**kwargs)
            
            execution_time = time.time() - start_time
            
            return ToolResult(
                tool_name=self.name,
                success=True,
                output=result,
                execution_time=execution_time
            )
        except ToolError as e:
            execution_time = time.time() - start_time
            
            return ToolResult(
                tool_name=self.name,
                success=False,
                output=None,
                error_message=str(e),
                execution_time=execution_time,
                metadata={"details": e.details}
            )
        except Exception as e:
            execution_time = time.time() - start_time
            
            error_message = f"Unexpected error: {str(e)}"
            logger.exception(error_message)
            
            return ToolResult(
                tool_name=self.name,
                success=False,
                output=None,
                error_message=error_message,
                execution_time=execution_time
            )
    
    def _validate_parameters(self, params: Dict[str, Any]) -> None:
        """Validate parameters against the schema.
        
        This is a simple validation method that can be extended by subclasses.
        
        Args:
            params: Parameters to validate
            
        Raises:
            ToolError: If parameters are invalid
        """
        schema = self._get_parameter_schema()
        
        # Skip validation if no schema
        if not schema:
            return
        
        # Check required parameters
        required = schema.get("required", [])
        for param in required:
            if param not in params:
                raise ToolError(f"Missing required parameter: {param}")
        
        # Check parameter types
        properties = schema.get("properties", {})
        for param, value in params.items():
            if param in properties:
                prop_schema = properties[param]
                param_type = prop_schema.get("type")
                
                if param_type == "string" and not isinstance(value, str):
                    raise ToolError(f"Parameter {param} must be a string")
                elif param_type == "integer" and not isinstance(value, int):
                    raise ToolError(f"Parameter {param} must be an integer")
                elif param_type == "number" and not isinstance(value, (int, float)):
                    raise ToolError(f"Parameter {param} must be a number")
                elif param_type == "boolean" and not isinstance(value, bool):
                    raise ToolError(f"Parameter {param} must be a boolean")
                elif param_type == "array" and not isinstance(value, list):
                    raise ToolError(f"Parameter {param} must be an array")
                elif param_type == "object" and not isinstance(value, dict):
                    raise ToolError(f"Parameter {param} must be an object")


class ToolManager:
    """Manager for registering and executing tools."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the tool manager.
        
        Args:
            config: Configuration for the tool manager
        """
        self.config = config or {}
        self.tools: Dict[str, Tool] = {}
        self.memory_callback: Optional[Callable] = None
        self.event_callback: Optional[Callable] = None
    
    def register_tool(self, tool: Tool) -> None:
        """Register a tool with the manager.
        
        Args:
            tool: Tool to register
            
        Raises:
            ValueError: If a tool with the same name is already registered
        """
        if tool.name in self.tools:
            raise ValueError(f"Tool with name '{tool.name}' is already registered")
        
        self.tools[tool.name] = tool
        logger.info(f"Registered tool: {tool.name}")
    
    def register_tools(self, tools: List[Tool]) -> None:
        """Register multiple tools with the manager.
        
        Args:
            tools: List of tools to register
        """
        for tool in tools:
            self.register_tool(tool)
    
    def get_tool(self, name: str) -> Optional[Tool]:
        """Get a tool by name.
        
        Args:
            name: Name of the tool
            
        Returns:
            The tool if found, None otherwise
        """
        return self.tools.get(name)
    
    def list_tools(self) -> Dict[str, Dict[str, Any]]:
        """List all registered tools.
        
        Returns:
            Dictionary of tool names to their information
        """
        return {
            name: {
                "description": tool.description,
                "parameter_schema": tool._get_parameter_schema()
            }
            for name, tool in self.tools.items()
        }
    
    def run_tool(self, name: str, parameters: Dict[str, Any]) -> ToolResult:
        """Run a tool by name with the given parameters.
        
        Args:
            name: Name of the tool to run
            parameters: Parameters for the tool
            
        Returns:
            Result of the tool execution
            
        Raises:
            ValueError: If the tool is not found
        """
        tool = self.get_tool(name)
        if not tool:
            return ToolResult(
                tool_name=name,
                success=False,
                output=None,
                error_message=f"Tool not found: {name}"
            )
        
        # Run the tool
        result = tool.run(**parameters)
        
        # Store result in memory if a callback is registered
        if self.memory_callback:
            self.memory_callback(name, parameters, result)
        
        # Notify event listeners if a callback is registered
        if self.event_callback:
            self.event_callback("tool_execution", {
                "tool_name": name,
                "parameters": parameters,
                "result": result.to_dict()
            })
        
        return result
    
    def parse_and_run_tool(self, tool_call: str) -> ToolResult:
        """Parse a tool call string and run the tool.
        
        The format should be either:
        - JSON: {"name": "tool_name", "parameters": {...}}
        - Text: tool_name(param1=value1, param2=value2)
        
        Args:
            tool_call: Tool call string
            
        Returns:
            Result of the tool execution
        """
        try:
            # Try to parse as JSON
            if tool_call.strip().startswith("{"):
                call_data = json.loads(tool_call)
                name = call_data.get("name")
                parameters = call_data.get("parameters", {})
                
                if not name:
                    return ToolResult(
                        tool_name="unknown",
                        success=False,
                        output=None,
                        error_message="Invalid tool call format: 'name' not found in JSON"
                    )
            else:
                # Try to parse as text format: name(param1=value1, param2=value2)
                import re
                match = re.match(r'(\w+)\((.*)\)', tool_call)
                if not match:
                    return ToolResult(
                        tool_name="unknown",
                        success=False,
                        output=None,
                        error_message=f"Invalid tool call format: '{tool_call}'"
                    )
                
                name = match.group(1)
                params_str = match.group(2)
                
                # Parse parameters
                parameters = {}
                if params_str.strip():
                    param_pairs = params_str.split(",")
                    for pair in param_pairs:
                        key, value = pair.split("=", 1)
                        key = key.strip()
                        value = value.strip()
                        
                        # Try to convert string values to appropriate types
                        if value.lower() == "true":
                            value = True
                        elif value.lower() == "false":
                            value = False
                        elif value.isdigit():
                            value = int(value)
                        elif value.replace(".", "", 1).isdigit() and value.count(".") <= 1:
                            value = float(value)
                        elif value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        
                        parameters[key] = value
            
            return self.run_tool(name, parameters)
            
        except Exception as e:
            return ToolResult(
                tool_name="unknown",
                success=False,
                output=None,
                error_message=f"Error parsing tool call: {str(e)}"
            )
    
    def set_memory_callback(self, callback: Callable) -> None:
        """Set a callback for storing tool results in memory.
        
        Args:
            callback: Function to call with (tool_name, parameters, result)
        """
        self.memory_callback = callback
    
    def set_event_callback(self, callback: Callable) -> None:
        """Set a callback for notifying event listeners.
        
        Args:
            callback: Function to call with (event_name, event_data)
        """
        self.event_callback = callback
    
    def get_tools_json_schema(self) -> Dict[str, Any]:
        """Get JSON schema for all registered tools.
        
        This can be used for function calling APIs.
        
        Returns:
            JSON schema for tools
        """
        tools_schema = []
        
        for name, tool in self.tools.items():
            schema = {
                "name": name,
                "description": tool.description,
                "parameters": tool._get_parameter_schema()
            }
            tools_schema.append(schema)
        
        return {
            "type": "function",
            "function": {
                "name": "execute_tool",
                "description": "Execute a tool with the given parameters",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tool_name": {
                            "type": "string",
                            "enum": list(self.tools.keys()),
                            "description": "Name of the tool to execute"
                        },
                        "parameters": {
                            "type": "object",
                            "description": "Parameters for the tool"
                        }
                    },
                    "required": ["tool_name"]
                }
            }
        } 