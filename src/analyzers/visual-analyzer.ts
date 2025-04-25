import puppeteer from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PhaseType, SeverityLevel } from '../lib/persrm/types';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

interface ViewportConfig {
  width: number;
  height: number;
}

interface ComponentConfig {
  name: string;
  selector: string;
  states: string[];
  route?: string;
}

export interface VisualAnalyzerConfig {
  screenshotDir?: string;
  baselineDir?: string;
  compareWithBaseline?: boolean;
  viewport?: ViewportConfig;
  baseUrl?: string;
  components?: ComponentConfig[];
  threshold?: number;
  verbose?: boolean;
}

export interface Screenshot {
  componentName: string;
  state: string;
  path: string;
  timestamp: string;
}

export interface VisualDifference {
  state: string;
  diffCount: number;
  diffPercentage: number;
  diffImagePath: string;
}

export interface ColorInfo {
  hex: string;
  count: number;
  percentage?: number;
}

export interface ColorGroup {
  name: string;
  colors: string[];
  mainColor?: string;
}

export interface ColorInconsistency {
  type: 'similar-colors' | 'too-many-colors' | 'non-token-color';
  colors: string[];
  recommendation: string;
}

export interface ColorAnalysisResult {
  colorGroups: ColorGroup[];
  inconsistencies: ColorInconsistency[];
}

export interface ContrastIssue {
  element: string;
  ratio: number;
  requiredRatio: number;
  foregroundColor: string;
  backgroundColor: string;
}

export interface AccessibilityResult {
  contrastIssues: ContrastIssue[];
}

export interface ComparisonResult {
  hasDifferences: boolean;
  differences: VisualDifference[];
}

export interface VisualAnalysisResult {
  componentName: string;
  screenshots: string[];
  duration: number;
}

export interface VisualIssue {
  id: string;
  type: 'visual-difference' | 'color-inconsistency' | 'contrast-issue';
  description: string;
  severity: SeverityLevel;
  impact: string;
  recommendation: string;
  visualEvidence?: string; // Path to diff image or screenshot
}

export interface VisualAnalysisReport {
  id: string;
  componentName: string;
  timestamp: string;
  duration: number;
  score: number;
  maxScore: number;
  visualIssues: VisualIssue[];
  recommendations: string[];
  screenshots: Screenshot[];
  diffImages: string[];
  phases: { phase: PhaseType; score: number; maxScore: number }[];
}

export class VisualAnalyzer {
  private config: VisualAnalyzerConfig;
  
  constructor(config: VisualAnalyzerConfig = {}) {
    this.config = {
      screenshotDir: './screenshots',
      baselineDir: './baselines',
      compareWithBaseline: true,
      viewport: { width: 1280, height: 800 },
      baseUrl: 'http://localhost:3000',
      threshold: 0.1, // 10% threshold for pixel differences
      verbose: false,
      ...config
    };
    
    // Ensure screenshot directories exist
    fs.ensureDirSync(this.config.screenshotDir);
    fs.ensureDirSync(this.config.baselineDir);
  }
  
  /**
   * Capture screenshots of a component in different states
   */
  public async analyze(componentName: string): Promise<VisualAnalysisResult> {
    const startTime = Date.now();
    const componentConfig = this.findComponentConfig(componentName);
    
    if (!componentConfig) {
      throw new Error(`Component ${componentName} not found in configuration`);
    }
    
    if (this.config.verbose) {
      console.log(`Analyzing component: ${componentName}`);
    }
    
    const screenshotPaths: string[] = [];
    
    const browser = await puppeteer.launch({
      headless: true
    });
    
    try {
      const page = await browser.newPage();
      
      // Set viewport
      await page.setViewport(this.config.viewport);
      
      // Navigate to the page
      const url = this.getComponentUrl(componentConfig);
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      // Capture screenshots for each state
      for (const state of componentConfig.states) {
        if (this.config.verbose) {
          console.log(`Capturing ${componentName} in state: ${state}`);
        }
        
        // Apply state (e.g., hover, focus, etc.)
        if (state !== 'default') {
          await this.applyState(page, componentConfig.selector, state);
        }
        
        // Take screenshot
        const screenshotPath = this.getScreenshotPath(componentName, state);
        const screenshot = await page.screenshot({
          path: screenshotPath,
          fullPage: false
        });
        
        // Store screenshot path
        screenshotPaths.push(screenshotPath);
        
        // Revert state if needed
        if (state !== 'default') {
          await this.revertState(page, componentConfig.selector, state);
        }
      }
    } finally {
      await browser.close();
    }
    
    const duration = Date.now() - startTime;
    
    return {
      componentName,
      screenshots: screenshotPaths,
      duration
    };
  }
  
