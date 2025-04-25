"""
Speech-to-Text Module

This module provides speech recognition capabilities using Whisper or OpenAI's API.
"""

import os
import io
import time
import wave
import tempfile
import logging
from typing import Optional, Dict, Any, Union, Callable, List, Tuple
from enum import Enum
from dataclasses import dataclass, field
import threading
import queue

import numpy as np

try:
    import pyaudio
    HAS_PYAUDIO = True
except ImportError:
    HAS_PYAUDIO = False
    
try:
    import sounddevice as sd
    HAS_SOUNDDEVICE = True
except ImportError:
    HAS_SOUNDDEVICE = False
    
try:
    import soundfile as sf
    HAS_SOUNDFILE = True
except ImportError:
    HAS_SOUNDFILE = False

# Attempt to import whisper
try:
    import whisper
    HAS_WHISPER = True
except ImportError:
    HAS_WHISPER = False

# Attempt to import OpenAI client
try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

logger = logging.getLogger(__name__)


class SpeechBackend(str, Enum):
    """Available speech recognition backends."""
    WHISPER_LOCAL = "whisper_local"
    OPENAI = "openai"
    SYSTEM = "system"  # For platform-specific speech recognition


@dataclass
class AudioConfig:
    """Configuration for audio recording and processing."""
    sample_rate: int = 16000
    channels: int = 1
    format: str = "int16"
    chunk_size: int = 1024
    silence_threshold: float = 0.03
    silence_duration: float = 2.0  # seconds of silence to stop recording
    max_duration: float = 30.0  # maximum recording duration in seconds
    device_index: Optional[int] = None


@dataclass
class SpeechConfig:
    """Configuration for speech recognition."""
    backend: SpeechBackend = SpeechBackend.WHISPER_LOCAL
    model_name: str = "base"  # Whisper model size (tiny, base, small, medium, large)
    language: Optional[str] = None
    api_key: Optional[str] = None
    translate: bool = False
    audio: AudioConfig = field(default_factory=AudioConfig)
    enable_vad: bool = True  # Voice Activity Detection


