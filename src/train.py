import os
import yaml
import torch
import argparse
import datetime
import logging
import json
import deepspeed
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling,
    EarlyStoppingCallback
)
from datasets import load_dataset
import wandb

from src.memory import MemoryManager
from src.reasoning import ReasoningManager, ReasoningMode, ReasoningTrace
from src.tools import ToolManager

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("training.log")
    ]
)
logger = logging.getLogger(__name__)

def load_config(config_path):
    with open(config_path, 'r') as f:
        return yaml.safe_load(f)

def setup_model_and_tokenizer(config, args):
    """Setup model and tokenizer based on configuration."""
    logger.info(f"Loading model: {config['model']['name']}")
    
    # Load tokenizer
    tokenizer_path = args.tokenizer_path if args.tokenizer_path else config['model']['name']
    tokenizer = AutoTokenizer.from_pretrained(
        tokenizer_path,
        trust_remote_code=config['model']['trust_remote_code']
    )
    
    # Make sure the tokenizer has a pad token
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # Load model
    model_path = args.model_path if args.model_path else config['model']['name']
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        trust_remote_code=config['model']['trust_remote_code'],
        torch_dtype=torch.float16 if config['training']['fp16'] else torch.float32
    )
    
    logger.info(f"Model loaded: {model.__class__.__name__}")
    return model, tokenizer

