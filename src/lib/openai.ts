import OpenAI from 'openai';
import { env } from '@/env.mjs';

// Initialize OpenAI client if API key is available
let openaiClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI | null {
  // If we already have a client, return it
  if (openaiClient) {
    return openaiClient;
  }

  // Try to get API key from environment or local storage
  const apiKey = getOpenAIApiKey();

  // If no API key, return null
  if (!apiKey) {
    console.warn('OpenAI API key not found');
    return null;
  }

  // Create new OpenAI client
  try {
    openaiClient = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true, // For client-side usage
    });
    return openaiClient;
  } catch (error) {
    console.error('Error initializing OpenAI client:', error);
    return null;
  }
}

// Get API key from environment or localStorage
function getOpenAIApiKey(): string | undefined {
  // First try environment variable
  if (env.OPENAI_API_KEY) {
    return env.OPENAI_API_KEY;
  }

  // Then try localStorage (for client-side usage)
  if (typeof window !== 'undefined') {
    return localStorage.getItem('openai_api_key') || undefined;
  }

  return undefined;
}

// Export the client for direct usage
export const openai = getOpenAIClient(); 