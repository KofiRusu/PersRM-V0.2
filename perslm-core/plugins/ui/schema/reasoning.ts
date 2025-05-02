import { UIModel, UILayout, UIControl, UIControlType, UILayoutType } from './parser';

/**
 * Reasoning module context
 */
export interface ReasoningContext {
  schema: string | Record<string, any>;
  uiModel: UIModel;
  modelId: string;
  modelName: string;
  metadata: Record<string, any>;
}

/**
 * Reasoning module interface
 */
export interface ReasoningModule {
  name: string;
  description: string;
  process: (context: ReasoningContext) => any;
}

/**
 * Reasoning module for layout optimization
 */
export class LayoutReasoningModule implements ReasoningModule {
  name = 'layout';
  description = 'Optimizes the layout of UI components based on field relationships and semantics';

  process(context: ReasoningContext): any {
    const { uiModel } = context;
    const layout = uiModel.layout;

    // Apply layout optimizations
    if (layout.type === UILayoutType.FORM) {
      return this.optimizeFormLayout(layout);
    } else if (layout.type === UILayoutType.TABLE) {
      return this.optimizeTableLayout(layout);
    } else {
      return this.optimizeGenericLayout(layout);
    }
  }

  /**
   * Optimize form layout
   */
  private optimizeFormLayout(layout: UILayout): any {
    // Group related fields together
    const controls = layout.elements;
    const groups = this.groupRelatedFields(controls);

    // Create a responsive grid layout if needed
    // For forms, we'll use a 12-column grid system
    layout.columns = 12;
    layout.gap = '1rem';

    // Apply column spans based on field types
    this.applyColumnSpans(controls);

    return {
      groups,
      columnCount: layout.columns,
      gap: layout.gap,
    };
  }

  /**
   * Optimize table layout
   */
  private optimizeTableLayout(layout: UILayout): any {
    // For tables, focus on column ordering and visibility
    if (layout.elements.length > 0 && layout.elements[0].children) {
      const columns = layout.elements[0].children;

      // Prioritize important columns
      this.prioritizeColumns(columns);

      return {
        columnCount: columns.length,
        prioritizedColumns: columns.map(col => col.name),
      };
    }

    return {};
  }

  /**
   * Optimize generic layout
   */
  private optimizeGenericLayout(layout: UILayout): any {
    // For generic layouts, apply basic responsive principles
    layout.columns = 12;
    layout.gap = '1rem';

    // Apply column spans based on content
    this.applyColumnSpans(layout.elements);

    return {
      columnCount: layout.columns,
      gap: layout.gap,
    };
  }

  /**
   * Group related fields together based on naming conventions and semantics
   */
  private groupRelatedFields(controls: UIControl[]): { name: string; controls: UIControl[] }[] {
    const groups: Record<string, UIControl[]> = {};

    // Group by prefix (e.g., "user_name" and "user_email" -> "user")
    for (const control of controls) {
      // Skip container controls
      if (this.isContainerControl(control)) {
        continue;
      }

      const nameParts = control.name.split(/[._-]/);
      if (nameParts.length > 1) {
        const prefix = nameParts[0];
        if (!groups[prefix]) {
          groups[prefix] = [];
        }
        groups[prefix].push(control);
      } else {
        // For fields without a clear prefix, use "general"
        if (!groups.general) {
          groups.general = [];
        }
        groups.general.push(control);
      }
    }

    // Convert groups object to array
    return Object.entries(groups).map(([name, controls]) => ({
      name,
      controls,
    }));
  }

