"""
Tools Module for PersLM

This package implements tool integrations that allow the model to interact with
external systems and perform actions in the real world.

Key tool categories:
- Operating System: file operations, shell commands
- Web: HTTP requests, web scraping
- Computation: calculator, data processing
- APIs: integration with external services
"""

from src.tools.base import Tool, ToolManager, ToolResult, ToolError
from src.tools.file_tools import FileReader, FileWriter
from src.tools.shell_tools import ShellExecutor
from src.tools.web_tools import WebSearchTool, HTTPClient
from src.tools.calculator import Calculator 