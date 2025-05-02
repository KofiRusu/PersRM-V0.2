import { v4 as uuidv4 } from "uuid";
import { PhaseType, SeverityLevel } from "../lib/persrm/types";

// Available tasks for simulation
export enum CognitiveTask {
  CLICK_BUTTON = "click_button",
  FORM_FILL = "form_fill",
  NAVIGATION = "navigation",
  SEARCH = "search",
  SELECTION = "selection",
  DRAG_DROP = "drag_drop",
  MULTI_STEP = "multi_step",
  CUSTOM = "custom",
}

// Interface types
export enum InterfaceType {
  SIMPLE = "simple",
  MEDIUM = "medium",
  COMPLEX = "complex",
}

export interface InterfaceDefinition {
  type: InterfaceType;
  elements: {
    inputs?: number;
    buttons?: number;
    dropdowns?: number;
    images?: number;
    textBlocks?: number;
    interactiveElements?: number;
  };
  layout: {
    density: "low" | "medium" | "high";
    consistency: "low" | "medium" | "high";
    distractions: "none" | "few" | "many";
  };
  accessibility: {
    labelQuality: "poor" | "adequate" | "good";
    contrast: "poor" | "adequate" | "good";
    keyboardNavigable: boolean;
  };
}

export interface TaskDuration {
  expected: number; // milliseconds
  simulated: number; // milliseconds
  percentile90: number; // 90th percentile estimate
  expertUser: number; // expert user estimate
  noviceUser: number; // novice user estimate
}

export interface CognitiveFactors {
  mentalDemand: number; // 0-10
  visualDemand: number; // 0-10
  motorDemand: number; // 0-10
  temporalDemand: number; // 0-10
  frustration: number; // 0-10
  overallLoad: number; // 0-10
}

export interface CognitiveIssue {
  id: string;
  task: string;
  component: string;
  description: string;
  severity: SeverityLevel;
  impact: string;
  suggestion: string;
}

export interface CognitiveSimulationResult {
  componentId: string;
  task: CognitiveTask;
  customTaskName?: string;
  duration: TaskDuration;
  cognitiveFactors: CognitiveFactors;
  issues: CognitiveIssue[];
  score: number;
  maxScore: number;
}

export interface TaskDefinition {
  name: string;
  task: CognitiveTask;
  component: string;
  params?: Record<string, any>;
}

export interface CognitiveLoadSimulatorConfig {
  verbose?: boolean;
  expertUserFactor?: number;
  noviceUserFactor?: number;
  randomVariation?: number;
}

export class CognitiveLoadSimulator {
  private config: CognitiveLoadSimulatorConfig;

  // Base time estimates in milliseconds for different tasks
  private readonly baseTaskTimes: Record<CognitiveTask, number> = {
    [CognitiveTask.CLICK_BUTTON]: 500,
    [CognitiveTask.FORM_FILL]: 3000,
    [CognitiveTask.NAVIGATION]: 1500,
    [CognitiveTask.SEARCH]: 5000,
    [CognitiveTask.SELECTION]: 1000,
    [CognitiveTask.DRAG_DROP]: 2000,
    [CognitiveTask.MULTI_STEP]: 8000,
    [CognitiveTask.CUSTOM]: 2000,
  };

  // Basic cognitive load factors for different tasks
  private readonly baseTaskFactors: Record<
    CognitiveTask,
    Partial<CognitiveFactors>
  > = {
    [CognitiveTask.CLICK_BUTTON]: {
      mentalDemand: 2,
      visualDemand: 3,
      motorDemand: 4,
    },
    [CognitiveTask.FORM_FILL]: {
      mentalDemand: 5,
      visualDemand: 4,
      motorDemand: 6,
    },
    [CognitiveTask.NAVIGATION]: {
      mentalDemand: 4,
      visualDemand: 5,
      motorDemand: 3,
    },
    [CognitiveTask.SEARCH]: {
      mentalDemand: 7,
      visualDemand: 8,
      motorDemand: 3,
    },
    [CognitiveTask.SELECTION]: {
      mentalDemand: 4,
      visualDemand: 5,
      motorDemand: 4,
    },
    [CognitiveTask.DRAG_DROP]: {
      mentalDemand: 5,
      visualDemand: 6,
      motorDemand: 7,
    },
    [CognitiveTask.MULTI_STEP]: {
      mentalDemand: 8,
      visualDemand: 7,
      motorDemand: 6,
    },
    [CognitiveTask.CUSTOM]: {
      mentalDemand: 5,
      visualDemand: 5,
      motorDemand: 5,
    },
  };

