import React, { createContext, useContext, useState, useEffect, useMemo, FC, ReactNode, useCallback } from 'react';
import { UIPluginBase, UIInteractionType, interactionRegistry } from './component_base';
import { pluginRegistry, globalPluginRegistry } from './plugin_manifest';
import { ThemeProvider, useTheme, ThemeTokens } from '@/theme';
import { UIPluginRegistry } from './plugin_manifest';

// Context for plugin rendering
interface PluginRendererContextType {
  registerInteraction: <T = any>(
    pluginId: string,
    type: UIInteractionType,
    handler: (event: any) => void
  ) => void;
  triggerInteraction: <T = any>(
    pluginId: string,
    type: UIInteractionType,
    target: string,
    value?: T
  ) => void;
  getPlugin: <TProps = any, TSettings = any, TState = any>(
    id: string
  ) => UIPluginBase<TProps, TSettings, TState> | undefined;
  theme: ThemeTokens;
}

const PluginRendererContext = createContext<PluginRendererContextType>({
  registerInteraction: () => {},
  triggerInteraction: () => {},
  getPlugin: () => undefined,
  theme: {} as ThemeTokens,
});

// Hook to use plugin renderer context
export const usePluginRenderer = () => useContext(PluginRendererContext);

// Options for the plugin renderer
export interface PluginRendererOptions {
  themeId?: string;
  enableDevTools?: boolean;
  enableWireframe?: boolean;
  onError?: (error: Error, pluginId: string) => void;
}

// Props for the plugin renderer component
export interface PluginRendererProps {
  children: React.ReactNode;
  options?: PluginRendererOptions;
}

// The plugin renderer component
export function PluginRenderer({ children, options = {} }: PluginRendererProps) {
  const { theme } = useTheme();
  
  // Register interaction handler
  const registerInteraction = <T = any>(
    pluginId: string,
    type: UIInteractionType,
    handler: (event: any) => void
  ) => {
    interactionRegistry.register(pluginId, type, handler);
  };
  
  // Trigger interaction
  const triggerInteraction = <T = any>(
    pluginId: string,
    type: UIInteractionType,
    target: string,
    value?: T
  ) => {
    interactionRegistry.trigger(pluginId, {
      type,
      target,
      value,
      timestamp: Date.now(),
    });
  };
  
  // Get plugin by ID
  const getPlugin = <TProps = any, TSettings = any, TState = any>(
    id: string
  ): UIPluginBase<TProps, TSettings, TState> | undefined => {
    return pluginRegistry.getPlugin<TProps, TSettings, TState>(id);
  };
  
  // Context value
  const contextValue = useMemo(() => ({
    registerInteraction,
    triggerInteraction,
    getPlugin,
    theme,
  }), [theme]);
  
  return (
    <PluginRendererContext.Provider value={contextValue}>
      {children}
    </PluginRendererContext.Provider>
  );
}

// Props for rendering a single plugin
export interface RenderPluginProps<TProps = any> {
  pluginId: string;
  props?: Partial<TProps>;
  settings?: any;
  className?: string;
}

// Component for rendering a single plugin
export function RenderPlugin<TProps = any>({ 
  pluginId, 
  props = {}, 
  settings,
  className,
}: RenderPluginProps<TProps>) {
  const { getPlugin, theme } = usePluginRenderer();
  const [error, setError] = useState<Error | null>(null);
  
  // Get the plugin
  const plugin = getPlugin<TProps>(pluginId);
  
  // Handle error if plugin not found
  if (!plugin) {
    return (
      <div className="flex items-center justify-center p-4 border border-dashed border-red-300 rounded-md bg-red-50 text-red-500">
        Plugin "{pluginId}" not found
      </div>
    );
  }
  
  // Apply theme to props if plugin supports it
  const themeProps = plugin.applyTheme ? plugin.applyTheme(theme) : {};
  
  // Merge props with default props and theme props
  const mergedProps = {
    ...plugin.defaultProps,
    ...themeProps,
    ...props,
  } as TProps;
  
  // Apply settings if provided
  if (settings && plugin.settingsSchema) {
    try {
      // Validate settings against schema
      const parsedSettings = plugin.settingsSchema.parse(settings);
      // Store settings
      plugin.defaultSettings = parsedSettings;
    } catch (err) {
      console.error(`Invalid settings for plugin "${pluginId}":`, err);
    }
  }
  
  // Initialize plugin state if not already initialized
  useEffect(() => {
    if (plugin.lifecycle) {
      plugin.lifecycle.init();
    }
    
    // Cleanup when unmounted
    return () => {
      // Unregister all interaction handlers
      interactionRegistry.unregister(pluginId);
    };
  }, [plugin, pluginId]);
  
  // Render the plugin component with error boundary
  try {
    return (
      <div 
        className={className}
        data-plugin-id={pluginId}
        data-plugin-version={plugin.metadata.version}
      >
        {plugin.component(mergedProps)}
      </div>
    );
  } catch (err) {
    // Handle error
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`Error rendering plugin "${pluginId}":`, error);
    setError(error);
    
    // Render error state
    return (
      <div className="p-4 border border-dashed border-red-300 rounded-md bg-red-50 text-red-500">
        <h3 className="font-medium">Error in plugin "{plugin.metadata.name}"</h3>
        <p className="text-sm mt-2">{error.message}</p>
      </div>
    );
  }
}

// Props for plugin container
export interface PluginContainerProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

// Component for wrapping plugin content
export function PluginContainer({ id, children, className }: PluginContainerProps) {
  return (
    <div 
      id={`plugin-${id}`}
      className={`plugin-container ${className || ''}`}
      data-plugin-id={id}
    >
      {children}
    </div>
  );
}

// Component for rendering multiple plugins in a layout
export interface PluginLayoutProps {
  plugins: Array<{
    id: string;
    props?: any;
    settings?: any;
    position?: { x: number; y: number };
    size?: { width: string | number; height: string | number };
  }>;
  layout?: 'grid' | 'flex' | 'absolute';
  className?: string;
}

// Component for rendering multiple plugins
export function PluginLayout({ 
  plugins, 
  layout = 'grid',
  className = '',
}: PluginLayoutProps) {
  // Determine layout class
  let layoutClass = '';
  
  switch (layout) {
    case 'grid':
      layoutClass = 'grid grid-cols-12 gap-4';
      break;
    case 'flex':
      layoutClass = 'flex flex-wrap gap-4';
      break;
    case 'absolute':
      layoutClass = 'relative';
      break;
    default:
      layoutClass = 'grid grid-cols-12 gap-4';
  }
  
  return (
    <div className={`plugin-layout ${layoutClass} ${className}`}>
      {plugins.map(({ id, props, settings, position, size }) => {
        // Style for absolute positioning
        const style: React.CSSProperties = {};
        
        if (layout === 'absolute' && position) {
          style.position = 'absolute';
          style.left = `${position.x}px`;
          style.top = `${position.y}px`;
        }
        
        if (size) {
          style.width = typeof size.width === 'number' ? `${size.width}px` : size.width;
          style.height = typeof size.height === 'number' ? `${size.height}px` : size.height;
        }
        
        return (
          <div
            key={id}
            className={layout === 'grid' ? 'col-span-4' : ''}
            style={style}
          >
            <RenderPlugin
              pluginId={id}
              props={props}
              settings={settings}
            />
          </div>
        );
      })}
    </div>
  );
}

