#!/usr/bin/env node

/**
 * PersLM Self-Improvement CLI
 * This script analyzes benchmark scoring reports and generates improvement suggestions
 */

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const { SelfImprovementEngine } = require('../self-improvement/self-improvement-engine');

// Define the program
const program = new Command();

program
  .name('improve')
  .description('Analyze benchmark scoring reports to generate self-improvement suggestions')
  .option('-i, --input <path>', 'Path to scoring reports directory', './generation-benchmark/analysis/reports')
  .option('-o, --output <path>', 'Path to output file for suggestions', './generation-benchmark/analysis/improvement-suggestions.md')
  .option('-v, --verbose', 'Show verbose output', false)
  .option('--apply', 'Automatically apply improvement suggestions', false)
  .option('--memory <path>', 'Path to memory storage file', './improvement-memory.json')
  .parse(process.argv);

const options = program.opts();

// Main function
async function main() {
  try {
    console.log('🧠 PersLM Self-Improvement Engine');
    console.log('Analyzing scoring reports...');
    
    // Verify report directory exists
    if (!fs.existsSync(options.input)) {
      console.error(`Error: Report directory not found at ${options.input}`);
      process.exit(1);
    }
    
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Create and run the self-improvement engine
    const engine = new SelfImprovementEngine();
    
    console.log(`Analyzing reports from: ${options.input}`);
    const summary = await engine.analyzeScoringReports(options.input);
    
    if (options.verbose) {
      console.log('Analysis summary:');
      console.log(`- Total reports analyzed: ${summary.totalReports}`);
      console.log(`- Component types: ${summary.componentTypes.join(', ')}`);
      console.log(`- Most common weakness: ${summary.mostCommonWeakness}`);
      
      console.log('\nWeaknesses detected:');
      summary.weaknesses.forEach(w => {
        console.log(`- ${w.category}: ${w.count} occurrences`);
      });
      
      console.log('\nAverage scores:');
      summary.averageScores.forEach(s => {
        console.log(`- ${s.category}: ${s.score.toFixed(2)}`);
      });
      
      console.log('\nAverage improvements by category:');
      summary.improvementsByCategory.forEach(i => {
        console.log(`- ${i.category}: ${i.averageImprovement.toFixed(2)}`);
      });
    }
    
    // Generate suggestions
    const promptSuggestions = engine.suggestPromptImprovements(summary);
    const strategySuggestions = engine.suggestEnhancementStrategies(summary);
    
    // Create improvement report
    const report = generateImprovementReport(summary, promptSuggestions, strategySuggestions);
    
    // Save report
    fs.writeFileSync(options.output, report);
    console.log(`Improvement suggestions saved to: ${options.output}`);
    
    // Apply suggestions if requested
    if (options.apply) {
      console.log('\nApplying self-improvements...');
      await engine.applySelfImprovements();
      console.log('Self-improvements applied successfully');
    }
    
    console.log('\n✅ Self-improvement analysis completed successfully!');
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * Generates a markdown report with improvement suggestions
 */
function generateImprovementReport(summary, promptSuggestions, strategySuggestions) {
  const now = new Date();
  
  let report = `# PersLM Self-Improvement Suggestions\n\n`;
  report += `**Generated**: ${now.toISOString().split('T')[0]}\n\n`;
  
  // Add analysis summary
  report += `## Analysis Summary\n\n`;
  report += `- **Reports Analyzed**: ${summary.totalReports}\n`;
  report += `- **Component Types**: ${summary.componentTypes.join(', ')}\n`;
  report += `- **Most Common Weakness**: ${summary.mostCommonWeakness}\n\n`;
  
  // Add average scores
  report += `### Average Scores\n\n`;
  report += `| Category | Score |\n`;
  report += `|----------|-------|\n`;
  summary.averageScores.forEach(s => {
    report += `| ${s.category} | ${s.score.toFixed(2)}/5 |\n`;
  });
  report += '\n';
  
  // Add key weaknesses
  report += `### Key Weaknesses\n\n`;
  summary.weaknesses.forEach(w => {
    report += `- **${w.category}**: ${w.count} occurrences\n`;
  });
  report += '\n';
  
  // Add prompt improvement suggestions
  report += `## Prompt Improvement Suggestions\n\n`;
  promptSuggestions.forEach(s => {
    report += `- ${s}\n`;
  });
  report += '\n';
  
  // Add enhancement strategy suggestions
  report += `## Enhancement Strategy Suggestions\n\n`;
  strategySuggestions.forEach(s => {
    report += `- ${s}\n`;
  });
  report += '\n';
  
  // Add next steps
  report += `## Next Steps\n\n`;
  report += `1. Apply the suggested prompt improvements to the component generation prompts\n`;
  report += `2. Implement the suggested enhancement strategies in the component enhancement process\n`;
  report += `3. Run the benchmark again to measure the impact of these improvements\n`;
  report += `4. Continue the self-improvement cycle to refine results further\n`;
  
  return report;
}

// Run the main function
main(); 