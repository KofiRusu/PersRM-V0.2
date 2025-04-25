import { retentionService, EventData } from './retention';

export interface AdaptationRule {
  id: string;
  name: string;
  description: string;
  condition: (events: EventData[], context: Record<string, any>) => boolean;
  action: (context: Record<string, any>) => Promise<void>;
  priority: number;
  isEnabled: boolean;
  lastTriggered?: Date;
}

export interface AdaptationPreference {
  key: string;
  value: any;
  updatedAt: Date;
}

export type AssistantFeature = 
  | 'panel-size'
  | 'animation-variant'
  | 'keyboard-shortcut'
  | 'auto-open-triggers'
  | 'theme';

export interface FeatureUsagePattern {
  feature: AssistantFeature;
  usageCount: number;
  lastUsed: Date;
  preferredValue?: any;
}

class AutoAdaptationService {
  private adaptationRules: Map<string, AdaptationRule> = new Map();
  private preferences: Map<string, AdaptationPreference> = new Map();
  private featureUsage: Map<AssistantFeature, FeatureUsagePattern> = new Map();
  private isInitialized: boolean = false;
  private lastAnalysisTime: Date | null = null;
  private defaultsSet: boolean = false;
  
  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Load saved preferences from localStorage
    this.loadPreferences();
    
    // Set default rules if no custom rules exist
    this.setDefaultRules();
    
    // Load feature usage patterns
    this.loadFeatureUsage();
    
    this.isInitialized = true;
    