  /**
   * Apply column spans based on field types
   */
  private applyColumnSpans(controls: UIControl[]): void {
    for (const control of controls) {
      // Skip container controls that manage their own layout
      if (this.isContainerControl(control)) {
        continue;
      }

      // Apply column spans based on control type
      switch (control.type) {
        case UIControlType.TEXT_INPUT:
        case UIControlType.EMAIL_INPUT:
        case UIControlType.PASSWORD_INPUT:
        case UIControlType.URL_INPUT:
        case UIControlType.NUMBER_INPUT:
        case UIControlType.SELECT:
          // Standard inputs take 6 columns (half width) on larger screens
          control.metadata = {
            ...control.metadata,
            columnSpan: 6,
          };
          break;

        case UIControlType.TEXTAREA:
        case UIControlType.RICH_TEXT:
          // Multi-line inputs take full width
          control.metadata = {
            ...control.metadata,
            columnSpan: 12,
          };
          break;

        case UIControlType.CHECKBOX:
        case UIControlType.SWITCH:
          // Checkboxes take 4 columns (1/3 width)
          control.metadata = {
            ...control.metadata,
            columnSpan: 4,
          };
          break;

        case UIControlType.DATE_PICKER:
        case UIControlType.TIME_PICKER:
        case UIControlType.DATETIME_PICKER:
          // Date/time controls take 6 columns (half width)
          control.metadata = {
            ...control.metadata,
            columnSpan: 6,
          };
          break;

        case UIControlType.FILE_UPLOAD:
        case UIControlType.IMAGE_UPLOAD:
          // Upload controls take full width
          control.metadata = {
            ...control.metadata,
            columnSpan: 12,
          };
          break;

        case UIControlType.RADIO_GROUP:
        case UIControlType.CHECKBOX_GROUP:
          // Option groups take full width
          control.metadata = {
            ...control.metadata,
            columnSpan: 12,
          };
          break;

        default:
          // Default to full width
          control.metadata = {
            ...control.metadata,
            columnSpan: 12,
          };
      }

      // Handle special cases based on field name patterns
      if (
        control.name.includes('description') ||
        control.name.includes('notes') ||
        control.name.includes('comment')
      ) {
        // Description/notes fields always take full width
        control.metadata = {
          ...control.metadata,
          columnSpan: 12,
        };
      }
    }
  }

  /**
   * Prioritize columns for table layouts
   */
  private prioritizeColumns(columns: UIControl[]): void {
    // Move primary identifier columns to the beginning
    const idColumnIndex = columns.findIndex(col =>
      ['id', '_id', 'key', 'uuid', 'identifier'].includes(col.name.toLowerCase())
    );

    if (idColumnIndex > 0) {
      const idColumn = columns.splice(idColumnIndex, 1)[0];
      columns.unshift(idColumn);
    }

    // Move name/title columns to the beginning (after ID)
    const nameColumnIndex = columns.findIndex(col =>
      ['name', 'title', 'label'].includes(col.name.toLowerCase())
    );

    if (nameColumnIndex > 0) {
      const nameColumn = columns.splice(nameColumnIndex, 1)[0];
      columns.splice(idColumnIndex > 0 ? 1 : 0, 0, nameColumn);
    }

    // Move timestamps to the end
    const timestampColumns = columns.filter(col =>
      ['created_at', 'updated_at', 'created', 'modified', 'date'].some(term =>
        col.name.toLowerCase().includes(term)
      )
    );

    if (timestampColumns.length > 0) {
      // Remove timestamp columns from their original positions
      for (const col of timestampColumns) {
        const index = columns.indexOf(col);
        if (index !== -1) {
          columns.splice(index, 1);
        }
      }

      // Add timestamp columns to the end
      columns.push(...timestampColumns);
    }

    // Mark columns with appropriate metadata
    columns.forEach((column, index) => {
      column.metadata = {
        ...column.metadata,
        priority: index,
        isTimestamp: timestampColumns.includes(column),
        isPrimary: index === 0 || index === 1,
      };
    });
  }

  /**
   * Check if a control is a container control (has its own layout)
   */
  private isContainerControl(control: UIControl): boolean {
    return [
      UIControlType.FORM,
      UIControlType.TABLE,
      UIControlType.CARD,
      UIControlType.LIST,
      UIControlType.TABS,
      UIControlType.MODAL,
    ].includes(control.type);
  }
}

/**
 * Reasoning module for accessibility enhancements
 */
