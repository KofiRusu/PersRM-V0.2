import { v4 as uuidv4 } from 'uuid';
import { UXEnhancementSummary, UXIssue, PhaseType, SeverityLevel } from '../persrm/types';

/**
 * Represents a step in a user flow
 */
export interface FlowStep {
  id: string;
  component: string;
  action: string;
  expectedDuration: number; // in milliseconds
  description: string;
  isRequired: boolean;
  dependsOn?: string[]; // IDs of steps that must be completed before this one
}

/**
 * Represents a user flow through components
 */
export interface UserFlow {
  id: string;
  name: string;
  description: string;
  steps: FlowStep[];
  expectedTotalDuration: number; // in milliseconds
  requiredStepsToComplete: string[]; // IDs of steps required for flow completion
}

/**
 * Mapping of component names to their UX enhancement summaries
 */
export interface ComponentMap {
  [componentName: string]: UXEnhancementSummary;
}

/**
 * Result of a simulated step
 */
export interface SimulatedStepResult {
  stepId: string;
  success: boolean;
  timeToComplete: number; // in milliseconds
  confused: boolean;
  errors: number;
  notes: string[];
}

/**
 * Result of a simulated user flow
 */
export interface SimulatedFlowResult {
  flowId: string;
  timestamp: string;
  totalDuration: number;
  averageTimeToComplete: number;
  successRate: number; // 0-1
  completionRate: number; // 0-1 (percentage of steps completed)
  confusionRate: number; // 0-1
  stepResults: SimulatedStepResult[];
  overallScore: number; // 0-100
  notes: string[];
}

/**
 * Configuration for simulation
 */
export interface SimulationConfig {
  iterations: number;
  noiseLevel: number; // 0-1, how much random variability to introduce
  userExpertiseLevel: number; // 0-1, expert users have lower confusion rates
  devicePerformance: number; // 0-1, affects timing
  networkCondition: number; // 0-1, affects timing for data operations
  randomSeed?: number; // Optional seed for deterministic randomness
}

const DEFAULT_CONFIG: SimulationConfig = {
  iterations: 10,
  noiseLevel: 0.3,
  userExpertiseLevel: 0.5,
  devicePerformance: 0.8,
  networkCondition: 0.7
};

/**
 * Simulates a user flow with components
 * @param userFlow The user flow to simulate
 * @param componentMap Mapping of components to their UX enhancement summaries
 * @param config Simulation configuration
 * @returns Results of the simulation
 */
export function simulateUserFlow(
  userFlow: UserFlow,
  componentMap: ComponentMap,
  config: Partial<SimulationConfig> = {}
): SimulatedFlowResult[] {
  // Merge with default config
  const fullConfig: SimulationConfig = { ...DEFAULT_CONFIG, ...config };
  
  const results: SimulatedFlowResult[] = [];
  
  // Run simulation for specified number of iterations
  for (let i = 0; i < fullConfig.iterations; i++) {
    const stepResults: SimulatedStepResult[] = [];
    const flowNotes: string[] = [];
    let totalDuration = 0;
    let completedSteps = 0;
    let requiredStepsCompleted = 0;
    let confusedSteps = 0;
    
    // Process each step in the flow
    for (const step of userFlow.steps) {
      const component = componentMap[step.component];
      
      // Skip if dependencies aren't met
      if (step.dependsOn && step.dependsOn.length > 0) {
        const dependencies = stepResults.filter(r => step.dependsOn?.includes(r.stepId));
        if (dependencies.some(d => !d.success)) {
          stepResults.push({
            stepId: step.id,
            success: false,
            timeToComplete: 0,
            confused: false,
            errors: 0,
            notes: ['Skipped due to dependency failure']
          });
          continue;
        }
      }
      
      // Simulate this step
      const stepResult = simulateStep(step, component, fullConfig);
      stepResults.push(stepResult);
      
      // Update totals
      totalDuration += stepResult.timeToComplete;
      if (stepResult.success) {
        completedSteps++;
        if (userFlow.requiredStepsToComplete.includes(step.id)) {
          requiredStepsCompleted++;
        }
      }
      if (stepResult.confused) {
        confusedSteps++;
      }
      
      // Add flow-level notes based on results
      if (stepResult.errors > 2) {
        flowNotes.push(`High error rate in step: ${step.description}`);
      }
      if (stepResult.timeToComplete > step.expectedDuration * 2) {
        flowNotes.push(`Step taking much longer than expected: ${step.description}`);
      }
    }
    
    // Calculate overall metrics
    const successRate = requiredStepsCompleted / userFlow.requiredStepsToComplete.length;
    const completionRate = completedSteps / userFlow.steps.length;
    const confusionRate = confusedSteps / userFlow.steps.length;
    const averageTimeToComplete = totalDuration / completedSteps || 0;
    
    // Calculate overall score (0-100)
    const timeScore = Math.max(0, 100 - (totalDuration / userFlow.expectedTotalDuration - 1) * 100);
    const successScore = successRate * 100;
    const confusionPenalty = confusionRate * 50; // Confusion reduces score
    
    const overallScore = Math.max(0, Math.min(100, (timeScore * 0.3 + successScore * 0.7) - confusionPenalty));
    
    results.push({
      flowId: userFlow.id,
      timestamp: new Date().toISOString(),
      totalDuration,
      averageTimeToComplete,
      successRate,
      completionRate,
      confusionRate,
      stepResults,
      overallScore,
      notes: flowNotes
    });
  }
  
  return results;
}

