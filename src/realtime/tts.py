"""
Text-to-Speech Module

This module provides text-to-speech capabilities with multiple backend options.
"""

import os
import io
import tempfile
import logging
from typing import Optional, Dict, Any, Union, List, BinaryIO
from enum import Enum
from dataclasses import dataclass, field

try:
    import numpy as np
    import soundfile as sf
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    import pygame
    HAS_PYGAME = True
except ImportError:
    HAS_PYGAME = False

try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

# Try to import system-specific TTS libraries
try:
    # macOS-specific TTS
    import subprocess
    HAS_SYSTEM_TTS = True
except ImportError:
    HAS_SYSTEM_TTS = False

# Try to import edge-tts
try:
    import edge_tts
    HAS_EDGE_TTS = True
except ImportError:
    HAS_EDGE_TTS = False

# Try to import pyttsx3
try:
    import pyttsx3
    HAS_PYTTSX3 = True
except ImportError:
    HAS_PYTTSX3 = False

logger = logging.getLogger(__name__)


class TTSBackend(str, Enum):
    """Available TTS backends."""
    SYSTEM = "system"  # System-specific TTS (macOS, Windows, etc.)
    PYTTSX3 = "pyttsx3"  # Cross-platform offline TTS
    EDGE_TTS = "edge_tts"  # Microsoft Edge TTS (requires internet)
    OPENAI = "openai"  # OpenAI's TTS API
    ELEVENLABS = "elevenlabs"  # ElevenLabs TTS API
    CUSTOM = "custom"  # For custom TTS systems


@dataclass
class VoiceConfig:
    """Configuration for TTS voice."""
    voice_id: str = "default"  # Voice identifier
    language: str = "en-US"  # Language code
    gender: Optional[str] = None  # Male/Female/Neutral
    rate: float = 1.0  # Speed multiplier
    pitch: float = 1.0  # Pitch multiplier
    volume: float = 1.0  # Volume multiplier


@dataclass
class TTSConfig:
    """Configuration for text-to-speech."""
    backend: TTSBackend = TTSBackend.SYSTEM
    voice: VoiceConfig = field(default_factory=VoiceConfig)
    api_key: Optional[str] = None
    output_format: str = "wav"  # wav, mp3, ogg
    cache_dir: Optional[str] = None  # Directory for caching audio files
    enable_cache: bool = True  # Whether to cache generated audio


