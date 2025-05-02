#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { marked } = require('marked');

program
  .description('Visualize benchmark results and generate trend analysis')
  .option('-i, --input <dir>', 'Directory containing benchmark results', './generation-benchmark/results')
  .option('-o, --output <dir>', 'Output directory for visualizations', './generation-benchmark/analysis')
  .option('-f, --format <format>', 'Output format (html, md)', 'html')
  .option('-v, --verbose', 'Enable verbose output')
  .parse(process.argv);

const options = program.opts();

async function generateCharts(benchmarkData) {
  const width = 800;
  const height = 400;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white' });
  
  // Score distribution chart
  const scoreData = {
    labels: benchmarkData.map(d => d.component),
    datasets: [
      {
        label: 'Overall Score',
        data: benchmarkData.map(d => d.score.overall),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1
      }
    ]
  };
  
  const scoreConfig = {
    type: 'bar',
    data: scoreData,
    options: {
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Component Score Distribution'
        }
      }
    }
  };
  
  // Category scores radar chart
  const categoryData = {
    labels: ['Fidelity', 'Code Quality', 'Accessibility', 'UX Polish', 'Innovation'],
    datasets: benchmarkData.map((d, i) => ({
      label: d.component,
      data: [
        d.score.fidelity,
        d.score.codeQuality,
        d.score.accessibility,
        d.score.uxPolish,
        d.score.innovation
      ],
      backgroundColor: `rgba(${50 + i * 30}, ${100 + i * 20}, ${200 - i * 15}, 0.2)`,
      borderColor: `rgba(${50 + i * 30}, ${100 + i * 20}, ${200 - i * 15}, 1)`,
      pointBackgroundColor: `rgba(${50 + i * 30}, ${100 + i * 20}, ${200 - i * 15}, 1)`
    }))
  };
  
  const categoryConfig = {
    type: 'radar',
    data: categoryData,
    options: {
      scales: {
        r: {
          beginAtZero: true,
          max: 100
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Category Scores Comparison'
        }
      }
    }
  };
  
  // Generate the charts
  const scoreChart = await chartJSNodeCanvas.renderToBuffer(scoreConfig);
  const categoryChart = await chartJSNodeCanvas.renderToBuffer(categoryConfig);
  
  // Save the charts
  fs.writeFileSync(path.join(options.output, 'score-distribution.png'), scoreChart);
  fs.writeFileSync(path.join(options.output, 'category-scores.png'), categoryChart);
  
  return {
    scoreChartPath: 'score-distribution.png',
    categoryChartPath: 'category-scores.png'
  };
}

function analyzeResults(benchmarkData) {
  // Calculate average scores
  const totalScores = benchmarkData.reduce((acc, curr) => {
    acc.overall += curr.score.overall;
    acc.fidelity += curr.score.fidelity;
    acc.codeQuality += curr.score.codeQuality;
    acc.accessibility += curr.score.accessibility;
    acc.uxPolish += curr.score.uxPolish;
    acc.innovation += curr.score.innovation;
    return acc;
  }, { overall: 0, fidelity: 0, codeQuality: 0, accessibility: 0, uxPolish: 0, innovation: 0 });
  
  const count = benchmarkData.length;
  const averages = {
    overall: (totalScores.overall / count).toFixed(2),
    fidelity: (totalScores.fidelity / count).toFixed(2),
    codeQuality: (totalScores.codeQuality / count).toFixed(2),
    accessibility: (totalScores.accessibility / count).toFixed(2),
    uxPolish: (totalScores.uxPolish / count).toFixed(2),
    innovation: (totalScores.innovation / count).toFixed(2)
  };
  
  // Find top and bottom performers
  const sortedByScore = [...benchmarkData].sort((a, b) => b.score.overall - a.score.overall);
  const topPerformers = sortedByScore.slice(0, 3);
  const bottomPerformers = sortedByScore.slice(-3).reverse();
  
  // Identify strengths and weaknesses
  const strengths = Object.entries({
    fidelity: totalScores.fidelity / count,
    codeQuality: totalScores.codeQuality / count,
    accessibility: totalScores.accessibility / count,
    uxPolish: totalScores.uxPolish / count,
    innovation: totalScores.innovation / count
  }).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([key]) => key);
  
  const weaknesses = Object.entries({
    fidelity: totalScores.fidelity / count,
    codeQuality: totalScores.codeQuality / count,
    accessibility: totalScores.accessibility / count,
    uxPolish: totalScores.uxPolish / count,
    innovation: totalScores.innovation / count
  }).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([key]) => key);
  
  return {
    averages,
    topPerformers,
    bottomPerformers,
    strengths,
    weaknesses
  };
}