def prepare_dataset(config, tokenizer, args):
    """Prepare and tokenize dataset."""
    # Override data paths if provided in args
    train_file = args.train_file if args.train_file else config['data']['train_file']
    eval_file = args.eval_file if args.eval_file else config['data']['eval_file']
    
    logger.info(f"Loading datasets from: {train_file} (train), {eval_file} (eval)")
    
    # Load dataset from files
    dataset = load_dataset(
        'json',
        data_files={
            'train': train_file,
            'validation': eval_file
        }
    )
    
    # Limit dataset size if specified
    if args.max_samples:
        dataset['train'] = dataset['train'].select(range(min(args.max_samples, len(dataset['train']))))
        dataset['validation'] = dataset['validation'].select(range(min(args.max_samples // 10, len(dataset['validation']))))
    
    logger.info(f"Dataset loaded. Train size: {len(dataset['train'])}, Eval size: {len(dataset['validation'])}")
    
    # Tokenize the dataset
    def tokenize_function(examples):
        return tokenizer(
            examples['text'],
            truncation=True,
            max_length=config['model']['max_length'],
            padding="max_length" if args.pad_to_max_length else False
        )
    
    logger.info("Tokenizing dataset...")
    tokenized_dataset = dataset.map(
        tokenize_function,
        batched=True,
        num_proc=args.preprocessing_num_workers,
        remove_columns=dataset['train'].column_names,
        desc="Tokenizing dataset",
    )
    
    logger.info("Tokenization complete.")
    return tokenized_dataset

def setup_trainer(model, tokenizer, dataset, config, args):
    """Setup the Trainer for training."""
    # Create output directory with timestamp
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    output_dir = os.path.join(args.output_dir, f"run_{timestamp}")
    os.makedirs(output_dir, exist_ok=True)
    
    # Save config for reference
    with open(os.path.join(output_dir, 'config.yaml'), 'w') as f:
        yaml.dump(config, f)
    
    # DeepSpeed config
    deepspeed_config = config['deepspeed']['config'] if config['deepspeed']['enabled'] else None
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=output_dir,
        num_train_epochs=args.num_epochs if args.num_epochs else config['training']['num_train_epochs'],
        per_device_train_batch_size=args.batch_size if args.batch_size else config['training']['batch_size'],
        per_device_eval_batch_size=args.batch_size if args.batch_size else config['training']['batch_size'],
        gradient_accumulation_steps=config['training']['gradient_accumulation_steps'],
        learning_rate=args.learning_rate if args.learning_rate else config['training']['learning_rate'],
        weight_decay=config['training']['weight_decay'],
        warmup_steps=config['training']['warmup_steps'],
        fp16=config['training']['fp16'],
        logging_dir=os.path.join(output_dir, 'logs'),
        logging_steps=args.logging_steps,
        eval_steps=args.eval_steps,
        save_steps=args.save_steps,
        evaluation_strategy="steps",
        save_strategy="steps",
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        gradient_checkpointing=config['training']['gradient_checkpointing'],
        deepspeed=deepspeed_config,
        report_to="wandb" if args.use_wandb else None,
        run_name=f"perslm_{timestamp}" if args.use_wandb else None,
    )
    
    # Setup trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=dataset['train'],
        eval_dataset=dataset['validation'],
        tokenizer=tokenizer,
        data_collator=DataCollatorForLanguageModeling(
            tokenizer=tokenizer,
            mlm=False
        ),
        callbacks=[EarlyStoppingCallback(early_stopping_patience=3)]
    )
    
    return trainer

def setup_manager_interfaces(model, tokenizer, config, args):
    """Setup manager interfaces for memory, reasoning, and tools."""
    managers = {}
    
    # Create model text generation function
    def generate_text(prompt, max_length=None, temperature=0.7, top_p=0.9):
        inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
        
        if max_length is None:
            max_length = config['model']['max_length']
        
        with torch.no_grad():
            outputs = model.generate(
                inputs.input_ids,
                max_length=max_length,
                temperature=temperature,
                top_p=top_p,
                do_sample=True,
                pad_token_id=tokenizer.pad_token_id
            )
        
        return tokenizer.decode(outputs[0], skip_special_tokens=True)
    
    # Setup memory manager if enabled
    if args.enable_memory:
        logger.info("Initializing memory system...")
        
        # Create embedding provider using the model
        def get_embedding(text):
            inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512).to(model.device)
            with torch.no_grad():
                outputs = model(**inputs, output_hidden_states=True)
                # Use the hidden states as embeddings (last layer, first token)
                embedding = outputs.hidden_states[-1][:, 0].cpu().numpy()[0]
            return embedding
        
        # Initialize memory manager
        memory_manager = MemoryManager(
            config=config.get('memory', {}),
            embedding_provider=get_embedding
        )
        
        # Initialize memory directory
        os.makedirs(args.memory_dir, exist_ok=True)
        
        managers['memory'] = memory_manager
    
    # Setup reasoning manager if enabled
    if args.enable_reasoning:
        logger.info("Initializing reasoning system...")
        
        # Initialize reasoning manager
        reasoning_manager = ReasoningManager(
            model_provider=generate_text,
            memory_manager=managers.get('memory'),
            config=config.get('reasoning', {})
        )
        
        # Load reasoners
        from src.reasoning.chain_of_thought import ChainOfThoughtReasoner
        from src.reasoning.self_reflection import SelfReflectionReasoner
        from src.reasoning.task_decomposition import TaskDecomposer
        from src.reasoning.planning import Planner
        
        # Register reasoners
        reasoning_manager.register_reasoner(
            ReasoningMode.CHAIN_OF_THOUGHT, 
            ChainOfThoughtReasoner(config.get('reasoning', {}).get('chain_of_thought', {}))
        )
        
        reasoning_manager.register_reasoner(
            ReasoningMode.SELF_REFLECTION, 
            SelfReflectionReasoner(config.get('reasoning', {}).get('self_reflection', {}))
        )
        
        reasoning_manager.register_reasoner(
            ReasoningMode.TASK_DECOMPOSITION, 
            TaskDecomposer(config.get('reasoning', {}).get('task_decomposition', {}))
        )
        
        reasoning_manager.register_reasoner(
            ReasoningMode.PLANNING, 
            Planner(config.get('reasoning', {}).get('planning', {}))
        )
        
        managers['reasoning'] = reasoning_manager
    
    # Setup tool manager if enabled
    if args.enable_tools:
        logger.info("Initializing tool system...")
        
        # Initialize tool manager
        tool_manager = ToolManager(config=config.get('tools', {}))
        
        # Register memory callback
        if 'memory' in managers:
            def memory_callback(tool_name, parameters, result):
                # Store tool usage in memory
                memory_content = f"Tool: {tool_name}\nParameters: {json.dumps(parameters)}\nResult: {result.to_text()}"
                managers['memory'].add(memory_content, long_term=True, metadata={
                    "type": "tool_usage",
                    "tool_name": tool_name,
                    "success": result.success
                })
            
            tool_manager.set_memory_callback(memory_callback)
        
        # Load and register tools
        if args.enable_file_tools:
            from src.tools.file_tools import FileReader, FileWriter
            tool_manager.register_tools([
                FileReader(config.get('tools', {}).get('file_reader', {})),
                FileWriter(config.get('tools', {}).get('file_writer', {}))
            ])
        
        if args.enable_shell_tools:
            from src.tools.shell_tools import ShellExecutor
            tool_manager.register_tools([
                ShellExecutor(config.get('tools', {}).get('shell_executor', {}))
            ])
        
        if args.enable_web_tools:
            from src.tools.web_tools import HTTPClient, WebSearchTool
            tool_manager.register_tools([
                HTTPClient(config.get('tools', {}).get('http_client', {})),
                WebSearchTool(config.get('tools', {}).get('web_search', {}))
            ])
        
        if args.enable_calculator:
            from src.tools.calculator import Calculator
            tool_manager.register_tools([
                Calculator(config.get('tools', {}).get('calculator', {}))
            ])
        
        managers['tools'] = tool_manager
    
    # Setup modality processors if enabled
    if args.enable_modalities:
        logger.info("Initializing modality processors...")
        modality_processors = {}
        
        if args.enable_image_modality:
            from src.modalities.image import ImageProcessor
            image_config = config.get('modalities', {}).get('image', {})
            image_processor = ImageProcessor(ModalityConfig(**image_config))
            modality_processors['image'] = image_processor
        
        if args.enable_audio_modality:
            from src.modalities.audio import AudioProcessor
            audio_config = config.get('modalities', {}).get('audio', {})
            audio_processor = AudioProcessor(ModalityConfig(**audio_config))
            modality_processors['audio'] = audio_processor
        
        managers['modalities'] = modality_processors
    
    return managers

