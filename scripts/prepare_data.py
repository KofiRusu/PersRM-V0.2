import os
import json
import argparse
import random
from typing import List, Dict, Optional
import datasets
from tqdm import tqdm
import pandas as pd

def load_text_files(directory: str) -> List[str]:
    """Load text files from a directory."""
    texts = []
    for filename in os.listdir(directory):
        if filename.endswith('.txt'):
            with open(os.path.join(directory, filename), 'r', encoding='utf-8') as f:
                texts.append(f.read())
    return texts

def load_huggingface_dataset(dataset_name: str, split: str = "train", text_field: str = "text") -> List[str]:
    """Load dataset from HuggingFace datasets hub."""
    print(f"Loading dataset {dataset_name}, split: {split}")
    dataset = datasets.load_dataset(dataset_name, split=split)
    
    if text_field not in dataset.column_names:
        available_columns = ', '.join(dataset.column_names)
        raise ValueError(f"Field '{text_field}' not found in dataset. Available columns: {available_columns}")
    
    return dataset[text_field]

def clean_text(text: str) -> str:
    """Clean text by removing excessive newlines, fixing spacing, etc."""
    # Replace multiple newlines with a single newline
    text = '\n'.join(line.strip() for line in text.split('\n') if line.strip())
    
    # Fix spacing around punctuation
    for punct in ['.', ',', '!', '?', ':', ';']:
        text = text.replace(f' {punct}', punct)
    
    # Remove HTML tags (simple implementation)
    text = text.replace('<br>', '\n').replace('<br />', '\n')
    
    return text

def process_text(text: str, min_length: int = 50, max_length: int = 4096) -> List[str]:
    """Process text into chunks of appropriate length."""
    # Clean the text first
    text = clean_text(text)
    
    # Split into paragraphs
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for para in paragraphs:
        para_length = len(para.split())
        if current_length + para_length > max_length:
            if current_length >= min_length:
                chunks.append(' '.join(current_chunk))
            current_chunk = [para]
            current_length = para_length
        else:
            current_chunk.append(para)
            current_length += para_length
    
    if current_length >= min_length:
        chunks.append(' '.join(current_chunk))
    
    return chunks

def save_jsonl(data: List[Dict], output_file: str):
    """Save data in JSONL format."""
    with open(output_file, 'w', encoding='utf-8') as f:
        for item in data:
            f.write(json.dumps(item) + '\n')

def save_dataset_stats(dataset_info: Dict, output_file: str):
    """Save dataset statistics and metadata."""
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(dataset_info, f, indent=2)

def main():
    parser = argparse.ArgumentParser(description='Prepare training data for PersLM')
    parser.add_argument('--input_dir', type=str, help='Directory containing input text files')
    parser.add_argument('--output_dir', type=str, required=True, help='Directory to save processed data')
    parser.add_argument('--min_length', type=int, default=50, help='Minimum chunk length in words')
    parser.add_argument('--max_length', type=int, default=4096, help='Maximum chunk length in words')
    parser.add_argument('--train_ratio', type=float, default=0.95, help='Ratio of data to use for training')
    parser.add_argument('--seed', type=int, default=42, help='Random seed for reproducibility')
    parser.add_argument('--hf_dataset', type=str, help='HuggingFace dataset to use, e.g., "openai/webgpt_comparisons"')
    parser.add_argument('--hf_split', type=str, default="train", help='HuggingFace dataset split to use')
    parser.add_argument('--hf_text_field', type=str, default="text", help='Field containing text in HF dataset')
    parser.add_argument('--max_samples', type=int, help='Maximum number of samples to use (default: use all)')
    
    args = parser.parse_args()
    
    # Set random seed for reproducibility
    random.seed(args.seed)
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Initialize all_chunks list
    all_chunks = []
    dataset_info = {
        "source": [],
        "num_original_samples": 0,
        "num_processed_chunks": 0,
        "min_length": args.min_length,
        "max_length": args.max_length,
        "train_ratio": args.train_ratio,
        "seed": args.seed
    }
    
    # Load local text files if input_dir is provided
    if args.input_dir:
        print(f"Loading text files from {args.input_dir}...")
        texts = load_text_files(args.input_dir)
        dataset_info["source"].append({"type": "local_files", "path": args.input_dir, "count": len(texts)})
        dataset_info["num_original_samples"] += len(texts)
        
        # Process texts into chunks
        print("Processing local text files into chunks...")
        for text in tqdm(texts):
            chunks = process_text(text, args.min_length, args.max_length)
            all_chunks.extend(chunks)
    
    # Load HuggingFace dataset if specified
    if args.hf_dataset:
        print(f"Loading HuggingFace dataset: {args.hf_dataset}")
        try:
            texts = load_huggingface_dataset(args.hf_dataset, args.hf_split, args.hf_text_field)
            dataset_info["source"].append({
                "type": "huggingface", 
                "dataset": args.hf_dataset, 
                "split": args.hf_split,
                "count": len(texts)
            })
            dataset_info["num_original_samples"] += len(texts)
            
            # Process texts into chunks
            print("Processing HuggingFace dataset into chunks...")
            for text in tqdm(texts):
                chunks = process_text(text, args.min_length, args.max_length)
                all_chunks.extend(chunks)
        except Exception as e:
            print(f"Error loading HuggingFace dataset: {e}")
    
    # Apply max_samples limit if specified
    if args.max_samples and len(all_chunks) > args.max_samples:
        print(f"Limiting to {args.max_samples} samples from {len(all_chunks)} total chunks")
        all_chunks = all_chunks[:args.max_samples]
    
    # Shuffle chunks for better data distribution
    print("Shuffling data chunks...")
    random.shuffle(all_chunks)
    
    dataset_info["num_processed_chunks"] = len(all_chunks)
    
    # Split into train and eval
    split_idx = int(len(all_chunks) * args.train_ratio)
    train_chunks = all_chunks[:split_idx]
    eval_chunks = all_chunks[split_idx:]
    
    # Save processed data
    print("Saving processed data...")
    train_data = [{'text': chunk} for chunk in train_chunks]
    eval_data = [{'text': chunk} for chunk in eval_chunks]
    
    train_file = os.path.join(args.output_dir, 'train.jsonl')
    eval_file = os.path.join(args.output_dir, 'eval.jsonl')
    stats_file = os.path.join(args.output_dir, 'dataset_stats.json')
    
    save_jsonl(train_data, train_file)
    save_jsonl(eval_data, eval_file)
    save_dataset_stats(dataset_info, stats_file)
    
    print(f"Processed {len(train_chunks)} training chunks and {len(eval_chunks)} evaluation chunks")
    print(f"Data saved to {args.output_dir}")
    print(f"Stats saved to {stats_file}")

if __name__ == '__main__':
    main() 