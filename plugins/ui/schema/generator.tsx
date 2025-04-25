import React from 'react';
import { UIModel, UIControl, UIControlType, UILayout, UILayoutType } from './parser';

/**
 * Component generation options
 */
export interface ComponentGeneratorOptions {
  useTailwind?: boolean;
  useShad?: boolean;
  customComponents?: Record<string, React.ComponentType<any>>;
  defaultClassName?: string;
  importStatements?: string[];
  wrapWithErrorBoundary?: boolean;
  addFormValidation?: boolean;
  formMode?: 'controlled' | 'uncontrolled';
  labelPosition?: 'top' | 'left' | 'right' | 'bottom';
  disableResponsive?: boolean;
  debug?: boolean;
}

/**
 * Default component generator options
 */
const defaultGeneratorOptions: ComponentGeneratorOptions = {
  useTailwind: true,
  useShad: true,
  defaultClassName: '',
  importStatements: [],
  wrapWithErrorBoundary: true,
  addFormValidation: true,
  formMode: 'controlled',
  labelPosition: 'top',
  disableResponsive: false,
  debug: false,
};

/**
 * Component code generation result
 */
export interface GeneratedComponent {
  code: string;
  fileName: string;
  componentName: string;
  imports: string[];
  hasForm: boolean;
  hasTable: boolean;
  hasAsync: boolean;
}

/**
 * UI Component generator
 */
export class ComponentGenerator {
  private options: ComponentGeneratorOptions;

  constructor(options: ComponentGeneratorOptions = {}) {
    this.options = { ...defaultGeneratorOptions, ...options };
  }

  /**
   * Generate a React component from a UI model
   */
  generateComponent(uiModel: UIModel): GeneratedComponent {
    const componentName = this.formatComponentName(uiModel.name);
    const fileName = this.formatFileName(uiModel.name);
    
    // Track imports needed
    const imports: string[] = [...(this.options.importStatements || [])];
    
    // Add default React import
    imports.push('import React, { useState } from \'react\';');
    
    let hasForm = false;
    let hasTable = false;
    let hasAsync = false;

    // Check if model has forms or tables
    this.analyzeModel(uiModel, {
      hasForm: (has) => { hasForm = has; },
      hasTable: (has) => { hasTable = has; },
      hasAsync: (has) => { hasAsync = has; },
    });

    // Add appropriate imports
    if (hasForm && this.options.addFormValidation) {
      if (this.options.useShad) {
        imports.push('import { useForm } from \'react-hook-form\';');
        imports.push('import { zodResolver } from \'@hookform/resolvers/zod\';');
        imports.push('import * as z from \'zod\';');
        imports.push('import { Button } from \'@/components/ui/button\';');
        imports.push('import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from \'@/components/ui/form\';');
        imports.push('import { Input } from \'@/components/ui/input\';');
        imports.push('import { Checkbox } from \'@/components/ui/checkbox\';');
        imports.push('import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from \'@/components/ui/select\';');
      } else {
        imports.push('import { useForm, Controller } from \'react-hook-form\';');
      }
    }

    if (hasTable) {
      if (this.options.useShad) {
        imports.push('import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from \'@/components/ui/table\';');
      }
    }

    if (hasAsync) {
      imports.push('import { useEffect } from \'react\';');
    }

    // Generate interface for props
    const propsInterface = this.generatePropsInterface(uiModel);
    
    // Generate form schema if needed
    const formSchema = hasForm && this.options.addFormValidation
      ? this.generateFormSchema(uiModel)
      : '';
    
    // Generate component body
    const componentBody = this.generateComponentBody(uiModel);
    
    // Combine everything into complete component code
    const code = `${imports.join('\n')}\n\n${propsInterface}\n\n${formSchema}\n\n${componentBody}`;
    
    return {
      code,
      fileName,
      componentName,
      imports,
      hasForm,
      hasTable,
      hasAsync,
    };
  }