  /**
   * Compare current screenshots with baseline
   */
  public async compareWithBaseline(componentName: string): Promise<ComparisonResult> {
    const componentConfig = this.findComponentConfig(componentName);
    
    if (!componentConfig) {
      throw new Error(`Component ${componentName} not found in configuration`);
    }
    
    const differences: VisualDifference[] = [];
    
    for (const state of componentConfig.states) {
      const currentPath = this.getScreenshotPath(componentName, state);
      const baselinePath = this.getBaselinePath(componentName, state);
      
      // Skip if baseline doesn't exist
      if (!fs.existsSync(baselinePath)) {
        if (this.config.verbose) {
          console.log(`No baseline found for ${componentName} in state: ${state}`);
        }
        continue;
      }
      
      // Compare images
      const diffResult = await this.compareImages(currentPath, baselinePath, componentName, state);
      
      // If differences are above threshold, add to results
      if (diffResult.diffPercentage > (this.config.threshold || 0)) {
        differences.push({
          state,
          diffCount: diffResult.diffCount,
          diffPercentage: diffResult.diffPercentage,
          diffImagePath: diffResult.diffImagePath
        });
      }
    }
    
    return {
      hasDifferences: differences.length > 0,
      differences
    };
  }
  
  /**
   * Compare two images pixel by pixel
   */
  public async compareImages(
    img1Path: string, 
    img2Path: string, 
    componentName: string,
    state: string
  ): Promise<{ diffCount: number; diffPercentage: number; diffImagePath: string }> {
    // Read images
    const img1 = PNG.sync.read(fs.readFileSync(img1Path));
    const img2 = PNG.sync.read(fs.readFileSync(img2Path));
    
    // Create output image
    const { width, height } = img1;
    const diff = new PNG({ width, height });
    
    // Compare pixel by pixel
    const diffCount = pixelmatch(
      img1.data, 
      img2.data, 
      diff.data, 
      width, 
      height, 
      { threshold: 0.1 }
    );
    
    // Calculate difference percentage
    const totalPixels = width * height;
    const diffPercentage = diffCount / totalPixels;
    
    // Write diff image
    const diffImagePath = this.getDiffImagePath(componentName, state);
    fs.writeFileSync(diffImagePath, PNG.sync.write(diff));
    
    return {
      diffCount,
      diffPercentage,
      diffImagePath
    };
  }
  
  /**
   * Analyze color consistency in a component's screenshots
   */
  public async analyzeColorConsistency(componentName: string): Promise<ColorAnalysisResult> {
    const componentConfig = this.findComponentConfig(componentName);
    
    if (!componentConfig) {
      throw new Error(`Component ${componentName} not found in configuration`);
    }
    
    // Get paths to screenshots
    const screenshotPath = this.getScreenshotPath(componentName, 'default');
    
    // Extract colors
    const colors = await this.extractColors(screenshotPath);
    
    // Group similar colors
    const colorGroups = this.groupSimilarColors(colors);
    
    // Find inconsistencies
    const inconsistencies = this.findColorInconsistencies(colorGroups, colors);
    
    return {
      colorGroups,
      inconsistencies
    };
  }
  
  /**
   * Extract dominant colors from an image
   */
  public async extractColors(imagePath: string): Promise<ColorInfo[]> {
    // This is a simplified implementation
    // In a real version, you would use a more sophisticated color extraction algorithm
    // or a library like node-vibrant or color-thief
    
    // Mock implementation for testing
    const mockColors = [
      { hex: '#3366CC', count: 120 },
      { hex: '#3367CD', count: 118 },
      { hex: '#FF5733', count: 85 },
      { hex: '#C70039', count: 45 },
      { hex: '#11FF33', count: 30 }
    ];
    
    // Calculate percentages
    const totalCount = mockColors.reduce((sum, color) => sum + color.count, 0);
    
    return mockColors.map(color => ({
      ...color,
      percentage: (color.count / totalCount) * 100
    }));
  }
  
