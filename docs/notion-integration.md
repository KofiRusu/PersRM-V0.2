# Notion Integration Guide

This guide explains how to set up the Notion integration for archiving benchmark results.

## Prerequisites

1. A Notion account
2. Admin access to create integrations
3. Ability to create and modify databases in Notion

## Step 1: Create a Notion Integration

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click on "New integration"
3. Name it something like "PersLM Benchmark Archive"
4. Select the workspace where you want to store benchmark results
5. Set capabilities to "Read & Write content"
6. Submit to create the integration
7. Copy the "Internal Integration Token" - this will be your `NOTION_TOKEN`

## Step 2: Create the Database

1. In Notion, create a new page
2. Create a new database (full page or inline)
3. Add the following properties to the database:
   - Prompt (Title) - default
   - Model (Text)
   - ResponseTime (Number)
   - CodeLength (Number)
   - Success (Checkbox)
   - BestModel (Checkbox)
   - Date (Date)
   - Error (Text)
   - File (Text)
   - Notes (Text)

## Step 3: Share Database with Integration

1. Click the "Share" button in the top right of your database page
2. Click the "Invite" button
3. Under "Invite", search for your integration name
4. Select the integration to add it to the database

## Step 4: Get the Database ID

1. Open your database in a browser
2. Look at the URL, which should look like:
   ```
   https://www.notion.so/workspace/1234567890abcdef1234567890abcdef?v=...
   ```
3. Copy the ID portion (`1234567890abcdef1234567890abcdef`) - this will be your `NOTION_DATABASE_ID`

## Step 5: Configure Environment Variables

Add the following to your `.env` file:

```
NOTION_TOKEN=your_integration_token
NOTION_DATABASE_ID=your_database_id
```

## Step 6: Archive Benchmark Results

Run the archival script to send benchmark results to Notion:

```bash
npm run benchmark:archive
```

## Viewing and Analyzing Results

In Notion, you can now:

1. Sort by any property (e.g., ResponseTime, Success rate)
2. Filter to see only specific models or prompts
3. Create views for different analysis needs:
   - Best performing models per prompt
   - Prompts with most failures
   - Historical performance trends

## Troubleshooting

If archival fails, check:

1. Your `NOTION_TOKEN` and `NOTION_DATABASE_ID` are correctly set
2. The integration has access to the database
3. Your database has all the required properties with correct types
4. You have benchmark results files in the `benchmark-results` directory 