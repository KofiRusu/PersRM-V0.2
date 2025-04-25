#!/usr/bin/env python3
"""
Tool Testing Script

This script tests the tool functionalities in PersLM by registering and executing
various tools.
"""

import os
import sys
import argparse
import logging
import json

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import tool modules
from src.tools import ToolManager
from src.tools.file_tools import FileReader, FileWriter
from src.tools.shell_tools import ShellExecutor
from src.tools.web_tools import HTTPClient, WebSearchTool
from src.tools.calculator import Calculator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def setup_tool_manager():
    """Set up and configure the tool manager."""
    tool_manager = ToolManager()
    
    # Register tools
    tool_manager.register_tools([
        FileReader(),
        FileWriter(),
        ShellExecutor({
            "blocked_commands": ["rm", "sudo", "mv", "chmod"],
            "default_timeout": 5
        }),
        HTTPClient({
            "timeout": 10,
            "max_content_length": 1024 * 1024,  # 1 MB
            "blocked_domains": ["example.com"]
        }),
        WebSearchTool(),
        Calculator()
    ])
    
    return tool_manager

def test_file_tools(tool_manager):
    """Test file tools."""
    logger.info("Testing file tools...")
    
    # Create a test file
    test_file_path = os.path.join("data", "test_file.txt")
    test_content = "This is a test file.\nIt has multiple lines.\nUsed for testing file tools."
    
    # Create data directory if it doesn't exist
    os.makedirs(os.path.dirname(test_file_path), exist_ok=True)
    
    # Test file writing
    logger.info("Testing FileWriter tool...")
    write_result = tool_manager.run_tool("file_writer", {
        "path": test_file_path,
        "content": test_content
    })
    
    if write_result.success:
        logger.info("FileWriter test successful.")
        logger.info(f"Result: {write_result.to_text()}")
    else:
        logger.error(f"FileWriter test failed: {write_result.error_message}")
    
    # Test file reading
    logger.info("Testing FileReader tool...")
    read_result = tool_manager.run_tool("file_reader", {
        "path": test_file_path
    })
    
    if read_result.success:
        logger.info("FileReader test successful.")
        logger.info(f"Result: {read_result.output}")
        
        # Verify content
        if read_result.output == test_content:
            logger.info("Content verification successful.")
        else:
            logger.error("Content verification failed: content doesn't match.")
    else:
        logger.error(f"FileReader test failed: {read_result.error_message}")
    
    return read_result.success and write_result.success

def test_shell_tool(tool_manager):
    """Test shell execution tool."""
    logger.info("Testing shell tool...")
    
    # Test simple command
    logger.info("Testing simple shell command...")
    shell_result = tool_manager.run_tool("shell_executor", {
        "command": "echo 'Hello from the shell'"
    })
    
    if shell_result.success:
        logger.info("Shell command test successful.")
        logger.info(f"Result: {shell_result.to_text()}")
    else:
        logger.error(f"Shell command test failed: {shell_result.error_message}")
    
    # Test blocked command
    logger.info("Testing blocked shell command...")
    blocked_result = tool_manager.run_tool("shell_executor", {
        "command": "sudo echo 'This should be blocked'"
    })
    
    if not blocked_result.success:
        logger.info("Blocked command test successful (command was correctly blocked).")
    else:
        logger.error("Blocked command test failed (command was not blocked).")
    
    return shell_result.success and not blocked_result.success

def test_calculator_tool(tool_manager):
    """Test calculator tool."""
    logger.info("Testing calculator tool...")
    
    # Test simple calculation
    logger.info("Testing simple calculation...")
    calc_result = tool_manager.run_tool("calculator", {
        "expression": "2 + 2 * 3"
    })
    
    if calc_result.success:
        logger.info("Calculator test successful.")
        logger.info(f"Result: {calc_result.to_text()}")
        
        # Verify result
        result = calc_result.output.get("result")
        expected = 8
        if result == expected:
            logger.info(f"Result verification successful: {result} == {expected}")
        else:
            logger.error(f"Result verification failed: {result} != {expected}")
    else:
        logger.error(f"Calculator test failed: {calc_result.error_message}")
    
    # Test more complex calculation
    logger.info("Testing complex calculation...")
    complex_calc_result = tool_manager.run_tool("calculator", {
        "expression": "sin(pi/4) + cos(pi/3)",
        "precision": 4
    })
    
    if complex_calc_result.success:
        logger.info("Complex calculator test successful.")
        logger.info(f"Result: {complex_calc_result.to_text()}")
    else:
        logger.error(f"Complex calculator test failed: {complex_calc_result.error_message}")
    
    return calc_result.success and complex_calc_result.success

