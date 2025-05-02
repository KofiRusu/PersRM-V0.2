"""
Plugin Loader Module

This module provides functionality for loading and managing PersLM plugins.
It dynamically discovers and loads plugins from the plugin directory.
"""

import os
import sys
import importlib
import importlib.util
import logging
import json
import yaml
import inspect
from typing import Dict, List, Any, Optional, Type, Set

from .plugin_base import PluginBase, PluginStatus

logger = logging.getLogger(__name__)


class PluginLoader:
    """
    Plugin loader for PersLM plugins.
    
    This class discovers and loads plugins from the plugin directory.
    It also manages plugin lifecycle and dependencies.
    """
    
    def __init__(self, plugin_dir: Optional[str] = None, config_file: Optional[str] = None):
        """
        Initialize the plugin loader.
        
        Args:
            plugin_dir: Directory containing plugins (default: plugins/)
            config_file: Path to plugin configuration file
        """
        # Set plugin directory
        self.plugin_dir = plugin_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), "")
        
        # Set config file
        self.config_file = config_file
        
        # Initialize plugin registry
        self.plugins: Dict[str, PluginBase] = {}
        self.plugin_classes: Dict[str, Type[PluginBase]] = {}
        self.disabled_plugins: Set[str] = set()
        
        # Load plugin configuration
        self.plugin_config = self._load_plugin_config()
        
        # Memory manager reference
        self.memory_manager = None
        
        # User profile reference
        self.user_profile = None
    
    def set_memory_manager(self, memory_manager) -> None:
        """
        Set memory manager for plugins.
        
        Args:
            memory_manager: Memory manager instance
        """
        self.memory_manager = memory_manager
        
        # Update for existing plugins
        for plugin in self.plugins.values():
            plugin.set_memory_manager(memory_manager)
    
    def set_user_profile(self, user_profile) -> None:
        """
        Set user profile for plugins.
        
        Args:
            user_profile: User profile instance
        """
        self.user_profile = user_profile
        
        # Update for existing plugins
        for plugin in self.plugins.values():
            plugin.set_user_profile(user_profile)
    
    def _load_plugin_config(self) -> Dict[str, Any]:
        """
        Load plugin configuration from file.
        
        Returns:
            Plugin configuration dictionary
        """
        config = {"plugins": {}}
        
        if not self.config_file:
            return config
        
        if not os.path.exists(self.config_file):
            logger.warning(f"Plugin configuration file {self.config_file} not found")
            return config
        
        try:
            with open(self.config_file, 'r') as f:
                if self.config_file.endswith('.json'):
                    config = json.load(f)
                elif self.config_file.endswith(('.yaml', '.yml')):
                    config = yaml.safe_load(f)
                else:
                    logger.warning(f"Unknown config file format: {self.config_file}")
        except Exception as e:
            logger.error(f"Error loading plugin configuration: {e}")
        
        return config
    
    def _save_plugin_config(self) -> bool:
        """
        Save plugin configuration to file.
        
        Returns:
            True if successful, False otherwise
        """
        if not self.config_file:
            return False
        
        try:
            with open(self.config_file, 'w') as f:
                if self.config_file.endswith('.json'):
                    json.dump(self.plugin_config, f, indent=2)
                elif self.config_file.endswith(('.yaml', '.yml')):
                    yaml.dump(self.plugin_config, f)
                else:
                    logger.warning(f"Unknown config file format: {self.config_file}")
                    return False
            return True
        except Exception as e:
            logger.error(f"Error saving plugin configuration: {e}")
            return False
    
    def discover_plugins(self) -> List[str]:
        """
        Discover available plugins.
        
        Returns:
            List of discovered plugin IDs
        """
        discovered_plugins = []
        
        # Look in base plugins directory
        self._discover_in_directory(self.plugin_dir, discovered_plugins)
        
        # Look in examples directory
        examples_dir = os.path.join(self.plugin_dir, "examples")
        if os.path.isdir(examples_dir):
            self._discover_in_directory(examples_dir, discovered_plugins)
        
        return discovered_plugins
    
    def _discover_in_directory(self, directory: str, discovered_plugins: List[str]) -> None:
        """
        Discover plugins in a directory.
        
        Args:
            directory: Directory to search for plugins
            discovered_plugins: List to add discovered plugin IDs to
        """
        # Walk through directory
        for root, dirs, files in os.walk(directory):
            # Skip __pycache__ directories
            if "__pycache__" in root:
                continue
                
            # Check for plugin manifest
            manifest_path = os.path.join(root, "plugin_manifest.json")
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, 'r') as f:
                        manifest = json.load(f)
                    
                    if "id" in manifest:
                        plugin_id = manifest["id"]
                        rel_path = os.path.relpath(root, self.plugin_dir)
                        
                        # Skip if already discovered
                        if plugin_id in discovered_plugins:
                            continue
                        
                        discovered_plugins.append(plugin_id)
                        
                        # Add to plugin registry if not already loaded
                        if plugin_id not in self.plugin_classes:
                            self._load_plugin_class(plugin_id, root)
                except Exception as e:
                    logger.error(f"Error loading plugin manifest at {manifest_path}: {e}")
    
    def _load_plugin_class(self, plugin_id: str, plugin_path: str) -> Optional[Type[PluginBase]]:
        """
        Load plugin class from path.
        
        Args:
            plugin_id: Plugin ID
            plugin_path: Path to plugin directory
            
        Returns:
            Plugin class or None if not found
        """
        try:
            # Look for plugin.py or main.py
            module_paths = [
                os.path.join(plugin_path, "plugin.py"),
                os.path.join(plugin_path, "main.py")
            ]
            
            module_path = None
            for path in module_paths:
                if os.path.exists(path):
                    module_path = path
                    break
            
            if not module_path:
                logger.error(f"Plugin {plugin_id} does not have a plugin.py or main.py file")
                return None
            
            # Load module
            module_name = f"plugins.{plugin_id.replace('-', '_')}"
            spec = importlib.util.spec_from_file_location(module_name, module_path)
            if not spec or not spec.loader:
                logger.error(f"Could not load module for plugin {plugin_id}")
                return None
                
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Find plugin class (subclass of PluginBase)
            plugin_class = None
            for name, obj in inspect.getmembers(module):
                if (inspect.isclass(obj) and 
                    issubclass(obj, PluginBase) and 
                    obj != PluginBase):
                    plugin_class = obj
                    break
            
            if not plugin_class:
                logger.error(f"No plugin class found in {module_path}")
                return None
            
            # Add to plugin registry
            self.plugin_classes[plugin_id] = plugin_class
            return plugin_class
        
        except Exception as e:
            logger.error(f"Error loading plugin class for {plugin_id}: {e}")
            return None
    
    def load_plugin(self, plugin_id: str) -> Optional[PluginBase]:
        """
        Load a plugin by ID.
        
        Args:
            plugin_id: Plugin ID
            
        Returns:
            Loaded plugin instance or None if loading failed
        """
        # Check if plugin is already loaded
        if plugin_id in self.plugins:
            return self.plugins[plugin_id]
        
        # Check if plugin is disabled
        if plugin_id in self.disabled_plugins:
            logger.info(f"Plugin {plugin_id} is disabled")
            return None
        
        # Get plugin class
        plugin_class = self.plugin_classes.get(plugin_id)
        if not plugin_class:
            # Try to discover it
            self.discover_plugins()
            plugin_class = self.plugin_classes.get(plugin_id)
            
            if not plugin_class:
                logger.error(f"Plugin class for {plugin_id} not found")
                return None
        
        try:
            # Get plugin config
            config = self.plugin_config.get("plugins", {}).get(plugin_id, {})
            
            # Create plugin instance
            plugin = plugin_class(plugin_id, config)
            
            # Set memory manager and user profile
            if self.memory_manager:
                plugin.set_memory_manager(self.memory_manager)
            
            if self.user_profile:
                plugin.set_user_profile(self.user_profile)
            
            # Update status
            plugin.status = PluginStatus.INITIALIZING
            
            # Validate configuration
            if not plugin.validate_config():
                logger.error(f"Plugin {plugin_id} configuration is invalid")
                plugin.status = PluginStatus.ERROR
                return None
            
            # Setup plugin
            if not plugin.setup():
                logger.error(f"Plugin {plugin_id} setup failed")
                plugin.status = PluginStatus.ERROR
                return None
            
            # Update status
            plugin.status = PluginStatus.ENABLED
            
            # Add to loaded plugins
            self.plugins[plugin_id] = plugin
            
            logger.info(f"Plugin {plugin_id} loaded successfully")
            return plugin
        
        except Exception as e:
            logger.error(f"Error loading plugin {plugin_id}: {e}")
            return None
    
    def unload_plugin(self, plugin_id: str) -> bool:
        """
        Unload a plugin by ID.
        
        Args:
            plugin_id: Plugin ID
            
        Returns:
            True if unload was successful, False otherwise
        """
        if plugin_id not in self.plugins:
            logger.warning(f"Plugin {plugin_id} is not loaded")
            return False
        
        plugin = self.plugins[plugin_id]
        
        try:
            # Unload plugin
            if not plugin.unload():
                logger.error(f"Plugin {plugin_id} unload failed")
                return False
            
            # Remove from loaded plugins
            del self.plugins[plugin_id]
            
            logger.info(f"Plugin {plugin_id} unloaded successfully")
            return True
        
        except Exception as e:
            logger.error(f"Error unloading plugin {plugin_id}: {e}")
            return False
    
    def enable_plugin(self, plugin_id: str) -> bool:
        """
        Enable a plugin.
        
        Args:
            plugin_id: Plugin ID
            
        Returns:
            True if enabling was successful, False otherwise
        """
        # Remove from disabled plugins
        if plugin_id in self.disabled_plugins:
            self.disabled_plugins.remove(plugin_id)
        
        # Update config
        if "plugins" not in self.plugin_config:
            self.plugin_config["plugins"] = {}
        
        if plugin_id not in self.plugin_config["plugins"]:
            self.plugin_config["plugins"][plugin_id] = {}
        
        self.plugin_config["plugins"][plugin_id]["enabled"] = True
        
        # Save config
        self._save_plugin_config()
        
        # Load plugin if not already loaded
        if plugin_id not in self.plugins:
            return self.load_plugin(plugin_id) is not None
        
        return True
    
    def disable_plugin(self, plugin_id: str) -> bool:
        """
        Disable a plugin.
        
        Args:
            plugin_id: Plugin ID
            
        Returns:
            True if disabling was successful, False otherwise
        """
        # Add to disabled plugins
        self.disabled_plugins.add(plugin_id)
        
        # Update config
        if "plugins" not in self.plugin_config:
            self.plugin_config["plugins"] = {}
        
        if plugin_id not in self.plugin_config["plugins"]:
            self.plugin_config["plugins"][plugin_id] = {}
        
        self.plugin_config["plugins"][plugin_id]["enabled"] = False
        
        # Save config
        self._save_plugin_config()
        
        # Unload plugin if loaded
        if plugin_id in self.plugins:
            return self.unload_plugin(plugin_id)
        
        return True
    
    def execute_plugin_action(self, plugin_id: str, action: str, parameters: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a plugin action.
        
        Args:
            plugin_id: Plugin ID
            action: Action to execute
            parameters: Action parameters
            
        Returns:
            Action result
        """
        # Check if plugin is loaded
        if plugin_id not in self.plugins:
            # Try to load it
            plugin = self.load_plugin(plugin_id)
            if not plugin:
                return {"success": False, "error": f"Plugin {plugin_id} not found or could not be loaded"}
        else:
            plugin = self.plugins[plugin_id]
        
        # Check plugin status
        if plugin.status != PluginStatus.ENABLED:
            return {"success": False, "error": f"Plugin {plugin_id} is not enabled"}
        
        try:
            # Execute action
            result = plugin.execute(action, parameters)
            return result
        except Exception as e:
            logger.error(f"Error executing plugin action {plugin_id}.{action}: {e}")
            return {"success": False, "error": f"Error executing plugin action: {str(e)}"}
    
    def get_loaded_plugins(self) -> List[Dict[str, Any]]:
        """
        Get information about loaded plugins.
        
        Returns:
            List of plugin information dictionaries
        """
        return [plugin.get_info() for plugin in self.plugins.values()]
    
    def get_available_plugins(self) -> List[str]:
        """
        Get IDs of available plugins.
        
        Returns:
            List of plugin IDs
        """
        return list(self.plugin_classes.keys()) 