export class AccessibilityReasoningModule implements ReasoningModule {
  name = 'accessibility';
  description = 'Enhances UI components with accessibility features';

  process(context: ReasoningContext): any {
    const { uiModel } = context;
    const layout = uiModel.layout;

    // Process all controls recursively
    this.processControls(layout.elements);

    return {
      applied: true,
      enhancedControls: layout.elements.length,
    };
  }

  /**
   * Process controls recursively to add accessibility enhancements
   */
  private processControls(controls: UIControl[]): void {
    for (const control of controls) {
      // Add ARIA attributes based on control type
      this.addAriaAttributes(control);

      // Improve label text for better accessibility
      this.improveLabelText(control);

      // Process children recursively
      if (control.children && control.children.length > 0) {
        this.processControls(control.children);
      }
    }
  }

  /**
   * Add ARIA attributes to a control
   */
  private addAriaAttributes(control: UIControl): void {
    if (!control.metadata) {
      control.metadata = {};
    }

    if (!control.metadata.aria) {
      control.metadata.aria = {};
    }

    // Add basic ARIA attributes based on control type
    switch (control.type) {
      case UIControlType.TEXT_INPUT:
      case UIControlType.EMAIL_INPUT:
      case UIControlType.PASSWORD_INPUT:
      case UIControlType.URL_INPUT:
      case UIControlType.NUMBER_INPUT:
      case UIControlType.TEXTAREA:
        control.metadata.aria = {
          ...control.metadata.aria,
          'aria-labelledby': `${control.id}-label`,
          'aria-describedby': control.description ? `${control.id}-description` : undefined,
          'aria-required': control.validation?.required ? 'true' : undefined,
        };
        break;

      case UIControlType.CHECKBOX:
      case UIControlType.SWITCH:
        control.metadata.aria = {
          ...control.metadata.aria,
          'aria-labelledby': `${control.id}-label`,
          'aria-describedby': control.description ? `${control.id}-description` : undefined,
          'role': control.type === UIControlType.SWITCH ? 'switch' : undefined,
        };
        break;

      case UIControlType.SELECT:
        control.metadata.aria = {
          ...control.metadata.aria,
          'aria-labelledby': `${control.id}-label`,
          'aria-describedby': control.description ? `${control.id}-description` : undefined,
          'aria-required': control.validation?.required ? 'true' : undefined,
        };
        break;

      case UIControlType.RADIO_GROUP:
        control.metadata.aria = {
          ...control.metadata.aria,
          'role': 'radiogroup',
          'aria-labelledby': `${control.id}-label`,
          'aria-describedby': control.description ? `${control.id}-description` : undefined,
          'aria-required': control.validation?.required ? 'true' : undefined,
        };
        break;

      case UIControlType.TABLE:
        control.metadata.aria = {
          ...control.metadata.aria,
          'role': 'table',
          'aria-labelledby': control.label ? `${control.id}-label` : undefined,
        };
        break;
    }

    // Add hint for error message element IDs
    control.metadata.errorMessageId = `${control.id}-error`;
  }

  /**
   * Improve label text for better accessibility
   */
  private improveLabelText(control: UIControl): void {
    // Don't modify labels for container controls
    if (
      control.type === UIControlType.FORM ||
      control.type === UIControlType.TABLE ||
      control.type === UIControlType.CARD ||
      control.type === UIControlType.LIST ||
      control.type === UIControlType.TABS ||
      control.type === UIControlType.MODAL
    ) {
      return;
    }

    // Add indication for required fields if not already present
    if (
      control.validation?.required &&
      !control.label.includes('*') &&
      !control.label.includes('required')
    ) {
      control.label = `${control.label} *`;
    }

    // Add context to ambiguous labels
    if (control.label.length < 3 || /^[a-z]$/i.test(control.label)) {
      control.label = this.elaborateLabel(control.name);
    }
  }

  /**
   * Create more descriptive label from field name
   */
  private elaborateLabel(name: string): string {
    // Convert camelCase, snake_case or kebab-case to sentence case
    const normalized = name
      .replace(/([A-Z])/g, ' $1') // camelCase to spaces
      .replace(/[_-]/g, ' ') // snake_case or kebab-case to spaces
      .trim();

    // Capitalize first letter
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }
}

