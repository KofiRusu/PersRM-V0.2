import { NextRequest, NextResponse } from 'next/server';
import { openai } from '@/lib/openai';
import { z } from 'zod';
import { generateRouteFiles, ReasoningStructured } from '@/lib/generation/generateRouteFiles';

// Default system prompt for code generation
const CODEGEN_SYSTEM_PROMPT = `You are an expert frontend engineer who specializes in creating React components with Next.js, TailwindCSS, and shadcn/ui.
You output clean, accessible, well-structured TypeScript code based on UI/UX reasoning provided.

When given a reasoning description, create a complete implementation that follows all the described patterns and best practices.
Your generated code should:
- Use TypeScript
- Include proper imports
- Use modern React patterns (hooks, functional components)
- Follow TailwindCSS best practices
- Integrate shadcn/ui components where appropriate
- Be responsive and accessible
- Include appropriate comments for complex logic
- Be production-ready and well-structured

Always wrap your code in \`\`\`tsx code blocks.`;

// Validation schemas
const codegenRequestSchema = z.object({
  reasoning: z.string().min(10),
  model: z.enum(['openai', 'deepseek']).optional().default('openai'),
  extraContext: z.string().optional().default('')
});

const routegenRequestSchema = z.object({
  reasoning: z.string().min(10),
  structuredReasoning: z.object({
    routeName: z.string().min(1),
    componentType: z.enum(['page', 'component', 'form']),
    pageType: z.enum(['form', 'display', 'dashboard', 'detail']).optional(),
    needsApi: z.boolean().optional(),
    needsLayout: z.boolean().optional(),
    formFields: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        label: z.string().optional(),
        required: z.boolean().optional(),
        placeholder: z.string().optional(),
        validation: z.string().optional()
      })
    ).optional(),
    dataStructure: z.record(z.string()).optional(),
    description: z.string().optional(),
    implementation: z.string().optional()
  })
});

const requestSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  reasoning: z.string().min(1, "Reasoning is required"),
});

export async function POST(req: NextRequest) {
  try {
    // Parse and validate the request
    const body = await req.json();
    const result = requestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid request", details: result.error.format() },
        { status: 400 }
      );
    }

    const { prompt, reasoning } = result.data;

    // Get the OpenAI client
    const client = openai;
    if (!client) {
      return NextResponse.json(
        { error: "OpenAI client not configured" },
        { status: 500 }
      );
    }

    // Generate code based on the prompt and reasoning
    const code = await generateCode(client, prompt, reasoning);

    return NextResponse.json({ 
      code 
    });
  } catch (error) {
    console.error("Error generating code:", error);
    return NextResponse.json(
      { error: "Failed to generate code" },
      { status: 500 }
    );
  }
}

