import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';

interface ReleaseOptions {
  version: string;
  releaseType: 'stable' | 'beta' | 'alpha';
  skipTag: boolean;
  skipNotes: boolean;
  forceBump: boolean;
}

interface Benchmark {
  name: string;
  average: number;
  min: number;
  max: number;
  p95: number;
  success: boolean;
}

/**
 * Get the last release version from git tags
 */
function getLastReleaseVersion(): string {
  try {
    // Get all tags, sorted by version
    const tags = execSync('git tag -l "v*" --sort=-v:refname').toString().trim().split('\n');
    
    // Return the latest tag, or 'v0.0.0' if no tags exist
    return tags.length > 0 ? tags[0] : 'v0.0.0';
  } catch (error) {
    console.error('Error getting last release version:', error);
    return 'v0.0.0';
  }
}

/**
 * Get commits since the last release
 */
function getCommitsSinceRelease(lastRelease: string): Array<{ hash: string; message: string; author: string; date: string }> {
  try {
    // Get commits since the last release
    const format = '%H|%s|%an|%ad';
    const command = `git log ${lastRelease}..HEAD --pretty=format:"${format}"`;
    const output = execSync(command).toString().trim();
    
    if (!output) {
      return [];
    }
    
    // Parse commits
    return output.split('\n').map(line => {
      const [hash, message, author, date] = line.split('|');
      return { hash, message, author, date };
    });
  } catch (error) {
    console.error('Error getting commits since release:', error);
    return [];
  }
}

/**
 * Categorize commits into features, fixes, etc.
 */
function categorizeCommits(commits: Array<{ hash: string; message: string; author: string; date: string }>): {
  features: Array<{ hash: string; message: string; author: string }>;
  fixes: Array<{ hash: string; message: string; author: string }>;
  other: Array<{ hash: string; message: string; author: string }>;
} {
  const features: Array<{ hash: string; message: string; author: string }> = [];
  const fixes: Array<{ hash: string; message: string; author: string }> = [];
  const other: Array<{ hash: string; message: string; author: string }> = [];
  
  commits.forEach(commit => {
    const { hash, message, author } = commit;
    
    // Skip merge commits
    if (message.startsWith('Merge ')) {
      return;
    }
    
    // Categorize by commit message
    if (
      message.match(/^(feat|feature|add|implement)/i) ||
      message.includes('new') || 
      message.includes('support') ||
      message.includes('add')
    ) {
      features.push({ hash, message, author });
    } else if (
      message.match(/^(fix|bug|issue|resolve)/i) || 
      message.includes('fix') || 
      message.includes('resolv')
    ) {
      fixes.push({ hash, message, author });
    } else {
      other.push({ hash, message, author });
    }
  });
  
  return { features, fixes, other };
}

/**
 * Normalize a commit message
 */
function normalizeCommitMessage(message: string): string {
  // Remove common prefixes
  let normalized = message.replace(/^(feat|feature|fix|bug|chore|docs|style|refactor|perf|test|build|ci|revert)(\(.*?\))?:\s*/i, '');
  
  // Capitalize first letter
  normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  
  // Ensure it ends with a period
  if (!normalized.endsWith('.')) {
    normalized += '.';
  }
  
  return normalized;
}

/**
 * Load benchmark results
 */
async function loadBenchmarks(): Promise<Benchmark[]> {
  try {
    const benchmarkDir = path.join(process.cwd(), 'benchmark-reports');
    const files = await fs.readdir(benchmarkDir);
    
    // Get the most recent benchmark file
    const benchmarkFiles = files.filter(file => file.startsWith('benchmark-') && file.endsWith('.json'));
    
    if (benchmarkFiles.length === 0) {
      return [];
    }
    
    // Sort by file creation time (newest first)
    const sortedFiles = benchmarkFiles.sort(async (a, b) => {
      const statsA = await fs.stat(path.join(benchmarkDir, a));
      const statsB = await fs.stat(path.join(benchmarkDir, b));
      return statsB.mtime.getTime() - statsA.mtime.getTime();
    });
    
    // Load the most recent benchmark file
    const benchmarkPath = path.join(benchmarkDir, sortedFiles[0]);
    const benchmarkData = JSON.parse(await fs.readFile(benchmarkPath, 'utf-8'));
    
    // Extract benchmark results
    return benchmarkData.results.map((result: any) => ({
      name: result.name,
      average: result.duration,
      min: result.duration,
      max: result.duration,
      p95: result.duration,
      success: result.success
    }));
  } catch (error) {
    console.error('Error loading benchmarks:', error);
    return [];
  }
}

/**
 * Load A/B test results
 */