  /**
   * Group similar colors together
   */
  private groupSimilarColors(colors: ColorInfo[]): ColorGroup[] {
    // Simplified implementation - group by color family
    const groups: ColorGroup[] = [];
    
    // Extract red, green, blue color groups
    const redColors = colors.filter(c => this.isRedish(c.hex));
    const greenColors = colors.filter(c => this.isGreenish(c.hex));
    const blueColors = colors.filter(c => this.isBluish(c.hex));
    
    if (redColors.length > 0) {
      groups.push({
        name: 'reds',
        colors: redColors.map(c => c.hex),
        mainColor: this.findMainColor(redColors)
      });
    }
    
    if (greenColors.length > 0) {
      groups.push({
        name: 'greens',
        colors: greenColors.map(c => c.hex),
        mainColor: this.findMainColor(greenColors)
      });
    }
    
    if (blueColors.length > 0) {
      groups.push({
        name: 'blues',
        colors: blueColors.map(c => c.hex),
        mainColor: this.findMainColor(blueColors)
      });
    }
    
    return groups;
  }
  
  /**
   * Check if a hex color is reddish
   */
  private isRedish(hex: string): boolean {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    
    return r > 1.5 * g && r > 1.5 * b;
  }
  
  /**
   * Check if a hex color is greenish
   */
  private isGreenish(hex: string): boolean {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    
    return g > 1.5 * r && g > 1.5 * b;
  }
  
  /**
   * Check if a hex color is bluish
   */
  private isBluish(hex: string): boolean {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    
    return b > 1.5 * r && b > 1.5 * g;
  }
  
  /**
   * Find the main color (most frequent) in a group
   */
  private findMainColor(colors: ColorInfo[]): string {
    if (colors.length === 0) return null;
    
    const sorted = [...colors].sort((a, b) => b.count - a.count);
    return sorted[0].hex;
  }
  
  /**
   * Find color inconsistencies in the component
   */
  private findColorInconsistencies(
    colorGroups: ColorGroup[], 
    colors: ColorInfo[]
  ): ColorInconsistency[] {
    const inconsistencies: ColorInconsistency[] = [];
    
    // Find similar colors within the same group
    for (const group of colorGroups) {
      if (group.colors.length > 1) {
        // Sort by hex code to group similar colors
        const sortedColors = [...group.colors].sort();
        
        // Check for similar colors (too close to each other)
        for (let i = 0; i < sortedColors.length - 1; i++) {
          if (this.areColorsSimilar(sortedColors[i], sortedColors[i+1])) {
            inconsistencies.push({
              type: 'similar-colors',
              colors: [sortedColors[i], sortedColors[i+1]],
              recommendation: `Consolidate similar ${group.name} colors to improve consistency. Use ${group.mainColor} as the standard.`
            });
          }
        }
      }
    }
    
    // Check if there are too many colors (arbitrary threshold)
    if (colors.length > 8) {
      inconsistencies.push({
        type: 'too-many-colors',
        colors: colors.map(c => c.hex),
        recommendation: 'Reduce the number of unique colors for better visual consistency. Consider using a design token system.'
      });
    }
    
    return inconsistencies;
  }
  
  /**
   * Check if two colors are similar (within a threshold)
   */
  private areColorsSimilar(hex1: string, hex2: string): boolean {
    // Parse hex values
    const r1 = parseInt(hex1.substring(1, 3), 16);
    const g1 = parseInt(hex1.substring(3, 5), 16);
    const b1 = parseInt(hex1.substring(5, 7), 16);
    
    const r2 = parseInt(hex2.substring(1, 3), 16);
    const g2 = parseInt(hex2.substring(3, 5), 16);
    const b2 = parseInt(hex2.substring(5, 7), 16);
    
    // Calculate Euclidean distance in RGB space
    const distance = Math.sqrt(
      Math.pow(r1 - r2, 2) +
      Math.pow(g1 - g2, 2) +
      Math.pow(b1 - b2, 2)
    );
    
    // Consider similar if within threshold (range 0-441)
    return distance < 20; // Arbitrary threshold
  }
  
  /**
   * Check accessibility (contrast ratios, etc.)
   */
  public async checkAccessibility(componentName: string): Promise<AccessibilityResult> {
    // In a real implementation, this would use axe-core or similar
    // For this example, we'll use a mock implementation
    
    const mockContrastIssues: ContrastIssue[] = [
      {
        element: `.${componentName.toLowerCase()}-text`,
        ratio: 3.2,
        requiredRatio: 4.5,
        foregroundColor: '#777777',
        backgroundColor: '#EEEEEE'
      }
    ];
    
    return {
      contrastIssues: mockContrastIssues
    };
  }
  
