"""
Web Tools

This module implements tools for web interactions like HTTP requests and web search.
"""

import json
import logging
import re
import time
import requests
from typing import Dict, List, Optional, Any, Union
from urllib.parse import urlparse, urljoin

from src.tools.base import Tool, ToolError

logger = logging.getLogger(__name__)

class HTTPClient(Tool):
    """Tool for making HTTP requests."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the HTTP client tool.
        
        Args:
            config: Configuration for the tool
        """
        super().__init__(
            name="http_client",
            description="Make HTTP requests to websites and APIs",
            config=config
        )
        
        # Default config values
        self.timeout = self.config.get("timeout", 30)  # seconds
        self.max_content_length = self.config.get("max_content_length", 1024 * 1024)  # 1 MB
        self.allowed_domains = self.config.get("allowed_domains", None)  # None means all allowed
        self.blocked_domains = self.config.get("blocked_domains", [])
        self.max_redirects = self.config.get("max_redirects", 5)
        self.user_agent = self.config.get(
            "user_agent", 
            "PersLM/1.0 (Personal Language Model; +https://github.com/yourusername/PersLM)"
        )
    
    def _get_parameter_schema(self) -> Dict[str, Any]:
        """Get the parameter schema for this tool."""
        return {
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": "URL to send the request to"
                },
                "method": {
                    "type": "string",
                    "enum": ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"],
                    "description": "HTTP method",
                    "default": "GET"
                },
                "headers": {
                    "type": "object",
                    "description": "HTTP headers",
                    "additionalProperties": {"type": "string"}
                },
                "params": {
                    "type": "object",
                    "description": "URL parameters",
                    "additionalProperties": {"type": "string"}
                },
                "data": {
                    "type": "object",
                    "description": "Form data to send",
                    "additionalProperties": {"type": "string"}
                },
                "json": {
                    "type": "object",
                    "description": "JSON data to send"
                },
                "timeout": {
                    "type": "number",
                    "description": "Timeout in seconds",
                    "default": 30
                },
                "parse_response": {
                    "type": "boolean",
                    "description": "Whether to parse the response body as JSON",
                    "default": true
                }
            },
            "required": ["url"]
        }
    
    def _is_domain_allowed(self, url: str) -> bool:
        """Check if a domain is allowed.
        
        Args:
            url: URL to check
            
        Returns:
            True if the domain is allowed, False otherwise
        """
        parsed_url = urlparse(url)
        domain = parsed_url.netloc
        
        # Check if domain is blocked
        for blocked in self.blocked_domains:
            if blocked in domain:
                return False
        
        # Check if domain is allowed (if allowlist is provided)
        if self.allowed_domains is not None:
            return any(allowed in domain for allowed in self.allowed_domains)
        
        return True
    
    def execute(
        self, 
        url: str, 
        method: str = "GET", 
        headers: Dict[str, str] = None, 
        params: Dict[str, str] = None,
        data: Dict[str, str] = None,
        json: Dict[str, Any] = None,
        timeout: float = None,
        parse_response: bool = True
    ) -> Dict[str, Any]:
        """Make an HTTP request.
        
        Args:
            url: URL to send the request to
            method: HTTP method
            headers: HTTP headers
            params: URL parameters
            data: Form data to send
            json: JSON data to send
            timeout: Timeout in seconds
            parse_response: Whether to parse the response body as JSON
            
        Returns:
            Dictionary with response data
            
        Raises:
            ToolError: If the request fails
        """
        # Check if domain is allowed
        if not self._is_domain_allowed(url):
            blocked_domains_str = ", ".join(self.blocked_domains)
            raise ToolError(
                f"Domain not allowed: {urlparse(url).netloc}",
                {"blocked_domains": blocked_domains_str}
            )
        
        # Use default timeout if not specified
        if timeout is None:
            timeout = self.timeout
        
        # Prepare headers
        request_headers = {
            "User-Agent": self.user_agent
        }
        if headers:
            request_headers.update(headers)
        
        try:
            # Make the request
            start_time = time.time()
            response = requests.request(
                method=method,
                url=url,
                headers=request_headers,
                params=params,
                data=data,
                json=json,
                timeout=timeout,
                allow_redirects=True,
                max_redirects=self.max_redirects
            )
            
            # Calculate request time
            request_time = time.time() - start_time
            
            # Check content length
            content_length = len(response.content)
            if content_length > self.max_content_length:
                raise ToolError(
                    f"Response too large: {content_length} bytes (max: {self.max_content_length} bytes)"
                )
            
            # Parse response body if requested
            body = None
            if parse_response and response.content:
                content_type = response.headers.get("Content-Type", "")
                if "application/json" in content_type:
                    try:
                        body = response.json()
                    except json.JSONDecodeError:
                        body = response.text
                elif "text/" in content_type:
                    body = response.text
                else:
                    # Binary content - provide basic info but not the raw data
                    body = {
                        "content_type": content_type,
                        "size": content_length,
                        "encoding": response.encoding or "binary"
                    }
            else:
                body = response.text
            
            # Extract HTML title if the response is HTML
            title = None
            if "text/html" in response.headers.get("Content-Type", ""):
                title_match = re.search(r"<title>(.*?)</title>", response.text, re.IGNORECASE | re.DOTALL)
                if title_match:
                    title = title_match.group(1).strip()
            
            return {
                "url": response.url,
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": body,
                "title": title,
                "content_length": content_length,
                "request_time": request_time
            }
            
        except requests.exceptions.Timeout:
            raise ToolError(f"Request timed out after {timeout}s: {url}")
        except requests.exceptions.TooManyRedirects:
            raise ToolError(f"Too many redirects: {url}")
        except requests.exceptions.RequestException as e:
            raise ToolError(f"Request failed: {str(e)}")
        except Exception as e:
            raise ToolError(f"Unexpected error: {str(e)}")


