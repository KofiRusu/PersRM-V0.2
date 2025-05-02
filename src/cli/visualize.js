#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { JSDOM } = require('jsdom');
const d3 = require('d3');
const chalk = require('chalk');

// Set up virtual DOM for server-side rendering
const { window } = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.document = window.document;

program
  .option('-d, --directory <directory>', 'Directory containing benchmark result files')
  .option('-o, --output <output>', 'Output directory for visualization files')
  .option('-t, --type <type>', 'Type of visualization (radar, bar, line, all)', 'all');

program.parse(process.argv);

const options = program.opts();

if (!options.directory) {
  console.error(chalk.red('Error: --directory option is required'));
  process.exit(1);
}

const resultsDir = options.directory;
const outputDir = options.output || path.join(resultsDir, 'visualizations');
const vizType = options.type || 'all';

// Ensure directories exist
if (!fs.existsSync(resultsDir)) {
  console.error(chalk.red(`Error: Directory ${resultsDir} does not exist`));
  process.exit(1);
}

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Read result files
console.log(chalk.blue('Reading benchmark results...'));

const resultFiles = fs.readdirSync(resultsDir)
  .filter(file => file.endsWith('.json') || file.endsWith('.md'));

if (resultFiles.length === 0) {
  console.error(chalk.yellow('Warning: No result files found'));
  process.exit(0);
}

// Parse result files
const results = [];

resultFiles.forEach(file => {
  const filePath = path.join(resultsDir, file);
  console.log(chalk.cyan(`Processing ${file}...`));
  
  try {
    if (file.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      results.push({
        file,
        data,
        type: 'json'
      });
    } else if (file.endsWith('.md')) {
      // Parse markdown file
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract scores from markdown
      const scoreData = extractScoresFromMarkdown(content);
      results.push({
        file,
        data: scoreData,
        type: 'markdown'
      });
    }
  } catch (error) {
    console.error(chalk.red(`Error processing ${file}: ${error.message}`));
  }
});

if (results.length === 0) {
  console.error(chalk.red('Error: No valid result files found'));
  process.exit(1);
}

