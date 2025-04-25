# PersLM Multi-Modal System

The PersLM multi-modal system extends the model's capabilities beyond text to interact with other modalities such as images and audio. This document explains the multi-modal architecture, available modalities, and how to use and extend the system.

## Overview

The multi-modal system in PersLM enables the integration of different modalities with the core language model, allowing it to:

- Process images through captioning and object recognition
- Convert speech to text and text to speech
- Analyze visual and audio content
- Generate images and audio from text descriptions
- Provide a unified interface across modalities

Key features of the multi-modal system:
- Modular architecture for easily adding new modalities
- Consistent APIs for modality conversion
- Integration with the memory and reasoning systems
- Extensible design for adding new models and capabilities
- Placeholder implementations for rapid prototyping

## Available Modalities

PersLM currently supports the following modalities:

### Image Modality

The image modality processor enables interaction with images through:

#### Image Understanding
- **Image Captioning**: Generate descriptions of images
- **OCR (Optical Character Recognition)**: Extract text from images
- **Image Analysis**: Analyze image content, extract metadata

#### Image Generation
- **Text-to-Image**: Generate images from text descriptions

**Example Usage:**
```python
from src.modalities.base import ModalityConfig
from src.modalities.image import ImageProcessor

# Initialize processor
image_config = ModalityConfig(enabled=True, device="cuda")
image_processor = ImageProcessor(image_config)
image_processor.initialize()

# Image to text (captioning)
caption = image_processor.to_text("path/to/image.jpg")
print(f"Image caption: {caption}")

# OCR
text = image_processor.ocr("path/to/document.png")
print(f"Extracted text: {text}")

# Image analysis
analysis = image_processor.analyze_image("path/to/photo.jpg")
print(f"Image analysis: {analysis}")

# Text to image
generated_image = image_processor.from_text("A beautiful sunset over mountains")
generated_image.save("generated_sunset.png")

# Clean up
image_processor.cleanup()
```

### Audio Modality

The audio modality processor enables interaction with audio through:

#### Audio Understanding
- **Speech-to-Text (Transcription)**: Convert spoken language to text
- **Audio Analysis**: Analyze audio content, detect speakers, etc.

#### Audio Generation
- **Text-to-Speech (Synthesis)**: Convert text to spoken language

**Example Usage:**
```python
from src.modalities.base import ModalityConfig
from src.modalities.audio import AudioProcessor

# Initialize processor
audio_config = ModalityConfig(enabled=True, device="cuda")
audio_processor = AudioProcessor(audio_config)
audio_processor.initialize()

# Audio to text (transcription)
transcription = audio_processor.to_text("path/to/recording.wav")
print(f"Transcription: {transcription}")

# Audio analysis
analysis = audio_processor.analyze_audio("path/to/audio.wav")
print(f"Audio analysis: {analysis}")

# Text to audio
speech_audio = audio_processor.from_text("Hello, this is a test of the text to speech system.")
with open("generated_speech.wav", "wb") as f:
    f.write(speech_audio)

# Clean up
audio_processor.cleanup()
```

## System Architecture

The multi-modal system is built around a consistent architecture:

### Base Components

#### ModalityConfig
Configuration for modality processors, including:
- `enabled`: Whether the modality is enabled
- `model_name`: Name of the model to use
- `model_path`: Path to the model files
- `device`: Device to run the model on (CPU/GPU)
- `batch_size`: Batch size for processing
- `max_size`: Maximum size/dimension/length
- `timeout`: Maximum processing time

#### ModalityProcessor
Base class for all modality processors, with key methods:
- `initialize()`: Load models and resources
- `to_text()`: Convert from the modality to text
- `from_text()`: Convert from text to the modality
- `cleanup()`: Release resources

### Integration with Core Systems

The multi-modal system integrates with other PersLM components:

#### Memory Integration
Multi-modal content can be stored in memory:
```python
# Store an image caption in memory
image = image_processor.load_image("path/to/image.jpg")
caption = image_processor.to_text(image)
memory_manager.add(caption, metadata={"type": "image_caption", "source": "path/to/image.jpg"})
```

#### Reasoning Integration
The reasoning system can use multi-modal inputs:
```python
# Use image content in reasoning
image = image_processor.load_image("path/to/chart.png")
chart_text = image_processor.ocr(image)
context = f"Chart content: {chart_text}"
reasoning_result = reasoning_manager.reason(query="What does this chart show?", context=context)
```

#### Tool Integration
Multi-modal processors can be used with tools:
```python
# Use image processing in a tool
def image_analysis_tool(image_path):
    image = image_processor.load_image(image_path)
    analysis = image_processor.analyze_image(image)
    return analysis
```

## Implementation Details

### Image Processor

The image processor provides:

1. **Image Loading**
   - Support for file paths, bytes, and base64-encoded images
   - Validation of image formats and sizes

2. **Image Captioning**
   - Implementation ready for models like BLIP, ViT, etc.
   - Placeholder implementation for testing

3. **OCR**
   - Implementation ready for models like Tesseract, EasyOCR, etc.
   - Placeholder implementation for testing

4. **Image Generation**
   - Implementation ready for models like Stable Diffusion, DALL-E, etc.
   - Placeholder implementation for testing

### Audio Processor

The audio processor provides:

