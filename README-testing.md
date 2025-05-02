# Testing the Comment Permissions & Moderation System

This document provides detailed instructions for testing the comment permissions and moderation system in PersRM.

## Prerequisites

- Node.js (v14 or newer)
- A package manager (npm, yarn, or pnpm)
- Python 3.x (for the browser opener script)
- PostgreSQL database with proper permissions

## Automated Setup & Testing

We've provided an all-in-one setup script that handles migrations, testing, and opening a test page:

```bash
# Make the script executable if needed
chmod +x setup_and_test.sh

# Run the setup and test script
./setup_and_test.sh
```

This script will:
1. Run Prisma migrations
2. Execute the comment permissions migration script
3. Run tests using your available package manager
4. Provide instructions for restarting the dev server
5. Optionally open a test task in the browser

## Manual Testing

If you prefer to run steps individually:

### 1. Run Migrations

```bash
# Run Prisma migrations
npx prisma migrate dev

# If you encounter permission errors, try this alternative:
npx prisma migrate dev --create-only
npx prisma db push

# Run the comment permissions migration script
node prisma/migrations/migrate-comment-permissions.js
```

### 2. Run Tests

Depending on your package manager:

```bash
# Using npm
npm test
# OR
npx vitest

# Using yarn
yarn test

# Using pnpm
pnpm test
```

You can also use our test runner script:

```bash
# Make executable if needed
chmod +x run_tests.sh

# Run the tests
./run_tests.sh
```

### 3. Restart Development Server

```bash
# Using npm
npm run dev

# Using yarn
yarn dev

# Using pnpm
pnpm dev
```

### 4. Open Test Page in Browser

```bash
# Run the Python script to open a test task comments page
python open_persrm_window.py
```

## Manual UI Testing

For manual UI testing, verify the following:

1. **User Roles**:
   - Regular users can only see PUBLIC comments and their own PRIVATE comments
   - Moderators/admins can see all comments and have moderation controls

2. **Creating Comments**:
   - Create a PUBLIC comment
   - Create a PRIVATE comment (verify visibility)

3. **Moderating Comments**:
   - As a moderator/admin, hide a comment (add a reason)
   - Verify the comment is hidden for regular users
   - Verify the comment is visible for moderators/admins with the "Show hidden comments" toggle

4. **Deleting Comments**:
   - Regular users can only delete their own comments (soft delete)
   - Moderators can delete any comment (soft delete)
   - Admins can permanently delete comments

5. **Real-time Updates**:
   - Open two browser windows with different users (regular user and moderator)
   - Verify that moderation actions in one window are reflected in the other

## Troubleshooting

### Database Errors

#### Permission Denied to Create Database

If you see this error during Prisma migrations:
```
Error: P3014
Prisma Migrate could not create the shadow database. Please make sure the database user has permission to create databases.
ERROR: permission denied to create database
```

This occurs because your database user doesn't have permission to create a shadow database. You have several options:

1. **Use the `--create-only` flag with `db push` (recommended):**
   ```bash
   npx prisma migrate dev --create-only
   npx prisma db push
   ```
   This creates the migration files without trying to use a shadow database, then directly pushes the schema changes.

2. **Provide a `shadowDatabaseUrl` in schema.prisma:**
   Create a shadow database manually and add this to your schema:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
     shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
   }
   ```
   Then add `SHADOW_DATABASE_URL` to your `.env` file.

3. **Use admin database credentials temporarily:**
   Modify your `.env` file to use a database user with CREATE DATABASE permissions.

#### Other Database Issues

- Ensure your database is running
- Verify connection string in `.env` is correct
- Try resetting the database: `npx prisma migrate reset` (will erase all data)
- Check database logs for specific errors

### Test Failures

- Check the error messages for specific failed tests
- Ensure test environment variables are set correctly (if different from dev)
- Verify database schema is up to date: `npx prisma db pull`
- Run individual test files if needed: `npx vitest __tests__/comments.test.ts`

### Python Script Issues

- Ensure Python 3.x is installed
- Try running with a specific task ID: `python open_persrm_window.py`
  - You'll be prompted to enter a task ID
- If browser doesn't open, manually navigate to: `http://localhost:3000/tasks/{TASK_ID}#comments`

### Package Manager Not Found

- Install the required package manager:
  - npm: comes with Node.js
  - yarn: `npm install -g yarn`
  - pnpm: `npm install -g pnpm`

## Additional Resources

For more details on the comment moderation system, see:
- `docs/comment-permissions.md` - System documentation
- `__tests__/comments.test.ts` - Test cases and expected behaviors 