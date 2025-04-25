import { BaseSchemaGeneratorPlugin, ComponentGenerationContext, ComponentGeneratorRegistration } from './SchemaGeneratorPlugin';
import { SchemaField } from './SchemaPlugin';
import { PluginMetadata } from './PluginRegistry';
import React, { ReactNode } from 'react';

/**
 * Basic form generators for common field types
 */
export class BasicFormGenerators extends BaseSchemaGeneratorPlugin {
  /**
   * Plugin metadata
   */
  readonly metadata: PluginMetadata = {
    id: 'core.basic-form-generators',
    name: 'Basic Form Generators',
    description: 'Provides generators for common form field types',
    version: '1.0.0',
    author: 'PersLM',
    tags: ['form', 'ui', 'generator'],
  };
  
  /**
   * Get component generators
   */
  getComponentGenerators(): ComponentGeneratorRegistration[] {
    return [
      // String field
      {
        type: 'string',
        priority: 1,
        generator: this.generateStringField.bind(this),
      },
      
      // Number field
      {
        type: 'number',
        priority: 1,
        generator: this.generateNumberField.bind(this),
      },
      
      // Boolean field
      {
        type: 'boolean',
        priority: 1,
        generator: this.generateBooleanField.bind(this),
      },
      
      // Email field
      {
        type: 'string',
        format: 'email',
        priority: 2,
        generator: this.generateEmailField.bind(this),
      },
      
      // Password field
      {
        type: 'string',
        format: 'password',
        priority: 2,
        generator: this.generatePasswordField.bind(this),
      },
      
      // Select field (enum)
      {
        type: 'string',
        priority: 2,
        match: (field) => Boolean(field.enum?.length),
        generator: this.generateSelectField.bind(this),
      },
      
      // Textarea field
      {
        type: 'string',
        priority: 2,
        match: (field) => Boolean(field.uiOptions?.multiline),
        generator: this.generateTextareaField.bind(this),
      },
      
      // Object field
      {
        type: 'object',
        priority: 1,
        generator: this.generateObjectField.bind(this),
      },
      
      // Array field
      {
        type: 'array',
        priority: 1,
        generator: this.generateArrayField.bind(this),
      },
    ];
  }
  
  /**
   * Generate string field
   */
  private generateStringField(field: SchemaField, context: ComponentGenerationContext): ReactNode {
    const { value, onChange, errors } = context;
    const hasError = errors && errors.length > 0;
    
    return React.createElement('div', { className: 'field-container' },
      field.title && React.createElement('label', {}, field.title),
      React.createElement('input', {
        type: 'text',
        value: value || '',
        onChange: (e: any) => onChange(e.target.value),
        placeholder: field.description,
        className: `form-input ${hasError ? 'has-error' : ''}`,
        required: field.required,
        minLength: field.minLength,
        maxLength: field.maxLength,
        pattern: field.pattern,
      }),
      hasError && React.createElement('div', { className: 'error-message' }, errors!.join(', '))
    );
  }
  
  /**
   * Generate number field
   */
  private generateNumberField(field: SchemaField, context: ComponentGenerationContext): ReactNode {
    const { value, onChange, errors } = context;
    const hasError = errors && errors.length > 0;
    
    return React.createElement('div', { className: 'field-container' },
      field.title && React.createElement('label', {}, field.title),
      React.createElement('input', {
        type: 'number',
        value: value ?? '',
        onChange: (e: any) => onChange(Number(e.target.value)),
        placeholder: field.description,
        className: `form-input ${hasError ? 'has-error' : ''}`,
        required: field.required,
        min: field.minimum,
        max: field.maximum,
        step: field.uiOptions?.step || 1,
      }),
      hasError && React.createElement('div', { className: 'error-message' }, errors!.join(', '))
    );
  }
  
  /**
   * Generate boolean field
   */
  private generateBooleanField(field: SchemaField, context: ComponentGenerationContext): ReactNode {
    const { value, onChange, errors } = context;
    const hasError = errors && errors.length > 0;
    
    return React.createElement('div', { className: 'field-container checkbox-container' },
      React.createElement('input', {
        type: 'checkbox',
        checked: Boolean(value),
        onChange: (e: any) => onChange(e.target.checked),
        className: `form-checkbox ${hasError ? 'has-error' : ''}`,
        required: field.required,
      }),
      field.title && React.createElement('label', {}, field.title),
      hasError && React.createElement('div', { className: 'error-message' }, errors!.join(', '))
    );
  }
  
  /**
   * Generate email field
   */
  private generateEmailField(field: SchemaField, context: ComponentGenerationContext): ReactNode {
    const { value, onChange, errors } = context;
    const hasError = errors && errors.length > 0;
    
    return React.createElement('div', { className: 'field-container' },
      field.title && React.createElement('label', {}, field.title),
      React.createElement('input', {
        type: 'email',
        value: value || '',
        onChange: (e: any) => onChange(e.target.value),
        placeholder: field.description || 'Email address',
        className: `form-input ${hasError ? 'has-error' : ''}`,
        required: field.required,
      }),
      hasError && React.createElement('div', { className: 'error-message' }, errors!.join(', '))
    );
  }
  