def prepare_reasoning_dataset(model, tokenizer, managers, args):
    """Prepare a dataset with reasoning traces for training or evaluation."""
    if 'reasoning' not in managers:
        logger.error("Reasoning manager not initialized")
        return None
    
    reasoning_manager = managers['reasoning']
    
    # Load benchmark data
    if args.reasoning_benchmark == "gsm8k":
        # Example: Use the GSM8K (grade school math) benchmark
        try:
            benchmark_data = load_dataset("gsm8k", "main")
            benchmark_split = "test" if args.eval_only else "train"
            benchmark = benchmark_data[benchmark_split]
            benchmark_field = "question"
            answer_field = "answer"
        except Exception as e:
            logger.error(f"Failed to load GSM8K benchmark: {e}")
            return None
    elif args.reasoning_benchmark == "hotpotqa":
        # Example: Use the HotpotQA benchmark
        try:
            benchmark_data = load_dataset("hotpot_qa", "distractor")
            benchmark_split = "validation" if args.eval_only else "train"
            benchmark = benchmark_data[benchmark_split]
            benchmark_field = "question"
            answer_field = "answer"
        except Exception as e:
            logger.error(f"Failed to load HotpotQA benchmark: {e}")
            return None
    else:
        logger.error(f"Unknown reasoning benchmark: {args.reasoning_benchmark}")
        return None
    
    # Limit dataset size if specified
    if args.max_reasoning_samples:
        benchmark = benchmark.select(range(min(args.max_reasoning_samples, len(benchmark))))
    
    logger.info(f"Loaded {len(benchmark)} samples from {args.reasoning_benchmark} benchmark")
    
    # Generate reasoning traces
    reasoning_data = []
    modes = [ReasoningMode.CHAIN_OF_THOUGHT, ReasoningMode.SELF_REFLECTION]  # Use appropriate modes for the task
    
    for i, sample in enumerate(benchmark):
        if i % 10 == 0:
            logger.info(f"Processing sample {i}/{len(benchmark)}")
        
        query = sample[benchmark_field]
        answer = sample[answer_field]
        
        # Choose reasoning mode
        mode = modes[i % len(modes)]
        
        # Generate reasoning trace
        try:
            result = reasoning_manager.reason(
                query=query,
                mode=mode,
                max_iterations=3
            )
            
            if result["success"]:
                reasoning_trace = result["trace"].get_full_trace()
                final_answer = result["result"].get("answer", "")
                
                # Create training example
                reasoning_example = {
                    "text": f"Question: {query}\n\n{reasoning_trace}\nAnswer: {final_answer}",
                    "query": query,
                    "trace": reasoning_trace,
                    "answer": final_answer,
                    "reference_answer": answer,
                    "mode": mode.value
                }
                
                reasoning_data.append(reasoning_example)
            else:
                logger.warning(f"Reasoning failed for sample {i}: {result.get('error', 'Unknown error')}")
        except Exception as e:
            logger.exception(f"Error processing sample {i}")
    
    logger.info(f"Generated {len(reasoning_data)} reasoning examples")
    
    # Save reasoning data if requested
    if args.save_reasoning_data:
        reasoning_data_path = os.path.join(args.output_dir, "reasoning_data.jsonl")
        with open(reasoning_data_path, 'w') as f:
            for example in reasoning_data:
                f.write(json.dumps(example) + "\n")
        logger.info(f"Saved reasoning data to {reasoning_data_path}")
    
    # Create dataset
    from datasets import Dataset
    reasoning_dataset = Dataset.from_dict({
        "text": [example["text"] for example in reasoning_data]
    })
    
    # Tokenize dataset
    def tokenize_function(examples):
        return tokenizer(
            examples['text'],
            truncation=True,
            max_length=args.max_reasoning_length,
            padding="max_length" if args.pad_to_max_length else False
        )
    
    tokenized_dataset = reasoning_dataset.map(
        tokenize_function,
        batched=True,
        num_proc=args.preprocessing_num_workers,
        remove_columns=reasoning_dataset.column_names,
        desc="Tokenizing reasoning dataset",
    )
    
    return tokenized_dataset

