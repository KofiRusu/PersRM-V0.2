#!/usr/bin/env node

/**
 * Database Setup Utility
 * 
 * This script helps set up and validate the database configuration.
 * It can be used to switch between SQLite and PostgreSQL modes.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// Basic console colors
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Define paths
const ENV_PATH = path.join(process.cwd(), '.env');
const SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');

/**
 * Read the current database configuration
 */
function readCurrentConfig() {
  console.log('Reading current configuration...');
  
  let dbProvider = 'sqlite';
  let dbUrl = 'file:./dev.db';
  
  // Read schema.prisma to get provider
  if (fs.existsSync(SCHEMA_PATH)) {
    const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const providerMatch = schemaContent.match(/provider\s*=\s*"([^"]+)"/);
    if (providerMatch && providerMatch[1]) {
      dbProvider = providerMatch[1];
    }
  }
  
  // Read .env to get database URL
  if (fs.existsSync(ENV_PATH)) {
    const envContent = fs.readFileSync(ENV_PATH, 'utf8');
    const dbUrlMatch = envContent.match(/DATABASE_URL="([^"]+)"/);
    if (dbUrlMatch && dbUrlMatch[1]) {
      dbUrl = dbUrlMatch[1];
    }
  }
  
  console.log(`Current database provider: ${colors.blue(dbProvider)}`);
  console.log(`Current database URL: ${colors.blue(dbUrl)}`);
  
  return { dbProvider, dbUrl };
}

/**
 * Switch to SQLite configuration
 */
function switchToSqlite() {
  console.log('\nSwitching to SQLite...');
  
  // Update schema.prisma
  let schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
  schemaContent = schemaContent.replace(/provider\s*=\s*"[^"]+"/g, 'provider = "sqlite"');
  fs.writeFileSync(SCHEMA_PATH, schemaContent);
  
  // Update .env
  let envContent = fs.readFileSync(ENV_PATH, 'utf8');
  envContent = envContent.replace(/DATABASE_URL="[^"]+"/g, 'DATABASE_URL="file:./dev.db"');
  fs.writeFileSync(ENV_PATH, envContent);
  
  console.log(colors.green('Updated configuration to use SQLite.'));
  
  // Generate Prisma client
  console.log('\nUpdating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log(`\n${colors.green('SQLite configuration complete!')} You may need to run this command to update your database:`);
  console.log('  npx prisma db push');
}

/**
 * Switch to PostgreSQL configuration
 */
function switchToPostgres() {
  rl.question('\nEnter PostgreSQL connection URL (postgresql://USER:PASSWORD@HOST:PORT/DATABASE): ', (dbUrl) => {
    console.log('\nSwitching to PostgreSQL...');
    
    // Update schema.prisma
    let schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf8');
    schemaContent = schemaContent.replace(/provider\s*=\s*"[^"]+"/g, 'provider = "postgresql"');
    fs.writeFileSync(SCHEMA_PATH, schemaContent);
    
    // Update .env
    let envContent = fs.readFileSync(ENV_PATH, 'utf8');
    envContent = envContent.replace(/DATABASE_URL="[^"]+"/g, `DATABASE_URL="${dbUrl}"`);
    fs.writeFileSync(ENV_PATH, envContent);
    
    console.log(colors.green('Updated configuration to use PostgreSQL.'));
    
    // Generate Prisma client
    console.log('\nUpdating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    console.log(`\n${colors.green('PostgreSQL configuration complete!')} You may need to run this command to set up your database:`);
    console.log('  npx prisma migrate dev --name init-postgres');
    
    rl.close();
  });
}

/**
 * Main function
 */
function main() {
  console.log(colors.blue('=== PersLM Database Setup Utility ===\n'));
  
  // Read current config
  const { dbProvider } = readCurrentConfig();
  
  console.log('\nSelect an option:');
  console.log(`1. Switch to ${colors.blue('SQLite')} (for development)`);
  console.log(`2. Switch to ${colors.blue('PostgreSQL')} (for production)`);
  console.log('3. Exit');
  
  rl.question('\nEnter your choice (1-3): ', (answer) => {
    switch (answer) {
      case '1':
        switchToSqlite();
        rl.close();
        break;
      case '2':
        switchToPostgres();
        break;
      case '3':
        console.log('Exiting...');
        rl.close();
        break;
      default:
        console.log(colors.red('Invalid option. Exiting...'));
        rl.close();
    }
  });
}

// Run the script
main(); 