import fs from 'fs-extra';
import path from 'path';
import glob from 'glob';
import * as css from 'css';
import { PhaseType, SeverityLevel } from '../lib/persrm/types';
import { v4 as uuidv4 } from 'uuid';

export interface DesignToken {
  name: string;
  value: string;
  type: 'color' | 'spacing' | 'typography' | 'shadow' | 'border' | 'animation' | 'other';
}

export interface DesignSystem {
  colors: Record<string, string>;
  spacing: Record<string, string | number>;
  typography: Record<string, any>;
  shadows: Record<string, string>;
  borders: Record<string, any>;
  animations: Record<string, any>;
  breakpoints: Record<string, string | number>;
}

export interface TokenIssue {
  id: string;
  tokenName: string;
  tokenValue: string;
  expectedValue?: string;
  type: 'inconsistent' | 'undefined' | 'unused' | 'deprecated';
  component?: string;
  severity: SeverityLevel;
  impact: string;
  suggestion: string;
}

export interface TokenExtraction {
  componentName: string;
  tokensFound: DesignToken[];
  issues: TokenIssue[];
  score: number;
  maxScore: number;
}

export interface DesignTokenAnalyzerConfig {
  designSystemPath?: string;
  tokensDir?: string;
  includeCssFiles?: boolean;
  includeInlineStyles?: boolean;
  strictMode?: boolean;
  verbose?: boolean;
}

export class DesignTokenAnalyzer {
  private config: DesignTokenAnalyzerConfig;
  private designSystem: DesignSystem;
  private tokenDefinitions: Map<string, DesignToken> = new Map();
  private extractedTokens: Map<string, Set<string>> = new Map();
  
  constructor(config: DesignTokenAnalyzerConfig = {}) {
    this.config = {
      designSystemPath: './design-system.json',
      tokensDir: './tokens',
      includeCssFiles: true,
      includeInlineStyles: true,
      strictMode: false,
      verbose: false,
      ...config
    };
    
    // Load design system
    this.loadDesignSystem();
    
    // Load token definitions
    this.loadTokenDefinitions();
  }
  
  /**
   * Load design system from JSON file
   */
  private loadDesignSystem(): void {
    try {
      if (fs.existsSync(this.config.designSystemPath)) {
        this.designSystem = fs.readJSONSync(this.config.designSystemPath);
        
        if (this.config.verbose) {
          console.log(`Loaded design system from ${this.config.designSystemPath}`);
        }
      } else {
        // Use default empty design system
        this.designSystem = {
          colors: {},
          spacing: {},
          typography: {},
          shadows: {},
          borders: {},
          animations: {},
          breakpoints: {}
        };
        
        if (this.config.verbose) {
          console.log(`Design system file not found at ${this.config.designSystemPath}, using defaults`);
        }
      }
    } catch (error) {
      console.error('Error loading design system:', error);
      // Initialize with empty design system
      this.designSystem = {
        colors: {},
        spacing: {},
        typography: {},
        shadows: {},
        borders: {},
        animations: {},
        breakpoints: {}
      };
    }
  }
  
  /**
   * Load token definitions from token files
   */
  private loadTokenDefinitions(): void {
    try {
      const tokenDir = this.config.tokensDir;
      
      if (fs.existsSync(tokenDir)) {
        const tokenFiles = glob.sync(path.join(tokenDir, '**/*.json'));
        
        for (const file of tokenFiles) {
          const tokenSet = fs.readJSONSync(file);
          const category = path.basename(file, '.json');
          
          // Map tokens to our internal format
          this.mapTokensToDefinitions(tokenSet, category);
        }
        
        if (this.config.verbose) {
          console.log(`Loaded ${this.tokenDefinitions.size} token definitions from ${tokenFiles.length} files`);
        }
      } else if (this.config.verbose) {
        console.log(`Token directory not found at ${tokenDir}`);
      }
      
      // If no tokens loaded from files, extract from design system
      if (this.tokenDefinitions.size === 0) {
        this.extractTokensFromDesignSystem();
      }
    } catch (error) {
      console.error('Error loading token definitions:', error);
    }
  }
  
