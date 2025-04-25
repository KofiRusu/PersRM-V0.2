import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

interface AssistantLogEntry {
  id: string;
  timestamp: string;
  action: 'open' | 'close';
  source: 'keyboard' | 'button';
  variant: 'slide-fade' | 'zoom-bounce' | 'none';
  sessionId: string;
  duration?: number;
  metadata?: {
    timestamp: string;
    url?: string;
  };
}

interface VariantAnalysis {
  variant: string;
  openCount: number;
  closeCount: number;
  keyboardOpenCount: number;
  keyboardCloseCount: number;
  buttonOpenCount: number;
  buttonCloseCount: number;
  averageDuration: number;
  totalDuration: number;
  engagementScore: number;
}

/**
 * Load assistant logs from JSONL file
 */
async function loadAssistantLogs(filePath: string): Promise<AssistantLogEntry[]> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const lines = data.trim().split('\n');
    return lines.map(line => JSON.parse(line));
  } catch (error) {
    console.error(`Error loading logs from ${filePath}:`, error);
    return [];
  }
}

/**
 * Analyze variant performance
 */
function analyzeVariants(logs: AssistantLogEntry[]): Record<string, VariantAnalysis> {
  const variants: Record<string, VariantAnalysis> = {};
  
  // Initialize variant records
  const variantNames = ['slide-fade', 'zoom-bounce', 'none'];
  variantNames.forEach(variant => {
    variants[variant] = {
      variant,
      openCount: 0,
      closeCount: 0,
      keyboardOpenCount: 0,
      keyboardCloseCount: 0,
      buttonOpenCount: 0,
      buttonCloseCount: 0,
      averageDuration: 0,
      totalDuration: 0,
      engagementScore: 0
    };
  });
  
  // Process logs
  logs.forEach(log => {
    const variant = log.variant;
    const action = log.action;
    const source = log.source;
    
    // Skip if variant is not recognized
    if (!variants[variant]) return;
    
    if (action === 'open') {
      variants[variant].openCount++;
      if (source === 'keyboard') {
        variants[variant].keyboardOpenCount++;
      } else {
        variants[variant].buttonOpenCount++;
      }
    } else if (action === 'close') {
      variants[variant].closeCount++;
      if (source === 'keyboard') {
        variants[variant].keyboardCloseCount++;
      } else {
        variants[variant].buttonCloseCount++;
      }
      
      // Track duration if available
      if (log.duration) {
        variants[variant].totalDuration += log.duration;
      }
    }
  });
  
  // Calculate averages and engagement score
  Object.values(variants).forEach(variant => {
    // Calculate average duration
    if (variant.closeCount > 0) {
      variant.averageDuration = variant.totalDuration / variant.closeCount;
    }
    
    // Calculate engagement score:
    // - keyboard usage weight (higher is better)
    // - average duration weight (higher is better)
    // - open/close ratio weight (closer to 1 is better)
    const keyboardUsage = (variant.keyboardOpenCount + variant.keyboardCloseCount) / 
                         Math.max(1, variant.openCount + variant.closeCount);
    const durationScore = Math.min(1, variant.averageDuration / 60); // Cap at 60 seconds
    const openCloseRatio = Math.min(variant.openCount, variant.closeCount) / 
                          Math.max(1, Math.max(variant.openCount, variant.closeCount));
    
    // Weighted engagement score
    variant.engagementScore = (keyboardUsage * 0.4) + (durationScore * 0.4) + (openCloseRatio * 0.2);
  });
  
  return variants;
}

/**
 * Determine the winning variant
 */
function determineWinner(variants: Record<string, VariantAnalysis>): VariantAnalysis {
  return Object.values(variants).reduce((winner, current) => {
    return current.engagementScore > winner.engagementScore ? current : winner;
  }, Object.values(variants)[0]);
}

/**
 * Save winning variant to configuration
 */
