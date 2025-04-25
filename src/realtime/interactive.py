"""
Interactive Real-Time Conversation Module

This module provides a conversational interface with real-time speech input and output.
"""

import os
import sys
import time
import json
import logging
import threading
import queue
from typing import Optional, Dict, Any, List, Callable, Tuple, Iterator, Union
from dataclasses import dataclass, field
from enum import Enum

from .speech import SpeechRecognizer, SpeechConfig, SpeechBackend, AudioConfig
from .tts import TextToSpeech, TTSConfig, TTSBackend, VoiceConfig

# Optional terminal UI imports
try:
    import click
    from rich.console import Console
    from rich.panel import Panel
    from rich.live import Live
    from rich.markdown import Markdown
    HAS_RICH = True
except ImportError:
    HAS_RICH = False

logger = logging.getLogger(__name__)


class InputMode(str, Enum):
    """Available input modes."""
    TEXT = "text"
    VOICE = "voice"
    HYBRID = "hybrid"  # Allows both text and voice


class OutputMode(str, Enum):
    """Available output modes."""
    TEXT = "text"
    VOICE = "voice"
    HYBRID = "hybrid"  # Produces both text and voice


@dataclass
class InteractionConfig:
    """Configuration for interactive conversation."""
    # Input/output modes
    input_mode: InputMode = InputMode.HYBRID
    output_mode: OutputMode = OutputMode.HYBRID
    
    # Voice configuration
    speech_config: Optional[SpeechConfig] = None
    tts_config: Optional[TTSConfig] = None
    
    # Model configuration
    model_provider: Any = None  # Function or class to provide model responses
    streaming: bool = True  # Whether to stream responses
    max_tokens: int = 1024  # Maximum tokens to generate
    
    # Behavior configuration
    interruption_enabled: bool = True  # Whether to allow interruptions
    activity_timeout: float = 60.0  # Seconds of inactivity before session ends
    auto_reconnect: bool = True  # Whether to reconnect automatically on errors
    
    # UI configuration
    terminal_ui: bool = True  # Whether to use rich terminal UI
    prompt_template: str = "{user_input}"  # Template for user prompts
    system_message: Optional[str] = None  # System message for model context


