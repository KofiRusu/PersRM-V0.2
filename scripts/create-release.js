#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');

/**
 * Get the last release version from git tags
 */
function getLastReleaseVersion() {
  try {
    // Get the most recent tag
    const tags = execSync('git tag -l "v*" --sort=-v:refname').toString().trim().split('\n');
    if (tags.length === 0 || tags[0] === '') {
      console.log(chalk.yellow('No previous release tags found. Using v0.0.0 as base.'));
      return 'v0.0.0';
    }
    return tags[0];
  } catch (error) {
    console.error(chalk.red('Error getting last release version:'), error.message);
    return 'v0.0.0';
  }
}

/**
 * Get commits since the last release
 */
function getCommitsSinceRelease(lastRelease) {
  try {
    const format = '%h|%an|%s';
    const output = execSync(`git log ${lastRelease}..HEAD --pretty=format:"${format}"`).toString().trim();
    
    if (!output) {
      return [];
    }
    
    return output.split('\n').map(line => {
      const [hash, author, message] = line.split('|');
      return { hash, author, message };
    });
  } catch (error) {
    console.error(chalk.red('Error getting commits:'), error.message);
    return [];
  }
}

/**
 * Normalize commit messages and categorize them
 */
function categorizeCommits(commits) {
  const features = [];
  const fixes = [];
  const others = [];

  for (const commit of commits) {
    const message = commit.message.trim();
    
    // Skip merge commits
    if (message.startsWith('Merge ')) {
      continue;
    }
    
    // Clean and normalize the message
    let cleanMessage = message.replace(/^\w+:\s*/, '');
    cleanMessage = cleanMessage.charAt(0).toUpperCase() + cleanMessage.slice(1);
    
    if (!cleanMessage.endsWith('.')) {
      cleanMessage += '.';
    }
    
    // Categorize based on prefixes or keywords
    if (message.startsWith('feat') || 
        message.match(/add(ed)?\s|new\s|implement(ed)?\s|introduce(d)?\s/i)) {
      features.push(cleanMessage);
    } else if (message.startsWith('fix') || 
               message.match(/fix(ed)?\s|resolve(d)?\s|correct(ed)?\s|patch(ed)?\s/i)) {
      fixes.push(cleanMessage);
    } else {
      others.push(cleanMessage);
    }
  }
  
  return { features, fixes, others };
}

/**
 * Load benchmark results
 */
