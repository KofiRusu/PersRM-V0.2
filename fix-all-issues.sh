#!/bin/bash

# Comprehensive fix script for PersRM comment system
echo "=========================================="
echo "PersRM Comment System - Fix All Issues"
echo "=========================================="
echo ""

# Determine package manager
if command -v npm &> /dev/null; then
    PKG_MGR="npm"
elif command -v yarn &> /dev/null; then
    PKG_MGR="yarn"
elif command -v pnpm &> /dev/null; then
    PKG_MGR="pnpm"
else
    echo "Error: No package manager (npm, yarn, or pnpm) found."
    echo "Please install Node.js which includes npm."
    exit 1
fi

# 1. Apply Database Changes
echo "STEP 1: Applying database schema changes..."
echo "-----------------------------------------"
npx prisma db push --accept-data-loss

echo ""
echo "STEP 2: Running comment permissions migration script..."
echo "-----------------------------------------"
node prisma/migrations/migrate-comment-permissions.js

# 3. Check for running servers
echo ""
echo "STEP 3: Checking for running Next.js servers..."
echo "-----------------------------------------"
echo "Stopping any existing Next.js servers to avoid port conflicts..."

# Find and kill existing Next.js processes
pkill -f "node.*next" || echo "No Next.js processes found to stop."
sleep 2

# 4. Start server on correct port
echo ""
echo "STEP 4: Starting development server on port 3001..."
echo "-----------------------------------------"

# Create a temporary file to capture server logs
LOG_FILE="$(mktemp)"
echo "Server logs will be saved to: $LOG_FILE"

# Start the development server with specific port
PORT=3001 $PKG_MGR run dev > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

echo "Server started with PID: $SERVER_PID"
echo "Waiting for server to initialize (10 seconds)..."
sleep 10

# Check if server is still running
if ps -p $SERVER_PID > /dev/null; then
    echo "Server is running successfully on port 3001!"
else
    echo "Server process died. Check logs at $LOG_FILE"
    echo "Last 10 lines of server log:"
    tail -n 10 "$LOG_FILE"
    exit 1
fi

# 5. Try to open a hard-coded task ID that's likely to exist
echo ""
echo "STEP 5: Opening a task page in browser..."
echo "-----------------------------------------"
echo "Which would you prefer?"
echo "1. Use Python script with automatic task detection"
echo "2. Open a direct URL with a known working task ID"
read -p "Enter choice (1 or 2): " OPEN_CHOICE

if [ "$OPEN_CHOICE" = "1" ]; then
    python open_persrm_window.py
else
    # Get a list of task IDs from the database
    echo "Fetching task IDs from database..."
    TASK_IDS=$(npx prisma studio --browser none 2>&1 | grep -o 'clk[a-zA-Z0-9]*' | head -n 1)
    
    if [ -z "$TASK_IDS" ]; then
        # If no task ID found, use a hardcoded one that matches CUID format
        TASK_ID="clsm7rpxk0000h6xghsjnj4qs"
        echo "No tasks found in database. Using generic task ID: $TASK_ID"
    else
        TASK_ID=$(echo "$TASK_IDS" | head -n 1)
        echo "Found task ID: $TASK_ID"
    fi
    
    # Build and open URL
    URL="http://localhost:3001/tasks/$TASK_ID#comments"
    echo "Opening URL: $URL"
    
    if command -v open &> /dev/null; then
        # macOS
        open "$URL"
    elif command -v xdg-open &> /dev/null; then
        # Linux
        xdg-open "$URL"
    elif command -v start &> /dev/null; then
        # Windows
        start "$URL"
    else
        echo "Cannot open browser automatically."
        echo "Please manually open: $URL"
    fi
fi

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "If the browser didn't open automatically:"
echo "1. Open your browser"
echo "2. Navigate to: http://localhost:3001/tasks/{TASK_ID}#comments"
echo "   (Replace {TASK_ID} with a valid task ID)"
echo ""
echo "To stop the server later, run:"
echo "kill $SERVER_PID"
echo "" 