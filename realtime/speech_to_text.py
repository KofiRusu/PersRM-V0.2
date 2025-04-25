"""
Speech-to-Text Module for PersLM

This module provides speech recognition capabilities for real-time interactions
using OpenAI's Whisper model or alternative engines.
"""

import os
import io
import time
import logging
import threading
import tempfile
import wave
from typing import Optional, Dict, Any, Callable, List, Union
from pathlib import Path
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

try:
    import numpy as np
    import torch
    from transformers import WhisperProcessor, WhisperForConditionalGeneration
    WHISPER_AVAILABLE = True
except ImportError:
    WHISPER_AVAILABLE = False
    logger.warning("Whisper dependencies not available. Install with: pip install transformers torch")

try:
    import pyaudio
    PYAUDIO_AVAILABLE = True
except ImportError:
    PYAUDIO_AVAILABLE = False
    logger.warning("PyAudio not available. Install with: pip install pyaudio")

try:
    import speech_recognition as sr
    SR_AVAILABLE = True
except ImportError:
    SR_AVAILABLE = False
    logger.warning("SpeechRecognition not available. Install with: pip install SpeechRecognition")


@dataclass
class AudioConfig:
    """Configuration for audio recording and processing."""
    sample_rate: int = 16000
    channels: int = 1
    format: int = pyaudio.paInt16 if PYAUDIO_AVAILABLE else 8  # 16-bit int if PyAudio available
    chunk_size: int = 1024
    silence_threshold: float = 0.03  # Energy level below which is considered silence
    silence_duration: float = 1.0  # Seconds of silence to end recording
    max_duration: float = 30.0  # Maximum recording duration in seconds
    device_index: Optional[int] = None  # Input device index, None for default


@dataclass
class TranscriptionResult:
    """Result of a speech transcription."""
    text: str = ""
    language: Optional[str] = None
    confidence: float = 0.0
    segments: List[Dict[str, Any]] = field(default_factory=list)
    duration: float = 0.0
    audio_path: Optional[str] = None
    error: Optional[str] = None


class WhisperTranscriber:
    """
    Speech-to-text using OpenAI's Whisper model through HuggingFace Transformers.
    """
    
    def __init__(
        self,
        model_size: str = "base",  # tiny, base, small, medium, large
        device: str = "auto",
        compute_type: str = "float16",
        language: Optional[str] = None,
        translate: bool = False,
        cache_dir: Optional[str] = None
    ):
        """
        Initialize Whisper transcriber.
        
        Args:
            model_size: Whisper model size
            device: Device to run on ('cpu', 'cuda', 'auto')
            compute_type: Compute type ('float32', 'float16', 'int8')
            language: Language code (e.g., 'en', 'fr'), None for auto-detection
            translate: Whether to translate non-English speech to English
            cache_dir: Directory to cache models
        """
        if not WHISPER_AVAILABLE:
            raise ImportError("Whisper dependencies not available. Install with: pip install transformers torch")
        
        self.model_size = model_size
        self.language = language
        self.translate = translate
        
        # Determine device
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
            
        # Determine compute type
        if compute_type == "float16" and self.device == "cuda":
            self.compute_dtype = torch.float16
        elif compute_type == "int8":
            self.compute_dtype = torch.int8
        else:
            self.compute_dtype = torch.float32
            
        # Load model
        model_id = f"openai/whisper-{model_size}"
        logger.info(f"Loading Whisper model: {model_id} on {self.device}")
        
        self.processor = WhisperProcessor.from_pretrained(model_id, cache_dir=cache_dir)
        self.model = WhisperForConditionalGeneration.from_pretrained(
            model_id,
            cache_dir=cache_dir,
            torch_dtype=self.compute_dtype,
            low_cpu_mem_usage=True
        )
        
        self.model.to(self.device)
        logger.info(f"Whisper model loaded successfully")
        
    def transcribe_file(self, audio_path: str) -> TranscriptionResult:
        """
        Transcribe audio from a file.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Transcription result
        """
        try:
            start_time = time.time()
            
            # Load audio file
            import librosa
            audio_array, _ = librosa.load(audio_path, sr=16000, mono=True)
            
            result = self._process_audio(audio_array)
            result.audio_path = audio_path
            result.duration = time.time() - start_time
            
            return result
        except Exception as e:
            logger.error(f"Error transcribing audio file: {e}")
            return TranscriptionResult(error=str(e))
            
    def transcribe_array(self, audio_array: np.ndarray) -> TranscriptionResult:
        """
        Transcribe audio from a numpy array.
        
        Args:
            audio_array: Audio data as numpy array
            
        Returns:
            Transcription result
        """
        try:
            start_time = time.time()
            result = self._process_audio(audio_array)
            result.duration = time.time() - start_time
            return result
        except Exception as e:
            logger.error(f"Error transcribing audio array: {e}")
            return TranscriptionResult(error=str(e))
            
    def _process_audio(self, audio_array: np.ndarray) -> TranscriptionResult:
        """Process audio data with Whisper model."""
        # Convert to float32 if needed
        if audio_array.dtype != np.float32:
            audio_array = audio_array.astype(np.float32)
        
        # Normalize audio (important for Whisper)
        if np.abs(audio_array).max() > 1.0:
            audio_array = audio_array / np.abs(audio_array).max()
        
        # Process with Whisper
        input_features = self.processor(
            audio_array, 
            sampling_rate=16000, 
            return_tensors="pt"
        ).input_features.to(self.device)
        
        # Generate transcription
        forced_decoder_ids = None
        if self.language:
            forced_decoder_ids = self.processor.get_decoder_prompt_ids(
                language=self.language, 
                task="translate" if self.translate else "transcribe"
            )
        
        with torch.no_grad():
            predicted_ids = self.model.generate(
                input_features,
                forced_decoder_ids=forced_decoder_ids
            )
        
        # Decode the predicted ids
        transcription = self.processor.batch_decode(
            predicted_ids, 
            skip_special_tokens=True
        )[0]
        
        result = TranscriptionResult(
            text=transcription,
            language=self.language,
            confidence=0.9,  # Placeholder, Whisper doesn't provide confidence scores directly
        )
        
        return result


