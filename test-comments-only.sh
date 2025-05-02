#!/bin/bash

# Script to run only the comment-related tests in isolation
echo "Testing PersRM comment moderation system (isolated)..."

# Check for npx
if ! command -v npx &> /dev/null; then
    echo "Error: npx is required but not installed."
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Run only the comments test file
echo "Running comment-specific tests..."
npx vitest __tests__/comments.test.ts

# If the test file doesn't exist, provide instructions
if [ $? -ne 0 ]; then
    echo ""
    echo "Note: If the test file doesn't exist, you may need to create it first."
    echo "See the 'docs/comment-permissions.md' for test examples."
    echo ""
    echo "Alternative: Test the comment system manually in the browser:"
    echo "1. Run your development server"
    echo "2. Execute: python open_persrm_window.py"
fi

echo ""
echo "To manually test the comment moderation system in the browser:"
echo "1. Ensure your dev server is running"
echo "2. Run: python open_persrm_window.py"
echo "3. Try creating, editing, and moderating comments"
echo "" 