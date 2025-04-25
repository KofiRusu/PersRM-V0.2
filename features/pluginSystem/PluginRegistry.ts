import { EventEmitter } from 'events';
import { z } from 'zod';
import { FieldSchema } from './SchemaOverride';
import EventEmitter3 from 'eventemitter3';

/**
 * Plugin metadata schema
 */
export const PluginMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
  icon: z.string().optional(),
  dependencies: z.record(z.string()).optional(),
});

export type PluginMetadata = z.infer<typeof PluginMetadataSchema>;

/**
 * Plugin registry events
 */
export enum PluginRegistryEvent {
  /**
   * Plugin registered
   */
  PLUGIN_REGISTERED = 'plugin:registered',
  
  /**
   * Plugin unregistered
   */
  PLUGIN_UNREGISTERED = 'plugin:unregistered',
  
  /**
   * Plugin enabled
   */
  PLUGIN_ENABLED = 'plugin:enabled',
  
  /**
   * Plugin disabled
   */
  PLUGIN_DISABLED = 'plugin:disabled',
  
  /**
   * Plugin configured
   */
  PLUGIN_CONFIGURED = 'plugin:configured',
  
  /**
   * Registry initialized
   */
  REGISTRY_INITIALIZED = 'registry:initialized',
  
  /**
   * Registry reloaded
   */
  REGISTRY_RELOADED = 'registry:reloaded'
}

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
  /**
   * Unique plugin ID
   */
  id: string;
  
  /**
   * Plugin name
   */
  name: string;
  
  /**
   * Plugin description
   */
  description: string;
  
  /**
   * Plugin version
   */
  version: string;
  
  /**
   * Plugin author
   */
  author?: string;
  
  /**
   * Plugin homepage URL
   */
  homepage?: string;
  
  /**
   * Plugin tags for categorization
   */
  tags?: string[];
  
  /**
   * Minimum supported app version
   */
  minAppVersion?: string;
  
  /**
   * Maximum supported app version
   */
  maxAppVersion?: string;
  
  /**
   * Required permissions
   */
  permissions?: string[];
}

/**
 * Base plugin interface that all plugins must implement
 */
export interface BasePlugin {
  /**
   * Plugin metadata
   */
  readonly metadata: PluginMetadata;
  
  /**
   * Initialize plugin
   * Called when the plugin is registered or activated
   */
  initialize(): void | Promise<void>;
  
  /**
   * Cleanup plugin
   * Called when the plugin is deactivated or unregistered
   */
  cleanup(): void | Promise<void>;
}

/**
 * Plugin registration status
 */
export enum PluginStatus {
  /**
   * Plugin is registered but not activated
   */
  REGISTERED = 'registered',
  
  /**
   * Plugin is activated and running
   */
  ACTIVE = 'active',
  
  /**
   * Plugin is disabled by user
   */
  DISABLED = 'disabled',
  
  /**
   * Plugin failed to load
   */
  ERROR = 'error'
}

/**
 * Registration information for a plugin
 */
export interface PluginRegistration<T extends BasePlugin = BasePlugin> {
  /**
   * Plugin instance
   */
  instance: T;
  
  /**
   * Plugin status
   */
  status: PluginStatus;
  
  /**
   * Error message if status is ERROR
   */
  error?: string;
  
  /**
   * Last activation time
   */
  activatedAt?: Date;
  
  /**
   * Last deactivation time
   */
  deactivatedAt?: Date;
}

/**
 * Configuration schema object
 */
export interface ConfigSchema {
  type: 'object';
  shape: Record<string, {
    type: string;
    description?: string;
    default?: any;
    required?: boolean;
    [key: string]: any;
  }>;
}

/**
 * Configurable plugin interface
 */
export interface ConfigurablePlugin extends BasePlugin {
  /**
   * Get configuration schema
   */
  getConfigSchema(): ConfigSchema;
  
  /**
   * Get default configuration
   */
  getDefaultConfig(): Record<string, any>;
  
