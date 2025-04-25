/**
 * Utility to generate route files from structured reasoning
 */
import fs from 'fs';
import path from 'path';
import { getOpenAIClient } from '@/lib/openai';

// Types for structured reasoning
export interface ReasoningStructured {
  routeName: string;
  componentType: 'page' | 'component' | 'form';
  pageType?: 'form' | 'display' | 'dashboard' | 'detail';
  needsApi?: boolean;
  needsLayout?: boolean;
  formFields?: FormField[];
  dataStructure?: Record<string, string>;
  description?: string;
  implementation?: string;
}

interface FormField {
  name: string;
  type: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  validation?: string;
}

interface GeneratedFiles {
  files: Array<{
    path: string;
    content: string;
    type: 'page' | 'api' | 'layout' | 'component';
  }>;
  errors: string[];
}

/**
 * Generate route files from structured reasoning
 */
export async function generateRouteFiles(reasoning: ReasoningStructured): Promise<GeneratedFiles> {
  const generatedFiles: GeneratedFiles = {
    files: [],
    errors: []
  };

  try {
    // Normalize route name: convert spaces to dashes, lowercase, remove special chars
    const normalizedRouteName = reasoning.routeName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    // Create page and API directories if they don't exist
    const routeDir = path.join(process.cwd(), 'src', 'app', normalizedRouteName);
    const apiDir = path.join(process.cwd(), 'src', 'app', 'api', normalizedRouteName);

    // Create directories if they don't exist
    const createDirIfNotExists = (dirPath: string) => {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    };

    // 1. Generate page.tsx file
    await generatePageFile(reasoning, normalizedRouteName, generatedFiles);

    // 2. Generate API route if needed
    if (reasoning.needsApi) {
      await generateApiRoute(reasoning, normalizedRouteName, generatedFiles);
    }

    // 3. Generate layout.tsx if needed
    if (reasoning.needsLayout) {
      await generateLayoutFile(reasoning, normalizedRouteName, generatedFiles);
    }

    // Write files to disk
    for (const file of generatedFiles.files) {
      const filePath = path.join(process.cwd(), file.path);
      const dirPath = path.dirname(filePath);
      
      // Create directory if it doesn't exist
      createDirIfNotExists(dirPath);
      
      // Write file content
      fs.writeFileSync(filePath, file.content);
    }

    return generatedFiles;
  } catch (error) {
    console.error('Error generating route files:', error);
    generatedFiles.errors.push(`Generation error: ${error instanceof Error ? error.message : String(error)}`);
    return generatedFiles;
  }
}

/**
 * Generate page.tsx file based on reasoning
 */
async function generatePageFile(
  reasoning: ReasoningStructured,
  routeName: string,
  result: GeneratedFiles
): Promise<void> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    result.errors.push('OpenAI client not configured. Cannot generate page file.');
    return;
  }

  const pageType = reasoning.pageType || 'display';
  const hasForm = pageType === 'form' || reasoning.componentType === 'form';
  
  // Create a detailed prompt for the OpenAI model
  const prompt = `
Generate a Next.js page component file (TypeScript) for a route named "${reasoning.routeName}".
The page should be a ${pageType} page that ${reasoning.description || 'displays content to the user'}.

${hasForm 
  ? `The page contains a form with the following fields:
${reasoning.formFields?.map(field => 
  `- ${field.name} (${field.type}): ${field.label || field.name}${field.required ? ' (required)' : ''}`
).join('\n') || 'No fields specified'}`
  : `The page displays data with the following structure:
