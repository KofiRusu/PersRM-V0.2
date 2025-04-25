"""
File Operation Tools

This module implements tools for file operations like reading and writing files.
"""

import os
import json
import logging
from typing import Dict, List, Optional, Any, BinaryIO, Union, TextIO

from src.tools.base import Tool, ToolError

logger = logging.getLogger(__name__)

class FileReader(Tool):
    """Tool for reading files."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the file reader tool.
        
        Args:
            config: Configuration for the tool
        """
        super().__init__(
            name="file_reader",
            description="Read the contents of a file",
            config=config
        )
    
    def _get_parameter_schema(self) -> Dict[str, Any]:
        """Get the parameter schema for this tool."""
        return {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file to read"
                },
                "binary": {
                    "type": "boolean",
                    "description": "Whether to read the file in binary mode",
                    "default": False
                },
                "start_line": {
                    "type": "integer",
                    "description": "Line number to start reading from (0-indexed)",
                    "default": 0
                },
                "end_line": {
                    "type": "integer",
                    "description": "Line number to end reading at (0-indexed, inclusive)",
                    "default": -1
                },
                "encoding": {
                    "type": "string",
                    "description": "File encoding",
                    "default": "utf-8"
                }
            },
            "required": ["path"]
        }
    
    def execute(self, path: str, binary: bool = False, start_line: int = 0, end_line: int = -1, encoding: str = "utf-8") -> Any:
        """Read a file.
        
        Args:
            path: Path to the file to read
            binary: Whether to read the file in binary mode
            start_line: Line number to start reading from (0-indexed)
            end_line: Line number to end reading at (0-indexed, inclusive)
            encoding: File encoding
            
        Returns:
            File contents as string or bytes
            
        Raises:
            ToolError: If the file doesn't exist or can't be read
        """
        # Normalize path and check if it exists
        path = os.path.abspath(os.path.expanduser(path))
        
        if not os.path.exists(path):
            raise ToolError(f"File not found: {path}")
            
        if not os.path.isfile(path):
            raise ToolError(f"Not a file: {path}")
        
        try:
            # Check file size
            file_size = os.path.getsize(path)
            max_size = self.config.get("max_file_size", 10 * 1024 * 1024)  # Default: 10 MB
            
            if file_size > max_size:
                raise ToolError(f"File too large: {file_size} bytes (max: {max_size} bytes)")
            
            # Read the file
            mode = "rb" if binary else "r"
            with open(path, mode, encoding=None if binary else encoding) as f:
                if binary:
                    return f.read()
                else:
                    # Read specific lines if requested
                    if start_line > 0 or end_line >= 0:
                        lines = f.readlines()
                        
                        # Adjust end_line if it's -1
                        if end_line < 0:
                            end_line = len(lines) - 1
                        
                        # Validate line range
                        if start_line < 0:
                            start_line = 0
                        if end_line >= len(lines):
                            end_line = len(lines) - 1
                        
                        # Extract the requested lines
                        selected_lines = lines[start_line:end_line+1]
                        return "".join(selected_lines)
                    else:
                        return f.read()
                
        except UnicodeDecodeError:
            raise ToolError(f"File is not in {encoding} encoding")
        except IOError as e:
            raise ToolError(f"Error reading file: {str(e)}")
        except Exception as e:
            raise ToolError(f"Unexpected error: {str(e)}")


class FileWriter(Tool):
    """Tool for writing to files."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the file writer tool.
        
        Args:
            config: Configuration for the tool
        """
        super().__init__(
            name="file_writer",
            description="Write content to a file",
            config=config
        )
    
    def _get_parameter_schema(self) -> Dict[str, Any]:
        """Get the parameter schema for this tool."""
        return {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file to write"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write to the file"
                },
                "binary": {
                    "type": "boolean",
                    "description": "Whether to write the file in binary mode",
                    "default": False
                },
                "append": {
                    "type": "boolean",
                    "description": "Whether to append to the file instead of overwriting",
                    "default": False
                },
                "encoding": {
                    "type": "string",
                    "description": "File encoding",
                    "default": "utf-8"
                },
                "create_dirs": {
                    "type": "boolean",
                    "description": "Whether to create parent directories if they don't exist",
                    "default": True
                }
            },
            "required": ["path", "content"]
        }
    
    def execute(
        self, 
        path: str, 
        content: str, 
        binary: bool = False, 
        append: bool = False, 
        encoding: str = "utf-8",
        create_dirs: bool = True
    ) -> Dict[str, Any]:
        """Write content to a file.
        
        Args:
            path: Path to the file to write
            content: Content to write to the file
            binary: Whether to write the file in binary mode
            append: Whether to append to the file instead of overwriting
            encoding: File encoding
            create_dirs: Whether to create parent directories if they don't exist
            
        Returns:
            Dictionary with success message and file info
            
        Raises:
            ToolError: If the file can't be written
        """
        # Normalize path
        path = os.path.abspath(os.path.expanduser(path))
        
        # Check write permissions for directory
        directory = os.path.dirname(path)
        
        # Create parent directories if requested
        if create_dirs and not os.path.exists(directory):
            try:
                os.makedirs(directory)
            except OSError as e:
                raise ToolError(f"Error creating directories: {str(e)}")
        
        if not os.path.exists(directory):
            raise ToolError(f"Directory not found: {directory}")
            
        if not os.access(directory, os.W_OK):
            raise ToolError(f"No write permission for directory: {directory}")
        
        # Check if there are restrictions on allowed paths
        allowed_paths = self.config.get("allowed_paths", [])
        if allowed_paths:
            if not any(path.startswith(allowed) for allowed in allowed_paths):
                allowed_paths_str = ", ".join(allowed_paths)
                raise ToolError(
                    f"Path not in allowed paths: {path}",
                    {"allowed_paths": allowed_paths}
                )
        
        # Convert content to bytes if binary mode
        if binary and isinstance(content, str):
            content = content.encode(encoding)
        
        try:
            # Get file mode
            mode = "ab" if append and binary else "wb" if binary else "a" if append else "w"
            
            # Write the file
            with open(path, mode, encoding=None if binary else encoding) as f:
                f.write(content)
            
            # Get file info
            file_size = os.path.getsize(path)
            
            return {
                "message": f"File {'appended to' if append else 'written'} successfully",
                "path": path,
                "size": file_size,
                "append": append
            }
                
        except IOError as e:
            raise ToolError(f"Error writing file: {str(e)}")
        except Exception as e:
            raise ToolError(f"Unexpected error: {str(e)}") 