import { z } from 'zod';

/**
 * Types of schema elements that can be parsed
 */
export enum SchemaElementType {
  STRING = 'string',
  NUMBER = 'number',
  INTEGER = 'integer',
  BOOLEAN = 'boolean',
  ARRAY = 'array',
  OBJECT = 'object',
  ENUM = 'enum',
  DATE = 'date',
  TIME = 'time',
  DATETIME = 'datetime',
  EMAIL = 'email',
  URL = 'url',
  FILE = 'file',
  IMAGE = 'image',
  REFERENCE = 'reference',
  CUSTOM = 'custom',
}

/**
 * UI Control types that can be generated
 */
export enum UIControlType {
  TEXT_INPUT = 'text_input',
  NUMBER_INPUT = 'number_input',
  PASSWORD_INPUT = 'password_input',
  EMAIL_INPUT = 'email_input',
  URL_INPUT = 'url_input',
  TEXTAREA = 'textarea',
  CHECKBOX = 'checkbox',
  SWITCH = 'switch',
  SELECT = 'select',
  MULTISELECT = 'multiselect',
  RADIO_GROUP = 'radio_group',
  CHECKBOX_GROUP = 'checkbox_group',
  DATE_PICKER = 'date_picker',
  TIME_PICKER = 'time_picker',
  DATETIME_PICKER = 'datetime_picker',
  FILE_UPLOAD = 'file_upload',
  IMAGE_UPLOAD = 'image_upload',
  SLIDER = 'slider',
  COLOR_PICKER = 'color_picker',
  RICH_TEXT = 'rich_text',
  TABLE = 'table',
  CARD = 'card',
  LIST = 'list',
  TABS = 'tabs',
  MODAL = 'modal',
  FORM = 'form',
  CUSTOM = 'custom',
}

/**
 * Validation rule interface
 */
export interface ValidationRule {
  type: string;
  message?: string;
  value?: any;
}

/**
 * UI control validation schema
 */
export interface UIControlValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  rules?: ValidationRule[];
  custom?: Record<string, any>;
}

/**
 * Schema element interface
 */
export interface SchemaElement {
  name: string;
  type: SchemaElementType;
  description?: string;
  defaultValue?: any;
  enum?: any[];
  format?: string;
  required?: boolean;
  readOnly?: boolean;
  writeOnly?: boolean;
  nullable?: boolean;
  deprecated?: boolean;
  items?: SchemaElement; // For array types
  properties?: SchemaElement[]; // For object types
  validation?: UIControlValidation;
  metadata?: Record<string, any>;
}

/**
 * UI control interface
 */
export interface UIControl {
  id: string;
  name: string;
  label: string;
  type: UIControlType;
  description?: string;
  defaultValue?: any;
  placeholder?: string;
  options?: { label: string; value: any }[];
  validation?: UIControlValidation;
  readOnly?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  style?: Record<string, any>;
  className?: string;
  children?: UIControl[];
  metadata?: Record<string, any>;
}

/**
 * UI layout type
 */
export enum UILayoutType {
  FORM = 'form',
  TABLE = 'table',
  LIST = 'list',
  GRID = 'grid',
  TABS = 'tabs',
  CARD = 'card',
  CUSTOM = 'custom',
}

/**
 * UI layout interface
 */
export interface UILayout {
  type: UILayoutType;
  title?: string;
  description?: string;
  columns?: number;
  gap?: string;
  style?: Record<string, any>;
  className?: string;
  elements: UIControl[];
  metadata?: Record<string, any>;
}

/**
 * UI model interface
 */
export interface UIModel {
  id: string;
  name: string;
  description?: string;
  layout: UILayout;
  schema: SchemaElement;
  metadata?: Record<string, any>;
}

/**
 * OpenAPI schema type
 */
export type OpenAPISchema = Record<string, any>;

/**
 * JSON schema type
 */
export type JSONSchema = Record<string, any>;

/**
 * Schema source type
 */
