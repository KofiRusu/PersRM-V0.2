#!/usr/bin/env python
# Fine-tune deepseek-coder for UI/UX reasoning

import os
import json
import torch
import transformers
from datasets import load_dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM, 
    BitsAndBytesConfig,
    TrainingArguments,
    Trainer,
    DataCollatorForLanguageModeling
)

def main():
    # Configuration
    model_name = "deepseek-ai/deepseek-coder-6.7b-base"
    dataset_path = "./data/reasoning_instruction.jsonl"
    output_dir = "./models/reasoning-model"
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Check if GPU is available
    use_gpu = torch.cuda.is_available()
    print(f"GPU available: {use_gpu}")
    
    # Load tokenizer and model
    print(f"Loading model: {model_name}")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # For Mac/CPU usage, skip quantization
    if use_gpu:
        # Quantization config for memory efficiency with GPU
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
        )
        
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            quantization_config=bnb_config,
            device_map="auto",
            trust_remote_code=True
        )
        
        # Prepare model for LoRA training
        model = prepare_model_for_kbit_training(model)
    else:
        print("Running on CPU with minimal model for testing")
        # For testing on CPU, use a much smaller model
        test_model_name = "distilgpt2"  # Use a tiny model for testing
        model = AutoModelForCausalLM.from_pretrained(
            test_model_name,
            trust_remote_code=True
        )
    
    # Set tokenizer padding settings
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    
    # LoRA configuration
    lora_config = LoraConfig(
        r=16,  # rank
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=[
            "q_proj", 
            "k_proj", 
            "v_proj", 
            "o_proj",
        ] if use_gpu else None  # Adjust target modules based on the model
    )
    
    # Apply LoRA
    model = get_peft_model(model, lora_config)
    
    # Load and format dataset
    def format_instruction(example):
        return {
            "text": f"### Instruction:\n{example['instruction']}\n\n### Response:\n{example['output']}"
        }
    
    # Load dataset from JSONL file
    dataset = load_dataset("json", data_files=dataset_path)["train"]
    formatted_dataset = dataset.map(format_instruction)
    
    # Define data collator for language modeling
    def tokenize_function(examples):
        return tokenizer(
            examples["text"],
            padding="max_length",
            truncation=True,
            max_length=512,
            return_tensors="pt"
        )
    
    tokenized_dataset = formatted_dataset.map(
        tokenize_function, 
        batched=True, 
        remove_columns=["instruction", "output", "text"]
    )
    
    # Training arguments - adjusted for CPU
    training_args = TrainingArguments(
        output_dir=output_dir,
        learning_rate=1e-4,
        num_train_epochs=1 if not use_gpu else 3,  # Fewer epochs for CPU testing
        per_device_train_batch_size=1 if not use_gpu else 4,  # Smaller batch for CPU
        gradient_accumulation_steps=2 if not use_gpu else 4,
        warmup_ratio=0.03,
        logging_steps=10,
        save_strategy="epoch",
        report_to="tensorboard",
        fp16=use_gpu,  # Only use fp16 with GPU
        no_cuda=not use_gpu,  # Force CPU if no GPU available
    )
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer, 
        mlm=False
    )
    
    # Create trainer
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        data_collator=data_collator,
    )
    
    # Train model
    print("Starting training...")
    trainer.train()
    
    # Save model
    print(f"Saving model to {output_dir}")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    
    print("Training complete!")

if __name__ == "__main__":
    main() 