  /**
   * Generate password field
   */
  private generatePasswordField(field: SchemaField, context: ComponentGenerationContext): ReactNode {
    const { value, onChange, errors } = context;
    const hasError = errors && errors.length > 0;
    
    return React.createElement('div', { className: 'field-container' },
      field.title && React.createElement('label', {}, field.title),
      React.createElement('input', {
        type: 'password',
        value: value || '',
        onChange: (e: any) => onChange(e.target.value),
        placeholder: field.description || 'Password',
        className: `form-input ${hasError ? 'has-error' : ''}`,
        required: field.required,
        minLength: field.minLength,
        maxLength: field.maxLength,
      }),
      hasError && React.createElement('div', { className: 'error-message' }, errors!.join(', '))
    );
  }
  
  /**
   * Generate select field (enum)
   */
  private generateSelectField(field: SchemaField, context: ComponentGenerationContext): ReactNode {
    const { value, onChange, errors } = context;
    const hasError = errors && errors.length > 0;
    
    return React.createElement('div', { className: 'field-container' },
      field.title && React.createElement('label', {}, field.title),
      React.createElement('select', {
        value: value ?? '',
        onChange: (e: any) => onChange(e.target.value),
        className: `form-select ${hasError ? 'has-error' : ''}`,
        required: field.required,
      },
        // Empty option
        !field.required && React.createElement('option', { value: '' }, field.uiOptions?.placeholder || 'Select...'),
        // Enum options
        field.enum?.map((option, index) => 
          React.createElement('option', { key: index, value: option }, 
            field.enumLabels?.[index] || option
          )
        )
      ),
      hasError && React.createElement('div', { className: 'error-message' }, errors!.join(', '))
    );
  }
  
  /**
   * Generate textarea field
   */
  private generateTextareaField(field: SchemaField, context: ComponentGenerationContext): ReactNode {
    const { value, onChange, errors } = context;
    const hasError = errors && errors.length > 0;
    
    return React.createElement('div', { className: 'field-container' },
      field.title && React.createElement('label', {}, field.title),
      React.createElement('textarea', {
        value: value || '',
        onChange: (e: any) => onChange(e.target.value),
        placeholder: field.description,
        className: `form-textarea ${hasError ? 'has-error' : ''}`,
        required: field.required,
        minLength: field.minLength,
        maxLength: field.maxLength,
        rows: field.uiOptions?.rows || 4,
      }),
      hasError && React.createElement('div', { className: 'error-message' }, errors!.join(', '))
    );
  }
  
  /**
   * Generate object field
   */
  private generateObjectField(field: SchemaField, context: ComponentGenerationContext): ReactNode {
    const { value, onChange, path, generateComponent } = context;
    const objValue = value || {};
    
    if (!field.properties) {
      return React.createElement('div', { className: 'no-fields' }, 'No fields defined');
    }
    
    const propertyEntries = Object.entries(field.properties);
    
    return React.createElement('div', { className: 'object-field' },
      field.title && React.createElement('div', { className: 'object-title' }, field.title),
      propertyEntries.map(([propName, propField]) => {
        const propValue = objValue[propName];
        const propPath = [...path, propName];
        
        return React.createElement('div', { key: propName, className: 'property-field' },
          generateComponent(
            propField,
            propPath,
            propValue,
            (newValue) => {
              const updatedObj = { ...objValue, [propName]: newValue };
              onChange(updatedObj);
            }
          )
        );
      })
    );
  }
  
  /**
   * Generate array field
   */
  private generateArrayField(field: SchemaField, context: ComponentGenerationContext): ReactNode {
    const { value, onChange, path, generateComponent } = context;
    const arrayValue = Array.isArray(value) ? value : [];
    
    if (!field.items) {
      return React.createElement('div', { className: 'no-items' }, 'No item schema defined');
    }
    
    const handleAdd = () => {
      let defaultValue;
      if (field.items.type === 'string') defaultValue = '';
      else if (field.items.type === 'number') defaultValue = 0;
      else if (field.items.type === 'boolean') defaultValue = false;
      else if (field.items.type === 'object') defaultValue = {};
      else if (field.items.type === 'array') defaultValue = [];
      else defaultValue = null;
      
      onChange([...arrayValue, defaultValue]);
    };
    
    const handleRemove = (index: number) => {
      const newArray = [...arrayValue];
      newArray.splice(index, 1);
      onChange(newArray);
    };
    
    return React.createElement('div', { className: 'array-field' },
      field.title && React.createElement('div', { className: 'array-title' }, field.title),
      arrayValue.map((item, index) => {
        const itemPath = [...path, index.toString()];
        
        return React.createElement('div', { key: index, className: 'array-item' },
          React.createElement('div', { className: 'array-item-content' },
            generateComponent(
              field.items!,
              itemPath,
              item,
              (newValue) => {
                const newArray = [...arrayValue];
                newArray[index] = newValue;
                onChange(newArray);
              }
            )
          ),
          React.createElement('button', {
            type: 'button',
            className: 'remove-item-button',
            onClick: () => handleRemove(index),
          }, 'Remove')
        );
      }),
      React.createElement('button', {
        type: 'button',
        className: 'add-item-button',
        onClick: handleAdd,
      }, `Add ${field.items.title || 'Item'}`)
    );
  }
} 