1. **Audio Loading**
   - Support for various audio formats and sources
   - Validation of audio formats and lengths

2. **Speech-to-Text**
   - Implementation ready for models like Whisper, Wav2Vec, etc.
   - Placeholder implementation for testing

3. **Text-to-Speech**
   - Implementation ready for models like gTTS, Tacotron, etc.
   - Placeholder implementation for testing

## Using the Multi-Modal System

### Configuration

Configure the multi-modal system in your project:

```python
# In config.yaml
modalities:
  image:
    enabled: true
    model_name: "openai/clip-vit-base-patch32"
    device: "cuda"
    max_size: 1024
  
  audio:
    enabled: true
    model_name: "openai/whisper-medium"
    device: "cuda"
    max_size: 10485760  # 10MB
```

### Basic Usage

Use the multi-modal system in your application:

```python
# Initialize processors
from src.modalities.base import ModalityConfig
from src.modalities.image import ImageProcessor
from src.modalities.audio import AudioProcessor

def init_modalities(config):
    modalities = {}
    
    if config.get("modalities", {}).get("image", {}).get("enabled", False):
        image_config = ModalityConfig(**config["modalities"]["image"])
        modalities["image"] = ImageProcessor(image_config)
        modalities["image"].initialize()
    
    if config.get("modalities", {}).get("audio", {}).get("enabled", False):
        audio_config = ModalityConfig(**config["modalities"]["audio"])
        modalities["audio"] = AudioProcessor(audio_config)
        modalities["audio"].initialize()
    
    return modalities

# Use modalities
modalities = init_modalities(config)

# Process an image
if "image" in modalities:
    caption = modalities["image"].to_text("path/to/image.jpg")
    print(caption)

# Process audio
if "audio" in modalities:
    transcription = modalities["audio"].to_text("path/to/audio.wav")
    print(transcription)
```

### Command Line Interface

Use the multi-modal system from the command line:

```bash
# Test image captioning
python scripts/test_modalities.py --test image

# Test audio transcription
python scripts/test_modalities.py --test audio

# Test all modalities
python scripts/test_modalities.py --test all
```

## Extending the Multi-Modal System

### Adding New Modality Processors

To add a new modality processor:

1. Create a new class that inherits from `ModalityProcessor`
2. Implement the required methods
3. Register it with the application

Example for a hypothetical "Video" modality:

```python
from src.modalities.base import ModalityProcessor, ModalityConfig

class VideoProcessor(ModalityProcessor):
    def __init__(self, config: ModalityConfig = None):
        super().__init__(config)
        self.video_model = None
        
    def initialize(self) -> bool:
        # Load models and resources
        try:
            # Load video processing model
            self.is_initialized = True
            return True
        except Exception as e:
            logger.exception("Failed to initialize video processor")
            return False
            
    def to_text(self, video_source) -> str:
        # Convert video to text (e.g., video description)
        video = self._load_video(video_source)
        # Process video...
        return "Description of video content"
        
    def from_text(self, text: str):
        # Generate video from text description
        # Implementation...
        return video_data
```

### Implementing Real Models

To replace the placeholder implementations with real models:

1. Add the appropriate model dependencies
2. Update the initialization method to load the real model
3. Update the processing methods to use the model

Example with a real image captioning model:

```python
def initialize(self) -> bool:
    try:
        from transformers import CLIPProcessor, CLIPModel
        
        model_name = self.config.model_name or "openai/clip-vit-base-patch32"
        self.clip_model = CLIPModel.from_pretrained(model_name)
        self.clip_processor = CLIPProcessor.from_pretrained(model_name)
        
        device = self.config.device
        if device == "cuda" and torch.cuda.is_available():
            self.clip_model = self.clip_model.to("cuda")
            
        self.is_initialized = True
        return True
    except Exception as e:
        logger.exception(f"Failed to initialize image processor: {str(e)}")
        return False

def to_text(self, image_source) -> str:
    self._ensure_initialized()
    
    image = self.load_image(image_source)
    inputs = self.clip_processor(
        text=["a photo of a cat", "a photo of a dog"], 
        images=image, 
        return_tensors="pt", 
        padding=True
    )
    
    if torch.cuda.is_available():
        inputs = {k: v.to("cuda") for k, v in inputs.items()}
        
    outputs = self.clip_model(**inputs)
    logits_per_image = outputs.logits_per_image
    probs = logits_per_image.softmax(dim=1)
    
    if probs[0][0] > probs[0][1]:
        return "This is a photo of a cat"
    else:
        return "This is a photo of a dog"
```

## Future Developments

The multi-modal system is designed to be expanded with additional capabilities:

1. **Additional Modalities**
   - Video processing
   - Document understanding
   - 3D model processing
   - Tactile/haptic feedback

2. **Enhanced Integration**
   - Multi-modal reasoning (reasoning across modalities)
   - Multi-modal memory (storing and retrieving multi-modal content)
   - Multi-modal generation (coordinated generation across modalities)

3. **Advanced Models**
   - Integration with state-of-the-art multi-modal models
   - Fine-tuning for specialized domains
   - Model quantization for efficient deployment

4. **Real-time Processing**
   - Streaming audio and video processing
   - Real-time transcription and captioning
   - Interactive multi-modal applications 