function generateReport(benchmarkData, chartPaths, analysis) {
  const { averages, topPerformers, bottomPerformers, strengths, weaknesses } = analysis;
  
  let content = '';
  
  if (options.format === 'html') {
    content = `
      <html>
      <head>
        <title>PersLM Benchmark Visualization</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
          h1, h2, h3 { color: #333; }
          .chart-container { margin: 30px 0; text-align: center; }
          .chart { max-width: 100%; height: auto; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>PersLM Benchmark Visualization</h1>
        
        <div class="summary">
          <h2>Summary</h2>
          <p>Average overall score: <strong>${averages.overall}</strong></p>
          <p>Strengths: <strong>${strengths.join(', ')}</strong></p>
          <p>Areas for improvement: <strong>${weaknesses.join(', ')}</strong></p>
        </div>
        
        <div class="chart-container">
          <h2>Score Distribution</h2>
          <img class="chart" src="${chartPaths.scoreChartPath}" alt="Score Distribution Chart" />
        </div>
        
        <div class="chart-container">
          <h2>Category Scores Comparison</h2>
          <img class="chart" src="${chartPaths.categoryChartPath}" alt="Category Scores Chart" />
        </div>
        
        <h2>Top Performers</h2>
        <table>
          <tr>
            <th>Component</th>
            <th>Overall Score</th>
            <th>Fidelity</th>
            <th>Code Quality</th>
            <th>Accessibility</th>
            <th>UX Polish</th>
            <th>Innovation</th>
          </tr>
          ${topPerformers.map(item => `
            <tr>
              <td>${item.component}</td>
              <td>${item.score.overall.toFixed(2)}</td>
              <td>${item.score.fidelity.toFixed(2)}</td>
              <td>${item.score.codeQuality.toFixed(2)}</td>
              <td>${item.score.accessibility.toFixed(2)}</td>
              <td>${item.score.uxPolish.toFixed(2)}</td>
              <td>${item.score.innovation.toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
        
        <h2>Areas for Improvement</h2>
        <table>
          <tr>
            <th>Component</th>
            <th>Overall Score</th>
            <th>Fidelity</th>
            <th>Code Quality</th>
            <th>Accessibility</th>
            <th>UX Polish</th>
            <th>Innovation</th>
          </tr>
          ${bottomPerformers.map(item => `
            <tr>
              <td>${item.component}</td>
              <td>${item.score.overall.toFixed(2)}</td>
              <td>${item.score.fidelity.toFixed(2)}</td>
              <td>${item.score.codeQuality.toFixed(2)}</td>
              <td>${item.score.accessibility.toFixed(2)}</td>
              <td>${item.score.uxPolish.toFixed(2)}</td>
              <td>${item.score.innovation.toFixed(2)}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
  } else {
    content = `# PersLM Benchmark Visualization

## Summary
- Average overall score: **${averages.overall}**
- Strengths: **${strengths.join(', ')}**
- Areas for improvement: **${weaknesses.join(', ')}**

## Score Distribution
![Score Distribution Chart](${chartPaths.scoreChartPath})

## Category Scores Comparison
![Category Scores Chart](${chartPaths.categoryChartPath})

## Top Performers
| Component | Overall | Fidelity | Code Quality | Accessibility | UX Polish | Innovation |
|-----------|---------|----------|--------------|---------------|-----------|------------|
${topPerformers.map(item => `| ${item.component} | ${item.score.overall.toFixed(2)} | ${item.score.fidelity.toFixed(2)} | ${item.score.codeQuality.toFixed(2)} | ${item.score.accessibility.toFixed(2)} | ${item.score.uxPolish.toFixed(2)} | ${item.score.innovation.toFixed(2)} |`).join('\n')}

## Areas for Improvement
| Component | Overall | Fidelity | Code Quality | Accessibility | UX Polish | Innovation |
|-----------|---------|----------|--------------|---------------|-----------|------------|
${bottomPerformers.map(item => `| ${item.component} | ${item.score.overall.toFixed(2)} | ${item.score.fidelity.toFixed(2)} | ${item.score.codeQuality.toFixed(2)} | ${item.score.accessibility.toFixed(2)} | ${item.score.uxPolish.toFixed(2)} | ${item.score.innovation.toFixed(2)} |`).join('\n')}
`;
  }
  
  const outputFilePath = path.join(options.output, `benchmark-report.${options.format === 'html' ? 'html' : 'md'}`);
  fs.writeFileSync(outputFilePath, content);
  
  return outputFilePath;
}

async function main() {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(options.output)) {
      fs.mkdirSync(options.output, { recursive: true });
    }
    
    // Read benchmark results
    const benchmarkFiles = fs.readdirSync(options.input)
      .filter(file => file.endsWith('.json'))
      .map(file => path.join(options.input, file));
    
    if (benchmarkFiles.length === 0) {
      console.error('No benchmark result files found');
      process.exit(1);
    }
    
    // Parse benchmark data
    const benchmarkData = benchmarkFiles.map(file => {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      return {
        component: path.basename(file, '.json'),
        score: data.score || {},
        issues: data.issues || []
      };
    });
    
    // Generate charts
    const chartPaths = await generateCharts(benchmarkData);
    
    // Analyze results
    const analysis = analyzeResults(benchmarkData);
    
    // Generate and save report
    const reportPath = generateReport(benchmarkData, chartPaths, analysis);
    
    console.log(`Visualization complete. Report saved to: ${reportPath}`);
    
  } catch (error) {
    console.error('Error generating visualizations:', error);
    process.exit(1);
  }
}

main(); 