  constructor(config: CognitiveLoadSimulatorConfig = {}) {
    this.config = {
      verbose: false,
      expertUserFactor: 0.7,
      noviceUserFactor: 1.5,
      randomVariation: 0.2,
      ...config,
    };
  }

  /**
   * Estimate the time to complete a task given an interface definition
   */
  public estimateTaskTime(
    task: CognitiveTask | TaskDefinition,
    interfaceDef: InterfaceDefinition,
  ): CognitiveSimulationResult {
    // Handle both simple task type and full task definition
    const taskType = typeof task === "string" ? task : task.task;
    const taskName = typeof task === "string" ? task : task.name;
    const componentId = typeof task === "string" ? "unknown" : task.component;
    const customParams = typeof task === "string" ? {} : task.params || {};

    // Start with base times for the task
    const baseTime = this.baseTaskTimes[taskType];

    // Apply factors based on interface complexity
    const complexityFactor = this.calculateComplexityFactor(interfaceDef);
    const expectedTime = baseTime * complexityFactor;

    // Add random variation to simulate real-world differences
    const variationRange = expectedTime * (this.config.randomVariation || 0.2);
    const simulatedTime =
      expectedTime + (Math.random() * variationRange - variationRange / 2);

    // Calculate expert and novice times
    const expertTime = simulatedTime * (this.config.expertUserFactor || 0.7);
    const noviceTime = simulatedTime * (this.config.noviceUserFactor || 1.5);

    // Calculate 90th percentile (slower users/cases)
    const percentile90 = simulatedTime * 1.3;

    // Calculate cognitive factors
    const cognitiveFactors = this.calculateCognitiveFactors(
      taskType,
      interfaceDef,
      customParams,
    );

    // Detect potential issues
    const issues = this.detectCognitiveIssues(
      taskName,
      componentId,
      expectedTime,
      simulatedTime,
      cognitiveFactors,
      interfaceDef,
    );

    // Calculate overall score
    const score = this.calculateCognitiveScore(
      expectedTime,
      cognitiveFactors,
      issues,
    );

    if (this.config.verbose) {
      console.log(
        `Task ${taskName} estimated completion time: ${Math.round(simulatedTime)}ms`,
      );
      console.log(`Cognitive factors:`, cognitiveFactors);
    }

    return {
      componentId,
      task: taskType,
      customTaskName: typeof task !== "string" ? task.name : undefined,
      duration: {
        expected: Math.round(expectedTime),
        simulated: Math.round(simulatedTime),
        percentile90: Math.round(percentile90),
        expertUser: Math.round(expertTime),
        noviceUser: Math.round(noviceTime),
      },
      cognitiveFactors,
      issues,
      score,
      maxScore: 100,
    };
  }

