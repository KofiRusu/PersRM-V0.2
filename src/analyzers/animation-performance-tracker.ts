import { v4 as uuidv4 } from 'uuid';
import { PhaseType, SeverityLevel } from '../lib/persrm/types';

export interface FrameRateData {
  averageFps: number;
  minFps: number;
  maxFps: number;
  dropCount: number;
  duration: number;
  timestamps: number[];
  frameDeltas: number[];
}

export interface AnimationConfig {
  name: string;
  selector: string;
  type: 'hover' | 'click' | 'load' | 'scroll' | 'custom';
  duration?: number;
  action?: string;
}

export interface AnimationIssue {
  id: string;
  component: string;
  animation: string;
  description: string;
  severity: SeverityLevel;
  impact: string;
  suggestion: string;
  frameRate?: number;
  expectedFrameRate?: number;
}

export interface AnimationPerformanceResult {
  componentId: string;
  timestamp: string;
  animations: {
    name: string;
    data: FrameRateData;
  }[];
  issues: AnimationIssue[];
  score: number;
  maxScore: number;
}

export interface AnimationPerformanceTrackerConfig {
  targetFrameRate?: number;
  slowFrameThreshold?: number;
  recordFrames?: boolean;
  verbose?: boolean;
  headless?: boolean;
}

export class AnimationPerformanceTracker {
  private config: AnimationPerformanceTrackerConfig;
  private isTracking: boolean = false;
  private frameData: { time: number; delta: number }[] = [];
  private animationConfigs: Map<string, AnimationConfig[]> = new Map();
  
  constructor(config: AnimationPerformanceTrackerConfig = {}) {
    this.config = {
      targetFrameRate: 60,
      slowFrameThreshold: 16.7, // ms (60fps)
      recordFrames: true,
      verbose: false,
      headless: true,
      ...config
    };
  }
  
  /**
   * Register a component's animations for tracking
   */
  public registerComponent(componentId: string, animations: AnimationConfig[]): void {
    this.animationConfigs.set(componentId, animations);
    
    if (this.config.verbose) {
      console.log(`Registered ${animations.length} animations for component ${componentId}`);
    }
  }
  
  /**
   * Track frame rate for a specific component animation
   */
  public async trackFrameRate(
    componentId: string, 
    animationName?: string
  ): Promise<FrameRateData> {
    if (this.isTracking) {
      throw new Error('Already tracking frame rate. Call stopTracking first.');
    }
    
    // In a real implementation, this would use puppeteer to:
    // 1. Open the component in a browser
    // 2. Inject frame tracking code
    // 3. Trigger the animation
    // 4. Collect and return the frame data
    
    // For this implementation, we'll simulate frame data
    return this.simulateFrameData(componentId, animationName);
  }
  
  /**
   * Simulate frame rate data for testing or when browser-based tracking is not available
   */
  private simulateFrameData(componentId: string, animationName?: string): FrameRateData {
    const targetFps = this.config.targetFrameRate;
    const animationConfig = this.getAnimationConfig(componentId, animationName);
    
    // Duration based on config or default to 1 second
    const duration = animationConfig?.duration || 1000;
    
    // Generate simulated frame timestamps
    const frameCount = Math.floor((targetFps * duration) / 1000);
    const timestamps: number[] = [];
    const frameDeltas: number[] = [];
    
    const now = Date.now();
    let prevTimestamp = now;
    let cumulativeTime = 0;
    
    // Add some randomness to make it realistic
    for (let i = 0; i < frameCount; i++) {
      // Normally, frames would be spaced evenly (e.g., 16.7ms for 60fps)
      // Add some variability to simulate real-world conditions
      const idealFrameTime = 1000 / targetFps;
      
      // Introduce occasional slow frames
      let frameTime: number;
      
      if (Math.random() < 0.1) {
        // 10% chance of a slow frame
        frameTime = idealFrameTime * (1 + Math.random() * 1.5);
      } else {
        // Normal frame with some variability
        frameTime = idealFrameTime * (0.8 + Math.random() * 0.4);
      }
      
      cumulativeTime += frameTime;
      const timestamp = now + cumulativeTime;
      
      timestamps.push(timestamp);
      frameDeltas.push(timestamp - prevTimestamp);
      
      prevTimestamp = timestamp;
    }
    
    // Calculate fps metrics
    const deltas = frameDeltas.slice(1); // Skip first delta which might be invalid
    const fpsValues = deltas.map(delta => 1000 / delta);
    
    const averageFps = fpsValues.reduce((sum, fps) => sum + fps, 0) / fpsValues.length;
    const minFps = Math.min(...fpsValues);
    const maxFps = Math.max(...fpsValues);
    
    // Count dropped frames (frames taking more than 1.5x the ideal frame time)
    const idealFrameTime = 1000 / targetFps;
    const dropCount = deltas.filter(delta => delta > idealFrameTime * 1.5).length;
    
    return {
      averageFps,
      minFps,
      maxFps,
      dropCount,
      duration,
      timestamps,
      frameDeltas: deltas
    };
  }
  
