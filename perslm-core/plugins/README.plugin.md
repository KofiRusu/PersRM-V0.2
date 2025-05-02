# PersLM Plugin System

The PersLM plugin system is a comprehensive architecture that enables extending the core functionality through both backend (Python) and frontend (TypeScript/React) plugins. This document provides guidance on developing plugins for both layers.

## Overview

The plugin system consists of:

1. **Backend Plugins** (Python): Provide core functionality, data processing, and integration with external systems
2. **UI Plugins** (TypeScript/React): Provide user interface components and interactive elements

## Plugin Directory Structure

```
/plugins
├── core/                  # Core plugin infrastructure (Python)
│   ├── plugin_base.py     # Abstract base class for all Python plugins
│   └── plugin_loader.py   # Plugin discovery and management
├── examples/              # Example plugin implementations
│   └── calendar/          # Calendar integration example
│       ├── plugin.py      # Plugin implementation
│       └── plugin_manifest.json # Plugin metadata
├── ui/                    # UI plugin infrastructure (TypeScript/React)
│   ├── component_base.ts  # Base class for UI plugins
│   ├── plugin_manifest.ts # UI plugin manifest definitions and loaders
│   └── renderer.tsx       # Components for rendering UI plugins
└── utils/                 # Utility functions for plugin development
    └── plugin_utils.py    # Helper functions for plugin development
```

## Backend (Python) Plugins

### Plugin Manifest Structure

Every plugin must have a `plugin_manifest.json` file in its root directory with the following structure:

```json
{
  "id": "unique-plugin-id",
  "name": "Human-Readable Plugin Name",
  "description": "Description of what the plugin does",
  "version": "1.0.0",
  "author": "Plugin Author",
  "entry_point": "plugin.py",
  "permissions": [
    "required_permission_1",
    "required_permission_2"
  ],
  "requires": [
    "dependency-plugin-id"
  ]
}
```

### Plugin Implementation

Backend plugins must extend the `PluginBase` abstract class and implement its required methods:

```python
from plugins.core.plugin_base import PluginBase
from plugins.utils.plugin_utils import create_action_schema, create_config_schema

class MyPlugin(PluginBase):
    """My custom plugin implementation."""
    
    def __init__(self, plugin_id, config=None):
        """Initialize the plugin."""
        super().__init__(plugin_id, config)
    
    def setup(self) -> bool:
        """Set up the plugin."""
        # Initialize resources, connections, etc.
        return True
    
    def execute(self, action, parameters):
        """Execute plugin action."""
        # Implement action dispatcher
        actions = {
            'my_action': self.my_action,
            'another_action': self.another_action
        }
        
        if action not in actions:
            return {
                'success': False,
                'error': f"Unsupported action: {action}"
            }
        
        try:
            result = actions[action](**parameters)
            return {
                'success': True,
                'result': result
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def unload(self) -> bool:
        """Clean up resources when unloading."""
        # Release resources, close connections, etc.
        return True
    
    def get_schema(self):
        """Get configuration schema."""
        return create_config_schema(
            config_fields={
                'setting_1': {
                    'type': 'string',
                    'description': 'Description of setting 1'
                },
                'setting_2': {
                    'type': 'integer',
                    'description': 'Description of setting 2'
                }
            },
            required_fields=['setting_1'],
            title='My Plugin Configuration',
            description='Configuration settings for My Plugin'
        )
    
    def get_actions(self):
        """Get available actions with their parameter schemas."""
        return {
            'my_action': create_action_schema(
                name='my_action',
                description='Performs a custom action',
                parameters={
                    'param1': {
                        'type': 'string',
                        'description': 'First parameter'
                    },
                    'param2': {
                        'type': 'integer',
                        'description': 'Second parameter'
                    }
                },
                required=['param1'],
                returns={
                    'type': 'object',
                    'properties': {
                        'result': {
                            'type': 'string',
                            'description': 'Action result'
                        }
                    }
                }
            ),
            'another_action': create_action_schema(
                name='another_action',
                description='Performs another action',
                parameters={},
                returns={}
            )
        }
    
    def my_action(self, param1, param2=0):
        """Implement my_action functionality."""
        return {'result': f"Executed with {param1} and {param2}"}
    
    def another_action(self):
        """Implement another_action functionality."""
        return {'data': 'Some data'}
```

### Plugin Utilities

The `plugin_utils.py` module provides helper functions for common plugin tasks:

```python
# Create a plugin manifest
from plugins.utils.plugin_utils import create_plugin_manifest

manifest = create_plugin_manifest(
    plugin_id="my-plugin",
    name="My Plugin",
    description="A useful plugin",
    version="1.0.0",
    author="Your Name",
    permissions=["network"],
    output_path="./my_plugin/plugin_manifest.json"
)

# Create action schema
from plugins.utils.plugin_utils import create_action_schema

action_schema = create_action_schema(
    name="fetch_data",
    description="Fetches data from an external API",
    parameters={
        "query": {
            "type": "string",
            "description": "Search query"
        }
    },
    required=["query"]
)

# Create configuration schema
from plugins.utils.plugin_utils import create_config_schema

config_schema = create_config_schema(
    config_fields={
        "api_key": {
            "type": "string",
            "description": "API key for authentication"
        }
    },
    required_fields=["api_key"],
    title="My Plugin Configuration"
)
```

## UI (TypeScript/React) Plugins

### UI Plugin Structure

UI plugins are implemented as React components with metadata and lifecycle hooks:

