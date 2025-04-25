"""
Real-time Interaction Loop for PersLM

This module provides a seamless voice interface for PersLM, orchestrating:
1. Speech-to-text conversion
2. Model inference
3. Text-to-speech output

Creates a natural conversation loop with the PersLM model.
"""

import os
import sys
import time
import json
import logging
import threading
import signal
import queue
from typing import Optional, Dict, Any, List, Callable, Union, Tuple
from pathlib import Path

# Add parent directory to path for imports
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Import PersLM modules
from realtime.speech_to_text import SpeechToText, AudioConfig, TranscriptionResult
from realtime.text_to_speech import TextToSpeech, TTSEngine, VoiceConfig
from src.personalization import PersonalizationManager
from src.memory import Memory

logger = logging.getLogger(__name__)

# Try to import optional colorama for nice terminal output
try:
    from colorama import init, Fore, Style
    init()
    COLOR_AVAILABLE = True
except ImportError:
    COLOR_AVAILABLE = False
    logger.warning("Colorama not available. Install with: pip install colorama for colored output")


class InteractionState:
    """Tracks the state of a conversation session."""
    
    IDLE = "idle"
    LISTENING = "listening"
    PROCESSING = "processing"
    SPEAKING = "speaking"
    
    def __init__(self):
        """Initialize interaction state."""
        self.current = self.IDLE
        self.prev = self.IDLE
        self.user_speaking = False
        self.assistant_speaking = False
        self.last_transition = time.time()
        self.last_user_input = ""
        self.last_assistant_response = ""
        self.turn_count = 0
        self.session_start_time = time.time()
        self.interrupt_requested = False
        self.user_id = "default_user"
        
    def transition(self, new_state: str) -> None:
        """
        Transition to a new state.
        
        Args:
            new_state: New state
        """
        self.prev = self.current
        self.current = new_state
        self.last_transition = time.time()
        
        if new_state == self.LISTENING:
            self.user_speaking = True
            self.assistant_speaking = False
        elif new_state == self.SPEAKING:
            self.user_speaking = False
            self.assistant_speaking = True
        else:
            self.user_speaking = False
            self.assistant_speaking = False
            
        logger.debug(f"State transition: {self.prev} -> {self.current}")
        
    def request_interrupt(self) -> None:
        """Request interruption of the current state."""
        self.interrupt_requested = True
        logger.info("Interrupt requested")
        
    def clear_interrupt(self) -> None:
        """Clear interrupt request."""
        self.interrupt_requested = False
        
    def start_new_turn(self) -> None:
        """Start a new conversation turn."""
        self.turn_count += 1
        self.clear_interrupt()
        
    def get_session_duration(self) -> float:
        """Get session duration in seconds."""
        return time.time() - self.session_start_time
        
    def get_current_state_duration(self) -> float:
        """Get duration of current state in seconds."""
        return time.time() - self.last_transition