  /**
   * Calculate complexity factor based on interface definition
   */
  private calculateComplexityFactor(interfaceDef: InterfaceDefinition): number {
    let factor = 1.0;

    // Adjust based on interface type
    switch (interfaceDef.type) {
      case InterfaceType.SIMPLE:
        factor *= 0.8;
        break;
      case InterfaceType.MEDIUM:
        factor *= 1.0;
        break;
      case InterfaceType.COMPLEX:
        factor *= 1.3;
        break;
    }

    // Adjust based on number of elements
    const elementCount = Object.values(interfaceDef.elements).reduce(
      (sum, val) => sum + (val || 0),
      0,
    );
    if (elementCount > 20) {
      factor *= 1.4;
    } else if (elementCount > 10) {
      factor *= 1.2;
    } else if (elementCount > 5) {
      factor *= 1.1;
    }

    // Adjust based on layout density
    switch (interfaceDef.layout.density) {
      case "low":
        factor *= 0.9;
        break;
      case "medium":
        factor *= 1.0;
        break;
      case "high":
        factor *= 1.3;
        break;
    }

    // Adjust based on layout consistency
    switch (interfaceDef.layout.consistency) {
      case "low":
        factor *= 1.3;
        break;
      case "medium":
        factor *= 1.1;
        break;
      case "high":
        factor *= 0.9;
        break;
    }

    // Adjust based on distractions
    switch (interfaceDef.layout.distractions) {
      case "none":
        factor *= 0.9;
        break;
      case "few":
        factor *= 1.1;
        break;
      case "many":
        factor *= 1.4;
        break;
    }

    // Adjust based on accessibility
    // Poor accessibility makes tasks take longer
    if (interfaceDef.accessibility.labelQuality === "poor") {
      factor *= 1.2;
    }

    if (interfaceDef.accessibility.contrast === "poor") {
      factor *= 1.15;
    }

    if (!interfaceDef.accessibility.keyboardNavigable) {
      factor *= 1.1;
    }

    return factor;
  }

  /**
   * Calculate cognitive factors for a task
   */
  private calculateCognitiveFactors(
    taskType: CognitiveTask,
    interfaceDef: InterfaceDefinition,
    customParams: Record<string, any> = {},
  ): CognitiveFactors {
    // Start with base factors for the task type
    const baseFactors = this.baseTaskFactors[taskType];

    // Initialize with default values
    let cognitiveFactors: CognitiveFactors = {
      mentalDemand: baseFactors.mentalDemand || 5,
      visualDemand: baseFactors.visualDemand || 5,
      motorDemand: baseFactors.motorDemand || 5,
      temporalDemand: baseFactors.temporalDemand || 5,
      frustration: baseFactors.frustration || 3,
      overallLoad: 0, // Will be calculated
    };

    // Adjust based on interface complexity
    switch (interfaceDef.type) {
      case InterfaceType.COMPLEX:
        cognitiveFactors.mentalDemand += 2;
        cognitiveFactors.visualDemand += 2;
        break;
      case InterfaceType.MEDIUM:
        cognitiveFactors.mentalDemand += 1;
        cognitiveFactors.visualDemand += 1;
        break;
    }

    // Adjust based on layout
    if (interfaceDef.layout.density === "high") {
      cognitiveFactors.visualDemand += 1.5;
      cognitiveFactors.mentalDemand += 1;
    }

    if (interfaceDef.layout.consistency === "low") {
      cognitiveFactors.mentalDemand += 2;
      cognitiveFactors.frustration += 2;
    }

    if (interfaceDef.layout.distractions === "many") {
      cognitiveFactors.mentalDemand += 1.5;
      cognitiveFactors.visualDemand += 1;
      cognitiveFactors.frustration += 1.5;
    }

    // Adjust based on accessibility
    if (interfaceDef.accessibility.labelQuality === "poor") {
      cognitiveFactors.mentalDemand += 1.5;
      cognitiveFactors.frustration += 2;
    }

    if (interfaceDef.accessibility.contrast === "poor") {
      cognitiveFactors.visualDemand += 2;
      cognitiveFactors.frustration += 1;
    }

    if (!interfaceDef.accessibility.keyboardNavigable) {
      cognitiveFactors.motorDemand += 1;
    }

    // Handle custom parameters
    if (customParams.isTimeCritical) {
      cognitiveFactors.temporalDemand += 3;
      cognitiveFactors.frustration += 2;
    }

    if (customParams.requiresPrecision) {
      cognitiveFactors.motorDemand += 2;
      cognitiveFactors.mentalDemand += 1;
    }

    // Ensure values are capped at 10
    Object.keys(cognitiveFactors).forEach((key) => {
      cognitiveFactors[key] = Math.min(10, Math.max(0, cognitiveFactors[key]));
    });

    // Calculate overall load as weighted average of other factors
    cognitiveFactors.overallLoad =
      cognitiveFactors.mentalDemand * 0.25 +
      cognitiveFactors.visualDemand * 0.2 +
      cognitiveFactors.motorDemand * 0.15 +
      cognitiveFactors.temporalDemand * 0.15 +
      cognitiveFactors.frustration * 0.25;

    return cognitiveFactors;
  }

