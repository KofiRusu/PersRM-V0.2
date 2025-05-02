import { openai } from "./openai";

export type ModelType = "openai" | "ollama" | "deepseek";

interface GenerateOptions {
  model?: string;
  modelType?: ModelType;
  temperature?: number;
  ollamaUrl?: string;
}

// Error tracking for API keys
const apiKeyStatus = {
  openai: { disabled: false, lastError: null, retryAfter: null },
  deepseek: { disabled: false, lastError: null, retryAfter: null },
};

// Retry configuration
const RETRY_DELAYS = [2000, 4000, 8000]; // Exponential backoff in milliseconds

/**
 * Generate a UI component from a natural language prompt
 */
export async function generateComponentFromPrompt(
  prompt: string,
  options: GenerateOptions = {},
): Promise<{
  code: string;
  error?: string;
  modelUsed?: string;
  reasoningScore?: number;
}> {
  const {
    model = "gpt-4o",
    modelType = "openai",
    temperature = 0.4,
    ollamaUrl = "http://localhost:11434",
  } = options;

  const startTime = Date.now();
  let result;
  let modelUsed = `${modelType}:${model}`;

  try {
    // Use the appropriate generator based on model type
    if (modelType === "deepseek" && !apiKeyStatus.deepseek.disabled) {
      try {
        result = await generateWithDeepSeek(prompt, model, temperature);
        modelUsed = `deepseek:${model}`;
      } catch (error) {
        // Log DeepSeek error and fall back to OpenAI
        console.error("DeepSeek API error, falling back to OpenAI:", error);
        apiKeyStatus.deepseek.disabled = true;
        apiKeyStatus.deepseek.lastError = error;

        // Set retry timer to re-enable after 30 minutes
        apiKeyStatus.deepseek.retryAfter = Date.now() + 30 * 60 * 1000;

        // Fall back to OpenAI
        result = await generateWithOpenAI(prompt, "gpt-4o", temperature);
        modelUsed = "openai:gpt-4o";
      }
    } else if (modelType === "openai" && !apiKeyStatus.openai.disabled) {
      result = await generateWithOpenAI(prompt, model, temperature);
      modelUsed = `openai:${model}`;
    } else if (modelType === "ollama") {
      result = await generateWithOllama(prompt, model, ollamaUrl);
      modelUsed = `ollama:${model}`;
    } else {
      // If the preferred model type is disabled, try the alternative
      if (modelType === "deepseek" && apiKeyStatus.deepseek.disabled) {
        if (!apiKeyStatus.openai.disabled) {
          result = await generateWithOpenAI(prompt, "gpt-4o", temperature);
          modelUsed = "openai:gpt-4o";
        } else {
          throw new Error("All API providers are currently disabled");
        }
      } else if (modelType === "openai" && apiKeyStatus.openai.disabled) {
        if (!apiKeyStatus.deepseek.disabled) {
          result = await generateWithDeepSeek(
            prompt,
            "deepseek-chat",
            temperature,
          );
          modelUsed = "deepseek:deepseek-chat";
        } else {
          throw new Error("All API providers are currently disabled");
        }
      }
    }

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // If we have code, evaluate reasoning quality
    let reasoningScore;
    if (result && result.code) {
      reasoningScore = await rateReasoning(result.code);
    }

    // Log the test for analytics
    await logReasoningTest(
      prompt,
      result?.code || "",
      modelUsed,
      reasoningScore,
    );

    return {
      ...result,
      modelUsed,
      reasoningScore,
      metadata: {
        responseTime,
        modelUsed,
        inputPrompt: prompt,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error generating component:", error);

    // Attempt retry with exponential backoff
    for (let i = 0; i < RETRY_DELAYS.length; i++) {
      try {
        console.log(`Retry attempt ${i + 1} after ${RETRY_DELAYS[i]}ms`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[i]));

        // Try the alternative provider if available
        if (!apiKeyStatus.openai.disabled && modelType !== "openai") {
          result = await generateWithOpenAI(prompt, "gpt-4o", temperature);
          modelUsed = "openai:gpt-4o";
          break;
        } else if (
          !apiKeyStatus.deepseek.disabled &&
          modelType !== "deepseek"
        ) {
          result = await generateWithDeepSeek(
            prompt,
            "deepseek-chat",
            temperature,
          );
          modelUsed = "deepseek:deepseek-chat";
          break;
        }
      } catch (retryError) {
        console.error(`Retry attempt ${i + 1} failed:`, retryError);
        if (i === RETRY_DELAYS.length - 1) {
          return {
            code: "",
            error: "All retry attempts failed. Please try again later.",
            modelUsed: "none",
            metadata: {
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    }

    return {
      code: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
      modelUsed: "none",
      metadata: {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Generate a UI component from a JSON schema
 */
export async function generateComponentFromSchema(
  schema: any,
  options: GenerateOptions = {},
): Promise<{
  code: string;
  error?: string;
  modelUsed?: string;
  reasoningScore?: number;
}> {
  const {
    model = "gpt-4o",
    modelType = "openai",
    temperature = 0.4,
    ollamaUrl = "http://localhost:11434",
  } = options;

  const schemaString = JSON.stringify(schema, null, 2);

  // Create a prompt that instructs the model to generate a form based on the schema
  const prompt = `
Generate a React component that implements a form based on the following JSON Schema:

\`\`\`json
${schemaString}
\`\`\`

Important requirements:
1. Use Tailwind CSS for styling
2. Use Shadcn UI components for form controls
3. Include proper validation using React Hook Form
4. Handle form submission
5. Make the UI responsive and accessible
6. Include proper error handling and loading states
7. Return clean, well-structured TypeScript/React code

The component should be complete and ready to use.
`;

  const startTime = Date.now();
  let result;
  let modelUsed = `${modelType}:${model}`;

  try {
    // Use the appropriate generator based on model type
    if (modelType === "deepseek" && !apiKeyStatus.deepseek.disabled) {
      try {
        result = await generateWithDeepSeek(prompt, model, temperature);
        modelUsed = `deepseek:${model}`;
      } catch (error) {
        // Log DeepSeek error and fall back to OpenAI
        console.error("DeepSeek API error, falling back to OpenAI:", error);
        apiKeyStatus.deepseek.disabled = true;
        apiKeyStatus.deepseek.lastError = error;

        // Set retry timer to re-enable after 30 minutes
        apiKeyStatus.deepseek.retryAfter = Date.now() + 30 * 60 * 1000;

        // Fall back to OpenAI
        result = await generateWithOpenAI(prompt, "gpt-4o", temperature);
        modelUsed = "openai:gpt-4o";
      }
    } else if (modelType === "openai" && !apiKeyStatus.openai.disabled) {
      result = await generateWithOpenAI(prompt, model, temperature);
      modelUsed = `openai:${model}`;
    } else if (modelType === "ollama") {
      result = await generateWithOllama(prompt, model, ollamaUrl);
      modelUsed = `ollama:${model}`;
    } else {
      // If the preferred model type is disabled, try the alternative
      if (modelType === "deepseek" && apiKeyStatus.deepseek.disabled) {
        if (!apiKeyStatus.openai.disabled) {
          result = await generateWithOpenAI(prompt, "gpt-4o", temperature);
          modelUsed = "openai:gpt-4o";
        } else {
          throw new Error("All API providers are currently disabled");
        }
      } else if (modelType === "openai" && apiKeyStatus.openai.disabled) {
        if (!apiKeyStatus.deepseek.disabled) {
          result = await generateWithDeepSeek(
            prompt,
            "deepseek-chat",
            temperature,
          );
          modelUsed = "deepseek:deepseek-chat";
        } else {
          throw new Error("All API providers are currently disabled");
        }
      }
    }

    // Calculate response time
    const responseTime = Date.now() - startTime;

    // If we have code, evaluate reasoning quality
    let reasoningScore;
    if (result && result.code) {
      reasoningScore = await rateReasoning(result.code);
    }

    // Log the test for analytics
    await logReasoningTest(
      prompt,
      result?.code || "",
      modelUsed,
      reasoningScore,
    );

    return {
      ...result,
      modelUsed,
      reasoningScore,
      metadata: {
        responseTime,
        modelUsed,
        inputPrompt: prompt,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("Error generating component from schema:", error);

    // Attempt retry with exponential backoff
    for (let i = 0; i < RETRY_DELAYS.length; i++) {
      try {
        console.log(`Retry attempt ${i + 1} after ${RETRY_DELAYS[i]}ms`);
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[i]));

        // Try the alternative provider if available
        if (!apiKeyStatus.openai.disabled && modelType !== "openai") {
          result = await generateWithOpenAI(prompt, "gpt-4o", temperature);
          modelUsed = "openai:gpt-4o";
          break;
        } else if (
          !apiKeyStatus.deepseek.disabled &&
          modelType !== "deepseek"
        ) {
          result = await generateWithDeepSeek(
            prompt,
            "deepseek-chat",
            temperature,
          );
          modelUsed = "deepseek:deepseek-chat";
          break;
        }
      } catch (retryError) {
        console.error(`Retry attempt ${i + 1} failed:`, retryError);
        if (i === RETRY_DELAYS.length - 1) {
          return {
            code: "",
            error: "All retry attempts failed. Please try again later.",
            modelUsed: "none",
            metadata: {
              error:
                error instanceof Error
                  ? error.message
                  : "Unknown error occurred",
              timestamp: new Date().toISOString(),
            },
          };
        }
      }
    }

    return {
      code: "",
      error: error instanceof Error ? error.message : "Unknown error occurred",
      modelUsed: "none",
      metadata: {
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Generate component using OpenAI API
 */
async function generateWithOpenAI(
  prompt: string,
  model: string,
  temperature: number,
): Promise<{ code: string; error?: string }> {
  // If OpenAI client is available from the imported module
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `You are an expert frontend engineer who specializes in creating React components with Tailwind CSS and Shadcn UI. 
            You output clean, accessible, well-structured TypeScript code. 
            When given a request, you respond with a complete, ready-to-use React component.
            Always wrap your code in \`\`\`tsx code blocks and include proper imports.
            Never include explanations or comments outside the code block.`,
          },
          { role: "user", content: prompt },
        ],
        temperature,
      });

      const content = response.choices[0]?.message.content || "";

      // Extract code from markdown code blocks if present
      const codeMatch = content.match(/```(?:tsx|jsx|ts|js)?\s*([\s\S]*?)```/);
      const code = codeMatch ? codeMatch[1].trim() : content;

      return { code };
    } catch (error) {
      // Mark OpenAI as disabled if we get a serious error
      if (error instanceof Error && error.message.includes("401")) {
        apiKeyStatus.openai.disabled = true;
        apiKeyStatus.openai.lastError = error;
        apiKeyStatus.openai.retryAfter = Date.now() + 30 * 60 * 1000;
      }

      if (error instanceof Error) {
        return { code: "", error: error.message };
      }
      return { code: "", error: "Unknown error with OpenAI API" };
    }
  }

  // Fallback to fetch if the OpenAI client isn't available
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are an expert frontend engineer who specializes in creating React components with Tailwind CSS and Shadcn UI. 
            You output clean, accessible, well-structured TypeScript code. 
            When given a request, you respond with a complete, ready-to-use React component.
            Always wrap your code in \`\`\`tsx code blocks and include proper imports.
            Never include explanations or comments outside the code block.`,
          },
          { role: "user", content: prompt },
        ],
        temperature,
      }),
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        apiKeyStatus.openai.disabled = true;
        apiKeyStatus.openai.lastError = new Error(
          `OpenAI API error: ${response.status} ${response.statusText}`,
        );
        apiKeyStatus.openai.retryAfter = Date.now() + 30 * 60 * 1000;
      }
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    // Extract code from markdown code blocks if present
    const codeMatch = content.match(/```(?:tsx|jsx|ts|js)?\s*([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : content;

    return { code };
  } catch (error) {
    if (error instanceof Error) {
      return { code: "", error: error.message };
    }
    return { code: "", error: "Unknown error with OpenAI API" };
  }
}

/**
 * Generate component using Ollama API
 */
async function generateWithOllama(
  prompt: string,
  model: string,
  ollamaUrl: string,
): Promise<{ code: string; error?: string }> {
  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt: `You are an expert frontend engineer who specializes in creating React components with Tailwind CSS and Shadcn UI. 
          You output clean, accessible, well-structured TypeScript code. 
          When given a request, you respond with a complete, ready-to-use React component.
          Always wrap your code in \`\`\`tsx code blocks and include proper imports.
          Never include explanations or comments outside the code block.
          
          USER REQUEST: ${prompt}`,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const content = data.response || "";

    // Extract code from markdown code blocks if present
    const codeMatch = content.match(/```(?:tsx|jsx|ts|js)?\s*([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : content;

    return { code };
  } catch (error) {
    if (error instanceof Error) {
      return { code: "", error: error.message };
    }
    return { code: "", error: "Unknown error with Ollama API" };
  }
}

/**
 * Generate component using DeepSeek API
 */
async function generateWithDeepSeek(
  prompt: string,
  model: string = "deepseek-chat",
  temperature: number = 0.4,
): Promise<{ code: string; error?: string }> {
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `You are an expert frontend engineer who specializes in creating React components with Tailwind CSS and Shadcn UI. 
            You output clean, accessible, well-structured TypeScript code. 
            When given a request, you respond with a complete, ready-to-use React component.
            Always wrap your code in \`\`\`tsx code blocks and include proper imports.
            Never include explanations or comments outside the code block.`,
          },
          { role: "user", content: prompt },
        ],
        temperature,
      }),
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        apiKeyStatus.deepseek.disabled = true;
        apiKeyStatus.deepseek.lastError = new Error(
          `DeepSeek API error: ${response.status} ${response.statusText}`,
        );
        apiKeyStatus.deepseek.retryAfter = Date.now() + 30 * 60 * 1000;
      }
      throw new Error(
        `DeepSeek API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "";

    // Extract code from markdown code blocks if present
    const codeMatch = content.match(/```(?:tsx|jsx|ts|js)?\s*([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : content;

    return { code };
  } catch (error) {
    if (error instanceof Error) {
      return { code: "", error: error.message };
    }
    return { code: "", error: "Unknown error with DeepSeek API" };
  }
}

/**
 * Rate the reasoning quality of generated code
 */
export async function rateReasoning(code: string): Promise<number> {
  try {
    // Skip if OpenAI is disabled
    if (apiKeyStatus.openai.disabled) {
      return 5; // Default middle score
    }

    // Use OpenAI to evaluate the reasoning
    const prompt = `
    Evaluate the reasoning quality of this React component code on a scale of 1-10.
    Consider:
    1. Does it follow best practices?
    2. Is the code well-structured and maintainable?
    3. Does it handle edge cases?
    4. Is the component accessible?
    5. Is the code DRY (Don't Repeat Yourself)?
    
    Respond with only a single integer between 1 and 10.
    
    Code to evaluate:
    \`\`\`tsx
    ${code}
    \`\`\`
    `;

    // Use the openai client if available
    if (openai) {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const content = response.choices[0]?.message.content || "";

      // Extract score using regex
      const scoreMatch = content.match(/\b([1-9]|10)\b/);
      if (scoreMatch) {
        return parseInt(scoreMatch[0], 10);
      }
    } else {
      // Use fetch API as fallback
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.3,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `OpenAI API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";

      // Extract score using regex
      const scoreMatch = content.match(/\b([1-9]|10)\b/);
      if (scoreMatch) {
        return parseInt(scoreMatch[0], 10);
      }
    }

    // Default fallback score
    return 5;
  } catch (error) {
    console.error("Error rating reasoning:", error);
    return 5; // Default middle score on error
  }
}

/**
 * Log reasoning test results to database
 */
async function logReasoningTest(
  prompt: string,
  code: string,
  model: string,
  score?: number,
): Promise<void> {
  try {
    const response = await fetch("/api/reasoning-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        code,
        model,
        score: score || 0,
      }),
    });

    if (!response.ok) {
      console.error("Error logging reasoning test:", await response.text());
    }
  } catch (error) {
    console.error("Error logging reasoning test:", error);
  }
}

/**
 * Format the code with proper indentation
 */
export function formatCode(code: string): string {
  try {
    // Very simple formatting for demonstration
    // In a real application, you might use a proper code formatter like prettier
    return code.trim();
  } catch (error) {
    console.error("Error formatting code:", error);
    return code;
  }
}

/**
 * Check if API provider is available
 */
export function isProviderAvailable(provider: "openai" | "deepseek"): boolean {
  // Check if provider is disabled
  if (apiKeyStatus[provider].disabled) {
    // Check if retry period has elapsed
    if (
      apiKeyStatus[provider].retryAfter &&
      Date.now() > apiKeyStatus[provider].retryAfter
    ) {
      // Re-enable provider for retry
      apiKeyStatus[provider].disabled = false;
      apiKeyStatus[provider].lastError = null;
      apiKeyStatus[provider].retryAfter = null;
      return true;
    }
    return false;
  }
  return true;
}

export interface RouteGenerationOptions {
  prompt: string;
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  endpoint: string;
  requestData?: string;
  responseFormat?: string;
  model?: string;
}

export async function generateRouteCode(
  options: RouteGenerationOptions,
): Promise<string> {
  const {
    prompt,
    method,
    endpoint,
    requestData,
    responseFormat,
    model = "gpt-4",
  } = options;

  try {
    // Determine which AI model to use
    if (model.startsWith("gpt-")) {
      return generateRouteWithOpenAI(options);
    } else {
      return generateRouteWithOllama(options);
    }
  } catch (error) {
    console.error("Error generating route code:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to generate route code",
    );
  }
}

/**
 * Generate route code using OpenAI
 */
async function generateRouteWithOpenAI(
  options: RouteGenerationOptions,
): Promise<string> {
  const {
    prompt,
    method,
    endpoint,
    requestData,
    responseFormat,
    model = "gpt-4",
  } = options;

  try {
    // Check if OpenAI client is initialized
    const openai = getOpenAIClient();
    if (!openai) {
      throw new Error("OpenAI client not initialized");
    }

    // Construct the system prompt
    const systemPrompt = `You are an expert Next.js API route generator. Your task is to generate well-structured, 
    clean and secure route handlers for Next.js App Router. Follow these guidelines:
    
    - Generate route handlers using Next.js App Router conventions
    - Use proper error handling and validation with zod
    - Include comments to explain key parts of the code
    - Follow best practices for security, validation and error handling
    - Do not import components or libraries that would not be used
    - Generate ONLY the code, no explanations or markdown`;

    // Construct the user prompt
    let userPrompt = `Generate a ${method} route handler for endpoint "${endpoint}" that does the following:
    
    ${prompt}
    `;

    if (requestData) {
      userPrompt += `\nThe request body structure should be: ${requestData}`;
    }

    if (responseFormat) {
      userPrompt += `\nThe response format should be: ${responseFormat}`;
    }

    // Make the API call
    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
    });

    // Extract and return the generated code
    const generatedCode = response.choices[0]?.message.content || "";
    return generatedCode.trim();
  } catch (error) {
    console.error("OpenAI route generation error:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to generate route with OpenAI",
    );
  }
}

/**
 * Generate route code using Ollama
 */
async function generateRouteWithOllama(
  options: RouteGenerationOptions,
): Promise<string> {
  const {
    prompt,
    method,
    endpoint,
    requestData,
    responseFormat,
    model = "llama3",
  } = options;

  try {
    // Construct the system prompt
    const systemPrompt = `You are an expert Next.js API route generator. Your task is to generate well-structured, 
    clean and secure route handlers for Next.js App Router. Follow these guidelines:
    
    - Generate route handlers using Next.js App Router conventions
    - Use proper error handling and validation with zod
    - Include comments to explain key parts of the code
    - Follow best practices for security, validation and error handling
    - Do not import components or libraries that would not be used
    - Generate ONLY the code, no explanations or markdown`;

    // Construct the user prompt
    let userPrompt = `Generate a ${method} route handler for endpoint "${endpoint}" that does the following:
    
    ${prompt}
    `;

    if (requestData) {
      userPrompt += `\nThe request body structure should be: ${requestData}`;
    }

    if (responseFormat) {
      userPrompt += `\nThe response format should be: ${responseFormat}`;
    }

    // Make the API call to Ollama
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        prompt: `${systemPrompt}\n\n${userPrompt}`,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    return result.response.trim();
  } catch (error) {
    console.error("Ollama route generation error:", error);
    throw new Error(
      error instanceof Error
        ? error.message
        : "Failed to generate route with Ollama",
    );
  }
}

export type RouteGenerationOptions = {
  method: string;
  endpoint: string;
  description: string;
  requestData: string | null;
  responseFormat: string | null;
  model?: ModelType;
};

export async function generateRouteCode(
  options: RouteGenerationOptions,
): Promise<string> {
  const {
    method,
    endpoint,
    description,
    requestData,
    responseFormat,
    model = "openai",
  } = options;

  // Create a prompt for the route generation
  const prompt = `
Generate a Next.js API route handler for a ${method.toUpperCase()} endpoint at ${endpoint}.

Description: ${description}

${
  requestData
    ? `The request will include the following data structure:
${requestData}`
    : "The request does not include any body data."
}

${
  responseFormat
    ? `The response should follow this format:
${responseFormat}`
    : "The response should return appropriate status codes and messages."
}

Requirements:
- Use Next.js App Router API route conventions
- Include proper error handling with try/catch blocks
- Use Zod for request validation if needed
- Return appropriate HTTP status codes
- Follow REST API best practices
- Include TypeScript types for request/response
- Add helpful comments
- Return only the complete code for the route.ts file with no additional explanations
`;

  const modelType =
    typeof model === "string" &&
    (model === "openai" || model === "ollama" || model === "deepseek")
      ? (model as ModelType)
      : "openai";

  const modelName =
    typeof model === "string" &&
    model !== "openai" &&
    model !== "ollama" &&
    model !== "deepseek"
      ? model
      : modelType === "openai"
        ? "gpt-4o"
        : "llama3";

  try {
    // Use the appropriate generator based on model type
    if (modelType === "openai") {
      const result = await generateWithOpenAI(prompt, modelName, 0.4);

      // Extract code from markdown code blocks if present
      const codeMatch = result.code.match(
        /```(?:tsx|ts|js|jsx)?\s*([\s\S]*?)```/,
      );
      const code = codeMatch ? codeMatch[1].trim() : result.code;

      return code;
    } else if (modelType === "ollama") {
      const result = await generateWithOllama(
        prompt,
        modelName,
        "http://localhost:11434",
      );

      // Extract code from markdown code blocks if present
      const codeMatch = result.code.match(
        /```(?:tsx|ts|js|jsx)?\s*([\s\S]*?)```/,
      );
      const code = codeMatch ? codeMatch[1].trim() : result.code;

      return code;
    } else if (modelType === "deepseek") {
      const result = await generateWithDeepSeek(prompt, modelName, 0.4);

      // Extract code from markdown code blocks if present
      const codeMatch = result.code.match(
        /```(?:tsx|ts|js|jsx)?\s*([\s\S]*?)```/,
      );
      const code = codeMatch ? codeMatch[1].trim() : result.code;

      return code;
    }

    throw new Error(`Unsupported model type: ${modelType}`);
  } catch (error) {
    console.error("Error generating route code:", error);
    throw error;
  }
}
