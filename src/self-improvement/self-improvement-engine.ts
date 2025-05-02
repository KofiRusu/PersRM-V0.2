import * as fs from "fs";
import * as path from "path";

/**
 * Represents a summary of analysis of scoring reports
 */
export interface AnalysisSummary {
  weaknesses: { category: string; count: number }[];
  mostCommonWeakness: string;
  averageScores: { category: string; score: number }[];
  totalReports: number;
  componentTypes: string[];
  enhancementImprovements: { component: string; improvement: number }[];
  improvementsByCategory: { category: string; averageImprovement: number }[];
}

/**
 * Represents a scoring report with criteria scores and analysis
 */
interface ScoringReport {
  promptId: string;
  componentName: string;
  baseline?: {
    fidelity: number;
    codeQuality: number;
    accessibility: number;
    uxPolish: number;
    innovation: number;
    totalScore: number;
  };
  enhanced?: {
    fidelity: number;
    codeQuality: number;
    accessibility: number;
    uxPolish: number;
    innovation: number;
    totalScore: number;
  };
  improvements?: {
    fidelity: number;
    codeQuality: number;
    accessibility: number;
    uxPolish: number;
    innovation: number;
    totalScore: number;
  };
}

/**
 * Self-Improvement Engine for analyzing and improving the component generation process
 */
export class SelfImprovementEngine {
  private static readonly SCORE_THRESHOLD = 3; // Scores below this are considered weaknesses

  /**
   * Analyzes all scoring reports in the specified directory
   * @param reportDir Directory containing the scoring reports
   * @returns Summary of the analysis
   */
  public async analyzeScoringReports(
    reportDir: string,
  ): Promise<AnalysisSummary> {
    // Check if directory exists
    if (!fs.existsSync(reportDir)) {
      throw new Error(`Report directory not found: ${reportDir}`);
    }

    // Get all markdown files in the directory
    const files = fs
      .readdirSync(reportDir)
      .filter((file) => file.endsWith(".md") && file.startsWith("score-"));

    if (files.length === 0) {
      throw new Error("No scoring reports found in the directory");
    }

    console.log(`Analyzing ${files.length} scoring reports...`);

    // Parse each report
    const reports: ScoringReport[] = [];
    const componentTypes: Set<string> = new Set();

    for (const file of files) {
      const filePath = path.join(reportDir, file);
      const content = fs.readFileSync(filePath, "utf-8");

      try {
        const report = this.parseReport(content);
        reports.push(report);

        // Extract component type from name
        const componentType = this.extractComponentType(report.componentName);
        if (componentType) {
          componentTypes.add(componentType);
        }
      } catch (error) {
        console.warn(`Error parsing report ${file}: ${error}`);
      }
    }

    // Calculate averages for each criteria
    const criteria = [
      "fidelity",
      "codeQuality",
      "accessibility",
      "uxPolish",
      "innovation",
    ];
    const baselineScores: Record<string, number[]> = {};
    const enhancedScores: Record<string, number[]> = {};
    const improvements: Record<string, number[]> = {};

    // Initialize arrays
    criteria.forEach((criterion) => {
      baselineScores[criterion] = [];
      enhancedScores[criterion] = [];
      improvements[criterion] = [];
    });

    // Aggregate scores
    reports.forEach((report) => {
      if (report.baseline) {
        criteria.forEach((criterion) => {
          baselineScores[criterion].push(report.baseline[criterion]);
        });
      }

      if (report.enhanced) {
        criteria.forEach((criterion) => {
          enhancedScores[criterion].push(report.enhanced[criterion]);
        });
      }

      if (report.baseline && report.enhanced) {
        criteria.forEach((criterion) => {
          const improvement =
            report.enhanced[criterion] - report.baseline[criterion];
          improvements[criterion].push(improvement);
        });
      }
    });

    // Calculate average scores
    const averageScores: { category: string; score: number }[] = [];
    criteria.forEach((criterion) => {
      if (enhancedScores[criterion].length > 0) {
        // Prefer enhanced scores if available
        const sum = enhancedScores[criterion].reduce((a, b) => a + b, 0);
        averageScores.push({
          category: criterion,
          score: sum / enhancedScores[criterion].length,
        });
      } else if (baselineScores[criterion].length > 0) {
        // Fall back to baseline scores
        const sum = baselineScores[criterion].reduce((a, b) => a + b, 0);
        averageScores.push({
          category: criterion,
          score: sum / baselineScores[criterion].length,
        });
      }
    });

    // Identify weaknesses
    const weaknesses: { category: string; count: number }[] = [];
    averageScores.forEach(({ category, score }) => {
      if (score < SelfImprovementEngine.SCORE_THRESHOLD) {
        weaknesses.push({ category, count: 0 });
      }
    });

    // Count occurrences of weaknesses in reports
    reports.forEach((report) => {
      const scoreObj = report.enhanced || report.baseline;
      if (scoreObj) {
        criteria.forEach((criterion) => {
          if (scoreObj[criterion] < SelfImprovementEngine.SCORE_THRESHOLD) {
            const weakness = weaknesses.find((w) => w.category === criterion);
            if (weakness) {
              weakness.count++;
            } else {
              weaknesses.push({ category: criterion, count: 1 });
            }
          }
        });
      }
    });

    // Sort weaknesses by count (descending)
    weaknesses.sort((a, b) => b.count - a.count);

    // Get most common weakness
    const mostCommonWeakness =
      weaknesses.length > 0 ? weaknesses[0].category : "none";

    // Calculate improvement by category
    const improvementsByCategory = criteria.map((category) => {
      const values = improvements[category];
      const averageImprovement =
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;

      return { category, averageImprovement };
    });

    // Calculate enhancement improvements by component
    const enhancementImprovements = reports
      .filter((report) => report.baseline && report.enhanced)
      .map((report) => ({
        component: report.componentName,
        improvement: report.enhanced.totalScore - report.baseline.totalScore,
      }));

    return {
      weaknesses,
      mostCommonWeakness,
      averageScores,
      totalReports: reports.length,
      componentTypes: Array.from(componentTypes),
      enhancementImprovements,
      improvementsByCategory,
    };
  }

