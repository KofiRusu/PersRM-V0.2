#!/bin/bash

# Script to detect running Next.js servers and their ports
echo "Detecting running Next.js servers..."

# Find processes that might be Next.js servers
echo "Checking for Next.js processes..."
NEXT_PROCESSES=$(ps aux | grep "next" | grep -v "grep" | grep -v "find_server.sh")

# Display found processes
if [ -n "$NEXT_PROCESSES" ]; then
    echo "Found potential Next.js processes:"
    echo "$NEXT_PROCESSES"
    echo ""
else
    echo "No Next.js processes found running."
    echo ""
fi

# Check commonly used ports
echo "Checking commonly used Next.js ports..."
PORTS_TO_CHECK=(3000 3001 3002 3003 3004 3005 8080 8000)
WORKING_PORTS=()

for PORT in "${PORTS_TO_CHECK[@]}"; do
    echo -n "Checking port $PORT... "
    # Use curl with a timeout to check if the port responds
    if curl -s "http://localhost:$PORT" -o /dev/null -m 1; then
        echo "ACTIVE ✓"
        WORKING_PORTS+=($PORT)
    else
        echo "not active"
    fi
done

echo ""
if [ ${#WORKING_PORTS[@]} -eq 0 ]; then
    echo "No active Next.js servers found on common ports."
    echo "Make sure your development server is running with:"
    echo "./start-dev-server.sh"
else
    echo "Found active web servers on ports: ${WORKING_PORTS[*]}"
    echo ""
    echo "To open a task with a specific port:"
    echo "python open_persrm_window.py"
    echo "Then enter the port number when prompted."
fi

# Attempt to determine port from package.json
echo ""
echo "Checking package.json for port configuration..."
if grep -q "PORT=" .env 2>/dev/null; then
    PORT=$(grep "PORT=" .env | cut -d'=' -f2)
    echo "Found PORT=$PORT in .env file"
elif grep -q "port" package.json; then
    echo "Port configuration might be in package.json"
    echo "Consider checking this file manually."
else
    echo "No explicit port configuration found."
fi

echo ""
echo "If you know the correct port, use:"
echo "python open_persrm_window.py"
echo "And enter the port number when prompted." 