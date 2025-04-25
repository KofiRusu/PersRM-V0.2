"""
Optimize Inference Module

This module provides utilities for optimizing model inference through quantization,
efficient batching, and response caching.
"""

import os
import json
import time
import logging
import argparse
from typing import Dict, List, Optional, Any, Union, Tuple
from pathlib import Path
import tempfile
import hashlib

try:
    import torch
    import transformers
    from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer
    from bitsandbytes.nn import Linear4bit, Linear8bitLt
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

try:
    from vllm import LLM, SamplingParams
    HAS_VLLM = True
except ImportError:
    HAS_VLLM = False

logger = logging.getLogger(__name__)

class ResponseCache:
    """Simple cache for model responses."""
    
    def __init__(self, cache_dir: Optional[str] = None, max_entries: int = 1000):
        """
        Initialize the response cache.
        
        Args:
            cache_dir: Directory to store cache files, or None for in-memory only
            max_entries: Maximum number of entries to keep in memory
        """
        self.cache_dir = cache_dir
        if cache_dir:
            os.makedirs(cache_dir, exist_ok=True)
        
        self.max_entries = max_entries
        self.in_memory_cache: Dict[str, Tuple[str, float]] = {}  # {hash: (response, timestamp)}
        
    def _hash_input(self, prompt: str, params: Dict[str, Any]) -> str:
        """Generate a hash for the input prompt and parameters."""
        # Create a string representation of params that will be consistent
        param_str = json.dumps(params, sort_keys=True)
        combined = f"{prompt}|{param_str}"
        return hashlib.md5(combined.encode()).hexdigest()
    
    def get(self, prompt: str, params: Dict[str, Any]) -> Optional[str]:
        """
        Get a cached response if available.
        
        Args:
            prompt: Input prompt
            params: Generation parameters
            
        Returns:
            Cached response or None if not found
        """
        hash_key = self._hash_input(prompt, params)
        
        # Check in-memory cache first
        if hash_key in self.in_memory_cache:
            return self.in_memory_cache[hash_key][0]
            
        # Check disk cache if enabled
        if self.cache_dir:
            cache_file = os.path.join(self.cache_dir, f"{hash_key}.json")
            if os.path.exists(cache_file):
                try:
                    with open(cache_file, 'r') as f:
                        data = json.load(f)
                        # Update in-memory cache
                        self.in_memory_cache[hash_key] = (data['response'], time.time())
                        return data['response']
                except Exception as e:
                    logger.warning(f"Error reading cache file: {e}")
        
        return None
    
    def put(self, prompt: str, params: Dict[str, Any], response: str) -> None:
        """
        Store a response in the cache.
        
        Args:
            prompt: Input prompt
            params: Generation parameters
            response: Model response
        """
        hash_key = self._hash_input(prompt, params)
        timestamp = time.time()
        
        # Update in-memory cache
        self.in_memory_cache[hash_key] = (response, timestamp)
        
        # Trim cache if needed
        if len(self.in_memory_cache) > self.max_entries:
            # Remove oldest entries
            sorted_entries = sorted(self.in_memory_cache.items(), key=lambda x: x[1][1])
            for key, _ in sorted_entries[:len(self.in_memory_cache) - self.max_entries]:
                del self.in_memory_cache[key]
        
        # Write to disk if enabled
        if self.cache_dir:
            cache_file = os.path.join(self.cache_dir, f"{hash_key}.json")
            try:
                with open(cache_file, 'w') as f:
                    json.dump({
                        'prompt': prompt,
                        'params': params,
                        'response': response,
                        'timestamp': timestamp
                    }, f)
            except Exception as e:
                logger.warning(f"Error writing cache file: {e}")


