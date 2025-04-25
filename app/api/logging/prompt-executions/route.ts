import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PromptExecution } from '@/app/common/prompt-tracking';

// Initialize Prisma client
const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const promptExecution: PromptExecution = await request.json();
    
    if (!promptExecution.id || !promptExecution.promptTemplateId) {
      return NextResponse.json(
        { error: 'Invalid request format. Execution ID and template ID are required.' },
        { status: 400 }
      );
    }

    // First, check if the template exists in the database
    let template = await prisma.promptTemplate.findUnique({
      where: { id: promptExecution.promptTemplateId },
    });

    // If template doesn't exist, create it with placeholder data
    if (!template) {
      template = await prisma.promptTemplate.create({
        data: {
          id: promptExecution.promptTemplateId,
          name: 'Auto-created Template',
          template: '',
          description: 'Automatically created from execution',
          category: 'unknown',
          version: 1,
        },
      });
    }

    // Check if execution already exists (for updates)
    const existingExecution = await prisma.promptExecution.findUnique({
      where: { id: promptExecution.id },
    });

    if (existingExecution) {
      // Update existing execution
      const updatedExecution = await prisma.promptExecution.update({
        where: { id: promptExecution.id },
        data: {
          success: promptExecution.success,
          feedback: promptExecution.feedback,
          feedbackDetails: promptExecution.feedbackDetails,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Prompt execution updated successfully',
        execution: updatedExecution,
      });
    } else {
      // Create new execution
      const savedExecution = await prisma.promptExecution.create({
        data: {
          id: promptExecution.id,
          promptTemplateId: promptExecution.promptTemplateId,
          input: JSON.stringify(promptExecution.input),
          output: promptExecution.output,
          success: promptExecution.success,
          feedback: promptExecution.feedback,
          feedbackDetails: promptExecution.feedbackDetails,
          executionTime: promptExecution.executionTime,
          executedAt: new Date(promptExecution.executedAt),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Prompt execution saved successfully',
        execution: savedExecution,
      });
    }
  } catch (error) {
    console.error('Error saving prompt execution:', error);
    return NextResponse.json(
      { error: 'Failed to save prompt execution', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// For retrieving all executions or filtered by template ID
export async function GET(request: NextRequest) {
  try {
    // Only available in development mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json(
        { error: 'This endpoint is only available in development mode' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const templateId = searchParams.get('templateId');
    const limit = parseInt(searchParams.get('limit') || '100');

    // Build query
    const where: any = {};
    if (templateId) where.promptTemplateId = templateId;

    // Query executions
    const executions = await prisma.promptExecution.findMany({
      where,
      orderBy: {
        executedAt: 'desc',
      },
      take: Math.min(limit, 500), // Cap at 500 max
      include: {
        template: true, // Include the related template
      },
    });

    // Transform results to parse JSON fields
    const results = executions.map(execution => ({
      ...execution,
      input: JSON.parse(execution.input as string),
    }));

    return NextResponse.json({
      executions: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Error retrieving prompt executions:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve prompt executions', details: (error as Error).message },
      { status: 500 }
    );
  }
} 