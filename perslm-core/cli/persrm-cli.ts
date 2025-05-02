#!/usr/bin/env node

import { Command } from "commander";
import path from "path";
import { PersRMAgent } from "../lib/persrm/agent";
import {
  AgentMode,
  PersRMConfig,
  UXEnhancementSummary,
} from "../lib/persrm/types";
import { SelfImprovementEngine } from "../self-improvement/self-improvement-engine";
import { PromptRefiner } from "../self-improvement/prompt-refiner";
import {
  SelfTrainer,
  AdaptationStrategy,
} from "../self-improvement/self-train";
import {
  SelfImprovementMemory,
  StrategyOutcome,
} from "../self-improvement/improvement-memory";
import { StrategyDiscoveryEngine } from "../self-improvement/strategy-discovery";
import * as fs from "fs";
import * as path from "path";
import { program } from "commander";
import {
  SelfTrainer,
  ImprovementSummary,
} from "../self-improvement/self-train";
import { SelfImprovementMemory } from "../self-improvement/improvement-memory";
import { StrategyDiscoveryEngine } from "../self-improvement/strategy-discovery";
import {
  scoreComponent,
  scoreComponentFile,
  getEmptyScoreResult,
  getMinimumScoreResult,
  ScoreResult,
} from "../lib/scoring";

// Define the CLI version
const packageJson = require("../../package.json");
const VERSION = packageJson.version;

// Define a custom interface for the analyze result that includes reportPath
interface AnalysisResultWithReport {
  success: boolean;
  reportPath: string;
  data?: any;
  error?: string;
}

const program = new Command();

program
  .name("persrm")
  .description("PersRM: A tool for personalized UI/UX enhancement")
  .version(VERSION);