  /**
   * Map tokens from token files to internal format
   */
  private mapTokensToDefinitions(tokenSet: any, category: string): void {
    // Handle different token file formats
    if (typeof tokenSet === 'object') {
      // Flat format
      if (!tokenSet.tokens && Object.keys(tokenSet).length > 0) {
        Object.entries(tokenSet).forEach(([name, value]) => {
          let tokenType: 'color' | 'spacing' | 'typography' | 'shadow' | 'border' | 'animation' | 'other' = 'other';
          
          // Try to determine token type
          if (category.includes('color')) {
            tokenType = 'color';
          } else if (category.includes('spacing') || category.includes('size')) {
            tokenType = 'spacing';
          } else if (category.includes('typography') || category.includes('font')) {
            tokenType = 'typography';
          } else if (category.includes('shadow')) {
            tokenType = 'shadow';
          } else if (category.includes('border')) {
            tokenType = 'border';
          } else if (category.includes('animation')) {
            tokenType = 'animation';
          }
          
          // Add to definitions
          this.tokenDefinitions.set(name, {
            name,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            type: tokenType
          });
        });
      }
      // Nested format with explicit tokens array
      else if (tokenSet.tokens && Array.isArray(tokenSet.tokens)) {
        tokenSet.tokens.forEach(token => {
          if (token.name && token.value) {
            this.tokenDefinitions.set(token.name, {
              name: token.name,
              value: typeof token.value === 'string' ? token.value : JSON.stringify(token.value),
              type: token.type || category as any || 'other'
            });
          }
        });
      }
    }
  }
  
  /**
   * Extract tokens from design system if no token files are available
   */
  private extractTokensFromDesignSystem(): void {
    // Extract colors
    Object.entries(this.designSystem.colors || {}).forEach(([name, value]) => {
      this.tokenDefinitions.set(`color.${name}`, {
        name: `color.${name}`,
        value: value.toString(),
        type: 'color'
      });
    });
    
    // Extract spacing
    Object.entries(this.designSystem.spacing || {}).forEach(([name, value]) => {
      this.tokenDefinitions.set(`spacing.${name}`, {
        name: `spacing.${name}`,
        value: value.toString(),
        type: 'spacing'
      });
    });
    
    // Extract typography
    Object.entries(this.designSystem.typography || {}).forEach(([name, value]) => {
      this.tokenDefinitions.set(`typography.${name}`, {
        name: `typography.${name}`,
        value: typeof value === 'string' ? value : JSON.stringify(value),
        type: 'typography'
      });
    });
    
    // Extract shadows
    Object.entries(this.designSystem.shadows || {}).forEach(([name, value]) => {
      this.tokenDefinitions.set(`shadow.${name}`, {
        name: `shadow.${name}`,
        value: value.toString(),
        type: 'shadow'
      });
    });
    
    if (this.config.verbose) {
      console.log(`Extracted ${this.tokenDefinitions.size} token definitions from design system`);
    }
  }
  
  /**
   * Extract tokens from a component
   */
  public async extractTokensFromComponent(componentPath: string): Promise<TokenExtraction> {
    const startTime = Date.now();
    const componentName = path.basename(componentPath, path.extname(componentPath));
    const tokensFound: DesignToken[] = [];
    const issues: TokenIssue[] = [];
    
    if (this.config.verbose) {
      console.log(`Extracting tokens from ${componentPath}`);
    }
    
    try {
      // Read component file
      const content = await fs.readFile(componentPath, 'utf-8');
      
      // Extract tokens from component content
      const componentTokens = this.extractTokensFromContent(content, componentPath);
      tokensFound.push(...componentTokens);
      
      // If enabled, also check related CSS files
      if (this.config.includeCssFiles) {
        const cssTokens = await this.extractTokensFromCssFiles(componentPath, componentName);
        tokensFound.push(...cssTokens);
      }
      
      // Track extracted tokens by component
      this.extractedTokens.set(componentName, new Set(tokensFound.map(t => t.name)));
      
      // Validate tokens against definitions
      const tokenIssues = this.validateTokens(tokensFound, componentName);
      issues.push(...tokenIssues);
      
      // Calculate score based on issues
      const score = this.calculateScore(issues);
      
      return {
        componentName,
        tokensFound,
        issues,
        score,
        maxScore: 100
      };
    } catch (error) {
      console.error(`Error extracting tokens from ${componentPath}:`, error);
      
      // Add issue for extraction error
      issues.push({
        id: uuidv4(),
        tokenName: 'N/A',
        tokenValue: 'N/A',
        type: 'undefined',
        component: componentName,
        severity: SeverityLevel.ERROR,
        impact: 'High',
        suggestion: `Unable to extract tokens from component: ${error.message}`
      });
      
      return {
        componentName,
        tokensFound: [],
        issues,
        score: 0,
        maxScore: 100
      };
    }
  }
  
