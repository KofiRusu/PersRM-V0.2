#!/usr/bin/env node

/**
 * Test Database Connection
 * 
 * This script tests the database connection with the current Prisma configuration.
 */

const { PrismaClient } = require('@prisma/client');

// Use console colors instead of chalk for simplicity
const colors = {
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

// Create Prisma client
const prisma = new PrismaClient();

/**
 * Test database connection and run basic operations
 */
async function testConnection() {
  console.log(colors.blue('Testing database connection...'));
  
  try {
    // Get database info
    const databaseUrl = process.env.DATABASE_URL || 'unknown';
    console.log(colors.blue(`Database URL: ${databaseUrl}`));
    
    // Try a simple query to see if the connection works
    await prisma.$connect();
    console.log(colors.green('✓ Successfully connected to the database'));
    
    // Test a simple query - counting the components
    const componentCount = await prisma.component.count();
    console.log(colors.green(`✓ Query successful: ${componentCount} components in database`));
    
    // Test metadata Json/String handling - first create a test event
    console.log(colors.blue('Testing metadata handling...'));
    
    const testMetadata = {
      test: true,
      timestamp: new Date().toISOString(),
      values: [1, 2, 3],
      nested: {
        key: 'value'
      }
    };
    
    // Convert to string for SQLite
    const metadataStr = typeof testMetadata === 'object' ? JSON.stringify(testMetadata) : testMetadata;
    
    // Create test event
    const testEvent = await prisma.event.create({
      data: {
        eventType: 'db-connection-test',
        timestamp: new Date(),
        sessionId: 'test-session',
        metadata: metadataStr  // This works for both SQLite (string) and PostgreSQL (json)
      }
    });
    
    console.log(colors.green(`✓ Created test event with ID: ${testEvent.id}`));
    
    // Read it back
    const readEvent = await prisma.event.findUnique({
      where: {
        id: testEvent.id
      }
    });
    
    // Parse metadata if it's a string (SQLite)
    const metadata = readEvent.metadata ? 
      (typeof readEvent.metadata === 'string' ? JSON.parse(readEvent.metadata) : readEvent.metadata) : 
      null;
    
    if (metadata && metadata.test === true) {
      console.log(colors.green('✓ Successfully stored and retrieved JSON metadata'));
    } else {
      console.log(colors.red('✗ Failed to correctly store/retrieve JSON metadata'));
    }
    
    // Clean up - delete the test event
    await prisma.event.delete({
      where: {
        id: testEvent.id
      }
    });
    
    console.log(colors.green('✓ Database operations completed successfully'));
    
  } catch (error) {
    console.error(colors.red('Error testing database connection:'));
    console.error(error);
  } finally {
    // Disconnect from the database
    await prisma.$disconnect();
  }
}

// Run the test
testConnection()
  .then(() => {
    console.log(colors.blue('\nDatabase connection test completed'));
  })
  .catch((error) => {
    console.error(colors.red('\nDatabase connection test failed:'), error);
    process.exit(1);
  }); 