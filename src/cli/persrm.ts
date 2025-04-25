#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import chalk from 'chalk';
import fs from 'fs-extra';
import { getActiveAgent, AgentMode, CommonAgentInterface } from '../lib/persrm/agent-switcher';
import { PersRMConfig } from '../lib/persrm/types';
import { 
  getBenchmarkHistory, 
  getBenchmarkTrend, 
  findRegressions, 
  getBenchmarkComparison, 
  EnhancedBenchmarkEntry,
  BenchmarkFilter
} from '../lib/analytics/benchmark';
// Import the integration services
import notionSync, { updateNotionConfig, isNotionConfigured } from '../lib/integrations/notion-sync';
import slackSync, { updateSlackConfig, isSlackConfigured } from '../lib/integrations/slack-sync';

// Extended configuration interface for CLI-specific options
interface CliExtendedConfig extends PersRMConfig {
  autoOptimize?: boolean;
}

// Main CLI program
const program = new Command();

program
  .name('persrm')
  .description('PersRM: Personalized UX Analysis and Optimization')
  .version('1.0.0');

// Global options
program
  .option('-m, --mode <mode>', 'Agent mode: "mock" or "prod"', process.env.PERSRM_MODE || 'mock')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('-o, --output <dir>', 'Output directory for reports', 'persrm-output')
  .option('-c, --config <path>', 'Path to configuration file');

