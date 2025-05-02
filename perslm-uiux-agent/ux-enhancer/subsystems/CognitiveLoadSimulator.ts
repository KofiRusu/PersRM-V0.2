import fs from 'fs/promises';
import path from 'path';
import { SeverityLevel } from '../types';

export interface CognitiveLoadResult {
  score: number;
  maxScore: number;
  issues: CognitiveLoadIssue[];
  metrics: {
    estimatedTaskTime: number;
    informationDensity: number;
    interactionComplexity: number;
    visualClutter: number;
    mentalModelMatch: number;
  };
  tasks: CognitiveTask[];
}

export interface CognitiveLoadIssue {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  taskId?: string;
  recommendations: string[];
}

export interface CognitiveTask {
  id: string;
  name: string;
  description: string;
  timeEstimate: number;
  complexity: 'low' | 'medium' | 'high';
  steps: TaskStep[];
}

export interface TaskStep {
  action: string;
  target: string;
  timeEstimate: number;
  mentalOperators: string[];
}

export class CognitiveLoadSimulator {
  private outputDir: string = '.tmp/ux-results/cognitive';
  
  // Constants for KLM (Keystroke-Level Model) time estimates in milliseconds
  private readonly KLM = {
    K: 280,   // Keystroke
    P: 1100,  // Pointing to a target
    B: 100,   // Button press
    H: 400,   // Home (moving hand between keyboard and mouse)
    M: 1200,  // Mental preparation
    R: 100    // System response time (varies greatly)
  };
  
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
   * Estimate time to complete tasks on the component
   * @param componentHtml The HTML markup of the component
   * @param componentId Unique identifier for the component
   */
  async estimateTaskTime(
    componentHtml: string,
    componentId: string
  ): Promise<CognitiveTask[]> {
    try {
      // Identify interactive elements
      const interactiveElements = this.identifyInteractiveElements(componentHtml);
      
      // Generate common tasks based on interactive elements
      const tasks = this.generateTasks(interactiveElements, componentId);
      
      // Save task data to file
      const tasksPath = path.join(this.outputDir, `${componentId}-tasks.json`);
      await fs.writeFile(
        path.resolve(tasksPath),
        JSON.stringify(tasks, null, 2)
      );
      
      return tasks;
    } catch (error) {
      console.error('Task time estimation failed:', error);
      return [];
    }
  }
  
