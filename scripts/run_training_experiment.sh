#!/bin/bash
set -e

# Create necessary directories
mkdir -p checkpoints
mkdir -p data/memory

# Print system info
echo "=== System Information ==="
echo "GPU Info:"
nvidia-smi || echo "No NVIDIA GPU detected"

# First, check if the sample data is prepared
if [ ! -f "data/sample/train.jsonl" ]; then
    echo "Sample data not found. Preparing sample data..."
    bash scripts/setup_sample_data.sh
fi

# Run a small training experiment
echo "=== Starting Training Experiment ==="
python src/train.py \
  --config configs/model_config.yaml \
  --output_dir checkpoints \
  --train_file data/sample/train.jsonl \
  --eval_file data/sample/eval.jsonl \
  --max_samples 500 \
  --num_epochs 1 \
  --batch_size 2 \
  --logging_steps 5 \
  --eval_steps 20 \
  --save_steps 50 \
  --enable_memory \
  --memory_dir data/memory

echo "Training experiment completed."
echo "Check the 'checkpoints' directory for model outputs." 