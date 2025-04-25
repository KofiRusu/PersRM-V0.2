import fs from 'fs-extra';
import path from 'path';
import { UXIssue, PhaseType } from '../persrm/types';

export interface ComponentGeneratorOptions {
  name: string;
  type: 'button' | 'card' | 'form' | 'modal' | 'table' | 'custom';
  outputPath: string;
  designTokensPath?: string;
  enhancementSuggestions?: UXIssue[];
  framework?: 'react' | 'vue' | 'svelte';
  typescript?: boolean;
  accessibility?: boolean;
  includeStyles?: boolean;
  includeTests?: boolean;
  style?: 'css' | 'scss' | 'styled-components' | 'tailwind';
}

interface DesignTokens {
  colors?: Record<string, string>;
  typography?: Record<string, any>;
  spacing?: Record<string, string | number>;
  shadows?: Record<string, string>;
  breakpoints?: Record<string, string | number>;
  borderRadius?: Record<string, string | number>;
  animations?: Record<string, any>;
}

export interface GeneratedComponent {
  name: string;
  type: string;
  files: {
    path: string;
    content: string;
  }[];
}

export class ComponentGenerator {
  private designTokens: DesignTokens = {};
  private defaultOptions: Partial<ComponentGeneratorOptions> = {
    framework: 'react',
    typescript: true,
    accessibility: true,
    includeStyles: true,
    includeTests: true,
    style: 'css'
  };
  
  constructor(private baseOptions: Partial<ComponentGeneratorOptions> = {}) {
    // Load design tokens if provided
    if (baseOptions.designTokensPath) {
      this.loadDesignTokens(baseOptions.designTokensPath);
    }
  }
  
  /**
   * Load design tokens from a JSON file
   */
  private loadDesignTokens(tokensPath: string): void {
    try {
      if (fs.existsSync(tokensPath)) {
        this.designTokens = fs.readJSONSync(tokensPath);
      }
    } catch (error) {
      console.error('Error loading design tokens:', error);
    }
  }
  
  /**
   * Generate a component based on options and enhancement suggestions
   */
  public async generateComponent(options: ComponentGeneratorOptions): Promise<GeneratedComponent> {
    // Merge with default options
    const mergedOptions = { ...this.defaultOptions, ...this.baseOptions, ...options };
    
    // Make sure the component name is properly formatted
    const componentName = this.formatComponentName(mergedOptions.name);
    
    // Determine the appropriate file extension
    const fileExtension = this.getFileExtension(mergedOptions);
    
    // Generate component content
    const componentContent = this.generateComponentContent(componentName, mergedOptions);
    
    // Determine output path
    const componentPath = path.join(
      mergedOptions.outputPath, 
      `${componentName}.${fileExtension}`
    );
    
    // Create directory if it doesn't exist
    fs.ensureDirSync(path.dirname(componentPath));
    
    // Generate related files (styles, tests, etc.)
    const files = [{ path: componentPath, content: componentContent }];
    
    // Add styles if needed
    if (mergedOptions.includeStyles && mergedOptions.style !== 'styled-components') {
      const styleExtension = mergedOptions.style === 'scss' ? 'scss' : 'css';
      const stylePath = path.join(
        mergedOptions.outputPath, 
        `${componentName}.${styleExtension}`
      );
      const styleContent = this.generateStyleContent(componentName, mergedOptions);
      
      files.push({ path: stylePath, content: styleContent });
    }
    
    // Add tests if needed
    if (mergedOptions.includeTests) {
      const testPath = path.join(
        mergedOptions.outputPath, 
        `${componentName}.test.${mergedOptions.typescript ? 'tsx' : 'jsx'}`
      );
      const testContent = this.generateTestContent(componentName, mergedOptions);
      
      files.push({ path: testPath, content: testContent });
    }
    
    // Write files
    for (const file of files) {
      await fs.writeFile(file.path, file.content);
    }
    
    return {
      name: componentName,
      type: mergedOptions.type,
      files
    };
  }
  