async function generateCode(client: any, prompt: string, reasoning: string) {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert UI developer using React, Next.js, TypeScript, and TailwindCSS. 
        Your task is to convert a UI/UX design question and its reasoning into clean, working code.
        
        Create a complete, self-contained component based on the user's prompt and the reasoning provided.
        
        Guidelines:
        - Use TypeScript for type safety
        - Use modern React patterns (hooks, functional components)
        - Implement responsive design with Tailwind CSS
        - Add appropriate comments only when necessary
        - Include all imports at the top
        - Use shadcn/ui components when appropriate
        - Ensure the component is accessible
        - Return ONLY the code with no explanation or markdown formatting
        
        The component should be complete and ready to use in a Next.js application.`
      },
      {
        role: "user",
        content: `Generate a React component based on this design question:
        
        QUESTION: ${prompt}
        
        REASONING: ${reasoning}
        
        Please provide only the code with no explanation.`
      }
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * Generate code using OpenAI
 */
async function generateWithOpenAI(reasoning: string, extraContext: string): Promise<string> {
  if (!openai) {
    throw new Error('OpenAI client is not available');
  }
  
  const prompt = `Based on the following UI/UX reasoning, generate a complete React component implementation.

UI/UX REASONING:
${reasoning}

${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}

Generate the complete React component with all necessary imports and proper TypeScript typing.`;
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: CODEGEN_SYSTEM_PROMPT },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3, // Lower temperature for more predictable code
    max_tokens: 3000,
  });
  
  const content = response.choices[0]?.message.content || '';
  
  // Extract code from markdown code blocks if present
  const codeMatch = content.match(/```(?:tsx|jsx|ts|js)?\s*([\s\S]*?)```/);
  return codeMatch ? codeMatch[1].trim() : content;
}

/**
 * Generate code using DeepSeek API
 */
async function generateWithDeepSeek(reasoning: string, extraContext: string): Promise<string> {
  const prompt = `Based on the following UI/UX reasoning, generate a complete React component implementation.

UI/UX REASONING:
${reasoning}

${extraContext ? `ADDITIONAL CONTEXT:\n${extraContext}\n` : ''}

Generate the complete React component with all necessary imports and proper TypeScript typing.`;
  
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'deepseek-coder-6.7b-instruct',
      messages: [
        { role: 'system', content: CODEGEN_SYSTEM_PROMPT },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more predictable code
      max_tokens: 3000,
    }),
  });
  
  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  const content = data.choices[0]?.message?.content || '';
  
  // Extract code from markdown code blocks if present
  const codeMatch = content.match(/```(?:tsx|jsx|ts|js)?\s*([\s\S]*?)```/);
  return codeMatch ? codeMatch[1].trim() : content;
}

/**
 * Extract structured reasoning from textual reasoning
 */
export async function extractStructuredReasoning(reasoning: string): Promise<ReasoningStructured | null> {
  if (!openai) {
    console.error('OpenAI client not configured. Cannot extract structured reasoning.');
    return null;
  }
  
  try {
    const prompt = `
Extract structured information from the following UI/UX reasoning about a page/route:

${reasoning}

Extract and return ONLY a JSON object with the following structure:
{
  "routeName": "name of the route (e.g., 'feedback-form', 'user-dashboard')",
  "componentType": "page" or "component" or "form",
  "pageType": "form" or "display" or "dashboard" or "detail",
  "needsApi": boolean (true if it needs an API endpoint),
  "needsLayout": boolean (true if it needs a custom layout),
  "formFields": [
    {
      "name": "field name",
      "type": "field type (e.g., text, email, password)",
      "label": "display label",
      "required": boolean,
      "placeholder": "placeholder text",
      "validation": "validation rules"
    }
  ],
  "dataStructure": record of field names and types (for data display pages),
  "description": "brief description of what the page does",
  "implementation": "key implementation details"
}

Return ONLY the JSON object, no other text.`;
    
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a specialized AI that extracts structured information from text and converts it to JSON format. Be precise and thorough in your extraction.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });
    
    const content = response.choices[0]?.message.content || '';
    
    try {
      // Parse the JSON response
      const structured = JSON.parse(content) as ReasoningStructured;
      return structured;
    } catch (error) {
      console.error('Error parsing structured reasoning JSON:', error);
      return null;
    }
  } catch (error) {
    console.error('Error extracting structured reasoning:', error);
    return null;
  }
}

/**
 * Log code generation for analytics and improvement
 */
async function logCodeGeneration(
  reasoning: string,
  code: string,
  model: string
): Promise<void> {
  // In a production environment, this would log to a database
  console.log(`[Codegen Log] Model: ${model}, Reasoning: ${reasoning.substring(0, 50)}...`);
  
  // This could be extended to store in database for analytics
  try {
    // Simple file-based logging as an example
    const fs = require('fs');
    const path = require('path');
    const logDir = path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'codegen_logs.jsonl');
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      model,
      reasoning: reasoning.substring(0, 500) + (reasoning.length > 500 ? '...' : ''),
      code_length: code.length,
    }) + '\n';
    
    fs.appendFileSync(logFile, logEntry);
  } catch (error) {
    console.error('Failed to log code generation:', error);
  }
} 