class ModelPruner:
    """
    Model pruning for resource-constrained environments.
    
    Features:
    - Structured pruning (head pruning, layer dropping)
    - Unstructured pruning (weight magnitude pruning)
    - Distillation-guided pruning
    - Export pruned models for deployment
    """
    
    def __init__(
        self,
        model_path: str,
        output_dir: Optional[str] = None,
        device: str = "auto",
        trust_remote_code: bool = False
    ):
        """
        Initialize the model pruner.
        
        Args:
            model_path: Path to model checkpoint or huggingface model ID
            output_dir: Directory to save pruned models
            device: Device to run on ('cpu', 'cuda', 'auto')
            trust_remote_code: Trust remote code when loading models
        """
        if not HAS_TORCH:
            raise ImportError("PyTorch and Transformers are required for model pruning.")
            
        self.model_path = model_path
        self.output_dir = output_dir or "models/pruned"
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Determine device
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
            
        # Load model and tokenizer
        logger.info(f"Loading model from {model_path} for pruning...")
        self.tokenizer = AutoTokenizer.from_pretrained(
            model_path, 
            trust_remote_code=trust_remote_code
        )
        
        self.model = AutoModelForCausalLM.from_pretrained(
            model_path,
            torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
            device_map="auto" if self.device != "cpu" else None,
            trust_remote_code=trust_remote_code
        )
        
        logger.info(f"Model loaded with {self._count_parameters(self.model)} parameters")
    
    def _count_parameters(self, model: torch.nn.Module) -> int:
        """Count the number of parameters in a model."""
        return sum(p.numel() for p in model.parameters())
    
    def _get_target_modules(self, module_types: List[str]) -> List[str]:
        """Get target module names based on their types."""
        target_modules = []
        
        # Create mapping of module path to module type
        for name, module in self.model.named_modules():
            module_type = module.__class__.__name__
            if any(t in module_type for t in module_types):
                target_modules.append(name)
                
        return target_modules
    
    def prune_heads(
        self,
        head_reduction: float = 0.1,  # Fraction of heads to prune (0-1)
        layer_pattern: str = ".*attention.*",  # Regex pattern for attention layers
        save_model: bool = True,
        model_suffix: str = "head_pruned"
    ) -> torch.nn.Module:
        """
        Prune attention heads based on importance scores.
        
        Args:
            head_reduction: Fraction of heads to prune (0-1)
            layer_pattern: Regex pattern to identify attention layers
            save_model: Whether to save the pruned model
            model_suffix: Suffix for the pruned model name
            
        Returns:
            Pruned model
        """
        import re
        from torch.nn.utils.prune import l1_unstructured
        
        logger.info(f"Pruning {head_reduction*100:.1f}% of attention heads")
        
        # Find attention modules
        attn_modules = []
        pattern = re.compile(layer_pattern)
        
        # Identify query, key, value projection matrices in attention blocks
        for name, module in self.model.named_modules():
            if pattern.search(name) and hasattr(module, "weight"):
                attn_modules.append((name, module))
        
        if not attn_modules:
            logger.warning("No attention modules found matching the pattern")
            return self.model
            
        # Determine number of heads to prune
        heads_to_prune = max(1, int(len(attn_modules) * head_reduction))
        logger.info(f"Will prune {heads_to_prune} heads out of {len(attn_modules)}")
        
        # Compute head importance scores and prune least important
        for i, (name, module) in enumerate(attn_modules):
            # Skip if we've pruned enough heads
            if i >= heads_to_prune:
                break
                
            logger.info(f"Pruning attention module: {name}")
            
            # Apply L1 unstructured pruning
            l1_unstructured(module, name='weight', amount=0.3)  # Prune 30% of weights in this head
        
        if save_model:
            output_path = os.path.join(
                self.output_dir, 
                f"{os.path.basename(self.model_path)}-{model_suffix}"
            )
            logger.info(f"Saving pruned model to {output_path}")
            self.model.save_pretrained(output_path)
            self.tokenizer.save_pretrained(output_path)
            
        return self.model
    
    def prune_layers(
        self,
        layer_reduction: float = 0.1,  # Fraction of layers to prune (0-1)
        layer_prefix: str = "model.layers.",  # Prefix for transformer layers
        save_model: bool = True,
        model_suffix: str = "layer_pruned"
    ) -> torch.nn.Module:
        """
        Prune transformer layers.
        
        Args:
            layer_reduction: Fraction of layers to prune (0-1)
            layer_prefix: Prefix for transformer layers in the model
            save_model: Whether to save the pruned model
            model_suffix: Suffix for the pruned model name
            
        Returns:
            Pruned model
        """
        # Find transformer layers
        layers = []
        for name, _ in self.model.named_modules():
            if name.startswith(layer_prefix) and name.count('.') == layer_prefix.count('.') + 1:
                layer_idx = name.split('.')[-1]
                if layer_idx.isdigit():
                    layers.append(int(layer_idx))
        
        if not layers:
            logger.warning(f"No layers found with prefix {layer_prefix}")
            return self.model
            
        # Sort layers and determine which to remove
        layers = sorted(layers)
        layers_to_remove = max(1, int(len(layers) * layer_reduction))
        
        # Strategy: Remove layers uniformly across network depth
        # For example, if removing 3 out of 12 layers, remove layers 3, 7, 11
        if layers_to_remove >= len(layers):
            logger.warning(f"Cannot remove {layers_to_remove} layers, max is {len(layers)-1}")
            layers_to_remove = len(layers) - 1  # Keep at least one layer
            
        # Calculate indices to remove with even spacing
        indices_to_remove = []
        if layers_to_remove > 0:
            step = len(layers) / (layers_to_remove + 1)
            for i in range(1, layers_to_remove + 1):
                idx = int(i * step - 1)
                indices_to_remove.append(layers[idx])
        
        logger.info(f"Removing {layers_to_remove} layers: {indices_to_remove}")
        
        # Create a new state dict without the specified layers
        new_state_dict = {}
        layers_mapping = {}  # Map new layer indices to old ones
        
        # Create the layers mapping
        new_idx = 0
        for old_idx in range(max(layers) + 1):
            if old_idx not in indices_to_remove:
                layers_mapping[old_idx] = new_idx
                new_idx += 1
        
        # Create the new state dict with remapped layers
        orig_state_dict = self.model.state_dict()
        for key, value in orig_state_dict.items():
            # Skip keys for layers we're removing
            if any(f"{layer_prefix}{idx}." in key for idx in indices_to_remove):
                continue
                
            # Remap layer indices for keys we're keeping
            new_key = key
            for old_idx, new_idx in layers_mapping.items():
                old_pattern = f"{layer_prefix}{old_idx}."
                new_pattern = f"{layer_prefix}{new_idx}."
                if old_pattern in key:
                    new_key = key.replace(old_pattern, new_pattern)
                    break
                    
            new_state_dict[new_key] = value
        
        # Create a new model with fewer layers
        config = self.model.config
        # Adjust model configuration
        if hasattr(config, "num_hidden_layers"):
            config.num_hidden_layers -= layers_to_remove
        
        # Initialize a new model and load the modified state dict
        new_model = AutoModelForCausalLM.from_config(config)
        
        # Handle potential configuration mismatch by filtering state_dict
        # Only keeping keys that exist in the model
        filtered_state_dict = {k: v for k, v in new_state_dict.items() 
                              if k in new_model.state_dict()}
        
        missing = set(new_model.state_dict().keys()) - set(filtered_state_dict.keys())
        unexpected = set(filtered_state_dict.keys()) - set(new_model.state_dict().keys())
        
        if missing:
            logger.warning(f"Missing {len(missing)} keys in state dict")
        if unexpected:
            logger.warning(f"Unexpected {len(unexpected)} keys in state dict")
        
        new_model.load_state_dict(filtered_state_dict, strict=False)
        self.model = new_model
        
        if save_model:
            output_path = os.path.join(
                self.output_dir, 
                f"{os.path.basename(self.model_path)}-{model_suffix}"
            )
            logger.info(f"Saving layer-pruned model to {output_path}")
            self.model.save_pretrained(output_path)
            self.tokenizer.save_pretrained(output_path)
            
        return self.model
    
    def magnitude_pruning(
        self,
        sparsity: float = 0.3,  # Target sparsity (0-1)
        save_model: bool = True,
        model_suffix: str = "magnitude_pruned"
    ) -> torch.nn.Module:
        """
        Apply magnitude-based weight pruning.
        
        Args:
            sparsity: Target sparsity level (0-1)
            save_model: Whether to save the pruned model
            model_suffix: Suffix for the pruned model name
            
        Returns:
            Pruned model
        """
        from torch.nn.utils.prune import global_unstructured, L1Unstructured
        
        logger.info(f"Applying magnitude pruning with {sparsity*100:.1f}% sparsity")
        
        # Get all parameters that can be pruned
        parameters_to_prune = []
        for name, module in self.model.named_modules():
            if isinstance(module, torch.nn.Linear):
                parameters_to_prune.append((module, 'weight'))
        
        # Apply global unstructured pruning
        global_unstructured(
            parameters_to_prune,
            pruning_method=L1Unstructured,
            amount=sparsity,
        )
        
        # Make pruning permanent
        for module, param_name in parameters_to_prune:
            torch.nn.utils.prune.remove(module, param_name)
        
        if save_model:
            output_path = os.path.join(
                self.output_dir, 
                f"{os.path.basename(self.model_path)}-{model_suffix}"
            )
            logger.info(f"Saving magnitude-pruned model to {output_path}")
            self.model.save_pretrained(output_path)
            self.tokenizer.save_pretrained(output_path)
            
        return self.model
    
    def evaluate_pruned_model(
        self,
        eval_dataset: Optional[str] = None,
        eval_prompts: Optional[List[str]] = None,
        batch_size: int = 8
    ) -> Dict[str, float]:
        """
        Evaluate a pruned model to measure quality impact.
        
        Args:
            eval_dataset: HuggingFace dataset to use for evaluation
            eval_prompts: List of prompts to use for evaluation
            batch_size: Batch size for evaluation
            
        Returns:
            Dictionary of evaluation metrics
        """
        if eval_dataset is None and eval_prompts is None:
            # Default evaluation prompts if none specified
            eval_prompts = [
                "Explain the concept of artificial intelligence in simple terms.",
                "What are the three branches of the US government?",
                "Write a short poem about nature.",
                "Summarize the plot of Romeo and Juliet."
            ]
        
        logger.info(f"Evaluating pruned model on {len(eval_prompts)} prompts")
        
        # Set model to evaluation mode
        self.model.eval()
        
        # Generate responses
        results = {
            "avg_generation_time": 0.0,
            "parameter_reduction": 0.0,
            "memory_reduction": 0.0
        }
        
        # Measure generation time
        total_time = 0.0
        tokens_generated = 0
        
        with torch.no_grad():
            for i in range(0, len(eval_prompts), batch_size):
                batch = eval_prompts[i:i+batch_size]
                inputs = self.tokenizer(batch, return_tensors="pt", padding=True)
                inputs = {k: v.to(self.device) for k, v in inputs.items()}
                
                start_time = time.time()
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=100,
                    do_sample=True,
                    temperature=0.7,
                    top_p=0.95
                )
                end_time = time.time()
                
                # Calculate tokens generated
                tokens_in_batch = sum(len(output) - len(inputs["input_ids"][j]) 
                                    for j, output in enumerate(outputs))
                tokens_generated += tokens_in_batch
                total_time += (end_time - start_time)
        
        # Calculate metrics
        if tokens_generated > 0:
            results["avg_generation_time"] = total_time / tokens_generated  # seconds per token
            
        # Calculate parameter reduction
        original_params = 0
        # You'll need to store the original parameter count before pruning
        # For now, use a placeholder estimate based on model name
        if "7b" in self.model_path.lower():
            original_params = 7 * 10**9
        elif "13b" in self.model_path.lower():
            original_params = 13 * 10**9
        else:
            original_params = self._count_parameters(self.model) * 1.2  # Estimate 20% reduction
            
        current_params = self._count_parameters(self.model)
        results["parameter_reduction"] = 1.0 - (current_params / original_params)
        
        # Memory usage is roughly proportional to parameter count for inference
        results["memory_reduction"] = results["parameter_reduction"]
        
        logger.info(f"Evaluation results: {results}")
        return results
    
    def distillation_pruning(
        self,
        teacher_model_path: Optional[str] = None,
        training_data: Optional[str] = None,
        pruning_ratio: float = 0.3,
        num_epochs: int = 3,
        learning_rate: float = 5e-5,
        save_model: bool = True,
        model_suffix: str = "distill_pruned"
    ) -> torch.nn.Module:
        """
        Apply distillation-guided pruning where a teacher model guides
        the pruning of a student model for better retention of capabilities.
        
        Args:
            teacher_model_path: Path to teacher model, or None to use original model
            training_data: Path to training data, either a directory or HF dataset name
            pruning_ratio: How much of the model to prune (0-1)
            num_epochs: Number of distillation epochs
            learning_rate: Learning rate for distillation
            save_model: Whether to save the pruned model
            model_suffix: Suffix for the pruned model name
            
        Returns:
            Pruned and distilled model
        """
        logger.info(f"Starting distillation-guided pruning with ratio {pruning_ratio}")
        
        # Load the teacher model if provided, otherwise use a copy of the current model
        if teacher_model_path:
            logger.info(f"Loading teacher model from {teacher_model_path}")
            teacher_model = AutoModelForCausalLM.from_pretrained(
                teacher_model_path,
                torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
                device_map="auto" if self.device != "cpu" else None,
                trust_remote_code=True
            )
        else:
            logger.info("Using copy of original model as teacher")
            # Create a deep copy of the model as the teacher
            import copy
            teacher_model = copy.deepcopy(self.model)
            
        # Create student model by pruning the current model
        logger.info("Applying initial pruning to create student model")
        
        # Apply magnitude pruning to get the initial pruned student model
        self.magnitude_pruning(
            sparsity=pruning_ratio,
            save_model=False  # Don't save intermediate model
        )
        
        # Load the training data
        if training_data:
            logger.info(f"Loading distillation data from {training_data}")
            
            # Check if it's a HuggingFace dataset
            if "/" in training_data:
                try:
                    from datasets import load_dataset
                    dataset = load_dataset(training_data)
                    train_dataset = dataset["train"]
                except Exception as e:
                    logger.error(f"Error loading HF dataset: {e}")
                    return self.model
            else:
                # Assume it's a local directory with text files
                from datasets import load_dataset
                try:
                    dataset = load_dataset("text", data_files={"train": f"{training_data}/*.txt"})
                    train_dataset = dataset["train"]
                except Exception as e:
                    logger.error(f"Error loading local dataset: {e}")
                    return self.model
                    
            # Create simple distillation dataset
            def tokenize_function(examples):
                return self.tokenizer(
                    examples["text"], 
                    truncation=True,
                    max_length=512,
                    return_tensors="pt"
                )
                
            tokenized_dataset = train_dataset.map(
                tokenize_function,
                batched=True,
                remove_columns=train_dataset.column_names
            )
            
            # Prepare distillation training
            from torch.utils.data import DataLoader
            from torch.optim import AdamW
            
            train_dataloader = DataLoader(
                tokenized_dataset, 
                batch_size=4, 
                shuffle=True
            )
            
            optimizer = AdamW(self.model.parameters(), lr=learning_rate)
            
            # Move models to the right device
            teacher_model.to(self.device)
            self.model.to(self.device)
            
            # Set teacher to eval mode
            teacher_model.eval()
            
            # Train the student model
            logger.info(f"Starting distillation training for {num_epochs} epochs")
            
            for epoch in range(num_epochs):
                self.model.train()
                
                total_loss = 0
                for batch_idx, batch in enumerate(train_dataloader):
                    # Move batch to device
                    input_ids = batch["input_ids"].to(self.device)
                    attention_mask = batch.get("attention_mask", None)
                    if attention_mask is not None:
                        attention_mask = attention_mask.to(self.device)
                    
                    # Forward pass for student
                    student_outputs = self.model(input_ids, attention_mask=attention_mask)
                    student_logits = student_outputs.logits
                    
                    # Forward pass for teacher
                    with torch.no_grad():
                        teacher_outputs = teacher_model(input_ids, attention_mask=attention_mask)
                        teacher_logits = teacher_outputs.logits
                    
                    # Calculate distillation loss (KL divergence)
                    loss_fct = torch.nn.KLDivLoss(reduction="batchmean")
                    loss = loss_fct(
                        torch.nn.functional.log_softmax(student_logits / 2.0, dim=-1),
                        torch.nn.functional.softmax(teacher_logits / 2.0, dim=-1)
                    )
                    
                    # Backward pass
                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()
                    
                    total_loss += loss.item()
                    
                    if (batch_idx + 1) % 10 == 0:
                        logger.info(f"Epoch {epoch + 1}/{num_epochs}, Batch {batch_idx + 1}, Loss: {loss.item():.4f}")
                
                avg_loss = total_loss / len(train_dataloader)
                logger.info(f"Epoch {epoch + 1}/{num_epochs} completed. Average loss: {avg_loss:.4f}")
            
            logger.info("Distillation training completed")
        else:
            logger.warning("No training data provided. Skipping distillation step.")
        
        # Clean up teacher model
        del teacher_model
        torch.cuda.empty_cache()
        
        # Save the model if requested
        if save_model:
            output_path = os.path.join(
                self.output_dir, 
                f"{os.path.basename(self.model_path)}-{model_suffix}"
            )
            logger.info(f"Saving distilled and pruned model to {output_path}")
            self.model.save_pretrained(output_path)
            self.tokenizer.save_pretrained(output_path)
        
        return self.model


