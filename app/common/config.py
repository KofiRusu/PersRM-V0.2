"""
Configuration Module

This module handles configuration loading, saving, and management for the PersLM application.
"""

import os
import yaml
import json
import logging
from typing import Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

# Global configuration
_config = {}
_config_path = None


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Load configuration from file.
    
    Args:
        config_path: Path to configuration file
        
    Returns:
        Configuration dictionary
    """
    global _config, _config_path
    
    # Use default config path if not specified
    if not config_path:
        app_dir = Path(__file__).parent.parent
        config_path = os.path.join(app_dir, "config", "app_config.yaml")
    
    _config_path = config_path
    
    # Try to load configuration
    try:
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                if config_path.endswith('.yaml') or config_path.endswith('.yml'):
                    _config = yaml.safe_load(f) or {}
                elif config_path.endswith('.json'):
                    _config = json.load(f)
                else:
                    logger.warning(f"Unknown config file format: {config_path}")
                    _config = {}
                
            logger.info(f"Loaded configuration from {config_path}")
        else:
            logger.warning(f"Configuration file not found: {config_path}")
            _config = {}
            
            # Create default configuration directory
            os.makedirs(os.path.dirname(config_path), exist_ok=True)
    except Exception as e:
        logger.error(f"Error loading configuration: {e}")
        _config = {}
    
    # Apply environment variable overrides
    _apply_env_overrides()
    
    return _config


def save_config() -> bool:
    """
    Save configuration to file.
    
    Returns:
        True if successful, False otherwise
    """
    global _config, _config_path
    
    if not _config_path:
        logger.warning("No configuration path set")
        return False
    
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(_config_path), exist_ok=True)
        
        # Save configuration
        with open(_config_path, 'w') as f:
            if _config_path.endswith('.yaml') or _config_path.endswith('.yml'):
                yaml.dump(_config, f, default_flow_style=False)
            elif _config_path.endswith('.json'):
                json.dump(_config, f, indent=2)
            else:
                logger.warning(f"Unknown config file format: {_config_path}")
                return False
        
        logger.info(f"Saved configuration to {_config_path}")
        return True
    except Exception as e:
        logger.error(f"Error saving configuration: {e}")
        return False


def get_config() -> Dict[str, Any]:
    """
    Get the current configuration.
    
    Returns:
        Configuration dictionary
    """
    global _config
    return _config


def set_config_value(key: str, value: Any, save: bool = True) -> bool:
    """
    Set a configuration value.
    
    Args:
        key: Configuration key (can be nested with dots, e.g., 'database.host')
        value: Configuration value
        save: Whether to save the configuration to file
        
    Returns:
        True if successful, False otherwise
    """
    global _config
    
    try:
        # Handle nested keys
        if '.' in key:
            parts = key.split('.')
            current = _config
            
            # Navigate to the last level
            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                elif not isinstance(current[part], dict):
                    current[part] = {}
                
                current = current[part]
            
            # Set the value
            current[parts[-1]] = value
        else:
            _config[key] = value
        
        # Save configuration if requested
        if save:
            return save_config()
        
        return True
    except Exception as e:
        logger.error(f"Error setting configuration value: {e}")
        return False


def get_config_value(key: str, default: Any = None) -> Any:
    """
    Get a configuration value.
    
    Args:
        key: Configuration key (can be nested with dots, e.g., 'database.host')
        default: Default value to return if key not found
        
    Returns:
        Configuration value or default
    """
    global _config
    
    try:
        # Handle nested keys
        if '.' in key:
            parts = key.split('.')
            current = _config
            
            # Navigate to the value
            for part in parts:
                if part not in current:
                    return default
                current = current[part]
            
            return current
        else:
            return _config.get(key, default)
    except Exception as e:
        logger.error(f"Error getting configuration value: {e}")
        return default


def update_config(updates: Dict[str, Any], save: bool = True) -> bool:
    """
    Update multiple configuration values.
    
    Args:
        updates: Dictionary of configuration updates
        save: Whether to save the configuration to file
        
    Returns:
        True if successful, False otherwise
    """
    for key, value in updates.items():
        # Update each value but don't save yet
        set_config_value(key, value, save=False)
    
    # Save configuration if requested
    if save:
        return save_config()
    
    return True


def _apply_env_overrides():
    """Apply environment variable overrides to configuration."""
    # Look for environment variables with prefix PERSLM_
    prefix = "PERSLM_"
    
    for key, value in os.environ.items():
        if key.startswith(prefix):
            # Convert environment variable name to config key
            config_key = key[len(prefix):].lower().replace('__', '.')
            
            # Convert value to appropriate type
            if value.lower() in ('true', 'yes', 'on'):
                typed_value = True
            elif value.lower() in ('false', 'no', 'off'):
                typed_value = False
            elif value.isdigit():
                typed_value = int(value)
            elif value.replace('.', '', 1).isdigit() and value.count('.') <= 1:
                typed_value = float(value)
            else:
                typed_value = value
            
            # Update configuration
            set_config_value(config_key, typed_value, save=False)
            logger.debug(f"Applied environment override: {config_key} = {typed_value}")


def reset_config():
    """Reset configuration to default values."""
    global _config
    _config = {}
    return save_config() 