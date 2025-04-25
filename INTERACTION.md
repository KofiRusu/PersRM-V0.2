# Real-Time Interaction Guide

This guide provides instructions for setting up and using the real-time interaction capabilities of PersLM, which enable voice conversations and multimodal interactions.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Audio Integration](#audio-integration)
- [Example Interaction Flow](#example-interaction-flow)
- [Troubleshooting](#troubleshooting)

## Overview

The Real-Time Interaction module of PersLM provides:

- **Speech-to-Text**: Convert spoken language to text using local Whisper models or cloud APIs
- **Text-to-Speech**: Convert model responses to spoken language
- **Interactive Conversations**: Engage in natural, voice-based conversations with fallback to text
- **Personalization**: Adapt responses based on user profiles and interaction history
- **Memory Integration**: Record and recall conversation history
- **Multimodal Support**: Handle text, audio, and potentially other modalities

The system is designed to be resilient, with fallbacks for when audio capabilities aren't available, ensuring cross-platform usability.

## Installation

### Prerequisites

- Python 3.10+
- FFmpeg (for audio processing)
- PersLM base system

### Required Packages

```bash
# For speech recognition
pip install openai-whisper sounddevice soundfile pyaudio

# For text-to-speech
pip install pyttsx3 edge-tts pygame

# For optional TTS providers
pip install elevenlabs openai

# For terminal UI
pip install rich click
```

### Installing FFmpeg

#### macOS:
```bash
brew install ffmpeg
```

#### Ubuntu/Debian:
```bash
sudo apt update
sudo apt install ffmpeg
```

#### Windows:
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH, or install via:
```bash
choco install ffmpeg
```

## Configuration

Configuration is managed through a YAML file located at `src/realtime/config/config.yaml`. You can override this path with the `--config` command-line argument.

### Example Configuration

```yaml
# Speech-to-Text Configuration
speech:
  backend: whisper_local  # Options: whisper_local, openai, system
  model_name: base        # Whisper model size (tiny, base, small, medium, large)
  language: null          # Language code or null for auto-detection
  
  # Audio settings
  audio:
    sample_rate: 16000
    silence_threshold: 0.03
    silence_duration: 2.0
    max_duration: 30.0

# Text-to-Speech Configuration
tts:
  backend: system         # Options: system, pyttsx3, edge_tts, openai, elevenlabs
  voice:
    voice_id: default
    language: en-US
    rate: 1.0
  
  # Caching to reduce latency
  enable_cache: true
  cache_dir: cache/tts

# Interaction Configuration  
interaction:
  input_mode: hybrid      # Options: text, voice, hybrid
  output_mode: hybrid     # Options: text, voice, hybrid
  streaming: true         # Enable streaming responses
  interruption_enabled: true
```

## Usage

### Command Line Interface

```bash
# Start real-time conversation
python -m src.realtime.realtime_loop --user john_doe

# With specific configuration
python -m src.realtime.realtime_loop --config custom_config.yaml --user john_doe

# With session timeout (in seconds)
python -m src.realtime.realtime_loop --timeout 300
```

### Python API

```python
from src.realtime.realtime_loop import RealtimeLoop

# Initialize
loop = RealtimeLoop(
    config_path="path/to/config.yaml",
    user_id="john_doe"
)

# Start conversation
loop.start()

# Stop conversation
loop.stop()
```

## Audio Integration

The real-time interaction system integrates with audio through multiple components:

### Speech-to-Text

The system supports multiple speech recognition backends:

1. **Local Whisper** (Default): Runs OpenAI's Whisper model locally for private, offline speech recognition.
2. **OpenAI API**: Uses OpenAI's cloud API for speech recognition.
3. **System**: Uses platform-specific speech recognition (when available).

Voice Activity Detection (VAD) is implemented to automatically detect when a user has finished speaking, improving the conversational flow.

### Text-to-Speech

Multiple TTS options are available:

1. **System**: Uses the operating system's built-in TTS capabilities:
   - macOS: Uses the `say` command
   - Windows: Uses Windows Speech API via pyttsx3
   - Linux: Uses espeak or festival

2. **Edge TTS**: Microsoft's Edge browser TTS service (requires internet)

3. **ElevenLabs**: High-quality, emotional TTS (requires API key)

4. **OpenAI**: OpenAI's TTS service (requires API key)

5. **pyttsx3**: Cross-platform offline TTS library

### Audio Output

Audio playback is handled through pygame, providing cross-platform compatibility. Response caching is implemented to reduce latency for frequently used responses.

## Example Interaction Flow

The following diagram illustrates the flow of a typical voice interaction:

```
User speaks → Speech Recognition → Text Transcription → PersLM Processing → 
Generated Response → Text-to-Speech → Audio Output → User hears
```

During this process:

1. The user's speech is captured via microphone
2. Speech is transcribed to text using the configured backend
3. The text is processed by PersLM, including:
   - User profile personalization
   - Memory integration
   - Agent-based processing
4. The generated response is converted to speech
5. The audio is played back to the user
6. The entire interaction is logged to memory

At any point, the user can interrupt the system's response by starting to speak again, creating a more natural conversational flow.

### Session Example

```
$ python -m src.realtime.realtime_loop

Interactive Conversation Session Started
Speak or type your message. Press Ctrl+C to exit.

Listening...
You: What's the weather like today?

PersLM: I don't have real-time weather data, but I can help you find that information. Would you like me to show you how to check the weather for your location?

You: Yes, please.

PersLM: To check the current weather, you can:
1. Visit weather.gov or a similar website
2. Use a weather app on your phone
3. Ask a virtual assistant like Siri or Google Assistant
4. Type "weather near me" into a search engine

Would you like information about any of these options?

You: No, that's enough. Thank you.

PersLM: You're welcome! Let me know if you need help with anything else.

Session ended.
```

## Troubleshooting

### Common Issues

1. **Microphone Not Working**
   - Check microphone permissions for your application
   - Try a different device with `--device-index` argument
   - Verify microphone works in other applications

2. **Speech Recognition Issues**
   - Try a different Whisper model size (tiny or base for faster but less accurate recognition)
   - Adjust the silence detection threshold in configuration
   - Ensure FFmpeg is properly installed

3. **Text-to-Speech Issues**
   - Try a different TTS backend
   - Check audio output device is working
   - For API-based TTS, verify your API key is correctly configured

4. **High Latency**
   - Use smaller Whisper models for faster transcription
   - Enable TTS caching
   - Use local TTS options instead of API-based ones
   - Disable streaming for complete responses

If issues persist, check the logs using the `--log-level debug` argument for more detailed information about what's happening during the interaction process. 