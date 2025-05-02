#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { spawn } = require('child_process');
const chalk = require('chalk');

program
  .description('Run the complete benchmark process: generate, validate, score, and visualize')
  .option('-p, --prompt-dir <directory>', 'Directory containing prompt files', 'generation-benchmark/prompts')
  .option('-o, --output-dir <directory>', 'Output directory for results', 'generation-benchmark/results')
  .option('-r, --retry <number>', 'Number of retry attempts for failed generations', '3')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--no-validate', 'Skip validation step')
  .option('--no-visualize', 'Skip visualization step')
  .option('-m, --max-parallel <number>', 'Maximum number of parallel processes', '2')
  .option('--self-improve', 'Enable self-improvement cycles')
  .option('--discover', 'Enable strategy discovery')
  .option('--report-format <format>', 'Report format (html, markdown, json)', 'html');

program.parse(process.argv);

const options = program.opts();

// Ensure directories exist
const promptDir = path.resolve(options.promptDir);
const outputDir = path.resolve(options.outputDir);
const componentsDir = path.join(outputDir, 'components');
const reportsDir = path.join(outputDir, 'reports');
const visualizationsDir = path.join(outputDir, 'visualizations');

[outputDir, componentsDir, reportsDir, visualizationsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

if (!fs.existsSync(promptDir)) {
  console.error(chalk.red(`Error: Prompt directory ${promptDir} does not exist`));
  process.exit(1);
}

// Get prompt files
const promptFiles = fs.readdirSync(promptDir)
  .filter(file => file.endsWith('.txt') || file.endsWith('.md'));

if (promptFiles.length === 0) {
  console.error(chalk.red(`Error: No prompt files found in ${promptDir}`));
  process.exit(1);
}

console.log(chalk.blue(`Found ${promptFiles.length} prompt files`));

// Track results
const results = {
  startTime: new Date(),
  endTime: null,
  totalPrompts: promptFiles.length,
  successful: 0,
  failed: 0,
  components: [],
  scores: {}
};

// Execute command as Promise
function executeCommand(command, args, cwd = process.cwd(), env = process.env) {
  return new Promise((resolve, reject) => {
    if (options.verbose) {
      console.log(chalk.cyan(`Executing: ${command} ${args.join(' ')}`));
    }
    
    const proc = spawn(command, args, { 
      cwd, 
      env: { ...env, NODE_ENV: 'production' },
      stdio: options.verbose ? 'inherit' : 'pipe'
    });
    
    let stdout = '';
    let stderr = '';
    
    if (proc.stdout) {
      proc.stdout.on('data', data => {
        stdout += data.toString();
      });
    }
    
    if (proc.stderr) {
      proc.stderr.on('data', data => {
        stderr += data.toString();
      });
    }
    
    proc.on('close', code => {
      if (code === 0) {
        resolve({ code, stdout, stderr });
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });
    
    proc.on('error', err => {
      reject(err);
    });
  });
}

// Process prompt files in batches
async function processBatch(batch) {
  const promises = batch.map(async promptFile => {
    const promptPath = path.join(promptDir, promptFile);
    const componentName = path.parse(promptFile).name;
    const componentOutputPath = path.join(componentsDir, `${componentName}.tsx`);
    
    console.log(chalk.blue(`Processing ${promptFile}...`));
    
    // Step 1: Generate component
    let generationSuccess = false;
    let retries = 0;
    
    while (!generationSuccess && retries <= options.retry) {
      try {
        if (retries > 0) {
          console.log(chalk.yellow(`Retry attempt ${retries} for ${promptFile}`));
        }
        
        const generateArgs = [
          'benchmark',
          '--prompt', promptPath,
          '--output', componentOutputPath
        ];
        
        if (options.selfImprove) {
          generateArgs.push('--improve');
        }
        
        if (options.discover) {
          generateArgs.push('--discover');
        }
        
        if (options.verbose) {
          generateArgs.push('--verbose');
        }
        
        await executeCommand('node', ['./src/persrm-cli.js', ...generateArgs]);
        generationSuccess = true;
        
        console.log(chalk.green(`Generated component: ${componentOutputPath}`));
        results.successful++;
        
      } catch (error) {
        retries++;
        console.error(chalk.red(`Generation failed for ${promptFile}: ${error.message}`));
        
        if (retries > options.retry) {
          console.error(chalk.red(`Maximum retries reached for ${promptFile}, skipping...`));
          results.failed++;
          return { promptFile, success: false, error: error.message };
        }
      }
    }
    
    // If generation failed, skip subsequent steps
    if (!generationSuccess) {
      return { promptFile, success: false };
    }
    
    try {
      // Step 2: Validate component (optional)
      if (options.validate !== false) {
        console.log(chalk.blue(`Validating ${componentName}...`));
        
        const validateArgs = [
          './src/cli/validate.js',
          '--directory', componentsDir,
          '--output', path.join(reportsDir, `${componentName}-validation.json`)
        ];
        
        if (options.verbose) {
          validateArgs.push('--verbose');
        }
        
        await executeCommand('node', validateArgs);
        console.log(chalk.green(`Validation complete for ${componentName}`));
      }
      
      // Step 3: Score component
      console.log(chalk.blue(`Scoring ${componentName}...`));
      
      const scoreArgs = [
        'score',
        '--component', componentOutputPath,
        '--prompt', promptPath,
        '--output', path.join(reportsDir, `${componentName}-score.md`)
      ];
      
      if (options.reportFormat) {
        scoreArgs.push('--format', options.reportFormat);
      }
      
      if (options.verbose) {
        scoreArgs.push('--verbose');
      }
      
      const scoreResult = await executeCommand('node', ['./src/persrm-cli.js', ...scoreArgs]);
      console.log(chalk.green(`Scoring complete for ${componentName}`));
      
      // Extract score from result
      const scoreMatch = scoreResult.stdout.match(/Overall Score: (\d+(\.\d+)?)/);
      const score = scoreMatch ? parseFloat(scoreMatch[1]) : null;
      
      results.components.push({
        name: componentName,
        path: componentOutputPath,
        prompt: promptPath,
        score
      });
      
      results.scores[componentName] = score;
      
      return { promptFile, success: true, score };
      
    } catch (error) {
      console.error(chalk.red(`Processing failed for ${promptFile}: ${error.message}`));
      return { promptFile, success: false, error: error.message };
    }
  });
  
  return Promise.all(promises);
}

// Run visualizations
async function runVisualizations() {
  if (options.visualize === false) {
    return;
  }
  
  console.log(chalk.blue('Generating visualizations...'));
  
  try {
    const visualizeArgs = [
      './src/cli/visualize.js',
      '--directory', reportsDir,
      '--output', visualizationsDir,
      '--type', 'all'
    ];
    
    await executeCommand('node', visualizeArgs);
    console.log(chalk.green('Visualizations complete'));
    
  } catch (error) {
    console.error(chalk.red(`Visualization failed: ${error.message}`));
  }
}

// Generate summary report
function generateSummaryReport() {
  const duration = (results.endTime - results.startTime) / 1000;
  const successRate = (results.successful / results.totalPrompts) * 100;
  
  const sortedComponents = [...results.components].sort((a, b) => {
    return (b.score || 0) - (a.score || 0);
  });
  
  const avgScore = sortedComponents.length > 0
    ? sortedComponents.reduce((sum, comp) => sum + (comp.score || 0), 0) / sortedComponents.length
    : 0;
  
  const report = {
    summary: {
      startTime: results.startTime,
      endTime: results.endTime,
      duration: `${duration.toFixed(2)} seconds`,
      totalPrompts: results.totalPrompts,
      successful: results.successful,
      failed: results.failed,
      successRate: `${successRate.toFixed(2)}%`,
      averageScore: avgScore.toFixed(2)
    },
    components: sortedComponents.map(comp => ({
      name: comp.name,
      score: comp.score,
      path: path.relative(process.cwd(), comp.path)
    }))
  };
  
  // Save report
  const reportPath = path.join(outputDir, 'benchmark-summary.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  
  // Generate HTML report
  const htmlReport = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Benchmark Summary Report</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 20px;
        line-height: 1.6;
      }
      .report-header {
        text-align: center;
        margin-bottom: 30px;
      }
      .summary {
        background-color: #f9f9f9;
        padding: 20px;
        border-radius: 5px;
        margin-bottom: 30px;
      }
      .metrics {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        margin-bottom: 30px;
      }
      .metric {
        flex: 1;
        min-width: 200px;
        padding: 15px;
        background-color: #f2f2f2;
        border-radius: 5px;
        text-align: center;
      }
      .metric-value {
        font-size: 24px;
        font-weight: bold;
        margin: 10px 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      th, td {
        border: 1px solid #ddd;
        padding: 8px;
        text-align: left;
      }
      th {
        background-color: #f2f2f2;
      }
      tr:nth-child(even) {
        background-color: #f9f9f9;
      }
      .success-badge {
        background-color: #28a745;
        color: white;
        padding: 3px 10px;
        border-radius: 20px;
        display: inline-block;
      }
      .failed-badge {
        background-color: #dc3545;
        color: white;
        padding: 3px 10px;
        border-radius: 20px;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <div class="report-header">
      <h1>Benchmark Summary Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="metrics">
      <div class="metric">
        <div>Success Rate</div>
        <div class="metric-value">${report.summary.successRate}</div>
        <div>${report.summary.successful} / ${report.summary.totalPrompts}</div>
      </div>
      
      <div class="metric">
        <div>Average Score</div>
        <div class="metric-value">${report.summary.averageScore}</div>
        <div>out of 5.00</div>
      </div>
      
      <div class="metric">
        <div>Total Duration</div>
        <div class="metric-value">${report.summary.duration}</div>
      </div>
    </div>
    
    <div class="summary">
      <h2>Details</h2>
      <p><strong>Start Time:</strong> ${report.summary.startTime.toLocaleString()}</p>
      <p><strong>End Time:</strong> ${report.summary.endTime.toLocaleString()}</p>
      <p><strong>Total Components:</strong> ${report.summary.totalPrompts}</p>
      <p><strong>Successful:</strong> ${report.summary.successful}</p>
      <p><strong>Failed:</strong> ${report.summary.failed}</p>
    </div>
    
    <h2>Component Results</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Component</th>
          <th>Score</th>
          <th>Status</th>
          <th>Path</th>
        </tr>
      </thead>
      <tbody>
        ${report.components.map((comp, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${comp.name}</td>
            <td>${comp.score ? comp.score.toFixed(2) : 'N/A'}</td>
            <td>${comp.score ? '<span class="success-badge">Success</span>' : '<span class="failed-badge">Failed</span>'}</td>
            <td>${comp.path}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    <div>
      <h2>Links to Visualizations</h2>
      <ul>
        ${fs.readdirSync(visualizationsDir)
          .filter(file => file.endsWith('.html'))
          .map(file => `<li><a href="${path.relative(outputDir, path.join(visualizationsDir, file))}">${file}</a></li>`)
          .join('')}
      </ul>
    </div>
  </body>
  </html>
  `;
  
  fs.writeFileSync(path.join(outputDir, 'benchmark-summary.html'), htmlReport, 'utf8');
  
  return report;
}

// Main function to run the benchmark
async function runBenchmark() {
  console.log(chalk.blue('Starting benchmark process...'));
  console.log(chalk.blue(`Processing ${promptFiles.length} prompt files`));
  
  const maxParallel = parseInt(options.maxParallel, 10);
  
  // Process in batches to limit parallelism
  for (let i = 0; i < promptFiles.length; i += maxParallel) {
    const batch = promptFiles.slice(i, i + maxParallel);
    await processBatch(batch);
    console.log(chalk.blue(`Completed batch ${Math.floor(i / maxParallel) + 1}/${Math.ceil(promptFiles.length / maxParallel)}`));
  }
  
  // Run visualizations
  await runVisualizations();
  
  // Generate summary
  results.endTime = new Date();
  const summary = generateSummaryReport();
  
  console.log(chalk.green('\nBenchmark process complete!'));
  console.log(chalk.green(`Success rate: ${summary.summary.successRate}`));
  console.log(chalk.green(`Average score: ${summary.summary.averageScore}`));
  console.log(chalk.green(`Total duration: ${summary.summary.duration}`));
  console.log(chalk.green(`Summary report: ${path.join(outputDir, 'benchmark-summary.html')}`));
}

runBenchmark().catch(error => {
  console.error(chalk.red(`Benchmark process failed: ${error.message}`));
  process.exit(1);
}); 