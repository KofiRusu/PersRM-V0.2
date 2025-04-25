#!/usr/bin/env python
# Test the fine-tuned reasoning model

import torch
from transformers import GPT2Tokenizer, GPT2LMHeadModel

# Paths
MODEL_PATH = "./models/simple-reasoning-model"

# Test questions
TEST_QUESTIONS = [
    "When should I use a modal dialog vs. a slide-over panel?",
    "What's the best pattern for form validation in a multi-step checkout?",
    "How should I design loading states in a dashboard?",
    "What's the most accessible approach to implement a dropdown menu?"
]

def generate_reasoning(model, tokenizer, question, max_length=512):
    """Generate reasoning for a given UI/UX question"""
    prompt = f"### Instruction:\n{question}\n\n### Response:"
    
    # Encode the prompt
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=max_length)
    
    # Generate the completion
    with torch.no_grad():
        output = model.generate(
            inputs["input_ids"],
            max_length=max_length,
            num_return_sequences=1,
            temperature=0.7,
            top_p=0.9,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id
        )
    
    # Decode and return the generated text
    generated_text = tokenizer.decode(output[0], skip_special_tokens=True)
    
    # Extract the response part
    response = generated_text.split("### Response:", 1)[-1].strip()
    return response

def main():
    # Load the model and tokenizer
    print(f"Loading model from {MODEL_PATH}")
    try:
        tokenizer = GPT2Tokenizer.from_pretrained(MODEL_PATH)
        model = GPT2LMHeadModel.from_pretrained(MODEL_PATH)
        
        # Set pad token if needed
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
    except Exception as e:
        print(f"Error loading model: {e}")
        print("Falling back to base model (distilgpt2)")
        tokenizer = GPT2Tokenizer.from_pretrained("distilgpt2")
        model = GPT2LMHeadModel.from_pretrained("distilgpt2")
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
    
    # Test the model on sample questions
    for i, question in enumerate(TEST_QUESTIONS):
        print(f"\n--- Test Question {i+1} ---")
        print(f"Question: {question}")
        print("\nGenerating reasoning...")
        
        try:
            reasoning = generate_reasoning(model, tokenizer, question)
            print("\nReasoning:")
            print(reasoning)
        except Exception as e:
            print(f"Error generating reasoning: {e}")
        
        print("-" * 50)

if __name__ == "__main__":
    main() 