#!/usr/bin/env python3
"""
PersLM Core CLI Interface
-------------------------
Python interface to the PersLM Core reasoning engine.
This provides a bridge to the underlying JavaScript/TypeScript CLI
while also exposing native Python functionality.
"""

import os
import sys
import json
import argparse
import subprocess
from typing import List, Dict, Any, Optional

# Directory of this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def run_js_cli(args: List[str]) -> int:
    """
    Run the JavaScript CLI with the given arguments.
    
    Args:
        args: Command-line arguments to pass to the JS CLI
        
    Returns:
        Exit code from the CLI process
    """
    # Check if we have a built CLI
    if os.path.exists(os.path.join(SCRIPT_DIR, "dist", "cli", "persrm-cli.js")):
        cli_path = os.path.join("dist", "cli", "persrm-cli.js")
        cmd = ["node", cli_path] + args
    # Fall back to npm script
    else:
        cmd = ["npm", "run", "cli", "--", *args]
    
    try:
        return subprocess.run(cmd, check=False).returncode
    except Exception as e:
        print(f"Error running JS CLI: {e}")
        return 1

def analyze_command(args: argparse.Namespace) -> int:
    """
    Run an analysis on the target file or directory.
    
    Args:
        args: Parsed command-line arguments
        
    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    print(f"Analyzing {args.target}...")
    
    # Pass to JS CLI for now
    js_args = ["analyze", args.target]
    if args.output:
        js_args.extend(["--output", args.output])
    if args.format:
        js_args.extend(["--format", args.format])
    
    return run_js_cli(js_args)

def optimize_command(args: argparse.Namespace) -> int:
    """
    Optimize the target file or component.
    
    Args:
        args: Parsed command-line arguments
        
    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    print(f"Optimizing {args.target}...")
    
    # Pass to JS CLI
    js_args = ["optimize", args.target]
    if args.level:
        js_args.extend(["--level", args.level])
    if args.output:
        js_args.extend(["--output", args.output])
        
    return run_js_cli(js_args)

def benchmark_command(args: argparse.Namespace) -> int:
    """
    Run benchmarks on the reasoning model.
    
    Args:
        args: Parsed command-line arguments
        
    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    print(f"Running benchmarks ({args.type})...")
    
    # Pass to JS CLI
    js_args = ["benchmark"]
    if args.type:
        js_args.append(args.type)
    if args.output:
        js_args.extend(["--output", args.output])
        
    return run_js_cli(js_args)

def create_argparser() -> argparse.ArgumentParser:
    """
    Create the command-line argument parser.
    
    Returns:
        Configured ArgumentParser instance
    """
    parser = argparse.ArgumentParser(
        description="PersLM Core - Base reasoning model CLI",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )
    
    # Create subparsers for commands
    subparsers = parser.add_subparsers(dest="command", help="Command to run")
    
    # analyze command
    analyze_parser = subparsers.add_parser("analyze", help="Analyze a file or component")
    analyze_parser.add_argument("target", help="File or directory to analyze")
    analyze_parser.add_argument("--output", "-o", help="Output file for analysis results")
    analyze_parser.add_argument("--format", "-f", choices=["json", "html", "md"], 
                               default="json", help="Output format")
    analyze_parser.set_defaults(func=analyze_command)
    
    # optimize command
    optimize_parser = subparsers.add_parser("optimize", help="Optimize a file or component")
    optimize_parser.add_argument("target", help="File or component to optimize")
    optimize_parser.add_argument("--level", "-l", choices=["basic", "advanced"], 
                                default="basic", help="Optimization level")
    optimize_parser.add_argument("--output", "-o", help="Output file for optimized result")
    optimize_parser.set_defaults(func=optimize_command)
    
    # benchmark command
    benchmark_parser = subparsers.add_parser("benchmark", help="Run benchmarks")
    benchmark_parser.add_argument("type", nargs="?", choices=["run", "visualize"], 
                                 default="run", help="Benchmark operation")
    benchmark_parser.add_argument("--output", "-o", help="Output directory for results")
    benchmark_parser.set_defaults(func=benchmark_command)
    
    return parser

def main() -> int:
    """
    Main entry point for the CLI.
    
    Returns:
        Exit code (0 for success, non-zero for failure)
    """
    parser = create_argparser()
    args = parser.parse_args()
    
    # No command specified, show help
    if not args.command:
        parser.print_help()
        return 0
    
    # Run the specified command
    if hasattr(args, "func"):
        return args.func(args)
    else:
        print(f"Unknown command: {args.command}")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 