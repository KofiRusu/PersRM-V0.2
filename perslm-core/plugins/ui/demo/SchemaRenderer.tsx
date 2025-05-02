import React, { useState } from 'react';
import { SchemaSourceType } from '../schema/parser';
import { createSchemaPipeline } from '../schema/pipeline';
import { createReasoningModules } from '../schema/reasoning';

interface SchemaRendererProps {
  schema: string | Record<string, any>;
  modelId: string;
  modelName: string;
  schemaType?: SchemaSourceType;
  enableReasoning?: boolean;
}

/**
 * Demo component for rendering a UI from a schema
 */
export const SchemaRenderer: React.FC<SchemaRendererProps> = ({
  schema,
  modelId,
  modelName,
  schemaType = SchemaSourceType.JSON_SCHEMA,
  enableReasoning = true,
}) => {
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'reasoning'>('preview');
  const [uiComponent, setUiComponent] = useState<React.ComponentType<any> | null>(null);

  // Generate component from schema
  const generateComponent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Create reasoning modules if enabled
      const reasoningModules = enableReasoning ? createReasoningModules() : [];
      
      // Create pipeline
      const pipeline = createSchemaPipeline({
        schemaSourceType: schemaType,
        enableReasoning,
        reasoningModules,
        useTailwind: true,
        useShad: true,
        verbose: true,
      });
      
      // Transform schema to component
      const result = pipeline.transform(schema, modelId, modelName);
      
      // Set generated code
      setGeneratedCode(result.component.code);
      setResult(result);
      
      // Create component dynamically
      try {
        // Use Function constructor as a simple way to evaluate the component code
        // Note: This is not safe for production use with untrusted inputs
        const componentCode = result.component.code;
        
        // Create a module-like environment for the component
        const moduleFactory = new Function('React', 'useState', 'useEffect', 'useCallback', `
          ${componentCode}
          return { default: ${result.component.componentName} };
        `);
        
        // Execute the module factory with dependencies
        const module = moduleFactory(React, useState, React.useEffect, React.useCallback);
        setUiComponent(() => module.default);
      } catch (err) {
        console.error('Failed to create component dynamically:', err);
        setError(`Failed to create component: ${err instanceof Error ? err.message : String(err)}`);
      }
    } catch (err) {
      console.error('Failed to generate component:', err);
      setError(`Failed to generate component: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate component on mount
  React.useEffect(() => {
    generateComponent();
  }, [schema, modelId, modelName, schemaType, enableReasoning]);

  // Render dynamic component
  const renderDynamicComponent = () => {
    if (!uiComponent) {
      return null;
    }
    
    const Component = uiComponent;
    
    try {
      return <Component />;
    } catch (err) {
      console.error('Failed to render component:', err);
      return (
        <div className="p-4 border border-red-500 rounded bg-red-50">
          <h3 className="text-red-800 font-medium">Render Error</h3>
          <p className="text-red-600">{err instanceof Error ? err.message : String(err)}</p>
        </div>
      );
    }
  };

  return (
    <div className="schema-renderer">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{modelName}</h2>
        <p className="text-sm text-gray-500">ID: {modelId}</p>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 border border-red-500 rounded bg-red-50">
          <h3 className="text-red-800 font-medium">Error</h3>
          <p className="text-red-600">{error}</p>
        </div>
      )}
      
      {/* Loading state */}
      {loading && (
        <div className="mb-6 p-4 border border-blue-300 rounded bg-blue-50">
          <p className="text-blue-800">Generating component...</p>
        </div>
      )}
      
      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <ul className="flex -mb-px">
          <li className="mr-1">
            <button
              className={`inline-block py-2 px-4 font-medium ${
                activeTab === 'preview'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </button>
          </li>
          <li className="mr-1">
            <button
              className={`inline-block py-2 px-4 font-medium ${
                activeTab === 'code'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('code')}
            >
              Code
            </button>
          </li>
          {enableReasoning && (
            <li className="mr-1">
              <button
                className={`inline-block py-2 px-4 font-medium ${
                  activeTab === 'reasoning'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('reasoning')}
              >
                Reasoning
              </button>
            </li>
          )}
        </ul>
      </div>
      
      {/* Tab content */}
      <div className="tab-content">
        {/* Preview tab */}
        {activeTab === 'preview' && (
          <div className="p-4 border rounded-md bg-white">
            {renderDynamicComponent()}
          </div>
        )}
        
        {/* Code tab */}
        {activeTab === 'code' && generatedCode && (
          <div className="p-4 border rounded-md bg-gray-50">
            <pre className="whitespace-pre-wrap text-sm overflow-auto p-4 bg-gray-800 text-gray-200 rounded">
              {generatedCode}
            </pre>
          </div>
        )}
        
        {/* Reasoning tab */}
        {activeTab === 'reasoning' && enableReasoning && result?.reasoning && (
          <div className="p-4 border rounded-md bg-white">
            <h3 className="text-lg font-medium mb-4">Reasoning Analysis</h3>
            
            {Object.entries(result.reasoning).map(([moduleName, moduleResult]) => (
              <div key={moduleName} className="mb-6">
                <h4 className="text-md font-medium mb-2 text-blue-700">{moduleName}</h4>
                <pre className="whitespace-pre-wrap text-sm overflow-auto p-4 bg-gray-50 border rounded">
                  {JSON.stringify(moduleResult, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Actions */}
      <div className="mt-6 flex justify-end">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          onClick={generateComponent}
          disabled={loading}
        >
          {loading ? 'Generating...' : 'Re-generate'}
        </button>
      </div>
    </div>
  );
};

/**
 * Demo component that renders a predefined schema
 */
export const SchemaDemoRenderer: React.FC = () => {
  // Sample user schema
  const userSchema = {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', readOnly: true },
      firstName: { type: 'string', minLength: 1, maxLength: 50 },
      lastName: { type: 'string', minLength: 1, maxLength: 50 },
      email: { type: 'string', format: 'email', minLength: 5, maxLength: 100 },
      password: { type: 'string', format: 'password', minLength: 8, maxLength: 100, writeOnly: true },
      role: { 
        type: 'string', 
        enum: ['admin', 'user', 'editor', 'viewer'],
        default: 'user'
      },
      isActive: { type: 'boolean', default: true },
      dateOfBirth: { type: 'string', format: 'date' },
      bio: { type: 'string', maxLength: 500 },
      profileImage: { type: 'string', format: 'url' },
      createdAt: { type: 'string', format: 'date-time', readOnly: true },
      updatedAt: { type: 'string', format: 'date-time', readOnly: true },
    },
    required: ['firstName', 'lastName', 'email', 'password', 'role'],
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Schema-to-UI Demo</h1>
      
      <SchemaRenderer
        schema={userSchema}
        modelId="user-form"
        modelName="User Registration Form"
        schemaType={SchemaSourceType.JSON_SCHEMA}
        enableReasoning={true}
      />
    </div>
  );
};

export default SchemaDemoRenderer; 