  /**
   * Extract tokens from component content (JSX, TSX, etc.)
   */
  private extractTokensFromContent(content: string, filePath: string): DesignToken[] {
    const tokensFound: DesignToken[] = [];
    const fileExt = path.extname(filePath);
    
    // Extract inline styles from JSX/TSX
    if (fileExt === '.jsx' || fileExt === '.tsx') {
      // Look for style={{ ... }} patterns
      const styleRegex = /style=\{\{([\s\S]*?)\}\}/g;
      let match;
      
      while ((match = styleRegex.exec(content)) !== null) {
        const styleContent = match[1];
        const styleProps = this.parseStyleProps(styleContent);
        
        // Add each style property as a token
        for (const [prop, value] of styleProps) {
          // Determine token type based on property name
          let tokenType: 'color' | 'spacing' | 'typography' | 'shadow' | 'border' | 'animation' | 'other' = 'other';
          
          if (/color|background|border-color|fill|stroke/.test(prop)) {
            tokenType = 'color';
          } else if (/margin|padding|width|height|top|left|right|bottom|gap/.test(prop)) {
            tokenType = 'spacing';
          } else if (/font|text|line-height|letter-spacing|word-spacing/.test(prop)) {
            tokenType = 'typography';
          } else if (/shadow|box-shadow|text-shadow/.test(prop)) {
            tokenType = 'shadow';
          } else if (/border|border-radius|border-width/.test(prop)) {
            tokenType = 'border';
          } else if (/animation|transition/.test(prop)) {
            tokenType = 'animation';
          }
          
          tokensFound.push({
            name: `inline.${prop}`,
            value,
            type: tokenType
          });
        }
      }
    }
    
    // Extract imported design tokens
    const importedTokens = this.extractImportedTokens(content);
    tokensFound.push(...importedTokens);
    
    return tokensFound;
  }
  
