# PersLM Embedded & Mobile Deployment Guide

This document provides instructions for deploying PersLM on embedded systems, edge devices, and mobile platforms.

## Table of Contents

- [Overview](#overview)
- [Embedded Deployment](#embedded-deployment)
- [Mobile Integration](#mobile-integration)
- [Raspberry Pi Deployment](#raspberry-pi-deployment)
- [ARM64 Devices](#arm64-devices)
- [Optimizations](#optimizations)
- [Hardware Requirements](#hardware-requirements)
- [Offline Operation](#offline-operation)
- [IoT Integration](#iot-integration)
- [Troubleshooting](#troubleshooting)

## Overview

PersLM supports deployment on resource-constrained devices with optimizations for:

- Lower memory usage
- Reduced CPU requirements
- Offline operation
- Power efficiency
- Lighter-weight models
- Headless operation

The embedded deployment focuses on maintaining core functionality while reducing resource requirements, making PersLM accessible on a wide range of devices beyond traditional desktops.

## Embedded Deployment

### Using the Embedded Launcher

The embedded launcher is a specialized entry point designed for resource-constrained environments:

```bash
python app/embedded/embedded_launcher.py
```

This launcher automatically applies optimizations like:
- Using smaller models
- Limiting concurrent tasks
- Reducing memory footprint
- Disabling resource-intensive features

### Configuration

Embedded-specific configuration options:

```yaml
# Embedded mode configuration
embedded:
  # Memory settings
  memory_limit: 512  # MB
  low_power_mode: true
  
  # Model settings
  model_size: "tiny"  # Use smaller models
  quantization: "int8"  # Quantize models to int8
  
  # Operation settings
  max_concurrent_tasks: 1
  offload_to_disk: true
  
  # IoT integration
  iot_sensors_enabled: false
  mqtt_enabled: false
  mqtt_broker: "localhost"
  mqtt_port: 1883
```

## Mobile Integration

While PersLM doesn't currently offer native mobile apps, there are several ways to integrate with mobile devices:

### REST API Integration

The web server component can be used to build mobile apps that interact with PersLM:

1. Run the web server on a local network:
   ```bash
   python app/web/api_server.py --host=0.0.0.0 --port=8000
   ```

2. Connect from mobile apps using the REST API endpoints

### Progressive Web App (PWA)

The web interface can be wrapped as a Progressive Web App:

1. Deploy the web interface
2. Add PWA manifest and service workers
3. Install to mobile home screen

### React Native / Flutter

For custom mobile applications:

1. Build a native mobile UI using React Native or Flutter
2. Connect to PersLM via the REST API
3. Implement native speech recognition for voice interface

## Raspberry Pi Deployment

PersLM runs well on Raspberry Pi models 3B+ and newer. Here's how to set it up:

### Installation

1. Set up Raspberry Pi OS (64-bit recommended):
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. Install dependencies:
   ```bash
   sudo apt install -y python3-pip python3-dev libatlas-base-dev ffmpeg portaudio19-dev
   ```

3. Clone PersLM repository:
   ```bash
   git clone https://github.com/yourusername/PersLM.git
   cd PersLM
   ```

4. Install Python requirements:
   ```bash
   pip3 install -r requirements-embedded.txt
   ```

5. Run using the embedded launcher:
   ```bash
   python3 app/embedded/embedded_launcher.py
   ```

### Auto-start on Boot

To run PersLM at system startup:

1. Create a systemd service:
   ```bash
   sudo nano /etc/systemd/system/perslm.service
   ```

2. Add the following content:
   ```
   [Unit]
   Description=PersLM Assistant
   After=network.target
   
   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi/PersLM
   ExecStart=/usr/bin/python3 app/embedded/embedded_launcher.py --headless
   Restart=on-failure
   
   [Install]
   WantedBy=multi-user.target
   ```

3. Enable and start the service:
   ```bash
   sudo systemctl enable perslm.service
   sudo systemctl start perslm.service
   ```

### GPIO Integration

PersLM can be integrated with Raspberry Pi GPIO:

1. Install RPi.GPIO:
   ```bash
   pip3 install RPi.GPIO
   ```

2. Create a GPIO integration script (examples provided in `app/embedded/integrations/`)

## ARM64 Devices

### Supported Platforms

PersLM can run on various ARM64 devices:
- Raspberry Pi (3/4/5)
- NVIDIA Jetson
- AWS Graviton
- Apple Silicon Macs
- Various ARM SBCs (Single Board Computers)

### Docker Deployment

A Docker-based deployment is recommended for compatibility:

1. Build the ARM64 Docker image:
   ```bash
   docker build -t perslm-arm64 -f Dockerfile.arm64 .
   ```

2. Run the container:
   ```bash
   docker run -d --name perslm --restart unless-stopped \
     -p 8000:8000 \
     -v perslm-data:/app/data \
     perslm-arm64
   ```

## Optimizations

### Model Quantization

Reduce memory usage with quantization:

```bash
# Run with 8-bit quantization (recommended for embedded)
python app/embedded/embedded_launcher.py --quantization int8

# Run with 4-bit quantization (extreme compression)
python app/embedded/embedded_launcher.py --quantization int4
```

### Offline Models

For fully offline operation:

1. Download optimized models:
   ```bash
   python scripts/download_embedded_models.py
   ```

2. Enable offline mode:
   ```bash
   python app/embedded/embedded_launcher.py --offline
   ```

### CPU Optimizations

Optimize CPU usage:

1. Limit threads:
   ```bash
   python app/embedded/embedded_launcher.py --threads 2
   ```

2. Enable low-power mode:
   ```bash
   python app/embedded/embedded_launcher.py --low-power
   ```

## Hardware Requirements

### Minimum Requirements

- **CPU**: ARM Cortex-A53 (or equivalent) @ 1.2GHz+
- **RAM**: 2GB+
- **Storage**: 4GB+ available space
- **OS**: Linux-based OS, Raspberry Pi OS, or Android

### Recommended Requirements

- **CPU**: ARM Cortex-A72 (or equivalent) @ 1.8GHz+
- **RAM**: 4GB+
- **Storage**: 8GB+ available space
- **Optional**: Microphone and speakers for voice interaction

## Offline Operation

PersLM can operate fully offline on embedded devices:

### Offline Models

1. Download compact models:
   ```bash
   python scripts/download_embedded_models.py
   ```

2. Specify offline mode:
   ```bash
   python app/embedded/embedded_launcher.py --offline
   ```

### Offline Speech Recognition

For offline voice interaction:

1. Use smaller Whisper models:
   ```bash
   python app/embedded/embedded_launcher.py --speech-model tiny
   ```

2. Use alternative offline TTS options:
   ```bash
   python app/embedded/embedded_launcher.py --tts-backend pyttsx3
   ```

## IoT Integration

PersLM can integrate with IoT devices and protocols:

### MQTT Integration

```bash
# Start with MQTT support
python app/embedded/embedded_launcher.py --mqtt-broker mqtt.example.com
```

### Example: Smart Home Integration

1. Configure PersLM to listen to smart home topics:
   ```yaml
   iot:
     mqtt:
       enabled: true
       broker: "homeassistant.local"
       port: 1883
       topics:
         - "home/sensors/#"
         - "home/commands/perslm"
       publish_topic: "home/assistants/perslm"
   ```

2. Trigger actions based on sensor data or commands

## Troubleshooting

### Common Issues

1. **High memory usage**:
   - Use `--low-memory` flag
   - Reduce model size with `--model-size tiny`
   - Enable quantization with `--quantization int8`

2. **Slow performance**:
   - Check CPU temperature (may be throttling)
   - Disable unnecessary features with `--minimal`
   - Reduce concurrent task limit with `--max-tasks 1`

3. **Crashes on startup**:
   - Check system memory with `free -h`
   - Ensure dependencies are installed correctly
   - Check logs with `--log-level debug`

4. **Network connectivity issues**:
   - Use `--offline` mode
   - Check network configuration
   - Verify firewall settings

### Logs

Logs are stored in the `logs/` directory:
- `embedded_app.log`: Main application log
- `error.log`: Error messages
- `performance.log`: Performance metrics

Enable debug logging for more information:
```bash
python app/embedded/embedded_launcher.py --log-level debug
``` 