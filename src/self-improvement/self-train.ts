import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { PromptRefiner } from "./prompt-refiner";
import { SelfImprovementMemory, StrategyOutcome } from "./improvement-memory";
import { PersRMAgent } from "../agent";
import {
  StrategyDiscoveryEngine,
  GeneratedStrategy,
} from "./strategy-discovery";
import {
  scoreComponentFile,
  ScoreResult,
  getEmptyScoreResult,
  getMinimumScoreResult,
} from "../lib/scoring";

/**
 * Interface representing a summary of improvements between benchmark runs
 */
export interface ImprovementSummary {
  promptId: string;
  oldBaseline: number;
  newBaseline: number;
  oldEnhanced: number;
  newEnhanced: number;
  improvement: number; // Positive = better
}

/**
 * Interface for detailed scoring data
 */
interface ScoringData {
  promptId: string;
  componentName: string;
  baseline: number;
  enhanced: number;
  improvement: number;
}

/**
 * Interface for multi-cycle training summary
 */
export interface MultiCycleSummary {
  cycles: {
    cycleNumber: number;
    averageScore: number;
    improvementPercent: number;
    adaptationApplied?: AdaptationStrategy;
  }[];
  plateauDetected: boolean;
  adaptationsApplied: AdaptationStrategy[];
}

/**
 * Type definition for adaptation strategies
 */
export type AdaptationStrategy = {
  name: string;
  description: string;
  apply: (input: string) => Promise<string>;
  type: "prompt" | "context" | "model" | "config";
};

/**
 * Interface for custom refinement requirements
 */
interface RefinementRequirements {
  accessibility: string[];
  ux: string[];
  responsiveness: string[];
  codeQuality: string[];
  strictness: number; // 1-5, higher means more strict
}

/**
 * Configuration options for self-training
 */
export interface SelfTrainingConfig {
  maxCycles?: number;
  requireImprovement?: boolean;
  improvementThreshold?: number;
  memoryPath?: string;
  verbose?: boolean;
  strategyPreferences?: string[];
  enableDiscovery?: boolean;
  discoveryThreshold?: number;
}

export interface SelfTrainerOptions {
  memory?: SelfImprovementMemory;
  maxIterations?: number;
  improvementThreshold?: number;
  verbose?: boolean;
  maxScore?: number;
  enableStrategyDiscovery?: boolean;
}

/**
 * Class responsible for self-improvement of the PersRM agent
 */
export class SelfTrainer {
  private readonly projectPath: string;
  private readonly reportsDir: string;
  private readonly promptsDir: string;
  private readonly refinedPromptsDir: string;
  private readonly originalOutputDir: string;
  private readonly refinedOutputDir: string;
  private currentStrategy: AdaptationStrategy | null = null;
  private adaptationCount: number = 0;
  private memory: SelfImprovementMemory;
  private useMemory: boolean = false;
  private projectName: string;
  private lastCycleScores: { before: number; after: number } = {
    before: 0,
    after: 0,
  };
  private agent: PersRMAgent;
  private promptRefiner: PromptRefiner;
  private strategyDiscovery: StrategyDiscoveryEngine | null = null;
  private strategies: Map<string, AdaptationStrategy> = new Map();
  private config: Required<SelfTrainingConfig>;
  private verbose: boolean;
  private maxImprovementCycles: number;
  private improvementThreshold: number;
  private enableDiscovery: boolean;
  private discoveryThreshold: number;
  private plateauedStrategies: Set<string> = new Set();
  private discoveredStrategies: Map<string, GeneratedStrategy> = new Map();
  private maxIterations: number;
  private maxScore: number;
  private discoveryEngine?: StrategyDiscoveryEngine;
  private enableStrategyDiscovery: boolean;