export enum SchemaSourceType {
  OPENAPI = 'openapi',
  JSON_SCHEMA = 'json_schema',
  GRAPHQL = 'graphql',
  CUSTOM = 'custom',
}

/**
 * Schema parser options
 */
export interface SchemaParserOptions {
  sourceType: SchemaSourceType;
  includeReadOnly?: boolean;
  includeWriteOnly?: boolean;
  includeDeprecated?: boolean;
  flattenNestedObjects?: boolean;
  maxDepth?: number;
  customTypeMapping?: Record<string, UIControlType>;
  customFormatMapping?: Record<string, UIControlType>;
  defaultControlType?: UIControlType;
  includeDescription?: boolean;
  includeExamples?: boolean;
}

/**
 * Determines the appropriate UI control type based on schema element
 */
function determineControlType(element: SchemaElement, options?: SchemaParserOptions): UIControlType {
  // Handle custom type mapping if provided
  if (options?.customTypeMapping && options.customTypeMapping[element.type]) {
    return options.customTypeMapping[element.type];
  }
  
  // Handle custom format mapping if provided
  if (options?.customFormatMapping && element.format && options.customFormatMapping[element.format]) {
    return options.customFormatMapping[element.format];
  }
  
  // Determine control type based on schema type and format
  switch (element.type) {
    case SchemaElementType.STRING:
      if (element.enum && element.enum.length > 0) {
        return UIControlType.SELECT;
      }
      
      switch (element.format) {
        case 'password':
          return UIControlType.PASSWORD_INPUT;
        case 'email':
          return UIControlType.EMAIL_INPUT;
        case 'uri':
        case 'url':
          return UIControlType.URL_INPUT;
        case 'date':
          return UIControlType.DATE_PICKER;
        case 'time':
          return UIControlType.TIME_PICKER;
        case 'date-time':
          return UIControlType.DATETIME_PICKER;
        case 'rich-text':
        case 'html':
          return UIControlType.RICH_TEXT;
        default:
          // Check if it's a long text by validation rules
          if (element.validation?.minLength && element.validation.minLength > 100) {
            return UIControlType.TEXTAREA;
          }
          return UIControlType.TEXT_INPUT;
      }
    
    case SchemaElementType.NUMBER:
    case SchemaElementType.INTEGER:
      if (element.enum && element.enum.length > 0) {
        return UIControlType.SELECT;
      }
      return UIControlType.NUMBER_INPUT;
    
    case SchemaElementType.BOOLEAN:
      return UIControlType.CHECKBOX;
    
    case SchemaElementType.ARRAY:
      if (element.items?.enum && element.items.enum.length > 0) {
        // If array of enum types, use multi-select or checkbox group
        return UIControlType.MULTISELECT;
      }
      
      if (element.items?.type === SchemaElementType.OBJECT) {
        // If array of objects, use table
        return UIControlType.TABLE;
      }
      
      return UIControlType.LIST;
    
    case SchemaElementType.OBJECT:
      return UIControlType.FORM;
    
    case SchemaElementType.ENUM:
      return UIControlType.SELECT;
    
    case SchemaElementType.DATE:
      return UIControlType.DATE_PICKER;
    
    case SchemaElementType.TIME:
      return UIControlType.TIME_PICKER;
    
    case SchemaElementType.DATETIME:
      return UIControlType.DATETIME_PICKER;
    
    case SchemaElementType.EMAIL:
      return UIControlType.EMAIL_INPUT;
    
    case SchemaElementType.URL:
      return UIControlType.URL_INPUT;
    
    case SchemaElementType.FILE:
      return UIControlType.FILE_UPLOAD;
    
    case SchemaElementType.IMAGE:
      return UIControlType.IMAGE_UPLOAD;
    
    default:
      return options?.defaultControlType || UIControlType.TEXT_INPUT;
  }
}

/**
 * Parses validation rules from schema element
 */
