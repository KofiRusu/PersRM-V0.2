#!/bin/bash
set -e

# Create data directory if it doesn't exist
mkdir -p data

# Download and prepare a sample dataset using HuggingFace datasets
# For initial testing, we'll use a small subset of the OpenOrca dataset
echo "Setting up sample dataset from OpenOrca for initial training..."

# Process the dataset using prepare_data.py
python scripts/prepare_data.py \
  --output_dir data/sample \
  --hf_dataset "Open-Orca/OpenOrca" \
  --hf_split "train" \
  --hf_text_field "question" \
  --max_samples 1000 \
  --min_length 50 \
  --max_length 2048 \
  --train_ratio 0.9 \
  --seed 42

echo "Sample dataset setup complete. Data saved to data/sample/" 