  /**
   * Analyze the UI model to determine what features it needs
   */
  private analyzeModel(
    uiModel: UIModel, 
    trackers: { 
      hasForm: (has: boolean) => void, 
      hasTable: (has: boolean) => void,
      hasAsync: (has: boolean) => void
    }
  ): void {
    if (uiModel.layout.type === UILayoutType.FORM) {
      trackers.hasForm(true);
    }
    
    if (uiModel.layout.type === UILayoutType.TABLE) {
      trackers.hasTable(true);
    }
    
    // Check for async operations like file uploads
    const checkControlForAsync = (control: UIControl) => {
      if (
        control.type === UIControlType.FILE_UPLOAD ||
        control.type === UIControlType.IMAGE_UPLOAD
      ) {
        trackers.hasAsync(true);
      }
      
      // Check children recursively
      if (control.children) {
        control.children.forEach(checkControlForAsync);
      }
    };
    
    // Check all elements for async operations
    uiModel.layout.elements.forEach(checkControlForAsync);
    
    // Also check if the layout is a form but has table elements
    if (uiModel.layout.type === UILayoutType.FORM) {
      const checkControlForTable = (control: UIControl) => {
        if (control.type === UIControlType.TABLE) {
          trackers.hasTable(true);
        }
        
        // Check children recursively
        if (control.children) {
          control.children.forEach(checkControlForTable);
        }
      };
      
      uiModel.layout.elements.forEach(checkControlForTable);
    }
  }

  /**
   * Format a name into a valid component name
   */
  private formatComponentName(name: string): string {
    // Convert to PascalCase
    return name
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  }

  /**
   * Format a name into a valid file name
   */
  private formatFileName(name: string): string {
    // Convert to kebab-case
    return name
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with a single space
      .toLowerCase()
      .split(' ')
      .join('-') + '.tsx';
  }

  /**
   * Generate interface for component props
   */
  private generatePropsInterface(uiModel: UIModel): string {
    // Start with basic props
    let props = [
      'className?: string',
      'style?: React.CSSProperties',
    ];
    
    // Add data prop if model has a schema
    if (uiModel.schema) {
      props.push(`data?: any`);
    }
    
    // Add onSubmit prop if model has a form
    if (uiModel.layout.type === UILayoutType.FORM) {
      props.push('onSubmit?: (data: any) => void');
      props.push('isLoading?: boolean');
    }
    
    // Add specific props based on layout type
    if (uiModel.layout.type === UILayoutType.TABLE) {
      props.push('items?: any[]');
      props.push('onRowClick?: (item: any, index: number) => void');
    }
    
    // Assemble the interface
    return `export interface ${this.formatComponentName(uiModel.name)}Props {
  ${props.join(';\n  ')};
}`;
  }

