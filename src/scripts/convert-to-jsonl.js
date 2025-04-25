const fs = require('fs');
const path = require('path');

// Read the JSON examples
const examples = require('../data/reasoning-examples.json');

// Convert to JSONL format
const jsonlContent = examples.map(example => JSON.stringify(example)).join('\n');

// Write to output file
const outputPath = path.join(__dirname, '../data/reasoning-examples.jsonl');
fs.writeFileSync(outputPath, jsonlContent);

console.log(`Converted ${examples.length} examples to JSONL format at ${outputPath}`); 