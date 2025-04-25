#!/usr/bin/env python3
"""
PersLM Embedded Launcher

This script launches PersLM in embedded mode, optimized for IoT, Raspberry Pi,
and other resource-constrained environments.
"""

import os
import sys
import time
import json
import logging
import argparse
import threading
from pathlib import Path

# Add project root to Python path
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

logger = logging.getLogger("embedded_launcher")


class PersLMEmbedded:
    """
    Embedded launcher for PersLM on resource-constrained devices.
    
    Features:
    - Optimized for low memory and CPU usage
    - Supports headless operation
    - Integrates with IoT sensors and outputs
    """
    
    def __init__(self, args):
        """Initialize the embedded application."""
        self.args = args
        self.running = False
        self.realtime_loop = None
        self.autonomy_loop = None
        
        # Configure logging
        log_level = getattr(logging, args.log_level.upper())
        logging.basicConfig(
            level=log_level,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            handlers=[
                logging.FileHandler(os.path.join("logs", "embedded_app.log")),
                logging.StreamHandler()
            ]
        )
        
        # Load configuration
        logger.info("Loading configuration...")
        self.config = config.load_config(args.config)
        
        # Update with embedded-specific settings
        self._apply_embedded_optimizations()
        
        # Initialize components
        self._initialize_components()
    
    def _apply_embedded_optimizations(self):
        """Apply embedded-specific optimizations to config."""
        # Override memory-intensive settings
        embedded_overrides = {
            "performance.memory_limit": 512,  # MB
            "performance.low_power_mode": True,
            "performance.offload_to_gpu": False,  # Most embedded devices don't have GPUs
            "realtime.model_size": "tiny",  # Use smaller models
            "autonomy.max_concurrent_tasks": 1,  # Limit concurrent tasks
            "ui.ui_type": "minimal"  # Use minimal UI
        }
        
        for key, value in embedded_overrides.items():
            config.set_config_value(key, value, save=False)
        
        logger.info("Applied embedded optimizations")
    
    def _initialize_components(self):
        """Initialize system components."""
        try:
            # Create necessary directories
            os.makedirs("logs", exist_ok=True)
            
            # Initialize persistence system
            logger.info("Initializing persistence system...")
            persistence.initialize(self.config.get("persistence", {}))
            
            # Initialize notification system
            logger.info("Initializing notification system...")
            notification.initialize(
                self.config.get("notification", {}),
                handler=self._handle_notification
            )
            
            # Initialize real-time interaction loop with optimized settings
            logger.info("Initializing real-time interaction loop...")
            realtime_config = self.args.realtime_config
            
            # Use embedded-optimized config if available
            embedded_realtime_config = os.path.join(
                os.path.dirname(realtime_config), 
                "embedded_config.yaml"
            )
            if os.path.exists(embedded_realtime_config):
                realtime_config = embedded_realtime_config
            
            self.realtime_loop = RealtimeLoop(
                config_path=realtime_config,
                user_id=self.args.user
            )
            
            # Initialize autonomy loop with optimized settings
            logger.info("Initializing autonomy loop...")
            autonomy_config = self.args.autonomy_config
            
            # Use embedded-optimized config if available
            embedded_autonomy_config = os.path.join(
                os.path.dirname(autonomy_config), 
                "embedded_config.yaml"
            )
            if os.path.exists(embedded_autonomy_config):
                autonomy_config = embedded_autonomy_config
            
            self.autonomy_loop = AutonomyLoop(
                config_path=autonomy_config,
                autonomy_level=self.args.autonomy_level
            )
            
            logger.info("Components initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing components: {e}")
            raise
    
    def _handle_notification(self, title, message, notification_type):
        """Handle notifications in embedded environment."""
        # In embedded environment, log all notifications
        log_level = {
            "info": logging.INFO,
            "warning": logging.WARNING,
            "error": logging.ERROR,
            "success": logging.INFO
        }.get(notification_type, logging.INFO)
        
        logger.log(log_level, f"[{title}] {message}")
        
        # Send to IoT infrastructure if configured
        # TODO: Implement IoT integration
    
    def start(self):
        """Start the embedded application."""
        if self.running:
            logger.warning("Application already running")
            return
        
        self.running = True
        logger.info("Starting PersLM Embedded Application")
        
        try:
            # Start autonomy loop if enabled
            if not self.args.no_autonomy:
                self._start_autonomy_loop()
            
            # Start real-time loop if interactive mode is enabled
            if self.args.interactive:
                self._start_realtime_loop()
            
            # Enter main loop
            self._main_loop()
            
        except KeyboardInterrupt:
            logger.info("Application interrupted by user")
        except Exception as e:
            logger.error(f"Error running application: {e}")
        finally:
            self.stop()
    
    def stop(self):
        """Stop the embedded application."""
        if not self.running:
            return
        
        logger.info("Stopping PersLM Embedded Application")
        
        # Stop components
        if self.realtime_loop:
            self.realtime_loop.stop()
        
        if self.autonomy_loop:
            self.autonomy_loop.stop()
        
        # Save state
        persistence.save()
        
        self.running = False
        logger.info("Application stopped")
    
    def _main_loop(self):
        """Main application loop."""
        while self.running:
            try:
                # Process system events, check health, etc.
                self._check_system_health()
                
                # Sleep a bit to reduce CPU usage
                time.sleep(5.0)
                
            except KeyboardInterrupt:
                logger.info("Main loop interrupted by user")
                break
            except Exception as e:
                logger.error(f"Error in main loop: {e}")
                # Continue running, but log the error
    
    def _check_system_health(self):
        """Check system health and resources."""
        # Only check every minute to reduce overhead
        if int(time.time()) % 60 == 0:
            try:
                # Check memory usage
                import psutil
                memory = psutil.virtual_memory()
                memory_percent = memory.percent
                
                if memory_percent > 90:
                    logger.warning(f"High memory usage: {memory_percent}%")
                    # Take action to reduce memory usage
                    self._reduce_memory_usage()
                
                # Check CPU usage
                cpu_percent = psutil.cpu_percent(interval=1)
                if cpu_percent > 80:
                    logger.warning(f"High CPU usage: {cpu_percent}%")
                
                # Check disk space
                disk = psutil.disk_usage('/')
                if disk.percent > 90:
                    logger.warning(f"Low disk space: {disk.percent}% used")
                
                # Log system status at debug level
                logger.debug(f"System health: Memory {memory_percent}%, CPU {cpu_percent}%, Disk {disk.percent}%")
                
            except ImportError:
                # psutil not available
                logger.debug("psutil not available, skipping system health check")
            except Exception as e:
                logger.error(f"Error checking system health: {e}")
    
    def _reduce_memory_usage(self):
        """Take actions to reduce memory usage when it gets too high."""
        # TODO: Implement memory optimization actions
        logger.info("Taking actions to reduce memory usage")
        
        # Example actions:
        # 1. Trigger garbage collection
        import gc
        gc.collect()
        
        # 2. Clear caches
        # (application-specific)
    
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


def main():
    """Main entry point for embedded application."""
    parser = argparse.ArgumentParser(description="PersLM Embedded Application")
    
    # Configuration options
    parser.add_argument("--config", type=str, help="Path to application configuration file")
    parser.add_argument("--realtime-config", type=str, help="Path to real-time interaction configuration")
    parser.add_argument("--autonomy-config", type=str, help="Path to autonomy loop configuration")
    
    # User options
    parser.add_argument("--user", type=str, default="default_user", help="User ID")
    parser.add_argument("--autonomy-level", type=str, choices=["disabled", "assisted", "supervised", "full"],
                      default="full", help="Autonomy level")
    
    # Mode options
    parser.add_argument("--interactive", action="store_true", help="Enable interactive mode")
    parser.add_argument("--no-autonomy", action="store_true", help="Disable autonomy loop")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode")
    
    # Debug options
    parser.add_argument("--log-level", type=str, default="info", 
                      choices=["debug", "info", "warning", "error"], help="Logging level")
    
    # Parse arguments
    args = parser.parse_args()
    
    # Create and start the application
    try:
        app = PersLMEmbedded(args)
        app.start()
    except Exception as e:
        print(f"Error starting application: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 