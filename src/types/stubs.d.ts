// Stub type definitions to resolve TypeScript errors

// UUID stub
declare module 'uuid' {
  export function v4(): string;
}

// Stub types for missing analyzer modules
declare module '../analyzers/visual-analyzer' {
  export class VisualAnalyzer {
    constructor(config?: any);
    analyze(path: string): Promise<any>;
  }
}

declare module '../analyzers/design-token-analyzer' {
  export class DesignTokenAnalyzer {
    constructor(config?: any);
    analyze(path: string): Promise<any>;
  }
}

declare module '../analyzers/animation-performance-tracker' {
  export class AnimationPerformanceTracker {
    constructor(config?: any);
    analyze(path: string): Promise<any>;
  }
}

declare module '../analyzers/cognitive-load-simulator' {
  export class CognitiveLoadSimulator {
    constructor(config?: any);
    analyze(path: string): Promise<any>;
  }
}

declare module '../analyzers/accessibility-analyzer' {
  export class AccessibilityAnalyzer {
    constructor(config?: any);
    analyze(path: string): Promise<any>;
  }
}

declare module '../generators/component-generator' {
  export class ComponentGenerator {
    constructor(config?: any);
    generate(options: any): Promise<any>;
  }
}

declare module '../generators/report-generator' {
  export class ReportGenerator {
    constructor(config?: any);
    generate(data: any, options: any): Promise<string>;
  }
}

declare module '../ux-enhancer/validation' {
  export function validateEnhancementSummary(summary: any): {
    valid: boolean;
    errors: string[];
  };
} 