  /**
   * Parse style properties from inline style content
   */
  private parseStyleProps(styleContent: string): Map<string, string> {
    const props = new Map<string, string>();
    const lines = styleContent.split('\n');
    
    for (const line of lines) {
      // Match property: value, handling different formats
      const propMatch = line.match(/\s*([a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*)\s*:\s*(['"]?)(.*?)(\2)\s*,?$/);
      
      if (propMatch) {
        const [, propName, , propValue] = propMatch;
        props.set(propName, propValue);
      }
    }
    
    return props;
  }
  
  /**
   * Extract imported design tokens from component
   */
  private extractImportedTokens(content: string): DesignToken[] {
    const tokensFound: DesignToken[] = [];
    
    // Look for imports from token or design system files
    const importRegex = /import\s+(\{[\s\S]*?\}|\*\s+as\s+\w+)\s+from\s+['"](.+?(?:tokens|theme|design|styles)[^'"]*)['"]/g;
    let importMatch;
    
    while ((importMatch = importRegex.exec(content)) !== null) {
      const [, importedItems, importPath] = importMatch;
      
      // Extract imported token names
      const tokenNamesMatch = importedItems.match(/\{([^}]+)\}/);
      if (tokenNamesMatch) {
        const tokenNames = tokenNamesMatch[1].split(',').map(name => name.trim());
        
        // Look for usage of these tokens
        for (const tokenName of tokenNames) {
          const usageRegex = new RegExp(`${tokenName}\\b`, 'g');
          if (usageRegex.test(content)) {
            // Check if we have a definition for this token
            const matchingDefinitions = Array.from(this.tokenDefinitions.values())
              .filter(def => def.name.includes(tokenName));
            
            if (matchingDefinitions.length > 0) {
              tokensFound.push(...matchingDefinitions);
            } else {
              // Token used but not defined in our system
              tokensFound.push({
                name: tokenName,
                value: 'unknown',
                type: 'other'
              });
            }
          }
        }
      }
    }
    
    return tokensFound;
  }
  
  /**
   * Extract tokens from related CSS files
   */
  private async extractTokensFromCssFiles(componentPath: string, componentName: string): Promise<DesignToken[]> {
    const tokensFound: DesignToken[] = [];
    const dir = path.dirname(componentPath);
    const baseFileName = path.basename(componentPath, path.extname(componentPath));
    
    // Look for related CSS/SCSS files
    const cssFiles = glob.sync(path.join(dir, `${baseFileName}.{css,scss,less}`));
    
    for (const cssFile of cssFiles) {
      try {
        const cssContent = await fs.readFile(cssFile, 'utf-8');
        const cssTokens = this.extractTokensFromCss(cssContent, cssFile);
        tokensFound.push(...cssTokens);
      } catch (error) {
        console.error(`Error reading CSS file ${cssFile}:`, error);
      }
    }
    
    return tokensFound;
  }
  
  /**
   * Extract tokens from CSS content
   */
  private extractTokensFromCss(cssContent: string, filePath: string): DesignToken[] {
    const tokensFound: DesignToken[] = [];
    
    try {
      // Parse CSS
      const parsedCss = css.parse(cssContent);
      
      // Extract property values from CSS rules
      if (parsedCss.stylesheet?.rules) {
        for (const rule of parsedCss.stylesheet.rules) {
          if (rule.type === 'rule' && rule.declarations) {
            for (const declaration of rule.declarations) {
              if (declaration.type === 'declaration' && declaration.property && declaration.value) {
                let tokenType: 'color' | 'spacing' | 'typography' | 'shadow' | 'border' | 'animation' | 'other' = 'other';
                
                // Determine token type based on property name
                if (/color|background|border-color|fill|stroke/.test(declaration.property)) {
                  tokenType = 'color';
                } else if (/margin|padding|width|height|top|left|right|bottom|gap/.test(declaration.property)) {
                  tokenType = 'spacing';
                } else if (/font|text|line-height|letter-spacing|word-spacing/.test(declaration.property)) {
                  tokenType = 'typography';
                } else if (/shadow|box-shadow|text-shadow/.test(declaration.property)) {
                  tokenType = 'shadow';
                } else if (/border|border-radius|border-width/.test(declaration.property)) {
                  tokenType = 'border';
                } else if (/animation|transition/.test(declaration.property)) {
                  tokenType = 'animation';
                }
                
                tokensFound.push({
                  name: `css.${declaration.property}`,
                  value: declaration.value,
                  type: tokenType
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error parsing CSS from ${filePath}:`, error);
    }
    
    return tokensFound;
  }
  
  /**
   * Validate tokens against design system definitions
   */
  private validateTokens(tokens: DesignToken[], componentName: string): TokenIssue[] {
    const issues: TokenIssue[] = [];
    
    // Check each token against our definitions
    for (const token of tokens) {
      // For color tokens, check against defined colors
      if (token.type === 'color') {
        const colorValue = token.value.toLowerCase();
        
        // Skip variables and dynamic values
        if (colorValue.includes('var(') || colorValue.includes('${')) {
          continue;
        }
        
        // Check if this color is in our design system
        const definedColors = Object.values(this.designSystem.colors || {}).map(c => 
          c.toString().toLowerCase()
        );
        
        if (!definedColors.includes(colorValue)) {
          // Check if it's close to a defined color
          const closestColor = this.findClosestColor(colorValue, definedColors);
          
          if (closestColor) {
            issues.push({
              id: uuidv4(),
              tokenName: token.name,
              tokenValue: token.value,
              expectedValue: closestColor,
              type: 'inconsistent',
              component: componentName,
              severity: SeverityLevel.WARNING,
              impact: 'Medium',
              suggestion: `Replace ${token.value} with the design system color ${closestColor}`
            });
          } else {
            issues.push({
              id: uuidv4(),
              tokenName: token.name,
              tokenValue: token.value,
              type: 'undefined',
              component: componentName,
              severity: SeverityLevel.INFO,
              impact: 'Low',
              suggestion: 'Consider adding this color to the design system if it\'s intended to be reused'
            });
          }
        }
      }
      
      // For spacing tokens, check against defined spacing values
      if (token.type === 'spacing') {
        const spacingValue = token.value.toLowerCase();
        
        // Skip variables and dynamic values
        if (spacingValue.includes('var(') || spacingValue.includes('${')) {
          continue;
        }
        
        // Check if this spacing value is in our design system
        const definedSpacing = Object.values(this.designSystem.spacing || {}).map(s => 
          s.toString().toLowerCase()
        );
        
        if (!definedSpacing.includes(spacingValue)) {
          issues.push({
            id: uuidv4(),
            tokenName: token.name,
            tokenValue: token.value,
            type: 'inconsistent',
            component: componentName,
            severity: SeverityLevel.INFO,
            impact: 'Low',
            suggestion: 'Use design system spacing tokens for consistent layout'
          });
        }
      }
    }
    
    return issues;
  }
  
  /**
   * Find the closest color in the design system
   */
  private findClosestColor(color: string, definedColors: string[]): string | null {
    // Convert hex to RGB for comparison
    const colorRgb = this.hexToRgb(color);
    if (!colorRgb) return null;
    
    let closestColor = null;
    let smallestDistance = Number.MAX_VALUE;
    
    for (const definedColor of definedColors) {
      const definedRgb = this.hexToRgb(definedColor);
      if (!definedRgb) continue;
      
      // Calculate Euclidean distance in RGB space
      const distance = Math.sqrt(
        Math.pow(colorRgb.r - definedRgb.r, 2) +
        Math.pow(colorRgb.g - definedRgb.g, 2) +
        Math.pow(colorRgb.b - definedRgb.b, 2)
      );
      
      // If the distance is small enough, consider it close
      if (distance < 30 && distance < smallestDistance) {
        smallestDistance = distance;
        closestColor = definedColor;
      }
    }
    
    return closestColor;
  }
  
  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // Handle different hex formats
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);
    
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }
  
  /**
   * Calculate score based on issues
   */
  private calculateScore(issues: TokenIssue[]): number {
    let score = 100;
    
    // Deduct points based on issue severity
    for (const issue of issues) {
      switch (issue.severity) {
        case SeverityLevel.CRITICAL:
          score -= 15;
          break;
        case SeverityLevel.ERROR:
          score -= 10;
          break;
        case SeverityLevel.WARNING:
          score -= 5;
          break;
        case SeverityLevel.INFO:
          score -= 2;
          break;
      }
    }
    
    // Ensure score doesn't go below 0
    return Math.max(0, score);
  }
  
  /**
   * Analyze a directory of components
   */
  public async analyzeDirectory(directoryPath: string): Promise<TokenExtraction[]> {
    try {
      // Find component files
      const files = glob.sync(path.join(directoryPath, '**/*.{jsx,tsx,js,ts}'), {
        ignore: ['**/node_modules/**', '**/*.test.*', '**/*.spec.*']
      });
      
      if (this.config.verbose) {
        console.log(`Found ${files.length} files to analyze in ${directoryPath}`);
      }
      
      // Analyze each file
      const results: TokenExtraction[] = [];
      
      for (const file of files) {
        const result = await this.extractTokensFromComponent(file);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      console.error(`Error analyzing directory ${directoryPath}:`, error);
      return [];
    }
  }
  
  /**
   * Generate a report of all token usage across components
   */
  public generateTokenReport(): {
    tokenCount: number;
    issueCount: number;
    mostUsedTokens: { name: string; usageCount: number }[];
    components: { name: string; tokenCount: number; issueCount: number; score: number }[];
  } {
    const componentTokens = Array.from(this.extractedTokens.entries());
    const tokenUsage = new Map<string, number>();
    
    // Count token usage across components
    for (const [, tokens] of componentTokens) {
      for (const token of tokens) {
        const count = tokenUsage.get(token) || 0;
        tokenUsage.set(token, count + 1);
      }
    }
    
    // Sort by usage count
    const sortedTokens = Array.from(tokenUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, usageCount]) => ({ name, usageCount }));
    
    return {
      tokenCount: this.tokenDefinitions.size,
      issueCount: 0, // This would be calculated from all issues
      mostUsedTokens: sortedTokens,
      components: componentTokens.map(([name, tokens]) => ({
        name,
        tokenCount: tokens.size,
        issueCount: 0, // This would be calculated per component
        score: 100 // This would be calculated per component
      }))
    };
  }
} 