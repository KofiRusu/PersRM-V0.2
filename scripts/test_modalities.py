#!/usr/bin/env python3
"""
Modality Testing Script

This script tests the modality processors in PersLM for handling images and audio.
"""

import os
import sys
import argparse
import logging
import json
import base64
from PIL import Image
import io

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import modality modules
from src.modalities.base import ModalityConfig
from src.modalities.image import ImageProcessor
from src.modalities.audio import AudioProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def create_test_image():
    """Create a test image."""
    logger.info("Creating test image...")
    
    # Create a simple test image
    width, height = 300, 200
    image = Image.new('RGB', (width, height), color=(73, 109, 137))
    
    # Add some text
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(image)
    try:
        # Try to load a font (might not be available)
        font = ImageFont.truetype("Arial.ttf", 24)
    except IOError:
        font = None
    
    # Draw text on the image
    draw.text((10, 10), "PersLM Test Image", fill=(255, 255, 255), font=font)
    draw.text((10, 50), "Multi-modal testing", fill=(255, 255, 255), font=font)
    
    # Save the test image
    test_dir = os.path.join("data", "test_modalities")
    os.makedirs(test_dir, exist_ok=True)
    test_img_path = os.path.join(test_dir, "test_image.png")
    image.save(test_img_path)
    
    logger.info(f"Test image saved to {test_img_path}")
    return test_img_path

def create_test_audio():
    """Create a test audio file."""
    logger.info("Creating test audio file...")
    
    # Create a simple test audio (sine wave)
    import wave
    import math
    import array
    
    test_dir = os.path.join("data", "test_modalities")
    os.makedirs(test_dir, exist_ok=True)
    test_audio_path = os.path.join(test_dir, "test_audio.wav")
    
    # Parameters
    sample_rate = 44100  # Hz
    duration = 2  # seconds
    frequency = 440  # Hz (A4 note)
    
    # Generate samples
    samples = []
    for i in range(int(sample_rate * duration)):
        sample = math.sin(2 * math.pi * frequency * i / sample_rate)
        # Convert to 16-bit PCM
        sample = int(sample * 32767)
        samples.append(sample)
    
    # Create a WAV file
    with wave.open(test_audio_path, 'wb') as wav_file:
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(array.array('h', samples).tobytes())
    
    logger.info(f"Test audio saved to {test_audio_path}")
    return test_audio_path

def test_image_processor():
    """Test the image processor."""
    logger.info("Testing ImageProcessor...")
    
    # Create image processor
    config = ModalityConfig(enabled=True, device="cpu")
    image_processor = ImageProcessor(config)
    
    # Initialize processor
    if not image_processor.initialize():
        logger.error("Failed to initialize image processor")
        return False
    
    # Create test image
    test_img_path = create_test_image()
    
    # Test loading image
    logger.info("Testing image loading...")
    try:
        image = image_processor.load_image(test_img_path)
        logger.info(f"Successfully loaded image of size {image.size}")
    except Exception as e:
        logger.error(f"Failed to load image: {str(e)}")
        return False
    
    # Test image to text (captioning)
    logger.info("Testing image to text...")
    try:
        caption = image_processor.to_text(test_img_path)
        logger.info(f"Generated caption: {caption}")
    except Exception as e:
        logger.error(f"Failed to generate caption: {str(e)}")
        return False
    
    # Test OCR
    logger.info("Testing OCR...")
    try:
        ocr_text = image_processor.ocr(test_img_path)
        logger.info(f"Extracted text: {ocr_text}")
    except Exception as e:
        logger.error(f"Failed to extract text: {str(e)}")
        return False
    
    # Test image analysis
    logger.info("Testing image analysis...")
    try:
        analysis = image_processor.analyze_image(test_img_path)
        logger.info(f"Image analysis results: {json.dumps(analysis, indent=2)}")
    except Exception as e:
        logger.error(f"Failed to analyze image: {str(e)}")
        return False
    
    # Test text to image
    logger.info("Testing text to image...")
    try:
        generated_image = image_processor.from_text("A blue sky with clouds")
        
        # Save the generated image
        test_dir = os.path.join("data", "test_modalities")
        generated_img_path = os.path.join(test_dir, "generated_image.png")
        generated_image.save(generated_img_path)
        logger.info(f"Generated image saved to {generated_img_path}")
        
        # Test image to base64
        base64_img = image_processor.image_to_base64(generated_image)
        logger.info(f"Base64 image length: {len(base64_img)} characters")
    except Exception as e:
        logger.error(f"Failed to generate image: {str(e)}")
        return False
    
    # Clean up
    image_processor.cleanup()
    
    return True

