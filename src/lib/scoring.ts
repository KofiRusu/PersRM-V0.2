/**
 * Scoring module for PersLM
 * Contains functions for evaluating components against prompts
 */

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

/**
 * Interface for component scoring results
 */
export interface ScoreResult {
  total: number;
  fidelity: number;
  codeQuality: number;
  accessibility: number;
  uxPolish: number;
  innovation: number;
  errors?: string[];
}

/**
 * Scores a component against the prompt requirements
 * @param code Component code to evaluate
 * @param prompt Original prompt used to generate the component
 * @param type Type of component (baseline, enhanced, or v0)
 * @param verbose Whether to log detailed scoring information
 * @returns Structured score object with individual criteria scores and total
 */
export function scoreComponent(
  code: string,
  prompt: string,
  type: string = "baseline",
  verbose: boolean = false,
): ScoreResult {
  try {
    if (!code || !prompt) {
      logger.error("Missing code or prompt for scoring");
      return getEmptyScoreResult();
    }

    // Normalize whitespace
    code = code.trim();
    prompt = prompt.trim();

    // Scoring criteria weights
    const weights = {
      fidelity: 0.35,
      codeQuality: 0.25,
      accessibility: 0.15,
      uxPolish: 0.15,
      innovation: 0.1,
    };

    // Extract requirements from prompt
    const requiredElements = extractRequirements(prompt);

    if (verbose) {
      logger.info(
        `Scoring ${type} component with ${requiredElements.length} requirements`,
      );
    }

    // Score fidelity (requirements implementation)
    const fidelityScore = scoreFidelity(code, requiredElements, prompt);

    // Score code quality (structure, comments, semantic HTML)
    const codeQualityScore = scoreCodeQuality(code);

    // Score accessibility (ARIA attributes, semantic markup, etc)
    const accessibilityScore = scoreAccessibility(code);

    // Score UX polish (transitions, responsiveness, etc)
    const uxPolishScore = scoreUXPolish(code, type);

    // Score innovation (additional features beyond prompt)
    const innovationScore = scoreInnovation(code, prompt, type);

    // Calculate weighted total
    const total = Math.round(
      fidelityScore * weights.fidelity +
        codeQualityScore * weights.codeQuality +
        accessibilityScore * weights.accessibility +
        uxPolishScore * weights.uxPolish +
        innovationScore * weights.innovation,
    );

    if (verbose) {
      logger.info(
        `Score breakdown - Fidelity: ${fidelityScore}, Code Quality: ${codeQualityScore}, ` +
          `Accessibility: ${accessibilityScore}, UX Polish: ${uxPolishScore}, ` +
          `Innovation: ${innovationScore}, Total: ${total}`,
      );
    }

    return {
      total,
      fidelity: fidelityScore,
      codeQuality: codeQualityScore,
      accessibility: accessibilityScore,
      uxPolish: uxPolishScore,
      innovation: innovationScore,
    };
  } catch (error) {
    logger.error(
      `Error scoring component: ${error instanceof Error ? error.message : String(error)}`,
    );
    return getEmptyScoreResult();
  }
}

/**
 * Scores a component from a file path
 * @param filePath Path to the component file
 * @param prompt Original prompt used to generate the component
 * @param type Type of component (baseline, enhanced, or v0)
 * @param verbose Whether to log detailed scoring information
 * @returns Promise resolving to a score result
 */