async function loadABTestResults(): Promise<{
  winner: string;
  score: number;
} | null> {
  try {
    const reportsDir = path.join(process.cwd(), 'reports');
    const files = await fs.readdir(reportsDir);
    
    // Get the most recent AB test report
    const abTestFiles = files.filter(file => file.startsWith('ab-test-report-') && file.endsWith('.md'));
    
    if (abTestFiles.length === 0) {
      return null;
    }
    
    // Sort by file creation time (newest first)
    const sortedFiles = abTestFiles.sort(async (a, b) => {
      const statsA = await fs.stat(path.join(reportsDir, a));
      const statsB = await fs.stat(path.join(reportsDir, b));
      return statsB.mtime.getTime() - statsA.mtime.getTime();
    });
    
    // Load the most recent AB test report
    const reportPath = path.join(reportsDir, sortedFiles[0]);
    const reportContent = await fs.readFile(reportPath, 'utf-8');
    
    // Extract winner information
    const winnerMatch = reportContent.match(/\*\*Winner:\s+([a-z-]+)\*\*\s+\(Engagement Score:\s+(\d+\.\d+)%\)/);
    
    if (winnerMatch) {
      return {
        winner: winnerMatch[1],
        score: parseFloat(winnerMatch[2])
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error loading A/B test results:', error);
    return null;
  }
}

/**
 * Generate release notes
 */
async function generateReleaseNotes(options: ReleaseOptions): Promise<string> {
  // Get the last release version
  const lastRelease = getLastReleaseVersion();
  
  // Get commits since the last release
  const commits = getCommitsSinceRelease(lastRelease);
  
  // Categorize commits
  const { features, fixes, other } = categorizeCommits(commits);
  
  // Load benchmarks
  const benchmarks = await loadBenchmarks();
  
  // Load A/B test results
  const abTestResults = await loadABTestResults();
  
  // Generate release notes
  const version = options.version.startsWith('v') ? options.version : `v${options.version}`;
  const releaseDate = new Date().toISOString().split('T')[0];
  
  let notes = `# ${version} Release Notes (${releaseDate})

## Overview

This ${options.releaseType === 'stable' ? 'stable release' : `${options.releaseType} release`} of the Reasoning Assistant System includes improvements to the user interface, performance optimizations, and new collaborative features.

`;

  // Add summary of key features
  notes += `## Key Features

- Team Copilot Mode with session creation, sharing, history logging, and collaborative views
- Adaptive Reasoning Assistant with prompt tracking and animation variant testing
- Reasoning Tree Visualizer with zoom, pan, layout modes, import/export, and ARIA features
- Execution Recovery System with resume checkpoints, toast feedback, and tool call monitoring

`;

  // Add features
  if (features.length > 0) {
    notes += '## New Features\n\n';
    features.forEach(feature => {
      notes += `- ${normalizeCommitMessage(feature.message)}\n`;
    });
    notes += '\n';
  }
  
  // Add fixes
  if (fixes.length > 0) {
    notes += '## Bug Fixes\n\n';
    fixes.forEach(fix => {
      notes += `- ${normalizeCommitMessage(fix.message)}\n`;
    });
    notes += '\n';
  }
  
  // Add other changes
  if (other.length > 0) {
    notes += '## Other Improvements\n\n';
    other.forEach(change => {
      notes += `- ${normalizeCommitMessage(change.message)}\n`;
    });
    notes += '\n';
  }
  
  // Add stability metrics
  if (benchmarks.length > 0) {
    notes += '## Stability Metrics\n\n';
    notes += '| Benchmark | Result | Status |\n';
    notes += '|-----------|--------|--------|\n';
    
    benchmarks.forEach(benchmark => {
      const status = benchmark.success ? '✅ Pass' : '❌ Fail';
      const result = `${benchmark.average.toFixed(2)}ms`;
      notes += `| ${benchmark.name} | ${result} | ${status} |\n`;
    });
    
    const successRate = benchmarks.filter(b => b.success).length / benchmarks.length * 100;
    notes += `\nOverall test success rate: ${successRate.toFixed(2)}%\n\n`;
  }
  
  // Add A/B test results
  if (abTestResults) {
    notes += '## A/B Test Results\n\n';
    notes += `After extensive testing, the **${abTestResults.winner}** animation variant has been selected as the default UI transition effect with an engagement score of ${abTestResults.score.toFixed(2)}%.\n\n`;
  }
  
  // Add known issues
  notes += '## Known Issues\n\n';
  notes += '- Some advanced template generation options are not yet fully implemented.\n';
  notes += '- The system may experience brief delays when processing complex queries with multiple embedded components.\n';
  notes += '- Export functionality is limited to JSON and CSV formats.\n\n';
  
  // Add how to share sessions
  notes += '## How to Share Sessions or Export Reasoning Chains\n\n';
  notes += '### Sharing Sessions\n\n';
  notes += '1. Open the Reasoning Assistant with the keyboard shortcut (⌘K / Ctrl+K) or by clicking the assistant icon.\n';
  notes += '2. Click the Session Switcher at the top of the assistant panel.\n';
  notes += '3. Find the session you want to share and click the share icon.\n';
  notes += '4. A shareable link will be copied to your clipboard, which you can send to collaborators.\n\n';
  
  notes += '### Exporting Reasoning Chains\n\n';
  notes += '1. Navigate to a shared session page or open the Reasoning Assistant.\n';
  notes += '2. For shared sessions, click the "Export" button at the top of the page.\n';
  notes += '3. From the assistant, use the History tab to view and export past reasoning chains.\n';
  notes += '4. Downloaded files can be imported into other sessions using the import functionality.\n';
  
  return notes;
}

/**
 * Save release notes to a file
 */
async function saveReleaseNotes(notes: string, version: string): Promise<string> {
  const releaseDir = path.join(process.cwd(), 'releases');
  await fs.mkdir(releaseDir, { recursive: true });
  
  const fileName = `${version.replace(/^v/, '')}.md`;
  const filePath = path.join(releaseDir, fileName);
  
  await fs.writeFile(filePath, notes);
  
  return filePath;
}

/**
 * Create a git tag for the release
 */
function createReleaseTag(version: string, message: string): void {
  try {
    // Ensure version has a 'v' prefix
    const tagVersion = version.startsWith('v') ? version : `v${version}`;
    
    // Create an annotated tag
    execSync(`git tag -a ${tagVersion} -m "${message}"`);
    console.log(chalk.green(`Created tag ${tagVersion}`));
    
    // Prompt to push the tag
    console.log(chalk.yellow('\nTo push the tag to the remote repository, run:'));
    console.log(chalk.blue(`git push origin ${tagVersion}`));
  } catch (error) {
    console.error('Error creating release tag:', error);
    throw error;
  }
}

/**
 * Bump version in package.json
 */
async function bumpVersion(version: string): Promise<void> {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  
  try {
    // Read package.json
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    
    // Update version
    packageJson.version = version.replace(/^v/, '');
    
    // Write updated package.json
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    
    console.log(chalk.green(`Updated package.json version to ${packageJson.version}`));
  } catch (error) {
    console.error('Error bumping version in package.json:', error);
  }
}

/**
 * Prompt for release options
 */
async function promptReleaseOptions(): Promise<ReleaseOptions> {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  let currentVersion = '0.0.0';
  
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    currentVersion = packageJson.version || '0.0.0';
  } catch (error) {
    console.warn('Could not read package.json, using default version');
  }
  
  const defaultVersion = bumpSemver(currentVersion, 'minor');
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'version',
      message: 'Enter the release version:',
      default: defaultVersion,
      validate: (input) => /^\d+\.\d+\.\d+(-.*)?$/.test(input) ? true : 'Please enter a valid semver version (e.g., 1.0.0, 1.0.0-beta.1)'
    },
    {
      type: 'list',
      name: 'releaseType',
      message: 'Select the release type:',
      choices: [
        { name: 'Stable', value: 'stable' },
        { name: 'Beta', value: 'beta' },
        { name: 'Alpha', value: 'alpha' }
      ],
      default: 'stable'
    },
    {
      type: 'confirm',
      name: 'skipTag',
      message: 'Skip creating a git tag?',
      default: false
    },
    {
      type: 'confirm',
      name: 'skipNotes',
      message: 'Skip generating release notes?',
      default: false
    },
    {
      type: 'confirm',
      name: 'forceBump',
      message: 'Force update version in package.json?',
      default: true
    }
  ]);
  
  return {
    version: answers.version,
    releaseType: answers.releaseType,
    skipTag: answers.skipTag,
    skipNotes: answers.skipNotes,
    forceBump: answers.forceBump
  };
}