class SpeechRecognitionTranscriber:
    """
    Speech-to-text using the SpeechRecognition library with various backends.
    """
    
    def __init__(
        self,
        backend: str = "google",  # google, sphinx, wit, azure, etc.
        language: str = "en-US",
        api_key: Optional[str] = None,
        **kwargs
    ):
        """
        Initialize SpeechRecognition transcriber.
        
        Args:
            backend: Recognition backend to use
            language: Language code
            api_key: API key for paid services
            **kwargs: Additional backend-specific parameters
        """
        if not SR_AVAILABLE:
            raise ImportError("SpeechRecognition not available. Install with: pip install SpeechRecognition")
            
        self.backend = backend
        self.language = language
        self.api_key = api_key
        self.kwargs = kwargs
        self.recognizer = sr.Recognizer()
        
        # Configure backend-specific settings
        if backend == "google":
            pass  # No additional setup needed
        elif backend == "sphinx":
            try:
                import pocketsphinx
            except ImportError:
                raise ImportError("PocketSphinx not available. Install with: pip install pocketsphinx")
        elif backend == "wit":
            if not api_key:
                raise ValueError("Wit.ai requires an API key")
        elif backend == "azure":
            if not api_key:
                raise ValueError("Azure Speech requires an API key")
        elif backend == "houndify":
            if not api_key:
                raise ValueError("Houndify requires client_id and client_key")
        
        logger.info(f"SpeechRecognition initialized with {backend} backend")
    
    def transcribe_file(self, audio_path: str) -> TranscriptionResult:
        """
        Transcribe audio from a file.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Transcription result
        """
        try:
            start_time = time.time()
            
            with sr.AudioFile(audio_path) as source:
                audio_data = self.recognizer.record(source)
                
            result = self._process_audio(audio_data)
            result.audio_path = audio_path
            result.duration = time.time() - start_time
            
            return result
        except Exception as e:
            logger.error(f"Error transcribing audio file: {e}")
            return TranscriptionResult(error=str(e))
            
    def _process_audio(self, audio_data: sr.AudioData) -> TranscriptionResult:
        """Process audio data with selected backend."""
        try:
            if self.backend == "google":
                text = self.recognizer.recognize_google(
                    audio_data, 
                    language=self.language
                )
            elif self.backend == "sphinx":
                text = self.recognizer.recognize_sphinx(
                    audio_data, 
                    language=self.language
                )
            elif self.backend == "wit":
                text = self.recognizer.recognize_wit(
                    audio_data, 
                    key=self.api_key
                )
            elif self.backend == "azure":
                text = self.recognizer.recognize_azure(
                    audio_data,
                    key=self.api_key,
                    language=self.language,
                    **self.kwargs
                )
            elif self.backend == "houndify":
                text = self.recognizer.recognize_houndify(
                    audio_data,
                    client_id=self.kwargs.get("client_id"),
                    client_key=self.kwargs.get("client_key")
                )
            else:
                raise ValueError(f"Unsupported backend: {self.backend}")
                
            return TranscriptionResult(
                text=text,
                language=self.language,
                confidence=0.8,  # Placeholder
            )
        except sr.UnknownValueError:
            return TranscriptionResult(error="Could not understand audio")
        except sr.RequestError as e:
            return TranscriptionResult(error=f"Recognition request error: {e}")
        except Exception as e:
            return TranscriptionResult(error=f"Recognition error: {e}")