  /**
   * Generate Zod form schema from UI model
   */
  private generateFormSchema(uiModel: UIModel): string {
    // Only generate schema for forms
    if (uiModel.layout.type !== UILayoutType.FORM) {
      return '';
    }
    
    const schemaFields: string[] = [];
    
    // Process all controls to build schema
    const processControl = (control: UIControl): void => {
      // Skip non-input controls
      if (
        control.type === UIControlType.TABLE ||
        control.type === UIControlType.CARD ||
        control.type === UIControlType.LIST ||
        control.type === UIControlType.TABS ||
        control.type === UIControlType.MODAL
      ) {
        // For container controls, process their children
        if (control.children) {
          control.children.forEach(processControl);
        }
        return;
      }
      
      let fieldSchema = 'z.any()';
      
      switch (control.type) {
        case UIControlType.TEXT_INPUT:
        case UIControlType.EMAIL_INPUT:
        case UIControlType.URL_INPUT:
        case UIControlType.PASSWORD_INPUT:
        case UIControlType.TEXTAREA:
        case UIControlType.RICH_TEXT:
          fieldSchema = 'z.string()';
          
          // Add validations
          if (control.validation?.required) {
            fieldSchema += '.min(1, { message: "This field is required" })';
          } else {
            fieldSchema += '.optional()';
          }
          
          if (control.validation?.minLength) {
            fieldSchema += `.min(${control.validation.minLength}, { message: "Must be at least ${control.validation.minLength} characters" })`;
          }
          
          if (control.validation?.maxLength) {
            fieldSchema += `.max(${control.validation.maxLength}, { message: "Must be no more than ${control.validation.maxLength} characters" })`;
          }
          
          if (control.type === UIControlType.EMAIL_INPUT) {
            fieldSchema += '.email({ message: "Invalid email address" })';
          }
          
          if (control.type === UIControlType.URL_INPUT) {
            fieldSchema += '.url({ message: "Invalid URL" })';
          }
          break;
          
        case UIControlType.NUMBER_INPUT:
          fieldSchema = 'z.number()';
          
          // Add validations
          if (control.validation?.required) {
            fieldSchema += '';
          } else {
            fieldSchema += '.optional()';
          }
          
          if (control.validation?.min !== undefined) {
            fieldSchema += `.min(${control.validation.min}, { message: "Must be at least ${control.validation.min}" })`;
          }
          
          if (control.validation?.max !== undefined) {
            fieldSchema += `.max(${control.validation.max}, { message: "Must be no more than ${control.validation.max}" })`;
          }
          break;
          
        case UIControlType.CHECKBOX:
        case UIControlType.SWITCH:
          fieldSchema = 'z.boolean()';
          
          if (!control.validation?.required) {
            fieldSchema += '.optional()';
          }
          break;
          
        case UIControlType.SELECT:
        case UIControlType.RADIO_GROUP:
          if (control.options && control.options.length > 0) {
            // Create a union type of literals for the options
            const values = control.options.map(option => 
              typeof option.value === 'string' 
                ? `"${option.value}"` 
                : String(option.value)
            );
            fieldSchema = `z.enum([${values.join(', ')}])`;
          } else {
            fieldSchema = 'z.string()';
          }
          
          if (!control.validation?.required) {
            fieldSchema += '.optional()';
          }
          break;
          
        case UIControlType.MULTISELECT:
        case UIControlType.CHECKBOX_GROUP:
          fieldSchema = 'z.array(z.string())';
          
          if (control.validation?.required) {
            fieldSchema += '.min(1, { message: "Select at least one option" })';
          }
          break;
          
        case UIControlType.DATE_PICKER:
          fieldSchema = 'z.date()';
          
          if (!control.validation?.required) {
            fieldSchema += '.optional()';
          }
          break;
          
        case UIControlType.FILE_UPLOAD:
        case UIControlType.IMAGE_UPLOAD:
          // For file inputs, we don't use Zod validation directly
          // since they're handled separately
          fieldSchema = 'z.any()';
          break;
          
        default:
          fieldSchema = 'z.any()';
          
          if (!control.validation?.required) {
            fieldSchema += '.optional()';
          }
      }
      
      schemaFields.push(`${control.name}: ${fieldSchema}`);
    };
    
    // Process all form controls
    uiModel.layout.elements.forEach(processControl);
    
    // If no fields, return empty string
    if (schemaFields.length === 0) {
      return '';
    }
    
    // Assemble the schema
    const schemaName = `${this.formatComponentName(uiModel.name)}Schema`;
    return `const ${schemaName} = z.object({
  ${schemaFields.join(',\n  ')}
});

type ${this.formatComponentName(uiModel.name)}Values = z.infer<typeof ${schemaName}>;`;
  }