```typescript
import React from 'react';
import { z } from 'zod';
import {
  UIPluginBase,
  UIPluginMetadata,
  createUIPlugin
} from 'plugins/ui/component_base';

// Define plugin props type
interface MyPluginProps {
  title: string;
  color?: string;
}

// Define plugin settings type
interface MyPluginSettings {
  showHeader: boolean;
  maxItems: number;
}

// Define plugin state type
interface MyPluginState {
  items: string[];
  loading: boolean;
}

// Define settings schema
const settingsSchema = z.object({
  showHeader: z.boolean(),
  maxItems: z.number().min(1).max(100)
});

// Create the plugin component
const MyPluginComponent: React.FC<MyPluginProps & {
  settings: MyPluginSettings;
  state: MyPluginState;
  setState: (state: Partial<MyPluginState>) => void;
}> = ({ title, color = 'blue', settings, state, setState }) => {
  
  // Component implementation
  return (
    <div className="my-plugin">
      {settings.showHeader && <h2 style={{ color }}>{title}</h2>}
      {state.loading ? (
        <p>Loading...</p>
      ) : (
        <ul>
          {state.items.slice(0, settings.maxItems).map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
      <button onClick={() => setState({ loading: true })}>
        Reload Data
      </button>
    </div>
  );
};

// Create and export the plugin
export default createUIPlugin({
  // Plugin metadata
  metadata: {
    id: 'my-ui-plugin',
    name: 'My UI Plugin',
    description: 'A sample UI plugin',
    version: '1.0.0',
    author: 'Your Name',
    category: 'ui',
    tags: ['demo', 'ui'],
  },
  
  // Component implementation
  component: MyPluginComponent,
  
  // Default props
  defaultProps: {
    title: 'Default Title',
  },
  
  // Default settings
  defaultSettings: {
    showHeader: true,
    maxItems: 10,
  },
  
  // Default state
  defaultState: {
    items: [],
    loading: false,
  },
  
  // Settings schema
  settingsSchema,
  
  // Theme integration
  applyTheme: (theme) => ({
    color: theme.colors.primary,
  }),
  
  // Lifecycle hooks
  lifecycle: {
    init: () => {
      console.log('Plugin initialized');
      // Fetch initial data
      return fetch('/api/data')
        .then(response => response.json())
        .then(data => ({
          items: data,
          loading: false,
        }));
    },
    destroy: () => {
      console.log('Plugin destroyed');
    },
  },
});
```

### Rendering UI Plugins

To render UI plugins in your application:

```tsx
import React from 'react';
import { UIPluginRenderer, UIPluginRegistryProvider } from 'plugins/ui/renderer';
import MyPlugin from './plugins/my-plugin';

function App() {
  return (
    <UIPluginRegistryProvider>
      <div className="app">
        <h1>My Application</h1>
        
        {/* Render a plugin by ID */}
        <UIPluginRenderer 
          pluginId="my-ui-plugin"
          pluginProps={{ title: "Custom Title" }}
        />
        
        {/* Render a plugin slot (extension point) */}
        <UIPluginSlot
          slotName="dashboard-widgets"
          slotProps={{ position: 'sidebar' }}
        />
      </div>
    </UIPluginRegistryProvider>
  );
}
```

### Registering UI Plugins

```typescript
import { registerUIPlugin } from 'plugins/ui/plugin_manifest';
import MyPlugin from './plugins/my-plugin';

// Register the plugin manually
registerUIPlugin(MyPlugin);

// Or load plugins from a manifest
import { UIPluginManifestLoader } from 'plugins/ui/plugin_manifest';

const manifest = {
  "id": "my-ui-plugin",
  "source": "/plugins/my-plugin.js",
  "enabled": true,
  "settings": {
    "showHeader": true,
    "maxItems": 5
  }
};

UIPluginManifestLoader.loadFromObject(manifest)
  .then(() => console.log('Plugin loaded'))
  .catch(err => console.error('Failed to load plugin', err));
```

## Best Practices

### Plugin Development

1. **Provide clear error handling**: Always handle errors gracefully and provide meaningful error messages
2. **Validate inputs**: Use schemas to validate configuration and action parameters
3. **Respect permissions**: Check required permissions before executing actions
4. **Clean up resources**: Properly release resources in the `unload()` method
5. **Use typed interfaces**: Avoid using `any` in TypeScript, define proper interfaces
6. **Implement proper lifecycle hooks**: Handle initialization and cleanup properly

### Plugin Integration

1. **Check dependencies**: Verify that required dependencies are loaded
2. **Handle plugin failures**: Implement fallbacks for failed plugins
3. **Manage state carefully**: Use proper state management for UI plugins
4. **Test thoroughly**: Test plugins with different configurations and edge cases

## Plugin Permissions

Backend plugins can request the following permissions:

- `network`: Access to external networks and APIs
- `file_system`: Access to read/write files
- `user_data`: Access to user profile and preferences
- `calendar_access`: Access to calendar data
- `contacts_access`: Access to contact information
- `notification`: Ability to send notifications
- `background_processing`: Run tasks in the background

UI plugins can request:

- `user_interface`: Modify the main UI
- `data_access`: Access application data
- `storage`: Store plugin-specific data
- `api_access`: Access external APIs

## Troubleshooting

### Common Issues

1. **Plugin not loading**:
   - Check that the manifest file is valid JSON
   - Verify that all required fields are present
   - Check for entry point file existence

2. **Plugin action failing**:
   - Verify parameters match the schema
   - Check for proper error handling
   - Look for permission issues

3. **UI plugin not rendering**:
   - Check that the plugin is registered
   - Verify props and settings are valid
   - Look for rendering errors in console

## Plugin Development Workflow

1. **Create plugin structure**:
   - Create directory and manifest file
   - Implement the plugin class/component

2. **Test locally**:
   - Use the plugin loader to load your plugin
   - Test all actions/functionality

3. **Publish**:
   - Package your plugin
   - Distribute to users or publish to marketplace 