// Export all-in-one UI plugin renderer with ThemeProvider
export interface UIPluginRendererProps {
  children: React.ReactNode;
  themeId?: string;
  options?: PluginRendererOptions;
}

export function UIPluginRenderer({ 
  children, 
  themeId = 'light',
  options,
}: UIPluginRendererProps) {
  return (
    <ThemeProvider defaultTheme={themeId}>
      <PluginRenderer options={options}>
        {children}
      </PluginRenderer>
    </ThemeProvider>
  );
}

interface UIPluginRendererProps<TProps = any> {
  plugin: UIPluginBase<TProps>;
  props?: Partial<TProps>;
  overrideTheme?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Generic renderer for UI plugins
 */
export function UIPluginRenderer<TProps = any>({
  plugin,
  props = {},
  overrideTheme = true,
  className,
  style,
}: UIPluginRendererProps<TProps>): React.ReactElement {
  const theme = useTheme();

  // Initialize plugin if it has lifecycle methods
  React.useEffect(() => {
    if (plugin.lifecycle) {
      plugin.lifecycle.init();
      
      // Cleanup on unmount
      return () => {
        if (plugin.lifecycle) {
          plugin.lifecycle.destroy();
        }
      };
    }
  }, [plugin]);
  
  // Merge default props, theme props, and passed props
  const mergedProps = useMemo(() => {
    // Start with default props
    let result = { ...plugin.defaultProps };
    
    // Apply theme if the plugin supports it and it's not disabled
    if (overrideTheme && plugin.applyTheme) {
      result = { ...result, ...plugin.applyTheme(theme) };
    }
    
    // Apply passed props (these override defaults and theme)
    result = { ...result, ...props };
    
    return result as TProps;
  }, [plugin, props, theme, overrideTheme]);
  
  // Render the plugin component
  return (
    <div
      className={className}
      style={style}
      data-plugin-id={plugin.metadata.id}
      data-plugin-version={plugin.metadata.version}
    >
      {plugin.component(mergedProps)}
    </div>
  );
}

interface UIPluginRendererByIdProps<TProps = any> {
  pluginId: string;
  props?: Partial<TProps>;
  overrideTheme?: boolean;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
  getPlugin: (id: string) => UIPluginBase<TProps> | undefined;
}

/**
 * Renderer for UI plugins by ID
 */
export function UIPluginRendererById<TProps = any>({
  pluginId,
  props = {},
  overrideTheme = true,
  className,
  style,
  fallback = null,
  getPlugin,
}: UIPluginRendererByIdProps<TProps>): React.ReactElement | null {
  // Get plugin by ID
  const plugin = getPlugin(pluginId);
  
  // Return fallback if plugin is not found
  if (!plugin) {
    return fallback as React.ReactElement | null;
  }
  
  // Render the plugin
  return (
    <UIPluginRenderer
      plugin={plugin}
      props={props}
      overrideTheme={overrideTheme}
      className={className}
      style={style}
    />
  );
}

interface UIPluginListRendererProps<TProps = any> {
  plugins: UIPluginBase<TProps>[];
  propsMap?: Record<string, Partial<TProps>>;
  overrideTheme?: boolean;
  containerClassName?: string;
  containerStyle?: React.CSSProperties;
  itemClassName?: string;
  itemStyle?: React.CSSProperties;
  renderEmpty?: React.ReactNode;
}

/**
 * Renderer for a list of UI plugins
 */
export function UIPluginListRenderer<TProps = any>({
  plugins,
  propsMap = {},
  overrideTheme = true,
  containerClassName,
  containerStyle,
  itemClassName,
  itemStyle,
  renderEmpty = null,
}: UIPluginListRendererProps<TProps>): React.ReactElement | null {
  // Return fallback if no plugins
  if (!plugins.length) {
    return renderEmpty as React.ReactElement | null;
  }
  
  // Render the plugins
  return (
    <div className={containerClassName} style={containerStyle}>
      {plugins.map((plugin) => (
        <UIPluginRenderer
          key={plugin.metadata.id}
          plugin={plugin}
          props={propsMap[plugin.metadata.id] || {}}
          overrideTheme={overrideTheme}
          className={itemClassName}
          style={itemStyle}
        />
      ))}
    </div>
  );
}

export default UIPluginRenderer;

/**
 * UI Plugin renderer props
 */
export interface UIPluginRendererProps<TProps = any, TSettings = any, TState = any> {
  pluginId: string;
  props?: Partial<TProps>;
  settings?: Partial<TSettings>;
  initialState?: Partial<TState>;
  className?: string;
  style?: React.CSSProperties;
  onStateChange?: (state: TState) => void;
  renderError?: (error: Error) => React.ReactNode;
}

/**
 * UI Plugin renderer error boundary
 */
class UIPluginErrorBoundary extends React.Component<
  { 
    children: ReactNode; 
    onError?: (error: Error) => void;
    fallback?: ReactNode;
  }, 
  { 
    hasError: boolean; 
    error: Error | null 
  }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('UI Plugin error:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="ui-plugin-error">
          <h3>Plugin Error</h3>
          <p>{this.state.error?.message || 'An unknown error occurred'}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * UI Plugin renderer component
 */
export const UIPluginRenderer = FC<UIPluginRendererProps<any, any, any>>(({
  pluginId, 
  className, 
  style, 
  onStateChange,
  renderError,
  ...restProps 
}) => {
  const { 
    getPlugin,
    theme,
  } = usePluginRenderer();
  
  const [plugin, setPlugin] = useState<UIPluginBase<any, any, any> | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [state, setState] = useState<any | null>(null);
  
  // Get plugin from registry
  useEffect(() => {
    try {
      const foundPlugin = getPlugin<any, any, any>(pluginId);
      setPlugin(foundPlugin);
      
      // Initialize plugin state
      if (foundPlugin.defaultState || restProps.initialState) {
        const initialState = {
          ...foundPlugin.defaultState,
          ...restProps.initialState,
        } as any;
        setState(initialState);
        
        // Call lifecycle init method
        if (foundPlugin.lifecycle?.init) {
          foundPlugin.lifecycle.init();
        }
      }
    } catch (err) {
      console.error(`Error loading plugin "${pluginId}":`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      if (renderError) {
        renderError(err instanceof Error ? err : new Error(String(err)));
      }
    }
    
    // Call lifecycle destroy method when unmounting
    return () => {
      if (plugin?.lifecycle?.destroy) {
        plugin.lifecycle.destroy();
      }
    };
  }, [pluginId]);
  
  // Apply theme to plugin props
  const themedProps = useMemo(() => {
    if (!plugin) return {};
    
    // Get default props
    const defaultProps = plugin.defaultProps || {};
    
    // Apply theme to props if the plugin has an applyTheme method
    const themeProps = plugin.applyTheme ? plugin.applyTheme(theme) : {};
    
    // Merge props
    return {
      ...defaultProps,
      ...themeProps,
      ...restProps.props,
    };
  }, [plugin, theme, restProps.props]);
  
  // Apply settings
  const mergedSettings = useMemo(() => {
    if (!plugin) return {};
    
    // Get default settings
    const defaultSettings = plugin.defaultSettings || {};
    
    // Merge settings
    return {
      ...defaultSettings,
      ...restProps.settings,
    };
  }, [plugin, restProps.settings]);
  
  // Handle state updates
  const handleSetState = useMemo(() => {
    return (newState: Partial<any>) => {
      setState((prevState) => {
        const nextState = { ...prevState, ...newState } as any;
        
        // Call lifecycle update method if available
        if (plugin?.lifecycle?.update) {
          try {
            plugin.lifecycle.update(prevState, nextState);
          } catch (error) {
            console.error(`Failed to call update lifecycle method for plugin "${pluginId}":`, error);
          }
        }
        
        // Call onStateChange callback if available
        if (onStateChange) {
          try {
            onStateChange(nextState);
          } catch (error) {
            console.error(`Failed to call onStateChange callback for plugin "${pluginId}":`, error);
          }
        }
        
        return nextState;
      });
    };
  }, [plugin, pluginId, onStateChange]);
  
  // Create a wrapped component with error boundary
  const PluginComponent = useMemo(() => {
    if (!plugin || !plugin.component) {
      return null;
    }
    
    const PluginFC = plugin.component as FC<any>;
    
    return (
      <UIPluginErrorBoundary onError={renderError} fallback={restProps.fallback}>
        <PluginFC 
          {...themedProps} 
          settings={mergedSettings}
          state={state}
          setState={handleSetState}
        />
      </UIPluginErrorBoundary>
    );
  }, [plugin, themedProps, mergedSettings, state, handleSetState, renderError, restProps.fallback]);
  
  // If plugin failed to load, show error
  if (error) {
    return restProps.fallback || (
      <div className={`ui-plugin-error ${className || ''}`} style={style}>
        <h3>Failed to load plugin</h3>
        <p>{error.message}</p>
      </div>
    );
  }
  
  // If plugin is not loaded yet, show loading state
  if (!plugin) {
    return (
      <div className={`ui-plugin-loading ${className || ''}`} style={style}>
        Loading plugin...
      </div>
    );
  }
  
  // Render plugin component
  return (
    <div className={`ui-plugin ${className || ''}`} style={style}>
      {PluginComponent}
    </div>
  );
});

UIPluginRenderer.displayName = 'UIPluginRenderer';

/**
 * Create a UI Plugin renderer factory function
 * This allows creating a strongly typed renderer for a specific plugin
 */
export function createUIPluginRenderer<TProps = any, TSettings = any, TState = any>(
  pluginId: string
): FC<Omit<UIPluginRendererProps<TProps, TSettings, TState>, 'pluginId'>> {
  const PluginRenderer: FC<Omit<UIPluginRendererProps<TProps, TSettings, TState>, 'pluginId'>> = 
    props => <UIPluginRenderer pluginId={pluginId} {...props as any} />;
  
  PluginRenderer.displayName = `UIPluginRenderer(${pluginId})`;
  
  return PluginRenderer;
}

/**
 * UI Plugin list renderer props
 */
export interface UIPluginListRendererProps<TProps = any, TSettings = any, TState = any> {
  plugins: UIPluginBase<TProps, TSettings, TState>[];
  commonProps?: Partial<TProps>;
  commonSettings?: Partial<TSettings>;
  commonInitialState?: Partial<TState>;
  renderContainer?: (plugin: UIPluginBase<TProps, TSettings, TState>, index: number) => React.ReactElement;
  onError?: (error: Error, plugin: UIPluginBase<TProps, TSettings, TState>) => React.ReactNode;
  className?: string;
  containerClassName?: string;
  style?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
}

/**
 * UI Plugin list renderer
 */
export function UIPluginListRenderer<TProps = any, TSettings = any, TState = any>({
  plugins,
  commonProps = {},
  commonSettings = {},
  commonInitialState = {},
  renderContainer,
  onError,
  className,
  containerClassName,
  style,
  containerStyle,
}: UIPluginListRendererProps<TProps, TSettings, TState>): React.ReactElement {
  return (
    <div className={`ui-plugin-list ${className || ''}`} style={style}>
      {plugins.map((plugin, index) => {
        if (renderContainer) {
          return renderContainer(plugin, index);
        }
        
        return (
          <UIPluginRenderer
            key={`${plugin.metadata.id}-${index}`}
            pluginId={plugin.metadata.id}
            props={commonProps}
            settings={commonSettings}
            initialState={commonInitialState}
            onStateChange={onError ? (state) => onError(new Error(`State change for plugin "${plugin.metadata.id}"`), plugin) : undefined}
            className={containerClassName}
            style={containerStyle}
          />
        );
      })}
    </div>
  );
}

/**
 * UI Plugin category renderer props
 */
export interface UIPluginCategoryRendererProps<TProps = any, TSettings = any, TState = any> {
  category: string;
  commonProps?: Partial<TProps>;
  commonSettings?: Partial<TSettings>;
  commonInitialState?: Partial<TState>;
  renderContainer?: (plugin: UIPluginBase<TProps, TSettings, TState>, index: number) => React.ReactElement;
  onEmpty?: () => React.ReactNode;
  onError?: (error: Error, plugin: UIPluginBase<TProps, TSettings, TState>) => React.ReactNode;
  className?: string;
  containerClassName?: string;
  style?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
}

/**
 * UI Plugin category renderer
 */
export function UIPluginCategoryRenderer<TProps = any, TSettings = any, TState = any>({
  category,
  commonProps = {},
  commonSettings = {},
  commonInitialState = {},
  renderContainer,
  onEmpty,
  onError,
  className,
  containerClassName,
  style,
  containerStyle,
}: UIPluginCategoryRendererProps<TProps, TSettings, TState>): React.ReactElement | null {
  // Get plugins by category
  const plugins = useMemo(() => {
    return globalPluginRegistry.getPluginsByCategory<TProps, TSettings, TState>(category);
  }, [category]);
  
  // If no plugins found, render empty component or null
  if (plugins.length === 0) {
    return onEmpty ? <>{onEmpty()}</> : null;
  }
  
  // Render plugin list
  return (
    <UIPluginListRenderer
      plugins={plugins}
      commonProps={commonProps}
      commonSettings={commonSettings}
      commonInitialState={commonInitialState}
      renderContainer={renderContainer}
      onError={onError}
      className={className}
      containerClassName={containerClassName}
      style={style}
      containerStyle={containerStyle}
    />
  );
}

/**
 * UI Plugin tag renderer props
 */
export interface UIPluginTagRendererProps<TProps = any, TSettings = any, TState = any> {
  tag: string;
  commonProps?: Partial<TProps>;
  commonSettings?: Partial<TSettings>;
  commonInitialState?: Partial<TState>;
  renderContainer?: (plugin: UIPluginBase<TProps, TSettings, TState>, index: number) => React.ReactElement;
  onEmpty?: () => React.ReactNode;
  onError?: (error: Error, plugin: UIPluginBase<TProps, TSettings, TState>) => React.ReactNode;
  className?: string;
  containerClassName?: string;
  style?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
}

/**
 * UI Plugin tag renderer
 */
export function UIPluginTagRenderer<TProps = any, TSettings = any, TState = any>({
  tag,
  commonProps = {},
  commonSettings = {},
  commonInitialState = {},
  renderContainer,
  onEmpty,
  onError,
  className,
  containerClassName,
  style,
  containerStyle,
}: UIPluginTagRendererProps<TProps, TSettings, TState>): React.ReactElement | null {
  // Get plugins by tag
  const plugins = useMemo(() => {
    return globalPluginRegistry.getPluginsByTag<TProps, TSettings, TState>(tag);
  }, [tag]);
  
  // If no plugins found, render empty component or null
  if (plugins.length === 0) {
    return onEmpty ? <>{onEmpty()}</> : null;
  }
  
  // Render plugin list
  return (
    <UIPluginListRenderer
      plugins={plugins}
      commonProps={commonProps}
      commonSettings={commonSettings}
      commonInitialState={commonInitialState}
      renderContainer={renderContainer}
      onError={onError}
      className={className}
      containerClassName={containerClassName}
      style={style}
      containerStyle={containerStyle}
    />
  );
}

interface PluginRendererProps<TProps = any, TSettings = any, TState = any> {
  plugin: UIPluginBase<TProps, TSettings, TState>;
  settings?: Partial<TSettings>;
  initialState?: Partial<TState>;
  props?: Partial<TProps>;
  theme?: any;
  onStateChange?: (newState: TState) => void;
}

/**
 * PluginRenderer Component
 * Renders a UI plugin with the appropriate props, settings, and state management
 */
export function PluginRenderer<TProps = any, TSettings = any, TState = any>({
  plugin,
  settings = {},
  initialState = {},
  props = {},
  theme,
  onStateChange,
}: PluginRendererProps<TProps, TSettings, TState>) {
  // Combine default settings with provided settings
  const mergedSettings = {
    ...plugin.defaultSettings,
    ...settings,
  } as TSettings;
  
  // Initialize state with defaults and provided initial state
  const [state, setStateInternal] = useState<TState>({
    ...plugin.defaultState,
    ...initialState,
  } as TSettings);
  
  // Generate props with theme application if available
  const themeProps = theme && plugin.applyTheme ? plugin.applyTheme(theme) : {};
  
  // Combine all props
  const mergedProps = {
    ...plugin.defaultProps,
    ...themeProps,
    ...props,
  } as TProps;
  
  // State setter that notifies parent component
  const setState = useCallback((newPartialState: Partial<TState>) => {
    setStateInternal((prevState) => {
      const newState = { ...prevState, ...newPartialState };
      
      // Trigger lifecycle update method if available
      if (plugin.lifecycle?.update) {
        plugin.lifecycle.update(prevState, newState);
      }
      
      // Notify parent component if callback provided
      if (onStateChange) {
        onStateChange(newState);
      }
      
      return newState;
    });
  }, [plugin, onStateChange]);
  
  // Initialize plugin when component mounts
  useEffect(() => {
    if (plugin.lifecycle?.init) {
      plugin.lifecycle.init();
    }
    
    // Cleanup when component unmounts
    return () => {
      if (plugin.lifecycle?.destroy) {
        plugin.lifecycle.destroy();
      }
    };
  }, [plugin]);
  
  // Render the plugin component with all necessary props
  const PluginComponent = plugin.component;
  return (
    <PluginComponent
      {...mergedProps}
      settings={mergedSettings}
      state={state}
      setState={setState}
    />
  );
}

/**
 * Plugin Error Boundary Component
 * Catches errors in plugin rendering and shows a fallback UI
 */
interface PluginErrorBoundaryProps {
  pluginId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface PluginErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class PluginErrorBoundary extends React.Component<
  PluginErrorBoundaryProps,
  PluginErrorBoundaryState
> {
  constructor(props: PluginErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error): PluginErrorBoundaryState {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`Error in plugin ${this.props.pluginId}:`, error, errorInfo);
  }
  
  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default error UI
      return (
        <div className="plugin-error">
          <h3>Plugin Error</h3>
          <p>The plugin {this.props.pluginId} encountered an error.</p>
          <p>{this.state.error?.message || 'Unknown error'}</p>
        </div>
      );
    }
    
    return this.props.children;
  }
}

/**
 * Safe Plugin Renderer Component
 * Wraps the PluginRenderer in an error boundary
 */
export function SafePluginRenderer<TProps = any, TSettings = any, TState = any>(
  props: PluginRendererProps<TProps, TSettings, TState> & {
    fallback?: React.ReactNode;
  }
) {
  const { plugin, fallback, ...rendererProps } = props;
  
  return (
    <PluginErrorBoundary pluginId={plugin.metadata.id} fallback={fallback}>
      <PluginRenderer plugin={plugin} {...rendererProps} />
    </PluginErrorBoundary>
  );
}

// Context for providing plugins and renderer state
export interface UIPluginRendererContextValue {
  // Registry containing all registered plugins
  registry: UIPluginRegistry;
  