  /**
   * Generate the component JSX for a specific control
   */
  private generateControlJSX(control: UIControl, formContext: boolean = false): string {
    const { useTailwind, useShad } = this.options;
    let jsx = '';
    
    // For shadcn/ui with form context
    if (useShad && formContext) {
      switch (control.type) {
        case UIControlType.TEXT_INPUT:
        case UIControlType.EMAIL_INPUT:
        case UIControlType.PASSWORD_INPUT:
        case UIControlType.URL_INPUT:
          return `<FormField
  control={form.control}
  name="${control.name}"
  render={({ field }) => (
    <FormItem>
      <FormLabel>${control.label}</FormLabel>
      <FormControl>
        <Input 
          placeholder="${control.placeholder || ''}" 
          type="${control.type === UIControlType.PASSWORD_INPUT ? 'password' : 
                 control.type === UIControlType.EMAIL_INPUT ? 'email' :
                 control.type === UIControlType.URL_INPUT ? 'url' : 'text'}"
          {...field} 
        />
      </FormControl>
      ${control.description ? `<FormDescription>${control.description}</FormDescription>` : ''}
      <FormMessage />
    </FormItem>
  )}
/>`;
          
        case UIControlType.TEXTAREA:
          return `<FormField
  control={form.control}
  name="${control.name}"
  render={({ field }) => (
    <FormItem>
      <FormLabel>${control.label}</FormLabel>
      <FormControl>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="${control.placeholder || ''}"
          {...field}
        />
      </FormControl>
      ${control.description ? `<FormDescription>${control.description}</FormDescription>` : ''}
      <FormMessage />
    </FormItem>
  )}
/>`;
          
        case UIControlType.NUMBER_INPUT:
          return `<FormField
  control={form.control}
  name="${control.name}"
  render={({ field }) => (
    <FormItem>
      <FormLabel>${control.label}</FormLabel>
      <FormControl>
        <Input
          type="number"
          {...field}
          onChange={(e) => field.onChange(Number(e.target.value))}
        />
      </FormControl>
      ${control.description ? `<FormDescription>${control.description}</FormDescription>` : ''}
      <FormMessage />
    </FormItem>
  )}
/>`;
          
        case UIControlType.CHECKBOX:
          return `<FormField
  control={form.control}
  name="${control.name}"
  render={({ field }) => (
    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md p-4">
      <FormControl>
        <Checkbox
          checked={field.value}
          onCheckedChange={field.onChange}
        />
      </FormControl>
      <div className="space-y-1 leading-none">
        <FormLabel>${control.label}</FormLabel>
        ${control.description ? `<FormDescription>${control.description}</FormDescription>` : ''}
      </div>
    </FormItem>
  )}
/>`;
          
        case UIControlType.SELECT:
          const options = control.options 
            ? control.options.map(option => 
                `<SelectItem key="${option.value}" value="${option.value}">${option.label}</SelectItem>`
              ).join('\n          ')
            : '';
            
          return `<FormField
  control={form.control}
  name="${control.name}"
  render={({ field }) => (
    <FormItem>
      <FormLabel>${control.label}</FormLabel>
      <Select onValueChange={field.onChange} defaultValue={field.value}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          ${options}
        </SelectContent>
      </Select>
      ${control.description ? `<FormDescription>${control.description}</FormDescription>` : ''}
      <FormMessage />
    </FormItem>
  )}
/>`;
          
        default:
          // For unsupported types in shadcn, fall back to regular input
          return `<FormField
  control={form.control}
  name="${control.name}"
  render={({ field }) => (
    <FormItem>
      <FormLabel>${control.label}</FormLabel>
      <FormControl>
        <Input {...field} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>`;
      }
    }
    
    // For regular components with Tailwind
    if (useTailwind) {
      switch (control.type) {
        case UIControlType.TEXT_INPUT:
        case UIControlType.EMAIL_INPUT:
        case UIControlType.PASSWORD_INPUT:
        case UIControlType.URL_INPUT:
          jsx = `<div className="mb-4">
  <label htmlFor="${control.id}" className="block text-sm font-medium text-gray-700 mb-1">
    ${control.label}${control.validation?.required ? ' *' : ''}
  </label>
  <input
    type="${control.type === UIControlType.PASSWORD_INPUT ? 'password' : 
           control.type === UIControlType.EMAIL_INPUT ? 'email' :
           control.type === UIControlType.URL_INPUT ? 'url' : 'text'}"
    id="${control.id}"
    name="${control.name}"
    placeholder="${control.placeholder || ''}"
    defaultValue={${formContext ? `form.${control.name}` : `data?.${control.name} || ''`}}
    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
    ${control.validation?.required ? 'required' : ''}
  />
  ${control.description ? `<p className="mt-1 text-sm text-gray-500">${control.description}</p>` : ''}
</div>`;
          break;
          
        case UIControlType.TEXTAREA:
          jsx = `<div className="mb-4">
  <label htmlFor="${control.id}" className="block text-sm font-medium text-gray-700 mb-1">
    ${control.label}${control.validation?.required ? ' *' : ''}
  </label>
  <textarea
    id="${control.id}"
    name="${control.name}"
    placeholder="${control.placeholder || ''}"
    defaultValue={${formContext ? `form.${control.name}` : `data?.${control.name} || ''`}}
    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
    rows={4}
    ${control.validation?.required ? 'required' : ''}
  ></textarea>
  ${control.description ? `<p className="mt-1 text-sm text-gray-500">${control.description}</p>` : ''}
</div>`;
          break;
          
        case UIControlType.NUMBER_INPUT:
          jsx = `<div className="mb-4">
  <label htmlFor="${control.id}" className="block text-sm font-medium text-gray-700 mb-1">
    ${control.label}${control.validation?.required ? ' *' : ''}
  </label>
  <input
    type="number"
    id="${control.id}"
    name="${control.name}"
    defaultValue={${formContext ? `form.${control.name}` : `data?.${control.name} || ''`}}
    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
    ${control.validation?.min !== undefined ? `min="${control.validation.min}"` : ''}
    ${control.validation?.max !== undefined ? `max="${control.validation.max}"` : ''}
    ${control.validation?.required ? 'required' : ''}
  />
  ${control.description ? `<p className="mt-1 text-sm text-gray-500">${control.description}</p>` : ''}
</div>`;
          break;
          
        case UIControlType.CHECKBOX:
          jsx = `<div className="mb-4">
  <div className="flex items-center">
    <input
      type="checkbox"
      id="${control.id}"
      name="${control.name}"
      defaultChecked={${formContext ? `form.${control.name}` : `data?.${control.name} || false`}}
      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
    />
    <label htmlFor="${control.id}" className="ml-2 block text-sm text-gray-700">
      ${control.label}
    </label>
  </div>
  ${control.description ? `<p className="mt-1 text-sm text-gray-500">${control.description}</p>` : ''}
</div>`;
          break;
          
        case UIControlType.SELECT:
          const options = control.options 
            ? control.options.map(option => 
                `<option key="${option.value}" value="${option.value}">${option.label}</option>`
              ).join('\n        ')
            : '';
            
          jsx = `<div className="mb-4">
  <label htmlFor="${control.id}" className="block text-sm font-medium text-gray-700 mb-1">
    ${control.label}${control.validation?.required ? ' *' : ''}
  </label>
  <select
    id="${control.id}"
    name="${control.name}"
    defaultValue={${formContext ? `form.${control.name}` : `data?.${control.name} || ''`}}
    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
    ${control.validation?.required ? 'required' : ''}
  >
    <option value="">Select an option</option>
    ${options}
  </select>
  ${control.description ? `<p className="mt-1 text-sm text-gray-500">${control.description}</p>` : ''}
</div>`;
          break;
          
        case UIControlType.RADIO_GROUP:
          const radioOptions = control.options 
            ? control.options.map(option => 
                `<div className="flex items-center mb-2" key="${option.value}">
          <input
            type="radio"
            id="${control.id}-${option.value}"
            name="${control.name}"
            value="${option.value}"
            defaultChecked={${formContext ? `form.${control.name}` : `data?.${control.name}`} === '${option.value}'}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
          />
          <label htmlFor="${control.id}-${option.value}" className="ml-2 block text-sm text-gray-700">
            ${option.label}
          </label>
        </div>`
              ).join('\n        ')
            : '';
            
          jsx = `<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    ${control.label}${control.validation?.required ? ' *' : ''}
  </label>
  <div>
    ${radioOptions}
  </div>
  ${control.description ? `<p className="mt-1 text-sm text-gray-500">${control.description}</p>` : ''}
</div>`;
          break;
          
        case UIControlType.TABLE:
          if (control.children && control.children.length > 0) {
            const headers = control.children.map(child => 
              `<th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">${child.label}</th>`
            ).join('\n            ');
            
            const cells = control.children.map(child => 
              `<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.${child.name}}</td>`
            ).join('\n              ');
            
            jsx = `<div className="mb-4">
  <h3 className="text-lg font-medium text-gray-700 mb-2">${control.label}</h3>
  ${control.description ? `<p className="mb-4 text-sm text-gray-500">${control.description}</p>` : ''}
  <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
    <table className="min-w-full divide-y divide-gray-200">
      <thead className="bg-gray-50">
        <tr>
          ${headers}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {items?.map((item, index) => (
          <tr
            key={index}
            className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
            onClick={() => onRowClick && onRowClick(item, index)}
          >
            ${cells}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>`;
          } else {
            jsx = `<div className="mb-4">
  <h3 className="text-lg font-medium text-gray-700 mb-2">${control.label}</h3>
  <p className="text-sm text-gray-500">No columns defined for this table.</p>
</div>`;
          }
          break;
          
        case UIControlType.FORM:
          if (control.children && control.children.length > 0) {
            const formControls = control.children.map(child => 
              this.generateControlJSX(child, formContext)
            ).join('\n      ');
            
            jsx = `<div className="mb-4">
  <h3 className="text-lg font-medium text-gray-700 mb-2">${control.label}</h3>
  ${control.description ? `<p className="mb-4 text-sm text-gray-500">${control.description}</p>` : ''}
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
    ${formControls}
  </div>
</div>`;
          } else {
            jsx = `<div className="mb-4">
  <h3 className="text-lg font-medium text-gray-700 mb-2">${control.label}</h3>
  <p className="text-sm text-gray-500">No fields defined for this form.</p>
</div>`;
          }
          break;
          
        case UIControlType.CARD:
          if (control.children && control.children.length > 0) {
            const cardContent = control.children.map(child => 
              this.generateControlJSX(child, formContext)
            ).join('\n      ');
            
            jsx = `<div className="mb-4 bg-white rounded-lg shadow overflow-hidden">
  <div className="px-6 py-4 border-b border-gray-200">
    <h3 className="text-lg font-medium text-gray-700">${control.label}</h3>
    ${control.description ? `<p className="mt-1 text-sm text-gray-500">${control.description}</p>` : ''}
  </div>
  <div className="px-6 py-4">
    ${cardContent}
  </div>
</div>`;
          } else {
            jsx = `<div className="mb-4 bg-white rounded-lg shadow overflow-hidden">
  <div className="px-6 py-4">
    <h3 className="text-lg font-medium text-gray-700">${control.label}</h3>
    ${control.description ? `<p className="mt-1 text-sm text-gray-500">${control.description}</p>` : ''}
  </div>
</div>`;
          }
          break;
          
        case UIControlType.DATE_PICKER:
          jsx = `<div className="mb-4">
  <label htmlFor="${control.id}" className="block text-sm font-medium text-gray-700 mb-1">
    ${control.label}${control.validation?.required ? ' *' : ''}
  </label>
  <input
    type="date"
    id="${control.id}"
    name="${control.name}"
    defaultValue={${formContext ? `form.${control.name}` : `data?.${control.name} || ''`}}
    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
    ${control.validation?.required ? 'required' : ''}
  />
  ${control.description ? `<p className="mt-1 text-sm text-gray-500">${control.description}</p>` : ''}
</div>`;
          break;
          
        default:
          // For any unsupported control type
          jsx = `<div className="mb-4">
  <label className="block text-sm font-medium text-gray-700 mb-1">
    ${control.label}
  </label>
  <div className="p-4 bg-gray-100 rounded-md text-sm">
    Unsupported control type: ${control.type}
  </div>
</div>`;
      }
    } else {
      // Non-Tailwind fallbacks - simplified basic HTML
      switch (control.type) {
        case UIControlType.TEXT_INPUT:
        case UIControlType.EMAIL_INPUT:
        case UIControlType.PASSWORD_INPUT:
        case UIControlType.URL_INPUT:
          jsx = `<div>
  <label htmlFor="${control.id}">
    ${control.label}${control.validation?.required ? ' *' : ''}
  </label>
  <input
    type="${control.type === UIControlType.PASSWORD_INPUT ? 'password' : 
           control.type === UIControlType.EMAIL_INPUT ? 'email' :
           control.type === UIControlType.URL_INPUT ? 'url' : 'text'}"
    id="${control.id}"
    name="${control.name}"
    placeholder="${control.placeholder || ''}"
    defaultValue={${formContext ? `form.${control.name}` : `data?.${control.name} || ''`}}
    ${control.validation?.required ? 'required' : ''}
  />
  ${control.description ? `<p>${control.description}</p>` : ''}
</div>`;
          break;
          
        default:
          // Very basic fallback
          jsx = `<div>
  <label>${control.label}</label>
  <input type="text" name="${control.name}" />
</div>`;
      }
    }
    
    return jsx;
  }

