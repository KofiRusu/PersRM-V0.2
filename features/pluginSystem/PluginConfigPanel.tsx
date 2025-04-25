import React, { useState, useEffect } from 'react';
import { globalPluginRegistry, PluginRegistryEvent, isConfigurablePlugin } from './PluginRegistry';
import { z } from 'zod';

/**
 * Component to render a configuration field based on its schema
 */
interface ConfigFieldProps {
  label: string;
  path: string;
  schema: z.ZodTypeAny;
  value: any;
  onChange: (path: string, value: any) => void;
}

const ConfigField: React.FC<ConfigFieldProps> = ({ label, path, schema, value, onChange }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    let newValue = e.target.value;
    
    // Convert value to the correct type based on schema
    if (schema instanceof z.ZodNumber) {
      newValue = Number(newValue);
    } else if (schema instanceof z.ZodBoolean) {
      newValue = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : newValue === 'true';
    }
    
    onChange(path, newValue);
  };
  
  // Render different input types based on schema
  if (schema instanceof z.ZodBoolean) {
    return (
      <div className="form-control">
        <label className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={!!value} 
            onChange={handleChange}
            className="checkbox"
          />
          <span>{label}</span>
        </label>
      </div>
    );
  }
  
  if (schema instanceof z.ZodEnum) {
    const options = schema._def.values;
    return (
      <div className="form-control">
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
        <select 
          value={value || ''} 
          onChange={handleChange}
          className="select select-bordered w-full"
        >
          {options.map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    );
  }
  
  if (schema instanceof z.ZodNumber) {
    return (
      <div className="form-control">
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
        <input 
          type="number" 
          value={value || 0} 
          onChange={handleChange}
          className="input input-bordered w-full"
        />
      </div>
    );
  }
  
  // Default to text input
  return (
    <div className="form-control">
      <label className="label">
        <span className="label-text">{label}</span>
      </label>
      <input 
        type="text" 
        value={value || ''} 
        onChange={handleChange}
        className="input input-bordered w-full"
      />
    </div>
  );
};

/**
 * Plugin configuration panel component
 */
export interface PluginConfigPanelProps {
  pluginId?: string;
  onClose?: () => void;
  className?: string;
}

export const PluginConfigPanel: React.FC<PluginConfigPanelProps> = ({ 
  pluginId, 
  onClose,
  className = '',
}) => {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [selectedPlugin, setSelectedPlugin] = useState<string | undefined>(pluginId);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  
  // Load plugins when component mounts
  useEffect(() => {
    // Get all configurable plugins
    const allPlugins = globalPluginRegistry.getAllPlugins()
      .filter(isConfigurablePlugin);
    
    setPlugins(allPlugins);
    
    // Listen for registry updates
    const removeListener = globalPluginRegistry.on(
      PluginRegistryEvent.REGISTRY_UPDATED,
      () => {
        const updatedPlugins = globalPluginRegistry.getAllPlugins()
          .filter(isConfigurablePlugin);
        setPlugins(updatedPlugins);
      }
    );
    
    return () => {
      removeListener();
    };
  }, []);
  
  // Load selected plugin config
  useEffect(() => {
    if (!selectedPlugin) {
      setConfig({});
      return;
    }
    
    const plugin = globalPluginRegistry.getPlugin(selectedPlugin);
    if (!plugin || !isConfigurablePlugin(plugin)) {
      setConfig({});
      return;
    }
    
    const currentConfig = globalPluginRegistry.getPluginConfig(selectedPlugin) || plugin.getDefaultConfig();
    setConfig(currentConfig);
  }, [selectedPlugin]);
  
  // Handle plugin selection
  const handlePluginChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPlugin(e.target.value || undefined);
    setError(null);
  };
  
  // Handle config field change
  const handleConfigChange = (path: string, value: any) => {
    setConfig(prevConfig => ({
      ...prevConfig,
      [path]: value,
    }));
  };
  
  // Handle save button click
  const handleSave = () => {
    if (!selectedPlugin) {
      return;
    }
    
    const success = globalPluginRegistry.configurePlugin(selectedPlugin, config);
    if (!success) {
      setError('Failed to configure plugin');
    } else {
      setError(null);
      if (onClose) {
        onClose();
      }
    }
  };
  
  // Render plugin configuration form
  const renderConfigForm = () => {
    if (!selectedPlugin) {
      return (
        <div className="text-center py-4">
          <p>Select a plugin to configure</p>
        </div>
      );
    }
    
    const plugin = globalPluginRegistry.getPlugin(selectedPlugin);
    if (!plugin || !isConfigurablePlugin(plugin)) {
      return (
        <div className="text-center py-4">
          <p>Selected plugin is not configurable</p>
        </div>
      );
    }
    
    const schema = plugin.getConfigSchema();
    if (!schema) {
      return (
        <div className="text-center py-4">
          <p>Plugin does not have a configuration schema</p>
        </div>
      );
    }
    
    // Get schema shape
    const shape = schema.shape;
    
    return (
      <div className="space-y-4">
        {Object.entries(shape).map(([key, fieldSchema]) => (
          <ConfigField
            key={key}
            label={key}
            path={key}
            schema={fieldSchema as z.ZodTypeAny}
            value={config[key]}
            onChange={handleConfigChange}
          />
        ))}
        
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
        
        <div className="flex justify-end space-x-2 pt-4">
          {onClose && (
            <button 
              type="button" 
              onClick={onClose}
              className="btn btn-outline"
            >
              Cancel
            </button>
          )}
          <button 
            type="button" 
            onClick={handleSave}
            className="btn btn-primary"
          >
            Save Configuration
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <div className={`bg-base-100 p-4 rounded-box ${className}`}>
      <h2 className="text-lg font-semibold mb-4">Plugin Configuration</h2>
      
      <div className="form-control mb-6">
        <label className="label">
          <span className="label-text">Select Plugin</span>
        </label>
        <select 
          value={selectedPlugin || ''} 
          onChange={handlePluginChange}
          className="select select-bordered w-full"
        >
          <option value="">-- Select a plugin --</option>
          {plugins.map(plugin => (
            <option key={plugin.metadata.id} value={plugin.metadata.id}>
              {plugin.metadata.name}
            </option>
          ))}
        </select>
      </div>
      
      {renderConfigForm()}
    </div>
  );
};

