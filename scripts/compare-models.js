#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { execSync } = require('child_process');

// Import the aiClient - using dynamic import for ESM/TypeScript compatibility
let getCompletionFromModel;

// Load test prompts from benchmarks/prompts.json
let BENCHMARK_PROMPTS = [];
try {
  const promptsPath = path.join(process.cwd(), 'benchmarks/prompts.json');
  BENCHMARK_PROMPTS = JSON.parse(fs.readFileSync(promptsPath, 'utf-8'));
  console.log(chalk.green(`Loaded ${BENCHMARK_PROMPTS.length} benchmark prompts from prompts.json`));
} catch (error) {
  console.error(chalk.red(`Failed to load prompts from benchmarks/prompts.json: ${error.message}`));
  console.log(chalk.yellow('Falling back to default test prompts'));
  
  // Fallback to default prompts if file not found or invalid
  BENCHMARK_PROMPTS = [
    {
      id: "ui-button-basic",
      description: "Generate a React button component with props for label and onClick",
      input: "Create a React component for a customizable button with a label and onClick handler. Use Tailwind CSS."
    },
    {
      id: "form-validation",
      description: "Create a contact form with validation",
      input: "Create a contact form with name, email, and message fields with validation"
    }
  ];
}

// Models to test
const MODELS = [
  { name: "GPT-4o", model: "gpt-4o", type: "openai" },
  { name: "GPT-3.5 Turbo", model: "gpt-3.5-turbo", type: "openai" },
  { name: "DeepSeek Chat", model: "deepseek-chat", type: "deepseek" }
];

// Results storage
const results = {
  models: {},
  prompts: {},
  comparisons: []
};

// Output directory for results
const OUTPUT_DIR = path.join(process.cwd(), 'benchmark-results');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Real model API call implementation as specified in the prompt
async function runBenchmarkPrompt(model, input) {
  const start = Date.now();
  const response = await getCompletionFromModel(model.type, model.model, input);
  const end = Date.now();
  return {
    output: response,
    latencyMs: end - start,
    length: response.length,
  };
}

