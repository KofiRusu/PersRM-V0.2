import OpenAI from "openai";
import reasoningExamples from "@/data/reasoning-examples.json";

/**
 * Generate reasoning response using OpenAI API
 */
export async function generateReasoning(
  openai: OpenAI,
  question: string
): Promise<string> {
  // Create a system prompt with examples
  const examples = reasoningExamples.slice(0, 3).map(example => 
    `Question: ${example.input}\n\nReasoning: ${example.expected_reasoning}`
  ).join("\n\n---\n\n");

  const systemPrompt = `You are an expert UI/UX designer and frontend developer with deep knowledge of design patterns, accessibility, and best practices.
  
Your task is to provide detailed, well-structured reasoning about UI/UX questions. For each question, analyze the problem, explain different approaches, highlight best practices, address accessibility concerns, and provide implementation guidance.

Structure your answer with these sections:
1. Analysis - Understand the core problem and constraints
2. Approaches - Different ways to solve the problem
3. Best Practices - Industry standards and recommended patterns
4. Accessibility Considerations - How to make the solution accessible
5. Implementation - Code patterns or technical approaches
6. Examples - Real-world examples when relevant

Here are some example questions and high-quality reasoning:

${examples}

Now, provide similar reasoning for the user's question. Be thorough, practical, and focus on modern web development techniques.`;

  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: question }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });

  return response.choices[0]?.message.content || "No reasoning could be generated.";
}

/**
 * Extract structured sections from reasoning text
 */
export function extractStructuredResponse(reasoning: string): {
  analysis: string;
  approaches: string[];
  bestPractices: string[];
  accessibility: string[];
  implementation: string;
  examples: string;
} {
  // Default structure
  const defaultResponse = {
    analysis: "Analysis could not be extracted.",
    approaches: ["No approaches could be extracted."],
    bestPractices: ["No best practices could be extracted."],
    accessibility: ["No accessibility considerations could be extracted."],
    implementation: "No implementation details could be extracted.",
    examples: "No examples could be extracted."
  };

  try {
    // Extract sections using regex patterns
    const analysisMatch = reasoning.match(/(?:Analysis|Understanding the Problem)[\s\S]*?(?=(?:Approaches|Different Approaches|Possible Solutions|$))/i);
    const approachesMatch = reasoning.match(/(?:Approaches|Different Approaches|Possible Solutions)[\s\S]*?(?=(?:Best Practices|Recommended Patterns|$))/i);
    const bestPracticesMatch = reasoning.match(/(?:Best Practices|Recommended Patterns)[\s\S]*?(?=(?:Accessibility|Accessibility Considerations|$))/i);
    const accessibilityMatch = reasoning.match(/(?:Accessibility|Accessibility Considerations)[\s\S]*?(?=(?:Implementation|Technical Implementation|Code Patterns|$))/i);
    const implementationMatch = reasoning.match(/(?:Implementation|Technical Implementation|Code Patterns)[\s\S]*?(?=(?:Examples|Real-world Examples|$))/i);
    const examplesMatch = reasoning.match(/(?:Examples|Real-world Examples)[\s\S]*?$/i);

    // Process matches
    const analysis = analysisMatch ? analysisMatch[0].replace(/(?:Analysis|Understanding the Problem)[:\s]*/i, "").trim() : defaultResponse.analysis;
    
    // Process approaches as bullet points
    const approachesText = approachesMatch ? approachesMatch[0].replace(/(?:Approaches|Different Approaches|Possible Solutions)[:\s]*/i, "").trim() : "";
    const approaches = approachesText ? extractBulletPoints(approachesText) : defaultResponse.approaches;
    
    // Process best practices as bullet points
    const bestPracticesText = bestPracticesMatch ? bestPracticesMatch[0].replace(/(?:Best Practices|Recommended Patterns)[:\s]*/i, "").trim() : "";
    const bestPractices = bestPracticesText ? extractBulletPoints(bestPracticesText) : defaultResponse.bestPractices;
    
    // Process accessibility as bullet points
    const accessibilityText = accessibilityMatch ? accessibilityMatch[0].replace(/(?:Accessibility|Accessibility Considerations)[:\s]*/i, "").trim() : "";
    const accessibility = accessibilityText ? extractBulletPoints(accessibilityText) : defaultResponse.accessibility;
    
    const implementation = implementationMatch ? implementationMatch[0].replace(/(?:Implementation|Technical Implementation|Code Patterns)[:\s]*/i, "").trim() : defaultResponse.implementation;
    const examples = examplesMatch ? examplesMatch[0].replace(/(?:Examples|Real-world Examples)[:\s]*/i, "").trim() : defaultResponse.examples;

    return {
      analysis,
      approaches,
      bestPractices,
      accessibility,
      implementation,
      examples
    };
  } catch (error) {
    console.error("Error extracting structured response:", error);
    return defaultResponse;
  }
}

/**
 * Extract bullet points from text
 */
export function extractBulletPoints(text: string): string[] {
  // Try to extract numbered or bulleted lists
  const bulletRegex = /(?:^|\n)[\s]*[•\-\*\d]+[\.\s]+(.*?)(?=(?:\n[\s]*[•\-\*\d]+[\.\s]+)|$)/g;
  const matches = [...text.matchAll(bulletRegex)];
  
  if (matches.length > 0) {
    return matches.map(match => match[1].trim());
  }
  
  // If no bullet points found, split by newlines and filter empty lines
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
} 