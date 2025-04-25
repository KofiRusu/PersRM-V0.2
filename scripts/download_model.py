import os
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from huggingface_hub import snapshot_download

def download_model(model_name: str, output_dir: str, trust_remote_code: bool = True):
    """Download model and tokenizer from HuggingFace."""
    print(f"Downloading model {model_name}...")
    
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # Download model files
    snapshot_download(
        repo_id=model_name,
        local_dir=output_dir,
        local_dir_use_symlinks=False,
        ignore_patterns=["*.md", "*.txt"]
    )
    
    print("Loading model and tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(
        output_dir,
        trust_remote_code=trust_remote_code
    )
    
    model = AutoModelForCausalLM.from_pretrained(
        output_dir,
        torch_dtype=torch.float16,
        trust_remote_code=trust_remote_code
    )
    
    print("Saving model and tokenizer...")
    model.save_pretrained(output_dir)
    tokenizer.save_pretrained(output_dir)
    
    print(f"Model and tokenizer saved to {output_dir}")

def main():
    import argparse
    parser = argparse.ArgumentParser(description='Download and prepare base model for PersLM')
    parser.add_argument('--model_name', type=str, default='mistralai/Mistral-7B-v0.1',
                      help='Name of the model to download')
    parser.add_argument('--output_dir', type=str, default='models/base',
                      help='Directory to save the model')
    parser.add_argument('--trust_remote_code', action='store_true',
                      help='Trust remote code when loading model')
    
    args = parser.parse_args()
    
    download_model(
        model_name=args.model_name,
        output_dir=args.output_dir,
        trust_remote_code=args.trust_remote_code
    )

if __name__ == '__main__':
    main() 