  /**
   * Format component name to Pascal case (e.g., "my-button" → "MyButton")
   */
  private formatComponentName(name: string): string {
    return name
      .split(/[-_\s]+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
  
  /**
   * Get appropriate file extension based on options
   */
  private getFileExtension(options: ComponentGeneratorOptions): string {
    if (options.framework === 'react') {
      return options.typescript ? 'tsx' : 'jsx';
    } else if (options.framework === 'vue') {
      return 'vue';
    } else if (options.framework === 'svelte') {
      return 'svelte';
    }
    return options.typescript ? 'tsx' : 'jsx'; // Default to React
  }
  
  /**
   * Generate component content based on type and options
   */
  private generateComponentContent(name: string, options: ComponentGeneratorOptions): string {
    // Apply enhancements based on suggestions
    const enhancements = this.applyEnhancements(options.enhancementSuggestions || []);
    
    // Generate the appropriate component based on the type
    switch (options.type) {
      case 'button':
        return this.generateButtonComponent(name, options, enhancements);
      case 'card':
        return this.generateCardComponent(name, options, enhancements);
      case 'form':
        return this.generateFormComponent(name, options, enhancements);
      case 'modal':
        return this.generateModalComponent(name, options, enhancements);
      case 'table':
        return this.generateTableComponent(name, options, enhancements);
      default:
        return this.generateCustomComponent(name, options, enhancements);
    }
  }
  
  /**
   * Apply enhancements based on UX issues
   */
  private applyEnhancements(issues: UXIssue[]): Record<string, any> {
    const enhancements: Record<string, any> = {
      useMemo: false,
      useCallback: false,
      ariaLabels: false,
      ariaDescribedby: false,
      keyboardNavigation: false,
      loadOptimization: false,
      animationOptimization: false,
      colorContrast: false
    };
    
    // Apply specific enhancements based on issue types
    for (const issue of issues) {
      switch (issue.phase) {
        case PhaseType.LOAD_TIME:
          enhancements.useMemo = true;
          enhancements.useCallback = true;
          enhancements.loadOptimization = true;
          break;
        case PhaseType.RESPONSIVENESS:
          enhancements.useCallback = true;
          break;
        case PhaseType.ACCESSIBILITY:
          enhancements.ariaLabels = true;
          enhancements.ariaDescribedby = true;
          enhancements.keyboardNavigation = true;
          break;
        case PhaseType.ANIMATIONS:
          enhancements.animationOptimization = true;
          break;
        case PhaseType.VISUAL_CONSISTENCY:
          enhancements.colorContrast = true;
          break;
      }
    }
    
    return enhancements;
  }
  
  /**
   * Generate a button component
   */
  private generateButtonComponent(name: string, options: ComponentGeneratorOptions, enhancements: Record<string, any>): string {
    const { typescript, accessibility, style } = options;
    const propsType = typescript ? `
interface ${name}Props {
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  className?: string;${accessibility ? '\n  ariaLabel?: string;' : ''}
}` : '';

    const importLines = [`import React${enhancements.useMemo ? ', { useMemo, useCallback }' : ''} from 'react';`];
    
    if (style !== 'styled-components') {
      importLines.push(`import './${name}.${style === 'scss' ? 'scss' : 'css'}';`);
    } else {
      importLines.push('import styled from \'styled-components\';');
    }
    
    const imports = importLines.join('\n');
    
    // Generate styled-components if needed
    const styledComponents = style === 'styled-components' ? `
const StyledButton = styled.button<{ variant: string; size: string }>\`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
  
  /* Variant styles */
  background-color: \${props => props.variant === 'primary' ? '#0066cc' : 
    props.variant === 'danger' ? '#dc3545' : 'transparent'};
  color: \${props => props.variant === 'primary' || props.variant === 'danger' ? 'white' : '#333'};
  border: 1px solid \${props => props.variant === 'primary' ? '#0066cc' : 
    props.variant === 'danger' ? '#dc3545' : '#ddd'};
    
  /* Size styles */
  padding: \${props => props.size === 'small' ? '6px 12px' : 
    props.size === 'large' ? '12px 24px' : '8px 16px'};
  font-size: \${props => props.size === 'small' ? '14px' : 
    props.size === 'large' ? '18px' : '16px'};
    
  &:hover:not(:disabled) {
    background-color: \${props => props.variant === 'primary' ? '#0055aa' : 
      props.variant === 'danger' ? '#bd2130' : '#f8f9fa'};
  }
  
  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.25);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
\`;
` : '';

    const componentBody = `
const ${name} = (${typescript ? 'props: ' + name + 'Props' : '{ label, onClick, variant = \'primary\', size = \'medium\', disabled = false, className = \'\'' + (accessibility ? ', ariaLabel' : '') + ' }'}) => {
  ${enhancements.useCallback ? `const handleClick = useCallback((event) => {
    ${typescript ? 'props.onClick(event);' : 'onClick(event);'}
  }, [${typescript ? 'props.onClick' : 'onClick'}]);` : ''}

  ${enhancements.useMemo ? `const buttonClasses = useMemo(() => {
    const classes = ['${name.toLowerCase()}'];
    ${typescript ? `if (props.className) {
      classes.push(props.className);
    }
    classes.push(\`${name.toLowerCase()}-\${props.variant}\`);
    classes.push(\`${name.toLowerCase()}-\${props.size}\`);` : 
    `if (className) {
      classes.push(className);
    }
    classes.push(\`${name.toLowerCase()}-\${variant}\`);
    classes.push(\`${name.toLowerCase()}-\${size}\`);`}
    return classes.join(' ');
  }, [${typescript ? 'props.className, props.variant, props.size' : 'className, variant, size'}]);` : ''}

  return (
    ${style === 'styled-components' ? 
      `<StyledButton
      variant={${typescript ? 'props.variant' : 'variant'}}
      size={${typescript ? 'props.size' : 'size'}}
      onClick={${enhancements.useCallback ? 'handleClick' : typescript ? 'props.onClick' : 'onClick'}}
      disabled={${typescript ? 'props.disabled' : 'disabled'}}
      className={${typescript ? 'props.className' : 'className'}}
      ${accessibility ? `aria-label={${typescript ? 'props.ariaLabel || props.label' : 'ariaLabel || label'}}` : ''}
    >
      ${typescript ? 'props.label' : 'label'}
    </StyledButton>` : 
      `<button
      type="button"
      className={${enhancements.useMemo ? 'buttonClasses' : `'${name.toLowerCase()} ${name.toLowerCase()}-' + ${typescript ? 'props.variant' : 'variant'} + ' ${name.toLowerCase()}-' + ${typescript ? 'props.size' : 'size'} + ' ' + ${typescript ? 'props.className' : 'className'}`}}
      onClick={${enhancements.useCallback ? 'handleClick' : typescript ? 'props.onClick' : 'onClick'}}
      disabled={${typescript ? 'props.disabled' : 'disabled'}}
      ${accessibility ? `aria-label={${typescript ? 'props.ariaLabel || props.label' : 'ariaLabel || label'}}` : ''}
    >
      ${typescript ? 'props.label' : 'label'}
    </button>`}
  );
};

export default ${name};`;

    return `${imports}

${propsType}
${styledComponents}${componentBody}
`;
  }
  
  /**
   * Generate a card component
   */
  private generateCardComponent(name: string, options: ComponentGeneratorOptions, enhancements: Record<string, any>): string {
    const { typescript, accessibility } = options;
    
    const propsType = typescript ? `
interface ${name}Props {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  elevated?: boolean;
  ${accessibility ? 'headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;' : ''}
}` : '';

    const imports = `import React${enhancements.useMemo ? ', { useMemo }' : ''} from 'react';
${options.style !== 'styled-components' ? `import './${name}.${options.style === 'scss' ? 'scss' : 'css'}';` : 'import styled from \'styled-components\';'}`;

    const styledComponents = options.style === 'styled-components' ? `
const CardContainer = styled.div<{ elevated: boolean }>\`
  border-radius: 8px;
  border: 1px solid #eaeaea;
  padding: 16px;
  background-color: white;
  box-shadow: \${props => props.elevated ? '0 4px 8px rgba(0, 0, 0, 0.1)' : 'none'};
  transition: box-shadow 0.2s ease-in-out;
  
  &:hover {
    box-shadow: \${props => props.elevated ? '0 8px 16px rgba(0, 0, 0, 0.1)' : '0 2px 4px rgba(0, 0, 0, 0.05)'};
  }
\`;

const CardHeader = styled.div\`
  margin-bottom: 16px;
  border-bottom: 1px solid #eaeaea;
  padding-bottom: 8px;
\`;

const CardFooter = styled.div\`
  margin-top: 16px;
  border-top: 1px solid #eaeaea;
  padding-top: 8px;
\`;

const CardContent = styled.div\`
  padding: 8px 0;
\`;
` : '';

    const componentBody = `
const ${name} = (${typescript ? 'props: ' + name + 'Props' : '{ title, children, footer, className = \'\', onClick, elevated = false' + (accessibility ? ', headingLevel = 2' : '') + ' }'}) => {
  ${enhancements.useMemo && !options.style === 'styled-components' ? `const cardClasses = useMemo(() => {
    const classes = ['${name.toLowerCase()}'];
    ${typescript ? `if (props.className) {
      classes.push(props.className);
    }
    if (props.elevated) {
      classes.push('${name.toLowerCase()}-elevated');
    }` : 
    `if (className) {
      classes.push(className);
    }
    if (elevated) {
      classes.push('${name.toLowerCase()}-elevated');
    }`}
    return classes.join(' ');
  }, [${typescript ? 'props.className, props.elevated' : 'className, elevated'}]);` : ''}

  ${accessibility ? `// Dynamically render the appropriate heading level
  const Heading = ${typescript ? '\`h\${props.headingLevel}\`' : '\`h\${headingLevel}\`'};` : ''}

  return (
    ${options.style === 'styled-components' ? 
      `<CardContainer 
      elevated={${typescript ? 'props.elevated' : 'elevated'}}
      className={${typescript ? 'props.className' : 'className'}}
      onClick={${typescript ? 'props.onClick' : 'onClick'}}
    >
      <CardHeader>
        ${accessibility ? 
          `<${typescript ? '`h${props.headingLevel}`' : '`h${headingLevel}`'}>${typescript ? 'props.title' : 'title'}</${typescript ? '`h${props.headingLevel}`' : '`h${headingLevel}`'}>` : 
          `<h2>${typescript ? 'props.title' : 'title'}</h2>`}
      </CardHeader>
      <CardContent>
        ${typescript ? 'props.children' : 'children'}
      </CardContent>
      {${typescript ? 'props.footer' : 'footer'} && (
        <CardFooter>
          ${typescript ? 'props.footer' : 'footer'}
        </CardFooter>
      )}
    </CardContainer>` : 
      `<div 
      className={${enhancements.useMemo ? 'cardClasses' : `'${name.toLowerCase()}' + (${typescript ? 'props.elevated' : 'elevated'} ? ' ${name.toLowerCase()}-elevated' : '') + ' ' + ${typescript ? 'props.className' : 'className'}`}}
      onClick={${typescript ? 'props.onClick' : 'onClick'}}
    >
      <div className="${name.toLowerCase()}-header">
        ${accessibility ? 
          `<${typescript ? '`h${props.headingLevel}`' : '`h${headingLevel}`'} className="${name.toLowerCase()}-title">${typescript ? 'props.title' : 'title'}</${typescript ? '`h${props.headingLevel}`' : '`h${headingLevel}`'}>` : 
          `<h2 className="${name.toLowerCase()}-title">${typescript ? 'props.title' : 'title'}</h2>`}
      </div>
      <div className="${name.toLowerCase()}-content">
        ${typescript ? 'props.children' : 'children'}
      </div>
      {${typescript ? 'props.footer' : 'footer'} && (
        <div className="${name.toLowerCase()}-footer">
          ${typescript ? 'props.footer' : 'footer'}
        </div>
      )}
    </div>`}
  );
};

export default ${name};`;

    return `${imports}

${propsType}
${styledComponents}${componentBody}
`;
  }
  
  /**
   * Generate style content
   */
  private generateStyleContent(name: string, options: ComponentGeneratorOptions): string {
    const { type, style } = options;
    const lowerName = name.toLowerCase();
    
    // Get color tokens or default values
    const colors = this.designTokens.colors || {
      primary: '#0066cc',
      secondary: '#6c757d',
      danger: '#dc3545',
      success: '#28a745',
      warning: '#ffc107',
      info: '#17a2b8',
      light: '#f8f9fa',
      dark: '#343a40',
      border: '#dee2e6'
    };
    
    // Generate appropriate CSS based on component type
    switch (type) {
      case 'button':
        return `.${lowerName} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.${lowerName}-primary {
  background-color: ${colors.primary};
  color: white;
  border: 1px solid ${colors.primary};
}

.${lowerName}-primary:hover:not(:disabled) {
  background-color: darken(${colors.primary}, 10%);
}

.${lowerName}-secondary {
  background-color: transparent;
  color: ${colors.dark};
  border: 1px solid ${colors.border};
}

.${lowerName}-secondary:hover:not(:disabled) {
  background-color: ${colors.light};
}

.${lowerName}-danger {
  background-color: ${colors.danger};
  color: white;
  border: 1px solid ${colors.danger};
}

.${lowerName}-danger:hover:not(:disabled) {
  background-color: darken(${colors.danger}, 10%);
}

.${lowerName}-small {
  padding: 6px 12px;
  font-size: 14px;
}

.${lowerName}-medium {
  padding: 8px 16px;
  font-size: 16px;
}

.${lowerName}-large {
  padding: 12px 24px;
  font-size: 18px;
}

.${lowerName}:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.25);
}

.${lowerName}:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}`;

      case 'card':
        return `.${lowerName} {
  border-radius: 8px;
  border: 1px solid ${colors.border};
  padding: 16px;
  background-color: white;
  transition: box-shadow 0.2s ease-in-out;
}

.${lowerName}-elevated {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.${lowerName}:hover {
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.${lowerName}-elevated:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.${lowerName}-header {
  margin-bottom: 16px;
  border-bottom: 1px solid ${colors.border};
  padding-bottom: 8px;
}

.${lowerName}-footer {
  margin-top: 16px;
  border-top: 1px solid ${colors.border};
  padding-top: 8px;
}

.${lowerName}-content {
  padding: 8px 0;
}

.${lowerName}-title {
  margin: 0;
  color: ${colors.dark};
  font-size: 1.25rem;
}`;

      default:
        return `.${lowerName} {
  /* Base styles */
}`;
    }
  }
  
  /**
   * Generate test content
   */
  private generateTestContent(name: string, options: ComponentGeneratorOptions): string {
    const { typescript } = options;
    
    const imports = `import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ${name} from './${name}';`;
    
    // Generate appropriate tests based on component type
    switch (options.type) {
      case 'button':
        return `${imports}

describe('${name} Component', () => {
  test('renders correctly with default props', () => {
    const onClickMock = jest.fn();
    render(<${name} label="Click Me" onClick={onClickMock} />);
    
    const button = screen.getByText('Click Me');
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('${name.toLowerCase()}-primary');
    expect(button).toHaveClass('${name.toLowerCase()}-medium');
  });
  
  test('handles click events', () => {
    const onClickMock = jest.fn();
    render(<${name} label="Click Me" onClick={onClickMock} />);
    
    const button = screen.getByText('Click Me');
    fireEvent.click(button);
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });
  
  test('respects disabled state', () => {
    const onClickMock = jest.fn();
    render(<${name} label="Click Me" onClick={onClickMock} disabled />);
    
    const button = screen.getByText('Click Me');
    expect(button).toBeDisabled();
    
    fireEvent.click(button);
    expect(onClickMock).not.toHaveBeenCalled();
  });
  
  test('applies different variants correctly', () => {
    const { rerender } = render(<${name} label="Primary" onClick={() => {}} variant="primary" />);
    expect(screen.getByText('Primary')).toHaveClass('${name.toLowerCase()}-primary');
    
    rerender(<${name} label="Secondary" onClick={() => {}} variant="secondary" />);
    expect(screen.getByText('Secondary')).toHaveClass('${name.toLowerCase()}-secondary');
    
    rerender(<${name} label="Danger" onClick={() => {}} variant="danger" />);
    expect(screen.getByText('Danger')).toHaveClass('${name.toLowerCase()}-danger');
  });
});`;

      case 'card':
        return `${imports}

describe('${name} Component', () => {
  test('renders correctly with required props', () => {
    render(
      <${name} title="Card Title">
        <p>Card content</p>
      </${name}>
    );
    
    expect(screen.getByText('Card Title')).toBeInTheDocument();
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });
  
  test('renders footer when provided', () => {
    render(
      <${name} 
        title="Card Title"
        footer={<button>Action</button>}
      >
        <p>Card content</p>
      </${name}>
    );
    
    expect(screen.getByText('Action')).toBeInTheDocument();
  });
  
  test('applies elevated style when specified', () => {
    render(
      <${name} title="Elevated Card" elevated>
        <p>Card content</p>
      </${name}>
    );
    
    const card = screen.getByText('Elevated Card').closest('.${name.toLowerCase()}');
    expect(card).toHaveClass('${name.toLowerCase()}-elevated');
  });
  
  test('handles click events when provided', () => {
    const onClickMock = jest.fn();
    render(
      <${name} title="Clickable Card" onClick={onClickMock}>
        <p>Card content</p>
      </${name}>
    );
    
    const card = screen.getByText('Clickable Card').closest('.${name.toLowerCase()}');
    fireEvent.click(card);
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });
});`;

      default:
        return `${imports}

describe('${name} Component', () => {
  test('renders correctly', () => {
    render(<${name} />);
    // Add appropriate assertions based on your component
  });
});`;
    }
  }
  
  /**
   * Generate form component - simple implementation for now
   */
  private generateFormComponent(name: string, options: ComponentGeneratorOptions, enhancements: Record<string, any>): string {
    return `import React, { useState } from 'react';
${options.style !== 'styled-components' ? `import './${name}.${options.style === 'scss' ? 'scss' : 'css'}';` : ''}

const ${name} = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    // Add your form submission logic here
  };
  
  return (
    <form className="${name.toLowerCase()}" onSubmit={handleSubmit}>
      <div className="${name.toLowerCase()}-field">
        <label htmlFor="name">Name</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="${name.toLowerCase()}-field">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
        />
      </div>
      
      <div className="${name.toLowerCase()}-field">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          rows={4}
          required
        />
      </div>
      
      <button type="submit" className="${name.toLowerCase()}-submit">
        Submit
      </button>
    </form>
  );
};

export default ${name};`;
  }
  
  /**
   * Generate modal component - simple implementation
   */
  private generateModalComponent(name: string, options: ComponentGeneratorOptions, enhancements: Record<string, any>): string {
    return `import React, { useEffect } from 'react';
${options.style !== 'styled-components' ? `import './${name}.${options.style === 'scss' ? 'scss' : 'css'}';` : ''}

const ${name} = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  footer
}) => {
  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      // Prevent scrolling when modal is open
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  // Close modal when clicking the backdrop
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };
  
  return (
    <div className="${name.toLowerCase()}-backdrop" onClick={handleBackdropClick}>
      <div 
        className="${name.toLowerCase()}-container"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${name.toLowerCase()}-title"
      >
        <div className="${name.toLowerCase()}-header">
          <h2 id="${name.toLowerCase()}-title">{title}</h2>
          <button 
            className="${name.toLowerCase()}-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        
        <div className="${name.toLowerCase()}-content">
          {children}
        </div>
        
        {footer && (
          <div className="${name.toLowerCase()}-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default ${name};`;
  }
  
  /**
   * Generate table component - simple implementation
   */
  private generateTableComponent(name: string, options: ComponentGeneratorOptions, enhancements: Record<string, any>): string {
    return `import React from 'react';
${options.style !== 'styled-components' ? `import './${name}.${options.style === 'scss' ? 'scss' : 'css'}';` : ''}

const ${name} = ({ 
  headers,
  data,
  sortable = false,
  onRowClick,
  striped = true
}) => {
  return (
    <div className="${name.toLowerCase()}-container">
      <table className="${name.toLowerCase()} ${striped ? `${name.toLowerCase()}-striped` : ''}">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th 
                key={index}
                className={sortable ? `${name.toLowerCase()}-sortable` : ''}
              >
                {header.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr 
              key={rowIndex}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? `${name.toLowerCase()}-clickable` : ''}
            >
              {headers.map((header, colIndex) => (
                <td key={colIndex}>
                  {row[header.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ${name};`;
  }
  
  /**
   * Generate custom component - fallback
   */
  private generateCustomComponent(name: string, options: ComponentGeneratorOptions, enhancements: Record<string, any>): string {
    return `import React from 'react';
${options.style !== 'styled-components' ? `import './${name}.${options.style === 'scss' ? 'scss' : 'css'}';` : ''}

const ${name} = ({ children }) => {
  return (
    <div className="${name.toLowerCase()}">
      {children || <p>Custom ${name} Component</p>}
    </div>
  );
};

export default ${name};`;
  }
} 