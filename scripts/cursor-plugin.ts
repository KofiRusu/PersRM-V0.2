/**
 * Cursor Plugin for UI/UX Reasoning and Code Generation
 */
import { registerCommand, showInputBox, editor, window, showNotification } from 'cursor';

interface ReasoningResponse {
  fullResponse: string;
  structuredResponse: any;
  success: boolean;
  error?: string;
}

interface CodegenResponse {
  code: string;
  success: boolean;
  error?: string;
}

interface RouteGenerationResponse {
  success: boolean;
  reasoning: string;
  structuredReasoning: any;
  files: Array<{
    path: string;
    type: string;
  }>;
  errors: string[];
}

/**
 * Get reasoning from the server for a given prompt
 */
async function getReasoningOutput(prompt: string): Promise<ReasoningResponse> {
  try {
    const res = await fetch("/api/reasoning", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: prompt }),
    });
    
    if (!res.ok) {
      throw new Error(`Error: ${res.status} ${res.statusText}`);
    }
    
    return {
      ...(await res.json()),
      success: true,
    };
  } catch (error) {
    console.error("Failed to get reasoning:", error);
    return {
      fullResponse: "",
      structuredResponse: {},
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Generate code from reasoning
 */
async function generateCodeFromReasoning(reasoning: string): Promise<CodegenResponse> {
  try {
    const res = await fetch("/api/codegen", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reasoning }),
    });
    
    if (!res.ok) {
      throw new Error(`Error: ${res.status} ${res.statusText}`);
    }
    
    return {
      ...(await res.json()),
      success: true,
    };
  } catch (error) {
    console.error("Failed to generate code:", error);
    return {
      code: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Generate a complete route from prompt
 */
async function generateRoute(prompt: string): Promise<RouteGenerationResponse> {
  try {
    const res = await fetch("/api/generate-route", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });
    
    if (!res.ok) {
      throw new Error(`Error: ${res.status} ${res.statusText}`);
    }
    
    return {
      ...(await res.json()),
      success: true,
    };
  } catch (error) {
    console.error("Failed to generate route:", error);
    return {
      success: false,
      reasoning: "",
      structuredReasoning: {},
      files: [],
      errors: [error instanceof Error ? error.message : "Unknown error occurred"],
    };
  }
}

/**
 * Insert text at the current cursor position
 */
function insertIntoEditor(text: string) {
  const currentPosition = editor.selection.active;
  editor.edit((editBuilder) => {
    editBuilder.insert(currentPosition, text);
  });
}

/**
 * Create a properly formatted string for insertion
 */
function formatResults(reasoning: string, code: string): string {
  return `
/*
 * UI/UX Reasoning:
 * ${reasoning.split('\n').join('\n * ')}
 */

${code}
`;
}

/**
 * Format file generation summary
 */
function formatFileGenerationSummary(files: Array<{ path: string; type: string }>): string {
  if (files.length === 0) return "No files were generated.";
  
  return `
Generated ${files.length} file(s):

${files.map(file => `- ${file.path} (${file.type})`).join('\n')}
`;
}

/**
 * Main command: Generate UI component with reasoning
 */
registerCommand({
  id: "generate-reasoning-ui",
  name: "🧠 Generate UI Component with Reasoning",
  handler: async () => {
    try {
      // 1. Ask for user prompt
      const prompt = await showInputBox({
        placeHolder: "Describe the UI component you want to generate",
        prompt: "E.g., Create a user profile form with photo upload",
      });
      
      if (!prompt) return; // User cancelled
      
      // Show status notification
      showNotification({ type: "info", message: "Generating reasoning..." });
      
      // 2. Generate reasoning
      const reasoningResult = await getReasoningOutput(prompt);
      
      if (!reasoningResult.success) {
        showNotification({ 
          type: "error", 
          message: `Failed to generate reasoning: ${reasoningResult.error || "Unknown error"}` 
        });
        return;
      }
      
      // 3. Generate code from reasoning
      showNotification({ type: "info", message: "Generating code from reasoning..." });
      
      const codeResult = await generateCodeFromReasoning(reasoningResult.fullResponse);
      
      if (!codeResult.success) {
        // Still insert reasoning even if code generation fails
        insertIntoEditor(`/* 
 * UI/UX Reasoning:
 * ${reasoningResult.fullResponse.split('\n').join('\n * ')}
 */`);
        
        showNotification({ 
          type: "warning", 
          message: `Inserted reasoning but code generation failed: ${codeResult.error || "Unknown error"}` 
        });
        return;
      }
      
      // 4. Insert both reasoning and code
      insertIntoEditor(formatResults(reasoningResult.fullResponse, codeResult.code));
      
      showNotification({ 
        type: "success", 
        message: "Successfully generated component with reasoning!" 
      });
    } catch (error) {
      console.error("Command failed:", error);
      showNotification({ 
        type: "error", 
        message: `Command failed: ${error instanceof Error ? error.message : "Unknown error"}` 
      });
    }
  }
});

/**
 * Command: Generate complete route with reasoning
 */
registerCommand({
  id: "generate-reasoning-route",
  name: "🛣️ Generate Complete Route with Reasoning",
  handler: async () => {
    try {
      // 1. Ask for user prompt
      const prompt = await showInputBox({
        placeHolder: "Describe the route you want to generate",
        prompt: "E.g., Create a feedback form page with validation and API endpoint",
      });
      
      if (!prompt) return; // User cancelled
      
      // Show status notification
      showNotification({ type: "info", message: "Generating route with reasoning..." });
      
      // 2. Generate complete route
      const routeResult = await generateRoute(prompt);
      
      if (!routeResult.success || routeResult.errors.length > 0) {
        // Insert reasoning even if route generation fails
        if (routeResult.reasoning) {
          insertIntoEditor(`/* 
 * UI/UX Reasoning:
 * ${routeResult.reasoning.split('\n').join('\n * ')}
 */`);
          
          showNotification({ 
            type: "warning", 
            message: `Inserted reasoning but route generation failed: ${routeResult.errors.join(', ')}` 
          });
        } else {
          showNotification({ 
            type: "error", 
            message: `Failed to generate route: ${routeResult.errors.join(', ') || "Unknown error"}` 
          });
        }
        return;
      }
      
      // 3. Insert reasoning and file generation summary
      insertIntoEditor(`/* 
 * UI/UX Reasoning:
 * ${routeResult.reasoning.split('\n').join('\n * ')}
 * 
 * Files Generated:
 * ${formatFileGenerationSummary(routeResult.files).split('\n').join('\n * ')}
 */`);
      
      showNotification({ 
        type: "success", 
        message: `Successfully generated route with ${routeResult.files.length} file(s)!` 
      });
    } catch (error) {
      console.error("Command failed:", error);
      showNotification({ 
        type: "error", 
        message: `Command failed: ${error instanceof Error ? error.message : "Unknown error"}` 
      });
    }
  }
});

/**
 * Command: Generate just the reasoning for a UI component
 */
registerCommand({
  id: "generate-ui-reasoning-only",
  name: "🤔 Generate UI Reasoning Only",
  handler: async () => {
    try {
      // 1. Ask for user prompt
      const prompt = await showInputBox({
        placeHolder: "Describe the UI component you want reasoning for",
        prompt: "E.g., Design a dashboard homepage with activity feed",
      });
      
      if (!prompt) return; // User cancelled
      
      // Show status notification
      showNotification({ type: "info", message: "Generating reasoning..." });
      
      // 2. Generate reasoning
      const reasoningResult = await getReasoningOutput(prompt);
      
      if (!reasoningResult.success) {
        showNotification({ 
          type: "error", 
          message: `Failed to generate reasoning: ${reasoningResult.error || "Unknown error"}` 
        });
        return;
      }
      
      // 3. Insert reasoning as comment
      insertIntoEditor(`/* 
 * UI/UX Reasoning:
 * ${reasoningResult.fullResponse.split('\n').join('\n * ')}
 */`);
      
      showNotification({ 
        type: "success", 
        message: "Successfully generated component reasoning!" 
      });
    } catch (error) {
      console.error("Command failed:", error);
      showNotification({ 
        type: "error", 
        message: `Command failed: ${error instanceof Error ? error.message : "Unknown error"}` 
      });
    }
  }
});

// Export that we've loaded
export function activate() {
  console.log("Reasoning UI Generator plugin activated!");
} 