// Analyze command
program
  .command('analyze <path>')
  .description('Analyze a component or directory')
  .action(async (targetPath, options, command) => {
    const parentOptions = command.parent.opts();
    const workspacePath = process.cwd();
    const absolutePath = path.resolve(workspacePath, targetPath);
    
    console.log(chalk.blue('PersRM Analysis'));
    console.log(chalk.gray('---------------------'));
    console.log(chalk.white(`Target: ${absolutePath}`));
    console.log(chalk.white(`Mode: ${parentOptions.mode.toUpperCase()}`));
    
    try {
      // Set environment variable from CLI option
      if (parentOptions.mode) {
        process.env.PERSRM_MODE = parentOptions.mode;
      }
      
      // Determine agent mode
      const agentMode = parentOptions.mode === 'prod' ? AgentMode.PROD : AgentMode.MOCK;
      
      // Configure the agent
      const config: PersRMConfig = {
        projectPath: workspacePath,
        outputDir: path.join(workspacePath, parentOptions.output),
        mode: agentMode,
        verbose: parentOptions.verbose
      };
      
      // Load custom config if specified
      if (parentOptions.config && fs.existsSync(parentOptions.config)) {
        try {
          const customConfig = await fs.readJSON(parentOptions.config);
          Object.assign(config, customConfig);
        } catch (error) {
          console.error(chalk.red(`Error loading config: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }
      
      // Get the appropriate agent
      const agent = getActiveAgent(config, agentMode);
      
      // Run the analysis
      const isDirectory = (await fs.stat(absolutePath)).isDirectory();
      
      console.log(chalk.white(`Starting analysis...`));
      
      if (isDirectory && agent.analyzeDirectory) {
        const results = await agent.analyzeDirectory(absolutePath);
        console.log(chalk.green(`Analysis complete. Analyzed ${results.length} components.`));
      } else {
        const result = await agent.analyze(absolutePath);
        
        if (result && result.summary) {
          console.log(chalk.green(`Analysis complete.`));
          console.log(chalk.white(`Score: ${result.summary.overallScore}/${result.summary.maxScore}`));
          console.log(chalk.white(`Issues: ${result.summary.issues.length}`));
        } else {
          console.log(chalk.red(`Analysis failed.`));
        }
      }
      
      // Save results
      let outputPath = "";
      if (agent.saveResults) {
        outputPath = agent.saveResults();
        console.log(chalk.white(`Results saved to: ${outputPath}`));
      }
      
    } catch (error) {
      console.error(chalk.red(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Optimize command
program
  .command('optimize <path>')
  .description('Analyze and optimize a component or directory')
  .option('--apply', 'Apply suggested optimizations', false)
  .action(async (targetPath, options, command) => {
    const parentOptions = command.parent.opts();
    const workspacePath = process.cwd();
    const absolutePath = path.resolve(workspacePath, targetPath);
    
    console.log(chalk.blue('PersRM Optimization'));
    console.log(chalk.gray('---------------------'));
    console.log(chalk.white(`Target: ${absolutePath}`));
    console.log(chalk.white(`Mode: ${parentOptions.mode.toUpperCase()}`));
    console.log(chalk.white(`Apply changes: ${options.apply ? 'Yes' : 'No'}`));
    
    try {
      // Set environment variable from CLI option
      if (parentOptions.mode) {
        process.env.PERSRM_MODE = parentOptions.mode;
      }
      
      // Determine agent mode
      const agentMode = parentOptions.mode === 'prod' ? AgentMode.PROD : AgentMode.MOCK;
      
      // Configure the agent
      const config: CliExtendedConfig = {
        projectPath: workspacePath,
        outputDir: path.join(workspacePath, parentOptions.output),
        mode: agentMode,
        verbose: parentOptions.verbose,
        autoOptimize: options.apply
      };
      
      // Load custom config if specified
      if (parentOptions.config && fs.existsSync(parentOptions.config)) {
        try {
          const customConfig = await fs.readJSON(parentOptions.config);
          Object.assign(config, customConfig);
        } catch (error) {
          console.error(chalk.red(`Error loading config: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }
      
      // Get the appropriate agent
      const agent = getActiveAgent(config, agentMode);
      
      // Run the optimization
      console.log(chalk.white(`Starting optimization...`));
      
      const result = await agent.optimize(absolutePath);
      
      if (result && result.suggestions) {
        console.log(chalk.green(`Optimization complete.`));
        console.log(chalk.white(`Suggestions: ${result.suggestions.length}`));
        
        if (options.apply) {
          console.log(chalk.green(`Applied optimizations.`));
        } else {
          console.log(chalk.yellow(`Run with --apply to apply suggested optimizations.`));
        }
      } else {
        console.log(chalk.red(`Optimization failed.`));
      }
      
      // Save results
      let outputPath = "";
      if (agent.saveResults) {
        outputPath = agent.saveResults();
        console.log(chalk.white(`Results saved to: ${outputPath}`));
      }
      
    } catch (error) {
      console.error(chalk.red(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Benchmarks command
program
  .command('benchmarks')
  .description('View UX benchmark history and trends')
  .option('--history', 'Show benchmark history', false)
  .option('--trend', 'Show score trend over time', false)
  .option('--diff <id>', 'Compare with previous benchmark')
  .option('--project <name>', 'Filter by project name')
  .option('--component <name>', 'Filter by component name')
  .option('--branch <name>', 'Filter by branch name')
  .option('--limit <number>', 'Limit number of results', '10')
  .action(async (options) => {
    console.log(chalk.blue('PersRM Benchmarks'));
    console.log(chalk.gray('---------------------'));
    
    try {
      // Set up filter
      const filter: BenchmarkFilter = {};
      
      if (options.project) {
        filter.project = options.project;
        console.log(chalk.white(`Project: ${options.project}`));
      }
      
      if (options.component) {
        filter.component = options.component;
        console.log(chalk.white(`Component: ${options.component}`));
      }
      
      if (options.branch) {
        filter.branch = options.branch;
        console.log(chalk.white(`Branch: ${options.branch}`));
      }
      
      const limit = parseInt(options.limit, 10);
      
      // Determine which view to show
      if (options.diff) {
        // Compare specific benchmark with previous one
        const comparison = getBenchmarkComparison(options.diff);
        
        console.log('');
        console.log(chalk.bold.white('Benchmark Comparison'));
        console.log(chalk.gray('---------------------'));
        
        if (!comparison.current) {
          console.log(chalk.red(`Benchmark with ID ${options.diff} not found`));
          return;
        }
        
        // Current benchmark info
        const current = comparison.current;
        console.log(chalk.white(`Current: ${new Date(current.timestamp).toISOString()}`));
        console.log(chalk.white(`Score: ${current.summary.overallScore}/${current.summary.maxScore}`));
        
        if (comparison.previous) {
          // Previous benchmark info
          const previous = comparison.previous;
          console.log(chalk.white(`Previous: ${new Date(previous.timestamp).toISOString()}`));
          console.log(chalk.white(`Score: ${previous.summary.overallScore}/${previous.summary.maxScore}`));
          
          // Delta
          const delta = comparison.delta;
          if (delta) {
            const scoreChange = delta.overallScore;
            const color = scoreChange >= 0 ? chalk.green : chalk.red;
            console.log(color(`Score Change: ${scoreChange >= 0 ? '+' : ''}${scoreChange.toFixed(1)} (${delta.percentChange.toFixed(1)}%)`));
            
            // Phase changes
            console.log('');
            console.log(chalk.bold.white('Phase Changes:'));
            if (delta.phaseDeltas) {
              Object.entries(delta.phaseDeltas).forEach(([phase, change]) => {
                const phaseColor = change >= 0 ? chalk.green : chalk.red;
                console.log(phaseColor(`${phase}: ${change >= 0 ? '+' : ''}${change.toFixed(1)}`));
              });
            }
            
            // Issues
            console.log('');
            console.log(chalk.bold.white('Issues:'));
            console.log(chalk.green(`Resolved: ${delta.resolvedIssues.length}`));
            console.log(chalk.red(`New: ${delta.newIssues.length}`));
            console.log(chalk.white(`Unchanged: ${delta.unchangedIssues.length}`));
          }
        } else {
          console.log(chalk.yellow('No previous benchmark found for comparison'));
        }
      } else if (options.trend) {
        // Show trend over time
        const trend = getBenchmarkTrend(20, filter);
        
        console.log('');
        console.log(chalk.bold.white('Score Trend'));
        console.log(chalk.gray('---------------------'));
        
        if (trend.timestamps.length === 0) {
          console.log(chalk.yellow('No benchmark data available'));
          return;
        }
        
        // Simple ASCII chart for the trend
        const scores = trend.scores;
        const max = Math.max(...scores);
        const min = Math.min(...scores) - 5; // Subtract a little for better visualization
        const range = max - min;
        const height = 10;
        
        // Dates for x-axis
        const dates = trend.timestamps.map(ts => {
          const date = new Date(ts);
          return date.toLocaleDateString();
        });
        
        // Draw chart
        console.log('');
        for (let i = 0; i < height; i++) {
          const row = scores.map(score => {
            const normalizedScore = (score - min) / range;
            const rowPosition = 1 - (i / height);
            return normalizedScore >= rowPosition ? '█' : ' ';
          });
          
          // Y-axis labels on the left (only at certain intervals)
          const yValue = max - (i / height) * range;
          const yLabel = i % 3 === 0 ? yValue.toFixed(0).padStart(3) : '   ';
          
          console.log(`${yLabel} │${row.join('')}`);
        }
        
        // X-axis
        console.log(`    └${'─'.repeat(scores.length)}`);
        
        // Print trend summary
        console.log('');
        console.log(chalk.white(`Latest score: ${scores[scores.length - 1].toFixed(1)}`));
        console.log(chalk.white(`Average score: ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}`));
        
        // Calculate overall trend (positive or negative)
        if (scores.length > 1) {
          const firstScore = scores[0];
          const lastScore = scores[scores.length - 1];
          const overallChange = lastScore - firstScore;
          
          const trendColor = overallChange >= 0 ? chalk.green : chalk.red;
          console.log(trendColor(`Overall trend: ${overallChange >= 0 ? '+' : ''}${overallChange.toFixed(1)} points`));
        }
      } else {
        // Show benchmark history (default)
        const history = getBenchmarkHistory(limit, filter);
        
        console.log('');
        console.log(chalk.bold.white('Benchmark History'));
        console.log(chalk.gray('---------------------'));
        
        if (history.length === 0) {
          console.log(chalk.yellow('No benchmark data available'));
          return;
        }
        
        // Show each benchmark entry with delta information
        history.forEach((entry, index) => {
          const date = new Date(entry.timestamp);
          
          console.log(chalk.white(`${date.toLocaleDateString()} ${date.toLocaleTimeString()}`));
          console.log(chalk.white(`ID: ${entry.id}`));
          console.log(chalk.white(`Score: ${entry.summary.overallScore}/${entry.summary.maxScore}`));
          
          if (entry.summary.appName) {
            console.log(chalk.white(`Project: ${entry.summary.appName}`));
          }
          
          if (entry.summary.componentName) {
            console.log(chalk.white(`Component: ${entry.summary.componentName}`));
          }
          
          if (entry.branch) {
            console.log(chalk.white(`Branch: ${entry.branch}`));
          }
          
          if (entry.delta) {
            const scoreChange = entry.delta.overallScore;
            const color = scoreChange >= 0 ? chalk.green : chalk.red;
            console.log(color(`Score Change: ${scoreChange >= 0 ? '+' : ''}${scoreChange.toFixed(1)} points`));
          }
          
          if (entry.reportUrl) {
            console.log(chalk.blue(`Report: ${entry.reportUrl}`));
          }
          
          if (index < history.length - 1) {
            console.log(chalk.gray('---------------------'));
          }
        });
        
        console.log('');
        console.log(chalk.gray(`Showing ${history.length} of ${limit} results`));
      }
    } catch (error) {
      console.error(chalk.red(`Error retrieving benchmarks: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Generate report command
program
  .command('report [path]')
  .description('Generate a report from analysis/optimization results')
  .option('-f, --format <format>', 'Report format: html, md, json', 'html')
  .action(async (resultPath, options, command) => {
    const parentOptions = command.parent.opts();
    const workspacePath = process.cwd();
    
    // If no path provided, use latest results
    if (!resultPath) {
      resultPath = path.join(workspacePath, parentOptions.output, 'latest-result.json');
    }
    
    const absolutePath = path.resolve(workspacePath, resultPath);
    
    console.log(chalk.blue('PersRM Report Generation'));
    console.log(chalk.gray('---------------------'));
    console.log(chalk.white(`Source: ${absolutePath}`));
    console.log(chalk.white(`Format: ${options.format}`));
    console.log(chalk.white(`Mode: ${parentOptions.mode.toUpperCase()}`));
    
    try {
      // Set environment variable from CLI option
      if (parentOptions.mode) {
        process.env.PERSRM_MODE = parentOptions.mode;
      }
      
      // Determine agent mode
      const agentMode = parentOptions.mode === 'prod' ? AgentMode.PROD : AgentMode.MOCK;
      
      // Configure the agent
      const config: PersRMConfig = {
        projectPath: workspacePath,
        outputDir: path.join(workspacePath, parentOptions.output),
        mode: agentMode,
        verbose: parentOptions.verbose
      };
      
      // Get the appropriate agent
      const agent = getActiveAgent(config, agentMode);
      
      // Generate the report
      console.log(chalk.white(`Generating report...`));
      
      if (agent.generateReportFromResult) {
        const reportResult = await agent.generateReportFromResult(absolutePath, {
          format: options.format
        });
        
        if (reportResult && reportResult.report) {
          console.log(chalk.green(`Report generation complete.`));
          console.log(chalk.white(`Report saved to: ${reportResult.report}`));
        } else {
          console.log(chalk.red(`Report generation failed.`));
        }
      } else {
        console.log(chalk.red('Report generation not supported by the current agent.'));
      }
      
    } catch (error) {
      console.error(chalk.red(`Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Feedback command
program
  .command('feedback')
  .description('Simulate user feedback and learn from UX performance')
  .option('--simulate [flow]', 'Run user flow simulations')
  .option('--learn', 'Update learning insights', false)
  .option('--stuck', 'List stagnant components', false)
  .option('--component <name>', 'Target specific component')
  .option('--iterations <number>', 'Number of simulation iterations', '10')
  .action(async (options, command) => {
    const parentOptions = command.parent.opts();
    const workspacePath = process.cwd();
    
    console.log(chalk.blue('PersRM Feedback Simulation'));
    console.log(chalk.gray('---------------------'));
    console.log(chalk.white(`Mode: ${parentOptions.mode.toUpperCase()}`));
    
    try {
      // Set environment variable from CLI option
      if (parentOptions.mode) {
        process.env.PERSRM_MODE = parentOptions.mode;
      }
      
      // Determine agent mode
      const agentMode = parentOptions.mode === 'prod' ? AgentMode.PROD : AgentMode.MOCK;
      
      // Configure the agent
      const config: PersRMConfig = {
        projectPath: workspacePath,
        outputDir: path.join(workspacePath, parentOptions.output),
        verbose: parentOptions.verbose
      };
      
      // Get the appropriate agent
      const agent = getActiveAgent(config, agentMode);
      
      // Import the simulator and learner modules
      const { 
        generateSampleUserFlows, 
        simulateUserFlow, 
        createUserFlow 
      } = await import('../lib/feedback/simulator');
      
      const { 
        getStagnantComponents,
        getAllComponentData,
        addFlowResults,
        trackOptimization
      } = await import('../lib/feedback/learner');
      
      // Run simulations if requested
      if (options.simulate) {
        console.log(chalk.white(`Running user flow simulations...`));
        
        // Get available flows
        const flows = generateSampleUserFlows();
        
        // If flow name is provided, find that flow, otherwise use the first one
        let targetFlow = flows[0];
        if (typeof options.simulate === 'string') {
          const namedFlow = flows.find(f => 
            f.name.toLowerCase() === options.simulate.toLowerCase()
          );
          if (namedFlow) {
            targetFlow = namedFlow;
          } else {
            console.log(chalk.yellow(`Flow "${options.simulate}" not found. Using "${targetFlow.name}" instead.`));
          }
        }
        
        console.log(chalk.white(`Selected flow: ${targetFlow.name}`));
        console.log(chalk.white(`Steps: ${targetFlow.steps.length}`));
        
        // If component is specified, update the component map
        let componentMap = {};
        
        if (options.component) {
          console.log(chalk.white(`Targeting component: ${options.component}`));
          
          // Analyze the component
          const componentPath = path.resolve(workspacePath, options.component);
          const analysisResult = await agent.analyze(componentPath);
          
          if (analysisResult && analysisResult.summary) {
            componentMap[options.component] = analysisResult.summary;
          } else {
            console.log(chalk.red(`Failed to analyze component ${options.component}`));
            process.exit(1);
          }
        } else {
          // Get the latest analysis results
          const results = agent.getResults();
          
          if (results && results.length > 0) {
            // Create a map of component name to summary
            results.forEach(result => {
              if (result.summary && result.summary.componentName) {
                componentMap[result.summary.componentName] = result.summary;
              }
            });
          }
          
          if (Object.keys(componentMap).length === 0) {
            console.log(chalk.yellow('No analyzed components found. Run analyze command first or specify a component.'));
            process.exit(1);
          }
        }
        
        // Run the simulation
        const iterations = parseInt(options.iterations, 10);
        console.log(chalk.white(`Running ${iterations} iterations...`));
        
        const simulationResults = simulateUserFlow(targetFlow, componentMap, {
          iterations: iterations,
          noiseLevel: 0.3,
          userExpertiseLevel: 0.5,
          devicePerformance: 0.8,
          networkCondition: 0.7
        });
        
        // Calculate average statistics
        const avgSuccessRate = simulationResults.reduce((sum, r) => sum + r.successRate, 0) / simulationResults.length;
        const avgCompletionRate = simulationResults.reduce((sum, r) => sum + r.completionRate, 0) / simulationResults.length;
        const avgConfusionRate = simulationResults.reduce((sum, r) => sum + r.confusionRate, 0) / simulationResults.length;
        const avgOverallScore = simulationResults.reduce((sum, r) => sum + r.overallScore, 0) / simulationResults.length;
        
        console.log('');
        console.log(chalk.bold.white('Simulation Results:'));
        console.log(chalk.gray('---------------------'));
        console.log(chalk.white(`Success Rate: ${(avgSuccessRate * 100).toFixed(1)}%`));
        console.log(chalk.white(`Completion Rate: ${(avgCompletionRate * 100).toFixed(1)}%`));
        console.log(chalk.white(`Confusion Rate: ${(avgConfusionRate * 100).toFixed(1)}%`));
        console.log(chalk.white(`Overall Score: ${avgOverallScore.toFixed(1)}/100`));
        
        // Add simulation results to learning data
        if (options.learn) {
          console.log(chalk.white(`Adding results to learning system...`));
          addFlowResults(simulationResults, targetFlow, componentMap);
          console.log(chalk.green(`Learning data updated.`));
        }
      }
      
      // Show learning insights if requested
      if (options.learn && !options.simulate) {
        console.log(chalk.white(`Updating learning insights...`));
        
        // Get the latest analysis results
        const results = agent.getResults();
        
        if (results && results.length > 0) {
          // Create a map of component name to summary
          const componentMap = {};
          results.forEach(result => {
            if (result.summary && result.summary.componentName) {
              componentMap[result.summary.componentName] = result.summary;
            }
          });
          
          // Create a minimal user flow for learning
          const flow = createUserFlow(
            'Learning Update',
            'Updating learning data with latest analysis',
            []
          );
          
          // Add to learning data
          addFlowResults([], flow, componentMap);
          console.log(chalk.green(`Learning data updated with latest analysis.`));
        } else {
          console.log(chalk.yellow('No analyzed components found. Run analyze command first.'));
        }
      }
      
      // List stagnant components if requested
      if (options.stuck) {
        console.log(chalk.white(`Checking for stagnant components...`));
        
        const stagnantComponents = getStagnantComponents(3); // 3+ runs without improvement
        
        console.log('');
        console.log(chalk.bold.white('Stagnant Components:'));
        console.log(chalk.gray('---------------------'));
        
        if (stagnantComponents.length === 0) {
          console.log(chalk.green('No stagnant components detected.'));
        } else {
          stagnantComponents.forEach(component => {
            console.log(chalk.white(`- ${component.componentName}`));
            console.log(chalk.gray(`  Stagnant since: ${new Date(component.stagnantSince || '').toLocaleDateString()}`));
            console.log(chalk.gray(`  Optimization attempts: ${component.optimizationAttempts}`));
            
            if (component.suggestions.length > 0) {
              console.log(chalk.gray(`  Suggestions:`));
              component.suggestions
                .filter(s => !s.implementedAt)
                .forEach(suggestion => {
                  const priorityColor = 
                    suggestion.priority === 'high' ? chalk.red : 
                    suggestion.priority === 'medium' ? chalk.yellow : 
                    chalk.blue;
                  
                  console.log(priorityColor(`    ${suggestion.description} (${suggestion.priority.toUpperCase()})`));
                });
            }
            
            console.log('');
          });
        }
        
        // Get all component data for context
        const allComponents = getAllComponentData();
        
        console.log(chalk.white(`Total components tracked: ${allComponents.length}`));
        console.log(chalk.white(`Stagnant components: ${stagnantComponents.length}`));
        
        if (allComponents.length > 0) {
          const avgImprovementRate = allComponents.reduce((sum, c) => sum + c.improvementRate, 0) / allComponents.length;
          console.log(chalk.white(`Average improvement rate: ${(avgImprovementRate * 100).toFixed(1)}%`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`Feedback command failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Sync command
program
  .command('sync')
  .description('Manage external integrations like Notion and Slack')
  .option('--notion-token <token>', 'Notion API token')
  .option('--notion-db <id>', 'Notion database ID')
  .option('--slack-webhook <url>', 'Slack webhook URL')
  .option('--slack-channel <n>', 'Slack channel name')
  .option('--enable-notion', 'Enable Notion integration')
  .option('--disable-notion', 'Disable Notion integration')
  .option('--enable-slack', 'Enable Slack integration')
  .option('--disable-slack', 'Disable Slack integration')
  .option('--auto-sync', 'Enable automatic sync for both integrations')
  .option('--no-auto-sync', 'Disable automatic sync for both integrations')
  .option('--min-severity <level>', 'Minimum severity level for Slack alerts (info, warning, error, critical)')
  .option('--push <type>', 'Push data to configured integrations (analysis, benchmark, learning, regression, insights)')
  .option('--test', 'Test the configured integrations')
  .option('--summary', 'Show only summary information when pushing data')
  .option('--failures', 'Only push failed components/analyses (with critical/error issues)')
  .option('--last <n>', 'Sync the last N analysis results instead of just the latest', '1')
  .option('--copy-links', 'Generate and display copyable links to Notion/Slack', false)
  .option('--regression-threshold <num>', 'Score delta threshold to trigger regression alerts', '-5')
  .option('--organize-by <field>', 'Organization field for Notion data (project, component, phase, date)', 'project')
  .option('--format <style>', 'Formatting style for Slack messages (compact, detailed)', 'detailed')
  .option('--group-by <field>', 'Group entries in Notion (project, component, score, date)', 'project')
  .option('--enable-ai-insights', 'Enable AI-generated insights for regressions')
  .option('--force-insights', 'Generate and push AI insights without waiting for regressions')
  .action(async (options) => {
    console.log(chalk.blue('PersRM External Integrations'));
    console.log(chalk.gray('---------------------'));
    
    try {
      // Update Notion config if options provided
      if (options.notionToken || options.notionDb || options.enableNotion || options.disableNotion || options.groupBy || options.organizeBy) {
        const notionConfig = {};
        
        if (options.notionToken) {
          notionConfig.token = options.notionToken;
          console.log(chalk.white('Updated Notion API token'));
        }
        
        if (options.notionDb) {
          notionConfig.databaseId = options.notionDb;
          console.log(chalk.white(`Updated Notion database ID: ${options.notionDb}`));
        }
        
        if (options.enableNotion) {
          notionConfig.enabled = true;
          console.log(chalk.green('Enabled Notion integration'));
        } else if (options.disableNotion) {
          notionConfig.enabled = false;
          console.log(chalk.yellow('Disabled Notion integration'));
        }
        
        if (options.autoSync !== undefined) {
          notionConfig.autoSync = options.autoSync;
          const status = options.autoSync ? 'enabled' : 'disabled';
          console.log(chalk.white(`Auto-sync for Notion ${status}`));
        }
        
        if (options.organizeBy) {
          notionConfig.organizeBy = options.organizeBy;
          console.log(chalk.white(`Set Notion organization field to: ${options.organizeBy}`));
        }
        
        if (options.groupBy) {
          notionConfig.groupBy = options.groupBy;
          console.log(chalk.white(`Set Notion grouping to: ${options.groupBy}`));
        }
        
        updateNotionConfig(notionConfig);
      }
      
      // Update Slack config if options provided
      if (options.slackWebhook || options.slackChannel || options.enableSlack || options.disableSlack || options.minSeverity || options.format || options.enableAiInsights) {
        const slackConfig = {};
        
        if (options.slackWebhook) {
          slackConfig.webhookUrl = options.slackWebhook;
          console.log(chalk.white('Updated Slack webhook URL'));
        }
        
        if (options.slackChannel) {
          slackConfig.channel = options.slackChannel;
          console.log(chalk.white(`Updated Slack channel: ${options.slackChannel}`));
        }
        
        if (options.enableSlack) {
          slackConfig.enabled = true;
          console.log(chalk.green('Enabled Slack integration'));
        } else if (options.disableSlack) {
          slackConfig.enabled = false;
          console.log(chalk.yellow('Disabled Slack integration'));
        }
        
        if (options.minSeverity) {
          slackConfig.minSeverity = options.minSeverity;
          console.log(chalk.white(`Set minimum severity level for Slack: ${options.minSeverity}`));
        }
        
        if (options.autoSync !== undefined) {
          slackConfig.autoSync = options.autoSync;
          const status = options.autoSync ? 'enabled' : 'disabled';
          console.log(chalk.white(`Auto-sync for Slack ${status}`));
        }
        
        if (options.format) {
          slackConfig.messageFormat = options.format;
          console.log(chalk.white(`Set Slack message format to: ${options.format}`));
        }
        
        if (options.enableAiInsights) {
          slackConfig.aiInsights = true;
          console.log(chalk.green('Enabled AI-generated insights for Slack'));
        }
        
        updateSlackConfig(slackConfig);
      }
      
      // Push data to integrations if requested
      if (options.push) {
        // Get the latest results
        const workspacePath = process.cwd();
        const parentOptions = program.opts();
        const outputDir = path.join(workspacePath, parentOptions.output || 'persrm-output');
        
        // Handle --last option to sync multiple recent results
        const lastN = parseInt(options.last, 10) || 1;
        
        // Find all analysis result files
        let resultFiles = [];
        try {
          // Get all analysis files sorted by timestamp (newest first)
          const allFiles = fs.readdirSync(outputDir)
            .filter(file => file.startsWith('result-') && file.endsWith('.json'))
            .map(file => {
              const filePath = path.join(outputDir, file);
              return {
                path: filePath,
                time: fs.statSync(filePath).mtime.getTime(),
                name: file
              };
            })
            .sort((a, b) => b.time - a.time); // Sort newest first
            
          resultFiles = allFiles.slice(0, lastN).map(file => file.path);
          
          if (resultFiles.length === 0) {
            console.error(chalk.red('No analysis results found. Run analyze command first.'));
            return;
          }
        } catch (error) {
          console.error(chalk.red(`Error looking for analysis results: ${error instanceof Error ? error.message : 'Unknown error'}`));
          return;
        }
        
        // Get Git info if available
        let gitInfo = {};
        try {
          const { getGitInfo } = await import('../lib/persrm/git-info');
          gitInfo = await getGitInfo();
        } catch (error) {
          console.log(chalk.yellow('Git information not available.'));
        }
        
        // Store links for later display
        const notionLinks = [];
        const slackLinks = [];
        
        // Determine the right base metadata to use
        const baseMetadata = {
          branch: gitInfo.branch || 'main',
          commitSha: gitInfo.commitSha,
          author: gitInfo.author
        };
        
        // Process each result file
        for (const resultPath of resultFiles) {
          try {
            // Read the result file
            const results = await fs.readJSON(resultPath);
            
            // Skip if no summary
            if (!results.summary) {
              console.log(chalk.yellow(`No summary in ${path.basename(resultPath)}, skipping.`));
              continue;
            }
            
            // Skip if failures-only mode and no critical/error issues
            if (options.failures) {
              const hasCriticalIssues = results.summary.issues.some(issue => 
                issue.severity === 'critical' || issue.severity === 'error'
              );
              
              if (!hasCriticalIssues) {
                if (!options.summary) {
                  console.log(chalk.gray(`Skipping ${path.basename(resultPath)}: No critical/error issues.`));
                }
                continue;
              }
            }
            
            // Create metadata with report URL
            const metadata = {
              ...baseMetadata,
              reportUrl: results.reportUrl || null
            };
            
            // Show file being synced if not in summary mode
            if (!options.summary) {
              console.log(chalk.white(`\nSyncing ${path.basename(resultPath)}...`));
              
              // Log component info
              console.log(chalk.gray(
                `Component: ${results.summary.componentName || 'N/A'}, ` +
                `Project: ${results.summary.appName || 'N/A'}, ` +
                `Score: ${results.summary.overallScore}/${results.summary.maxScore}`
              ));
            }
            
            // Push based on type
            if (options.push === 'analysis') {
              // Push to Notion if configured
              if (isNotionConfigured()) {
                const { pushAnalysisSummary } = await import('../lib/integrations/notion-sync');
                const notionResult = await pushAnalysisSummary(results.summary, metadata);
                
                if (notionResult) {
                  if (options.summary) {
                    process.stdout.write(chalk.green('N'));
                  } else {
                    console.log(chalk.green('Successfully pushed to Notion'));
                  }
                  
                  // Store Notion link for later display
                  if (options.copyLinks) {
                    const notionPageUrl = `https://notion.so/${notionResult.replace(/-/g, '')}`;
                    notionLinks.push({
                      component: results.summary.componentName || results.summary.appName || 'Unknown',
                      url: notionPageUrl
                    });
                  }
                } else {
                  if (options.summary) {
                    process.stdout.write(chalk.red('N'));
                  } else {
                    console.log(chalk.red('Failed to push to Notion'));
                  }
                }
              }
              
              // Push to Slack if configured
              if (isSlackConfigured()) {
                const { sendAnalysisToSlack } = await import('../lib/integrations/slack-sync');
                const slackResult = await sendAnalysisToSlack(results.summary, metadata);
                
                if (slackResult) {
                  if (options.summary) {
                    process.stdout.write(chalk.green('S'));
                  } else {
                    console.log(chalk.green('Successfully sent to Slack'));
                  }
                  
                  // Store Slack link for display later (if channel name is available)
                  if (options.copyLinks) {
                    const { getSlackConfig } = await import('../lib/integrations/slack-sync');
                    const slackConfig = getSlackConfig();
                    if (slackConfig && slackConfig.channel && slackConfig.channel.startsWith('#')) {
                      slackLinks.push({
                        component: results.summary.componentName || results.summary.appName || 'Unknown',
                        channel: slackConfig.channel
                      });
                    }
                  }
                } else {
                  if (options.summary) {
                    process.stdout.write(chalk.red('S'));
                  } else {
                    console.log(chalk.red('Failed to send to Slack'));
                  }
                }
              }
            } else if (options.push === 'benchmark') {
              // Log benchmark for history
              const { logBenchmark } = await import('../lib/analytics/benchmark');
              const benchmarkEntry = await logBenchmark(results.summary, baseMetadata);
              
              // Get previous benchmark for comparison if available
              const { getBenchmarkHistory } = await import('../lib/analytics/benchmark');
              const history = getBenchmarkHistory(2, {
                component: results.summary.componentName,
                project: results.summary.appName
              });
              
              const previousEntry = history.length > 1 ? history[1] : null;
              
              // Push to Notion if configured
              if (isNotionConfigured()) {
                const { pushBenchmarkData } = await import('../lib/integrations/notion-sync');
                const notionResult = await pushBenchmarkData(benchmarkEntry);
                
                if (notionResult) {
                  if (options.summary) {
                    process.stdout.write(chalk.green('N'));
                  } else {
                    console.log(chalk.green('Successfully pushed benchmark to Notion'));
                  }
                  
                  // Store Notion link for later display
                  if (options.copyLinks) {
                    const notionPageUrl = `https://notion.so/${notionResult.replace(/-/g, '')}`;
                    notionLinks.push({
                      component: results.summary.componentName || results.summary.appName || 'Unknown',
                      url: notionPageUrl,
                      type: 'benchmark'
                    });
                  }
                } else {
                  if (options.summary) {
                    process.stdout.write(chalk.red('N'));
                  } else {
                    console.log(chalk.red('Failed to push benchmark to Notion'));
                  }
                }
              }
              
              // Push to Slack if configured
              if (isSlackConfigured()) {
                const { sendBenchmarkToSlack } = await import('../lib/integrations/slack-sync');
                const slackResult = await sendBenchmarkToSlack(
                  results.summary,
                  previousEntry ? previousEntry.summary : null,
                  metadata
                );
                
                if (slackResult) {
                  if (options.summary) {
                    process.stdout.write(chalk.green('S'));
                  } else {
                    console.log(chalk.green('Successfully sent benchmark to Slack'));
                  }
                } else {
                  if (options.summary) {
                    process.stdout.write(chalk.red('S'));
                  } else {
                    console.log(chalk.red('Failed to send benchmark to Slack'));
                  }
                }
              }
              
              // Check for regressions and send regression alerts if score dropped
              // Use the regression threshold provided in options
              const regressionThreshold = parseFloat(options.regressionThreshold || '-5');
              if (previousEntry && benchmarkEntry.delta && benchmarkEntry.delta.overallScore < regressionThreshold) {
                if (!options.summary) {
                  console.log(chalk.yellow(`Regression detected: ${benchmarkEntry.delta.overallScore.toFixed(1)} points!`));
                }
                
                // Send regression alert to Slack
                if (isSlackConfigured()) {
                  const { sendRegressionAlertToSlack } = await import('../lib/integrations/slack-sync');
                  
                  // Create affected phases array
                  const affectedPhases = Object.entries(benchmarkEntry.delta.phaseDeltas)
                    .filter(([_, delta]) => delta < 0)
                    .map(([name, delta]) => ({ name, delta }));
                  
                  await sendRegressionAlertToSlack({
                    id: benchmarkEntry.id,
                    component: results.summary.componentName || 'Unknown component',
                    project: results.summary.appName,
                    previousScore: previousEntry.summary.overallScore,
                    currentScore: results.summary.overallScore,
                    percentChange: benchmarkEntry.delta.percentChange,
                    newIssues: benchmarkEntry.delta.newIssues.length,
                    affectedPhases,
                    reportUrl: metadata.reportUrl
                  });
                  
                  if (!options.summary) {
                    console.log(chalk.green('Regression alert sent to Slack'));
                  }
                  
                  // Generate and send AI insights if enabled
                  const { getSlackConfig } = await import('../lib/integrations/slack-sync');
                  const slackConfig = getSlackConfig();
                  
                  if (slackConfig && slackConfig.aiInsights) {
                    const { sendAIInsightsToSlack } = await import('../lib/integrations/slack-sync');
                    
                    // Create mock insights based on regression data
                    // In a real implementation, this would call an AI service
                    const insights = {
                      component: results.summary.componentName || 'Unknown component',
                      title: `UX Improvement Recommendations for ${results.summary.componentName}`,
                      summary: `Analysis of the ${results.summary.componentName} component revealed a regression of ${Math.abs(benchmarkEntry.delta.overallScore).toFixed(1)} points. The current score is ${results.summary.overallScore.toFixed(1)}/100.`,
                      recommendations: [
                        'Review recent changes to the component that might have affected user interaction flow',
                        'Consider reverting changes that negatively impacted the most severely affected phases',
                        'Add additional test coverage for critical user paths'
                      ],
                      reportUrl: metadata.reportUrl
                    };
                    
                    await sendAIInsightsToSlack(insights);
                    
                    if (!options.summary) {
                      console.log(chalk.green('AI insights sent to Slack'));
                    }
                  }
                }
              }
            } else if (options.push === 'regression') {
              // Push only regression data
              console.log(chalk.white('Checking for regressions to report...'));
              
              // Find regressions
              const { findRegressions } = await import('../lib/analytics/benchmark');
              const regressions = findRegressions(5, { // Find regressions with at least 5% drop
                component: results.summary.componentName,
                project: results.summary.appName
              });
              
              if (regressions.length === 0) {
                console.log(chalk.green('No significant regressions found.'));
                continue;
              }
              
              console.log(chalk.yellow(`Found ${regressions.length} regressions to report.`));
              
              // Send regression alerts to Slack
              if (isSlackConfigured()) {
                const { sendRegressionAlertToSlack } = await import('../lib/integrations/slack-sync');
                
                let successCount = 0;
                for (const regression of regressions) {
                  // Create affected phases array
                  const affectedPhases = Object.entries(regression.phaseDeltas || {})
                    .filter(([_, delta]) => delta < 0)
                    .map(([name, delta]) => ({ name, delta }));
                  
                  const success = await sendRegressionAlertToSlack({
                    id: regression.id,
                    component: regression.component || 'Unknown component',
                    project: regression.project || 'Unknown project',
                    previousScore: regression.previousScore,
                    currentScore: regression.currentScore,
                    percentChange: regression.percentChange,
                    newIssues: regression.newIssues || 0,
                    affectedPhases,
                    reportUrl: regression.reportUrl || metadata.reportUrl
                  });
                  
                  if (success) successCount++;
                  
                  if (options.summary) {
                    process.stdout.write(success ? chalk.green('R') : chalk.red('R'));
                    process.stdout.write(' ');
                  }
                }
                
                if (!options.summary) {
                  console.log(chalk.green(`Successfully sent ${successCount}/${regressions.length} regression alerts to Slack`));
                } else {
                  console.log(''); // Newline after summary output
                }
              }
            } else if (options.push === 'insights') {
              // Push AI-generated insights
              console.log(chalk.white('Generating and sending AI insights...'));
              
              // In a real implementation, this would call an AI service to generate insights
              if (isSlackConfigured()) {
                const { sendAIInsightsToSlack } = await import('../lib/integrations/slack-sync');
                
                // Generate mock insights
                const insights = {
                  component: results.summary.componentName || 'Unknown component',
                  title: `UX Improvement Recommendations for ${results.summary.componentName}`,
                  summary: `Analysis of the ${results.summary.componentName} component revealed several areas for improvement. The overall score is ${results.summary.overallScore.toFixed(1)}/100, with key issues identified in user flow and accessibility.`,
                  recommendations: [
                    'Improve form validation feedback to be more immediate and descriptive',
                    'Add keyboard navigation support for all interactive elements',
                    'Optimize loading states to provide better user feedback during async operations'
                  ],
                  reportUrl: metadata.reportUrl
                };
                
                const success = await sendAIInsightsToSlack(insights);
                
                if (success) {
                  if (options.summary) {
                    process.stdout.write(chalk.green('I'));
                  } else {
                    console.log(chalk.green('Successfully sent AI insights to Slack'));
                  }
                } else {
                  if (options.summary) {
                    process.stdout.write(chalk.red('I'));
                  } else {
                    console.log(chalk.red('Failed to send AI insights to Slack'));
                  }
                }
                
                if (options.summary) {
                  console.log(''); // Newline after summary output
                }
              }
            } else if (options.push === 'learning') {
              console.log(chalk.white('Pushing learning data to configured integrations...'));
              
              // Get learning data
              const { getAllComponentData } = await import('../lib/feedback/learner');
              const learningData = getAllComponentData();
              
              if (learningData.length === 0) {
                console.log(chalk.yellow('No learning data available.'));
                return;
              }
              
              // Store links for later display
              const notionLinks = [];
              
              if (isNotionConfigured()) {
                const { pushLearningData } = await import('../lib/integrations/notion-sync');
                
                let successCount = 0;
                for (const componentData of learningData) {
                  const notionResult = await pushLearningData(componentData);
                  if (notionResult) {
                    successCount++;
                    
                    // Store Notion link for later display
                    if (options.copyLinks) {
                      const notionPageUrl = `https://notion.so/${notionResult.replace(/-/g, '')}`;
                      notionLinks.push({
                        component: componentData.componentName,
                        url: notionPageUrl,
                        type: 'learning'
                      });
                    }
                  }
                  
                  if (options.summary) {
                    process.stdout.write(notionResult ? chalk.green('N') : chalk.red('N'));
                    process.stdout.write(' ');
                  }
                }
                
                if (!options.summary) {
                  console.log(chalk.green(`Successfully pushed ${successCount}/${learningData.length} components to Notion`));
                } else {
                  console.log(''); // Newline after summary output
                }
              }
              
              if (isSlackConfigured()) {
                const { sendLearningToSlack } = await import('../lib/integrations/slack-sync');
                
                // Only send data for components with high-priority suggestions
                const componentsWithHighPriority = learningData.filter(
                  data => data.suggestions.some(s => s.priority === 'high')
                );
                
                let successCount = 0;
                for (const componentData of componentsWithHighPriority) {
                  const slackResult = await sendLearningToSlack(componentData);
                  if (slackResult) successCount++;
                  
                  if (options.summary) {
                    process.stdout.write(slackResult ? chalk.green('S') : chalk.red('S'));
                    process.stdout.write(' ');
                  }
                }
                
                if (!options.summary) {
                  console.log(chalk.green(`Successfully sent ${successCount}/${componentsWithHighPriority.length} components to Slack`));
                } else {
                  console.log(''); // Newline after summary output
                }
              }
              
              // Display copyable links if requested
              if (options.copyLinks && notionLinks.length > 0) {
                console.log('');
                console.log(chalk.blue('Generated Links:'));
                
                console.log(chalk.bold('\nNotion Pages:'));
                notionLinks.forEach(link => {
                  console.log(chalk.white(`${link.component} (${link.type}):`));
                  console.log(chalk.blue.underline(link.url));
                });
              }
            }
            
            if (options.summary) {
              process.stdout.write(' ');
            }
          } catch (error) {
            console.error(chalk.red(`Error processing ${path.basename(resultPath)}: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        }
        
        // Display newline after summary output
        if (options.summary) {
          console.log('');
        }
        
        // Display copyable links if requested
        if (options.copyLinks && (notionLinks.length > 0 || slackLinks.length > 0)) {
          console.log('');
          console.log(chalk.blue('Generated Links:'));
          
          if (notionLinks.length > 0) {
            console.log(chalk.bold('\nNotion Pages:'));
            notionLinks.forEach(link => {
              console.log(chalk.white(`${link.component} (${link.type || 'analysis'}):`));
              console.log(chalk.blue.underline(link.url));
            });
          }
          
          if (slackLinks.length > 0) {
            console.log(chalk.bold('\nSlack Channels:'));
            slackLinks.forEach(link => {
              console.log(chalk.white(`${link.component}:`));
              console.log(chalk.blue.underline(`slack://channel?team=TEAMID&id=${link.channel.substring(1)}`));
              console.log(chalk.gray(`(Copy and replace TEAMID with your Slack team ID)`));
            });
          }
        }
      }
      
      // Test integrations if requested
      if (options.test) {
        console.log(chalk.white('Testing configured integrations...'));
        
        // Test Notion
        if (isNotionConfigured()) {
          try {
            const { testNotionConnection } = await import('../lib/integrations/notion-sync');
            const notionResult = await testNotionConnection();
            
            if (notionResult) {
              console.log(chalk.green('✓ Notion integration is working correctly'));
              
              // Display database URL for easy access
              const { getNotionConfig } = await import('../lib/integrations/notion-sync');
              const notionConfig = getNotionConfig();
              if (notionConfig && notionConfig.databaseId) {
                const notionDbUrl = `https://notion.so/${notionConfig.databaseId.replace(/-/g, '')}`;
                console.log(chalk.blue(`  Database URL: ${notionDbUrl}`));
              }
            } else {
              console.log(chalk.red('✗ Notion integration test failed'));
            }
          } catch (error) {
            console.log(chalk.red(`✗ Notion integration error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        } else {
          console.log(chalk.yellow('⚠ Notion integration is not configured'));
        }
        
        // Test Slack
        if (isSlackConfigured()) {
          try {
            const { testSlackConnection } = await import('../lib/integrations/slack-sync');
            const slackResult = await testSlackConnection();
            
            if (slackResult) {
              console.log(chalk.green('✓ Slack integration is working correctly'));
              
              // Display channel info if available
              const { getSlackConfig } = await import('../lib/integrations/slack-sync');
              const slackConfig = getSlackConfig();
              if (slackConfig && slackConfig.channel) {
                console.log(chalk.blue(`  Channel: ${slackConfig.channel}`));
              }
            } else {
              console.log(chalk.red('✗ Slack integration test failed'));
            }
          } catch (error) {
            console.log(chalk.red(`✗ Slack integration error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        } else {
          console.log(chalk.yellow('⚠ Slack integration is not configured'));
        }
      }
      
      // If no options were provided, show current status
      if (!Object.keys(options).some(key => options[key] !== undefined && key !== '_name')) {
        // Show Notion status
        console.log(chalk.white('Notion Integration:'));
        if (isNotionConfigured()) {
          console.log(chalk.green('  Status: Enabled and configured'));
          
          // Display database URL for easy access
          const { getNotionConfig } = await import('../lib/integrations/notion-sync');
          const notionConfig = getNotionConfig();
          if (notionConfig && notionConfig.databaseId) {
            const notionDbUrl = `https://notion.so/${notionConfig.databaseId.replace(/-/g, '')}`;
            console.log(chalk.blue(`  Database URL: ${notionDbUrl}`));
            
            if (notionConfig.organizeBy) {
              console.log(chalk.blue(`  Organized by: ${notionConfig.organizeBy}`));
            }
            
            if (notionConfig.groupBy) {
              console.log(chalk.blue(`  Grouped by: ${notionConfig.groupBy}`));
            }
          }
        } else {
          console.log(chalk.yellow('  Status: Not fully configured'));
        }
        
        // Show Slack status
        console.log(chalk.white('Slack Integration:'));
        if (isSlackConfigured()) {
          console.log(chalk.green('  Status: Enabled and configured'));
          
          // Display channel info if available
          const { getSlackConfig } = await import('../lib/integrations/slack-sync');
          const slackConfig = getSlackConfig();
          if (slackConfig) {
            if (slackConfig.channel) {
              console.log(chalk.blue(`  Channel: ${slackConfig.channel}`));
            }
            
            if (slackConfig.minSeverity) {
              console.log(chalk.blue(`  Min severity: ${slackConfig.minSeverity}`));
            }
            
            if (slackConfig.messageFormat) {
              console.log(chalk.blue(`  Message format: ${slackConfig.messageFormat}`));
            }
            
            console.log(chalk.blue(`  AI insights: ${slackConfig.aiInsights ? 'Enabled' : 'Disabled'}`));
          }
        } else {
          console.log(chalk.yellow('  Status: Not fully configured'));
        }
        
        // Show setup instructions
        console.log('');
        console.log(chalk.white('Setup Instructions:'));
        console.log(chalk.gray('  To configure Notion:'));
        console.log(chalk.gray('    persrm sync --notion-token YOUR_TOKEN --notion-db DATABASE_ID --enable-notion'));
        console.log(chalk.gray('  To configure Slack:'));
        console.log(chalk.gray('    persrm sync --slack-webhook YOUR_WEBHOOK_URL --enable-slack'));
        console.log('');
        console.log(chalk.white('Usage Examples:'));
        console.log(chalk.gray('  Push analysis results:'));
        console.log(chalk.gray('    persrm sync --push analysis'));
        console.log(chalk.gray('  Push benchmark data:'));
        console.log(chalk.gray('    persrm sync --push benchmark'));
        console.log(chalk.gray('  Push regression alerts:'));
        console.log(chalk.gray('    persrm sync --push regression'));
        console.log(chalk.gray('  Push AI insights:'));
        console.log(chalk.gray('    persrm sync --push insights'));
        console.log(chalk.gray('  Push last 5 analysis results:'));
        console.log(chalk.gray('    persrm sync --push analysis --last 5'));
        console.log(chalk.gray('  Push only failed components:'));
        console.log(chalk.gray('    persrm sync --push analysis --failures'));
        console.log(chalk.gray('  Change Notion organization:'));
        console.log(chalk.gray('    persrm sync --organize-by phase --group-by project'));
        console.log(chalk.gray('  Enable AI insights for regressions:'));
        console.log(chalk.gray('    persrm sync --enable-ai-insights'));
        console.log(chalk.gray('  Test integrations:'));
        console.log(chalk.gray('    persrm sync --test'));
      }
    } catch (error) {
      console.error(chalk.red(`Sync command failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(); 