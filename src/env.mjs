// Environment variable configuration with defaults
export const env = {
  // OpenAI API key from environment variable
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  
  // OpenAI model to use
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o',
  
  // Ollama base URL
  NEXT_PUBLIC_OLLAMA_BASE_URL: process.env.NEXT_PUBLIC_OLLAMA_BASE_URL || 'http://localhost:11434',
  
  // Application environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Base URL
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
}; 