import React, { useEffect, useState } from 'react';
import { SchemaField } from './SchemaPlugin';
import { SchemaForm } from './SchemaForm';
import { PluginRegistry } from './PluginRegistry';
import { BasicFormGenerators } from './BasicFormGenerators';
import { ThemePlugin } from './ThemePlugin';

/**
 * User registration schema example
 */
const userRegistrationSchema: SchemaField = {
  type: 'object',
  title: 'User Registration',
  properties: {
    personalInfo: {
      type: 'object',
      title: 'Personal Information',
      properties: {
        firstName: {
          type: 'string',
          title: 'First Name',
          required: true,
          minLength: 2,
          maxLength: 50,
        },
        lastName: {
          type: 'string',
          title: 'Last Name',
          required: true,
          minLength: 2,
          maxLength: 50,
        },
        email: {
          type: 'string',
          format: 'email',
          title: 'Email Address',
          required: true,
        },
        phone: {
          type: 'string',
          title: 'Phone Number',
          pattern: '^[0-9\\-\\+\\s\\(\\)]+$',
        },
      },
    },
    account: {
      type: 'object',
      title: 'Account Details',
      properties: {
        username: {
          type: 'string',
          title: 'Username',
          required: true,
          minLength: 4,
          maxLength: 20,
          pattern: '^[a-zA-Z0-9_]+$',
        },
        password: {
          type: 'string',
          format: 'password',
          title: 'Password',
          required: true,
          minLength: 8,
          description: 'At least 8 characters with letters and numbers',
        },
        confirmPassword: {
          type: 'string',
          format: 'password',
          title: 'Confirm Password',
          required: true,
        },
        role: {
          type: 'string',
          title: 'Role',
          enum: ['user', 'admin', 'editor'],
          enumLabels: ['Regular User', 'Administrator', 'Content Editor'],
          default: 'user',
        },
      },
    },
    preferences: {
      type: 'object',
      title: 'Preferences',
      properties: {
        theme: {
          type: 'string',
          title: 'Theme',
          enum: ['light', 'dark', 'system'],
          enumLabels: ['Light Mode', 'Dark Mode', 'System Default'],
          default: 'system',
        },
        receiveEmails: {
          type: 'boolean',
          title: 'Receive Email Notifications',
          default: true,
        },
        bio: {
          type: 'string',
          title: 'Bio',
          uiOptions: {
            multiline: true,
            rows: 4,
          },
          maxLength: 500,
        },
      },
    },
    address: {
      type: 'object',
      title: 'Address',
      properties: {
        street: {
          type: 'string',
          title: 'Street Address',
        },
        city: {
          type: 'string',
          title: 'City',
        },
        state: {
          type: 'string',
          title: 'State/Province',
        },
        zipCode: {
          type: 'string',
          title: 'ZIP/Postal Code',
        },
        country: {
          type: 'string',
          title: 'Country',
          enum: ['USA', 'Canada', 'UK', 'Australia', 'Other'],
          default: 'USA',
        },
      },
    },
    interests: {
      type: 'array',
      title: 'Interests',
      items: {
        type: 'string',
        title: 'Interest',
      },
    },
  },
};

/**
 * Custom validation function
 */
const customValidate = (value: any, schema: SchemaField): string[] | null => {
  const errors: string[] = [];
  
  // Validate password confirmation
  if (
    value?.account?.password &&
    value?.account?.confirmPassword &&
    value.account.password !== value.account.confirmPassword
  ) {
    errors.push('Passwords do not match');
  }
  
  return errors.length > 0 ? errors : null;
};

/**
 * Schema form example component
 */
export function SchemaFormExample() {
  const [formValue, setFormValue] = useState<any>({});
  const [showValidation, setShowValidation] = useState(false);
  const [registryInitialized, setRegistryInitialized] = useState(false);
  
  // Initialize plugins
  useEffect(() => {
    const initPlugins = async () => {
      const registry = PluginRegistry.getInstance();
      
      // Register basic form generators plugin
      await registry.registerPlugin(new BasicFormGenerators());
      
      // Register theme plugin with custom theme
      await registry.registerPlugin(new ThemePlugin({
        primaryColor: '#2a6fc9',
        secondaryColor: '#6c757d',
        errorColor: '#e74c3c',
        borderRadius: '4px',
      }));
      
      setRegistryInitialized(true);
    };
    
    initPlugins();
  }, []);
  
  // Handle form submission
  const handleSubmit = (value: any) => {
    console.log('Form submitted:', value);
    alert('Form submitted! Check console for values.');
  };
  
  // Handle form value change
  const handleChange = (value: any) => {
    setFormValue(value);
  };
  
  if (!registryInitialized) {
    return <div>Initializing plugins...</div>;
  }
  
  return (
    <div className="schema-form-example">
      <h1>Schema Form Example</h1>
      <p>
        This example demonstrates a dynamic form generated from a schema using the plugin system.
      </p>
      
      <div className="form-container">
        <SchemaForm
          schema={userRegistrationSchema}
          onChange={handleChange}
          onSubmit={handleSubmit}
          validate={customValidate}
          showValidation={showValidation}
          submitText="Register"
          cancelText="Reset"
          onCancel={() => setFormValue({})}
        />
      </div>
      
      <div className="validation-toggle">
        <label>
          <input
            type="checkbox"
            checked={showValidation}
            onChange={() => setShowValidation(!showValidation)}
          />
          Show validation errors
        </label>
      </div>
      
      <div className="form-value">
        <h3>Current Form Value:</h3>
        <pre>{JSON.stringify(formValue, null, 2)}</pre>
      </div>
    </div>
  );
} 