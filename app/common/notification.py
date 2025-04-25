"""
Notification Module

This module provides notification functionality for the PersLM application.
It supports desktop notifications, system tray alerts, and custom notification handlers.
"""

import os
import sys
import time
import logging
import threading
from typing import Dict, Any, Optional, Callable, List, Union
from pathlib import Path

logger = logging.getLogger(__name__)

# Global state
_config = {}
_initialized = False
_custom_handler = None
_notification_queue = []
_queue_thread = None
_running = False

# Platform detection
_is_windows = sys.platform == "win32"
_is_macos = sys.platform == "darwin"
_is_linux = sys.platform == "linux"

# Optional imports for platform-specific notifications
try:
    if _is_windows:
        from win10toast import ToastNotifier
        _win_notifier = ToastNotifier()
    elif _is_macos:
        import subprocess
    elif _is_linux:
        import gi
        gi.require_version('Notify', '0.7')
        from gi.repository import Notify
        Notify.init("PersLM")
except ImportError:
    pass  # Will fall back to print-based notifications


def initialize(config: Optional[Dict[str, Any]] = None, handler: Optional[Callable] = None) -> bool:
    """
    Initialize the notification system.
    
    Args:
        config: Configuration options
        handler: Custom notification handler
        
    Returns:
        True if successful, False otherwise
    """
    global _config, _initialized, _custom_handler, _running
    
    if _initialized:
        logger.warning("Notification system already initialized")
        return True
    
    _config = config or {}
    _custom_handler = handler
    
    # Initialize platform-specific notification
    if _is_linux:
        try:
            Notify.init("PersLM")
        except NameError:
            logger.warning("Linux notification system not available")
    
    # Start queue processor if queueing is enabled
    if _config.get('queue_notifications', False):
        _start_queue_thread()
    
    _initialized = True
    _running = True
    
    logger.info("Notification system initialized")
    return True


def _start_queue_thread():
    """Start the notification queue processor thread."""
    global _queue_thread, _running
    
    if _queue_thread and _queue_thread.is_alive():
        return
    
    _running = True
    _queue_thread = threading.Thread(
        target=_queue_worker,
        name="notification-queue",
        daemon=True
    )
    _queue_thread.start()
    
    logger.debug("Notification queue thread started")


def _queue_worker():
    """Background worker for processing notification queue."""
    global _running, _notification_queue
    
    while _running:
        try:
            # Process queued notifications
            while _notification_queue:
                title, message, notification_type = _notification_queue.pop(0)
                _send_notification(title, message, notification_type)
            
            # Sleep a bit
            time.sleep(0.1)
                
        except Exception as e:
            logger.error(f"Error in notification queue worker: {e}")
            time.sleep(1)  # Sleep and retry on error


def stop():
    """Stop the notification system."""
    global _running, _queue_thread
    
    _running = False
    
    # Wait for queue thread to stop
    if _queue_thread and _queue_thread.is_alive():
        _queue_thread.join(timeout=5.0)
    
    # Clean up platform-specific resources
    if _is_linux:
        try:
            Notify.uninit()
        except NameError:
            pass
    
    logger.info("Notification system stopped")


def send(title: str, message: str, notification_type: str = "info") -> bool:
    """
    Send a notification.
    
    Args:
        title: Notification title
        message: Notification message
        notification_type: Type of notification (info, warning, error, success)
        
    Returns:
        True if notification was sent, False otherwise
    """
    global _config, _initialized, _notification_queue
    
    if not _initialized:
        logger.warning("Notification system not initialized")
        return False
    
    # Check notification settings
    if not _config.get('enable_notifications', True):
        return False
    
    # Filter by notification type
    allowed_types = _config.get('notification_types', ['info', 'warning', 'error', 'success'])
    if notification_type not in allowed_types:
        return False
    
    # Queue or send immediately
    if _config.get('queue_notifications', False):
        _notification_queue.append((title, message, notification_type))
        return True
    else:
        return _send_notification(title, message, notification_type)


def _send_notification(title: str, message: str, notification_type: str) -> bool:
    """
    Send a notification using the appropriate method.
    
    Args:
        title: Notification title
        message: Notification message
        notification_type: Type of notification
        
    Returns:
        True if notification was sent, False otherwise
    """
    # Use custom handler if provided
    if _custom_handler:
        try:
            _custom_handler(title, message, notification_type)
            return True
        except Exception as e:
            logger.error(f"Error in custom notification handler: {e}")
            # Fall through to default methods
    
    # Platform-specific notifications
    try:
        if _is_windows:
            try:
                icon_path = _get_icon_path(notification_type)
                _win_notifier.show_toast(
                    title,
                    message,
                    icon_path=icon_path,
                    duration=5,
                    threaded=True
                )
                return True
            except NameError:
                # Fall back to print
                pass
                
        elif _is_macos:
            try:
                # Use osascript for macOS notifications
                script = f'display notification "{message}" with title "{title}"'
                subprocess.run(['osascript', '-e', script], check=False)
                return True
            except (NameError, FileNotFoundError):
                # Fall back to print
                pass
                
        elif _is_linux:
            try:
                # Use libnotify for Linux notifications
                notification = Notify.Notification.new(title, message)
                notification.show()
                return True
            except NameError:
                # Fall back to print
                pass
    except Exception as e:
        logger.error(f"Error sending platform notification: {e}")
    
    # Fall back to printing the notification
    _print_notification(title, message, notification_type)
    return True


def _print_notification(title: str, message: str, notification_type: str):
    """Print a notification to the console."""
    # ANSI color codes for different notification types
    colors = {
        "info": "\033[94m",     # Blue
        "warning": "\033[93m",  # Yellow
        "error": "\033[91m",    # Red
        "success": "\033[92m"   # Green
    }
    
    color = colors.get(notification_type, "\033[0m")
    reset = "\033[0m"
    
    print(f"\n{color}[{title}]{reset} {message}\n")


def _get_icon_path(notification_type: str) -> Optional[str]:
    """
    Get the path to an icon for the given notification type.
    
    Args:
        notification_type: Type of notification
        
    Returns:
        Path to icon file or None
    """
    # Check if icon directory is set in config
    icon_dir = _config.get('icon_dir')
    
    if not icon_dir:
        # Use default location
        app_dir = Path(__file__).parent.parent
        icon_dir = os.path.join(app_dir, "resources", "icons")
    
    # Map notification type to icon file
    icon_files = {
        "info": "info.ico",
        "warning": "warning.ico",
        "error": "error.ico",
        "success": "success.ico"
    }
    
    icon_file = icon_files.get(notification_type, "info.ico")
    icon_path = os.path.join(icon_dir, icon_file)
    
    # Return path if file exists, otherwise None
    return icon_path if os.path.exists(icon_path) else None 