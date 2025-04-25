#!/usr/bin/env node

/**
 * PersLM Plugin Enhancement Tool
 * CLI entry point for the plugin enhancement and diagnostic system
 */

const path = require('path');
const { spawnSync } = require('child_process');

// Force TypeScript to be compiled on the fly
try {
  // Use ts-node to run the TypeScript file directly
  const result = spawnSync('npx', [
    'ts-node',
    path.resolve(__dirname, '../plugins/ui/plugin_enhancer.ts'),
    ...process.argv.slice(2)
  ], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  process.exit(result.status);
} catch (error) {
  console.error('Failed to run the plugin enhancer:', error.message);
  console.error('Make sure ts-node is installed: npm install -g ts-node typescript');
  process.exit(1);
} 