/**
 * Plugin management panel for enabling/disabling plugins
 */
export interface PluginManagementPanelProps {
  onConfigurePlugin?: (pluginId: string) => void;
  className?: string;
}

export const PluginManagementPanel: React.FC<PluginManagementPanelProps> = ({
  onConfigurePlugin,
  className = '',
}) => {
  const [plugins, setPlugins] = useState<any[]>([]);
  
  // Load plugins when component mounts
  useEffect(() => {
    // Get all plugins
    const allPlugins = globalPluginRegistry.getAllPlugins();
    setPlugins(allPlugins);
    
    // Listen for registry updates
    const removeListener = globalPluginRegistry.on(
      PluginRegistryEvent.REGISTRY_UPDATED,
      () => {
        const updatedPlugins = globalPluginRegistry.getAllPlugins();
        setPlugins(updatedPlugins);
      }
    );
    
    return () => {
      removeListener();
    };
  }, []);
  
  // Handle plugin enable/disable
  const handleTogglePlugin = (id: string, enabled: boolean) => {
    if (enabled) {
      globalPluginRegistry.enablePlugin(id);
    } else {
      globalPluginRegistry.disablePlugin(id);
    }
  };
  
  return (
    <div className={`bg-base-100 rounded-box ${className}`}>
      <h2 className="text-lg font-semibold p-4 border-b border-base-300">
        Installed Plugins
      </h2>
      
      {plugins.length === 0 ? (
        <div className="p-4 text-center">
          <p>No plugins installed</p>
        </div>
      ) : (
        <ul className="divide-y divide-base-300">
          {plugins.map(plugin => {
            const { id, name, description, version } = plugin.metadata;
            const isEnabled = globalPluginRegistry.isPluginEnabled(id);
            const isConfigurable = isConfigurablePlugin(plugin);
            
            return (
              <li key={id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{name}</h3>
                    <span className="text-xs opacity-70 px-2 py-0.5 bg-base-200 rounded">
                      v{version}
                    </span>
                  </div>
                  
                  {description && (
                    <p className="text-sm opacity-70 mt-1">{description}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {isConfigurable && onConfigurePlugin && (
                    <button
                      type="button"
                      onClick={() => onConfigurePlugin(id)}
                      className="btn btn-sm btn-ghost"
                      title="Configure plugin"
                    >
                      ⚙️
                    </button>
                  )}
                  
                  <label className="cursor-pointer flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      checked={isEnabled} 
                      onChange={(e) => handleTogglePlugin(id, e.target.checked)}
                      className="toggle toggle-primary"
                    />
                  </label>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}; 