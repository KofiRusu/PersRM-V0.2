import { Ollama } from "langchain/llms/ollama";
import { getLocalStorage } from "./localStorage";
import { env } from "@/env.mjs";

const OLLAMA_BASE_URL = env.NEXT_PUBLIC_OLLAMA_BASE_URL || "http://localhost:11434";
const DEFAULT_MODEL = "llama3";

// Check if the reasoning model is available
export async function isReasoningModelAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) return false;
    
    const data = await response.json();
    return data.models.some((model: any) => model.name === DEFAULT_MODEL);
  } catch (error) {
    console.error("Error checking Ollama model availability:", error);
    return false;
  }
}

// Generate reasoning using the Ollama API
export async function getReasoning(prompt: string, context?: string): Promise<string> {
  try {
    // Prepare system prompt for reasoning
    let systemPrompt = `You are an expert UI/UX designer and frontend developer.
Provide detailed and structured reasoning for the following question or design challenge.
Focus on explaining your thought process, considering user experience, accessibility, and technical feasibility.
Provide concrete examples and patterns when possible.`;

    if (context) {
      systemPrompt += `\nAvailable context: ${context}`;
    }

    // Initialize Ollama model
    const model = new Ollama({
      baseUrl: "http://localhost:11434",
      model: "persreason", // Try this model first
      temperature: 0.1,
    });

    // Call the model with the system prompt and user prompt
    const result = await model.call(
      `${systemPrompt}\n\nQuestion or challenge: ${prompt}\n\nReasoning:`
    );

    return result.trim();
  } catch (error) {
    console.error("Primary model failed:", error);
    
    try {
      // Fallback to a different model
      const fallbackModel = new Ollama({
        baseUrl: "http://localhost:11434",
        model: "llama3", // Fallback model
        temperature: 0.2,
      });
      
      const fallbackResult = await fallbackModel.call(prompt);
      return fallbackResult.trim();
    } catch (fallbackError) {
      console.error("Fallback model also failed:", fallbackError);
      throw new Error("Failed to generate reasoning with available models");
    }
  }
}

/**
 * Get reasoning for route generation based on app description
 */
export async function getRouteReasoning(
  appDescription: string, 
  features?: string[],
  existingRoutes?: string[]
): Promise<string> {
  if (!ollama) {
    throw new Error('Ollama client is not initialized');
  }
  
  const modelName = process.env.REASONING_MODEL || 'llama3';
  
  const systemPrompt = `You are an expert in Next.js application architecture and routing.
Provide clear, structured reasoning about route structure for a web application based on the provided description.
Consider best practices for Next.js App Router, including:
- Route grouping strategies
- Dynamic vs static routes
- Parallel routes when appropriate
- Intercepted routes for modals
- Loading and error states
- API routes organization

Explain your decisions with a focus on maintainability, user experience, and performance.`;

  let promptContent = `Application Description: ${appDescription}\n\n`;
  
  if (features && features.length > 0) {
    promptContent += `Features:\n${features.map(f => `- ${f}`).join('\n')}\n\n`;
  }
  
  if (existingRoutes && existingRoutes.length > 0) {
    promptContent += `Existing Routes:\n${existingRoutes.map(r => `- ${r}`).join('\n')}\n\n`;
  }
  
  promptContent += 'Based on this information, reason through an optimal route structure for this application.';
  
  try {
    const response = await ollama.chat({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptContent }
      ],
      stream: false
    });
    
    return response.message.content;
  } catch (error) {
    console.error('Error generating route reasoning:', error);
    throw new Error('Failed to generate route reasoning');
  }
}

export async function getUIUXReasoning(
  question: string,
  temperature: number = 0.7,
  max_tokens: number = 2048
): Promise<string> {
  try {
    const systemPrompt = `You are an expert UI/UX developer with deep knowledge of modern web development. 
Your task is to provide detailed, thoughtful reasoning about UI/UX design decisions, implementation 
approaches, and best practices in response to the user's questions. Focus on:

1. Explaining the reasoning behind design patterns and implementation choices
2. Considering accessibility, usability, and responsive design
3. Providing context about why certain approaches are preferable
4. Discussing tradeoffs between different implementation strategies
5. Sharing insights based on real-world experience

Provide nuanced, expert-level reasoning that helps developers make informed decisions about their UI/UX implementation.`;

    // Make request to Ollama API
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        prompt: question,
        system: systemPrompt,
        options: {
          temperature: temperature,
          num_predict: max_tokens,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Ollama API error:", errorData);
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    let result = "";

    if (!reader) {
      throw new Error("Failed to get reader from response");
    }

    // Process the streaming response
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the value to text
      const chunk = new TextDecoder().decode(value);
      
      try {
        // Ollama returns JSON objects for each token
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            result += parsed.response;
          }
        }
      } catch (e) {
        console.warn("Error parsing JSON chunk", e);
      }
    }

    return result.trim();
  } catch (error) {
    console.error("Error in getUIUXReasoning:", error);
    throw error;
  }
} 