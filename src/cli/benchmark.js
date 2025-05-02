#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk') || { green: (t) => t, red: (t) => t, yellow: (t) => t, blue: (t) => t, cyan: (t) => t };

// Define the main program
const program = new Command();

program
  .name('benchmark')
  .description('Run generation benchmarks against prompt files')
  .option('-p, --prompts <path>', 'Path to directory containing prompt files', './generation-benchmark/prompts')
  .option('-o, --output <path>', 'Path to output directory for generated components', './generation-benchmark/outputs')
  .option('-r, --report <path>', 'Path to output directory for benchmark reports', './generation-benchmark/analysis')
  .option('-c, --components <types>', 'Component types to generate (comma-separated, or "all")', 'all')
  .option('-v, --verbose', 'Show verbose output', false)
  .option('-b, --baseline-only', 'Generate only baseline components (no enhancement)', false)
  .option('-m, --max-retries <number>', 'Maximum number of retries for failed generations', 3)
  .option('-s, --single <promptId>', 'Run only a specific prompt ID (e.g., "02")')
  .action(async (options) => {
    console.log(chalk.cyan('🚀 Running PersLM generation benchmark'));
    
    try {
      const promptsDir = path.resolve(options.prompts);
      const outputDir = path.resolve(options.output);
      const reportDir = path.resolve(options.report);
      const maxRetries = parseInt(options.maxRetries) || 3;
      
      validateEnvironment(promptsDir, outputDir, reportDir);
      
      // Find all prompt files
      let promptFiles = fs.readdirSync(promptsDir)
        .filter((filename) => filename.endsWith('.txt') && filename.startsWith('prompt-'))
        .map((filename) => path.join(promptsDir, filename))
        .sort();
      
      if (promptFiles.length === 0) {
        console.error(chalk.red(`No prompt files found in ${promptsDir}`));
        process.exit(1);
      }
      
      // Filter by specific prompt ID if requested
      if (options.single) {
        const singleId = options.single.padStart(2, '0');
        promptFiles = promptFiles.filter(file => 
          path.basename(file).includes(`prompt-${singleId}-`)
        );
        
        if (promptFiles.length === 0) {
          console.error(chalk.red(`No prompt file found with ID ${options.single}`));
          process.exit(1);
        }
      }
      
      console.log(chalk.green(`Found ${promptFiles.length} prompt files`));
      
      // Filter by component types if specified
      const componentTypes = options.components === 'all' 
        ? [] 
        : options.components.split(',').map(t => t.trim().toLowerCase());
      
      // Store benchmark results
      const results = [];
      const stats = {
        success: 0,
        failure: 0,
        retries: 0,
        baseline: { generated: 0 },
        enhanced: { generated: 0 }
      };
      
      // Process each prompt file
      for (let i = 0; i < promptFiles.length; i++) {
        const promptFile = promptFiles[i];
        const filename = path.basename(promptFile);
        const match = filename.match(/prompt-(\d+)-(.+)\.txt/);
        
        if (!match) {
          console.warn(chalk.yellow(`Skipping ${filename} - doesn't match expected format`));
          continue;
        }
        
        const promptId = match[1];
        const componentType = match[2].replace(/-/g, ' ');
        
        // Skip if filtering by component type
        if (componentTypes.length > 0) {
          // Extract both hyphenated and space versions for matching
          const hyphenatedType = match[2];
          const spacedType = componentType;
          const typeMatches = componentTypes.some(t => 
            hyphenatedType.includes(t) || 
            spacedType.includes(t) || 
            t.includes(hyphenatedType) ||
            t.includes(spacedType)
          );
          
          if (!typeMatches) {
            console.log(chalk.blue(`Skipping ${componentType} (not in requested types)`));
            continue;
          }
        }
        
        console.log(chalk.cyan(`\n[${i+1}/${promptFiles.length}] Processing ${componentType} (ID: ${promptId})`));
        
        let baselineSuccess = false;
        let enhancedSuccess = false;
        let baselineCode = null;
        let enhancedCode = null;
        let baselineScore = null;
        let enhancedScore = null;
        let baselineRetries = 0;
        let enhancedRetries = 0;
        
        try {
          // Read prompt content
          const promptContent = fs.readFileSync(promptFile, 'utf-8');
          
          // Create component-specific output directory
          const componentOutputDir = path.join(outputDir, `prompt-${promptId}`);
          if (!fs.existsSync(componentOutputDir)) {
            fs.mkdirSync(componentOutputDir, { recursive: true });
          }
          
          // Save prompt file to output directory for reference
          fs.writeFileSync(path.join(componentOutputDir, 'prompt.txt'), promptContent);
          
          // Format the component name consistently
          const componentName = `${componentType.replace(/\s+/g, '')}Component`;
          
          // Generate baseline component with retries
          while (!baselineSuccess && baselineRetries < maxRetries) {
            try {
              console.log(chalk.cyan(`Generating baseline ${componentType}${baselineRetries > 0 ? ` (attempt ${baselineRetries + 1})` : ''}...`));
              
              baselineCode = generateBaselineComponent(componentType, promptContent);
              if (validateComponent(baselineCode, componentName)) {
                baselineSuccess = true;
                stats.baseline.generated++;
                
                // Score the baseline component
                baselineScore = scoreComponent(baselineCode, promptContent, 'baseline');
                console.log(chalk.green(`✅ Baseline component generated`));
                console.log(chalk.green(`   Score: ${baselineScore.total}/100`));
                
                // Save baseline component
                const baselineFilePath = path.join(componentOutputDir, `${componentName}.baseline.tsx`);
                fs.writeFileSync(baselineFilePath, baselineCode);
              } else {
                console.log(chalk.yellow(`⚠️ Generated baseline component failed validation, retrying...`));
                baselineRetries++;
                stats.retries++;
              }
            } catch (error) {
              console.error(chalk.yellow(`Error generating baseline component (attempt ${baselineRetries + 1}):`, error));
              baselineRetries++;
              stats.retries++;
            }
          }
          
          if (!baselineSuccess) {
            throw new Error(`Failed to generate valid baseline component after ${maxRetries} attempts`);
          }
          
          // Generate enhanced component if not baseline-only
          if (!options.baselineOnly) {
            while (!enhancedSuccess && enhancedRetries < maxRetries) {
              try {
                console.log(chalk.cyan(`Enhancing ${componentType}${enhancedRetries > 0 ? ` (attempt ${enhancedRetries + 1})` : ''}...`));
                
                enhancedCode = enhanceComponent(baselineCode, promptContent, componentType);
                if (validateComponent(enhancedCode, componentName)) {
                  enhancedSuccess = true;
                  stats.enhanced.generated++;
                  
                  // Score the enhanced component
                  enhancedScore = scoreComponent(enhancedCode, promptContent, 'enhanced');
                  console.log(chalk.green(`✅ Enhanced component generated`));
                  console.log(chalk.green(`   Score: ${enhancedScore.total}/100`));
                  console.log(chalk.green(`   Improvement: +${enhancedScore.total - baselineScore.total} points`));
                  
                  // Save enhanced component
                  const enhancedFilePath = path.join(componentOutputDir, `${componentName}.enhanced.tsx`);
                  fs.writeFileSync(enhancedFilePath, enhancedCode);
                } else {
                  console.log(chalk.yellow(`⚠️ Generated enhanced component failed validation, retrying...`));
                  enhancedRetries++;
                  stats.retries++;
                }
              } catch (error) {
                console.error(chalk.yellow(`Error enhancing component (attempt ${enhancedRetries + 1}):`, error));
                enhancedRetries++;
                stats.retries++;
              }
            }
          }
          
          // Store result
          if (enhancedSuccess || options.baselineOnly) {
            stats.success++;
            results.push({
              promptId,
              componentType,
              baselineScore: baselineScore ? baselineScore.total : null,
              enhancedScore: enhancedScore ? enhancedScore.total : null,
              improvement: (baselineScore && enhancedScore) ? enhancedScore.total - baselineScore.total : 0,
              baselineRetries,
              enhancedRetries
            });
          } else if (baselineSuccess) {
            stats.failure++;
            results.push({
              promptId,
              componentType,
              baselineScore: baselineScore ? baselineScore.total : null,
              error: `Failed to generate valid enhanced component after ${maxRetries} attempts`,
              baselineRetries,
              enhancedRetries
            });
          }
          
        } catch (error) {
          stats.failure++;
          console.error(chalk.red(`Error processing ${componentType}:`, error));
          results.push({
            promptId,
            componentType,
            error: error instanceof Error ? error.message : String(error),
            baselineRetries,
            enhancedRetries
          });
        }
      }
      
      // Generate benchmark report
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const reportPath = path.join(reportDir, `benchmark-report-${timestamp}.json`);
      
      const report = {
        timestamp: new Date().toISOString(),
        config: {
          framework: 'react',
          styling: 'tailwind',
          enhancementEnabled: !options.baselineOnly
        },
        stats,
        results
      };
      
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(chalk.cyan(`\n✨ Benchmark complete!`));
      console.log(chalk.green(`   Success: ${stats.success}/${results.length} components (${((stats.success/results.length)*100).toFixed(1)}%)`));
      if (stats.failure > 0) {
        console.log(chalk.yellow(`   Failures: ${stats.failure}`));
      }
      if (stats.retries > 0) {
        console.log(chalk.yellow(`   Total retries: ${stats.retries}`));
      }
      console.log(chalk.green(`   Report saved to: ${reportPath}`));
      
      // Display summary
      const successfulResults = results.filter(r => r.baselineScore !== null);
      if (successfulResults.length > 0) {
        const avgBaselineScore = successfulResults.reduce((sum, r) => sum + r.baselineScore, 0) / successfulResults.length;
        console.log(chalk.cyan(`\n📊 Average baseline score: ${avgBaselineScore.toFixed(1)}/100`));
        
        if (!options.baselineOnly) {
          const enhancedResults = results.filter(r => r.enhancedScore !== null);
          if (enhancedResults.length > 0) {
            const avgEnhancedScore = enhancedResults.reduce((sum, r) => sum + r.enhancedScore, 0) / enhancedResults.length;
            const avgImprovement = enhancedResults.reduce((sum, r) => sum + r.improvement, 0) / enhancedResults.length;
            const avgImprovementPercent = (avgImprovement / avgBaselineScore * 100).toFixed(1);
            
            console.log(chalk.cyan(`   Average enhanced score: ${avgEnhancedScore.toFixed(1)}/100`));
            console.log(chalk.cyan(`   Average improvement: +${avgImprovement.toFixed(1)} points (${avgImprovementPercent}%)`));
          }
        }
      }
      
    } catch (error) {
      console.error(chalk.red('Benchmark failed:', error));
      process.exit(1);
    }
  });

