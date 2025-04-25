import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { promises as fs } from 'fs';
import path from 'path';
import { getOllamaCompletion } from '@/lib/ollama';

// Default system prompt for route generation
const defaultSystemPrompt = `You are an expert API route generator for Next.js applications.
Your task is to create robust, secure, and efficient route handlers.

Consider the following aspects when creating a route:
- Request validation and type safety
- Error handling and appropriate status codes
- Security considerations (authentication, authorization, input sanitization)
- Efficiency and performance
- RESTful design principles
- Integration with the application's data models and services
- Appropriate HTTP methods (GET, POST, PUT, DELETE, etc.)
- Clear response formats and status codes

Respond with well-commented, production-ready code for the route handler.`;

interface RouteGenerationRequest {
  prompt: string;
  model?: 'openai' | 'ollama' | 'custom';
  systemPrompt?: string;
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  requestData?: Record<string, any>;
  responseFormat?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = 'openai', systemPrompt, endpoint, method = 'GET', requestData, responseFormat } = await request.json() as RouteGenerationRequest;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    let routeCode: string;
    let error: string | null = null;

    // Construct a more detailed prompt with the provided details
    const enhancedPrompt = `
Create a Next.js API route handler for the following endpoint: ${endpoint || 'described below'}
HTTP Method: ${method}
${requestData ? `Request Data: ${JSON.stringify(requestData, null, 2)}` : ''}
${responseFormat ? `Response Format: ${responseFormat}` : ''}

Requirements: ${prompt}
    `.trim();

    try {
      if (model === 'ollama') {
        routeCode = await generateWithOllama(enhancedPrompt, systemPrompt || defaultSystemPrompt);
      } else if (model === 'custom') {
        routeCode = await generateWithCustomModel(enhancedPrompt, systemPrompt || defaultSystemPrompt);
      } else {
        // Default to OpenAI
        routeCode = await generateWithOpenAI(enhancedPrompt, systemPrompt || defaultSystemPrompt);
      }

      // Log the generation for future dataset creation
      await logRouteGeneration(prompt, routeCode, model);

      return NextResponse.json({ routeCode });
    } catch (e) {
      console.error('Error generating route:', e);
      error = e instanceof Error ? e.message : 'Unknown error';
      return NextResponse.json({ error }, { status: 500 });
    }
  } catch (e) {
    console.error('Error processing request:', e);
    return NextResponse.json(
      { error: 'Invalid request format' },
      { status: 400 }
    );
  }
}

async function generateWithOpenAI(prompt: string, systemPrompt: string): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client is not initialized. Please check your API key.');
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 2000,
  });

  if (!response.choices[0].message.content) {
    throw new Error('No response from OpenAI');
  }

  return response.choices[0].message.content;
}

async function generateWithOllama(prompt: string, systemPrompt: string): Promise<string> {
  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];
    
    const response = await getOllamaCompletion('llama3', messages);
    return response;
  } catch (error) {
    console.error('Error generating with Ollama:', error);
    // Fallback to OpenAI if Ollama fails
    return generateWithOpenAI(prompt, systemPrompt);
  }
}

async function generateWithCustomModel(prompt: string, systemPrompt: string): Promise<string> {
  // Placeholder for custom model integration
  // This could be replaced with a call to a locally hosted model or another service
  console.log('Custom model requested, falling back to OpenAI');
  return generateWithOpenAI(prompt, systemPrompt);
}

async function logRouteGeneration(prompt: string, routeCode: string, model: string) {
  const logDir = path.join(process.cwd(), 'src/app/api/route-generation-log');
  
  try {
    // Create log directory if it doesn't exist
    await fs.mkdir(logDir, { recursive: true });
    
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      prompt,
      routeCode,
      model
    });
    
    const logFile = path.join(logDir, 'route-generation.jsonl');
    await fs.appendFile(logFile, logEntry + '\n');
  } catch (error) {
    console.error('Error logging route generation:', error);
    // Don't throw here, just log the error
  }
} 