#!/usr/bin/env python3

import subprocess
import os
import time
import webbrowser
import sys
import signal

def signal_handler(sig, frame):
    print('\nGracefully shutting down...')
    if 'server_process' in globals():
        server_process.terminate()
    sys.exit(0)

# Register the signal handler
signal.signal(signal.SIGINT, signal_handler)

# Colors for terminal output
GREEN = '\033[92m'
BLUE = '\033[94m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

print(f"{BLUE}======================================{RESET}")
print(f"{BLUE}PersRM Reasoning Runner{RESET}")
print(f"{BLUE}======================================{RESET}")
print()

# 1. Kill any existing Next.js processes to avoid port conflicts
print(f"{YELLOW}Stopping any existing Node.js processes...{RESET}")
try:
    subprocess.run(["pkill", "-f", "node.*next"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(2)
except Exception as e:
    print(f"  Note: {e}")

# 2. Set up environment variables for the reasoning app
os.environ["PORT"] = "3017"  # Use port 3017 specifically
os.environ["NEXT_PUBLIC_APP_MODE"] = "reasoning"  # Set the app mode if needed

# 3. Start the reasoning app
print(f"{YELLOW}Starting Reasoning app on port 3017...{RESET}")
try:
    # Launch the server process with standard Next.js dev command
    server_process = subprocess.Popen(
        ["npm", "run", "dev"], 
        env=os.environ,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for server to start
    print(f"{YELLOW}Server starting on port 3017... waiting{RESET}")
    for _ in range(15):  # Wait up to 15 seconds
        print(".", end="", flush=True)
        time.sleep(1)
    print("\n")
    
    # 4. Open the reasoning page in browser
    url = "http://localhost:3017/reasoning"
    print(f"{GREEN}Opening reasoning page in browser: {url}{RESET}")
    webbrowser.open(url)
    
    # 5. Keep the script running and capture output
    print(f"{YELLOW}Monitoring server output (press Ctrl+C to exit):{RESET}")
    while True:
        output = server_process.stdout.readline()
        if output:
            print(output.strip())
        
        # Check if the process is still alive
        if server_process.poll() is not None:
            print(f"{RED}Server process exited with code {server_process.poll()}{RESET}")
            
            # Print any error output
            error_output = server_process.stderr.read()
            if error_output:
                print(f"{RED}Error output:{RESET}")
                print(error_output)
            
            break
            
except Exception as e:
    print(f"{RED}Error: {e}{RESET}")
    sys.exit(1)
finally:
    print(f"{YELLOW}Shutting down...{RESET}")
    if 'server_process' in globals() and server_process.poll() is None:
        server_process.terminate() 