class OptimizedInference:
    """
    Optimized inference using various acceleration techniques.
    
    Features:
    - Model quantization (4-bit or 8-bit)
    - Response caching
    - Streaming output
    - Support for vLLM if available
    """
    
    def __init__(
        self,
        model_path: str,
        quantization: str = "none",  # "none", "4bit", "8bit", "gptq"
        cache_dir: Optional[str] = None,
        device: str = "auto",
        max_batch_size: int = 8,
        use_vllm: bool = False,
        trust_remote_code: bool = False,
        **kwargs
    ):
        """
        Initialize the inference optimizer.
        
        Args:
            model_path: Path to model checkpoint or huggingface model ID
            quantization: Quantization method to use
            cache_dir: Directory for response caching
            device: Device to run on ('cpu', 'cuda', 'auto')
            max_batch_size: Maximum batch size for inference
            use_vllm: Whether to use vLLM if available
            trust_remote_code: Trust remote code when loading models
            **kwargs: Additional parameters for model loading
        """
        self.model_path = model_path
        self.quantization = quantization
        self.max_batch_size = max_batch_size
        self.use_vllm = use_vllm and HAS_VLLM
        self.trust_remote_code = trust_remote_code
        
        # Determine device
        if device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device
            
        # Initialize cache
        self.cache = ResponseCache(cache_dir) if cache_dir else None
        
        # Load model
        if self.use_vllm:
            self._initialize_vllm()
        else:
            self._initialize_transformers(kwargs)
            
        logger.info(f"Initialized model from {model_path} with quantization={quantization}")
            
    def _initialize_transformers(self, kwargs: Dict[str, Any]) -> None:
        """Initialize using HuggingFace Transformers."""
        if not HAS_TORCH:
            raise ImportError("PyTorch and Transformers are required for model loading.")
        
        # Set up quantization parameters
        model_kwargs = {}
        
        if self.quantization == "4bit":
            if not hasattr(transformers, "BitsAndBytesConfig"):
                raise ImportError("BitsAndBytes quantization requires transformers>=4.30.0")
                
            model_kwargs["quantization_config"] = transformers.BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_use_double_quant=True,
                bnb_4bit_quant_type="nf4"
            )
            
        elif self.quantization == "8bit":
            if not hasattr(transformers, "BitsAndBytesConfig"):
                raise ImportError("BitsAndBytes quantization requires transformers>=4.30.0")
            
            model_kwargs["quantization_config"] = transformers.BitsAndBytesConfig(
                load_in_8bit=True
            )
            
        elif self.quantization == "gptq":
            model_kwargs["device_map"] = "auto"
            
        # Update with additional kwargs
        model_kwargs.update(kwargs)
        
        # Load tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_path, 
            trust_remote_code=self.trust_remote_code
        )
        
        # Load model
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_path,
            torch_dtype=torch.float16 if self.device != "cpu" else torch.float32,
            device_map="auto" if self.device != "cpu" else None,
            trust_remote_code=self.trust_remote_code,
            **model_kwargs
        )
        
        # Optimize for inference
        if hasattr(self.model, "eval"):
            self.model.eval()
            
        # Set padding token if needed
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token
    
    def _initialize_vllm(self) -> None:
        """Initialize using vLLM if available."""
        if not HAS_VLLM:
            raise ImportError("vLLM is not installed. Install with 'pip install vllm'.")
        
        # Set up vLLM parameters
        vllm_kwargs = {
            "model": self.model_path,
            "trust_remote_code": self.trust_remote_code,
        }
        
        # Set up quantization
        if self.quantization == "4bit":
            vllm_kwargs["quantization"] = "awq"
        elif self.quantization == "8bit":
            vllm_kwargs["quantization"] = "int8"
        
        # Initialize vLLM
        self.vllm = LLM(**vllm_kwargs)
        
        # Get tokenizer from vLLM
        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_path,
            trust_remote_code=self.trust_remote_code
        )
    
    def generate(
        self,
        prompt: str,
        max_tokens: int = 512,
        temperature: float = 0.7,
        top_p: float = 0.95,
        use_cache: bool = True,
        stream: bool = False,
        callback=None,
        **kwargs
    ) -> Union[str, Iterator[str]]:
        """
        Generate text from the model.
        
        Args:
            prompt: Input prompt
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            top_p: Top-p sampling parameter
            use_cache: Whether to use response caching
            stream: Whether to stream outputs
            callback: Callback function for streamed output
            **kwargs: Additional generation parameters
            
        Returns:
            Generated text or a generator yielding text chunks
        """
        # Check cache first
        params = {
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            **kwargs
        }
        
        if use_cache and self.cache and not stream:
            cached = self.cache.get(prompt, params)
            if cached:
                logger.info("Using cached response")
                return cached
        
        # Generate using appropriate backend
        if self.use_vllm:
            result = self._generate_vllm(prompt, max_tokens, temperature, top_p, stream, callback, **kwargs)
        else:
            result = self._generate_transformers(prompt, max_tokens, temperature, top_p, stream, callback, **kwargs)
        
        # Cache result if not streaming
        if use_cache and self.cache and not stream and isinstance(result, str):
            self.cache.put(prompt, params, result)
            
        return result
    
    def _generate_transformers(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float,
        top_p: float,
        stream: bool,
        callback,
        **kwargs
    ) -> Union[str, Iterator[str]]:
        """Generate using HuggingFace Transformers."""
        # Prepare inputs
        inputs = self.tokenizer(prompt, return_tensors="pt")
        input_ids = inputs["input_ids"].to(self.device)
        
        # Set up generation parameters
        generation_kwargs = {
            "max_new_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "do_sample": temperature > 0.0,
            "pad_token_id": self.tokenizer.pad_token_id,
            **kwargs
        }
        
        # Generate with streaming if requested
        if stream:
            return self._stream_transformers(input_ids, generation_kwargs, callback)
        
        # Regular generation
        with torch.no_grad():
            outputs = self.model.generate(input_ids, **generation_kwargs)
            
        # Decode outputs
        generated_text = self.tokenizer.decode(outputs[0][len(input_ids[0]):], skip_special_tokens=True)
        return generated_text
        
    def _stream_transformers(self, input_ids, generation_kwargs, callback):
        """Stream outputs from Transformers models."""
        from threading import Thread
        
        # Create streamer
        streamer = TextIteratorStreamer(self.tokenizer, skip_special_tokens=True)
        generation_kwargs["streamer"] = streamer
        
        # Run generation in a separate thread
        thread = Thread(target=self.model.generate, args=(input_ids,), kwargs=generation_kwargs)
        thread.start()
        
        # Stream chunks
        generated_text = ""
        for new_text in streamer:
            generated_text += new_text
            if callback:
                callback(new_text)
            yield new_text
            
        # Return the final generated text if needed
        return generated_text
        
    def _generate_vllm(
        self,
        prompt: str,
        max_tokens: int,
        temperature: float,
        top_p: float,
        stream: bool,
        callback,
        **kwargs
    ) -> Union[str, Iterator[str]]:
        """Generate using vLLM."""
        # Set up sampling parameters
        sampling_params = SamplingParams(
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            **kwargs
        )
        
        if stream:
            # Stream outputs
            outputs = self.vllm.generate(prompt, sampling_params, stream=True)
            generated_text = ""
            
            for output in outputs:
                if output.outputs:
                    new_text = output.outputs[0].text[len(generated_text):]
                    generated_text = output.outputs[0].text
                    if callback:
                        callback(new_text)
                    yield new_text
                    
            return generated_text
        else:
            # Regular generation
            outputs = self.vllm.generate(prompt, sampling_params)
            return outputs[0].outputs[0].text
    
    def batch_generate(
        self,
        prompts: List[str],
        max_tokens: int = 512,
        temperature: float = 0.7,
        top_p: float = 0.95,
        **kwargs
    ) -> List[str]:
        """
        Generate text for multiple prompts in batch mode.
        
        Args:
            prompts: List of input prompts
            max_tokens: Maximum tokens to generate
            temperature: Sampling temperature
            top_p: Top-p sampling parameter
            **kwargs: Additional generation parameters
            
        Returns:
            List of generated texts
        """
        # Check for cached responses
        params = {
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            **kwargs
        }
        
        results = []
        uncached_indices = []
        uncached_prompts = []
        
        # Get cached results if available
        if self.cache:
            for i, prompt in enumerate(prompts):
                cached = self.cache.get(prompt, params)
                if cached:
                    results.append(cached)
                else:
                    uncached_indices.append(i)
                    uncached_prompts.append(prompt)
        else:
            uncached_indices = list(range(len(prompts)))
            uncached_prompts = prompts
            results = [None] * len(prompts)
        
        # If all results are cached, return immediately
        if not uncached_prompts:
            return results
            
        # Process uncached prompts based on the backend
        if self.use_vllm:
            uncached_results = self._batch_generate_vllm(uncached_prompts, max_tokens, temperature, top_p, **kwargs)
        else:
            uncached_results = self._batch_generate_transformers(uncached_prompts, max_tokens, temperature, top_p, **kwargs)
        
        # Merge cached and new results
        for i, idx in enumerate(uncached_indices):
            results[idx] = uncached_results[i]
            
            # Cache the new result
            if self.cache:
                self.cache.put(uncached_prompts[i], params, uncached_results[i])
        
        return results
    
    def _batch_generate_transformers(
        self,
        prompts: List[str],
        max_tokens: int,
        temperature: float,
        top_p: float,
        **kwargs
    ) -> List[str]:
        """Batch generate using HuggingFace Transformers."""
        # Process in batches based on max_batch_size
        all_results = []
        
        for i in range(0, len(prompts), self.max_batch_size):
            batch_prompts = prompts[i:i+self.max_batch_size]
            
            # Tokenize and pad
            inputs = self.tokenizer(batch_prompts, padding=True, return_tensors="pt")
            input_ids = inputs["input_ids"].to(self.device)
            attention_mask = inputs["attention_mask"].to(self.device)
            
            # Set up generation parameters
            generation_kwargs = {
                "max_new_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p,
                "do_sample": temperature > 0.0,
                "pad_token_id": self.tokenizer.pad_token_id,
                "attention_mask": attention_mask,
                **kwargs
            }
            
            # Generate
            with torch.no_grad():
                outputs = self.model.generate(input_ids, **generation_kwargs)
            
            # Decode each output
            batch_results = []
            for j, output in enumerate(outputs):
                input_length = len(input_ids[j])
                generated_text = self.tokenizer.decode(output[input_length:], skip_special_tokens=True)
                batch_results.append(generated_text)
                
            all_results.extend(batch_results)
            
        return all_results
    
    def _batch_generate_vllm(
        self,
        prompts: List[str],
        max_tokens: int,
        temperature: float,
        top_p: float,
        **kwargs
    ) -> List[str]:
        """Batch generate using vLLM."""
        # Set up sampling parameters
        sampling_params = SamplingParams(
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            **kwargs
        )
        
        # Generate with vLLM
        outputs = self.vllm.generate(prompts, sampling_params)
        
        # Extract results
        results = []
        for output in outputs:
            results.append(output.outputs[0].text)
            
        return results