  /**
   * Configure plugin
   * @param config Configuration object
   */
  configure(config: Record<string, any>): void;
}

/**
 * Type guard for ConfigurablePlugin
 */
export function isConfigurablePlugin(plugin: BasePlugin): plugin is ConfigurablePlugin {
  return (
    'getConfigSchema' in plugin &&
    'getDefaultConfig' in plugin &&
    'configure' in plugin &&
    typeof (plugin as any).getConfigSchema === 'function' &&
    typeof (plugin as any).getDefaultConfig === 'function' &&
    typeof (plugin as any).configure === 'function'
  );
}

/**
 * Interface for plugins that provide schema overrides
 */
export interface SchemaOverridePlugin extends BasePlugin {
  /**
   * Get the schema types this plugin can override
   */
  getOverridableTypes(): string[];
  
  /**
   * Check if this plugin can override a specific field
   * @param schemaType Schema type
   * @param field Field schema
   */
  canOverride(schemaType: string, field: FieldSchema): boolean;
  
  /**
   * Get the component to render for the field
   * @param schemaType Schema type
   * @param field Field schema
   */
  getOverrideComponent(schemaType: string, field: FieldSchema): React.ComponentType<any> | null;
}

export function isSchemaOverridePlugin(plugin: any): plugin is SchemaOverridePlugin {
  return (
    plugin &&
    typeof plugin.getOverridableTypes === 'function' &&
    typeof plugin.canOverride === 'function' &&
    typeof plugin.getOverrideComponent === 'function'
  );
}

/**
 * Plugin manager for registration and lifecycle management
 */
export class PluginRegistry {
  /**
   * Singleton instance
   */
  private static instance: PluginRegistry;
  
  /**
   * Get singleton instance
   */
  public static getInstance(): PluginRegistry {
    if (!PluginRegistry.instance) {
      PluginRegistry.instance = new PluginRegistry();
    }
    return PluginRegistry.instance;
  }
  
  /**
   * Registered plugins
   */
  private plugins: Map<string, PluginRegistration> = new Map();
  
  /**
   * Plugin type registrations
   */
  private pluginTypes: Map<string, Set<string>> = new Map();
  
  /**
   * Plugin change listeners
   */
  private listeners: Array<() => void> = [];
  
  /**
   * Private constructor for singleton
   */
  private constructor() {}
  
  /**
   * Register a plugin
   * @param plugin Plugin instance
   * @param activate Whether to activate immediately
   */
  async registerPlugin<T extends BasePlugin>(
    plugin: T,
    activate = true
  ): Promise<PluginRegistration<T>> {
    const { id } = plugin.metadata;
    
    // Check if plugin is already registered
    if (this.plugins.has(id)) {
      throw new Error(`Plugin with ID ${id} is already registered`);
    }
    
    // Create registration
    const registration: PluginRegistration<T> = {
      instance: plugin,
      status: PluginStatus.REGISTERED,
    };
    
    this.plugins.set(id, registration);
    
    // Register plugin type
    this.registerPluginType(plugin);
    
    // Activate if requested
    if (activate) {
      await this.activatePlugin(id);
    }
    
    // Notify listeners
    this.notifyListeners();
    
    return registration;
  }
  
  /**
   * Register a plugin's type
   * @param plugin Plugin instance
   */
  private registerPluginType(plugin: BasePlugin): void {
    // Get all interfaces implemented by this plugin
    const interfaces = Object.getPrototypeOf(plugin).constructor.name;
    const interfaceNames = interfaces.split(',').map(i => i.trim());
    
    // Register each interface
    for (const interfaceName of interfaceNames) {
      if (!this.pluginTypes.has(interfaceName)) {
        this.pluginTypes.set(interfaceName, new Set());
      }
      
      this.pluginTypes.get(interfaceName)!.add(plugin.metadata.id);
    }
  }
  
