#!/usr/bin/env python3

import socket
import subprocess
import time
import os
import sys

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
    common_ports = [3000, 3001, 3002, 3003, 3004, 3005, 8080, 8000]
    active_ports = []
    
    print("Checking common web server ports...")
    for port in common_ports:
        if check_port(port):
            print(f"✅ Port {port} is active")
            active_ports.append(port)
        else:
            print(f"❌ Port {port} is not active")
    
    return active_ports

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
                subprocess.Popen(['./start-dev-server.sh'], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE)
            else:
                # Fallback to direct npm command
                subprocess.Popen(['npm', 'run', 'dev'], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE)
            
            print("Server starting... waiting 10 seconds")
            time.sleep(10)
            
            # Check again
            active_ports = find_active_ports()
            if active_ports:
                print(f"\nServer successfully started on port(s): {active_ports}")
            else:
                print("\nServer may have failed to start. Check for errors in the terminal.")
        else:
            print("\nServer not started. You'll need to start it manually.")
    else:
        print(f"\nFound active server(s) on port(s): {active_ports}")
    
    return active_ports

def open_task_page(port=None):
    """Open a task page in the browser"""
    active_ports = find_active_ports()
    
    if not active_ports and port is None:
        print("No active servers found and no port specified.")
        return False
    
    if port is None:
        port = active_ports[0]  # Use the first active port
    
    print(f"\nUsing port {port} to open task page")
    
    # Run the open_persrm_window.py script with the correct port
    try:
        subprocess.run(['python', 'open_persrm_window.py'])
        return True
    except Exception as e:
        print(f"Error opening task page: {e}")
        return False

if __name__ == "__main__":
    print("Next.js Server & Task Page Checker")
    print("==================================")
    
    active_ports = start_server_if_needed()
    
    if active_ports:
        print("\nWould you like to open a task page? (y/n)")
        response = input().strip().lower()
        
        if response == 'y':
            if len(active_ports) > 1:
                print(f"\nMultiple active ports found: {active_ports}")
                print("Which port would you like to use?")
                port_input = input().strip()
                
                try:
                    port = int(port_input)
                    open_task_page(port)
                except ValueError:
                    print("Invalid port number. Using the first active port.")
                    open_task_page(active_ports[0])
            else:
                open_task_page(active_ports[0])
    
    print("\nDone!") 