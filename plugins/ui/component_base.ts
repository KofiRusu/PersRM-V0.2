import React, { FC } from 'react';
// Define ThemeTokens type directly instead of importing from @/theme
export type ThemeTokens = {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  spacing: Record<string, string | number>;
  breakpoints: Record<string, string | number>;
  shadows: Record<string, string>;
  [key: string]: Record<string, unknown>;
};
import { ReactNode } from 'react';
import { z } from 'zod';

/**
 * Metadata for UI plugins
 */
export interface UIPluginMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  icon?: string; // Icon name from Lucide or base64 string
  tags: string[];
  dependencies?: Array<{
    pluginId: string;
    minVersion?: string;
    maxVersion?: string;
  }>;
  compatibleWith?: string[]; // Framework compatibility (e.g., 'react', 'vue', 'svelte')
  preview?: string;
  license?: string;
  IconComponent?: React.ComponentType;
  repositoryUrl?: string;
  homepage?: string;
  compatibility?: {
    minPersLMVersion?: string;
    maxPersLMVersion?: string;
  };
  documentation?: string;
  repository?: string;
  screenshots?: string[];
}

/**
 * Visual configuration for UI plugins that can be modified by visual tools
 */
export interface UIPluginVisualConfig {
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  spacing?: { padding: string; margin: string };
  isVisible?: boolean;
  customStyles?: Record<string, unknown>;
  customClasses?: string[];
  themeOverrides?: Partial<ThemeTokens>;
}

/**
 * Types of UI interactions that can trigger events
 */
export enum UIInteractionType {
  CLICK = 'click',
  HOVER = 'hover',
  FOCUS = 'focus',
  BLUR = 'blur',
  INPUT = 'input',
  SUBMIT = 'submit',
  KEYDOWN = 'keydown',
  KEYUP = 'keyup',
  CHANGE = 'change',
  KEYPRESS = 'keypress',
  DRAG = 'drag',
  DROP = 'drop',
  SCROLL = 'scroll',
  RESIZE = 'resize',
  CUSTOM = 'custom',
}

/**
 * State lifecycle methods for UI plugins
 */
export interface UIPluginLifecycle<TState = Record<string, unknown>> {
  init?: () => void | Promise<void>;
  destroy?: () => void | Promise<void>;
  pause?: () => void;
  resume?: () => void;
  getState?: () => TState;
  setState?: (state: Partial<TState>) => void;
  resetState?: () => void;
  update?: (prevState: TState, nextState: TState) => void;
  suspend?: () => void;
  settingsChanged?: (newSettings: Record<string, unknown>) => void;
}

/**
 * Interface for UI interaction events
 */
export interface UIInteractionEvent<T = unknown> {
  type: UIInteractionType;
  target: string; // ID of the target element
  value?: T; // Value associated with the interaction (e.g., input value)
  timestamp: number;
  metadata?: Record<string, unknown>; // Additional event metadata
}

/**
 * Interface for UI interaction handlers
 */
export interface UIInteractionHandler<T = unknown> {
  type: UIInteractionType;
  handler: (event: UIInteractionEvent<T>) => void;
}

/**
 * Plugin analytics interface
 */
export interface UIPluginAnalytics {
  trackInteraction: (type: UIInteractionType, data?: unknown) => void;
  trackError: (error: Error, context?: unknown) => void;
  trackUsage: (data?: unknown) => void;
}

/**
 * Plugin performance monitoring interface
 */
export interface UIPluginPerformance {
  measure: (id: string, startTime?: number) => number;
  markStart: (id: string) => void;
  markEnd: (id: string) => number;
  getMetrics: () => Record<string, unknown>;
}

/**
 * Hooks for UI plugins
 */
export interface UIPluginHooks<TProps = Record<string, unknown>, TSettings = Record<string, unknown>, TState = Record<string, unknown>> {
  onMount?: (props: TProps, settings: TSettings, state: TState) => void;
  onUnmount?: (props: TProps, settings: TSettings, state: TState) => void;
  onPropsChange?: (prevProps: TProps, nextProps: TProps, state: TState) => void;
  onSettingsChange?: (prevSettings: TSettings, nextSettings: TSettings, state: TState) => void;
  onStateChange?: (prevState: TState, nextState: TState, props: TProps, settings: TSettings) => void;
  onThemeChange?: (prevTheme: ThemeTokens, nextTheme: ThemeTokens) => void;
}

/**
 * Base interface for all UI plugins
 */
export interface UIPluginBase<TProps = Record<string, unknown>, TSettings = Record<string, unknown>, TState = Record<string, unknown>> {
  // Core plugin information
  metadata: UIPluginMetadata;
  
