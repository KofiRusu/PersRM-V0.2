import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';
import { SeverityLevel } from '../types';

export interface VisualAnalysisResult {
  score: number;
  maxScore: number;
  issues: VisualIssue[];
  metrics: {
    layoutShifts: number;
    contrastIssues: number;
    overflowIssues: number;
    responsiveIssues: number;
    accessibilityScore: number;
  };
  snapshotPath?: string;
}

export interface VisualIssue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  element?: string;
  recommendations: string[];
  screenshot?: string;
}

export class VisualAnalyzer {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private outputDir: string = '.tmp/ux-results/visual';
  
  /**
   * Initialize the visual analyzer
   */
  async initialize(): Promise<void> {
    try {
      // Ensure output directory exists
      await fs.mkdir(path.resolve(this.outputDir), { recursive: true });
      
      // Launch headless browser
      this.browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      this.page = await this.browser.newPage();
      
      // Set viewport size
      await this.page.setViewport({ width: 1280, height: 800 });
      
      console.log('Visual analyzer initialized successfully');
    } catch (error) {
      console.error('Failed to initialize visual analyzer:', error);
      throw new Error(`Visual analyzer initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
  
  /**
   * Capture a visual snapshot of the component
   * @param componentHtml The HTML markup of the component
   * @param componentCss The CSS for the component
   * @param componentId Unique identifier for the component
   */
  async captureVisualSnapshot(
    componentHtml: string, 
    componentCss: string, 
    componentId: string
  ): Promise<string> {
    if (!this.page) {
      throw new Error('Visual analyzer not initialized');
    }
    
    try {
      // Create a minimal HTML page with the component
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>${componentCss}</style>
            <style>
              body { 
                margin: 0; 
                padding: 20px;
                font-family: system-ui, sans-serif;
              }
              .component-wrapper {
                border: 1px dashed #ccc;
                padding: 20px;
                box-sizing: border-box;
              }
            </style>
          </head>
          <body>
            <div class="component-wrapper">
              ${componentHtml}
            </div>
          </body>
        </html>
      `;
      
      // Set the content
      await this.page.setContent(html, { waitUntil: 'networkidle0' });
      
      // Take a screenshot
      const snapshotPath = path.join(this.outputDir, `${componentId}-snapshot.png`);
      await this.page.screenshot({ 
        path: path.resolve(snapshotPath),
        fullPage: true
      });
      
      return snapshotPath;
    } catch (error) {
      console.error('Failed to capture visual snapshot:', error);
      throw new Error(`Visual snapshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Analyze the visual aspects of a component
   * @param componentHtml The HTML markup of the component
   * @param componentCss The CSS for the component
   * @param componentId Unique identifier for the component
   */
  async analyzeComponent(
    componentHtml: string, 
    componentCss: string, 
    componentId: string
  ): Promise<VisualAnalysisResult> {
    if (!this.page) {
      await this.initialize();
    }
    
    try {
      // Capture snapshot
      const snapshotPath = await this.captureVisualSnapshot(componentHtml, componentCss, componentId);
      
      // Create a minimal HTML page with the component
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>${componentCss}</style>
          </head>
          <body>
            <div id="component-root">${componentHtml}</div>
          </body>
        </html>
      `;
      
      // Set the content
      await this.page!.setContent(html, { waitUntil: 'networkidle0' });
      
      // Run accessibility audit
      const accessibilityReport = await this.page!.evaluate(() => {
        // Simple implementation to mimic axe-core
        const issues: any[] = [];
        const root = document.getElementById('component-root');
        
        // Check for images without alt
        const imagesWithoutAlt = Array.from(root?.querySelectorAll('img:not([alt])') || []);
        if (imagesWithoutAlt.length > 0) {
          issues.push({
            type: 'accessibility',
            subtype: 'alt-text',
            elements: imagesWithoutAlt.length,
            severity: 'critical'
          });
        }
        
        // Check for buttons without accessible name
        const buttonsWithoutName = Array.from(
          root?.querySelectorAll('button:not([aria-label]):not(:has(*)):empty') || []
        );
        if (buttonsWithoutName.length > 0) {
          issues.push({
            type: 'accessibility',
            subtype: 'button-name',
            elements: buttonsWithoutName.length,
            severity: 'critical'
          });
        }
        
        // Check for color contrast (simplified)
        const textElements = Array.from(root?.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button') || []);
        let contrastIssues = 0;
        
        textElements.forEach(el => {
          const styles = window.getComputedStyle(el);
          // This is a very basic check - real implementation would use color contrast algorithms
          if (styles.color === 'rgb(255, 255, 255)' && styles.backgroundColor === 'rgb(255, 255, 255)') {
            contrastIssues++;
          }
          if (styles.color === 'rgb(0, 0, 0)' && styles.backgroundColor === 'rgb(0, 0, 0)') {
            contrastIssues++;
          }
        });
        
        if (contrastIssues > 0) {
          issues.push({
            type: 'accessibility',
            subtype: 'contrast',
            elements: contrastIssues,
            severity: 'high'
          });
        }
        
        // Check layout issues (simplified)
        const elementsWithOverflow = Array.from(root?.querySelectorAll('*') || [])
          .filter(el => {
            const styles = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return rect.width > window.innerWidth || 
                   styles.overflow === 'visible' && 
                  (parseInt(styles.width) > window.innerWidth || 
                   parseInt(styles.height) > window.innerHeight * 2);
          });
        
        if (elementsWithOverflow.length > 0) {
          issues.push({
            type: 'layout',
            subtype: 'overflow',
            elements: elementsWithOverflow.length,
            severity: 'medium'
          });
        }
        
        // Responsive issues check (simplified)
        const elementsWithFixedWidth = Array.from(root?.querySelectorAll('*') || [])
          .filter(el => {
            const styles = window.getComputedStyle(el);
            return styles.width.endsWith('px') && parseInt(styles.width) > 500;
          });
        
        if (elementsWithFixedWidth.length > 0) {
          issues.push({
            type: 'responsive',
            subtype: 'fixed-width',
            elements: elementsWithFixedWidth.length,
            severity: 'medium'
          });
        }
        
        return {
          issues,
          totalElements: root?.querySelectorAll('*').length || 0
        };
      });
      
      // Check layout shifts by resizing viewport
      const layoutShifts = await this.checkLayoutShifts();
      
      // Process issues and calculate score
      const issues = this.processIssues(accessibilityReport.issues, componentId);
      
      // Calculate metrics
      const contrastIssues = accessibilityReport.issues.filter(i => i.subtype === 'contrast').length;
      const overflowIssues = accessibilityReport.issues.filter(i => i.subtype === 'overflow').length;
      const responsiveIssues = accessibilityReport.issues.filter(i => i.subtype === 'fixed-width').length;
      
      // Calculate accessibility score (0-100)
      const rawAccessibilityScore = 100 - (issues.length * 10);
      const accessibilityScore = Math.max(0, Math.min(100, rawAccessibilityScore));
      
      // Calculate overall score
      // 50% accessibility, 20% layout shifts, 15% overflow, 15% responsive
      const totalElements = accessibilityReport.totalElements || 1; // Avoid division by zero
      const score = Math.round(
        (accessibilityScore * 0.5) + 
        (Math.max(0, 100 - (layoutShifts * 20)) * 0.2) + 
        (Math.max(0, 100 - (overflowIssues / totalElements * 100)) * 0.15) + 
        (Math.max(0, 100 - (responsiveIssues / totalElements * 100)) * 0.15)
      );
      
      // Save analysis results
      const resultsPath = path.join(this.outputDir, `${componentId}-analysis.json`);
      const result: VisualAnalysisResult = {
        score: Math.min(100, score),
        maxScore: 100,
        issues,
        metrics: {
          layoutShifts,
          contrastIssues,
          overflowIssues,
          responsiveIssues,
          accessibilityScore
        },
        snapshotPath
      };
      
      await fs.writeFile(
        path.resolve(resultsPath), 
        JSON.stringify(result, null, 2)
      );
      
      return result;
    } catch (error) {
      console.error('Visual analysis failed:', error);
      
      // Return a failure result
      return {
        score: 0,
        maxScore: 100,
        issues: [{
          id: `${componentId}-visual-error`,
          title: 'Visual analysis failed',
          description: `Error: ${error instanceof Error ? error.message : String(error)}`,
          severity: SeverityLevel.ERROR,
          recommendations: [
            'Check if the component renders correctly',
            'Verify that the component HTML and CSS are valid'
          ]
        }],
        metrics: {
          layoutShifts: 0,
          contrastIssues: 0,
          overflowIssues: 0,
          responsiveIssues: 0,
          accessibilityScore: 0
        }
      };
    }
  }
  
  /**
   * Check for layout shifts by resizing the viewport
   */
  private async checkLayoutShifts(): Promise<number> {
    if (!this.page) {
      throw new Error('Visual analyzer not initialized');
    }
    
    // Measure positions of elements at different viewport widths
    const viewportWidths = [1280, 768, 375];
    let totalLayoutShifts = 0;
    
    try {
      for (let i = 0; i < viewportWidths.length - 1; i++) {
        // Set first viewport width
        await this.page.setViewport({
          width: viewportWidths[i],
          height: 800
        });
        
        // Get positions of elements
        const positions1 = await this.page.evaluate(() => {
          return Array.from(document.querySelectorAll('#component-root *')).map(el => {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            };
          });
        });
        
        // Change viewport width
        await this.page.setViewport({
          width: viewportWidths[i + 1],
          height: 800
        });
        
        // Get new positions
        const positions2 = await this.page.evaluate(() => {
          return Array.from(document.querySelectorAll('#component-root *')).map(el => {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            };
          });
        });
        
        // Compare positions to detect layout shifts
        // Only consider shifts on Y axis as significant relative to viewport change ratio
        const viewportRatio = viewportWidths[i] / viewportWidths[i + 1];
        
        for (let j = 0; j < Math.min(positions1.length, positions2.length); j++) {
          const pos1 = positions1[j];
          const pos2 = positions2[j];
          
          // Calculate normalized position change
          // Ignore X position changes as they're expected during responsive behavior
          const yShift = Math.abs(pos1.y - (pos2.y * viewportRatio));
          
          if (yShift > 20) { // Consider shifts greater than 20px as significant
            totalLayoutShifts++;
          }
        }
      }
      
      return totalLayoutShifts;
    } catch (error) {
      console.error('Layout shift analysis failed:', error);
      return 0;
    }
  }
  
  /**
   * Process raw issues into structured visual issues
   */
  private processIssues(
    rawIssues: any[], 
    componentId: string
  ): VisualIssue[] {
    return rawIssues.map((issue, index) => {
      const issueId = `${componentId}-visual-${issue.type}-${index}`;
      
      let title = '';
      let description = '';
      let severity = SeverityLevel.LOW;
      let recommendations: string[] = [];
      
      switch (issue.type) {
        case 'accessibility':
          switch (issue.subtype) {
            case 'alt-text':
              title = 'Missing alt text on images';
              description = `${issue.elements} image(s) are missing alt text attributes, which makes them inaccessible to screen readers.`;
              severity = SeverityLevel.CRITICAL;
              recommendations = [
                'Add descriptive alt text to all images',
                'Use empty alt="" for decorative images'
              ];
              break;
              
            case 'button-name':
              title = 'Buttons without accessible names';
              description = `${issue.elements} button(s) are missing accessible names, making their purpose unclear to assistive technology users.`;
              severity = SeverityLevel.CRITICAL;
              recommendations = [
                'Add text content to buttons',
                'Use aria-label for icon-only buttons'
              ];
              break;
              
            case 'contrast':
              title = 'Color contrast issues';
              description = `${issue.elements} element(s) have insufficient color contrast, making text difficult to read for users with visual impairments.`;
              severity = SeverityLevel.HIGH;
              recommendations = [
                'Increase contrast ratio to at least 4.5:1 for normal text',
                'Use darker text colors on light backgrounds or vice versa'
              ];
              break;
          }
          break;
          
        case 'layout':
          title = 'Overflow issues';
          description = `${issue.elements} element(s) overflow their containers, potentially causing layout issues.`;
          severity = SeverityLevel.MEDIUM;
          recommendations = [
            'Add overflow handling to containers',
            'Use relative sizing to ensure content fits within containers',
            'Test component at various screen sizes'
          ];
          break;
          
        case 'responsive':
          title = 'Fixed width elements';
          description = `${issue.elements} element(s) use fixed widths, which can cause responsive layout issues on smaller screens.`;
          severity = SeverityLevel.MEDIUM;
          recommendations = [
            'Use relative units (%, rem, em) instead of pixels for width',
            'Add max-width constraints instead of fixed width',
            'Implement a responsive grid system'
          ];
          break;
      }
      
      return {
        id: issueId,
        title,
        description,
        severity,
        recommendations
      };
    });
  }
}

export default VisualAnalyzer; 