  // Get a plugin by ID
  getPlugin: <TProps = any, TSettings = any, TState = any>(
    pluginId: string
  ) => UIPluginBase<TProps, TSettings, TState> | undefined;
  
  // Get plugins by category
  getPluginsByCategory: (category: string) => UIPluginBase<any, any, any>[];
  
  // Get plugins by tag
  getPluginsByTag: (tag: string) => UIPluginBase<any, any, any>[];
  
  // Current theme
  theme: any;
}

// Create the context with a default value
export const UIPluginRendererContext = React.createContext<UIPluginRendererContextValue | null>(null);

// Hook to use the plugin renderer context
export function useUIPluginRenderer(): UIPluginRendererContextValue {
  const context = React.useContext(UIPluginRendererContext);
  if (!context) {
    throw new Error('useUIPluginRenderer must be used within a UIPluginRendererProvider');
  }
  return context;
}

// Props for the renderer provider
export interface UIPluginRendererProviderProps {
  // Registry containing all plugins
  registry: UIPluginRegistry;
  
  // Current theme 
  theme: any;
  
  // Children components
  children: React.ReactNode;
}

// Plugin Renderer Provider Component
export const UIPluginRendererProvider: React.FC<UIPluginRendererProviderProps> = ({
  registry,
  theme,
  children,
}) => {
  // Create context value
  const contextValue: UIPluginRendererContextValue = {
    registry,
    getPlugin: registry.getPlugin,
    getPluginsByCategory: registry.getPluginsByCategory,
    getPluginsByTag: registry.getPluginsByTag,
    theme,
  };
  
  return (
    <UIPluginRendererContext.Provider value={contextValue}>
      {children}
    </UIPluginRendererContext.Provider>
  );
};

// Props for the plugin renderer component
export interface PluginRendererProps<TProps = any, TSettings = any, TState = any> {
  // ID of the plugin to render
  pluginId: string;
  
