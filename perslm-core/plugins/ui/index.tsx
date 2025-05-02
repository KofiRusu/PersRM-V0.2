/**
 * PersLM UI Plugin System
 * A modular system for creating, managing, and rendering UI plugins
 */

// Export core plugin system
export * from './component_base';
export * from './plugin_manifest';
export * from './renderer';

// Export schema transformation pipeline
export * from './schema';

// Re-export example components
import LoginFormPlugin from './components/LoginForm';
import SchemaDemoRenderer from './demo/SchemaRenderer';

// Create a plugin registry for common use
import { UIPluginRegistry } from './plugin_manifest';
export const globalPluginRegistry = new UIPluginRegistry();

// Register built-in plugins
globalPluginRegistry.registerPlugin(LoginFormPlugin);

/**
 * Register a plugin with the global registry
 */
export function registerPlugin(plugin: any) {
  globalPluginRegistry.registerPlugin(plugin);
  return plugin;
}

/**
 * Unregister a plugin from the global registry
 */
export function unregisterPlugin(pluginId: string) {
  return globalPluginRegistry.unregisterPlugin(pluginId);
}

// Export example components
export {
  LoginFormPlugin,
  SchemaDemoRenderer,
};

// Default export
export default {
  registerPlugin,
  unregisterPlugin,
  globalPluginRegistry,
  LoginFormPlugin,
  SchemaDemoRenderer,
}; 