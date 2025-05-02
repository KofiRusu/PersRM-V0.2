#!/bin/bash

# This script applies Prisma schema changes without requiring shadow database permissions
# It completely bypasses prisma migrate and uses db push directly

# Set to exit on error
set -e

echo "=== PersRM Database Migration (No Shadow DB Required) ==="
echo ""

# Check for Node.js and npx
if ! command -v npx &> /dev/null; then
    echo "Error: npx is required but not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Step 1: Push schema changes directly to the database
echo "Step 1: Applying schema changes directly to database..."
echo "This will bypass migration history but apply the current schema."
npx prisma db push --accept-data-loss

# Step 2: Apply custom migration script
echo ""
echo "Step 2: Running comment permissions migration script..."
node prisma/migrations/migrate-comment-permissions.js

echo ""
echo "=== Migration completed successfully! ==="
echo "Your database schema has been updated with the comment permissions system."
echo ""
echo "Warning: This method bypassed the migration history. Your database schema"
echo "is now updated, but Prisma's migration history will not reflect these changes."
echo ""
echo "Next steps:"
echo "1. Restart your development server"
echo "2. Test the comment moderation system in the browser"
echo "" 