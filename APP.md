# PersLM Application Overview

PersLM Application is a cross-platform, user-facing interface for the PersLM AI assistant. It provides various modes of interaction and deployment options to suit different user needs.

## Table of Contents

- [Application Structure](#application-structure)
- [Runtime Modes](#runtime-modes)
- [Installation](#installation)
- [Configuration](#configuration)
- [Entry Points](#entry-points)
- [Running the Application](#running-the-application)
- [Troubleshooting](#troubleshooting)

## Application Structure

The PersLM application is organized into several subpackages:

```
PersLM/
├── app/                          # Application layer
│   ├── desktop/                  # Desktop UI components
│   │   ├── desktop_launcher.py   # Desktop app entry point
│   │   ├── ui_manager.py         # UI component manager
│   │   └── tray_icon.py          # System tray integration
│   ├── cli/                      # Command-line interface
│   │   └── cli_entry.py          # CLI entry point
│   ├── web/                      # Web UI and API
│   │   └── api_server.py         # FastAPI server
│   ├── embedded/                 # IoT/edge deployment
│   │   └── embedded_launcher.py  # Embedded entry point
│   ├── common/                   # Shared utilities
│   │   ├── config.py             # Configuration management
│   │   ├── persistence.py        # State persistence
│   │   └── notification.py       # Notification system
│   ├── packaging/                # Build and distribution tools
│   │   ├── pyinstaller_spec.py   # PyInstaller configuration
│   │   └── build_app.py          # Build script
│   └── config/                   # Configuration files
│       └── app_config.yaml       # Default configuration
└── src/                          # Core PersLM components
```

## Runtime Modes

PersLM supports multiple runtime modes:

### 1. Desktop Application

A full-featured desktop application with:
- GUI interface
- System tray integration
- Notification support
- Speech input/output
- Background processing

### 2. Command-Line Interface (CLI)

A terminal-based interface with:
- Interactive command shell
- Color-coded output
- Command history and completion
- Easy scriptability
- Full access to PersLM capabilities

### 3. Web Interface

A web-based interface with:
- REST API
- WebSocket support for streaming
- Responsive web UI
- Remote access capabilities

### 4. Embedded/Edge Deployment

An optimized deployment for resource-constrained environments:
- Low memory footprint
- Minimal UI options
- Headless operation support
- IoT integration

## Installation

### Pre-built Packages

The easiest way to install PersLM is using the pre-built packages:

#### Windows
1. Download the latest `PersLM-Setup.exe` installer from the releases page
2. Run the installer and follow the prompts
3. PersLM will be installed and added to the Start menu

#### macOS
1. Download the latest `PersLM.dmg` from the releases page
2. Mount the DMG by double-clicking it
3. Drag PersLM.app to your Applications folder
4. (Optional) Right-click and select Open the first time to bypass Gatekeeper

#### Linux
1. Download the latest `PersLM-{arch}.tar.gz` for your architecture
2. Extract it: `tar -xzf PersLM-{arch}.tar.gz`
3. Run the application: `./PersLM/PersLM`

### Building from Source

To build PersLM from source:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/PersLM.git
   cd PersLM
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Build the application:
   ```bash
   python app/packaging/build_app.py
   ```

4. Find the built application in the `dist/` directory

## Configuration

PersLM can be configured through several methods:

1. **Configuration Files**:
   - Main app config: `app/config/app_config.yaml`
   - Real-time interaction: `src/realtime/config/config.yaml`
   - Autonomy settings: `src/loop/config/config.yaml`

2. **Command-line Arguments**:
   Each entry point supports various command-line arguments to override configuration settings.

3. **Environment Variables**:
   All settings can be overridden with environment variables prefixed with `PERSLM_`.
   Example: `PERSLM_UI_TYPE=minimal` to set the UI type.

4. **Runtime Settings**:
   Many settings can be changed during runtime through the settings UI.

## Entry Points

### Desktop Application

```bash
# Start desktop application
python app/desktop/desktop_launcher.py

# With specific configuration
python app/desktop/desktop_launcher.py --config=my_config.yaml

# With specific user profile
python app/desktop/desktop_launcher.py --user=john_doe

# Start minimized to tray
python app/desktop/desktop_launcher.py --tray-only
```

### CLI

```bash
# Start CLI
python app/cli/cli_entry.py

# With voice mode enabled
python app/cli/cli_entry.py --voice

# With autonomy disabled
python app/cli/cli_entry.py --no-autonomy

# Execute a command and exit
python app/cli/cli_entry.py --exec="status"
```

### Web Server

```bash
# Start web server
python app/web/api_server.py

# Specify host and port
python app/web/api_server.py --host=0.0.0.0 --port=8000

# Disable autonomy
python app/web/api_server.py --no-autonomy
```

### Embedded Deployment

```bash
# Start in embedded mode
python app/embedded/embedded_launcher.py

# Start in interactive mode
python app/embedded/embedded_launcher.py --interactive

# Run headless
python app/embedded/embedded_launcher.py --headless
```

## Running the Application

### Windows

1. Double-click the PersLM shortcut in the Start menu or Desktop
2. The application starts in the system tray
3. Click the system tray icon to open the main window

### macOS

1. Open the Applications folder and double-click PersLM.app
2. The application appears in the menu bar
3. Click the menu bar icon to open the main window

### Linux

1. Run the PersLM executable or use the desktop shortcut if available
2. The application appears in the system tray
3. Click the system tray icon to open the main window

## Troubleshooting

### Common Issues

1. **Application won't start**:
   - Check if Python is installed and in PATH
   - Ensure all dependencies are installed
   - Check logs in `logs/` directory

2. **UI not appearing**:
   - Make sure Qt libraries are installed
   - Try running with `--ui-type=minimal`
   - Check display server compatibility

3. **Voice features not working**:
   - Ensure microphone permissions are granted
   - Check audio device configuration
   - Try running with `--config` to specify audio devices

4. **High resource usage**:
   - Lower model size in configuration
   - Disable unnecessary features
   - Use the embedded mode for resource-constrained environments

For more troubleshooting help, check the logs in the `logs/` directory or run the application with `--log-level=debug`. 