def evaluate_reasoning(model, tokenizer, managers, args):
    """Evaluate the model's reasoning capabilities on a benchmark."""
    if 'reasoning' not in managers:
        logger.error("Reasoning manager not initialized")
        return
    
    reasoning_manager = managers['reasoning']
    
    # Load benchmark data
    if args.reasoning_benchmark == "gsm8k":
        # Example: Use the GSM8K (grade school math) benchmark
        try:
            benchmark_data = load_dataset("gsm8k", "main")
            benchmark = benchmark_data["test"]
            benchmark_field = "question"
            answer_field = "answer"
        except Exception as e:
            logger.error(f"Failed to load GSM8K benchmark: {e}")
            return
    elif args.reasoning_benchmark == "hotpotqa":
        # Example: Use the HotpotQA benchmark
        try:
            benchmark_data = load_dataset("hotpot_qa", "distractor")
            benchmark = benchmark_data["validation"]
            benchmark_field = "question"
            answer_field = "answer"
        except Exception as e:
            logger.error(f"Failed to load HotpotQA benchmark: {e}")
            return
    else:
        logger.error(f"Unknown reasoning benchmark: {args.reasoning_benchmark}")
        return
    
    # Limit dataset size if specified
    if args.max_reasoning_samples:
        benchmark = benchmark.select(range(min(args.max_reasoning_samples, len(benchmark))))
    
    logger.info(f"Evaluating reasoning on {len(benchmark)} samples from {args.reasoning_benchmark} benchmark")
    
    # Run evaluation
    results = {
        "total": len(benchmark),
        "correct": 0,
        "incorrect": 0,
        "failed": 0,
        "samples": []
    }
    
    for mode in ReasoningMode:
        if mode == ReasoningMode.AUTO:
            continue
        results[mode.value] = {
            "total": 0,
            "correct": 0,
            "incorrect": 0,
            "failed": 0
        }
    
    for i, sample in enumerate(benchmark):
        if i % 10 == 0:
            logger.info(f"Evaluating sample {i}/{len(benchmark)}")
        
        query = sample[benchmark_field]
        reference_answer = sample[answer_field]
        
        # Test each reasoning mode
        for mode in list(ReasoningMode):
            if mode == ReasoningMode.AUTO:
                continue
            
            try:
                # Generate reasoning trace
                result = reasoning_manager.reason(
                    query=query,
                    mode=mode,
                    max_iterations=3
                )
                
                if result["success"]:
                    reasoner_result = result["result"]
                    model_answer = reasoner_result.get("answer", "")
                    
                    # Very simple exact match accuracy (in a real implementation, this would be more sophisticated)
                    correct = model_answer.strip().lower() == reference_answer.strip().lower()
                    
                    # Update stats
                    results[mode.value]["total"] += 1
                    if correct:
                        results[mode.value]["correct"] += 1
                        results["correct"] += 1
                    else:
                        results[mode.value]["incorrect"] += 1
                        results["incorrect"] += 1
                    
                    # Save sample results
                    sample_result = {
                        "query": query,
                        "reference_answer": reference_answer,
                        "model_answer": model_answer,
                        "correct": correct,
                        "mode": mode.value,
                        "trace": result["trace"].to_dict() if args.save_traces else None
                    }
                    
                    results["samples"].append(sample_result)
                else:
                    results[mode.value]["failed"] += 1
                    results["failed"] += 1
                    
                    logger.warning(f"Reasoning failed for sample {i}, mode {mode.value}: {result.get('error', 'Unknown error')}")
            except Exception as e:
                results[mode.value]["failed"] += 1
                results["failed"] += 1
                
                logger.exception(f"Error evaluating sample {i}, mode {mode.value}")
        
        # Log progress
        if (i + 1) % 100 == 0:
            accuracy = results["correct"] / (results["correct"] + results["incorrect"]) if (results["correct"] + results["incorrect"]) > 0 else 0
            logger.info(f"Progress: {i+1}/{len(benchmark)}, Accuracy: {accuracy:.2f}")
    
    # Calculate overall accuracy
    if (results["correct"] + results["incorrect"]) > 0:
        results["accuracy"] = results["correct"] / (results["correct"] + results["incorrect"])
    else:
        results["accuracy"] = 0.0
    
    # Calculate accuracy for each mode
    for mode in ReasoningMode:
        if mode == ReasoningMode.AUTO:
            continue
        
        mode_results = results[mode.value]
        if (mode_results["correct"] + mode_results["incorrect"]) > 0:
            mode_results["accuracy"] = mode_results["correct"] / (mode_results["correct"] + mode_results["incorrect"])
        else:
            mode_results["accuracy"] = 0.0
    
    # Log results
    logger.info(f"Reasoning evaluation complete.")
    logger.info(f"Overall accuracy: {results['accuracy']:.4f} ({results['correct']}/{results['correct'] + results['incorrect']})")
    
    for mode in ReasoningMode:
        if mode == ReasoningMode.AUTO:
            continue
        
        mode_results = results[mode.value]
        logger.info(f"{mode.value} accuracy: {mode_results.get('accuracy', 0):.4f} ({mode_results['correct']}/{mode_results['correct'] + mode_results['incorrect']})")
    
    # Save results if requested
    if args.save_evaluation_results:
        eval_results_path = os.path.join(args.output_dir, "reasoning_eval.json")
        
        # Remove traces from individual samples if they're too large
        if not args.save_traces:
            for sample in results["samples"]:
                sample["trace"] = None
        
        with open(eval_results_path, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"Saved evaluation results to {eval_results_path}")
    
    return results

