import { openai } from '@/lib/openai';
import { RetentionService, LearningEntry, LogResult } from '../memory/retentionService';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface TuningOptions {
  filter?: LogResult | 'all';
  component?: string;
  minEntries?: number;
  targetModel?: string;
  epochs?: number;
  rank?: number;
  alpha?: number;
  useSynthetic?: boolean;
}

export interface TuningResult {
  success: boolean;
  model?: string;
  trainingTime?: number;
  entriesUsed?: number;
  error?: string;
  promptEngineered?: boolean;
}

export interface PromptTemplate {
  role: string;
  content: string;
}

/**
 * Service for tuning models based on learning data
 */
export class ModelTuner {
  private retentionService: RetentionService;
  
  constructor() {
    this.retentionService = new RetentionService();
  }
  
  /**
   * Generate a fine-tuned model or improved prompts
   */
  async tuneModel(options: TuningOptions): Promise<TuningResult> {
    const {
      filter = 'all',
      component,
      minEntries = 10,
      targetModel = 'deepseek-ai/deepseek-coder-6.7b-base',
      epochs = 2,
      rank = 16,
      alpha = 32,
      useSynthetic = true
    } = options;
    
    try {
      // Get learning entries based on filter
      let entries: LearningEntry[] = [];
      if (filter === 'all') {
        if (component) {
          entries = await this.retentionService.getEntriesByComponent(component);
        } else {
          // Combine entries from all result types
          const successEntries = await this.retentionService.getEntriesByResult('success');
          const failureEntries = await this.retentionService.getEntriesByResult('failure');
          const improvedEntries = await this.retentionService.getEntriesByResult('improved');
          entries = [...successEntries, ...failureEntries, ...improvedEntries];
        }
      } else {
        entries = await this.retentionService.getEntriesByResult(filter);
        if (component) {
          entries = entries.filter(entry => entry.component === component);
        }
      }
      
      // Check if we have enough entries
      if (entries.length < minEntries) {
        if (useSynthetic) {
          console.log(`Only ${entries.length} entries found, generating synthetic examples...`);
          const syntheticEntries = await this.generateSyntheticExamples(entries, minEntries - entries.length);
          entries = [...entries, ...syntheticEntries];
        } else {
          return {
            success: false,
            error: `Not enough learning entries. Found ${entries.length}, needed ${minEntries}`,
            promptEngineered: false
          };
        }
      }
      
      // Prepare dataset for fine-tuning
      const dataset = await this.prepareFineTuningDataset(entries);
      
      // Check if we should do LoRA fine-tuning or just prompt engineering
      if (entries.length >= 50 && targetModel) {
        // Enough data for LoRA fine-tuning
        const startTime = Date.now();
        
        // Prepare and save dataset
        const datasetPath = path.join(process.cwd(), 'data', 'fine-tuning.jsonl');
        this.saveDatasetToFile(dataset, datasetPath);
        
        // Run fine-tuning
        const modelName = await this.runFineTuning(datasetPath, targetModel, epochs, rank, alpha);
        
        const endTime = Date.now();
        const trainingTime = (endTime - startTime) / 1000; // Convert to seconds
        
        return {
          success: true,
          model: modelName,
          trainingTime,
          entriesUsed: entries.length,
          promptEngineered: false
        };
      } else {
        // Not enough data, use prompt engineering instead
        const engineeredPrompts = await this.generateImprovedPrompts(entries);
        
        // Save engineered prompts
        const promptsPath = path.join(process.cwd(), 'data', 'engineered-prompts.json');
        fs.writeFileSync(promptsPath, JSON.stringify(engineeredPrompts, null, 2));
        
        return {
          success: true,
          entriesUsed: entries.length,
          promptEngineered: true
        };
      }
    } catch (error) {
      console.error('Error tuning model:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        promptEngineered: false
      };
    }
  }
  
  /**
   * Generate synthetic examples to augment training data
   */
  private async generateSyntheticExamples(baseEntries: LearningEntry[], count: number): Promise<LearningEntry[]> {
    const client = openai;
    if (!client) {
      throw new Error('OpenAI client not configured');
    }
    
    if (baseEntries.length === 0) {
      return [];
    }
    
    const syntheticEntries: LearningEntry[] = [];
    
    // Generate synthetic examples using the patterns from existing entries
    const systemPrompt = `
      You are an expert at generating synthetic training examples for AI models.
      Based on the provided examples, generate new, diverse but realistic examples that follow the same patterns.
      Each example should have similar structure but different content.
    `;
    
    const userPrompt = `
      Here are some example entries from our learning system:
      
      ${baseEntries.slice(0, 5).map(entry => JSON.stringify(entry, null, 2)).join('\n\n')}
      
      Generate ${count} new, realistic synthetic examples following the same patterns but with different content.
      Return the examples as a valid JSON array.
    `;
    
    try {
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });
      
