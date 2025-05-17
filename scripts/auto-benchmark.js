#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const chalk = require("chalk");
const axios = require("axios");

// Get benchmark results directory
const resultsDir = path.join(__dirname, "../benchmark-results");

// Ensure the directory exists
if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

// Find previous benchmark results
const prevResults = fs.readdirSync(resultsDir)
  .filter(f => f.startsWith("model-comparison-results") && f.endsWith(".json"))
  .map(f => ({ file: f, time: fs.statSync(path.join(resultsDir, f)).mtime.getTime() }))
  .sort((a, b) => b.time - a.time);

const latestFile = prevResults[0]?.file;
let latest = null;

if (latestFile) {
  console.log(chalk.blue(`Found previous benchmark results: ${latestFile}`));
  try {
    latest = JSON.parse(fs.readFileSync(path.join(resultsDir, latestFile), "utf8"));
    console.log(chalk.green(`Successfully loaded previous results`));
  } catch (error) {
    console.error(chalk.red(`Error loading previous results: ${error.message}`));
  }
} else {
  console.log(chalk.yellow("No previous benchmark results found"));
}

// Run new benchmark
console.log(chalk.blue("\nRunning benchmark..."));
try {
  execSync("node scripts/compare-models.js", { stdio: "inherit" });
  console.log(chalk.green("\nBenchmark completed successfully"));
} catch (error) {
  console.error(chalk.red(`\nError running benchmark: ${error.message}`));
  process.exit(1);
}

// Find new result file
const newFiles = fs.readdirSync(resultsDir)
  .filter(f => f.startsWith("model-comparison-results") && f.endsWith(".json"))
  .sort((a, b) => fs.statSync(path.join(resultsDir, b)).mtime.getTime() - fs.statSync(path.join(resultsDir, a)).mtime.getTime());

if (newFiles.length === 0) {
  console.error(chalk.red("\nNo benchmark result files found after running benchmark"));
  process.exit(1);
}

const newFile = newFiles[0];
let newResults = null;

try {
  newResults = JSON.parse(fs.readFileSync(path.join(resultsDir, newFile), "utf8"));
  console.log(chalk.green(`\nLoaded new benchmark results: ${newFile}`));
} catch (error) {
  console.error(chalk.red(`\nError loading new results: ${error.message}`));
  process.exit(1);
}