function parseValidation(element: SchemaElement): UIControlValidation {
  const validation: UIControlValidation = {
    required: element.required || false,
    rules: [],
  };
  
  // String-specific validations
  if (element.type === SchemaElementType.STRING) {
    if (element.validation?.minLength !== undefined) {
      validation.minLength = element.validation.minLength;
      validation.rules?.push({
        type: 'minLength',
        message: `Must be at least ${element.validation.minLength} characters`,
        value: element.validation.minLength,
      });
    }
    
    if (element.validation?.maxLength !== undefined) {
      validation.maxLength = element.validation.maxLength;
      validation.rules?.push({
        type: 'maxLength',
        message: `Must be no more than ${element.validation.maxLength} characters`,
        value: element.validation.maxLength,
      });
    }
    
    if (element.validation?.pattern) {
      validation.pattern = element.validation.pattern;
      validation.rules?.push({
        type: 'pattern',
        message: 'Invalid format',
        value: element.validation.pattern,
      });
    }
  }
  
  // Number-specific validations
  if (element.type === SchemaElementType.NUMBER || element.type === SchemaElementType.INTEGER) {
    if (element.validation?.min !== undefined) {
      validation.min = element.validation.min;
      validation.rules?.push({
        type: 'min',
        message: `Must be at least ${element.validation.min}`,
        value: element.validation.min,
      });
    }
    
    if (element.validation?.max !== undefined) {
      validation.max = element.validation.max;
      validation.rules?.push({
        type: 'max',
        message: `Must be no more than ${element.validation.max}`,
        value: element.validation.max,
      });
    }
  }
  
  // Add any custom validation rules
  if (element.validation?.rules) {
    validation.rules = [...(validation.rules || []), ...element.validation.rules];
  }
  
  // Add custom validation
  if (element.validation?.custom) {
    validation.custom = element.validation.custom;
  }
  
  return validation;
}

/**
 * Creates a UI control from a schema element
 */
function createUIControl(element: SchemaElement, options?: SchemaParserOptions): UIControl {
  const controlType = determineControlType(element, options);
  
  const control: UIControl = {
    id: element.name,
    name: element.name,
    label: element.name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase()),
    type: controlType,
    description: options?.includeDescription ? element.description : undefined,
    defaultValue: element.defaultValue,
    validation: parseValidation(element),
    readOnly: element.readOnly,
    metadata: {},
  };
  
  // Add options for enum types
  if (element.enum && element.enum.length > 0) {
    control.options = element.enum.map((value: any) => ({
      label: String(value),
      value,
    }));
  }
  
  // Handle nested objects for form type
  if (controlType === UIControlType.FORM && element.properties) {
    control.children = element.properties.map((prop) => createUIControl(prop, options));
  }
  
  // Handle array items for table/list type
  if ((controlType === UIControlType.TABLE || controlType === UIControlType.LIST) && element.items) {
    if (controlType === UIControlType.TABLE && element.items.properties) {
      // For table, we need to create column controls
      control.children = element.items.properties.map((prop) => createUIControl(prop, options));
    } else if (controlType === UIControlType.LIST) {
      // For list, we need a single item control template
      control.children = [createUIControl(element.items, options)];
    }
  }
  
  return control;
}

/**
 * Creates a default layout for UI controls
 */
function createDefaultLayout(controls: UIControl[], layoutType?: UILayoutType): UILayout {
  return {
    type: layoutType || UILayoutType.FORM,
    elements: controls,
  };
}

/**
 * Schema Parser class
 */
export class SchemaParser {
  private options: SchemaParserOptions;
  
  constructor(options: SchemaParserOptions) {
    this.options = options;
  }
  
