# PersLM Self-Improvement System

The Self-Improvement System is a core component of PersLM that enables the AI agent to continuously learn and improve its performance through adaptive strategies, memory-based recommendations, and systematic refinement of prompts and processes.

## Components

### 1. SelfImprovementMemory

This class manages the memory of adaptation strategies and their outcomes, allowing the system to learn which strategies work best in different contexts.

**Key Features:**
- Stores strategy outcomes with detailed metrics and context
- Retrieves successful strategies based on context and requirements
- Provides recommendations tailored to specific scores and contexts
- Generates visual reports for strategy performance analysis
- Persists memory to disk for continuous improvement across sessions

**Usage Example:**
```typescript
// Create a memory instance
const memory = new SelfImprovementMemory();

// Record a strategy outcome
await memory.recordStrategyOutcome({
  strategy: myStrategy,
  scoreBeforeAdaptation: 6.5,
  scoreAfterAdaptation: 8.2,
  improvementPercent: 26.2,
  timestamp: new Date().toISOString(),
  successfulRequirements: ['accessibility', 'responsiveness']
});

// Get strategies that have been successful
const successfulStrategies = await memory.getSuccessfulStrategies(5.0);

// Get recommendations based on current score
const recommendations = await memory.getStrategyRecommendations(
  7.0, 
  { projectContext: 'UI Library' }
);

// Generate a visualization report
const reportPath = await memory.visualizeMemory();
```

### 2. PromptRefiner

This class is responsible for analyzing and refining prompts to improve the quality of generated components.

**Key Features:**
- Multiple refinement strategies for different aspects of component generation
- Support for accessibility enhancements
- UX and visual design improvements
- Technical implementation guidance
- Performance optimization suggestions

**Refinement Strategies:**
- `refineWithExamples`: Adds concrete examples to guide implementation
- `enhanceWithAccessibility`: Adds accessibility requirements
- `enhanceWithUX`: Adds UX best practices
- `enhanceCreativity`: Encourages more creative solutions
- `enhanceWithPerformance`: Adds performance optimization requirements
- `enhanceWithTechnicalDetails`: Adds technical implementation details
- `improveReadability`: Improves prompt clarity and organization
- `enhanceWithVisualDesign`: Adds visual design requirements

**Usage Example:**
```typescript
// Create a refiner with an agent
const refiner = new PromptRefiner(persRMAgent);

// Refine a prompt with examples
const refinedPrompt = await refiner.refineWithExamples(originalPrompt);

// Enhance accessibility requirements
const accessiblePrompt = await refiner.enhanceWithAccessibility(originalPrompt);
```

### 3. SelfTrainer

This class orchestrates the self-improvement process, applying strategies, recording outcomes, and managing the improvement cycle.

**Key Features:**
- Multiple adaptation strategies for component improvement
- Memory-based strategy selection
- Performance tracking and plateau detection
- Configurable improvement thresholds
- Detailed outcome recording

**Usage Example:**
```typescript
// Create a trainer with an agent
const trainer = new SelfTrainer(persRMAgent, {
  verbose: true,
  maxImprovementCycles: 3,
  improvementThreshold: 5
});

// Improve a component prompt
const improvement = await trainer.improveComponent(
  originalPrompt,
  initialScore,
  { 
    projectContext: 'Dashboard', 
    requirementTypes: ['accessibility', 'performance']
  }
);

// Get available strategies
const strategies = trainer.getAllStrategies();

// Apply a specific strategy
const adaptedPrompt = await trainer.applyStrategy('AddAccessibility', originalPrompt);
```

## How It Works

1. **Initial Generation**: The system starts with a baseline component generation based on the original prompt.

2. **Performance Measurement**: The quality of the generated component is measured across various dimensions.

3. **Strategy Selection**: The system selects adaptation strategies based on historical performance data and current context.

4. **Adaptation Application**: The selected strategies are applied to refine the prompt or adjust parameters.

5. **Outcome Recording**: The results are recorded in the improvement memory for future reference.

6. **Continuous Learning**: Over time, the system learns which strategies work best for different types of components and contexts.

## Adding New Strategies

To add a new adaptation strategy:

1. Implement the strategy in the appropriate class (typically PromptRefiner)
2. Add it to the SelfTrainer's initializeStrategies method
3. Test it with different prompts and contexts

```typescript
// Example of adding a new strategy
this.addStrategy({
  name: "NewStrategy",
  description: "Description of what the strategy does",
  type: "prompt", // or "context", "model", "config"
  apply: async (prompt: string) => {
    // Implementation of the strategy
    return modifiedPrompt;
  }
});
```

## Testing

A test script (`test-self-improvement.ts`) is provided to demonstrate how to use the system and verify its functionality.

Run the test with:
```
ts-node src/self-improvement/test-self-improvement.ts
```

## Workflow

The Self-Improvement System follows this general workflow:

1. **Generation Phase**
   - A component is generated using the current prompt
   - The quality of the component is scored across multiple dimensions

2. **Analysis Phase**
   - The system analyzes the component's strengths and weaknesses
   - Areas for improvement are identified based on the scoring

3. **Strategy Selection Phase**
   - The system consults the memory for strategy recommendations
   - Strategies are selected based on historical performance and current context

4. **Refinement Phase**
   - Selected strategies are applied to refine the prompt
   - The component is regenerated with the improved prompt

5. **Evaluation Phase**
   - The new component is scored and compared with the previous version
   - Improvement metrics are calculated and recorded

6. **Memory Update Phase**
   - Strategy outcomes are recorded in the memory
   - Memory statistics are updated
   - Visualizations are generated to track progress

7. **Adaptation Phase (if needed)**
   - If improvement plateaus, different strategies are attempted
   - The system may combine multiple strategies or try novel approaches

This cycle repeats until a satisfactory quality level is achieved or the maximum number of improvement cycles is reached.

## Integration with CLI

The Self-Improvement System can be integrated with the PersLM CLI to provide self-improvement capabilities via the command line:

```bash
# Run component generation with self-improvement
npx persrm generate --component button --self-improve

# Analyze improvement history
npx persrm analyze-improvements

# Run benchmark tests with self-improvement
npx persrm benchmark --self-improve --max-cycles 5
```

## Future Enhancements

Planned enhancements for the Self-Improvement System include:

1. **Multi-Model Adaptation**: Test strategies across different LLM models to identify model-specific optimizations

2. **Inter-Component Learning**: Apply successful strategies from one component type to another

3. **Meta-Learning**: Strategies that learn to generate new strategies based on observed patterns

4. **User Feedback Integration**: Incorporate explicit user feedback to guide improvement direction

5. **Hybrid Approach**: Combine LLM-based improvements with rule-based and statistical approaches 