  /**
   * Suggests improvements to the component generation prompts
   * @param summary Analysis summary
   * @returns Array of suggested improvements
   */
  public suggestPromptImprovements(summary: AnalysisSummary): string[] {
    const suggestions: string[] = [];

    // Handle accessibility weaknesses
    if (summary.weaknesses.some((w) => w.category === "accessibility")) {
      suggestions.push(
        "Explicitly require ARIA attributes for interactive elements",
      );
      suggestions.push(
        "Request keyboard navigation support for all interactive components",
      );
      suggestions.push(
        "Specify that components must be screen reader compatible",
      );
      suggestions.push(
        "Include color contrast requirements for text and interactive elements",
      );
      suggestions.push("Require proper semantic HTML elements for structure");
    }

    // Handle UX polish weaknesses
    if (summary.weaknesses.some((w) => w.category === "uxPolish")) {
      suggestions.push("Request smooth transitions for state changes");
      suggestions.push(
        "Specify hover and focus states for interactive elements",
      );
      suggestions.push(
        "Require mobile-friendly touch targets and interactions",
      );
      suggestions.push(
        "Include loading states and transitions for asynchronous actions",
      );
      suggestions.push(
        "Specify responsive design requirements with concrete breakpoints",
      );
    }

    // Handle code quality weaknesses
    if (summary.weaknesses.some((w) => w.category === "codeQuality")) {
      suggestions.push(
        "Require well-structured component organization with logical prop grouping",
      );
      suggestions.push(
        "Specify consistent naming conventions for props and internal variables",
      );
      suggestions.push(
        "Request comprehensive TypeScript type definitions for all props and states",
      );
      suggestions.push("Include error handling requirements for edge cases");
      suggestions.push("Request performance optimization best practices");
    }

    // Handle fidelity weaknesses
    if (summary.weaknesses.some((w) => w.category === "fidelity")) {
      suggestions.push(
        "Provide more specific implementation details for key features",
      );
      suggestions.push(
        "Include visual examples or references to guide the implementation",
      );
      suggestions.push("Specify exact prop structures and default values");
      suggestions.push(
        "Detail expected component behavior for different states",
      );
      suggestions.push(
        "Request comprehensive test coverage for functionality verification",
      );
    }

    // Handle innovation weaknesses
    if (summary.weaknesses.some((w) => w.category === "innovation")) {
      suggestions.push(
        "Encourage creative additions that enhance usability beyond requirements",
      );
      suggestions.push(
        "Request novel interaction patterns that improve user experience",
      );
      suggestions.push(
        "Suggest exploration of modern design trends in the implementation",
      );
      suggestions.push(
        "Ask for intelligent defaults that anticipate user needs",
      );
      suggestions.push(
        "Encourage context-aware behavior that adapts to usage patterns",
      );
    }

    return suggestions;
  }