class TextToSpeech:
    """
    Text-to-speech system with multiple backend options.
    
    Features:
    - Multiple backend options (system, pyttsx3, edge-tts, OpenAI, ElevenLabs)
    - Voice customization
    - Audio caching
    - Streaming support
    """
    
    def __init__(self, config: Optional[TTSConfig] = None):
        """
        Initialize the TTS system.
        
        Args:
            config: Configuration for TTS
        """
        self.config = config or TTSConfig()
        
        # Initialize audio playback
        self._init_audio_playback()
        
        # Initialize cache if enabled
        if self.config.enable_cache and self.config.cache_dir:
            os.makedirs(self.config.cache_dir, exist_ok=True)
        
        # Initialize backend
        self._backend = None
        self._openai_client = None
        self._elevenlabs_client = None
        self._pyttsx3_engine = None
        
        if self.config.backend == TTSBackend.SYSTEM:
            self._init_system_tts()
        elif self.config.backend == TTSBackend.PYTTSX3:
            self._init_pyttsx3()
        elif self.config.backend == TTSBackend.EDGE_TTS:
            self._init_edge_tts()
        elif self.config.backend == TTSBackend.OPENAI:
            self._init_openai()
        elif self.config.backend == TTSBackend.ELEVENLABS:
            self._init_elevenlabs()
    
    def _init_audio_playback(self):
        """Initialize audio playback system."""
        if HAS_PYGAME:
            pygame.mixer.init()
            logger.info("Initialized audio playback with Pygame")
    
    def _init_system_tts(self):
        """Initialize system-specific TTS."""
        if not HAS_SYSTEM_TTS:
            raise ImportError("System TTS dependencies are not available")
        
        # Check platform
        import platform
        system = platform.system()
        
        if system == "Darwin":  # macOS
            # Test say command
            try:
                subprocess.run(["say", "--version"], check=True, capture_output=True)
                logger.info("Initialized macOS TTS")
            except (subprocess.SubprocessError, FileNotFoundError):
                raise RuntimeError("macOS TTS not available")
        
        elif system == "Windows":
            # Try to use Windows SAPI
            if HAS_PYTTSX3:
                self._init_pyttsx3()
            else:
                raise RuntimeError("Windows TTS requires pyttsx3")
        
        elif system == "Linux":
            # Try to use espeak or festival
            try:
                subprocess.run(["espeak", "--version"], check=True, capture_output=True)
                logger.info("Initialized Linux TTS (espeak)")
            except (subprocess.SubprocessError, FileNotFoundError):
                try:
                    subprocess.run(["festival", "--version"], check=True, capture_output=True)
                    logger.info("Initialized Linux TTS (festival)")
                except (subprocess.SubprocessError, FileNotFoundError):
                    raise RuntimeError("Linux TTS not available (install espeak or festival)")
        
        else:
            raise RuntimeError(f"Unsupported platform for system TTS: {system}")
    
    def _init_pyttsx3(self):
        """Initialize pyttsx3 TTS."""
        if not HAS_PYTTSX3:
            raise ImportError("pyttsx3 is not installed. Install with: pip install pyttsx3")
        
        self._pyttsx3_engine = pyttsx3.init()
        
        # Configure voice
        voices = self._pyttsx3_engine.getProperty('voices')
        
        # Set voice if specified and available
        if self.config.voice.voice_id != "default" and voices:
            for voice in voices:
                if self.config.voice.voice_id in (voice.id, voice.name):
                    self._pyttsx3_engine.setProperty('voice', voice.id)
                    break
        # Otherwise try to match by language and gender
        elif voices:
            for voice in voices:
                lang_match = self.config.voice.language in getattr(voice, 'languages', [])
                gender_match = (self.config.voice.gender is None or 
                               self.config.voice.gender.lower() in getattr(voice, 'gender', '').lower())
                
                if lang_match and gender_match:
                    self._pyttsx3_engine.setProperty('voice', voice.id)
                    break
        
        # Set other properties
        self._pyttsx3_engine.setProperty('rate', int(self._pyttsx3_engine.getProperty('rate') * self.config.voice.rate))
        self._pyttsx3_engine.setProperty('volume', self.config.voice.volume)
        
        logger.info("Initialized pyttsx3 TTS engine")
    
    def _init_edge_tts(self):
        """Initialize Microsoft Edge TTS."""
        if not HAS_EDGE_TTS:
            raise ImportError("edge-tts is not installed. Install with: pip install edge-tts")
        
        # Edge TTS is initialized on-demand
        logger.info("Initialized Edge TTS")
    
    def _init_openai(self):
        """Initialize OpenAI TTS."""
        if not HAS_OPENAI:
            raise ImportError("OpenAI SDK is not installed. Install with: pip install openai")
        
        # Get API key from config or environment
        api_key = self.config.api_key or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key not provided. Set it in config or OPENAI_API_KEY environment variable."
            )
            
        self._openai_client = OpenAI(api_key=api_key)
        logger.info("Initialized OpenAI TTS")
    
    def _init_elevenlabs(self):
        """Initialize ElevenLabs TTS."""
        try:
            from elevenlabs import generate, set_api_key, voices
            from elevenlabs.api import User
        except ImportError:
            raise ImportError("ElevenLabs SDK is not installed. Install with: pip install elevenlabs")
        
        # Get API key from config or environment
        api_key = self.config.api_key or os.environ.get("ELEVENLABS_API_KEY")
        if not api_key:
            raise ValueError(
                "ElevenLabs API key not provided. Set it in config or ELEVENLABS_API_KEY environment variable."
            )
            
        # Set API key
        set_api_key(api_key)
        
        # Test API connection
        try:
            user = User.from_api()
            logger.info(f"Initialized ElevenLabs TTS (character limit: {user.subscription.character_limit})")
        except Exception as e:
            raise RuntimeError(f"Failed to initialize ElevenLabs TTS: {str(e)}")
            
        # Store generate function
        self._elevenlabs_generate = generate
        self._elevenlabs_voices = voices
    
    def list_available_voices(self) -> List[Dict[str, Any]]:
        """
        List available voices for the current backend.
        
        Returns:
            List of available voices with their properties
        """
        voices = []
        
        if self.config.backend == TTSBackend.PYTTSX3 and self._pyttsx3_engine:
            for voice in self._pyttsx3_engine.getProperty('voices'):
                voices.append({
                    "id": voice.id,
                    "name": voice.name,
                    "languages": getattr(voice, "languages", []),
                    "gender": getattr(voice, "gender", None),
                    "age": getattr(voice, "age", None)
                })
        
        elif self.config.backend == TTSBackend.EDGE_TTS and HAS_EDGE_TTS:
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                available_voices = loop.run_until_complete(edge_tts.list_voices())
                for voice in available_voices:
                    voices.append({
                        "id": voice["ShortName"],
                        "name": voice["DisplayName"],
                        "locale": voice["Locale"],
                        "gender": voice.get("Gender", "Unknown"),
                        "language": voice.get("Language", "Unknown")
                    })
            finally:
                loop.close()
        
        elif self.config.backend == TTSBackend.OPENAI and self._openai_client:
            # OpenAI has a limited set of voices
            voices = [
                {"id": "alloy", "name": "Alloy", "gender": "neutral", "language": "en"},
                {"id": "echo", "name": "Echo", "gender": "male", "language": "en"},
                {"id": "fable", "name": "Fable", "gender": "female", "language": "en"},
                {"id": "onyx", "name": "Onyx", "gender": "male", "language": "en"},
                {"id": "nova", "name": "Nova", "gender": "female", "language": "en"},
                {"id": "shimmer", "name": "Shimmer", "gender": "female", "language": "en"}
            ]
        
        elif self.config.backend == TTSBackend.ELEVENLABS and "elevenlabs" in sys.modules:
            try:
                from elevenlabs import voices as get_voices
                available_voices = get_voices()
                for voice in available_voices:
                    voices.append({
                        "id": voice.voice_id,
                        "name": voice.name,
                        "gender": getattr(voice, "gender", None),
                        "preview_url": getattr(voice, "preview_url", None),
                        "description": getattr(voice, "description", None)
                    })
            except Exception as e:
                logger.error(f"Error listing ElevenLabs voices: {str(e)}")
        
        return voices
    
    def synthesize(self, text: str, output_file: Optional[str] = None) -> Union[bytes, str]:
        """
        Synthesize speech from text.
        
        Args:
            text: Text to synthesize
            output_file: Path to save audio file, or None to return bytes
            
        Returns:
            Audio data as bytes, or path to output file if provided
        """
        # Check cache if enabled
        if self.config.enable_cache and self.config.cache_dir:
            cache_key = f"{self.config.backend}_{self.config.voice.voice_id}_{hash(text)}"
            cache_path = os.path.join(self.config.cache_dir, f"{cache_key}.{self.config.output_format}")
            
            if os.path.exists(cache_path):
                logger.info(f"Using cached audio: {cache_path}")
                if output_file:
                    import shutil
                    shutil.copy(cache_path, output_file)
                    return output_file
                else:
                    with open(cache_path, "rb") as f:
                        return f.read()
        
        # Generate speech based on backend
        if self.config.backend == TTSBackend.SYSTEM:
            audio_data = self._synthesize_system(text, output_file)
        elif self.config.backend == TTSBackend.PYTTSX3:
            audio_data = self._synthesize_pyttsx3(text, output_file)
        elif self.config.backend == TTSBackend.EDGE_TTS:
            audio_data = self._synthesize_edge_tts(text, output_file)
        elif self.config.backend == TTSBackend.OPENAI:
            audio_data = self._synthesize_openai(text, output_file)
        elif self.config.backend == TTSBackend.ELEVENLABS:
            audio_data = self._synthesize_elevenlabs(text, output_file)
        else:
            raise ValueError(f"Unsupported TTS backend: {self.config.backend}")
        
        # Cache the result if enabled
        if self.config.enable_cache and self.config.cache_dir and isinstance(audio_data, bytes):
            with open(cache_path, "wb") as f:
                f.write(audio_data)
        
        return audio_data
    
    def _synthesize_system(self, text: str, output_file: Optional[str] = None) -> Union[bytes, str]:
        """Synthesize speech using system TTS."""
        import platform
        system = platform.system()
        
        if system == "Darwin":  # macOS
            return self._synthesize_macos(text, output_file)
        elif system == "Windows":  # Windows
            return self._synthesize_windows(text, output_file)
        elif system == "Linux":  # Linux
            return self._synthesize_linux(text, output_file)
        else:
            raise RuntimeError(f"Unsupported platform for system TTS: {system}")
    
    def _synthesize_macos(self, text: str, output_file: Optional[str] = None) -> Union[bytes, str]:
        """Synthesize speech using macOS TTS."""
        # Determine output path
        output_path = output_file
        if not output_path:
            with tempfile.NamedTemporaryFile(suffix=f".{self.config.output_format}", delete=False) as temp_file:
                output_path = temp_file.name
        
        # Build say command
        cmd = ["say"]
        
        # Add voice if specified
        if self.config.voice.voice_id != "default":
            cmd.extend(["-v", self.config.voice.voice_id])
        
        # Add rate if different from default
        if self.config.voice.rate != 1.0:
            # macOS say rate is words per minute, default is ~200
            cmd.extend(["-r", str(int(200 * self.config.voice.rate))])
        
        # Add output file
        cmd.extend(["-o", output_path, "--data-format=LEF32@44100"])
        
        # Add text
        cmd.append(text)
        
        # Run command
        process = subprocess.run(cmd, check=True, capture_output=True)
        
        # Return output
        if output_file:
            return output_file
        else:
            with open(output_path, "rb") as f:
                audio_data = f.read()
            
            # Delete temporary file
            os.unlink(output_path)
            
            return audio_data
    
    def _synthesize_windows(self, text: str, output_file: Optional[str] = None) -> Union[bytes, str]:
        """Synthesize speech using Windows TTS."""
        # Windows TTS through PowerShell
        if not output_file:
            with tempfile.NamedTemporaryFile(suffix=f".{self.config.output_format}", delete=False) as temp_file:
                output_path = temp_file.name
        else:
            output_path = output_file
        
        # PowerShell script to generate speech
        ps_script = f"""
        Add-Type -AssemblyName System.Speech
        $synthesizer = New-Object System.Speech.Synthesis.SpeechSynthesizer
        """
        
        # Add voice selection if not default
        if self.config.voice.voice_id != "default":
            ps_script += f"""
            $voice = $synthesizer.GetInstalledVoices() | Where-Object {{ $_.VoiceInfo.Name -eq '{self.config.voice.voice_id}' }} | Select-Object -First 1
            if ($voice) {{
                $synthesizer.SelectVoice($voice.VoiceInfo.Name)
            }}
            """
        
        # Configure rate and volume
        if self.config.voice.rate != 1.0:
            ps_script += f"$synthesizer.Rate = {int(self.config.voice.rate * 10) - 10}\n"
            
        if self.config.voice.volume != 1.0:
            ps_script += f"$synthesizer.Volume = {int(self.config.voice.volume * 100)}\n"
        
        # Set output and speak
        ps_script += f"""
        $synthesizer.SetOutputToWaveFile('{output_path}')
        $synthesizer.Speak('{text.replace("'", "''")}')
        $synthesizer.Dispose()
        """
        
        # Run PowerShell script
        cmd = ["powershell", "-Command", ps_script]
        process = subprocess.run(cmd, check=True, capture_output=True)
        
        # Return output
        if output_file:
            return output_file
        else:
            with open(output_path, "rb") as f:
                audio_data = f.read()
            
            # Delete temporary file
            os.unlink(output_path)
            
            return audio_data
    
    def _synthesize_linux(self, text: str, output_file: Optional[str] = None) -> Union[bytes, str]:
        """Synthesize speech using Linux TTS."""
        # Determine output path
        output_path = output_file
        if not output_path:
            with tempfile.NamedTemporaryFile(suffix=f".{self.config.output_format}", delete=False) as temp_file:
                output_path = temp_file.name
        
        # Try espeak first
        try:
            cmd = ["espeak", "-w", output_path]
            
            # Add voice if specified
            if self.config.voice.voice_id != "default":
                cmd.extend(["-v", self.config.voice.voice_id])
            
            # Add rate if different from default
            if self.config.voice.rate != 1.0:
                # espeak rate is words per minute, default is 175
                cmd.extend(["-s", str(int(175 * self.config.voice.rate))])
            
            # Add volume
            if self.config.voice.volume != 1.0:
                cmd.extend(["-a", str(int(self.config.voice.volume * 100))])
            
            # Add text
            cmd.append(text)
            
            # Run command
            process = subprocess.run(cmd, check=True, capture_output=True)
        except (subprocess.SubprocessError, FileNotFoundError):
            # Fall back to festival
            try:
                # Write text to temporary file
                with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as text_file:
                    text_file.write(text)
                    text_path = text_file.name
                
                cmd = ["text2wave", text_path, "-o", output_path]
                process = subprocess.run(cmd, check=True, capture_output=True)
                
                # Delete text file
                os.unlink(text_path)
            except (subprocess.SubprocessError, FileNotFoundError):
                raise RuntimeError("No TTS system available on Linux")
        
        # Return output
        if output_file:
            return output_file
        else:
            with open(output_path, "rb") as f:
                audio_data = f.read()
            
            # Delete temporary file
            os.unlink(output_path)
            
            return audio_data
    
    def _synthesize_pyttsx3(self, text: str, output_file: Optional[str] = None) -> Union[bytes, str]:
        """Synthesize speech using pyttsx3."""
        if not self._pyttsx3_engine:
            self._init_pyttsx3()
        
        # Determine output path
        output_path = output_file
        if not output_path:
            with tempfile.NamedTemporaryFile(suffix=f".{self.config.output_format}", delete=False) as temp_file:
                output_path = temp_file.name
        
        # Save to file
        self._pyttsx3_engine.save_to_file(text, output_path)
        self._pyttsx3_engine.runAndWait()
        
        # Return output
        if output_file:
            return output_file
        else:
            with open(output_path, "rb") as f:
                audio_data = f.read()
            
            # Delete temporary file
            os.unlink(output_path)
            
            return audio_data
    
    def _synthesize_edge_tts(self, text: str, output_file: Optional[str] = None) -> Union[bytes, str]:
        """Synthesize speech using Microsoft Edge TTS."""
        if not HAS_EDGE_TTS:
            raise ImportError("edge-tts is not installed")
        
        import asyncio
        from io import BytesIO
        
        # Determine output path
        output_path = output_file
        if not output_path:
            with tempfile.NamedTemporaryFile(suffix=f".{self.config.output_format}", delete=False) as temp_file:
                output_path = temp_file.name
        
        # Create voice string
        voice = self.config.voice.voice_id
        if voice == "default":
            voice = f"en-US-AriaNeural"  # Default voice
        
        # Generate speech
        async def _generate():
            # Create communicator
            communicate = edge_tts.Communicate(text, voice)
            
            # Apply voice configuration
            if self.config.voice.rate != 1.0:
                # Edge TTS rate is percentage change, e.g., +10% or -20%
                rate_percent = int((self.config.voice.rate - 1.0) * 100)
                communicate.rate = f"{rate_percent:+d}%"
            
            if self.config.voice.volume != 1.0:
                # Edge TTS volume is percentage change
                volume_percent = int((self.config.voice.volume - 1.0) * 100)
                communicate.volume = f"{volume_percent:+d}%"
            
            if self.config.voice.pitch != 1.0:
                # Edge TTS pitch is semitones, roughly map 0.5-1.5 to -10 to +10 semitones
                pitch_semitones = int((self.config.voice.pitch - 1.0) * 20)
                communicate.pitch = f"{pitch_semitones:+d}Hz"
            
            # Run synthesis
            await communicate.save(output_path)
        
        # Run async function
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_generate())
        finally:
            loop.close()
        
        # Return output
        if output_file:
            return output_file
        else:
            with open(output_path, "rb") as f:
                audio_data = f.read()
            
            # Delete temporary file
            os.unlink(output_path)
            
            return audio_data
    
    def _synthesize_openai(self, text: str, output_file: Optional[str] = None) -> Union[bytes, str]:
        """Synthesize speech using OpenAI TTS API."""
        if not self._openai_client:
            self._init_openai()
        
        # Determine model and voice
        voice = self.config.voice.voice_id
        if voice == "default":
            voice = "alloy"  # Default voice
        
        model = "tts-1"  # Default model
        if "hd" in self.config.voice.voice_id:
            model = "tts-1-hd"
        
        # Generate speech
        response = self._openai_client.audio.speech.create(
            model=model,
            voice=voice,
            input=text,
            response_format=self.config.output_format
        )
        
        # Get audio data
        audio_data = response.content
        
        # Write to file if requested
        if output_file:
            with open(output_file, "wb") as f:
                f.write(audio_data)
            return output_file
        
        return audio_data
    
    def _synthesize_elevenlabs(self, text: str, output_file: Optional[str] = None) -> Union[bytes, str]:
        """Synthesize speech using ElevenLabs TTS API."""
        if not "_elevenlabs_generate" in dir(self):
            self._init_elevenlabs()
        
        # Get voice ID
        voice_id = self.config.voice.voice_id
        if voice_id == "default":
            voice_id = None  # Use ElevenLabs default
        
        # Generate speech
        audio_data = self._elevenlabs_generate(
            text=text,
            voice=voice_id,
            model="eleven_monolingual_v1"
        )
        
        # Write to file if requested
        if output_file:
            with open(output_file, "wb") as f:
                f.write(audio_data)
            return output_file
        
        return audio_data
    
    def play(self, audio_data: Union[bytes, str]) -> None:
        """
        Play audio data.
        
        Args:
            audio_data: Audio data as bytes or path to audio file
        """
        if not HAS_PYGAME:
            raise ImportError("Pygame is required for audio playback")
        
        # Load audio
        if isinstance(audio_data, bytes):
            # Write bytes to temporary file
            with tempfile.NamedTemporaryFile(suffix=f".{self.config.output_format}", delete=False) as temp_file:
                temp_file.write(audio_data)
                audio_path = temp_file.name
            cleanup_needed = True
        else:
            audio_path = audio_data
            cleanup_needed = False
        
        try:
            # Play audio
            pygame.mixer.music.load(audio_path)
            pygame.mixer.music.play()
            
            # Wait for playback to finish
            while pygame.mixer.music.get_busy():
                pygame.time.delay(100)
        finally:
            # Delete temporary file if created
            if cleanup_needed and os.path.exists(audio_path):
                os.unlink(audio_path)
    
    def say(self, text: str) -> None:
        """
        Synthesize and play speech.
        
        Args:
            text: Text to speak
        """
        audio_data = self.synthesize(text)
        self.play(audio_data)


