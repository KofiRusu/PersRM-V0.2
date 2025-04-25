import { BaseSchemaGeneratorPlugin, ComponentGenerationContext, ComponentGeneratorRegistration } from './SchemaGeneratorPlugin';
import { SchemaField } from './SchemaPlugin';
import { PluginMetadata } from './PluginRegistry';
import React, { ReactNode } from 'react';

/**
 * Theme options for styling form components
 */
export interface ThemeOptions {
  /**
   * Primary color
   */
  primaryColor: string;
  
  /**
   * Secondary color
   */
  secondaryColor: string;
  
  /**
   * Background color
   */
  backgroundColor: string;
  
  /**
   * Text color
   */
  textColor: string;
  
  /**
   * Error color
   */
  errorColor: string;
  
  /**
   * Border radius
   */
  borderRadius: string;
  
  /**
   * Font family
   */
  fontFamily: string;
  
  /**
   * Font size
   */
  fontSize: string;
  
  /**
   * Input padding
   */
  inputPadding: string;
  
  /**
   * Border color
   */
  borderColor: string;
  
  /**
   * Section background color
   */
  sectionBackground: string;
}

/**
 * Theme plugin for styling form components
 */
export class ThemePlugin extends BaseSchemaGeneratorPlugin {
  /**
   * Plugin metadata
   */
  readonly metadata: PluginMetadata = {
    id: 'core.theme-plugin',
    name: 'Theme Plugin',
    description: 'Provides styling for form components',
    version: '1.0.0',
    author: 'PersLM',
    tags: ['theme', 'ui', 'style'],
  };
  
  /**
   * Theme options
   */
  private themeOptions: ThemeOptions;
  
  /**
   * Constructor
   * @param options Theme options
   */
  constructor(options?: Partial<ThemeOptions>) {
    super();
    
    // Default theme options
    const defaultOptions: ThemeOptions = {
      primaryColor: '#4a90e2',
      secondaryColor: '#6c757d',
      backgroundColor: '#ffffff',
      textColor: '#333333',
      errorColor: '#dc3545',
      borderRadius: '4px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
      fontSize: '16px',
      inputPadding: '8px 12px',
      borderColor: '#ced4da',
      sectionBackground: '#f8f9fa',
    };
    
    // Merge options
    this.themeOptions = {
      ...defaultOptions,
      ...options,
    };
  }
  
  /**
   * Post-process component with theme styling
   */
  postprocessComponent(
    component: ReactNode,
    field: SchemaField,
    context: ComponentGenerationContext
  ): ReactNode {
    if (!React.isValidElement(component)) {
      return component;
    }
    
    const { type } = field;
    const isRoot = context.path.length === 0;
    
    // Apply specific styles based on component type
    switch (type) {
      case 'object':
        return this.styleObjectComponent(component, field, isRoot);
        
      case 'array':
        return this.styleArrayComponent(component, field);
        
      default:
        return this.styleFieldComponent(component, field);
    }
  }
  
  /**
   * Style a field component
   */
  private styleFieldComponent(component: React.ReactElement, field: SchemaField): ReactNode {
    const { themeOptions } = this;
    
    // Apply styles to field container
    const containerStyle = {
      marginBottom: '16px',
    };
    
    // Apply styles to label
    const labelStyle = {
      display: 'block',
      marginBottom: '6px',
      fontWeight: 'bold',
      fontSize: '14px',
      color: themeOptions.textColor,
      fontFamily: themeOptions.fontFamily,
    };
    
    // Apply styles to input
    const inputStyle = {
      display: 'block',
      width: '100%',
      padding: themeOptions.inputPadding,
      fontSize: themeOptions.fontSize,
      fontFamily: themeOptions.fontFamily,
      color: themeOptions.textColor,
      backgroundColor: themeOptions.backgroundColor,
      backgroundClip: 'padding-box',
      border: `1px solid ${themeOptions.borderColor}`,
      borderRadius: themeOptions.borderRadius,
      transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
    };
    
    // Apply styles to error message
    const errorStyle = {
      marginTop: '4px',
      fontSize: '14px',
      color: themeOptions.errorColor,
      fontFamily: themeOptions.fontFamily,
    };
    
    return React.cloneElement(component, {
      style: {
        ...containerStyle,
        ...component.props.style,
      },
      children: React.Children.map(component.props.children, child => {
        if (!React.isValidElement(child)) {
          return child;
        }
        
        if (child.type === 'label') {
          return React.cloneElement(child, {
            style: {
              ...labelStyle,
              ...child.props.style,
            },
          });
        }
        
        if (child.type === 'input' || child.type === 'select' || child.type === 'textarea') {
          return React.cloneElement(child, {
            style: {
              ...inputStyle,
              ...child.props.style,
            },
          });
        }
        
        if (child.props.className === 'error-message') {
          return React.cloneElement(child, {
            style: {
              ...errorStyle,
              ...child.props.style,
            },
          });
        }
        
        return child;
      }),
    });
  }
  