  // Props to pass to the plugin
  props?: Partial<TProps>;
  
  // Settings to override default plugin settings
  settings?: Partial<TSettings>;
  
  // Initial state to override default plugin state
  initialState?: Partial<TState>;
  
  // Callback when state changes
  onStateChange?: (state: TState) => void;
  
  // Class name to apply to the container
  className?: string;
  
  // Additional styles to apply to the container
  style?: React.CSSProperties;
}

// Plugin Renderer Component
export function PluginRenderer<TProps = any, TSettings = any, TState = any>({
  pluginId,
  props = {},
  settings = {},
  initialState = {},
  onStateChange,
  className,
  style,
}: PluginRendererProps<TProps, TSettings, TState>): React.ReactElement | null {
  // Get the plugin renderer context
  const { getPlugin, theme } = useUIPluginRenderer();
  
  // Get the plugin from the registry
  const plugin = getPlugin<TProps, TSettings, TState>(pluginId);
  
  // Return null if plugin is not found
  if (!plugin) {
    console.warn(`Plugin with ID ${pluginId} not found`);
    return null;
  }
  
  // Combine default state with initial state
  const [state, setStateInternal] = useState<TState>({
    ...plugin.defaultState,
    ...initialState,
  });
  
  // Combine default settings with provided settings
  const effectiveSettings = {
    ...plugin.defaultSettings,
    ...settings,
  };
  
  // Combine default props with theme props and provided props
  const effectiveProps = {
    ...plugin.defaultProps,
    ...(plugin.applyTheme ? plugin.applyTheme(theme) : {}),
    ...props,
  };
  
  // Initialize plugin if needed
  useEffect(() => {
    if (plugin.lifecycle?.init) {
      plugin.lifecycle.init();
    }
    
    // Cleanup when unmounting
    return () => {
      if (plugin.lifecycle?.destroy) {
        plugin.lifecycle.destroy();
      }
    };
  }, [plugin]);
  
  // Create a state setter that notifies about changes
  const setState = useCallback(
    (partialState: Partial<TState>) => {
      setStateInternal((prevState) => {
        const newState = { ...prevState, ...partialState };
        
        // Call the update lifecycle method if provided
        if (plugin.lifecycle?.update) {
          plugin.lifecycle.update(prevState, newState);
        }
        
        // Call the onStateChange callback if provided
        if (onStateChange) {
          onStateChange(newState);
        }
        
        return newState;
      });
    },
    [plugin, onStateChange]
  );
  
  // Get the component to render
  const Component = plugin.component;
  
  // Render the component with props, settings, and state
  return (
    <div className={className} style={style}>
      <Component
        {...effectiveProps}
        settings={effectiveSettings}
        state={state}
        setState={setState}
      />
    </div>
  );
}

// Dynamic Plugin Renderer (renders a plugin by ID)
export const DynamicPluginRenderer: React.FC<{
  pluginId: string;
  [key: string]: any;
}> = ({ pluginId, ...rest }) => {
  return <PluginRenderer pluginId={pluginId} props={rest} />;
};

// Plugin List Renderer (renders all plugins in a category)
export interface PluginListRendererProps {
  // Category to filter plugins by
  category: string;
  
