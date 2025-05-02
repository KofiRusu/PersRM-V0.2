import { z } from 'zod';
import { UIPluginBase, UIPluginMetadata, isUIPlugin } from './component_base';

/**
 * UI Plugin manifest validation error
 */
export class UIPluginManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UIPluginManifestError';
  }
}

/**
 * UI Plugin dependency
 */
export interface UIPluginDependency {
  id: string;
  version: string;
  optional?: boolean;
}

/**
 * UI Plugin manifest extension
 */
export interface UIPluginManifestExtension {
  id: string;
  name: string;
  data: Record<string, any>;
}

/**
 * UI Plugin script
 */
export interface UIPluginScript {
  id: string;
  path: string;
  type: 'module' | 'commonjs';
  async?: boolean;
  defer?: boolean;
}

/**
 * UI Plugin style
 */
export interface UIPluginStyle {
  id: string;
  path: string;
  priority?: number;
}

/**
 * UI Plugin asset
 */
export interface UIPluginAsset {
  id: string;
  path: string;
  type: string;
}

/**
 * UI Plugin configuration
 */
export interface UIPluginConfiguration {
  id: string;
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  default?: any;
  required?: boolean;
  options?: any[];
  schema?: Record<string, any>;
}

/**
 * UI Plugin permission
 */
export interface UIPluginPermission {
  id: string;
  name: string;
  description: string;
  required?: boolean;
}

/**
 * UI Plugin Registry
 * Registry for managing UI plugins
 */
export class UIPluginRegistry {
  // Map of plugin IDs to plugin instances
  private plugins = new Map<string, UIPluginBase<any, any, any>>();
  
  // Map of categories to plugin IDs
  private categoriesMap = new Map<string, Set<string>>();
  
  // Map of tags to plugin IDs
  private tagsMap = new Map<string, Set<string>>();
  
  /**
   * Register a plugin with the registry
   */
  registerPlugin<TProps, TSettings, TState>(
    plugin: UIPluginBase<TProps, TSettings, TState>
  ): void {
    const { id, category, tags } = plugin.metadata;
    
    // Check if plugin with this ID already exists
    if (this.plugins.has(id)) {
      console.warn(`Plugin with ID ${id} already exists. Overwriting.`);
    }
    
    // Store the plugin
    this.plugins.set(id, plugin);
    
    // Add to category map
    if (category) {
      const categoryPlugins = this.categoriesMap.get(category) || new Set<string>();
      categoryPlugins.add(id);
      this.categoriesMap.set(category, categoryPlugins);
    }
    
    // Add to tags map
    if (tags && Array.isArray(tags)) {
      tags.forEach(tag => {
        const tagPlugins = this.tagsMap.get(tag) || new Set<string>();
        tagPlugins.add(id);
        this.tagsMap.set(tag, tagPlugins);
      });
    }
    
    console.log(`Plugin ${id} registered successfully.`);
  }
  
  /**
   * Unregister a plugin from the registry
   */
  unregisterPlugin(pluginId: string): boolean {
    // Check if plugin exists
    if (!this.plugins.has(pluginId)) {
      console.warn(`Plugin with ID ${pluginId} does not exist.`);
      return false;
    }
    
    // Get the plugin
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    
    // Remove from category map
    const { category, tags } = plugin.metadata;
    if (category) {
      const categoryPlugins = this.categoriesMap.get(category);
      if (categoryPlugins) {
        categoryPlugins.delete(pluginId);
        if (categoryPlugins.size === 0) {
          this.categoriesMap.delete(category);
        } else {
          this.categoriesMap.set(category, categoryPlugins);
        }
      }
    }
    
    // Remove from tags map
    if (tags && Array.isArray(tags)) {
      tags.forEach(tag => {
        const tagPlugins = this.tagsMap.get(tag);
        if (tagPlugins) {
          tagPlugins.delete(pluginId);
          if (tagPlugins.size === 0) {
            this.tagsMap.delete(tag);
          } else {
            this.tagsMap.set(tag, tagPlugins);
          }
        }
      });
    }
    
    // Remove the plugin
    this.plugins.delete(pluginId);
    console.log(`Plugin ${pluginId} unregistered successfully.`);
    
    return true;
  }
  