// Compare latency/output size if prior results exist
if (latest && newResults) {
  console.log(chalk.blue("\n📊 Regression Check:"));
  
  // Check model-level metrics
  Object.keys(newResults.models).forEach(model => {
    if (latest.models && latest.models[model]) {
      const newModel = newResults.models[model];
      const oldModel = latest.models[model];
      
      // Check response time
      const avgRespTimeDiff = newModel.avgResponseTime - oldModel.avgResponseTime;
      const avgRespTimePercent = (avgRespTimeDiff / oldModel.avgResponseTime) * 100;
      
      if (avgRespTimeDiff > 100 || avgRespTimePercent > 10) {
        console.warn(chalk.yellow(`⚠️ [${model}] Average response time increased by ${avgRespTimeDiff.toFixed(1)}ms (${avgRespTimePercent.toFixed(1)}%)`));
      } else {
        console.log(chalk.green(`✅ [${model}] Response time: ${avgRespTimeDiff > 0 ? '+' : ''}${avgRespTimeDiff.toFixed(1)}ms (${avgRespTimePercent.toFixed(1)}%)`));
      }
      
      // Check code length
      const avgCodeLengthDiff = newModel.avgCodeLength - oldModel.avgCodeLength;
      const avgCodeLengthPercent = (avgCodeLengthDiff / oldModel.avgCodeLength) * 100;
      
      if (avgCodeLengthDiff < -50 || avgCodeLengthPercent < -10) {
        console.warn(chalk.yellow(`⚠️ [${model}] Average code length decreased by ${Math.abs(avgCodeLengthDiff).toFixed(1)} chars (${Math.abs(avgCodeLengthPercent).toFixed(1)}%)`));
      } else {
        console.log(chalk.green(`✅ [${model}] Code length: ${avgCodeLengthDiff > 0 ? '+' : ''}${avgCodeLengthDiff.toFixed(1)} chars (${avgCodeLengthPercent.toFixed(1)}%)`));
      }
      
      // Check success rate
      const successRateDiff = newModel.successRate - oldModel.successRate;
      
      if (successRateDiff < 0) {
        console.warn(chalk.yellow(`⚠️ [${model}] Success rate decreased by ${Math.abs(successRateDiff)}%`));
      } else if (successRateDiff > 0) {
        console.log(chalk.green(`✅ [${model}] Success rate improved by ${successRateDiff}%`));
      } else {
        console.log(chalk.green(`✅ [${model}] Success rate unchanged at ${newModel.successRate}%`));
      }
    } else {
      console.log(chalk.blue(`ℹ️ New model in benchmark: ${model}`));
    }
  });
  
  // Check per-prompt performance
  console.log(chalk.blue("\n📝 Per-Prompt Performance:"));
  Object.keys(newResults.prompts).forEach(prompt => {
    if (latest.prompts && latest.prompts[prompt]) {
      console.log(chalk.cyan(`\n🔍 Prompt: "${prompt}"`));
      
      Object.keys(newResults.prompts[prompt].results).forEach(model => {
        if (latest.prompts[prompt].results && latest.prompts[prompt].results[model]) {
          const newResult = newResults.prompts[prompt].results[model];
          const oldResult = latest.prompts[prompt].results[model];
          
          // Check response time
          const responseTimeDiff = newResult.responseTime - oldResult.responseTime;
          const responseTimePercent = (responseTimeDiff / oldResult.responseTime) * 100;
          
          if (responseTimeDiff > 100 || responseTimePercent > 10) {
            console.warn(chalk.yellow(`  ⚠️ [${model}] Response time increased by ${responseTimeDiff}ms (${responseTimePercent.toFixed(1)}%)`));
          }
          
          // Check code length
          const codeLengthDiff = newResult.codeLength - oldResult.codeLength;
          const codeLengthPercent = (codeLengthDiff / oldResult.codeLength) * 100;
          
          if (codeLengthDiff < -50 || codeLengthPercent < -10) {
            console.warn(chalk.yellow(`  ⚠️ [${model}] Code length decreased by ${Math.abs(codeLengthDiff)} chars (${Math.abs(codeLengthPercent).toFixed(1)}%)`));
          }
          
          // Check success status change
          if (oldResult.success && !newResult.success) {
            console.warn(chalk.red(`  🚨 [${model}] Regression: Previously successful but now failing`));
          } else if (!oldResult.success && newResult.success) {
            console.log(chalk.green(`  🎉 [${model}] Improvement: Previously failing but now successful`));
          }
        } else {
          console.log(chalk.blue(`  ℹ️ New model for this prompt: ${model}`));
        }
      });
    } else {
      console.log(chalk.blue(`ℹ️ New prompt in benchmark: "${prompt}"`));
    }
  });
  
  // Check for missing models/prompts in new results
  Object.keys(latest.models || {}).forEach(model => {
    if (!newResults.models[model]) {
      console.warn(chalk.yellow(`⚠️ Model "${model}" was in previous benchmark but missing from current one`));
    }
  });
  
  Object.keys(latest.prompts || {}).forEach(prompt => {
    if (!newResults.prompts[prompt]) {
      console.warn(chalk.yellow(`⚠️ Prompt "${prompt}" was in previous benchmark but missing from current one`));
    }
  });
}

// Generate markdown summary report
const reportFile = path.join(resultsDir, `benchmark-summary-${new Date().toISOString().replace(/:/g, '-')}.md`);
try {
  let report = `# Benchmark Summary Report\n\n`;
  report += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  
  if (latest) {
    report += `**Compared with:** ${latestFile}\n\n`;
  }
  
  report += `## Model Performance\n\n`;
  report += `| Model | Avg Response Time | Avg Code Length | Success Rate |\n`;
  report += `| ----- | ------------------ | --------------- | ------------ |\n`;
  
  Object.keys(newResults.models || {}).forEach(model => {
    const modelData = newResults.models[model] || { 
      avgResponseTime: 0, 
      avgCodeLength: 0, 
      successRate: 0 
    };
    
    // Use default values if properties are undefined or NaN
    const avgResponseTime = !isNaN(modelData.avgResponseTime) ? modelData.avgResponseTime.toFixed(1) : '0.0';
    const avgCodeLength = !isNaN(modelData.avgCodeLength) ? modelData.avgCodeLength.toFixed(1) : '0.0';
    const successRate = !isNaN(modelData.successRate) ? modelData.successRate : 0;
    
    report += `| ${model} | ${avgResponseTime}ms | ${avgCodeLength} chars | ${successRate}% |\n`;
  });
  
  report += `\n## Per-Prompt Performance\n\n`;
  
  Object.keys(newResults.prompts || {}).forEach(prompt => {
    report += `### ${prompt}\n\n`;
    
    const promptData = newResults.prompts[prompt] || {};
    const bestModel = promptData.bestModel || 'None';
    
    report += `Best model: **${bestModel}**\n\n`;
    report += `| Model | Response Time | Code Length | Success |\n`;
    report += `| ----- | ------------- | ----------- | ------- |\n`;
    
    Object.keys(promptData.results || {}).forEach(model => {
      const result = promptData.results[model] || { responseTime: 0, codeLength: 0, success: false };
      
      // Use default values if properties are undefined
      const responseTime = !isNaN(result.responseTime) ? result.responseTime : 0;
      const codeLength = !isNaN(result.codeLength) ? result.codeLength : 0;
      
      report += `| ${model} | ${responseTime}ms | ${codeLength} chars | ${result.success ? '✅' : '❌'} |\n`;
    });
    
    report += `\n`;
  });
  
  fs.writeFileSync(reportFile, report);
  console.log(chalk.green(`\n📄 Benchmark summary report generated: ${path.basename(reportFile)}`));
} catch (error) {
  console.error(chalk.red(`\nError generating summary report: ${error.message}`));
}