  // Render function to customize how each plugin is rendered
  renderItem?: (plugin: UIPluginBase<any, any, any>, index: number) => React.ReactNode;
  
  // Class name to apply to the container
  className?: string;
  
  // Additional styles to apply to the container
  style?: React.CSSProperties;
}

export const PluginListRenderer: React.FC<PluginListRendererProps> = ({
  category,
  renderItem,
  className,
  style,
}) => {
  // Get the plugin renderer context
  const { getPluginsByCategory } = useUIPluginRenderer();
  
  // Get all plugins in the category
  const plugins = getPluginsByCategory(category);
  
  return (
    <div className={className} style={style}>
      {plugins.map((plugin, index) => {
        if (renderItem) {
          return renderItem(plugin, index);
        }
        
        return (
          <PluginRenderer
            key={plugin.metadata.id}
            pluginId={plugin.metadata.id}
          />
        );
      })}
    </div>
  );
};

/**
 * Props for the UIPluginRenderer component
 */
interface UIPluginRendererProps<TProps = any, TSettings = any, TState = any> {
  // The plugin instance to render
  plugin: UIPluginBase<TProps, TSettings, TState>;
  
  // Additional props to pass to the plugin component
  componentProps?: Partial<TProps>;
  
  // Theme object to apply to the plugin
  theme?: any;
  
  // Whether to apply the theme to the plugin
  applyTheme?: boolean;
  
  // Error boundary fallback component
  errorFallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  
  // Loading component to show while the plugin is loading
  loadingComponent?: React.ReactNode;
  
  // Whether to show a loading indicator while the plugin is initializing
  showLoading?: boolean;
  
  // Whether to apply the lifecycle hooks
  applyLifecycle?: boolean;
  
  // Additional class name to apply to the container
  className?: string;
  
  // Additional style to apply to the container
  style?: React.CSSProperties;
  
  // Called when the plugin throws an error
  onError?: (error: Error) => void;
}

/**
 * Error boundary for UI plugins
 */
class UIPluginErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<{ error: Error; resetError: () => void }>; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; fallback: React.ComponentType<{ error: Error; resetError: () => void }>; onError?: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent = this.props.fallback;
      return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
    }

    return this.props.children;
  }
}

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<{ error: Error; resetError: () => void }> = ({ error, resetError }) => {
  return (
    <div className="ui-plugin-error">
      <h3>Error in UI plugin</h3>
      <p>{error.message}</p>
      <button onClick={resetError}>Try Again</button>
    </div>
  );
};

/**
 * Default loading component
 */
const DefaultLoadingComponent: React.FC = () => {
  return (
    <div className="ui-plugin-loading">
      <span>Loading plugin...</span>
    </div>
  );
};

/**
 * UI Plugin Renderer Component
 * Renders a UI plugin with proper error handling and lifecycle management
 */
