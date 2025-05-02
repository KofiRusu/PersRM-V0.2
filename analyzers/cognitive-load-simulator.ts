// Placeholder for cognitive-load-simulator.ts
export enum InterfaceType {
  Simple = 'Simple',
  Moderate = 'Moderate',
  Complex = 'Complex'
}

export interface CognitiveTask {
  type: string;
  complexity: number;
  timeToComplete: number;
}

export class CognitiveLoadSimulator {
  analyze(componentPath: string) {
    return {
      score: 90,
      issues: [],
      complexity: 'low',
      interactionEfficiency: 'high',
      recommendations: []
    };
  }
}

export default CognitiveLoadSimulator; 