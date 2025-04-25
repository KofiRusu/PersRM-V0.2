#!/usr/bin/env python3
"""
PersLM CLI Entry Point

This script provides a command-line interface for interacting with the PersLM assistant.
It supports conversation mode, task execution, and system management.
"""

import os
import sys
import cmd
import time
import json
import shlex
import logging
import argparse
import threading
from pathlib import Path
from typing import Optional, Dict, Any, List

# Add the project root to the Python path
script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
root_dir = script_dir.parent.parent
sys.path.insert(0, str(root_dir))

# Import application components
from app.common import config, persistence, notification

# Import PersLM core components
try:
    from src.realtime.realtime_loop import RealtimeLoop
    from src.loop.autonomy_loop import AutonomyLoop
    from src.personalization import personalization_manager
except ImportError as e:
    print(f"Error importing PersLM components: {e}")
    print("Make sure you're running from the correct directory.")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(os.path.join("logs", "cli_app.log")),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("cli_entry")

# Terminal colors
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    USER = "\033[94m"  # Blue for user
    ASSISTANT = "\033[92m"  # Green for assistant
    SYSTEM = "\033[93m"  # Yellow for system
    ERROR = "\033[91m"  # Red for errors


class PersLMCLI(cmd.Cmd):
    """Interactive CLI for PersLM Assistant."""
    
    intro = f"""{Colors.BOLD}{Colors.CYAN}
    ╔═══════════════════════════════════════════╗
    ║                 PersLM CLI                 ║
    ║          Personal Language Model           ║
    ╚═══════════════════════════════════════════╝{Colors.RESET}
    
    Type 'help' or '?' to list commands.
    Type 'chat' to start a conversation.
    Type 'exit' to quit.
    """
    prompt = f"{Colors.BOLD}{Colors.CYAN}PersLM>{Colors.RESET} "
    
    def __init__(self, args):
        """Initialize the CLI application."""
        super().__init__()
        self.args = args
        self.config = config.load_config(args.config)
        self.realtime_loop = None
        self.autonomy_loop = None
        self.conversation_active = False
        self.autonomy_active = False
        self.user_id = args.user
        
        # Initialize components
        self._initialize_components()
        
        # Start autonomy if requested
        if args.autonomy_level != "disabled" and not args.no_autonomy:
            self.do_start_autonomy("")
    
    def _initialize_components(self):
        """Initialize PersLM components."""
        try:
            # Create necessary directories
            os.makedirs("logs", exist_ok=True)
            
            # Initialize persistence system
            persistence.initialize(self.config.get("persistence", {}))
            
            # Initialize notification system for CLI
            notification.initialize(
                self.config.get("notification", {}),
                handler=self._handle_notification
            )
            
            # Initialize real-time interaction loop
            logger.info("Initializing real-time interaction loop...")
            self.realtime_loop = RealtimeLoop(
                config_path=self.args.realtime_config,
                user_id=self.user_id,
                model_provider=self._model_provider
            )
            
            # Initialize autonomy loop
            logger.info("Initializing autonomy loop...")
            self.autonomy_loop = AutonomyLoop(
                config_path=self.args.autonomy_config,
                autonomy_level=self.args.autonomy_level
            )
            
            logger.info("Components initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing components: {e}")
            print(f"{Colors.ERROR}Error initializing PersLM: {str(e)}{Colors.RESET}")
            sys.exit(1)
    
    def _model_provider(self, prompt, streaming=False):
        """Custom model provider for CLI interaction."""
        if streaming:
            # This would normally stream from the model
            # For now, we'll just simulate with a simple implementation
            response = f"This is a simulated streaming response for: {prompt}"
            words = response.split()
            for word in words:
                yield word + " "
                time.sleep(0.05)
        else:
            # Non-streaming response
            return f"This is a simulated response for: {prompt}"
    
    def _handle_notification(self, title, message, notification_type):
        """Handle notifications in CLI environment."""
        type_color = {
            "info": Colors.CYAN,
            "warning": Colors.YELLOW,
            "error": Colors.RED,
            "success": Colors.GREEN
        }.get(notification_type, Colors.RESET)
        
        print(f"\n{type_color}{Colors.BOLD}[{title}]{Colors.RESET} {message}")
    
    def emptyline(self):
        """Do nothing on empty line."""
        pass
    
    def default(self, line):
        """Handle unknown commands as conversation input."""
        if self.conversation_active:
            self._process_user_input(line)
        else:
            print(f"{Colors.YELLOW}Unknown command: {line}{Colors.RESET}")
            print(f"{Colors.YELLOW}Type 'help' to see available commands, or 'chat' to start a conversation.{Colors.RESET}")
    
    def do_exit(self, arg):
        """Exit the application."""
        print(f"{Colors.CYAN}Goodbye!{Colors.RESET}")
        return True
    
    def do_quit(self, arg):
        """Exit the application."""
        return self.do_exit(arg)
    
    def do_EOF(self, arg):
        """Exit on Ctrl-D."""
        print()  # Add newline
        return self.do_exit(arg)
    
    def do_chat(self, arg):
        """Start a conversation with PersLM."""
        if self.conversation_active:
            print(f"{Colors.YELLOW}Conversation is already active.{Colors.RESET}")
            return
        
        self.conversation_active = True
        print(f"\n{Colors.CYAN}Starting conversation. Type 'exit' or press Ctrl+C to end.{Colors.RESET}")
        print(f"{Colors.CYAN}Type your messages and press Enter to send.{Colors.RESET}\n")
        
        # Change prompt for conversation mode
        self.prompt = f"{Colors.BOLD}{Colors.USER}You>{Colors.RESET} "
        
        # If speech is enabled, start the realtime loop
        if self.args.voice:
            self._start_voice_conversation()
    
    def _start_voice_conversation(self):
        """Start a voice conversation."""
        if not self.realtime_loop:
            print(f"{Colors.ERROR}Error: Real-time loop not initialized.{Colors.RESET}")
            return
        
        print(f"{Colors.CYAN}Starting voice conversation. Please speak...{Colors.RESET}")
        
        # Start in a separate thread
        threading.Thread(
            target=self._voice_thread,
            name="voice-thread",
            daemon=True
        ).start()
    
    def _voice_thread(self):
        """Thread function for voice conversation."""
        try:
            self.realtime_loop.start()
        except Exception as e:
            logger.error(f"Error in voice thread: {e}")
            print(f"\n{Colors.ERROR}Error in voice conversation: {str(e)}{Colors.RESET}")
            self.conversation_active = False
            self.prompt = f"{Colors.BOLD}{Colors.CYAN}PersLM>{Colors.RESET} "
    
    def _process_user_input(self, user_input):
        """Process user input in conversation mode."""
        # Check for exit command
        if user_input.lower() in ('exit', 'quit', 'end'):
            print(f"{Colors.CYAN}Ending conversation.{Colors.RESET}")
            self.conversation_active = False
            self.prompt = f"{Colors.BOLD}{Colors.CYAN}PersLM>{Colors.RESET} "
            return
        
        # Process input and get response
        try:
            if self.args.voice:
                # Voice mode is handled by the realtime_loop thread
                # Just echo the user input
                pass
            else:
                # Text mode - process manually
                print(f"{Colors.BOLD}{Colors.ASSISTANT}PersLM>{Colors.RESET} ", end="", flush=True)
                
                # Get response from model
                # This would normally use the model directly
                response = f"This is a simulated response to: {user_input}"
                
                # Print response with slight delay for realism
                for word in response.split():
                    print(f"{word} ", end="", flush=True)
                    time.sleep(0.05)
                print()
        
        except KeyboardInterrupt:
            print(f"\n{Colors.YELLOW}Response interrupted.{Colors.RESET}")
        except Exception as e:
            logger.error(f"Error processing input: {e}")
            print(f"\n{Colors.ERROR}Error: {str(e)}{Colors.RESET}")
    
    def do_start_autonomy(self, arg):
        """Start the autonomy loop."""
        if self.autonomy_active:
            print(f"{Colors.YELLOW}Autonomy loop is already running.{Colors.RESET}")
            return
        
        if not self.autonomy_loop:
            print(f"{Colors.ERROR}Error: Autonomy loop not initialized.{Colors.RESET}")
            return
        
        try:
            self.autonomy_loop.start()
            self.autonomy_active = True
            print(f"{Colors.GREEN}Autonomy loop started successfully.{Colors.RESET}")
        except Exception as e:
            logger.error(f"Error starting autonomy loop: {e}")
            print(f"{Colors.ERROR}Error starting autonomy loop: {str(e)}{Colors.RESET}")
    
    def do_stop_autonomy(self, arg):
        """Stop the autonomy loop."""
        if not self.autonomy_active:
            print(f"{Colors.YELLOW}Autonomy loop is not running.{Colors.RESET}")
            return
        
        try:
            self.autonomy_loop.stop()
            self.autonomy_active = False
            print(f"{Colors.GREEN}Autonomy loop stopped successfully.{Colors.RESET}")
        except Exception as e:
            logger.error(f"Error stopping autonomy loop: {e}")
            print(f"{Colors.ERROR}Error stopping autonomy loop: {str(e)}{Colors.RESET}")
    
    def do_status(self, arg):
        """Display the status of PersLM components."""
        print(f"\n{Colors.BOLD}{Colors.CYAN}PersLM Status:{Colors.RESET}")
        print(f"  User: {self.user_id}")
        print(f"  Conversation: {'Active' if self.conversation_active else 'Inactive'}")
        print(f"  Autonomy Loop: {'Active' if self.autonomy_active else 'Inactive'}")
        print(f"  Voice Mode: {'Enabled' if self.args.voice else 'Disabled'}")
        
        # Add more status information as needed
        # For example, you could show recent tasks, memory usage, etc.
    
    def do_set(self, arg):
        """Set a configuration value: set [key] [value]"""
        args = shlex.split(arg)
        if len(args) < 2:
            print(f"{Colors.YELLOW}Usage: set [key] [value]{Colors.RESET}")
            return
        
        key = args[0]
        value = args[1]
        
        # Convert value to appropriate type
        if value.lower() in ('true', 'yes', 'on'):
            value = True
        elif value.lower() in ('false', 'no', 'off'):
            value = False
        elif value.isdigit():
            value = int(value)
        elif value.replace('.', '', 1).isdigit() and value.count('.') <= 1:
            value = float(value)
        
        # Update configuration
        try:
            config.set_config_value(key, value)
            print(f"{Colors.GREEN}Configuration updated: {key} = {value}{Colors.RESET}")
        except Exception as e:
            logger.error(f"Error updating configuration: {e}")
            print(f"{Colors.ERROR}Error updating configuration: {str(e)}{Colors.RESET}")
    
    def do_get(self, arg):
        """Get a configuration value: get [key]"""
        key = arg.strip()
        if not key:
            print(f"{Colors.YELLOW}Usage: get [key]{Colors.RESET}")
            return
        
        try:
            value = config.get_config_value(key)
            print(f"{Colors.CYAN}{key} = {value}{Colors.RESET}")
        except Exception as e:
            logger.error(f"Error getting configuration: {e}")
            print(f"{Colors.ERROR}Error getting configuration: {str(e)}{Colors.RESET}")
    
    def do_list_tasks(self, arg):
        """List scheduled and active tasks."""
        if not self.autonomy_loop:
            print(f"{Colors.ERROR}Error: Autonomy loop not initialized.{Colors.RESET}")
            return
        
        try:
            # This would normally get tasks from the autonomy loop
            # For now, we'll just show a placeholder message
            print(f"\n{Colors.CYAN}Scheduled Tasks:{Colors.RESET}")
            print("  1. Daily Review (daily, 03:00)")
            print("  2. Memory Consolidation (every 12 hours)")
            print("  3. News Update (daily, 07:00)")
            
            print(f"\n{Colors.CYAN}Active Tasks:{Colors.RESET}")
            print("  No active tasks")
            
        except Exception as e:
            logger.error(f"Error listing tasks: {e}")
            print(f"{Colors.ERROR}Error listing tasks: {str(e)}{Colors.RESET}")
    
    def do_help(self, arg):
        """Show help for commands."""
        if not arg:
            print(f"\n{Colors.BOLD}{Colors.CYAN}Available Commands:{Colors.RESET}")
            print(f"  {Colors.BOLD}chat{Colors.RESET} - Start a conversation with PersLM")
            print(f"  {Colors.BOLD}start_autonomy{Colors.RESET} - Start the autonomy loop")
            print(f"  {Colors.BOLD}stop_autonomy{Colors.RESET} - Stop the autonomy loop")
            print(f"  {Colors.BOLD}status{Colors.RESET} - Display component status")
            print(f"  {Colors.BOLD}set{Colors.RESET} - Set a configuration value")
            print(f"  {Colors.BOLD}get{Colors.RESET} - Get a configuration value")
            print(f"  {Colors.BOLD}list_tasks{Colors.RESET} - List scheduled and active tasks")
            print(f"  {Colors.BOLD}exit{Colors.RESET}, {Colors.BOLD}quit{Colors.RESET} - Exit the application")
            print(f"  {Colors.BOLD}help{Colors.RESET} - Show this help message")
            print(f"\nType {Colors.BOLD}help [command]{Colors.RESET} for more information about a specific command.")
        else:
            # Call the default cmd.Cmd help method
            super().do_help(arg)
    
    def do_version(self, arg):
        """Show version information."""
        print(f"\n{Colors.BOLD}{Colors.CYAN}PersLM Version Information:{Colors.RESET}")
        print(f"  Version: 1.0.0")
        print(f"  Build: Development")
        print(f"  Python: {sys.version.split()[0]}")
        print(f"  Platform: {sys.platform}")