  /**
   * Check contrast ratio between two colors
   * Formula: (L1 + 0.05) / (L2 + 0.05) where L1 is the lighter color and L2 is the darker one
   */
  public async checkContrastRatio(foreground: string, background: string): Promise<{
    passes: boolean;
    ratio: number;
    requiredRatio: number;
    foregroundColor: string;
    backgroundColor: string;
    element: string;
  }> {
    // Calculate relative luminance
    const fgLuminance = this.calculateLuminance(foreground);
    const bgLuminance = this.calculateLuminance(background);
    
    // Calculate contrast ratio
    const lighter = Math.max(fgLuminance, bgLuminance);
    const darker = Math.min(fgLuminance, bgLuminance);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    
    // WCAG AA requires 4.5:1 for normal text
    const requiredRatio = 4.5;
    
    return {
      passes: ratio >= requiredRatio,
      ratio,
      requiredRatio,
      foregroundColor: foreground,
      backgroundColor: background,
      element: 'unknown' // In a real implementation, this would be more specific
    };
  }
  
  /**
   * Calculate relative luminance of a color according to WCAG 2.0
   */
  private calculateLuminance(hex: string): number {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    
    // Calculate luminance according to WCAG formula
    const rLinear = r <= 0.03928 ? r / 12.92 : Math.pow((r + 0.055) / 1.055, 2.4);
    const gLinear = g <= 0.03928 ? g / 12.92 : Math.pow((g + 0.055) / 1.055, 2.4);
    const bLinear = b <= 0.03928 ? b / 12.92 : Math.pow((b + 0.055) / 1.055, 2.4);
    
    return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
  }
  
  /**
   * Generate a comprehensive visual analysis report
   */
  public async generateReport(componentName: string): Promise<VisualAnalysisReport> {
    const startTime = Date.now();
    
    // Run all analyses
    const analysisResult = await this.analyze(componentName);
    const comparisonResult = this.config.compareWithBaseline ? 
      await this.compareWithBaseline(componentName) : 
      { hasDifferences: false, differences: [] };
    const colorAnalysis = await this.analyzeColorConsistency(componentName);
    const accessibilityResult = await this.checkAccessibility(componentName);
    
    // Collect issues
    const visualIssues: VisualIssue[] = [];
    
    // Add visual difference issues
    for (const diff of comparisonResult.differences) {
      visualIssues.push({
        id: uuidv4(),
        type: 'visual-difference',
        description: `Visual difference detected in ${componentName} (${diff.state} state)`,
        severity: diff.diffPercentage > 0.3 ? SeverityLevel.ERROR : SeverityLevel.WARNING,
        impact: diff.diffPercentage > 0.3 ? 'High' : 'Medium',
        recommendation: 'Review recent changes to ensure they were intentional',
        visualEvidence: diff.diffImagePath
      });
    }
    
    // Add color inconsistency issues
    for (const inconsistency of colorAnalysis.inconsistencies) {
      visualIssues.push({
        id: uuidv4(),
        type: 'color-inconsistency',
        description: `Color inconsistency: ${inconsistency.type}`,
        severity: SeverityLevel.WARNING,
        impact: 'Medium',
        recommendation: inconsistency.recommendation
      });
    }
    
    // Add contrast issues
    for (const issue of accessibilityResult.contrastIssues) {
      visualIssues.push({
        id: uuidv4(),
        type: 'contrast-issue',
        description: `Contrast ratio (${issue.ratio.toFixed(2)}:1) below required (${issue.requiredRatio}:1)`,
        severity: SeverityLevel.ERROR,
        impact: 'High',
        recommendation: 'Increase contrast between foreground and background colors to meet WCAG AA standards'
      });
    }
    
    // Calculate score based on issues
    let score = 100;
    
    // Deduct points for each issue based on severity
    for (const issue of visualIssues) {
      if (issue.severity === SeverityLevel.CRITICAL) {
        score -= 20;
      } else if (issue.severity === SeverityLevel.ERROR) {
        score -= 15;
      } else if (issue.severity === SeverityLevel.WARNING) {
        score -= 10;
      } else {
        score -= 5;
      }
    }
    
    // Ensure score doesn't go below 0
    score = Math.max(0, score);
    
    // Generate recommendations
    const recommendations = [...new Set(visualIssues.map(issue => issue.recommendation))];
    
    // Collect screenshots
    const screenshots: Screenshot[] = analysisResult.screenshots.map(path => {
      const fileName = path.split('/').pop();
      const [component, state] = fileName.split('-');
      
      return {
        componentName,
        state: state.replace('.png', ''),
        path,
        timestamp: new Date().toISOString()
      };
    });
    
    // Collect diff images
    const diffImages = comparisonResult.differences.map(diff => diff.diffImagePath);
    
    // Create phase scores
    const phaseScores = [
      {
        phase: PhaseType.VISUAL_CONSISTENCY,
        score: 100 - (colorAnalysis.inconsistencies.length * 10),
        maxScore: 100
      },
      {
        phase: PhaseType.ACCESSIBILITY,
        score: 100 - (accessibilityResult.contrastIssues.length * 20),
        maxScore: 100
      }
    ];
    
    const duration = Date.now() - startTime;
    
    return {
      id: uuidv4(),
      componentName,
      timestamp: new Date().toISOString(),
      duration,
      score,
      maxScore: 100,
      visualIssues,
      recommendations,
      screenshots,
      diffImages,
      phases: phaseScores
    };
  }
  
