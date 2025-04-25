import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    // Get all reasoning test logs ordered by most recent first
    const logs = await prisma.reasoningTestLog.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ 
      logs: logs.map(log => ({
        id: log.id,
        createdAt: log.createdAt,
        prompt: log.prompt.length > 100 ? log.prompt.substring(0, 100) + '...' : log.prompt,
        model: log.model,
        score: log.score,
        responseTime: log.responseTime,
        errorMessage: log.errorMessage,
      }))
    });
  } catch (error) {
    console.error('Error fetching reasoning logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reasoning logs' },
      { status: 500 }
    );
  }
} 