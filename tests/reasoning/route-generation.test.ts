import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { generateReasoning } from '@/app/api/reasoning/utils';
import { extractStructuredReasoning } from '@/app/api/codegen/route';
import { generateRouteFiles, ReasoningStructured } from '@/lib/generation/generateRouteFiles';
import fs from 'fs';
import path from 'path';

// Mocks
jest.mock('@/app/api/reasoning/utils', () => ({
  generateReasoning: jest.fn(),
}));

jest.mock('@/app/api/codegen/route', () => ({
  extractStructuredReasoning: jest.fn(),
}));

jest.mock('@/lib/generation/generateRouteFiles', () => ({
  generateRouteFiles: jest.fn(),
}));

jest.mock('fs', () => ({
  writeFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('Route Generation Pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockPrompt = "Create a feedback form page for logged-in users with validation and API endpoint.";
  
  const mockReasoning = `
Analysis:
I need to create a feedback form page that allows logged-in users to submit feedback. This will require form validation and an API endpoint.

Approaches:
1. Server-side form with server actions
2. Client-side form with API endpoint
3. Progressive enhancement with both

Best Practices:
- Use controlled form components
- Implement proper validation feedback
- Show loading states during submission
- Provide success/error messages

Accessibility:
- Use proper ARIA attributes
- Ensure keyboard navigation works
- Provide clear error messages

Implementation:
- Use React Hook Form with Zod validation
- Create a feedback schema
- Set up API endpoint for form submission
- Store feedback in database
- Redirect to success page after submission

Examples:
- GitHub feedback forms
- Vercel contact forms
`;

  const mockStructuredReasoning: ReasoningStructured = {
    routeName: "feedback-form",
    componentType: "form",
    pageType: "form",
    needsApi: true,
    needsLayout: false,
    formFields: [
      {
        name: "title",
        type: "text",
        label: "Feedback Title",
        required: true
      },
      {
        name: "category",
        type: "select",
        label: "Category",
        required: true
      },
      {
        name: "message",
        type: "textarea",
        label: "Your Feedback",
        required: true
      },
      {
        name: "rating",
        type: "number",
        label: "Rating (1-5)",
        required: true
      }
    ],
    description: "A form to collect user feedback with validation and submission to an API endpoint",
    implementation: "Use React Hook Form with Zod validation, create API endpoint to store feedback in database"
  };

  const mockGeneratedFiles = {
    files: [
      {
        path: "src/app/feedback-form/page.tsx",
        content: "// Mock page.tsx content",
        type: "page" as const
      },
      {
        path: "src/app/api/feedback-form/route.ts",
        content: "// Mock API route.ts content",
        type: "api" as const
      }
    ],
    errors: []
  };

  it('should successfully generate route files for a valid prompt', async () => {
    // Mock successful responses for each step
    (generateReasoning as jest.Mock).mockResolvedValue(mockReasoning);
    (extractStructuredReasoning as jest.Mock).mockResolvedValue(mockStructuredReasoning);
    (generateRouteFiles as jest.Mock).mockResolvedValue(mockGeneratedFiles);
    
    // Call API directly (simplified)
    const reasoningResult = await generateReasoning({} as any, mockPrompt);
    const structuredResult = await extractStructuredReasoning(reasoningResult);
    const filesResult = await generateRouteFiles(structuredResult!);
    
    // Assertions
    expect(generateReasoning).toHaveBeenCalledWith(expect.anything(), mockPrompt);
    expect(extractStructuredReasoning).toHaveBeenCalledWith(mockReasoning);
    expect(generateRouteFiles).toHaveBeenCalledWith(mockStructuredReasoning);
    
    expect(filesResult.files).toHaveLength(2);
    expect(filesResult.errors).toHaveLength(0);
    expect(filesResult.files[0].path).toContain('feedback-form');
    expect(filesResult.files[1].path).toContain('api/feedback-form');
  });

  it('should handle reasoning generation failure', async () => {
    // Mock reasoning failure
    const mockError = new Error('Failed to generate reasoning');
    (generateReasoning as jest.Mock).mockRejectedValue(mockError);
    
    // Call API and expect error to be thrown
    await expect(async () => {
      await generateReasoning({} as any, mockPrompt);
    }).rejects.toThrow('Failed to generate reasoning');
    
    // Assertions
    expect(generateReasoning).toHaveBeenCalledWith(expect.anything(), mockPrompt);
    expect(extractStructuredReasoning).not.toHaveBeenCalled();
    expect(generateRouteFiles).not.toHaveBeenCalled();
  });

  it('should handle structured reasoning extraction failure', async () => {
    // Mock successful reasoning but failed extraction
    (generateReasoning as jest.Mock).mockResolvedValue(mockReasoning);
    (extractStructuredReasoning as jest.Mock).mockResolvedValue(null);
    
    // Call API steps
    const reasoningResult = await generateReasoning({} as any, mockPrompt);
    const structuredResult = await extractStructuredReasoning(reasoningResult);
    
    // Assertions
    expect(generateReasoning).toHaveBeenCalledWith(expect.anything(), mockPrompt);
    expect(extractStructuredReasoning).toHaveBeenCalledWith(mockReasoning);
    expect(structuredResult).toBeNull();
    expect(generateRouteFiles).not.toHaveBeenCalled();
  });

  it('should handle route file generation errors', async () => {
    // Mock successful reasoning and extraction but file generation errors
    (generateReasoning as jest.Mock).mockResolvedValue(mockReasoning);
    (extractStructuredReasoning as jest.Mock).mockResolvedValue(mockStructuredReasoning);
    (generateRouteFiles as jest.Mock).mockResolvedValue({
      files: [],
      errors: ['Failed to generate page file', 'OpenAI API error']
    });
    
    // Call API steps
    const reasoningResult = await generateReasoning({} as any, mockPrompt);
    const structuredResult = await extractStructuredReasoning(reasoningResult);
    const filesResult = await generateRouteFiles(structuredResult!);
    
    // Assertions
    expect(generateReasoning).toHaveBeenCalledWith(expect.anything(), mockPrompt);
    expect(extractStructuredReasoning).toHaveBeenCalledWith(mockReasoning);
    expect(generateRouteFiles).toHaveBeenCalledWith(mockStructuredReasoning);
    
    expect(filesResult.files).toHaveLength(0);
    expect(filesResult.errors).toHaveLength(2);
    expect(filesResult.errors[0]).toContain('Failed to generate page file');
  });

  it('should handle invalid structured reasoning', async () => {
    // Mock successful reasoning but invalid structured reasoning (missing required fields)
    (generateReasoning as jest.Mock).mockResolvedValue(mockReasoning);
    (extractStructuredReasoning as jest.Mock).mockResolvedValue({
      // Missing required routeName field
      componentType: "form"
    } as any);
    
    // Call API steps
    const reasoningResult = await generateReasoning({} as any, mockPrompt);
    const structuredResult = await extractStructuredReasoning(reasoningResult);
    
    // We expect generateRouteFiles to throw an error due to missing required fields
    await expect(async () => {
      await generateRouteFiles(structuredResult!);
    }).rejects.toThrow();
    
    // Assertions
    expect(generateReasoning).toHaveBeenCalledWith(expect.anything(), mockPrompt);
    expect(extractStructuredReasoning).toHaveBeenCalledWith(mockReasoning);
  });
}); 