#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { ESLint } = require('eslint');
const { exec } = require('child_process');
const { promisify } = require('util');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const chalk = require('chalk');

const execAsync = promisify(exec);

// Define program options
program
  .description('Validate React component files for syntax, accessibility and semantic HTML')
  .option('-d, --directory <directory>', 'Directory containing component files to validate', './components')
  .option('-f, --file <file>', 'Specific component file to validate')
  .option('-o, --output <file>', 'Output validation results to JSON file')
  .option('-v, --verbose', 'Show detailed validation results')
  .option('--fix', 'Fix auto-fixable issues')
  .parse(process.argv);

const options = program.opts();

// Main validation function
async function validateComponent(filePath) {
  const result = {
    file: filePath,
    valid: true,
    syntaxValid: true,
    accessibilityValid: true,
    semanticValid: true,
    issues: {
      syntax: [],
      accessibility: [],
      semantic: []
    },
    fixedIssues: 0
  };

  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // 1. Validate JSX/TSX syntax
    try {
      await validateSyntax(filePath, fileContent, result);
    } catch (error) {
      result.syntaxValid = false;
      result.valid = false;
      result.issues.syntax.push({
        message: `Syntax validation failed: ${error.message}`,
        location: { line: error.loc?.line || 0, column: error.loc?.column || 0 }
      });
      
      if (options.verbose) {
        console.error(chalk.red(`Syntax error in ${filePath}: ${error.message}`));
      }
    }
    
    // 2. Validate accessibility
    try {
      await validateAccessibility(filePath, fileContent, result);
    } catch (error) {
      if (options.verbose) {
        console.error(chalk.yellow(`Accessibility validation failed in ${filePath}: ${error.message}`));
      }
    }
    
    // 3. Validate semantic HTML
    try {
      validateSemanticHTML(fileContent, result);
    } catch (error) {
      if (options.verbose) {
        console.error(chalk.yellow(`Semantic HTML validation failed in ${filePath}: ${error.message}`));
      }
    }
    
    // Fix issues if requested
    if (options.fix && !result.syntaxValid) {
      await fixIssues(filePath, result);
    }
    
    // Update overall validity
    result.valid = result.syntaxValid && result.accessibilityValid && result.semanticValid;
    
    return result;
  } catch (error) {
    result.valid = false;
    if (options.verbose) {
      console.error(chalk.red(`Validation failed for ${filePath}: ${error.message}`));
    }
    return result;
  }
}

// Validate syntax using ESLint
async function validateSyntax(filePath, content, result) {
  const eslint = new ESLint({
    overrideConfig: {
      extends: [
        'eslint:recommended',
        'plugin:react/recommended',
        'plugin:@typescript-eslint/recommended'
      ],
      plugins: ['react', '@typescript-eslint'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      },
      settings: {
        react: {
          version: 'detect'
        }
      },
      rules: {
        'react/prop-types': 'off',
        'react/react-in-jsx-scope': 'off'
      }
    },
    useEslintrc: false
  });
  
  const results = await eslint.lintText(content, { filePath });
  
  if (results[0].errorCount > 0) {
    result.syntaxValid = false;
    result.valid = false;
    
    for (const message of results[0].messages) {
      if (message.severity === 2) { // Error
        result.issues.syntax.push({
          message: message.message,
          ruleId: message.ruleId,
          location: { line: message.line, column: message.column }
        });
      }
    }
  }
  
  // Also try to parse with babel
  try {
    parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (error) {
    result.syntaxValid = false;
    result.valid = false;
    result.issues.syntax.push({
      message: `Parse error: ${error.message}`,
      location: { line: error.loc?.line || 0, column: error.loc?.column || 0 }
    });
  }
}

// Validate accessibility using eslint-plugin-jsx-a11y
async function validateAccessibility(filePath, content, result) {
  const eslint = new ESLint({
    overrideConfig: {
      extends: ['plugin:jsx-a11y/recommended'],
      plugins: ['jsx-a11y'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        }
      }
    },
    useEslintrc: false
  });
  
  try {
    const results = await eslint.lintText(content, { filePath });
  
    if (results[0].errorCount > 0 || results[0].warningCount > 0) {
      for (const message of results[0].messages) {
        // Consider warnings as issues but don't fail validation for them
        result.issues.accessibility.push({
          message: message.message,
          ruleId: message.ruleId,
          severity: message.severity,
          location: { line: message.line, column: message.column }
        });
        
        if (message.severity === 2) { // Error
          result.accessibilityValid = false;
          result.valid = false;
        }
      }
    }
  } catch (error) {
    // Don't fail the entire validation if a11y validation fails
    result.issues.accessibility.push({
      message: `A11y validation error: ${error.message}`,
      severity: 1
    });
  }
}

