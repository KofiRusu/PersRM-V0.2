import * as fs from "fs";
import * as path from "path";
import { PersRMAgent } from "../agent";
import { AdaptationStrategy } from "./self-train";
import { SelfImprovementMemory, StrategyOutcome } from "./improvement-memory";

/**
 * Interface representing pattern analysis of strategy performance
 */
export interface StrategyPattern {
  // Strategy metadata
  name: string;
  type: string;
  totalUsage: number;
  successCount: number;
  failureCount: number;
  averageImprovement: number;

  // Context specific performance
  performanceByRequirement: Map<
    string,
    { count: number; avgImprovement: number }
  >;
  performanceByComponentType: Map<
    string,
    { count: number; avgImprovement: number }
  >;
  performanceByProject: Map<string, { count: number; avgImprovement: number }>;

  // Score range performance
  performanceByScoreRange: Map<
    string,
    { count: number; avgImprovement: number }
  >;

  // Recent trends
  recentOutcomes: StrategyOutcome[];
  improvementTrend: "increasing" | "stable" | "decreasing";
}

/**
 * Interface representing the analysis of failures and plateaus
 */
export interface FailureAnalysis {
  // Component specific patterns
  failingComponentTypes: string[];
  failingRequirements: string[];

  // Score ranges where strategies plateau
  plateauScoreRanges: { min: number; max: number }[];

  // Specific strengths and weaknesses identified
  identifiedWeaknesses: string[];
  potentialImprovementAreas: string[];

  // Pattern of failures
  commonFailurePatterns: string[];
}

/**
 * Interface for a generated strategy
 */
export interface GeneratedStrategy {
  strategy: AdaptationStrategy;
  metadata: {
    createdAt: Date;
    targetComponentTypes: string[];
    targetRequirements: string[];
    targetScoreRange: { min: number; max: number };
    plateauedStrategies: string[];
    expectedImprovement: number;
  };
  performance: {
    usageCount: number;
    successRate: number;
    averageImprovement: number;
    applications: Array<{
      date: Date;
      componentType: string;
      requirements: string[];
      scoreBefore: number;
      scoreAfter: number;
      improvement: number;
    }>;
  };
}

/**
 * Engine that discovers new adaptation strategies based on memory and patterns
 */
export class StrategyDiscoveryEngine {
  private agent: PersRMAgent;
  private memory: SelfImprovementMemory;
  private discoveredStrategies: Map<string, GeneratedStrategy> = new Map();
  private plateauThreshold = 3; // Number of attempts with minimal improvement to consider a plateau
  private minImprovementThreshold = 0.1; // 10% improvement is minimal threshold
  private generationCounter = 0;
  private storePath: string;

  constructor(
    agent: PersRMAgent,
    memory: SelfImprovementMemory,
    options?: {
      plateauThreshold?: number;
      minImprovementThreshold?: number;
      storePath?: string;
    },
  ) {
    this.agent = agent;
    this.memory = memory;

    if (options) {
      this.plateauThreshold = options.plateauThreshold ?? this.plateauThreshold;
      this.minImprovementThreshold =
        options.minImprovementThreshold ?? this.minImprovementThreshold;
      this.storePath =
        options.storePath ??
        path.join(process.cwd(), "discovered-strategies.json");
    } else {
      this.storePath = path.join(process.cwd(), "discovered-strategies.json");
    }

    this.loadDiscoveredStrategies();
  }