  /**
   * Suggests strategies for enhancing components
   * @param summary Analysis summary
   * @returns Array of suggested strategies
   */
  public suggestEnhancementStrategies(summary: AnalysisSummary): string[] {
    const strategies: string[] = [];

    // Handle accessibility weaknesses
    if (summary.weaknesses.some((w) => w.category === "accessibility")) {
      strategies.push(
        "Integrate automated accessibility checks in the enhancement process",
      );
      strategies.push("Add a comprehensive ARIA attribute application step");
      strategies.push(
        "Implement keyboard navigation and focus management improvements",
      );
      strategies.push(
        "Apply contrast verification and enhancement for text elements",
      );
      strategies.push(
        "Convert non-semantic markup to appropriate semantic elements",
      );
    }

    // Handle UX polish weaknesses
    if (summary.weaknesses.some((w) => w.category === "uxPolish")) {
      strategies.push("Apply consistent transition and animation patterns");
      strategies.push("Enhance hover and focus states with visual feedback");
      strategies.push(
        "Implement responsive design patterns for all viewport sizes",
      );
      strategies.push("Add loading state and skeleton screen implementations");
      strategies.push("Refine touch interactions for mobile experiences");
    }

    // Handle code quality weaknesses
    if (summary.weaknesses.some((w) => w.category === "codeQuality")) {
      strategies.push(
        "Restructure component organization for better maintainability",
      );
      strategies.push("Enhance type definitions with more specific interfaces");
      strategies.push(
        "Apply performance optimizations like memoization and callback stabilization",
      );
      strategies.push("Implement comprehensive error handling and fallbacks");
      strategies.push(
        "Refactor naming conventions for consistency and clarity",
      );
    }

    // Handle fidelity weaknesses
    if (summary.weaknesses.some((w) => w.category === "fidelity")) {
      strategies.push("Analyze and implement missing requirements from prompt");
      strategies.push("Verify behavior across all specified component states");
      strategies.push("Ensure all prop combinations work as expected");
      strategies.push("Add default values aligned with requirements");
      strategies.push("Implement edge case handling as specified");
    }

    // Handle innovation weaknesses
    if (summary.weaknesses.some((w) => w.category === "innovation")) {
      strategies.push(
        "Add intelligent defaults based on common usage patterns",
      );
      strategies.push("Implement progressive enhancement for modern browsers");
      strategies.push(
        "Create novel interaction patterns that enhance usability",
      );
      strategies.push("Add contextual behavior adaptations");
      strategies.push(
        "Integrate subtle delight factors for better user experience",
      );
    }

    return strategies;
  }

  /**
   * Applies self-improvements based on analysis (stub)
   * Future implementation will automate the application of suggestions
   */
  public async applySelfImprovements(): Promise<void> {
    console.log("This is a stub method for future implementation");
    console.log(
      "In the future, this will automatically apply improvement suggestions",
    );
  }