  /**
   * Detect cognitive issues based on simulation results
   */
  private detectCognitiveIssues(
    taskName: string | CognitiveTask,
    componentId: string,
    expectedTime: number,
    simulatedTime: number,
    cognitiveFactors: CognitiveFactors,
    interfaceDef: InterfaceDefinition,
  ): CognitiveIssue[] {
    const issues: CognitiveIssue[] = [];

    // Check for high overall cognitive load
    if (cognitiveFactors.overallLoad > 7) {
      issues.push({
        id: uuidv4(),
        task: taskName.toString(),
        component: componentId,
        description: `High cognitive load (${cognitiveFactors.overallLoad.toFixed(1)}/10) for task "${taskName}"`,
        severity: SeverityLevel.ERROR,
        impact: "High",
        suggestion:
          "Simplify the interface or break down the task into smaller steps",
      });
    } else if (cognitiveFactors.overallLoad > 5) {
      issues.push({
        id: uuidv4(),
        task: taskName.toString(),
        component: componentId,
        description: `Moderate cognitive load (${cognitiveFactors.overallLoad.toFixed(1)}/10) for task "${taskName}"`,
        severity: SeverityLevel.WARNING,
        impact: "Medium",
        suggestion:
          "Consider simplifying the interface or improving instructions",
      });
    }

    // Check for high frustration
    if (cognitiveFactors.frustration > 7) {
      issues.push({
        id: uuidv4(),
        task: taskName.toString(),
        component: componentId,
        description: `High frustration level (${cognitiveFactors.frustration.toFixed(1)}/10) for task "${taskName}"`,
        severity: SeverityLevel.ERROR,
        impact: "High",
        suggestion:
          "Improve usability and feedback mechanisms to reduce user frustration",
      });
    }

    // Check for accessibility issues
    if (interfaceDef.accessibility.labelQuality === "poor") {
      issues.push({
        id: uuidv4(),
        task: taskName.toString(),
        component: componentId,
        description: "Poor quality labels increase cognitive load",
        severity: SeverityLevel.WARNING,
        impact: "Medium",
        suggestion:
          "Improve form labels and instructions to be more descriptive and clear",
      });
    }

    if (interfaceDef.accessibility.contrast === "poor") {
      issues.push({
        id: uuidv4(),
        task: taskName.toString(),
        component: componentId,
        description: "Poor contrast increases visual demand",
        severity: SeverityLevel.WARNING,
        impact: "Medium",
        suggestion:
          "Increase contrast ratios to meet accessibility standards (WCAG AA or AAA)",
      });
    }

    // Check for long task completion time
    if (simulatedTime > 5000) {
      issues.push({
        id: uuidv4(),
        task: taskName.toString(),
        component: componentId,
        description: `Long task completion time (${Math.round(simulatedTime)}ms)`,
        severity:
          simulatedTime > 8000 ? SeverityLevel.ERROR : SeverityLevel.WARNING,
        impact: simulatedTime > 8000 ? "High" : "Medium",
        suggestion:
          "Optimize the task flow or provide shortcuts for frequent actions",
      });
    }

    // Check for layout issues
    if (
      interfaceDef.layout.density === "high" &&
      interfaceDef.layout.distractions === "many"
    ) {
      issues.push({
        id: uuidv4(),
        task: taskName.toString(),
        component: componentId,
        description:
          "Dense layout with many distractions increases cognitive load",
        severity: SeverityLevel.WARNING,
        impact: "Medium",
        suggestion:
          "Reduce visual density and eliminate unnecessary distractions",
      });
    }

    // Check for consistency issues
    if (interfaceDef.layout.consistency === "low") {
      issues.push({
        id: uuidv4(),
        task: taskName.toString(),
        component: componentId,
        description: "Inconsistent layout increases mental demand",
        severity: SeverityLevel.WARNING,
        impact: "Medium",
        suggestion:
          "Improve consistency by following established UX patterns and design system guidelines",
      });
    }

    return issues;
  }