  /**
   * Find component configuration by name
   */
  private findComponentConfig(componentName: string): ComponentConfig | undefined {
    return this.config.components?.find(c => c.name === componentName);
  }
  
  /**
   * Get URL for a component
   */
  private getComponentUrl(component: ComponentConfig): string {
    if (component.route) {
      return `${this.config.baseUrl}${component.route}`;
    }
    
    // Default to a route based on component name
    return `${this.config.baseUrl}/components/${component.name.toLowerCase()}`;
  }
  
  /**
   * Get path for a screenshot
   */
  private getScreenshotPath(componentName: string, state: string): string {
    return path.join(this.config.screenshotDir, `${componentName}-${state}.png`);
  }
  
  /**
   * Get path for a baseline screenshot
   */
  private getBaselinePath(componentName: string, state: string): string {
    return path.join(this.config.baselineDir, `${componentName}-${state}.png`);
  }
  
  /**
   * Get path for a diff image
   */
  private getDiffImagePath(componentName: string, state: string): string {
    return path.join(this.config.screenshotDir, `${componentName}-${state}-diff.png`);
  }
  
  /**
   * Apply a state to a component (e.g., hover, focus)
   */
  private async applyState(page: any, selector: string, state: string): Promise<void> {
    switch (state) {
      case 'hover':
        await page.hover(selector);
        break;
      case 'focus':
        await page.focus(selector);
        break;
      case 'active':
        await page.hover(selector);
        await page.mouse.down();
        break;
      case 'disabled':
        // Nothing to do as disabled is usually a prop
        break;
      default:
        // Custom state - try to apply via page.evaluate
        await page.evaluate((sel, st) => {
          const element = document.querySelector(sel);
          if (element) {
            element.setAttribute('data-state', st);
          }
        }, selector, state);
    }
    
    // Wait for any transitions to complete
    await page.waitForTimeout(300);
  }
  
  /**
   * Revert a component state
   */
  private async revertState(page: any, selector: string, state: string): Promise<void> {
    switch (state) {
      case 'hover':
        await page.mouse.move(0, 0);
        break;
      case 'focus':
        await page.evaluate(() => {
          (document.activeElement as HTMLElement).blur();
        });
        break;
      case 'active':
        await page.mouse.up();
        await page.mouse.move(0, 0);
        break;
      default:
        // Custom state - revert via page.evaluate
        await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          if (element) {
            element.removeAttribute('data-state');
          }
        }, selector);
    }
    
    // Wait for any transitions to complete
    await page.waitForTimeout(300);
  }
  
  /**
   * Save a baseline from the current screenshots
   */
  public async saveBaseline(componentName: string): Promise<string[]> {
    const componentConfig = this.findComponentConfig(componentName);
    
    if (!componentConfig) {
      throw new Error(`Component ${componentName} not found in configuration`);
    }
    
    const baselinePaths = [];
    
    for (const state of componentConfig.states) {
      const currentPath = this.getScreenshotPath(componentName, state);
      const baselinePath = this.getBaselinePath(componentName, state);
      
      // Copy current screenshot to baseline
      if (fs.pathExistsSync(currentPath)) {
        fs.copySync(currentPath, baselinePath);
        baselinePaths.push(baselinePath);
      }
    }
    
    return baselinePaths;
  }
} 