  /**
   * Get a plugin by ID
   */
  getPlugin<TProps = any, TSettings = any, TState = any>(
    pluginId: string
  ): UIPluginBase<TProps, TSettings, TState> | undefined {
    return this.plugins.get(pluginId) as UIPluginBase<TProps, TSettings, TState> | undefined;
  }
  
  /**
   * Get all plugins
   */
  getAllPlugins(): UIPluginBase<any, any, any>[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * Get all plugins in a category
   */
  getPluginsByCategory(category: string): UIPluginBase<any, any, any>[] {
    const categoryPlugins = this.categoriesMap.get(category);
    if (!categoryPlugins) return [];
    
    return Array.from(categoryPlugins)
      .map(id => this.plugins.get(id))
      .filter(Boolean) as UIPluginBase<any, any, any>[];
  }
  
  /**
   * Get all plugins with a specific tag
   */
  getPluginsByTag(tag: string): UIPluginBase<any, any, any>[] {
    const tagPlugins = this.tagsMap.get(tag);
    if (!tagPlugins) return [];
    
    return Array.from(tagPlugins)
      .map(id => this.plugins.get(id))
      .filter(Boolean) as UIPluginBase<any, any, any>[];
  }
  
  /**
   * Get all categories
   */
  getAllCategories(): string[] {
    return Array.from(this.categoriesMap.keys());
  }
  
  /**
   * Get all tags
   */
  getAllTags(): string[] {
    return Array.from(this.tagsMap.keys());
  }
  
  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
    this.categoriesMap.clear();
    this.tagsMap.clear();
  }
  
  /**
   * Get the number of registered plugins
   */
  get size(): number {
    return this.plugins.size;
  }
}

/**
 * Create a singleton global plugin registry
 */
export const globalUIPluginRegistry = new UIPluginRegistry();

/**
 * Helper function to register a UI plugin globally
 */
export function registerUIPlugin<TProps, TSettings, TState>(
  plugin: UIPluginBase<TProps, TSettings, TState>
): void {
  globalUIPluginRegistry.registerPlugin(plugin);
}

/**
 * Helper function to unregister a UI plugin globally
 */
export function unregisterUIPlugin(pluginId: string): boolean {
  return globalUIPluginRegistry.unregisterPlugin(pluginId);
}

/**
 * Plugin dependency interface
 */
export interface PluginDependency {
  // Plugin ID of the dependency
  id: string;
  
  // Minimum version of the dependency
  minVersion?: string;
  
  // Maximum version of the dependency
  maxVersion?: string;
  
  // Whether the dependency is optional
  optional?: boolean;
}

/**
 * Plugin permission interface
 */
export interface PluginPermission {
  // Type of permission
  type: string;
  
  // Reason for requesting the permission
  reason?: string;
  
  // Scope of the permission
  scope?: string;
}

/**
 * Plugin configuration schema interface
 */
export interface PluginConfigSchema {
  // Schema type
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';
  
  // Properties if type is 'object'
  properties?: Record<string, PluginConfigSchema>;
  
  // Items if type is 'array'
  items?: PluginConfigSchema | PluginConfigSchema[];
  
  // Default value
  default?: any;
  
  // Description
  description?: string;
  
  // Minimum value
  minimum?: number;
  
  // Maximum value
  maximum?: number;
  
  // Enum values
  enum?: any[];
  
  // Format (for validation)
  format?: string;
  
  // Pattern (for string validation)
  pattern?: string;
  
  // Required properties
  required?: string[];
  
  // Additional properties
  additionalProperties?: boolean;
  
  // Title
  title?: string;
}

/**
 * Plugin manifest interface
 */
export interface PluginManifest extends UIPluginMetadata {
  // Display name of the plugin
  displayName?: string;
  
  // Main entry point file
  main: string;
  
  // Plugin dependencies
  dependencies?: PluginDependency[];
  
  // Plugin permissions
  permissions?: PluginPermission[];
  
  // Configuration schema
  config?: PluginConfigSchema;
  
  // Additional resources (CSS, images, etc.)
  resources?: string[];
  