  /**
   * Generate the main component body
   */
  private generateComponentBody(uiModel: UIModel): string {
    const componentName = this.formatComponentName(uiModel.name);
    const hasForm = uiModel.layout.type === UILayoutType.FORM;
    
    let stateSetup = '';
    let componentBody = '';
    
    // Setup state if needed
    if (hasForm && this.options.formMode === 'controlled') {
      const initialStateFields = uiModel.layout.elements
        .filter(element => {
          // Filter out container elements
          return !(
            element.type === UIControlType.CARD ||
            element.type === UIControlType.TABLE ||
            element.type === UIControlType.TABS ||
            element.type === UIControlType.MODAL
          );
        })
        .map(element => {
          let defaultValue = 'undefined';
          
          switch (element.type) {
            case UIControlType.CHECKBOX:
            case UIControlType.SWITCH:
              defaultValue = 'false';
              break;
            case UIControlType.TEXT_INPUT:
            case UIControlType.EMAIL_INPUT:
            case UIControlType.PASSWORD_INPUT:
            case UIControlType.URL_INPUT:
            case UIControlType.TEXTAREA:
              defaultValue = '""';
              break;
            case UIControlType.SELECT:
            case UIControlType.RADIO_GROUP:
              defaultValue = '""';
              break;
            case UIControlType.MULTISELECT:
            case UIControlType.CHECKBOX_GROUP:
              defaultValue = '[]';
              break;
          }
          
          return `${element.name}: data?.${element.name} ?? ${defaultValue}`;
        })
        .join(',\n    ');
      
      stateSetup = `
  // Form state
  const [formState, setFormState] = useState({
    ${initialStateFields}
  });
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(formState);
    }
  };`;
    }
    
    if (hasForm && this.options.addFormValidation && this.options.useShad) {
      // Generate form with shadcn and react-hook-form
      const formControls = uiModel.layout.elements.map(element => 
        this.generateControlJSX(element, true)
      ).join('\n      ');
      
      componentBody = `
  // Form with validation
  const form = useForm<${componentName}Values>({
    resolver: zodResolver(${componentName}Schema),
    defaultValues: data || {},
  });

  // Handle form submission
  function onFormSubmit(values: ${componentName}Values) {
    if (onSubmit) {
      onSubmit(values);
    }
  }

  return (
    <div className={\`${this.options.defaultClassName} \${className || ''}\`} style={style}>
      ${uiModel.description ? `<div className="mb-6">
        <h2 className="text-2xl font-bold">${uiModel.name}</h2>
        <p className="text-gray-500">${uiModel.description}</p>
      </div>` : ''}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-8">
          ${formControls}
          
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      </Form>
    </div>
  );`;
    } else if (hasForm) {
      // Generate regular form
      const formControls = uiModel.layout.elements.map(element => 
        this.generateControlJSX(element, this.options.formMode === 'controlled')
      ).join('\n      ');
      
      componentBody = `${stateSetup}

  return (
    <div className={\`${this.options.defaultClassName} \${className || ''}\`} style={style}>
      ${uiModel.description ? `<div className="mb-6">
        <h2 className="text-2xl font-bold">${uiModel.name}</h2>
        <p className="text-gray-500">${uiModel.description}</p>
      </div>` : ''}
      
      <form onSubmit={${this.options.formMode === 'controlled' ? 'handleSubmit' : 'e => { e.preventDefault(); onSubmit && onSubmit(new FormData(e.target)); }'}}>
        ${formControls}
        
        <div className="mt-6">
          <button
            type="submit"
            disabled={isLoading}
            className="${this.options.useTailwind ? 'inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500' : ''}"
          >
            {isLoading ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );`;
    } else if (uiModel.layout.type === UILayoutType.TABLE) {
      // Generate table layout
      componentBody = `
  return (
    <div className={\`${this.options.defaultClassName} \${className || ''}\`} style={style}>
      ${uiModel.description ? `<div className="mb-6">
        <h2 className="text-2xl font-bold">${uiModel.name}</h2>
        <p className="text-gray-500">${uiModel.description}</p>
      </div>` : ''}
      
      ${this.generateTableLayout(uiModel.layout)}
    </div>
  );`;
    } else {
      // Generate generic layout
      const controls = uiModel.layout.elements.map(element => 
        this.generateControlJSX(element)
      ).join('\n      ');
      
      componentBody = `
  return (
    <div className={\`${this.options.defaultClassName} \${className || ''}\`} style={style}>
      ${uiModel.description ? `<div className="mb-6">
        <h2 className="text-2xl font-bold">${uiModel.name}</h2>
        <p className="text-gray-500">${uiModel.description}</p>
      </div>` : ''}
      
      ${controls}
    </div>
  );`;
    }
    
    // Generate the full component
    return `export const ${componentName}: React.FC<${componentName}Props> = ({
  className,
  style,
  data,
  ${hasForm ? 'onSubmit,' : ''}
  ${hasForm ? 'isLoading = false,' : ''}
  ${uiModel.layout.type === UILayoutType.TABLE ? 'items = [],' : ''}
  ${uiModel.layout.type === UILayoutType.TABLE ? 'onRowClick,' : ''}
}) => {${componentBody}}

export default ${componentName};`;
  }

