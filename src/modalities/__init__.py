"""
Modalities Module for PersLM

This package implements support for different modalities beyond text,
enabling multi-modal capabilities for the model.

Key modalities:
- Image: processing and generating images
- Audio: speech-to-text and text-to-speech
- Future extensions: video, structured data, etc.
"""

from src.modalities.base import ModalityProcessor, ModalityConfig
from src.modalities.image import ImageProcessor
from src.modalities.audio import AudioProcessor 