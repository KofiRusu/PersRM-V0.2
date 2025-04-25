"""
Text-to-Speech Module for PersLM

This module provides text-to-speech capabilities for real-time interactions
using various engines like ElevenLabs, macOS TTS, and more.
"""

import os
import io
import time
import json
import logging
import tempfile
import platform
from typing import Optional, Dict, Any, List, Callable, Union, Tuple
from dataclasses import dataclass
from enum import Enum
from abc import ABC, abstractmethod
from pathlib import Path

logger = logging.getLogger(__name__)

# Try to import optional dependencies
try:
    from elevenlabs import generate, set_api_key, voices, save
    ELEVENLABS_AVAILABLE = True
except ImportError:
    ELEVENLABS_AVAILABLE = False
    logger.warning("ElevenLabs not available. Install with: pip install elevenlabs")

try:
    from gtts import gTTS
    GTTS_AVAILABLE = True
except ImportError:
    GTTS_AVAILABLE = False
    logger.warning("gTTS not available. Install with: pip install gtts")

try:
    import pyttsx3
    PYTTSX3_AVAILABLE = True
except ImportError:
    PYTTSX3_AVAILABLE = False
    logger.warning("pyttsx3 not available. Install with: pip install pyttsx3")


class TTSEngine(Enum):
    """Supported TTS engines."""
    ELEVENLABS = "elevenlabs"
    MACOS = "macos"
    GTTS = "gtts"
    PYTTSX3 = "pyttsx3"
    

@dataclass
class VoiceConfig:
    """Configuration for TTS voice."""
    voice_id: str = ""  # Voice identifier 
    name: str = "default"  # Human-readable name
    language: str = "en"  # Language code
    gender: str = "neutral"  # male, female, neutral
    rate: float = 1.0  # Speech rate (1.0 = normal)
    pitch: float = 1.0  # Speech pitch (1.0 = normal)
    volume: float = 1.0  # Speech volume (1.0 = normal)


