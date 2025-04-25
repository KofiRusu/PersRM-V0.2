"""
Configuration loading and management.

This module handles loading and validating configuration from YAML files.
"""

import os
import yaml
import logging
from typing import Dict, Any, Optional, List, Union

logger = logging.getLogger(__name__)

class ConfigLoader:
    """
    Configuration loader that handles loading and validation of YAML configuration files.
    """
    
    def __init__(self, config_dir: str = "configs"):
        """
        Initialize the configuration loader.
        
        Args:
            config_dir: Directory containing configuration files
        """
        self.config_dir = config_dir
        self.configs: Dict[str, Any] = {}
        
    def load_config(self, config_name: str) -> Dict[str, Any]:
        """
        Load a configuration file.
        
        Args:
            config_name: Name of the configuration file (without extension)
            
        Returns:
            Dictionary containing the configuration
            
        Raises:
            FileNotFoundError: If the configuration file doesn't exist
            yaml.YAMLError: If the configuration file is invalid
        """
        if config_name in self.configs:
            return self.configs[config_name]
            
        config_path = os.path.join(self.config_dir, f"{config_name}.yaml")
        
        try:
            with open(config_path, 'r') as file:
                config = yaml.safe_load(file)
                
            self.configs[config_name] = config
            logger.info(f"Loaded configuration from {config_path}")
            return config
            
        except FileNotFoundError:
            logger.error(f"Configuration file not found: {config_path}")
            raise
            
        except yaml.YAMLError as e:
            logger.error(f"Error parsing YAML in {config_path}: {str(e)}")
            raise
    
    def get_value(
        self, 
        config_name: str, 
        key_path: str, 
        default: Any = None
    ) -> Any:
        """
        Get a value from a configuration using dot notation for nested keys.
        
        Args:
            config_name: Name of the configuration file
            key_path: Path to the configuration value using dot notation (e.g., "user_profile.storage.type")
            default: Default value to return if the key doesn't exist
            
        Returns:
            Configuration value or default if not found
        """
        try:
            config = self.load_config(config_name)
            
            # Navigate through nested dictionaries using the key path
            keys = key_path.split('.')
            value = config
            
            for key in keys:
                if key in value:
                    value = value[key]
                else:
                    return default
                    
            return value
            
        except (FileNotFoundError, yaml.YAMLError):
            return default
    
    def merge_configs(self, *config_names: str) -> Dict[str, Any]:
        """
        Merge multiple configurations together.
        
        Args:
            *config_names: Names of configurations to merge
            
        Returns:
            Merged configuration dictionary
        """
        merged_config = {}
        
        for config_name in config_names:
            try:
                config = self.load_config(config_name)
                merged_config = self._deep_merge(merged_config, config)
                
            except (FileNotFoundError, yaml.YAMLError):
                logger.warning(f"Could not merge configuration {config_name}")
                
        return merged_config
    
    def _deep_merge(self, dict1: Dict[str, Any], dict2: Dict[str, Any]) -> Dict[str, Any]:
        """
        Recursively merge two dictionaries.
        
        Args:
            dict1: First dictionary
            dict2: Second dictionary (values override dict1)
            
        Returns:
            Merged dictionary
        """
        result = dict1.copy()
        
        for key, value in dict2.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                # Recursively merge nested dictionaries
                result[key] = self._deep_merge(result[key], value)
            else:
                # Override or add values
                result[key] = value
                
        return result


# Global configuration loader instance
config_loader = ConfigLoader()


def load_personalization_config() -> Dict[str, Any]:
    """
    Load the personalization configuration.
    
    Returns:
        Dictionary containing personalization configuration
    """
    return config_loader.load_config("personalization") 