class AudioRecorder:
    """Records audio from microphone in real-time."""
    
    def __init__(self, config: Optional[AudioConfig] = None):
        """
        Initialize audio recorder.
        
        Args:
            config: Audio configuration
        """
        if not PYAUDIO_AVAILABLE:
            raise ImportError("PyAudio not available. Install with: pip install pyaudio")
            
        self.config = config or AudioConfig()
        self.pyaudio = pyaudio.PyAudio()
        self.stream = None
        self.frames = []
        self.is_recording = False
        self.stop_event = threading.Event()
        
    def start_recording(self) -> None:
        """Start recording audio from microphone."""
        if self.is_recording:
            return
            
        self.frames = []
        self.stop_event.clear()
        self.is_recording = True
        
        self.stream = self.pyaudio.open(
            format=self.config.format,
            channels=self.config.channels,
            rate=self.config.sample_rate,
            input=True,
            input_device_index=self.config.device_index,
            frames_per_buffer=self.config.chunk_size
        )
        
        # Start recording thread
        self.recording_thread = threading.Thread(target=self._record_audio)
        self.recording_thread.daemon = True
        self.recording_thread.start()
        
        logger.info("Started audio recording")
        
    def _record_audio(self) -> None:
        """Record audio in a background thread with automatic silence detection."""
        silence_counter = 0
        start_time = time.time()
        has_speech = False
        
        try:
            while not self.stop_event.is_set():
                # Check if max duration reached
                if time.time() - start_time > self.config.max_duration:
                    logger.info("Max recording duration reached")
                    break
                
                # Read audio chunk
                data = self.stream.read(self.config.chunk_size, exception_on_overflow=False)
                self.frames.append(data)
                
                # Convert to numpy array for energy calculation
                frame_data = np.frombuffer(data, dtype=np.int16)
                energy = np.abs(frame_data).mean() / 32768.0  # Normalize
                
                # Detect speech/silence
                if energy > self.config.silence_threshold:
                    silence_counter = 0
                    has_speech = True
                elif has_speech:
                    silence_counter += self.config.chunk_size / self.config.sample_rate
                    
                    # Stop if silence duration threshold reached
                    if silence_counter > self.config.silence_duration:
                        logger.info("Silence detected, stopping recording")
                        break
        except Exception as e:
            logger.error(f"Error during recording: {e}")
        finally:
            self.is_recording = False
            
    def stop_recording(self) -> Optional[str]:
        """
        Stop recording and save audio to file.
        
        Returns:
            Path to saved audio file or None if no data recorded
        """
        if not self.is_recording and not self.frames:
            return None
            
        # Signal recording thread to stop
        self.stop_event.set()
        
        # Close stream if open
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            self.stream = None
            
        self.is_recording = False
        
        # Wait for recording thread to finish
        if hasattr(self, 'recording_thread') and self.recording_thread.is_alive():
            self.recording_thread.join(timeout=1.0)
            
        # Save recorded audio to file
        if not self.frames:
            return None
            
        temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        
        with wave.open(temp_file.name, 'wb') as wf:
            wf.setnchannels(self.config.channels)
            wf.setsampwidth(self.pyaudio.get_sample_size(self.config.format))
            wf.setframerate(self.config.sample_rate)
            wf.writeframes(b''.join(self.frames))
            
        logger.info(f"Saved recording to {temp_file.name}")
        return temp_file.name
        
    def get_audio_data(self) -> Optional[bytes]:
        """Get raw audio data from recording."""
        if not self.frames:
            return None
        return b''.join(self.frames)
        
    def get_available_devices(self) -> List[Dict[str, Any]]:
        """Get list of available input devices."""
        devices = []
        
        for i in range(self.pyaudio.get_device_count()):
            device_info = self.pyaudio.get_device_info_by_index(i)
            if device_info['maxInputChannels'] > 0:  # Input device
                devices.append({
                    'index': i,
                    'name': device_info['name'],
                    'channels': device_info['maxInputChannels'],
                    'sample_rate': int(device_info['defaultSampleRate'])
                })
                
        return devices
        
    def __del__(self):
        """Clean up resources."""
        if self.stream:
            self.stream.close()
            
        if hasattr(self, 'pyaudio'):
            self.pyaudio.terminate()