def main():
    """Main entry point for CLI application."""
    parser = argparse.ArgumentParser(description="PersLM CLI Application")
    
    # Configuration options
    parser.add_argument("--config", type=str, help="Path to application configuration file")
    parser.add_argument("--realtime-config", type=str, help="Path to real-time interaction configuration")
    parser.add_argument("--autonomy-config", type=str, help="Path to autonomy loop configuration")
    
    # User options
    parser.add_argument("--user", type=str, default="default_user", help="User ID")
    parser.add_argument("--autonomy-level", type=str, choices=["disabled", "assisted", "supervised", "full"],
                      default="supervised", help="Autonomy level")
    
    # Feature flags
    parser.add_argument("--voice", action="store_true", help="Enable voice conversation")
    parser.add_argument("--no-autonomy", action="store_true", help="Disable autonomy loop")
    parser.add_argument("--no-color", action="store_true", help="Disable colored output")
    
    # Command execution
    parser.add_argument("--exec", type=str, help="Execute a command and exit")
    
    # Parse arguments
    args = parser.parse_args()
    
    # Disable colors if requested or if not in a terminal
    if args.no_color or not sys.stdout.isatty():
        for attr in dir(Colors):
            if not attr.startswith('__'):
                setattr(Colors, attr, '')
    
    # Execute a single command if requested
    if args.exec:
        # Create CLI instance
        cli = PersLMCLI(args)
        
        # Execute the command
        cli.onecmd(args.exec)
        
        # Exit
        return
    
    # Start interactive CLI
    try:
        cli = PersLMCLI(args)
        cli.cmdloop()
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        # Cleanup
        if hasattr(cli, 'autonomy_loop') and cli.autonomy_loop:
            cli.autonomy_loop.stop()
        
        if hasattr(cli, 'realtime_loop') and cli.realtime_loop:
            cli.realtime_loop.stop()
        
        persistence.save()


if __name__ == "__main__":
    main() 