${JSON.stringify(reasoning.dataStructure || {}, null, 2)}`
}

Implementation notes:
${reasoning.implementation || 'Use modern React patterns and shadcn/ui components'}

The file should:
- Use TypeScript React/Next.js
- Use shadcn/ui components
- Include proper imports
- Use modern React patterns
- Be fully responsive
- Be accessible

Only include the file content, no explanations.
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert Next.js developer who specializes in creating clean, maintainable, accessible TypeScript code.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 2500
    });

    const pageContent = response.choices[0]?.message.content || '';
    
    // Clean up the content if it contains markdown code blocks
    const cleanContent = pageContent.replace(/```(tsx|jsx|typescript|javascript)?\n([\s\S]*?)\n```/g, '$2');
    
    result.files.push({
      path: `src/app/${routeName}/page.tsx`,
      content: cleanContent,
      type: 'page'
    });
  } catch (error) {
    console.error('Error generating page file:', error);
    result.errors.push(`Page generation error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate API route file based on reasoning
 */
async function generateApiRoute(
  reasoning: ReasoningStructured,
  routeName: string,
  result: GeneratedFiles
): Promise<void> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    result.errors.push('OpenAI client not configured. Cannot generate API route.');
    return;
  }

  const hasForm = reasoning.pageType === 'form' || reasoning.componentType === 'form';
  
  // Create a detailed prompt for the OpenAI model
  const prompt = `
Generate a Next.js API route file (TypeScript) for a route named "${reasoning.routeName}".
The API should handle ${hasForm ? 'form submissions' : 'data requests'} related to the page.

${hasForm 
  ? `The form contains the following fields that need to be validated and processed:
${reasoning.formFields?.map(field => 
  `- ${field.name} (${field.type}): ${field.label || field.name}${field.required ? ' (required)' : ''}`
).join('\n') || 'No fields specified'}`
  : `The API handles data with the following structure:
${JSON.stringify(reasoning.dataStructure || {}, null, 2)}`
}

Implementation notes:
${reasoning.implementation || 'Use zod for validation and proper error handling'}

The file should:
- Use TypeScript
- Handle different HTTP methods (GET, POST, etc.)
- Include proper validation using zod
- Return appropriate status codes
- Handle errors gracefully
- Use async/await patterns

Only include the file content, no explanations.
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert Next.js backend developer who specializes in creating clean, maintainable API routes with proper validation and error handling.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 2000
    });

    const apiContent = response.choices[0]?.message.content || '';
    
    // Clean up the content if it contains markdown code blocks
    const cleanContent = apiContent.replace(/```(tsx|ts|typescript)?\n([\s\S]*?)\n```/g, '$2');
    
    result.files.push({
      path: `src/app/api/${routeName}/route.ts`,
      content: cleanContent,
      type: 'api'
    });
  } catch (error) {
    console.error('Error generating API route:', error);
    result.errors.push(`API route generation error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate layout file based on reasoning
 */
async function generateLayoutFile(
  reasoning: ReasoningStructured,
  routeName: string,
  result: GeneratedFiles
): Promise<void> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    result.errors.push('OpenAI client not configured. Cannot generate layout file.');
    return;
  }
  
  // Create a detailed prompt for the OpenAI model
  const prompt = `
Generate a Next.js layout component file (TypeScript) for a route named "${reasoning.routeName}".
The layout should provide a consistent structure for the page and any nested routes.

Implementation notes:
${reasoning.implementation || 'Use modern React patterns and shadcn/ui components'}

The file should:
- Use TypeScript React/Next.js
- Include proper imports
- Use modern React patterns
- Be fully responsive
- Be accessible
- Define a layout that wraps child components

Only include the file content, no explanations.
`;

  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an expert Next.js developer who specializes in creating clean, maintainable, accessible TypeScript code.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 1500
    });

    const layoutContent = response.choices[0]?.message.content || '';
    
    // Clean up the content if it contains markdown code blocks
    const cleanContent = layoutContent.replace(/```(tsx|jsx|typescript|javascript)?\n([\s\S]*?)\n```/g, '$2');
    
    result.files.push({
      path: `src/app/${routeName}/layout.tsx`,
      content: cleanContent,
      type: 'layout'
    });
  } catch (error) {
    console.error('Error generating layout file:', error);
    result.errors.push(`Layout generation error: ${error instanceof Error ? error.message : String(error)}`);
  }
} 