class SpeechToText:
    """
    Main speech-to-text interface that orchestrates audio recording and transcription.
    """
    
    def __init__(
        self,
        engine: str = "whisper",  # whisper, speechrecognition
        engine_config: Optional[Dict[str, Any]] = None,
        audio_config: Optional[AudioConfig] = None,
        save_recordings: bool = False,
        recordings_dir: Optional[str] = None
    ):
        """
        Initialize speech-to-text system.
        
        Args:
            engine: Speech recognition engine to use
            engine_config: Engine-specific configuration
            audio_config: Audio recording configuration
            save_recordings: Whether to save recordings permanently
            recordings_dir: Directory to save recordings
        """
        self.engine = engine
        self.engine_config = engine_config or {}
        self.audio_config = audio_config or AudioConfig()
        self.save_recordings = save_recordings
        
        if save_recordings:
            self.recordings_dir = recordings_dir or "recordings"
            os.makedirs(self.recordings_dir, exist_ok=True)
        else:
            self.recordings_dir = None
            
        # Initialize audio recorder
        try:
            self.recorder = AudioRecorder(config=self.audio_config)
        except ImportError:
            self.recorder = None
            logger.warning("Audio recording not available. Voice input will not work.")
            
        # Initialize transcription engine
        self._init_transcription_engine()
        
    def _init_transcription_engine(self) -> None:
        """Initialize the selected transcription engine."""
        try:
            if self.engine == "whisper":
                self.transcriber = WhisperTranscriber(**self.engine_config)
            elif self.engine == "speechrecognition":
                self.transcriber = SpeechRecognitionTranscriber(**self.engine_config)
            else:
                raise ValueError(f"Unsupported engine: {self.engine}")
        except ImportError as e:
            logger.error(f"Failed to initialize transcription engine: {e}")
            self.transcriber = None
            
    def listen(self) -> TranscriptionResult:
        """
        Listen for speech and transcribe.
        
        Returns:
            Transcription result
        """
        if not self.recorder:
            return TranscriptionResult(error="Audio recording not available")
            
        if not self.transcriber:
            return TranscriptionResult(error="Transcription engine not available")
            
        logger.info("Listening for speech...")
        
        # Start recording
        self.recorder.start_recording()
        
        try:
            # Wait for recording to complete (automatic silence detection)
            while self.recorder.is_recording:
                time.sleep(0.1)
                
            # Get audio file path
            audio_path = self.recorder.stop_recording()
            
            if not audio_path:
                return TranscriptionResult(error="No speech detected")
                
            # Transcribe audio
            logger.info("Transcribing speech...")
            result = self.transcriber.transcribe_file(audio_path)
            
            # Save or delete recording
            if self.save_recordings and self.recordings_dir:
                timestamp = time.strftime("%Y%m%d-%H%M%S")
                saved_path = os.path.join(self.recordings_dir, f"recording_{timestamp}.wav")
                shutil.copy(audio_path, saved_path)
                result.audio_path = saved_path
                
            # Clean up temp file
            if not self.save_recordings and audio_path:
                try:
                    os.unlink(audio_path)
                except:
                    pass
                    
            return result
            
        except Exception as e:
            logger.error(f"Error during speech recognition: {e}")
            return TranscriptionResult(error=str(e))
            
    def transcribe_file(self, audio_path: str) -> TranscriptionResult:
        """
        Transcribe audio from a file.
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Transcription result
        """
        if not self.transcriber:
            return TranscriptionResult(error="Transcription engine not available")
            
        return self.transcriber.transcribe_file(audio_path)
        
    def get_available_devices(self) -> List[Dict[str, Any]]:
        """Get list of available audio input devices."""
        if not self.recorder:
            return []
        return self.recorder.get_available_devices()


