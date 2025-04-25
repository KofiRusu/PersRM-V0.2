import { prisma } from '@/lib/db';

export type LogResult = 'success' | 'failure' | 'improved';

export interface LearningEntry {
  taskId: string;
  component: string;
  input: Record<string, any>;
  output: Record<string, any>;
  result: LogResult;
  feedback?: string;
  errorType?: string;
  remediation?: string;
  metadata?: Record<string, any>;
}

/**
 * Service for storing and retrieving learning data
 */
export class RetentionService {
  /**
   * Store a new learning entry
   */
  async storeEntry(entry: LearningEntry): Promise<string> {
    const { taskId, component, input, output, result, feedback, errorType, remediation, metadata } = entry;
    
    const learningLog = await prisma.learningLog.create({
      data: {
        taskId,
        component,
        input: JSON.stringify(input),
        output: JSON.stringify(output),
        result,
        feedback,
        errorType,
        remediation,
        metadata: metadata ? JSON.stringify(metadata) : null,
      }
    });
    
    return learningLog.id;
  }
  
  /**
   * Get learning entries by result type
   */
  async getEntriesByResult(result: LogResult): Promise<LearningEntry[]> {
    const entries = await prisma.learningLog.findMany({
      where: { result },
      orderBy: { timestamp: 'desc' },
    });
    
    return entries.map(entry => ({
      taskId: entry.taskId,
      component: entry.component,
      input: JSON.parse(entry.input),
      output: JSON.parse(entry.output),
      result: entry.result as LogResult,
      feedback: entry.feedback || undefined,
      errorType: entry.errorType || undefined,
      remediation: entry.remediation || undefined,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
    }));
  }
  
  /**
   * Get learning entries by component
   */
  async getEntriesByComponent(component: string): Promise<LearningEntry[]> {
    const entries = await prisma.learningLog.findMany({
      where: { component },
      orderBy: { timestamp: 'desc' },
    });
    
    return entries.map(entry => ({
      taskId: entry.taskId,
      component: entry.component,
      input: JSON.parse(entry.input),
      output: JSON.parse(entry.output),
      result: entry.result as LogResult,
      feedback: entry.feedback || undefined,
      errorType: entry.errorType || undefined,
      remediation: entry.remediation || undefined,
      metadata: entry.metadata ? JSON.parse(entry.metadata) : undefined,
    }));
  }
  
  /**
   * Update an existing entry with remediation information
   */
  async updateRemediation(taskId: string, remediation: string): Promise<void> {
    await prisma.learningLog.updateMany({
      where: { taskId },
      data: { remediation }
    });
  }
  
  /**
   * Get stats on learning entries
   */
  async getStats(): Promise<{ 
    totalEntries: number; 
    successCount: number; 
    failureCount: number; 
    improvedCount: number;
    componentBreakdown: Record<string, number>;
  }> {
    const totalEntries = await prisma.learningLog.count();
    const successCount = await prisma.learningLog.count({ where: { result: 'success' } });
    const failureCount = await prisma.learningLog.count({ where: { result: 'failure' } });
    const improvedCount = await prisma.learningLog.count({ where: { result: 'improved' } });
    
    const componentGroups = await prisma.learningLog.groupBy({
      by: ['component'],
      _count: true,
    });
    
    const componentBreakdown = componentGroups.reduce((acc, group) => {
      acc[group.component] = group._count;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalEntries,
      successCount,
      failureCount,
      improvedCount,
      componentBreakdown,
    };
  }
  
  /**
   * Delete entries older than a certain date
   */
  async pruneOldEntries(olderThan: Date): Promise<number> {
    const result = await prisma.learningLog.deleteMany({
      where: {
        timestamp: {
          lt: olderThan
        }
      }
    });
    
    return result.count;
  }
} 