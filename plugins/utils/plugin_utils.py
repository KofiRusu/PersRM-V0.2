"""
Plugin Utilities Module

This module provides utility functions for plugin development.
"""

import os
import json
import yaml
import logging
import inspect
from typing import Dict, Any, Optional, Callable, Type, List, Union

logger = logging.getLogger(__name__)


def create_plugin_manifest(
    plugin_id: str,
    name: str,
    description: str,
    version: str,
    author: str,
    entry_point: str = "plugin.py",
    permissions: Optional[List[str]] = None,
    requires: Optional[List[str]] = None,
    output_path: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a plugin manifest file.
    
    Args:
        plugin_id: Unique plugin identifier
        name: Human-readable plugin name
        description: Plugin description
        version: Plugin version
        author: Plugin author
        entry_point: Entry point file (default: plugin.py)
        permissions: List of permissions required by the plugin
        requires: List of plugin dependencies
        output_path: Path to write manifest to
        
    Returns:
        Plugin manifest dictionary
    """
    manifest = {
        "id": plugin_id,
        "name": name,
        "description": description,
        "version": version,
        "author": author,
        "entry_point": entry_point,
        "permissions": permissions or [],
        "requires": requires or []
    }
    
    if output_path:
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        logger.info(f"Plugin manifest created at {output_path}")
    
    return manifest


def create_action_schema(
    name: str,
    description: str,
    parameters: Optional[Dict[str, Any]] = None,
    required: Optional[List[str]] = None,
    returns: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Create a JSON schema for a plugin action.
    
    Args:
        name: Action name
        description: Action description
        parameters: Dictionary of parameter schemas
        required: List of required parameters
        returns: Schema for return value
        
    Returns:
        Action schema dictionary
    """
    schema = {
        "name": name,
        "description": description,
        "parameters": {
            "type": "object",
            "properties": parameters or {},
            "required": required or []
        },
        "returns": returns or {
            "type": "object",
            "properties": {
                "success": {
                    "type": "boolean",
                    "description": "Whether the action was successful"
                },
                "result": {
                    "type": "object",
                    "description": "Action result"
                }
            },
            "required": ["success"]
        }
    }
    
    return schema


def create_config_schema(
    config_fields: Dict[str, Dict[str, Any]],
    required_fields: Optional[List[str]] = None,
    title: Optional[str] = None,
    description: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a JSON schema for plugin configuration.
    
    Args:
        config_fields: Dictionary of configuration field schemas
        required_fields: List of required configuration fields
        title: Schema title
        description: Schema description
        
    Returns:
        Configuration schema dictionary
    """
    schema = {
        "type": "object",
        "properties": config_fields,
        "required": required_fields or []
    }
    
    if title:
        schema["title"] = title
    
    if description:
        schema["description"] = description
    
    return schema


def auto_schema_from_class(cls: Type, exclude_methods: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Automatically generate action schemas from class methods.
    
    Args:
        cls: Plugin class
        exclude_methods: Methods to exclude from schema generation
        
    Returns:
        Dictionary of action schemas
    """
    exclude_methods = exclude_methods or []
    
    # Add default methods to exclude
    exclude_methods.extend([
        "setup", "unload", "get_schema", "get_actions", "get_info",
        "validate_config", "set_memory_manager", "set_user_profile",
        "__init__", "__new__", "__call__", "__str__", "__repr__"
    ])
    
    schemas = {}
    
    for name, method in inspect.getmembers(cls, predicate=inspect.isfunction):
        # Skip excluded methods
        if name.startswith("_") or name in exclude_methods:
            continue
        
        # Get method signature
        sig = inspect.signature(method)
        doc = inspect.getdoc(method) or ""
        
        # Extract description from docstring
        description = doc.split("\n")[0] if doc else f"Execute {name}"
        
        # Parse parameters from signature
        parameters = {}
        required = []
        
        for param_name, param in sig.parameters.items():
            # Skip 'self' parameter
            if param_name == "self":
                continue
            
            # Get parameter type
            param_type = "string"  # Default type
            if param.annotation != inspect.Parameter.empty:
                if param.annotation == int:
                    param_type = "integer"
                elif param.annotation == float:
                    param_type = "number"
                elif param.annotation == bool:
                    param_type = "boolean"
                elif param.annotation == dict or param.annotation == Dict:
                    param_type = "object"
                elif param.annotation == list or param.annotation == List:
                    param_type = "array"
            
            # Create parameter schema
            param_schema = {
                "type": param_type,
                "description": f"Parameter '{param_name}' for action '{name}'"
            }
            
            # Add default value if exists
            if param.default != inspect.Parameter.empty and param.default is not None:
                param_schema["default"] = param.default
            
            # Add to parameters
            parameters[param_name] = param_schema
            
            # Check if required
            if param.default == inspect.Parameter.empty:
                required.append(param_name)
        
        # Create action schema
        schemas[name] = create_action_schema(
            name=name,
            description=description,
            parameters=parameters,
            required=required
        )
    
    return schemas


def auto_setup_from_config(
    plugin: Any,
    required_fields: Optional[List[str]] = None,
    setup_actions: Optional[Dict[str, Callable]] = None
) -> bool:
    """
    Automatically set up a plugin from its configuration.
    
    Args:
        plugin: Plugin instance
        required_fields: List of required configuration fields
        setup_actions: Dictionary of setup actions by field name
        
    Returns:
        True if setup was successful, False otherwise
    """
    required_fields = required_fields or []
    setup_actions = setup_actions or {}
    
    # Check required fields
    for field in required_fields:
        if field not in plugin.config:
            plugin.error_message = f"Missing required configuration field: {field}"
            return False
    
    # Execute setup actions
    for field, action in setup_actions.items():
        if field in plugin.config:
            try:
                action(plugin.config[field])
            except Exception as e:
                plugin.error_message = f"Error setting up field {field}: {str(e)}"
                return False
    
    return True


def load_plugin_data_file(plugin_dir: str, filename: str) -> Any:
    """
    Load data from a plugin data file.
    
    Args:
        plugin_dir: Plugin directory
        filename: Data file name
        
    Returns:
        Loaded data
    """
    filepath = os.path.join(plugin_dir, filename)
    
    if not os.path.exists(filepath):
        logger.warning(f"Plugin data file not found: {filepath}")
        return None
    
    try:
        with open(filepath, 'r') as f:
            if filename.endswith('.json'):
                return json.load(f)
            elif filename.endswith(('.yaml', '.yml')):
                return yaml.safe_load(f)
            else:
                # Assume plain text
                return f.read()
    except Exception as e:
        logger.error(f"Error loading plugin data file {filepath}: {e}")
        return None


def save_plugin_data_file(plugin_dir: str, filename: str, data: Any) -> bool:
    """
    Save data to a plugin data file.
    
    Args:
        plugin_dir: Plugin directory
        filename: Data file name
        data: Data to save
        
    Returns:
        True if successful, False otherwise
    """
    filepath = os.path.join(plugin_dir, filename)
    
    # Ensure directory exists
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    
    try:
        with open(filepath, 'w') as f:
            if filename.endswith('.json'):
                json.dump(data, f, indent=2)
            elif filename.endswith(('.yaml', '.yml')):
                yaml.dump(data, f)
            else:
                # Assume plain text
                f.write(str(data))
        return True
    except Exception as e:
        logger.error(f"Error saving plugin data file {filepath}: {e}")
        return False 