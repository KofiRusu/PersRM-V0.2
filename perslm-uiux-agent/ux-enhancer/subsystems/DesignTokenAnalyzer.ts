import fs from 'fs/promises';
import path from 'path';
import { SeverityLevel } from '../types';

export interface DesignTokenAnalysisResult {
  score: number;
  maxScore: number;
  issues: DesignTokenIssue[];
  metrics: {
    colorConsistency: number;
    spacingConsistency: number;
    typographyConsistency: number;
    borderConsistency: number;
    shadowConsistency: number;
    totalTokensCount: number;
    uniqueTokensCount: number;
  };
  tokens: DesignTokenMap;
}

export interface DesignTokenIssue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  tokenType?: string;
  recommendations: string[];
}

export interface DesignTokenMap {
  colors: Record<string, string[]>;
  spacing: Record<string, string[]>;
  typography: Record<string, string[]>;
  borders: Record<string, string[]>;
  shadows: Record<string, string[]>;
}

export class DesignTokenAnalyzer {
  private outputDir: string = '.tmp/ux-results/design-tokens';
  
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
   * Extract design tokens from component CSS
   * @param componentCss The CSS for the component
   * @param componentId Unique identifier for the component
   */
  async extractDesignTokens(
    componentCss: string,
    componentId: string
  ): Promise<DesignTokenMap> {
    try {
      // Parse CSS to extract token values
      const colorTokens = this.extractColorTokens(componentCss);
      const spacingTokens = this.extractSpacingTokens(componentCss);
      const typographyTokens = this.extractTypographyTokens(componentCss);
      const borderTokens = this.extractBorderTokens(componentCss);
      const shadowTokens = this.extractShadowTokens(componentCss);
      
      const tokenMap: DesignTokenMap = {
        colors: this.groupSimilarValues(colorTokens),
        spacing: this.groupSimilarValues(spacingTokens),
        typography: this.groupSimilarValues(typographyTokens),
        borders: this.groupSimilarValues(borderTokens),
        shadows: this.groupSimilarValues(shadowTokens)
      };
      
      // Save extracted tokens to file
      const tokensPath = path.join(this.outputDir, `${componentId}-tokens.json`);
      await fs.writeFile(
        path.resolve(tokensPath),
        JSON.stringify(tokenMap, null, 2)
      );
      
      return tokenMap;
    } catch (error) {
      console.error('Token extraction failed:', error);
      return {
        colors: {},
        spacing: {},
        typography: {},
        borders: {},
        shadows: {}
      };
    }
  }
  
  /**
   * Analyze design token consistency
   * @param componentCss The CSS for the component
   * @param componentId Unique identifier for the component
   */
  async analyzeDesignConsistency(
    componentCss: string,
    componentId: string
  ): Promise<DesignTokenAnalysisResult> {
    try {
      // Extract tokens
      const tokens = await this.extractDesignTokens(componentCss, componentId);
      
      // Count tokens
      const totalTokensCount = this.countTotalTokens(tokens);
      const uniqueTokensCount = this.countUniqueTokenGroups(tokens);
      
      // Calculate consistency scores (0-100)
      const colorConsistency = this.calculateConsistencyScore(tokens.colors);
      const spacingConsistency = this.calculateConsistencyScore(tokens.spacing);
      const typographyConsistency = this.calculateConsistencyScore(tokens.typography);
      const borderConsistency = this.calculateConsistencyScore(tokens.borders);
      const shadowConsistency = this.calculateConsistencyScore(tokens.shadows);
      
      // Generate issues based on token analysis
      const issues = this.generateIssues(tokens, componentId);
      
      // Calculate overall score
      // Weight by importance and normalize to 0-100
      const score = Math.round(
        (colorConsistency * 0.3) +
        (spacingConsistency * 0.25) +
        (typographyConsistency * 0.2) +
        (borderConsistency * 0.15) +
        (shadowConsistency * 0.1)
      );
      
      const result: DesignTokenAnalysisResult = {
        score: Math.min(100, score),
        maxScore: 100,
        issues,
        metrics: {
          colorConsistency,
          spacingConsistency,
          typographyConsistency,
          borderConsistency,
          shadowConsistency,
          totalTokensCount,
          uniqueTokensCount
        },
        tokens
      };
      
      // Save analysis results
      const resultsPath = path.join(this.outputDir, `${componentId}-analysis.json`);
      await fs.writeFile(
        path.resolve(resultsPath),
        JSON.stringify(result, null, 2)
      );
      
      return result;
    } catch (error) {
      console.error('Design token analysis failed:', error);
      
      // Return a failure result
      return {
        score: 0,
        maxScore: 100,
        issues: [{
          id: `${componentId}-design-token-error`,
          title: 'Design token analysis failed',
          description: `Error: ${error instanceof Error ? error.message : String(error)}`,
          severity: SeverityLevel.ERROR,
          recommendations: [
            'Check if the component CSS is valid',
            'Verify that the component uses standard CSS properties'
          ]
        }],
        metrics: {
          colorConsistency: 0,
          spacingConsistency: 0,
          typographyConsistency: 0,
          borderConsistency: 0,
          shadowConsistency: 0,
          totalTokensCount: 0,
          uniqueTokensCount: 0
        },
        tokens: {
          colors: {},
          spacing: {},
          typography: {},
          borders: {},
          shadows: {}
        }
      };
    }
  }
  