/**
 * Reasoning module for theme consistency
 */
export class ThemeReasoningModule implements ReasoningModule {
  name = 'theme';
  description = 'Applies consistent theming to UI components';

  process(context: ReasoningContext): any {
    const { uiModel } = context;
    const layout = uiModel.layout;

    // Add theme-specific metadata to the layout
    layout.metadata = {
      ...layout.metadata,
      theme: {
        backgroundColor: 'white',
        borderRadius: '0.375rem', // '6px'
        spacing: '1rem', // '16px'
        fontFamily: 'sans-serif',
        primaryColor: 'indigo',
        textColor: 'gray-700',
        borderColor: 'gray-300',
      },
    };

    // Process all controls recursively
    this.processControls(layout.elements, layout.metadata.theme);

    return {
      applied: true,
      theme: layout.metadata.theme,
    };
  }

  /**
   * Process controls recursively to add theme metadata
   */
  private processControls(controls: UIControl[], theme: any): void {
    for (const control of controls) {
      // Add theme metadata to control
      control.metadata = {
        ...control.metadata,
        theme: {
          // Inherit from parent theme
          ...theme,
          // Add control-specific theme properties
          ...this.getControlTheme(control),
        },
      };

      // Process children recursively
      if (control.children && control.children.length > 0) {
        this.processControls(control.children, theme);
      }
    }
  }

  /**
   * Get theme properties specific to a control type
   */
  private getControlTheme(control: UIControl): any {
    switch (control.type) {
      case UIControlType.TEXT_INPUT:
      case UIControlType.EMAIL_INPUT:
      case UIControlType.PASSWORD_INPUT:
      case UIControlType.URL_INPUT:
      case UIControlType.NUMBER_INPUT:
      case UIControlType.TEXTAREA:
        return {
          height: '2.5rem', // '40px'
          paddingX: '0.75rem', // '12px'
          focusRingColor: 'indigo-500',
        };

      case UIControlType.CHECKBOX:
      case UIControlType.SWITCH:
        return {
          accentColor: 'indigo-600',
          size: '1rem', // '16px'
        };

      case UIControlType.SELECT:
        return {
          height: '2.5rem', // '40px'
          paddingX: '0.75rem', // '12px'
          chevronColor: 'gray-400',
        };

      case UIControlType.RADIO_GROUP:
      case UIControlType.CHECKBOX_GROUP:
        return {
          accentColor: 'indigo-600',
          spacing: '0.5rem', // '8px'
        };

      case UIControlType.BUTTON:
        return {
          height: '2.5rem', // '40px'
          paddingX: '1rem', // '16px'
          backgroundColor: 'indigo-600',
          hoverBackgroundColor: 'indigo-700',
          textColor: 'white',
          fontWeight: 'medium',
        };

      case UIControlType.TABLE:
        return {
          headerBackgroundColor: 'gray-50',
          borderColor: 'gray-200',
          rowHoverColor: 'gray-50',
        };

      case UIControlType.CARD:
        return {
          padding: '1.5rem', // '24px'
          shadowSize: 'sm',
        };

      default:
        return {};
    }
  }
}

/**
 * Reasoning module for state management
 */
export class StateReasoningModule implements ReasoningModule {
  name = 'state';
  description = 'Adds state management recommendations for UI components';

  process(context: ReasoningContext): any {
    const { uiModel } = context;
    const layout = uiModel.layout;

    // Analyze state needs based on layout type
    if (layout.type === UILayoutType.FORM) {
      return this.analyzeFormState(uiModel);
    } else if (layout.type === UILayoutType.TABLE) {
      return this.analyzeTableState(uiModel);
    } else {
      return this.analyzeGenericState(uiModel);
    }
  }

