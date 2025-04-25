"""
Research Agent

This module implements the Research Agent, which specializes in retrieving
information, conducting research, and synthesizing findings.
"""

import logging
import json
from typing import Dict, List, Optional, Any, Callable

from src.agents.base import Agent, AgentTask, AgentResult
from src.tools import ToolManager
from src.memory import MemoryManager

logger = logging.getLogger(__name__)

class ResearchAgent(Agent):
    """Agent specializing in research and information retrieval."""
    
    def __init__(
        self,
        agent_id: str,
        model_provider: Callable,
        tool_manager: Optional[ToolManager] = None,
        memory_manager: Optional[MemoryManager] = None,
        config: Dict[str, Any] = None
    ):
        """Initialize the research agent.
        
        Args:
            agent_id: Unique identifier for the agent
            model_provider: Function to generate text from the model
            tool_manager: Tool manager for using tools
            memory_manager: Memory manager for storing information
            config: Configuration for the agent
        """
        super().__init__(
            agent_id=agent_id,
            name="Research Agent",
            description="Specializes in research and information retrieval",
            model_provider=model_provider,
            memory_manager=memory_manager,
            config=config
        )
        
        self.tool_manager = tool_manager
        
        # Default configurations
        self.search_depth = config.get("search_depth", 2)
        self.max_sources = config.get("max_sources", 5)
        self.synthesize_results = config.get("synthesize_results", True)
    
    @property
    def task_types(self) -> List[str]:
        """Get the task types this agent can handle."""
        return ["research", "search", "retrieval", "information"]
    
    @property
    def capabilities(self) -> List[str]:
        """Get the capabilities of this agent."""
        base_capabilities = ["research", "information-retrieval", "summarization"]
        
        # Add tool-specific capabilities if tools are available
        if self.tool_manager:
            tools = self.tool_manager.list_tools()
            if "web_search" in tools:
                base_capabilities.append("web-search")
            if "http_client" in tools:
                base_capabilities.append("web-browsing")
        
        return base_capabilities
    
    def can_handle_task(self, task: AgentTask) -> bool:
        """Check if this agent can handle a specific task."""
        # Ensure it's a supported task type
        if task.type not in self.task_types and "general" not in self.task_types:
            return False
        
        # Check if we have necessary tools
        if "search" in task.type and not self.has_search_tools():
            return False
        
        return True
    
    def has_search_tools(self) -> bool:
        """Check if search tools are available."""
        if not self.tool_manager:
            return False
        
        tools = self.tool_manager.list_tools()
        return "web_search" in tools or "http_client" in tools
    
    def execute(self, task: AgentTask) -> AgentResult:
        """Execute a research task.
        
        Args:
            task: Research task to execute
            
        Returns:
            Result of the research
        """
        logger.info(f"Executing research task: {task.query}")
        
        # Plan research approach
        research_plan = self._plan_research(task)
        
        # Retrieve information
        search_results = self._retrieve_information(task, research_plan)
        
        # Synthesize findings
        if self.synthesize_results:
            synthesis = self._synthesize_findings(task, search_results)
        else:
            synthesis = "Information retrieved but not synthesized"
        
        # Create result
        result = {
            "research_plan": research_plan,
            "sources": search_results,
            "synthesis": synthesis
        }
        
        # Save to memory if available
        if self.memory_manager:
            # Store sources
            for i, source in enumerate(search_results):
                source_content = f"Source {i+1}: {source.get('title', 'Unknown')}\n{source.get('content', '')}"
                self.memory_manager.add(source_content, long_term=True, metadata={
                    "type": "research_source",
                    "task_id": task.id,
                    "source_index": i,
                    "source_url": source.get("url", ""),
                    "agent_id": self.agent_id
                })
            
            # Store synthesis
            self.memory_manager.add(synthesis, long_term=True, metadata={
                "type": "research_synthesis",
                "task_id": task.id,
                "agent_id": self.agent_id,
                "source_count": len(search_results)
            })
        
        return AgentResult(
            task_id=task.id,
            agent_id=self.agent_id,
            success=True,
            result=result
        )
    
    def _plan_research(self, task: AgentTask) -> Dict[str, Any]:
        """Plan the research approach.
        
        Args:
            task: Research task
            
        Returns:
            Research plan
        """
        # Use model to generate research plan
        prompt = f"""
Task: {task.query}

Create a research plan for this task. Include:
1. Key questions to answer
2. Information sources to check
3. Search terms to use
4. Any specific areas to focus on
"""
        
        if task.context:
            prompt += f"\nContext: {task.context}\n"
        
        planning_result = self.model_provider(prompt)
        
        # Extract key search terms
        search_terms_prompt = f"""
Based on this research task: {task.query}

List the 3-5 most important search terms to use:
"""
        search_terms_result = self.model_provider(search_terms_prompt)
        
        # Parse out search terms (simple extraction)
        search_terms = []
        for line in search_terms_result.split("\n"):
            line = line.strip()
            if line and not line.startswith("Based on") and len(line) < 100:
                # Remove leading numbers, dashes, etc.
                cleaned_line = line.lstrip("0123456789-. ")
                if cleaned_line:
                    search_terms.append(cleaned_line)
        
        return {
            "plan": planning_result,
            "search_terms": search_terms[:5]  # Limit to 5 terms
        }
    
    def _retrieve_information(self, task: AgentTask, research_plan: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Retrieve information based on the research plan.
        
        Args:
            task: Research task
            research_plan: Research plan
            
        Returns:
            List of information sources and their content
        """
        search_results = []
        
        # If no tool manager, return empty results
        if not self.tool_manager:
            return search_results
        
        # Get search terms from plan
        search_terms = research_plan.get("search_terms", [])
        
        # If no search terms, extract some from the query
        if not search_terms:
            search_terms = [task.query]
        
        # Perform web search for each search term
        for term in search_terms[:self.max_sources]:
            if "web_search" in self.tool_manager.list_tools():
                result = self.tool_manager.run_tool("web_search", {
                    "query": term,
                    "num_results": min(3, self.max_sources)
                })
                
                if result.success:
                    # Process search results
                    for search_item in result.output.get("results", []):
                        # Skip if we've reached max sources
                        if len(search_results) >= self.max_sources:
                            break
                        
                        # Get the content from the URL if possible
                        content = search_item.get("snippet", "")
                        url = search_item.get("url", "")
                        
                        # Optionally fetch more content with HTTP client
                        if "http_client" in self.tool_manager.list_tools() and url:
                            try:
                                http_result = self.tool_manager.run_tool("http_client", {
                                    "url": url,
                                    "method": "GET"
                                })
                                
                                if http_result.success:
                                    # Extract content from HTML
                                    html_content = http_result.output.get("body", "")
                                    if isinstance(html_content, str) and len(html_content) > len(content):
                                        content = self._extract_text_from_html(html_content)
                            except Exception as e:
                                logger.warning(f"Error fetching URL content: {str(e)}")
                        
                        search_results.append({
                            "title": search_item.get("title", "Untitled"),
                            "url": url,
                            "content": content,
                            "search_term": term
                        })
        
        # If using memory, check for relevant past information
        if self.memory_manager:
            memory_results = self.memory_manager.search(task.query, k=3)
            
            for memory_item in memory_results:
                # Skip if we've reached max sources
                if len(search_results) >= self.max_sources:
                    break
                
                search_results.append({
                    "title": f"Memory: {memory_item.get('metadata', {}).get('type', 'Information')}",
                    "url": "",
                    "content": memory_item.get("content", ""),
                    "search_term": "memory",
                    "from_memory": True
                })
        
        return search_results
    
    def _extract_text_from_html(self, html_content: str) -> str:
        """Extract readable text from HTML content.
        
        This is a simple implementation. In a production system, 
        consider using a library like BeautifulSoup.
        
        Args:
            html_content: HTML content
            
        Returns:
            Extracted text
        """
        # Simple tag stripping - not comprehensive but functional for basic HTML
        text = html_content
        
        # Remove script and style tags with content
        import re
        text = re.sub(r'<script.*?>.*?</script>', ' ', text, flags=re.DOTALL)
        text = re.sub(r'<style.*?>.*?</style>', ' ', text, flags=re.DOTALL)
        
        # Remove all HTML tags
        text = re.sub(r'<[^>]*>', ' ', text)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Limit length
        max_length = 5000
        if len(text) > max_length:
            text = text[:max_length] + "..."
        
        return text
    
    def _synthesize_findings(self, task: AgentTask, search_results: List[Dict[str, Any]]) -> str:
        """Synthesize findings into a coherent response.
        
        Args:
            task: Research task
            search_results: Retrieved information
            
        Returns:
            Synthesized findings
        """
        if not search_results:
            return "No information found for the given query."
        
        # Prepare sources text
        sources_text = ""
        for i, source in enumerate(search_results):
            # Truncate content if too long
            content = source.get("content", "")
            if len(content) > 1000:
                content = content[:1000] + "..."
                
            sources_text += f"\nSOURCE {i+1}: {source.get('title', 'Untitled')}\n"
            sources_text += f"URL: {source.get('url', 'None')}\n"
            sources_text += f"CONTENT: {content}\n"
            sources_text += "-" * 40 + "\n"
        
        # Create synthesis prompt
        prompt = f"""
RESEARCH TASK: {task.query}

SOURCES:
{sources_text}

Based on the sources above, provide a comprehensive synthesis that answers the research task.
Include key facts, different perspectives, and cite sources by number (e.g., [SOURCE 1]).
If the sources don't contain enough information to fully answer the question, note what's missing.

SYNTHESIS:
"""
        
        # Generate synthesis
        synthesis = self.model_provider(prompt)
        
        return synthesis 