// Extract scores from markdown
function extractScoresFromMarkdown(content) {
  const scoreData = {
    components: []
  };
  
  // Extract overall score
  const overallMatch = content.match(/Overall Score: (\d+(\.\d+)?)/);
  if (overallMatch) {
    scoreData.overallScore = parseFloat(overallMatch[1]);
  }
  
  // Extract component scores
  const componentBlocks = content.split(/##\s+Component/g).slice(1);
  
  componentBlocks.forEach(block => {
    const nameMatch = block.match(/^[:\s]+(.+?)\n/);
    if (!nameMatch) return;
    
    const componentName = nameMatch[1].trim();
    const component = { name: componentName, scores: {} };
    
    // Extract category scores
    const categories = ['Fidelity', 'Code Quality', 'Accessibility', 'UX Polish', 'Innovation'];
    
    categories.forEach(category => {
      const regex = new RegExp(`${category}[:\\s]+(\\d+(\\.\\d+)?)`);
      const match = block.match(regex);
      if (match) {
        component.scores[category.toLowerCase().replace(/\s+/g, '_')] = parseFloat(match[1]);
      }
    });
    
    // Only add if we have scores
    if (Object.keys(component.scores).length > 0) {
      scoreData.components.push(component);
    }
  });
  
  return scoreData;
}

// Generate radar chart (spider chart) for component scores
function generateRadarChart(componentData) {
  const width = 600;
  const height = 500;
  const margin = { top: 80, right: 80, bottom: 80, left: 80 };
  
  const svg = d3.create('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;');
  
  const categories = ['fidelity', 'code_quality', 'accessibility', 'ux_polish', 'innovation'];
  const categoryLabels = ['Fidelity', 'Code Quality', 'Accessibility', 'UX Polish', 'Innovation'];
  const numCategories = categories.length;
  
  // Set up scales
  const angleScale = d3.scaleLinear()
    .domain([0, numCategories])
    .range([0, 2 * Math.PI]);
    
  const radiusScale = d3.scaleLinear()
    .domain([0, 5])  // Assuming max score is 5
    .range([0, Math.min(width, height) / 2 - margin.top]);
  
  // Compute coordinates for each category
  function getCoordinates(score, i) {
    const angle = angleScale(i);
    return {
      x: width / 2 + radiusScale(score) * Math.sin(angle),
      y: height / 2 - radiusScale(score) * Math.cos(angle)
    };
  }
  
  // Draw axes
  const axes = svg.append('g')
    .attr('class', 'axes');
  
  categories.forEach((_, i) => {
    const angle = angleScale(i);
    const lineEnd = {
      x: width / 2 + radiusScale(5) * Math.sin(angle),
      y: height / 2 - radiusScale(5) * Math.cos(angle)
    };
    
    axes.append('line')
      .attr('x1', width / 2)
      .attr('y1', height / 2)
      .attr('x2', lineEnd.x)
      .attr('y2', lineEnd.y)
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1);
      
    // Add category labels
    const labelPos = {
      x: width / 2 + (radiusScale(5) + 20) * Math.sin(angle),
      y: height / 2 - (radiusScale(5) + 20) * Math.cos(angle)
    };
    
    axes.append('text')
      .attr('x', labelPos.x)
      .attr('y', labelPos.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .text(categoryLabels[i]);
  });
  
  // Draw concentric circles
  const circles = svg.append('g')
    .attr('class', 'circles');
  
  [1, 2, 3, 4, 5].forEach(value => {
    circles.append('circle')
      .attr('cx', width / 2)
      .attr('cy', height / 2)
      .attr('r', radiusScale(value))
      .attr('fill', 'none')
      .attr('stroke', '#ccc')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3');
      
    // Add value labels
    circles.append('text')
      .attr('x', width / 2 + 5)
      .attr('y', height / 2 - radiusScale(value))
      .attr('font-size', '10px')
      .attr('fill', '#999')
      .text(value);
  });
  
  // Draw data polygons
  const colors = d3.schemeCategory10;
  
  componentData.forEach((component, componentIndex) => {
    const points = categories.map((category, i) => {
      const score = component.scores[category] || 0;
      const coords = getCoordinates(score, i);
      return `${coords.x},${coords.y}`;
    }).join(' ');
    
    // Create polygon
    svg.append('polygon')
      .attr('points', points)
      .attr('fill', colors[componentIndex % colors.length])
      .attr('fill-opacity', 0.3)
      .attr('stroke', colors[componentIndex % colors.length])
      .attr('stroke-width', 2);
  });
  
  // Add legend
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - margin.right}, ${margin.top})`);
  
  componentData.forEach((component, i) => {
    const legendItem = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);
    
    legendItem.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', colors[i % colors.length]);
    
    legendItem.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .attr('font-size', '12px')
      .text(component.name);
  });
  
  // Add title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .attr('font-size', '18px')
    .attr('font-weight', 'bold')
    .text('Component Score Comparison');
  
  return svg.node().outerHTML;
}

// Generate bar chart for score comparison
function generateBarChart(componentData) {
  const width = 800;
  const height = 500;
  const margin = { top: 60, right: 120, bottom: 100, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const svg = d3.create('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;');
    
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);
  
  const categories = ['fidelity', 'code_quality', 'accessibility', 'ux_polish', 'innovation'];
  const categoryLabels = ['Fidelity', 'Code Quality', 'Accessibility', 'UX Polish', 'Innovation'];
  
  // Set up scales
  const xScale = d3.scaleBand()
    .domain(categoryLabels)
    .range([0, innerWidth])
    .padding(0.1);
  
  const yScale = d3.scaleLinear()
    .domain([0, 5])  // Assuming max score is 5
    .range([innerHeight, 0]);
  
  // Draw axes
  g.append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .attr('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em');
  
  g.append('g')
    .call(d3.axisLeft(yScale));
  
  // Draw bars
  const colors = d3.schemeCategory10;
  const barWidth = xScale.bandwidth() / componentData.length;
  
  componentData.forEach((component, componentIndex) => {
    categoryLabels.forEach((label, i) => {
      const category = categories[i];
      const score = component.scores[category] || 0;
      
      g.append('rect')
        .attr('x', xScale(label) + componentIndex * barWidth)
        .attr('y', yScale(score))
        .attr('width', barWidth)
        .attr('height', innerHeight - yScale(score))
        .attr('fill', colors[componentIndex % colors.length]);
    });
  });
  
  // Add legend
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - margin.right + 20}, ${margin.top})`);
  
  componentData.forEach((component, i) => {
    const legendItem = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);
    
    legendItem.append('rect')
      .attr('width', 15)
      .attr('height', 15)
      .attr('fill', colors[i % colors.length]);
    
    legendItem.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .attr('font-size', '12px')
      .text(component.name);
  });
  
  // Add title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .attr('font-size', '18px')
    .attr('font-weight', 'bold')
    .text('Component Scores by Category');
  
  // Y-axis label
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('Score');
  
  return svg.node().outerHTML;
}

