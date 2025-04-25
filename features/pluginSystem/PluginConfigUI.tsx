import React, { useState, useEffect } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Settings, Info, CheckCircle, AlertCircle } from 'lucide-react';

import { globalPluginRegistry, BasePlugin, isConfigurablePlugin, PluginRegistryEvent } from './PluginRegistry';

/**
 * Plugin settings UI props
 */
interface PluginSettingsProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;
  
  /**
   * Callback when the dialog is closed
   */
  onOpenChange: (open: boolean) => void;
}

/**
 * Plugin settings UI component
 */
export function PluginSettings({ open, onOpenChange }: PluginSettingsProps): React.ReactElement {
  // State for all plugins
  const [plugins, setPlugins] = useState<BasePlugin[]>([]);
  // Currently selected plugin ID
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  // Plugin configuration values by plugin ID
  const [configValues, setConfigValues] = useState<Record<string, Record<string, any>>>({});
  // Status messages by plugin ID
  const [statusMessages, setStatusMessages] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({});

  // Load plugins when opened
  useEffect(() => {
    if (open) {
      refreshPlugins();
    }
  }, [open]);

  // Listen for plugin registry events
  useEffect(() => {
    const unsubscribeRegistered = globalPluginRegistry.on(
      PluginRegistryEvent.PLUGIN_REGISTERED,
      refreshPlugins
    );
    const unsubscribeUnregistered = globalPluginRegistry.on(
      PluginRegistryEvent.PLUGIN_UNREGISTERED,
      refreshPlugins
    );
    const unsubscribeConfigured = globalPluginRegistry.on(
      PluginRegistryEvent.PLUGIN_CONFIGURED,
      refreshPlugins
    );
    
    return () => {
      unsubscribeRegistered();
      unsubscribeUnregistered();
      unsubscribeConfigured();
    };
  }, []);

  // Refresh the plugin list and configurations
  const refreshPlugins = () => {
    const allPlugins = globalPluginRegistry.getAllPlugins();
    setPlugins(allPlugins);
    
    // Initialize config values for configurable plugins
    const configs: Record<string, Record<string, any>> = {};
    
    allPlugins.forEach(plugin => {
      const id = plugin.metadata.id;
      
      if (isConfigurablePlugin(plugin)) {
        // Get current config or default
        configs[id] = globalPluginRegistry.getPluginConfig(id) || plugin.getDefaultConfig();
      }
    });
    
    setConfigValues(configs);
    
    // Select first plugin if none selected
    if (allPlugins.length > 0 && !selectedPlugin) {
      setSelectedPlugin(allPlugins[0].metadata.id);
    } else if (allPlugins.length === 0) {
      setSelectedPlugin(null);
    }
  };

  // Toggle plugin enabled/disabled state
  const togglePluginEnabled = (id: string) => {
    if (globalPluginRegistry.isPluginEnabled(id)) {
      globalPluginRegistry.disablePlugin(id);
    } else {
      globalPluginRegistry.enablePlugin(id);
    }
    refreshPlugins();
  };

  // Handle config value change
  const handleConfigChange = (pluginId: string, key: string, value: any) => {
    setConfigValues(prev => ({
      ...prev,
      [pluginId]: {
        ...prev[pluginId],
        [key]: value
      }
    }));
  };

  // Save plugin configuration
  const savePluginConfig = (pluginId: string) => {
    const plugin = globalPluginRegistry.getPlugin(pluginId);
    
    if (plugin && isConfigurablePlugin(plugin)) {
      try {
        const success = globalPluginRegistry.configurePlugin(
          pluginId, 
          configValues[pluginId]
        );
        
        if (success) {
          setStatusMessages(prev => ({
            ...prev,
            [pluginId]: {
              type: 'success',
              message: 'Configuration saved successfully'
            }
          }));
          
          // Clear success message after 3 seconds
          setTimeout(() => {
            setStatusMessages(prev => {
              const newMessages = { ...prev };
              delete newMessages[pluginId];
              return newMessages;
            });
          }, 3000);
        } else {
          setStatusMessages(prev => ({
            ...prev,
            [pluginId]: {
              type: 'error',
              message: 'Failed to save configuration'
            }
          }));
        }
      } catch (error) {
        setStatusMessages(prev => ({
          ...prev,
          [pluginId]: {
            type: 'error',
            message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }));
      }
    }
  };

  // Reset plugin configuration to default
  const resetPluginConfig = (pluginId: string) => {
    const plugin = globalPluginRegistry.getPlugin(pluginId);
    
    if (plugin && isConfigurablePlugin(plugin)) {
      const defaultConfig = plugin.getDefaultConfig();
      setConfigValues(prev => ({
        ...prev,
        [pluginId]: defaultConfig
      }));
      
      setStatusMessages(prev => ({
        ...prev,
        [pluginId]: {
          type: 'success',
          message: 'Reset to defaults (not saved)'
        }
      }));
    }
  };

  // Render a configuration control based on field type
  const renderConfigControl = (
    pluginId: string,
    key: string,
    schema: any,
    value: any
  ) => {
    // Get the field type from the schema
    const schemaType = schema.type;
    
    switch (schemaType) {
      case 'string':
        if (schema.enum) {
          // Dropdown for enum values
          return (
            <Select 
              value={value ?? ''} 
              onValueChange={(v) => handleConfigChange(pluginId, key, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={schema.description || key} />
              </SelectTrigger>
              <SelectContent>
                {schema.enum.map((option: string) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        } else if (schema.format === 'textarea') {
          // Textarea for long text
          return (
            <Textarea
              value={value ?? ''}
              onChange={(e) => handleConfigChange(pluginId, key, e.target.value)}
              placeholder={schema.description || key}
              rows={4}
            />
          );
        } else {
          // Input for regular text
          return (
            <Input
              value={value ?? ''}
              onChange={(e) => handleConfigChange(pluginId, key, e.target.value)}
              placeholder={schema.description || key}
            />
          );
        }
      
      case 'number':
      case 'integer':
        return (
          <Input
            type="number"
            value={value ?? ''}
            onChange={(e) => handleConfigChange(pluginId, key, parseFloat(e.target.value))}
            placeholder={schema.description || key}
          />
        );
      
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={`${pluginId}-${key}`}
              checked={!!value}
              onCheckedChange={(checked) => handleConfigChange(pluginId, key, checked)}
            />
            <Label htmlFor={`${pluginId}-${key}`}>{schema.description || key}</Label>
          </div>
        );
      
      default:
        return (
          <div className="text-sm text-muted-foreground">
            Unsupported field type: {schemaType}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Plugin Settings
          </DialogTitle>
          <DialogDescription>
            Configure and manage plugins for the UI schema system.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
          {plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center w-full p-8 text-center">
              <Info className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No plugins available</h3>
              <p className="text-sm text-muted-foreground mt-2">
                There are no plugins registered in the system.
              </p>
            </div>
          ) : (
            <Tabs
              value={selectedPlugin || undefined}
              onValueChange={setSelectedPlugin}
              className="flex flex-1 overflow-hidden"
            >
              <div className="flex flex-col w-full">
                <TabsList className="grid grid-flow-col auto-cols-max gap-2 h-auto p-2 mb-4 overflow-x-auto">
                  {plugins.map((plugin) => (
                    <TabsTrigger
                      key={plugin.metadata.id}
                      value={plugin.metadata.id}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <span className="text-sm">{plugin.metadata.name}</span>
                      {globalPluginRegistry.isPluginEnabled(plugin.metadata.id) ? (
                        <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                          Inactive
                        </Badge>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <ScrollArea className="flex-1">
                  {plugins.map((plugin) => (
                    <TabsContent
                      key={plugin.metadata.id}
                      value={plugin.metadata.id}
                      className="h-full mt-0"
                    >
                      <div className="space-y-6">
                        <Card>
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div>
                                <CardTitle>{plugin.metadata.name}</CardTitle>
                                <CardDescription>
                                  {plugin.metadata.description || 'No description available'}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  id={`toggle-${plugin.metadata.id}`}
                                  checked={globalPluginRegistry.isPluginEnabled(plugin.metadata.id)}
                                  onCheckedChange={() => togglePluginEnabled(plugin.metadata.id)}
                                />
                                <Label htmlFor={`toggle-${plugin.metadata.id}`}>
                                  {globalPluginRegistry.isPluginEnabled(plugin.metadata.id) ? 'Enabled' : 'Disabled'}
                                </Label>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2 mb-4">
                                <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                                  v{plugin.metadata.version}
                                </Badge>
                                {plugin.metadata.author && (
                                  <Badge variant="outline">
                                    By {plugin.metadata.author}
                                  </Badge>
                                )}
                                {plugin.metadata.tags?.map((tag) => (
                                  <Badge key={tag} variant="outline" className="bg-purple-50 text-purple-700 border-purple-100">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                              
                              <Separator className="my-4" />
                              
                              {isConfigurablePlugin(plugin) ? (
                                <>
                                  <h3 className="text-sm font-medium mb-4">Plugin Configuration</h3>
                                  
                                  {statusMessages[plugin.metadata.id] && (
                                    <Alert 
                                      variant={statusMessages[plugin.metadata.id].type === 'success' ? 'default' : 'destructive'}
                                      className="mb-4"
                                    >
                                      {statusMessages[plugin.metadata.id].type === 'success' ? (
                                        <CheckCircle className="h-4 w-4" />
                                      ) : (
                                        <AlertCircle className="h-4 w-4" />
                                      )}
                                      <AlertTitle>
                                        {statusMessages[plugin.metadata.id].type === 'success' ? 'Success' : 'Error'}
                                      </AlertTitle>
                                      <AlertDescription>
                                        {statusMessages[plugin.metadata.id].message}
                                      </AlertDescription>
                                    </Alert>
                                  )}
                                  
                                  <div className="space-y-4">
                                    {Object.entries(plugin.getConfigSchema().shape).map(([key, fieldSchema]) => (
                                      <div key={key} className="space-y-2">
                                        <Label htmlFor={`${plugin.metadata.id}-${key}`} className="text-sm font-medium">
                                          {fieldSchema.description || key}
                                        </Label>
                                        {renderConfigControl(
                                          plugin.metadata.id,
                                          key,
                                          fieldSchema,
                                          configValues[plugin.metadata.id]?.[key]
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </>
                              ) : (
                                <div className="text-sm text-muted-foreground">
                                  This plugin does not have any configurable options.
                                </div>
                              )}
                            </div>
                          </CardContent>
                          {isConfigurablePlugin(plugin) && (
                            <CardFooter className="flex justify-end gap-2 border-t pt-4">
                              <Button
                                variant="outline"
                                onClick={() => resetPluginConfig(plugin.metadata.id)}
                              >
                                Reset to Defaults
                              </Button>
                              <Button
                                onClick={() => savePluginConfig(plugin.metadata.id)}
                              >
                                Save Changes
                              </Button>
                            </CardFooter>
                          )}
                        </Card>
                      </div>
                    </TabsContent>
                  ))}
                </ScrollArea>
              </div>
            </Tabs>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 