class RealTimeLoop:
    """
    Real-time voice interaction loop for PersLM.
    
    Orchestrates speech recognition, model inference, and speech synthesis
    to create a seamless conversation experience.
    """
    
    def __init__(
        self,
        model_path: Optional[str] = None,
        model_api_url: Optional[str] = None,
        user_id: str = "default_user",
        stt_config: Optional[Dict[str, Any]] = None,
        tts_config: Optional[Dict[str, Any]] = None,
        interrupt_mode: str = "auto",  # auto, manual, none
        output_dir: Optional[str] = None,
        save_transcripts: bool = True,
        save_recordings: bool = False,
        memory: Optional[Memory] = None,
        personalization_manager: Optional[PersonalizationManager] = None
    ):
        """
        Initialize real-time loop.
        
        Args:
            model_path: Path to model or model ID
            model_api_url: URL to model API (alternative to model_path)
            user_id: User ID for personalization
            stt_config: Speech-to-text configuration
            tts_config: Text-to-speech configuration
            interrupt_mode: How to handle interruptions
            output_dir: Directory to save outputs
            save_transcripts: Whether to save conversation transcripts
            save_recordings: Whether to save audio recordings
            memory: Memory instance to use
            personalization_manager: Personalization manager to use
        """
        self.model_path = model_path
        self.model_api_url = model_api_url
        self.interrupt_mode = interrupt_mode
        self.save_transcripts = save_transcripts
        self.save_recordings = save_recordings
        
        # Set up directory structure
        if output_dir:
            self.output_dir = Path(output_dir)
        else:
            self.output_dir = Path("output")
            
        self.transcripts_dir = self.output_dir / "transcripts"
        self.recordings_dir = self.output_dir / "recordings"
        
        if save_transcripts:
            os.makedirs(self.transcripts_dir, exist_ok=True)
        if save_recordings:
            os.makedirs(self.recordings_dir, exist_ok=True)
            
        # Initialize state
        self.state = InteractionState()
        self.state.user_id = user_id
        
        # Initialize components
        self._init_speech_to_text(stt_config)
        self._init_text_to_speech(tts_config)
        self._init_model(memory, personalization_manager)
        
        # Streams for concurrent processing
        self.input_queue = queue.Queue()
        self.output_queue = queue.Queue()
        
        # Control flags
        self.running = False
        self.stop_event = threading.Event()
        
    def _init_speech_to_text(self, config: Optional[Dict[str, Any]] = None) -> None:
        """Initialize speech-to-text component."""
        if config is None:
            config = {}
            
        # Default to Whisper for better quality
        engine = config.get("engine", "whisper")
        
        # Engine-specific options
        engine_config = config.get("engine_config", {})
        if engine == "whisper" and "model_size" not in engine_config:
            engine_config["model_size"] = "base"
            
        # Audio recording config
        audio_config_dict = config.get("audio_config", {})
        audio_config = AudioConfig(
            sample_rate=audio_config_dict.get("sample_rate", 16000),
            channels=audio_config_dict.get("channels", 1),
            silence_threshold=audio_config_dict.get("silence_threshold", 0.03),
            silence_duration=audio_config_dict.get("silence_duration", 1.0),
            max_duration=audio_config_dict.get("max_duration", 30.0),
            device_index=audio_config_dict.get("device_index")
        )
        
        # Initialize STT
        try:
            self.stt = SpeechToText(
                engine=engine,
                engine_config=engine_config,
                audio_config=audio_config,
                save_recordings=self.save_recordings,
                recordings_dir=str(self.recordings_dir) if self.save_recordings else None
            )
            logger.info(f"Speech-to-text initialized with {engine} engine")
        except ImportError as e:
            logger.error(f"Failed to initialize speech-to-text: {e}")
            self.stt = None
            
    def _init_text_to_speech(self, config: Optional[Dict[str, Any]] = None) -> None:
        """Initialize text-to-speech component."""
        if config is None:
            config = {}
            
        # Default to pyttsx3 for reliability
        engine = config.get("engine", "pyttsx3")
        
        # Engine-specific options
        engine_options = config.get("engine_options", {})
        
        # Voice configuration
        voice_config_dict = config.get("voice_config", {})
        voice_config = VoiceConfig(
            voice_id=voice_config_dict.get("voice_id", ""),
            name=voice_config_dict.get("name", "default"),
            language=voice_config_dict.get("language", "en"),
            gender=voice_config_dict.get("gender", "neutral"),
            rate=voice_config_dict.get("rate", 1.0),
            pitch=voice_config_dict.get("pitch", 1.0),
            volume=voice_config_dict.get("volume", 1.0)
        )
        
        # Initialize TTS
        try:
            self.tts = TextToSpeech(
                engine=engine,
                voice_config=voice_config,
                engine_options=engine_options
            )
            logger.info(f"Text-to-speech initialized with {engine} engine")
            
            # Try to select preferred voice if specified
            preferred_voice = config.get("preferred_voice")
            if preferred_voice:
                self.tts.set_voice(preferred_voice)
                
        except ImportError as e:
            logger.error(f"Failed to initialize text-to-speech: {e}")
            self.tts = None
            
    def _init_model(
        self, 
        memory: Optional[Memory] = None,
        personalization_manager: Optional[PersonalizationManager] = None
    ) -> None:
        """Initialize PersLM model."""
        # Initialize or use provided memory
        self.memory = memory or Memory()
        
        # Initialize or use provided personalization manager
        if personalization_manager:
            self.personalization = personalization_manager
        else:
            try:
                from src.personalization import PersonalizationManager
                self.personalization = PersonalizationManager(memory=self.memory)
                logger.info("Personalization manager initialized")
            except ImportError:
                logger.warning("PersonalizationManager not available. Running without personalization.")
                self.personalization = None
                
        # Initialize model interface
        self.model = None
        if self.model_path:
            try:
                from src.serve.api import ModelAPI
                self.model = ModelAPI(model_path=self.model_path)
                logger.info(f"Loaded model from {self.model_path}")
            except ImportError:
                logger.warning("ModelAPI not available. Using fallback inference.")
                self._setup_fallback_model()
        elif self.model_api_url:
            try:
                import requests
                # Just test if the API is available
                response = requests.get(f"{self.model_api_url}/health")
                if response.status_code == 200:
                    logger.info(f"Using model API at {self.model_api_url}")
                    self.model_api_url = self.model_api_url.rstrip("/")
                else:
                    logger.warning(f"Model API returned status {response.status_code}")
                    self._setup_fallback_model()
            except Exception as e:
                logger.warning(f"Error connecting to model API: {e}")
                self._setup_fallback_model()
        else:
            self._setup_fallback_model()
            
    def _setup_fallback_model(self) -> None:
        """Set up fallback model (simulated or minimal)."""
        try:
            # Try to import transformers for a minimal model
            from transformers import pipeline
            
            # Use smallest available model
            self.model = pipeline("text-generation", model="distilgpt2")
            logger.info("Using distilgpt2 as fallback model")
        except ImportError:
            # Create a simulated model that just echoes back
            logger.warning("No model available. Using echo simulation.")
            self.model = lambda x: {"text": f"Echo: {x}"}
            
    def _generate_response(self, text: str) -> str:
        """
        Generate a response from the model.
        
        Args:
            text: Input text
            
        Returns:
            Model response
        """
        try:
            # Mark state as processing
            self.state.transition(InteractionState.PROCESSING)
            
            if hasattr(self.model, "generate"):
                # Local model
                response = self.model.generate(text, max_new_tokens=100)
                if isinstance(response, dict):
                    response_text = response.get("text", "")
                else:
                    response_text = response[0]["generated_text"]
            elif self.model_api_url:
                # Remote API
                import requests
                response = requests.post(
                    f"{self.model_api_url}/generate",
                    json={"prompt": text, "max_tokens": 100}
                )
                if response.status_code == 200:
                    response_text = response.json().get("text", "")
                else:
                    response_text = f"Error: API returned status {response.status_code}"
            else:
                # Fallback/simulated model
                response_text = self.model(text)
                
            # Apply personalization if available
            if self.personalization:
                response_text = self.personalization.personalize_response(
                    self.state.user_id,
                    response_text,
                    text
                )
                
            return response_text
            
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return "I apologize, but I'm having trouble generating a response right now."
            
    def _log_interaction(self, user_input: str, assistant_response: str) -> None:
        """
        Log interaction to transcript and memory.
        
        Args:
            user_input: User input text
            assistant_response: Assistant response text
        """
        # Update state
        self.state.last_user_input = user_input
        self.state.last_assistant_response = assistant_response
        
        # Log to memory
        if self.memory:
            self.memory.add_interaction(
                self.state.user_id,
                "user",
                user_input,
                metadata={"turn": self.state.turn_count}
            )
            self.memory.add_interaction(
                self.state.user_id,
                "assistant",
                assistant_response,
                metadata={"turn": self.state.turn_count}
            )
            
        # Save to transcript file
        if self.save_transcripts:
            timestamp = time.strftime("%Y%m%d-%H%M%S")
            transcript_file = self.transcripts_dir / f"transcript_{timestamp}.json"
            
            # Check if file exists and append, or create new
            if transcript_file.exists():
                try:
                    with open(transcript_file, 'r') as f:
                        transcript = json.load(f)
                except Exception:
                    transcript = {"interactions": []}
            else:
                transcript = {"interactions": []}
                
            # Add interaction
            transcript["interactions"].append({
                "user": user_input,
                "assistant": assistant_response,
                "timestamp": time.time(),
                "turn": self.state.turn_count
            })
            
            # Save updated transcript
            with open(transcript_file, 'w') as f:
                json.dump(transcript, f, indent=2)
                
    def _print_colored(self, role: str, text: str) -> None:
        """
        Print colored text in the console.
        
        Args:
            role: 'user' or 'assistant'
            text: Text to print
        """
        if not COLOR_AVAILABLE:
            if role == "user":
                print(f"User: {text}")
            else:
                print(f"Assistant: {text}")
            return
            
        if role == "user":
            print(f"{Fore.GREEN}User:{Style.RESET_ALL} {text}")
        else:
            print(f"{Fore.BLUE}Assistant:{Style.RESET_ALL} {text}")
            
    def _listen_worker(self) -> None:
        """Background worker for listening to speech."""
        while not self.stop_event.is_set():
            # Only listen when in listening state
            if self.state.current != InteractionState.LISTENING:
                time.sleep(0.1)
                continue
                
            logger.debug("Listening for speech...")
            
            if not self.stt:
                # No STT available, simulate with text input
                try:
                    text = input("You: ")
                    result = TranscriptionResult(text=text)
                    self.input_queue.put(result)
                except EOFError:
                    self.stop_event.set()
                    break
            else:
                # Use speech recognition
                result = self.stt.listen()
                if not result.error and result.text.strip():
                    self.input_queue.put(result)
                elif result.error:
                    logger.error(f"Error during speech recognition: {result.error}")
                    # Stay in listening state but pause briefly
                    time.sleep(1)
                else:
                    # No speech detected, continue listening
                    continue
                    
    def _process_worker(self) -> None:
        """Background worker for processing inputs and generating responses."""
        while not self.stop_event.is_set():
            try:
                # Get input from queue (with timeout)
                result = self.input_queue.get(timeout=0.5)
                
                # Print user input
                self._print_colored("user", result.text)
                
                # Generate response
                response = self._generate_response(result.text)
                
                # Add response to output queue
                self.output_queue.put(response)
                
                # Log interaction
                self._log_interaction(result.text, response)
                
                # Mark item as processed
                self.input_queue.task_done()
                
            except queue.Empty:
                # No input available, continue
                continue
            except Exception as e:
                logger.error(f"Error in process worker: {e}")
                time.sleep(0.5)
                
    def _output_worker(self) -> None:
        """Background worker for outputting responses as speech."""
        while not self.stop_event.is_set():
            try:
                # Get response from queue (with timeout)
                response = self.output_queue.get(timeout=0.5)
                
                # Transition to speaking state
                self.state.transition(InteractionState.SPEAKING)
                
                # Print response
                self._print_colored("assistant", response)
                
                # Speak response if TTS available
                if self.tts:
                    self.tts.speak(response, blocking=True)
                    
                # Mark as completed and transition to idle
                self.output_queue.task_done()
                self.state.transition(InteractionState.IDLE)
                
                # Start new turn
                self.state.start_new_turn()
                
            except queue.Empty:
                # No output available, continue
                continue
            except Exception as e:
                logger.error(f"Error in output worker: {e}")
                self.state.transition(InteractionState.IDLE)
                time.sleep(0.5)
    
    def _handle_interruption(self) -> None:
        """Handle user interruption."""
        if self.interrupt_mode == "none":
            # Interruption disabled
            return
            
        if self.state.interrupt_requested:
            logger.info("Processing interruption")
            
            if self.state.current == InteractionState.SPEAKING:
                # Stop speaking
                self.output_queue = queue.Queue()  # Clear output queue
                if self.tts and hasattr(self.tts.provider, "stop"):
                    self.tts.provider.stop()
                    
                # Transition to listening
                self.state.transition(InteractionState.LISTENING)
                self.state.clear_interrupt()
                
    def _control_worker(self) -> None:
        """Background worker for controlling the conversation flow."""
        while not self.stop_event.is_set():
            # Handle state transitions
            if self.state.current == InteractionState.IDLE:
                # Transition to listening when idle
                self.state.transition(InteractionState.LISTENING)
                
            # Handle interruptions
            self._handle_interruption()
            
            # Sleep briefly
            time.sleep(0.1)
            
    def start(self) -> None:
        """Start the real-time interaction loop."""
        if self.running:
            logger.warning("Interaction loop already running")
            return
            
        logger.info("Starting real-time interaction loop")
        self.running = True
        self.stop_event.clear()
        
        # Start worker threads
        self.listen_thread = threading.Thread(target=self._listen_worker)
        self.process_thread = threading.Thread(target=self._process_worker)
        self.output_thread = threading.Thread(target=self._output_worker)
        self.control_thread = threading.Thread(target=self._control_worker)
        
        self.listen_thread.daemon = True
        self.process_thread.daemon = True
        self.output_thread.daemon = True
        self.control_thread.daemon = True
        
        self.listen_thread.start()
        self.process_thread.start()
        self.output_thread.start()
        self.control_thread.start()
        
        # Set up interrupt handler
        if self.interrupt_mode == "manual":
            # Set up SIGINT handler for manual interruption
            def interrupt_handler(signum, frame):
                if not self.state.interrupt_requested:
                    self.state.request_interrupt()
                else:
                    # Second interrupt = exit
                    self.stop()
                    
            signal.signal(signal.SIGINT, interrupt_handler)
            
        # Print welcome message
        if self.tts:
            welcome = "I'm ready. You can start speaking now."
            print(f"\n{Fore.BLUE if COLOR_AVAILABLE else ''}Assistant:{Style.RESET_ALL if COLOR_AVAILABLE else ''} {welcome}")
            self.tts.speak(welcome)
            
        else:
            print("\nReady for text interaction. Type your messages.")
            
    def stop(self) -> None:
        """Stop the real-time interaction loop."""
        if not self.running:
            return
            
        logger.info("Stopping real-time interaction loop")
        self.stop_event.set()
        self.running = False
        
        # Wait for threads to finish
        if hasattr(self, 'listen_thread'):
            self.listen_thread.join(timeout=2.0)
        if hasattr(self, 'process_thread'):
            self.process_thread.join(timeout=2.0)
        if hasattr(self, 'output_thread'):
            self.output_thread.join(timeout=2.0)
        if hasattr(self, 'control_thread'):
            self.control_thread.join(timeout=2.0)
            
        # Print goodbye message
        print("\nThank you for the conversation. Goodbye!")
        
    def run(self) -> None:
        """Run the interaction loop and wait for completion."""
        try:
            self.start()
            
            # Keep main thread alive until stop requested
            while self.running and not self.stop_event.is_set():
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            pass
        finally:
            self.stop()


