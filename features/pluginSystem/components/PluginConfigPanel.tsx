import React, { useState, useEffect } from 'react';
import { 
  ConfigurablePlugin, 
  globalPluginRegistry, 
  PluginRegistryEvent,
  isConfigurablePlugin
} from '../PluginRegistry';

/**
 * Form field props for plugin configuration
 */
interface ConfigFieldProps {
  /**
   * Field key
   */
  fieldKey: string;
  
  /**
   * Field schema
   */
  schema: {
    type: string;
    description?: string;
    enum?: string[];
    format?: string;
    [key: string]: any;
  };
  
  /**
   * Current value
   */
  value: any;
  
  /**
   * Value change handler
   */
  onChange: (value: any) => void;
}

/**
 * Generic configuration field renderer
 */
const ConfigField: React.FC<ConfigFieldProps> = ({ 
  fieldKey, 
  schema, 
  value, 
  onChange 
}) => {
  const { type, description, enum: enumValues } = schema;
  
  // Handle different field types
  switch (type) {
    case 'string':
      if (enumValues) {
        return (
          <div className="mb-4">
            <label htmlFor={fieldKey} className="block text-sm font-medium mb-1">
              {fieldKey}
              {description && <span className="text-gray-500 ml-1 text-xs">({description})</span>}
            </label>
            <select
              id={fieldKey}
              value={value || ''}
              onChange={e => onChange(e.target.value)}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            >
              {enumValues.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );
      }
      
      return (
        <div className="mb-4">
          <label htmlFor={fieldKey} className="block text-sm font-medium mb-1">
            {fieldKey}
            {description && <span className="text-gray-500 ml-1 text-xs">({description})</span>}
          </label>
          <input
            type="text"
            id={fieldKey}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );
      
    case 'number':
    case 'integer':
      return (
        <div className="mb-4">
          <label htmlFor={fieldKey} className="block text-sm font-medium mb-1">
            {fieldKey}
            {description && <span className="text-gray-500 ml-1 text-xs">({description})</span>}
          </label>
          <input
            type="number"
            id={fieldKey}
            value={value ?? ''}
            onChange={e => onChange(type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
        </div>
      );
      
    case 'boolean':
      return (
        <div className="mb-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id={fieldKey}
              checked={!!value}
              onChange={e => onChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
            />
            <label htmlFor={fieldKey} className="ml-2 block text-sm font-medium">
              {fieldKey}
              {description && <span className="text-gray-500 ml-1 text-xs">({description})</span>}
            </label>
          </div>
        </div>
      );
      
    default:
      return (
        <div className="mb-4 p-2 border rounded bg-gray-100">
          <div className="text-sm font-medium">{fieldKey}</div>
          <div className="text-sm text-gray-500">
            Unsupported type: {type}
          </div>
        </div>
      );
  }
};

/**
 * Individual plugin configuration panel
 */
interface PluginConfigFormProps {
  /**
   * Plugin to configure
   */
  plugin: ConfigurablePlugin;
  
  /**
   * Save configuration callback
   */
  onSave?: (pluginId: string, config: Record<string, any>) => void;
}

/**
 * Configuration form for a single plugin
 */
const PluginConfigForm: React.FC<PluginConfigFormProps> = ({ plugin, onSave }) => {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [isDirty, setIsDirty] = useState(false);
  
  // Initialize with current config
  useEffect(() => {
    const currentConfig = globalPluginRegistry.getPluginConfig(plugin.metadata.id) || {};
    setConfig(currentConfig);
    setIsDirty(false);
  }, [plugin.metadata.id]);
  
  // Get schema definition
  const schema = plugin.getConfigSchema();
  
  // Handle field changes
  const handleFieldChange = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };
  
  // Save configuration
  const handleSave = () => {
    const success = globalPluginRegistry.configurePlugin(plugin.metadata.id, config);
    
    if (success) {
      setIsDirty(false);
      if (onSave) {
        onSave(plugin.metadata.id, config);
      }
    }
  };
  
  // Reset to defaults
  const handleReset = () => {
    const defaultConfig = plugin.getDefaultConfig();
    setConfig(defaultConfig);
    setIsDirty(true);
  };
  
  return (
    <div className="border rounded p-4 mb-4">
      <h3 className="text-lg font-medium mb-2">{plugin.metadata.name}</h3>
      {plugin.metadata.description && (
        <p className="text-sm text-gray-600 mb-4">{plugin.metadata.description}</p>
      )}
      
      <div className="space-y-4">
        {Object.entries(schema.shape).map(([key, fieldSchema]) => (
          <ConfigField
            key={key}
            fieldKey={key}
            schema={fieldSchema}
            value={config[key]}
            onChange={value => handleFieldChange(key, value)}
          />
        ))}
      </div>
      
      <div className="flex justify-end space-x-2 mt-4">
        <button
          type="button"
          onClick={handleReset}
          className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
        >
          Reset to Defaults
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty}
          className={`px-3 py-1 text-sm text-white rounded ${
            isDirty 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-blue-300 cursor-not-allowed'
          }`}
        >
          Save Changes
        </button>
      </div>
    </div>
  );
};

/**
 * Main plugin configuration panel props
 */
interface PluginConfigPanelProps {
  /**
   * Optional filter to show only specific plugin IDs
   */
  pluginIds?: string[];
  
  /**
   * Callback when configuration is saved
   */
  onConfigSaved?: (pluginId: string, config: Record<string, any>) => void;
}

/**
 * Plugin configuration panel component that shows configurable plugins
 * and allows editing their configuration
 */
const PluginConfigPanel: React.FC<PluginConfigPanelProps> = ({ 
  pluginIds,
  onConfigSaved 
}) => {
  const [plugins, setPlugins] = useState<ConfigurablePlugin[]>([]);
  
  // Load plugins on mount and when registry changes
  useEffect(() => {
    const loadPlugins = () => {
      const allPlugins = globalPluginRegistry
        .getAllPlugins()
        .filter(plugin => 
          isConfigurablePlugin(plugin) && 
          globalPluginRegistry.isPluginEnabled(plugin.metadata.id) &&
          (!pluginIds || pluginIds.includes(plugin.metadata.id))
        ) as ConfigurablePlugin[];
      
      setPlugins(allPlugins);
    };
    
    // Initial load
    loadPlugins();
    
    // Listen for registry changes
    const events = [
      PluginRegistryEvent.PLUGIN_REGISTERED,
      PluginRegistryEvent.PLUGIN_UNREGISTERED,
      PluginRegistryEvent.PLUGIN_ENABLED,
      PluginRegistryEvent.PLUGIN_DISABLED,
      PluginRegistryEvent.PLUGIN_CONFIGURED
    ];
    
    const listeners = events.map(event => {
      const unsubscribe = globalPluginRegistry.on(event, loadPlugins);
      return unsubscribe;
    });
    
    return () => {
      // Cleanup listeners
      listeners.forEach(unsubscribe => unsubscribe());
    };
  }, [pluginIds]);
  
  if (plugins.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No configurable plugins available
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold mb-4">Plugin Configuration</h2>
      
      {plugins.map(plugin => (
        <PluginConfigForm
          key={plugin.metadata.id}
          plugin={plugin}
          onSave={onConfigSaved}
        />
      ))}
    </div>
  );
};

export default PluginConfigPanel; 