  // Initialization options
  initOptions?: Record<string, any>;
  
  // Plugin enabled by default
  enabledByDefault?: boolean;
  
  // Plugin can be disabled
  canBeDisabled?: boolean;
  
  // Plugin visibility
  isHidden?: boolean;
  
  // Plugin is experimental
  isExperimental?: boolean;
  
  // Plugin is deprecated
  isDeprecated?: boolean;
  
  // Deprecation message
  deprecationMessage?: string;
  
  // Platform compatibility
  platforms?: ('web' | 'desktop' | 'mobile')[];
  
  // Browser compatibility
  browsers?: ('chrome' | 'firefox' | 'safari' | 'edge')[];
  
  // Plugin localization
  localization?: Record<string, Record<string, string>>;
  
  // Additional custom fields
  [key: string]: any;
}

/**
 * Validate a plugin manifest
 * @param manifest Plugin manifest to validate
 * @returns True if the manifest is valid, false otherwise
 */
export function validateManifest(manifest: PluginManifest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check required fields
  if (!manifest.id) {
    errors.push('Missing required field: id');
  }
  
  if (!manifest.name) {
    errors.push('Missing required field: name');
  }
  
  if (!manifest.version) {
    errors.push('Missing required field: version');
  }
  
  if (!manifest.main) {
    errors.push('Missing required field: main');
  }
  
  // Validate version format (semver)
  if (manifest.version && !/^\d+\.\d+\.\d+(?:-[\w.]+)?(?:\+[\w.]+)?$/.test(manifest.version)) {
    errors.push('Invalid version format. Must follow Semantic Versioning (e.g., 1.0.0)');
  }
  
  // Validate ID format
  if (manifest.id && !/^[a-z0-9-_.]+$/.test(manifest.id)) {
    errors.push('Invalid id format. Must contain only lowercase letters, numbers, hyphens, underscores, and dots');
  }
  
  // Check dependencies
  if (manifest.dependencies) {
    for (const dep of manifest.dependencies) {
      if (!dep.id) {
        errors.push('Dependency missing required field: id');
      }
    }
  }
  
  // Check permissions
  if (manifest.permissions) {
    for (const perm of manifest.permissions) {
      if (!perm.type) {
        errors.push('Permission missing required field: type');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Parse a plugin manifest from JSON
 * @param json JSON string containing the plugin manifest
 * @returns Parsed plugin manifest
 */
export function parseManifest(json: string): PluginManifest {
  try {
    const manifest = JSON.parse(json) as PluginManifest;
    return manifest;
  } catch (error) {
    throw new Error(`Failed to parse plugin manifest: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Create a default plugin manifest
 * @param id Plugin ID
 * @param name Plugin name
 * @param version Plugin version
 * @param main Plugin main entry point
 * @returns Default plugin manifest
 */
export function createDefaultManifest(
  id: string,
  name: string,
  version = '1.0.0',
  main = 'index.js'
): PluginManifest {
  return {
    id,
    name,
    version,
    main,
    description: '',
    author: '',
    enabledByDefault: true,
    canBeDisabled: true,
    isHidden: false,
    isExperimental: false,
    isDeprecated: false,
  };
}

/**
 * Plugin Manifest Type
 */
export interface UIPluginManifest {
  // The ID of the plugin
  id: string;
  
  // The URL or module path to load the plugin from
  source: string;
  
  // Whether to load the plugin immediately or lazily
  lazy?: boolean;
  
  // Initial settings to apply to the plugin
  settings?: Record<string, any>;
  
  // Initial state to apply to the plugin
  state?: Record<string, any>;
  
  // Whether the plugin is enabled
  enabled?: boolean;
}

/**
 * Plugin Loader
 * Utility for loading plugins from manifests
 */
export class UIPluginLoader {
  constructor(private registry: UIPluginRegistry) {}
  
  /**
   * Load a plugin from a manifest
   */
  async loadPlugin(manifest: UIPluginManifest): Promise<boolean> {
    try {
      // Determine if the source is a URL or a local module path
      const isUrl = manifest.source.startsWith('http://') || manifest.source.startsWith('https://');
      
      // Load the plugin module
      let pluginModule;
      if (isUrl) {
        // Load from URL
        pluginModule = await import(/* webpackIgnore: true */ manifest.source);
      } else {
        // Load from local module
        pluginModule = await import(manifest.source);
      }
      
      // Get the plugin from the module
      const plugin = pluginModule.default || pluginModule;
      
      // Register the plugin
      this.registry.registerPlugin(plugin);
      
      return true;
    } catch (error) {
      console.error(`Failed to load plugin from manifest (${manifest.id}):`, error);
      return false;
    }
  }
  
  /**
   * Load multiple plugins from manifests
   */
  async loadPlugins(manifests: UIPluginManifest[]): Promise<boolean[]> {
    const results = await Promise.all(
      manifests.map(manifest => this.loadPlugin(manifest))
    );
    
    return results;
  }
}

/**
 * Create a plugin loader for the global registry
 */
export const globalUIPluginLoader = new UIPluginLoader(globalUIPluginRegistry);

/**
 * Register all plugins from a manifest with a registry
 */
export function registerManifest(
  registry: UIPluginRegistry,
  manifest: UIPluginManifest
): void {
  manifest.plugins.forEach((plugin) => {
    registry.registerPlugin(plugin);
  });
}

/**
 * Register multiple plugins at once
 */
export function registerPlugins(plugins: UIPluginBase<any, any, any>[]): void {
  plugins.forEach((plugin) => globalUIPluginRegistry.registerPlugin(plugin));
}

/**
 * Create a plugin registry for a specific context
 * Useful for isolated plugin registries
 */
export function createPluginRegistry(): UIPluginRegistry {
  return new UIPluginRegistry();
}

/**
 * Plugin manifest interface
 */
export interface PluginManifestItem {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: string;
  tags: string[];
  entrypoint: string;
  icon?: string;
  preview?: string;
  dependencies?: string[];
  settings?: {
    schema: Record<string, any>;
    defaults: Record<string, any>;
  };
}

/**
 * Plugin manifest
 */
export interface PluginManifest {
  schemaVersion: string;
  plugins: PluginManifestItem[];
}

/**
 * Load plugins from a manifest
 */
export async function loadPluginsFromManifest(manifest: PluginManifest): Promise<UIPluginBase[]> {
  const loadedPlugins: UIPluginBase[] = [];
  
  for (const item of manifest.plugins) {
    try {
      // Import plugin module
      const module = await import(item.entrypoint);
      
      // Get plugin instance
      const plugin = module.default || module.plugin;
      
      if (!isUIPlugin(plugin)) {
        console.error(`Invalid plugin instance for "${item.id}"`);
        continue;
      }
      
      // Check if IDs match
      if (plugin.metadata.id !== item.id) {
        console.error(`Plugin ID mismatch: "${item.id}" vs "${plugin.metadata.id}"`);
        continue;
      }
      
      // Register plugin
      globalUIPluginRegistry.registerPlugin(plugin);
      loadedPlugins.push(plugin);
    } catch (error) {
      console.error(`Failed to load plugin "${item.id}":`, error);
    }
  }
  
  return loadedPlugins;
}

/**
 * Create an empty manifest for a plugin
 */
export function createEmptyManifest(metadata: UIPluginMetadata): UIPluginManifest {
  return {
    metadata,
    entryPoint: './index.js',
  };
}

/**
 * UI Plugin manifest schema definition
 */
export const UIPluginManifestSchema = z.object({
  // Plugin metadata (required)
  id: z.string().min(1).describe('Plugin ID (unique identifier)'),
  name: z.string().min(1).describe('Plugin name'),
  version: z.string().regex(/^\d+\.\d+\.\d+/).describe('Plugin version (semver)'),
  
  // Plugin metadata (optional)
  description: z.string().optional().describe('Plugin description'),
  author: z.string().optional().describe('Plugin author'),
  license: z.string().optional().describe('Plugin license'),
  icon: z.string().url().optional().describe('Plugin icon URL'),
  category: z.string().optional().describe('Plugin category'),
  tags: z.array(z.string()).optional().describe('Plugin tags'),
  enabled: z.boolean().optional().default(true).describe('Plugin enabled state'),
  
  // Plugin dependencies
  dependencies: z.array(z.object({
    id: z.string().min(1).describe('Dependency plugin ID'),
    version: z.string().regex(/^\d+\.\d+\.\d+/).describe('Dependency plugin version (semver)'),
    optional: z.boolean().optional().default(false).describe('Optional dependency')
  })).optional().default([]).describe('Plugin dependencies'),
  
  // Plugin capabilities
  capabilities: z.array(z.string()).optional().default([]).describe('Plugin capabilities'),
  
  // Plugin permissions
  permissions: z.array(z.string()).optional().default([]).describe('Plugin permissions'),
  
  // Plugin configuration
  config: z.record(z.any()).optional().default({}).describe('Plugin configuration'),
  
  // Plugin resources
  resources: z.array(z.object({
    path: z.string().min(1).describe('Resource path'),
    type: z.string().min(1).describe('Resource type'),
    url: z.string().url().describe('Resource URL')
  })).optional().default([]).describe('Plugin resources'),
  
  // Plugin components
  components: z.array(z.object({
    id: z.string().min(1).describe('Component ID'),
    name: z.string().min(1).describe('Component name'),
    description: z.string().optional().describe('Component description'),
    slots: z.array(z.string()).optional().default([]).describe('Component slots'),
    entry: z.string().min(1).describe('Component entry point')
  })).optional().default([]).describe('Plugin components'),
  
  // Plugin settings
  settings: z.array(z.object({
    id: z.string().min(1).describe('Setting ID'),
    name: z.string().min(1).describe('Setting name'),
    description: z.string().optional().describe('Setting description'),
    type: z.enum(['string', 'number', 'boolean', 'object', 'array']).describe('Setting type'),
    default: z.any().optional().describe('Setting default value'),
    required: z.boolean().optional().default(false).describe('Setting required')
  })).optional().default([]).describe('Plugin settings'),
  
  // Plugin entry point
  main: z.string().min(1).describe('Plugin entry point'),
  
  // Plugin assets
  assets: z.record(z.string().url()).optional().default({}).describe('Plugin assets'),
  
  // Plugin i18n
  i18n: z.record(z.record(z.string())).optional().default({}).describe('Plugin i18n'),
  
  // Plugin API
  api: z.record(z.any()).optional().default({}).describe('Plugin API'),
  
  // Plugin metadata
  createdAt: z.string().datetime().optional().describe('Plugin creation date'),
  updatedAt: z.string().datetime().optional().describe('Plugin update date')
});

/**
 * UI Plugin manifest type
 */
export type UIPluginManifestSchema = z.infer<typeof UIPluginManifestSchema>;

/**
 * UI Plugin manifest loader
 */
export class UIPluginManifestLoader {
  /**
   * Load a manifest from JSON string
   * @param json JSON string
   * @returns Manifest object
   */
  public static loadFromJson(json: string): UIPluginManifestSchema {
    try {
      const data = JSON.parse(json);
      return UIPluginManifestLoader.loadFromObject(data);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new UIPluginManifestError(`Invalid JSON: ${error.message}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Load a manifest from object
   * @param obj Object
   * @returns Manifest object
   */
  public static loadFromObject(obj: any): UIPluginManifestSchema {
    try {
      return UIPluginManifestSchema.parse(obj);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join(', ');
        throw new UIPluginManifestError(`Invalid manifest: ${issues}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Validate a manifest
   * @param manifest Manifest
   * @returns Validation result
   */
  public static validate(manifest: any): { valid: boolean; errors: string[] } {
    try {
      UIPluginManifestSchema.parse(manifest);
      return { valid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
        return { valid: false, errors };
      }
      
      return { valid: false, errors: [String(error)] };
    }
  }
  
  /**
   * Get plugin metadata from manifest
   * @param manifest Manifest
   * @returns Plugin metadata
   */
  public static getMetadata(manifest: UIPluginManifestSchema): UIPluginMetadata {
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      license: manifest.license,
      icon: manifest.icon,
      category: manifest.category,
      tags: manifest.tags,
      enabled: manifest.enabled
    };
  }
} 