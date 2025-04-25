const fs = require('fs');
const path = require('path');

// Path to the input and output files
const inputFilePath = path.join(__dirname, '../data/reasoning-examples.json');
const outputFilePath = path.join(__dirname, '../data/finetuning-examples.jsonl');

// Read the input file
const examples = JSON.parse(fs.readFileSync(inputFilePath, 'utf8'));

// Format each example for fine-tuning
function formatForFineTuning(example) {
  // Create the fine-tuning format with system, user, and assistant messages
  return {
    messages: [
      {
        role: "system",
        content: "You are an AI assistant that provides detailed reasoning about UI/UX and application design decisions."
      },
      {
        role: "user",
        content: `${example.input.prompt}\n\nContext: ${example.input.context}`
      },
      {
        role: "assistant",
        content: example.expected_reasoning
      }
    ]
  };
}

// Convert examples to the fine-tuning format
const formattedExamples = examples.map(formatForFineTuning);

// Convert to JSONL (each JSON object on a separate line)
const jsonlContent = formattedExamples.map(ex => JSON.stringify(ex)).join('\n');

// Write to the output file
fs.writeFileSync(outputFilePath, jsonlContent, 'utf8');

console.log(`Successfully formatted ${examples.length} examples for fine-tuning and saved to ${outputFilePath}`); 