  /**
   * Analyze state needs for form layouts
   */
  private analyzeFormState(uiModel: UIModel): any {
    const formControls = this.getAllInputControls(uiModel.layout.elements);
    
    // Create state fields for all form controls
    const stateFields = formControls.map(control => {
      return {
        name: control.name,
        type: this.getStateType(control),
        defaultValue: this.getDefaultValue(control),
        validation: control.validation,
      };
    });

    // Add form state recommendations
    return {
      stateType: 'form',
      stateFields,
      recommendations: [
        {
          name: 'formState',
          hook: 'useState',
          initialValue: '{}',
        },
        {
          name: 'validation',
          hook: 'useForm',
          options: 'zod',
        },
        {
          name: 'submission',
          hook: 'useCallback',
          asyncHandler: true,
        },
      ],
    };
  }

  /**
   * Analyze state needs for table layouts
   */
  private analyzeTableState(uiModel: UIModel): any {
    return {
      stateType: 'table',
      recommendations: [
        {
          name: 'tableData',
          hook: 'useState',
          initialValue: '[]',
        },
        {
          name: 'pagination',
          hook: 'useState',
          initialValue: '{ page: 1, pageSize: 10 }',
        },
        {
          name: 'sorting',
          hook: 'useState',
          initialValue: '{ column: null, direction: "asc" }',
        },
        {
          name: 'loading',
          hook: 'useState',
          initialValue: 'false',
        },
        {
          name: 'fetchData',
          hook: 'useCallback',
          asyncHandler: true,
          dependencies: ['pagination', 'sorting'],
        },
      ],
    };
  }

  /**
   * Analyze state needs for generic layouts
   */
  private analyzeGenericState(uiModel: UIModel): any {
    const inputControls = this.getAllInputControls(uiModel.layout.elements);
    
    // If we have input controls, treat it like a form
    if (inputControls.length > 0) {
      return this.analyzeFormState(uiModel);
    }
    
    // Otherwise, minimal state
    return {
      stateType: 'display',
      recommendations: [
        {
          name: 'data',
          hook: 'useState',
          initialValue: 'null',
        },
        {
          name: 'loading',
          hook: 'useState',
          initialValue: 'false',
        },
      ],
    };
  }

  /**
   * Get all input controls recursively
   */
  private getAllInputControls(controls: UIControl[]): UIControl[] {
    const inputControls: UIControl[] = [];
    
    for (const control of controls) {
      if (this.isInputControl(control)) {
        inputControls.push(control);
      }
      
      if (control.children && control.children.length > 0) {
        inputControls.push(...this.getAllInputControls(control.children));
      }
    }
    
    return inputControls;
  }

  /**
   * Check if a control is an input control
   */
  private isInputControl(control: UIControl): boolean {
    return [
      UIControlType.TEXT_INPUT,
      UIControlType.EMAIL_INPUT,
      UIControlType.PASSWORD_INPUT,
      UIControlType.URL_INPUT,
      UIControlType.NUMBER_INPUT,
      UIControlType.TEXTAREA,
      UIControlType.CHECKBOX,
      UIControlType.SWITCH,
      UIControlType.SELECT,
      UIControlType.MULTISELECT,
      UIControlType.RADIO_GROUP,
      UIControlType.CHECKBOX_GROUP,
      UIControlType.DATE_PICKER,
      UIControlType.TIME_PICKER,
      UIControlType.DATETIME_PICKER,
      UIControlType.FILE_UPLOAD,
      UIControlType.IMAGE_UPLOAD,
      UIControlType.SLIDER,
      UIControlType.COLOR_PICKER,
      UIControlType.RICH_TEXT,
    ].includes(control.type);
  }

