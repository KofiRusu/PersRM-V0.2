/**
 * Schema-to-UI Pipeline
 * Exports all components for the schema-to-UI transformation pipeline
 */

// Export parser module
export * from './parser';

// Export generator module
export * from './generator';

// Export reasoning module
export * from './reasoning';

// Export pipeline module
export * from './pipeline';

// Re-export main functions for easy access
import { createSchemaParser, SchemaSourceType } from './parser';
import { createComponentGenerator } from './generator';
import { createReasoningModules } from './reasoning';
import { createSchemaPipeline } from './pipeline';

/**
 * Create a complete schema-to-UI pipeline with all modules
 */
export function createUIFromSchema(options: {
  schemaSourceType?: SchemaSourceType;
  enableReasoning?: boolean;
  useTailwind?: boolean;
  useShad?: boolean;
  verbose?: boolean;
}) {
  const {
    schemaSourceType = SchemaSourceType.JSON_SCHEMA,
    enableReasoning = true,
    useTailwind = true,
    useShad = true,
    verbose = false,
  } = options;

  // Create reasoning modules if enabled
  const reasoningModules = enableReasoning ? createReasoningModules() : [];
  
  // Create the pipeline
  return createSchemaPipeline({
    schemaSourceType,
    enableReasoning,
    reasoningModules,
    useTailwind,
    useShad,
    verbose,
  });
}

// Default export
export default {
  createSchemaParser,
  createComponentGenerator,
  createReasoningModules,
  createSchemaPipeline,
  createUIFromSchema,
}; 