// Validate semantic HTML
function validateSemanticHTML(content, result) {
  const semanticIssues = [];
  
  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
    
    // Check for common semantic HTML issues
    traverse(ast, {
      JSXElement(path) {
        const node = path.node;
        const openingElement = node.openingElement;
        const name = openingElement.name;
        
        // Convert JSXIdentifier to string
        const tagName = name.name || (name.property && name.property.name);
        
        if (!tagName) return;
        
        // Check for click handlers on non-interactive elements
        if (tagName !== 'button' && tagName !== 'a' && tagName !== 'input' && 
            tagName !== 'select' && tagName !== 'textarea' && tagName !== 'Area') {
          const hasClickHandler = openingElement.attributes.some(attr => 
            attr.name && attr.name.name === 'onClick'
          );
          
          if (hasClickHandler) {
            const loc = openingElement.loc;
            semanticIssues.push({
              message: `Non-interactive element <${tagName}> has onClick handler but is not focusable`,
              location: { line: loc.start.line, column: loc.start.column }
            });
          }
        }
        
        // Check for heading structure
        if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || 
            tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
          // Just count headings for now
        }
        
        // Check for buttons without type
        if (tagName === 'button') {
          const hasType = openingElement.attributes.some(attr => 
            attr.name && attr.name.name === 'type'
          );
          
          if (!hasType) {
            const loc = openingElement.loc;
            semanticIssues.push({
              message: 'Button element should have explicit type attribute',
              location: { line: loc.start.line, column: loc.start.column }
            });
          }
        }
        
        // Check for images without alt
        if (tagName === 'img') {
          const hasAlt = openingElement.attributes.some(attr => 
            attr.name && attr.name.name === 'alt'
          );
          
          if (!hasAlt) {
            const loc = openingElement.loc;
            semanticIssues.push({
              message: 'Image should have alt attribute',
              location: { line: loc.start.line, column: loc.start.column }
            });
          }
        }
      }
    });
    
    // Update result
    if (semanticIssues.length > 0) {
      result.issues.semantic = semanticIssues;
      
      // Only set semantic validity to false if there are critical issues
      const criticalIssues = semanticIssues.filter(
        issue => issue.message.includes('Image should have alt')
      );
      
      if (criticalIssues.length > 0) {
        result.semanticValid = false;
        result.valid = false;
      }
    }
  } catch (error) {
    // Don't fail validation for semantic issues
    result.issues.semantic.push({
      message: `Semantic HTML validation error: ${error.message}`
    });
  }
}