  /**
   * Parses a JSON schema into a schema element
   */
  parseJSONSchema(schema: JSONSchema, name = 'root'): SchemaElement {
    const schemaElement: SchemaElement = {
      name,
      type: this.mapJSONSchemaType(schema.type),
      description: schema.description,
      required: schema.required === true,
      defaultValue: schema.default,
      readOnly: schema.readOnly,
      writeOnly: schema.writeOnly,
      nullable: schema.nullable,
      deprecated: schema.deprecated,
      enum: schema.enum,
      format: schema.format,
      metadata: {},
    };
    
    // Parse validation
    schemaElement.validation = {
      required: schema.required === true,
      minLength: schema.minLength,
      maxLength: schema.maxLength,
      min: schema.minimum,
      max: schema.maximum,
      pattern: schema.pattern,
    };
    
    // Parse nested properties for objects
    if (schema.type === 'object' && schema.properties) {
      schemaElement.properties = Object.entries(schema.properties).map(([propName, propSchema]) => {
        const propElement = this.parseJSONSchema(propSchema as JSONSchema, propName);
        
        // Check if property is required
        if (schema.required && Array.isArray(schema.required) && schema.required.includes(propName)) {
          propElement.required = true;
          if (propElement.validation) {
            propElement.validation.required = true;
          }
        }
        
        return propElement;
      });
    }
    
    // Parse array items
    if (schema.type === 'array' && schema.items) {
      schemaElement.items = this.parseJSONSchema(schema.items as JSONSchema, `${name}Item`);
    }
    
    return schemaElement;
  }
  
  /**
   * Maps JSON schema type to SchemaElementType
   */
  private mapJSONSchemaType(type: string | string[]): SchemaElementType {
    // Handle array of types, pick the first non-null type
    if (Array.isArray(type)) {
      const nonNullType = type.find((t) => t !== 'null');
      return nonNullType
        ? this.mapJSONSchemaType(nonNullType)
        : SchemaElementType.STRING;
    }
    
    switch (type) {
      case 'string':
        return SchemaElementType.STRING;
      case 'number':
        return SchemaElementType.NUMBER;
      case 'integer':
        return SchemaElementType.INTEGER;
      case 'boolean':
        return SchemaElementType.BOOLEAN;
      case 'array':
        return SchemaElementType.ARRAY;
      case 'object':
        return SchemaElementType.OBJECT;
      default:
        return SchemaElementType.STRING;
    }
  }
  
  /**
   * Parses an OpenAPI schema into a schema element
   */
  parseOpenAPISchema(schema: OpenAPISchema, name = 'root'): SchemaElement {
    // For OpenAPI, if there's a schema property, use that
    if (schema.schema) {
      return this.parseOpenAPISchema(schema.schema, name);
    }
    
    // Handle $ref
    if (schema.$ref) {
      // In a real implementation, we would need to resolve the reference
      // For now, return a placeholder
      return {
        name,
        type: SchemaElementType.REFERENCE,
        metadata: { ref: schema.$ref },
      };
    }
    
    // OpenAPI schema is largely compatible with JSON Schema
    return this.parseJSONSchema(schema, name);
  }
  
  /**
   * Creates a UI model from a schema element
   */
  createUIModel(schemaElement: SchemaElement, modelId: string, modelName: string): UIModel {
    let controls: UIControl[] = [];
    let layoutType = UILayoutType.FORM;
    
    // Handle different root schema types
    if (schemaElement.type === SchemaElementType.OBJECT && schemaElement.properties) {
      // Create controls for each property
      controls = schemaElement.properties.map((prop) => createUIControl(prop, this.options));
    } else if (schemaElement.type === SchemaElementType.ARRAY && schemaElement.items) {
      // For array root, create a table or list layout
      layoutType = schemaElement.items.type === SchemaElementType.OBJECT
        ? UILayoutType.TABLE
        : UILayoutType.LIST;
      
      // Create a single control for the array
      controls = [createUIControl(schemaElement, this.options)];
    } else {
      // For simple types, create a single control
      controls = [createUIControl(schemaElement, this.options)];
    }
    
    // Create the UI model
    return {
      id: modelId,
      name: modelName,
      description: schemaElement.description,
      layout: createDefaultLayout(controls, layoutType),
      schema: schemaElement,
    };
  }
  
