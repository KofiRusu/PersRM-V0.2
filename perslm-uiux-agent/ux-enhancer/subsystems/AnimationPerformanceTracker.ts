import fs from 'fs/promises';
import path from 'path';
import { SeverityLevel } from '../types';

export interface AnimationPerformanceResult {
  score: number;
  maxScore: number;
  issues: AnimationIssue[];
  metrics: {
    avgFrameRate: number;
    frameDrops: number;
    animationDuration: number;
    powerEfficiency: number;
    complexAnimations: number;
  };
  animations: Animation[];
}

export interface AnimationIssue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  animation?: string;
  recommendations: string[];
}

export interface Animation {
  id: string;
  type: string;
  selector: string;
  duration: number;
  fps: number;
  frameDrops: number;
  properties: string[];
  gpuAccelerated: boolean;
  complexity: 'low' | 'medium' | 'high';
}

export interface FrameData {
  timestamp: number;
  frameDuration: number;
  fps: number;
}

export class AnimationPerformanceTracker {
  private outputDir: string = '.tmp/ux-results/animation';
  
  constructor() {
    this.ensureOutputDir();
  }
  
  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(path.resolve(this.outputDir), { recursive: true });
    } catch (error) {
      console.error('Failed to create output directory:', error);
    }
  }
  
  /**
   * Track frame rate of animations
   * @param componentHtml The HTML markup of the component
   * @param componentCss The CSS for the component
   * @param componentJs The JavaScript for the component
   * @param componentId Unique identifier for the component
   */
  async trackFrameRate(
    componentHtml: string,
    componentCss: string,
    componentJs: string,
    componentId: string
  ): Promise<FrameData[]> {
    try {
      // This would typically use a headless browser to run the component
      // and measure actual frame rates during animations.
      // For this implementation, we'll simulate frame data based on the
      // animation complexity detected in the CSS and JS.
      
      // Extract animations from CSS
      const cssAnimations = this.extractCssAnimations(componentCss);
      
      // Extract animations from JS
      const jsAnimations = this.extractJsAnimations(componentJs);
      
      // Simulate frame data for each animation
      const frameData: FrameData[] = [];
      const allAnimations = [...cssAnimations, ...jsAnimations];
      
      for (const animation of allAnimations) {
        // Calculate typical FPS for this animation type
        const baseFps = this.getBaseFrameRate(animation);
        // Adjust for complexity
        const adjustedFps = this.adjustForComplexity(baseFps, animation);
        
        // Generate frame data for this animation
        const animationFrames = this.simulateFrameData(
          animation.duration,
          adjustedFps,
          animation.complexity
        );
        
        frameData.push(...animationFrames);
      }
      
      // Save frame data to file
      const frameDataPath = path.join(this.outputDir, `${componentId}-frame-data.json`);
      await fs.writeFile(
        path.resolve(frameDataPath),
        JSON.stringify(frameData, null, 2)
      );
      
      return frameData;
    } catch (error) {
      console.error('Frame rate tracking failed:', error);
      return [];
    }
  }
  
  /**
   * Analyze animation performance
   * @param componentHtml The HTML markup of the component
   * @param componentCss The CSS for the component
   * @param componentJs The JavaScript for the component
   * @param componentId Unique identifier for the component
   */
  async analyzeAnimationPerformance(
    componentHtml: string,
    componentCss: string,
    componentJs: string,
    componentId: string
  ): Promise<AnimationPerformanceResult> {
    try {
      // Extract animations
      const cssAnimations = this.extractCssAnimations(componentCss);
      const jsAnimations = this.extractJsAnimations(componentJs);
      const allAnimations = [...cssAnimations, ...jsAnimations];
      
      // If no animations found, return a perfect score
      if (allAnimations.length === 0) {
        return {
          score: 100,
          maxScore: 100,
          issues: [],
          metrics: {
            avgFrameRate: 60,
            frameDrops: 0,
            animationDuration: 0,
            powerEfficiency: 100,
            complexAnimations: 0
          },
          animations: []
        };
      }
      
      // Track frame rate
      const frameData = await this.trackFrameRate(
        componentHtml,
        componentCss,
        componentJs,
        componentId
      );
      
      // Calculate metrics
      const avgFrameRate = this.calculateAverageFrameRate(frameData);
      const frameDrops = this.calculateFrameDrops(frameData);
      const totalAnimationDuration = allAnimations.reduce((sum, anim) => sum + anim.duration, 0);
      const powerEfficiency = this.calculatePowerEfficiency(allAnimations);
      const complexAnimations = allAnimations.filter(anim => anim.complexity === 'high').length;
      
      // Generate issues
      const issues = this.generateIssues(allAnimations, frameData, componentId);
      
      // Calculate score (0-100)
      // 40% frame rate, 20% power efficiency, 20% duration, 20% complexity
      const frameRateScore = Math.min(100, (avgFrameRate / 60) * 100);
      const powerScore = powerEfficiency;
      const durationScore = Math.max(0, 100 - (totalAnimationDuration / 10) * 5); // Penalize animations longer than 2s
      const complexityScore = Math.max(0, 100 - (complexAnimations / allAnimations.length) * 100);
      
      const score = Math.round(
        (frameRateScore * 0.4) +
        (powerScore * 0.2) +
        (durationScore * 0.2) +
        (complexityScore * 0.2)
      );
      
      const result: AnimationPerformanceResult = {
        score: Math.min(100, score),
        maxScore: 100,
        issues,
        metrics: {
          avgFrameRate,
          frameDrops,
          animationDuration: totalAnimationDuration,
          powerEfficiency,
          complexAnimations
        },
        animations: allAnimations
      };
      
      // Save analysis results
      const resultsPath = path.join(this.outputDir, `${componentId}-analysis.json`);
      await fs.writeFile(
        path.resolve(resultsPath),
        JSON.stringify(result, null, 2)
      );
      
      return result;
    } catch (error) {
      console.error('Animation performance analysis failed:', error);
      
      // Return a failure result
      return {
        score: 0,
        maxScore: 100,
        issues: [{
          id: `${componentId}-animation-error`,
          title: 'Animation performance analysis failed',
          description: `Error: ${error instanceof Error ? error.message : String(error)}`,
          severity: SeverityLevel.ERROR,
          recommendations: [
            'Check if the component renders correctly',
            'Verify that the component CSS and JavaScript are valid'
          ]
        }],
        metrics: {
          avgFrameRate: 0,
          frameDrops: 0,
          animationDuration: 0,
          powerEfficiency: 0,
          complexAnimations: 0
        },
        animations: []
      };
    }
  }
  
  /**
   * Extract CSS animations and transitions
   */
  private extractCssAnimations(css: string): Animation[] {
    const animations: Animation[] = [];
    
    // Match @keyframes definitions
    const keyframesPattern = /@keyframes\s+([^\s{]+)\s*{([^}]*)}/g;
    const keyframes: Record<string, string> = {};
    
    let match;
    while ((match = keyframesPattern.exec(css)) !== null) {
      const name = match[1];
      const content = match[2];
      keyframes[name] = content;
    }
    
    // Match animation properties
    const animationPattern = /animation(?:-duration)?\s*:\s*([^;]+)/gi;
    while ((match = animationPattern.exec(css)) !== null) {
      const value = match[1].trim();
      // Parse animation value to get name and duration
      const parts = value.split(/\s+/);
      
      // Look for animation name (not a time value)
      const nameIndex = parts.findIndex(part => !part.includes('ms') && !part.includes('s') && isNaN(parseFloat(part)));
      const name = nameIndex >= 0 ? parts[nameIndex] : 'unknown';
      
      // Look for duration
      const durationIndex = parts.findIndex(part => part.includes('ms') || part.includes('s'));
      let duration = 300; // Default duration if not specified
      if (durationIndex >= 0) {
        const durationStr = parts[durationIndex];
        if (durationStr.includes('ms')) {
          duration = parseFloat(durationStr);
        } else if (durationStr.includes('s')) {
          duration = parseFloat(durationStr) * 1000;
        }
      }
      
      // Check if animation uses keyframes defined in the CSS
      const hasKeyframes = keyframes[name] !== undefined;
      
      // Parse the keyframes to determine properties being animated
      const properties: string[] = [];
      if (hasKeyframes) {
        const propertyPattern = /\b(transform|opacity|color|background|width|height|top|left|right|bottom|margin|padding)\b/g;
        const keyframeContent = keyframes[name];
        let propertyMatch;
        while ((propertyMatch = propertyPattern.exec(keyframeContent)) !== null) {
          if (!properties.includes(propertyMatch[1])) {
            properties.push(propertyMatch[1]);
          }
        }
      }
      
      // Determine if GPU accelerated
      const gpuAccelerated = properties.includes('transform') || properties.includes('opacity');
      
      // Determine complexity
      let complexity: 'low' | 'medium' | 'high' = 'low';
      if (properties.length > 5) {
        complexity = 'high';
      } else if (properties.length > 2) {
        complexity = 'medium';
      }
      
      // Create animation object
      const animation: Animation = {
        id: `css-animation-${animations.length + 1}`,
        type: 'css-animation',
        selector: 'unknown', // Would need to parse selectors for real implementation
        duration,
        fps: gpuAccelerated ? 60 : 50, // Estimate based on acceleration
        frameDrops: complexity === 'high' ? 5 : (complexity === 'medium' ? 2 : 0),
        properties,
        gpuAccelerated,
        complexity
      };
      
      animations.push(animation);
    }
    
    // Match transition properties
    const transitionPattern = /transition(?:-duration)?\s*:\s*([^;]+)/gi;
    while ((match = transitionPattern.exec(css)) !== null) {
      const value = match[1].trim();
      // Parse transition value to get property and duration
      const parts = value.split(/\s+/);
      
      // Look for property
      const propertyIndex = parts.findIndex(part => 
        part !== 'ease' && part !== 'linear' && part !== 'ease-in' && 
        part !== 'ease-out' && part !== 'ease-in-out' && 
        !part.includes('ms') && !part.includes('s')
      );
      
      const property = propertyIndex >= 0 ? parts[propertyIndex] : 'all';
      
      // Look for duration
      const durationIndex = parts.findIndex(part => part.includes('ms') || part.includes('s'));
      let duration = 300; // Default duration if not specified
      if (durationIndex >= 0) {
        const durationStr = parts[durationIndex];
        if (durationStr.includes('ms')) {
          duration = parseFloat(durationStr);
        } else if (durationStr.includes('s')) {
          duration = parseFloat(durationStr) * 1000;
        }
      }
      
      // Determine if GPU accelerated
      const gpuAccelerated = property === 'transform' || property === 'opacity';
      
      // Determine complexity
      let complexity: 'low' | 'medium' | 'high' = 'low';
      if (property === 'all') {
        complexity = 'high';
      } else if (property === 'transform' || property.includes('box-shadow')) {
        complexity = 'medium';
      }
      
      // Create animation object
      const animation: Animation = {
        id: `css-transition-${animations.length + 1}`,
        type: 'css-transition',
        selector: 'unknown', // Would need to parse selectors for real implementation
        duration,
        fps: gpuAccelerated ? 60 : 50, // Estimate based on acceleration
        frameDrops: complexity === 'high' ? 4 : (complexity === 'medium' ? 1 : 0),
        properties: [property],
        gpuAccelerated,
        complexity
      };
      
      animations.push(animation);
    }
    
    return animations;
  }
  
  /**
   * Extract JavaScript animations
   */
  private extractJsAnimations(js: string): Animation[] {
    const animations: Animation[] = [];
    
    // Look for common animation APIs
    const animationAPIs = [
      // Animation patterns
      { pattern: /requestAnimationFrame/g, type: 'requestAnimationFrame', complexity: 'high', duration: 500 },
      { pattern: /anime\(/g, type: 'anime.js', complexity: 'medium', duration: 400 },
      { pattern: /gsap\.to/g, type: 'gsap', complexity: 'medium', duration: 400 },
      { pattern: /\$\(.*\)\.animate/g, type: 'jquery', complexity: 'medium', duration: 300 },
      { pattern: /new Animation/g, type: 'web-animations-api', complexity: 'medium', duration: 350 },
      { pattern: /createAnimation/g, type: 'framer-motion', complexity: 'low', duration: 250 },
      { pattern: /\.transition/g, type: 'transition', complexity: 'low', duration: 200 },
      { pattern: /\.spring/g, type: 'spring', complexity: 'medium', duration: 300 }
    ];
    
    for (const api of animationAPIs) {
      const matches = js.match(api.pattern);
      if (matches && matches.length > 0) {
        // For each match, create an animation object
        for (let i = 0; i < matches.length; i++) {
          // Estimate properties based on common patterns
          const transformPattern = /transform|translate|rotate|scale/g;
          const opacityPattern = /opacity/g;
          const colorPattern = /color|background/g;
          
          const properties: string[] = [];
          if (js.match(transformPattern)) properties.push('transform');
          if (js.match(opacityPattern)) properties.push('opacity');
          if (js.match(colorPattern)) properties.push('color');
          
          // If no specific properties found, assume generic
          if (properties.length === 0) {
            properties.push('mixed');
          }
          
          // Determine if GPU accelerated
          const gpuAccelerated = properties.includes('transform') || properties.includes('opacity');
          
          const animation: Animation = {
            id: `js-animation-${animations.length + 1}`,
            type: api.type,
            selector: 'unknown', // Would need deeper parsing for real implementation
            duration: api.duration,
            fps: api.complexity === 'high' ? 45 : (api.complexity === 'medium' ? 55 : 60),
            frameDrops: api.complexity === 'high' ? 8 : (api.complexity === 'medium' ? 3 : 0),
            properties,
            gpuAccelerated,
            complexity: api.complexity as 'low' | 'medium' | 'high'
          };
          
          animations.push(animation);
        }
      }
    }
    
    return animations;
  }
  
  /**
   * Get base frame rate for animation type
   */
  private getBaseFrameRate(animation: Animation): number {
    switch (animation.type) {
      case 'requestAnimationFrame':
        return 55; // Potentially optimized but often complex
      case 'gsap':
      case 'framer-motion':
        return 58; // Well optimized libraries
      case 'jquery':
        return 45; // Often less optimized
      case 'css-animation':
      case 'css-transition':
        return animation.gpuAccelerated ? 60 : 50;
      default:
        return 50;
    }
  }
  
  /**
   * Adjust frame rate based on animation complexity
   */
  private adjustForComplexity(baseFps: number, animation: Animation): number {
    switch (animation.complexity) {
      case 'high':
        return Math.max(30, baseFps - 15);
      case 'medium':
        return Math.max(40, baseFps - 5);
      case 'low':
        return baseFps;
      default:
        return baseFps;
    }
  }
  
  /**
   * Simulate frame data for an animation
   */
  private simulateFrameData(
    duration: number,
    targetFps: number,
    complexity: 'low' | 'medium' | 'high'
  ): FrameData[] {
    const frameData: FrameData[] = [];
    const totalFrames = Math.ceil(duration / (1000 / 60)); // At 60 fps
    
    // Calculate expected frame time in ms
    const expectedFrameTime = 1000 / targetFps;
    
    // Add variability based on complexity
    const variabilityFactor = 
      complexity === 'high' ? 0.4 :
      complexity === 'medium' ? 0.2 : 0.1;
    
    let currentTime = 0;
    for (let i = 0; i < totalFrames; i++) {
      // Add some random variation to frame time
      const variation = (Math.random() * 2 - 1) * expectedFrameTime * variabilityFactor;
      const frameDuration = expectedFrameTime + variation;
      
      // Occasionally add a frame drop for high complexity animations
      const frameDropProbability = 
        complexity === 'high' ? 0.15 :
        complexity === 'medium' ? 0.05 : 0.01;
      
      if (Math.random() < frameDropProbability) {
        // Simulate a frame drop by doubling the frame time
        currentTime += frameDuration * 2;
        frameData.push({
          timestamp: currentTime,
          frameDuration: frameDuration * 2,
          fps: 1000 / (frameDuration * 2)
        });
      } else {
        currentTime += frameDuration;
        frameData.push({
          timestamp: currentTime,
          frameDuration,
          fps: 1000 / frameDuration
        });
      }
    }
    
    return frameData;
  }
  
  /**
   * Calculate average frame rate from frame data
   */
  private calculateAverageFrameRate(frameData: FrameData[]): number {
    if (frameData.length === 0) {
      return 60; // Default to 60 fps if no data
    }
    
    const totalFps = frameData.reduce((sum, frame) => sum + frame.fps, 0);
    return Math.round(totalFps / frameData.length);
  }
  
  /**
   * Calculate frame drops from frame data
   */
  private calculateFrameDrops(frameData: FrameData[]): number {
    // Count frames with fps < 30 as dropped
    return frameData.filter(frame => frame.fps < 30).length;
  }
  
  /**
   * Calculate power efficiency score (0-100)
   */
  private calculatePowerEfficiency(animations: Animation[]): number {
    if (animations.length === 0) {
      return 100;
    }
    
    // Factors that affect power efficiency:
    // 1. GPU acceleration (good)
    // 2. Animation complexity (bad)
    // 3. Animation duration (longer = worse)
    
    // Calculate percentage of GPU accelerated animations
    const gpuAcceleratedCount = animations.filter(anim => anim.gpuAccelerated).length;
    const gpuAcceleratedPercent = (gpuAcceleratedCount / animations.length) * 100;
    
    // Calculate complexity score (0-100, lower is better)
    const complexityScores = {
      'high': 100,
      'medium': 50,
      'low': 0
    };
    
    const avgComplexity = animations.reduce((sum, anim) => {
      return sum + complexityScores[anim.complexity];
    }, 0) / animations.length;
    
    // Calculate duration penalty (longer animations use more power)
    const totalDuration = animations.reduce((sum, anim) => sum + anim.duration, 0);
    const avgDuration = totalDuration / animations.length;
    const durationPenalty = Math.min(50, Math.floor(avgDuration / 100)); // Up to 50% penalty for long animations
    
    // Calculate final power efficiency score
    // 50% from GPU acceleration, 30% from complexity, 20% from duration
    const powerEfficiency = Math.round(
      (gpuAcceleratedPercent * 0.5) +
      ((100 - avgComplexity) * 0.3) +
      ((100 - durationPenalty) * 0.2)
    );
    
    return Math.min(100, Math.max(0, powerEfficiency));
  }
  
  /**
   * Generate issues based on animation analysis
   */
  private generateIssues(
    animations: Animation[],
    frameData: FrameData[],
    componentId: string
  ): AnimationIssue[] {
    const issues: AnimationIssue[] = [];
    
    // Check for low frame rate
    const avgFrameRate = this.calculateAverageFrameRate(frameData);
    if (avgFrameRate < 45) {
      issues.push({
        id: `${componentId}-animation-framerate`,
        title: 'Low frame rate',
        description: `The average frame rate of ${avgFrameRate} fps may result in jerky animations.`,
        severity: avgFrameRate < 30 ? SeverityLevel.HIGH : SeverityLevel.MEDIUM,
        recommendations: [
          'Reduce animation complexity',
          'Use GPU-accelerated properties (transform, opacity)',
          'Avoid animating layout properties (width, height, padding, etc.)'
        ]
      });
    }
    
    // Check for frame drops
    const frameDrops = this.calculateFrameDrops(frameData);
    if (frameDrops > 5) {
      issues.push({
        id: `${componentId}-animation-drops`,
        title: 'Significant frame drops',
        description: `Detected ${frameDrops} frame drops which may cause animation stuttering.`,
        severity: frameDrops > 10 ? SeverityLevel.HIGH : SeverityLevel.MEDIUM,
        recommendations: [
          'Simplify animations during high-activity periods',
          'Avoid simultaneous animations of multiple elements',
          'Consider using CSS animations instead of JavaScript for simple cases'
        ]
      });
    }
    
    // Check for non-GPU accelerated animations
    const nonGpuAnimations = animations.filter(anim => !anim.gpuAccelerated);
    if (nonGpuAnimations.length > 0) {
      issues.push({
        id: `${componentId}-animation-non-gpu`,
        title: 'Non-GPU accelerated animations',
        description: `${nonGpuAnimations.length} animation(s) are not using GPU acceleration.`,
        severity: nonGpuAnimations.length > 2 ? SeverityLevel.MEDIUM : SeverityLevel.LOW,
        recommendations: [
          'Use transform and opacity for animations',
          'Avoid animating layout properties directly',
          'Add will-change: transform for critical animations'
        ]
      });
    }
    
    // Check for excessively long animations
    const longAnimations = animations.filter(anim => anim.duration > 1000);
    if (longAnimations.length > 0) {
      issues.push({
        id: `${componentId}-animation-duration`,
        title: 'Excessively long animations',
        description: `${longAnimations.length} animation(s) have a duration exceeding 1 second.`,
        severity: SeverityLevel.LOW,
        recommendations: [
          'Keep animations under 300-500ms for best user experience',
          'Use shorter animations for frequently used UI elements',
          'Consider reducing animation duration for better perceived performance'
        ]
      });
    }
    
    // Check for power efficiency
    const powerEfficiency = this.calculatePowerEfficiency(animations);
    if (powerEfficiency < 70) {
      issues.push({
        id: `${componentId}-animation-power`,
        title: 'Poor power efficiency',
        description: 'Animations may cause excessive battery drain on mobile devices.',
        severity: powerEfficiency < 50 ? SeverityLevel.MEDIUM : SeverityLevel.LOW,
        recommendations: [
          'Use CSS animations instead of JavaScript when possible',
          'Reduce animation complexity and duration',
          'Respect prefers-reduced-motion media query',
          'Consider disabling non-essential animations on low-power mode'
        ]
      });
    }
    
    return issues;
  }
}

export default AnimationPerformanceTracker; 