  /**
   * Analyze cognitive load of a component
   * @param componentHtml The HTML markup of the component
   * @param componentId Unique identifier for the component
   */
  async analyzeCognitiveLoad(
    componentHtml: string,
    componentId: string
  ): Promise<CognitiveLoadResult> {
    try {
      // Identify interactive elements
      const interactiveElements = this.identifyInteractiveElements(componentHtml);
      
      // If no interactive elements, return a simple result
      if (interactiveElements.length === 0) {
        return {
          score: 90, // Still not perfect since we can't fully verify
          maxScore: 100,
          issues: [],
          metrics: {
            estimatedTaskTime: 0,
            informationDensity: this.calculateInformationDensity(componentHtml),
            interactionComplexity: 0,
            visualClutter: this.calculateVisualClutter(componentHtml),
            mentalModelMatch: 95 // Assume good if no interactions
          },
          tasks: []
        };
      }
      
      // Generate common tasks based on interactive elements
      const tasks = this.generateTasks(interactiveElements, componentId);
      
      // Calculate metrics
      const estimatedTaskTime = tasks.reduce((sum, task) => sum + task.timeEstimate, 0);
      const informationDensity = this.calculateInformationDensity(componentHtml);
      const interactionComplexity = this.calculateInteractionComplexity(tasks);
      const visualClutter = this.calculateVisualClutter(componentHtml);
      const mentalModelMatch = this.calculateMentalModelMatch(componentHtml, tasks);
      
      // Generate issues
      const issues = this.generateIssues(tasks, componentHtml, componentId);
      
      // Calculate score (0-100)
      // Lower is better for time, density, complexity, and clutter
      // Higher is better for mental model match
      const timeScore = Math.max(0, 100 - (estimatedTaskTime / 1000) * 5); // Penalize over 20s
      const densityScore = Math.max(0, 100 - informationDensity);
      const complexityScore = Math.max(0, 100 - interactionComplexity * 20); // 5 = 0 score
      const clutterScore = Math.max(0, 100 - visualClutter);
      const mentalModelScore = mentalModelMatch;
      
      const score = Math.round(
        (timeScore * 0.25) +
        (densityScore * 0.2) +
        (complexityScore * 0.2) +
        (clutterScore * 0.15) +
        (mentalModelScore * 0.2)
      );
      
      const result: CognitiveLoadResult = {
        score: Math.min(100, score),
        maxScore: 100,
        issues,
        metrics: {
          estimatedTaskTime,
          informationDensity,
          interactionComplexity,
          visualClutter,
          mentalModelMatch
        },
        tasks
      };
      
      // Save analysis results
      const resultsPath = path.join(this.outputDir, `${componentId}-analysis.json`);
      await fs.writeFile(
        path.resolve(resultsPath),
        JSON.stringify(result, null, 2)
      );
      
      return result;
    } catch (error) {
      console.error('Cognitive load analysis failed:', error);
      
      // Return a failure result
      return {
        score: 0,
        maxScore: 100,
        issues: [{
          id: `${componentId}-cognitive-error`,
          title: 'Cognitive load analysis failed',
          description: `Error: ${error instanceof Error ? error.message : String(error)}`,
          severity: SeverityLevel.ERROR,
          recommendations: [
            'Check if the component renders correctly',
            'Verify that the component HTML is valid'
          ]
        }],
        metrics: {
          estimatedTaskTime: 0,
          informationDensity: 0,
          interactionComplexity: 0,
          visualClutter: 0,
          mentalModelMatch: 0
        },
        tasks: []
      };
    }
  }
  
