#!/usr/bin/env python3
"""
PersLM System Universal Launcher
--------------------------------
This script provides a simple text-based interface to launch any of the
three PersLM modules (Core, UI/UX Agent, PyUI) from a single entry point.
"""

import os
import sys
import subprocess
import platform

# Root directory of PersLM system
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# Module paths
CORE_PATH = os.path.join(ROOT_DIR, "perslm-core")
UIUX_PATH = os.path.join(ROOT_DIR, "perslm-uiux-agent")
PYUI_PATH = os.path.join(ROOT_DIR, "perslm-pyui")

def clear_screen():
    """Clear terminal screen based on operating system."""
    if platform.system() == "Windows":
        os.system("cls")
    else:
        os.system("clear")

def check_module_availability():
    """Check which modules are available in the system."""
    modules = {
        "core": os.path.exists(CORE_PATH) and os.path.isdir(CORE_PATH),
        "uiux": os.path.exists(UIUX_PATH) and os.path.isdir(UIUX_PATH),
        "pyui": os.path.exists(PYUI_PATH) and os.path.isdir(PYUI_PATH)
    }
    return modules

def run_core_cli():
    """Run the PersLM Core CLI."""
    if not os.path.exists(CORE_PATH):
        print("❌ Error: perslm-core module not found!")
        return False
    
    try:
        # Change to core directory
        os.chdir(CORE_PATH)
        
        # Check if we have TypeScript CLI or Python CLI
        if os.path.exists(os.path.join(CORE_PATH, "cli.py")):
            print("🚀 Launching PersLM Core CLI (Python)...")
            subprocess.run([sys.executable, "cli.py"], check=True)
        elif os.path.exists(os.path.join(CORE_PATH, "dist", "cli", "persrm-cli.js")):
            print("🚀 Launching PersLM Core CLI (Node.js)...")
            subprocess.run(["node", "dist/cli/persrm-cli.js"], check=True)
        else:
            # Try npm script as fallback
            print("🚀 Launching PersLM Core CLI via npm...")
            subprocess.run(["npm", "run", "cli"], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error running Core CLI: {e}")
        return False
    finally:
        # Return to root directory
        os.chdir(ROOT_DIR)

def start_uiux_dev_server():
    """Start the UI/UX Agent development server."""
    if not os.path.exists(UIUX_PATH):
        print("❌ Error: perslm-uiux-agent module not found!")
        return False
    
    try:
        # Change to uiux directory
        os.chdir(UIUX_PATH)
        
        print("🚀 Starting UI/UX Agent development server...")
        print("ℹ️ Press Ctrl+C to stop the server")
        subprocess.run(["npm", "run", "dev"], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error starting UI/UX dev server: {e}")
        return False
    finally:
        # Return to root directory
        os.chdir(ROOT_DIR)

def launch_chatbot():
    """Launch the PyUI chatbot interface."""
    if not os.path.exists(PYUI_PATH):
        print("❌ Error: perslm-pyui module not found!")
        return False
    
    try:
        # Change to pyui directory
        os.chdir(PYUI_PATH)
        
        print("🚀 Launching PyUI Chatbot Interface...")
        subprocess.run([sys.executable, "chatbot_interface.py"], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error launching chatbot: {e}")
        return False
    finally:
        # Return to root directory
        os.chdir(ROOT_DIR)

def launch_task_dashboard():
    """Launch the PyUI task dashboard."""
    if not os.path.exists(PYUI_PATH):
        print("❌ Error: perslm-pyui module not found!")
        return False
    
    try:
        # Change to pyui directory
        os.chdir(PYUI_PATH)
        
        print("🚀 Launching PyUI Task Dashboard...")
        subprocess.run([sys.executable, "task_dashboard.py"], check=True)
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Error launching task dashboard: {e}")
        return False
    finally:
        # Return to root directory
        os.chdir(ROOT_DIR)

def display_menu(available_modules):
    """Display the main menu with available modules."""
    clear_screen()
    print("=" * 60)
    print("🧠 PersLM System Launcher".center(60))
    print("=" * 60)
    print()
    
    menu_items = []
    
    if available_modules["core"]:
        menu_items.append(("[1] Run Core CLI", run_core_cli))
    else:
        menu_items.append(("⚠️ [1] Core module not available", None))
    
    if available_modules["uiux"]:
        menu_items.append(("[2] Start UI/UX Dev Server", start_uiux_dev_server))
    else:
        menu_items.append(("⚠️ [2] UI/UX Agent not available", None))
    
    if available_modules["pyui"]:
        menu_items.append(("[3] Launch Chatbot Interface", launch_chatbot))
        menu_items.append(("[4] Launch Task Dashboard", launch_task_dashboard))
    else:
        menu_items.append(("⚠️ [3] PyUI not available", None))
    
    # Add exit option
    exit_number = len(menu_items) + 1
    menu_items.append((f"[{exit_number}] Exit", None))
    
    # Display menu
    for item in menu_items:
        print(item[0])
    
    print()
    choice = input("Enter your choice: ")
    
    try:
        choice_num = int(choice)
        if 1 <= choice_num < exit_number:
            func = menu_items[choice_num - 1][1]
            if func:
                clear_screen()
                func()
                input("\nPress Enter to return to menu...")
            else:
                print("Module not available. Please install it first.")
                input("\nPress Enter to continue...")
        elif choice_num == exit_number:
            print("Exiting PersLM System Launcher. Goodbye!")
            return False
        else:
            print("Invalid choice. Please try again.")
            input("\nPress Enter to continue...")
    except ValueError:
        print("Invalid input. Please enter a number.")
        input("\nPress Enter to continue...")
    
    return True

def main():
    """Main launcher function."""
    # Check which modules are available
    available_modules = check_module_availability()
    
    # Display banner if any module is missing
    if not all(available_modules.values()):
        missing_modules = [name for name, available in available_modules.items() if not available]
        print("⚠️ Warning: Some PersLM modules are not available:")
        for module in missing_modules:
            print(f"  - {module}")
        print("\nOnly available modules will be shown in the menu.")
        input("Press Enter to continue...")
    
    # Main menu loop
    keep_running = True
    while keep_running:
        keep_running = display_menu(available_modules)

if __name__ == "__main__":
    main() 