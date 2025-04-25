#!/usr/bin/env node

import { Command } from 'commander';
import { ModelTuner, TuningOptions } from '../lib/retraining/modelTuner';
import { LogResult } from '../lib/memory/retentionService';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();

program
  .name('retrain-model')
  .description('Retrain models based on learning data')
  .version('1.0.0');

program
  .option('-f, --filter <type>', 'Filter entries by result type (success, failure, improved, all)', 'all')
  .option('-c, --component <name>', 'Filter entries by component name')
  .option('-m, --min-entries <number>', 'Minimum number of entries required', '10')
  .option('-t, --target-model <name>', 'Target model to fine-tune', 'deepseek-ai/deepseek-coder-6.7b-base')
  .option('-e, --epochs <number>', 'Number of training epochs', '2')
  .option('-r, --rank <number>', 'LoRA rank', '16')
  .option('-a, --alpha <number>', 'LoRA alpha', '32')
  .option('--no-synthetic', 'Do not generate synthetic examples to supplement training data')
  .action(async (options) => {
    const spinner = ora('Preparing for model tuning...').start();
    
    try {
      // Validate options
      const filter = options.filter as LogResult | 'all';
      if (filter !== 'all' && filter !== 'success' && filter !== 'failure' && filter !== 'improved') {
        spinner.fail(chalk.red(`Invalid filter type: ${filter}. Must be one of: success, failure, improved, all`));
        process.exit(1);
      }
      
      const tuningOptions: TuningOptions = {
        filter,
        component: options.component,
        minEntries: parseInt(options.minEntries, 10),
        targetModel: options.targetModel,
        epochs: parseInt(options.epochs, 10),
        rank: parseInt(options.rank, 10),
        alpha: parseInt(options.alpha, 10),
        useSynthetic: options.synthetic !== false
      };
      
      spinner.text = `Collecting learning entries for ${filter} results${options.component ? ` in ${options.component}` : ''}...`;
      
      const tuner = new ModelTuner();
      const result = await tuner.tuneModel(tuningOptions);
      
      if (result.success) {
        if (result.promptEngineered) {
          spinner.succeed(chalk.green(`Successfully generated engineered prompts using ${result.entriesUsed} entries`));
          console.log(chalk.cyan('Prompts saved to: data/engineered-prompts.json'));
        } else {
          spinner.succeed(chalk.green(`Successfully fine-tuned model "${result.model}" using ${result.entriesUsed} entries`));
          console.log(chalk.cyan(`Training completed in ${result.trainingTime} seconds`));
          console.log(chalk.cyan(`Model saved to: models/${result.model}`));
        }
      } else {
        spinner.fail(chalk.red(`Failed to tune model: ${result.error}`));
        process.exit(1);
      }
    } catch (error) {
      spinner.fail(chalk.red(`An error occurred: ${error instanceof Error ? error.message : String(error)}`));
      console.error(error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv); 