class SpeechRecognizer:
    """
    Speech recognition system using either local Whisper or OpenAI's API.
    
    Features:
    - Real-time audio capture
    - Voice activity detection
    - Transcription using Whisper
    - Streaming recognition with callbacks
    """
    
    def __init__(self, config: Optional[SpeechConfig] = None):
        """
        Initialize the speech recognizer.
        
        Args:
            config: Configuration for speech recognition
        """
        self.config = config or SpeechConfig()
        
        # Initialize backend
        self._model = None
        self._openai_client = None
        
        if self.config.backend == SpeechBackend.WHISPER_LOCAL:
            self._init_whisper()
        elif self.config.backend == SpeechBackend.OPENAI:
            self._init_openai()
        elif self.config.backend == SpeechBackend.SYSTEM:
            self._init_system()
        
        # Initialize audio system
        self._audio_interface = self._get_audio_interface()
        
        # Recording state
        self._recording = False
        self._audio_queue = queue.Queue()
        self._record_thread = None
        self._frames = []
        self._is_speaking = False
        self._silence_frames = 0
        
    def _init_whisper(self):
        """Initialize Whisper model."""
        if not HAS_WHISPER:
            raise ImportError(
                "Whisper is not installed. Install with: pip install openai-whisper"
            )
        
        logger.info(f"Loading Whisper model: {self.config.model_name}")
        self._model = whisper.load_model(self.config.model_name)
        logger.info(f"Whisper model loaded successfully")
    
    def _init_openai(self):
        """Initialize OpenAI client."""
        if not HAS_OPENAI:
            raise ImportError(
                "OpenAI SDK is not installed. Install with: pip install openai"
            )
        
        # Get API key from config or environment
        api_key = self.config.api_key or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError(
                "OpenAI API key not provided. Set it in config or OPENAI_API_KEY environment variable."
            )
            
        self._openai_client = OpenAI(api_key=api_key)
        logger.info("OpenAI client initialized")
    
    def _init_system(self):
        """Initialize system-specific speech recognition."""
        # Placeholder for system-specific implementations
        # This could use platform-specific libraries like:
        # - Windows: Windows Speech Recognition
        # - macOS: NSSpeechRecognizer
        # - Linux: DeepSpeech, Vosk, etc.
        raise NotImplementedError("System speech recognition not implemented yet")
    
    def _get_audio_interface(self):
        """Get audio recording interface."""
        if HAS_PYAUDIO:
            return self._record_pyaudio
        elif HAS_SOUNDDEVICE:
            return self._record_sounddevice
        else:
            raise ImportError(
                "No audio interface available. Install either PyAudio or SoundDevice."
            )
    
    def _record_pyaudio(self, duration: Optional[float] = None, vad: bool = True):
        """Record audio using PyAudio."""
        if not HAS_PYAUDIO:
            raise ImportError("PyAudio is not installed.")
        
        pa = pyaudio.PyAudio()
        
        # Open audio stream
        stream = pa.open(
            format=getattr(pyaudio, f"paInt{int(self.config.audio.format[3:])}"),
            channels=self.config.audio.channels,
            rate=self.config.audio.sample_rate,
            input=True,
            frames_per_buffer=self.config.audio.chunk_size,
            input_device_index=self.config.audio.device_index
        )
        
        # Initialize recording state
        self._frames = []
        self._recording = True
        self._is_speaking = False
        self._silence_frames = 0
        start_time = time.time()
        max_duration = duration or self.config.audio.max_duration
        
        logger.info(f"Recording started (max duration: {max_duration}s)")
        
        try:
            # Voice activity detection loop
            while self._recording and (time.time() - start_time) < max_duration:
                # Read audio data
                data = stream.read(self.config.audio.chunk_size, exception_on_overflow=False)
                self._frames.append(data)
                
                if vad and self.config.enable_vad:
                    # Convert bytes to numpy array
                    frame = np.frombuffer(data, dtype=np.int16)
                    # Calculate RMS amplitude
                    rms = np.sqrt(np.mean(frame.astype(np.float32) ** 2))
                    normalized_rms = rms / 32768.0  # Normalize to [0, 1]
                    
                    # Check if speaking
                    if normalized_rms > self.config.audio.silence_threshold:
                        self._is_speaking = True
                        self._silence_frames = 0
                    elif self._is_speaking:
                        self._silence_frames += 1
                        # Check if silence duration exceeded
                        silence_frames_threshold = int(
                            self.config.audio.silence_duration * 
                            self.config.audio.sample_rate / 
                            self.config.audio.chunk_size
                        )
                        if self._silence_frames >= silence_frames_threshold:
                            logger.info("Silence detected, stopping recording")
                            break
        finally:
            # Clean up
            stream.stop_stream()
            stream.close()
            pa.terminate()
            
        # Prepare audio data
        audio_data = b''.join(self._frames)
        return audio_data
    
    def _record_sounddevice(self, duration: Optional[float] = None, vad: bool = True):
        """Record audio using SoundDevice."""
        if not HAS_SOUNDDEVICE:
            raise ImportError("SoundDevice is not installed.")
        
        # Determine duration
        actual_duration = duration or self.config.audio.max_duration
        
        # Create a queue for audio data
        q = queue.Queue()
        
        # Callback function for audio chunks
        def callback(indata, frames, time, status):
            """This is called for each audio chunk."""
            if status:
                logger.warning(f"Audio status: {status}")
            q.put(indata.copy())
            
            if vad and self.config.enable_vad:
                # Check if speaking
                rms = np.sqrt(np.mean(indata ** 2))
                if rms > self.config.audio.silence_threshold:
                    self._is_speaking = True
                    self._silence_frames = 0
                elif self._is_speaking:
                    self._silence_frames += 1
                    
                    # Check if silence duration exceeded
                    silence_frames_threshold = int(
                        self.config.audio.silence_duration * 
                        self.config.audio.sample_rate / 
                        self.config.audio.chunk_size
                    )
                    if self._silence_frames >= silence_frames_threshold:
                        raise sd.CallbackStop("Silence detected")
        
        # Initialize recording state
        self._is_speaking = False
        self._silence_frames = 0
        
        # Record audio
        with sd.InputStream(
            samplerate=self.config.audio.sample_rate,
            channels=self.config.audio.channels,
            blocksize=self.config.audio.chunk_size,
            dtype=self.config.audio.format,
            callback=callback,
            device=self.config.audio.device_index
        ):
            logger.info(f"Recording started (max duration: {actual_duration}s)")
            
            # Collect audio chunks
            frames = []
            timeout = actual_duration + 1  # Add a little extra time
            end_time = time.time() + actual_duration
            
            try:
                while time.time() < end_time:
                    try:
                        frames.append(q.get(timeout=timeout))
                    except queue.Empty:
                        break
            except (KeyboardInterrupt, sd.CallbackStop):
                logger.info("Recording stopped")
        
        # Convert frames to single audio buffer
        if not frames:
            return np.array([])
        
        audio_data = np.concatenate(frames)
        return audio_data
    
    def record_audio(self, duration: Optional[float] = None, vad: bool = True) -> bytes:
        """
        Record audio for the specified duration or until silence is detected.
        
        Args:
            duration: Maximum recording duration in seconds (None for config default)
            vad: Whether to use voice activity detection
            
        Returns:
            Recorded audio data as bytes
        """
        # Record audio using the appropriate interface
        audio_data = self._audio_interface(duration, vad)
        
        # Convert to WAV format if needed
        if isinstance(audio_data, np.ndarray):
            with io.BytesIO() as wav_io:
                with wave.open(wav_io, 'wb') as wav_file:
                    wav_file.setnchannels(self.config.audio.channels)
                    wav_file.setsampwidth(2)  # 16-bit audio
                    wav_file.setframerate(self.config.audio.sample_rate)
                    wav_file.writeframes(audio_data.tobytes())
                audio_data = wav_io.getvalue()
        
        return audio_data
    
    def start_streaming(self, callback: Callable[[str, float], None]):
        """
        Start streaming speech recognition.
        
        Args:
            callback: Function to call with recognition results
        """
        if self._record_thread and self._record_thread.is_alive():
            logger.warning("Streaming already in progress")
            return
        
        self._recording = True
        self._record_thread = threading.Thread(
            target=self._streaming_worker,
            args=(callback,),
            daemon=True
        )
        self._record_thread.start()
    
    def stop_streaming(self):
        """Stop streaming speech recognition."""
        self._recording = False
        if self._record_thread:
            self._record_thread.join(timeout=2.0)
    
    def _streaming_worker(self, callback: Callable[[str, float], None]):
        """Worker thread for streaming speech recognition."""
        logger.info("Starting streaming speech recognition")
        
        while self._recording:
            try:
                # Record audio
                start_time = time.time()
                audio_data = self.record_audio(vad=True)
                
                # Skip if no audio recorded
                if not audio_data or len(audio_data) < 1000:
                    time.sleep(0.1)
                    continue
                
                # Transcribe
                transcript = self.transcribe_audio(audio_data)
                elapsed = time.time() - start_time
                
                # Call user callback with results
                if transcript:
                    callback(transcript, elapsed)
                
            except Exception as e:
                logger.error(f"Error in streaming worker: {str(e)}")
                time.sleep(0.5)
        
        logger.info("Streaming speech recognition stopped")
    
    def transcribe_audio(self, audio_data: Union[bytes, np.ndarray, str]) -> str:
        """
        Transcribe audio data.
        
        Args:
            audio_data: Audio data to transcribe (bytes, numpy array, or path to file)
            
        Returns:
            Transcribed text
        """
        if self.config.backend == SpeechBackend.WHISPER_LOCAL:
            return self._transcribe_whisper(audio_data)
        elif self.config.backend == SpeechBackend.OPENAI:
            return self._transcribe_openai(audio_data)
        else:
            raise ValueError(f"Unsupported backend: {self.config.backend}")
    
    def _transcribe_whisper(self, audio_data: Union[bytes, np.ndarray, str]) -> str:
        """Transcribe using local Whisper model."""
        # Check if model is loaded
        if self._model is None:
            self._init_whisper()
        
        # Convert audio to a temporary file if needed
        if isinstance(audio_data, (bytes, np.ndarray)):
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                if isinstance(audio_data, bytes):
                    temp_file.write(audio_data)
                else:
                    sf.write(temp_file.name, audio_data, self.config.audio.sample_rate)
                audio_path = temp_file.name
        else:
            audio_path = audio_data
        
        try:
            # Transcribe with Whisper
            logger.debug(f"Transcribing audio file: {audio_path}")
            
            # Set transcription options
            options = {
                "language": self.config.language,
                "task": "translate" if self.config.translate else "transcribe",
            }
            
            # Filter out None values
            options = {k: v for k, v in options.items() if v is not None}
            
            # Run transcription
            result = self._model.transcribe(audio_path, **options)
            
            # Get transcribed text
            return result["text"].strip()
        
        finally:
            # Remove temporary file if created
            if isinstance(audio_data, (bytes, np.ndarray)) and os.path.exists(audio_path):
                os.unlink(audio_path)
    
    def _transcribe_openai(self, audio_data: Union[bytes, np.ndarray, str]) -> str:
        """Transcribe using OpenAI's API."""
        # Check if client is initialized
        if self._openai_client is None:
            self._init_openai()
        
        # Convert audio to a temporary file if needed
        if isinstance(audio_data, np.ndarray):
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                sf.write(temp_file.name, audio_data, self.config.audio.sample_rate)
                audio_path = temp_file.name
        elif isinstance(audio_data, bytes):
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
                temp_file.write(audio_data)
                audio_path = temp_file.name
        else:
            audio_path = audio_data
        
        try:
            # Send to OpenAI API
            logger.debug(f"Sending audio to OpenAI: {audio_path}")
            with open(audio_path, "rb") as audio_file:
                # Choose appropriate API endpoint
                if self.config.model_name in ("whisper-1", "whisper-2"):
                    # Use whisper API
                    response = self._openai_client.audio.transcriptions.create(
                        model=self.config.model_name,
                        file=audio_file,
                        language=self.config.language
                    )
                    return response.text.strip()
                else:
                    # Use appropriate model based on config
                    model = self.config.model_name
                    if model not in ("whisper-1", "whisper-2"):
                        model = "whisper-1"  # Default to whisper-1 if invalid
                    
                    response = self._openai_client.audio.transcriptions.create(
                        model=model,
                        file=audio_file,
                        language=self.config.language
                    )
                    return response.text.strip()
                    
        finally:
            # Remove temporary file if created
            if isinstance(audio_data, (bytes, np.ndarray)) and os.path.exists(audio_path):
                os.unlink(audio_path)
    
    def list_audio_devices(self) -> List[Dict[str, Any]]:
        """
        List available audio input devices.
        
        Returns:
            List of audio device information
        """
        devices = []
        
        if HAS_PYAUDIO:
            pa = pyaudio.PyAudio()
            for i in range(pa.get_device_count()):
                device_info = pa.get_device_info_by_index(i)
                if device_info["maxInputChannels"] > 0:
                    devices.append({
                        "index": i,
                        "name": device_info["name"],
                        "channels": device_info["maxInputChannels"],
                        "sample_rate": device_info["defaultSampleRate"],
                        "interface": "pyaudio"
                    })
            pa.terminate()
            
        elif HAS_SOUNDDEVICE:
            for i, device in enumerate(sd.query_devices()):
                if device["max_input_channels"] > 0:
                    devices.append({
                        "index": i,
                        "name": device["name"],
                        "channels": device["max_input_channels"],
                        "sample_rate": device["default_samplerate"],
                        "interface": "sounddevice"
                    })
        
        return devices


