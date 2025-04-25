import { BasePlugin, PluginMetadata } from './PluginRegistry';
import { SchemaField } from './SchemaPlugin';
import { ReactNode } from 'react';

/**
 * Component generation context
 */
export interface ComponentGenerationContext {
  /**
   * Current path in the schema
   */
  path: string[];
  
  /**
   * Current value
   */
  value: any;
  
  /**
   * Update value
   */
  onChange: (value: any) => void;
  
  /**
   * Parent field if nested
   */
  parentField?: SchemaField;
  
  /**
   * Field validation errors
   */
  errors?: string[];
  
  /**
   * Generate child component
   */
  generateComponent: (
    field: SchemaField,
    childPath: string[],
    childValue: any,
    childOnChange: (value: any) => void
  ) => ReactNode;
  
  /**
   * All schema plugin instances
   */
  plugins: SchemaGeneratorPlugin[];
}

/**
 * Component generator function
 */
export type ComponentGenerator = (
  field: SchemaField,
  context: ComponentGenerationContext
) => ReactNode;

/**
 * Component generator registration
 */
export interface ComponentGeneratorRegistration {
  /**
   * Schema field type this generator handles
   */
  type: string;
  
  /**
   * Schema field format this generator handles (optional)
   */
  format?: string;
  
  /**
   * Custom matcher function (optional)
   */
  match?: (field: SchemaField) => boolean;
  
  /**
   * Generator priority (higher = more specific)
   */
  priority: number;
  
  /**
   * Component generator function
   */
  generator: ComponentGenerator;
}

/**
 * Schema generator plugin interface
 */
export interface SchemaGeneratorPlugin extends BasePlugin {
  /**
   * Get component generators
   */
  getComponentGenerators(): ComponentGeneratorRegistration[];
  
  /**
   * Pre-process schema before generation
   * @param schema Original schema
   * @returns Processed schema
   */
  preprocessSchema?(schema: SchemaField): SchemaField;
  
  /**
   * Post-process generated component
   * @param component Generated component
   * @param field Schema field
   * @param context Generation context
   * @returns Processed component
   */
  postprocessComponent?(
    component: ReactNode,
    field: SchemaField,
    context: ComponentGenerationContext
  ): ReactNode;
}

/**
 * Find matching component generator
 * @param generators Available generators
 * @param field Schema field
 * @returns Best matching generator or undefined
 */
export function findMatchingGenerator(
  generators: ComponentGeneratorRegistration[],
  field: SchemaField
): ComponentGeneratorRegistration | undefined {
  return generators
    .filter(generator => {
      // Check if type matches
      if (generator.type !== field.type && generator.type !== '*') {
        return false;
      }
      
      // Check if format matches (if specified)
      if (generator.format && generator.format !== field.format) {
        return false;
      }
      
      // Custom matcher
      if (generator.match && !generator.match(field)) {
        return false;
      }
      
      return true;
    })
    // Sort by priority (highest first)
    .sort((a, b) => b.priority - a.priority)[0];
}

/**
 * Base class for schema generator plugins
 */
export abstract class BaseSchemaGeneratorPlugin implements SchemaGeneratorPlugin {
  /**
   * Plugin metadata
   */
  abstract readonly metadata: PluginMetadata;
  
  /**
   * Initialize plugin
   */
  initialize(): void | Promise<void> {
    // Default implementation does nothing
  }
  
  /**
   * Cleanup plugin
   */
  cleanup(): void | Promise<void> {
    // Default implementation does nothing
  }
  
  /**
   * Get component generators
   */
  abstract getComponentGenerators(): ComponentGeneratorRegistration[];
  
  /**
   * Pre-process schema before generation
   * @param schema Original schema
   * @returns Processed schema
   */
  preprocessSchema(schema: SchemaField): SchemaField {
    return schema;
  }
  
  /**
   * Post-process generated component
   * @param component Generated component
   * @param field Schema field
   * @param context Generation context
   * @returns Processed component
   */
  postprocessComponent(
    component: ReactNode,
    field: SchemaField,
    context: ComponentGenerationContext
  ): ReactNode {
    return component;
  }
} 