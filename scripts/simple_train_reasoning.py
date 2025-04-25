#!/usr/bin/env python
# Simple training script for reasoning model on macOS
# No GPU acceleration, just CPU training for testing

import os
import json
import torch
from torch.utils.data import Dataset, DataLoader
from transformers import (
    GPT2Tokenizer, 
    GPT2LMHeadModel,
    AdamW,
    get_linear_schedule_with_warmup
)

# Path to the JSONL file containing the reasoning data
DATASET_PATH = "./data/reasoning_instruction.jsonl"
OUTPUT_DIR = "./models/simple-reasoning-model"
MODEL_NAME = "distilgpt2"  # Using a small model for testing
MAX_LENGTH = 512
BATCH_SIZE = 2
EPOCHS = 1
LEARNING_RATE = 5e-5

class ReasoningDataset(Dataset):
    """Custom dataset for reasoning training data"""
    
    def __init__(self, file_path, tokenizer, max_length=512):
        self.examples = []
        self.tokenizer = tokenizer
        self.max_length = max_length
        
        # Load data from JSONL file
        with open(file_path, 'r') as f:
            for line in f:
                item = json.loads(line)
                text = f"### Instruction:\n{item['instruction']}\n\n### Response:\n{item['output']}"
                self.examples.append(text)
    
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
    
    # Initialize tokenizer and model
    print(f"Loading model: {MODEL_NAME}")
    tokenizer = GPT2Tokenizer.from_pretrained(MODEL_NAME)
    model = GPT2LMHeadModel.from_pretrained(MODEL_NAME)
    
    # Set pad token
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    
    # Load dataset
    print(f"Loading dataset from {DATASET_PATH}")
    dataset = ReasoningDataset(DATASET_PATH, tokenizer, MAX_LENGTH)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    # Prepare optimizer and schedule
    optimizer = AdamW(model.parameters(), lr=LEARNING_RATE)
    total_steps = len(dataloader) * EPOCHS
    scheduler = get_linear_schedule_with_warmup(
        optimizer, 
        num_warmup_steps=0,
        num_training_steps=total_steps
    )
    
    # Training loop
    print("Starting training...")
    model.train()
    for epoch in range(EPOCHS):
        print(f"Epoch {epoch+1}/{EPOCHS}")
        total_loss = 0
        
        for batch_idx, batch in enumerate(dataloader):
            # Move batch to device
            input_ids = batch["input_ids"]
            attention_mask = batch["attention_mask"]
            labels = batch["labels"]
            
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
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()
            
            # Print progress
            if (batch_idx + 1) % 10 == 0:
                print(f"  Batch {batch_idx+1}/{len(dataloader)}, Loss: {loss.item():.4f}")
        
        avg_loss = total_loss / len(dataloader)
        print(f"  Average loss: {avg_loss:.4f}")
    
    # Save model
    print(f"Saving model to {OUTPUT_DIR}")
    model.save_pretrained(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    print("Training complete!")

if __name__ == "__main__":
    train() 