console.log(chalk.green("\n✅ Benchmark automation complete. Results saved to:"), chalk.cyan(newFile));

// Send webhook alert if configured
const webhookUrl = process.env.BENCHMARK_ALERT_WEBHOOK_URL;

if (webhookUrl) {
  const alertMsg = {
    content: `📊 Benchmark Completed (${new Date().toLocaleString()}):\n- Models tested: ${Object.keys(newResults.models || {}).length}\n- Results saved to: ${newFile}`,
  };

  // Check for regressions
  const regressions = [];
  
  Object.keys(newResults.models || {}).forEach(model => {
    if (latest?.models?.[model]) {
      const newModel = newResults.models[model];
      const oldModel = latest.models[model];
      
      // Check response time regression
      if (newModel.avgResponseTime - oldModel.avgResponseTime > 100) {
        regressions.push(`• ${model}: Response time increased by ${(newModel.avgResponseTime - oldModel.avgResponseTime).toFixed(1)}ms`);
      }
      
      // Check code length regression
      if (oldModel.avgCodeLength - newModel.avgCodeLength > 50) {
        regressions.push(`• ${model}: Code length decreased by ${(oldModel.avgCodeLength - newModel.avgCodeLength).toFixed(1)} chars`);
      }
      
      // Check success rate regression
      if (oldModel.successRate > newModel.successRate) {
        regressions.push(`• ${model}: Success rate dropped by ${(oldModel.successRate - newModel.successRate).toFixed(1)}%`);
      }
    }
  });

  // Check per-prompt regressions
  Object.keys(newResults.prompts || {}).forEach(prompt => {
    if (latest?.prompts?.[prompt]) {
      Object.keys(newResults.prompts[prompt].results || {}).forEach(model => {
        if (latest.prompts[prompt].results?.[model]) {
          const newResult = newResults.prompts[prompt].results[model];
          const oldResult = latest.prompts[prompt].results[model];
          
          if (oldResult.success && !newResult.success) {
            regressions.push(`• ${model} now failing on prompt "${prompt}"`);
          }
        }
      });
    }
  });

  // Check for model changes
  const modelChanges = [];
  
  // New models
  Object.keys(newResults.models || {}).forEach(model => {
    if (latest && !latest.models?.[model]) {
      modelChanges.push(`• Added: ${model}`);
    }
  });
  
  // Removed models
  if (latest) {
    Object.keys(latest.models || {}).forEach(model => {
      if (!newResults.models?.[model]) {
        modelChanges.push(`• Removed: ${model}`);
      }
    });
  }

  if (regressions.length > 0) {
    alertMsg.content += `\n\n⚠️ ${regressions.length} regressions detected:\n${regressions.join("\n")}`;
  } else {
    alertMsg.content += "\n\n✅ No regressions detected!";
  }
  
  if (modelChanges.length > 0) {
    alertMsg.content += `\n\n🔄 Model changes:\n${modelChanges.join("\n")}`;
  }

  // Add link to report file if generated
  if (reportFile) {
    alertMsg.content += `\n\n📄 Full report: ${path.basename(reportFile)}`;
  }

  axios.post(webhookUrl, alertMsg)
    .then(() => console.log(chalk.green("\n✅ Sent benchmark alert webhook")))
    .catch(err => console.error(chalk.red("\n❌ Failed to send webhook:"), err.message));
} 