  /**
   * Parse a schema string or object
   */
  parse(schema: string | Record<string, any>, modelId: string, modelName: string): UIModel {
    let schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;
    let schemaElement: SchemaElement;
    
    // Parse based on source type
    switch (this.options.sourceType) {
      case SchemaSourceType.JSON_SCHEMA:
        schemaElement = this.parseJSONSchema(schemaObj);
        break;
      case SchemaSourceType.OPENAPI:
        schemaElement = this.parseOpenAPISchema(schemaObj);
        break;
      case SchemaSourceType.GRAPHQL:
        // Not implemented yet
        throw new Error('GraphQL schema parsing is not implemented yet');
      case SchemaSourceType.CUSTOM:
        // Assume schema is already in SchemaElement format
        schemaElement = schemaObj as SchemaElement;
        break;
      default:
        throw new Error(`Unsupported schema source type: ${this.options.sourceType}`);
    }
    
    // Create UI model
    return this.createUIModel(schemaElement, modelId, modelName);
  }
}

/**
 * Zod schema for schema element
 */
export const schemaElementSchema = z.object({
  name: z.string(),
  type: z.nativeEnum(SchemaElementType),
  description: z.string().optional(),
  defaultValue: z.any().optional(),
  enum: z.array(z.any()).optional(),
  format: z.string().optional(),
  required: z.boolean().optional(),
  readOnly: z.boolean().optional(),
  writeOnly: z.boolean().optional(),
  nullable: z.boolean().optional(),
  deprecated: z.boolean().optional(),
  items: z.lazy(() => schemaElementSchema).optional(),
  properties: z.array(z.lazy(() => schemaElementSchema)).optional(),
  validation: z.object({
    required: z.boolean().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    rules: z.array(
      z.object({
        type: z.string(),
        message: z.string().optional(),
        value: z.any().optional(),
      })
    ).optional(),
    custom: z.record(z.any()).optional(),
  }).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Zod schema for UI control
 */
export const uiControlSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string(),
  type: z.nativeEnum(UIControlType),
  description: z.string().optional(),
  defaultValue: z.any().optional(),
  placeholder: z.string().optional(),
  options: z.array(
    z.object({
      label: z.string(),
      value: z.any(),
    })
  ).optional(),
  validation: z.object({
    required: z.boolean().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    rules: z.array(
      z.object({
        type: z.string(),
        message: z.string().optional(),
        value: z.any().optional(),
      })
    ).optional(),
    custom: z.record(z.any()).optional(),
  }).optional(),
  readOnly: z.boolean().optional(),
  disabled: z.boolean().optional(),
  hidden: z.boolean().optional(),
  style: z.record(z.any()).optional(),
  className: z.string().optional(),
  children: z.array(z.lazy(() => uiControlSchema)).optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Zod schema for UI layout
 */
export const uiLayoutSchema = z.object({
  type: z.nativeEnum(UILayoutType),
  title: z.string().optional(),
  description: z.string().optional(),
  columns: z.number().optional(),
  gap: z.string().optional(),
  style: z.record(z.any()).optional(),
  className: z.string().optional(),
  elements: z.array(uiControlSchema),
  metadata: z.record(z.any()).optional(),
});

/**
 * Zod schema for UI model
 */
export const uiModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  layout: uiLayoutSchema,
  schema: schemaElementSchema,
  metadata: z.record(z.any()).optional(),
});

/**
 * Create a schema parser with default options
 */
export function createSchemaParser(
  sourceType: SchemaSourceType = SchemaSourceType.JSON_SCHEMA,
  options?: Partial<Omit<SchemaParserOptions, 'sourceType'>>
): SchemaParser {
  return new SchemaParser({
    sourceType,
    includeReadOnly: options?.includeReadOnly ?? true,
    includeWriteOnly: options?.includeWriteOnly ?? true,
    includeDeprecated: options?.includeDeprecated ?? false,
    flattenNestedObjects: options?.flattenNestedObjects ?? false,
    maxDepth: options?.maxDepth ?? 5,
    customTypeMapping: options?.customTypeMapping ?? {},
    customFormatMapping: options?.customFormatMapping ?? {},
    defaultControlType: options?.defaultControlType ?? UIControlType.TEXT_INPUT,
    includeDescription: options?.includeDescription ?? true,
    includeExamples: options?.includeExamples ?? true,
  });
} 