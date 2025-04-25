import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetentionService, LearningEntry, LogResult } from '../../lib/memory/retentionService';
import { FeedbackAnalyzer, FeedbackAnalysis } from '../../lib/retraining/feedbackAnalyzer';

// Mock the prisma client
vi.mock('@/lib/db', () => ({
  prisma: {
    learningLog: {
      create: vi.fn().mockResolvedValue({ id: 'mock-id-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(5),
      groupBy: vi.fn().mockResolvedValue([
        { component: 'ui-generator', _count: 3 },
        { component: 'reasoning', _count: 2 }
      ]),
      deleteMany: vi.fn().mockResolvedValue({ count: 2 })
    }
  }
}));

// Mock the OpenAI client
vi.mock('@/lib/openai', () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sentiment: 'positive',
                  categories: ['responsive design', 'accessibility'],
                  actionItems: ['Improve color contrast', 'Add more aria attributes'],
                  score: 8,
                  result: 'success'
                })
              }
            }
          ]
        })
      }
    }
  }
}));

describe('Feedback Flow System', () => {
  let retentionService: RetentionService;
  let feedbackAnalyzer: FeedbackAnalyzer;
  
  beforeEach(() => {
    retentionService = new RetentionService();
    feedbackAnalyzer = new FeedbackAnalyzer();
    
    // Reset mock calls
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  test('RetentionService can store learning entries', async () => {
    const mockEntry: LearningEntry = {
      taskId: 'task-123',
      component: 'ui-generator',
      input: { prompt: 'Create a login form' },
      output: { code: '<form>...</form>' },
      result: 'success' as LogResult,
      feedback: 'Looks good!'
    };
    
    const id = await retentionService.storeEntry(mockEntry);
    
    expect(id).toBe('mock-id-1');
    
    // Check that prisma.learningLog.create was called with the correct data
    const { prisma } = await import('@/lib/db');
    expect(prisma.learningLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.learningLog.create).toHaveBeenCalledWith({
      data: {
        taskId: 'task-123',
        component: 'ui-generator',
        input: JSON.stringify({ prompt: 'Create a login form' }),
        output: JSON.stringify({ code: '<form>...</form>' }),
        result: 'success',
        feedback: 'Looks good!',
        errorType: undefined,
        remediation: undefined,
        metadata: null,
      }
    });
  });
  
  test('RetentionService can retrieve entries by result', async () => {
    // Mock the findMany response
    const { prisma } = await import('@/lib/db');
    (prisma.learningLog.findMany as any).mockResolvedValueOnce([
      {
        taskId: 'task-123',
        component: 'ui-generator',
        input: JSON.stringify({ prompt: 'Create a login form' }),
        output: JSON.stringify({ code: '<form>...</form>' }),
        result: 'success',
        feedback: 'Looks good!',
        timestamp: new Date()
      }
    ]);
    
    const entries = await retentionService.getEntriesByResult('success');
    
    expect(entries.length).toBe(1);
    expect(entries[0].taskId).toBe('task-123');
    expect(entries[0].component).toBe('ui-generator');
    expect(entries[0].input).toEqual({ prompt: 'Create a login form' });
    expect(entries[0].output).toEqual({ code: '<form>...</form>' });
    expect(entries[0].result).toBe('success');
    expect(entries[0].feedback).toBe('Looks good!');
    
    expect(prisma.learningLog.findMany).toHaveBeenCalledWith({
      where: { result: 'success' },
      orderBy: { timestamp: 'desc' },
    });
  });
  
  test('RetentionService can update remediation', async () => {
    await retentionService.updateRemediation('task-123', 'Fix the issue by...');
    
    const { prisma } = await import('@/lib/db');
    expect(prisma.learningLog.updateMany).toHaveBeenCalledWith({
      where: { taskId: 'task-123' },
      data: { remediation: 'Fix the issue by...' }
    });
  });
  
  test('RetentionService can get statistics', async () => {
    // Mock the necessary responses
    const { prisma } = await import('@/lib/db');
    (prisma.learningLog.count as any)
      .mockResolvedValueOnce(10) // totalEntries
      .mockResolvedValueOnce(5)  // successCount
      .mockResolvedValueOnce(3)  // failureCount
      .mockResolvedValueOnce(2); // improvedCount
    
    const stats = await retentionService.getStats();
    
    expect(stats.totalEntries).toBe(10);
    expect(stats.successCount).toBe(5);
    expect(stats.failureCount).toBe(3);
    expect(stats.improvedCount).toBe(2);
    expect(stats.componentBreakdown['ui-generator']).toBe(3);
    expect(stats.componentBreakdown['reasoning']).toBe(2);
  });
  
  test('FeedbackAnalyzer can analyze short feedback', async () => {
    const analysis = await feedbackAnalyzer.analyzeFeedback({
      feedback: 'This is good but needs better responsive design',
      component: 'ui-generator'
    });
    
    expect(analysis.sentiment).toBe('positive');
    expect(analysis.categories).toContain('responsive design');
    expect(analysis.result).toBe('success');
    expect(analysis.score).toBeGreaterThan(0);
    
    // The OpenAI client should not be called for short feedback
    const { openai } = await import('@/lib/openai');
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
  });
  
  test('FeedbackAnalyzer can analyze detailed feedback with AI', async () => {
    // Create a long feedback that will trigger AI analysis
    const longFeedback = 'This component looks great overall, but I noticed some issues with the responsive behavior on mobile devices. The layout breaks at small screen sizes and some text becomes unreadable. Also, the color contrast could be improved for better accessibility. The component works well functionally, but these UI issues should be addressed to make it more polished and professional. I would suggest adding better media queries and testing on various screen sizes.';
    
    const analysis = await feedbackAnalyzer.analyzeFeedback({
      feedback: longFeedback,
      component: 'ui-generator',
      originalPrompt: '{"prompt":"Create a responsive card component"}',
      generatedCode: '<div class="card">...</div>'
    });
    
    expect(analysis.sentiment).toBe('positive');
    expect(analysis.categories).toContain('responsive design');
    expect(analysis.categories).toContain('accessibility');
    expect(analysis.actionItems.length).toBe(2);
    expect(analysis.actionItems[0]).toBe('Improve color contrast');
    expect(analysis.result).toBe('success');
    expect(analysis.score).toBe(8);
    
    // The OpenAI client should be called for long feedback
    const { openai } = await import('@/lib/openai');
    expect(openai.chat.completions.create).toHaveBeenCalled();
  });
  
  test('Complete feedback flow works end-to-end', async () => {
    // First, analyze feedback
    const analysis = await feedbackAnalyzer.analyzeFeedback({
      feedback: 'Needs improvement in responsive design',
      component: 'ui-generator'
    });
    
    expect(analysis.sentiment).toBe('negative');
    expect(analysis.categories).toContain('responsive design');
    
    // Then store the entry with the analysis
    const entry: LearningEntry = {
      taskId: 'task-456',
      component: 'ui-generator',
      input: { prompt: 'Create a dashboard layout' },
      output: { code: '<div class="dashboard">...</div>' },
      result: 'improved' as LogResult,
      feedback: 'Needs improvement in responsive design',
      metadata: {
        analysisCategories: analysis.categories,
        analysisSentiment: analysis.sentiment,
        analysisSuggestions: analysis.actionItems
      }
    };
    
    const id = await retentionService.storeEntry(entry);
    expect(id).toBe('mock-id-1');
    
    // Add remediation
    await retentionService.updateRemediation('task-456', 'Added media queries to fix responsive issues');
    
    const { prisma } = await import('@/lib/db');
    expect(prisma.learningLog.updateMany).toHaveBeenCalledWith({
      where: { taskId: 'task-456' },
      data: { remediation: 'Added media queries to fix responsive issues' }
    });
  });
}); 