    // Log initialization
    retentionService.trackEvent('auto-adaptation-initialized', {
      ruleCount: this.adaptationRules.size,
      preferencesCount: this.preferences.size,
    });
  }
  
  /**
   * Register an adaptation rule
   */
  public registerRule(rule: AdaptationRule): void {
    this.adaptationRules.set(rule.id, rule);
    
    // Log rule registration
    retentionService.trackEvent('adaptation-rule-registered', {
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      isEnabled: rule.isEnabled,
    });
  }
  
  /**
   * Set a preference value
   */
  public setPreference(key: string, value: any): void {
    this.preferences.set(key, {
      key,
      value,
      updatedAt: new Date(),
    });
    
    // Save to localStorage
    this.savePreferences();
    
    // Log preference change
    retentionService.trackEvent('adaptation-preference-set', {
      key,
      value,
    });
  }
  
  /**
   * Get a preference value
   */
  public getPreference<T>(key: string, defaultValue: T): T {
    const preference = this.preferences.get(key);
    return preference ? preference.value : defaultValue;
  }
  
  /**
   * Track feature usage
   */
  public trackFeatureUsage(feature: AssistantFeature, value?: any): void {
    const now = new Date();
    const usage = this.featureUsage.get(feature) || {
      feature,
      usageCount: 0,
      lastUsed: now,
    };
    
    // Update usage pattern
    usage.usageCount++;
    usage.lastUsed = now;
    
    // Update preferred value if provided
    if (value !== undefined) {
      usage.preferredValue = value;
    }
    
    this.featureUsage.set(feature, usage);
    
    // Save to localStorage
    this.saveFeatureUsage();
    
    // Log feature usage
    retentionService.trackEvent('feature-usage', {
      feature,
      value,
      usageCount: usage.usageCount,
    });
  }
  
  /**
   * Get feature usage pattern
   */
  public getFeatureUsage(feature: AssistantFeature): FeatureUsagePattern | null {
    return this.featureUsage.get(feature) || null;
  }
  
  /**
   * Run adaptation analysis
   * This checks all rules and applies appropriate adaptations
   */
  public async analyzeAndAdapt(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Get recent events for analysis
    const events = await this.getRecentEvents();
    
    // Create context for rule evaluation
    const context: Record<string, any> = {
      preferences: Object.fromEntries(this.preferences.entries()),
      featureUsage: Object.fromEntries(this.featureUsage.entries()),
      currentTime: new Date(),
    };
    
    // Sort rules by priority (higher first)
    const sortedRules = Array.from(this.adaptationRules.values())
      .filter(rule => rule.isEnabled)
      .sort((a, b) => b.priority - a.priority);
    
    // Evaluate and apply rules
    for (const rule of sortedRules) {
      try {
        // Check if rule condition is met
        if (rule.condition(events, context)) {
          // Apply rule action
          await rule.action(context);
          
          // Update last triggered time
          rule.lastTriggered = new Date();
          
          // Log rule trigger
          retentionService.trackEvent('adaptation-rule-triggered', {
            ruleId: rule.id,
            ruleName: rule.name,
          });
        }
      } catch (error) {
        console.error(`Error processing adaptation rule ${rule.id}:`, error);
      }
    }
    
    this.lastAnalysisTime = new Date();
    
    // Log adaptation analysis
    retentionService.trackEvent('adaptation-analysis-completed', {
      rulesEvaluated: sortedRules.length,
      timestamp: this.lastAnalysisTime.toISOString(),
    });
  }
  
  /**
   * Determine the best animation variant based on user usage patterns
   */
  public getBestAnimationVariant(): 'slide' | 'fade' | 'scale' {
    const usage = this.getFeatureUsage('animation-variant');
    
    if (usage?.preferredValue) {
      return usage.preferredValue;
    }
    
    // Default to slide
    return 'slide';
  }
  
  /**
   * Determine the optimal panel size based on usage
   */
  public getOptimalPanelSize(): { width: number; height: string } {
    const panelSizePref = this.getPreference<{ width: number; height: string }>(
      'panel-size',
      { width: 320, height: '100%' }
    );
    
    return panelSizePref;
  }
  
  /**
   * Get preferred keyboard shortcut
   */
  public getPreferredKeyboardShortcut(): string {
    return this.getPreference<string>('keyboard-shortcut', 'k');
  }
  
  /**
   * Check if the assistant should auto-open based on context
   */
  public shouldAutoOpen(context: Record<string, any>): boolean {
    // Get auto-open triggers preference
    const triggers = this.getPreference<string[]>('auto-open-triggers', []);
    
    // Check if any trigger matches the current context
    for (const trigger of triggers) {
      if (context[trigger]) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Set default adaptation rules
   */
  private setDefaultRules(): void {
    if (this.defaultsSet) return;
    
    // Example rule: Adjust panel size based on repeated resizing
    this.registerRule({
      id: 'panel-size-adaptation',
      name: 'Panel Size Adaptation',
      description: 'Adjusts the default panel size based on user resizing patterns',
      priority: 10,
      isEnabled: true,
      condition: (events, context) => {
        // Check for multiple resize events
        const resizeEvents = events.filter(e => e.eventType === 'assistant-panel-resize');
        return resizeEvents.length >= 3;
      },
      action: async (context) => {
        // Find most common size in resize events
        const events = await this.getEventsByType('assistant-panel-resize', 10);
        
        if (events.length > 0) {
          // Extract size information from events
          const sizes = events.map(e => e.metadata?.size).filter(Boolean);
          
          if (sizes.length > 0) {
            // Use most recent size as preferred
            const mostRecentSize = sizes[0];
            this.setPreference('panel-size', mostRecentSize);
          }
        }
      }
    });
    
    // Rule: Adapt keyboard shortcut based on usage patterns
    this.registerRule({
      id: 'keyboard-shortcut-adaptation',
      name: 'Keyboard Shortcut Adaptation',
      description: 'Adapts keyboard shortcuts based on frequent usage patterns',
      priority: 5,
      isEnabled: true,
      condition: (events, context) => {
        // Look for keyboard usage events
        const keyboardEvents = events.filter(e => 
          e.eventType === 'assistant' && 
          e.metadata?.source === 'keyboard'
        );
        return keyboardEvents.length >= 5;
      },
      action: async (context) => {
        // Default to 'k' if no clear pattern emerges
        this.setPreference('keyboard-shortcut', 'k');
      }
    });
    
    // Rule: Adapt animation variant based on performance and user preferences
    this.registerRule({
      id: 'animation-variant-adaptation',
      name: 'Animation Variant Adaptation',
      description: 'Selects the optimal animation variant based on device performance and user preference',
      priority: 8,
      isEnabled: true,
      condition: (events, context) => {
        // Check if we have enough panel interaction data
        const interactionEvents = events.filter(e => e.eventType === 'ab-test-panel-interaction');
        return interactionEvents.length >= 10;
      },
      action: async (context) => {
        // Analyze which variant gets the most interactions
        const events = await this.getEventsByType('ab-test-panel-interaction', 20);
        
        // Count by variant
        const variantCounts: Record<string, number> = {};
        
        events.forEach(e => {
          const variant = e.metadata?.animationVariant || 'slide';
          variantCounts[variant] = (variantCounts[variant] || 0) + 1;
        });
        
        // Find the most popular variant
        let bestVariant: 'slide' | 'fade' | 'scale' = 'slide';
        let maxCount = 0;
        
        Object.entries(variantCounts).forEach(([variant, count]) => {
          if (count > maxCount) {
            maxCount = count;
            bestVariant = variant as 'slide' | 'fade' | 'scale';
          }
        });
        
        // Update feature usage with preferred variant
        this.trackFeatureUsage('animation-variant', bestVariant);
      }
    });
    
    this.defaultsSet = true;
  }
  
  /**
   * Get recent events for adaptation analysis
   */
  private async getRecentEvents(limit: number = 100): Promise<EventData[]> {
    // For now, use the retention service local cache
    return retentionService.getEvents();
  }
  
  /**
   * Get events by specific type
   */
  private async getEventsByType(eventType: string, limit: number = 20): Promise<EventData[]> {
    const events = retentionService.getEvents();
    return events
      .filter(e => e.eventType === eventType)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
  
  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): void {
    try {
      const savedPreferences = localStorage.getItem('adaptation-preferences');
      
      if (savedPreferences) {
        const preferences = JSON.parse(savedPreferences);
        
        Object.entries(preferences).forEach(([key, value]) => {
          this.preferences.set(key, {
            ...value as AdaptationPreference,
            updatedAt: new Date((value as AdaptationPreference).updatedAt),
          });
        });
      }
    } catch (error) {
      console.error('Error loading adaptation preferences:', error);
    }
  }
  
  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      const preferencesObj = Object.fromEntries(this.preferences.entries());
      localStorage.setItem('adaptation-preferences', JSON.stringify(preferencesObj));
    } catch (error) {
      console.error('Error saving adaptation preferences:', error);
    }
  }
  
  /**
   * Load feature usage from localStorage
   */
  private loadFeatureUsage(): void {
    try {
      const savedUsage = localStorage.getItem('feature-usage');
      
      if (savedUsage) {
        const usage = JSON.parse(savedUsage);
        
        Object.entries(usage).forEach(([feature, pattern]) => {
          this.featureUsage.set(feature as AssistantFeature, {
            ...pattern as FeatureUsagePattern,
            lastUsed: new Date((pattern as FeatureUsagePattern).lastUsed),
          });
        });
      }
    } catch (error) {
      console.error('Error loading feature usage:', error);
    }
  }
  
  /**
   * Save feature usage to localStorage
   */
  private saveFeatureUsage(): void {
    try {
      const usageObj = Object.fromEntries(this.featureUsage.entries());
      localStorage.setItem('feature-usage', JSON.stringify(usageObj));
    } catch (error) {
      console.error('Error saving feature usage:', error);
    }
  }
}

// Export singleton instance
export const autoAdaptationService = new AutoAdaptationService();
export default autoAdaptationService; 