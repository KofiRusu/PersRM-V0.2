"""
Code Agent

This module implements the Code Agent, which specializes in code generation,
code analysis, debugging, and other programming-related tasks.
"""

import logging
import os
import re
from typing import Dict, List, Optional, Any, Callable, Tuple

from src.agents.base import Agent, AgentTask, AgentResult
from src.tools import ToolManager
from src.memory import MemoryManager

logger = logging.getLogger(__name__)

class CodeAgent(Agent):
    """Agent specializing in code-related tasks."""
    
    def __init__(
        self,
        agent_id: str,
        model_provider: Callable,
        tool_manager: Optional[ToolManager] = None,
        memory_manager: Optional[MemoryManager] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the code agent.
        
        Args:
            agent_id: Unique identifier for the agent
            model_provider: Function to generate text from the model
            tool_manager: Tool manager for using tools
            memory_manager: Memory manager for storing code snippets
            config: Configuration for the agent
        """
        super().__init__(
            agent_id=agent_id,
            name="Code Agent",
            description="Specializes in code generation, analysis, and debugging",
            model_provider=model_provider,
            memory_manager=memory_manager,
            config=config
        )
        
        self.tool_manager = tool_manager
        
        # Default configurations
        self.default_language = config.get("default_language", "python")
        self.include_tests = config.get("include_tests", True)
        self.include_documentation = config.get("include_documentation", True)
        self.max_file_size = config.get("max_file_size", 1024 * 1024)  # 1MB
        
        # Supported languages
        self.supported_languages = config.get("supported_languages", [
            "python", "javascript", "typescript", "java", "c", "cpp", "csharp",
            "go", "rust", "ruby", "php", "swift", "kotlin", "shell"
        ])
    
    @property
    def task_types(self) -> List[str]:
        """Get the task types this agent can handle."""
        return ["code", "programming", "debugging", "code-analysis", "code-generation"]
    
    @property
    def capabilities(self) -> List[str]:
        """Get the capabilities of this agent."""
        base_capabilities = ["code-generation", "code-analysis", "debugging"]
        
        # Add language-specific capabilities
        for language in self.supported_languages:
            base_capabilities.append(f"language-{language}")
        
        # Add tool-specific capabilities if tools are available
        if self.tool_manager:
            tools = self.tool_manager.list_tools()
            if "file_reader" in tools:
                base_capabilities.append("file-reading")
            if "file_writer" in tools:
                base_capabilities.append("file-writing")
            if "shell_executor" in tools:
                base_capabilities.append("code-execution")
        
        return base_capabilities
    
    def can_handle_task(self, task: AgentTask) -> bool:
        """Check if this agent can handle a specific task."""
        # Ensure it's a supported task type
        if task.type not in self.task_types and "general" not in self.task_types:
            return False
        
        # Check if the task requires file operations and we have the tools
        if any(kw in task.query.lower() for kw in ["read file", "write file", "create file"]):
            if not self.tool_manager or "file_reader" not in self.tool_manager.list_tools():
                return False
        
        # Check if the task requires code execution
        if any(kw in task.query.lower() for kw in ["run code", "execute code", "test code"]):
            if not self.tool_manager or "shell_executor" not in self.tool_manager.list_tools():
                return False
        
        return True
    
    def execute(self, task: AgentTask) -> AgentResult:
        """Execute a code-related task.
        
        Args:
            task: Code task to execute
            
        Returns:
            Result of the code task
        """
        logger.info(f"Executing code task: {task.query}")
        
        # Determine the type of code task
        task_category = self._determine_task_category(task)
        
        # Execute the appropriate task handler
        if task_category == "code_generation":
            code_result = self._generate_code(task)
        elif task_category == "code_analysis":
            code_result = self._analyze_code(task)
        elif task_category == "debugging":
            code_result = self._debug_code(task)
        else:
            code_result = self._general_code_task(task)
        
        # Save to memory if available
        if self.memory_manager and "code" in code_result:
            language = code_result.get("language", self.default_language)
            code = code_result.get("code", "")
            
            self.memory_manager.add(f"```{language}\n{code}\n```", long_term=True, metadata={
                "type": "code_snippet",
                "language": language,
                "task_id": task.id,
                "task_category": task_category,
                "agent_id": self.agent_id
            })
        
        return AgentResult(
            task_id=task.id,
            agent_id=self.agent_id,
            success=True,
            result=code_result
        )
    
    def _determine_task_category(self, task: AgentTask) -> str:
        """Determine the category of code task.
        
        Args:
            task: Code task
            
        Returns:
            Task category: code_generation, code_analysis, debugging, or general
        """
        query_lower = task.query.lower()
        
        if any(kw in query_lower for kw in ["generate", "create", "write code", "implement"]):
            return "code_generation"
        elif any(kw in query_lower for kw in ["analyze", "review", "explain code"]):
            return "code_analysis"
        elif any(kw in query_lower for kw in ["debug", "fix", "error", "issue", "problem"]):
            return "debugging"
        else:
            return "general"
    
    def _extract_code_from_text(self, text: str) -> Tuple[str, str]:
        """Extract code and its language from markdown-formatted text.
        
        Args:
            text: Text containing code blocks
            
        Returns:
            Tuple of (language, code)
        """
        # Look for fenced code blocks with language
        code_block_pattern = r"```(\w+)\n(.*?)```"
        match = re.search(code_block_pattern, text, re.DOTALL)
        
        if match:
            language = match.group(1)
            code = match.group(2)
            return language, code
        
        # Look for fenced code blocks without language
        code_block_pattern = r"```\n(.*?)```"
        match = re.search(code_block_pattern, text, re.DOTALL)
        
        if match:
            code = match.group(1)
            return self.default_language, code
        
        # If no code blocks found, assume entire text is code
        return self.default_language, text
    
    def _read_code_file(self, file_path: str) -> Tuple[bool, str, str]:
        """Read code from a file.
        
        Args:
            file_path: Path to the file
            
        Returns:
            Tuple of (success, language, code)
        """
        if not self.tool_manager or "file_reader" not in self.tool_manager.list_tools():
            return False, "", "File reader tool not available"
        
        try:
            result = self.tool_manager.run_tool("file_reader", {
                "path": file_path
            })
            
            if not result.success:
                return False, "", f"Error reading file: {result.error_message}"
            
            # Determine language from file extension
            _, ext = os.path.splitext(file_path)
            language = self._get_language_from_extension(ext)
            
            return True, language, result.output
            
        except Exception as e:
            logger.exception(f"Error reading file {file_path}")
            return False, "", f"Error reading file: {str(e)}"
    
    def _write_code_file(self, file_path: str, code: str) -> Tuple[bool, str]:
        """Write code to a file.
        
        Args:
            file_path: Path to the file
            code: Code to write
            
        Returns:
            Tuple of (success, message)
        """
        if not self.tool_manager or "file_writer" not in self.tool_manager.list_tools():
            return False, "File writer tool not available"
        
        try:
            result = self.tool_manager.run_tool("file_writer", {
                "path": file_path,
                "content": code,
                "create_dirs": True
            })
            
            if not result.success:
                return False, f"Error writing file: {result.error_message}"
            
            return True, f"File written successfully to {file_path}"
            
        except Exception as e:
            logger.exception(f"Error writing file {file_path}")
            return False, f"Error writing file: {str(e)}"
    
    def _execute_code(self, code: str, language: str) -> Tuple[bool, Dict[str, Any]]:
        """Execute code and return the results.
        
        Args:
            code: Code to execute
            language: Programming language
            
        Returns:
            Tuple of (success, execution_result)
        """
        if not self.tool_manager or "shell_executor" not in self.tool_manager.list_tools():
            return False, {"error": "Shell executor tool not available"}
        
        # Create temporary file
        import tempfile
        import uuid
        
        try:
            # Determine file extension
            ext = self._get_extension_from_language(language)
            temp_dir = tempfile.gettempdir()
            file_name = f"code_{uuid.uuid4().hex}{ext}"
            file_path = os.path.join(temp_dir, file_name)
            
            # Write code to file
            with open(file_path, "w") as f:
                f.write(code)
            
            # Prepare execution command
            command = self._get_execution_command(file_path, language)
            
            # Execute code
            result = self.tool_manager.run_tool("shell_executor", {
                "command": command,
                "timeout": 10,
                "working_dir": temp_dir
            })
            
            # Clean up
            try:
                os.unlink(file_path)
            except:
                pass
            
            if not result.success:
                return False, {
                    "stdout": "",
                    "stderr": result.error_message,
                    "exit_code": -1
                }
            
            return True, {
                "stdout": result.output.get("stdout", ""),
                "stderr": result.output.get("stderr", ""),
                "exit_code": result.output.get("exit_code", 0)
            }
            
        except Exception as e:
            logger.exception(f"Error executing code")
            return False, {"error": f"Error executing code: {str(e)}"}
    
    def _get_language_from_extension(self, ext: str) -> str:
        """Get language from file extension.
        
        Args:
            ext: File extension
            
        Returns:
            Programming language
        """
        ext = ext.lower().lstrip(".")
        
        language_map = {
            "py": "python",
            "js": "javascript",
            "ts": "typescript",
            "tsx": "typescript",
            "jsx": "javascript",
            "java": "java",
            "c": "c",
            "cpp": "cpp",
            "cc": "cpp",
            "cs": "csharp",
            "go": "go",
            "rs": "rust",
            "rb": "ruby",
            "php": "php",
            "swift": "swift",
            "kt": "kotlin",
            "sh": "shell",
            "bash": "shell",
            "html": "html",
            "css": "css",
            "sql": "sql"
        }
        
        return language_map.get(ext, self.default_language)
    
    def _get_extension_from_language(self, language: str) -> str:
        """Get file extension from language.
        
        Args:
            language: Programming language
            
        Returns:
            File extension
        """
        language = language.lower()
        
        extension_map = {
            "python": ".py",
            "javascript": ".js",
            "typescript": ".ts",
            "java": ".java",
            "c": ".c",
            "cpp": ".cpp",
            "csharp": ".cs",
            "go": ".go",
            "rust": ".rs",
            "ruby": ".rb",
            "php": ".php",
            "swift": ".swift",
            "kotlin": ".kt",
            "shell": ".sh",
            "html": ".html",
            "css": ".css",
            "sql": ".sql"
        }
        
        return extension_map.get(language, ".txt")
    
    def _get_execution_command(self, file_path: str, language: str) -> str:
        """Get command to execute code.
        
        Args:
            file_path: Path to the code file
            language: Programming language
            
        Returns:
            Execution command
        """
        language = language.lower()
        
        command_map = {
            "python": f"python {file_path}",
            "javascript": f"node {file_path}",
            "typescript": f"ts-node {file_path}",
            "java": f"java {file_path}",
            "c": f"gcc {file_path} -o {file_path}.out && {file_path}.out",
            "cpp": f"g++ {file_path} -o {file_path}.out && {file_path}.out",
            "csharp": f"dotnet {file_path}",
            "go": f"go run {file_path}",
            "rust": f"rustc {file_path} -o {file_path}.out && {file_path}.out",
            "ruby": f"ruby {file_path}",
            "php": f"php {file_path}",
            "swift": f"swift {file_path}",
            "kotlin": f"kotlinc {file_path} -include-runtime -d {file_path}.jar && java -jar {file_path}.jar",
            "shell": f"bash {file_path}"
        }
        
        return command_map.get(language, f"cat {file_path}")
    
    def _generate_code(self, task: AgentTask) -> Dict[str, Any]:
        """Generate code based on task requirements.
        
        Args:
            task: Code generation task
            
        Returns:
            Generated code and metadata
        """
        # Extract requirements from task
        language = self._extract_language_from_task(task)
        file_path = self._extract_file_path_from_task(task)
        
        # Create code generation prompt
        prompt = f"""
Generate code for the following task:
{task.query}

Requirements:
- Language: {language}
- Include detailed comments explaining the code
"""
        
        if self.include_documentation:
            prompt += "- Include documentation (docstrings, function headers)\n"
        
        if self.include_tests and language.lower() in ["python", "javascript", "typescript"]:
            prompt += "- Include unit tests or example usage\n"
        
        if task.context:
            prompt += f"\nAdditional context:\n{task.context}\n"
        
        prompt += "\nCode:"
        
        # Generate code
        result = self.model_provider(prompt)
        language_detected, code = self._extract_code_from_text(result)
        
        # Determine if we should write to a file
        should_write = file_path is not None and self.tool_manager and "file_writer" in self.tool_manager.list_tools()
        
        # Write to file if needed
        if should_write:
            write_success, write_message = self._write_code_file(file_path, code)
        else:
            write_success, write_message = False, "No file path specified or file writer unavailable"
        
        # Return result
        return {
            "language": language_detected or language,
            "code": code,
            "file_path": file_path if should_write else None,
            "file_written": write_success,
            "write_message": write_message if should_write else None
        }
    
    def _analyze_code(self, task: AgentTask) -> Dict[str, Any]:
        """Analyze existing code.
        
        Args:
            task: Code analysis task
            
        Returns:
            Analysis results
        """
        # Check if we need to read a file
        file_path = self._extract_file_path_from_task(task)
        
        if file_path:
            # Read code from file
            read_success, language, code = self._read_code_file(file_path)
            
            if not read_success:
                return {
                    "success": False,
                    "error": code  # In this case, code contains the error message
                }
        else:
            # Extract code from context or prompt
            if task.context:
                language, code = self._extract_code_from_text(task.context)
            else:
                language, code = self._extract_code_from_text(task.query)
        
        # Create analysis prompt
        prompt = f"""
Analyze the following code:

```{language}
{code}
```

Provide the following analysis:
1. Summary of what the code does
2. Code quality assessment
3. Potential bugs or issues
4. Suggestions for improvement
5. Analysis of time and space complexity (if applicable)
"""
        
        # Generate analysis
        analysis = self.model_provider(prompt)
        
        return {
            "language": language,
            "code": code,
            "analysis": analysis,
            "file_path": file_path
        }
    
    def _debug_code(self, task: AgentTask) -> Dict[str, Any]:
        """Debug code with issues.
        
        Args:
            task: Debugging task
            
        Returns:
            Debugging results with fixed code
        """
        # Check if we need to read a file
        file_path = self._extract_file_path_from_task(task)
        
        if file_path:
            # Read code from file
            read_success, language, code = self._read_code_file(file_path)
            
            if not read_success:
                return {
                    "success": False,
                    "error": code  # In this case, code contains the error message
                }
        else:
            # Extract code from context or prompt
            if task.context:
                language, code = self._extract_code_from_text(task.context)
            else:
                language, code = self._extract_code_from_text(task.query)
        
        # Extract error message if available
        error_message = self._extract_error_message(task.query)
        if not error_message and task.context:
            error_message = self._extract_error_message(task.context)
        
        # Create debugging prompt
        prompt = f"""
Debug the following code:

```{language}
{code}
```
"""
        
        if error_message:
            prompt += f"\nError message:\n{error_message}\n"
        
        prompt += """
Provide the following:
1. Identify the issue(s) in the code
2. Fixed version of the code
3. Explanation of what was wrong and how it was fixed
"""
        
        # Generate debug results
        debug_results = self.model_provider(prompt)
        
        # Extract fixed code
        _, fixed_code = self._extract_code_from_text(debug_results)
        
        # Determine if we should write the fixed code
        should_write = file_path is not None and self.tool_manager and "file_writer" in self.tool_manager.list_tools()
        
        # Write fixed code if needed
        if should_write:
            write_success, write_message = self._write_code_file(file_path, fixed_code)
        else:
            write_success, write_message = False, "No file path specified or file writer unavailable"
        
        # Return result
        return {
            "language": language,
            "original_code": code,
            "fixed_code": fixed_code,
            "debug_results": debug_results,
            "file_path": file_path if should_write else None,
            "file_written": write_success,
            "write_message": write_message if should_write else None
        }
    
    def _general_code_task(self, task: AgentTask) -> Dict[str, Any]:
        """Handle general code-related tasks.
        
        Args:
            task: General code task
            
        Returns:
            Task results
        """
        # Create prompt
        prompt = f"""
Code task: {task.query}

"""
        
        if task.context:
            prompt += f"Context:\n{task.context}\n\n"
        
        prompt += "Please provide a detailed response addressing this code-related task."
        
        # Generate response
        response = self.model_provider(prompt)
        
        # Extract code if present
        language, code = self._extract_code_from_text(response)
        
        return {
            "response": response,
            "contains_code": bool(code),
            "language": language if code else None,
            "code": code if code else None
        }
    
    def _extract_language_from_task(self, task: AgentTask) -> str:
        """Extract programming language from task.
        
        Args:
            task: Code task
            
        Returns:
            Programming language
        """
        # Check query for language mentions
        query = task.query.lower()
        
        for language in self.supported_languages:
            if language in query:
                return language
        
        # Check metadata
        language = task.metadata.get("language")
        if language:
            return language
        
        # Default language
        return self.default_language
    
    def _extract_file_path_from_task(self, task: AgentTask) -> Optional[str]:
        """Extract file path from task.
        
        Args:
            task: Code task
            
        Returns:
            File path or None
        """
        # Check metadata
        file_path = task.metadata.get("file_path")
        if file_path:
            return file_path
        
        # Check for file path in query
        query = task.query
        
        # Look for patterns like "file: path/to/file.py" or "write to file.py"
        file_patterns = [
            r"file:?\s+([^\s,]+\.[a-zA-Z0-9]+)",
            r"(?:write|save|read|open)(?:\s+to|\s+from)?\s+(?:file\s+)?([^\s,]+\.[a-zA-Z0-9]+)",
            r"([^\s,]+\.[a-zA-Z0-9]+)(?:\s+file)"
        ]
        
        for pattern in file_patterns:
            match = re.search(pattern, query)
            if match:
                return match.group(1)
        
        return None
    
    def _extract_error_message(self, text: str) -> Optional[str]:
        """Extract error message from text.
        
        Args:
            text: Text that might contain error messages
            
        Returns:
            Error message or None
        """
        # Look for common error message patterns
        error_patterns = [
            r"(?:error|exception|traceback):\s*(.*?)(?:\n\n|\Z)",
            r"(?:error|exception|traceback)[:\n](.*?)(?:\n\n|\Z)"
        ]
        
        for pattern in error_patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()
        
        return None 