class TTSProvider(ABC):
    """Abstract base class for TTS providers."""
    
    @abstractmethod
    def generate_speech(
        self, 
        text: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> Tuple[bytes, str]:
        """
        Generate speech from text.
        
        Args:
            text: Text to convert to speech
            voice_config: Voice configuration
            
        Returns:
            Tuple of (audio_data, format)
            audio_data: Raw audio data
            format: Audio format (e.g., 'wav', 'mp3')
        """
        pass
    
    @abstractmethod
    def save_to_file(
        self, 
        text: str, 
        output_path: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> str:
        """
        Save generated speech to a file.
        
        Args:
            text: Text to convert to speech
            output_path: Path to save audio file
            voice_config: Voice configuration
            
        Returns:
            Path to saved audio file
        """
        pass
        
    @abstractmethod
    def get_available_voices(self) -> List[VoiceConfig]:
        """
        Get list of available voices.
        
        Returns:
            List of available voice configurations
        """
        pass
    
    def play(
        self, 
        text: str, 
        voice_config: Optional[VoiceConfig] = None,
        blocking: bool = True
    ) -> None:
        """
        Play generated speech.
        
        Args:
            text: Text to speak
            voice_config: Voice configuration
            blocking: Whether to block until playback completes
        """
        try:
            # Generate speech to a temporary file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                file_path = self.save_to_file(text, temp_file.name, voice_config)
            
            # Play audio
            self._play_audio(file_path, blocking)
            
            # Clean up
            try:
                os.unlink(file_path)
            except:
                pass
                
        except Exception as e:
            logger.error(f"Error playing speech: {e}")
            
    def _play_audio(self, file_path: str, blocking: bool = True) -> None:
        """
        Play audio file.
        
        Args:
            file_path: Path to audio file
            blocking: Whether to block until playback completes
        """
        try:
            # Try different methods for playback
            if platform.system() == "Darwin":  # macOS
                import subprocess
                
                if blocking:
                    subprocess.run(["afplay", file_path], check=True)
                else:
                    subprocess.Popen(["afplay", file_path])
                    
            elif platform.system() == "Windows":
                import winsound
                
                if blocking:
                    winsound.PlaySound(file_path, winsound.SND_FILENAME)
                else:
                    import threading
                    threading.Thread(
                        target=winsound.PlaySound,
                        args=(file_path, winsound.SND_FILENAME),
                        daemon=True
                    ).start()
                    
            else:  # Linux or other
                try:
                    import pygame
                    
                    pygame.mixer.init()
                    pygame.mixer.music.load(file_path)
                    pygame.mixer.music.play()
                    
                    if blocking:
                        while pygame.mixer.music.get_busy():
                            pygame.time.Clock().tick(10)
                            
                except ImportError:
                    # Try using system commands
                    import subprocess
                    
                    # Try different players
                    players = ["aplay", "paplay", "mpg123", "mpg321"]
                    
                    for player in players:
                        try:
                            if blocking:
                                subprocess.run([player, file_path], check=True)
                            else:
                                subprocess.Popen([player, file_path])
                            break
                        except (subprocess.SubprocessError, FileNotFoundError):
                            continue
                    else:
                        logger.error("No audio player found. Install pygame for audio playback.")
                        
        except Exception as e:
            logger.error(f"Error playing audio: {e}")


class ElevenLabsTTS(TTSProvider):
    """TTS provider using ElevenLabs API."""
    
    def __init__(
        self, 
        api_key: Optional[str] = None,
        model_id: str = "eleven_monolingual_v1",
        stability: float = 0.5,
        similarity_boost: float = 0.5,
        use_speaker_boost: bool = True
    ):
        """
        Initialize ElevenLabs TTS provider.
        
        Args:
            api_key: ElevenLabs API key
            model_id: Model ID to use
            stability: Stability factor (0.0 to 1.0)
            similarity_boost: Similarity boost factor (0.0 to 1.0)
            use_speaker_boost: Whether to use speaker boost
        """
        if not ELEVENLABS_AVAILABLE:
            raise ImportError("ElevenLabs not available. Install with: pip install elevenlabs")
            
        # Set API key
        if api_key:
            set_api_key(api_key)
        elif os.environ.get("ELEVENLABS_API_KEY"):
            set_api_key(os.environ.get("ELEVENLABS_API_KEY"))
        else:
            logger.warning("No ElevenLabs API key provided. Using limited free tier.")
            
        self.model_id = model_id
        self.stability = stability
        self.similarity_boost = similarity_boost
        self.use_speaker_boost = use_speaker_boost
        
        # Cache available voices
        self._available_voices = None
        
    def generate_speech(
        self, 
        text: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> Tuple[bytes, str]:
        """Generate speech using ElevenLabs API."""
        voice_id = "21m00Tcm4TlvDq8ikWAM" if voice_config is None else voice_config.voice_id
        
        audio_data = generate(
            text=text,
            voice=voice_id,
            model=self.model_id,
            stability=self.stability,
            similarity_boost=self.similarity_boost,
            use_speaker_boost=self.use_speaker_boost
        )
        
        return audio_data, "mp3"
        
    def save_to_file(
        self, 
        text: str, 
        output_path: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> str:
        """Save generated speech to a file."""
        audio_data, _ = self.generate_speech(text, voice_config)
        
        # Ensure output path has correct extension
        if not output_path.endswith(".mp3"):
            output_path = f"{output_path}.mp3"
            
        save(audio_data, output_path)
        return output_path
        
    def get_available_voices(self) -> List[VoiceConfig]:
        """Get list of available ElevenLabs voices."""
        if self._available_voices is None:
            try:
                elevenlabs_voices = voices()
                
                self._available_voices = []
                for voice in elevenlabs_voices:
                    gender = "male" if voice.labels.get("gender") == "male" else "female"
                    
                    self._available_voices.append(VoiceConfig(
                        voice_id=voice.voice_id,
                        name=voice.name,
                        language=voice.labels.get("language", "en"),
                        gender=gender
                    ))
            except Exception as e:
                logger.error(f"Error fetching ElevenLabs voices: {e}")
                return [VoiceConfig(voice_id="21m00Tcm4TlvDq8ikWAM", name="Rachel")]
                
        return self._available_voices


class MacOSTTS(TTSProvider):
    """TTS provider using macOS native TTS."""
    
    def __init__(self):
        """Initialize macOS TTS provider."""
        if platform.system() != "Darwin":
            raise ImportError("MacOS TTS is only available on macOS")
            
        # Cache available voices
        self._available_voices = None
        
    def generate_speech(
        self, 
        text: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> Tuple[bytes, str]:
        """Generate speech using macOS say command."""
        temp_file = tempfile.NamedTemporaryFile(suffix=".aiff", delete=False)
        temp_file.close()
        
        voice_name = "Alex" if voice_config is None else voice_config.name
        rate = 175 if voice_config is None else int(175 * voice_config.rate)
        
        import subprocess
        subprocess.run([
            "say", 
            "-v", voice_name, 
            "-r", str(rate), 
            "-o", temp_file.name, 
            text
        ], check=True)
        
        with open(temp_file.name, 'rb') as f:
            audio_data = f.read()
            
        try:
            os.unlink(temp_file.name)
        except:
            pass
            
        return audio_data, "aiff"
        
    def save_to_file(
        self, 
        text: str, 
        output_path: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> str:
        """Save generated speech to a file."""
        voice_name = "Alex" if voice_config is None else voice_config.name
        rate = 175 if voice_config is None else int(175 * voice_config.rate)
        
        # Ensure output path has correct extension
        if not output_path.endswith((".aiff", ".wav")):
            output_path = f"{output_path}.aiff"
            
        import subprocess
        subprocess.run([
            "say", 
            "-v", voice_name, 
            "-r", str(rate), 
            "-o", output_path, 
            text
        ], check=True)
        
        return output_path
        
    def get_available_voices(self) -> List[VoiceConfig]:
        """Get list of available macOS voices."""
        if self._available_voices is None:
            try:
                import subprocess
                result = subprocess.run(
                    ["say", "-v", "?"], 
                    capture_output=True, 
                    text=True, 
                    check=True
                )
                
                voices = []
                for line in result.stdout.splitlines():
                    parts = line.strip().split()
                    if len(parts) >= 2:
                        name = parts[0]
                        language_code = parts[-1].strip("()")
                        gender = "female" if "female" in line.lower() else "male"
                        
                        voices.append(VoiceConfig(
                            voice_id=name,
                            name=name,
                            language=language_code,
                            gender=gender
                        ))
                        
                self._available_voices = voices
                
            except Exception as e:
                logger.error(f"Error fetching macOS voices: {e}")
                return [VoiceConfig(name="Alex", language="en_US")]
                
        return self._available_voices


class GTTSProvider(TTSProvider):
    """TTS provider using Google Text-to-Speech."""
    
    def __init__(
        self,
        language: str = "en",
        slow: bool = False
    ):
        """
        Initialize Google TTS provider.
        
        Args:
            language: Language code
            slow: Whether to speak slowly
        """
        if not GTTS_AVAILABLE:
            raise ImportError("gTTS not available. Install with: pip install gtts")
            
        self.language = language
        self.slow = slow
        
    def generate_speech(
        self, 
        text: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> Tuple[bytes, str]:
        """Generate speech using Google TTS."""
        language = self.language
        if voice_config and voice_config.language:
            language = voice_config.language
            
        tts = gTTS(text=text, lang=language, slow=self.slow)
        
        # Save to bytes buffer
        mp3_buffer = io.BytesIO()
        tts.write_to_fp(mp3_buffer)
        mp3_buffer.seek(0)
        
        return mp3_buffer.read(), "mp3"
        
    def save_to_file(
        self, 
        text: str, 
        output_path: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> str:
        """Save generated speech to a file."""
        language = self.language
        if voice_config and voice_config.language:
            language = voice_config.language
            
        # Ensure output path has correct extension
        if not output_path.endswith(".mp3"):
            output_path = f"{output_path}.mp3"
            
        tts = gTTS(text=text, lang=language, slow=self.slow)
        tts.save(output_path)
        
        return output_path
        
    def get_available_voices(self) -> List[VoiceConfig]:
        """Get list of available Google TTS voices."""
        # gTTS doesn't have voice selection, just languages
        languages = {
            "en": "English",
            "fr": "French",
            "es": "Spanish",
            "de": "German",
            "it": "Italian",
            "ja": "Japanese",
            "ko": "Korean",
            "pt": "Portuguese",
            "ru": "Russian",
            "zh": "Chinese",
        }
        
        voices = []
        for code, name in languages.items():
            voices.append(VoiceConfig(
                voice_id=code,
                name=f"gTTS {name}",
                language=code,
                gender="neutral"
            ))
            
        return voices


class Pyttsx3Provider(TTSProvider):
    """TTS provider using pyttsx3 (offline TTS)."""
    
    def __init__(self):
        """Initialize pyttsx3 TTS provider."""
        if not PYTTSX3_AVAILABLE:
            raise ImportError("pyttsx3 not available. Install with: pip install pyttsx3")
            
        self.engine = pyttsx3.init()
        
        # Cache available voices
        self._available_voices = None
        
    def generate_speech(
        self, 
        text: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> Tuple[bytes, str]:
        """Generate speech using pyttsx3."""
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        temp_file.close()
        
        # Configure engine
        if voice_config:
            if voice_config.voice_id:
                self.engine.setProperty('voice', voice_config.voice_id)
            if voice_config.rate:
                self.engine.setProperty('rate', int(self.engine.getProperty('rate') * voice_config.rate))
            if voice_config.volume:
                self.engine.setProperty('volume', voice_config.volume)
                
        # Save to file
        self.engine.save_to_file(text, temp_file.name)
        self.engine.runAndWait()
        
        with open(temp_file.name, 'rb') as f:
            audio_data = f.read()
            
        try:
            os.unlink(temp_file.name)
        except:
            pass
            
        return audio_data, "wav"
        
    def save_to_file(
        self, 
        text: str, 
        output_path: str, 
        voice_config: Optional[VoiceConfig] = None
    ) -> str:
        """Save generated speech to a file."""
        # Ensure output path has correct extension
        if not output_path.endswith(".wav"):
            output_path = f"{output_path}.wav"
            
        # Configure engine
        if voice_config:
            if voice_config.voice_id:
                self.engine.setProperty('voice', voice_config.voice_id)
            if voice_config.rate:
                self.engine.setProperty('rate', int(self.engine.getProperty('rate') * voice_config.rate))
            if voice_config.volume:
                self.engine.setProperty('volume', voice_config.volume)
                
        # Save to file
        self.engine.save_to_file(text, output_path)
        self.engine.runAndWait()
        
        return output_path
        
    def get_available_voices(self) -> List[VoiceConfig]:
        """Get list of available pyttsx3 voices."""
        if self._available_voices is None:
            voices = []
            for voice in self.engine.getProperty('voices'):
                # Try to determine gender from voice name
                gender = "neutral"
                if "female" in voice.name.lower():
                    gender = "female"
                elif "male" in voice.name.lower():
                    gender = "male"
                    
                # Try to extract language from ID
                language = "en"
                if "_" in voice.id:
                    language = voice.id.split("_")[1]
                    
                voices.append(VoiceConfig(
                    voice_id=voice.id,
                    name=voice.name,
                    language=language,
                    gender=gender
                ))
                
            self._available_voices = voices
            
        return self._available_voices
        
    def play(
        self, 
        text: str, 
        voice_config: Optional[VoiceConfig] = None,
        blocking: bool = True
    ) -> None:
        """
        Play speech directly using pyttsx3.
        
        Args:
            text: Text to speak
            voice_config: Voice configuration
            blocking: Whether to block until playback completes
        """
        # Configure engine
        if voice_config:
            if voice_config.voice_id:
                self.engine.setProperty('voice', voice_config.voice_id)
            if voice_config.rate:
                self.engine.setProperty('rate', int(self.engine.getProperty('rate') * voice_config.rate))
            if voice_config.volume:
                self.engine.setProperty('volume', voice_config.volume)
                
        # Play audio
        self.engine.say(text)
        
        if blocking:
            self.engine.runAndWait()
        else:
            import threading
            threading.Thread(target=self.engine.runAndWait, daemon=True).start()


class TextToSpeech:
    """
    Main text-to-speech interface that orchestrates speech generation and playback.
    """
    
    def __init__(
        self,
        engine: Union[str, TTSEngine] = TTSEngine.PYTTSX3,
        voice_config: Optional[VoiceConfig] = None,
        engine_options: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize text-to-speech system.
        
        Args:
            engine: TTS engine to use
            voice_config: Voice configuration
            engine_options: Engine-specific options
        """
        self.engine_name = engine.value if isinstance(engine, TTSEngine) else engine
        self.voice_config = voice_config or VoiceConfig()
        self.engine_options = engine_options or {}
        
        # Initialize TTS provider
        self._init_provider()
        
    def _init_provider(self) -> None:
        """Initialize the selected TTS provider."""
        try:
            if self.engine_name == TTSEngine.ELEVENLABS.value:
                self.provider = ElevenLabsTTS(**self.engine_options)
            elif self.engine_name == TTSEngine.MACOS.value:
                self.provider = MacOSTTS()
            elif self.engine_name == TTSEngine.GTTS.value:
                self.provider = GTTSProvider(**self.engine_options)
            elif self.engine_name == TTSEngine.PYTTSX3.value:
                self.provider = Pyttsx3Provider()
            else:
                raise ValueError(f"Unsupported TTS engine: {self.engine_name}")
                
        except ImportError as e:
            logger.error(f"Failed to initialize TTS provider: {e}")
            logger.info("Falling back to pyttsx3 provider")
            
            try:
                self.provider = Pyttsx3Provider()
            except ImportError:
                logger.error("Failed to initialize fallback TTS provider")
                self.provider = None
                
    def speak(self, text: str, blocking: bool = True) -> bool:
        """
        Convert text to speech and play it.
        
        Args:
            text: Text to speak
            blocking: Whether to block until playback completes
            
        Returns:
            True if successful, False otherwise
        """
        if not self.provider:
            logger.error("No TTS provider available")
            return False
            
        try:
            self.provider.play(text, self.voice_config, blocking)
            return True
        except Exception as e:
            logger.error(f"Error during speech synthesis: {e}")
            return False
            
    def save_to_file(self, text: str, output_path: str) -> Optional[str]:
        """
        Convert text to speech and save to file.
        
        Args:
            text: Text to convert
            output_path: Path to save audio file
            
        Returns:
            Path to saved file if successful, None otherwise
        """
        if not self.provider:
            logger.error("No TTS provider available")
            return None
            
        try:
            return self.provider.save_to_file(text, output_path, self.voice_config)
        except Exception as e:
            logger.error(f"Error saving speech to file: {e}")
            return None
            
    def get_available_voices(self) -> List[VoiceConfig]:
        """
        Get list of available voices.
        
        Returns:
            List of available voice configurations
        """
        if not self.provider:
            return []
            
        return self.provider.get_available_voices()
        
    def set_voice(self, voice_id: str) -> bool:
        """
        Set voice by ID.
        
        Args:
            voice_id: Voice identifier
            
        Returns:
            True if successful, False otherwise
        """
        voices = self.get_available_voices()
        for voice in voices:
            if voice.voice_id == voice_id:
                self.voice_config = voice
                return True
                
        return False


# CLI interface
def main():
    """Command-line interface for text-to-speech."""
    import argparse
    
    parser = argparse.ArgumentParser(description="PersLM Text-to-Speech Module")
    parser.add_argument("--engine", choices=[e.value for e in TTSEngine], 
                      default="pyttsx3", help="TTS engine to use")
    parser.add_argument("--text", help="Text to speak")
    parser.add_argument("--file", help="Read text from file")
    parser.add_argument("--output", help="Output audio file path")
    parser.add_argument("--voice", help="Voice ID or name")
    parser.add_argument("--language", default="en", help="Language code")
    parser.add_argument("--rate", type=float, default=1.0, help="Speech rate (1.0 = normal)")
    parser.add_argument("--pitch", type=float, default=1.0, help="Speech pitch (1.0 = normal)")
    parser.add_argument("--volume", type=float, default=1.0, help="Speech volume (1.0 = normal)")
    parser.add_argument("--list-voices", action="store_true", help="List available voices")
    parser.add_argument("--api-key", help="API key for paid services")
    parser.add_argument("--non-blocking", action="store_true", help="Non-blocking playback")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    # Configure logging
    logging_level = logging.DEBUG if args.debug else logging.INFO
    logging.basicConfig(level=logging_level, 
                     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Build engine options
    engine_options = {}
    
    if args.engine == TTSEngine.ELEVENLABS.value:
        engine_options["api_key"] = args.api_key
    elif args.engine == TTSEngine.GTTS.value:
        engine_options["language"] = args.language
        
    # Create voice config
    voice_config = VoiceConfig(
        voice_id=args.voice or "",
        name=args.voice or "",
        language=args.language,
        rate=args.rate,
        pitch=args.pitch,
        volume=args.volume
    )
    
    # Initialize TTS
    tts = TextToSpeech(engine=args.engine, voice_config=voice_config, engine_options=engine_options)
    
    if args.list_voices:
        # List available voices
        voices = tts.get_available_voices()
        print(f"Available voices for {args.engine}:")
        for voice in voices:
            print(f"  ID: {voice.voice_id}")
            print(f"  Name: {voice.name}")
            print(f"  Language: {voice.language}")
            print(f"  Gender: {voice.gender}")
            print()
        return
    
    # Get text to speak
    text = args.text
    if args.file:
        try:
            with open(args.file, 'r', encoding='utf-8') as f:
                text = f.read()
        except Exception as e:
            print(f"Error reading file: {e}")
            return
            
    if not text:
        print("Error: No text provided. Use --text or --file")
        return
        
    # Output to file or speak
    if args.output:
        output_path = tts.save_to_file(text, args.output)
        if output_path:
            print(f"Speech saved to {output_path}")
        else:
            print("Error saving speech to file")
    else:
        print(f"Speaking: {text[:50]}{'...' if len(text) > 50 else ''}")
        tts.speak(text, blocking=not args.non_blocking)
        
        if args.non_blocking:
            input("Press Enter to exit...")


if __name__ == "__main__":
    main() 