# CLI interface
def main():
    """Command-line interface for real-time conversation."""
    import argparse
    import yaml
    
    parser = argparse.ArgumentParser(description="PersLM Real-time Conversation")
    parser.add_argument("--config", help="Configuration file path")
    parser.add_argument("--model", help="Path to model or model ID")
    parser.add_argument("--api-url", help="Model API URL")
    parser.add_argument("--user-id", default="default_user", help="User ID for personalization")
    parser.add_argument("--stt-engine", choices=["whisper", "speechrecognition"], 
                      help="Speech-to-text engine")
    parser.add_argument("--tts-engine", choices=["pyttsx3", "elevenlabs", "gtts", "macos"], 
                      help="Text-to-speech engine")
    parser.add_argument("--voice", help="Voice ID or name")
    parser.add_argument("--interrupt-mode", choices=["auto", "manual", "none"],
                      default="auto", help="How to handle interruptions")
    parser.add_argument("--output-dir", help="Directory to save outputs")
    parser.add_argument("--save-transcripts", action="store_true", help="Save conversation transcripts")
    parser.add_argument("--save-recordings", action="store_true", help="Save audio recordings")
    parser.add_argument("--debug", action="store_true", help="Enable debug logging")
    
    args = parser.parse_args()
    
    # Configure logging
    logging_level = logging.DEBUG if args.debug else logging.INFO
    logging.basicConfig(level=logging_level,
                     format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    
    # Load configuration
    config = {}
    if args.config:
        try:
            with open(args.config, 'r') as f:
                config = yaml.safe_load(f)
        except Exception as e:
            print(f"Error loading config file: {e}")
            config = {}
    
    # Override config with command line arguments
    stt_config = config.get("speech_to_text", {})
    if args.stt_engine:
        stt_config["engine"] = args.stt_engine
        
    tts_config = config.get("text_to_speech", {})
    if args.tts_engine:
        tts_config["engine"] = args.tts_engine
    if args.voice:
        voice_config = tts_config.get("voice_config", {})
        voice_config["voice_id"] = args.voice
        voice_config["name"] = args.voice
        tts_config["voice_config"] = voice_config
        
    # Create real-time loop
    loop = RealTimeLoop(
        model_path=args.model or config.get("model_path"),
        model_api_url=args.api_url or config.get("model_api_url"),
        user_id=args.user_id or config.get("user_id", "default_user"),
        stt_config=stt_config,
        tts_config=tts_config,
        interrupt_mode=args.interrupt_mode or config.get("interrupt_mode", "auto"),
        output_dir=args.output_dir or config.get("output_dir"),
        save_transcripts=args.save_transcripts or config.get("save_transcripts", False),
        save_recordings=args.save_recordings or config.get("save_recordings", False)
    )
    
    # Run the loop
    loop.run()


if __name__ == "__main__":
    main() 