/**
 * Simulates a single step in a user flow
 * @param step The step to simulate
 * @param component The component UX enhancement summary
 * @param config Simulation configuration
 * @returns Result of the step simulation
 */
function simulateStep(
  step: FlowStep,
  component: UXEnhancementSummary,
  config: SimulationConfig
): SimulatedStepResult {
  const notes: string[] = [];
  
  // Base metrics derived from component UX score
  const componentScore = component ? component.overallScore / component.maxScore : 0.5;
  
  // Base confusion rate is inverse of component score
  let baseConfusionRate = 1 - componentScore;
  
  // Base success probability depends on component score
  let baseSuccessProbability = componentScore;
  
  // Base timing is expected duration modified by component score
  let baseTiming = step.expectedDuration / (0.5 + componentScore / 2);
  
  // Apply noise and variability
  const result = injectNoiseOrVariability({
    baseSuccessProbability,
    baseConfusionRate,
    baseTiming
  }, config);
  
  // Determine if step was successful
  const success = Math.random() < result.successProbability;
  
  // Determine if user was confused
  const confused = Math.random() < result.confusionRate;
  
  // Calculate errors based on confusion and success
  let errors = 0;
  if (confused) {
    errors += Math.floor(Math.random() * 3) + 1;
    notes.push('User showed signs of confusion');
  }
  if (!success) {
    errors += Math.floor(Math.random() * 2) + 1;
    notes.push('User failed to complete action as expected');
  }
  
  // Adjust timing based on confusion and errors
  let timeToComplete = result.timing;
  if (confused) timeToComplete *= (1 + Math.random() * 0.5);
  if (errors > 0) timeToComplete *= (1 + errors * 0.2);
  
  // Add notes about UX issues
  if (component && component.issues) {
    // Find applicable issues for this component
    const relevantIssues = component.issues.filter(issue => {
      // Issues that would affect this step
      return (
        (issue.phase === PhaseType.RESPONSIVENESS && timeToComplete > step.expectedDuration) ||
        (issue.phase === PhaseType.ACCESSIBILITY && confused) ||
        (issue.phase === PhaseType.VISUAL_CONSISTENCY && confused) ||
        (issue.severity === SeverityLevel.CRITICAL || issue.severity === SeverityLevel.ERROR)
      );
    });
    
    if (relevantIssues.length > 0) {
      relevantIssues.forEach(issue => {
        notes.push(`Affected by UX issue: ${issue.message}`);
      });
    }
  }
  
  return {
    stepId: step.id,
    success,
    timeToComplete,
    confused,
    errors,
    notes
  };
}

/**
 * Injects realistic noise and variability into simulation parameters
 * @param params Base parameters
 * @param config Simulation configuration
 * @returns Modified parameters with noise applied
 */
