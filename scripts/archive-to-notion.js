const { Client } = require("@notionhq/client");
const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

// Find the latest benchmark results file
const benchmarkDir = path.join(__dirname, "../benchmark-results");
const files = fs.readdirSync(benchmarkDir)
  .filter(f => f.startsWith("model-comparison-results") && f.endsWith(".json"))
  .sort((a, b) => 
    fs.statSync(path.join(benchmarkDir, b)).mtime.getTime() - 
    fs.statSync(path.join(benchmarkDir, a)).mtime.getTime()
  );

if (files.length === 0) {
  console.error(chalk.red("No benchmark result files found"));
  process.exit(1);
}

const latestFile = files[0];
console.log(chalk.blue(`Found latest benchmark file: ${latestFile}`));

// Load benchmark data
const data = JSON.parse(fs.readFileSync(path.join(benchmarkDir, latestFile), "utf8"));
const timestamp = new Date().toISOString();
const fileDate = latestFile.match(/\d{4}-\d{2}-\d{2}T/)?.[0]?.slice(0, -1) || 
                 new Date().toISOString().split("T")[0];

/**
 * Archive benchmark results to Notion
 */
async function archive() {
  if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
    console.error(chalk.red("Error: NOTION_TOKEN and NOTION_DATABASE_ID environment variables must be set"));
    console.log(chalk.yellow("Add them to your .env file or set them before running this script"));
    process.exit(1);
  }

  let archivedCount = 0;
  const results = [];

  // Process each prompt+model combination
  for (const [promptId, promptData] of Object.entries(data.prompts || {})) {
    for (const [modelName, modelData] of Object.entries(promptData.results || {})) {
      results.push({
        promptId,
        model: modelName,
        responseTime: modelData.responseTime,
        codeLength: modelData.codeLength,
        success: modelData.success,
        error: modelData.error,
        bestModel: promptData.bestModel === modelName,
      });
    }
  }

  // Archive each result to Notion
  console.log(chalk.blue(`Archiving ${results.length} benchmark results to Notion...`));
  
  for (const item of results) {
    try {
      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: {
          Prompt: { title: [{ text: { content: item.promptId } }] },
          Model: { rich_text: [{ text: { content: item.model } }] },
          ResponseTime: { number: item.responseTime },
          CodeLength: { number: item.codeLength },
          Success: { checkbox: item.success },
          BestModel: { checkbox: item.bestModel },
          Date: { date: { start: fileDate } },
          Error: item.error ? { rich_text: [{ text: { content: item.error } }] } : undefined,
          File: { rich_text: [{ text: { content: latestFile } }] },
        }
      });
      archivedCount++;
      process.stdout.write(chalk.green("."));
    } catch (error) {
      console.error(chalk.red(`\nError archiving ${item.promptId} + ${item.model}: ${error.message}`));
    }
  }

  // Archive summary data as well
  try {
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Prompt: { title: [{ text: { content: "SUMMARY" } }] },
        Model: { rich_text: [{ text: { content: "All Models" } }] },
        Date: { date: { start: fileDate } },
        File: { rich_text: [{ text: { content: latestFile } }] },
        Notes: { 
          rich_text: [{ 
            text: { 
              content: `Total Models: ${Object.keys(data.models || {}).length}\nTotal Prompts: ${Object.keys(data.prompts || {}).length}` 
            } 
          }] 
        },
      }
    });
    archivedCount++;
  } catch (error) {
    console.error(chalk.red(`\nError archiving summary: ${error.message}`));
  }

  console.log(chalk.green(`\n\n✅ Archived ${archivedCount} benchmark entries to Notion`));
}

archive().catch(error => {
  console.error(chalk.red(`\nError: ${error.message}`));
  process.exit(1);
}); 