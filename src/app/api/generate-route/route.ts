import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { openai } from '@/lib/openai';

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

    // Generate route based on the prompt and reasoning
    const route = await generateRoute(client, prompt, reasoning);

    return NextResponse.json({ 
      route 
    });
  } catch (error) {
    console.error("Error generating route:", error);
    return NextResponse.json(
      { error: "Failed to generate route" },
      { status: 500 }
    );
  }
}

async function generateRoute(client: any, prompt: string, reasoning: string) {
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an expert API route developer using Next.js, TypeScript, and tRPC. 
        Your task is to convert a UI/UX design question and its reasoning into a functional API route.
        
        Create a complete API route implementation based on the user's prompt and the reasoning provided.
        
        Guidelines:
        - Use TypeScript for type safety
        - Implement proper request validation with Zod
        - Add appropriate error handling
        - Include all imports at the top
        - Structure the response properly
        - Return ONLY the code with no explanation or markdown formatting
        
        The API route should be complete and ready to use in a Next.js application.`
      },
      {
        role: "user",
        content: `Generate a Next.js API route based on this design question:
        
        QUESTION: ${prompt}
        
        REASONING: ${reasoning}
        
        Please provide only the code for the API route with no explanation.`
      }
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });

  return response.choices[0]?.message?.content || "";
} 