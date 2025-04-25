"""
Real-time Interaction Loop

This module provides a real-time interaction loop with speech input and output.
"""

import os
import time
import yaml
import logging
import argparse
import threading
from typing import Dict, Any, Optional, Callable, List
from pathlib import Path

from .interactive import InteractiveConversation, InteractionConfig, InputMode, OutputMode
from .speech import SpeechRecognizer, SpeechConfig, SpeechBackend, AudioConfig
from .tts import TextToSpeech, TTSConfig, TTSBackend, VoiceConfig

# Import personalization components if available
try:
    from src.personalization import personalization_manager
    HAS_PERSONALIZATION = True
except ImportError:
    HAS_PERSONALIZATION = False

# Import memory components if available
try:
    from src.memory import Memory
    HAS_MEMORY = True
except ImportError:
    HAS_MEMORY = False

# Import agents components if available
try:
    from src.agents import AgentManager
    HAS_AGENTS = True
except ImportError:
    HAS_AGENTS = False

logger = logging.getLogger(__name__)


def load_config(config_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Load configuration from YAML file.
    
    Args:
        config_path: Path to configuration file
        
    Returns:
        Configuration dictionary
    """
    # Default config path
    if not config_path:
        config_path = os.path.join(os.path.dirname(__file__), "config", "config.yaml")
    
    # Load configuration
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        logger.info(f"Loaded configuration from {config_path}")
        return config
    except Exception as e:
        logger.warning(f"Error loading configuration from {config_path}: {e}")
        logger.info("Using default configuration")
        return {}


def create_speech_config(config: Dict[str, Any]) -> SpeechConfig:
    """
    Create speech recognition configuration.
    
    Args:
        config: Configuration dictionary
        
    Returns:
        SpeechConfig object
    """
    speech_config = config.get('speech', {})
    audio_config = speech_config.get('audio', {})
    
    return SpeechConfig(
        backend=SpeechBackend(speech_config.get('backend', 'whisper_local')),
        model_name=speech_config.get('model_name', 'base'),
        language=speech_config.get('language'),
        api_key=speech_config.get('api_key'),
        translate=speech_config.get('translate', False),
        audio=AudioConfig(
            sample_rate=audio_config.get('sample_rate', 16000),
            channels=audio_config.get('channels', 1),
            format=audio_config.get('format', 'int16'),
            chunk_size=audio_config.get('chunk_size', 1024),
            silence_threshold=audio_config.get('silence_threshold', 0.03),
            silence_duration=audio_config.get('silence_duration', 2.0),
            max_duration=audio_config.get('max_duration', 30.0),
            device_index=audio_config.get('device_index')
        ),
        enable_vad=speech_config.get('enable_vad', True)
    )


def create_tts_config(config: Dict[str, Any]) -> TTSConfig:
    """
    Create text-to-speech configuration.
    
    Args:
        config: Configuration dictionary
        
    Returns:
        TTSConfig object
    """
    tts_config = config.get('tts', {})
    voice_config = tts_config.get('voice', {})
    
    return TTSConfig(
        backend=TTSBackend(tts_config.get('backend', 'system')),
        voice=VoiceConfig(
            voice_id=voice_config.get('voice_id', 'default'),
            language=voice_config.get('language', 'en-US'),
            gender=voice_config.get('gender'),
            rate=voice_config.get('rate', 1.0),
            pitch=voice_config.get('pitch', 1.0),
            volume=voice_config.get('volume', 1.0)
        ),
        api_key=tts_config.get('api_key'),
        output_format=tts_config.get('output_format', 'wav'),
        cache_dir=tts_config.get('cache_dir'),
        enable_cache=tts_config.get('enable_cache', True)
    )


def create_interaction_config(
    config: Dict[str, Any],
    model_provider: Optional[Callable] = None
) -> InteractionConfig:
    """
    Create interaction configuration.
    
    Args:
        config: Configuration dictionary
        model_provider: Function to provide model responses
        
    Returns:
        InteractionConfig object
    """
    interaction_config = config.get('interaction', {})
    
    return InteractionConfig(
        input_mode=InputMode(interaction_config.get('input_mode', 'hybrid')),
        output_mode=OutputMode(interaction_config.get('output_mode', 'hybrid')),
        speech_config=create_speech_config(config),
        tts_config=create_tts_config(config),
        model_provider=model_provider,
        streaming=interaction_config.get('streaming', True),
        max_tokens=interaction_config.get('max_tokens', 1024),
        interruption_enabled=interaction_config.get('interruption_enabled', True),
        activity_timeout=interaction_config.get('activity_timeout', 60.0),
        auto_reconnect=interaction_config.get('auto_reconnect', True),
        terminal_ui=interaction_config.get('terminal_ui', True),
        system_message=interaction_config.get('system_message')
    )


class RealtimeLoop:
    """
    Real-time interaction loop with speech I/O and PersLM integration.
    
    Features:
    - Voice input and output
    - Integration with personalization
    - Integration with memory system
    - Integration with agents
    """
    
    def __init__(
        self,
        config_path: Optional[str] = None,
        model_provider: Optional[Callable] = None,
        user_id: Optional[str] = None
    ):
        """
        Initialize the real-time loop.
        
        Args:
            config_path: Path to configuration file
            model_provider: Function to provide model responses
            user_id: User ID for personalization
        """
        self.config = load_config(config_path)
        self.user_id = user_id or "default_user"
        
        # Initialize personalization
        self.personalization = None
        if HAS_PERSONALIZATION:
            self.personalization = personalization_manager
            logger.info("Personalization system initialized")
        
        # Initialize memory
        self.memory = None
        if HAS_MEMORY:
            self.memory = Memory()
            logger.info("Memory system initialized")
        
        # Initialize agents
        self.agents = None
        if HAS_AGENTS:
            self.agents = AgentManager()
            logger.info("Agent system initialized")
        
        # Create model provider if not provided
        if not model_provider:
            model_provider = self._create_model_provider()
        
        # Create interactive conversation
        self.interaction_config = create_interaction_config(self.config, model_provider)
        self.conversation = InteractiveConversation(self.interaction_config)
        
        # Tracking
        self.active = False
        self.interaction_count = 0
        self.session_start_time = 0
    
    def _create_model_provider(self) -> Callable:
        """
        Create a model provider function.
        
        Returns:
            Function to provide model responses
        """
        def model_provider(prompt: str, streaming: bool = False):
            """Model provider function with PersLM integration."""
            # Placeholder for when no model is available
            if not self.agents:
                if streaming:
                    import time
                    
                    # Simple streaming response simulator
                    words = f"I'm sorry, but the PersLM system is not fully initialized. Your prompt was: {prompt}".split()
                    for word in words:
                        yield word + " "
                        time.sleep(0.1)
                else:
                    return f"I'm sorry, but the PersLM system is not fully initialized. Your prompt was: {prompt}"
                
            # Use agents to generate response
            try:
                if streaming:
                    return self._generate_streaming_response(prompt)
                else:
                    return self._generate_complete_response(prompt)
            except Exception as e:
                logger.error(f"Error generating response: {str(e)}")
                if streaming:
                    yield "I'm sorry, but I encountered an error while processing your request."
                else:
                    return "I'm sorry, but I encountered an error while processing your request."
        
        return model_provider
    
    def _generate_streaming_response(self, prompt: str):
        """
        Generate a streaming response using PersLM.
        
        Args:
            prompt: User prompt
            
        Yields:
            Response chunks
        """
        # TODO: Implement real streaming from agents/model
        # For now, simulate with a simple implementation
        response = self._generate_complete_response(prompt)
        words = response.split()
        for word in words:
            yield word + " "
            time.sleep(0.05)
    
    def _generate_complete_response(self, prompt: str) -> str:
        """
        Generate a complete response using PersLM.
        
        Args:
            prompt: User prompt
            
        Returns:
            Complete response
        """
        # Record user input in memory if available
        if self.memory:
            self.memory.add("user_input", {
                "text": prompt,
                "timestamp": time.time(),
                "user_id": self.user_id
            })
        
        # Generate response using agents if available
        response = None
        if self.agents:
            # TODO: Implement actual agent call here
            response = f"This is a simulated response from PersLM agents for: {prompt}"
        else:
            response = f"This is a placeholder response. Agents are not initialized. Your prompt was: {prompt}"
        
        # Apply personalization if available
        if self.personalization:
            try:
                response = self.personalization.personalize_response(
                    user_id=self.user_id,
                    response=response,
                    query=prompt
                )
            except Exception as e:
                logger.error(f"Error in personalization: {str(e)}")
        
        # Record interaction in memory if available
        if self.memory:
            self.memory.add("interaction", {
                "user_input": prompt,
                "system_response": response,
                "timestamp": time.time(),
                "user_id": self.user_id
            })
        
        return response
    
    def start(self, timeout: Optional[float] = None):
        """
        Start the real-time loop.
        
        Args:
            timeout: Maximum session duration in seconds, or None for no limit
        """
        if self.active:
            logger.warning("Real-time loop already running")
            return
        
        self.active = True
        self.session_start_time = time.time()
        
        logger.info("Starting real-time interaction loop")
        
        try:
            # Start conversation
            self.conversation.start(timeout=timeout)
            
        except KeyboardInterrupt:
            logger.info("Real-time loop interrupted by user")
        except Exception as e:
            logger.error(f"Error in real-time loop: {str(e)}")
        finally:
            self.active = False
            
            # Log session information
            session_duration = time.time() - self.session_start_time
            logger.info(f"Real-time session ended. Duration: {session_duration:.2f}s")
            
            # Record session in memory if available
            if self.memory:
                self.memory.add("session", {
                    "start_time": self.session_start_time,
                    "end_time": time.time(),
                    "duration": session_duration,
                    "interaction_count": self.interaction_count,
                    "user_id": self.user_id
                })
    
    def stop(self):
        """Stop the real-time loop."""
        if not self.active:
            logger.warning("Real-time loop not running")
            return
        
        logger.info("Stopping real-time loop")
        self.conversation.stop()
        self.active = False


def main():
    """Command-line interface for real-time loop."""
    parser = argparse.ArgumentParser(description="Real-time interaction loop")
    parser.add_argument("--config", type=str, help="Path to configuration file")
    parser.add_argument("--user", type=str, default="default_user", help="User ID for personalization")
    parser.add_argument("--timeout", type=float, help="Maximum session duration in seconds")
    parser.add_argument("--log-level", type=str, default="info", 
                      choices=["debug", "info", "warning", "error"], help="Logging level")
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper()),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Create real-time loop
    loop = RealtimeLoop(
        config_path=args.config,
        user_id=args.user
    )
    
    # Start loop
    try:
        loop.start(timeout=args.timeout)
    except KeyboardInterrupt:
        loop.stop()


if __name__ == "__main__":
    main() 