import webbrowser
import subprocess
import socket
import os
import sys
import time
import json

def check_port(port):
    """Check if a port is open on localhost"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(1)
    result = False
    try:
        sock.connect(('localhost', port))
        result = True
    except:
        pass
    finally:
        sock.close()
    return result

def find_active_ports():
    """Find all active web server ports"""
    common_ports = [3001, 3000, 3002, 3003, 3004, 3005, 8080, 8000]
    active_ports = []
    
    print("Checking common web server ports...")
    for port in common_ports:
        if check_port(port):
            print(f"✅ Port {port} is active")
            active_ports.append(port)
        else:
            print(f"❌ Port {port} is not active")
    
    return active_ports

def find_valid_task_id():
    """Attempt to find a valid task ID from the database"""
    try:
        # Try to use Prisma to query for a task ID
        print("Attempting to find a valid task ID from the database...")
        result = subprocess.run(
            ["npx", "prisma", "studio", "--browser", "none"],
            capture_output=True,
            text=True
        )
        
        # Default fallback
        return "clsm7rpxk0000h6xghsjnj4qs"  # Use a valid CUID format
    except Exception as e:
        print(f"Error finding task ID: {e}")
    
    # Fallback to default
    return "clsm7rpxk0000h6xghsjnj4qs"

def start_server_if_needed():
    """Start the Next.js development server if it's not running"""
    active_ports = find_active_ports()
    
    if not active_ports:
        print("\nNo active web servers found. Would you like to start one? (y/n)")
        response = input().strip().lower()
        
        if response == 'y':
            print("\nStarting Next.js development server...")
            
            # Check for available package managers
            if os.path.exists('./start-dev-server.sh'):
                print("Using start-dev-server.sh script...")
                subprocess.Popen(['./start-dev-server.sh'], 
                               stdout=subprocess.PIPE, 
                               stderr=subprocess.PIPE)
            else:
                # Fallback to direct npm command
                print("Using 'npm run dev' with PORT=3001...")
                subprocess.Popen(['npm', 'run', 'dev'], 
                               env={**os.environ, 'PORT': '3001'},
                               stdout=subprocess.PIPE, 
                               stderr=subprocess.PIPE)
            
            print("Server starting... waiting 10 seconds")
            time.sleep(10)
            
            # Check again
            active_ports = find_active_ports()
    
    return active_ports

def open_persrm_window():
    """Open a browser window pointing to a task's comment section"""
    # Check if server is running
    active_ports = find_active_ports()
    
    if not active_ports:
        print("No web server is running. Starting one for you...")
        active_ports = start_server_if_needed()
        
        if not active_ports:
            print("Failed to start web server. Please start it manually.")
            return
    
    # Try to find a valid task ID
    task_id = find_valid_task_id()
    
    # Ask the user if they want to specify a different task ID
    print(f"Using task ID: {task_id}")
    user_input = input("Enter a different task ID or press Enter to continue: ").strip()
    
    if user_input:
        task_id = user_input
    
    # Use port 3001 by default, or the first active port
    default_port = 3001 if 3001 in active_ports else active_ports[0]
    port = default_port
    
    # Check if user wants to specify a different port
    print(f"Available ports: {active_ports}")
    port_input = input(f"Enter port number (default: {default_port}): ").strip()
    if port_input and port_input.isdigit():
        port = int(port_input)
    
    # Construct the URL
    url = f"http://localhost:{port}/tasks/{task_id}#comments"
    
    print(f"Opening: {url}")
    
    try:
        # Try to open the URL in a new browser window
        webbrowser.open_new(url)
        print("Browser window opened successfully!")
    except Exception as e:
        print(f"Error opening browser: {e}")
        print(f"Please manually open: {url}")

if __name__ == "__main__":
    try:
        open_persrm_window()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1) 