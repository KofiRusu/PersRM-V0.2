import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModelTuner } from '../../lib/retraining/modelTuner';
import { RetentionService, LearningEntry } from '../../lib/memory/retentionService';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

// Mock RetentionService
vi.mock('../../lib/memory/retentionService', () => {
  return {
    RetentionService: vi.fn().mockImplementation(() => ({
      getEntriesByResult: vi.fn(),
      getEntriesByComponent: vi.fn(),
      getEntries: vi.fn()
    }))
  };
});

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockImplementation((path) => {
    if (path.includes('data')) {
      return Promise.resolve();
    }
    return Promise.reject(new Error('File does not exist'));
  })
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    callback(null, 'Success output', '');
  }),
  execSync: vi.fn().mockReturnValue(Buffer.from('mock output'))
}));

// Mock OpenAI
vi.mock('@/lib/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    input: { prompt: "Create a responsive navbar" },
                    expected_reasoning: "A responsive navbar should adapt to different screen sizes..."
                  },
                  {
                    input: { prompt: "Create a mobile menu" },
                    expected_reasoning: "A mobile menu should be easily accessible..."
                  }
                ])
              }
            }
          ]
        })
      }
    }
  }
}));

describe('ModelTuner', () => {
  let modelTuner: ModelTuner;
  let retentionService: RetentionService;
  
  beforeEach(() => {
    vi.clearAllMocks();
    retentionService = new RetentionService();
    modelTuner = new ModelTuner(retentionService);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  test('tuneModel with sufficient entries runs fine-tuning', async () => {
    // Mock learning entries
    const mockEntries: LearningEntry[] = Array(15).fill(null).map((_, i) => ({
      taskId: `task-${i}`,
      component: 'ui-generator',
      input: { prompt: `Create a component ${i}` },
      output: { code: `<div>Component ${i}</div>` },
      result: 'success',
      feedback: 'Great component!'
    }));
    
    (retentionService.getEntries as jest.Mock).mockResolvedValue(mockEntries);
    
    const result = await modelTuner.tuneModel({
      filter: 'success',
      component: 'ui-generator',
      minEntries: 10,
      targetModel: 'test-model',
      epochs: 2,
      rank: 16,
      alpha: 32
    });
    
    expect(result.success).toBe(true);
    expect(result.modelName).toBe('test-model-ft');
    expect(result.entriesUsed).toBe(15);
    
    // Verify that writeFile was called with the correct arguments
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('data/fine-tuning.jsonl'),
      expect.any(String)
    );
    
    // Verify that exec was called
    expect(exec).toHaveBeenCalled();
    const execCall = vi.mocked(exec).mock.calls[0][0] as string;
    expect(execCall).toContain('test-model');
    expect(execCall).toContain('--epochs 2');
  });
  
  test('tuneModel with insufficient entries generates synthetic examples', async () => {
    // Mock learning entries - not enough for fine-tuning
    const mockEntries: LearningEntry[] = Array(5).fill(null).map((_, i) => ({
      taskId: `task-${i}`,
      component: 'ui-generator',
      input: { prompt: `Create a component ${i}` },
      output: { code: `<div>Component ${i}</div>` },
      result: 'success',
      feedback: 'Great component!'
    }));
    
    (retentionService.getEntries as jest.Mock).mockResolvedValue(mockEntries);
    
    const result = await modelTuner.tuneModel({
      filter: 'success',
      component: 'ui-generator',
      minEntries: 10,
      targetModel: 'test-model',
      epochs: 2,
      rank: 16,
      alpha: 32,
      useSynthetic: true
    });
    
    expect(result.success).toBe(true);
    expect(result.entriesUsed).toBeGreaterThanOrEqual(10); // Original 5 + synthetic examples
    expect(result.syntheticExamplesGenerated).toBeGreaterThan(0);
    
    // Verify OpenAI was called to generate synthetic examples
    const { openai } = await import('@/lib/openai');
    expect(openai.chat.completions.create).toHaveBeenCalled();
  });
  
  test('tuneModel with disabled synthetic examples and insufficient entries fails', async () => {
    // Mock learning entries - not enough for fine-tuning
    const mockEntries: LearningEntry[] = Array(5).fill(null).map((_, i) => ({
      taskId: `task-${i}`,
      component: 'ui-generator',
      input: { prompt: `Create a component ${i}` },
      output: { code: `<div>Component ${i}</div>` },
      result: 'success',
      feedback: 'Great component!'
    }));
    
    (retentionService.getEntries as jest.Mock).mockResolvedValue(mockEntries);
    
    const result = await modelTuner.tuneModel({
      filter: 'success',
      component: 'ui-generator',
      minEntries: 10,
      targetModel: 'test-model',
      epochs: 2,
      rank: 16,
      alpha: 32,
      useSynthetic: false // Disable synthetic examples
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Insufficient entries');
  });
  
  test('tuneModel creates data directory if it does not exist', async () => {
    // Mock fs.access to throw an error, simulating non-existent directory
    vi.mocked(fs.access).mockRejectedValueOnce(new Error('ENOENT'));
    
    // Mock learning entries
    const mockEntries: LearningEntry[] = Array(15).fill(null).map((_, i) => ({
      taskId: `task-${i}`,
      component: 'ui-generator',
      input: { prompt: `Create a component ${i}` },
      output: { code: `<div>Component ${i}</div>` },
      result: 'success',
      feedback: 'Great component!'
    }));
    
    (retentionService.getEntries as jest.Mock).mockResolvedValue(mockEntries);
    
    await modelTuner.tuneModel({
      filter: 'success',
      component: 'ui-generator',
      minEntries: 10,
      targetModel: 'test-model',
      epochs: 2,
      rank: 16,
      alpha: 32
    });
    
    // Verify mkdir was called to create the data directory
    expect(fs.mkdir).toHaveBeenCalledWith(expect.stringContaining('data'), { recursive: true });
  });
  
  test('tuneModel handles fine-tuning failure', async () => {
    // Mock learning entries
    const mockEntries: LearningEntry[] = Array(15).fill(null).map((_, i) => ({
      taskId: `task-${i}`,
      component: 'ui-generator',
      input: { prompt: `Create a component ${i}` },
      output: { code: `<div>Component ${i}</div>` },
      result: 'success',
      feedback: 'Great component!'
    }));
    
    (retentionService.getEntries as jest.Mock).mockResolvedValue(mockEntries);
    
    // Mock exec to fail
    vi.mocked(exec).mockImplementationOnce((cmd, callback) => {
      callback(new Error('Fine-tuning failed'), '', 'Error output');
      return {} as any;
    });
    
    const result = await modelTuner.tuneModel({
      filter: 'success',
      component: 'ui-generator',
      minEntries: 10,
      targetModel: 'test-model',
      epochs: 2,
      rank: 16,
      alpha: 32
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Fine-tuning failed');
  });
  
  test('tuneModel performs prompt engineering instead of fine-tuning', async () => {
    // Mock learning entries
    const mockEntries: LearningEntry[] = Array(15).fill(null).map((_, i) => ({
      taskId: `task-${i}`,
      component: 'ui-generator',
      input: { prompt: `Create a component ${i}` },
      output: { code: `<div>Component ${i}</div>` },
      result: 'success',
      feedback: 'Great component!'
    }));
    
    (retentionService.getEntries as jest.Mock).mockResolvedValue(mockEntries);
    
    const result = await modelTuner.tuneModel({
      filter: 'success',
      component: 'ui-generator',
      minEntries: 10,
      targetModel: 'test-model',
      epochs: 2,
      rank: 16,
      alpha: 32,
      usePromptEngineering: true // Use prompt engineering instead
    });
    
    expect(result.success).toBe(true);
    expect(result.promptsEngineered).toBe(true);
    
    // Verify that writeFile was called with the engineered prompts
    expect(fs.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('data/engineered-prompts.json'),
      expect.any(String)
    );
    
    // Verify that exec was NOT called (no fine-tuning)
    expect(exec).not.toHaveBeenCalled();
  });
}); 