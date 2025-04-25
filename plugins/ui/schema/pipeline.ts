import { SchemaParser, SchemaSourceType, UIModel } from './parser';
import { ComponentGenerator, GeneratedComponent } from './generator';
import { ReasoningModule, ReasoningContext } from './reasoning';

/**
 * Pipeline result interface
 */
export interface PipelineResult {
  uiModel: UIModel;
  component: GeneratedComponent;
  reasoning?: Record<string, any>;
}

/**
 * Pipeline options interface
 */
export interface PipelineOptions {
  schemaSourceType?: SchemaSourceType;
  enableReasoning?: boolean;
  reasoningModules?: ReasoningModule[];
  useTailwind?: boolean;
  useShad?: boolean;
  generateFiles?: boolean;
  outputDir?: string;
  addHooks?: boolean;
  generateIndexFile?: boolean;
  verbose?: boolean;
  customTypeMapping?: Record<string, string>;
  customFormatMapping?: Record<string, string>;
}

/**
 * Schema transformation pipeline
 */
export class SchemaPipeline {
  private parser: SchemaParser;
  private generator: ComponentGenerator;
  private options: PipelineOptions;
  private reasoning: ReasoningModule[] = [];

  /**
   * Creates a new schema transformation pipeline
   * @param options Pipeline options
   */
  constructor(options: PipelineOptions = {}) {
    this.options = {
      schemaSourceType: SchemaSourceType.JSON_SCHEMA,
      enableReasoning: true,
      useTailwind: true,
      useShad: true,
      generateFiles: false,
      outputDir: './components',
      addHooks: true,
      generateIndexFile: true,
      verbose: false,
      ...options,
    };

    // Initialize parser
    this.parser = new SchemaParser({
      sourceType: this.options.schemaSourceType || SchemaSourceType.JSON_SCHEMA,
      customTypeMapping: this.options.customTypeMapping,
      customFormatMapping: this.options.customFormatMapping,
    });

    // Initialize generator
    this.generator = new ComponentGenerator({
      useTailwind: this.options.useTailwind,
      useShad: this.options.useShad,
    });

    // Initialize reasoning modules if enabled
    if (this.options.enableReasoning) {
      this.reasoning = this.options.reasoningModules || [];
    }
  }

  /**
   * Transforms a schema into a UI component
   * @param schema Schema to transform
   * @param modelId Model ID
   * @param modelName Model name
   * @returns Pipeline result
   */
  transform(schema: string | Record<string, any>, modelId: string, modelName: string): PipelineResult {
    // Log start of pipeline if verbose
    if (this.options.verbose) {
      console.log(`[Pipeline] Starting transformation for ${modelName}`);
    }

    // Step 1: Parse the schema
    const uiModel = this.parser.parse(schema, modelId, modelName);

    // Initialize reasoning context if reasoning is enabled
    let reasoningContext: ReasoningContext | undefined;
    let reasoningResults: Record<string, any> = {};

    if (this.options.enableReasoning && this.reasoning.length > 0) {
      reasoningContext = {
        schema: schema,
        uiModel: uiModel,
        modelId: modelId,
        modelName: modelName,
        metadata: {},
      };

      // Step 2: Apply reasoning modules in sequence
      for (const module of this.reasoning) {
        if (this.options.verbose) {
          console.log(`[Pipeline] Applying reasoning module: ${module.name}`);
        }

        const result = module.process(reasoningContext);
        reasoningResults[module.name] = result;

        // Update the context with the result
        reasoningContext.metadata[module.name] = result;
      }
    }

    // Step 3: Generate the component
    const component = this.generator.generateComponent(uiModel);

    // Log completion if verbose
    if (this.options.verbose) {
      console.log(`[Pipeline] Completed transformation for ${modelName}`);
    }

    // Return the result
    return {
      uiModel,
      component,
      reasoning: reasoningResults,
    };
  }

  /**
   * Transforms multiple schemas into UI components
   * @param schemas Schemas to transform
   * @returns Array of pipeline results
   */
  transformBatch(
    schemas: Array<{
      schema: string | Record<string, any>;
      modelId: string;
      modelName: string;
    }>
  ): PipelineResult[] {
    return schemas.map(({ schema, modelId, modelName }) =>
      this.transform(schema, modelId, modelName)
    );
  }

  /**
   * Transforms a schema and writes the output to a file
   * @param schema Schema to transform
   * @param modelId Model ID
   * @param modelName Model name
   * @param outputDir Output directory (overrides the default)
   * @returns Pipeline result
   */
  async transformAndWrite(
    schema: string | Record<string, any>,
    modelId: string,
    modelName: string,
    outputDir?: string
  ): Promise<PipelineResult> {
    const result = this.transform(schema, modelId, modelName);
    
    // If generateFiles is enabled, write the output
    if (this.options.generateFiles) {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const dir = outputDir || this.options.outputDir || './components';
      
      try {
        // Create the output directory if it doesn't exist
        await fs.mkdir(dir, { recursive: true });
        
        // Write the component file
        const filePath = path.join(dir, result.component.fileName);
        await fs.writeFile(filePath, result.component.code);
        
        if (this.options.verbose) {
          console.log(`[Pipeline] Wrote component to ${filePath}`);
        }
        
        // Generate and write index file if enabled
        if (this.options.generateIndexFile) {
          const indexPath = path.join(dir, 'index.ts');
          let indexContent = '';
          
          try {
            // Check if the index file exists
            indexContent = await fs.readFile(indexPath, 'utf-8');
          } catch (error) {
            // File doesn't exist, create it
            indexContent = '// Generated index file\n\n';
          }
          
          // Add export statement if it doesn't exist
          const exportStatement = `export { default as ${result.component.componentName} } from './${path.basename(result.component.fileName, '.tsx')}';\n`;
          
          if (!indexContent.includes(exportStatement)) {
            indexContent += exportStatement;
            await fs.writeFile(indexPath, indexContent);
            
            if (this.options.verbose) {
              console.log(`[Pipeline] Updated index file at ${indexPath}`);
            }
          }
        }
      } catch (error) {
        console.error('[Pipeline] Error writing files:', error);
        throw error;
      }
    }
    
    return result;
  }
}

/**
 * Create a schema pipeline with default options
 */
export function createSchemaPipeline(options?: PipelineOptions): SchemaPipeline {
  return new SchemaPipeline(options);
} 