class WebSearchTool(Tool):
    """Tool for performing web searches."""
    
    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the web search tool.
        
        Args:
            config: Configuration for the tool
        """
        super().__init__(
            name="web_search",
            description="Search the web for information",
            config=config
        )
        
        # Default config values
        self.search_engine = self.config.get("search_engine", "duckduckgo")
        self.num_results = self.config.get("num_results", 5)
        self.timeout = self.config.get("timeout", 30)
        self.http_client = HTTPClient(config)
    
    def _get_parameter_schema(self) -> Dict[str, Any]:
        """Get the parameter schema for this tool."""
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query"
                },
                "num_results": {
                    "type": "integer",
                    "description": "Number of results to return",
                    "default": 5
                },
                "search_engine": {
                    "type": "string",
                    "enum": ["duckduckgo", "google", "bing"],
                    "description": "Search engine to use",
                    "default": "duckduckgo"
                }
            },
            "required": ["query"]
        }
    
    def _search_duckduckgo(self, query: str, num_results: int) -> List[Dict[str, Any]]:
        """Search DuckDuckGo.
        
        Args:
            query: Search query
            num_results: Number of results to return
            
        Returns:
            List of search results
        """
        # Note: This is a simplified implementation that uses the HTML site.
        # A better approach would be to use the API if available.
        url = "https://html.duckduckgo.com/html/"
        params = {"q": query}
        
        try:
            response = self.http_client.execute(
                url=url,
                method="POST",
                data=params,
                timeout=self.timeout,
                parse_response=False
            )
            
            if response["status_code"] != 200:
                raise ToolError(f"DuckDuckGo search failed with status code {response['status_code']}")
            
            # Extract search results
            results = []
            html = response["body"]
            
            # Simple regex extraction (a proper HTML parser would be better)
            result_patterns = re.finditer(
                r'<a class="result__a" href="(.*?)".*?>(.*?)</a>.*?<a class="result__snippet".*?>(.*?)</a>',
                html,
                re.DOTALL
            )
            
            for i, match in enumerate(result_patterns):
                if i >= num_results:
                    break
                
                url = match.group(1)
                title = match.group(2)
                snippet = match.group(3)
                
                # Clean up HTML entities and tags
                title = re.sub(r'<.*?>', '', title).strip()
                snippet = re.sub(r'<.*?>', '', snippet).strip()
                
                results.append({
                    "title": title,
                    "url": url,
                    "snippet": snippet
                })
            
            return results
            
        except Exception as e:
            raise ToolError(f"DuckDuckGo search failed: {str(e)}")
    
    def _search_generic(self, query: str, num_results: int, search_engine: str) -> List[Dict[str, Any]]:
        """Placeholder for other search engines.
        
        This would be implemented with proper API integrations.
        
        Args:
            query: Search query
            num_results: Number of results to return
            search_engine: Search engine to use
            
        Returns:
            List of search results
        """
        # This is a placeholder that would be replaced with actual API calls
        return [{
            "title": f"Example result for {query} using {search_engine}",
            "url": f"https://example.com/{query}",
            "snippet": f"This is a placeholder result for the search '{query}' using {search_engine}. In a real implementation, this would use the {search_engine} API."
        }]
    
    def execute(
        self, 
        query: str, 
        num_results: int = None, 
        search_engine: str = None
    ) -> Dict[str, Any]:
        """Perform a web search.
        
        Args:
            query: Search query
            num_results: Number of results to return
            search_engine: Search engine to use
            
        Returns:
            Dictionary with search results
            
        Raises:
            ToolError: If the search fails
        """
        # Use default values if not specified
        if num_results is None:
            num_results = self.num_results
        
        if search_engine is None:
            search_engine = self.search_engine
        
        # Cap number of results
        num_results = min(num_results, 10)
        
        # Perform search based on selected engine
        if search_engine == "duckduckgo":
            results = self._search_duckduckgo(query, num_results)
        else:
            # Use placeholder for other engines
            results = self._search_generic(query, num_results, search_engine)
        
        # Return the results
        return {
            "query": query,
            "search_engine": search_engine,
            "num_results": len(results),
            "results": results
        } 