  /**
   * Generate table layout JSX
   */
  private generateTableLayout(layout: UILayout): string {
    if (layout.type !== UILayoutType.TABLE || !layout.elements.length) {
      return '<div>No table data available</div>';
    }
    
    const tableElement = layout.elements[0];
    if (!tableElement.children || !tableElement.children.length) {
      return '<div>No columns defined for this table</div>';
    }
    
    const { useTailwind, useShad } = this.options;
    
    if (useShad) {
      const headers = tableElement.children.map(column => 
        `<TableHead key="${column.id}">${column.label}</TableHead>`
      ).join('\n          ');
      
      const cells = tableElement.children.map(column => 
        `<TableCell key="${column.id}">{item.${column.name}}</TableCell>`
      ).join('\n              ');
      
      return `<Table>
  ${layout.title ? `<TableCaption>${layout.title}</TableCaption>` : ''}
  <TableHeader>
    <TableRow>
      ${headers}
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item, index) => (
      <TableRow 
        key={index}
        className={onRowClick ? 'cursor-pointer' : ''}
        onClick={() => onRowClick && onRowClick(item, index)}
      >
        ${cells}
      </TableRow>
    ))}
    {items.length === 0 && (
      <TableRow>
        <TableCell colSpan={${tableElement.children.length}} className="text-center py-4">
          No data available
        </TableCell>
      </TableRow>
    )}
  </TableBody>
</Table>`;
    } else if (useTailwind) {
      const headers = tableElement.children.map(column => 
        `<th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          ${column.label}
        </th>`
      ).join('\n          ');
      
      const cells = tableElement.children.map(column => 
        `<td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {item.${column.name}}
            </td>`
      ).join('\n            ');
      
      return `<div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
  ${layout.title ? `<h3 className="text-lg font-medium p-4 bg-gray-50 border-b">${layout.title}</h3>` : ''}
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        ${headers}
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {items.map((item, index) => (
        <tr 
          key={index}
          className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
          onClick={() => onRowClick && onRowClick(item, index)}
        >
          ${cells}
        </tr>
      ))}
      {items.length === 0 && (
        <tr>
          <td colSpan={${tableElement.children.length}} className="px-6 py-4 text-center text-sm text-gray-500">
            No data available
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>`;
    } else {
      // Basic HTML table
      const headers = tableElement.children.map(column => 
        `<th>${column.label}</th>`
      ).join('\n          ');
      
      const cells = tableElement.children.map(column => 
        `<td>{item.${column.name}}</td>`
      ).join('\n            ');
      
      return `<div>
  ${layout.title ? `<h3>${layout.title}</h3>` : ''}
  <table>
    <thead>
      <tr>
        ${headers}
      </tr>
    </thead>
    <tbody>
      {items.map((item, index) => (
        <tr 
          key={index}
          onClick={() => onRowClick && onRowClick(item, index)}
        >
          ${cells}
        </tr>
      ))}
      {items.length === 0 && (
        <tr>
          <td colSpan={${tableElement.children.length}} style={{ textAlign: 'center' }}>
            No data available
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>`;
    }
  }
}

/**
 * Create a component generator with default options
 */
export function createComponentGenerator(options?: Partial<ComponentGeneratorOptions>): ComponentGenerator {
  return new ComponentGenerator(options);
} 