export function injectNoiseOrVariability(
  params: {
    baseSuccessProbability: number;
    baseConfusionRate: number;
    baseTiming: number;
  },
  config: SimulationConfig
): {
  successProbability: number;
  confusionRate: number;
  timing: number;
} {
  // Apply random variability based on noise level
  const noiseMultiplier = config.noiseLevel * 0.5; // Scale down for more reasonable variation
  
  // Add noise to success probability
  let successProbability = params.baseSuccessProbability + 
    (Math.random() * 2 - 1) * noiseMultiplier;
  
  // User expertise reduces confusion rate
  let confusionRate = params.baseConfusionRate * (1 - config.userExpertiseLevel * 0.7) +
    (Math.random() * 2 - 1) * noiseMultiplier;
  
  // Device and network affect timing
  let timing = params.baseTiming * 
    (1 + (1 - config.devicePerformance) * 0.5) * 
    (1 + (1 - config.networkCondition) * 0.3) +
    (Math.random() * 2 - 1) * params.baseTiming * noiseMultiplier;
  
  // Ensure values stay within reasonable bounds
  successProbability = Math.max(0.1, Math.min(1, successProbability));
  confusionRate = Math.max(0, Math.min(1, confusionRate));
  timing = Math.max(params.baseTiming * 0.5, timing);
  
  return {
    successProbability,
    confusionRate,
    timing
  };
}

/**
 * Creates a new user flow
 * @param name Flow name
 * @param description Flow description
 * @param steps Array of flow steps
 * @returns The created user flow
 */
export function createUserFlow(
  name: string,
  description: string,
  steps: Omit<FlowStep, 'id'>[]
): UserFlow {
  const flowSteps: FlowStep[] = steps.map(step => ({
    ...step,
    id: uuidv4()
  }));
  
  // Calculate expected total duration
  const expectedTotalDuration = flowSteps.reduce(
    (total, step) => total + step.expectedDuration,
    0
  );
  
  // Determine required steps
  const requiredStepsToComplete = flowSteps
    .filter(step => step.isRequired)
    .map(step => step.id);
  
  return {
    id: uuidv4(),
    name,
    description,
    steps: flowSteps,
    expectedTotalDuration,
    requiredStepsToComplete
  };
}

/**
 * Generates a set of sample user flows for testing
 * @returns Array of sample user flows
 */
export function generateSampleUserFlows(): UserFlow[] {
  return [
    createUserFlow(
      'User Registration',
      'New user registration flow',
      [
        {
          component: 'RegistrationForm',
          action: 'fill_form',
          expectedDuration: 10000,
          description: 'Fill out registration form',
          isRequired: true
        },
        {
          component: 'RegistrationForm',
          action: 'submit',
          expectedDuration: 2000,
          description: 'Submit registration',
          isRequired: true,
          dependsOn: ['step1']
        },
        {
          component: 'VerificationPage',
          action: 'verify_email',
          expectedDuration: 5000,
          description: 'Verify email address',
          isRequired: true,
          dependsOn: ['step2']
        },
        {
          component: 'Dashboard',
          action: 'view',
          expectedDuration: 3000,
          description: 'View dashboard after registration',
          isRequired: false,
          dependsOn: ['step3']
        }
      ]
    ),
    createUserFlow(
      'Product Purchase',
      'User purchases a product',
      [
        {
          component: 'ProductList',
          action: 'browse',
          expectedDuration: 15000,
          description: 'Browse product listing',
          isRequired: true
        },
        {
          component: 'ProductDetail',
          action: 'view',
          expectedDuration: 8000,
          description: 'View product details',
          isRequired: true,
          dependsOn: ['step1']
        },
        {
          component: 'ProductDetail',
          action: 'add_to_cart',
          expectedDuration: 2000,
          description: 'Add product to cart',
          isRequired: true,
          dependsOn: ['step2']
        },
        {
          component: 'ShoppingCart',
          action: 'view',
          expectedDuration: 3000,
          description: 'View shopping cart',
          isRequired: true,
          dependsOn: ['step3']
        },
        {
          component: 'Checkout',
          action: 'checkout',
          expectedDuration: 12000,
          description: 'Complete checkout process',
          isRequired: true,
          dependsOn: ['step4']
        },
        {
          component: 'OrderConfirmation',
          action: 'view',
          expectedDuration: 4000,
          description: 'View order confirmation',
          isRequired: false,
          dependsOn: ['step5']
        }
      ]
    )
  ];
} 