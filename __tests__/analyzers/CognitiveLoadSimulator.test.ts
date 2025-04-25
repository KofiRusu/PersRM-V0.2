import { 
  CognitiveLoadSimulator, 
  CognitiveTask, 
  InterfaceType,
  InterfaceDefinition
} from '../../src/analyzers/cognitive-load-simulator';
import { SeverityLevel } from '../../src/lib/persrm/types';

describe('CognitiveLoadSimulator', () => {
  let simulator: CognitiveLoadSimulator;
  
  beforeEach(() => {
    simulator = new CognitiveLoadSimulator({
      verbose: false,
      randomVariation: 0.1 // Lower variation for more predictable tests
    });
  });
  
  test('constructor initializes with default config when none provided', () => {
    const defaultSimulator = new CognitiveLoadSimulator();
    expect(defaultSimulator).toBeDefined();
  });
  
  test('estimateTaskTime returns valid result for button click task', () => {
    const simpleInterface = CognitiveLoadSimulator.createDefaultInterfaceDef(InterfaceType.SIMPLE);
    
    const result = simulator.estimateTaskTime(CognitiveTask.CLICK_BUTTON, simpleInterface);
    
    expect(result).toBeDefined();
    expect(result.task).toBe(CognitiveTask.CLICK_BUTTON);
    expect(result.duration.expected).toBeGreaterThan(0);
    expect(result.cognitiveFactors).toBeDefined();
    expect(result.cognitiveFactors.mentalDemand).toBeGreaterThanOrEqual(0);
    expect(result.cognitiveFactors.mentalDemand).toBeLessThanOrEqual(10);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.maxScore).toBe(100);
  });
  
  test('interface complexity increases task duration and cognitive load', () => {
    const simpleInterface = CognitiveLoadSimulator.createDefaultInterfaceDef(InterfaceType.SIMPLE);
    const complexInterface = CognitiveLoadSimulator.createDefaultInterfaceDef(InterfaceType.COMPLEX);
    
    const simpleResult = simulator.estimateTaskTime(CognitiveTask.FORM_FILL, simpleInterface);
    const complexResult = simulator.estimateTaskTime(CognitiveTask.FORM_FILL, complexInterface);
    
    // Complex interfaces should take longer
    expect(complexResult.duration.expected).toBeGreaterThan(simpleResult.duration.expected);
    
    // Complex interfaces should have higher cognitive load
    expect(complexResult.cognitiveFactors.overallLoad)
      .toBeGreaterThan(simpleResult.cognitiveFactors.overallLoad);
    
    // Complex interfaces should have lower scores
    expect(complexResult.score).toBeLessThan(simpleResult.score);
  });
  
  test('custom task params affect cognitive factors', () => {
    const interfaceDef = CognitiveLoadSimulator.createDefaultInterfaceDef();
    
    // Create a task definition with custom parameters
    const customTask = {
      name: 'Precise Button Click',
      task: CognitiveTask.CLICK_BUTTON,
      component: 'TestButton',
      params: {
        requiresPrecision: true,
        isTimeCritical: true
      }
    };
    
    const result = simulator.estimateTaskTime(customTask, interfaceDef);
    
    // Time critical tasks should have higher temporal demand
    expect(result.cognitiveFactors.temporalDemand).toBeGreaterThan(5);
    
    // Precision-requiring tasks should have higher motor demand
    expect(result.cognitiveFactors.motorDemand).toBeGreaterThan(5);
    
    // Should have a custom task name
    expect(result.customTaskName).toBe('Precise Button Click');
  });
  
  test('poor accessibility increases cognitive load and identifies issues', () => {
    const interfaceDef: InterfaceDefinition = {
      type: InterfaceType.MEDIUM,
      elements: {
        inputs: 3,
        buttons: 2,
        dropdowns: 1
      },
      layout: {
        density: 'medium',
        consistency: 'medium',
        distractions: 'few'
      },
      accessibility: {
        labelQuality: 'poor',
        contrast: 'poor',
        keyboardNavigable: false
      }
    };
    
    const result = simulator.estimateTaskTime(CognitiveTask.FORM_FILL, interfaceDef);
    
    // Poor accessibility should increase frustration
    expect(result.cognitiveFactors.frustration).toBeGreaterThan(5);
    
    // Should identify accessibility issues
    expect(result.issues.some(i => i.description.includes('Poor quality labels'))).toBe(true);
    expect(result.issues.some(i => i.description.includes('Poor contrast'))).toBe(true);
  });
  
  test('analyzeComponent calculates overall score across multiple tasks', () => {
    const interfaceDef = CognitiveLoadSimulator.createDefaultInterfaceDef();
    const tasks = [
      CognitiveTask.CLICK_BUTTON,
      CognitiveTask.NAVIGATION,
      {
        name: 'Fill Form',
        task: CognitiveTask.FORM_FILL,
        component: 'TestForm'
      }
    ];
    
    const result = simulator.analyzeComponent('TestComponent', tasks, interfaceDef);
    
    expect(result).toBeDefined();
    expect(result.componentId).toBe('TestComponent');
    expect(result.taskResults.length).toBe(3);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    
    // Overall score should be the average of task scores
    const avgScore = Math.round(
      result.taskResults.reduce((sum, res) => sum + res.score, 0) / result.taskResults.length
    );
    expect(result.overallScore).toBe(avgScore);
  });
  
  test('different task types have different cognitive demands', () => {
    const interfaceDef = CognitiveLoadSimulator.createDefaultInterfaceDef();
    
    const buttonResult = simulator.estimateTaskTime(CognitiveTask.CLICK_BUTTON, interfaceDef);
    const searchResult = simulator.estimateTaskTime(CognitiveTask.SEARCH, interfaceDef);
    const dragDropResult = simulator.estimateTaskTime(CognitiveTask.DRAG_DROP, interfaceDef);
    
    // Search should have higher mental demand than button click
    expect(searchResult.cognitiveFactors.mentalDemand)
      .toBeGreaterThan(buttonResult.cognitiveFactors.mentalDemand);
    
    // Drag & drop should have higher motor demand than button click
    expect(dragDropResult.cognitiveFactors.motorDemand)
      .toBeGreaterThan(buttonResult.cognitiveFactors.motorDemand);
    
    // Different tasks should have different durations
    expect(searchResult.duration.expected)
      .not.toBe(buttonResult.duration.expected);
  });
  
  test('expert users complete tasks faster than novice users', () => {
    const interfaceDef = CognitiveLoadSimulator.createDefaultInterfaceDef();
    const result = simulator.estimateTaskTime(CognitiveTask.FORM_FILL, interfaceDef);
    
    // Expert times should be less than simulated times
    expect(result.duration.expertUser).toBeLessThan(result.duration.simulated);
    
    // Novice times should be more than simulated times
    expect(result.duration.noviceUser).toBeGreaterThan(result.duration.simulated);
  });
  
  test('complex and lengthy tasks generate appropriate issues', () => {
    // Create a complex interface with many distractions
    const interfaceDef: InterfaceDefinition = {
      type: InterfaceType.COMPLEX,
      elements: {
        inputs: 10,
        buttons: 8,
        dropdowns: 5,
        images: 12,
        textBlocks: 15,
        interactiveElements: 7
      },
      layout: {
        density: 'high',
        consistency: 'low',
        distractions: 'many'
      },
      accessibility: {
        labelQuality: 'adequate',
        contrast: 'adequate',
        keyboardNavigable: true
      }
    };
    
    // Multi-step task
    const result = simulator.estimateTaskTime(CognitiveTask.MULTI_STEP, interfaceDef);
    
    // Should have cognitive load issues
    expect(result.issues.some(i => 
      i.severity === SeverityLevel.ERROR && 
      i.description.includes('cognitive load')
    )).toBe(true);
    
    // Should have long task time issues
    expect(result.issues.some(i => 
      i.description.includes('Long task completion time')
    )).toBe(true);
    
    // Should have layout issues
    expect(result.issues.some(i => 
      i.description.includes('Dense layout with many distractions')
    )).toBe(true);
    
    // Should have consistency issues
    expect(result.issues.some(i => 
      i.description.includes('Inconsistent layout')
    )).toBe(true);
  });
}); 