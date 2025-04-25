import { NextRequest, NextResponse } from 'next/server';
import { generateComponentFromPrompt } from '@/lib/aiClient';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { prompt, model } = await req.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Determine model type from model ID
    let modelType = 'openai';
    if (model && model.startsWith('deepseek')) {
      modelType = 'deepseek';
    } else if (model && (model === 'llama3' || model === 'mistral')) {
      modelType = 'ollama';
    }
    
    // Generate component
    const result = await generateComponentFromPrompt(prompt, {
      model,
      modelType: modelType as any,
    });
    
    // Handle error
    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }
    
    // Return code and metadata
    return NextResponse.json({
      code: result.code,
      modelUsed: result.modelUsed,
      reasoningScore: result.reasoningScore
    });
  } catch (error) {
    console.error('Error generating UI component:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate UI component' },
      { status: 500 }
    );
  }
} 