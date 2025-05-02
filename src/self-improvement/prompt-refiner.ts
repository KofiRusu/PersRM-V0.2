import * as fs from "fs";
import * as path from "path";
import { PersRMAgent } from "../agent";

/**
 * Interface representing a refined prompt with improvements
 */
export interface RefinedPrompt {
  promptId: string;
  originalText: string;
  suggestedImprovements: string[];
  refinedText: string;
}

/**
 * Class responsible for refining prompts based on improvement suggestions
 */
export class PromptRefiner {
  private static readonly ACCESSIBILITY_KEYWORDS = [
    "aria",
    "keyboard",
    "focus",
    "accessible",
    "screen reader",
    "contrast",
    "alt text",
  ];

  private static readonly UX_KEYWORDS = [
    "responsive",
    "transition",
    "animation",
    "hover",
    "mobile",
    "loading",
    "feedback",
  ];

  private static readonly CODE_QUALITY_KEYWORDS = [
    "structure",
    "organization",
    "error handling",
    "validation",
    "naming",
    "comment",
  ];

  private agent: PersRMAgent;

  /**
   * Constructor for the PromptRefiner class
   * @param agent The PersRM agent to use for refinements
   */
  constructor(agent: PersRMAgent) {
    this.agent = agent;
  }

  /**
   * Analyzes improvement suggestions and generates refined prompts
   * @param improvementReportPath Path to the improvement suggestions file
   * @returns Array of refined prompts
   */
  public async analyzeSuggestions(
    improvementReportPath: string,
  ): Promise<RefinedPrompt[]> {
    // Check if the improvement report exists
    if (!fs.existsSync(improvementReportPath)) {
      throw new Error(
        `Improvement report not found at: ${improvementReportPath}`,
      );
    }

    // Read the improvement report
    const reportContent = fs.readFileSync(improvementReportPath, "utf-8");

    // Extract the prompt improvement suggestions
    const promptImprovements = this.extractPromptImprovements(reportContent);

    if (promptImprovements.length === 0) {
      console.warn("No prompt improvements found in the report");
    }

    // Get all prompt files from the prompts directory
    const promptsDir = path.join(
      process.cwd(),
      "generation-benchmark",
      "prompts",
    );
    const promptFiles = fs
      .readdirSync(promptsDir)
      .filter((file) => file.startsWith("prompt-") && file.endsWith(".txt"))
      .sort();

    // Process each prompt file and generate refinements
    const refinedPrompts: RefinedPrompt[] = [];

    for (const promptFile of promptFiles) {
      // Extract the prompt ID
      const match = promptFile.match(/prompt-(\d+)/);
      if (!match) continue;

      const promptId = match[1];

      // Read the original prompt content
      const promptPath = path.join(promptsDir, promptFile);
      const originalText = fs.readFileSync(promptPath, "utf-8");

      // Generate improvements specific to this prompt
      const suggestedImprovements = this.generatePromptSpecificImprovements(
        originalText,
        promptImprovements,
      );

      // Generate the refined text
      const refinedText = this.generateRefinedText(
        originalText,
        suggestedImprovements,
      );

      // Add to the list of refined prompts
      refinedPrompts.push({
        promptId,
        originalText,
        suggestedImprovements,
        refinedText,
      });
    }

    return refinedPrompts;
  }

