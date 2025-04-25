#!/usr/bin/env python3
"""
PersLM Desktop Launcher

This script launches the PersLM assistant as a desktop application.
It initializes the core components and keeps the assistant running in the background.
"""

import os
import sys
import time
import logging
import threading
import argparse
from pathlib import Path

# Add the project root to the Python path
script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
root_dir = script_dir.parent.parent
sys.path.insert(0, str(root_dir))

# Import application components
from app.common import config, persistence, notification
from app.desktop import tray_icon, ui_manager

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
        logging.FileHandler(os.path.join("logs", "desktop_app.log")),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("desktop_launcher")


class PersLMDesktopApp:
    """
    Desktop application for PersLM assistant.
    
    This class manages the lifecycle of the PersLM assistant,
    including initialization, background tasks, and UI.
    """
    
    def __init__(self, args):
        """Initialize the desktop application."""
        self.args = args
        self.running = False
        self.realtime_loop = None
        self.autonomy_loop = None
        self.ui_manager = None
        self.tray_icon = None
        
        # Load application configuration
        self.config = config.load_config(args.config)
        
        # Initialize platform-specific components
        self._initialize_platform()
        
        # Initialize core components
        self._initialize_core()
    
    def _initialize_platform(self):
        """Initialize platform-specific components."""
        # Create necessary directories
        os.makedirs("logs", exist_ok=True)
        
        # Initialize persistence system
        persistence.initialize(self.config.get("persistence", {}))
        
        # Initialize notification system
        notification.initialize(self.config.get("notification", {}))
        
        # Initialize UI
        self.ui_manager = ui_manager.UIManager(
            config=self.config.get("ui", {}),
            callback=self._handle_ui_event
        )
        
        # Initialize system tray icon
        self.tray_icon = tray_icon.TrayIcon(
            callback=self._handle_tray_event
        )
    
    def _initialize_core(self):
        """Initialize PersLM core components."""
        try:
            # Initialize real-time interaction loop
            logger.info("Initializing real-time interaction loop...")
            self.realtime_loop = RealtimeLoop(
                config_path=self.args.realtime_config,
                user_id=self.args.user
            )
            
            # Initialize autonomy loop
            logger.info("Initializing autonomy loop...")
            self.autonomy_loop = AutonomyLoop(
                config_path=self.args.autonomy_config,
                autonomy_level=self.args.autonomy
            )
            
            logger.info("Core components initialized successfully")
        
        except Exception as e:
            logger.error(f"Error initializing core components: {e}")
            self.show_error(f"Failed to initialize PersLM: {str(e)}")
            sys.exit(1)
    
    def start(self):
        """Start the desktop application."""
        if self.running:
            logger.warning("Application is already running")
            return
        
        self.running = True
        logger.info("Starting PersLM Desktop Application")
        
        try:
            # Start tray icon
            self.tray_icon.start()
            
            # Start UI if enabled
            if self.args.ui:
                self.ui_manager.start()
            
            # Start autonomy loop if enabled
            if not self.args.no_autonomy:
                self._start_autonomy_loop()
            
            # Start real-time loop if enabled
            if self.args.start_interaction:
                self._start_realtime_loop()
            
            # Display startup notification
            notification.send(
                title="PersLM Assistant",
                message="PersLM Assistant is now running",
                notification_type="info"
            )
            
            # Enter the main loop
            self._main_loop()
        
        except KeyboardInterrupt:
            logger.info("Application interrupted by user")
        except Exception as e:
            logger.error(f"Error in application: {e}")
            self.show_error(f"Application error: {str(e)}")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the desktop application."""
        if not self.running:
            return
        
        logger.info("Stopping PersLM Desktop Application")
        
        # Stop components
        if self.realtime_loop:
            self.realtime_loop.stop()
        
        if self.autonomy_loop:
            self.autonomy_loop.stop()
        
        if self.ui_manager:
            self.ui_manager.stop()
        
        if self.tray_icon:
            self.tray_icon.stop()
        
        # Cleanup
        persistence.save()
        
        self.running = False
        logger.info("Application stopped")
    
    def _main_loop(self):
        """Main application loop."""
        while self.running:
            try:
                # Process events, check status, etc.
                time.sleep(1.0)
                
                # Check if UI has requested exit
                if self.ui_manager and self.ui_manager.exit_requested:
                    logger.info("Exit requested by UI")
                    break
                
                # Check if tray icon has requested exit
                if self.tray_icon and self.tray_icon.exit_requested:
                    logger.info("Exit requested by tray icon")
                    break
                
            except KeyboardInterrupt:
                logger.info("Main loop interrupted by user")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                # Continue running, but log the error
    
    def _start_realtime_loop(self):
        """Start the real-time interaction loop in a separate thread."""
        if not self.realtime_loop:
            logger.warning("Real-time loop not initialized")
            return
        
        # Start in a separate thread
        threading.Thread(
            target=self._realtime_thread,
            name="realtime-thread",
            daemon=True
        ).start()
        
        logger.info("Real-time interaction thread started")
    
    def _realtime_thread(self):
        """Thread function for real-time interaction."""
        try:
            self.realtime_loop.start()
        except Exception as e:
            logger.error(f"Error in real-time interaction thread: {e}")
    
    def _start_autonomy_loop(self):
        """Start the autonomy loop."""
        if not self.autonomy_loop:
            logger.warning("Autonomy loop not initialized")
            return
        
        self.autonomy_loop.start()
        logger.info("Autonomy loop started")
    
    def _handle_ui_event(self, event_type, event_data=None):
        """
        Handle events from the UI.
        
        Args:
            event_type: Type of event
            event_data: Additional event data
        """
        logger.debug(f"UI event: {event_type}, data: {event_data}")
        
        if event_type == "start_conversation":
            self._start_realtime_loop()
        
        elif event_type == "stop_conversation":
            if self.realtime_loop:
                self.realtime_loop.stop()
        
        elif event_type == "toggle_autonomy":
            if self.autonomy_loop and self.autonomy_loop.running:
                self.autonomy_loop.stop()
            else:
                self._start_autonomy_loop()
        
        elif event_type == "change_settings":
            # Update settings
            if event_data:
                self._update_settings(event_data)
        
        elif event_type == "exit":
            self.running = False
    
    def _handle_tray_event(self, event_type, event_data=None):
        """
        Handle events from the system tray icon.
        
        Args:
            event_type: Type of event
            event_data: Additional event data
        """
        logger.debug(f"Tray event: {event_type}, data: {event_data}")
        
        if event_type == "open_ui":
            if self.ui_manager:
                self.ui_manager.show()
        
        elif event_type == "start_conversation":
            self._start_realtime_loop()
        
        elif event_type == "toggle_autonomy":
            if self.autonomy_loop and self.autonomy_loop.running:
                self.autonomy_loop.stop()
            else:
                self._start_autonomy_loop()
        
        elif event_type == "exit":
            self.running = False
    
    def _update_settings(self, settings):
        """
        Update application settings.
        
        Args:
            settings: New settings dictionary
        """
        logger.info(f"Updating settings: {settings}")
        
        # Update config
        config.update_config(settings)
        
        # Apply changes to components
        if "autonomy_level" in settings and self.autonomy_loop:
            self.autonomy_loop.set_autonomy_level(settings["autonomy_level"])
        
        if "voice_enabled" in settings:
            # Update voice settings in realtime_loop
            pass
    
    def show_error(self, message):
        """
        Show an error message.
        
        Args:
            message: Error message
        """
        logger.error(message)
        
        # Show in UI if available
        if self.ui_manager:
            self.ui_manager.show_error(message)
        
        # Show notification
        notification.send(
            title="PersLM Error",
            message=message,
            notification_type="error"
        )


def main():
    """Main entry point for the desktop application."""
    parser = argparse.ArgumentParser(description="PersLM Desktop Application")
    
    # Configuration options
    parser.add_argument("--config", type=str, help="Path to application configuration file")
    parser.add_argument("--realtime-config", type=str, help="Path to real-time interaction configuration")
    parser.add_argument("--autonomy-config", type=str, help="Path to autonomy loop configuration")
    
    # User options
    parser.add_argument("--user", type=str, default="default_user", help="User ID")
    parser.add_argument("--autonomy", type=str, choices=["disabled", "assisted", "supervised", "full"],
                      help="Autonomy level")
    
    # Startup options
    parser.add_argument("--ui", action="store_true", help="Show UI on startup")
    parser.add_argument("--start-interaction", action="store_true", help="Start conversation on startup")
    parser.add_argument("--no-autonomy", action="store_true", help="Disable autonomy loop")
    parser.add_argument("--tray-only", action="store_true", help="Start in tray without UI")
    
    # Parse arguments
    args = parser.parse_args()
    
    # Create and start the application
    app = PersLMDesktopApp(args)
    app.start()


if __name__ == "__main__":
    main() 