  /**
   * Calculate cognitive score based on factors and issues
   */
  private calculateCognitiveScore(
    expectedTime: number,
    cognitiveFactors: CognitiveFactors,
    issues: CognitiveIssue[],
  ): number {
    // Base score of 100
    let score = 100;

    // Deduct points based on cognitive load
    score -= cognitiveFactors.overallLoad * 5; // 0-50 point deduction

    // Longer tasks should have lower scores
    if (expectedTime > 5000) {
      score -= Math.min(20, ((expectedTime - 5000) / 1000) * 4);
    }

    // Deduct points for each issue
    for (const issue of issues) {
      switch (issue.severity) {
        case SeverityLevel.CRITICAL:
          score -= 20;
          break;
        case SeverityLevel.ERROR:
          score -= 15;
          break;
        case SeverityLevel.WARNING:
          score -= 10;
          break;
        case SeverityLevel.INFO:
          score -= 5;
          break;
      }
    }

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Analyze multiple tasks on a component
   */
  public analyzeComponent(
    componentId: string,
    tasks: Array<CognitiveTask | TaskDefinition>,
    interfaceDef: InterfaceDefinition,
  ): {
    componentId: string;
    taskResults: CognitiveSimulationResult[];
    overallScore: number;
    issues: CognitiveIssue[];
  } {
    const taskResults: CognitiveSimulationResult[] = [];
    const allIssues: CognitiveIssue[] = [];

    // Simulate each task
    for (const task of tasks) {
      const result = this.estimateTaskTime(task, interfaceDef);
      taskResults.push(result);
      allIssues.push(...result.issues);
    }

    // Calculate average score
    const overallScore =
      taskResults.length > 0
        ? Math.round(
            taskResults.reduce((sum, res) => sum + res.score, 0) /
              taskResults.length,
          )
        : 0;

    return {
      componentId,
      taskResults,
      overallScore,
      issues: allIssues,
    };
  }

  /**
   * Create a default interface definition for simple testing
   */
  public static createDefaultInterfaceDef(
    complexity: InterfaceType = InterfaceType.MEDIUM,
  ): InterfaceDefinition {
    const interfaceDef: InterfaceDefinition = {
      type: complexity,
      elements: {
        inputs: 0,
        buttons: 0,
        dropdowns: 0,
        images: 0,
        textBlocks: 0,
        interactiveElements: 0,
      },
      layout: {
        density: "medium",
        consistency: "medium",
        distractions: "few",
      },
      accessibility: {
        labelQuality: "adequate",
        contrast: "adequate",
        keyboardNavigable: true,
      },
    };

    // Set elements based on complexity
    switch (complexity) {
      case InterfaceType.SIMPLE:
        interfaceDef.elements = {
          inputs: 1,
          buttons: 2,
          dropdowns: 0,
          images: 1,
          textBlocks: 2,
          interactiveElements: 0,
        };
        break;
      case InterfaceType.MEDIUM:
        interfaceDef.elements = {
          inputs: 3,
          buttons: 4,
          dropdowns: 1,
          images: 2,
          textBlocks: 4,
          interactiveElements: 2,
        };
        break;
      case InterfaceType.COMPLEX:
        interfaceDef.elements = {
          inputs: 8,
          buttons: 6,
          dropdowns: 3,
          images: 5,
          textBlocks: 8,
          interactiveElements: 5,
        };
        break;
    }

    return interfaceDef;
  }
}