export async function scoreComponentFile(
  filePath: string,
  prompt: string,
  type: string = "baseline",
  verbose: boolean = false,
): Promise<ScoreResult> {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Component file not found: ${filePath}`);
    }

    const code = fs.readFileSync(filePath, "utf8");
    return scoreComponent(code, prompt, type, verbose);
  } catch (error) {
    logger.error(
      `Error scoring component file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return {
      ...getEmptyScoreResult(),
      errors: [
        `Failed to score ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Returns an empty score result for error cases
 */
export function getEmptyScoreResult(): ScoreResult {
  return {
    total: 0,
    fidelity: 0,
    codeQuality: 0,
    accessibility: 0,
    uxPolish: 0,
    innovation: 0,
    errors: ["Failed to score component"],
  };
}

/**
 * Returns a minimum baseline score for fallback scenarios
 */
export function getMinimumScoreResult(): ScoreResult {
  return {
    total: 20,
    fidelity: 10,
    codeQuality: 5,
    accessibility: 2,
    uxPolish: 2,
    innovation: 1,
    errors: ["Using minimum fallback score"],
  };
}

/**
 * Extracts requirements from the prompt
 * @param prompt The component generation prompt
 * @returns Array of required elements
 */
function extractRequirements(prompt: string): string[] {
  // Extract requirements based on common markers in prompts
  const requirements: string[] = [];

  // Look for bullets and numbered lists
  const bulletMatches = prompt.match(/[-•*]\s+(.*?)(?=\n|$)/g) || [];
  bulletMatches.forEach((match) => {
    const requirement = match.replace(/^[-•*]\s+/, "").trim();
    if (requirement) requirements.push(requirement);
  });

  // Look for numbered lists
  const numberedMatches = prompt.match(/\d+\.\s+(.*?)(?=\n|$)/g) || [];
  numberedMatches.forEach((match) => {
    const requirement = match.replace(/^\d+\.\s+/, "").trim();
    if (requirement) requirements.push(requirement);
  });

  // Look for "must have" or "should include" phrases
  const mustHaveMatches =
    prompt.match(
      /(?:must\s+have|should\s+include|requires)\s+(.*?)(?=\.|$)/gi,
    ) || [];
  mustHaveMatches.forEach((match) => {
    const requirement = match
      .replace(/(?:must\s+have|should\s+include|requires)\s+/i, "")
      .trim();
    if (requirement) requirements.push(requirement);
  });

  return requirements;
}

/**
 * Scores the fidelity of implementation against requirements
 * @param code Component code
 * @param requirements Required elements extracted from prompt
 * @param prompt Original prompt for context
 * @returns Score from 0-100
 */
function scoreFidelity(
  code: string,
  requirements: string[],
  prompt: string,
): number {
  let implementedCount = 0;

  requirements.forEach((req) => {
    // Convert both to lowercase for case-insensitive matching
    const reqLower = req.toLowerCase();
    const codeLower = code.toLowerCase();

    // Check if requirement keywords are present in the code
    const keywords = reqLower
      .split(/\s+/)
      .filter((word) => word.length > 3) // Only consider significant words
      .map((word) => word.replace(/[^\w]/g, "")); // Remove punctuation

    const keywordMatches = keywords.filter((keyword) =>
      codeLower.includes(keyword),
    );
    const matchRatio = keywordMatches.length / keywords.length;

    // If most keywords are found, consider the requirement implemented
    if (matchRatio >= 0.6) {
      implementedCount++;
    }
  });

  // Score based on percentage of requirements implemented
  const percentage =
    requirements.length > 0
      ? (implementedCount / requirements.length) * 100
      : 50; // Default to middle score if no requirements found

  return Math.min(Math.round(percentage), 100);
}

/**
 * Scores code quality based on structure and best practices
 * @param code Component code
 * @returns Score from 0-100
 */
function scoreCodeQuality(code: string): number {
  let score = 50; // Start with a baseline score

  // Check for proper indentation
  if (/^\s{2,4}\S/m.test(code)) {
    score += 5;
  }

  // Check for comments
  if (/\/\/|\/\*|\*\/|<!--/.test(code)) {
    score += 5;
  }

  // Check for semantic HTML elements
  const semanticElements = [
    "header",
    "footer",
    "main",
    "nav",
    "section",
    "article",
    "aside",
    "figure",
    "figcaption",
    "time",
    "mark",
  ];
  const semanticCount = semanticElements.filter((el) =>
    new RegExp(`<${el}[\\s>]|<${el}$`, "i").test(code),
  ).length;

  score += Math.min(semanticCount * 2, 10);

  // Check for proper closing tags and structure
  const openTags = code.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?>/gi) || [];
  const closeTags = code.match(/<\/[a-z][a-z0-9]*>/gi) || [];
  const selfClosingTags =
    code.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?\s*\/>/gi) || [];

  if (openTags.length - selfClosingTags.length === closeTags.length) {
    score += 10;
  }

  // Check for ES6+ features (for JS/TS components)
  if (/const|let|=>\s*{|}\)|async|await|class\s+\w+/.test(code)) {
    score += 10;
  }

  // Check for TypeScript typing
  if (/:\s*\w+(\[\])?|interface\s+\w+|type\s+\w+/.test(code)) {
    score += 10;
  }

  // Check for proper event handling
  if (/onClick|onChange|onSubmit|addEventListener/.test(code)) {
    score += 5;
  }

  // Penalize very short or long files
  if (code.length < 100) {
    score -= 10;
  } else if (code.length > 10000) {
    score -= 5;
  }

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Scores accessibility features
 * @param code Component code
 * @returns Score from 0-100
 */
function scoreAccessibility(code: string): number {
  let score = 40; // Start with a baseline score

  // Check for alt attributes on images
  const imgTags = code.match(/<img[^>]*>/gi) || [];
  const imgWithAlt = code.match(/<img[^>]*alt=["'][^"']*["'][^>]*>/gi) || [];

  if (imgTags.length > 0 && imgTags.length === imgWithAlt.length) {
    score += 10;
  }

  // Check for ARIA attributes
  if (/aria-[\w-]+=['"][^'"]*["']/.test(code)) {
    score += 10;
  }

  // Check for role attributes
  if (/role=['"][^'"]*["']/.test(code)) {
    score += 5;
  }

  // Check for form labels
  const formInputs = code.match(/<input[^>]*>/gi) || [];
  const labelsOrAriaLabel =
    code.match(
      /<label[^>]*>|aria-label=['"][^'"]*["']|aria-labelledby=['"][^'"]*["']/gi,
    ) || [];

  if (formInputs.length > 0 && labelsOrAriaLabel.length >= formInputs.length) {
    score += 10;
  }

  // Check for tabindex attributes
  if (/tabindex=['"]-?\d+["']/.test(code)) {
    score += 5;
  }

  // Check for language attribute
  if (/<html[^>]*lang=["'][a-z]{2}(-[a-z]{2})?["'][^>]*>/i.test(code)) {
    score += 5;
  }

  // Check for semantic heading structure
  const headings = code.match(/<h[1-6][^>]*>/gi) || [];
  if (headings.length > 0 && code.includes("<h1")) {
    score += 5;
  }

  // Check for semantic button vs div with click handler
  const buttonElements = code.match(/<button[^>]*>/gi) || [];
  const divWithClick = code.match(/<div[^>]*onClick/gi) || [];

  if (buttonElements.length > 0 && divWithClick.length === 0) {
    score += 10;
  }

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Scores UX polish features
 * @param code Component code
 * @param type Component type for context
 * @returns Score from 0-100
 */
function scoreUXPolish(code: string, type: string): number {
  // Baseline components get a default score
  if (type === "baseline") {
    return 60;
  }

  let score = 40; // Start with a baseline score

  // Check for transitions/animations
  if (/transition:|animation:|@keyframes|transform:|animate-/.test(code)) {
    score += 15;
  }

  // Check for hover states
  if (/:hover|onMouseEnter|onMouseLeave/.test(code)) {
    score += 10;
  }

  // Check for focus states
  if (/:focus|onFocus|onBlur/.test(code)) {
    score += 10;
  }

  // Check for responsive design
  if (/media\s+(?:query|screen)|@media|sm:|md:|lg:|xl:/.test(code)) {
    score += 15;
  }

  // Check for loading states
  if (/isLoading|loading[="']|spinner|progress/.test(code)) {
    score += 5;
  }

  // Check for error handling
  if (/error[="']|validation|invalid|onError/.test(code)) {
    score += 5;
  }

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Scores innovation beyond the base requirements
 * @param code Component code
 * @param prompt Original prompt for context
 * @param type Component type
 * @returns Score from 0-100
 */
function scoreInnovation(code: string, prompt: string, type: string): number {
  // Baseline components get a minimal innovation score
  if (type === "baseline") {
    return 30;
  }

  let score = 30; // Start with a baseline score
  const promptLower = prompt.toLowerCase();

  // Check for themes/dark mode
  if (
    !promptLower.includes("dark mode") &&
    !promptLower.includes("theme") &&
    (code.includes("darkMode") ||
      code.includes("theme-") ||
      code.includes("isDark"))
  ) {
    score += 10;
  }

  // Check for keyboard shortcuts
  if (
    !promptLower.includes("keyboard") &&
    !promptLower.includes("shortcut") &&
    (code.includes("keydown") ||
      code.includes("keyCode") ||
      code.includes("key="))
  ) {
    score += 10;
  }

  // Check for performance optimizations
  if (
    code.includes("useMemo") ||
    code.includes("useCallback") ||
    code.includes("React.memo") ||
    code.includes("shouldComponentUpdate")
  ) {
    score += 10;
  }

  // Check for internationalization
  if (
    !promptLower.includes("i18n") &&
    !promptLower.includes("internationalization") &&
    (code.includes("i18n") ||
      code.includes("translate") ||
      code.includes("locale"))
  ) {
    score += 10;
  }

  // Check for advanced features
  if (
    code.includes("useEffect") ||
    code.includes("useState") ||
    code.includes("useReducer") ||
    code.includes("useContext")
  ) {
    score += 10;
  }

  // Check for custom hooks
  if (code.includes("function use") && code.match(/function\s+use[A-Z]\w+/)) {
    score += 10;
  }

  // Higher scores for enhanced components
  if (type === "enhanced") {
    score += 10;
  }

  return Math.min(Math.max(score, 0), 100);
}
