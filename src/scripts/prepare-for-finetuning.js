const fs = require('fs');
const path = require('path');

// Read the JSON examples
const examples = require('../data/reasoning-examples.json');

// Template for formatting examples
const formatForFineTuning = (example) => {
  return {
    messages: [
      {
        role: "system",
        content: "You are an expert UI/UX developer and API designer. Provide detailed reasoning for design decisions."
      },
      {
        role: "user",
        content: example.input + (example.context ? `\n\nContext: ${example.context}` : "")
      },
      {
        role: "assistant",
        content: example.expected_reasoning
      }
    ]
  };
};

// Convert all examples to fine-tuning format
const formattedExamples = examples.map(formatForFineTuning);

// Convert to JSONL format
const jsonlContent = formattedExamples.map(example => JSON.stringify(example)).join('\n');

// Write to output file
const outputPath = path.join(__dirname, '../data/finetuning-examples.jsonl');
fs.writeFileSync(outputPath, jsonlContent);

console.log(`Prepared ${examples.length} examples for fine-tuning at ${outputPath}`); 