  /**
   * Get animation configuration for a component
   */
  private getAnimationConfig(componentId: string, animationName?: string): AnimationConfig | undefined {
    const componentAnimations = this.animationConfigs.get(componentId);
    
    if (!componentAnimations || componentAnimations.length === 0) {
      return undefined;
    }
    
    if (animationName) {
      return componentAnimations.find(a => a.name === animationName);
    }
    
    // Return the first animation if no specific name is provided
    return componentAnimations[0];
  }
  
  /**
   * Analyze a component's animation performance
   */
  public async analyzeComponent(componentId: string): Promise<AnimationPerformanceResult> {
    const componentAnimations = this.animationConfigs.get(componentId) || [];
    
    if (componentAnimations.length === 0 && this.config.verbose) {
      console.log(`No animations registered for component ${componentId}`);
    }
    
    const timestamp = new Date().toISOString();
    const animationResults = [];
    const issues = [];
    
    // Track each registered animation
    for (const animation of componentAnimations) {
      try {
        const frameData = await this.trackFrameRate(componentId, animation.name);
        animationResults.push({
          name: animation.name,
          data: frameData
        });
        
        // Check for performance issues
        const animationIssues = this.detectPerformanceIssues(componentId, animation.name, frameData);
        issues.push(...animationIssues);
      } catch (error) {
        console.error(`Error tracking animation "${animation.name}" for component ${componentId}:`, error);
      }
    }
    
    // Fallback to a generic animation test if none are registered
    if (componentAnimations.length === 0) {
      try {
        const frameData = await this.trackFrameRate(componentId);
        animationResults.push({
          name: 'general',
          data: frameData
        });
        
        // Check for performance issues
        const animationIssues = this.detectPerformanceIssues(componentId, 'general', frameData);
        issues.push(...animationIssues);
      } catch (error) {
        console.error(`Error tracking general performance for component ${componentId}:`, error);
      }
    }
    
    // Calculate overall score
    const score = this.calculatePerformanceScore(animationResults, issues);
    
    return {
      componentId,
      timestamp,
      animations: animationResults,
      issues,
      score,
      maxScore: 100
    };
  }
  
  /**
   * Detect performance issues in frame rate data
   */
  private detectPerformanceIssues(
    componentId: string, 
    animationName: string, 
    frameData: FrameRateData
  ): AnimationIssue[] {
    const issues: AnimationIssue[] = [];
    const targetFps = this.config.targetFrameRate;
    
    // Check average FPS
    if (frameData.averageFps < targetFps * 0.9) {
      issues.push({
        id: uuidv4(),
        component: componentId,
        animation: animationName,
        description: `Low average frame rate (${frameData.averageFps.toFixed(1)} FPS)`,
        severity: frameData.averageFps < targetFps * 0.75 
          ? SeverityLevel.ERROR 
          : SeverityLevel.WARNING,
        impact: frameData.averageFps < targetFps * 0.75 ? 'High' : 'Medium',
        suggestion: 'Optimize animation performance by reducing complexity or using CSS transitions',
        frameRate: frameData.averageFps,
        expectedFrameRate: targetFps
      });
    }
    
    // Check for significant frame drops
    if (frameData.dropCount > 5 || frameData.dropCount / frameData.frameDeltas.length > 0.1) {
      issues.push({
        id: uuidv4(),
        component: componentId,
        animation: animationName,
        description: `Significant frame drops detected (${frameData.dropCount} drops)`,
        severity: SeverityLevel.WARNING,
        impact: 'Medium',
        suggestion: 'Reduce animation complexity or optimize rendering performance',
        frameRate: frameData.averageFps,
        expectedFrameRate: targetFps
      });
    }
    
    // Check for very low minimum FPS
    if (frameData.minFps < targetFps * 0.5) {
      issues.push({
        id: uuidv4(),
        component: componentId,
        animation: animationName,
        description: `Severe frame rate drops (minimum: ${frameData.minFps.toFixed(1)} FPS)`,
        severity: SeverityLevel.ERROR,
        impact: 'High',
        suggestion: 'Look for blocking operations during animation that cause severe stuttering',
        frameRate: frameData.minFps,
        expectedFrameRate: targetFps
      });
    }
    
    return issues;
  }
  
