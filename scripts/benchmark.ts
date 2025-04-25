import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import chalk from 'chalk';

interface BenchmarkResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
}

interface TestCase {
  question: string;
  expectedKeywords: string[];
}

const TEST_CASES: TestCase[] = [
  {
    question: "When should I use a modal dialog vs. a slide-over panel?",
    expectedKeywords: ["modal", "dialog", "slide-over", "panel", "context", "focus", "attention", "disruption"]
  },
  {
    question: "How should I implement a responsive navigation bar?",
    expectedKeywords: ["navigation", "responsive", "mobile", "desktop", "hamburger", "menu", "breakpoint"]
  },
  {
    question: "What's the best approach for form validation in React?",
    expectedKeywords: ["form", "validation", "React", "error", "submit", "state", "feedback"]
  }
];

async function createTestSession(): Promise<string> {
  console.log(chalk.blue('Creating test session...'));
  
  try {
    const response = await fetch('http://localhost:3000/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Benchmark Session ${new Date().toISOString()}`,
        isShared: true
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create session: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(chalk.green(`Test session created with ID: ${data.id}`));
    
    return data.id;
  } catch (error) {
    console.error(chalk.red('Failed to create test session:'), error);
    throw error;
  }
}

async function benchmarkReasoningAPI(sessionId: string): Promise<BenchmarkResult[]> {
  console.log(chalk.blue('Benchmarking Reasoning API...'));
  const results: BenchmarkResult[] = [];
  
  for (const testCase of TEST_CASES) {
    console.log(chalk.yellow(`Testing: "${testCase.question}"`));
    
    const start = performance.now();
    try {
      const response = await fetch('http://localhost:3000/api/reasoning', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: testCase.question,
          sessionId,
          model: 'openai'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const end = performance.now();
      
      // Validate response contains expected keywords
      const fullText = data.fullReasoning.toLowerCase();
      const missingKeywords = testCase.expectedKeywords.filter(
        keyword => !fullText.includes(keyword.toLowerCase())
      );
      
      if (missingKeywords.length > 0) {
        results.push({
          name: `Reasoning API - ${testCase.question}`,
          success: false,
          duration: end - start,
          error: `Missing expected keywords: ${missingKeywords.join(', ')}`
        });
      } else {
        results.push({
          name: `Reasoning API - ${testCase.question}`,
          success: true,
          duration: end - start
        });
      }
      
    } catch (error) {
      const end = performance.now();
      results.push({
        name: `Reasoning API - ${testCase.question}`,
        success: false,
        duration: end - start,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

async function benchmarkSessionAPIs(sessionId: string): Promise<BenchmarkResult[]> {
  console.log(chalk.blue('Benchmarking Session APIs...'));
  const results: BenchmarkResult[] = [];
  
  // Test GET session
  try {
    const start = performance.now();
    const response = await fetch(`http://localhost:3000/api/sessions?id=${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    await response.json();
    const end = performance.now();
    
    results.push({
      name: 'Get Session',
      success: true,
      duration: end - start
    });
  } catch (error) {
    results.push({
      name: 'Get Session',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  // Test Activities API
  try {
    const start = performance.now();
    const response = await fetch(`http://localhost:3000/api/session-activities?sessionId=${sessionId}`);
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }
    
    await response.json();
    const end = performance.now();
    
    results.push({
      name: 'Get Session Activities',
      success: true,
      duration: end - start
    });
  } catch (error) {
    results.push({
      name: 'Get Session Activities',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  
  return results;
}

async function generateReport(results: BenchmarkResult[]): Promise<void> {
  console.log(chalk.blue('\nGenerating benchmark report...'));
  
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTests,
      passedTests,
      failedTests,
      successRate: `${((passedTests / totalTests) * 100).toFixed(2)}%`,
      averageDuration: `${averageDuration.toFixed(2)}ms`
    },
    results
  };
  
  // Ensure reports directory exists
  const reportsDir = path.join(process.cwd(), 'benchmark-reports');
  await fs.mkdir(reportsDir, { recursive: true });
  
  // Write report to file
  const filename = path.join(reportsDir, `benchmark-${Date.now()}.json`);
  await fs.writeFile(filename, JSON.stringify(report, null, 2));
  
  console.log(chalk.green(`Benchmark report saved to ${filename}`));
  
  // Print summary to console
  console.log(chalk.yellow('\nBenchmark Summary:'));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${chalk.green(passedTests)}`);
  console.log(`Failed: ${chalk.red(failedTests)}`);
  console.log(`Success Rate: ${chalk.blue(report.summary.successRate)}`);
  console.log(`Average Duration: ${chalk.blue(report.summary.averageDuration)}`);
  
  // Print detailed results
  console.log(chalk.yellow('\nDetailed Results:'));
  results.forEach(result => {
    const statusColor = result.success ? chalk.green : chalk.red;
    const status = result.success ? 'PASS' : 'FAIL';
    console.log(`${statusColor(status)} - ${result.name} (${result.duration.toFixed(2)}ms)`);
    if (result.error) {
      console.log(`  Error: ${chalk.red(result.error)}`);
    }
  });
}

async function main() {
  console.log(chalk.yellow('Starting system benchmark suite...'));
  
  try {
    const sessionId = await createTestSession();
    
    // Run benchmarks
    const reasoningResults = await benchmarkReasoningAPI(sessionId);
    const sessionResults = await benchmarkSessionAPIs(sessionId);
    
    // Generate report
    const allResults = [...reasoningResults, ...sessionResults];
    await generateReport(allResults);
    
    console.log(chalk.green('\nBenchmark completed successfully!'));
  } catch (error) {
    console.error(chalk.red('\nBenchmark failed:'), error);
    process.exit(1);
  }
}

// Run the benchmark
main(); 