#!/usr/bin/env node

const axios = require('axios');
const chalk = require('chalk');

// Get webhook URL from environment variables
const webhookUrl = process.env.BENCHMARK_ALERT_WEBHOOK_URL;

if (!webhookUrl) {
  console.error(chalk.red('Error: BENCHMARK_ALERT_WEBHOOK_URL environment variable is not set'));
  console.log(chalk.yellow('Set it in your .env file or use:'));
  console.log(chalk.yellow('BENCHMARK_ALERT_WEBHOOK_URL=your_webhook_url node scripts/test-webhook.js'));
  process.exit(1);
}

// Create test message
const testMessage = {
  content: `
📊 **Benchmark Alert Test**

This is a test message from the PersLM benchmark system. If you can see this, your webhook integration is working correctly!

Current time: ${new Date().toLocaleString()}
  `
};

console.log(chalk.blue('Sending test message to webhook...'));

// Send the test message
axios.post(webhookUrl, testMessage)
  .then(() => {
    console.log(chalk.green('✅ Test message sent successfully!'));
    console.log(chalk.blue('Check your Slack/Discord channel for the message.'));
  })
  .catch(error => {
    console.error(chalk.red(`❌ Failed to send test message: ${error.message}`));
    if (error.response) {
      console.error(chalk.red(`Status: ${error.response.status}`));
      console.error(chalk.red(`Data: ${JSON.stringify(error.response.data)}`));
    }
  }); 