/**
 * Bump a semver version
 */
function bumpSemver(version: string, type: 'major' | 'minor' | 'patch'): string {
  const semver = version.replace(/^v/, '').split('-')[0];
  const [major, minor, patch] = semver.split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      return version;
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log(chalk.blue('🚀 Creating Release...'));
  
  try {
    // Prompt for release options
    const options = await promptReleaseOptions();
    
    // Bump version in package.json if requested
    if (options.forceBump) {
      await bumpVersion(options.version);
    }
    
    // Generate and save release notes if requested
    if (!options.skipNotes) {
      console.log(chalk.blue('Generating release notes...'));
      const notes = await generateReleaseNotes(options);
      const filePath = await saveReleaseNotes(notes, options.version);
      console.log(chalk.green(`Release notes saved to ${filePath}`));
      
      // Show a preview of the release notes
      console.log(chalk.yellow('\nRelease Notes Preview:'));
      console.log(chalk.gray('-----------------------------------'));
      
      // Show first 10 lines
      const previewLines = notes.split('\n').slice(0, 10);
      console.log(previewLines.join('\n'));
      console.log(chalk.gray('...'));
      console.log(chalk.gray('-----------------------------------'));
    }
    
    // Create a git tag if requested
    if (!options.skipTag) {
      console.log(chalk.blue('Creating git tag...'));
      const tagMessage = `Release ${options.version}`;
      createReleaseTag(options.version, tagMessage);
    }
    
    console.log(chalk.green('\n✅ Release created successfully!'));
  } catch (error) {
    console.error(chalk.red('❌ Error creating release:'), error);
    process.exit(1);
  }
}

main(); 