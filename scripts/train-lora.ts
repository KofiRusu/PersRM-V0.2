/**
 * Configuration script for fine-tuning the reasoning model using LoRA
 * 
 * This script sets up the training configuration for fine-tuning
 * the deepseek-coder-6.7b-base model on our UI/UX reasoning dataset.
 * 
 * Usage:
 * ```
 * npm run train-lora
 * ```
 */

import { AutoTokenizer, AutoModelForCausalLM } from '@huggingface/transformers';
import { LoRAConfig, get_peft_model } from '@huggingface/peft';
import { Trainer, TrainingArguments } from '@huggingface/transformers';
import { TextDataset } from '@huggingface/datasets';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log("Starting LoRA fine-tuning setup...");

  // 1. Prepare the tokenizer
  console.log("Loading tokenizer...");
  const tokenizer = await AutoTokenizer.from_pretrained(
    "deepseek-ai/deepseek-coder-6.7b-base",
    {
      padding_side: 'right',
      use_fast: true
    }
  );

  // Set special tokens
  tokenizer.pad_token = tokenizer.eos_token;
  
  // 2. Load the base model
  console.log("Loading base model...");
  const model = await AutoModelForCausalLM.from_pretrained(
    "deepseek-ai/deepseek-coder-6.7b-base",
    {
      device_map: "auto",
      torch_dtype: "float16"
    }
  );

  // 3. Configure LoRA
  console.log("Configuring LoRA parameters...");
  const lora_config = new LoRAConfig(
    {
      r: 16,               // Rank of the update matrices
      lora_alpha: 32,      // LoRA scaling factor
      lora_dropout: 0.05,  // Dropout probability for LoRA layers
      bias: "none",        // Add bias to the LoRA layers ("none", "all", or "lora_only")
      task_type: "CAUSAL_LM",
      target_modules: [    // Modules to apply LoRA to
        "q_proj",
        "k_proj",
        "v_proj",
        "o_proj"
      ]
    }
  );

  // 4. Apply LoRA config to the model
  console.log("Applying LoRA configuration to model...");
  const peft_model = get_peft_model(model, lora_config);
  
  // 5. Prepare the dataset
  console.log("Loading and preparing dataset...");
  const dataset_path = path.join(process.cwd(), 'data', 'reasoning.jsonl');
  
  if (!fs.existsSync(dataset_path)) {
    throw new Error(`Dataset file not found at: ${dataset_path}`);
  }
  
  const dataset = await TextDataset.from_json(
    dataset_path,
    {
      text_column: "instruction",  // Input column
      label_column: "output"       // Output column
    }
  );
  
  // Split dataset into training and validation
  const split_dataset = dataset.train_test_split({
    test_size: 0.1,
    seed: 42
  });
  
  // 6. Define training arguments
  console.log("Setting up training arguments...");
  const training_args = new TrainingArguments({
    output_dir: "./results/reasoning-lora",
    num_train_epochs: 3,
    per_device_train_batch_size: 4,
    per_device_eval_batch_size: 4,
    gradient_accumulation_steps: 4,
    evaluation_strategy: "steps",
    eval_steps: 100,
    save_strategy: "steps",
    save_steps: 100,
    save_total_limit: 3,
    learning_rate: 2e-4,
    weight_decay: 0.01,
    warmup_steps: 100,
    lr_scheduler_type: "cosine",
    logging_steps: 10,
    report_to: "tensorboard",
    seed: 42,
    fp16: true,
    push_to_hub: false
  });
  
  // 7. Setup Trainer
  console.log("Initializing trainer...");
  const trainer = new Trainer({
    model: peft_model,
    args: training_args,
    train_dataset: split_dataset.train,
    eval_dataset: split_dataset.test,
    tokenizer: tokenizer,
  });
  
  // 8. Start training
  console.log("Starting training process...");
  await trainer.train();
  
  // 9. Save the trained model
  console.log("Saving fine-tuned model...");
  await trainer.save_model("./results/reasoning-lora-final");
  
  console.log("Fine-tuning completed successfully!");
}

// Run the main function
main().catch((error) => {
  console.error("Error during training:", error);
  process.exit(1);
}); 