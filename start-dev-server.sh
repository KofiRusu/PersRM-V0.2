#!/bin/bash

# Script to start the dev server correctly with port 3001
echo "Starting development server on port 3001..."

# Determine package manager
if command -v npm &> /dev/null; then
    PORT=3001 npm run dev
elif command -v yarn &> /dev/null; then
    PORT=3001 yarn dev
elif command -v pnpm &> /dev/null; then
    PORT=3001 pnpm dev
else
    echo "Error: No package manager (npm, yarn, or pnpm) found."
    echo "Please install Node.js which includes npm."
    exit 1
fi 