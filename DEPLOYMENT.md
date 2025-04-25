# PersLM Deployment Guide

This document provides comprehensive instructions for deploying PersLM in various environments, from local development to production.

## Table of Contents

- [System Requirements](#system-requirements)
- [Quick Start](#quick-start)
- [Deployment Options](#deployment-options)
  - [Local Deployment](#local-deployment)
  - [Docker Deployment](#docker-deployment)
  - [Cloud Deployment](#cloud-deployment)
- [Optimization](#optimization)
  - [Model Quantization](#model-quantization)
  - [Model Pruning](#model-pruning)
  - [Inference Acceleration](#inference-acceleration)
  - [Response Caching](#response-caching)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements (CPU-only)

- **OS**: Linux, macOS, or Windows 10+
- **CPU**: 4+ cores
- **RAM**: 16GB+
- **Storage**: 20GB+ free space
- **Python**: 3.10+

### Recommended Requirements (GPU)

- **OS**: Linux (Ubuntu 20.04+) or Windows 10+ with WSL2
- **GPU**: NVIDIA with 8GB+ VRAM (RTX series recommended)
- **CUDA**: 11.8+
- **RAM**: 32GB+
- **Storage**: 50GB+ SSD
- **Python**: 3.10+

## Quick Start

For a quick local deployment:

```bash
# Clone the repository
git clone https://github.com/yourusername/PersLM.git
cd PersLM

# Create and activate conda environment
conda env create -f environment.yml
conda activate perslm

# Install additional optimization packages
pip install bitsandbytes accelerate vllm

# Run the optimization script to set up a quantized model
python -m deployment.optimize_inference convert --model mistralai/Mistral-7B-Instruct-v0.2 --quantization q4_k_m

# Start the API server
python -m src.serve.api --model models/gguf/Mistral-7B-Instruct-v0.2-q4_k_m.gguf --quantization 4bit --port 5000
```

## Deployment Options

### Local Deployment

For local deployment without containers:

1. **Install dependencies**:
   ```bash
   # Create conda environment
   conda env create -f environment.yml
   conda activate perslm
   
   # Install optimization packages (optional)
   pip install bitsandbytes accelerate
   ```

2. **Choose deployment method**:
   
   **A. Command-line interface**:
   ```bash
   # Run with basic CLI
   python -m src.cli --model mistralai/Mistral-7B-Instruct-v0.2
   ```
   
   **B. Web API server**:
   ```bash
   # Run API server
   python -m src.serve.api --model mistralai/Mistral-7B-Instruct-v0.2 --port 5000
   ```
   
   **C. Interactive shell**:
   ```bash
   # Run interactive shell
   python -m src.shell --model mistralai/Mistral-7B-Instruct-v0.2
   ```

### Docker Deployment

For containerized deployment:

1. **Build the Docker image**:
   ```bash
   # Build GPU-enabled image
   docker build -t perslm -f deployment/docker_runtime/Dockerfile .
   
   # Or build CPU-only image
   docker build -t perslm-cpu -f deployment/docker_runtime/Dockerfile.cpu .
   ```

2. **Run with Docker**:
   ```bash
   # Run with GPU
   docker run -it --gpus all -p 5000:5000 -v $(pwd)/models:/app/models -v $(pwd)/data:/app/data perslm
   
   # Run with CPU only
   docker run -it -p 5000:5000 -v $(pwd)/models:/app/models -v $(pwd)/data:/app/data perslm-cpu
   ```

3. **Run with Docker Compose**:
   ```bash
   # Start using docker-compose
   cd deployment/docker_runtime
   docker-compose up -d
   
   # Start with monitoring (Prometheus + Grafana)
   docker-compose --profile monitoring up -d
   ```

### Cloud Deployment

#### AWS Deployment

For deployment on AWS:

1. **EC2 Instance**:
   - Launch an EC2 instance with GPU support (g4dn or g5 recommended)
   - Use the Deep Learning AMI for easy CUDA setup
   - Configure security groups to allow port 5000

2. **Deployment**:
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/PersLM.git
   cd PersLM
   
   # Run using Docker
   docker-compose -f deployment/docker_runtime/docker-compose.yml up -d
   ```

3. **Using with AWS ECS**:
   - Create an ECS cluster with GPU-enabled instances
   - Use the provided Dockerfile as the base for your task definition
   - Map port 5000 and set environment variables

#### Google Cloud Deployment

For deployment on Google Cloud:

1. **Create a VM instance**:
   - Use a GPU-enabled instance (T4 or A100)
   - Select a Deep Learning VM image

2. **Deployment**:
   ```bash
   # Clone the repository
   git clone https://github.com/yourusername/PersLM.git
   cd PersLM
   
   # Run using Docker
   docker-compose -f deployment/docker_runtime/docker-compose.yml up -d
   ```

3. **Using with GKE**:
   - Create a GKE cluster with GPU nodes
   - Apply Kubernetes configurations (examples in `deployment/k8s/`)

## Optimization

### Model Quantization

PersLM supports multiple quantization methods for reduced memory usage:

1. **4-bit Quantization**:
   ```bash
   # Quantize model using bitsandbytes
   python -m deployment.optimize_inference optimize --model mistralai/Mistral-7B-Instruct-v0.2 --quantization 4bit
   ```

2. **8-bit Quantization**:
   ```bash
   # Quantize model using bitsandbytes
   python -m deployment.optimize_inference optimize --model mistralai/Mistral-7B-Instruct-v0.2 --quantization 8bit
   ```

3. **GGUF Conversion**:
   ```bash
   # Convert to GGUF format
   python -m deployment.optimize_inference convert --model mistralai/Mistral-7B-Instruct-v0.2 --quantization q4_k_m
   ```

4. **Memory Estimation**:
   ```bash
   # Estimate memory requirements
   python -m deployment.optimize_inference memory --model-size 7 --bits 4
   ```

### Model Pruning

PersLM supports multiple model pruning strategies to reduce size and improve efficiency:

1. **Attention Head Pruning**:
   ```bash
   # Prune 10% of attention heads
   python -m deployment.optimize_inference prune --model mistralai/Mistral-7B-Instruct-v0.2 --method heads --head-reduction 0.1 --evaluate
   ```

2. **Layer Pruning**:
   ```bash
   # Prune 20% of model layers
   python -m deployment.optimize_inference prune --model mistralai/Mistral-7B-Instruct-v0.2 --method layers --layer-reduction 0.2 --evaluate
   ```
   
3. **Magnitude-Based Pruning**:
   ```bash
   # Create a 30% sparse model
   python -m deployment.optimize_inference prune --model mistralai/Mistral-7B-Instruct-v0.2 --method magnitude --sparsity 0.3 --evaluate
   ```

4. **Distillation-Guided Pruning**:
   ```bash
   # Prune with knowledge distillation
   python -m deployment.optimize_inference prune --model mistralai/Mistral-7B-Instruct-v0.2 --method distillation --sparsity 0.3 --training-data my_dataset.jsonl --distill-epochs 3 --evaluate
   ```

5. **Combined Pruning**:
   ```bash
   # Apply all pruning methods in sequence
   python -m deployment.optimize_inference prune --model mistralai/Mistral-7B-Instruct-v0.2 --method all --head-reduction 0.1 --layer-reduction 0.15 --sparsity 0.2 --training-data my_dataset.jsonl --evaluate
   ```

For comprehensive documentation of pruning options, see [deployment/README_PRUNING.md](./deployment/README_PRUNING.md).

### Inference Acceleration

Several methods are available for inference acceleration:

1. **vLLM**:
   ```bash
   # Install vLLM
   pip install vllm
   
   # Run with vLLM acceleration
   python -m src.serve.api --model mistralai/Mistral-7B-Instruct-v0.2 --use-vllm --port 5000
   ```

2. **GGML/GGUF**:
   ```bash
   # Run with GGUF model
   python -m src.serve.api --model models/gguf/Mistral-7B-Instruct-v0.2-q4_k_m.gguf --port 5000
   ```

3. **Batch Processing**:
   - The optimization module includes batch processing capabilities for handling multiple requests efficiently
   - See `OptimizedInference.batch_generate()` method

### Response Caching

To enable response caching for better performance:

```bash
# Enable caching
python -m src.serve.api --model mistralai/Mistral-7B-Instruct-v0.2 --enable-cache --cache-dir cache/responses
```

## Monitoring

PersLM includes comprehensive monitoring capabilities:

1. **Prometheus Metrics**:
   - Available at `/metrics` endpoint
   - Includes request counts, latency, token usage, and system metrics

2. **Grafana Dashboard**:
   - Available when using the Docker Compose monitoring profile
   - Access at http://localhost:3000 (default admin/admin)

3. **Logging**:
   - Set log level with `--log-level` (debug, info, warning, error)
   - Logs to standard output by default

## Troubleshooting

### Common Issues

1. **Out of Memory Errors**:
   - Use a more aggressive quantization method (4-bit)
   - Reduce batch size
   - Reduce maximum context length

2. **CUDA Errors**:
   - Ensure CUDA and PyTorch versions are compatible
   - Update GPU drivers
   - Try using CPU-only version if persistent

3. **Slow Inference**:
   - Enable vLLM or use GGUF format
   - Implement response caching
   - Use a smaller model or more aggressive quantization

### Getting Help

- Report issues on GitHub
- Join the community Discord server
- Check the FAQ in the documentation 