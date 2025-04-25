#!/usr/bin/env node

import { Command } from 'commander';
import { RetentionService, LogResult } from '../lib/memory/retentionService';
import { FeedbackAnalyzer } from '../lib/retraining/feedbackAnalyzer';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';

const program = new Command();

program
  .name('feedback-loop')
  .description('Manage and analyze learning system feedback')
  .version('1.0.0');

// Command to summarize learning logs
program
  .command('summary')
  .description('Show a summary of learning logs')
  .action(async () => {
    const spinner = ora('Loading learning logs...').start();
    
    try {
      const retentionService = new RetentionService();
      const stats = await retentionService.getStats();
      
      spinner.succeed('Summary loaded');
      
      // Create a table for overall stats
      const overallTable = new Table({
        head: [
          chalk.cyan('Total Entries'),
          chalk.green('Success'),
          chalk.yellow('Improved'),
          chalk.red('Failure'),
        ],
      });
      
      overallTable.push([
        stats.totalEntries,
        `${stats.successCount} (${Math.round(stats.successCount / stats.totalEntries * 100)}%)`,
        `${stats.improvedCount} (${Math.round(stats.improvedCount / stats.totalEntries * 100)}%)`,
        `${stats.failureCount} (${Math.round(stats.failureCount / stats.totalEntries * 100)}%)`,
      ]);
      
      console.log('\nOverall Statistics:');
      console.log(overallTable.toString());
      
      // Create a table for component breakdown
      const componentTable = new Table({
        head: [
          chalk.cyan('Component'),
          chalk.cyan('Count'),
          chalk.cyan('Percentage'),
        ],
      });
      
      Object.entries(stats.componentBreakdown)
        .sort((a, b) => b[1] - a[1])
        .forEach(([component, count]) => {
          componentTable.push([
            component,
            count,
            `${Math.round(count / stats.totalEntries * 100)}%`,
          ]);
        });
      
      console.log('\nComponent Breakdown:');
      console.log(componentTable.toString());
      
      // Suggestions based on stats
      console.log('\nSuggestions:');
      
      if (stats.failureCount > stats.totalEntries * 0.2) {
        console.log(chalk.yellow('⚠️  High failure rate detected. Consider retraining the model.'));
      }
      
      if (stats.totalEntries > 50) {
        console.log(chalk.green('✓ Enough data for LoRA fine-tuning. Run `pnpm retrain-model` to improve models.'));
      } else {
        console.log(chalk.yellow('⚠️  Not enough data for LoRA fine-tuning yet. Collect more feedback.'));
      }
      
      const componentsToImprove = Object.entries(stats.componentBreakdown)
        .filter(([_, count]) => count >= 5)
        .map(([component]) => component);
      
      if (componentsToImprove.length > 0) {
        console.log(chalk.green(`✓ Components with enough data for targeted improvement: ${componentsToImprove.join(', ')}`));
      }
    } catch (error) {
      spinner.fail(chalk.red(`Error loading summary: ${error instanceof Error ? error.message : String(error)}`));
      console.error(error);
      process.exit(1);
    }
  });

