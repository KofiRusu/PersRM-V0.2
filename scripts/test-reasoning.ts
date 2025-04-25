#!/usr/bin/env node

/**
 * CLI tool to test UI/UX reasoning prompts against local or remote models
 * 
 * Usage:
 * ```
 * npm run test-reasoning "When should I use a modal dialog vs. a slide-over panel?"
 * ```
 */

import { program } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import chalk from 'chalk';
import ora from 'ora';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

// Check if a local model is running
async function isLocalModelAvailable(url = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434'): Promise<boolean> {
  try {
    const response = await fetch(`${url}/api/health`, {
      method: 'GET',
      timeout: 2000
    });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Check if a fine-tuned model is available
async function isFineTunedModelAvailable(): Promise<boolean> {
  const modelPath = path.join(process.cwd(), 'results', 'reasoning-lora-final');
  return fs.existsSync(modelPath);
}

// Get API key from .env or ask user
function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(chalk.red('OpenAI API key not found.'));
    console.error(chalk.yellow('Please set OPENAI_API_KEY in your .env file'));
    process.exit(1);
  }
  return apiKey;
}

// Reasoning with OpenAI
async function reasonWithOpenAI(prompt: string): Promise<string> {
  const spinner = ora('Generating reasoning with OpenAI...').start();
  
  try {
    const apiKey = getOpenAIApiKey();
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert UI/UX designer and frontend developer specializing in React, Next.js, TailwindCSS, and shadcn/ui. Your task is to provide detailed reasoning about UI/UX patterns and design decisions, covering analysis, approaches, best practices, accessibility, implementation details, and examples.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    spinner.succeed('Reasoning generated successfully with OpenAI!');
    return response.choices[0]?.message.content || 'No response generated.';
  } catch (error) {
    spinner.fail(`OpenAI API error: ${error instanceof Error ? error.message : String(error)}`);
    return `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
  }
}

// Reasoning with local model via API
async function reasonWithLocalModel(prompt: string): Promise<string> {
  const spinner = ora('Generating reasoning with local model...').start();
  const baseUrl = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434';
  
  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'reasoning-lora',
        prompt: `User Question: ${prompt}\n\nReasoning:`,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Local model API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    spinner.succeed('Reasoning generated successfully with local model!');
    return data.response || 'No response generated.';
  } catch (error) {
    spinner.fail(`Local model error: ${error instanceof Error ? error.message : String(error)}`);
    console.log(chalk.yellow('Falling back to OpenAI...'));
    return reasonWithOpenAI(prompt);
  }
}

// Main function
async function generateReasoning(prompt: string, useOpenAI = false): Promise<void> {
  console.log(chalk.bold('📝 UI/UX Reasoning Prompt Test\n'));
  console.log(chalk.cyan('Prompt:'), prompt);
  console.log();
  
  let result: string;
  
  // Determine which model to use
  if (useOpenAI) {
    result = await reasonWithOpenAI(prompt);
  } else {
    const localAvailable = await isLocalModelAvailable();
    const fineTunedAvailable = await isFineTunedModelAvailable();
    
    if (localAvailable && fineTunedAvailable) {
      result = await reasonWithLocalModel(prompt);
    } else {
      console.log(chalk.yellow('Local model not available. Using OpenAI instead.'));
      result = await reasonWithOpenAI(prompt);
    }
  }
  
  // Output the result
  console.log(chalk.green('\nReasoning Result:\n'));
  console.log(result);
}

// CLI setup
program
  .name('test-reasoning')
  .description('Test UI/UX reasoning prompts against local or remote models')
  .version('1.0.0')
  .argument('<prompt>', 'The UI/UX question or prompt to reason about')
  .option('-o, --openai', 'Force using OpenAI instead of local model')
  .action(async (prompt, options) => {
    await generateReasoning(prompt, options.openai);
  });

program.parse();

// If no arguments, show help
if (process.argv.length <= 2) {
  program.help();
} 