  /**
   * Applies refinements to the original prompts and saves them to a new directory
   * @param refinedPrompts Array of refined prompts
   * @param promptDir Directory containing the original prompts (optional)
   */
  public async applyRefinements(
    refinedPrompts: RefinedPrompt[],
    promptDir: string = path.join(
      process.cwd(),
      "generation-benchmark",
      "prompts",
    ),
  ): Promise<void> {
    // Ensure the output directory exists
    const outputDir = path.join(
      process.cwd(),
      "generation-benchmark",
      "prompts-refined",
    );
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Process each refined prompt
    for (const refinedPrompt of refinedPrompts) {
      // Find the original prompt file
      const promptFiles = fs
        .readdirSync(promptDir)
        .filter((file) => file.startsWith(`prompt-${refinedPrompt.promptId}`));

      if (promptFiles.length === 0) {
        console.warn(`No prompt file found for ID: ${refinedPrompt.promptId}`);
        continue;
      }

      const originalFileName = promptFiles[0];
      const outputPath = path.join(outputDir, originalFileName);

      // Write the refined text to the output file
      fs.writeFileSync(outputPath, refinedPrompt.refinedText);

      console.log(`Refined prompt saved to: ${outputPath}`);
    }

    console.log(`All refined prompts have been saved to: ${outputDir}`);
  }

  /**
   * Refines a prompt by adding concrete examples
   * @param prompt The prompt to refine
   * @returns The refined prompt with examples
   */
  public async refineWithExamples(prompt: string): Promise<string> {
    const instruction = `
      Enhance this component prompt by adding 2-3 concrete examples that demonstrate best practices.
      The examples should be relevant to the component type and should illustrate key features.
      Maintain the original requirements while adding these examples in a new section.
    `;

    return this.refinePromptWithInstruction(prompt, instruction);
  }

  /**
   * Enhances a prompt with accessibility requirements
   * @param prompt The prompt to enhance
   * @returns The enhanced prompt with accessibility requirements
   */
  public async enhanceWithAccessibility(prompt: string): Promise<string> {
    const instruction = `
      Enhance this component prompt by adding specific accessibility requirements.
      Include WCAG compliance details, keyboard navigation support, screen reader compatibility,
      proper semantic HTML requirements, appropriate ARIA attributes, and color contrast guidelines.
      Maintain the original requirements while adding these accessibility enhancements.
    `;

    return this.refinePromptWithInstruction(prompt, instruction);
  }

  /**
   * Enhances a prompt with UX best practices
   * @param prompt The prompt to enhance
   * @returns The enhanced prompt with UX guidelines
   */
  public async enhanceWithUX(prompt: string): Promise<string> {
    const instruction = `
      Enhance this component prompt by adding detailed UX best practices and guidelines.
      Include requirements for hover/focus states, loading indicators, error feedback,
      consistent interaction patterns, and intuitive design.
      Maintain the original requirements while adding these UX enhancements.
    `;

    return this.refinePromptWithInstruction(prompt, instruction);
  }

  /**
   * Enhances a prompt to encourage more creative solutions
   * @param prompt The prompt to enhance
   * @returns The enhanced prompt with creativity encouragement
   */
  public async enhanceCreativity(prompt: string): Promise<string> {
    const instruction = `
      Enhance this component prompt to encourage more creative and innovative solutions.
      Add language that explicitly asks for unique approaches, modern design elements,
      and innovative interaction patterns. Suggest potential creative directions
      without being overly prescriptive. Emphasize visual distinctiveness and originality.
      Maintain the original requirements while adding these creativity enhancements.
    `;

    return this.refinePromptWithInstruction(prompt, instruction);
  }

  /**
   * Enhances a prompt with performance optimization requirements
   * @param prompt The prompt to enhance
   * @returns The enhanced prompt with performance requirements
   */
  public async enhanceWithPerformance(prompt: string): Promise<string> {
    const instruction = `
      Enhance this component prompt by adding performance optimization requirements.
      Include guidelines for efficient rendering, minimal reflows, optimized asset usage,
      lazy loading where appropriate, and browser performance considerations.
      Maintain the original requirements while adding these performance enhancements.
    `;

    return this.refinePromptWithInstruction(prompt, instruction);
  }

  /**
   * Enhances a prompt with technical implementation details
   * @param prompt The prompt to enhance
   * @returns The enhanced prompt with technical details
   */
  public async enhanceWithTechnicalDetails(prompt: string): Promise<string> {
    const instruction = `
      Enhance this component prompt by adding specific technical implementation details.
      Include requirements for code structure, TypeScript interfaces, proper state management,
      error handling, and integration patterns. Specify file organization and naming conventions.
      Maintain the original requirements while adding these technical details.
    `;

    return this.refinePromptWithInstruction(prompt, instruction);
  }