export function UIPluginRenderer<TProps = any, TSettings = any, TState = any>({
  plugin,
  componentProps = {},
  theme,
  applyTheme = true,
  errorFallback = DefaultErrorFallback,
  loadingComponent = <DefaultLoadingComponent />,
  showLoading = true,
  applyLifecycle = true,
  className = '',
  style = {},
  onError,
}: UIPluginRendererProps<TProps, TSettings, TState>) {
  const [isLoading, setIsLoading] = useState(showLoading);
  
  // Apply theme to props if needed
  const finalProps = useMemo(() => {
    const baseProps = componentProps as TProps;
    return applyTheme && theme ? plugin.getThemedProps(baseProps, theme) : baseProps;
  }, [plugin, componentProps, theme, applyTheme]);
  
  // Apply lifecycle hooks
  useEffect(() => {
    if (applyLifecycle) {
      // Call mount hook
      plugin.mount();
      
      // Call unmount hook on cleanup
      return () => {
        plugin.unmount();
      };
    }
  }, [plugin, applyLifecycle]);
  
  // Handle loading state
  useEffect(() => {
    if (showLoading) {
      // Simulate loading for demonstration
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      
      return () => {
        clearTimeout(timer);
      };
    } else {
      setIsLoading(false);
    }
  }, [showLoading]);
  
  // Access the component from the plugin
  const PluginComponent = plugin.component;
  
  // Render the plugin component with error boundary
  return (
    <div className={`ui-plugin-container ${className}`} style={style}>
      {isLoading ? (
        loadingComponent
      ) : (
        <UIPluginErrorBoundary fallback={errorFallback} onError={onError}>
          <PluginComponent
            {...finalProps}
            settings={plugin.settings}
            state={plugin.state}
            setState={(newState) => plugin.setState(newState)}
          />
        </UIPluginErrorBoundary>
      )}
    </div>
  );
}

/**
 * Higher-order component to create a plugin renderer for a specific plugin
 */
export function createPluginRenderer<TProps = any, TSettings = any, TState = any>(
  plugin: UIPluginBase<TProps, TSettings, TState>,
  defaultProps: Partial<UIPluginRendererProps<TProps, TSettings, TState>> = {}
) {
  return function PluginRenderer(props: Partial<UIPluginRendererProps<TProps, TSettings, TState>>) {
    return <UIPluginRenderer plugin={plugin} {...defaultProps} {...props} />;
  };
}

/**
 * Render multiple plugins in a grid layout
 */
export function UIPluginGrid<TProps = any, TSettings = any, TState = any>({
  plugins,
  columns = 3,
  gap = '1rem',
  ...rendererProps
}: {
  plugins: Array<UIPluginBase<TProps, TSettings, TState>>;
  columns?: number;
  gap?: string;
} & Omit<UIPluginRendererProps<TProps, TSettings, TState>, 'plugin'>) {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap,
    width: '100%',
  };
  
  return (
    <div className="ui-plugin-grid" style={gridStyle}>
      {plugins.map((plugin) => (
        <UIPluginRenderer
          key={plugin.metadata.id}
          plugin={plugin}
          {...rendererProps}
        />
      ))}
    </div>
  );
}

/**
 * Render a single plugin with a label
 */
export function LabeledUIPlugin<TProps = any, TSettings = any, TState = any>({
  plugin,
  label,
  labelPosition = 'top',
  labelStyle = {},
  ...rendererProps
}: {
  plugin: UIPluginBase<TProps, TSettings, TState>;
  label: string;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  labelStyle?: React.CSSProperties;
} & Omit<UIPluginRendererProps<TProps, TSettings, TState>, 'plugin'>) {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 
      labelPosition === 'top' ? 'column' :
      labelPosition === 'bottom' ? 'column-reverse' :
      labelPosition === 'left' ? 'row' : 'row-reverse',
    alignItems: 
      labelPosition === 'top' || labelPosition === 'bottom' ? 'stretch' : 'center',
    gap: '0.5rem',
  };
  
  const defaultLabelStyle: React.CSSProperties = {
    fontWeight: 'bold',
    padding: '0.25rem 0',
  };
  
  return (
    <div className="labeled-ui-plugin" style={containerStyle}>
      <div className="ui-plugin-label" style={{ ...defaultLabelStyle, ...labelStyle }}>
        {label}
      </div>
      <UIPluginRenderer plugin={plugin} {...rendererProps} />
    </div>
  );
}

interface UIPluginRendererProps<TProps = any, TSettings = any, TState = any> {
  // The plugin to render
  plugin: UIPluginBase<TProps, TSettings, TState>;
  
  // Override props to pass to the plugin component
  props?: Partial<TProps>;
  
  // Theme to apply to the component
  theme?: any;
  
  // Error boundary fallback UI
  errorFallback?: React.ReactNode;
  
  // Whether to render a loading state while the plugin initializes
  showLoading?: boolean;
  
  // Custom loading component
  loadingComponent?: React.ReactNode;
  
  // Whether the plugin is enabled
  enabled?: boolean;
  
  // Callback when an error occurs
  onError?: (error: Error) => void;
}

/**
 * Error boundary component for plugin rendering
 */
class PluginErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; onError?: (error: Error) => void; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { fallback?: React.ReactNode; onError?: (error: Error) => void; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Plugin rendering error:', error, errorInfo);
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="plugin-error">
          <h3>Plugin Error</h3>
          <p>{this.state.error?.message || 'An unknown error occurred'}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Renderer component for UI plugins
 */
export function UIPluginRenderer<TProps = any>({
  plugin,
  props = {},
  theme,
  errorFallback,
  showLoading = true,
  loadingComponent,
  enabled = true,
  onError,
}: UIPluginRendererProps<TProps>) {
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Initialize the plugin
  useEffect(() => {
    if (!enabled) return;
    
    try {
      if (!isInitialized) {
        // Mount the plugin
        plugin.mount();
        setIsInitialized(true);
      }
      
      // Set loading to false after a short delay
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 100);
      
      return () => {
        clearTimeout(timer);
        
        // Unmount only if we're fully unmounting
        if (isInitialized) {
          plugin.unmount();
          setIsInitialized(false);
        }
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsLoading(false);
      if (onError) {
        onError(error);
      }
    }
  }, [plugin, enabled, isInitialized, onError]);

  // Get themed props for the component
  const themedProps = useMemo(() => {
    if (!theme) {
      return { ...plugin.defaultProps, ...props };
    }
    
    // Apply theme transformations to props
    return plugin.getThemedProps({ ...plugin.defaultProps, ...props }, theme);
  }, [plugin, props, theme]);

  // Handle error state
  if (error) {
    return errorFallback ? (
      <>{errorFallback}</>
    ) : (
      <div className="plugin-error">
        <h3>Plugin Error</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  // Handle loading state
  if (isLoading && showLoading) {
    return loadingComponent ? (
      <>{loadingComponent}</>
    ) : (
      <div className="plugin-loading">Loading plugin...</div>
    );
  }

  // Render nothing if the plugin is disabled
  if (!enabled) {
    return null;
  }

  // The actual plugin component with error boundary
  const PluginComponent = plugin.component;
  
  return (
    <PluginErrorBoundary fallback={errorFallback} onError={onError}>
      <PluginComponent
        {...themedProps}
        settings={plugin.settings}
        state={plugin.state}
        setState={plugin.setState}
      />
    </PluginErrorBoundary>
  );
}

/**
 * Multi-plugin renderer for rendering multiple plugins in a container
 */
export function UIPluginMultiRenderer<TProps = any>({
  plugins,
  containerComponent: Container = 'div',
  containerProps = {},
  itemComponent: Item = 'div',
  itemProps = {},
  theme,
  enabled = true,
  onError,
}: {
  // Array of plugins to render
  plugins: Array<UIPluginBase<TProps>>;
  
  // Container component to wrap all plugins
  containerComponent?: React.ComponentType<any> | string;
  
  // Props to pass to the container component
  containerProps?: Record<string, any>;
  
  // Component to wrap each individual plugin
  itemComponent?: React.ComponentType<any> | string;
  
  // Props to pass to each item component
  itemProps?: Record<string, any>;
  
  // Theme to apply to all plugins
  theme?: any;
  
  // Whether all plugins are enabled
  enabled?: boolean;
  
  // Error callback
  onError?: (error: Error, plugin: UIPluginBase<TProps>) => void;
}) {
  return (
    <Container {...containerProps}>
      {plugins.map((plugin) => (
        <Item key={plugin.metadata.id} {...itemProps}>
          <UIPluginRenderer
            plugin={plugin}
            theme={theme}
            enabled={enabled}
            onError={onError ? (error) => onError(error, plugin) : undefined}
          />
        </Item>
      ))}
    </Container>
  );
}

/**
 * Plugin slot renderer for rendering plugins that extend specific extension points
 */
export function UIPluginSlotRenderer<TProps = any>({
  registry,
  extensionPoint,
  containerComponent: Container = 'div',
  containerProps = {},
  itemComponent: Item = 'div',
  itemProps = {},
  theme,
  enabled = true,
  filter,
  onError,
}: {
  // Plugin registry to get plugins from
  registry: { getAll: () => Array<UIPluginBase<any>> };
  
  // Extension point to filter plugins by
  extensionPoint: string;
  
  // Container component to wrap all plugins
  containerComponent?: React.ComponentType<any> | string;
  
  // Props to pass to the container component
  containerProps?: Record<string, any>;
  
  // Component to wrap each individual plugin
  itemComponent?: React.ComponentType<any> | string;
  
  // Props to pass to each item component
  itemProps?: Record<string, any>;
  
  // Theme to apply to all plugins
  theme?: any;
  
  // Whether all plugins are enabled
  enabled?: boolean;
  
  // Custom filter function for plugins
  filter?: (plugin: UIPluginBase<any>) => boolean;
  
  // Error callback
  onError?: (error: Error, plugin: UIPluginBase<any>) => void;
}) {
  // Filter plugins that match the extension point
  const plugins = useMemo(() => {
    const allPlugins = registry.getAll();
    return allPlugins.filter((plugin) => {
      // Check if the plugin extends the requested extension point
      const hasExtensionPoint = plugin.metadata.extensionPoints?.includes(extensionPoint);
      
      // Apply custom filter if provided
      if (filter && !filter(plugin)) {
        return false;
      }
      
      return hasExtensionPoint;
    });
  }, [registry, extensionPoint, filter]);

  // If no plugins match, render nothing
  if (plugins.length === 0) {
    return null;
  }

  // Render all matching plugins
  return (
    <Container {...containerProps}>
      {plugins.map((plugin) => (
        <Item key={plugin.metadata.id} {...itemProps}>
          <UIPluginRenderer
            plugin={plugin}
            theme={theme}
            enabled={enabled}
            onError={onError ? (error) => onError(error, plugin) : undefined}
          />
        </Item>
      ))}
    </Container>
  );
}

/**
 * UI Plugin registry context
 */
export interface UIPluginRegistryContextType {
  // Plugin registry
  registry: UIPluginRegistry;
  
  // Register a plugin
  registerPlugin: (metadata: UIPluginMetadata, component: React.ComponentType<any>) => void;
  
  // Unregister a plugin
  unregisterPlugin: (pluginId: string) => void;
  
  // Get a plugin
  getPlugin: (pluginId: string) => { metadata: UIPluginMetadata; component: React.ComponentType<any> } | undefined;
  
  // Get all plugins
  getAllPlugins: () => { metadata: UIPluginMetadata; component: React.ComponentType<any> }[];
  
  // Get plugins by category
  getPluginsByCategory: (category: string) => { metadata: UIPluginMetadata; component: React.ComponentType<any> }[];
  
  // Get plugins by tag
  getPluginsByTag: (tag: string) => { metadata: UIPluginMetadata; component: React.ComponentType<any> }[];
  
  // Load a plugin manifest
  loadPluginManifest: (manifest: UIPluginManifestSchema) => Promise<void>;
  
  // Load a plugin from a URL
  loadPluginFromUrl: (url: string) => Promise<void>;
}

/**
 * UI Plugin registry context
 */
export const UIPluginRegistryContext = createContext<UIPluginRegistryContextType | null>(null);

/**
 * Use UI Plugin registry hook
 */
export function useUIPluginRegistry(): UIPluginRegistryContextType {
  const context = useContext(UIPluginRegistryContext);
  
  if (!context) {
    throw new Error('useUIPluginRegistry must be used within a UIPluginRegistryProvider');
  }
  
  return context;
}

/**
 * UI Plugin registry provider
 */
export function UIPluginRegistryProvider({ children }: { children: React.ReactNode }): JSX.Element {
  // Plugin registry
  const registry = useMemo(() => UIPluginRegistry.getInstance(), []);
  
  // Plugin components
  const [plugins, setPlugins] = useState<Map<string, { metadata: UIPluginMetadata; component: React.ComponentType<any> }>>(
    new Map()
  );
  
  // Register a plugin
  const registerPlugin = useCallback((metadata: UIPluginMetadata, component: React.ComponentType<any>) => {
    setPlugins(prevPlugins => {
      const newPlugins = new Map(prevPlugins);
      newPlugins.set(metadata.id, { metadata, component });
      return newPlugins;
    });
  }, []);
  
  // Unregister a plugin
  const unregisterPlugin = useCallback((pluginId: string) => {
    setPlugins(prevPlugins => {
      const newPlugins = new Map(prevPlugins);
      newPlugins.delete(pluginId);
      return newPlugins;
    });
  }, []);
  
  // Get a plugin
  const getPlugin = useCallback((pluginId: string) => {
    return plugins.get(pluginId);
  }, [plugins]);
  
  // Get all plugins
  const getAllPlugins = useCallback(() => {
    return Array.from(plugins.values());
  }, [plugins]);
  
  // Get plugins by category
  const getPluginsByCategory = useCallback((category: string) => {
    return Array.from(plugins.values()).filter(plugin => plugin.metadata.category === category);
  }, [plugins]);
  
  // Get plugins by tag
  const getPluginsByTag = useCallback((tag: string) => {
    return Array.from(plugins.values()).filter(plugin => plugin.metadata.tags?.includes(tag));
  }, [plugins]);
  
  // Load a plugin manifest
  const loadPluginManifest = useCallback(async (manifest: UIPluginManifestSchema) => {
    // TODO: Implement plugin loading from manifest
    console.log('Loading plugin manifest:', manifest);
  }, []);
  
  // Load a plugin from a URL
  const loadPluginFromUrl = useCallback(async (url: string) => {
    try {
      const response = await fetch(url);
      const json = await response.text();
      const manifest = UIPluginManifestLoader.loadFromJson(json);
      await loadPluginManifest(manifest);
    } catch (error) {
      console.error(`Failed to load plugin from URL: ${url}`, error);
    }
  }, [loadPluginManifest]);
  
  // Registry context value
  const contextValue = useMemo(() => ({
    registry,
    registerPlugin,
    unregisterPlugin,
    getPlugin,
    getAllPlugins,
    getPluginsByCategory,
    getPluginsByTag,
    loadPluginManifest,
    loadPluginFromUrl
  }), [
    registry,
    registerPlugin,
    unregisterPlugin,
    getPlugin,
    getAllPlugins,
    getPluginsByCategory,
    getPluginsByTag,
    loadPluginManifest,
    loadPluginFromUrl
  ]);
  
  return (
    <UIPluginRegistryContext.Provider value={contextValue}>
      {children}
    </UIPluginRegistryContext.Provider>
  );
}

/**
 * UI Plugin renderer props
 */
export interface UIPluginRendererProps {
  // Plugin ID
  pluginId: string;
  
  // Plugin props
  pluginProps?: Record<string, any>;
  
  // Fallback component
  fallback?: React.ReactNode;
  
  // On error
  onError?: (error: Error) => void;
}

/**
 * UI Plugin renderer
 */
export function UIPluginRenderer({
  pluginId,
  pluginProps = {},
  fallback = null,
  onError
}: UIPluginRendererProps): JSX.Element {
  // Plugin registry
  const { getPlugin } = useUIPluginRegistry();
  
  // Plugin state
  const [plugin, setPlugin] = useState<{ metadata: UIPluginMetadata; component: React.ComponentType<any> } | undefined>(
    getPlugin(pluginId)
  );
  const [error, setError] = useState<Error | null>(null);
  
  // Update plugin when plugin ID changes
  useEffect(() => {
    setPlugin(getPlugin(pluginId));
    setError(null);
  }, [getPlugin, pluginId]);
  
  // Handle error
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);
  
  // Render plugin
  if (error) {
    return <>{fallback}</>;
  }
  
  if (!plugin) {
    return <>{fallback}</>;
  }
  
  try {
    const { component: PluginComponent } = plugin;
    return <PluginComponent {...pluginProps} />;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    setError(error);
    return <>{fallback}</>;
  }
}

/**
 * UI Plugin slot props
 */
export interface UIPluginSlotProps {
  // Slot name
  slotName: string;
  
  // Slot props
  slotProps?: Record<string, any>;
  
  // Filter plugins
  filterPlugins?: (plugin: { metadata: UIPluginMetadata; component: React.ComponentType<any> }) => boolean;
  
  // Render plugin
  renderPlugin?: (plugin: { metadata: UIPluginMetadata; component: React.ComponentType<any> }, index: number) => React.ReactNode;
  
  // Fallback component
  fallback?: React.ReactNode;
  
  // On error
  onError?: (error: Error, pluginId: string) => void;
}

/**
 * UI Plugin slot
 */
export function UIPluginSlot({
  slotName,
  slotProps = {},
  filterPlugins,
  renderPlugin,
  fallback = null,
  onError
}: UIPluginSlotProps): JSX.Element {
  // Plugin registry
  const { registry, getAllPlugins } = useUIPluginRegistry();
  
  // Filtered plugins
  const plugins = useMemo(() => {
    const allPlugins = getAllPlugins();
    
    // Get plugins for this slot
    const pluginsForSlot = allPlugins.filter(plugin => {
      // Skip disabled plugins
      if (plugin.metadata.enabled === false) {
        return false;
      }
      
      // Check if plugin is registered for this slot
      const pluginsForSlot = registry.getPluginsForSlot(slotName);
      return pluginsForSlot.includes(plugin.metadata.id);
    });
    
    // Apply filter if provided
    return filterPlugins ? pluginsForSlot.filter(filterPlugins) : pluginsForSlot;
  }, [getAllPlugins, filterPlugins, registry, slotName]);
  
  // Default render function
  const defaultRenderPlugin = useCallback((plugin: { metadata: UIPluginMetadata; component: React.ComponentType<any> }, index: number) => {
    return (
      <UIPluginRenderer
        key={`${plugin.metadata.id}-${index}`}
        pluginId={plugin.metadata.id}
        pluginProps={slotProps}
        onError={error => onError?.(error, plugin.metadata.id)}
        fallback={null}
      />
    );
  }, [slotProps, onError]);
  
  // Render plugins
  return (
    <>
      {plugins.length > 0 ? (
        plugins.map(renderPlugin || defaultRenderPlugin)
      ) : (
        fallback
      )}
    </>
  );
}

/**
 * Use UI Plugin hook
 */
export function useUIPlugin<T = any>(pluginId: string): {
  metadata: UIPluginMetadata | null;
  component: React.ComponentType<T> | null;
  loading: boolean;
  error: Error | null;
} {
  // Plugin registry
  const { getPlugin } = useUIPluginRegistry();
  
  // Plugin state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [plugin, setPlugin] = useState<{ metadata: UIPluginMetadata; component: React.ComponentType<T> } | null>(null);
  
  // Load plugin
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    try {
      const foundPlugin = getPlugin(pluginId);
      
      if (foundPlugin) {
        setPlugin(foundPlugin as { metadata: UIPluginMetadata; component: React.ComponentType<T> });
      } else {
        setPlugin(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [getPlugin, pluginId]);
  
  return {
    metadata: plugin?.metadata || null,
    component: plugin?.component || null,
    loading,
    error
  };
}

/**
 * Use UI Plugin slot hook
 */
export function useUIPluginSlot(slotName: string, filter?: (metadata: UIPluginMetadata) => boolean): {
  plugins: { metadata: UIPluginMetadata; component: React.ComponentType<any> }[];
  loading: boolean;
  error: Error | null;
} {
  // Plugin registry
  const { registry, getAllPlugins } = useUIPluginRegistry();
  
  // Plugin slot state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [plugins, setPlugins] = useState<{ metadata: UIPluginMetadata; component: React.ComponentType<any> }[]>([]);
  
  // Load plugin slot
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    try {
      const allPlugins = getAllPlugins();
      
      // Get plugins for this slot
      const pluginsForSlot = allPlugins.filter(plugin => {
        // Skip disabled plugins
        if (plugin.metadata.enabled === false) {
          return false;
        }
        
        // Check if plugin is registered for this slot
        const pluginsForSlot = registry.getPluginsForSlot(slotName);
        return pluginsForSlot.includes(plugin.metadata.id);
      });
      
      // Apply filter if provided
      const filteredPlugins = filter
        ? pluginsForSlot.filter(plugin => filter(plugin.metadata))
        : pluginsForSlot;
      
      setPlugins(filteredPlugins);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [getAllPlugins, filter, registry, slotName]);
  
  return {
    plugins,
    loading,
    error
  };
}

export default {
  UIPluginRegistryProvider,
  UIPluginRenderer,
  UIPluginSlot,
  useUIPlugin,
  useUIPluginSlot,
  useUIPluginRegistry
}; 