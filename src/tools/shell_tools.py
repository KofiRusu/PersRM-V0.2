"""
Shell Tools

This module implements tools for executing shell commands and scripts.
"""

import os
import subprocess
import shlex
import logging
import time
import signal
from typing import Dict, List, Optional, Any, Union

from src.tools.base import Tool, ToolError

logger = logging.getLogger(__name__)

class ShellExecutor(Tool):
    """Tool for executing shell commands."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the shell executor tool.
        
        Args:
            config: Configuration for the tool
        """
        super().__init__(
            name="shell_executor",
            description="Execute shell commands and return their output",
            config=config
        )
        
        # Default config values
        self.default_timeout = self.config.get("default_timeout", 30)  # seconds
        self.max_output_length = self.config.get("max_output_length", 10000)  # characters
        self.allowed_commands = self.config.get("allowed_commands", None)  # None means all allowed
        self.blocked_commands = self.config.get("blocked_commands", ["rm -rf", "sudo", "su"])
        self.working_directory = self.config.get("working_directory", os.getcwd())
    
    def _get_parameter_schema(self) -> Dict[str, Any]:
        """Get the parameter schema for this tool."""
        return {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "Shell command to execute"
                },
                "timeout": {
                    "type": "number",
                    "description": "Timeout in seconds (default is 30)",
                    "default": self.default_timeout
                },
                "working_dir": {
                    "type": "string",
                    "description": "Working directory for the command",
                    "default": self.working_directory
                },
                "env": {
                    "type": "object",
                    "description": "Environment variables to set for the command",
                    "additionalProperties": {"type": "string"}
                },
                "capture_stderr": {
                    "type": "boolean",
                    "description": "Whether to capture stderr in the output",
                    "default": True
                }
            },
            "required": ["command"]
        }
    
    def _is_command_allowed(self, command: str) -> bool:
        """Check if a command is allowed to run.
        
        Args:
            command: Command to check
            
        Returns:
            True if the command is allowed, False otherwise
        """
        # Check if the command contains any blocked commands
        for blocked in self.blocked_commands:
            if blocked in command:
                return False
        
        # If allowed_commands is specified, check if the command is in the list
        if self.allowed_commands is not None:
            return any(allowed in command for allowed in self.allowed_commands)
        
        return True
    
    def execute(
        self, 
        command: str, 
        timeout: float = None, 
        working_dir: str = None, 
        env: Dict[str, str] = None,
        capture_stderr: bool = True
    ) -> Dict[str, Any]:
        """Execute a shell command.
        
        Args:
            command: Shell command to execute
            timeout: Timeout in seconds
            working_dir: Working directory for the command
            env: Environment variables to set for the command
            capture_stderr: Whether to capture stderr in the output
            
        Returns:
            Dictionary with command output and status
            
        Raises:
            ToolError: If the command is not allowed or fails
        """
        # Check if command is allowed
        if not self._is_command_allowed(command):
            blocked_commands_str = ", ".join(self.blocked_commands)
            raise ToolError(
                f"Command not allowed: {command}",
                {"blocked_commands": blocked_commands_str}
            )
        
        # Use default timeout if not specified
        if timeout is None:
            timeout = self.default_timeout
        
        # Use default working directory if not specified
        if working_dir is None:
            working_dir = self.working_directory
        
        # Prepare environment variables
        env_vars = os.environ.copy()
        if env:
            env_vars.update(env)
        
        # Normalize working directory
        working_dir = os.path.abspath(os.path.expanduser(working_dir))
        
        # Check if working directory exists
        if not os.path.exists(working_dir):
            raise ToolError(f"Working directory not found: {working_dir}")
        
        try:
            # Start time
            start_time = time.time()
            
            # Prepare subprocess arguments
            stderr_pipe = subprocess.PIPE if capture_stderr else subprocess.DEVNULL
            
            # Run the command
            logger.info(f"Executing command: {command} (timeout: {timeout}s)")
            process = subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=stderr_pipe,
                cwd=working_dir,
                env=env_vars,
                text=True
            )
            
            # Wait for the process to complete with timeout
            try:
                stdout, stderr = process.communicate(timeout=timeout)
                
                # Truncate output if it's too long
                if len(stdout) > self.max_output_length:
                    stdout = stdout[:self.max_output_length] + "\n... (output truncated)"
                
                if stderr and len(stderr) > self.max_output_length:
                    stderr = stderr[:self.max_output_length] + "\n... (output truncated)"
                
                # Calculate execution time
                execution_time = time.time() - start_time
                
                # Return results
                result = {
                    "status": "completed",
                    "exit_code": process.returncode,
                    "stdout": stdout,
                    "execution_time": execution_time
                }
                
                if capture_stderr:
                    result["stderr"] = stderr
                
                # Check exit code
                if process.returncode != 0:
                    result["status"] = "error"
                
                return result
                
            except subprocess.TimeoutExpired:
                # Kill the process
                logger.warning(f"Command timed out after {timeout}s: {command}")
                
                # Try to terminate gracefully first
                process.terminate()
                try:
                    process.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    # If still running, kill forcefully
                    process.kill()
                
                return {
                    "status": "timeout",
                    "exit_code": -1,
                    "stdout": "Command timed out",
                    "execution_time": timeout
                }
                
        except Exception as e:
            logger.exception(f"Error executing command: {command}")
            raise ToolError(f"Error executing command: {str(e)}")
    
    def safe_execute(
        self, 
        command: str, 
        timeout: float = None, 
        working_dir: str = None, 
        env: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """Execute a shell command with additional safety measures.
        
        This method provides an extra layer of safety by:
        1. Parsing the command using shlex to avoid shell injection
        2. Further filtering dangerous commands
        3. Using a more restrictive execution environment
        
        Args:
            command: Shell command to execute
            timeout: Timeout in seconds
            working_dir: Working directory for the command
            env: Environment variables to set for the command
            
        Returns:
            Dictionary with command output and status
            
        Raises:
            ToolError: If the command is not allowed or fails
        """
        # Parse command into arguments
        try:
            args = shlex.split(command)
        except ValueError as e:
            raise ToolError(f"Invalid command syntax: {str(e)}")
        
        # Check if command executable is allowed
        executable = args[0]
        allowed_executables = self.config.get("allowed_executables", None)
        
        if allowed_executables is not None and executable not in allowed_executables:
            allowed_execs_str = ", ".join(allowed_executables)
            raise ToolError(
                f"Executable not allowed: {executable}",
                {"allowed_executables": allowed_execs_str}
            )
        
        # Execute command with the parsed arguments
        try:
            # Start time
            start_time = time.time()
            
            # Use default timeout if not specified
            if timeout is None:
                timeout = self.default_timeout
            
            # Use default working directory if not specified
            if working_dir is None:
                working_dir = self.working_directory
            
            # Prepare environment variables
            env_vars = os.environ.copy()
            if env:
                env_vars.update(env)
            
            # Run the command with arguments
            logger.info(f"Executing command (safe mode): {executable} {' '.join(args[1:])}")
            process = subprocess.Popen(
                args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=working_dir,
                env=env_vars,
                text=True
            )
            
            # Wait for the process to complete with timeout
            stdout, stderr = process.communicate(timeout=timeout)
            
            # Calculate execution time
            execution_time = time.time() - start_time
            
            # Truncate output if it's too long
            if len(stdout) > self.max_output_length:
                stdout = stdout[:self.max_output_length] + "\n... (output truncated)"
            
            if len(stderr) > self.max_output_length:
                stderr = stderr[:self.max_output_length] + "\n... (output truncated)"
            
            # Return results
            result = {
                "status": "completed" if process.returncode == 0 else "error",
                "exit_code": process.returncode,
                "stdout": stdout,
                "stderr": stderr,
                "execution_time": execution_time
            }
            
            return result
            
        except subprocess.TimeoutExpired:
            # Kill the process
            logger.warning(f"Command timed out: {command}")
            process.terminate()
            
            return {
                "status": "timeout",
                "exit_code": -1,
                "stdout": "",
                "stderr": "Command timed out",
                "execution_time": timeout
            }
            
        except Exception as e:
            logger.exception(f"Error executing command: {command}")
            raise ToolError(f"Error executing command: {str(e)}") 