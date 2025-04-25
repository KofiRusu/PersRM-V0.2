"""
PyInstaller Spec File for PersLM

This file configures PyInstaller to build distributable bundles for PersLM.
"""

import os
import sys
from pathlib import Path

# Determine block cipher
block_cipher = None

# Determine project root
project_root = Path(__file__).parent.parent.parent

# Determine entry point script
if sys.platform == 'darwin':
    # macOS
    entry_point = os.path.join(project_root, 'app', 'desktop', 'desktop_launcher.py')
    icon_file = os.path.join(project_root, 'app', 'resources', 'icons', 'perslm.icns')
elif sys.platform == 'win32':
    # Windows
    entry_point = os.path.join(project_root, 'app', 'desktop', 'desktop_launcher.py')
    icon_file = os.path.join(project_root, 'app', 'resources', 'icons', 'perslm.ico')
else:
    # Linux/Unix
    entry_point = os.path.join(project_root, 'app', 'desktop', 'desktop_launcher.py')
    icon_file = os.path.join(project_root, 'app', 'resources', 'icons', 'perslm.png')

# Default to desktop launcher if entry point not found
if not os.path.exists(entry_point):
    entry_point = os.path.join(project_root, 'app', 'cli', 'cli_entry.py')
    if not os.path.exists(entry_point):
        raise FileNotFoundError(f"Could not find entry point script")

# Create Analysis object
a = Analysis(
    [entry_point],
    pathex=[str(project_root)],
    binaries=[],
    datas=[
        # Include configuration files
        (os.path.join(project_root, 'app', 'config'), 'app/config'),
        (os.path.join(project_root, 'src', 'realtime', 'config'), 'src/realtime/config'),
        (os.path.join(project_root, 'src', 'loop', 'config'), 'src/loop/config'),
        
        # Include resources
        (os.path.join(project_root, 'app', 'resources'), 'app/resources'),
        
        # Include README and license
        (os.path.join(project_root, 'README.md'), '.'),
        (os.path.join(project_root, 'LICENSE'), '.'),
    ],
    hiddenimports=[
        # PersLM modules
        'src.realtime.realtime_loop',
        'src.realtime.speech',
        'src.realtime.tts',
        'src.realtime.interactive',
        'src.loop.autonomy_loop',
        'src.loop.autonomy',
        'src.loop.feedback',
        'src.loop.scheduler',
        'src.personalization',
        'src.memory',
        
        # App modules
        'app.desktop.desktop_launcher',
        'app.desktop.ui_manager',
        'app.desktop.tray_icon',
        'app.cli.cli_entry',
        'app.common.config',
        'app.common.persistence',
        'app.common.notification',
        
        # Dependencies
        'yaml',
        'pyttsx3',
        'numpy',
        'torch',
        'whisper',
        'faiss',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Create PYZ object
pyz = PYZ(
    a.pure, 
    a.zipped_data,
    cipher=block_cipher
)

# Create executable for desktop app
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='PersLM',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_file if os.path.exists(icon_file) else None,
)

# Create executable for CLI
cli_exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='perslm-cli',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

# Create collection
coll = COLLECT(
    exe,
    cli_exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='PersLM',
)

# Create macOS app bundle
if sys.platform == 'darwin':
    app = BUNDLE(
        exe,
        name='PersLM.app',
        icon=icon_file if os.path.exists(icon_file) else None,
        bundle_identifier='com.example.perslm',
        info_plist={
            'CFBundleShortVersionString': '1.0.0',
            'CFBundleGetInfoString': 'PersLM Personal Language Model',
            'NSHumanReadableCopyright': 'Copyright © 2023',
            'NSHighResolutionCapable': 'True',
        },
    ) 