import fs from "fs";
import path from "path";
import { AdaptationStrategy } from "./self-train";

/**
 * Interface representing the outcome of applying an adaptation strategy
 */
export interface StrategyOutcome {
  // This is the strategy that was applied
  // Can be a single strategy or an array of strategy names
  strategyApplied: string | string[];

  // Context information
  context?: {
    projectContext?: string;
    requirementTypes?: string[];
    componentType?: string;
  };

  // Score information
  scoreBeforeAdaptation: number;
  scoreAfterAdaptation: number;
  improvementPercent: number;

  // Metadata
  timestamp: string;

  // Previously using successfulRequirements - deprecated in favor of context
  successfulRequirements?: string[];

  // Reference to original strategy object - not serialized
  strategy?: AdaptationStrategy;
}

/**
 * Interface for memory statistics
 */
export interface MemoryStats {
  totalStrategies: number;
  successRate: number;
  averageImprovement: number;
  mostSuccessfulStrategy: {
    name: string;
    averageImprovement: number;
    successRate: number;
  } | null;
}

/**
 * Class for managing memory of self-improvement strategies and outcomes
 */
export class SelfImprovementMemory {
  private memory: StrategyOutcome[] = [];
  private memoryPath: string;

  /**
   * Constructor for the SelfImprovementMemory class
   * @param memoryPath Path to save memory to disk (optional)
   */
  constructor(memoryPath?: string) {
    this.memoryPath =
      memoryPath || path.join(process.cwd(), "improvement-memory.json");
    this.initialize();
  }

