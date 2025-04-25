FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PATH="/opt/conda/bin:${PATH}"

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Miniconda
RUN wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda.sh && \
    bash ~/miniconda.sh -b -p /opt/conda && \
    rm ~/miniconda.sh

# Copy environment file
COPY environment.yml /tmp/environment.yml

# Create conda environment
RUN conda env create -f /tmp/environment.yml

# Set working directory
WORKDIR /workspace

# Activate conda environment in shell
SHELL ["conda", "run", "-n", "perslm", "/bin/bash", "-c"]

# Default command
CMD ["/bin/bash"] 