// Function to set up the aiClient from a temporary file if needed
async function setupAIClient() {
  try {
    // Create a minimal wrapper for getCompletionFromModel
    const tempFilePath = path.join(process.cwd(), 'scripts/temp-ai-client.js');
    
    // Simple implementation that connects to the real APIs
    const jsWrapper = `
const https = require('https');
const { env } = process.env;

// Function to make HTTP requests to model APIs
async function getCompletionFromModel(modelType, modelName, prompt) {
  if (modelType === 'openai') {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    
    // OpenAI API call
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${openaiApiKey}\`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant that generates clean, well-documented React components.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(\`OpenAI API error: \${error.error?.message || response.statusText}\`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
  } 
  else if (modelType === 'deepseek') {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      throw new Error('DEEPSEEK_API_KEY environment variable is not set');
    }
    
    // DeepSeek API call
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${deepseekApiKey}\`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant that generates clean, well-documented React components.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(\`DeepSeek API error: \${error.error?.message || response.statusText}\`);
    }
    
    const result = await response.json();
    return result.choices[0].message.content;
  }
  else {
    throw new Error(\`Unsupported model type: \${modelType}\`);
  }
}

module.exports = { getCompletionFromModel };
    `;
    
    // Write temporary client file
    fs.writeFileSync(tempFilePath, jsWrapper, 'utf8');
    
    // Import the client
    const aiClient = require('./temp-ai-client.js');
    getCompletionFromModel = aiClient.getCompletionFromModel;
    
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to set up AI client: ${error.message}`));
    return false;
  }
}

async function runComparison() {
  console.log(chalk.blue('=== PersLM Model Comparison Benchmark ==='));
  
  // Set up AI client
  const clientSetup = await setupAIClient();
  if (!clientSetup) {
    console.error(chalk.red('Failed to set up AI client. Exiting.'));
    process.exit(1);
  }
  
  console.log(`Testing ${MODELS.length} models with ${BENCHMARK_PROMPTS.length} prompts`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('');
  
  // Initialize results structure
  MODELS.forEach(model => {
    results.models[model.name] = {
      totalTime: 0,
      successCount: 0,
      failCount: 0,
      avgResponseTime: 0,
      avgOutputLength: 0
    };
  });
  
  BENCHMARK_PROMPTS.forEach(promptItem => {
    results.prompts[promptItem.id] = {
      results: {},
      bestModel: null,
      worstModel: null
    };
  });
  
  // Run benchmarks
  for (const promptItem of BENCHMARK_PROMPTS) {
    console.log(chalk.yellow(`\nTesting prompt: "${promptItem.description}"`));
    
    for (const model of MODELS) {
      console.log(chalk.cyan(`  Testing with model: ${model.name}`));
      
      try {
        // Call the real model API
        const benchmarkResult = await runBenchmarkPrompt(model, promptItem.input);
        
        console.log(chalk.green(`    Success! Response time: ${benchmarkResult.latencyMs}ms, Output length: ${benchmarkResult.length} chars`));
        
        // Store result
        results.models[model.name].totalTime += benchmarkResult.latencyMs;
        results.models[model.name].successCount += 1;
        results.models[model.name].avgOutputLength += benchmarkResult.length;
        
        results.prompts[promptItem.id].results[model.name] = {
          responseTime: benchmarkResult.latencyMs,
          outputLength: benchmarkResult.length,
          success: true,
          output: benchmarkResult.output
        };
        
        // Save output to file
        const outputFile = path.join(OUTPUT_DIR, `${promptItem.id}_${model.name.replace(/\s+/g, '-')}.txt`);
        fs.writeFileSync(outputFile, benchmarkResult.output);
      } catch (error) {
        console.log(chalk.red(`    Failed: ${error.message}`));
        
        results.models[model.name].failCount += 1;
        
        results.prompts[promptItem.id].results[model.name] = {
          responseTime: 0,
          outputLength: 0,
          success: false,
          error: error.message
        };
      }
    }
  }
  
  // Calculate averages and determine best models for each prompt
  MODELS.forEach(model => {
    const modelResults = results.models[model.name];
    const totalTests = modelResults.successCount + modelResults.failCount;
    
    if (modelResults.successCount > 0) {
      modelResults.avgResponseTime = modelResults.totalTime / modelResults.successCount;
      modelResults.avgOutputLength = modelResults.avgOutputLength / modelResults.successCount;
    }
    
    modelResults.successRate = (modelResults.successCount / totalTests) * 100;
  });
  
  // Determine best model for each prompt
  BENCHMARK_PROMPTS.forEach(promptItem => {
    let bestModel = null;
    let worstModel = null;
    let bestTime = Infinity;
    let worstTime = 0;
    
    MODELS.forEach(model => {
      const result = results.prompts[promptItem.id].results[model.name];
      if (result && result.success) {
        if (result.responseTime < bestTime) {
          bestTime = result.responseTime;
          bestModel = model.name;
        }
        
        if (result.responseTime > worstTime) {
          worstTime = result.responseTime;
          worstModel = model.name;
        }
      }
    });
    
    results.prompts[promptItem.id].bestModel = bestModel;
    results.prompts[promptItem.id].worstModel = worstModel;
  });
  
  // Generate overall comparison report
  console.log(chalk.blue('\n=== Benchmark Results ==='));
  
  console.log(chalk.yellow('\nModel Performance:'));
  MODELS.forEach(model => {
    const modelResults = results.models[model.name];
    console.log(`  ${model.name}:`);
    console.log(`    Success Rate: ${modelResults.successRate.toFixed(2)}%`);
    console.log(`    Avg Response Time: ${modelResults.avgResponseTime.toFixed(2)}ms`);
    console.log(`    Avg Output Length: ${modelResults.avgOutputLength.toFixed(0)} chars`);
  });
  
  console.log(chalk.yellow('\nPrompt Results:'));
  BENCHMARK_PROMPTS.forEach(promptItem => {
    const promptResults = results.prompts[promptItem.id];
    console.log(`  ${promptItem.description}:`);
    console.log(`    Best Model: ${promptResults.bestModel || 'None'}`);
    console.log(`    Worst Model: ${promptResults.worstModel || 'None'}`);
  });
  
  // Save results to file
  const resultsFile = path.join(OUTPUT_DIR, `model-comparison-results-${new Date().toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(chalk.green(`\nResults saved to: ${resultsFile}`));
  
  // Clean up temp file
  try {
    fs.unlinkSync(path.join(process.cwd(), 'scripts/temp-ai-client.js'));
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Run the comparison
runComparison().catch(error => {
  console.error(chalk.red(`Error running comparison: ${error.message}`));
  process.exit(1);
}); 