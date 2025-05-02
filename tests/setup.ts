// Import any necessary setup functions or libraries
// This file runs before each test file

// Optional: Mock environment variables
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/perslm_data?schema=public';

// Optional: Configure global test timeout
// vitest.setTimeout(10000); 