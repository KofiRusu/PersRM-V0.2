#!/usr/bin/env python
# Simple training script for reasoning model on macOS
# No GPU acceleration, just CPU training for testing

import os
import json
import torch
import logging
from torch.utils.data import Dataset, DataLoader
from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM,
    AdamW,
    get_linear_schedule_with_warmup
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Path to the JSONL file containing the reasoning data
DATASET_PATH = "./data/reasoning_instruction.jsonl"
OUTPUT_DIR = "./models/reasoning-finetuned-model"
MODEL_NAME = "gpt2"  # Use standard GPT-2 model for testing
MAX_LENGTH = 512
BATCH_SIZE = 1  # Small batch size for CPU
EPOCHS = 1
LEARNING_RATE = 1e-5

class ReasoningDataset(Dataset):
    """Custom dataset for reasoning training data"""
    
    def __init__(self, file_path, tokenizer, max_length=512):
        self.examples = []
        self.tokenizer = tokenizer
        self.max_length = max_length
        
        logger.info(f"Loading dataset from {file_path}")
        # Load data from JSONL file
        with open(file_path, 'r') as f:
            for line in f:
                try:
                    item = json.loads(line)
                    text = f"### Instruction:\n{item['instruction']}\n\n### Response:\n{item['output']}"
                    self.examples.append(text)
                except json.JSONDecodeError:
                    logger.warning(f"Skipping invalid JSON line in dataset")
                except KeyError:
                    logger.warning(f"Skipping line with missing keys in dataset")
        
        logger.info(f"Loaded {len(self.examples)} examples from dataset")
    
    def __len__(self):
        return len(self.examples)
    
    def __getitem__(self, idx):
        text = self.examples[idx]
        encoding = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt"
        )
        
        # Convert to correct shape (remove batch dimension)
        input_ids = encoding["input_ids"].squeeze()
        attention_mask = encoding["attention_mask"].squeeze()
        
        # For causal language modeling, labels are the same as input_ids
        return {
            "input_ids": input_ids,
            "attention_mask": attention_mask,
            "labels": input_ids.clone()
        }

def train():
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Check if CUDA is available
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info(f"Using device: {device}")
    
    # Initialize tokenizer and model
    logger.info(f"Loading model: {MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    
    try:
        model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
        logger.info("Model loaded successfully")
    except Exception as e:
        logger.error(f"Error loading DeepSeek model: {e}")
        logger.info("Falling back to GPT2 model for testing")
        model = AutoModelForCausalLM.from_pretrained("gpt2")
        tokenizer = AutoTokenizer.from_pretrained("gpt2")
    
    # Move model to device
    model = model.to(device)
    
    # Set pad token if needed
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # Load dataset
    dataset = ReasoningDataset(DATASET_PATH, tokenizer, MAX_LENGTH)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    # Prepare optimizer and schedule
    optimizer = AdamW(model.parameters(), lr=LEARNING_RATE)
    total_steps = len(dataloader) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(
        optimizer, 
        num_warmup_steps=int(0.1 * total_steps),
        num_training_steps=total_steps
    )
    
    # Training loop
    logger.info("Starting training...")
    model.train()
    
    for epoch in range(EPOCHS):
        logger.info(f"Epoch {epoch+1}/{EPOCHS}")
        total_loss = 0
        
        for batch_idx, batch in enumerate(dataloader):
            # Move batch to device
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)
            
            # Zero gradients
            optimizer.zero_grad()
            
            # Forward pass
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels
            )
            
            loss = outputs.loss
            total_loss += loss.item()
            
            # Backward pass
            loss.backward()
            
            # Clip gradients
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            
            # Update weights
            optimizer.step()
            scheduler.step()
            
            # Print progress
            if batch_idx % 5 == 0:
                logger.info(f"  Batch {batch_idx}/{len(dataloader)}, Loss: {loss.item():.4f}")
        
        avg_loss = total_loss / len(dataloader)
        logger.info(f"  Average loss: {avg_loss:.4f}")
    
    # Save model
    logger.info(f"Saving model to {OUTPUT_DIR}")
    
    try:
        model.save_pretrained(OUTPUT_DIR)
        tokenizer.save_pretrained(OUTPUT_DIR)
        logger.info("Model saved successfully")
    except Exception as e:
        logger.error(f"Error saving model: {e}")
    
    logger.info("Training complete!")

if __name__ == "__main__":
    train() 