  /**
   * Unregister a plugin
   * @param id Plugin ID
   */
  async unregisterPlugin(id: string): Promise<void> {
    const registration = this.plugins.get(id);
    
    if (!registration) {
      throw new Error(`Plugin with ID ${id} is not registered`);
    }
    
    // Deactivate if active
    if (registration.status === PluginStatus.ACTIVE) {
      await this.deactivatePlugin(id);
    }
    
    // Remove from plugin types
    for (const [typeName, pluginIds] of this.pluginTypes.entries()) {
      pluginIds.delete(id);
      if (pluginIds.size === 0) {
        this.pluginTypes.delete(typeName);
      }
    }
    
    // Remove from registry
    this.plugins.delete(id);
    
    // Notify listeners
    this.notifyListeners();
  }
  
  /**
   * Activate a plugin
   * @param id Plugin ID
   */
  async activatePlugin(id: string): Promise<void> {
    const registration = this.plugins.get(id);
    
    if (!registration) {
      throw new Error(`Plugin with ID ${id} is not registered`);
    }
    
    if (registration.status === PluginStatus.ACTIVE) {
      return; // Already active
    }
    
    try {
      // Initialize plugin
      await registration.instance.initialize();
      
      // Update status
      registration.status = PluginStatus.ACTIVE;
      registration.activatedAt = new Date();
      registration.error = undefined;
      
      // Notify listeners
      this.notifyListeners();
    } catch (error) {
      // Update status with error
      registration.status = PluginStatus.ERROR;
      registration.error = error instanceof Error ? error.message : String(error);
      
      // Notify listeners
      this.notifyListeners();
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Deactivate a plugin
   * @param id Plugin ID
   */
  async deactivatePlugin(id: string): Promise<void> {
    const registration = this.plugins.get(id);
    
    if (!registration) {
      throw new Error(`Plugin with ID ${id} is not registered`);
    }
    
    if (registration.status !== PluginStatus.ACTIVE) {
      return; // Not active
    }
    
    try {
      // Cleanup plugin
      await registration.instance.cleanup();
      
      // Update status
      registration.status = PluginStatus.DISABLED;
      registration.deactivatedAt = new Date();
      
      // Notify listeners
      this.notifyListeners();
    } catch (error) {
      // Update status with error
      registration.status = PluginStatus.ERROR;
      registration.error = error instanceof Error ? error.message : String(error);
      
      // Notify listeners
      this.notifyListeners();
      
      // Re-throw error
      throw error;
    }
  }
  
  /**
   * Get all registered plugins
   */
  getAllPlugins(): PluginRegistration[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Get active plugins of a specific type
   * @param pluginType Plugin type/interface name
   */
  getPluginsByType<T extends BasePlugin>(pluginType: string): T[] {
    const pluginIds = this.pluginTypes.get(pluginType) || new Set();
    
    return Array.from(pluginIds)
      .map(id => this.plugins.get(id))
      .filter(registration => registration?.status === PluginStatus.ACTIVE)
      .map(registration => registration!.instance as T);
  }
  
  /**
   * Get a plugin by ID
   * @param id Plugin ID
   */
  getPlugin<T extends BasePlugin>(id: string): T | undefined {
    const registration = this.plugins.get(id);
    return registration?.instance as T | undefined;
  }
  
  /**
   * Add a change listener
   * @param listener Listener function
   */
  addChangeListener(listener: () => void): void {
    this.listeners.push(listener);
  }
  
  /**
   * Remove a change listener
   * @param listener Listener function
   */
  removeChangeListener(listener: () => void): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * Notify all listeners of changes
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (error) {
        console.error('Error in plugin listener:', error);
      }
    }
  }
}

/**
 * Global plugin registry instance
 */
export const globalPluginRegistry = new PluginRegistry();

/**
 * Register a plugin with hot reloading support
 * @param plugin Plugin to register
 * @returns Plugin instance for chaining
 */
export function registerPlugin<T>(plugin: T): T {
  globalPluginRegistry.register(plugin);
  return plugin;
} 