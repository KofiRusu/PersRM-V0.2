import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { prompt, code, model, score, responseTime, errorMessage, metadata } = await req.json();
    
    // Basic validation
    if (!prompt || !model) {
      return NextResponse.json(
        { error: 'Prompt and model are required' },
        { status: 400 }
      );
    }

    // Create the reasoning test log
    const log = await prisma.reasoningTestLog.create({
      data: {
        prompt,
        code: code || '',
        model,
        score: score || 0,
        responseTime,
        errorMessage,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json({
      success: true,
      id: log.id
    });
  } catch (error) {
    console.error('Error logging reasoning test:', error);
    return NextResponse.json(
      { error: 'Failed to log reasoning test' },
      { status: 500 }
    );
  }
} 