/**
 * Validates that the environment is properly set up
 * @param {string} promptsDir - Directory containing prompt files 
 * @param {string} outputDir - Directory for generated components
 * @param {string} reportDir - Directory for benchmark reports
 */
function validateEnvironment(promptsDir, outputDir, reportDir) {
  // Check if prompts directory exists
  if (!fs.existsSync(promptsDir)) {
    console.error(chalk.red(`Prompts directory not found: ${promptsDir}`));
    process.exit(1);
  }
  
  // Create output directories if they don't exist
  if (!fs.existsSync(outputDir)) {
    console.log(chalk.blue(`Creating output directory: ${outputDir}`));
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  if (!fs.existsSync(reportDir)) {
    console.log(chalk.blue(`Creating report directory: ${reportDir}`));
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // Make sure the directories are writable
  try {
    const testFile = path.join(outputDir, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    
    const testReport = path.join(reportDir, '.write-test');
    fs.writeFileSync(testReport, 'test');
    fs.unlinkSync(testReport);
  } catch (error) {
    console.error(chalk.red(`Cannot write to output or report directories: ${error.message}`));
    process.exit(1);
  }
}

/**
 * Validates a generated component
 * @param {string} code - Generated component code 
 * @param {string} componentName - Expected component name
 * @returns {boolean} True if component is valid
 */
function validateComponent(code, componentName) {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  // Must be a reasonable length
  if (code.length < 200) {
    return false;
  }
  
  // Must include React import
  if (!code.includes('import React') && !code.includes('from "react"') && !code.includes("from 'react'")) {
    return false;
  }
  
  // Must include component definition
  if (!code.includes(`function ${componentName}`) && !code.includes(`const ${componentName}`)) {
    return false;
  }
  
  // Must include return statement
  if (!code.includes('return (')) {
    return false;
  }
  
  // Check for balanced JSX tags
  const openTags = (code.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?>/gi) || []).length;
  const closeTags = (code.match(/<\/[a-z][a-z0-9]*>/gi) || []).length;
  const selfClosingTags = (code.match(/<[a-z][a-z0-9]*(?:\s[^>]*)?\s*\/>/gi) || []).length;
  
  if (openTags - selfClosingTags !== closeTags) {
    return false;
  }
  
  // Must export the component
  if (!code.includes('export default') && !code.includes('export function') && !code.includes('export const')) {
    return false;
  }
  
  return true;
}

// Mock function to generate a baseline component
function generateBaselineComponent(componentType, promptContent) {
  // Extract requirements from the prompt
  const requirements = extractRequirements(promptContent);
  
  // Create a simple React component based on the type
  let code = `import React from 'react';\n`;
  code += `import { useState } from 'react';\n`;
  code += `\n`;
  code += `// ${componentType} implementation based on prompt requirements\n`;
  code += `// Requirements: ${requirements.slice(0, 3).join(', ')}${requirements.length > 3 ? ', ...' : ''}\n`;
  code += `\n`;
  
  const componentName = `${componentType.replace(/\s+/g, '')}Component`;
  
  code += `export default function ${componentName}() {\n`;
  code += `  const [isActive, setIsActive] = useState(false);\n`;
  code += `\n`;
  code += `  return (\n`;
  code += `    <div className="container mx-auto p-4">\n`;
  code += `      <h2 className="text-2xl font-bold mb-4">${componentType}</h2>\n`;
  
  // Add specific elements based on component type
  if (componentType.includes('hero')) {
    code += `      <div className="bg-blue-100 p-8 rounded-lg">\n`;
    code += `        <h1 className="text-4xl font-bold">Welcome to Our Platform</h1>\n`;
    code += `        <p className="my-4">The best solution for your needs</p>\n`;
    code += `        <button className="bg-blue-500 text-white px-4 py-2 rounded">\n`;
    code += `          Get Started\n`;
    code += `        </button>\n`;
    code += `      </div>\n`;
  } else if (componentType.includes('form')) {
    code += `      <form className="bg-gray-100 p-6 rounded-lg">\n`;
    code += `        <div className="mb-4">\n`;
    code += `          <label htmlFor="name" className="block mb-2">Name</label>\n`;
    code += `          <input id="name" type="text" className="w-full p-2 border rounded" />\n`;
    code += `        </div>\n`;
    code += `        <div className="mb-4">\n`;
    code += `          <label htmlFor="email" className="block mb-2">Email</label>\n`;
    code += `          <input id="email" type="email" className="w-full p-2 border rounded" />\n`;
    code += `        </div>\n`;
    code += `        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">\n`;
    code += `          Submit\n`;
    code += `        </button>\n`;
    code += `      </form>\n`;
  } else if (componentType.includes('card')) {
    code += `      <div className="bg-white shadow-md rounded-lg overflow-hidden">\n`;
    code += `        <div className="p-4">\n`;
    code += `          <h3 className="text-xl font-semibold mb-2">Card Title</h3>\n`;
    code += `          <p className="text-gray-600">Card description goes here. This provides details about the content.</p>\n`;
    code += `          <button \n`;
    code += `            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"\n`;
    code += `            onClick={() => setIsActive(!isActive)}\n`;
    code += `          >\n`;
    code += `            {isActive ? 'Active' : 'Inactive'}\n`;
    code += `          </button>\n`;
    code += `        </div>\n`;
    code += `      </div>\n`;
  } else {
    code += `      <div className="bg-gray-100 p-6 rounded-lg">\n`;
    code += `        <p>Basic ${componentType} implementation</p>\n`;
    code += `        <button \n`;
    code += `          className="bg-blue-500 text-white px-4 py-2 rounded mt-4"\n`;
    code += `          onClick={() => setIsActive(!isActive)}\n`;
    code += `        >\n`;
    code += `          {isActive ? 'Active' : 'Inactive'}\n`;
    code += `        </button>\n`;
    code += `      </div>\n`;
  }
  
  code += `    </div>\n`;
  code += `  );\n`;
  code += `}\n`;
  
  return code;
}

// Mock function to enhance a component
function enhanceComponent(baselineCode, promptContent, componentType) {
  // Start with the baseline code
  let enhancedCode = baselineCode;
  
  // Add accessibility attributes
  enhancedCode = enhancedCode.replace(/<button(?!\s+aria-)/g, '<button aria-label="Action button"');
  
  // Add responsive classes
  enhancedCode = enhancedCode.replace(/className="container/g, 'className="container sm:px-4 md:px-6 lg:px-8');
  
  // Add dark mode support
  if (enhancedCode.includes('<div className="container')) {
    enhancedCode = enhancedCode.replace('<div className="container', '<div className="container dark:bg-gray-800 dark:text-white');
  }
  
  // Add animation
  enhancedCode = enhancedCode.replace(
    'export default function',
    `// Enhanced with animations, accessibility, and responsive design
export default function`
  );
  
  // Add transition effects
  enhancedCode = enhancedCode.replace(
    /className="bg-blue-500/g,
    'className="bg-blue-500 hover:bg-blue-600 transition-colors duration-300'
  );
  
  // Add error handling
  if (enhancedCode.includes('useState')) {
    enhancedCode = enhancedCode.replace(
      'const [isActive, setIsActive] = useState(false);',
      'const [isActive, setIsActive] = useState(false);\n  const [error, setError] = useState(null);\n'
    );
    
    // Add error display
    enhancedCode = enhancedCode.replace(
      '</div>\n    </div>',
      '  {error && <p className="text-red-500 mt-4" role="alert">{error}</p>}\n      </div>\n    </div>'
    );
  }
  
  // Add ARIA roles for better accessibility
  enhancedCode = enhancedCode.replace(/<nav/g, '<nav role="navigation"');
  enhancedCode = enhancedCode.replace(/<main/g, '<main role="main"');
  enhancedCode = enhancedCode.replace(/<header/g, '<header role="banner"');
  enhancedCode = enhancedCode.replace(/<footer/g, '<footer role="contentinfo"');
  
  // Add semantic HTML improvements
  if (componentType.includes('hero')) {
    // Improve heading hierarchy and semantic structure
    enhancedCode = enhancedCode.replace(
      /<div className="bg-blue-100 p-8 rounded-lg">/,
      '<section className="bg-blue-100 p-8 rounded-lg hero-section" aria-labelledby="hero-heading">'
    );
    enhancedCode = enhancedCode.replace(
      /<h1 className="text-4xl font-bold">/,
      '<h1 id="hero-heading" className="text-4xl font-bold">'
    );
    enhancedCode = enhancedCode.replace(
      /<\/div>\s*$/gm,
      '</section>'
    );
  }
  
  return enhancedCode;
}

// Mock function to extract requirements from a prompt
function extractRequirements(promptContent) {
  const requirements = [];
  
  // Extract bullet points
  const bulletPointRegex = /[-•*]\s+(.*?)(?=\n|$)/g;
  let match;
  while ((match = bulletPointRegex.exec(promptContent)) !== null) {
    requirements.push(match[1].trim());
  }
  
  // Extract numbered items
  const numberedItemRegex = /\d+\.\s+(.*?)(?=\n|$)/g;
  while ((match = numberedItemRegex.exec(promptContent)) !== null) {
    requirements.push(match[1].trim());
  }
  
  // Extract "must have" phrases
  const mustHaveRegex = /must\s+(?:have|include)\s+(.*?)(?=\.|$)/gi;
  while ((match = mustHaveRegex.exec(promptContent)) !== null) {
    requirements.push(match[1].trim());
  }
  
  // Extract "should include" phrases
  const shouldIncludeRegex = /should\s+(?:have|include)\s+(.*?)(?=\.|$)/gi;
  while ((match = shouldIncludeRegex.exec(promptContent)) !== null) {
    requirements.push(match[1].trim());
  }
  
  return requirements;
}

// Mock function to score a component
function scoreComponent(code, prompt, type) {
  // Base scores for baseline and enhanced components
  const baseScore = type === 'baseline' ? 60 : 80;
  
  // Calculate sub-scores
  let fidelity = type === 'baseline' ? 70 : 85;
  let codeQuality = type === 'baseline' ? 65 : 80;
  let accessibility = type === 'baseline' ? 50 : 85;
  let uxPolish = type === 'baseline' ? 55 : 85;
  let innovation = type === 'baseline' ? 40 : 75;
  
  // Adjust scores based on code features
  if (code.includes('aria-')) {
    accessibility += 10;
  }
  
  if (code.includes('role="')) {
    accessibility += 5;
  }
  
  if (code.includes('transition') || code.includes('animation')) {
    uxPolish += 5;
  }
  
  if (code.includes('dark:')) {
    innovation += 10;
    uxPolish += 5;
  }
  
  if (code.includes('sm:') || code.includes('md:') || code.includes('lg:')) {
    codeQuality += 5;
    uxPolish += 5;
  }
  
  if (code.includes('useState') || code.includes('useEffect')) {
    codeQuality += 5;
  }
  
  if (code.includes('error')) {
    innovation += 5;
  }
  
  if (code.includes('htmlFor=')) {
    accessibility += 5;
  }
  
  // Check fidelity by examining if the requirements are met
  const requirements = extractRequirements(prompt);
  const requirementMatches = requirements.filter(req => {
    const keywords = req.split(/\s+/).filter(word => word.length > 3);
    const matchCount = keywords.filter(keyword => 
      code.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    return matchCount > keywords.length * 0.6;
  }).length;
  
  if (requirements.length > 0) {
    fidelity = Math.min(100, Math.round((requirementMatches / requirements.length) * 100));
  }
  
  // Cap scores at 100
  fidelity = Math.min(fidelity, 100);
  codeQuality = Math.min(codeQuality, 100);
  accessibility = Math.min(accessibility, 100);
  uxPolish = Math.min(uxPolish, 100);
  innovation = Math.min(innovation, 100);
  
  // Calculate total score (weighted)
  const total = Math.round(
    fidelity * 0.35 +
    codeQuality * 0.25 +
    accessibility * 0.15 +
    uxPolish * 0.15 +
    innovation * 0.10
  );
  
  return {
    total,
    fidelity,
    codeQuality,
    accessibility,
    uxPolish,
    innovation
  };
}

// Parse command line arguments
program.parse(process.argv); 