class InteractiveConversation:
    """
    Interactive conversation system with real-time speech I/O.
    
    Features:
    - Real-time speech recognition
    - Low-latency response streaming
    - Text-to-speech output
    - Terminal user interface (optional)
    - Interruption handling
    """
    
    def __init__(self, config: Optional[InteractionConfig] = None):
        """
        Initialize the interactive conversation system.
        
        Args:
            config: Configuration for conversation
        """
        self.config = config or InteractionConfig()
        
        # Initialize speech components if needed
        self.speech_recognizer = None
        self.tts = None
        
        if self.config.input_mode in (InputMode.VOICE, InputMode.HYBRID):
            self._init_speech_recognition()
            
        if self.config.output_mode in (OutputMode.VOICE, OutputMode.HYBRID):
            self._init_tts()
        
        # Initialize terminal UI if enabled
        self.console = None
        if self.config.terminal_ui and HAS_RICH:
            self.console = Console()
        
        # Conversation state
        self.conversation_history: List[Dict[str, Any]] = []
        if self.config.system_message:
            self.conversation_history.append({
                "role": "system",
                "content": self.config.system_message
            })
        
        # Processing flags
        self._running = False
        self._processing = False
        self._last_activity_time = time.time()
        self._should_interrupt = False
        
        # Processing threads
        self._input_thread = None
        self._output_thread = None
        self._streaming_buffer = queue.Queue()
    
    def _init_speech_recognition(self):
        """Initialize speech recognition component."""
        self.speech_recognizer = SpeechRecognizer(
            config=self.config.speech_config or SpeechConfig(
                backend=SpeechBackend.WHISPER_LOCAL,
                model_name="base",
                enable_vad=True
            )
        )
        logger.info("Speech recognition initialized")
    
    def _init_tts(self):
        """Initialize text-to-speech component."""
        self.tts = TextToSpeech(
            config=self.config.tts_config or TTSConfig(
                backend=TTSBackend.SYSTEM,
                voice=VoiceConfig(),
                enable_cache=True,
                cache_dir="cache/tts"
            )
        )
        logger.info("Text-to-speech initialized")
    
    def start(self, timeout: Optional[float] = None):
        """
        Start the interactive conversation session.
        
        Args:
            timeout: Maximum session duration in seconds, or None for no limit
        """
        if self._running:
            logger.warning("Session already running")
            return
        
        self._running = True
        start_time = time.time()
        
        # Print welcome message
        if self.console:
            self.console.print(Panel.fit(
                "Interactive Conversation Session Started\n"
                "Speak or type your message. Press Ctrl+C to exit.",
                title="PersLM",
                border_style="blue"
            ))
        else:
            print("\nInteractive Conversation Session Started")
            print("Speak or type your message. Press Ctrl+C to exit.\n")
        
        try:
            while self._running:
                # Check timeout
                if timeout and (time.time() - start_time) > timeout:
                    logger.info(f"Session timeout reached ({timeout}s)")
                    break
                
                # Check inactivity timeout
                if (time.time() - self._last_activity_time) > self.config.activity_timeout:
                    logger.info(f"Inactivity timeout reached ({self.config.activity_timeout}s)")
                    break
                
                # Get user input
                user_input = self._get_user_input()
                
                # Skip if empty input
                if not user_input:
                    time.sleep(0.1)
                    continue
                
                # Update activity timestamp
                self._last_activity_time = time.time()
                
                # Process user input
                self._process_user_input(user_input)
                
        except KeyboardInterrupt:
            logger.info("Session interrupted by user")
        finally:
            self._running = False
            
            # Clean up
            if self.speech_recognizer and hasattr(self.speech_recognizer, "stop_streaming"):
                self.speech_recognizer.stop_streaming()
            
            if self.console:
                self.console.print("\n[bold green]Session ended.[/bold green]")
            else:
                print("\nSession ended.")
    
    def _get_user_input(self) -> str:
        """
        Get input from the user based on the configured input mode.
        
        Returns:
            User input text
        """
        # Get input based on mode
        if self.config.input_mode == InputMode.TEXT:
            # Text-only input
            if self.console:
                try:
                    return click.prompt("\nYou", prompt_suffix="> ")
                except click.exceptions.Abort:
                    raise KeyboardInterrupt()
            else:
                try:
                    return input("\nYou> ")
                except EOFError:
                    raise KeyboardInterrupt()
                
        elif self.config.input_mode == InputMode.VOICE:
            # Voice-only input
            if self.console:
                self.console.print("[blue]Listening...[/blue]")
            else:
                print("Listening...")
                
            # Record and transcribe
            audio_data = self.speech_recognizer.record_audio()
            transcript = self.speech_recognizer.transcribe_audio(audio_data)
            
            # Show transcript
            if self.console:
                self.console.print(f"[blue]You said:[/blue] {transcript}")
            else:
                print(f"You said: {transcript}")
                
            return transcript
            
        elif self.config.input_mode == InputMode.HYBRID:
            # Hybrid input - allow both text and voice
            if self.console:
                self.console.print("[blue]Speak or type your message (or press Enter to switch):[/blue]")
            else:
                print("Speak or type your message (or press Enter to switch):")
            
            # Start listening in background
            speech_queue = queue.Queue()
            stop_event = threading.Event()
            
            def speech_worker():
                try:
                    audio_data = self.speech_recognizer.record_audio()
                    if not stop_event.is_set():
                        transcript = self.speech_recognizer.transcribe_audio(audio_data)
                        speech_queue.put(transcript)
                except Exception as e:
                    logger.error(f"Error in speech worker: {str(e)}")
            
            speech_thread = threading.Thread(target=speech_worker, daemon=True)
            speech_thread.start()
            
            # Wait for either speech input or text input
            text_input = ""
            try:
                # Wait for user to type something
                if sys.platform == "win32":
                    import msvcrt
                    chars = []
                    while not speech_queue.qsize() and not stop_event.is_set():
                        if msvcrt.kbhit():
                            char = msvcrt.getwch()
                            if char == '\r':  # Enter key
                                print()
                                break
                            elif char == '\x03':  # Ctrl+C
                                stop_event.set()
                                raise KeyboardInterrupt()
                            else:
                                print(char, end='', flush=True)
                                chars.append(char)
                        time.sleep(0.01)
                    text_input = ''.join(chars)
                else:
                    import select
                    import termios
                    import tty
                    
                    # Save terminal settings
                    old_settings = termios.tcgetattr(sys.stdin)
                    try:
                        # Set terminal to raw mode
                        tty.setraw(sys.stdin.fileno())
                        
                        chars = []
                        while not speech_queue.qsize() and not stop_event.is_set():
                            # Check if input is available
                            if select.select([sys.stdin], [], [], 0.01)[0]:
                                char = sys.stdin.read(1)
                                if char == '\r':  # Enter key
                                    sys.stdout.write('\n')
                                    sys.stdout.flush()
                                    break
                                elif char == '\x03':  # Ctrl+C
                                    stop_event.set()
                                    raise KeyboardInterrupt()
                                else:
                                    sys.stdout.write(char)
                                    sys.stdout.flush()
                                    chars.append(char)
                            time.sleep(0.01)
                        text_input = ''.join(chars)
                    finally:
                        # Restore terminal settings
                        termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old_settings)
                        
            except (ImportError, AttributeError):
                # Fall back to regular input if terminal control fails
                logger.warning("Terminal control not available, falling back to regular input")
                try:
                    text_input = input("\nYou> ")
                except EOFError:
                    stop_event.set()
                    raise KeyboardInterrupt()
            
            # Stop speech recognition
            stop_event.set()
            
            # Get results
            try:
                speech_input = speech_queue.get(block=False)
                
                # Show transcript
                if self.console:
                    self.console.print(f"[blue]You said:[/blue] {speech_input}")
                else:
                    print(f"\nYou said: {speech_input}")
                    
                return speech_input
            except queue.Empty:
                # Return text input if no speech detected
                return text_input
        
        return ""
    
    def _process_user_input(self, user_input: str):
        """
        Process user input and generate a response.
        
        Args:
            user_input: User input text
        """
        if not user_input.strip():
            return
        
        # Add to conversation history
        self.conversation_history.append({
            "role": "user",
            "content": user_input
        })
        
        # Prepare for processing
        self._processing = True
        self._should_interrupt = False
        
        # Clear streaming buffer
        while not self._streaming_buffer.empty():
            try:
                self._streaming_buffer.get_nowait()
            except queue.Empty:
                break
        
        # Get model response
        if self.config.streaming:
            # Start streaming response
            self._stream_response(user_input)
        else:
            # Get complete response
            self._get_complete_response(user_input)
        
        # Reset processing state
        self._processing = False
    
    def _stream_response(self, user_input: str):
        """
        Stream model response in real-time.
        
        Args:
            user_input: User input text
        """
        if not self.config.model_provider:
            logger.error("No model provider configured")
            return
        
        # Create prompt from conversation history
        prompt = self._create_prompt(user_input)
        
        # Start streaming in background
        self._output_thread = threading.Thread(
            target=self._streaming_worker,
            args=(prompt,),
            daemon=True
        )
        self._output_thread.start()
        
        # Display streaming results
        response_chunks = []
        speaking_thread = None
        current_speech_chunk = []
        last_speech_time = time.time()
        speech_chunk_size = 20  # Number of words per speech chunk
        
        try:
            if self.console and HAS_RICH:
                # Rich console UI for text display
                with Live("", refresh_per_second=10) as live:
                    while self._output_thread.is_alive() or not self._streaming_buffer.empty():
                        try:
                            # Get next chunk
                            chunk = self._streaming_buffer.get(timeout=0.1)
                            response_chunks.append(chunk)
                            
                            # Update displayed text
                            response_text = "".join(response_chunks)
                            live.update(Panel(
                                Markdown(response_text),
                                title="PersLM",
                                border_style="green"
                            ))
                            
                            # Handle speech output if enabled
                            if self.config.output_mode in (OutputMode.VOICE, OutputMode.HYBRID):
                                current_speech_chunk.append(chunk)
                                words_in_chunk = " ".join(current_speech_chunk).split()
                                
                                # Speak when we have enough words or there's a pause
                                if (len(words_in_chunk) >= speech_chunk_size or 
                                    (chunk.strip().endswith(('.', '!', '?', ':', ';', ',')) and 
                                     len(words_in_chunk) > 5 and
                                     time.time() - last_speech_time > 1.0)):
                                    
                                    # Only start a new speech thread if the previous one is done
                                    if speaking_thread is None or not speaking_thread.is_alive():
                                        speech_text = " ".join(words_in_chunk)
                                        speaking_thread = threading.Thread(
                                            target=self._speak_text,
                                            args=(speech_text,),
                                            daemon=True
                                        )
                                        speaking_thread.start()
                                        current_speech_chunk = []
                                        last_speech_time = time.time()
                            
                        except queue.Empty:
                            # No new chunks available
                            pass
                        
                        # Check for interruption
                        if self._should_interrupt:
                            break
            else:
                # Simple print-based UI
                print("\nPersLM: ", end="", flush=True)
                while self._output_thread.is_alive() or not self._streaming_buffer.empty():
                    try:
                        # Get next chunk
                        chunk = self._streaming_buffer.get(timeout=0.1)
                        response_chunks.append(chunk)
                        
                        # Print chunk
                        print(chunk, end="", flush=True)
                        
                        # Handle speech output if enabled
                        if self.config.output_mode in (OutputMode.VOICE, OutputMode.HYBRID):
                            current_speech_chunk.append(chunk)
                            words_in_chunk = " ".join(current_speech_chunk).split()
                            
                            # Speak when we have enough words or there's a pause
                            if (len(words_in_chunk) >= speech_chunk_size or 
                                (chunk.strip().endswith(('.', '!', '?', ':', ';', ',')) and 
                                 len(words_in_chunk) > 5 and
                                 time.time() - last_speech_time > 1.0)):
                                
                                # Only start a new speech thread if the previous one is done
                                if speaking_thread is None or not speaking_thread.is_alive():
                                    speech_text = " ".join(words_in_chunk)
                                    speaking_thread = threading.Thread(
                                        target=self._speak_text,
                                        args=(speech_text,),
                                        daemon=True
                                    )
                                    speaking_thread.start()
                                    current_speech_chunk = []
                                    last_speech_time = time.time()
                        
                    except queue.Empty:
                        # No new chunks available
                        pass
                    
                    # Check for interruption
                    if self._should_interrupt:
                        break
                print()  # Add newline after response
        
        except KeyboardInterrupt:
            # Handle interruption
            self._should_interrupt = True
            logger.info("Response interrupted by user")
        
        # Finalize TTS if there are remaining words
        if (self.config.output_mode in (OutputMode.VOICE, OutputMode.HYBRID) and 
            current_speech_chunk and len(current_speech_chunk) > 0):
            speech_text = " ".join(" ".join(current_speech_chunk).split())
            if speech_text.strip():
                self._speak_text(speech_text)
        
        # Wait for threads to finish
        if speaking_thread and speaking_thread.is_alive():
            speaking_thread.join(timeout=1.0)
        
        # Add response to conversation history
        response_text = "".join(response_chunks)
        if response_text:
            self.conversation_history.append({
                "role": "assistant",
                "content": response_text
            })
    
    def _streaming_worker(self, prompt: str):
        """
        Worker thread for streaming model responses.
        
        Args:
            prompt: Input prompt for the model
        """
        try:
            # Call model with streaming
            for chunk in self._call_model_streaming(prompt):
                if self._should_interrupt:
                    break
                self._streaming_buffer.put(chunk)
                
        except Exception as e:
            logger.error(f"Error in streaming worker: {str(e)}")
            self._streaming_buffer.put(f"\nError generating response: {str(e)}")
    
    def _get_complete_response(self, user_input: str):
        """
        Get complete model response (non-streaming).
        
        Args:
            user_input: User input text
        """
        if not self.config.model_provider:
            logger.error("No model provider configured")
            return
        
        try:
            # Create prompt from conversation history
            prompt = self._create_prompt(user_input)
            
            # Get response from model
            if self.console:
                with self.console.status("[green]Generating response...[/green]"):
                    response = self._call_model(prompt)
            else:
                print("\nGenerating response...")
                response = self._call_model(prompt)
            
            # Display response
            if self.console and HAS_RICH:
                self.console.print(Panel(
                    Markdown(response),
                    title="PersLM",
                    border_style="green"
                ))
            else:
                print(f"\nPersLM: {response}")
            
            # Speak response if enabled
            if self.config.output_mode in (OutputMode.VOICE, OutputMode.HYBRID):
                self._speak_text(response)
            
            # Add to conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": response
            })
            
        except Exception as e:
            logger.error(f"Error generating response: {str(e)}")
            if self.console:
                self.console.print(f"[bold red]Error:[/bold red] {str(e)}")
            else:
                print(f"\nError: {str(e)}")
    
    def _call_model(self, prompt: str) -> str:
        """
        Call the model to get a complete response.
        
        Args:
            prompt: Input prompt
            
        Returns:
            Model response text
        """
        if callable(self.config.model_provider):
            # Function-based provider
            return self.config.model_provider(prompt)
        elif hasattr(self.config.model_provider, "generate"):
            # Class-based provider with generate method
            return self.config.model_provider.generate(
                prompt, 
                max_tokens=self.config.max_tokens
            )
        else:
            # Try to use as is
            return str(self.config.model_provider(prompt))
    
    def _call_model_streaming(self, prompt: str) -> Iterator[str]:
        """
        Call the model with streaming output.
        
        Args:
            prompt: Input prompt
            
        Yields:
            Text chunks from the model
        """
        if callable(self.config.model_provider):
            # Check if provider supports streaming
            if hasattr(self.config.model_provider, "streaming"):
                # Custom streaming function
                yield from self.config.model_provider(prompt, streaming=True)
            else:
                # Fallback to non-streaming
                result = self.config.model_provider(prompt)
                yield result
        elif hasattr(self.config.model_provider, "generate"):
            # Class-based provider with generate method
            if hasattr(self.config.model_provider, "generate_streaming"):
                # Streaming generate method
                yield from self.config.model_provider.generate_streaming(
                    prompt, 
                    max_tokens=self.config.max_tokens
                )
            else:
                # Fallback to non-streaming
                result = self.config.model_provider.generate(
                    prompt, 
                    max_tokens=self.config.max_tokens
                )
                yield result
        else:
            # Try to use as is
            result = str(self.config.model_provider(prompt))
            yield result
    
    def _create_prompt(self, user_input: str) -> str:
        """
        Create a prompt from the conversation history.
        
        Args:
            user_input: Latest user input
            
        Returns:
            Formatted prompt for the model
        """
        # Format using template if available
        formatted_input = self.config.prompt_template.format(user_input=user_input)
        
        # Simple conversation format for text completion
        if len(self.conversation_history) <= 1:  # Only system message or empty
            return formatted_input
        
        # Format conversation history
        messages = []
        for message in self.conversation_history:
            role = message["role"]
            content = message["content"]
            
            if role == "system":
                messages.append(f"<system>\n{content}\n</system>")
            elif role == "user":
                messages.append(f"User: {content}")
            elif role == "assistant":
                messages.append(f"Assistant: {content}")
        
        # Add current user input
        messages.append(f"User: {formatted_input}")
        messages.append("Assistant:")
        
        return "\n\n".join(messages)
    
    def _speak_text(self, text: str):
        """
        Speak text using TTS.
        
        Args:
            text: Text to speak
        """
        if not self.tts:
            self._init_tts()
        
        try:
            self.tts.say(text)
        except Exception as e:
            logger.error(f"Error in TTS: {str(e)}")
    
    def interrupt(self):
        """Interrupt the current response generation."""
        if self._processing and self.config.interruption_enabled:
            self._should_interrupt = True
            logger.info("Interruption requested")
            return True
        return False
    
    def stop(self):
        """Stop the conversation session."""
        self._running = False
        self._should_interrupt = True
        
        # Stop speech recognition if active
        if self.speech_recognizer and hasattr(self.speech_recognizer, "stop_streaming"):
            self.speech_recognizer.stop_streaming()
        
        logger.info("Session stopped")