function loadBenchmarks() {
  try {
    const benchmarkDir = path.join(process.cwd(), 'benchmark-reports');
    
    if (!fs.existsSync(benchmarkDir)) {
      return null;
    }
    
    const files = fs.readdirSync(benchmarkDir)
      .filter(file => file.startsWith('benchmark-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      return null;
    }
    
    const latestBenchmark = fs.readFileSync(path.join(benchmarkDir, files[0]), 'utf8');
    return JSON.parse(latestBenchmark);
  } catch (error) {
    console.error(chalk.yellow('Could not load benchmark results:'), error.message);
    return null;
  }
}

/**
 * Load A/B test results
 */
function loadABTestResults() {
  try {
    const reportsDir = path.join(process.cwd(), 'reports');
    
    if (!fs.existsSync(reportsDir)) {
      return null;
    }
    
    const files = fs.readdirSync(reportsDir)
      .filter(file => file.startsWith('ab-test-report-') && file.endsWith('.md'))
      .sort()
      .reverse();
    
    if (files.length === 0) {
      return null;
    }
    
    const latestReport = fs.readFileSync(path.join(reportsDir, files[0]), 'utf8');
    return latestReport;
  } catch (error) {
    console.error(chalk.yellow('Could not load A/B test results:'), error.message);
    return null;
  }
}

/**
 * Bump the semantic version
 */
function bumpSemver(version, type) {
  const [major, minor, patch] = version.replace('v', '').split('.').map(Number);
  
  switch (type) {
    case 'major':
      return `v${major + 1}.0.0`;
    case 'minor':
      return `v${major}.${minor + 1}.0`;
    case 'patch':
      return `v${major}.${minor}.${patch + 1}`;
    default:
      return version;
  }
}

/**
 * Bump the version in package.json
 */
function bumpVersion(version) {
  try {
    const packagePath = path.join(process.cwd(), 'package.json');
    
    if (!fs.existsSync(packagePath)) {
      console.warn(chalk.yellow('package.json not found, skipping version bump'));
      return;
    }
    
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    packageJson.version = version.replace('v', '');
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log(chalk.green(`Updated package.json to version ${version}`));
  } catch (error) {
    console.error(chalk.red('Error updating package.json:'), error.message);
  }
}

/**
 * Generate release notes
 */
function generateReleaseNotes(version, releaseType, { features, fixes, others }, benchmarks, abTestResults) {
  const date = new Date().toISOString().split('T')[0];
  let notes = `# ${version} (${date}) - ${releaseType}\n\n`;
  
  // Add summary
  notes += '## Summary\n\n';
  notes += `This ${releaseType} release includes `;
  const counts = [];
  if (features.length > 0) counts.push(`${features.length} new features`);
  if (fixes.length > 0) counts.push(`${fixes.length} bug fixes`);
  if (others.length > 0) counts.push(`${others.length} improvements`);
  
  if (counts.length === 0) {
    notes += 'various improvements and maintenance updates.\n\n';
  } else {
    const lastCount = counts.pop();
    notes += counts.length > 0 ? counts.join(', ') + ' and ' + lastCount + '.\n\n' : lastCount + '.\n\n';
  }
  
  // Add features
  if (features.length > 0) {
    notes += '## New Features\n\n';
    features.forEach(feature => {
      notes += `- ${feature}\n`;
    });
    notes += '\n';
  }
  
  // Add fixes
  if (fixes.length > 0) {
    notes += '## Bug Fixes\n\n';
    fixes.forEach(fix => {
      notes += `- ${fix}\n`;
    });
    notes += '\n';
  }
  
  // Add other changes
  if (others.length > 0) {
    notes += '## Other Changes\n\n';
    others.forEach(other => {
      notes += `- ${other}\n`;
    });
    notes += '\n';
  }
  
  // Add benchmark results if available
  if (benchmarks) {
    notes += '## Performance\n\n';
    notes += '| Metric | Value | Change |\n';
    notes += '| ------ | ----- | ------ |\n';
    
    if (benchmarks.responseTime) {
      notes += `| Average Response Time | ${benchmarks.responseTime.current}ms | ${benchmarks.responseTime.change > 0 ? '+' : ''}${benchmarks.responseTime.change}% |\n`;
    }
    if (benchmarks.memoryUsage) {
      notes += `| Memory Usage | ${benchmarks.memoryUsage.current}MB | ${benchmarks.memoryUsage.change > 0 ? '+' : ''}${benchmarks.memoryUsage.change}% |\n`;
    }
    if (benchmarks.throughput) {
      notes += `| Throughput | ${benchmarks.throughput.current} req/s | ${benchmarks.throughput.change > 0 ? '+' : ''}${benchmarks.throughput.change}% |\n`;
    }
    notes += '\n';
  }
  
  // Add A/B test winner if available
  if (abTestResults) {
    notes += '## A/B Test Results\n\n';
    
    // Extract just a summary - assuming the report follows a specific format
    const summary = abTestResults.split('\n').slice(0, 10).join('\n');
    notes += summary + '\n\n';
    notes += '(See the full report in the reports directory for details)\n\n';
  }
  
  // Add known issues
  notes += '## Known Issues\n\n';
  notes += '- None at this time.\n\n';
  
  // Add installation instructions
  notes += '## Installation\n\n';
  notes += '```\nnpm install\nnpm run build\nnpm start\n```\n\n';
  
  return notes;
}

/**
 * Save release notes to a file
 */
function saveReleaseNotes(version, notes) {
  try {
    const releasesDir = path.join(process.cwd(), 'releases');
    
    if (!fs.existsSync(releasesDir)) {
      fs.mkdirSync(releasesDir, { recursive: true });
    }
    
    const filePath = path.join(releasesDir, `RELEASE-${version}.md`);
    fs.writeFileSync(filePath, notes);
    
    console.log(chalk.green(`Release notes saved to ${filePath}`));
    return filePath;
  } catch (error) {
    console.error(chalk.red('Error saving release notes:'), error.message);
    return null;
  }
}

/**
 * Create a git tag for the release
 */
function createReleaseTag(version, notesPath) {
  try {
    // Create an annotated tag
    execSync(`git tag -a ${version} -m "Release ${version}"`);
    console.log(chalk.green(`Created git tag: ${version}`));
    
    // Suggest pushing the tag
    console.log(chalk.blue(`To push the tag to remote, run: git push origin ${version}`));
    
    return true;
  } catch (error) {
    console.error(chalk.red('Error creating git tag:'), error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log(chalk.blue('=== PersLM Release Creator ==='));
  
  const lastRelease = getLastReleaseVersion();
  console.log(chalk.blue(`Last release version: ${lastRelease}`));
  
  const commits = getCommitsSinceRelease(lastRelease);
  console.log(chalk.blue(`Found ${commits.length} commits since last release`));
  
  if (commits.length === 0) {
    console.log(chalk.yellow('No new commits found since last release. Continue anyway?'));
    const { continueAnyway } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'continueAnyway',
        message: 'Continue creating release with no new changes?',
        default: false
      }
    ]);
    
    if (!continueAnyway) {
      console.log(chalk.blue('Release creation cancelled.'));
      return;
    }
  }
  
  // Categorize commits
  const categorizedCommits = categorizeCommits(commits);
  
  // Load benchmark and A/B test results
  const benchmarks = loadBenchmarks();
  const abTestResults = loadABTestResults();
  
  // Prompt for release options
  const { versionType, version, releaseType, skipTag, skipNotes } = await inquirer.prompt([
    {
      type: 'list',
      name: 'versionType',
      message: 'Select version increment type:',
      choices: ['major', 'minor', 'patch', 'custom'],
      default: 'patch'
    },
    {
      type: 'input',
      name: 'version',
      message: 'Enter custom version:',
      default: (answers) => answers.versionType !== 'custom' ? bumpSemver(lastRelease, answers.versionType) : lastRelease,
      when: (answers) => answers.versionType === 'custom'
    },
    {
      type: 'list',
      name: 'releaseType',
      message: 'Select release type:',
      choices: ['stable', 'beta', 'alpha'],
      default: 'stable'
    },
    {
      type: 'confirm',
      name: 'skipTag',
      message: 'Skip creating git tag?',
      default: false
    },
    {
      type: 'confirm',
      name: 'skipNotes',
      message: 'Skip generating release notes?',
      default: false
    }
  ]);
  
  // Determine the final version
  const finalVersion = version || bumpSemver(lastRelease, versionType);
  console.log(chalk.blue(`Creating ${releaseType} release ${finalVersion}`));
  
  // Update package.json
  bumpVersion(finalVersion);
  
  // Generate and save release notes
  let notesPath = null;
  if (!skipNotes) {
    const notes = generateReleaseNotes(finalVersion, releaseType, categorizedCommits, benchmarks, abTestResults);
    notesPath = saveReleaseNotes(finalVersion, notes);
  }
  
  // Create git tag
  if (!skipTag) {
    createReleaseTag(finalVersion, notesPath);
  }
  
  console.log(chalk.green('Release creation completed!'));
}

// Run the main function
main().catch(error => {
  console.error(chalk.red('Error:'), error);
  process.exit(1);
}); 