  /**
   * Load previously discovered strategies from disk
   */
  private loadDiscoveredStrategies(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = fs.readFileSync(this.storePath, "utf8");
        const strategies = JSON.parse(data) as GeneratedStrategy[];

        strategies.forEach((strategy) => {
          this.discoveredStrategies.set(strategy.strategy.name, strategy);
        });

        console.log(`Loaded ${strategies.length} discovered strategies`);
      }
    } catch (error) {
      console.error("Error loading discovered strategies:", error);
    }
  }

  /**
   * Save discovered strategies to disk
   */
  private saveDiscoveredStrategies(): void {
    try {
      const strategies = Array.from(this.discoveredStrategies.values());
      fs.writeFileSync(
        this.storePath,
        JSON.stringify(strategies, null, 2),
        "utf8",
      );
    } catch (error) {
      console.error("Error saving discovered strategies:", error);
    }
  }

  /**
   * Analyze strategy patterns from memory data
   */
  private analyzeStrategyPatterns(
    memoryData: StrategyOutcome[],
  ): Map<string, StrategyPattern> {
    const patterns = new Map<string, StrategyPattern>();

    // Group outcomes by strategy
    const strategyGroups = new Map<string, StrategyOutcome[]>();

    for (const outcome of memoryData) {
      if (!outcome.strategyApplied) continue;

      const strategies = Array.isArray(outcome.strategyApplied)
        ? outcome.strategyApplied
        : [outcome.strategyApplied];

      for (const strategy of strategies) {
        if (!strategyGroups.has(strategy)) {
          strategyGroups.set(strategy, []);
        }

        strategyGroups.get(strategy)!.push(outcome);
      }
    }

    // Analyze each strategy group
    for (const [strategyName, outcomes] of strategyGroups.entries()) {
      // Basic metrics
      const totalUsage = outcomes.length;
      const successCount = outcomes.filter(
        (o) => o.improvementPercent > this.minImprovementThreshold,
      ).length;
      const failureCount = totalUsage - successCount;

      // Calculate average improvement
      const totalImprovement = outcomes.reduce(
        (sum, o) => sum + o.improvementPercent,
        0,
      );
      const averageImprovement = totalImprovement / totalUsage;

      // Context specific performance
      const performanceByRequirement = new Map<
        string,
        { count: number; avgImprovement: number }
      >();
      const performanceByComponentType = new Map<
        string,
        { count: number; avgImprovement: number }
      >();
      const performanceByProject = new Map<
        string,
        { count: number; avgImprovement: number }
      >();
      const performanceByScoreRange = new Map<
        string,
        { count: number; avgImprovement: number }
      >();

      // Process requirements
      for (const outcome of outcomes) {
        // Process requirements
        if (outcome.context?.requirementTypes) {
          for (const req of outcome.context.requirementTypes) {
            if (!performanceByRequirement.has(req)) {
              performanceByRequirement.set(req, {
                count: 0,
                avgImprovement: 0,
              });
            }

            const entry = performanceByRequirement.get(req)!;
            entry.count++;
            entry.avgImprovement =
              (entry.avgImprovement * (entry.count - 1) +
                outcome.improvementPercent) /
              entry.count;
          }
        }

        // Process component types
        if (outcome.context?.componentType) {
          if (!performanceByComponentType.has(outcome.context.componentType)) {
            performanceByComponentType.set(outcome.context.componentType, {
              count: 0,
              avgImprovement: 0,
            });
          }

          const entry = performanceByComponentType.get(
            outcome.context.componentType,
          )!;
          entry.count++;
          entry.avgImprovement =
            (entry.avgImprovement * (entry.count - 1) +
              outcome.improvementPercent) /
            entry.count;
        }

        // Process projects
        if (outcome.context?.projectContext) {
          if (!performanceByProject.has(outcome.context.projectContext)) {
            performanceByProject.set(outcome.context.projectContext, {
              count: 0,
              avgImprovement: 0,
            });
          }

          const entry = performanceByProject.get(
            outcome.context.projectContext,
          )!;
          entry.count++;
          entry.avgImprovement =
            (entry.avgImprovement * (entry.count - 1) +
              outcome.improvementPercent) /
            entry.count;
        }

        // Process score ranges
        const scoreRange = Math.floor(outcome.scoreBeforeAdaptation / 2) * 2;
        const rangeKey = `${scoreRange}-${scoreRange + 2}`;

        if (!performanceByScoreRange.has(rangeKey)) {
          performanceByScoreRange.set(rangeKey, {
            count: 0,
            avgImprovement: 0,
          });
        }

        const entry = performanceByScoreRange.get(rangeKey)!;
        entry.count++;
        entry.avgImprovement =
          (entry.avgImprovement * (entry.count - 1) +
            outcome.improvementPercent) /
          entry.count;
      }

      // Get recent trend (last 5 outcomes)
      const recentOutcomes = [...outcomes]
        .sort((a, b) => {
          return (
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        })
        .slice(0, 5);

      // Calculate trend
      let improvementTrend: "increasing" | "stable" | "decreasing" = "stable";
      if (recentOutcomes.length >= 3) {
        const recentAvg =
          recentOutcomes
            .slice(0, 3)
            .reduce((sum, o) => sum + o.improvementPercent, 0) / 3;
        const previousAvg =
          totalUsage > 5
            ? outcomes
                .slice(0, totalUsage - 3)
                .reduce((sum, o) => sum + o.improvementPercent, 0) /
              (totalUsage - 3)
            : recentAvg;

        if (recentAvg > previousAvg * 1.1) {
          improvementTrend = "increasing";
        } else if (recentAvg < previousAvg * 0.9) {
          improvementTrend = "decreasing";
        }
      }

      // Create pattern entry
      const pattern: StrategyPattern = {
        name: strategyName,
        type: strategyName.toLowerCase().includes("prompt")
          ? "prompt"
          : strategyName.toLowerCase().includes("context")
            ? "context"
            : strategyName.toLowerCase().includes("model")
              ? "model"
              : "config",
        totalUsage,
        successCount,
        failureCount,
        averageImprovement,
        performanceByRequirement,
        performanceByComponentType,
        performanceByProject,
        performanceByScoreRange,
        recentOutcomes,
        improvementTrend,
      };

      patterns.set(strategyName, pattern);
    }

    return patterns;
  }

  /**
   * Analyze failures and plateaus to identify improvement areas
   */
  private analyzeFailuresAndPlateaus(
    memoryData: StrategyOutcome[],
    plateauedStrategies: string[],
    context: {
      projectContext?: string;
      requirementTypes?: string[];
      componentType?: string;
    },
  ): FailureAnalysis {
    // Extract outcomes relevant to the current context
    const relevantOutcomes = memoryData.filter((outcome) => {
      let relevant = true;

      // Filter by project context
      if (context.projectContext && outcome.context?.projectContext) {
        relevant =
          relevant && outcome.context.projectContext === context.projectContext;
      }

      // Filter by component type
      if (context.componentType && outcome.context?.componentType) {
        relevant =
          relevant && outcome.context.componentType === context.componentType;
      }

      // Filter by requirement types (at least one match)
      if (
        context.requirementTypes?.length &&
        outcome.context?.requirementTypes?.length
      ) {
        relevant =
          relevant &&
          context.requirementTypes.some((req) =>
            outcome.context!.requirementTypes!.includes(req),
          );
      }

      return relevant;
    });

    // Extract failures
    const failures = relevantOutcomes.filter(
      (o) => o.improvementPercent <= this.minImprovementThreshold,
    );

    // Identify failing component types
    const failingComponentTypes = new Set<string>();
    for (const failure of failures) {
      if (failure.context?.componentType) {
        failingComponentTypes.add(failure.context.componentType);
      }
    }

    // Identify failing requirements
    const failingRequirements = new Set<string>();
    for (const failure of failures) {
      if (failure.context?.requirementTypes) {
        for (const req of failure.context.requirementTypes) {
          failingRequirements.add(req);
        }
      }
    }

    // Identify plateau score ranges
    const plateauScoreRanges = new Set<string>();
    for (const outcome of relevantOutcomes) {
      if (
        plateauedStrategies.includes(outcome.strategyApplied as string) ||
        (Array.isArray(outcome.strategyApplied) &&
          outcome.strategyApplied.some((s) => plateauedStrategies.includes(s)))
      ) {
        const scoreRange = Math.floor(outcome.scoreBeforeAdaptation / 2) * 2;
        plateauScoreRanges.add(`${scoreRange}-${scoreRange + 2}`);
      }
    }

    // Convert to min/max ranges
    const ranges = Array.from(plateauScoreRanges).map((range) => {
      const [min, max] = range.split("-").map(Number);
      return { min, max };
    });

    // Analyze common failure patterns (simplified)
    const commonFailurePatterns: string[] = [];

    // Check for high score plateau
    if (ranges.some((r) => r.min >= 8)) {
      commonFailurePatterns.push(
        "Strategies plateau at high scores (8+), suggesting diminishing returns",
      );
    }

    // Check for specific component type failures
    if (failingComponentTypes.size > 0) {
      commonFailurePatterns.push(
        `Consistent failures with component types: ${Array.from(failingComponentTypes).join(", ")}`,
      );
    }

    // Check for specific requirement failures
    if (failingRequirements.size > 0) {
      commonFailurePatterns.push(
        `Consistent failures with requirements: ${Array.from(failingRequirements).join(", ")}`,
      );
    }

    // Identify weaknesses and improvement areas based on the analysis
    const identifiedWeaknesses: string[] = [];
    const potentialImprovementAreas: string[] = [];

    // Component specific weaknesses
    for (const componentType of failingComponentTypes) {
      identifiedWeaknesses.push(
        `Limited improvement in ${componentType} components`,
      );
      potentialImprovementAreas.push(
        `${componentType}-specific optimization strategies`,
      );
    }

    // Requirement specific weaknesses
    for (const req of failingRequirements) {
      identifiedWeaknesses.push(`Difficulty addressing ${req} requirements`);
      potentialImprovementAreas.push(
        `Specialized techniques for ${req} optimization`,
      );
    }

    // General weaknesses
    if (plateauedStrategies.length > 0) {
      identifiedWeaknesses.push(
        `${plateauedStrategies.length} strategies have plateaued`,
      );
      potentialImprovementAreas.push(
        "Hybrid or complementary strategy combinations",
      );
    }

    return {
      failingComponentTypes: Array.from(failingComponentTypes),
      failingRequirements: Array.from(failingRequirements),
      plateauScoreRanges: ranges,
      identifiedWeaknesses,
      potentialImprovementAreas,
      commonFailurePatterns,
    };
  }

  /**
   * Generate a new strategy based on analysis
   */
  private async generateNewStrategy(
    patterns: Map<string, StrategyPattern>,
    failureAnalysis: FailureAnalysis,
    context: {
      projectContext?: string;
      requirementTypes?: string[];
      componentType?: string;
    },
    currentScore: number,
  ): Promise<GeneratedStrategy | null> {
    // Prepare context for strategy generation
    const scoreRange = Math.floor(currentScore / 2) * 2;
    const targetScoreRange = { min: scoreRange, max: scoreRange + 2 };

    // Extract successful strategies for similar contexts
    const successfulStrategies = Array.from(patterns.values())
      .filter(
        (pattern) => pattern.averageImprovement > this.minImprovementThreshold,
      )
      .sort((a, b) => b.averageImprovement - a.averageImprovement);

    // Extract patterns from the successful strategies
    const effectiveApproaches: string[] = [];

    // Component-specific patterns
    if (context.componentType) {
      for (const strategy of successfulStrategies) {
        const perfEntry = strategy.performanceByComponentType.get(
          context.componentType,
        );
        if (
          perfEntry &&
          perfEntry.avgImprovement > this.minImprovementThreshold
        ) {
          effectiveApproaches.push(
            `Strategy ${strategy.name} works well with ${context.componentType} components`,
          );
        }
      }
    }

    // Requirement-specific patterns
    if (context.requirementTypes?.length) {
      for (const req of context.requirementTypes) {
        for (const strategy of successfulStrategies) {
          const perfEntry = strategy.performanceByRequirement.get(req);
          if (
            perfEntry &&
            perfEntry.avgImprovement > this.minImprovementThreshold
          ) {
            effectiveApproaches.push(
              `Strategy ${strategy.name} addresses ${req} requirements effectively`,
            );
          }
        }
      }
    }

    // Extract features of successful strategies
    const successFeatures = successfulStrategies
      .map(
        (s) =>
          `${s.name}: ${s.averageImprovement.toFixed(2)} avg improvement, ${s.successCount}/${s.totalUsage} success rate`,
      )
      .slice(0, 5);

    // Generate a new strategy using the agent's LLM capabilities
    this.generationCounter++;
    const strategyId = `DiscoveredStrategy${this.generationCounter}`;

    // Create a strategy generation prompt
    const prompt = `
Generate a new adaptation strategy to improve component quality based on the following insights:

CURRENT CONTEXT:
${context.componentType ? `- Component Type: ${context.componentType}` : "- Component Type: Not specified"}
${context.requirementTypes?.length ? `- Requirements: ${context.requirementTypes.join(", ")}` : "- Requirements: Not specified"}
${context.projectContext ? `- Project: ${context.projectContext}` : "- Project: Not specified"}
- Current Score Range: ${targetScoreRange.min}-${targetScoreRange.max}

PLATEAUED STRATEGIES:
${failureAnalysis.commonFailurePatterns.map((p) => `- ${p}`).join("\n")}

SUCCESSFUL APPROACHES:
${effectiveApproaches.length > 0 ? effectiveApproaches.map((a) => `- ${a}`).join("\n") : "- No clear successful approaches identified"}

TOP PERFORMING STRATEGIES:
${successFeatures.map((f) => `- ${f}`).join("\n")}

IDENTIFIED WEAKNESSES:
${failureAnalysis.identifiedWeaknesses.map((w) => `- ${w}`).join("\n")}

POTENTIAL IMPROVEMENT AREAS:
${failureAnalysis.potentialImprovementAreas.map((a) => `- ${a}`).join("\n")}

Create a strategy that addresses these issues. The strategy should:
1. Have a clear focus on ${context.componentType || "any component type"}
2. Address ${context.requirementTypes?.join(", ") || "general requirements"}
3. Be applicable to current score range ${targetScoreRange.min}-${targetScoreRange.max}
4. Include a detailed implementation approach

STRATEGY NAME: A short, descriptive name (CamelCase without spaces)
STRATEGY DESCRIPTION: A one-sentence description of what the strategy does
STRATEGY TYPE: One of "prompt", "context", "model", or "config"
IMPLEMENTATION: A detailed JavaScript async function that implements the strategy (input: prompt string, output: modified string)
    `;

    try {
      // Call the agent to generate the strategy
      const response = await this.agent.getCompletion(prompt, {
        temperature: 0.7,
        max_tokens: 1000,
      });

      // Parse the response to extract strategy details
      const nameMatch = response.match(/STRATEGY NAME:(.+)/i);
      const descMatch = response.match(/STRATEGY DESCRIPTION:(.+)/i);
      const typeMatch = response.match(/STRATEGY TYPE:(.+)/i);
      const implMatch = response.match(/IMPLEMENTATION:(.+)/is);

      if (!nameMatch || !descMatch || !typeMatch || !implMatch) {
        console.error("Failed to parse generated strategy");
        return null;
      }

      const name = nameMatch[1].trim();
      const description = descMatch[1].trim();
      const type = typeMatch[1].trim().toLowerCase() as
        | "prompt"
        | "context"
        | "model"
        | "config";
      const implementation = implMatch[1].trim();

      // Create a safe implementation function
      // This is potentially dangerous as we're creating a function from a string
      // In a production environment, this should have additional safeguards
      let implementationFn: (input: string) => Promise<string>;

      try {
        // Extract just the function body
        const functionBodyMatch =
          implementation.match(
            /async\s*\(\s*prompt\s*:?\s*string\s*\)\s*=>\s*{(.+)}/is,
          ) ||
          implementation.match(
            /async\s+function\s*\(\s*prompt\s*:?\s*string\s*\)\s*{(.+)}/is,
          );

        if (!functionBodyMatch) {
          throw new Error("Couldn't extract function body");
        }

        const functionBody = functionBodyMatch[1].trim();

        // Create the function using Function constructor
        implementationFn = new Function(
          "prompt",
          `
          return (async (prompt) => {
            try {
              ${functionBody}
            } catch (error) {
              console.error("Error in generated strategy:", error);
              return prompt;
            }
          })(prompt);
        `,
        ) as (input: string) => Promise<string>;
      } catch (error) {
        console.error("Failed to create implementation function:", error);

        // Fallback to a simple function that returns the input
        implementationFn = async (input: string) => {
          console.warn("Using fallback implementation for", name);
          return input;
        };
      }

      // Create the new strategy
      const newStrategy: AdaptationStrategy = {
        name,
        description,
        type,
        apply: implementationFn,
      };

      // Create the generated strategy metadata
      const generatedStrategy: GeneratedStrategy = {
        strategy: newStrategy,
        metadata: {
          createdAt: new Date(),
          targetComponentTypes: context.componentType
            ? [context.componentType]
            : [],
          targetRequirements: context.requirementTypes || [],
          targetScoreRange,
          plateauedStrategies: Array.isArray(
            failureAnalysis.commonFailurePatterns,
          )
            ? failureAnalysis.commonFailurePatterns
            : [],
          expectedImprovement: 0.2, // Initial expected improvement of 20%
        },
        performance: {
          usageCount: 0,
          successRate: 0,
          averageImprovement: 0,
          applications: [],
        },
      };

      // Store the generated strategy
      this.discoveredStrategies.set(name, generatedStrategy);
      this.saveDiscoveredStrategies();

      return generatedStrategy;
    } catch (error) {
      console.error("Failed to generate new strategy:", error);
      return null;
    }
  }

  /**
   * Public method to discover a new strategy
   */
  public async discoverStrategy(
    context: {
      projectContext?: string;
      requirementTypes?: string[];
      componentType?: string;
    },
    plateauedStrategies: string[],
    currentScore: number,
  ): Promise<GeneratedStrategy | null> {
    try {
      // Get all strategy outcomes from memory
      const memoryData = await this.memory.getAllOutcomes();

      // Analyze strategy patterns
      const patterns = this.analyzeStrategyPatterns(memoryData);

      // Analyze failures and plateaus
      const failureAnalysis = this.analyzeFailuresAndPlateaus(
        memoryData,
        plateauedStrategies,
        context,
      );

      // Generate a new strategy
      return this.generateNewStrategy(
        patterns,
        failureAnalysis,
        context,
        currentScore,
      );
    } catch (error) {
      console.error("Error discovering strategy:", error);
      return null;
    }
  }

  /**
   * Register a manually created strategy as a discovered strategy
   */
  public registerDiscoveredStrategy(strategy: AdaptationStrategy): void {
    // Check if the strategy already exists
    if (this.discoveredStrategies.has(strategy.name)) {
      console.warn(
        `Strategy ${strategy.name} already exists as a discovered strategy`,
      );
      return;
    }

    // Create a new generated strategy entry
    const generatedStrategy: GeneratedStrategy = {
      strategy: strategy,
      metadata: {
        createdAt: new Date(),
        targetComponentTypes: [],
        targetRequirements: [],
        targetScoreRange: { min: 0, max: 10 },
        plateauedStrategies: [],
        expectedImprovement: 0.2, // Default expected improvement
      },
      performance: {
        usageCount: 0,
        successRate: 0,
        averageImprovement: 0,
        applications: [],
      },
    };

    // Store the strategy
    this.discoveredStrategies.set(strategy.name, generatedStrategy);
    this.saveDiscoveredStrategies();
  }

  /**
   * Get all discovered strategies
   */
  public getDiscoveredStrategies(): AdaptationStrategy[] {
    return Array.from(this.discoveredStrategies.values()).map(
      (gs) => gs.strategy,
    );
  }

  /**
   * Record the outcome of applying a discovered strategy
   */
  public recordStrategyOutcome(
    strategyName: string,
    outcome: StrategyOutcome,
  ): void {
    // Check if this is a discovered strategy
    if (!this.discoveredStrategies.has(strategyName)) {
      return;
    }

    const strategyData = this.discoveredStrategies.get(strategyName)!;

    // Update performance metrics
    strategyData.performance.usageCount++;

    // Add to applications
    strategyData.performance.applications.push({
      date: new Date(outcome.timestamp),
      componentType: outcome.context?.componentType || "unknown",
      requirements: outcome.context?.requirementTypes || [],
      scoreBefore: outcome.scoreBeforeAdaptation,
      scoreAfter: outcome.scoreAfterAdaptation,
      improvement: outcome.improvementPercent,
    });

    // Recalculate average improvement
    const totalImprovement = strategyData.performance.applications.reduce(
      (sum, app) => sum + app.improvement,
      0,
    );

    strategyData.performance.averageImprovement =
      totalImprovement / strategyData.performance.usageCount;

    // Recalculate success rate
    const successCount = strategyData.performance.applications.filter(
      (app) => app.improvement > this.minImprovementThreshold,
    ).length;

    strategyData.performance.successRate =
      successCount / strategyData.performance.usageCount;

    // Save updates
    this.saveDiscoveredStrategies();
  }

  /**
   * Check if a strategy has plateaued
   */
  public hasStrategyPlateaued(strategyName: string): boolean {
    // Check if this is a discovered strategy
    if (!this.discoveredStrategies.has(strategyName)) {
      return false;
    }

    const strategyData = this.discoveredStrategies.get(strategyName)!;

    // Need at least plateauThreshold applications to determine if plateaued
    if (strategyData.performance.applications.length < this.plateauThreshold) {
      return false;
    }

    // Get the most recent applications
    const recentApplications = [...strategyData.performance.applications]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, this.plateauThreshold);

    // Check if all recent applications have minimal improvement
    const hasPlateaued = recentApplications.every(
      (app) => app.improvement <= this.minImprovementThreshold,
    );

    return hasPlateaued;
  }

  /**
   * Generate a report of discovered strategies and their performance
   */
  public async generateDiscoveryReport(): Promise<string> {
    const strategies = Array.from(this.discoveredStrategies.values());

    let report = `# Strategy Discovery Report\n\n`;
    report += `## Overview\n\n`;
    report += `Total Discovered Strategies: ${strategies.length}\n\n`;

    if (strategies.length === 0) {
      report += `No strategies have been discovered yet.\n\n`;
      return report;
    }

    // Sort by performance
    const sortedStrategies = [...strategies].sort(
      (a, b) =>
        b.performance.averageImprovement - a.performance.averageImprovement,
    );

    // Top performing strategies
    report += `## Top Performing Strategies\n\n`;

    for (let i = 0; i < Math.min(sortedStrategies.length, 5); i++) {
      const strategy = sortedStrategies[i];
      report += `### ${i + 1}. ${strategy.strategy.name}\n\n`;
      report += `- Description: ${strategy.strategy.description}\n`;
      report += `- Type: ${strategy.strategy.type}\n`;
      report += `- Average Improvement: ${(strategy.performance.averageImprovement * 100).toFixed(2)}%\n`;
      report += `- Success Rate: ${(strategy.performance.successRate * 100).toFixed(2)}%\n`;
      report += `- Usage Count: ${strategy.performance.usageCount}\n\n`;
    }

    // Recently created strategies
    const recentStrategies = [...strategies]
      .sort(
        (a, b) =>
          b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime(),
      )
      .slice(0, 3);

    report += `## Recently Discovered Strategies\n\n`;

    for (const strategy of recentStrategies) {
      report += `### ${strategy.strategy.name}\n\n`;
      report += `- Created: ${strategy.metadata.createdAt.toISOString().split("T")[0]}\n`;
      report += `- Description: ${strategy.strategy.description}\n`;
      report += `- Target Component Types: ${strategy.metadata.targetComponentTypes.join(", ") || "Any"}\n`;
      report += `- Target Requirements: ${strategy.metadata.targetRequirements.join(", ") || "Any"}\n`;
      report += `- Target Score Range: ${strategy.metadata.targetScoreRange.min}-${strategy.metadata.targetScoreRange.max}\n\n`;
    }

    // Performance statistics
    report += `## Performance Statistics\n\n`;

    const allApplications = strategies.flatMap(
      (s) => s.performance.applications,
    );
    const totalApplications = allApplications.length;

    if (totalApplications > 0) {
      const successfulApplications = allApplications.filter(
        (a) => a.improvement > this.minImprovementThreshold,
      );
      const avgImprovement =
        allApplications.reduce((sum, a) => sum + a.improvement, 0) /
        totalApplications;

      report += `- Total Applications: ${totalApplications}\n`;
      report += `- Overall Success Rate: ${((successfulApplications.length / totalApplications) * 100).toFixed(2)}%\n`;
      report += `- Average Improvement: ${(avgImprovement * 100).toFixed(2)}%\n\n`;

      // Components with most improvement
      const componentImprovements = new Map<
        string,
        { count: number; totalImprovement: number }
      >();

      for (const app of allApplications) {
        if (!componentImprovements.has(app.componentType)) {
          componentImprovements.set(app.componentType, {
            count: 0,
            totalImprovement: 0,
          });
        }

        const entry = componentImprovements.get(app.componentType)!;
        entry.count++;
        entry.totalImprovement += app.improvement;
      }

      const bestComponents = Array.from(componentImprovements.entries())
        .map(([type, data]) => ({
          type,
          avgImprovement: data.totalImprovement / data.count,
          count: data.count,
        }))
        .sort((a, b) => b.avgImprovement - a.avgImprovement)
        .slice(0, 3);

      if (bestComponents.length > 0) {
        report += `### Components with Most Improvement\n\n`;

        for (const comp of bestComponents) {
          report += `- ${comp.type}: ${(comp.avgImprovement * 100).toFixed(2)}% avg improvement (${comp.count} applications)\n`;
        }

        report += `\n`;
      }
    } else {
      report += `No strategy applications recorded yet.\n\n`;
    }

    return report;
  }
}