  /**
   * Calculate overall performance score
   */
  private calculatePerformanceScore(
    animationResults: { name: string; data: FrameRateData }[],
    issues: AnimationIssue[]
  ): number {
    if (animationResults.length === 0) {
      return 0; // No animations to score
    }
    
    // Start with perfect score
    let score = 100;
    
    // Deduct points for issues
    for (const issue of issues) {
      switch (issue.severity) {
        case SeverityLevel.CRITICAL:
          score -= 25;
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
    
    // Also factor in average frame rate across all animations
    const targetFps = this.config.targetFrameRate;
    const averageFpsRatio = animationResults.reduce(
      (sum, animation) => sum + animation.data.averageFps / targetFps,
      0
    ) / animationResults.length;
    
    // Scale score by average FPS ratio (with a minimum of 50% impact)
    score = Math.min(score, score * Math.max(0.5, averageFpsRatio));
    
    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
  }
  
  /**
   * Analyze a directory of components
   */
  public async analyzeDirectory(directoryPath: string): Promise<AnimationPerformanceResult[]> {
    // In a real implementation, this would scan the directory for components
    // and analyze each one. For this implementation, we'll return a mock result.
    
    // Mock components for demonstration
    const componentIds = [
      'Button', 
      'Carousel', 
      'Dropdown', 
      'Modal',
      'TabPanel'
    ];
    
    const results: AnimationPerformanceResult[] = [];
    
    // Register mock animations for each component
    this.registerComponent('Button', [
      { name: 'hover', selector: '.button', type: 'hover', duration: 300 },
      { name: 'click', selector: '.button', type: 'click', duration: 200 }
    ]);
    
    this.registerComponent('Carousel', [
      { name: 'slide', selector: '.carousel', type: 'custom', duration: 500 }
    ]);
    
    this.registerComponent('Dropdown', [
      { name: 'open', selector: '.dropdown', type: 'click', duration: 300 }
    ]);
    
    this.registerComponent('Modal', [
      { name: 'open', selector: '.modal', type: 'custom', duration: 300 },
      { name: 'close', selector: '.modal', type: 'custom', duration: 300 }
    ]);
    
    this.registerComponent('TabPanel', [
      { name: 'switch', selector: '.tab-panel', type: 'click', duration: 250 }
    ]);
    
    // Analyze each component
    for (const componentId of componentIds) {
      const result = await this.analyzeComponent(componentId);
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Parse frame data from browser execution (used in real browser-based tracking)
   */
  private parseFrameData(rawData: string): FrameRateData {
    try {
      const data = JSON.parse(rawData);
      
      // Ensure expected structure
      if (!data.timestamps || !Array.isArray(data.timestamps)) {
        throw new Error('Invalid frame data format: missing timestamps array');
      }
      
      // Calculate deltas from timestamps
      const timestamps = data.timestamps as number[];
      const frameDeltas: number[] = [];
      
      for (let i = 1; i < timestamps.length; i++) {
        frameDeltas.push(timestamps[i] - timestamps[i - 1]);
      }
      
      // Calculate metrics
      const fpsValues = frameDeltas.map(delta => 1000 / delta);
      const averageFps = fpsValues.reduce((sum, fps) => sum + fps, 0) / fpsValues.length || 0;
      const minFps = fpsValues.length ? Math.min(...fpsValues) : 0;
      const maxFps = fpsValues.length ? Math.max(...fpsValues) : 0;
      
      // Count drops
      const idealFrameTime = 1000 / (this.config.targetFrameRate || 60);
      const dropCount = frameDeltas.filter(delta => delta > idealFrameTime * 1.5).length;
      
      // Calculate duration
      const duration = timestamps.length > 1 
        ? timestamps[timestamps.length - 1] - timestamps[0] 
        : 0;
      
      return {
        averageFps,
        minFps,
        maxFps,
        dropCount,
        duration,
        timestamps,
        frameDeltas
      };
    } catch (error) {
      console.error('Error parsing frame data:', error);
      
      // Return default values
      return {
        averageFps: 0,
        minFps: 0,
        maxFps: 0,
        dropCount: 0,
        duration: 0,
        timestamps: [],
        frameDeltas: []
      };
    }
  }
  
  /**
   * Frame tracking script that would be injected into the browser
   * in a real browser-based implementation
   */
  private getFrameTrackingScript(duration: number): string {
    return `
      // Track frame timestamps
      const timestamps = [];
      const startTime = performance.now();
      let running = true;
      
      // Tracking function using requestAnimationFrame
      function trackFrame(timestamp) {
        if (!running) return;
        
        timestamps.push(timestamp);
        
        // Check if we've reached the duration
        if (timestamp - startTime >= ${duration}) {
          running = false;
          // Report results back
          window.__ANIMATION_PERFORMANCE_RESULTS__ = {
            timestamps: timestamps
          };
        } else {
          requestAnimationFrame(trackFrame);
        }
      }
      
      // Start tracking
      requestAnimationFrame(trackFrame);
    `;
  }
} 