  // Component definition
  component: FC<TProps & {
    settings: TSettings;
    state: TState;
    setState: (state: Partial<TState>) => void;
  }>;
  
  // Props definition (default props and allowed props)
  defaultProps?: Partial<TProps>;
  propTypes?: z.ZodType<TProps>; // Now using ZodType instead of any
  
  // Settings schema
  settingsSchema?: z.ZodSchema<TSettings>;
  defaultSettings?: TSettings;
  
  // Default state
  defaultState?: TState;
  
  // Visual configuration
  visualConfig?: UIPluginVisualConfig;
  
  // State management
  lifecycle?: UIPluginLifecycle<TState>;
  
  // Theme integration
  applyTheme?: (theme: ThemeTokens) => Partial<TProps>;
  
  // Export methods
  toJSON?: () => string;
  fromJSON?: (json: string) => void;
  
  // Hooks
  hooks?: UIPluginHooks<TProps, TSettings, TState>;
  
  // State persistence
  storeState?: (state: TState) => void;
  loadState?: () => TState | null;
  
  // Analytics
  analytics?: UIPluginAnalytics;
  
  // Performance
  performance?: UIPluginPerformance;
  
  // Validation
  validateSettings?: (settings: TSettings) => boolean;
  validateState?: (state: TState) => boolean;
}

// Mock registry for interactions - this would be implemented fully in the actual code
export const interactionRegistry = {
  register: (pluginId: string, type: UIInteractionType, handler: (event: any) => void) => {},
  trigger: (pluginId: string, event: UIInteractionEvent<any>) => {},
  unregister: (pluginId: string) => {},
  unregisterHandler: (pluginId: string, type: UIInteractionType, handler: (event: any) => void) => {}
};

/**
 * Registry for UI interaction handlers
 */
export class UIInteractionRegistry {
  private handlers: Map<string, Map<UIInteractionType, UIInteractionHandler[]>> = new Map();
  
  /**
   * Register a handler for a specific plugin and interaction type
   */
  public register<T = unknown>(
    pluginId: string,
    type: UIInteractionType,
    handler: (event: UIInteractionEvent<T>) => void
  ): void {
    // Create plugin entry if it doesn't exist
    if (!this.handlers.has(pluginId)) {
      this.handlers.set(pluginId, new Map());
    }
    
    // Get plugin entry
    const pluginHandlers = this.handlers.get(pluginId)!;
    
    // Create type entry if it doesn't exist
    if (!pluginHandlers.has(type)) {
      pluginHandlers.set(type, []);
    }
    
    // Add handler
    pluginHandlers.get(type)!.push({
      type,
      handler: handler as (event: UIInteractionEvent<unknown>) => void
    });
  }
  
  /**
   * Unregister all handlers for a plugin
   */
  public unregister(pluginId: string): void {
    this.handlers.delete(pluginId);
  }
  
  /**
   * Trigger an interaction event for a plugin
   */
  public trigger<T = unknown>(
    pluginId: string,
    event: UIInteractionEvent<T>
  ): void {
    // Get plugin handlers
    const pluginHandlers = this.handlers.get(pluginId);
    if (!pluginHandlers) {
      return;
    }
    
    // Get handlers for event type
    const typeHandlers = pluginHandlers.get(event.type);
    if (!typeHandlers) {
      return;
    }
    
    // Call handlers
    for (const handler of typeHandlers) {
      try {
        handler.handler(event as unknown as UIInteractionEvent<unknown>);
      } catch (error) {
        console.error(`Error in plugin ${pluginId} interaction handler:`, error);
      }
    }
  }
}

/**
 * Typed factory function to create a new UI plugin
 */
export function createUIPlugin<TProps = Record<string, unknown>, TSettings = Record<string, unknown>, TState = Record<string, unknown>>(
  options: {
    metadata: UIPluginMetadata;
    component: FC<TProps & {
      settings: TSettings;
      state: TState;
      setState: (state: Partial<TState>) => void;
    }>;
    defaultProps?: Partial<TProps>;
    defaultSettings?: TSettings;
    defaultState?: TState;
    settingsSchema?: z.ZodSchema<TSettings>;
    applyTheme?: (theme: ThemeTokens) => Partial<TProps>;
    lifecycle?: UIPluginLifecycle<TState>;
    analytics?: UIPluginAnalytics;
    performance?: UIPluginPerformance;
  }
): UIPluginBase<TProps, TSettings, TState> {
  if (!options.metadata || !options.metadata.id || !options.component) {
    throw new Error('Invalid UI plugin configuration: metadata.id and component are required');
  }
  
  return {
    metadata: options.metadata,
    component: options.component,
    defaultProps: options.defaultProps || {} as Partial<TProps>,
    defaultSettings: options.defaultSettings as TSettings,
    defaultState: options.defaultState as TState,
    settingsSchema: options.settingsSchema,
    applyTheme: options.applyTheme,
    lifecycle: options.lifecycle,
    analytics: options.analytics,
    performance: options.performance,
    
    toJSON: () => {
      return JSON.stringify({
        metadata: options.metadata,
        defaultProps: options.defaultProps,
        defaultSettings: options.defaultSettings,
      });
    },
    
    fromJSON: (json: string) => {
      // Implementation would depend on UI plugin architecture
    }
  };
}

