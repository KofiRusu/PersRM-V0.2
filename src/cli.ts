#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs-extra';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { PersRMAgent } from './lib/persrm/agent';
import { 
  AgentMode, 
  PersRMConfig, 
  ComponentGenerationOptions, 
  ComponentType,
  ReportOptions
} from './lib/persrm/types';
import { getPackageVersion } from './lib/utils/package';

const program = new Command();

// Get version from package.json
const version = getPackageVersion();

program
  .name('persrm')
  .description('PersRM: Personalized UI/UX Performance Agent')
  .version(version);

// Common options for all commands
const addCommonOptions = (command: Command) => {
  return command
    .option('-o, --output-dir <path>', 'Output directory for results', './persrm-output')
    .option('-v, --verbose', 'Enable verbose logging', false)
    .option('-s, --screenshots', 'Take screenshots during analysis', false)
    .option('-d, --design-system <path>', 'Path to design system')
    .option('--ci', 'Run in CI mode', false)
    .option('--pr <number>', 'PR number for CI mode')
    .option('--branch <name>', 'Branch name for CI mode');
};

// Analysis command
program
  .command('analyze')
  .description('Analyze UI/UX of a project')
  .argument('<project-path>', 'Path to the project to analyze')
  .action(async (projectPath, options) => {
    const spinner = ora('Analyzing project...').start();
    
    try {
      const config: PersRMConfig = {
        mode: AgentMode.ANALYSIS,
        projectPath,
        outputDir: options.outputDir,
        verbose: options.verbose,
        takeScreenshots: options.screenshots,
        designSystemPath: options.designSystem,
        ciMode: options.ci,
        prNumber: options.pr,
        branch: options.branch
      };
      
      const agent = new PersRMAgent(config);
      const result = await agent.analyze();
      
      if (result.success) {
        spinner.succeed(chalk.green('Analysis completed successfully!'));
        console.log(`Overall Score: ${chalk.bold(result.summary.overallScore)}/${result.summary.maxScore}`);
        console.log(`Found ${chalk.yellow(result.issues.length)} issues`);
        console.log(`Results saved to: ${chalk.cyan(path.join(config.outputDir, 'analysis-result.json'))}`);
      } else {
        spinner.fail(chalk.red('Analysis failed'));
        console.error(result.error);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Analysis failed with an error'));
      console.error(error);
      process.exit(1);
    }
  });

addCommonOptions(program.commands[0]);

// Optimize command
program
  .command('optimize')
  .description('Analyze and optimize UI/UX of a project')
  .argument('<project-path>', 'Path to the project to optimize')
  .action(async (projectPath, options) => {
    const spinner = ora('Optimizing project...').start();
    
    try {
      const config: PersRMConfig = {
        mode: AgentMode.OPTIMIZATION,
        projectPath,
        outputDir: options.outputDir,
        verbose: options.verbose,
        takeScreenshots: options.screenshots,
        designSystemPath: options.designSystem,
        ciMode: options.ci,
        prNumber: options.pr,
        branch: options.branch
      };
      
      const agent = new PersRMAgent(config);
      const result = await agent.optimize();
      
      if (result.success) {
        spinner.succeed(chalk.green('Optimization completed successfully!'));
        console.log(`Overall Score: ${chalk.bold(result.summary.overallScore)}/${result.summary.maxScore}`);
        console.log(`Found ${chalk.yellow(result.issues.length)} issues`);
        console.log(`Generated ${chalk.green(result.suggestions.length)} suggestions`);
        console.log(`Results saved to: ${chalk.cyan(path.join(config.outputDir, 'optimization-result.json'))}`);
      } else {
        spinner.fail(chalk.red('Optimization failed'));
        console.error(result.error);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Optimization failed with an error'));
      console.error(error);
      process.exit(1);
    }
  });

addCommonOptions(program.commands[1]);

// Generate command
program
  .command('generate')
  .description('Generate a component')
  .argument('<component-name>', 'Name of the component to generate')
  .option('-t, --type <type>', 'Type of component to generate', 'BASIC')
  .option('-p, --project <path>', 'Project path')
  .option('-f, --framework <name>', 'Framework to use (react, vue, angular)', 'react')
  .option('-s, --style <type>', 'Styling approach (css, scss, styled)', 'css')
  .option('--props <props>', 'Component props as JSON string', '{}')
  .option('--tests', 'Generate tests', false)
  .option('--stories', 'Generate storybook stories', false)
  .action(async (componentName, options) => {
    const spinner = ora(`Generating ${componentName} component...`).start();
    
    try {
      if (!options.project) {
        spinner.fail(chalk.red('Project path is required'));
        console.error('Please specify a project path with --project');
        process.exit(1);
      }
      
      const config: PersRMConfig = {
        mode: AgentMode.COMPONENT_GENERATION,
        projectPath: options.project,
        outputDir: options.outputDir,
        verbose: options.verbose,
        designSystemPath: options.designSystem
      };
      
      const componentOptions: ComponentGenerationOptions = {
        componentName,
        componentType: options.type as ComponentType,
        framework: options.framework,
        styling: options.style,
        props: JSON.parse(options.props),
        generateTests: options.tests,
        generateStories: options.stories
      };
      
      const agent = new PersRMAgent(config);
      const result = await agent.generateComponent(componentOptions);
      
      if (result.success) {
        spinner.succeed(chalk.green(`Component ${componentName} generated successfully!`));
        console.log(`Component saved to: ${chalk.cyan(result.component.filePath)}`);
      } else {
        spinner.fail(chalk.red('Component generation failed'));
        console.error(result.error);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Component generation failed with an error'));
      console.error(error);
      process.exit(1);
    }
  });

addCommonOptions(program.commands[2]);

// Report command
program
  .command('report')
  .description('Generate a report from analysis or optimization results')
  .option('-i, --input <path>', 'Path to input result file')
  .option('-f, --format <format>', 'Report format (html, md, json)', 'html')
  .option('--screenshots', 'Include screenshots in report', false)
  .option('--diffs', 'Include visual diffs in report', false)
  .option('--compare <path>', 'Path to previous result to compare with')
  .option('--ci-publish', 'Publish report to CI', false)
  .action(async (options) => {
    const spinner = ora('Generating report...').start();
    
    try {
      // Find the project path from the input file directory
      let projectPath = process.cwd();
      if (options.input) {
        const inputDir = path.dirname(options.input);
        projectPath = path.resolve(inputDir, '..');
      }
      
      const config: PersRMConfig = {
        mode: AgentMode.REPORTING,
        projectPath,
        outputDir: options.outputDir,
        verbose: options.verbose,
        ciMode: options.ci
      };
      
      const reportOptions: ReportOptions = {
        format: options.format,
        includeScreenshots: options.screenshots,
        includeDiffs: options.diffs,
        compareWithPrevious: !!options.compare,
        previousResultPath: options.compare,
        ciIntegration: options.ciPublish
      };
      
      const agent = new PersRMAgent(config);
      const result = await agent.generateReport(reportOptions, options.input);
      
      if (result.success) {
        spinner.succeed(chalk.green('Report generated successfully!'));
        console.log(`Report saved to: ${chalk.cyan(result.report)}`);
      } else {
        spinner.fail(chalk.red('Report generation failed'));
        console.error(result.error);
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red('Report generation failed with an error'));
      console.error(error);
      process.exit(1);
    }
  });

addCommonOptions(program.commands[3]);

// Initialize command
program
  .command('init')
  .description('Initialize PersRM configuration')
  .option('-p, --project <path>', 'Project path', process.cwd())
  .action(async (options) => {
    const spinner = ora('Initializing PersRM configuration...').start();
    
    try {
      const configPath = path.join(options.project, 'persrm.config.json');
      
      // Check if config already exists
      if (fs.existsSync(configPath)) {
        spinner.warn(chalk.yellow('PersRM configuration already exists'));
        console.log(`Configuration file: ${chalk.cyan(configPath)}`);
        process.exit(0);
      }
      
      // Create default configuration
      const defaultConfig: PersRMConfig = {
        mode: AgentMode.ANALYSIS,
        projectPath: '.',
        outputDir: './persrm-output',
        verbose: false,
        takeScreenshots: false
      };
      
      // Write configuration file
      await fs.writeJSON(configPath, defaultConfig, { spaces: 2 });
      
      spinner.succeed(chalk.green('PersRM configuration initialized successfully!'));
      console.log(`Configuration file: ${chalk.cyan(configPath)}`);
    } catch (error) {
      spinner.fail(chalk.red('Initialization failed with an error'));
      console.error(error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command is provided
if (program.args.length === 0) {
  program.outputHelp();
} 