  /**
   * Constructor for the SelfTrainer class
   * @param agent The PersRM agent to train
   * @param options Configuration options
   */
  constructor(
    agent: PersRMAgent,
    options: {
      verbose?: boolean;
      memoryPath?: string;
      maxImprovementCycles?: number;
      improvementThreshold?: number;
      projectPath?: string;
      projectName?: string;
      enableDiscovery?: boolean;
      discoveryThreshold?: number;
      maxIterations?: number;
      maxScore?: number;
      enableStrategyDiscovery?: boolean;
    } = {},
  ) {
    this.agent = agent;
    this.verbose = options.verbose || false;
    this.memory = new SelfImprovementMemory(options.memoryPath);
    this.promptRefiner = new PromptRefiner(agent);
    this.maxImprovementCycles = options.maxImprovementCycles || 3;
    this.improvementThreshold = options.improvementThreshold || 5;
    this.projectPath = options.projectPath || process.cwd();
    this.projectName = options.projectName || path.basename(this.projectPath);
    this.enableDiscovery = options.enableDiscovery || false;
    this.discoveryThreshold = options.discoveryThreshold || 3;
    this.maxIterations = options.maxIterations || 5;
    this.maxScore = options.maxScore || 10;
    this.enableStrategyDiscovery = options.enableStrategyDiscovery || false;

    // Initialize strategy discovery engine if enabled
    if (this.enableDiscovery) {
      this.strategyDiscovery = new StrategyDiscoveryEngine(agent, this.memory);
    }

    // Initialize directories
    this.reportsDir = path.join(
      this.projectPath,
      "generation-benchmark",
      "reports",
    );
    this.promptsDir = path.join(
      this.projectPath,
      "generation-benchmark",
      "prompts",
    );
    this.refinedPromptsDir = path.join(
      this.projectPath,
      "generation-benchmark",
      "prompts-refined",
    );
    this.originalOutputDir = path.join(
      this.projectPath,
      "generation-benchmark",
      "outputs",
      "baseline",
    );
    this.refinedOutputDir = path.join(
      this.projectPath,
      "generation-benchmark",
      "outputs",
      "enhanced",
    );

    // Ensure directories exist
    this.ensureDirectoriesExist();

    // Initialize available strategies
    this.strategies = new Map();
    this.initializeStrategies();

    // Initialize default config
    this.config = {
      maxCycles: this.maxImprovementCycles,
      requireImprovement: true,
      improvementThreshold: this.improvementThreshold,
      memoryPath:
        options.memoryPath ||
        path.join(this.projectPath, "improvement-memory.json"),
      verbose: this.verbose,
      strategyPreferences: [],
      enableDiscovery: this.enableDiscovery,
      discoveryThreshold: this.discoveryThreshold,
    };

    if (this.enableStrategyDiscovery) {
      this.discoveryEngine = new StrategyDiscoveryEngine(
        this.agent,
        this.memory,
      );

      // Add any discovered strategies to the available strategies
      const discoveredStrategies =
        this.discoveryEngine.getDiscoveredStrategies();
      this.strategies = new Map(
        discoveredStrategies.map((s) => [s.strategy.name, s.strategy]),
      );
    }
  }