  /**
   * Get state type for a control
   */
  private getStateType(control: UIControl): string {
    switch (control.type) {
      case UIControlType.TEXT_INPUT:
      case UIControlType.EMAIL_INPUT:
      case UIControlType.PASSWORD_INPUT:
      case UIControlType.URL_INPUT:
      case UIControlType.TEXTAREA:
      case UIControlType.RICH_TEXT:
        return 'string';
      
      case UIControlType.NUMBER_INPUT:
        return 'number';
      
      case UIControlType.CHECKBOX:
      case UIControlType.SWITCH:
        return 'boolean';
      
      case UIControlType.SELECT:
      case UIControlType.RADIO_GROUP:
        return 'string';
      
      case UIControlType.MULTISELECT:
      case UIControlType.CHECKBOX_GROUP:
        return 'string[]';
      
      case UIControlType.DATE_PICKER:
      case UIControlType.TIME_PICKER:
      case UIControlType.DATETIME_PICKER:
        return 'Date';
      
      case UIControlType.FILE_UPLOAD:
      case UIControlType.IMAGE_UPLOAD:
        return 'File | null';
      
      default:
        return 'any';
    }
  }

  /**
   * Get default value for a control
   */
  private getDefaultValue(control: UIControl): string {
    if (control.defaultValue !== undefined) {
      return JSON.stringify(control.defaultValue);
    }
    
    switch (control.type) {
      case UIControlType.TEXT_INPUT:
      case UIControlType.EMAIL_INPUT:
      case UIControlType.PASSWORD_INPUT:
      case UIControlType.URL_INPUT:
      case UIControlType.TEXTAREA:
      case UIControlType.RICH_TEXT:
      case UIControlType.SELECT:
      case UIControlType.RADIO_GROUP:
        return '""';
      
      case UIControlType.NUMBER_INPUT:
        return '0';
      
      case UIControlType.CHECKBOX:
      case UIControlType.SWITCH:
        return 'false';
      
      case UIControlType.MULTISELECT:
      case UIControlType.CHECKBOX_GROUP:
        return '[]';
      
      case UIControlType.DATE_PICKER:
      case UIControlType.TIME_PICKER:
      case UIControlType.DATETIME_PICKER:
        return 'null';
      
      case UIControlType.FILE_UPLOAD:
      case UIControlType.IMAGE_UPLOAD:
        return 'null';
      
      default:
        return 'null';
    }
  }
}

/**
 * Reasoning module for flow analysis
 */
export class FlowReasoningModule implements ReasoningModule {
  name = 'flow';
  description = 'Analyzes and optimizes user flows in UI components';

  process(context: ReasoningContext): any {
    const { uiModel } = context;
    const layout = uiModel.layout;

    // Identify flow type based on layout and controls
    const flowType = this.identifyFlowType(layout);
    
    // Apply flow-specific optimizations
    if (flowType === 'form') {
      return this.optimizeFormFlow(layout);
    } else if (flowType === 'table') {
      return this.optimizeTableFlow(layout);
    } else if (flowType === 'wizard') {
      return this.optimizeWizardFlow(layout);
    } else {
      return this.optimizeGenericFlow(layout);
    }
  }

  /**
   * Identify flow type based on layout and controls
   */
  private identifyFlowType(layout: UILayout): string {
    if (layout.type === UILayoutType.FORM) {
      // Check if this is a multi-step form (wizard)
      const stepControls = layout.elements.filter(control => 
        control.type === UIControlType.TABS || 
        (control.name && (
          control.name.includes('step') || 
          control.name.includes('page') || 
          control.name.includes('wizard')
        ))
      );
      
      if (stepControls.length > 0) {
        return 'wizard';
      }
      
      return 'form';
    } else if (layout.type === UILayoutType.TABLE) {
      return 'table';
    } else {
      return 'generic';
    }
  }

  /**
   * Optimize form flow
   */
  private optimizeFormFlow(layout: UILayout): any {
    const controlCount = layout.elements.length;
    const hasManyFields = controlCount > 7;
    
    // Group related fields
    const fieldGroups = this.groupRelatedFields(layout.elements);
    
    // Determine form submission approach
    const submissionType = hasManyFields ? 'progressive' : 'simple';
    
    // Additional recommendations
    const recommendations = [
      {
        id: 'validation',
        description: 'Use client-side validation to provide immediate feedback',
      },
      {
        id: 'submission',
        description: hasManyFields 
          ? 'Show a loading state during submission and provide clear success/error feedback'
          : 'Provide inline validation and clear error messages',
      },
    ];
    
    if (hasManyFields) {
      recommendations.push({
        id: 'sectionBreaks',
        description: 'Consider adding section breaks to group related fields',
      });
    }
    
    return {
      flowType: 'form',
      fieldCount: controlCount,
      groups: fieldGroups.map(g => g.name),
      submissionType,
      recommendations,
    };
  }