  /**
   * Parses a scoring report from markdown content
   * @param content Report content
   * @returns Structured report object
   */
  private parseReport(content: string): ScoringReport {
    // Extract component name and ID
    const titleMatch = content.match(/# Score Report: (.*)/);
    if (!titleMatch) {
      throw new Error("Could not extract component name from report");
    }

    const componentName = titleMatch[1].trim();

    // Extract prompt ID
    const promptIdMatch = content.match(/Prompt ID: ([a-zA-Z0-9-]+)/);
    const promptId = promptIdMatch ? promptIdMatch[1] : "unknown";

    // Create the basic report
    const report: ScoringReport = {
      promptId,
      componentName,
    };

    // Check if baseline section exists
    if (content.includes("## Baseline Component")) {
      report.baseline = {
        fidelity: this.extractScore(content, "Fidelity", "baseline"),
        codeQuality: this.extractScore(content, "Code Quality", "baseline"),
        accessibility: this.extractScore(content, "Accessibility", "baseline"),
        uxPolish: this.extractScore(content, "UX Polish", "baseline"),
        innovation: this.extractScore(content, "Innovation", "baseline"),
        totalScore: this.extractScore(content, "Total Score", "baseline"),
      };
    }

    // Check if enhanced section exists
    if (content.includes("## Enhanced Component")) {
      report.enhanced = {
        fidelity: this.extractScore(content, "Fidelity", "enhanced"),
        codeQuality: this.extractScore(content, "Code Quality", "enhanced"),
        accessibility: this.extractScore(content, "Accessibility", "enhanced"),
        uxPolish: this.extractScore(content, "UX Polish", "enhanced"),
        innovation: this.extractScore(content, "Innovation", "enhanced"),
        totalScore: this.extractScore(content, "Total Score", "enhanced"),
      };
    }

    // Calculate improvements if both sections exist
    if (report.baseline && report.enhanced) {
      report.improvements = {
        fidelity: report.enhanced.fidelity - report.baseline.fidelity,
        codeQuality: report.enhanced.codeQuality - report.baseline.codeQuality,
        accessibility:
          report.enhanced.accessibility - report.baseline.accessibility,
        uxPolish: report.enhanced.uxPolish - report.baseline.uxPolish,
        innovation: report.enhanced.innovation - report.baseline.innovation,
        totalScore: report.enhanced.totalScore - report.baseline.totalScore,
      };
    }

    return report;
  }

  /**
   * Extracts a score from the markdown content
   * @param content Report content
   * @param criterion The criterion to extract (e.g., "Fidelity")
   * @param section The section to extract from ("baseline" or "enhanced")
   * @returns The extracted score
   */
  private extractScore(
    content: string,
    criterion: string,
    section: "baseline" | "enhanced",
  ): number {
    const sectionMarker =
      section === "baseline"
        ? "## Baseline Component"
        : "## Enhanced Component";
    const nextSectionMarker =
      section === "baseline"
        ? "## Enhanced Component"
        : "## Improvement Summary";

    // Extract the section content
    const sectionStartIndex = content.indexOf(sectionMarker);
    if (sectionStartIndex === -1) return 0;

    const sectionEndIndex = content.indexOf(
      nextSectionMarker,
      sectionStartIndex,
    );
    const sectionContent =
      sectionEndIndex !== -1
        ? content.substring(sectionStartIndex, sectionEndIndex)
        : content.substring(sectionStartIndex);

    // Extract the score for the criterion
    const criterionRegex = new RegExp(
      `${criterion}:\\s*(\\d+(?:\\.\\d+)?)`,
      "i",
    );
    const match = sectionContent.match(criterionRegex);

    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Extracts the component type from a component name
   * @param componentName Full component name
   * @returns Component type
   */
  private extractComponentType(componentName: string): string | undefined {
    // Look for common component types
    const commonTypes = [
      "button",
      "card",
      "form",
      "modal",
      "dropdown",
      "table",
      "list",
      "menu",
      "nav",
      "header",
      "footer",
      "sidebar",
      "accordion",
      "tabs",
      "pagination",
      "slider",
      "toggle",
    ];

    const lowerName = componentName.toLowerCase();

    for (const type of commonTypes) {
      if (lowerName.includes(type)) {
        return type;
      }
    }

    // Try to extract type from camel/pascal case names
    const typeMatch = componentName.match(/([A-Z][a-z]+)/);
    if (typeMatch) {
      return typeMatch[1].toLowerCase();
    }

    return undefined;
  }
}