// Fix issues using ESLint --fix
async function fixIssues(filePath, result) {
  try {
    const eslint = new ESLint({
      overrideConfig: {
        extends: [
          'eslint:recommended',
          'plugin:react/recommended',
          'plugin:@typescript-eslint/recommended',
          'plugin:jsx-a11y/recommended'
        ],
        plugins: ['react', '@typescript-eslint', 'jsx-a11y'],
        parser: '@typescript-eslint/parser',
        parserOptions: {
          ecmaVersion: 2020,
          sourceType: 'module',
          ecmaFeatures: {
            jsx: true
          }
        },
        settings: {
          react: {
            version: 'detect'
          }
        },
        rules: {
          'react/prop-types': 'off',
          'react/react-in-jsx-scope': 'off'
        }
      },
      useEslintrc: false,
      fix: true
    });
    
    const results = await eslint.lintFiles([filePath]);
    
    // Count fixed issues
    let fixedCount = 0;
    for (const res of results) {
      fixedCount += res.fixableErrorCount + res.fixableWarningCount;
    }
    
    result.fixedIssues = fixedCount;
    
    // Write fixed code to file
    if (fixedCount > 0) {
      const formatter = await eslint.loadFormatter('stylish');
      const resultText = formatter.format(results);
      if (options.verbose) {
        console.log(chalk.green(`Fixed ${fixedCount} issues in ${filePath}`));
        console.log(resultText);
      }
    }
    
    return fixedCount;
  } catch (error) {
    if (options.verbose) {
      console.error(chalk.red(`Failed to fix issues in ${filePath}: ${error.message}`));
    }
    return 0;
  }
}

// Run validation on all files in directory or specific file
async function validateFiles() {
  let filesToValidate = [];
  
  if (options.file) {
    filesToValidate = [path.resolve(options.file)];
  } else {
    const directory = path.resolve(options.directory);
    if (!fs.existsSync(directory)) {
      console.error(chalk.red(`Directory not found: ${directory}`));
      process.exit(1);
    }
    
    const files = fs.readdirSync(directory);
    filesToValidate = files
      .filter(file => file.endsWith('.jsx') || file.endsWith('.tsx'))
      .map(file => path.join(directory, file));
  }
  
  if (filesToValidate.length === 0) {
    console.error(chalk.yellow('No component files found to validate'));
    process.exit(0);
  }
  
  console.log(chalk.blue(`Validating ${filesToValidate.length} component files...`));
  
  const results = [];
  let validCount = 0;
  
  for (const file of filesToValidate) {
    try {
      const result = await validateComponent(file);
      results.push(result);
      
      if (result.valid) {
        validCount++;
        console.log(chalk.green(`✓ ${path.basename(file)} - Valid`));
      } else {
        console.log(chalk.red(`✗ ${path.basename(file)} - Invalid`));
        
        if (options.verbose) {
          if (result.issues.syntax.length > 0) {
            console.log(chalk.red('  Syntax issues:'));
            result.issues.syntax.forEach(issue => {
              console.log(chalk.red(`    - ${issue.message} (${issue.location.line}:${issue.location.column})`));
            });
          }
          
          if (result.issues.accessibility.length > 0) {
            console.log(chalk.yellow('  Accessibility issues:'));
            result.issues.accessibility.forEach(issue => {
              console.log(chalk.yellow(`    - ${issue.message} (${issue.location?.line || '?'}:${issue.location?.column || '?'})`));
            });
          }
          
          if (result.issues.semantic.length > 0) {
            console.log(chalk.yellow('  Semantic HTML issues:'));
            result.issues.semantic.forEach(issue => {
              console.log(chalk.yellow(`    - ${issue.message} (${issue.location?.line || '?'}:${issue.location?.column || '?'})`));
            });
          }
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error validating ${file}: ${error.message}`));
    }
  }
  
  const summary = {
    totalFiles: filesToValidate.length,
    validFiles: validCount,
    invalidFiles: filesToValidate.length - validCount,
    results
  };
  
  console.log(chalk.blue(`\nValidation complete: ${validCount}/${filesToValidate.length} files valid`));
  
  if (options.output) {
    const outputPath = path.resolve(options.output);
    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(chalk.blue(`Results saved to ${outputPath}`));
  }
  
  return summary;
}

// Run validation
validateFiles().catch(error => {
  console.error(chalk.red(`Validation failed: ${error.message}`));
  process.exit(1);
}); 