  /**
   * Optimize table flow
   */
  private optimizeTableFlow(layout: UILayout): any {
    // Look for potential row actions
    const hasActions = layout.elements.some(control => 
      control.name && (
        control.name.includes('action') || 
        control.name.includes('edit') || 
        control.name.includes('delete') || 
        control.name.includes('view')
      )
    );
    
    // Look for table control
    const tableControl = layout.elements.find(control => control.type === UIControlType.TABLE);
    const columnCount = tableControl?.children?.length || 0;
    
    // Recommendations
    const recommendations = [
      {
        id: 'pagination',
        description: 'Add pagination controls for tables with many rows',
      },
      {
        id: 'sorting',
        description: 'Enable column sorting for better data exploration',
      },
      {
        id: 'loading',
        description: 'Show loading state when fetching or refreshing data',
      },
    ];
    
    if (hasActions) {
      recommendations.push({
        id: 'rowActions',
        description: 'Implement row actions as dropdown menu for compact display',
      });
    }
    
    if (columnCount > 5) {
      recommendations.push({
        id: 'responsiveColumns',
        description: 'Hide less important columns on smaller screens',
      });
    }
    
    return {
      flowType: 'table',
      columnCount,
      hasActions,
      recommendations,
    };
  }

  /**
   * Optimize wizard flow
   */
  private optimizeWizardFlow(layout: UILayout): any {
    // Identify potential steps
    const steps = this.identifyWizardSteps(layout);
    
    // Recommendations
    const recommendations = [
      {
        id: 'progressIndicator',
        description: 'Add a progress indicator showing all steps and current position',
      },
      {
        id: 'navigation',
        description: 'Use Next/Previous buttons for navigation between steps',
      },
      {
        id: 'validation',
        description: 'Validate each step before allowing progression to the next',
      },
      {
        id: 'persistence',
        description: 'Save progress as the user advances through steps',
      },
    ];
    
    return {
      flowType: 'wizard',
      stepCount: steps.length,
      steps,
      recommendations,
    };
  }

  /**
   * Optimize generic flow
   */
  private optimizeGenericFlow(layout: UILayout): any {
    // Identify content types
    const contentTypes = this.identifyContentTypes(layout.elements);
    
    // Recommendations based on content
    const recommendations = [];
    
    if (contentTypes.includes('data')) {
      recommendations.push({
        id: 'loading',
        description: 'Show loading state when fetching data',
      });
    }
    
    if (contentTypes.includes('interactive')) {
      recommendations.push({
        id: 'feedback',
        description: 'Provide immediate feedback for user interactions',
      });
    }
    
    return {
      flowType: 'generic',
      contentTypes,
      recommendations,
    };
  }

  /**
   * Group related fields by name prefix or semantic meaning
   */
  private groupRelatedFields(controls: UIControl[]): { name: string; controls: UIControl[] }[] {
    const groups: Record<string, UIControl[]> = {};
    
    // Group by prefix (e.g., "user_name" and "user_email" -> "user")
    for (const control of controls) {
      // Skip container controls
      if (this.isContainerControl(control)) {
        continue;
      }
      
      const nameParts = control.name.split(/[._-]/);
      if (nameParts.length > 1) {
        const prefix = nameParts[0];
        if (!groups[prefix]) {
          groups[prefix] = [];
        }
        groups[prefix].push(control);
      } else {
        // For fields without a clear prefix, use "general"
        if (!groups.general) {
          groups.general = [];
        }
        groups.general.push(control);
      }
    }
    
    // Convert groups object to array
    return Object.entries(groups).map(([name, controls]) => ({
      name,
      controls,
    }));
  }