  /**
   * Improves the readability and clarity of a prompt
   * @param prompt The prompt to improve
   * @returns The improved prompt with better readability
   */
  public async improveReadability(prompt: string): Promise<string> {
    const instruction = `
      Improve the readability and clarity of this component prompt.
      Restructure the content to follow a logical flow, use bullet points for key requirements,
      add clear section headings, and ensure consistent terminology.
      Remove any ambiguity or vague language. Keep the original requirements
      but present them in a more organized and clear manner.
    `;

    return this.refinePromptWithInstruction(prompt, instruction);
  }

  /**
   * Enhances a prompt with visual design requirements
   * @param prompt The prompt to enhance
   * @returns The enhanced prompt with visual design requirements
   */
  public async enhanceWithVisualDesign(prompt: string): Promise<string> {
    const instruction = `
      Enhance this component prompt by adding detailed visual design requirements.
      Include specifications for consistent styling, typography recommendations,
      color scheme guidelines, spacing and layout principles, and visual hierarchy.
      Maintain the original requirements while adding these visual design enhancements.
    `;

    return this.refinePromptWithInstruction(prompt, instruction);
  }

  /**
   * Refines a prompt with a specific instruction using the PersRM agent
   * @param prompt The prompt to refine
   * @param instruction The instruction for refinement
   * @returns The refined prompt
   */
  private async refinePromptWithInstruction(
    prompt: string,
    instruction: string,
  ): Promise<string> {
    try {
      // Use the agent to refine the prompt
      const refinementTask = `
        ${instruction.trim()}
        
        ORIGINAL PROMPT:
        ${prompt.trim()}
        
        ENHANCED PROMPT:
      `;

      const refinedPrompt = await this.agent.generateText(refinementTask);

      // If the agent returned empty or very short text, return the original prompt
      if (!refinedPrompt || refinedPrompt.length < prompt.length / 2) {
        console.warn(
          "Agent returned insufficient refinement, using original prompt",
        );
        return prompt;
      }

      return refinedPrompt.trim();
    } catch (error) {
      console.error("Error refining prompt:", error);
      return prompt; // Return original prompt on error
    }
  }

  /**
   * Extracts prompt improvement suggestions from the improvement report
   * @param reportContent Content of the improvement report
   * @returns Array of improvement suggestions
   */
  private extractPromptImprovements(reportContent: string): string[] {
    const improvementSection = this.extractSection(
      reportContent,
      "## Prompt Improvement Suggestions",
      "##",
    );

    if (!improvementSection) {
      return [];
    }

    // Extract the bullet points
    const improvementLines = improvementSection
      .split("\n")
      .filter((line) => line.trim().startsWith("-"))
      .map((line) => line.trim().substring(2).trim());

    return improvementLines;
  }

  /**
   * Extracts a section from the report content
   * @param content Full report content
   * @param sectionStartMarker Marker for the start of the section
   * @param sectionEndMarker Marker for the end of the section
   * @returns The extracted section or null if not found
   */
  private extractSection(
    content: string,
    sectionStartMarker: string,
    sectionEndMarker: string,
  ): string | null {
    const startIndex = content.indexOf(sectionStartMarker);
    if (startIndex === -1) return null;

    const sectionStart = startIndex + sectionStartMarker.length;
    let sectionEnd = content.indexOf(sectionEndMarker, sectionStart);

    // If no end marker is found, use the end of the content
    if (sectionEnd === -1) {
      sectionEnd = content.length;
    }

    return content.substring(sectionStart, sectionEnd).trim();
  }

