# Model Pruning in PersLM

This document provides information on the model pruning features available in the PersLM framework, which enable running models on resource-constrained devices.

## Overview

Model pruning reduces the size and computational requirements of language models while maintaining as much of their performance as possible. The PersLM framework offers multiple pruning strategies that can be used individually or in combination:

1. **Attention Head Pruning** - Removes less important attention heads
2. **Layer Pruning** - Removes transformer layers uniformly across the network
3. **Magnitude-based Pruning** - Creates sparse weight matrices by zeroing out smaller weights
4. **Distillation-guided Pruning** - Uses knowledge distillation to retain more capabilities

## Usage

The pruning functionality is accessible through the command line interface:

```bash
python -m deployment.optimize_inference prune --model MODEL_PATH [options]
```

### Common Arguments

- `--model MODEL_PATH`: Path to model or HuggingFace model ID (required)
- `--output-dir DIR`: Output directory for pruned models (default: "models/pruned")
- `--method {heads,layers,magnitude,distillation,all}`: Pruning method to use (required)
- `--evaluate`: Evaluate model quality after pruning
- `--device {auto,cpu,cuda}`: Device to use (default: "auto")

### Method-specific Arguments

#### Head Pruning

```bash
python -m deployment.optimize_inference prune --model MODEL_PATH --method heads --head-reduction 0.1
```

- `--head-reduction FLOAT`: Fraction of attention heads to prune (0-1, default: 0.1)

#### Layer Pruning

```bash
python -m deployment.optimize_inference prune --model MODEL_PATH --method layers --layer-reduction 0.1
```

- `--layer-reduction FLOAT`: Fraction of layers to prune (0-1, default: 0.1)

#### Magnitude Pruning

```bash
python -m deployment.optimize_inference prune --model MODEL_PATH --method magnitude --sparsity 0.3
```

- `--sparsity FLOAT`: Target sparsity level (0-1, default: 0.3)

#### Distillation-guided Pruning

```bash
python -m deployment.optimize_inference prune --model MODEL_PATH --method distillation --sparsity 0.3 --training-data DATA_PATH
```

- `--sparsity FLOAT`: Target pruning ratio (0-1, default: 0.3)
- `--teacher-model PATH`: Teacher model path (optional, uses a copy of the original model if not specified)
- `--training-data PATH`: Path to training data (required)
- `--distill-epochs INT`: Number of distillation epochs (default: 3)
- `--learning-rate FLOAT`: Learning rate for distillation (default: 5e-5)

#### Combining Methods

To apply all pruning methods in sequence:

```bash
python -m deployment.optimize_inference prune --model MODEL_PATH --method all --head-reduction 0.1 --layer-reduction 0.1 --sparsity 0.3 --training-data DATA_PATH
```

## Example Usage Scenarios

### Minimal Pruning for Slight Resource Reduction

```bash
python -m deployment.optimize_inference prune --model meta-llama/Llama-2-7b-hf --method magnitude --sparsity 0.2 --evaluate
```

### Mobile-friendly Model

```bash
python -m deployment.optimize_inference prune --model meta-llama/Llama-2-7b-hf --method all --head-reduction 0.15 --layer-reduction 0.25 --sparsity 0.5 --training-data your_dataset.jsonl --evaluate
```

### Classroom Demonstration Model

```bash
python -m deployment.optimize_inference prune --model mistralai/Mistral-7B-v0.1 --method distillation --sparsity 0.4 --training-data educational_content.txt --distill-epochs 5 --evaluate
```

## Performance Impact

Pruning always involves a trade-off between model size/speed and model capabilities. The general impact of each method:

| Method | Size Reduction | Speed Improvement | Quality Impact |
|--------|----------------|-------------------|---------------|
| Head Pruning | 5-15% | 5-15% | Low to Medium |
| Layer Pruning | 10-50% | 10-50% | Medium to High |
| Magnitude Pruning | 10-70% | 5-20% | Low to High (depends on %) |
| Distillation | 20-60% | 20-60% | Medium (better than others) |

## Integration with Other Optimizations

Pruning can be combined with other optimization techniques in PersLM:

1. **Quantization**: Apply pruning first, then quantize the model
   ```bash
   # First prune
   python -m deployment.optimize_inference prune --model MODEL_PATH --method magnitude --sparsity 0.3
   
   # Then quantize
   python -m deployment.optimize_inference optimize --model models/pruned/MODEL_NAME-magnitude_pruned --quantization 4bit
   ```

2. **GGUF Conversion**: Convert pruned models to GGUF format for use with llama.cpp
   ```bash
   python -m deployment.optimize_inference convert --model models/pruned/MODEL_NAME-distill_pruned --quantization q4_k_m
   ```

## Advanced Usage

### Custom Pruning Workflows

For more advanced use cases, you can use the `ModelPruner` class directly in your Python code:

```python
from deployment.optimize_inference import ModelPruner

pruner = ModelPruner(model_path="your/model/path", output_dir="output")

# Apply custom pruning workflow
pruner.prune_heads(head_reduction=0.15, save_model=False)
pruner.prune_layers(layer_reduction=0.2, save_model=False)

# Evaluate intermediate result
metrics1 = pruner.evaluate_pruned_model()
print(f"After structural pruning: {metrics1}")

# Continue with magnitude pruning
pruner.magnitude_pruning(sparsity=0.3, save_model=True)

# Final evaluation
metrics2 = pruner.evaluate_pruned_model()
print(f"Final model: {metrics2}")
```

## How Pruning Works

### Attention Head Pruning

Identifies attention heads that contribute least to model performance based on weight magnitude and removes them from the model.

### Layer Pruning

Removes entire transformer layers uniformly across the network, adjusting the layer indexing to maintain a functional model.

### Magnitude-based Pruning

Applies L1-unstructured pruning to model weights, zeroing out weights with the smallest magnitudes to create a sparse matrix.

### Distillation-guided Pruning

Combines pruning with knowledge distillation, where a teacher model (the original or another specified model) guides the learning of the pruned student model to retain more of the original capabilities.

## Limitations

- Pruning may impact model capabilities unevenly across different tasks
- Extreme pruning (>70%) may lead to significant quality degradation
- Distillation requires training data and computation time
- Some model architectures may be more resilient to pruning than others

## Further Resources

- See the broader optimization capabilities in the [deployment/optimize_inference.py](./optimize_inference.py) file
- For quantization options, see `python -m deployment.optimize_inference optimize --help`
- For memory usage estimation, see `python -m deployment.optimize_inference memory --help`
