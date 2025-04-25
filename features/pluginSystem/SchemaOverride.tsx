import React from 'react';
import { z } from 'zod';

// Field definition interface
interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  title?: string;
  description?: string;
  required?: boolean;
  default?: any;
  properties?: Record<string, SchemaField>;
  items?: SchemaField;
  enum?: any[];
  format?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

// Input component props
interface FieldInputProps {
  field: SchemaField;
  value: any;
  onChange: (value: any) => void;
  path: string;
  errors?: Record<string, string>;
}

// Schema form props
interface SchemaFormProps {
  schema: Record<string, SchemaField>;
  initialValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void;
  children?: React.ReactNode;
}

// String Field Component
const StringField: React.FC<FieldInputProps> = ({ 
  field, 
  value, 
  onChange, 
  path, 
  errors 
}) => {
  return (
    <div className="field-container">
      {field.title && <label htmlFor={path}>{field.title}</label>}
      <input
        id={path}
        type={field.format === 'email' ? 'email' : 
              field.format === 'date' ? 'date' : 
              field.format === 'password' ? 'password' : 'text'}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.description}
        className={errors?.[path] ? 'input-error' : ''}
        required={field.required}
        minLength={field.minLength}
        maxLength={field.maxLength}
        pattern={field.pattern}
      />
      {errors?.[path] && <div className="error-message">{errors[path]}</div>}
    </div>
  );
};

// Number Field Component
const NumberField: React.FC<FieldInputProps> = ({ 
  field, 
  value, 
  onChange, 
  path, 
  errors 
}) => {
  return (
    <div className="field-container">
      {field.title && <label htmlFor={path}>{field.title}</label>}
      <input
        id={path}
        type="number"
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value))}
        placeholder={field.description}
        className={errors?.[path] ? 'input-error' : ''}
        required={field.required}
        min={field.minimum}
        max={field.maximum}
      />
      {errors?.[path] && <div className="error-message">{errors[path]}</div>}
    </div>
  );
};

// Boolean Field Component
const BooleanField: React.FC<FieldInputProps> = ({ 
  field, 
  value, 
  onChange, 
  path, 
  errors 
}) => {
  return (
    <div className="field-container checkbox">
      <input
        id={path}
        type="checkbox"
        checked={value || false}
        onChange={(e) => onChange(e.target.checked)}
        className={errors?.[path] ? 'input-error' : ''}
        required={field.required}
      />
      {field.title && <label htmlFor={path}>{field.title}</label>}
      {errors?.[path] && <div className="error-message">{errors[path]}</div>}
    </div>
  );
};

// Select Field Component
const SelectField: React.FC<FieldInputProps> = ({ 
  field, 
  value, 
  onChange, 
  path, 
  errors 
}) => {
  return (
    <div className="field-container">
      {field.title && <label htmlFor={path}>{field.title}</label>}
      <select
        id={path}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={errors?.[path] ? 'input-error' : ''}
        required={field.required}
      >
        <option value="">Select...</option>
        {field.enum?.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {errors?.[path] && <div className="error-message">{errors[path]}</div>}
    </div>
  );
};

// Array Field Component
const ArrayField: React.FC<FieldInputProps> = ({ 
  field, 
  value, 
  onChange, 
  path, 
  errors 
}) => {
  const handleAdd = () => {
    const newValue = [...(value || []), getDefaultValue(field.items as SchemaField)];
    onChange(newValue);
  };

  const handleChange = (index: number, newValue: any) => {
    const updatedValue = [...(value || [])];
    updatedValue[index] = newValue;
    onChange(updatedValue);
  };

  const handleRemove = (index: number) => {
    const updatedValue = [...(value || [])];
    updatedValue.splice(index, 1);
    onChange(updatedValue);
  };

  return (
    <div className="field-container array-field">
      {field.title && <label>{field.title}</label>}
      <div className="array-items">
        {(value || []).map((item: any, index: number) => (
          <div key={index} className="array-item">
            <SchemaField
              field={field.items as SchemaField}
              value={item}
              onChange={(newValue) => handleChange(index, newValue)}
              path={`${path}[${index}]`}
              errors={errors}
            />
            <button 
              type="button" 
              className="remove-button" 
              onClick={() => handleRemove(index)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="add-button" onClick={handleAdd}>
        Add Item
      </button>
      {errors?.[path] && <div className="error-message">{errors[path]}</div>}
    </div>
  );
};

// Object Field Component
const ObjectField: React.FC<FieldInputProps> = ({ 
  field, 
  value, 
  onChange, 
  path, 
  errors 
}) => {
  const handleChange = (key: string, newValue: any) => {
    const updatedValue = { ...(value || {}) };
    updatedValue[key] = newValue;
    onChange(updatedValue);
  };

  return (
    <div className="field-container object-field">
      {field.title && <label>{field.title}</label>}
      <div className="object-properties">
        {field.properties && Object.entries(field.properties).map(([key, propField]) => (
          <SchemaField
            key={key}
            field={propField}
            value={value?.[key]}
            onChange={(newValue) => handleChange(key, newValue)}
            path={path ? `${path}.${key}` : key}
            errors={errors}
          />
        ))}
      </div>
      {errors?.[path] && <div className="error-message">{errors[path]}</div>}
    </div>
  );
};

// Helper function to get default value based on field type
const getDefaultValue = (field: SchemaField): any => {
  if (field.default !== undefined) return field.default;
  
  switch (field.type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'object': return {};
    case 'array': return [];
    default: return null;
  }
};

// Generic Field component that selects the appropriate component based on field type
const SchemaField: React.FC<FieldInputProps> = ({ field, value, onChange, path, errors }) => {
  if (field.enum && field.enum.length > 0) {
    return (
      <SelectField
        field={field}
        value={value}
        onChange={onChange}
        path={path}
        errors={errors}
      />
    );
  }

  switch (field.type) {
    case 'string':
      return (
        <StringField
          field={field}
          value={value}
          onChange={onChange}
          path={path}
          errors={errors}
        />
      );
    case 'number':
      return (
        <NumberField
          field={field}
          value={value}
          onChange={onChange}
          path={path}
          errors={errors}
        />
      );
    case 'boolean':
      return (
        <BooleanField
          field={field}
          value={value}
          onChange={onChange}
          path={path}
          errors={errors}
        />
      );
    case 'array':
      return (
        <ArrayField
          field={field}
          value={value}
          onChange={onChange}
          path={path}
          errors={errors}
        />
      );
    case 'object':
      return (
        <ObjectField
          field={field}
          value={value}
          onChange={onChange}
          path={path}
          errors={errors}
        />
      );
    default:
      return <div>Unsupported field type: {field.type}</div>;
  }
};

// Schema Form Component
export const SchemaForm: React.FC<SchemaFormProps> = ({
  schema,
  initialValues = {},
  onSubmit,
  children
}) => {
  const [values, setValues] = React.useState(initialValues);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear error when field is changed
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    Object.entries(schema).forEach(([key, field]) => {
      if (field.required && !values[key]) {
        newErrors[key] = `${field.title || key} is required`;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(values);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="schema-form">
      {Object.entries(schema).map(([key, field]) => (
        <SchemaField
          key={key}
          field={field}
          value={values[key]}
          onChange={(value) => handleChange(key, value)}
          path={key}
          errors={errors}
        />
      ))}
      {children}
    </form>
  );
};

// Schema override component
export const SchemaOverride: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
}; 