async function saveWinningVariant(variant: string): Promise<void> {
  const configPath = path.join(process.cwd(), 'src', 'config', 'animations.ts');
  
  try {
    const configContent = `// This file is auto-generated based on A/B test results
export const ANIMATION_VARIANT = '${variant}';

// Animation variant options
export type AnimationVariant = 'slide-fade' | 'zoom-bounce' | 'none';

// Define animation properties for each variant
export const ANIMATION_PROPERTIES = {
  'slide-fade': {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.3 }
    },
    exit: { 
      opacity: 0, 
      y: 20,
      transition: { duration: 0.2 }
    }
  },
  'zoom-bounce': {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: { 
        type: "spring", 
        damping: 12, 
        stiffness: 200 
      }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8,
      transition: { duration: 0.15 }
    }
  },
  'none': {
    hidden: { opacity: 1 },
    visible: { opacity: 1 },
    exit: { opacity: 1 }
  }
};`;
    
    // Create directory if it doesn't exist
    const configDir = path.dirname(configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    // Write config file
    await fs.writeFile(configPath, configContent);
    console.log(chalk.green(`Winning variant '${variant}' saved to ${configPath}`));
  } catch (error) {
    console.error(`Error saving winning variant:`, error);
  }
}

/**
 * Generate a detailed report
 */
async function generateReport(variants: Record<string, VariantAnalysis>, winner: VariantAnalysis): Promise<void> {
  const reportDir = path.join(process.cwd(), 'reports');
  await fs.mkdir(reportDir, { recursive: true });
  
  const timestamp = new Date().toISOString().replace(/[:T.]/g, '-').slice(0, 19);
  const reportPath = path.join(reportDir, `ab-test-report-${timestamp}.md`);
  
  const report = `# Animation Variant A/B Test Report
Generated: ${new Date().toISOString()}

## Summary

The A/B test compared ${Object.keys(variants).length} animation variants for the UI reasoning assistant:
${Object.keys(variants).map(v => `- ${v}`).join('\n')}

**Winner: ${winner.variant}** (Engagement Score: ${(winner.engagementScore * 100).toFixed(2)}%)

## Detailed Results

| Metric | ${Object.values(variants).map(v => v.variant).join(' | ')} |
|--------|${Object.values(variants).map(() => '------').join('|')}|
| Open Count | ${Object.values(variants).map(v => v.openCount).join(' | ')} |
| Close Count | ${Object.values(variants).map(v => v.closeCount).join(' | ')} |
| Keyboard Opens | ${Object.values(variants).map(v => v.keyboardOpenCount).join(' | ')} |
| Button Opens | ${Object.values(variants).map(v => v.buttonOpenCount).join(' | ')} |
| Avg Duration (s) | ${Object.values(variants).map(v => v.averageDuration.toFixed(2)).join(' | ')} |
| Engagement Score | ${Object.values(variants).map(v => (v.engagementScore * 100).toFixed(2) + '%').join(' | ')} |

## Engagement Score Calculation

The engagement score is a composite metric calculated using:
- Keyboard usage (40%): How often users used keyboard shortcuts vs buttons
- Duration (40%): Average session duration (capped at 60s)
- Open/Close ratio (20%): How many sessions were properly closed vs abandoned

## Recommendations

Based on these results, we recommend using the **${winner.variant}** animation variant for all users. This variant showed:
${winner.keyboardOpenCount > 0 ? 
  `- Higher keyboard shortcut usage (${winner.keyboardOpenCount} keyboard opens)` : ''}
${winner.averageDuration > Object.values(variants).filter(v => v.variant !== winner.variant).reduce((sum, v) => sum + v.averageDuration, 0) / Math.max(1, Object.values(variants).length - 1) ?
  `- Longer average session duration (${winner.averageDuration.toFixed(2)}s)` : ''}
${winner.openCount > 0 && winner.closeCount > 0 ?
  `- Balanced open/close ratio (${(winner.closeCount / Math.max(1, winner.openCount) * 100).toFixed(2)}% sessions properly closed)` : ''}

This analysis has been used to automatically set the default animation variant in the configuration.
`;
  
  await fs.writeFile(reportPath, report);
  console.log(chalk.green(`A/B test report saved to ${reportPath}`));
  
  // Also print summary to console
  console.log(chalk.yellow('\nA/B Test Results Summary:'));
  console.log(`Total entries analyzed: ${Object.values(variants).reduce((sum, v) => sum + v.openCount + v.closeCount, 0)}`);
  console.log(`Winner: ${chalk.green(winner.variant)} with engagement score ${chalk.blue((winner.engagementScore * 100).toFixed(2) + '%')}`);
  
  console.log(chalk.yellow('\nVariant Comparison:'));
  Object.values(variants).forEach(variant => {
    const isWinner = variant.variant === winner.variant;
    const color = isWinner ? chalk.green : chalk.white;
    console.log(color(`${variant.variant}: Score ${(variant.engagementScore * 100).toFixed(2)}%, ${variant.openCount} opens, ${variant.averageDuration.toFixed(2)}s avg duration`));
  });
}

/**
 * Main function to analyze A/B tests
 */
async function analyzeABTests(logsPath: string): Promise<void> {
  console.log(chalk.blue('Analyzing animation variant A/B tests...'));
  
  try {
    // Load logs
    const logs = await loadAssistantLogs(logsPath);
    
    if (logs.length === 0) {
      console.log(chalk.yellow('No logs found! Please make sure the logs file exists and contains data.'));
      return;
    }
    
    console.log(chalk.green(`Loaded ${logs.length} log entries`));
    
    // Analyze variants
    const variants = analyzeVariants(logs);
    
    // Determine winner
    const winner = determineWinner(variants);
    
    console.log(chalk.green(`Analysis complete! Winning variant: ${chalk.bold(winner.variant)}`));
    
    // Save winning variant to config
    await saveWinningVariant(winner.variant);
    
    // Generate report
    await generateReport(variants, winner);
    
  } catch (error) {
    console.error(chalk.red('Error analyzing A/B tests:'), error);
  }
}

// Default logs path
const defaultLogsPath = path.join(process.cwd(), 'data', 'assistant-logs.jsonl');

// Handle command line arguments
const args = process.argv.slice(2);
const logsPath = args.length > 0 ? args[0] : defaultLogsPath;

// Run the analysis
analyzeABTests(logsPath); 