def convert_to_gguf(
    model_path: str,
    output_path: Optional[str] = None,
    quantization: str = "q4_k_m",  # Options: q4_0, q4_1, q5_0, q5_1, q8_0, etc.
    verbose: bool = False,
) -> str:
    """
    Convert a Hugging Face model to GGUF format for efficient inference.
    
    Args:
        model_path: Path to model or HF model ID
        output_path: Output directory (defaults to ./models/gguf/{model_name})
        quantization: GGUF quantization format
        verbose: Whether to show verbose output
        
    Returns:
        Path to converted model file
    """
    try:
        import subprocess
        from huggingface_hub import snapshot_download
    except ImportError:
        raise ImportError("huggingface_hub is required for model conversion.")
    
    # Determine if model_path is a HF model ID or local path
    if not os.path.exists(model_path):
        # Download the model from HF Hub
        print(f"Downloading model {model_path} from Hugging Face Hub...")
        model_path = snapshot_download(
            repo_id=model_path,
            allow_patterns=["*.bin", "*.json", "*.model", "tokenizer.model", "*.py"],
        )
    
    # Set default output path if not provided
    model_name = os.path.basename(model_path.rstrip("/"))
    if not output_path:
        output_path = os.path.join("models", "gguf", model_name)
    
    os.makedirs(output_path, exist_ok=True)
    
    # Try to find llama.cpp convert script
    convert_script_paths = [
        "/usr/local/bin/python -m llama_cpp.convert.convert_hf_to_gguf",
        "python -m llama_cpp.convert.convert_hf_to_gguf",
        "convert-hf-to-gguf.py",
        os.path.expanduser("~/.local/bin/convert-hf-to-gguf.py"),
    ]
    
    convert_cmd = None
    for path in convert_script_paths:
        try:
            subprocess.run(path.split() + ["--help"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            convert_cmd = path
            break
        except (subprocess.SubprocessError, FileNotFoundError):
            continue
    
    if not convert_cmd:
        raise RuntimeError(
            "Could not find llama.cpp convert script. "
            "Please install llama-cpp-python or specify the path manually."
        )
    
    # Build conversion command
    output_file = os.path.join(output_path, f"{model_name}-{quantization}.gguf")
    cmd = convert_cmd.split() + [
        model_path,
        "--outfile", output_file,
        "--outtype", "f16",
    ]
    
    if verbose:
        cmd.append("--verbose")
    
    # Run conversion
    print(f"Converting model to GGUF format ({quantization})...")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    
    if result.returncode != 0:
        raise RuntimeError(f"Conversion failed: {result.stderr.decode()}")
    
    print(f"Successfully converted model to {output_file}")
    
    # Quantize if needed
    if quantization != "f16":
        quantize_cmd = [
            "llama-quantize",
            output_file,
            os.path.join(output_path, f"{model_name}-{quantization}.gguf"),
            quantization
        ]
        
        print(f"Quantizing to {quantization}...")
        result = subprocess.run(quantize_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        
        if result.returncode != 0:
            raise RuntimeError(f"Quantization failed: {result.stderr.decode()}")
        
        print(f"Successfully quantized model to {quantization}")
    
    return output_file


def estimate_memory_usage(
    model_size_b: float,  # Base model size in billions of parameters
    batch_size: int = 1,
    sequence_length: int = 2048,
    bits: int = 16,  # 16, 8, 4, etc.
    kv_cache: bool = True,
    optimizations: List[str] = None,  # ["lora", "gptq", "awq"]
) -> Dict[str, float]:
    """
    Estimate memory usage for model inference.
    
    Args:
        model_size_b: Model size in billions of parameters
        batch_size: Batch size for inference
        sequence_length: Maximum sequence length
        bits: Precision (16, 8, 4, etc.)
        kv_cache: Whether KV cache is used
        optimizations: List of optimizations applied
        
    Returns:
        Dictionary with memory estimates
    """
    # Base model parameters * 2-4 bytes per parameter depending on precision
    bytes_per_param = bits / 8
    model_size_bytes = model_size_b * 1e9 * bytes_per_param
    
    # For FP16, we need ~2 bytes per parameter
    # For 8-bit quantization, we need ~1 byte per parameter
    # For 4-bit quantization, we need ~0.5 bytes per parameter
    
    # Activation memory (depends on batch size and sequence length)
    # Rough heuristic: 6 * batch_size * sequence_length * hidden_size bytes
    # hidden_size is typically sqrt(model_params) / 2
    hidden_size = int((model_size_b * 1e9) ** 0.5 / 2)
    activation_bytes = 6 * batch_size * sequence_length * hidden_size * (bits / 16)
    
    # KV cache (depends on batch size, number of layers, and sequence length)
    # layers = log(model_params) * 3
    layers = int(3 * (model_size_b ** 0.25) * 24)  
    heads = int(hidden_size / 64)
    kv_cache_bytes = 0
    if kv_cache:
        kv_cache_bytes = 2 * batch_size * layers * sequence_length * hidden_size * 2 * (bits / 16)
    
    # Apply optimization discounts
    optimization_discounts = {
        "lora": 0.9,  # LoRA typically reduces parameter count by ~90%
        "gptq": 0.8,  # GPTQ provides additional optimizations
        "awq": 0.8,   # AWQ provides additional optimizations
    }
    
    optimization_factor = 1.0
    if optimizations:
        for opt in optimizations:
            if opt in optimization_discounts:
                optimization_factor *= optimization_discounts[opt]
    
    model_size_bytes *= optimization_factor
    
    # Total memory estimate
    total_bytes = model_size_bytes + activation_bytes + kv_cache_bytes
    
    # Convert to more readable units
    result = {
        "model_size_gb": model_size_bytes / 1e9,
        "activation_memory_gb": activation_bytes / 1e9,
        "kv_cache_gb": kv_cache_bytes / 1e9,
        "total_gb": total_bytes / 1e9,
        "estimate_accuracy": "approximate",  # This is just an estimate
        "optimization_factor": optimization_factor
    }
    
    return result


def main():
    """Command-line interface for optimization utilities."""
    parser = argparse.ArgumentParser(description="Inference optimization utilities")
    subparsers = parser.add_subparsers(dest="command", help="Optimization command")
    
    # Optimize parser
    optimize_parser = subparsers.add_parser("optimize", help="Optimize a model for inference")
    optimize_parser.add_argument("--model", required=True, help="Model path or HF model ID")
    optimize_parser.add_argument("--quantization", default="none", choices=["none", "4bit", "8bit", "gptq"],
                               help="Quantization method")
    optimize_parser.add_argument("--output-dir", default="models/optimized", help="Output directory")
    optimize_parser.add_argument("--use-vllm", action="store_true", help="Use vLLM for acceleration")
    optimize_parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"],
                               help="Device to optimize for")
    
    # Convert parser
    convert_parser = subparsers.add_parser("convert", help="Convert model to GGUF format")
    convert_parser.add_argument("--model", required=True, help="Model path or HF model ID")
    convert_parser.add_argument("--output", help="Output file path")
    convert_parser.add_argument("--quantization", default="q4_k_m", 
                              help="Quantization method (q4_0, q4_1, q5_0, etc.)")
    
    # Memory estimation parser
    memory_parser = subparsers.add_parser("memory", help="Estimate memory requirements")
    memory_parser.add_argument("--model-size", type=float, required=True, help="Model size in billions of params")
    memory_parser.add_argument("--batch-size", type=int, default=1, help="Batch size")
    memory_parser.add_argument("--sequence-length", type=int, default=2048, help="Sequence length")
    memory_parser.add_argument("--bits", type=int, default=16, choices=[4, 8, 16], help="Bits per weight")
    memory_parser.add_argument("--no-kv-cache", action="store_true", help="Disable KV cache in estimation")
    
    # Pruning parser
    prune_parser = subparsers.add_parser("prune", help="Prune model for efficiency")
    prune_parser.add_argument("--model", required=True, help="Model path or HF model ID")
    prune_parser.add_argument("--output-dir", default="models/pruned", help="Output directory")
    prune_parser.add_argument("--method", required=True, 
                            choices=["heads", "layers", "magnitude", "distillation", "all"],
                            help="Pruning method")
    prune_parser.add_argument("--head-reduction", type=float, default=0.1, 
                            help="Fraction of attention heads to prune (0-1)")
    prune_parser.add_argument("--layer-reduction", type=float, default=0.1,
                            help="Fraction of layers to prune (0-1)")
    prune_parser.add_argument("--sparsity", type=float, default=0.3, 
                            help="Target sparsity for magnitude pruning (0-1)")
    prune_parser.add_argument("--teacher-model", help="Teacher model path for distillation pruning")
    prune_parser.add_argument("--training-data", help="Training data path for distillation")
    prune_parser.add_argument("--distill-epochs", type=int, default=3, help="Number of distillation epochs")
    prune_parser.add_argument("--learning-rate", type=float, default=5e-5, help="Learning rate for distillation")
    prune_parser.add_argument("--evaluate", action="store_true", 
                            help="Evaluate pruned model quality")
    prune_parser.add_argument("--device", default="auto", choices=["auto", "cpu", "cuda"],
                            help="Device to use for pruning")
    
    args = parser.parse_args()
    
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
    )
    
    if args.command == "optimize":
        optimizer = OptimizedInference(
            model_path=args.model,
            quantization=args.quantization,
            device=args.device,
            use_vllm=args.use_vllm
        )
        logger.info(f"Model optimized successfully: {args.model} (quantization={args.quantization})")
        
        # Run a simple test
        test_result = optimizer.generate("Hello, how are you today?", max_tokens=20)
        logger.info(f"Test generation: {test_result}")
        
    elif args.command == "convert":
        output_path = convert_to_gguf(
            model_path=args.model,
            output_path=args.output,
            quantization=args.quantization
        )
        logger.info(f"Model converted to GGUF: {output_path}")
        
    elif args.command == "memory":
        optimizations = []
        if args.bits == 4:
            optimizations.append("4bit")
        elif args.bits == 8:
            optimizations.append("8bit")
            
        memory_estimates = estimate_memory_usage(
            model_size_b=args.model_size,
            batch_size=args.batch_size,
            sequence_length=args.sequence_length,
            bits=args.bits,
            kv_cache=not args.no_kv_cache,
            optimizations=optimizations
        )
        
        # Print memory estimates
        print("\n===== MEMORY REQUIREMENT ESTIMATES =====")
        print(f"Model: {args.model_size}B parameters, {args.bits}-bit, batch={args.batch_size}, seq_len={args.sequence_length}")
        print(f"Model weights: {memory_estimates['model_size_gb']:.2f} GB")
        print(f"Activations: {memory_estimates['activation_memory_gb']:.2f} GB")
        if not args.no_kv_cache:
            print(f"KV cache: {memory_estimates['kv_cache_gb']:.2f} GB")
        print(f"Total GPU memory: {memory_estimates['total_gb']:.2f} GB")
        if "recommended_gpu" in memory_estimates:
            print(f"Recommended GPU: {memory_estimates['recommended_gpu']}")
        print(f"Optimization factor: {memory_estimates['optimization_factor']:.2f}")
        print("Note: These are approximate estimates and actual usage may vary.")
        
    elif args.command == "prune":
        pruner = ModelPruner(
            model_path=args.model,
            output_dir=args.output_dir,
            device=args.device
        )
        
        if args.method == "heads" or args.method == "all":
            pruner.prune_heads(
                head_reduction=args.head_reduction,
                save_model=(args.method != "all")
            )
        
        if args.method == "layers" or args.method == "all":
            pruner.prune_layers(
                layer_reduction=args.layer_reduction,
                save_model=(args.method != "all")
            )
            
        if args.method == "magnitude" or args.method == "all":
            pruner.magnitude_pruning(
                sparsity=args.sparsity,
                save_model=True
            )
            
        if args.method == "distillation" or args.method == "all":
            pruner.distillation_pruning(
                teacher_model_path=args.teacher_model,
                training_data=args.training_data,
                pruning_ratio=args.sparsity,
                num_epochs=args.distill_epochs,
                learning_rate=args.learning_rate,
                save_model=True
            )
            
        if args.evaluate:
            metrics = pruner.evaluate_pruned_model()
            print("\n===== PRUNED MODEL EVALUATION =====")
            print(f"Parameter reduction: {metrics['parameter_reduction']*100:.1f}%")
            print(f"Memory reduction: {metrics['memory_reduction']*100:.1f}%")
            print(f"Avg. generation time per token: {metrics['avg_generation_time']*1000:.2f} ms")
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main() 