# Simple command-line interface for testing
def main():
    """Command-line interface for testing TTS."""
    import argparse
    import sys
    
    parser = argparse.ArgumentParser(description="Test text-to-speech")
    parser.add_argument("--backend", choices=["system", "pyttsx3", "edge_tts", "openai", "elevenlabs"], 
                       default="system", help="TTS backend to use")
    parser.add_argument("--voice", default="default", help="Voice ID or name")
    parser.add_argument("--rate", type=float, default=1.0, help="Speech rate (0.5-2.0)")
    parser.add_argument("--volume", type=float, default=1.0, help="Volume (0.0-1.0)")
    parser.add_argument("--pitch", type=float, default=1.0, help="Pitch (0.5-2.0)")
    parser.add_argument("--language", default="en-US", help="Language code")
    parser.add_argument("--output", help="Output file path")
    parser.add_argument("--list-voices", action="store_true", help="List available voices")
    parser.add_argument("--api-key", help="API key for cloud TTS services")
    parser.add_argument("text", nargs="?", help="Text to speak")
    
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Create TTS config
    config = TTSConfig(
        backend=TTSBackend(args.backend),
        voice=VoiceConfig(
            voice_id=args.voice,
            language=args.language,
            rate=args.rate,
            pitch=args.pitch,
            volume=args.volume
        ),
        api_key=args.api_key,
        enable_cache=True,
        cache_dir="cache/tts"
    )
    
    # Create TTS system
    try:
        tts = TextToSpeech(config)
    except Exception as e:
        print(f"Error initializing TTS: {str(e)}")
        sys.exit(1)
    
    # List voices if requested
    if args.list_voices:
        voices = tts.list_available_voices()
        print("\nAvailable voices:")
        for voice in voices:
            print(f"  ID: {voice['id']}")
            print(f"  Name: {voice['name']}")
            for key, value in voice.items():
                if key not in ('id', 'name'):
                    print(f"  {key}: {value}")
            print()
        return
    
    # Speak text if provided
    if args.text:
        if args.output:
            output_file = tts.synthesize(args.text, args.output)
            print(f"Speech saved to: {output_file}")
        else:
            print("Speaking...")
            tts.say(args.text)
    else:
        print("No text provided. Use --list-voices to list available voices.")


if __name__ == "__main__":
    main() 