  /**
   * Ensures that required directories exist
   */
  private ensureDirectoriesExist(): void {
    [
      this.reportsDir,
      this.promptsDir,
      this.refinedPromptsDir,
      this.originalOutputDir,
      this.refinedOutputDir,
    ].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Initialize the adaptation strategies
   */
  private initializeStrategies(): void {
    // Prompt-based strategies
    this.addStrategy({
      name: "AddExamples",
      description:
        "Add concrete examples to the prompt to guide implementation",
      type: "prompt",
      apply: async (prompt: string) => {
        return this.promptRefiner.refineWithExamples(prompt);
      },
    });

    this.addStrategy({
      name: "AddAccessibility",
      description: "Enhance the prompt with accessibility requirements",
      type: "prompt",
      apply: async (prompt: string) => {
        return this.promptRefiner.enhanceWithAccessibility(prompt);
      },
    });

    this.addStrategy({
      name: "AddUXGuidelines",
      description: "Add UX best practices and guidelines to the prompt",
      type: "prompt",
      apply: async (prompt: string) => {
        return this.promptRefiner.enhanceWithUX(prompt);
      },
    });

    this.addStrategy({
      name: "IncreaseCreativity",
      description: "Modify the prompt to encourage more creative solutions",
      type: "prompt",
      apply: async (prompt: string) => {
        return this.promptRefiner.enhanceCreativity(prompt);
      },
    });

    this.addStrategy({
      name: "AddPerformance",
      description: "Add performance optimization requirements to the prompt",
      type: "prompt",
      apply: async (prompt: string) => {
        return this.promptRefiner.enhanceWithPerformance(prompt);
      },
    });

    this.addStrategy({
      name: "AddTechnicalDetails",
      description: "Enhance the prompt with technical implementation details",
      type: "prompt",
      apply: async (prompt: string) => {
        return this.promptRefiner.enhanceWithTechnicalDetails(prompt);
      },
    });

    this.addStrategy({
      name: "ImproveReadability",
      description: "Refine the prompt for clarity and readability",
      type: "prompt",
      apply: async (prompt: string) => {
        return this.promptRefiner.improveReadability(prompt);
      },
    });

    this.addStrategy({
      name: "AddVisualDesign",
      description: "Enhance the prompt with visual design requirements",
      type: "prompt",
      apply: async (prompt: string) => {
        return this.promptRefiner.enhanceWithVisualDesign(prompt);
      },
    });

    // TODO: Add context and model-based strategies in future iterations
  }

  /**
   * Add a strategy to the available strategies
   * @param strategy The strategy to add
   */
  private addStrategy(strategy: AdaptationStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get an adaptation strategy by name
   * @param name The name of the strategy
   * @returns The requested strategy or undefined if not found
   */
  getStrategy(name: string): AdaptationStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Get all available strategies
   * @returns Array of all adaptation strategies
   */
  getAllStrategies(): AdaptationStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Get all discovered strategies
   * @returns Array of discovered strategies and their details
   */
  getDiscoveredStrategies(): {
    strategy: AdaptationStrategy;
    details: GeneratedStrategy;
  }[] {
    return Array.from(this.discoveredStrategies.entries()).map(
      ([_, details]) => ({
        strategy: details.strategy,
        details,
      }),
    );
  }

  /**
   * Apply an adaptation strategy to input
   * @param strategyName The name of the strategy to apply
   * @param input The input to apply the strategy to
   * @returns The adapted input
   */
  async applyStrategy(strategyName: string, input: string): Promise<string> {
    const strategy = this.getStrategy(strategyName);

    if (!strategy) {
      throw new Error(`Strategy '${strategyName}' not found`);
    }

    if (this.verbose) {
      console.log(
        `Applying strategy: ${strategy.name} - ${strategy.description}`,
      );
    }

    return strategy.apply(input);
  }

  /**
   * Record the outcome of an adaptation strategy
   * @param outcome The strategy outcome to record
   */
  async recordOutcome(outcome: StrategyOutcome): Promise<void> {
    await this.memory.recordStrategyOutcome(outcome);

    // Update plateau tracking
    if (this.strategyDiscovery) {
      this.strategyDiscovery.updatePerformanceHistory(outcome);

      // Check if the strategy has plateaued
      if (this.strategyDiscovery.hasStrategyPlateaued(outcome.strategy.name)) {
        this.plateauedStrategies.add(outcome.strategy.name);

        if (this.verbose) {
          console.log(`Strategy '${outcome.strategy.name}' has plateaued`);
        }
      }
    }

    if (this.verbose) {
      console.log(`Recorded strategy outcome: ${outcome.strategy.name}`);
      console.log(`Improvement: ${outcome.improvementPercent.toFixed(2)}%`);
      console.log(
        `Score: ${outcome.scoreBeforeAdaptation.toFixed(1)} -> ${outcome.scoreAfterAdaptation.toFixed(1)}`,
      );
    }
  }

  /**
   * Get recommended strategies based on current score and context
   * @param currentScore Current score
   * @param context Optional context information
   * @returns Array of recommended strategies
   */
  async getRecommendedStrategies(
    currentScore: number,
    context?: {
      projectContext?: string;
      requirementTypes?: string[];
      componentType?: string;
    },
  ): Promise<AdaptationStrategy[]> {
    // Get recommendations from memory
    const memoryRecommendations = await this.memory.getStrategyRecommendations(
      currentScore,
      context,
    );

    // Get discovered strategies for variety
    const discoveredStrategies = Array.from(
      this.discoveredStrategies.values(),
    ).map((g) => g.strategy);

    // Combine both sets, prioritizing memory recommendations but including at least one discovered strategy
    const combined = [...memoryRecommendations];

    // Add discovered strategies that aren't already in the recommendations
    for (const strategy of discoveredStrategies) {
      if (!combined.some((s) => s.name === strategy.name)) {
        combined.push(strategy);
      }
    }

    return combined;
  }

  /**
   * Discover a new strategy when existing ones have plateaued
   * @param context Current context
   * @param currentScore Current score
   * @returns A newly discovered strategy or null
   */
  private async discoverNewStrategy(
    context: {
      projectContext?: string;
      requirementTypes?: string[];
      componentType?: string;
    },
    currentScore: number,
  ): Promise<AdaptationStrategy | null> {
    if (!this.strategyDiscovery || !this.enableDiscovery) {
      return null;
    }

    // Convert set to array for the discovery engine
    const plateauedStrategies = Array.from(this.plateauedStrategies);

    if (this.verbose) {
      console.log(`Attempting to discover a new strategy...`);
      console.log(`Plateaued strategies: ${plateauedStrategies.join(", ")}`);
    }

    // Attempt to discover a new strategy
    const generatedStrategy = await this.strategyDiscovery.discoverStrategy(
      context,
      plateauedStrategies,
      currentScore,
    );

    if (!generatedStrategy) {
      if (this.verbose) {
        console.log("No new strategy could be discovered");
      }
      return null;
    }

    // Add the discovered strategy to our available strategies
    this.addStrategy(generatedStrategy.strategy);

    // Save the generated strategy with its details
    this.discoveredStrategies.set(
      generatedStrategy.strategy.name,
      generatedStrategy,
    );

    if (this.verbose) {
      console.log(
        `Discovered new strategy: ${generatedStrategy.strategy.name}`,
      );
      console.log(`Description: ${generatedStrategy.strategy.description}`);
      console.log(`Confidence: ${generatedStrategy.confidence}%`);
      console.log(`Reasoning: ${generatedStrategy.reasoning}`);
    }

    return generatedStrategy.strategy;
  }

  /**
   * Improve a component using adaptation strategies
   * @param prompt The component prompt
   * @param initialScore Initial score of the component
   * @param context Optional context information
   * @returns Improved prompt and performance information
   */
  async improveComponent(
    prompt: string,
    initialScore: number,
    context?: {
      projectContext?: string;
      requirementTypes?: string[];
      componentType?: string;
    },
  ): Promise<{
    improvedPrompt: string;
    finalScore: number;
    improvement: number;
    strategiesApplied: string[];
    discoveredStrategies: string[];
  }> {
    let currentPrompt = prompt;
    let currentScore = initialScore;
    const strategiesApplied: string[] = [];
    const discoveredStrategiesApplied: string[] = [];
    let previousScore = initialScore;
    let plateauCount = 0;
    let consecutivePlateauCount = 0;

    if (this.verbose) {
      console.log(
        `Starting component improvement with initial score: ${initialScore.toFixed(1)}`,
      );
    }

    // Get recommended strategies from memory if available
    let recommendedStrategies = await this.getRecommendedStrategies(
      currentScore,
      context,
    );

    // Fall back to default strategies if no recommendations
    if (recommendedStrategies.length === 0) {
      recommendedStrategies = this.getAllStrategies();
    }

    for (let cycle = 0; cycle < this.maxImprovementCycles; cycle++) {
      if (this.verbose) {
        console.log(
          `\nImprovement cycle ${cycle + 1}/${this.maxImprovementCycles}`,
        );
      }

      // Check if we should try to discover a new strategy
      if (
        this.enableDiscovery &&
        consecutivePlateauCount >= this.discoveryThreshold &&
        this.plateauedStrategies.size >= this.discoveryThreshold
      ) {
        const newStrategy = await this.discoverNewStrategy(
          context || {},
          currentScore,
        );

        // If we discovered a new strategy, use it next
        if (newStrategy) {
          recommendedStrategies = [newStrategy, ...recommendedStrategies];
          consecutivePlateauCount = 0;
        }
      }

      // Choose a strategy for this cycle
      const strategy =
        recommendedStrategies[cycle % recommendedStrategies.length];

      if (!strategy) {
        if (this.verbose) {
          console.log("No suitable strategy found, ending improvement cycle");
        }
        break;
      }

      try {
        // Apply the strategy
        const strategyName = strategy.name;
        strategiesApplied.push(strategyName);

        // Track if this is a discovered strategy
        if (this.discoveredStrategies.has(strategyName)) {
          discoveredStrategiesApplied.push(strategyName);
        }

        if (this.verbose) {
          console.log(`Applying strategy: ${strategyName}`);
          if (this.discoveredStrategies.has(strategyName)) {
            console.log(`(This is a discovered strategy)`);
          }
        }

        // Apply the strategy to the current prompt
        const adaptedPrompt = await this.applyStrategy(
          strategyName,
          currentPrompt,
        );

        // Generate a component from the adapted prompt (to be implemented by the caller)
        // For now, just simulate an improvement in score
        // This would be replaced with actual generation and evaluation
        const newScore = currentScore + Math.random() * 10 - 2; // Simulate score improvement

        // Record the outcome
        await this.recordOutcome({
          strategy,
          projectContext: context?.projectContext,
          scoreBeforeAdaptation: currentScore,
          scoreAfterAdaptation: newScore,
          improvementPercent: ((newScore - currentScore) / currentScore) * 100,
          timestamp: new Date().toISOString(),
          successfulRequirements: context?.requirementTypes || [],
        });

        // Check if we've hit a plateau
        const hasPlateaued = newScore <= previousScore + 0.5;
        if (hasPlateaued) {
          plateauCount++;
          consecutivePlateauCount++;

          // Add to plateaued strategies if this is the second time it plateaus
          if (
            plateauCount >= 2 &&
            !this.plateauedStrategies.has(strategyName)
          ) {
            this.plateauedStrategies.add(strategyName);

            if (this.verbose) {
              console.log(
                `Strategy '${strategyName}' added to plateaued strategies list`,
              );
            }
          }
        } else {
          plateauCount = 0;
          consecutivePlateauCount = 0;
        }

        // Exit if we've hit a plateau for 2 consecutive cycles with different strategies
        if (plateauCount >= 2) {
          if (this.verbose) {
            console.log("Improvement has plateaued, ending improvement cycle");
          }
          break;
        }

        previousScore = currentScore;
        currentScore = newScore;
        currentPrompt = adaptedPrompt;

        // If we've achieved a significant improvement, we can exit early
        if (currentScore - initialScore >= this.improvementThreshold) {
          if (this.verbose) {
            console.log(
              `Achieved significant improvement (${(currentScore - initialScore).toFixed(1)} points), ending improvement cycle`,
            );
          }
          break;
        }
      } catch (error) {
        console.error(`Error in improvement cycle ${cycle + 1}:`, error);
        // Continue with the next strategy
      }
    }

    return {
      improvedPrompt: currentPrompt,
      finalScore: currentScore,
      improvement: currentScore - initialScore,
      strategiesApplied,
      discoveredStrategies: discoveredStrategiesApplied,
    };
  }

  /**
   * Visualize the memory for analysis
   * @returns Path to the generated report
   */
  async visualizeMemory(): Promise<string> {
    return this.memory.visualizeMemory();
  }

  /**
   * Generate a report on discovered strategies
   * @returns Path to the generated report
   */
  async generateStrategyDiscoveryReport(): Promise<string | null> {
    if (!this.strategyDiscovery) {
      console.error("Strategy discovery is not enabled");
      return null;
    }

    return this.strategyDiscovery.generateDiscoveryReport();
  }

  /**
   * Scores a component against the prompt requirements
   * @param promptId ID of the prompt
   * @param componentPath Path to the component file (.tsx)
   * @param promptContent Original prompt content
   * @param phase Type of component (baseline, enhanced, or v0)
   * @returns Structured score object with individual criteria scores and total
   */
  async scorePrompt(
    promptId: string,
    componentPath: string,
    promptContent: string,
    phase: "baseline" | "enhanced" | "v0",
  ): Promise<ScoreResult> {
    if (this.verbose) {
      console.log(`📊 Scoring ${phase} component for prompt ${promptId}...`);
    }

    try {
      // Use the scoreComponentFile function from the scoring module
      const result = await scoreComponentFile(
        componentPath,
        promptContent,
        phase,
        this.verbose
          ? (message, isError) => {
              if (isError) {
                console.error(`❌ ${message}`);
              } else {
                console.log(message);
              }
            }
          : undefined,
      );

      if (!result) {
        throw new Error(`Failed to score ${phase} component`);
      }

      if (this.verbose) {
        console.log(
          `✅ ${phase} component score: ${result.totalScore.toFixed(1)}/25`,
        );
      }

      return result;
    } catch (error) {
      console.error(`❌ Error scoring ${phase} component:`, error);

      // Return a default score in case of error
      return getEmptyScoreResult();
    }
  }

  /**
   * Runs a single improvement cycle
   * @param prompt - The prompt to improve
   * @param context - Optional context about the prompt
   * @returns A summary of the improvement
   */
  async runImprovementCycle(
    prompt: string,
    context?: {
      projectContext?: string;
      requirementTypes?: string[];
      componentType?: string;
      promptId?: string;
      baselinePath?: string;
      enhancedPath?: string;
    },
  ): Promise<ImprovementSummary> {
    // Set default values for missing fields
    const promptId = context?.promptId || "unknown";
    let baselineScore: ScoreResult | null = null;
    let enhancedScore: ScoreResult | null = null;

    if (this.verbose) {
      console.log(`\n🔄 Starting improvement cycle for prompt ${promptId}`);
    }

    try {
      // 1. Score baseline component if path is provided
      if (context?.baselinePath && fs.existsSync(context.baselinePath)) {
        baselineScore = await this.scorePrompt(
          promptId,
          context.baselinePath,
          prompt,
          "baseline",
        );
      } else {
        // Fallback to a simple score structure if no file path provided
        baselineScore = getMinimumScoreResult();

        if (this.verbose) {
          console.log("ℹ️ No baseline path provided, using simulated score");
        }
      }

      // Start with the highest score from baseline
      let highestScore = baselineScore.totalScore;
      let bestPrompt = prompt;
      let appliedStrategies: string[] = [];
      let plateauedStrategies: string[] = [];

      // Get recommendations for next strategy
      const recommendations = await this.getRecommendedStrategies(
        highestScore,
        context,
      );

      if (this.verbose && recommendations.length > 0) {
        console.log(
          `📋 Available strategies: ${recommendations.map((s) => s.name).join(", ")}`,
        );
      } else if (this.verbose) {
        console.log(`⚠️ No recommended strategies available`);
      }

      // Apply strategies to improve the prompt
      for (let iteration = 0; iteration < this.maxIterations; iteration++) {
        if (this.verbose) {
          console.log(`\n🔄 Iteration ${iteration + 1}/${this.maxIterations}`);
        }

        // Check if we have strategies to apply
        if (recommendations.length === 0) {
          if (this.verbose) {
            console.log(
              "⚠️ No suitable strategies found. All strategies may have been exhausted or plateaued.",
            );
          }
          break;
        }

        // Get next strategy
        const strategy = recommendations[iteration % recommendations.length];

        if (!strategy) {
          if (this.verbose) {
            console.log("⚠️ No more strategies available.");
          }
          break;
        }

        // Skip if strategy is already identified as plateaued
        if (plateauedStrategies.includes(strategy.name)) {
          if (this.verbose) {
            console.log(
              `⏩ Strategy ${strategy.name} has already plateaued, skipping.`,
            );
          }
          continue;
        }

        try {
          // Apply strategy
          if (this.verbose) {
            console.log(`🔧 Applying strategy: ${strategy.name}`);
          }

          const modifiedPrompt = await strategy.apply(bestPrompt);

          // 2. Generate and score enhanced component if path provided
          let newScore: number;

          if (context?.enhancedPath && fs.existsSync(context.enhancedPath)) {
            enhancedScore = await this.scorePrompt(
              promptId,
              context.enhancedPath,
              modifiedPrompt,
              "enhanced",
            );
            newScore = enhancedScore.totalScore;
          } else {
            // Fallback to simulation if no file path provided
            newScore = this.simulateScoreImprovement(
              highestScore,
              strategy.name,
            );

            if (this.verbose) {
              console.log(
                "ℹ️ No enhanced path provided, using simulated improvement",
              );
            }
          }

          // 3. Calculate improvement
          const improvement = newScore - highestScore;
          const improvementPercent = (improvement / highestScore) * 100;

          if (this.verbose) {
            const improvementEmoji =
              improvement > 0 ? "📈" : improvement < 0 ? "📉" : "➖";
            console.log(
              `${improvementEmoji} Score changed from ${highestScore.toFixed(1)} to ${newScore.toFixed(1)} (${improvement > 0 ? "+" : ""}${improvement.toFixed(2)} pts, ${improvementPercent.toFixed(1)}%)`,
            );
          }

          // Record the outcome
          const outcome: StrategyOutcome = {
            strategyApplied: strategy.name,
            scoreBeforeAdaptation: highestScore,
            scoreAfterAdaptation: newScore,
            improvementPercent: improvementPercent,
            context: {
              projectContext: context?.projectContext,
              requirementTypes: context?.requirementTypes,
              componentType: context?.componentType,
            },
            timestamp: new Date().toISOString(),
          };

          // 4. Log results to memory
          await this.memory.recordStrategyOutcome(outcome);

          // Check if we have improvement
          if (improvement > this.improvementThreshold) {
            // Update tracking variables
            highestScore = newScore;
            bestPrompt = modifiedPrompt;
            appliedStrategies.push(strategy.name);

            if (this.verbose) {
              console.log(`✅ Strategy effective! Applied ${strategy.name}`);
            }
          } else {
            // Strategy didn't yield sufficient improvement
            if (this.verbose) {
              console.log(
                `❌ Strategy ${strategy.name} did not yield sufficient improvement.`,
              );
            }
            plateauedStrategies.push(strategy.name);
          }

          // Stop if we've reached the maximum score
          if (highestScore >= this.maxScore) {
            if (this.verbose) {
              console.log(`🏆 Reached maximum score of ${this.maxScore}.`);
            }
            break;
          }
        } catch (error) {
          console.error(`❌ Error applying strategy ${strategy.name}:`, error);
          plateauedStrategies.push(strategy.name);
        }
      }

      // Calculate total improvement
      const totalImprovement = highestScore - baselineScore.totalScore;
      const totalImprovementPercent =
        (totalImprovement / baselineScore.totalScore) * 100;

      if (this.verbose) {
        console.log(`\n📋 Improvement cycle summary:`);
        console.log(`- Original score: ${baselineScore.totalScore.toFixed(1)}`);
        console.log(`- Final score: ${highestScore.toFixed(1)}`);
        console.log(
          `- Total improvement: ${totalImprovement.toFixed(2)} pts (${totalImprovementPercent.toFixed(1)}%)`,
        );
        console.log(
          `- Applied strategies: ${appliedStrategies.length > 0 ? appliedStrategies.join(", ") : "None"}`,
        );
        console.log(
          `- Plateaued strategies: ${plateauedStrategies.length > 0 ? plateauedStrategies.join(", ") : "None"}`,
        );
      }

      return {
        originalPrompt: prompt,
        improvedPrompt: bestPrompt,
        originalScore: baselineScore.totalScore,
        finalScore: highestScore,
        totalImprovement,
        appliedStrategies,
        iterationResults: [],
      };
    } catch (error) {
      console.error(`❌ Error in improvement cycle:`, error);

      // Return minimal information in case of unrecoverable error
      return {
        originalPrompt: prompt,
        improvedPrompt: prompt,
        originalScore: baselineScore?.totalScore || 0,
        finalScore: baselineScore?.totalScore || 0,
        totalImprovement: 0,
        appliedStrategies: [],
        iterationResults: [],
      };
    }
  }

  /**
   * Helper method to simulate score improvement
   * For testing when actual file generation is not performed
   */
  private simulateScoreImprovement(
    currentScore: number,
    strategyName: string,
  ): number {
    // Different strategies have different simulated impacts
    const strategyImpacts: { [key: string]: number } = {
      AddAccessibility: 0.5 + Math.random() * 1.0,
      AddUXGuidelines: 0.7 + Math.random() * 1.2,
      AddExamples: 0.4 + Math.random() * 0.8,
      IncreaseCreativity: 0.3 + Math.random() * 0.9,
      AddPerformance: 0.2 + Math.random() * 0.7,
      AddTechnicalDetails: 0.6 + Math.random() * 1.1,
      ImproveReadability: 0.3 + Math.random() * 0.6,
      AddVisualDesign: 0.5 + Math.random() * 1.0,
    };

    // Get the impact for this strategy, or use a default
    const impact = strategyImpacts[strategyName] || 0.2 + Math.random() * 0.8;

    // Occasionally simulate a slight regression
    const regression = Math.random() < 0.1 ? -0.2 - Math.random() * 0.3 : 0;

    // Calculate new score with diminishing returns as we approach max score
    const distanceToMax = this.maxScore - currentScore;
    const diminishingFactor = Math.max(0.2, distanceToMax / this.maxScore);

    return Math.min(
      this.maxScore,
      currentScore + impact * diminishingFactor + regression,
    );
  }
}