# Command-line interface for testing
def main():
    """Command-line interface for testing interactive conversation."""
    import argparse
    
    # Configure logging
    logging.basicConfig(level=logging.INFO)
    
    parser = argparse.ArgumentParser(description="Test interactive conversation")
    parser.add_argument("--input-mode", choices=["text", "voice", "hybrid"], 
                       default="hybrid", help="Input mode")
    parser.add_argument("--output-mode", choices=["text", "voice", "hybrid"], 
                       default="hybrid", help="Output mode")
    parser.add_argument("--no-streaming", action="store_true", help="Disable response streaming")
    parser.add_argument("--system-message", help="System message for the conversation")
    parser.add_argument("--timeout", type=float, help="Session timeout in seconds")
    parser.add_argument("--no-rich", action="store_true", help="Disable rich terminal UI")
    
    args = parser.parse_args()
    
    # Create a mock model provider for testing
    def mock_model_provider(prompt, streaming=False):
        """Mock model provider that generates test responses."""
        if "time" in prompt.lower():
            response = f"The current time is {time.strftime('%H:%M:%S')}."
        elif "date" in prompt.lower():
            response = f"Today is {time.strftime('%A, %B %d, %Y')}."
        elif "weather" in prompt.lower():
            response = "I don't have real-time weather data, but I can help you find a forecast online."
        elif "hello" in prompt.lower() or "hi" in prompt.lower():
            response = "Hello! How can I assist you today?"
        else:
            response = (
                "I'm a mock model for testing the interactive conversation system. "
                "I can respond to simple queries about time, date, weather, or greetings. "
                "What would you like to know?"
            )
        
        if streaming:
            # Simulate streaming by yielding words with small delays
            words = response.split()
            for i, word in enumerate(words):
                if i > 0:
                    # Add space before word (except for first word)
                    yield " "
                yield word
                
                # Add punctuation pauses
                if word.endswith((".", "!", "?", ":", ";", ",")):
                    time.sleep(0.3)
                else:
                    time.sleep(0.1)
        else:
            return response
    
    # Configure the conversation
    config = InteractionConfig(
        input_mode=InputMode(args.input_mode),
        output_mode=OutputMode(args.output_mode),
        model_provider=mock_model_provider,
        streaming=not args.no_streaming,
        terminal_ui=not args.no_rich,
        system_message=args.system_message
    )
    
    # Create and start the conversation
    conversation = InteractiveConversation(config)
    
    print("\nStarting interactive conversation test...")
    print("This is using a mock model. Ask about time, date, weather, or say hello.")
    print("Press Ctrl+C to exit.\n")
    
    conversation.start(timeout=args.timeout)


if __name__ == "__main__":
    main() 