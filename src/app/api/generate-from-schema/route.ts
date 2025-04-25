import { NextRequest, NextResponse } from 'next/server';
import { generateComponentFromSchema } from '@/lib/aiClient';

export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const { schema, model } = await req.json();
    
    if (!schema) {
      return NextResponse.json(
        { error: 'Schema is required' },
        { status: 400 }
      );
    }

    // Validate schema has required properties
    if (typeof schema !== 'object') {
      return NextResponse.json(
        { error: 'Invalid schema: must be an object' },
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
    const result = await generateComponentFromSchema(schema, {
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
    console.error('Error generating UI component from schema:', error);
    
    return NextResponse.json(
      { error: 'Failed to generate UI component from schema' },
      { status: 500 }
    );
  }
} 