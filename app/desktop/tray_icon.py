"""
System Tray Icon

This module provides a system tray icon for the desktop application.
"""

import os
import sys
import logging
from pathlib import Path
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

# Platform detection
IS_WINDOWS = sys.platform == "win32"
IS_MACOS = sys.platform == "darwin"
IS_LINUX = sys.platform.startswith("linux")

# Qt library detection (reuse from ui_manager.py)
try:
    # Try to import PySide6 (Qt6)
    from PySide6 import QtWidgets, QtCore, QtGui
    HAS_PYSIDE6 = True
    QtLib = "PySide6"
except ImportError:
    HAS_PYSIDE6 = False
    try:
        # Try to import PyQt6
        from PyQt6 import QtWidgets, QtCore, QtGui
        HAS_PYQT6 = True
        QtLib = "PyQt6"
    except ImportError:
        HAS_PYQT6 = False
        try:
            # Try to import PySide2 (Qt5)
            from PySide2 import QtWidgets, QtCore, QtGui
            HAS_PYSIDE2 = True
            QtLib = "PySide2"
        except ImportError:
            HAS_PYSIDE2 = False
            try:
                # Try to import PyQt5
                from PyQt5 import QtWidgets, QtCore, QtGui
                HAS_PYQT5 = True
                QtLib = "PyQt5"
            except ImportError:
                HAS_PYQT5 = False
                QtLib = None


