"""
Base Modality Interface

This module defines the base classes and interfaces for modality processors in PersLM.
"""

import logging
from typing import Dict, List, Optional, Any, Union, BinaryIO
from abc import ABC, abstractmethod
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class ModalityConfig:
    """Configuration for a modality processor."""
    enabled: bool = True
    model_name: Optional[str] = None
    model_path: Optional[str] = None
    device: str = "cpu"
    batch_size: int = 1
    max_size: Optional[int] = None  # Maximum size/dimension/length
    timeout: float = 30.0  # Seconds
    extra_options: Dict[str, Any] = None


class ModalityProcessor(ABC):
    """Base class for modality processors.
    
    All modality processors must inherit from this class and implement
    the required methods for their specific modality.
    """
    
    def __init__(self, config: Optional[ModalityConfig] = None):
        """Initialize the modality processor.
        
        Args:
            config: Configuration for the processor
        """
        self.config = config or ModalityConfig()
        self.model = None
        self.is_initialized = False
    
    @property
    def name(self) -> str:
        """Get the name of the modality."""
        return self.__class__.__name__
    
    @property
    def is_enabled(self) -> bool:
        """Check if the modality is enabled."""
        return self.config.enabled
    
    @abstractmethod
    def initialize(self) -> bool:
        """Initialize the modality processor.
        
        This method should load any necessary models or resources.
        
        Returns:
            True if initialization succeeded, False otherwise
        """
        pass
    
    @abstractmethod
    def to_text(self, data: Any) -> str:
        """Convert modality data to text.
        
        Args:
            data: Modality-specific data
            
        Returns:
            Text representation of the data
        """
        pass
    
    @abstractmethod
    def from_text(self, text: str) -> Any:
        """Convert text to modality data.
        
        Args:
            text: Text to convert
            
        Returns:
            Modality-specific data
        """
        pass
    
    def cleanup(self) -> None:
        """Clean up resources used by the modality processor.
        
        This method should release any resources, like GPU memory.
        """
        self.model = None
        self.is_initialized = False 