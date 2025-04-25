"""
Plugin Base Module

This module defines the base interface for all PersLM plugins.
Plugins should inherit from the PluginBase class and implement its methods.
"""

import abc
import logging
import json
import os
from typing import Dict, Any, Optional, List, Callable, Union
from enum import Enum

logger = logging.getLogger(__name__)


class PluginStatus(str, Enum):
    """Plugin status enumeration."""
    ENABLED = "enabled"
    DISABLED = "disabled"
    ERROR = "error"
    UNLOADED = "unloaded"
    INITIALIZING = "initializing"


class PluginBase(abc.ABC):
    """
    Base class for all PersLM plugins.
    
    All plugins must inherit from this class and implement its abstract methods.
    The plugin loader will use these methods to initialize and manage plugins.
    """
    
    def __init__(self, plugin_id: str, config: Optional[Dict[str, Any]] = None):
        """
        Initialize the plugin.
        
        Args:
            plugin_id: Unique identifier for the plugin
            config: Plugin configuration
        """
        self.plugin_id = plugin_id
        self.config = config or {}
        self.status = PluginStatus.UNLOADED
        self.error_message = None
        self.permissions = []
        self.memory_manager = None
        self.user_profile = None
        self._event_handlers = {}
    
    @abc.abstractmethod
    def setup(self) -> bool:
        """
        Set up the plugin.
        
        This method is called when the plugin is loaded.
        It should perform any necessary initialization.
        
        Returns:
            True if setup was successful, False otherwise
        """
        pass
    
    @abc.abstractmethod
    def execute(self, action: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a plugin action.
        
        Args:
            action: The action to perform
            parameters: Parameters for the action
            
        Returns:
            Result of the action
        """
        pass
    
    @abc.abstractmethod
    def unload(self) -> bool:
        """
        Unload the plugin.
        
        This method is called when the plugin is being unloaded.
        It should perform any necessary cleanup.
        
        Returns:
            True if unload was successful, False otherwise
        """
        pass
    
    @abc.abstractmethod
    def get_schema(self) -> Dict[str, Any]:
        """
        Get the JSON schema for plugin configuration.
        
        Returns:
            JSON schema for plugin configuration
        """
        pass
    
    @abc.abstractmethod
    def get_actions(self) -> Dict[str, Dict[str, Any]]:
        """
        Get available actions with their parameter schemas.
        
        Returns:
            Dictionary of actions with their parameter schemas
        """
        pass
    
    def get_info(self) -> Dict[str, Any]:
        """
        Get plugin information.
        
        Returns:
            Dictionary containing plugin information
        """
        return {
            "id": self.plugin_id,
            "name": self.__class__.__name__,
            "status": self.status,
            "error_message": self.error_message,
            "permissions": self.permissions,
            "actions": list(self.get_actions().keys())
        }
    
    def validate_config(self) -> bool:
        """
        Validate plugin configuration against the JSON schema.
        
        Returns:
            True if configuration is valid, False otherwise
        """
        try:
            # Lazy import to avoid dependencies for simple plugins
            from jsonschema import validate
            
            schema = self.get_schema()
            validate(instance=self.config, schema=schema)
            return True
        except ImportError:
            logger.warning(f"jsonschema not available, skipping validation for plugin {self.plugin_id}")
            return True
        except Exception as e:
            self.error_message = f"Configuration validation error: {str(e)}"
            logger.error(f"Plugin {self.plugin_id} configuration validation failed: {e}")
            return False
    
    def set_memory_manager(self, memory_manager) -> None:
        """
        Set memory manager for plugin use.
        
        Args:
            memory_manager: Memory manager instance
        """
        self.memory_manager = memory_manager
    
    def set_user_profile(self, user_profile) -> None:
        """
        Set user profile for plugin use.
        
        Args:
            user_profile: User profile instance
        """
        self.user_profile = user_profile
    
    def register_event_handler(self, event_type: str, handler: Callable) -> None:
        """
        Register event handler.
        
        Args:
            event_type: Type of event to handle
            handler: Event handler function
        """
        if event_type not in self._event_handlers:
            self._event_handlers[event_type] = []
        
        self._event_handlers[event_type].append(handler)
    
    def handle_event(self, event_type: str, event_data: Any) -> None:
        """
        Handle event.
        
        Args:
            event_type: Type of event
            event_data: Event data
        """
        if event_type in self._event_handlers:
            for handler in self._event_handlers[event_type]:
                try:
                    handler(event_data)
                except Exception as e:
                    logger.error(f"Error in plugin {self.plugin_id} event handler: {e}")
    
    def store_memory(self, key: str, data: Any) -> bool:
        """
        Store data in plugin memory.
        
        Args:
            key: Memory key
            data: Data to store
            
        Returns:
            True if successful, False otherwise
        """
        if not self.memory_manager:
            logger.warning(f"Plugin {self.plugin_id} tried to store memory without memory manager")
            return False
        
        try:
            # Create plugin-specific memory namespace
            namespace = f"plugin:{self.plugin_id}"
            memory_key = f"{namespace}:{key}"
            
            # Store in memory
            self.memory_manager.store(memory_key, data)
            return True
        except Exception as e:
            logger.error(f"Error storing plugin memory: {e}")
            return False
    
    def retrieve_memory(self, key: str) -> Optional[Any]:
        """
        Retrieve data from plugin memory.
        
        Args:
            key: Memory key
            
        Returns:
            Retrieved data or None if not found
        """
        if not self.memory_manager:
            logger.warning(f"Plugin {self.plugin_id} tried to retrieve memory without memory manager")
            return None
        
        try:
            # Create plugin-specific memory namespace
            namespace = f"plugin:{self.plugin_id}"
            memory_key = f"{namespace}:{key}"
            
            # Retrieve from memory
            return self.memory_manager.retrieve(memory_key)
        except Exception as e:
            logger.error(f"Error retrieving plugin memory: {e}")
            return None
    
    def get_user_preference(self, key: str, default: Any = None) -> Any:
        """
        Get user preference for plugin.
        
        Args:
            key: Preference key
            default: Default value if preference not found
            
        Returns:
            User preference or default value
        """
        if not self.user_profile:
            logger.warning(f"Plugin {self.plugin_id} tried to access user preferences without user profile")
            return default
        
        try:
            # Get preference path
            pref_path = f"plugins.{self.plugin_id}.{key}"
            
            # Get preference from user profile
            return self.user_profile.get_preference(pref_path, default)
        except Exception as e:
            logger.error(f"Error getting user preference: {e}")
            return default 