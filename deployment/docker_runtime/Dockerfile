FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    TRANSFORMERS_CACHE=/app/cache \
    HF_HOME=/app/cache

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    git \
    curl \
    wget \
    ca-certificates \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Create app directories
WORKDIR /app
RUN mkdir -p /app/cache /app/models /app/data

# Install Python dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir -r requirements.txt

# Install accelerated inference libraries
RUN pip3 install --no-cache-dir \
    torch>=2.0.0 \
    vllm \
    bitsandbytes \
    accelerate

# Install PersLM package
COPY . /app/
RUN pip3 install -e /app

# Expose ports
EXPOSE 5000

# Set default command
ENTRYPOINT ["python3", "-m", "perslm.serve.api"]
CMD ["--model", "mistralai/Mistral-7B-Instruct-v0.2", "--port", "5000", "--quantization", "4bit"] 