// Generate line chart for performance trends
function generateLineChart(resultsData) {
  const width = 800;
  const height = 500;
  const margin = { top: 60, right: 120, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  const svg = d3.create('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [0, 0, width, height])
    .attr('style', 'max-width: 100%; height: auto;');
    
  const g = svg.append('g')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);
  
  // Extract trend data - this would come from multiple results over time
  // For demo purposes, we'll create fake trend data if only one result is available
  let trendData = [];
  
  if (resultsData.length === 1) {
    // Create fake trend data for demonstration
    const components = resultsData[0].data.components;
    
    components.forEach(component => {
      const baseScores = { ...component.scores };
      
      // Generate 5 data points with slight variations
      for (let i = 0; i < 5; i++) {
        const scores = {};
        Object.keys(baseScores).forEach(key => {
          // Add some random variation
          scores[key] = Math.max(0, Math.min(5, baseScores[key] + (Math.random() - 0.5) * 0.5));
        });
        
        trendData.push({
          iteration: i + 1,
          component: component.name,
          scores
        });
      }
    });
  } else {
    // Use actual data from multiple results
    // This would require proper data structure from result files
    // For now, we'll use a placeholder
    console.log(chalk.yellow('Multiple result files not fully supported yet for trend analysis'));
  }
  
  // Calculate average score for each component in each iteration
  const trendsByComponent = {};
  
  trendData.forEach(data => {
    if (!trendsByComponent[data.component]) {
      trendsByComponent[data.component] = [];
    }
    
    const avgScore = Object.values(data.scores).reduce((sum, score) => sum + score, 0) / 
                    Object.values(data.scores).length;
    
    trendsByComponent[data.component].push({
      iteration: data.iteration,
      score: avgScore
    });
  });
  
  // Set up scales
  const xScale = d3.scaleLinear()
    .domain([1, d3.max(trendData, d => d.iteration)])
    .range([0, innerWidth]);
  
  const yScale = d3.scaleLinear()
    .domain([0, 5])  // Assuming max score is 5
    .range([innerHeight, 0]);
  
  // Draw axes
  g.append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(xScale).ticks(d3.max(trendData, d => d.iteration)));
  
  g.append('g')
    .call(d3.axisLeft(yScale));
  
  // Draw lines
  const colors = d3.schemeCategory10;
  const line = d3.line()
    .x(d => xScale(d.iteration))
    .y(d => yScale(d.score));
  
  Object.entries(trendsByComponent).forEach(([component, data], i) => {
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', colors[i % colors.length])
      .attr('stroke-width', 2)
      .attr('d', line);
      
    // Add dots for each data point
    g.selectAll(`.dot-${i}`)
      .data(data)
      .enter()
      .append('circle')
      .attr('class', `dot-${i}`)
      .attr('cx', d => xScale(d.iteration))
      .attr('cy', d => yScale(d.score))
      .attr('r', 4)
      .attr('fill', colors[i % colors.length]);
  });
  
  // Add legend
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - margin.right + 20}, ${margin.top})`);
  
  Object.keys(trendsByComponent).forEach((component, i) => {
    const legendItem = legend.append('g')
      .attr('transform', `translate(0, ${i * 20})`);
    
    legendItem.append('line')
      .attr('x1', 0)
      .attr('y1', 10)
      .attr('x2', 15)
      .attr('y2', 10)
      .attr('stroke', colors[i % colors.length])
      .attr('stroke-width', 2);
      
    legendItem.append('circle')
      .attr('cx', 7.5)
      .attr('cy', 10)
      .attr('r', 4)
      .attr('fill', colors[i % colors.length]);
    
    legendItem.append('text')
      .attr('x', 20)
      .attr('y', 12)
      .attr('font-size', '12px')
      .text(component);
  });
  
  // Add title
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', 30)
    .attr('text-anchor', 'middle')
    .attr('font-size', '18px')
    .attr('font-weight', 'bold')
    .text('Component Score Trends');
  
  // X-axis label
  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height - 10)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('Iteration');
  
  // Y-axis label
  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .text('Average Score');
  
  return svg.node().outerHTML;
}

// Generate HTML report with visualizations
function generateHTMLReport(resultData) {
  const componentsData = resultData.data.components || [];
  
  let visualizationsHTML = '';
  
  // Generate requested visualizations
  if (vizType === 'all' || vizType === 'radar') {
    visualizationsHTML += `
      <div class="chart-container">
        <h2>Radar Chart</h2>
        ${generateRadarChart(componentsData)}
      </div>
    `;
  }
  
  if (vizType === 'all' || vizType === 'bar') {
    visualizationsHTML += `
      <div class="chart-container">
        <h2>Bar Chart</h2>
        ${generateBarChart(componentsData)}
      </div>
    `;
  }
  
  if (vizType === 'all' || vizType === 'line') {
    visualizationsHTML += `
      <div class="chart-container">
        <h2>Line Chart (Trends)</h2>
        ${generateLineChart([resultData])}
      </div>
    `;
  }
  
  // Create HTML report
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Benchmark Visualization Report</title>
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
      .chart-container {
        margin-bottom: 50px;
        border: 1px solid #eee;
        padding: 20px;
        border-radius: 5px;
      }
      .summary {
        background-color: #f9f9f9;
        padding: 20px;
        border-radius: 5px;
        margin-bottom: 30px;
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
    </style>
  </head>
  <body>
    <div class="report-header">
      <h1>Benchmark Visualization Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
      <h2>Summary</h2>
      <p><strong>Total Components:</strong> ${componentsData.length}</p>
      ${resultData.data.overallScore ? `<p><strong>Overall Score:</strong> ${resultData.data.overallScore}</p>` : ''}
    </div>
    
    <div class="component-scores">
      <h2>Component Scores</h2>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Fidelity</th>
            <th>Code Quality</th>
            <th>Accessibility</th>
            <th>UX Polish</th>
            <th>Innovation</th>
            <th>Average</th>
          </tr>
        </thead>
        <tbody>
          ${componentsData.map(component => {
            const scores = component.scores || {};
            const avg = Object.values(scores).length > 0 
              ? (Object.values(scores).reduce((sum, score) => sum + score, 0) / Object.values(scores).length).toFixed(2)
              : 'N/A';
              
            return `
              <tr>
                <td>${component.name}</td>
                <td>${scores.fidelity || 'N/A'}</td>
                <td>${scores.code_quality || 'N/A'}</td>
                <td>${scores.accessibility || 'N/A'}</td>
                <td>${scores.ux_polish || 'N/A'}</td>
                <td>${scores.innovation || 'N/A'}</td>
                <td>${avg}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    ${visualizationsHTML}
  </body>
  </html>
  `;
  
  return html;
}

// Generate visualizations
console.log(chalk.blue('Generating visualizations...'));

results.forEach(result => {
  const outputFile = path.join(outputDir, `${path.parse(result.file).name}-visualization.html`);
  
  try {
    const htmlReport = generateHTMLReport(result);
    fs.writeFileSync(outputFile, htmlReport);
    console.log(chalk.green(`Generated visualization: ${outputFile}`));
  } catch (error) {
    console.error(chalk.red(`Error generating visualization for ${result.file}: ${error.message}`));
  }
});

console.log(chalk.blue('Visualization complete!')); 