  /**
   * Identify wizard steps from layout
   */
  private identifyWizardSteps(layout: UILayout): { name: string; fields: string[] }[] {
    // Look for tab control first
    const tabControl = layout.elements.find(control => control.type === UIControlType.TABS);
    
    if (tabControl && tabControl.children) {
      // Use tabs as steps
      return tabControl.children.map(tab => ({
        name: tab.label,
        fields: this.getControlFieldNames(tab),
      }));
    }
    
    // Look for controls with step/page in name
    const stepControls = layout.elements.filter(control => 
      control.name && (
        control.name.includes('step') || 
        control.name.includes('page') || 
        control.name.includes('wizard')
      )
    );
    
    if (stepControls.length > 0) {
      return stepControls.map(control => ({
        name: control.label,
        fields: this.getControlFieldNames(control),
      }));
    }
    
    // If no explicit steps found, create logical groupings
    const fieldGroups = this.groupRelatedFields(layout.elements);
    
    return fieldGroups.map((group, index) => ({
      name: `Step ${index + 1}: ${this.capitalizeFirstLetter(group.name)}`,
      fields: group.controls.map(c => c.name),
    }));
  }

  /**
   * Get field names from a control and its children
   */
  private getControlFieldNames(control: UIControl): string[] {
    const fieldNames: string[] = [];
    
    // Add this control if it's an input
    if (this.isInputControl(control)) {
      fieldNames.push(control.name);
    }
    
    // Process children recursively
    if (control.children) {
      for (const child of control.children) {
        fieldNames.push(...this.getControlFieldNames(child));
      }
    }
    
    return fieldNames;
  }

  /**
   * Identify content types in controls
   */
  private identifyContentTypes(controls: UIControl[]): string[] {
    const types = new Set<string>();
    
    for (const control of controls) {
      if (this.isInputControl(control)) {
        types.add('interactive');
      } else if (this.isContainerControl(control)) {
        types.add('container');
        
        // Check children recursively
        if (control.children) {
          const childTypes = this.identifyContentTypes(control.children);
          childTypes.forEach(type => types.add(type));
        }
      } else if (control.type === UIControlType.TABLE) {
        types.add('data');
      }
    }
    
    return Array.from(types);
  }

  /**
   * Check if a control is a container control
   */
  private isContainerControl(control: UIControl): boolean {
    return [
      UIControlType.FORM,
      UIControlType.TABLE,
      UIControlType.CARD,
      UIControlType.LIST,
      UIControlType.TABS,
      UIControlType.MODAL,
    ].includes(control.type);
  }

  /**
   * Check if a control is an input control
   */
  private isInputControl(control: UIControl): boolean {
    return [
      UIControlType.TEXT_INPUT,
      UIControlType.EMAIL_INPUT,
      UIControlType.PASSWORD_INPUT,
      UIControlType.URL_INPUT,
      UIControlType.NUMBER_INPUT,
      UIControlType.TEXTAREA,
      UIControlType.CHECKBOX,
      UIControlType.SWITCH,
      UIControlType.SELECT,
      UIControlType.MULTISELECT,
      UIControlType.RADIO_GROUP,
      UIControlType.CHECKBOX_GROUP,
      UIControlType.DATE_PICKER,
      UIControlType.TIME_PICKER,
      UIControlType.DATETIME_PICKER,
      UIControlType.FILE_UPLOAD,
      UIControlType.IMAGE_UPLOAD,
      UIControlType.SLIDER,
      UIControlType.COLOR_PICKER,
      UIControlType.RICH_TEXT,
    ].includes(control.type);
  }

  /**
   * Capitalize first letter of a string
   */
  private capitalizeFirstLetter(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

/**
 * Create all reasoning modules
 */
export function createReasoningModules(): ReasoningModule[] {
  return [
    new LayoutReasoningModule(),
    new AccessibilityReasoningModule(),
    new ThemeReasoningModule(),
    new StateReasoningModule(),
    new FlowReasoningModule(),
  ];
} 