// Command to view recent entries
program
  .command('recent')
  .description('Show recent learning entries')
  .option('-r, --result <type>', 'Filter by result type (success, failure, improved)')
  .option('-c, --component <name>', 'Filter by component name')
  .option('-l, --limit <number>', 'Limit number of entries to show', '10')
  .action(async (options) => {
    const spinner = ora('Loading recent entries...').start();
    
    try {
      const retentionService = new RetentionService();
      let entries = [];
      
      if (options.result) {
        const result = options.result as LogResult;
        entries = await retentionService.getEntriesByResult(result);
      } else if (options.component) {
        entries = await retentionService.getEntriesByComponent(options.component);
      } else {
        // Combine all results
        const successEntries = await retentionService.getEntriesByResult('success');
        const failureEntries = await retentionService.getEntriesByResult('failure');
        const improvedEntries = await retentionService.getEntriesByResult('improved');
        entries = [...successEntries, ...failureEntries, ...improvedEntries];
        
        // Sort by timestamp (recent first)
        entries.sort((a, b) => {
          const aTime = a.metadata?.timestamp ? new Date(a.metadata.timestamp).getTime() : 0;
          const bTime = b.metadata?.timestamp ? new Date(b.metadata.timestamp).getTime() : 0;
          return bTime - aTime;
        });
      }
      
      const limit = parseInt(options.limit, 10);
      entries = entries.slice(0, limit);
      
      spinner.succeed(`Loaded ${entries.length} entries`);
      
      if (entries.length === 0) {
        console.log(chalk.yellow('No entries found with the specified criteria.'));
        return;
      }
      
      // Create a table for entries
      const entriesTable = new Table({
        head: [
          chalk.cyan('Task ID'),
          chalk.cyan('Component'),
          chalk.cyan('Result'),
          chalk.cyan('Input'),
          chalk.cyan('Feedback'),
        ],
        colWidths: [12, 15, 10, 30, 30],
        wordWrap: true,
      });
      
      entries.forEach(entry => {
        const resultColor = 
          entry.result === 'success' ? chalk.green :
          entry.result === 'improved' ? chalk.yellow :
          chalk.red;
        
        entriesTable.push([
          entry.taskId.substring(0, 10),
          entry.component,
          resultColor(entry.result),
          JSON.stringify(entry.input).substring(0, 150),
          entry.feedback || 'N/A',
        ]);
      });
      
      console.log(entriesTable.toString());
      
      // Prompt for detailed view of an entry
      const { viewDetailed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'viewDetailed',
          message: 'View detailed information for an entry?',
          default: false,
        },
      ]);
      
      if (viewDetailed) {
        const { entryIndex } = await inquirer.prompt([
          {
            type: 'number',
            name: 'entryIndex',
            message: 'Enter the index of the entry to view (0-based):',
            validate: value => {
              const parsed = parseInt(value, 10);
              return (
                !isNaN(parsed) && parsed >= 0 && parsed < entries.length
                  ? true
                  : `Please enter a valid index between 0 and ${entries.length - 1}`
              );
            },
          },
        ]);
        
        const selectedEntry = entries[entryIndex];
        console.log('\nDetailed Entry Information:');
        console.log(chalk.cyan('Task ID:'), selectedEntry.taskId);
        console.log(chalk.cyan('Component:'), selectedEntry.component);
        console.log(chalk.cyan('Result:'), getColoredResult(selectedEntry.result));
        console.log(chalk.cyan('Input:'), JSON.stringify(selectedEntry.input, null, 2));
        console.log(chalk.cyan('Output:'), JSON.stringify(selectedEntry.output, null, 2));
        console.log(chalk.cyan('Feedback:'), selectedEntry.feedback || 'N/A');
        console.log(chalk.cyan('Error Type:'), selectedEntry.errorType || 'N/A');
        console.log(chalk.cyan('Remediation:'), selectedEntry.remediation || 'N/A');
        console.log(chalk.cyan('Metadata:'), selectedEntry.metadata ? JSON.stringify(selectedEntry.metadata, null, 2) : 'N/A');
      }
    } catch (error) {
      spinner.fail(chalk.red(`Error loading entries: ${error instanceof Error ? error.message : String(error)}`));
      console.error(error);
      process.exit(1);
    }
  });