def test_http_tool(tool_manager):
    """Test HTTP client tool."""
    logger.info("Testing HTTP client tool...")
    
    # Test simple GET request
    logger.info("Testing simple GET request...")
    http_result = tool_manager.run_tool("http_client", {
        "url": "https://httpbin.org/get",
        "method": "GET"
    })
    
    if http_result.success:
        logger.info("HTTP GET test successful.")
        logger.info(f"Status code: {http_result.output.get('status_code')}")
    else:
        logger.error(f"HTTP GET test failed: {http_result.error_message}")
    
    # Test POST request
    logger.info("Testing POST request...")
    post_result = tool_manager.run_tool("http_client", {
        "url": "https://httpbin.org/post",
        "method": "POST",
        "json": {"hello": "world"}
    })
    
    if post_result.success:
        logger.info("HTTP POST test successful.")
        logger.info(f"Status code: {post_result.output.get('status_code')}")
    else:
        logger.error(f"HTTP POST test failed: {post_result.error_message}")
    
    # Test blocked domain
    logger.info("Testing blocked domain...")
    blocked_result = tool_manager.run_tool("http_client", {
        "url": "https://example.com",
        "method": "GET"
    })
    
    if not blocked_result.success:
        logger.info("Blocked domain test successful (domain was correctly blocked).")
    else:
        logger.error("Blocked domain test failed (domain was not blocked).")
    
    return http_result.success and post_result.success and not blocked_result.success

def test_web_search_tool(tool_manager):
    """Test web search tool."""
    logger.info("Testing web search tool...")
    
    # Test search
    logger.info("Testing search...")
    search_result = tool_manager.run_tool("web_search", {
        "query": "PersLM language model",
        "num_results": 3
    })
    
    if search_result.success:
        logger.info("Web search test successful.")
        logger.info(f"Found {len(search_result.output.get('results', []))} results.")
        
        # Print first result
        if search_result.output.get('results'):
            first_result = search_result.output['results'][0]
            logger.info(f"First result: {first_result.get('title')}")
    else:
        logger.error(f"Web search test failed: {search_result.error_message}")
    
    return search_result.success

def test_tool_parsing(tool_manager):
    """Test parsing of tool calls."""
    logger.info("Testing tool call parsing...")
    
    # Test JSON format
    logger.info("Testing JSON-format tool call...")
    json_call = '{"name": "calculator", "parameters": {"expression": "1 + 1"}}'
    json_result = tool_manager.parse_and_run_tool(json_call)
    
    if json_result.success:
        logger.info("JSON tool call parsing successful.")
        logger.info(f"Result: {json_result.output.get('result')}")
    else:
        logger.error(f"JSON tool call parsing failed: {json_result.error_message}")
    
    # Test text format
    logger.info("Testing text-format tool call...")
    text_call = 'calculator(expression="1 + 1")'
    text_result = tool_manager.parse_and_run_tool(text_call)
    
    if text_result.success:
        logger.info("Text tool call parsing successful.")
        logger.info(f"Result: {text_result.output.get('result')}")
    else:
        logger.error(f"Text tool call parsing failed: {text_result.error_message}")
    
    return json_result.success and text_result.success

def main():
    parser = argparse.ArgumentParser(description='Test PersLM tools')
    parser.add_argument('--test', choices=['all', 'file', 'shell', 'calc', 'http', 'search', 'parsing'], 
                        default='all', help='Test to run')
    parser.add_argument('--json', action='store_true', help='Output results as JSON')
    
    args = parser.parse_args()
    
    tool_manager = setup_tool_manager()
    logger.info(f"Registered tools: {', '.join(tool_manager.tools.keys())}")
    
    results = {}
    
    if args.test in ['all', 'file']:
        results['file_tools'] = test_file_tools(tool_manager)
    
    if args.test in ['all', 'shell']:
        results['shell_tool'] = test_shell_tool(tool_manager)
    
    if args.test in ['all', 'calc']:
        results['calculator_tool'] = test_calculator_tool(tool_manager)
    
    if args.test in ['all', 'http']:
        results['http_tool'] = test_http_tool(tool_manager)
    
    if args.test in ['all', 'search']:
        results['web_search_tool'] = test_web_search_tool(tool_manager)
    
    if args.test in ['all', 'parsing']:
        results['tool_parsing'] = test_tool_parsing(tool_manager)
    
    # Output results
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        logger.info("Test results:")
        for test_name, success in results.items():
            logger.info(f"  {test_name}: {'SUCCESS' if success else 'FAILED'}")
    
    # Overall success
    all_success = all(results.values())
    if all_success:
        logger.info("All tests passed successfully!")
        return 0
    else:
        logger.error("Some tests failed. See details above.")
        return 1

if __name__ == '__main__':
    sys.exit(main()) 