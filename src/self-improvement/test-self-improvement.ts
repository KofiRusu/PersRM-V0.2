#!/usr/bin/env ts-node

import { PersRMAgent } from "../agent";
import { SelfImprovementMemory, StrategyOutcome } from "./improvement-memory";
import { SelfTrainer, AdaptationStrategy } from "./self-train";
import path from "path";
import fs from "fs";

/**
 * Test file for the self-improvement system
 *
 * This script demonstrates how to use the SelfTrainer and SelfImprovementMemory
 * classes to improve component generation through adaptive strategies.
 *
 * Run with: ts-node src/self-improvement/test-self-improvement.ts
 */

// Sample prompt for testing
const samplePrompt = `
# Button Component

Create a reusable button component with the following features:
- Primary, secondary, and tertiary variants
- Different sizes (small, medium, large)
- Icon support (optional, can be positioned left or right)
- Disabled state
- Loading state with a spinner

The component should be fully typed with TypeScript and follow best practices.
`;

/**
 * Function to load a test prompt from the prompts directory
 */
async function loadTestPrompt(promptId: string): Promise<string> {
  const promptsDir = path.join(
    process.cwd(),
    "generation-benchmark",
    "prompts",
  );

  // If prompt files don't exist yet, create a sample directory
  if (!fs.existsSync(promptsDir)) {
    fs.mkdirSync(promptsDir, { recursive: true });

    // Create a sample prompt
    const samplePromptPath = path.join(promptsDir, `prompt-${promptId}.txt`);
    fs.writeFileSync(samplePromptPath, samplePrompt);
  }

  // Find all prompt files matching the ID
  const promptFiles = fs
    .readdirSync(promptsDir)
    .filter((file) => file.startsWith(`prompt-${promptId}`));

  if (promptFiles.length === 0) {
    // No matching file found, create one with the sample prompt
    const newPromptPath = path.join(promptsDir, `prompt-${promptId}.txt`);
    fs.writeFileSync(newPromptPath, samplePrompt);
    return samplePrompt;
  }

  // Read the first matching prompt file
  const promptPath = path.join(promptsDir, promptFiles[0]);
  return fs.readFileSync(promptPath, "utf-8");
}

/**
 * Function to simulate generating a component and calculating its score
 */
async function simulateComponentGeneration(
  prompt: string,
  requirements: string[] = [],
): Promise<{ component: string; score: number }> {
  // For testing, just return a simple component and a simulated score
  const component = `
    const Button = ({ 
      variant = 'primary', 
      size = 'medium',
      icon,
      iconPosition = 'left',
      disabled = false,
      loading = false,
      children,
      ...props
    }) => {
      // Basic implementation
      return (
        <button 
          className={\`btn \${variant} \${size} \${disabled ? 'disabled' : ''} \${loading ? 'loading' : ''}\`}
          disabled={disabled || loading}
          {...props}
        >
          {loading && <span className="spinner" />}
          {icon && iconPosition === 'left' && <span className="icon left">{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className="icon right">{icon}</span>}
        </button>
      );
    };
  `;

  // Simulate a score based on prompt length and requirements
  const baseScore = 5 + Math.random() * 3;
  const requirementBonus = requirements.length * 0.5;
  const promptComplexityBonus = Math.min(prompt.length / 500, 2);

  return {
    component,
    score: baseScore + requirementBonus + promptComplexityBonus,
  };
}

/**
 * Main test function
 */
async function runTest() {
  try {
    console.log("=== Testing Self-Improvement System ===\n");

    // Create a memory instance with a test path
    const memoryPath = path.join(process.cwd(), "test-improvement-memory.json");
    const memory = new SelfImprovementMemory(memoryPath);

    console.log("Created SelfImprovementMemory instance");

    // Create a mock agent
    const mockAgent: PersRMAgent = {
      generateText: async (prompt: string) => {
        // This is a simple mock implementation
        console.log("Generating text with enhanced prompt...");

        // For testing, just return a slightly modified prompt
        return `${prompt.trim()}\n\nAdditional implementation details:\n- Use React.forwardRef for better component composition\n- Add proper ARIA attributes for accessibility\n- Include comprehensive TypeScript interface definitions`;
      },
      // Add other required properties/methods as needed
    } as any;

    // Create a trainer with the mock agent
    const trainer = new SelfTrainer(mockAgent, {
      verbose: true,
      memoryPath,
      maxImprovementCycles: 3,
      improvementThreshold: 2,
    });

    console.log("Created SelfTrainer instance");

    // Load a test prompt
    const prompt = await loadTestPrompt("01");
    console.log("\nLoaded test prompt:", prompt.substring(0, 100) + "...");

    // Simulate an initial component generation
    console.log("\nSimulating initial component generation...");
    const { score: initialScore } = await simulateComponentGeneration(prompt);
    console.log(`Initial component score: ${initialScore.toFixed(1)}`);

    // Demonstrate getting all available strategies
    const strategies = trainer.getAllStrategies();
    console.log(`\nAvailable strategies (${strategies.length}):`);
    strategies.forEach((strategy) => {
      console.log(`- ${strategy.name}: ${strategy.description}`);
    });

    // Record some simulated outcomes to populate the memory
    console.log("\nRecording some simulated strategy outcomes...");

    for (let i = 0; i < 5; i++) {
      const strategy = strategies[i % strategies.length];
      const improvement = Math.random() * 10 - 3; // -3 to +7

      const outcome: StrategyOutcome = {
        strategy,
        scoreBeforeAdaptation: 5 + Math.random() * 3,
        scoreAfterAdaptation: 5 + Math.random() * 3 + improvement,
        improvementPercent: improvement,
        timestamp: new Date().toISOString(),
        successfulRequirements: ["accessibility", "responsiveness"],
      };

      await memory.recordStrategyOutcome(outcome);
      console.log(
        `  Recorded outcome for strategy '${strategy.name}' with improvement: ${improvement.toFixed(1)}`,
      );
    }

    // Demonstrate getting strategy recommendations
    console.log("\nGetting strategy recommendations for current score...");
    const recommendations =
      await memory.getStrategyRecommendations(initialScore);
    console.log("Recommended strategies:");
    recommendations.forEach((strategy) => {
      console.log(`- ${strategy.name}`);
    });

    // Demonstrate improving a component
    console.log("\nImproving component prompt...");
    const improvement = await trainer.improveComponent(prompt, initialScore, {
      projectContext: "UI Library",
      requirementTypes: ["accessibility", "responsiveness"],
    });

    console.log(`\nImprovement results:`);
    console.log(`- Initial score: ${initialScore.toFixed(1)}`);
    console.log(`- Final score: ${improvement.finalScore.toFixed(1)}`);
    console.log(`- Improvement: ${improvement.improvement.toFixed(1)} points`);
    console.log(
      `- Strategies applied: ${improvement.strategiesApplied.join(", ")}`,
    );

    console.log("\nImproved prompt (excerpt):");
    console.log(improvement.improvedPrompt.substring(0, 300) + "...");

    // Generate visualization
    console.log("\nGenerating memory visualization...");
    const reportPath = await memory.visualizeMemory();
    console.log(`Memory visualization saved to: ${reportPath}`);

    console.log("\n=== Test completed successfully ===");
  } catch (error) {
    console.error("Error in test:", error);
  }
}

// Run the test
runTest();
