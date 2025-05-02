#!/bin/bash

# Complete setup script for PersRM comment moderation system
# This script:
# 1. Runs Prisma migrations
# 2. Executes the comment permission migration script
# 3. Runs tests with the available package manager
# 4. Opens a test task in the browser (optional)

# Set to exit on error, but handle specific errors gracefully
set -e

echo "=== PersRM Comment Moderation System Setup ==="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is required but not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Determine package manager
if command -v npm &> /dev/null; then
    PKG_MGR="npm"
elif command -v yarn &> /dev/null; then
    PKG_MGR="yarn"
elif command -v pnpm &> /dev/null; then
    PKG_MGR="pnpm"
else
    echo "Error: No package manager (npm, yarn, or pnpm) found."
    echo "Please install npm, yarn, or pnpm to continue."
    exit 1
fi

echo "Using package manager: $PKG_MGR"
echo ""

# Step 1: Run Prisma migrations
echo "Step 1: Running Prisma migrations..."
if command -v npx &> /dev/null; then
    # Use a temporary file to capture output
    TEMP_OUTPUT=$(mktemp)
    
    # Try running the migration
    if ! npx prisma migrate dev --preview-feature 2>&1 | tee "$TEMP_OUTPUT"; then
        # Check if the error is about shadow database permissions
        if grep -q "permission denied to create database" "$TEMP_OUTPUT"; then
            echo ""
            echo "Database permission error detected."
            echo "Your database user doesn't have permission to create a shadow database."
            echo ""
            echo "Option 1: Use the Prisma '--create-only' flag (recommended)"
            echo "This will create the migration without applying it:"
            echo "  npx prisma migrate dev --create-only"
            echo "Then apply manually:"
            echo "  npx prisma db push"
            echo ""
            echo "Option 2: Add 'shadowDatabaseUrl' to prisma/schema.prisma"
            echo "This requires a pre-created shadow database with proper permissions."
            echo ""
            echo "Option 3: Run with database admin credentials"
            echo "Temporarily modify your DATABASE_URL in .env with admin credentials."
            echo ""
            
            # Ask if user wants to try the --create-only approach
            echo -n "Would you like to try the '--create-only' approach now? (y/n): "
            read -r TRY_CREATE_ONLY
            
            if [ "$TRY_CREATE_ONLY" = "y" ] || [ "$TRY_CREATE_ONLY" = "Y" ]; then
                echo "Running migration with --create-only..."
                npx prisma migrate dev --create-only
                
                echo "Pushing schema changes to database..."
                npx prisma db push
            else
                echo "Migration skipped. Please fix database permissions before continuing."
                echo "See troubleshooting section in README-testing.md for more details."
                exit 1
            fi
        else
            # Some other error occurred
            echo "Prisma migration failed."
            echo "Please review the error message above and fix the issue."
            rm "$TEMP_OUTPUT"
            exit 1
        fi
    fi
    
    # Clean up temp file
    rm "$TEMP_OUTPUT"
else
    echo "Error: npx not found. Cannot run Prisma migrations."
    echo "Try running 'npm install -g npx' and try again."
    exit 1
fi

# Step 2: Run comment permissions migration script
echo ""
echo "Step 2: Running comment permissions migration script..."
if ! node prisma/migrations/migrate-comment-permissions.js; then
    echo "Error: Comment permissions migration script failed."
    echo "This could be due to database connection issues or missing tables."
    echo "Make sure your database is running and schema is up to date."
    exit 1
fi

# Step 3: Run tests
echo ""
echo "Step 3: Running tests..."

TEST_FAILED=false
if [ "$PKG_MGR" = "npm" ]; then
    npm test || npx vitest || TEST_FAILED=true
elif [ "$PKG_MGR" = "yarn" ]; then
    yarn test || npx vitest || TEST_FAILED=true
elif [ "$PKG_MGR" = "pnpm" ]; then
    pnpm test || npx vitest || TEST_FAILED=true
fi

if [ "$TEST_FAILED" = true ]; then
    echo ""
    echo "⚠️ Some tests may have failed. Review the output above for details."
    echo "You can still proceed with the setup, but some features might not work as expected."
    echo ""
    echo "Common test failure reasons:"
    echo "- Database connection issues"
    echo "- Incorrect environment variables"
    echo "- Missing database tables or migrations"
    echo ""
    
    echo -n "Would you like to continue anyway? (y/n): "
    read -r CONTINUE_AFTER_TEST_FAILURE
    if [ "$CONTINUE_AFTER_TEST_FAILURE" != "y" ] && [ "$CONTINUE_AFTER_TEST_FAILURE" != "Y" ]; then
        echo "Setup stopped. Please fix test failures before continuing."
        exit 1
    fi
fi

# Step 4: Restart dev server
echo ""
echo "Step 4: Restarting development server..."
echo "Please manually restart your development server with:"
echo "  $PKG_MGR run dev"

# Step 5: Open browser (optional)
echo ""
echo "Step 5: Would you like to open a test task in the browser? (y/n)"
read -r OPEN_BROWSER

if [ "$OPEN_BROWSER" = "y" ] || [ "$OPEN_BROWSER" = "Y" ]; then
    echo "Running Python script to open browser..."
    python open_persrm_window.py
fi

echo ""
echo "=== Setup and testing completed ==="
echo "If you need to manually restart the development server, run:"
echo "  $PKG_MGR run dev" 