# Simple command-line interface for testing
def main():
    """Command-line interface for testing speech recognition."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test speech recognition")
    parser.add_argument("--backend", choices=["whisper_local", "openai", "system"], 
                       default="whisper_local", help="Speech recognition backend")
    parser.add_argument("--model", default="base", help="Model name or size")
    parser.add_argument("--language", help="Language code")
    parser.add_argument("--translate", action="store_true", help="Translate to English")
    parser.add_argument("--list-devices", action="store_true", help="List audio devices")
    parser.add_argument("--device", type=int, help="Audio device index")
    parser.add_argument("--duration", type=float, default=None, 
                       help="Recording duration in seconds")
    parser.add_argument("--streaming", action="store_true", help="Enable streaming mode")
    
    args = parser.parse_args()
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    # Create speech recognizer
    config = SpeechConfig(
        backend=SpeechBackend(args.backend),
        model_name=args.model,
        language=args.language,
        translate=args.translate,
        audio=AudioConfig(device_index=args.device)
    )
    
    speech = SpeechRecognizer(config)
    
    # List devices if requested
    if args.list_devices:
        devices = speech.list_audio_devices()
        print("\nAvailable audio input devices:")
        for device in devices:
            print(f"  Index {device['index']}: {device['name']} "
                  f"({device['channels']} channels, {device['sample_rate']} Hz)")
        return
    
    # Streaming mode
    if args.streaming:
        print("\nStreaming mode. Speak to transcribe. Press Ctrl+C to exit.")
        
        def callback(text, elapsed):
            print(f"\nTranscription ({elapsed:.2f}s): {text}")
        
        try:
            speech.start_streaming(callback)
            while True:
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            print("\nStopping streaming...")
            speech.stop_streaming()
            
        return
    
    # Single recording mode
    print("\nRecording... (Speak now)")
    audio_data = speech.record_audio(duration=args.duration)
    
    print("Transcribing...")
    start_time = time.time()
    transcript = speech.transcribe_audio(audio_data)
    elapsed = time.time() - start_time
    
    print(f"\nTranscription ({elapsed:.2f}s):")
    print(transcript)


if __name__ == "__main__":
    main() 