/**
 * Type guard to check if an object is a valid UI plugin
 */
export function isUIPlugin<TProps = Record<string, unknown>, TSettings = Record<string, unknown>, TState = Record<string, unknown>>(
  obj: unknown
): obj is UIPluginBase<TProps, TSettings, TState> {
  if (!obj || typeof obj !== 'object') {
    return false;
  }
  
  const plugin = obj as Partial<UIPluginBase>;
  
  return Boolean(
    plugin.metadata &&
    typeof plugin.metadata === 'object' &&
    typeof plugin.metadata.id === 'string' &&
    typeof plugin.metadata.name === 'string' &&
    typeof plugin.component === 'function'
  );
}

/**
 * Create a simple UI plugin with minimal configuration
 */
export function createSimpleUIPlugin<TProps = Record<string, unknown>>(
  metadata: UIPluginMetadata,
  component: FC<TProps>,
  defaultProps: Partial<TProps>,
  applyTheme?: (theme: ThemeTokens) => Partial<TProps>
): UIPluginBase<TProps> {
  return createUIPlugin({
    metadata,
    component: component as FC<TProps & { settings: Record<string, unknown>; state: Record<string, unknown>; setState: (state: Partial<Record<string, unknown>>) => void }>,
    defaultProps,
    applyTheme
  });
}

/**
 * Create standard analytics functions for a plugin
 */
export function createStandardAnalytics(pluginId: string): UIPluginAnalytics {
  return {
    trackInteraction: (type: UIInteractionType, data?: unknown) => {
      console.log(`[Plugin: ${pluginId}] Interaction: ${type}`, data);
    },
    
    trackError: (error: Error, context?: unknown) => {
      console.error(`[Plugin: ${pluginId}] Error:`, error, context);
    },
    
    trackUsage: (data?: unknown) => {
      console.log(`[Plugin: ${pluginId}] Usage:`, data);
    }
  };
}

/**
 * Create standard performance monitoring functions for a plugin
 */
export function createStandardPerformance(pluginId: string): UIPluginPerformance {
  const metrics: Record<string, { start?: number; duration?: number }> = {};
  
  return {
    measure: (id: string, startTime?: number) => {
      const start = startTime || (metrics[id]?.start || 0);
      const end = performance.now();
      const duration = end - start;
      
      metrics[id] = { ...metrics[id], duration };
      
      console.log(`[Plugin: ${pluginId}] Measure ${id}: ${duration}ms`);
      
      return duration;
    },
    
    markStart: (id: string) => {
      metrics[id] = { ...metrics[id], start: performance.now() };
    },
    
    markEnd: (id: string) => {
      if (!metrics[id] || metrics[id].start === undefined) {
        console.warn(`[Plugin: ${pluginId}] No start mark for ${id}`);
        return 0;
      }
      
      return this.measure(id, metrics[id].start);
    },
    
    getMetrics: () => {
      return { ...metrics };
    }
  };
}

/**
 * Creates standard lifecycle hooks for a plugin
 */
export function createStandardLifecycle<TState = Record<string, unknown>>(
  pluginId: string,
  onInit?: () => void,
  onDestroy?: () => void,
  onUpdate?: (prevState: TState, nextState: TState) => void,
  onSuspend?: () => void,
  onResume?: () => void
): UIPluginLifecycle<TState> {
  let state: TState = {} as TState;
  
  return {
    init: () => {
      console.log(`[Plugin: ${pluginId}] Initializing`);
      if (onInit) onInit();
    },
    
    destroy: () => {
      console.log(`[Plugin: ${pluginId}] Destroying`);
      if (onDestroy) onDestroy();
    },
    
    getState: () => {
      return state;
    },
    
    setState: (newState: Partial<TState>) => {
      const prevState = { ...state };
      state = { ...state, ...newState };
      
      if (onUpdate) onUpdate(prevState, state);
    },
    
    resetState: () => {
      state = {} as TState;
    },
    
    update: onUpdate,
    
    suspend: () => {
      console.log(`[Plugin: ${pluginId}] Suspending`);
      if (onSuspend) onSuspend();
    },
    
    resume: () => {
      console.log(`[Plugin: ${pluginId}] Resuming`);
      if (onResume) onResume();
    }
  };
} 