import { BasePlugin, PluginMetadata } from './PluginRegistry';
import { ReactNode } from 'react';

/**
 * Schema field representation
 */
export interface SchemaField {
  /**
   * Field type (string, number, object, array, etc.)
   */
  type: string;
  
  /**
   * Field format (email, date, uri, etc.)
   */
  format?: string;
  
  /**
   * Field title
   */
  title?: string;
  
  /**
   * Field description
   */
  description?: string;
  
  /**
   * Default value
   */
  default?: any;
  
  /**
   * Whether field is required
   */
  required?: boolean;
  
  /**
   * Field properties for object type
   */
  properties?: Record<string, SchemaField>;
  
  /**
   * Item schema for array type
   */
  items?: SchemaField;
  
  /**
   * List of allowed values (enum)
   */
  enum?: any[];
  
  /**
   * Human-readable labels for enum values
   */
  enumLabels?: string[];
  
  /**
   * Minimum value for number type
   */
  minimum?: number;
  
  /**
   * Maximum value for number type
   */
  maximum?: number;
  
  /**
   * Minimum length for string type
   */
  minLength?: number;
  
  /**
   * Maximum length for string type
   */
  maxLength?: number;
  
  /**
   * Pattern for string validation
   */
  pattern?: string;
  
  /**
   * Custom UI options
   */
  uiOptions?: Record<string, any>;
  
  /**
   * Custom metadata
   */
  metadata?: Record<string, any>;
  
  /**
   * Field dependencies
   */
  dependencies?: Record<string, any>;
  
  /**
   * Conditional rendering/validation
   */
  conditions?: SchemaCondition[];
  
  /**
   * Additional properties (for extensibility)
   */
  [key: string]: any;
}

/**
 * Schema condition for conditional UI logic
 */
export interface SchemaCondition {
  /**
   * Field to check
   */
  field: string;
  
  /**
   * Operator (eq, neq, gt, lt, etc.)
   */
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'startsWith' | 'endsWith';
  
  /**
   * Value to compare against
   */
  value: any;
}

/**
 * Plugin hook context for schema processing
 */
export interface SchemaProcessingContext {
  /**
   * Current path in the schema
   */
  path: string[];
  
  /**
   * Root schema
   */
  rootSchema: SchemaField;
  
  /**
   * All schema plugins
   */
  plugins: SchemaPlugin[];
}

/**
 * Schema validation result
 */
export interface SchemaValidationResult {
  /**
   * Whether schema is valid
   */
  valid: boolean;
  
  /**
   * Validation errors
   */
  errors: string[];
}

/**
 * Schema field rendering context
 */
export interface SchemaFieldContext {
  /**
   * Field path
   */
  path: string[];
  
  /**
   * Parent schema field
   */
  parentField?: SchemaField;
  
  /**
   * Current field value
   */
  value: any;
  
  /**
   * Update field value
   */
  onChange: (value: any) => void;
  
  /**
   * Field errors
   */
  errors?: string[];
  
  /**
   * Validation state
   */
  validationState?: 'valid' | 'invalid' | 'validating';
  
  /**
   * Render child field (for nested rendering)
   */
  renderField: (field: SchemaField, childPath: string[], childValue: any, childOnChange: (value: any) => void) => ReactNode;
}

/**
 * Field renderer function type
 */
export type FieldRenderer = (field: SchemaField, context: SchemaFieldContext) => ReactNode;

/**
 * Field renderer registration
 */
export interface FieldRendererRegistration {
  /**
   * Field type
   */
  type: string;
  
  /**
   * Optional field format
   */
  format?: string;
  
  /**
   * Custom match function
   */
  match?: (field: SchemaField) => boolean;
  
  /**
   * Renderer function
   */
  renderer: FieldRenderer;
  
  /**
   * Renderer priority (higher = more specific)
   */
  priority: number;
}

/**
 * Schema plugin interface
 */
export interface SchemaPlugin extends BasePlugin {
  /**
   * Validate schema
   * @param schema Schema to validate
   * @param context Validation context
   * @returns Validation result
   */
  validateSchema?(schema: SchemaField, context: SchemaProcessingContext): SchemaValidationResult;
  
  /**
   * Transform schema before processing
   * @param schema Original schema
   * @param context Processing context
   * @returns Transformed schema
   */
  transformSchema?(schema: SchemaField, context: SchemaProcessingContext): SchemaField;
  
  /**
   * Get additional schema properties
   * @param schema Current schema
   * @param context Processing context
   * @returns Additional properties to merge
   */
  getAdditionalProperties?(schema: SchemaField, context: SchemaProcessingContext): Partial<SchemaField>;
  
  /**
   * Process schema type
   * @param type Original type
   * @param schema Current schema
   * @param context Processing context
   * @returns Processed type
   */
  processType?(type: string, schema: SchemaField, context: SchemaProcessingContext): string;
}

/**
 * Find matching renderer for a field
 * @param renderers Available renderers
 * @param field Schema field
 * @returns Best matching renderer or undefined
 */
export function findMatchingRenderer(
  renderers: FieldRendererRegistration[],
  field: SchemaField
): FieldRendererRegistration | undefined {
  return renderers
    .filter(renderer => {
      // Check if type matches
      if (renderer.type !== field.type && renderer.type !== '*') {
        return false;
      }
      
      // Check if format matches (if specified)
      if (renderer.format && renderer.format !== field.format) {
        return false;
      }
      
      // Custom matcher
      if (renderer.match && !renderer.match(field)) {
        return false;
      }
      
      return true;
    })
    // Sort by priority (highest first)
    .sort((a, b) => b.priority - a.priority)[0];
}

/**
 * Base schema plugin implementation
 */
export abstract class BaseSchemaPlugin implements SchemaPlugin {
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
   * Validate schema
   * @param schema Schema to validate
   * @param context Validation context
   * @returns Validation result
   */
  validateSchema(schema: SchemaField, context: SchemaProcessingContext): SchemaValidationResult {
    return { valid: true, errors: [] };
  }
  
  /**
   * Transform schema before processing
   * @param schema Original schema
   * @param context Processing context
   * @returns Transformed schema
   */
  transformSchema(schema: SchemaField, context: SchemaProcessingContext): SchemaField {
    return schema;
  }
  
  /**
   * Get additional schema properties
   * @param schema Current schema
   * @param context Processing context
   * @returns Additional properties to merge
   */
  getAdditionalProperties(schema: SchemaField, context: SchemaProcessingContext): Partial<SchemaField> {
    return {};
  }
  
  /**
   * Process schema type
   * @param type Original type
   * @param schema Current schema
   * @param context Processing context
   * @returns Processed type
   */
  processType(type: string, schema: SchemaField, context: SchemaProcessingContext): string {
    return type;
  }
} 