// Command to provide feedback on a task
program
  .command('feedback')
  .description('Provide feedback on a task')
  .requiredOption('-t, --task-id <id>', 'Task ID to provide feedback for')
  .action(async (options) => {
    const analyzer = new FeedbackAnalyzer();
    const retentionService = new RetentionService();
    
    try {
      // Get component type
      const { component } = await inquirer.prompt([
        {
          type: 'list',
          name: 'component',
          message: 'Which component are you providing feedback for?',
          choices: ['ui-generator', 'reasoning', 'route-generator', 'other'],
        },
      ]);
      
      // If "other", get specific component
      let specificComponent = component;
      if (component === 'other') {
        const { customComponent } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customComponent',
            message: 'Enter the component name:',
            validate: value => value.trim() !== '' ? true : 'Component name cannot be empty',
          },
        ]);
        specificComponent = customComponent;
      }
      
      // Get feedback type
      const { resultType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'resultType',
          message: 'What is your assessment of the result?',
          choices: [
            { name: 'Success - The output meets requirements', value: 'success' },
            { name: 'Improved - The output is usable but needs adjustments', value: 'improved' },
            { name: 'Failure - The output does not meet requirements', value: 'failure' },
          ],
        },
      ]);
      
      // Get detailed feedback
      const { feedback } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'feedback',
          message: 'Enter detailed feedback (an editor will open):',
        },
      ]);
      
      // If failure, get error type
      let errorType = undefined;
      if (resultType === 'failure') {
        const { errorCategory } = await inquirer.prompt([
          {
            type: 'list',
            name: 'errorCategory',
            message: 'What type of issue is this?',
            choices: [
              'syntax_error',
              'logic_error',
              'runtime_error',
              'design_issue',
              'accessibility_issue',
              'performance_issue',
              'other',
            ],
          },
        ]);
        
        errorType = errorCategory;
        
        if (errorCategory === 'other') {
          const { customError } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customError',
              message: 'Enter the error type:',
            },
          ]);
          errorType = customError;
        }
      }
      
      // Get input and output data
      const { inputData } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'inputData',
          message: 'Enter input data (JSON format):',
          default: '{\n  "prompt": "Your prompt here"\n}',
        },
      ]);
      
      const { outputData } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'outputData',
          message: 'Enter output data (JSON format):',
          default: '{\n  "code": "// Code here"\n}',
        },
      ]);
      
      let parsedInput;
      let parsedOutput;
      
      try {
        parsedInput = JSON.parse(inputData);
        parsedOutput = JSON.parse(outputData);
      } catch (error) {
        console.error(chalk.red('Error parsing JSON data. Please ensure it is valid JSON.'));
        process.exit(1);
      }
      
      // Analyze feedback
      const spinner = ora('Analyzing feedback...').start();
      
      const analysisPrompt = {
        feedback,
        component: specificComponent,
        originalPrompt: JSON.stringify(parsedInput),
        generatedCode: typeof parsedOutput.code === 'string' ? parsedOutput.code : JSON.stringify(parsedOutput),
      };
      
      const analysis = await analyzer.analyzeFeedback(analysisPrompt);
      
      spinner.succeed('Feedback analyzed');
      
      // Display analysis
      console.log('\nFeedback Analysis:');
      console.log(chalk.cyan('Sentiment:'), getColoredSentiment(analysis.sentiment));
      console.log(chalk.cyan('Categories:'), analysis.categories.join(', '));
      console.log(chalk.cyan('Score:'), `${analysis.score}/10`);
      console.log(chalk.cyan('Suggested Result:'), getColoredResult(analysis.result));
      
      if (analysis.actionItems.length > 0) {
        console.log(chalk.cyan('\nAction Items:'));
        analysis.actionItems.forEach((item, index) => {
          console.log(`${index + 1}. ${item}`);
        });
      }
      
      // Confirm storage
      const { confirmStore } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmStore',
          message: 'Store this feedback in the learning system?',
          default: true,
        },
      ]);
      
      if (confirmStore) {
        spinner.start('Storing feedback...');
        
        // Use the user-provided result type, but take error type from analysis if not provided
        const finalErrorType = errorType || analysis.errorType;
        
        await retentionService.storeEntry({
          taskId: options.taskId,
          component: specificComponent,
          input: parsedInput,
          output: parsedOutput,
          result: resultType as LogResult,
          feedback,
          errorType: finalErrorType,
          metadata: {
            analysisCategories: analysis.categories,
            analysisSentiment: analysis.sentiment,
            analysisScore: analysis.score,
            analysisActionItems: analysis.actionItems,
            timestamp: new Date().toISOString(),
          },
        });
        
        spinner.succeed('Feedback stored successfully');
        
        // Suggest remediation if failure
        if (resultType === 'failure') {
          console.log(chalk.yellow('\nSuggested Next Steps:'));
          console.log('1. Run `pnpm retrain-model -f failure` to improve the model based on failure cases');
          console.log('2. Review action items and implement improvements');
          console.log('3. Add a remediation plan with `pnpm feedback-loop remediate -t ' + options.taskId + '`');
        }
      }
    } catch (error) {
      console.error(chalk.red(`Error processing feedback: ${error instanceof Error ? error.message : String(error)}`));
      console.error(error);
      process.exit(1);
    }
  });

// Command to add remediation plan
program
  .command('remediate')
  .description('Add a remediation plan for a failure')
  .requiredOption('-t, --task-id <id>', 'Task ID to remediate')
  .action(async (options) => {
    try {
      const { remediation } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'remediation',
          message: 'Enter remediation plan (an editor will open):',
        },
      ]);
      
      const spinner = ora('Storing remediation plan...').start();
      
      const retentionService = new RetentionService();
      await retentionService.updateRemediation(options.taskId, remediation);
      
      spinner.succeed('Remediation plan stored successfully');
    } catch (error) {
      console.error(chalk.red(`Error storing remediation: ${error instanceof Error ? error.message : String(error)}`));
      console.error(error);
      process.exit(1);
    }
  });

// Command to clean up old entries
program
  .command('cleanup')
  .description('Remove old learning entries')
  .option('-d, --days <number>', 'Remove entries older than X days', '90')
  .action(async (options) => {
    try {
      const days = parseInt(options.days, 10);
      
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to remove entries older than ${days} days? This cannot be undone.`,
          default: false,
        },
      ]);
      
      if (!confirm) {
        console.log(chalk.yellow('Operation cancelled.'));
        return;
      }
      
      const spinner = ora(`Removing entries older than ${days} days...`).start();
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const retentionService = new RetentionService();
      const count = await retentionService.pruneOldEntries(cutoffDate);
      
      spinner.succeed(`Successfully removed ${count} entries older than ${days} days`);
    } catch (error) {
      console.error(chalk.red(`Error cleaning up entries: ${error instanceof Error ? error.message : String(error)}`));
      console.error(error);
      process.exit(1);
    }
  });

// Helper functions
function getColoredResult(result: string): string {
  if (result === 'success') return chalk.green(result);
  if (result === 'improved') return chalk.yellow(result);
  return chalk.red(result);
}

function getColoredSentiment(sentiment: string): string {
  if (sentiment === 'positive') return chalk.green(sentiment);
  if (sentiment === 'neutral') return chalk.yellow(sentiment);
  return chalk.red(sentiment);
}

// Parse command line arguments
program.parse(process.argv); 