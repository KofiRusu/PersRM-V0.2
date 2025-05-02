#!/bin/bash

# Script to run tests using available package manager
echo "Testing PersRM comment moderation system..."

# Try using npm (most common)
if command -v npm &> /dev/null; then
    echo "Running tests with npm..."
    npm test
# Try using yarn
elif command -v yarn &> /dev/null; then
    echo "Running tests with yarn..."
    yarn test
# Try using pnpm
elif command -v pnpm &> /dev/null; then
    echo "Running tests with pnpm..."
    pnpm test
else
    echo "No package manager found. Please run one of the following commands manually:"
    echo "npm test"
    echo "yarn test"
    echo "pnpm test"
    
    echo ""
    echo "If you need to install a package manager:"
    echo "npm: comes with Node.js installation"
    echo "yarn: npm install -g yarn"
    echo "pnpm: npm install -g pnpm"
    exit 1
fi

# Run Vitest specifically if needed
if command -v npx &> /dev/null; then
    echo "Running Vitest directly..."
    npx vitest
fi 