# CLI interface
def main():
    """Command-line interface for speech recognition."""
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description="PersLM Speech-to-Text Module")
    parser.add_argument("--mode", choices=["listen", "file", "server", "devices"], 
                      default="listen", help="Operation mode")
    parser.add_argument("--engine", choices=["whisper", "speechrecognition"],
                      default="whisper", help="Speech recognition engine")
    parser.add_argument("--model-size", default="base", 
                      help="Whisper model size (tiny, base, small, medium, large)")
    parser.add_argument("--file", help="Audio file to transcribe (for file mode)")
    parser.add_argument("--language", default=None, 
                      help="Language code (e.g., 'en', 'fr'), None for auto-detection")
    parser.add_argument("--device", default="auto", 
                      help="Device to use (cpu, cuda, auto)")
    parser.add_argument("--api-key", help="API key for paid services")
    parser.add_argument("--backend", default="google", 
                      help="Backend for SpeechRecognition (google, sphinx, wit, azure, etc.)")
    parser.add_argument("--save-recordings", action="store_true", 
                      help="Save recordings permanently")
    parser.add_argument("--recordings-dir", default="recordings", 
                      help="Directory to save recordings")
    parser.add_argument("--port", type=int, default=5002, 
                      help="Port for server mode")
    parser.add_argument("--host", default="0.0.0.0", 
                      help="Host for server mode")
    parser.add_argument("--debug", action="store_true", 
                      help="Enable debug logging")
    parser.add_argument("--output-json", action="store_true", 
                      help="Output result as JSON")
    
    args = parser.parse_args()
    
    # Configure logging
    logging_level = logging.DEBUG if args.debug else logging.INFO
    logging.basicConfig(level=logging_level, 
                     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    if args.mode == "devices":
        # List available devices
        try:
            recorder = AudioRecorder()
            devices = recorder.get_available_devices()
            print("Available audio input devices:")
            for i, device in enumerate(devices):
                print(f"{i}: {device['name']} ({device['channels']} channels, {device['sample_rate']} Hz)")
            return
        except Exception as e:
            print(f"Error listing devices: {e}")
            return
    
    # Build engine config
    if args.engine == "whisper":
        engine_config = {
            "model_size": args.model_size,
            "device": args.device,
            "language": args.language
        }
    else:  # speechrecognition
        engine_config = {
            "backend": args.backend,
            "language": args.language or "en-US",
            "api_key": args.api_key
        }
    
    if args.mode == "server":
        # Run as HTTP server
        try:
            from flask import Flask, request, jsonify
            
            app = Flask("PersLM Speech-to-Text")
            stt = SpeechToText(
                engine=args.engine,
                engine_config=engine_config,
                save_recordings=args.save_recordings,
                recordings_dir=args.recordings_dir
            )
            
            @app.route("/transcribe", methods=["POST"])
            def transcribe_endpoint():
                if "file" not in request.files:
                    return jsonify({"error": "No file provided"}), 400
                    
                file = request.files["file"]
                temp_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
                file.save(temp_file.name)
                
                result = stt.transcribe_file(temp_file.name)
                
                # Clean up
                try:
                    os.unlink(temp_file.name)
                except:
                    pass
                    
                return jsonify(result.__dict__)
                
            @app.route("/listen", methods=["POST"])
            def listen_endpoint():
                result = stt.listen()
                return jsonify(result.__dict__)
                
            @app.route("/devices", methods=["GET"])
            def devices_endpoint():
                devices = stt.get_available_devices()
                return jsonify(devices)
                
            print(f"Starting speech-to-text server on {args.host}:{args.port}")
            app.run(host=args.host, port=args.port, debug=args.debug)
            
        except ImportError:
            print("Flask is required for server mode. Install with: pip install flask")
            return
        except Exception as e:
            print(f"Error running server: {e}")
            return
    
    elif args.mode == "listen":
        # Interactive listening mode
        stt = SpeechToText(
            engine=args.engine,
            engine_config=engine_config,
            save_recordings=args.save_recordings,
            recordings_dir=args.recordings_dir
        )
        
        print("Listening for speech... (press Ctrl+C to exit)")
        try:
            while True:
                result = stt.listen()
                
                if args.output_json:
                    print(json.dumps(result.__dict__, indent=2))
                else:
                    if result.error:
                        print(f"Error: {result.error}")
                    else:
                        print(f"Transcription: {result.text}")
                        print(f"Language: {result.language}, Confidence: {result.confidence:.2f}")
                        print(f"Duration: {result.duration:.2f}s")
                
                choice = input("Listen again? (y/n): ")
                if choice.lower() != 'y':
                    break
                    
        except KeyboardInterrupt:
            print("\nExiting...")
            
    elif args.mode == "file":
        # Transcribe from file
        if not args.file:
            print("Error: --file argument is required for file mode")
            return
            
        if not os.path.exists(args.file):
            print(f"Error: File not found: {args.file}")
            return
            
        stt = SpeechToText(
            engine=args.engine,
            engine_config=engine_config
        )
        
        result = stt.transcribe_file(args.file)
        
        if args.output_json:
            print(json.dumps(result.__dict__, indent=2))
        else:
            if result.error:
                print(f"Error: {result.error}")
            else:
                print(f"Transcription: {result.text}")
                print(f"Language: {result.language}, Confidence: {result.confidence:.2f}")
                print(f"Duration: {result.duration:.2f}s")


if __name__ == "__main__":
    main() 