  /**
   * Initializes the memory system by loading existing memory from disk
   */
  private initialize(): void {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.memoryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Load existing memory if it exists
      if (fs.existsSync(this.memoryPath)) {
        const data = fs.readFileSync(this.memoryPath, "utf8");
        this.memory = JSON.parse(data);
      }
    } catch (error) {
      console.error("Error initializing memory:", error);
      // Continue with empty memory if error occurs
      this.memory = [];
    }
  }

  /**
   * Records the outcome of a strategy to memory
   * @param outcome The strategy outcome to record
   */
  async recordStrategyOutcome(outcome: StrategyOutcome): Promise<void> {
    this.memory.push(outcome);
    await this.saveToDisk();
  }

  /**
   * Retrieves successful strategies based on context
   * @param threshold Success threshold percentage
   * @param context Optional context filter
   * @returns Array of successful strategies
   */
  async getSuccessfulStrategies(
    threshold: number = 0,
    context?: { projectContext?: string; requirementTypes?: string[] },
  ): Promise<AdaptationStrategy[]> {
    // Create a map to track cumulative improvements per strategy
    const strategyImprovements = new Map<
      string,
      {
        strategy: AdaptationStrategy;
        totalImprovement: number;
        count: number;
        averageImprovement: number;
      }
    >();

    // Filter outcomes based on context if provided
    let relevantOutcomes = this.memory;

    if (context?.projectContext) {
      relevantOutcomes = relevantOutcomes.filter(
        (outcome) => outcome.context?.projectContext === context.projectContext,
      );
    }

    if (context?.requirementTypes && context.requirementTypes.length > 0) {
      relevantOutcomes = relevantOutcomes.filter((outcome) =>
        outcome.context?.requirementTypes?.some((req) =>
          context.requirementTypes!.includes(req),
        ),
      );
    }

    // Calculate improvements for each strategy
    for (const outcome of relevantOutcomes) {
      const strategyName = outcome.strategyApplied.toString();

      if (!strategyImprovements.has(strategyName)) {
        strategyImprovements.set(strategyName, {
          strategy: outcome.strategy!,
          totalImprovement: 0,
          count: 0,
          averageImprovement: 0,
        });
      }

      const data = strategyImprovements.get(strategyName)!;
      data.totalImprovement += outcome.improvementPercent;
      data.count += 1;
      data.averageImprovement = data.totalImprovement / data.count;
    }

    // Filter strategies by threshold and sort by average improvement
    const successfulStrategies = Array.from(strategyImprovements.values())
      .filter((data) => data.averageImprovement >= threshold)
      .sort((a, b) => b.averageImprovement - a.averageImprovement)
      .map((data) => data.strategy);

    return successfulStrategies;
  }

  /**
   * Gets strategy recommendations based on current score and context
   * @param currentScore Current score of the component
   * @param context Optional context information
   * @returns Array of recommended strategies sorted by relevance
   */
  async getStrategyRecommendations(
    currentScore: number,
    context?: { projectContext?: string; requirementTypes?: string[] },
  ): Promise<AdaptationStrategy[]> {
    // Create a map for strategy scores
    const strategyScores = new Map<
      string,
      {
        strategy: AdaptationStrategy;
        compositeScore: number;
        successCount: number;
        averageImprovement: number;
        scoreRelevance: number;
      }
    >();

    // Filter outcomes based on context if provided
    let relevantOutcomes = this.memory;

    if (context?.projectContext) {
      relevantOutcomes = relevantOutcomes.filter(
        (outcome) => outcome.context?.projectContext === context.projectContext,
      );
    }

    if (relevantOutcomes.length === 0) {
      // Return empty array if no relevant outcomes
      return [];
    }

    // Calculate scores for each strategy
    for (const outcome of relevantOutcomes) {
      const strategyName = outcome.strategyApplied.toString();

      if (!strategyScores.has(strategyName)) {
        strategyScores.set(strategyName, {
          strategy: outcome.strategy!,
          compositeScore: 0,
          successCount: 0,
          averageImprovement: 0,
          scoreRelevance: 0,
        });
      }

      const data = strategyScores.get(strategyName)!;

      // Successful outcomes contribute more to the score
      const wasSuccessful = outcome.improvementPercent > 0;
      if (wasSuccessful) {
        data.successCount += 1;
      }

      // Calculate relevance based on how close the starting score was
      const scoreDistance = Math.abs(
        outcome.scoreBeforeAdaptation - currentScore,
      );
      const maxScoreDistance = 10; // Assume scores range over 10 points
      const scoreRelevance = 1 - Math.min(scoreDistance / maxScoreDistance, 1);

      // Update data
      data.averageImprovement =
        (data.averageImprovement * data.successCount +
          outcome.improvementPercent) /
        (data.successCount + 1);

      data.scoreRelevance = Math.max(data.scoreRelevance, scoreRelevance);

      // Calculate composite score combining success rate, improvement, and relevance
      const successRate =
        data.successCount / (data.successCount + (wasSuccessful ? 0 : 1));
      data.compositeScore =
        successRate * 0.4 +
        Math.max(0, data.averageImprovement) * 0.4 +
        scoreRelevance * 0.2;
    }

    // Sort strategies by composite score
    const recommendedStrategies = Array.from(strategyScores.values())
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .map((data) => data.strategy);

    return recommendedStrategies;
  }

  /**
   * Visualizes the memory data as a markdown report
   * @returns Markdown string with memory visualization
   */
  async visualizeMemory(): Promise<string> {
    const stats = this.calculateStats();

    // Generate a markdown report
    let report = `# Self-Improvement Memory Report\n\n`;

    report += `## Overall Statistics\n\n`;
    report += `- **Total Strategies Applied:** ${stats.totalStrategies}\n`;
    report += `- **Overall Success Rate:** ${(stats.successRate * 100).toFixed(1)}%\n`;
    report += `- **Average Improvement:** ${stats.averageImprovement.toFixed(2)} points\n`;

    if (stats.mostSuccessfulStrategy) {
      report += `- **Most Successful Strategy:** ${stats.mostSuccessfulStrategy.name} `;
      report += `(${stats.mostSuccessfulStrategy.averageImprovement.toFixed(2)} avg. improvement, `;
      report += `${(stats.mostSuccessfulStrategy.successRate * 100).toFixed(1)}% success rate)\n`;
    }

    report += `\n## Strategy Performance\n\n`;
    report += `| Strategy | Success Rate | Avg. Improvement | Usage Count |\n`;
    report += `|----------|--------------|------------------|------------|\n`;

    // Get performance data for each strategy
    const strategyPerformance = new Map<
      string,
      {
        successCount: number;
        totalCount: number;
        totalImprovement: number;
      }
    >();

    for (const outcome of this.memory) {
      const strategyName = outcome.strategyApplied.toString();

      if (!strategyPerformance.has(strategyName)) {
        strategyPerformance.set(strategyName, {
          successCount: 0,
          totalCount: 0,
          totalImprovement: 0,
        });
      }

      const data = strategyPerformance.get(strategyName)!;
      data.totalCount += 1;
      data.totalImprovement += outcome.improvementPercent;

      if (outcome.improvementPercent > 0) {
        data.successCount += 1;
      }
    }

    // Add rows for each strategy
    for (const [name, data] of strategyPerformance.entries()) {
      const successRate = data.successCount / data.totalCount;
      const avgImprovement = data.totalImprovement / data.totalCount;

      report += `| ${name} | ${(successRate * 100).toFixed(1)}% | `;
      report += `${avgImprovement.toFixed(2)} | ${data.totalCount} |\n`;
    }

    report += `\n## Recent Applications\n\n`;
    report += `| Date | Strategy | Context | Before | After | Improvement |\n`;
    report += `|------|----------|---------|--------|-------|-------------|\n`;

    // Add the 10 most recent applications
    const recentOutcomes = [...this.memory]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 10);

    for (const outcome of recentOutcomes) {
      const date = new Date(outcome.timestamp).toLocaleDateString();
      const context = outcome.context?.projectContext || "N/A";

      report += `| ${date} | ${outcome.strategyApplied.toString()} | ${context} | `;
      report += `${outcome.scoreBeforeAdaptation.toFixed(1)} | `;
      report += `${outcome.scoreAfterAdaptation.toFixed(1)} | `;
      report += `${outcome.improvementPercent >= 0 ? "+" : ""}${outcome.improvementPercent.toFixed(2)} |\n`;
    }

    return report;
  }

  /**
   * Gets the raw memory data
   * @returns Array of strategy outcomes
   */
  getMemoryData(): StrategyOutcome[] {
    return [...this.memory];
  }

  /**
   * Calculates memory statistics
   * @returns Object with statistics
   */
  private calculateStats(): MemoryStats {
    if (this.memory.length === 0) {
      return {
        totalStrategies: 0,
        successRate: 0,
        averageImprovement: 0,
        mostSuccessfulStrategy: null,
      };
    }

    const totalStrategies = this.memory.length;
    const successfulStrategies = this.memory.filter(
      (outcome) => outcome.improvementPercent > 0,
    ).length;
    const successRate = successfulStrategies / totalStrategies;

    // Calculate average improvement
    const totalImprovement = this.memory.reduce(
      (sum, outcome) => sum + outcome.improvementPercent,
      0,
    );
    const averageImprovement = totalImprovement / totalStrategies;

    // Find most successful strategy
    const strategyPerformance = new Map<
      string,
      {
        name: string;
        successCount: number;
        totalCount: number;
        totalImprovement: number;
      }
    >();

    for (const outcome of this.memory) {
      const strategyName = outcome.strategyApplied.toString();

      if (!strategyPerformance.has(strategyName)) {
        strategyPerformance.set(strategyName, {
          name: strategyName,
          successCount: 0,
          totalCount: 0,
          totalImprovement: 0,
        });
      }

      const data = strategyPerformance.get(strategyName)!;
      data.totalCount += 1;
      data.totalImprovement += outcome.improvementPercent;

      if (outcome.improvementPercent > 0) {
        data.successCount += 1;
      }
    }

    // Find strategy with highest success rate and average improvement
    let bestStrategy = null;
    let bestScore = -Infinity;

    for (const data of strategyPerformance.values()) {
      if (data.totalCount < 3) continue; // Require minimum sample size

      const successRate = data.successCount / data.totalCount;
      const avgImprovement = data.totalImprovement / data.totalCount;
      const score = successRate * avgImprovement;

      if (score > bestScore) {
        bestScore = score;
        bestStrategy = {
          name: data.name,
          averageImprovement: avgImprovement,
          successRate: successRate,
        };
      }
    }

    return {
      totalStrategies,
      successRate,
      averageImprovement,
      mostSuccessfulStrategy: bestStrategy,
    };
  }

  /**
   * Saves the memory to disk
   */
  private async saveToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this.memoryPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await fs.promises.writeFile(
        this.memoryPath,
        JSON.stringify(this.memory, null, 2),
        "utf8",
      );
    } catch (error) {
      console.error("Error saving memory to disk:", error);
    }
  }
}