  /**
   * Generates prompt-specific improvements based on the original text and general improvements
   * @param originalText Original prompt text
   * @param generalImprovements General improvement suggestions
   * @returns Array of prompt-specific improvements
   */
  private generatePromptSpecificImprovements(
    originalText: string,
    generalImprovements: string[],
  ): string[] {
    const suggestions: string[] = [];
    const originalTextLower = originalText.toLowerCase();

    // Check if the prompt already has certain elements
    const hasAccessibility = this.containsAnyKeyword(
      originalTextLower,
      PromptRefiner.ACCESSIBILITY_KEYWORDS,
    );
    const hasUXDetail = this.containsAnyKeyword(
      originalTextLower,
      PromptRefiner.UX_KEYWORDS,
    );
    const hasCodeQuality = this.containsAnyKeyword(
      originalTextLower,
      PromptRefiner.CODE_QUALITY_KEYWORDS,
    );

    // Filter and adapt general improvements based on what's missing
    for (const improvement of generalImprovements) {
      // Skip improvements that are already covered in the original prompt
      if (
        hasAccessibility &&
        this.containsAnyKeyword(
          improvement.toLowerCase(),
          PromptRefiner.ACCESSIBILITY_KEYWORDS,
        )
      ) {
        continue;
      }

      if (
        hasUXDetail &&
        this.containsAnyKeyword(
          improvement.toLowerCase(),
          PromptRefiner.UX_KEYWORDS,
        )
      ) {
        continue;
      }

      if (
        hasCodeQuality &&
        this.containsAnyKeyword(
          improvement.toLowerCase(),
          PromptRefiner.CODE_QUALITY_KEYWORDS,
        )
      ) {
        continue;
      }

      // Add the improvement if it's relevant to this prompt type
      if (this.isImprovementRelevantToPrompt(improvement, originalTextLower)) {
        suggestions.push(improvement);
      }
    }

    // Add prompt-specific improvements
    if (!hasAccessibility) {
      suggestions.push(
        "Add accessibility requirements such as ARIA attributes and keyboard navigation",
      );
    }

    if (!hasUXDetail) {
      suggestions.push(
        "Specify detailed UX requirements including transitions, hover states, and responsive breakpoints",
      );
    }

    if (!hasCodeQuality && originalTextLower.includes("component")) {
      suggestions.push(
        "Request TypeScript interfaces for props and proper error handling",
      );
    }

    return suggestions;
  }

  /**
   * Checks if an improvement is relevant to a specific prompt
   * @param improvement Improvement suggestion
   * @param promptText Original prompt text
   * @returns Whether the improvement is relevant
   */
  private isImprovementRelevantToPrompt(
    improvement: string,
    promptText: string,
  ): boolean {
    // Check if the improvement is specific to a component type
    if (
      improvement.toLowerCase().startsWith("for forms:") &&
      !promptText.includes("form")
    ) {
      return false;
    }

    if (
      improvement.toLowerCase().startsWith("for tables:") &&
      !promptText.includes("table")
    ) {
      return false;
    }

    if (
      improvement.toLowerCase().startsWith("for modals:") &&
      !promptText.includes("modal")
    ) {
      return false;
    }

    return true;
  }

  /**
   * Checks if text contains any of the specified keywords
   * @param text Text to check
   * @param keywords Keywords to look for
   * @returns Whether any keyword was found
   */
  private containsAnyKeyword(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  }

  /**
   * Generates refined text based on the original prompt and suggested improvements
   * @param originalText Original prompt text
   * @param improvements Suggested improvements
   * @returns Refined prompt text
   */
  private generateRefinedText(
    originalText: string,
    improvements: string[],
  ): string {
    if (improvements.length === 0) {
      return originalText; // No changes needed
    }

    // Build the refined text
    let refinedText = originalText.trim();

    // Add a section for improvements if there are any
    const improvementSection = [
      "",
      "// ADDITIONAL REQUIREMENTS (Auto-refined):",
      ...improvements.map((improvement) => `// - ${improvement}`),
      "",
    ].join("\n");

    // Add the improvement section at the end of the prompt
    refinedText += `\n${improvementSection}`;

    return refinedText;
  }
}