      const result = response.choices[0]?.message.content;
      if (result) {
        try {
          const parsed = JSON.parse(result);
          const examples = Array.isArray(parsed) ? parsed : (parsed.examples || []);
          
          for (const example of examples.slice(0, count)) {
            if (this.isValidLearningEntry(example)) {
              syntheticEntries.push(example);
            }
          }
        } catch (error) {
          console.error('Error parsing synthetic examples:', error);
        }
      }
    } catch (error) {
      console.error('Error generating synthetic examples:', error);
    }
    
    // If we still don't have enough, create some by modifying existing ones
    while (syntheticEntries.length < count && baseEntries.length > 0) {
      const baseEntry = baseEntries[Math.floor(Math.random() * baseEntries.length)];
      syntheticEntries.push(this.modifyEntry(baseEntry, syntheticEntries.length));
    }
    
    return syntheticEntries;
  }
  
  /**
   * Check if an object is a valid LearningEntry
   */
  private isValidLearningEntry(obj: any): boolean {
    return (
      obj &&
      typeof obj.taskId === 'string' &&
      typeof obj.component === 'string' &&
      obj.input &&
      obj.output &&
      ['success', 'failure', 'improved'].includes(obj.result)
    );
  }
  
  /**
   * Create a modified copy of an entry for synthetic data
   */
  private modifyEntry(entry: LearningEntry, index: number): LearningEntry {
    // Create a deep copy
    const newEntry: LearningEntry = JSON.parse(JSON.stringify(entry));
    
    // Modify taskId to make it unique
    newEntry.taskId = `synthetic-${entry.taskId}-${index}`;
    
    // Slightly modify the input
    if (typeof newEntry.input.prompt === 'string') {
      newEntry.input.prompt = this.modifyText(newEntry.input.prompt);
    }
    
    // Slightly modify the output if it has code
    if (typeof newEntry.output.code === 'string') {
      newEntry.output.code = this.modifyCode(newEntry.output.code);
    }
    
    return newEntry;
  }
  
  /**
   * Modify text for synthetic data
   */
  private modifyText(text: string): string {
    // Simple function to slightly modify text
    const modifiers = [
      () => text.replace(/component/g, 'element'),
      () => text.replace(/button/g, 'button control'),
      () => text.replace(/create/g, 'build'),
      () => text.replace(/make/g, 'develop'),
      () => text.charAt(0).toLowerCase() + text.slice(1),
      () => text + ' with good UX',
      () => 'Please ' + text.toLowerCase(),
      () => text.replace(/UI/g, 'user interface'),
    ];
    
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    return modifier();
  }
  
  /**
   * Modify code for synthetic data
   */
  private modifyCode(code: string): string {
    // Simple function to slightly modify code
    const modifiers = [
      () => code.replace(/className=/g, 'className ='),
      () => code.replace(/const /g, 'let '),
      () => code.replace(/\/\/ /g, '// Comment: '),
      () => code.replace(/padding/g, 'padding'),
      () => code.replace(/margin/g, 'margin'),
      () => code.replace(/flex/g, 'flex'),
      () => code.replace(/grid/g, 'grid'),
    ];
    
    const modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
    return modifier();
  }
  
  /**
   * Prepare dataset for fine-tuning
   */
  private async prepareFineTuningDataset(entries: LearningEntry[]): Promise<string[]> {
    // Convert entries to the format expected by fine-tuning
    return entries.map(entry => {
      let instruction = '';
      let output = '';
      
      // Format depends on the component type
      if (entry.component === 'ui-generator') {
        instruction = `Generate a UI component based on this prompt: ${entry.input.prompt || ''}`;
        output = entry.output.code || '';
      } else if (entry.component === 'reasoning') {
        instruction = `Explain the UI/UX reasoning for this question: ${entry.input.question || ''}`;
        output = entry.output.reasoning || '';
      } else if (entry.component === 'route-generator') {
        instruction = `Generate a route based on this specification: ${entry.input.spec || ''}`;
        output = entry.output.code || '';
      } else {
        // Generic format
        instruction = `Task for ${entry.component}: ${JSON.stringify(entry.input)}`;
        output = JSON.stringify(entry.output);
      }
      
      // Format for JSONL fine-tuning
      return JSON.stringify({
        instruction,
        output
      });
    });
  }
  
  /**
   * Save dataset to file for fine-tuning
   */
  private saveDatasetToFile(dataset: string[], filePath: string): void {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write to file
    fs.writeFileSync(filePath, dataset.join('\n'));
  }
  
  /**
   * Run fine-tuning process
   */
  private async runFineTuning(
    datasetPath: string, 
    baseModel: string, 
    epochs: number, 
    rank: number,
    alpha: number
  ): Promise<string> {
    // Create a timestamp for the model name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const modelName = `perslm-ft-${timestamp}`;
    
    // Build command for fine-tuning
    const command = `pnpm train-lora \
      --model ${baseModel} \
      --dataset ${datasetPath} \
      --output-dir ./models/${modelName} \
      --epochs ${epochs} \
      --rank ${rank} \
      --alpha ${alpha} \
      --batch-size 4 \
      --learning-rate 5e-5`;
    
    console.log(`Running fine-tuning command: ${command}`);
    
    try {
      // Execute the command
      const { stdout, stderr } = await execAsync(command);
      console.log('Fine-tuning stdout:', stdout);
      if (stderr) {
        console.error('Fine-tuning stderr:', stderr);
      }
      
      return modelName;
    } catch (error) {
      console.error('Error during fine-tuning:', error);
      throw new Error(`Fine-tuning failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Generate improved prompts based on learning entries
   */
  private async generateImprovedPrompts(entries: LearningEntry[]): Promise<Record<string, PromptTemplate[]>> {
    const client = openai;
    if (!client) {
      throw new Error('OpenAI client not configured');
    }
    
    // Group entries by component
    const entriesByComponent: Record<string, LearningEntry[]> = {};
    entries.forEach(entry => {
      if (!entriesByComponent[entry.component]) {
        entriesByComponent[entry.component] = [];
      }
      entriesByComponent[entry.component].push(entry);
    });
    
    const improvedPrompts: Record<string, PromptTemplate[]> = {};
    
    // For each component, generate improved prompts
    for (const [component, componentEntries] of Object.entries(entriesByComponent)) {
      // Extract successful and failed entries
      const successEntries = componentEntries.filter(entry => entry.result === 'success');
      const failureEntries = componentEntries.filter(entry => entry.result === 'failure');
      
      const systemPrompt = `
        You are an expert at prompt engineering for AI models.
        Analyze successful and failed interactions with our ${component} system, and suggest improved prompt templates
        that would increase the success rate and quality of generated outputs.
        
        For each component, provide:
        1. A system prompt template
        2. A user prompt template with placeholders for variables
        
        Return these as JSON objects with "role" and "content" fields.
      `;
      
      const userPrompt = `
        Component: ${component}
        
        ${successEntries.length > 0 ? `
        Successful Interactions:
        ${successEntries.slice(0, 3).map(entry => JSON.stringify({
          input: entry.input,
          output: entry.output
        }, null, 2)).join('\n\n')}
        ` : ''}
        
        ${failureEntries.length > 0 ? `
        Failed Interactions:
        ${failureEntries.slice(0, 3).map(entry => JSON.stringify({
          input: entry.input,
          output: entry.output,
          errorType: entry.errorType
        }, null, 2)).join('\n\n')}
        ` : ''}
        
        Based on these examples, suggest improved system and user prompt templates that would:
        1. Increase success rate
        2. Handle edge cases better
        3. Produce higher quality outputs
        
        Return the templates as a JSON array with each object having "role" and "content" fields.
      `;
      
      try {
        const response = await client.chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
          response_format: { type: 'json_object' }
        });
        
        const result = response.choices[0]?.message.content;
        if (result) {
          try {
            const parsed = JSON.parse(result);
            const templates = Array.isArray(parsed) ? parsed : (parsed.templates || []);
            
            improvedPrompts[component] = templates.map(template => ({
              role: template.role || 'user',
              content: template.content || ''
            }));
          } catch (error) {
            console.error(`Error parsing prompt templates for ${component}:`, error);
            improvedPrompts[component] = [];
          }
        }
      } catch (error) {
        console.error(`Error generating improved prompts for ${component}:`, error);
        improvedPrompts[component] = [];
      }
    }
    
    return improvedPrompts;
  }
} 