  /**
   * Extract color values from CSS
   */
  private extractColorTokens(css: string): string[] {
    const colorPatterns = [
      /#[0-9a-fA-F]{3,8}\b/g, // Hex colors
      /rgba?\([^)]+\)/g, // RGB and RGBA
      /hsla?\([^)]+\)/g, // HSL and HSLA
      /\b(aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen)\b/gi // Named colors
    ];
    
    const colors: string[] = [];
    
    for (const pattern of colorPatterns) {
      const matches = css.match(pattern);
      if (matches) {
        colors.push(...matches);
      }
    }
    
    return colors;
  }
  
  /**
   * Extract spacing values from CSS
   */
  private extractSpacingTokens(css: string): string[] {
    // Look for margin, padding, gap properties
    const spacingPattern = /\b(margin|padding|gap|grid-gap|border-spacing)(?:-(?:top|right|bottom|left|inline|block|start|end))?\s*:\s*([^;]+)/gi;
    const spacingValues: string[] = [];
    
    let match;
    while ((match = spacingPattern.exec(css)) !== null) {
      // Extract values and split if multiple (e.g., margin: 10px 20px)
      const valueStr = match[2].trim();
      const values = valueStr.split(/\s+/);
      
      // Only include length values (px, rem, em, vh, etc.)
      values.forEach(value => {
        if (/^-?\d*\.?\d+(?:px|rem|em|vh|vw|%|pt|pc|in|cm|mm|ex|ch)$/.test(value)) {
          spacingValues.push(value);
        }
      });
    }
    
    return spacingValues;
  }
  
  /**
   * Extract typography values from CSS
   */
  private extractTypographyTokens(css: string): string[] {
    const fontSizePattern = /font-size\s*:\s*([^;]+)/gi;
    const fontWeightPattern = /font-weight\s*:\s*([^;]+)/gi;
    const fontFamilyPattern = /font-family\s*:\s*([^;]+)/gi;
    const lineHeightPattern = /line-height\s*:\s*([^;]+)/gi;
    
    const typographyValues: string[] = [];
    
    // Extract font sizes
    let match;
    while ((match = fontSizePattern.exec(css)) !== null) {
      typographyValues.push(`size:${match[1].trim()}`);
    }
    
    // Extract font weights
    while ((match = fontWeightPattern.exec(css)) !== null) {
      typographyValues.push(`weight:${match[1].trim()}`);
    }
    
    // Extract font families
    while ((match = fontFamilyPattern.exec(css)) !== null) {
      typographyValues.push(`family:${match[1].trim()}`);
    }
    
    // Extract line heights
    while ((match = lineHeightPattern.exec(css)) !== null) {
      typographyValues.push(`lineHeight:${match[1].trim()}`);
    }
    
    return typographyValues;
  }
  
  /**
   * Extract border values from CSS
   */
  private extractBorderTokens(css: string): string[] {
    const borderPattern = /(?:border|border-(?:top|right|bottom|left|inline|block|start|end))\s*:\s*([^;]+)/gi;
    const borderWidthPattern = /border-width\s*:\s*([^;]+)/gi;
    const borderRadiusPattern = /border-radius\s*:\s*([^;]+)/gi;
    
    const borderValues: string[] = [];
    
    // Extract full border declarations
    let match;
    while ((match = borderPattern.exec(css)) !== null) {
      borderValues.push(`border:${match[1].trim()}`);
    }
    
    // Extract border widths
    while ((match = borderWidthPattern.exec(css)) !== null) {
      borderValues.push(`width:${match[1].trim()}`);
    }
    
    // Extract border radii
    while ((match = borderRadiusPattern.exec(css)) !== null) {
      borderValues.push(`radius:${match[1].trim()}`);
    }
    
    return borderValues;
  }
  
  /**
   * Extract shadow values from CSS
   */
  private extractShadowTokens(css: string): string[] {
    const boxShadowPattern = /box-shadow\s*:\s*([^;]+)/gi;
    const textShadowPattern = /text-shadow\s*:\s*([^;]+)/gi;
    
    const shadowValues: string[] = [];
    
    // Extract box shadows
    let match;
    while ((match = boxShadowPattern.exec(css)) !== null) {
      shadowValues.push(`box:${match[1].trim()}`);
    }
    
    // Extract text shadows
    while ((match = textShadowPattern.exec(css)) !== null) {
      shadowValues.push(`text:${match[1].trim()}`);
    }
    
    return shadowValues;
  }
  
  /**
   * Group similar values to identify potential token groups
   */
  private groupSimilarValues(values: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    
    // Exact match grouping for simplicity
    // In a real implementation, this would use more sophisticated
    // grouping logic based on value similarity or patterns
    
    values.forEach(value => {
      // For colors, normalize format
      if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl') || /^[a-z]+$/i.test(value)) {
        // Simplistic grouping by first character for demo
        const key = value.charAt(0) === '#' ? value.substring(0, 4) : value.split('(')[0];
        if (!groups[key]) {
          groups[key] = [];
        }
        if (!groups[key].includes(value)) {
          groups[key].push(value);
        }
      } else {
        // For other values, group by first character or prefix
        const key = value.includes(':') ? value.split(':')[0] : value.charAt(0);
        if (!groups[key]) {
          groups[key] = [];
        }
        if (!groups[key].includes(value)) {
          groups[key].push(value);
        }
      }
    });
    
    return groups;
  }
  
  /**
   * Calculate a consistency score based on token groups
   */
  private calculateConsistencyScore(tokenGroups: Record<string, string[]>): number {
    // No tokens means we can't calculate a score
    if (Object.keys(tokenGroups).length === 0) {
      return 100; // Assume perfect if no tokens (nothing to be inconsistent)
    }
    
    const totalTokens = this.countTotalTokensInGroups(tokenGroups);
    const totalGroups = Object.keys(tokenGroups).length;
    
    // More groups relative to total tokens indicates less consistency
    // Ideal ratio: 1 group per 5+ tokens
    const idealRatio = 5;
    const actualRatio = totalTokens / totalGroups;
    
    // Calculate score: higher ratio = better consistency
    // Cap at 0-100 range
    let score = Math.min(100, (actualRatio / idealRatio) * 100);
    
    // Penalize groups with only 1 token (indicates lack of reuse)
    const singletonGroups = Object.values(tokenGroups).filter(group => group.length === 1).length;
    const singletonRatio = singletonGroups / totalGroups;
    
    // Reduce score based on singleton ratio
    score = score * (1 - (singletonRatio * 0.5));
    
    return Math.round(score);
  }
  
  /**
   * Count total tokens across all groups
   */
  private countTotalTokensInGroups(tokenGroups: Record<string, string[]>): number {
    return Object.values(tokenGroups).reduce((sum, group) => sum + group.length, 0);
  }
  
  /**
   * Count total tokens across all token types
   */
  private countTotalTokens(tokens: DesignTokenMap): number {
    return this.countTotalTokensInGroups(tokens.colors) +
           this.countTotalTokensInGroups(tokens.spacing) +
           this.countTotalTokensInGroups(tokens.typography) +
           this.countTotalTokensInGroups(tokens.borders) +
           this.countTotalTokensInGroups(tokens.shadows);
  }
  
  /**
   * Count unique token groups
   */
  private countUniqueTokenGroups(tokens: DesignTokenMap): number {
    return Object.keys(tokens.colors).length +
           Object.keys(tokens.spacing).length +
           Object.keys(tokens.typography).length +
           Object.keys(tokens.borders).length +
           Object.keys(tokens.shadows).length;
  }
  
  /**
   * Generate issues based on token analysis
   */
  private generateIssues(tokens: DesignTokenMap, componentId: string): DesignTokenIssue[] {
    const issues: DesignTokenIssue[] = [];
    
    // Check for color inconsistencies
    if (this.hasInconsistentTokens(tokens.colors)) {
      issues.push({
        id: `${componentId}-design-token-color`,
        title: 'Inconsistent color usage',
        description: 'Component uses many similar colors that could be consolidated into a design token system.',
        severity: SeverityLevel.MEDIUM,
        tokenType: 'color',
        recommendations: [
          'Define a color palette with primary, secondary, and neutral colors',
          'Use CSS variables or a design token system to maintain consistency',
          'Limit color variations to improve visual cohesion'
        ]
      });
    }
    
    // Check for spacing inconsistencies
    if (this.hasInconsistentTokens(tokens.spacing)) {
      issues.push({
        id: `${componentId}-design-token-spacing`,
        title: 'Inconsistent spacing values',
        description: 'Component uses many different spacing values that could be standardized.',
        severity: SeverityLevel.MEDIUM,
        tokenType: 'spacing',
        recommendations: [
          'Create a spacing scale (4px, 8px, 16px, 24px, 32px, etc.)',
          'Use standardized spacing variables instead of arbitrary values',
          'Maintain consistent spacing between related elements'
        ]
      });
    }
    
    // Check for typography inconsistencies
    if (this.hasInconsistentTokens(tokens.typography)) {
      issues.push({
        id: `${componentId}-design-token-typography`,
        title: 'Inconsistent typography',
        description: 'Component uses multiple font sizes, weights, or families that could be standardized.',
        severity: SeverityLevel.MEDIUM,
        tokenType: 'typography',
        recommendations: [
          'Create a type scale with standard font sizes',
          'Limit font weight variations (e.g., 400, 500, 700)',
          'Use a consistent font family throughout the component'
        ]
      });
    }
    
    // Check for border inconsistencies
    if (this.hasInconsistentTokens(tokens.borders)) {
      issues.push({
        id: `${componentId}-design-token-border`,
        title: 'Inconsistent border styles',
        description: 'Component uses multiple border widths, styles, or radii that could be standardized.',
        severity: SeverityLevel.LOW,
        tokenType: 'border',
        recommendations: [
          'Standardize border widths (e.g., 1px, 2px)',
          'Use consistent border radius values',
          'Define border tokens for different UI states (default, hover, active)'
        ]
      });
    }
    
    // Check for shadow inconsistencies
    if (this.hasInconsistentTokens(tokens.shadows)) {
      issues.push({
        id: `${componentId}-design-token-shadow`,
        title: 'Inconsistent shadow styles',
        description: 'Component uses multiple shadow styles that could be standardized.',
        severity: SeverityLevel.LOW,
        tokenType: 'shadow',
        recommendations: [
          'Create a shadow system with 2-4 elevation levels',
          'Maintain consistent color and opacity in shadows',
          'Use shadows consistently to indicate elevation'
        ]
      });
    }
    
    // Check for overall design token system issues
    if (this.countTotalTokens(tokens) > 20 && this.countUniqueTokenGroups(tokens) > 10) {
      issues.push({
        id: `${componentId}-design-token-system`,
        title: 'Missing design token system',
        description: 'Component would benefit from a structured design token system to maintain consistency.',
        severity: SeverityLevel.HIGH,
        recommendations: [
          'Implement a design token system with CSS variables',
          'Group tokens by purpose (brand, semantic, component-specific)',
          'Document the token system for team consistency'
        ]
      });
    }
    
    return issues;
  }
  
  /**
   * Check if token groups show inconsistent usage
   */
  private hasInconsistentTokens(tokenGroups: Record<string, string[]>): boolean {
    // Too many singleton groups indicates inconsistency
    const totalGroups = Object.keys(tokenGroups).length;
    if (totalGroups <= 1) {
      return false; // Only one group or none, so no inconsistency
    }
    
    const singletonGroups = Object.values(tokenGroups).filter(group => group.length === 1).length;
    const singletonRatio = singletonGroups / totalGroups;
    
    // If more than 50% of groups have only one value, consider it inconsistent
    return singletonRatio > 0.5;
  }
}

export default DesignTokenAnalyzer; 