  /**
   * Identify interactive elements in the component
   */
  private identifyInteractiveElements(html: string): any[] {
    // This would typically analyze the DOM to find interactive elements
    // For this implementation, we'll use regex to find common patterns
    
    const elements: any[] = [];
    
    // Look for buttons
    const buttonPattern = /<button[^>]*>(.*?)<\/button>/g;
    let match;
    while ((match = buttonPattern.exec(html)) !== null) {
      elements.push({
        type: 'button',
        text: this.stripTags(match[1]),
        disabled: match[0].includes('disabled'),
        ariaLabel: this.extractAttribute(match[0], 'aria-label'),
        hasIcon: match[1].includes('<svg') || match[1].includes('<i')
      });
    }
    
    // Look for inputs
    const inputPattern = /<input[^>]*>/g;
    while ((match = inputPattern.exec(html)) !== null) {
      const type = this.extractAttribute(match[0], 'type') || 'text';
      elements.push({
        type: `input-${type}`,
        placeholder: this.extractAttribute(match[0], 'placeholder'),
        required: match[0].includes('required'),
        disabled: match[0].includes('disabled'),
        ariaLabel: this.extractAttribute(match[0], 'aria-label')
      });
    }
    
    // Look for selects
    const selectPattern = /<select[^>]*>(.*?)<\/select>/gs;
    while ((match = selectPattern.exec(html)) !== null) {
      const optionPattern = /<option[^>]*>(.*?)<\/option>/g;
      const options: string[] = [];
      let optionMatch;
      while ((optionMatch = optionPattern.exec(match[1])) !== null) {
        options.push(this.stripTags(optionMatch[1]));
      }
      
      elements.push({
        type: 'select',
        options: options.length,
        disabled: match[0].includes('disabled'),
        ariaLabel: this.extractAttribute(match[0], 'aria-label')
      });
    }
    
    // Look for checkboxes and radio buttons
    const checkboxPattern = /<input[^>]*type=["'](?:checkbox|radio)["'][^>]*>/g;
    while ((match = checkboxPattern.exec(html)) !== null) {
      const type = this.extractAttribute(match[0], 'type');
      elements.push({
        type: type,
        checked: match[0].includes('checked'),
        disabled: match[0].includes('disabled'),
        ariaLabel: this.extractAttribute(match[0], 'aria-label')
      });
    }
    
    // Look for links
    const linkPattern = /<a[^>]*>(.*?)<\/a>/g;
    while ((match = linkPattern.exec(html)) !== null) {
      elements.push({
        type: 'link',
        text: this.stripTags(match[1]),
        href: this.extractAttribute(match[0], 'href'),
        hasIcon: match[1].includes('<svg') || match[1].includes('<i')
      });
    }
    
    return elements;
  }
  
  /**
   * Strip HTML tags from a string
   */
  private stripTags(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }
  
  /**
   * Extract attribute value from an HTML tag
   */
  private extractAttribute(tag: string, attribute: string): string | null {
    const pattern = new RegExp(`${attribute}=["']([^"']*)["']`);
    const match = tag.match(pattern);
    return match ? match[1] : null;
  }
  
  /**
   * Generate common tasks based on interactive elements
   */
  private generateTasks(
    interactiveElements: any[],
    componentId: string
  ): CognitiveTask[] {
    const tasks: CognitiveTask[] = [];
    
    // Group elements by type
    const buttons = interactiveElements.filter(el => el.type === 'button');
    const textInputs = interactiveElements.filter(el => el.type === 'input-text');
    const selects = interactiveElements.filter(el => el.type === 'select');
    const checkboxes = interactiveElements.filter(el => el.type === 'checkbox');
    const radios = interactiveElements.filter(el => el.type === 'radio');
    
    // Generate form filling task if there are inputs
    if (textInputs.length > 0) {
      const steps: TaskStep[] = [];
      
      // Add steps for each text input
      textInputs.forEach((input, index) => {
        steps.push({
          action: 'click',
          target: `text input ${index + 1}`,
          timeEstimate: this.KLM.P + this.KLM.B,
          mentalOperators: ['target acquisition']
        });
        
        steps.push({
          action: 'type',
          target: `text into input ${index + 1}`,
          timeEstimate: this.KLM.M + (this.KLM.K * 10), // Assume 10 characters
          mentalOperators: ['recall information', 'formulate input']
        });
      });
      
      // Add steps for selects
      selects.forEach((select, index) => {
        steps.push({
          action: 'click',
          target: `select dropdown ${index + 1}`,
          timeEstimate: this.KLM.P + this.KLM.B,
          mentalOperators: ['target acquisition']
        });
        
        steps.push({
          action: 'select',
          target: `option from dropdown ${index + 1}`,
          timeEstimate: this.KLM.M + this.KLM.P + this.KLM.B,
          mentalOperators: ['visual search', 'decision making']
        });
      });
      
      // Add steps for checkboxes and radios
      const checkablesLength = checkboxes.length + radios.length;
      if (checkablesLength > 0) {
        steps.push({
          action: 'read',
          target: 'checkbox/radio options',
          timeEstimate: this.KLM.M * Math.min(5, checkablesLength),
          mentalOperators: ['comprehension', 'decision making']
        });
        
        for (let i = 0; i < checkablesLength; i++) {
          steps.push({
            action: 'click',
            target: `checkbox/radio option ${i + 1}`,
            timeEstimate: this.KLM.P + this.KLM.B,
            mentalOperators: ['target acquisition']
          });
        }
      }
      
      // Add submit button step if present
      const submitButton = buttons.find(b => 
        (b.text || '').toLowerCase().includes('submit') || 
        (b.text || '').toLowerCase().includes('save')
      );
      
      if (submitButton) {
        steps.push({
          action: 'click',
          target: 'submit button',
          timeEstimate: this.KLM.M + this.KLM.P + this.KLM.B,
          mentalOperators: ['target acquisition', 'verification']
        });
      }
      
      // Calculate total time
      const totalTime = steps.reduce((sum, step) => sum + step.timeEstimate, 0);
      
      // Determine complexity
      let complexity: 'low' | 'medium' | 'high' = 'low';
      if (steps.length > 10) {
        complexity = 'high';
      } else if (steps.length > 5) {
        complexity = 'medium';
      }
      
      tasks.push({
        id: `${componentId}-task-form`,
        name: 'Complete form',
        description: 'Fill out and submit the form',
        timeEstimate: totalTime,
        complexity,
        steps
      });
    }
    
    // Generate navigation task if there are links
    const links = interactiveElements.filter(el => el.type === 'link');
    if (links.length > 0) {
      const steps: TaskStep[] = [];
      
      // Add read step
      steps.push({
        action: 'read',
        target: 'navigation options',
        timeEstimate: this.KLM.M * Math.min(5, links.length),
        mentalOperators: ['visual search', 'comprehension']
      });
      
      // Add click step
      steps.push({
        action: 'click',
        target: 'selected link',
        timeEstimate: this.KLM.M + this.KLM.P + this.KLM.B,
        mentalOperators: ['decision making', 'target acquisition']
      });
      
      // Calculate total time
      const totalTime = steps.reduce((sum, step) => sum + step.timeEstimate, 0);
      
      tasks.push({
        id: `${componentId}-task-navigation`,
        name: 'Navigate to section',
        description: 'Identify and click the appropriate navigation link',
        timeEstimate: totalTime,
        complexity: links.length > 5 ? 'medium' : 'low',
        steps
      });
    }
    
    // Generate interaction task for remaining buttons
    if (buttons.length > 0) {
      const steps: TaskStep[] = [];
      
      // Add read step if multiple buttons
      if (buttons.length > 1) {
        steps.push({
          action: 'read',
          target: 'available actions',
          timeEstimate: this.KLM.M * Math.min(5, buttons.length),
          mentalOperators: ['visual search', 'comprehension']
        });
      }
      
      // Add click step
      steps.push({
        action: 'click',
        target: 'action button',
        timeEstimate: this.KLM.M + this.KLM.P + this.KLM.B,
        mentalOperators: ['decision making', 'target acquisition']
      });
      
      // Calculate total time
      const totalTime = steps.reduce((sum, step) => sum + step.timeEstimate, 0);
      
      tasks.push({
        id: `${componentId}-task-action`,
        name: 'Perform action',
        description: 'Select and activate a button',
        timeEstimate: totalTime,
        complexity: buttons.length > 5 ? 'medium' : 'low',
        steps
      });
    }
    
    return tasks;
  }
  
  /**
   * Calculate information density from HTML
   */
  private calculateInformationDensity(html: string): number {
    // Count text elements and their length
    const textPattern = /<(?:p|h[1-6]|span|div|li|td|th)[^>]*>(.*?)<\/(?:p|h[1-6]|span|div|li|td|th)>/gs;
    let totalText = '';
    let match;
    
    while ((match = textPattern.exec(html)) !== null) {
      totalText += this.stripTags(match[1]) + ' ';
    }
    
    // Count interactive elements
    const interactiveElements = this.identifyInteractiveElements(html);
    
    // Count images
    const imagePattern = /<img[^>]*>/g;
    const imageCount = (html.match(imagePattern) || []).length;
    
    // Count icons
    const iconPattern = /<(?:svg|i)[^>]*>|class=["'][^"']*(?:icon|svg)[^"']*["']/g;
    const iconCount = (html.match(iconPattern) || []).length;
    
    // Calculate total elements
    const totalElements = (html.match(/<[^>]*>/g) || []).length;
    
    // Calculate word count
    const words = totalText.trim().split(/\s+/).filter(Boolean);
    
    // Calculate information density
    // Higher values indicate more information packed into the component
    const density = (
      (words.length * 0.5) + 
      (interactiveElements.length * 2) + 
      (imageCount * 3) + 
      (iconCount * 1)
    ) / Math.max(1, totalElements / 10);
    
    return Math.min(100, Math.round(density));
  }
  
  /**
   * Calculate interaction complexity from tasks
   */
  private calculateInteractionComplexity(tasks: CognitiveTask[]): number {
    if (tasks.length === 0) {
      return 0;
    }
    
    // Count total steps across all tasks
    const totalSteps = tasks.reduce((sum, task) => sum + task.steps.length, 0);
    
    // Count mental operators
    const totalMentalOperators = tasks.reduce((sum, task) => {
      return sum + task.steps.reduce((opSum, step) => opSum + step.mentalOperators.length, 0);
    }, 0);
    
    // Count high complexity tasks
    const highComplexityTasks = tasks.filter(task => task.complexity === 'high').length;
    
    // Calculate complexity score (0-5 scale)
    // Higher values indicate more complex interactions
    const complexity = (
      (totalSteps / tasks.length * 0.4) + 
      (totalMentalOperators / tasks.length * 0.4) + 
      (highComplexityTasks * 1.0)
    ) / 10 * 5;
    
    return Math.min(5, Math.round(complexity * 10) / 10);
  }
  
  /**
   * Calculate visual clutter from HTML
   */
  private calculateVisualClutter(html: string): number {
    // Count total elements
    const totalElements = (html.match(/<[^>]*>/g) || []).length;
    
    // Count nested levels
    const maxNestingLevel = this.calculateMaxNestingLevel(html);
    
    // Count different styles/classes
    const classPattern = /class=["']([^"']*)["']/g;
    const classes = new Set<string>();
    let match;
    
    while ((match = classPattern.exec(html)) !== null) {
      match[1].split(/\s+/).filter(Boolean).forEach(cls => classes.add(cls));
    }
    
    // Count inline styles
    const stylePattern = /style=["'][^"']*["']/g;
    const inlineStyleCount = (html.match(stylePattern) || []).length;
    
    // Calculate clutter score (0-100)
    // Higher values indicate more visual clutter
    const clutter = (
      (totalElements * 0.2) + 
      (maxNestingLevel * 2) + 
      (classes.size * 0.5) + 
      (inlineStyleCount * 2)
    );
    
    return Math.min(100, Math.round(clutter));
  }
  
  /**
   * Calculate maximum nesting level in HTML
   */
  private calculateMaxNestingLevel(html: string): number {
    // Simplified approach - count consecutive opening tags
    const tags = html.match(/<[^/][^>]*>/g) || [];
    let maxConsecutive = 0;
    let current = 0;
    
    for (let i = 0; i < html.length; i++) {
      if (html.substr(i, 1) === '<' && html.substr(i, 2) !== '</') {
        current++;
        maxConsecutive = Math.max(maxConsecutive, current);
      } else if (html.substr(i, 2) === '</') {
        current = Math.max(0, current - 1);
      }
    }
    
    return maxConsecutive;
  }
  
  /**
   * Calculate mental model match
   */
  private calculateMentalModelMatch(html: string, tasks: CognitiveTask[]): number {
    // Count standard patterns vs. non-standard ones
    const interactiveElements = this.identifyInteractiveElements(html);
    
    // Check for proper labels on form elements
    const inputsWithLabels = interactiveElements.filter(el => 
      (el.type.startsWith('input') || el.type === 'select') && 
      (el.ariaLabel || el.placeholder)
    ).length;
    
    const totalInputs = interactiveElements.filter(el => 
      el.type.startsWith('input') || el.type === 'select'
    ).length;
    
    // Check for clear button text
    const buttonsWithClearText = interactiveElements.filter(el => 
      el.type === 'button' && el.text && el.text.trim().length > 0 && !el.text.includes('btn-')
    ).length;
    
    const totalButtons = interactiveElements.filter(el => el.type === 'button').length;
    
    // Check for icons with accessibility attributes
    const accessibleIcons = interactiveElements.filter(el => 
      el.hasIcon && el.ariaLabel
    ).length;
    
    const totalIconButtons = interactiveElements.filter(el => el.hasIcon).length;
    
    // Calculate match percentage
    let matchScore = 100;
    
    if (totalInputs > 0) {
      matchScore -= (1 - (inputsWithLabels / totalInputs)) * 30;
    }
    
    if (totalButtons > 0) {
      matchScore -= (1 - (buttonsWithClearText / totalButtons)) * 30;
    }
    
    if (totalIconButtons > 0) {
      matchScore -= (1 - (accessibleIcons / totalIconButtons)) * 20;
    }
    
    // Penalize for high complexity tasks
    const highComplexityTasks = tasks.filter(task => task.complexity === 'high').length;
    matchScore -= highComplexityTasks * 10;
    
    return Math.max(0, Math.min(100, Math.round(matchScore)));
  }
  
  /**
   * Generate issues based on analysis
   */
  private generateIssues(
    tasks: CognitiveTask[],
    html: string,
    componentId: string
  ): CognitiveLoadIssue[] {
    const issues: CognitiveLoadIssue[] = [];
    
    // Check for long task times
    tasks.forEach(task => {
      if (task.timeEstimate > 10000) { // 10 seconds
        issues.push({
          id: `${componentId}-cognitive-time-${task.id}`,
          title: 'High task completion time',
          description: `Task "${task.name}" has an estimated completion time of ${(task.timeEstimate / 1000).toFixed(1)} seconds, which may frustrate users.`,
          severity: SeverityLevel.MEDIUM,
          taskId: task.id,
          recommendations: [
            'Break complex tasks into smaller steps',
            'Provide shortcuts for experienced users',
            'Reduce the number of required inputs'
          ]
        });
      }
    });
    
    // Check interaction complexity
    const interactionComplexity = this.calculateInteractionComplexity(tasks);
    if (interactionComplexity > 3) {
      issues.push({
        id: `${componentId}-cognitive-complexity`,
        title: 'High interaction complexity',
        description: 'The component requires complex interaction patterns that may increase cognitive load.',
        severity: SeverityLevel.HIGH,
        recommendations: [
          'Simplify user flow by reducing required steps',
          'Provide clear feedback at each step',
          'Consider splitting functionality across multiple screens'
        ]
      });
    }
    
    // Check information density
    const informationDensity = this.calculateInformationDensity(html);
    if (informationDensity > 70) {
      issues.push({
        id: `${componentId}-cognitive-density`,
        title: 'High information density',
        description: 'The component contains too much information, which may overwhelm users.',
        severity: SeverityLevel.MEDIUM,
        recommendations: [
          'Reduce the amount of information presented at once',
          'Group related information visually',
          'Use progressive disclosure techniques',
          'Consider splitting content across multiple views'
        ]
      });
    }
    
    // Check visual clutter
    const visualClutter = this.calculateVisualClutter(html);
    if (visualClutter > 60) {
      issues.push({
        id: `${componentId}-cognitive-clutter`,
        title: 'Excessive visual clutter',
        description: 'The component has high visual complexity, which may distract users and increase cognitive load.',
        severity: SeverityLevel.MEDIUM,
        recommendations: [
          'Increase white space between elements',
          'Reduce the number of visual elements',
          'Use consistent styling',
          'Remove decorative elements that don\'t add value'
        ]
      });
    }
    
    // Check mental model match
    const mentalModelMatch = this.calculateMentalModelMatch(html, tasks);
    if (mentalModelMatch < 70) {
      issues.push({
        id: `${componentId}-cognitive-mental-model`,
        title: 'Poor mental model match',
        description: 'The component may not align with users\' expectations, leading to confusion and errors.',
        severity: SeverityLevel.HIGH,
        recommendations: [
          'Follow established UI patterns',
          'Provide clear labels for all interactive elements',
          'Use familiar icons and symbols',
          'Test with real users to identify confusing elements'
        ]
      });
    }
    
    // Check for missing labels
    const interactiveElements = this.identifyInteractiveElements(html);
    const missingLabels = interactiveElements.filter(el => 
      (el.type.startsWith('input') || el.type === 'select') && 
      !el.ariaLabel && !el.placeholder
    );
    
    if (missingLabels.length > 0) {
      issues.push({
        id: `${componentId}-cognitive-labels`,
        title: 'Missing input labels',
        description: `${missingLabels.length} form element(s) lack clear labels, which may confuse users.`,
        severity: SeverityLevel.HIGH,
        recommendations: [
          'Add descriptive labels to all form fields',
          'Use aria-label for elements without visible labels',
          'Ensure placeholder text is not used as a replacement for labels'
        ]
      });
    }
    
    return issues;
  }
}

export default CognitiveLoadSimulator; 