program
  .command("analyze")
  .description("Analyze a project for UI/UX issues")
  .option("-p, --project <path>", "Path to the project to analyze", ".")
  .option("-o, --output <path>", "Path to output directory", "./persrm-output")
  .option("-d, --design-system <path>", "Path to design system tokens")
  .option("-v, --verbose", "Show verbose output", false)
  .action(async (options) => {
    const config: PersRMConfig = {
      mode: AgentMode.ANALYSIS,
      projectPath: path.resolve(options.project),
      outputDir: path.resolve(options.output),
      designSystemPath: options.designSystem
        ? path.resolve(options.designSystem)
        : undefined,
      options: {
        verbose: options.verbose ?? false,
      },
    };

    console.log(`Analyzing project: ${config.projectPath}`);
    const agent = new PersRMAgent(config);

    try {
      // Cast the result to the interface that includes reportPath
      const result =
        (await agent.analyze()) as unknown as AnalysisResultWithReport;
      console.log("Analysis completed successfully!");

      // Check if reportPath exists before trying to access it
      if (result.reportPath) {
        console.log(`Report saved to: ${result.reportPath}`);
      } else {
        console.log(`Analysis complete. No report path was provided.`);
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      process.exit(1);
    }
  });

program
  .command("optimize")
  .description("Optimize UI/UX issues in a project")
  .option("-p, --project <path>", "Path to the project to optimize", ".")
  .option("-o, --output <path>", "Path to output directory", "./persrm-output")
  .option("-d, --design-system <path>", "Path to design system tokens")
  .option("-v, --verbose", "Show verbose output", false)
  .action(async (options) => {
    const config: PersRMConfig = {
      mode: AgentMode.OPTIMIZATION,
      projectPath: path.resolve(options.project),
      outputDir: path.resolve(options.output),
      designSystemPath: options.designSystem
        ? path.resolve(options.designSystem)
        : undefined,
      options: {
        verbose: options.verbose ?? false,
      },
    };

    console.log(`Optimizing project: ${config.projectPath}`);
    const agent = new PersRMAgent(config);

    try {
      const result = await agent.optimize();
      console.log("Optimization completed successfully!");
      console.log(`Report saved to: ${result.reportPath}`);

      // Updated to match the new UXEnhancementSummary type
      if (result.enhancementSummary) {
        displayOptimizationSummary(result.enhancementSummary);
      }
    } catch (error) {
      console.error("Optimization failed:", error);
      process.exit(1);
    }
  });

program
  .command("generate")
  .description("Generate UI component based on requirements")
  .option("-p, --project <path>", "Path to the project", ".")
  .option("-o, --output <path>", "Path to output directory", "./persrm-output")
  .option("-n, --name <n>", "Component name")
  .option(
    "-t, --type <type>",
    "Component type (button, card, form, modal, etc.)",
  )
  .option("-f, --framework <framework>", "Framework (react, vue, svelte)")
  .option(
    "-s, --styling <style>",
    "Styling method (css, scss, tailwind, styled-components)",
  )
  .option("-a, --accessibility", "Ensure accessibility compliance", true)
  .option("-v, --verbose", "Show verbose output", false)
  .option(
    "--phase <phase>",
    "Generation phase: baseline, enhance, or full",
    "full",
  )
  .action(async (options) => {
    if (!options.name || !options.type) {
      console.error("Component name and type are required");
      process.exit(1);
    }

    // Validate phase option
    const validPhases = ["baseline", "enhance", "full"];
    if (!validPhases.includes(options.phase)) {
      console.error(
        `Invalid phase: ${options.phase}. Must be one of: ${validPhases.join(", ")}`,
      );
      process.exit(1);
    }

    const config: PersRMConfig = {
      mode: AgentMode.GENERATION,
      projectPath: path.resolve(options.project),
      outputDir: path.resolve(options.output),
      options: {
        verbose: options.verbose ?? false,
        generationPhase: options.phase,
      },
    };

    console.log(`Generating component: ${options.name}`);
    const agent = new PersRMAgent(config);

    try {
      // Phase 1: Baseline Generation
      if (options.phase === "baseline" || options.phase === "full") {
        console.log("Starting Phase 1: Baseline Generation");
        const result = await agent.generateComponent({
          name: options.name,
          type: options.type,
          framework: options.framework,
          styling: options.styling,
          accessibility: options.accessibility,
          phase: "baseline",
        });

        if (!result.success) {
          console.error("Component generation failed:", result.error);
          process.exit(1);
        }

        console.log("Phase 1 complete: Baseline component generated");

        if (options.phase === "baseline") {
          console.log("Component files:");
          result.component?.files.forEach((file) => {
            console.log(`- ${file.path}`);
          });
        }
      }

      // Phase 2: UX Enhancement
      if (options.phase === "enhance" || options.phase === "full") {
        console.log("Starting Phase 2: UX Enhancement");
        const result = await agent.generateComponent({
          name: options.name,
          type: options.type,
          framework: options.framework,
          styling: options.styling,
          accessibility: options.accessibility,
          phase: "enhance",
        });

        if (!result.success) {
          console.error("UX enhancement failed:", result.error);
          process.exit(1);
        }

        console.log("Phase 2 complete: Enhanced component generated");
        console.log("Component files:");
        result.component?.files.forEach((file) => {
          console.log(`- ${file.path}`);
        });
      }
    } catch (error) {
      console.error("Component generation failed:", error);
      process.exit(1);
    }
  });

// Helper function to display optimization summary
function displayOptimizationSummary(summary: UXEnhancementSummary) {
  console.log("\n=== Optimization Summary ===");
  console.log(`Project: ${summary.projectName}`);
  console.log(`Generated: ${new Date(summary.timestamp).toLocaleString()}`);
  console.log(`Overall score: ${summary.overallScore}/100`);

  // Use topIssues instead of issues
  console.log(`Issues found: ${summary.topIssues.length}`);

  // Group issues by severity
  const bySeverity = summary.topIssues.reduce(
    (acc, issue) => {
      const severity = issue.severity || "unknown";
      acc[severity] = (acc[severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  console.log("\nIssues by severity:");
  Object.entries(bySeverity).forEach(([severity, count]) => {
    console.log(`- ${severity}: ${count}`);
  });

  console.log("\nTop recommendations:");
  summary.recommendations.slice(0, 5).forEach((rec, i) => {
    console.log(`${i + 1}. ${rec.title}`);
  });
}

// Parse the command line arguments
program
  .command("benchmark")
  .description("Run generation benchmarks against prompt files")
  .option(
    "-p, --prompts <path>",
    "Path to directory containing prompt files",
    "./generation-benchmark/prompts",
  )
  .option(
    "-o, --output <path>",
    "Path to output directory for generated components",
    "./generation-benchmark/outputs",
  )
  .option(
    "-r, --report <path>",
    "Path to output directory for benchmark reports",
    "./generation-benchmark/analysis",
  )
  .option(
    "-f, --framework <framework>",
    "Frontend framework to use (react, vue, svelte)",
    "react",
  )
  .option(
    "-s, --styling <style>",
    "CSS styling method (css, tailwind, styled-components)",
    "tailwind",
  )
  .option(
    "-c, --components <types>",
    'Component types to generate (comma-separated, or "all")',
    "all",
  )
  .option("-m, --max-score <number>", "Maximum score for each component", "100")
  .option(
    "-b, --baseline-only",
    "Generate only baseline components (no enhancement)",
    false,
  )
  .option("-v, --verbose", "Show verbose output", false)
  .action(async (options) => {
    console.log("🚀 Running PersLM generation benchmark");

    try {
      const fs = require("fs");
      const promptsDir = path.resolve(options.prompts);
      const outputDir = path.resolve(options.output);
      const reportDir = path.resolve(options.report);

      // Check if prompts directory exists
      if (!fs.existsSync(promptsDir)) {
        console.error(`Prompts directory not found: ${promptsDir}`);
        process.exit(1);
      }

      // Create output directories if they don't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      // Find all prompt files
      const promptFiles = fs
        .readdirSync(promptsDir)
        .filter(
          (filename) =>
            filename.endsWith(".txt") && filename.startsWith("prompt-"),
        )
        .map((filename) => path.join(promptsDir, filename))
        .sort();

      if (promptFiles.length === 0) {
        console.error(`No prompt files found in ${promptsDir}`);
        process.exit(1);
      }

      console.log(`Found ${promptFiles.length} prompt files`);

      // Filter by component types if specified
      const componentTypes =
        options.components === "all"
          ? []
          : options.components.split(",").map((t) => t.trim().toLowerCase());

      // Initialize PersRMAgent
      const config: PersRMConfig = {
        mode: AgentMode.GENERATION,
        projectPath: process.cwd(),
        outputDir,
        options: {
          verbose: options.verbose ?? false,
          framework: options.framework,
          styling: options.styling,
          maxScore: parseInt(options.maxScore, 10),
          enhancementEnabled: !options.baselineOnly,
        },
      };

      const agent = new PersRMAgent(config);

      // Store benchmark results
      const results = [];

      // Process each prompt file
      for (let i = 0; i < promptFiles.length; i++) {
        const promptFile = promptFiles[i];
        const filename = path.basename(promptFile);
        const match = filename.match(/prompt-(\d+)-(.+)\.txt/);

        if (!match) {
          console.warn(`Skipping ${filename} - doesn't match expected format`);
          continue;
        }

        const promptId = match[1];
        const componentType = match[2].replace(/-/g, " ");

        // Skip if filtering by component type
        if (
          componentTypes.length > 0 &&
          !componentTypes.includes(componentType.toLowerCase())
        ) {
          console.log(`Skipping ${componentType} (not in requested types)`);
          continue;
        }

        console.log(
          `\n[${i + 1}/${promptFiles.length}] Processing ${componentType} (ID: ${promptId})`,
        );

        try {
          // Read prompt content
          const promptContent = fs.readFileSync(promptFile, "utf-8");

          // Create component-specific output directory
          const componentOutputDir = path.join(outputDir, `prompt-${promptId}`);
          if (!fs.existsSync(componentOutputDir)) {
            fs.mkdirSync(componentOutputDir, { recursive: true });
          }

          // Save prompt file to output directory for reference
          fs.writeFileSync(
            path.join(componentOutputDir, "prompt.txt"),
            promptContent,
          );

          // Generate baseline component
          console.log(`Generating baseline ${componentType}...`);
          const baselineResult = await agent.generateBaselineComponent(
            promptContent,
            componentType,
          );

          if (baselineResult.success) {
            console.log(`✅ Baseline component generated`);

            // Calculate baseline score
            const baselineScore = scoreComponent(
              baselineResult.code,
              promptContent,
              "baseline",
              options.verbose,
            );

            console.log(`   Score: ${baselineScore.total}/${options.maxScore}`);

            // Store baseline component
            const componentName = `${componentType.replace(/\s+/g, "")}Component`;
            const baselineFilePath = path.join(
              componentOutputDir,
              `${componentName}.baseline.tsx`,
            );
            fs.writeFileSync(baselineFilePath, baselineResult.code);

            // Generate enhanced component if enabled
            if (!options.baselineOnly) {
              console.log(`Enhancing ${componentType}...`);
              const enhancedResult = await agent.enhanceComponentUX(
                baselineResult.code,
                promptContent,
                componentType,
              );

              if (enhancedResult.success) {
                console.log(`✅ Enhanced component generated`);

                // Calculate enhanced score
                const enhancedScore = scoreComponent(
                  enhancedResult.code,
                  promptContent,
                  "enhanced",
                  options.verbose,
                );

                console.log(
                  `   Score: ${enhancedScore.total}/${options.maxScore}`,
                );
                console.log(
                  `   Improvement: +${enhancedScore.total - baselineScore.total} points`,
                );

                // Store enhanced component
                const enhancedFilePath = path.join(
                  componentOutputDir,
                  `${componentName}.enhanced.tsx`,
                );
                fs.writeFileSync(enhancedFilePath, enhancedResult.code);

                // Store result
                results.push({
                  promptId,
                  componentType,
                  baselineScore: baselineScore.total,
                  enhancedScore: enhancedScore.total,
                  improvement: enhancedScore.total - baselineScore.total,
                });
              } else {
                console.error(
                  `❌ Failed to enhance component: ${enhancedResult.error}`,
                );
                // Store result with just baseline
                results.push({
                  promptId,
                  componentType,
                  baselineScore: baselineScore.total,
                  enhancedScore: null,
                  improvement: 0,
                  error: enhancedResult.error,
                });
              }
            } else {
              // Store result with just baseline
              results.push({
                promptId,
                componentType,
                baselineScore: baselineScore.total,
                enhancedScore: null,
                improvement: 0,
              });
            }
          } else {
            console.error(
              `❌ Failed to generate baseline component: ${baselineResult.error}`,
            );
            // Store failed result
            results.push({
              promptId,
              componentType,
              baselineScore: null,
              enhancedScore: null,
              improvement: 0,
              error: baselineResult.error,
            });
          }
        } catch (error) {
          console.error(`Error processing ${componentType}:`, error);
          results.push({
            promptId,
            componentType,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Generate benchmark report
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const reportPath = path.join(
        reportDir,
        `benchmark-report-${timestamp}.json`,
      );

      const report = {
        timestamp: new Date().toISOString(),
        config: {
          framework: options.framework,
          styling: options.styling,
          maxScore: parseInt(options.maxScore, 10),
          enhancementEnabled: !options.baselineOnly,
        },
        results,
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`\n✨ Benchmark complete!`);
      console.log(`   Generated ${results.length} components`);
      console.log(`   Report saved to: ${reportPath}`);

      // Display summary
      const successfulResults = results.filter((r) => r.baselineScore !== null);
      if (successfulResults.length > 0) {
        const avgBaselineScore =
          successfulResults.reduce((sum, r) => sum + r.baselineScore, 0) /
          successfulResults.length;
        console.log(
          `\n📊 Average baseline score: ${avgBaselineScore.toFixed(1)}/${options.maxScore}`,
        );

        if (!options.baselineOnly) {
          const enhancedResults = results.filter(
            (r) => r.enhancedScore !== null,
          );
          if (enhancedResults.length > 0) {
            const avgEnhancedScore =
              enhancedResults.reduce((sum, r) => sum + r.enhancedScore, 0) /
              enhancedResults.length;
            const avgImprovement =
              enhancedResults.reduce((sum, r) => sum + r.improvement, 0) /
              enhancedResults.length;

            console.log(
              `   Average enhanced score: ${avgEnhancedScore.toFixed(1)}/${options.maxScore}`,
            );
            console.log(
              `   Average improvement: +${avgImprovement.toFixed(1)} points`,
            );
          }
        }
      }
    } catch (error) {
      console.error("Benchmark failed:", error);
      process.exit(1);
    }
  });

program
  .command("score")
  .description(
    "Score generated components and create a detailed evaluation report",
  )
  .option(
    "-p, --prompts <path>",
    "Path to directory containing prompt files",
    "./generation-benchmark/prompts",
  )
  .option(
    "-i, --input <path>",
    "Path to generated components",
    "./generation-benchmark/outputs",
  )
  .option(
    "-o, --output <path>",
    "Path to output directory for scoring reports",
    "./generation-benchmark/analysis/reports",
  )
  .option(
    "-s, --summary <path>",
    "Path to summary report",
    "./generation-benchmark/analysis/scoring-summary.md",
  )
  .option("-c, --compare <path>", "Compare with reference (v0) components", "")
  .option(
    "-t, --type <type>",
    "Type of components to score (baseline, enhanced, all)",
    "all",
  )
  .option("-m, --max-score <number>", "Maximum score for each component", "100")
  .option("-v, --verbose", "Show verbose output", false)
  .action(async (options) => {
    console.log("🔍 Evaluating component quality");

    try {
      const fs = require("fs");
      const promptsDir = path.resolve(options.prompts);
      const inputDir = path.resolve(options.input);
      const outputDir = path.resolve(options.output);
      const summaryPath = path.resolve(options.summary);

      // Check if directories exist
      if (!fs.existsSync(promptsDir)) {
        console.error(`Prompts directory not found: ${promptsDir}`);
        process.exit(1);
      }

      if (!fs.existsSync(inputDir)) {
        console.error(`Input directory not found: ${inputDir}`);
        process.exit(1);
      }

      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Find all prompt directories in the input dir
      const promptDirs = fs
        .readdirSync(inputDir)
        .filter((dirname) => dirname.startsWith("prompt-"))
        .map((dirname) => path.join(inputDir, dirname))
        .filter((dirpath) => fs.statSync(dirpath).isDirectory())
        .sort();

      if (promptDirs.length === 0) {
        console.error(`No prompt directories found in ${inputDir}`);
        console.error("Run the benchmark command first to generate components");
        process.exit(1);
      }

      console.log(
        `Found ${promptDirs.length} component directories to evaluate`,
      );

      // Track all scores for summary report
      const allScores = [];

      // Process each component directory
      for (let i = 0; i < promptDirs.length; i++) {
        const promptDir = promptDirs[i];
        const promptDirName = path.basename(promptDir);
        const match = promptDirName.match(/prompt-(\d+)/);

        if (!match) {
          console.warn(
            `Skipping ${promptDirName} - doesn't match expected format`,
          );
          continue;
        }

        const promptId = match[1];
        console.log(
          `\n[${i + 1}/${promptDirs.length}] Scoring prompt ${promptId}`,
        );

        // Read the prompt content
        const promptPath = path.join(promptDir, "prompt.txt");
        if (!fs.existsSync(promptPath)) {
          console.warn(`Prompt file not found: ${promptPath}`);
          continue;
        }

        const promptContent = fs.readFileSync(promptPath, "utf-8");

        // Get component name from first component file
        const componentFiles = fs
          .readdirSync(promptDir)
          .filter((filename) => filename.endsWith(".tsx"))
          .sort();

        if (componentFiles.length === 0) {
          console.warn(`No component files found in ${promptDir}`);
          continue;
        }

        // Extract component name from filename
        const componentNameMatch = componentFiles[0].match(
          /(.+)\.(?:baseline|enhanced)\.tsx/,
        );
        if (!componentNameMatch) {
          console.warn(
            `Unable to extract component name from ${componentFiles[0]}`,
          );
          continue;
        }

        const componentName = componentNameMatch[1];

        // Score baseline component if present and requested
        let baselineScore = null;
        if (options.type === "baseline" || options.type === "all") {
          const baselineFile = path.join(
            promptDir,
            `${componentName}.baseline.tsx`,
          );

          if (fs.existsSync(baselineFile)) {
            console.log(`Evaluating baseline ${componentName}...`);
            const baselineCode = fs.readFileSync(baselineFile, "utf-8");
            baselineScore = scoreComponent(
              baselineCode,
              promptContent,
              "baseline",
              options.verbose,
            );

            console.log(
              `✅ Baseline score: ${baselineScore.total}/${options.maxScore}`,
            );
            console.log(
              `   Fidelity: ${baselineScore.fidelity}, Code Quality: ${baselineScore.codeQuality}, Accessibility: ${baselineScore.accessibility}`,
            );
          } else {
            console.warn(`Baseline component not found: ${baselineFile}`);
          }
        }

        // Score enhanced component if present and requested
        let enhancedScore = null;
        if (options.type === "enhanced" || options.type === "all") {
          const enhancedFile = path.join(
            promptDir,
            `${componentName}.enhanced.tsx`,
          );

          if (fs.existsSync(enhancedFile)) {
            console.log(`Evaluating enhanced ${componentName}...`);
            const enhancedCode = fs.readFileSync(enhancedFile, "utf-8");
            enhancedScore = scoreComponent(
              enhancedCode,
              promptContent,
              "enhanced",
              options.verbose,
            );

            console.log(
              `✅ Enhanced score: ${enhancedScore.total}/${options.maxScore}`,
            );
            console.log(
              `   Fidelity: ${enhancedScore.fidelity}, Code Quality: ${enhancedScore.codeQuality}, Accessibility: ${enhancedScore.accessibility}`,
            );

            if (baselineScore) {
              const improvement = enhancedScore.total - baselineScore.total;
              const improvementPercent =
                baselineScore.total > 0
                  ? ((improvement / baselineScore.total) * 100).toFixed(1)
                  : "0";

              console.log(
                `   Improvement: +${improvement} points (${improvementPercent}%)`,
              );
            }
          } else {
            console.warn(`Enhanced component not found: ${enhancedFile}`);
          }
        }

        // Score reference (v0) component if present and requested
        let v0Score = null;
        if (options.compare) {
          const v0Dir = path.resolve(options.compare);
          if (fs.existsSync(v0Dir)) {
            const v0PromptDir = path.join(v0Dir, promptDirName);
            if (fs.existsSync(v0PromptDir)) {
              const v0File = path.join(v0PromptDir, `${componentName}.v0.tsx`);

              if (fs.existsSync(v0File)) {
                console.log(`Evaluating reference ${componentName}...`);
                const v0Code = fs.readFileSync(v0File, "utf-8");
                v0Score = scoreComponent(
                  v0Code,
                  promptContent,
                  "v0",
                  options.verbose,
                );

                console.log(
                  `✅ Reference score: ${v0Score.total}/${options.maxScore}`,
                );
                console.log(
                  `   Fidelity: ${v0Score.fidelity}, Code Quality: ${v0Score.codeQuality}, Accessibility: ${v0Score.accessibility}`,
                );
              }
            }
          }
        }

        // Generate a detailed scoring report
        const reportFilename = `${promptId}-${componentName}-score.md`;
        const reportPath = path.join(outputDir, reportFilename);

        const report = generateScoringReport(
          promptId,
          componentName,
          promptContent,
          baselineScore,
          enhancedScore,
          v0Score,
        );

        fs.writeFileSync(reportPath, report);
        console.log(`   Report saved to: ${reportPath}`);

        // Add data for summary report
        if (baselineScore || enhancedScore) {
          allScores.push({
            promptId,
            componentName,
            baseline: baselineScore ? baselineScore.total : 0,
            enhanced: enhancedScore ? enhancedScore.total : 0,
            v0: v0Score ? v0Score.total : undefined,
            improvement:
              enhancedScore && baselineScore
                ? enhancedScore.total - baselineScore.total
                : 0,
          });
        }
      }

      // Generate summary report
      if (allScores.length > 0) {
        const summaryReport = generateSummaryReport(
          allScores,
          options.type,
          !!options.compare,
        );
        fs.writeFileSync(summaryPath, summaryReport);
        console.log(`\n✨ Scoring summary saved to: ${summaryPath}`);

        // Display overall statistics
        const avgBaseline =
          allScores.reduce((sum, s) => sum + s.baseline, 0) / allScores.length;
        console.log(
          `\n📊 Average baseline score: ${avgBaseline.toFixed(1)}/${options.maxScore}`,
        );

        if (options.type === "enhanced" || options.type === "all") {
          const enhancedScores = allScores.filter((s) => s.enhanced > 0);
          if (enhancedScores.length > 0) {
            const avgEnhanced =
              enhancedScores.reduce((sum, s) => sum + s.enhanced, 0) /
              enhancedScores.length;
            const avgImprovement =
              enhancedScores.reduce((sum, s) => sum + s.improvement, 0) /
              enhancedScores.length;
            const avgImprovementPercent = (
              (avgImprovement / avgBaseline) *
              100
            ).toFixed(1);

            console.log(
              `   Average enhanced score: ${avgEnhanced.toFixed(1)}/${options.maxScore}`,
            );
            console.log(
              `   Average improvement: +${avgImprovement.toFixed(1)} points (${avgImprovementPercent}%)`,
            );
          }
        }

        if (options.compare) {
          const v0Scores = allScores.filter((s) => s.v0 !== undefined);
          if (v0Scores.length > 0) {
            const avgV0 =
              v0Scores.reduce((sum, s) => sum + (s.v0 || 0), 0) /
              v0Scores.length;
            console.log(
              `   Average reference score: ${avgV0.toFixed(1)}/${options.maxScore}`,
            );
          }
        }
      } else {
        console.warn("No scores were generated");
      }
    } catch (error) {
      console.error("Scoring failed:", error);
      process.exit(1);
    }
  });

program
  .command("improve")
  .description("Analyze scoring reports and suggest improvements")
  .option(
    "-i, --input <path>",
    "Path to scoring reports",
    "./generation-benchmark/analysis/reports",
  )
  .option(
    "-o, --output <path>",
    "Path to output suggestions file",
    "./generation-benchmark/analysis/improvement-suggestions.md",
  )
  .option("-v, --verbose", "Show verbose output", false)
  .action(async (options) => {
    console.log(`Analyzing reports from: ${options.input}`);

    try {
      const fs = require("fs");
      const inputDir = path.resolve(options.input);
      const outputFile = path.resolve(options.output);

      // Check if input directory exists
      if (!fs.existsSync(inputDir)) {
        console.error(`Input directory not found: ${inputDir}`);
        process.exit(1);
      }

      // Create the self-improvement engine
      const engine = new SelfImprovementEngine();

      // Analyze scoring reports
      console.log("Analyzing scoring reports...");
      const analysis = await engine.analyzeScoringReports(inputDir);

      console.log(`Found ${analysis.totalReports} reports to analyze`);
      console.log(
        `Identified ${analysis.weaknesses.length} key weakness areas`,
      );

      if (options.verbose) {
        console.log("\nWeaknesses:");
        analysis.weaknesses.forEach(({ category, count }) => {
          console.log(`- ${category}: ${count} occurrences`);
        });

        console.log("\nAverage Scores:");
        analysis.averageScores.forEach(({ category, score }) => {
          console.log(`- ${category}: ${score.toFixed(2)}/5`);
        });
      }

      // Generate suggestions
      console.log("\nGenerating improvement suggestions...");
      const promptSuggestions = engine.suggestPromptImprovements(analysis);
      const enhancementSuggestions =
        engine.suggestEnhancementStrategies(analysis);

      // Create a report with the suggestions
      const formatDate = new Date().toISOString().split("T")[0];
      let report = `# PersLM Self-Improvement Suggestions\n\n`;
      report += `**Generated**: ${formatDate}\n\n`;

      report += `## Analysis Summary\n\n`;
      report += `- **Reports Analyzed**: ${analysis.totalReports}\n`;
      report += `- **Component Types**: ${analysis.componentTypes.join(", ")}\n`;
      report += `- **Most Common Weakness**: ${analysis.mostCommonWeakness}\n\n`;

      report += `### Average Scores\n\n`;
      report += `| Category | Score |\n`;
      report += `|----------|-------|\n`;
      analysis.averageScores.forEach(({ category, score }) => {
        report += `| ${category} | ${score.toFixed(2)}/5 |\n`;
      });

      report += `\n### Key Weaknesses\n\n`;
      if (analysis.weaknesses.length > 0) {
        analysis.weaknesses.forEach(({ category, count }) => {
          report += `- **${category}**: ${count} occurrences\n`;
        });
      } else {
        report += `No significant weaknesses identified.\n`;
      }

      report += `\n## Prompt Improvement Suggestions\n\n`;
      if (promptSuggestions.length > 0) {
        promptSuggestions.forEach((suggestion) => {
          report += `- ${suggestion}\n`;
        });
      } else {
        report += `No prompt improvements suggested.\n`;
      }

      report += `\n## Enhancement Strategy Suggestions\n\n`;
      if (enhancementSuggestions.length > 0) {
        enhancementSuggestions.forEach((suggestion) => {
          report += `- ${suggestion}\n`;
        });
      } else {
        report += `No enhancement strategy improvements suggested.\n`;
      }

      report += `\n## Top Component Improvements\n\n`;
      if (analysis.enhancementImprovements.length > 0) {
        report += `| Component | Score Improvement |\n`;
        report += `|-----------|-------------------|\n`;
        analysis.enhancementImprovements
          .slice(0, 5)
          .forEach(({ component, improvement }) => {
            report += `| ${component} | +${improvement} |\n`;
          });
      } else {
        report += `No component improvements data available.\n`;
      }

      report += `\n## Improvement by Category\n\n`;
      if (analysis.improvementsByCategory.length > 0) {
        report += `| Category | Average Improvement |\n`;
        report += `|----------|--------------------|`;
        analysis.improvementsByCategory.forEach(
          ({ category, averageImprovement }) => {
            report += `\n| ${category} | ${averageImprovement.toFixed(2)} |`;
          },
        );
      } else {
        report += `No improvement by category data available.\n`;
      }

      report += `\n\n## Next Steps\n\n`;
      report += `1. Review and apply the suggested prompt improvements\n`;
      report += `2. Implement the enhancement strategy suggestions\n`;
      report += `3. Run another benchmark to verify improvements\n`;
      report += `4. Repeat the improvement cycle\n`;

      // Save the report
      fs.writeFileSync(outputFile, report);
      console.log(`\n✨ Improvement suggestions saved to: ${outputFile}`);
    } catch (error) {
      console.error("Self-improvement analysis failed:", error);
      process.exit(1);
    }
  });

program
  .command("refine-prompts")
  .description("Refine prompt library based on improvement suggestions")
  .option(
    "-i, --input <path>",
    "Path to improvement suggestions file",
    "./generation-benchmark/analysis/improvement-suggestions.md",
  )
  .option(
    "-p, --prompts <path>",
    "Path to original prompts directory",
    "./generation-benchmark/prompts",
  )
  .option(
    "-o, --output <path>",
    "Path to output refined prompts",
    "./generation-benchmark/prompts-refined",
  )
  .option("-v, --verbose", "Show verbose output", false)
  .action(async (options) => {
    console.log("🔍 Analyzing improvement suggestions...");

    try {
      const fs = require("fs");
      const inputFile = path.resolve(options.input);
      const promptsDir = path.resolve(options.prompts);
      const outputDir = path.resolve(options.output);

      // Check if input file exists
      if (!fs.existsSync(inputFile)) {
        console.error(`Input file not found: ${inputFile}`);
        console.error(
          'Run the "improve" command first to generate improvement suggestions.',
        );
        process.exit(1);
      }

      // Check if prompts directory exists
      if (!fs.existsSync(promptsDir)) {
        console.error(`Prompts directory not found: ${promptsDir}`);
        process.exit(1);
      }

      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Create the prompt refiner
      const refiner = new PromptRefiner();

      // Analyze suggestions
      console.log("Analyzing suggestions and generating refined prompts...");
      const refinedPrompts = await refiner.analyzeSuggestions(inputFile);

      console.log(`Generated ${refinedPrompts.length} refined prompts`);

      if (options.verbose) {
        refinedPrompts.forEach((prompt) => {
          console.log(`\nPrompt ${prompt.promptId}:`);
          console.log(
            `- Suggested improvements: ${prompt.suggestedImprovements.length}`,
          );
          prompt.suggestedImprovements.forEach((improvement) => {
            console.log(`  - ${improvement}`);
          });
        });
      }

      // Apply refinements
      console.log("\nApplying refinements to prompts...");
      await refiner.applyRefinements(refinedPrompts, promptsDir);

      console.log(
        `\n✨ All prompts have been refined and saved to: ${outputDir}`,
      );
    } catch (error) {
      console.error("Prompt refinement failed:", error);
      process.exit(1);
    }
  });

program
  .command("self-train")
  .description(
    "Run self-improvement cycle for refining prompts and performance",
  )
  .option(
    "-p, --project-path <path>",
    "Path to project directory",
    process.cwd(),
  )
  .option("-c, --component-type <type>", "Component type to focus on", "")
  .option("-v, --verbose", "Show detailed output", false)
  .option("-m, --memory", "Use memory for adaptations", false)
  .option("--memory-path <path>", "Path to memory storage file")
  .action(async (options: any) => {
    const trainer = new SelfTrainer({
      projectPath: options.projectPath,
      useMemory: options.memory,
      memoryPath: options.memoryPath,
      projectName: path.basename(options.projectPath),
    });

    console.log("Starting PersLM self-improvement cycle...");

    try {
      const reportPath = await trainer.runFullCycle();
      console.log(`\n✅ Self-improvement cycle completed!`);
      console.log(`Report saved to: ${reportPath}`);
    } catch (error) {
      console.error("Self-improvement cycle failed:", error);
      process.exit(1);
    }
  });

program
  .command("self-train-multi")
  .description(
    "Run multiple self-improvement cycles until plateau or max cycles reached",
  )
  .option(
    "-p, --project-path <path>",
    "Path to project directory",
    process.cwd(),
  )
  .option("-m, --max-cycles <number>", "Maximum number of cycles to run", "5")
  .option("-v, --verbose", "Show detailed output", false)
  .option("--memory", "Use memory for adaptation strategies", false)
  .option("--memory-path <path>", "Path to memory storage file")
  .option("--reset-memory", "Reset memory before training", false)
  .option(
    "--generate-memory-report",
    "Generate memory visualization report",
    false,
  )
  .option("--project-name <name>", "Project name for memory context")
  .action(async (options: any) => {
    const maxCycles = parseInt(options.maxCycles, 10);

    if (isNaN(maxCycles) || maxCycles < 1) {
      console.error("Invalid value for max-cycles. Must be a positive number.");
      process.exit(1);
    }

    const trainer = new SelfTrainer({
      projectPath: options.projectPath,
      useMemory: options.memory,
      memoryPath: options.memoryPath,
      projectName: options.projectName || path.basename(options.projectPath),
    });

    // Reset memory if requested
    if (options.resetMemory && options.memory) {
      const memory = trainer.getMemory();
      if (memory) {
        await memory.resetMemory();
        console.log("Memory has been reset.");
      }
    }

    console.log(
      `Starting PersLM multi-cycle training (max ${maxCycles} cycles)...`,
    );

    try {
      const reportPath = await trainer.runMultiCycle(maxCycles);
      console.log(`\n✅ Multi-cycle training completed!`);
      console.log(`Report saved to: ${reportPath}`);

      // Generate memory report if requested
      if (options.generateMemoryReport && options.memory) {
        console.log("\nGenerating memory visualization report...");
        const memoryReportPath = await trainer.generateMemoryReport();
        console.log(`Memory report saved to: ${memoryReportPath}`);
      }
    } catch (error) {
      console.error("Multi-cycle training failed:", error);
      process.exit(1);
    }
  });

// Add new memory management commands
program
  .command("memory-status")
  .description("Display status and statistics about improvement memory")
  .option("--memory-path <path>", "Path to memory storage file")
  .action(async (options: any) => {
    const memory = new SelfImprovementMemory(options.memoryPath);
    await memory.initialize();

    console.log(`\n📊 PersLM Self-Improvement Memory Status`);
    console.log(`Memory Path: ${memory.getMemoryPath()}`);
    console.log(`Total Strategies Recorded: ${memory.getMemorySize()}`);

    // Display effectiveness data
    const effectiveness = await memory.getStrategyEffectiveness();
    if (effectiveness.length > 0) {
      console.log("\nStrategy Effectiveness:");
      effectiveness.forEach((item) => {
        console.log(
          `- ${item.strategyName}: ${item.successRate.toFixed(1)}% success rate (${item.successCount}/${item.totalCount})`,
        );
      });

      // Generate visualization
      console.log("\nEffectiveness Visualization:");
      const visualization = await memory.visualizeMemory();
      console.log(visualization);
    } else {
      console.log("\nNo strategy effectiveness data available yet.");
    }
  });

program
  .command("memory-visualize")
  .description("Generate a memory visualization report")
  .option("--memory-path <path>", "Path to memory storage file")
  .option("-o, --output <path>", "Output path for visualization report")
  .action(async (options: any) => {
    const memory = new SelfImprovementMemory(options.memoryPath);
    await memory.initialize();

    const outputPath =
      options.output || path.join(process.cwd(), "memory-visualization.md");

    console.log(`Generating memory visualization...`);
    const visualization = await memory.visualizeMemory();

    // Create report with visualization
    const formatDate = new Date().toISOString().split("T")[0];
    let report = `# PersLM Self-Improvement Memory Visualization\n\n`;
    report += `**Generated**: ${formatDate}\n\n`;
    report += `## Memory Overview\n\n`;
    report += `Memory File: \`${memory.getMemoryPath()}\`\n\n`;
    report += `Total Strategies Recorded: ${memory.getMemorySize()}\n\n`;
    report += `## Visualization\n\n`;
    report += `\`\`\`\n${visualization}\n\`\`\`\n\n`;

    // Add effectiveness data
    report += `## Strategy Effectiveness\n\n`;
    const effectiveness = await memory.getStrategyEffectiveness();
    if (effectiveness.length > 0) {
      report += `| Strategy | Success Rate | Uses | Avg Improvement |\n`;
      report += `|----------|--------------|------|----------------|\n`;

      effectiveness.forEach((item) => {
        report += `| ${item.strategyName} | ${item.successRate.toFixed(1)}% | ${item.totalCount} | ${item.avgImprovement.toFixed(2)}% |\n`;
      });
    } else {
      report += `No strategy effectiveness data available yet.`;
    }

    // Save the report
    fs.writeFileSync(outputPath, report);
    console.log(`Memory visualization report saved to: ${outputPath}`);
  });

program
  .command("memory-reset")
  .description("Reset the improvement memory")
  .option("--memory-path <path>", "Path to memory storage file")
  .option("-f, --force", "Force reset without confirmation", false)
  .action(async (options: any) => {
    if (!options.force) {
      console.log(
        "WARNING: This will delete all stored adaptation strategies and outcomes.",
      );
      console.log("Use --force to reset without this warning.");
      console.log("Aborted. No changes made.");
      return;
    }

    const memory = new SelfImprovementMemory(options.memoryPath);
    await memory.resetMemory();
    console.log(`Memory has been reset.`);
  });

program
  .command("discover-strategies")
  .description(
    "Autonomously discover new strategies when existing ones have plateaued",
  )
  .option("-p, --project <path>", "Path to the project", ".")
  .option(
    "-o, --output <path>",
    "Path to output directory",
    "./generation-benchmark/outputs/discovery",
  )
  .option(
    "-f, --framework <framework>",
    "Framework (react, vue, svelte)",
    "react",
  )
  .option(
    "-s, --styling <style>",
    "Styling method (css, scss, tailwind, styled-components)",
    "tailwind",
  )
  .option("-v, --verbose", "Show verbose output", false)
  .option("--memory-path <path>", "Path to memory storage file")
  .option(
    "--discovery-threshold <n>",
    "Number of plateaus before attempting strategy discovery",
    "3",
  )
  .option(
    "--min-data-points <n>",
    "Minimum data points required for discovery",
    "5",
  )
  .option("--component-type <type>", "Type of component to focus on")
  .option(
    "--requirements <list>",
    "Comma-separated list of requirements to focus on",
  )
  .action(async (options) => {
    console.log("Starting strategy discovery process...");

    try {
      const config: PersRMConfig = {
        mode: AgentMode.GENERATION,
        projectPath: path.resolve(options.project),
        outputDir: path.resolve(options.output),
        options: {
          verbose: options.verbose ?? false,
          enableDiscovery: true,
          discoveryThreshold: parseInt(options.discoveryThreshold, 10),
        },
      };

      // Create PersRMAgent
      const agent = new PersRMAgent(config);

      // Create memory system
      const memory = new SelfImprovementMemory(options.memoryPath);

      // Create strategy discovery engine
      const discoveryEngine = new StrategyDiscoveryEngine(agent, memory, {
        minDataPoints: parseInt(options.minDataPoints, 10),
        patternThreshold: 70,
      });

      // Parse requirements if provided
      const requirementTypes = options.requirements
        ? options.requirements.split(",").map((r) => r.trim())
        : undefined;

      console.log("Analyzing existing strategies and outcomes...");

      // Discover new strategies
      const context = {
        componentType: options.componentType,
        requirementTypes,
      };

      // Get plateaued strategies from memory
      const memoryData = memory.getMemoryData();
      const strategyPerformance = new Map<string, number[]>();

      // Analyze strategy performance to identify plateaued strategies
      for (const outcome of memoryData) {
        const strategyName = outcome.strategy.name;

        if (!strategyPerformance.has(strategyName)) {
          strategyPerformance.set(strategyName, []);
        }

        strategyPerformance.get(strategyName)!.push(outcome.improvementPercent);
      }

      // Identify plateaued strategies
      const plateauedStrategies: string[] = [];
      for (const [
        strategyName,
        improvements,
      ] of strategyPerformance.entries()) {
        if (improvements.length < 3) continue;

        // Get the last 3 improvements
        const recentImprovements = improvements.slice(-3);
        const avgImprovement =
          recentImprovements.reduce((a, b) => a + b, 0) /
          recentImprovements.length;

        if (avgImprovement < 2) {
          plateauedStrategies.push(strategyName);
          console.log(
            `Strategy '${strategyName}' has plateaued (avg improvement: ${avgImprovement.toFixed(2)}%)`,
          );
        }
      }

      if (plateauedStrategies.length === 0) {
        console.log(
          "No plateaued strategies found. Need more data for discovery.",
        );
        process.exit(0);
      }

      console.log(
        `Found ${plateauedStrategies.length} plateaued strategies. Generating new strategies...`,
      );

      // Generate a new strategy
      const currentScore = 7.5; // Default midpoint score
      const generatedStrategy = await discoveryEngine.discoverStrategy(
        context,
        plateauedStrategies,
        currentScore,
      );

      if (!generatedStrategy) {
        console.log(
          "Could not generate a new strategy. Try again with more data.",
        );
        process.exit(0);
      }

      console.log("\n===== New Strategy Discovered =====");
      console.log(`Name: ${generatedStrategy.strategy.name}`);
      console.log(`Description: ${generatedStrategy.strategy.description}`);
      console.log(`Type: ${generatedStrategy.strategy.type}`);
      console.log(`Confidence: ${generatedStrategy.confidence}%`);
      console.log(`Reasoning: ${generatedStrategy.reasoning}`);
      console.log(
        `Inspiration sources: ${generatedStrategy.inspirationSources.join(", ")}`,
      );

      // Generate an example of applying the strategy
      if (options.componentType) {
        console.log("\nGenerating example application of strategy...");

        const examplePrompt = `
          # ${options.componentType} Component
          
          Create a reusable ${options.componentType} component with the following features:
          - Responsive design
          - Accessible to all users
          - Well-documented code
          - TypeScript support
          
          The component should be fully typed and follow best practices.
        `;

        const enhancedPrompt =
          await generatedStrategy.strategy.apply(examplePrompt);

        console.log("\nOriginal prompt:");
        console.log("------------------");
        console.log(examplePrompt.trim());

        console.log("\nEnhanced prompt:");
        console.log("------------------");
        console.log(enhancedPrompt);
      }

      // Generate discovery report
      console.log("\nGenerating discovery report...");
      const reportPath = await discoveryEngine.generateDiscoveryReport();
      console.log(`Report saved to: ${reportPath}`);
    } catch (error) {
      console.error("Strategy discovery failed:", error);
      process.exit(1);
    }
  });

program
  .command("view-discovered-strategies")
  .description("View and analyze discovered strategies")
  .option("--memory-path <path>", "Path to memory storage file")
  .option(
    "-o, --output <path>",
    "Path to output report",
    "./strategy-discovery-report.md",
  )
  .option("-v, --verbose", "Show verbose output", false)
  .action(async (options) => {
    console.log("Analyzing discovered strategies...");

    try {
      // Create memory system
      const memory = new SelfImprovementMemory(options.memoryPath);

      // Create a mock agent for the discovery engine
      const mockAgent = {
        generateText: async (prompt: string): Promise<string> => "",
      } as unknown as PersRMAgent;

      // Create strategy discovery engine
      const discoveryEngine = new StrategyDiscoveryEngine(mockAgent, memory);

      // Generate discovery report
      const reportPath = await discoveryEngine.generateDiscoveryReport();

      console.log(`Discovered strategies report saved to: ${reportPath}`);

      // Display summary in console
      if (options.verbose) {
        const discoveredStrategies = discoveryEngine.getDiscoveredStrategies();
        console.log(
          `\nFound ${discoveredStrategies.length} discovered strategies:`,
        );

        for (const strategy of discoveredStrategies) {
          console.log(`- ${strategy.name}: ${strategy.description}`);
        }
      }
    } catch (error) {
      console.error("Failed to analyze discovered strategies:", error);
      process.exit(1);
    }
  });

program.parse();

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