class TrayIcon:
    """
    System tray icon for the desktop application.
    
    This class provides a system tray icon with context menu
    for controlling the application from the system tray.
    """
    
    def __init__(self, callback: Optional[Callable] = None, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the system tray icon.
        
        Args:
            callback: Callback function for tray icon events
            config: Configuration options
        """
        self.callback = callback
        self.config = config or {}
        self.app = None
        self.tray_icon = None
        self.menu = None
        self.exit_requested = False
        
        # Get icon paths
        self.icon_path = self._get_icon_path()
        
        # Initialize tray icon if Qt is available
        if QtLib:
            self._initialize_tray()
        else:
            logger.warning("Qt libraries not available. Tray icon disabled.")
    
    def _get_icon_path(self) -> str:
        """
        Get the path to the tray icon.
        
        Returns:
            Path to the icon file
        """
        # Check if icon path is set in config
        icon_path = self.config.get('icon_path')
        
        if not icon_path:
            # Use default icon
            app_dir = Path(__file__).parent.parent
            resources_dir = os.path.join(app_dir, "resources", "icons")
            
            # Pick platform-specific icon format
            if IS_WINDOWS:
                icon_name = "perslm.ico"
            elif IS_MACOS:
                icon_name = "perslm.icns"
            else:
                icon_name = "perslm.png"
            
            icon_path = os.path.join(resources_dir, icon_name)
            
            # Fall back to PNG if specific format not found
            if not os.path.exists(icon_path):
                icon_path = os.path.join(resources_dir, "perslm.png")
        
        # If icon still doesn't exist, return empty string
        if not os.path.exists(icon_path):
            logger.warning(f"Tray icon not found: {icon_path}")
            return ""
            
        return icon_path
    
    def _initialize_tray(self):
        """Initialize the system tray icon."""
        try:
            # Create Qt application if needed
            self.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
            
            # Create tray icon
            self.tray_icon = QtWidgets.QSystemTrayIcon()
            
            # Set icon
            if self.icon_path:
                self.tray_icon.setIcon(QtGui.QIcon(self.icon_path))
            else:
                # Use fallback icon
                self.tray_icon.setIcon(self.app.style().standardIcon(QtWidgets.QStyle.SP_ComputerIcon))
            
            # Set tooltip
            self.tray_icon.setToolTip("PersLM Assistant")
            
            # Create context menu
            self.menu = QtWidgets.QMenu()
            
            # Add menu items
            open_action = self.menu.addAction("Open")
            open_action.triggered.connect(self._on_open)
            
            self.menu.addSeparator()
            
            # Conversation submenu
            convo_menu = self.menu.addMenu("Conversation")
            
            start_convo_action = convo_menu.addAction("Start Conversation")
            start_convo_action.triggered.connect(self._on_start_conversation)
            
            voice_convo_action = convo_menu.addAction("Voice Conversation")
            voice_convo_action.triggered.connect(self._on_voice_conversation)
            
            # Autonomy submenu
            autonomy_menu = self.menu.addMenu("Autonomy")
            
            self.autonomy_enabled_action = autonomy_menu.addAction("Enable Autonomy")
            self.autonomy_enabled_action.setCheckable(True)
            self.autonomy_enabled_action.setChecked(True)
            self.autonomy_enabled_action.triggered.connect(self._on_toggle_autonomy)
            
            self.menu.addSeparator()
            
            # Settings action
            settings_action = self.menu.addAction("Settings")
            settings_action.triggered.connect(self._on_settings)
            
            self.menu.addSeparator()
            
            # Exit action
            exit_action = self.menu.addAction("Exit")
            exit_action.triggered.connect(self._on_exit)
            
            # Set context menu
            self.tray_icon.setContextMenu(self.menu)
            
            # Connect activated signal
            if QtLib in ("PySide6", "PyQt6"):
                self.tray_icon.activated.connect(self._on_activated)
            else:  # Qt5
                self.tray_icon.activated.connect(self._on_activated_qt5)
            
            logger.info("Tray icon initialized")
        except Exception as e:
            logger.error(f"Error initializing tray icon: {e}")
            self.tray_icon = None
    
    def _on_activated(self, reason):
        """
        Handle tray icon activation (Qt6 version).
        
        Args:
            reason: Activation reason
        """
        # Check for double click
        if reason == QtWidgets.QSystemTrayIcon.ActivationReason.DoubleClick:
            self._on_open()
    
    def _on_activated_qt5(self, reason):
        """
        Handle tray icon activation (Qt5 version).
        
        Args:
            reason: Activation reason
        """
        # Check for double click
        if reason == QtWidgets.QSystemTrayIcon.DoubleClick:
            self._on_open()
    
    def _on_open(self):
        """Handle open action."""
        if self.callback:
            self.callback("open_ui")
    
    def _on_start_conversation(self):
        """Handle start conversation action."""
        if self.callback:
            self.callback("start_conversation")
    
    def _on_voice_conversation(self):
        """Handle voice conversation action."""
        if self.callback:
            self.callback("start_conversation", {"voice": True})
    
    def _on_toggle_autonomy(self, checked):
        """
        Handle toggle autonomy action.
        
        Args:
            checked: Whether the action is checked
        """
        if self.callback:
            self.callback("toggle_autonomy", {"enabled": checked})
    
    def _on_settings(self):
        """Handle settings action."""
        if self.callback:
            self.callback("open_settings")
    
    def _on_exit(self):
        """Handle exit action."""
        # Confirm exit
        if QtLib in ("PySide6", "PyQt6"):
            result = QtWidgets.QMessageBox.question(
                None,
                "Exit Confirmation",
                "Are you sure you want to exit PersLM Assistant?",
                QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No
            )
            confirmed = (result == QtWidgets.QMessageBox.StandardButton.Yes)
        else:  # Qt5
            result = QtWidgets.QMessageBox.question(
                None,
                "Exit Confirmation",
                "Are you sure you want to exit PersLM Assistant?",
                QtWidgets.QMessageBox.Yes | QtWidgets.QMessageBox.No
            )
            confirmed = (result == QtWidgets.QMessageBox.Yes)
        
        if confirmed:
            # Set exit flag
            self.exit_requested = True
            
            # Call callback
            if self.callback:
                self.callback("exit")
    
    def start(self):
        """Start the tray icon."""
        if self.tray_icon:
            self.tray_icon.show()
            logger.info("Tray icon started")
    
    def stop(self):
        """Stop the tray icon."""
        if self.tray_icon:
            self.tray_icon.hide()
            logger.info("Tray icon stopped")
    
    def show_message(self, title: str, message: str, icon_type="info"):
        """
        Show a balloon message from the tray icon.
        
        Args:
            title: Message title
            message: Message content
            icon_type: Icon type (info, warning, critical)
        """
        if not self.tray_icon:
            return
        
        # Map icon type
        if QtLib in ("PySide6", "PyQt6"):
            icon_map = {
                "info": QtWidgets.QSystemTrayIcon.MessageIcon.Information,
                "warning": QtWidgets.QSystemTrayIcon.MessageIcon.Warning,
                "critical": QtWidgets.QSystemTrayIcon.MessageIcon.Critical
            }
        else:  # Qt5
            icon_map = {
                "info": QtWidgets.QSystemTrayIcon.Information,
                "warning": QtWidgets.QSystemTrayIcon.Warning,
                "critical": QtWidgets.QSystemTrayIcon.Critical
            }
        
        icon = icon_map.get(icon_type.lower(), icon_map["info"])
        
        # Show message
        self.tray_icon.showMessage(title, message, icon) 