def main():
    parser = argparse.ArgumentParser(description='Train PersLM models')
    
    # Basic arguments
    parser.add_argument('--config', type=str, default='configs/model_config.yaml', help='Path to config file')
    parser.add_argument('--output_dir', type=str, default='checkpoints', help='Output directory for model')
    
    # Model and data arguments
    parser.add_argument('--model_path', type=str, help='Path to pretrained model (overrides config)')
    parser.add_argument('--tokenizer_path', type=str, help='Path to tokenizer (overrides config)')
    parser.add_argument('--train_file', type=str, help='Path to training data (overrides config)')
    parser.add_argument('--eval_file', type=str, help='Path to evaluation data (overrides config)')
    parser.add_argument('--max_samples', type=int, help='Maximum number of samples to use')
    
    # Training arguments
    parser.add_argument('--num_epochs', type=int, help='Number of training epochs (overrides config)')
    parser.add_argument('--batch_size', type=int, help='Batch size (overrides config)')
    parser.add_argument('--learning_rate', type=float, help='Learning rate (overrides config)')
    parser.add_argument('--logging_steps', type=int, default=10, help='Steps between logging')
    parser.add_argument('--eval_steps', type=int, default=100, help='Steps between evaluations')
    parser.add_argument('--save_steps', type=int, default=500, help='Steps between checkpoint saves')
    
    # Preprocessing arguments
    parser.add_argument('--preprocessing_num_workers', type=int, default=4, help='Number of workers for preprocessing')
    parser.add_argument('--pad_to_max_length', action='store_true', help='Pad sequences to max length')
    
    # Monitoring arguments
    parser.add_argument('--use_wandb', action='store_true', help='Use Weights & Biases for monitoring')
    parser.add_argument('--wandb_project', type=str, default='perslm', help='W&B project name')
    
    # Memory system
    parser.add_argument('--enable_memory', action='store_true', help='Enable memory system')
    parser.add_argument('--memory_dir', type=str, default='data/memory', help='Directory for memory storage')
    
    # Reasoning system
    parser.add_argument('--enable_reasoning', action='store_true', help='Enable reasoning system')
    parser.add_argument('--reasoning_benchmark', type=str, choices=['gsm8k', 'hotpotqa'], help='Benchmark for reasoning evaluation')
    parser.add_argument('--max_reasoning_samples', type=int, default=100, help='Maximum number of reasoning samples to evaluate')
    parser.add_argument('--max_reasoning_length', type=int, default=2048, help='Maximum length for reasoning sequences')
    parser.add_argument('--save_reasoning_data', action='store_true', help='Save reasoning data to disk')
    parser.add_argument('--save_evaluation_results', action='store_true', help='Save evaluation results to disk')
    parser.add_argument('--save_traces', action='store_true', help='Save full reasoning traces in evaluation results')
    parser.add_argument('--train_with_reasoning', action='store_true', help='Train with reasoning traces')
    parser.add_argument('--eval_reasoning', action='store_true', help='Evaluate reasoning capabilities')
    
    # Tool system
    parser.add_argument('--enable_tools', action='store_true', help='Enable tool system')
    parser.add_argument('--enable_file_tools', action='store_true', help='Enable file tools')
    parser.add_argument('--enable_shell_tools', action='store_true', help='Enable shell tools')
    parser.add_argument('--enable_web_tools', action='store_true', help='Enable web tools')
    parser.add_argument('--enable_calculator', action='store_true', help='Enable calculator tool')
    
    # Modality system
    parser.add_argument('--enable_modalities', action='store_true', help='Enable modality processors')
    parser.add_argument('--enable_image_modality', action='store_true', help='Enable image modality')
    parser.add_argument('--enable_audio_modality', action='store_true', help='Enable audio modality')
    
    # Dry run (validation only)
    parser.add_argument('--dry_run', action='store_true', help='Run validation only, no training')
    parser.add_argument('--eval_only', action='store_true', help='Run evaluation only, no training')
    
    args = parser.parse_args()
    
    # Load configuration
    config = load_config(args.config)
    
    # Initialize W&B if enabled
    if args.use_wandb:
        wandb.init(project=args.wandb_project)
        wandb.config.update(config)
    
    # Setup model and tokenizer
    model, tokenizer = setup_model_and_tokenizer(config, args)
    
    # Setup manager interfaces
    managers = setup_manager_interfaces(model, tokenizer, config, args)
    
    # Prepare base dataset
    dataset = prepare_dataset(config, tokenizer, args)
    
    # If training with reasoning, prepare reasoning dataset
    reasoning_dataset = None
    if args.train_with_reasoning and args.reasoning_benchmark:
        reasoning_dataset = prepare_reasoning_dataset(model, tokenizer, managers, args)
        
        # Combine datasets if both available
        if reasoning_dataset and dataset:
            # Replace small dev set from original dataset with reasoning dataset
            from datasets import concatenate_datasets
            train_dataset = concatenate_datasets([dataset['train'], reasoning_dataset])
            dataset['train'] = train_dataset
    
    # Setup trainer
    trainer = setup_trainer(model, tokenizer, dataset, config, args)
    
    # Evaluate reasoning if requested
    if args.eval_reasoning and args.reasoning_benchmark:
        reasoning_results = evaluate_reasoning(model, tokenizer, managers, args)
        
        # Log results to W&B if enabled
        if args.use_wandb:
            wandb.log({
                "reasoning_accuracy": reasoning_results["accuracy"],
                **{f"{mode.value}_accuracy": reasoning_results[mode.value]["accuracy"] 
                   for mode in ReasoningMode if mode != ReasoningMode.AUTO}
            })
    
    # Run training or validation
    if args.eval_only or args.dry_run:
        logger.info("Running evaluation only")
        metrics = trainer.evaluate()
        trainer.log_metrics("eval", metrics)
    else:
        logger.info("Starting training...")
        trainer.train()
        
        # Save the final model
        logger.info("Training complete. Saving final model...")
        trainer.save_model(os.path.join(args.output_dir, "final_model"))
        tokenizer.save_pretrained(os.path.join(args.output_dir, "final_model"))
        
        # Run final evaluation
        logger.info("Running final evaluation...")
        metrics = trainer.evaluate()
        trainer.log_metrics("eval", metrics)
        
        # Re-evaluate reasoning on the final model if requested
        if args.eval_reasoning and args.reasoning_benchmark:
            logger.info("Re-evaluating reasoning with final model...")
            reasoning_results = evaluate_reasoning(model, tokenizer, managers, args)
            
            # Log results to W&B if enabled
            if args.use_wandb:
                wandb.log({
                    "final_reasoning_accuracy": reasoning_results["accuracy"],
                    **{f"final_{mode.value}_accuracy": reasoning_results[mode.value]["accuracy"] 
                       for mode in ReasoningMode if mode != ReasoningMode.AUTO}
                })
    
    # Save memory if enabled
    if args.enable_memory and 'memory' in managers:
        logger.info("Saving memory...")
        managers['memory'].save()
    
    # Clean up resources
    for manager_name, manager in managers.items():
        if manager_name == 'modalities':
            for modality_name, processor in manager.items():
                processor.cleanup()
    
    logger.info("Process complete.")

if __name__ == '__main__':
    main() 