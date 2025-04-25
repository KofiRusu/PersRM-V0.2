"""
Desktop UI Manager

This module provides a platform-specific UI manager for the desktop application.
"""

import os
import sys
import logging
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

# Platform detection
IS_WINDOWS = sys.platform == "win32"
IS_MACOS = sys.platform == "darwin"
IS_LINUX = sys.platform.startswith("linux")

# Optional imports for UI frameworks
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


class UIManager:
    """
    Desktop UI manager.
    
    This class manages the UI for the desktop application,
    providing a platform-specific implementation.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None, callback: Optional[Callable] = None):
        """
        Initialize the UI manager.
        
        Args:
            config: UI configuration
            callback: Callback function for UI events
        """
        self.config = config or {}
        self.callback = callback
        self.ui_type = self.config.get('ui_type', 'qt')
        self.app = None
        self.main_window = None
        self.chat_widget = None
        self.settings_widget = None
        self.exit_requested = False
        
        # Determine UI implementation based on available libraries
        if self.ui_type == 'qt':
            if QtLib:
                logger.info(f"Using {QtLib} for UI")
                self._initialize_qt()
            else:
                logger.warning("Qt libraries not available. Falling back to minimal UI.")
                self.ui_type = 'minimal'
        
        if self.ui_type == 'minimal':
            self._initialize_minimal()
    
    def _initialize_qt(self):
        """Initialize Qt-based UI."""
        try:
            # Create Qt application
            self.app = QtWidgets.QApplication.instance() or QtWidgets.QApplication([])
            
            # Create main window
            self.main_window = QtWidgets.QMainWindow()
            self.main_window.setWindowTitle("PersLM Assistant")
            self.main_window.resize(800, 600)
            
            # Create central widget with tabs
            tabs = QtWidgets.QTabWidget()
            
            # Create chat widget
            self.chat_widget = self._create_chat_widget()
            tabs.addTab(self.chat_widget, "Chat")
            
            # Create settings widget
            self.settings_widget = self._create_settings_widget()
            tabs.addTab(self.settings_widget, "Settings")
            
            # Set central widget
            self.main_window.setCentralWidget(tabs)
            
            # Handle close event
            self.main_window.closeEvent = self._handle_close_event
            
            logger.info("Qt UI initialized")
        except Exception as e:
            logger.error(f"Error initializing Qt UI: {e}")
            self.ui_type = 'minimal'
            self._initialize_minimal()
    
    def _create_chat_widget(self):
        """Create the chat widget for Qt UI."""
        widget = QtWidgets.QWidget()
        layout = QtWidgets.QVBoxLayout(widget)
        
        # Chat display
        self.chat_display = QtWidgets.QTextEdit()
        self.chat_display.setReadOnly(True)
        layout.addWidget(self.chat_display)
        
        # Input area
        input_layout = QtWidgets.QHBoxLayout()
        
        self.chat_input = QtWidgets.QLineEdit()
        self.chat_input.setPlaceholderText("Type your message here...")
        self.chat_input.returnPressed.connect(self._send_message)
        
        send_button = QtWidgets.QPushButton("Send")
        send_button.clicked.connect(self._send_message)
        
        voice_button = QtWidgets.QPushButton("🎤")
        voice_button.setToolTip("Voice Input")
        voice_button.clicked.connect(self._toggle_voice)
        
        input_layout.addWidget(self.chat_input)
        input_layout.addWidget(voice_button)
        input_layout.addWidget(send_button)
        
        layout.addLayout(input_layout)
        
        return widget
    
    def _create_settings_widget(self):
        """Create the settings widget for Qt UI."""
        widget = QtWidgets.QWidget()
        layout = QtWidgets.QVBoxLayout(widget)
        
        # Create form layout for settings
        form_layout = QtWidgets.QFormLayout()
        
        # Autonomy level setting
        self.autonomy_combo = QtWidgets.QComboBox()
        self.autonomy_combo.addItems(["Disabled", "Assisted", "Supervised", "Full"])
        self.autonomy_combo.setCurrentText("Supervised")  # Default
        form_layout.addRow("Autonomy Level:", self.autonomy_combo)
        
        # Voice mode setting
        self.voice_checkbox = QtWidgets.QCheckBox("Enable Voice Mode")
        form_layout.addRow("", self.voice_checkbox)
        
        # Notification setting
        self.notification_checkbox = QtWidgets.QCheckBox("Enable Notifications")
        self.notification_checkbox.setChecked(True)
        form_layout.addRow("", self.notification_checkbox)
        
        # Apply button
        self.apply_button = QtWidgets.QPushButton("Apply Settings")
        self.apply_button.clicked.connect(self._apply_settings)
        
        layout.addLayout(form_layout)
        layout.addWidget(self.apply_button)
        
        # Add stretcher to keep form at top
        layout.addStretch()
        
        return widget
    
    def _initialize_minimal(self):
        """Initialize minimal UI for platforms without GUI support."""
        logger.info("Initialized minimal UI")
    
    def _send_message(self):
        """Handle message sending in Qt UI."""
        if not self.chat_input:
            return
        
        message = self.chat_input.text()
        if not message:
            return
        
        # Add user message to chat display
        self.chat_display.append(f"<b>You:</b> {message}")
        self.chat_input.clear()
        
        # Call callback with event
        if self.callback:
            self.callback("start_conversation", {"message": message})
    
    def _toggle_voice(self):
        """Toggle voice input in Qt UI."""
        if self.callback:
            self.callback("toggle_voice")
    
    def _apply_settings(self):
        """Apply settings in Qt UI."""
        if not self.callback:
            return
            
        settings = {
            "autonomy_level": self.autonomy_combo.currentText().lower(),
            "voice_enabled": self.voice_checkbox.isChecked(),
            "notifications_enabled": self.notification_checkbox.isChecked()
        }
        
        self.callback("change_settings", settings)
    
    def _handle_close_event(self, event):
        """Handle window close event in Qt UI."""
        # Confirm exit
        if QtLib in ("PySide6", "PyQt6"):
            result = QtWidgets.QMessageBox.question(
                self.main_window,
                "Exit Confirmation",
                "Are you sure you want to exit PersLM Assistant?",
                QtWidgets.QMessageBox.StandardButton.Yes | QtWidgets.QMessageBox.StandardButton.No
            )
            confirmed = (result == QtWidgets.QMessageBox.StandardButton.Yes)
        else:  # Qt5
            result = QtWidgets.QMessageBox.question(
                self.main_window,
                "Exit Confirmation",
                "Are you sure you want to exit PersLM Assistant?",
                QtWidgets.QMessageBox.Yes | QtWidgets.QMessageBox.No
            )
            confirmed = (result == QtWidgets.QMessageBox.Yes)
        
        if confirmed:
            # Set exit flag
            self.exit_requested = True
            
            # Accept event to close window
            event.accept()
            
            # Call callback with exit event
            if self.callback:
                self.callback("exit")
        else:
            # Reject event to keep window open
            event.ignore()
    
    def start(self):
        """Start the UI."""
        if self.ui_type == 'qt':
            # Show main window
            if self.main_window:
                self.main_window.show()
                
                # Don't block here - let the main thread handle the event loop
                logger.info("Qt UI started")
        else:
            logger.info("Minimal UI started")
    
    def stop(self):
        """Stop the UI."""
        if self.ui_type == 'qt':
            # Close main window
            if self.main_window:
                self.main_window.close()
                
            # Quit application if we created it
            if self.app and not self.app.closingDown():
                self.app.quit()
                
            logger.info("Qt UI stopped")
        else:
            logger.info("Minimal UI stopped")
    
    def show(self):
        """Show the UI."""
        if self.ui_type == 'qt' and self.main_window:
            self.main_window.show()
            self.main_window.activateWindow()
            self.main_window.raise_()
    
    def hide(self):
        """Hide the UI."""
        if self.ui_type == 'qt' and self.main_window:
            self.main_window.hide()
    
    def show_error(self, message: str):
        """Show an error message."""
        if self.ui_type == 'qt':
            if QtLib:
                QtWidgets.QMessageBox.critical(
                    self.main_window, "Error", message
                )
        else:
            print(f"Error: {message}")
    
    def add_message(self, sender: str, message: str):
        """Add a message to the chat display."""
        if self.ui_type == 'qt' and self.chat_display:
            # Format based on sender
            if sender.lower() == "user":
                self.chat_display.append(f"<b>You:</b> {message}")
            else:
                self.chat_display.append(f"<b>PersLM:</b> {message}")
    
    def is_visible(self) -> bool:
        """Check if the UI is visible."""
        if self.ui_type == 'qt' and self.main_window:
            return self.main_window.isVisible()
        return False 