def test_audio_processor():
    """Test the audio processor."""
    logger.info("Testing AudioProcessor...")
    
    # Create audio processor
    config = ModalityConfig(enabled=True, device="cpu")
    audio_processor = AudioProcessor(config)
    
    # Initialize processor
    if not audio_processor.initialize():
        logger.error("Failed to initialize audio processor")
        return False
    
    # Create test audio
    test_audio_path = create_test_audio()
    
    # Test loading audio
    logger.info("Testing audio loading...")
    try:
        audio_data = audio_processor.load_audio(test_audio_path)
        logger.info(f"Successfully loaded audio of size {len(audio_data)} bytes")
    except Exception as e:
        logger.error(f"Failed to load audio: {str(e)}")
        return False
    
    # Test audio to text (transcription)
    logger.info("Testing audio to text...")
    try:
        transcription = audio_processor.to_text(test_audio_path)
        logger.info(f"Generated transcription: {transcription}")
    except Exception as e:
        logger.error(f"Failed to generate transcription: {str(e)}")
        return False
    
    # Test text to audio
    logger.info("Testing text to audio...")
    try:
        speech_audio = audio_processor.from_text("Hello, this is a test of the text to speech system.")
        
        # Save the generated audio
        test_dir = os.path.join("data", "test_modalities")
        generated_audio_path = os.path.join(test_dir, "generated_audio.wav")
        with open(generated_audio_path, 'wb') as f:
            f.write(speech_audio)
        logger.info(f"Generated audio saved to {generated_audio_path}")
        
        # Test audio to base64
        base64_audio = audio_processor.audio_to_base64(speech_audio)
        logger.info(f"Base64 audio length: {len(base64_audio)} characters")
    except Exception as e:
        logger.error(f"Failed to generate audio: {str(e)}")
        return False
    
    # Test audio analysis
    logger.info("Testing audio analysis...")
    try:
        analysis = audio_processor.analyze_audio(test_audio_path)
        logger.info(f"Audio analysis results: {json.dumps(analysis, indent=2)}")
    except Exception as e:
        logger.error(f"Failed to analyze audio: {str(e)}")
        return False
    
    # Clean up
    audio_processor.cleanup()
    
    return True

def main():
    parser = argparse.ArgumentParser(description='Test PersLM modality processors')
    parser.add_argument('--test', choices=['all', 'image', 'audio'], default='all', help='Test to run')
    parser.add_argument('--json', action='store_true', help='Output results as JSON')
    
    args = parser.parse_args()
    
    results = {}
    
    if args.test in ['all', 'image']:
        logger.info("=== Testing Image Processor ===")
        results['image_processor'] = test_image_processor()
    
    if args.test in ['all', 'audio']:
        logger.info("=== Testing Audio Processor ===")
        results['audio_processor'] = test_audio_processor()
    
    # Output results
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        logger.info("Test results:")
        for test_name, success in results.items():
            logger.info(f"  {test_name}: {'SUCCESS' if success else 'FAILED'}")
    
    # Overall success
    all_success = all(results.values())
    if all_success:
        logger.info("All tests passed successfully!")
        return 0
    else:
        logger.error("Some tests failed. See details above.")
        return 1

if __name__ == '__main__':
    sys.exit(main()) 