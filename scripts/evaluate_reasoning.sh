#!/bin/bash
set -e

# Create necessary directories
mkdir -p evaluation/reasoning

# Select the benchmark dataset
BENCHMARK="gsm8k"  # Options: gsm8k, hotpotqa
SAMPLES=100

echo "=== Evaluating Reasoning on $BENCHMARK ==="

# Run evaluation with all reasoning modes
python src/train.py \
  --config configs/model_config.yaml \
  --output_dir evaluation/reasoning \
  --model_path checkpoints/final_model \
  --enable_memory \
  --memory_dir data/memory \
  --enable_reasoning \
  --reasoning_benchmark $BENCHMARK \
  --max_reasoning_samples $SAMPLES \
  --save_evaluation_results \
  --save_traces \
  --eval_reasoning \
  --eval_only

echo "=== Reasoning Evaluation Complete ==="
echo "Results saved to evaluation/reasoning/reasoning_eval.json"

# Optional: Generate some example reasoning traces
echo "=== Generating Example Reasoning Traces ==="
SAMPLE_QUERY="If a train travels at 120 kilometers per hour, how far will it travel in 2.5 hours?"

# Chain of thought reasoning
python -c "
import sys
import os
import torch
import yaml
sys.path.append('.')
from src.reasoning import ReasoningManager, ReasoningMode
from transformers import AutoModelForCausalLM, AutoTokenizer

# Load model and tokenizer
model_path = 'checkpoints/final_model'
model = AutoModelForCausalLM.from_pretrained(model_path, torch_dtype=torch.float16)
tokenizer = AutoTokenizer.from_pretrained(model_path)

# Setup text generation function
def generate_text(prompt):
    inputs = tokenizer(prompt, return_tensors='pt')
    with torch.no_grad():
        outputs = model.generate(
            inputs.input_ids, 
            max_length=2048, 
            temperature=0.7, 
            top_p=0.9, 
            do_sample=True,
            pad_token_id=tokenizer.pad_token_id
        )
    return tokenizer.decode(outputs[0], skip_special_tokens=True)

# Initialize reasoning manager
manager = ReasoningManager(model_provider=generate_text)

# Register reasoners
from src.reasoning.chain_of_thought import ChainOfThoughtReasoner
from src.reasoning.self_reflection import SelfReflectionReasoner
from src.reasoning.task_decomposition import TaskDecomposer
from src.reasoning.planning import Planner

manager.register_reasoner(ReasoningMode.CHAIN_OF_THOUGHT, ChainOfThoughtReasoner())
manager.register_reasoner(ReasoningMode.SELF_REFLECTION, SelfReflectionReasoner())
manager.register_reasoner(ReasoningMode.TASK_DECOMPOSITION, TaskDecomposer())
manager.register_reasoner(ReasoningMode.PLANNING, Planner())

# Run reasoning with each mode
query = '$SAMPLE_QUERY'
print(f'\\nQuery: {query}\\n')

for mode in [ReasoningMode.CHAIN_OF_THOUGHT, ReasoningMode.SELF_REFLECTION, ReasoningMode.TASK_DECOMPOSITION, ReasoningMode.PLANNING]:
    print(f'\\n===== {mode.value} =====\\n')
    result = manager.reason(query=query, mode=mode)
    if result['success']:
        print(result['trace'].get_full_trace())
        print(f'Answer: {result[\"result\"].get(\"answer\", \"\")}')
    else:
        print(f'Error: {result.get(\"error\", \"Unknown error\")}')
    print('\\n' + '='*50 + '\\n')
"

echo "=== Reasoning Examples Complete ===" 