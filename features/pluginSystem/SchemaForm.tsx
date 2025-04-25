import React, { ReactNode, useState, useEffect } from 'react';
import { SchemaField } from './SchemaPlugin';
import { PluginRegistry } from './PluginRegistry';
import { ComponentGenerationContext, SchemaGeneratorPlugin, findMatchingGenerator } from './SchemaGeneratorPlugin';

/**
 * Schema form props
 */
export interface SchemaFormProps {
  /**
   * Schema definition
   */
  schema: SchemaField;
  
  /**
   * Initial value
   */
  initialValue?: any;
  
  /**
   * Value change handler
   */
  onChange?: (value: any) => void;
  
  /**
   * Form submit handler
   */
  onSubmit?: (value: any) => void;
  
  /**
   * Custom validation handler
   */
  validate?: (value: any, schema: SchemaField) => string[] | null;
  
  /**
   * Whether to show validation errors
   */
  showValidation?: boolean;
  
  /**
   * Form title
   */
  title?: string;
  
  /**
   * Submit button text
   */
  submitText?: string;
  
  /**
   * Cancel button text
   */
  cancelText?: string;
  
  /**
   * Cancel handler
   */
  onCancel?: () => void;
  
  /**
   * Additional class name
   */
  className?: string;
}

/**
 * Validate value against schema
 */
function validateValueAgainstSchema(value: any, schema: SchemaField): string[] {
  const errors: string[] = [];
  
  if (schema.required && (value === undefined || value === null || value === '')) {
    errors.push('This field is required');
    return errors;
  }
  
  if (value === undefined || value === null) {
    return errors;
  }
  
  switch (schema.type) {
    case 'string':
      if (typeof value !== 'string') {
        errors.push('Value must be a string');
      } else {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
          errors.push(`Must be at least ${schema.minLength} characters`);
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
          errors.push(`Must be no more than ${schema.maxLength} characters`);
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
          errors.push('Value does not match the required pattern');
        }
        if (schema.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push('Must be a valid email address');
        }
      }
      break;
      
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        errors.push('Value must be a number');
      } else {
        if (schema.minimum !== undefined && value < schema.minimum) {
          errors.push(`Must be at least ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
          errors.push(`Must be no more than ${schema.maximum}`);
        }
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push('Value must be a boolean');
      }
      break;
      
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push('Value must be an object');
      } else if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (propSchema.required && !(propName in value)) {
            errors.push(`Missing required property: ${propName}`);
          } else if (propName in value) {
            const propErrors = validateValueAgainstSchema(value[propName], propSchema);
            errors.push(...propErrors.map(err => `${propName}: ${err}`));
          }
        }
      }
      break;
      
    case 'array':
      if (!Array.isArray(value)) {
        errors.push('Value must be an array');
      } else if (schema.items) {
        value.forEach((item, index) => {
          const itemErrors = validateValueAgainstSchema(item, schema.items!);
          errors.push(...itemErrors.map(err => `[${index}]: ${err}`));
        });
      }
      break;
  }
  
  return errors;
}

/**
 * Schema form component
 */
export function SchemaForm({
  schema,
  initialValue,
  onChange,
  onSubmit,
  validate,
  showValidation = false,
  title,
  submitText = 'Submit',
  cancelText = 'Cancel',
  onCancel,
  className = '',
}: SchemaFormProps) {
  // Initialize form value from initialValue or schema default
  const getInitialFormValue = () => {
    if (initialValue !== undefined) return initialValue;
    if (schema.default !== undefined) return schema.default;
    
    // Create default value based on schema type
    switch (schema.type) {
      case 'string': return '';
      case 'number': return 0;
      case 'boolean': return false;
      case 'object': return {};
      case 'array': return [];
      default: return null;
    }
  };
  
  // Form state
  const [value, setValue] = useState(getInitialFormValue);
  const [errors, setErrors] = useState<string[]>([]);
  const [touched, setTouched] = useState(false);
  
  // Get all schema generator plugins
  const pluginRegistry = PluginRegistry.getInstance();
  const generatorPlugins = pluginRegistry.getPluginsByType<SchemaGeneratorPlugin>('SchemaGeneratorPlugin');
  
  // Pre-process schema with all plugins
  const processedSchema = generatorPlugins.reduce(
    (currentSchema, plugin) => 
      plugin.preprocessSchema ? 
        plugin.preprocessSchema(currentSchema) : 
        currentSchema,
    schema
  );
  
  // Update value when initialValue changes
  useEffect(() => {
    if (initialValue !== undefined) {
      setValue(initialValue);
    }
  }, [initialValue]);
  
  // Call onChange when value changes
  useEffect(() => {
    if (onChange) {
      onChange(value);
    }
    
    // Validate if touched
    if (touched && showValidation) {
      validateForm();
    }
  }, [value, touched, showValidation]);
  
  // Collect all component generators from plugins
  const getAllComponentGenerators = () => {
    const generators = [];
    
    for (const plugin of generatorPlugins) {
      generators.push(...plugin.getComponentGenerators());
    }
    
    return generators;
  };
  
  // Generate component for a field
  const generateComponent = (
    field: SchemaField, 
    path: string[], 
    fieldValue: any, 
    fieldOnChange: (value: any) => void
  ): ReactNode => {
    // Create generation context
    const context: ComponentGenerationContext = {
      path,
      value: fieldValue,
      onChange: fieldOnChange,
      errors: touched && showValidation ? 
        validateValueAgainstSchema(fieldValue, field) : 
        undefined,
      generateComponent,
      plugins: generatorPlugins,
    };
    
    // Find matching generator
    const generators = getAllComponentGenerators();
    const matchingGenerator = findMatchingGenerator(generators, field);
    
    if (!matchingGenerator) {
      return (
        <div className="unsupported-field">
          Unsupported field type: {field.type}
          {field.format && ` (${field.format})`}
        </div>
      );
    }
    
    // Generate component
    let component = matchingGenerator.generator(field, context);
    
    // Post-process component with all plugins
    for (const plugin of generatorPlugins) {
      if (plugin.postprocessComponent) {
        component = plugin.postprocessComponent(component, field, context);
      }
    }
    
    return component;
  };
  
  // Validate form
  const validateForm = () => {
    // Run built-in validation
    let validationErrors = validateValueAgainstSchema(value, processedSchema);
    
    // Run custom validation if provided
    if (validate) {
      const customErrors = validate(value, processedSchema);
      if (customErrors && customErrors.length > 0) {
        validationErrors = [...validationErrors, ...customErrors];
      }
    }
    
    setErrors(validationErrors);
    return validationErrors.length === 0;
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    
    const isValid = validateForm();
    
    if (isValid && onSubmit) {
      onSubmit(value);
    }
  };
  
  return (
    <form 
      className={`schema-form ${className}`} 
      onSubmit={handleSubmit}
      noValidate
    >
      {title && <div className="schema-form-title">{title}</div>}
      
      <div className="schema-form-content">
        {generateComponent(processedSchema, [], value, setValue)}
      </div>
      
      {errors.length > 0 && touched && showValidation && (
        <div className="schema-form-errors">
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="schema-form-actions">
        {onSubmit && (
          <button type="submit" className="submit-button">
            {submitText}
          </button>
        )}
        
        {onCancel && (
          <button 
            type="button" 
            className="cancel-button" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
        )}
      </div>
    </form>
  );
} 