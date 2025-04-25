"""
Persistence Module

This module provides functionality for persisting application state between sessions.
"""

import os
import json
import time
import pickle
import logging
import threading
from typing import Dict, Any, Optional, Union, List
from pathlib import Path

logger = logging.getLogger(__name__)

# Global state
_storage = {}
_config = {}
_initialized = False
_storage_path = None
_autosave_thread = None
_autosave_interval = 300  # 5 minutes
_running = False


def initialize(config: Optional[Dict[str, Any]] = None) -> bool:
    """
    Initialize the persistence system.
    
    Args:
        config: Configuration options
        
    Returns:
        True if successful, False otherwise
    """
    global _config, _initialized, _storage_path, _autosave_interval, _running
    
    if _initialized:
        logger.warning("Persistence system already initialized")
        return True
    
    _config = config or {}
    
    # Set up storage path
    storage_dir = _config.get('storage_dir', 'data/persistence')
    os.makedirs(storage_dir, exist_ok=True)
    _storage_path = os.path.join(storage_dir, 'app_state.json')
    
    # Configure autosave
    _autosave_interval = _config.get('autosave_interval', 300)
    
    # Load existing data
    if not load():
        logger.warning("Failed to load existing persistence data")
    
    _initialized = True
    _running = True
    
    # Start autosave thread if enabled
    if _config.get('autosave', True):
        _start_autosave_thread()
    
    logger.info(f"Persistence system initialized, storage path: {_storage_path}")
    return True


def _start_autosave_thread():
    """Start the autosave thread."""
    global _autosave_thread, _running
    
    if _autosave_thread and _autosave_thread.is_alive():
        return
    
    _running = True
    _autosave_thread = threading.Thread(
        target=_autosave_worker,
        name="persistence-autosave",
        daemon=True
    )
    _autosave_thread.start()
    
    logger.debug("Autosave thread started")


def _autosave_worker():
    """Background worker for autosaving data."""
    global _running, _autosave_interval
    
    while _running:
        try:
            # Sleep for the interval
            time.sleep(_autosave_interval)
            
            # Save data
            if _running:  # Check again in case we were stopped during sleep
                save()
                
        except Exception as e:
            logger.error(f"Error in autosave worker: {e}")
            time.sleep(10)  # Sleep and retry on error


def stop():
    """Stop the persistence system."""
    global _running, _autosave_thread
    
    _running = False
    
    # Wait for autosave thread to stop
    if _autosave_thread and _autosave_thread.is_alive():
        _autosave_thread.join(timeout=5.0)
    
    # Final save
    save()
    
    logger.info("Persistence system stopped")


def save() -> bool:
    """
    Save current state to storage.
    
    Returns:
        True if successful, False otherwise
    """
    global _storage, _storage_path, _initialized
    
    if not _initialized or not _storage_path:
        logger.warning("Persistence system not initialized")
        return False
    
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(_storage_path), exist_ok=True)
        
        # Prepare data for serialization
        serializable_data = {}
        
        for key, value in _storage.items():
            if isinstance(value, (str, int, float, bool, list, dict, type(None))):
                # JSON-serializable types
                serializable_data[key] = value
            else:
                # Try to pickle complex objects
                try:
                    # Store as special format to indicate pickle
                    pickle_path = f"{_storage_path}.{key}.pickle"
                    with open(pickle_path, 'wb') as f:
                        pickle.dump(value, f)
                    serializable_data[key] = {"__pickle_file__": os.path.basename(pickle_path)}
                except Exception as e:
                    logger.error(f"Failed to pickle object for key '{key}': {e}")
                    # Skip this object
        
        # Save JSON-serializable data
        with open(_storage_path, 'w') as f:
            json.dump(serializable_data, f, indent=2)
        
        logger.debug(f"State saved to {_storage_path}")
        return True
    except Exception as e:
        logger.error(f"Error saving state: {e}")
        return False


def load() -> bool:
    """
    Load state from storage.
    
    Returns:
        True if successful, False otherwise
    """
    global _storage, _storage_path
    
    if not _storage_path:
        logger.warning("Storage path not set")
        return False
    
    try:
        if os.path.exists(_storage_path):
            with open(_storage_path, 'r') as f:
                data = json.load(f)
            
            # Process data
            for key, value in data.items():
                if isinstance(value, dict) and "__pickle_file__" in value:
                    # Load pickled data
                    pickle_path = os.path.join(os.path.dirname(_storage_path), value["__pickle_file__"])
                    if os.path.exists(pickle_path):
                        try:
                            with open(pickle_path, 'rb') as f:
                                _storage[key] = pickle.load(f)
                        except Exception as e:
                            logger.error(f"Failed to load pickled object for key '{key}': {e}")
                            # Skip this object
                else:
                    # Regular JSON data
                    _storage[key] = value
            
            logger.info(f"State loaded from {_storage_path}")
            return True
        else:
            logger.info(f"No existing state file found at {_storage_path}")
            return False
    except Exception as e:
        logger.error(f"Error loading state: {e}")
        return False


def get(key: str, default: Any = None) -> Any:
    """
    Get a value from storage.
    
    Args:
        key: Storage key
        default: Default value if key not found
        
    Returns:
        Stored value or default
    """
    global _storage
    return _storage.get(key, default)


def set(key: str, value: Any, save_now: bool = False) -> bool:
    """
    Set a value in storage.
    
    Args:
        key: Storage key
        value: Value to store
        save_now: Whether to save immediately
        
    Returns:
        True if successful, False if save_now=True and save failed
    """
    global _storage
    
    _storage[key] = value
    
    if save_now:
        return save()
    
    return True


def delete(key: str, save_now: bool = False) -> bool:
    """
    Delete a value from storage.
    
    Args:
        key: Storage key
        save_now: Whether to save immediately
        
    Returns:
        True if successful, False if save_now=True and save failed
    """
    global _storage
    
    if key in _storage:
        del _storage[key]
    
    if save_now:
        return save()
    
    return True


def clear(save_now: bool = True) -> bool:
    """
    Clear all stored data.
    
    Args:
        save_now: Whether to save immediately
        
    Returns:
        True if successful, False if save_now=True and save failed
    """
    global _storage
    
    _storage = {}
    
    if save_now:
        return save()
    
    return True


def get_all() -> Dict[str, Any]:
    """
    Get all stored data.
    
    Returns:
        Dictionary of all stored data
    """
    global _storage
    return dict(_storage)  # Return a copy


def update(data: Dict[str, Any], save_now: bool = False) -> bool:
    """
    Update multiple values in storage.
    
    Args:
        data: Dictionary of updates
        save_now: Whether to save immediately
        
    Returns:
        True if successful, False if save_now=True and save failed
    """
    global _storage
    
    _storage.update(data)
    
    if save_now:
        return save()
    
    return True 