#!/usr/bin/env python3
"""
Build Script for PersLM

This script builds distributable packages for PersLM using PyInstaller.
"""

import os
import sys
import shutil
import argparse
import platform
import subprocess
from pathlib import Path

# Determine project root
script_dir = Path(os.path.dirname(os.path.abspath(__file__)))
project_root = script_dir.parent.parent


def check_requirements():
    """Check that all build requirements are installed."""
    print("Checking build requirements...")
    requirements = ["pyinstaller"]
    
    for req in requirements:
        try:
            __import__(req)
        except ImportError:
            print(f"Error: {req} is not installed. Please install it with:")
            print(f"  pip install {req}")
            return False
    
    return True


def create_resources():
    """Create required resources if they don't exist."""
    # Create resources directory
    resources_dir = project_root / "app" / "resources" / "icons"
    os.makedirs(resources_dir, exist_ok=True)
    
    # Check if at least one icon exists
    icon_exists = False
    for ext in ["ico", "icns", "png"]:
        if (resources_dir / f"perslm.{ext}").exists():
            icon_exists = True
            break
    
    if not icon_exists:
        # Create a minimal icon if none exists
        print("No icons found. Creating a minimal icon...")
        
        # Try to create a basic PNG icon
        try:
            from PIL import Image, ImageDraw
            
            # Create a 256x256 image with a simple design
            img = Image.new('RGBA', (256, 256), color=(0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            
            # Draw a blue circle
            draw.ellipse((20, 20, 236, 236), fill=(30, 144, 255, 255))
            
            # Draw a white "P" letter
            draw.text((100, 95), "P", fill=(255, 255, 255, 255), font_size=120)
            
            # Save the PNG
            img.save(resources_dir / "perslm.png")
            print("Created minimal icon at app/resources/icons/perslm.png")
        except ImportError:
            print("Warning: PIL (Pillow) not installed. Cannot create icon.")
            print("You can create your own icons and place them in app/resources/icons/")


def build_pyinstaller(args):
    """Build the application using PyInstaller."""
    print("Building application using PyInstaller...")
    
    # Determine spec file
    spec_file = script_dir / "pyinstaller_spec.py"
    
    # Determine output directory
    output_dir = args.output_dir or (project_root / "dist")
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Build command
    cmd = [
        "pyinstaller",
        "--clean",
        f"--distpath={output_dir}",
        f"--workpath={output_dir}/build",
        str(spec_file)
    ]
    
    # Add additional arguments
    if args.onefile:
        cmd.append("--onefile")
    
    if args.upx_dir:
        cmd.extend(["--upx-dir", args.upx_dir])
    
    # Run PyInstaller
    print(f"Running command: {' '.join(cmd)}")
    process = subprocess.run(cmd, check=False)
    
    if process.returncode != 0:
        print(f"Error: PyInstaller failed with return code {process.returncode}")
        return False
    
    print(f"Application successfully built to {output_dir}")
    return True


def create_installer():
    """Create installers for the platform."""
    if platform.system() == "Windows":
        print("Creating Windows installer...")
        # Check for NSIS
        try:
            subprocess.run(["makensis", "-VERSION"], check=True, capture_output=True)
            
            # Create NSIS script
            nsis_script = script_dir / "windows_installer.nsi"
            if not nsis_script.exists():
                print("NSIS script not found. Skipping installer creation.")
                return False
            
            # Run NSIS
            subprocess.run(["makensis", str(nsis_script)], check=True)
            print("Windows installer created successfully")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("NSIS not found. Skipping installer creation.")
            return False
    
    elif platform.system() == "Darwin":
        print("Creating macOS DMG...")
        # Check if create-dmg is installed
        try:
            subprocess.run(["create-dmg", "--version"], check=True, capture_output=True)
            
            # Create DMG
            app_path = project_root / "dist" / "PersLM.app"
            dmg_path = project_root / "dist" / "PersLM.dmg"
            
            if not app_path.exists():
                print(f"App bundle not found at {app_path}. Skipping DMG creation.")
                return False
            
            # Run create-dmg
            subprocess.run([
                "create-dmg",
                "--volname", "PersLM",
                "--window-size", "500", "300",
                "--icon-size", "100",
                "--icon", "PersLM.app", "150", "150",
                "--app-drop-link", "350", "150",
                str(dmg_path),
                str(app_path)
            ], check=True)
            
            print(f"macOS DMG created at {dmg_path}")
            return True
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("create-dmg not found. Skipping DMG creation.")
            return False
    
    elif platform.system() == "Linux":
        print("Creating Linux package...")
        # For simplicity, create a tar.gz archive
        try:
            dist_dir = project_root / "dist" / "PersLM"
            archive_name = f"PersLM-{platform.machine()}.tar.gz"
            archive_path = project_root / "dist" / archive_name
            
            if not dist_dir.exists():
                print(f"Distribution not found at {dist_dir}. Skipping package creation.")
                return False
            
            # Create archive
            shutil.make_archive(
                str(archive_path).replace(".tar.gz", ""),
                "gztar",
                root_dir=str(project_root / "dist"),
                base_dir="PersLM"
            )
            
            print(f"Linux package created at {archive_path}")
            return True
        except Exception as e:
            print(f"Error creating Linux package: {e}")
            return False
    
    else:
        print(f"Installer creation not supported for {platform.system()}")
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Build PersLM into distributable packages")
    
    # Add arguments
    parser.add_argument("--output-dir", type=str, help="Output directory for built application")
    parser.add_argument("--onefile", action="store_true", help="Build a single executable file")
    parser.add_argument("--upx-dir", type=str, help="Directory containing UPX executable")
    parser.add_argument("--no-installer", action="store_true", help="Skip installer creation")
    parser.add_argument("--clean", action="store_true", help="Clean build directories before building")
    
    # Parse arguments
    args = parser.parse_args()
    
    # Clean if requested
    if args.clean:
        print("Cleaning build directories...")
        shutil.rmtree(project_root / "dist", ignore_errors=True)
        shutil.rmtree(project_root / "build", ignore_errors=True)
        if args.output_dir:
            shutil.rmtree(Path(args.output_dir), ignore_errors=True)
    
    # Check requirements
    if not check_requirements():
        return 1
    
    # Create resources
    create_resources()
    
    # Build with PyInstaller
    if not build_pyinstaller(args):
        return 1
    
    # Create installer
    if not args.no_installer:
        create_installer()
    
    print("Build completed successfully!")
    return 0


if __name__ == "__main__":
    sys.exit(main()) 