  /**
   * Style an object component
   */
  private styleObjectComponent(
    component: React.ReactElement, 
    field: SchemaField,
    isRoot: boolean
  ): ReactNode {
    const { themeOptions } = this;
    
    // If this is the root, apply general form styles
    if (isRoot) {
      const formStyle = {
        fontFamily: themeOptions.fontFamily,
        color: themeOptions.textColor,
        padding: '20px',
        backgroundColor: themeOptions.backgroundColor,
        borderRadius: themeOptions.borderRadius,
        maxWidth: '800px',
        margin: '0 auto',
      };
      
      const titleStyle = {
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '20px',
        color: themeOptions.primaryColor,
        fontFamily: themeOptions.fontFamily,
      };
      
      const buttonStyle = {
        padding: '10px 16px',
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#fff',
        backgroundColor: themeOptions.primaryColor,
        border: 'none',
        borderRadius: themeOptions.borderRadius,
        cursor: 'pointer',
        marginRight: '10px',
      };
      
      const cancelButtonStyle = {
        padding: '10px 16px',
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#fff',
        backgroundColor: themeOptions.secondaryColor,
        border: 'none',
        borderRadius: themeOptions.borderRadius,
        cursor: 'pointer',
      };
      
      return React.cloneElement(component, {
        style: {
          ...formStyle,
          ...component.props.style,
        },
        children: React.Children.map(component.props.children, child => {
          if (!React.isValidElement(child)) {
            return child;
          }
          
          if (child.props.className === 'schema-form-title') {
            return React.cloneElement(child, {
              style: {
                ...titleStyle,
                ...child.props.style,
              },
            });
          }
          
          if (child.props.className === 'schema-form-actions') {
            return React.cloneElement(child, {
              style: {
                marginTop: '20px',
                ...child.props.style,
              },
              children: React.Children.map(child.props.children, actionChild => {
                if (!React.isValidElement(actionChild)) {
                  return actionChild;
                }
                
                if (actionChild.props.className === 'submit-button') {
                  return React.cloneElement(actionChild, {
                    style: {
                      ...buttonStyle,
                      ...actionChild.props.style,
                    },
                  });
                }
                
                if (actionChild.props.className === 'cancel-button') {
                  return React.cloneElement(actionChild, {
                    style: {
                      ...cancelButtonStyle,
                      ...actionChild.props.style,
                    },
                  });
                }
                
                return actionChild;
              }),
            });
          }
          
          return child;
        }),
      });
    }
    
    // For nested objects, apply section styles
    const objectStyle = {
      padding: '16px',
      marginBottom: '16px',
      backgroundColor: themeOptions.sectionBackground,
      borderRadius: themeOptions.borderRadius,
      border: `1px solid ${themeOptions.borderColor}`,
    };
    
    const titleStyle = {
      fontSize: '18px',
      fontWeight: 'bold',
      marginBottom: '12px',
      color: themeOptions.textColor,
      fontFamily: themeOptions.fontFamily,
    };
    
    return React.cloneElement(component, {
      style: {
        ...objectStyle,
        ...component.props.style,
      },
      children: React.Children.map(component.props.children, child => {
        if (!React.isValidElement(child)) {
          return child;
        }
        
        if (child.props.className === 'object-title') {
          return React.cloneElement(child, {
            style: {
              ...titleStyle,
              ...child.props.style,
            },
          });
        }
        
        return child;
      }),
    });
  }
  
  /**
   * Style an array component
   */
  private styleArrayComponent(component: React.ReactElement, field: SchemaField): ReactNode {
    const { themeOptions } = this;
    
    const arrayStyle = {
      marginBottom: '16px',
    };
    
    const titleStyle = {
      fontSize: '18px',
      fontWeight: 'bold',
      marginBottom: '12px',
      color: themeOptions.textColor,
      fontFamily: themeOptions.fontFamily,
    };
    
    const itemStyle = {
      display: 'flex',
      marginBottom: '8px',
      padding: '12px',
      backgroundColor: themeOptions.sectionBackground,
      borderRadius: themeOptions.borderRadius,
      border: `1px solid ${themeOptions.borderColor}`,
    };
    
    const itemContentStyle = {
      flex: 1,
    };
    
    const removeButtonStyle = {
      padding: '4px 8px',
      fontSize: '14px',
      color: '#fff',
      backgroundColor: themeOptions.errorColor,
      border: 'none',
      borderRadius: themeOptions.borderRadius,
      cursor: 'pointer',
      marginLeft: '8px',
      alignSelf: 'flex-start',
    };
    
    const addButtonStyle = {
      padding: '8px 12px',
      fontSize: '14px',
      color: '#fff',
      backgroundColor: themeOptions.primaryColor,
      border: 'none',
      borderRadius: themeOptions.borderRadius,
      cursor: 'pointer',
      marginTop: '8px',
    };
    
    return React.cloneElement(component, {
      style: {
        ...arrayStyle,
        ...component.props.style,
      },
      children: React.Children.map(component.props.children, child => {
        if (!React.isValidElement(child)) {
          return child;
        }
        
        if (child.props.className === 'array-title') {
          return React.cloneElement(child, {
            style: {
              ...titleStyle,
              ...child.props.style,
            },
          });
        }
        
        if (child.props.className === 'array-item') {
          return React.cloneElement(child, {
            style: {
              ...itemStyle,
              ...child.props.style,
            },
            children: React.Children.map(child.props.children, itemChild => {
              if (!React.isValidElement(itemChild)) {
                return itemChild;
              }
              
              if (itemChild.props.className === 'array-item-content') {
                return React.cloneElement(itemChild, {
                  style: {
                    ...itemContentStyle,
                    ...itemChild.props.style,
                  },
                });
              }
              
              if (itemChild.props.className === 'remove-item-button') {
                return React.cloneElement(itemChild, {
                  style: {
                    ...removeButtonStyle,
                    ...itemChild.props.style,
                  },
                });
              }
              
              return itemChild;
            }),
          });
        }
        
        if (child.props.className === 'add-item-button') {
          return React.cloneElement(child, {
            style: {
              ...addButtonStyle,
              ...child.props.style,
            },
          });
        }
        
        return child;
      }),
    });
  }
  
  /**
   * Get component generators
   */
  getComponentGenerators(): ComponentGeneratorRegistration[] {
    return []; // This plugin only provides styling, not generators
  }
} 