#!/usr/bin/env python3
"""
PersLM Core Validation Test
---------------------------
This script validates the structure and basic functionality
of the perslm-core module.
"""

import os
import sys
import json
import unittest
import subprocess
from typing import List, Dict, Any

# Directory of this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

class PersLMCoreStructureTest(unittest.TestCase):
    """Test the structure of the perslm-core module."""
    
    def test_directory_structure(self):
        """Test that all required directories exist."""
        required_dirs = [
            "analyzers",
            "cli",
            "reasoning",
            "plugins",
            "benchmarks",
        ]
        
        for dirname in required_dirs:
            with self.subTest(directory=dirname):
                dir_path = os.path.join(SCRIPT_DIR, dirname)
                self.assertTrue(os.path.isdir(dir_path), f"Directory {dirname} should exist")
    
    def test_required_files(self):
        """Test that all required files exist."""
        required_files = [
            "README.md",
            "package.json",
            "tsconfig.json",
            "cli.py",
        ]
        
        for filename in required_files:
            with self.subTest(file=filename):
                file_path = os.path.join(SCRIPT_DIR, filename)
                self.assertTrue(os.path.isfile(file_path), f"File {filename} should exist")
    
    def test_package_json(self):
        """Test that package.json has the required properties."""
        package_path = os.path.join(SCRIPT_DIR, "package.json")
        
        try:
            with open(package_path, "r") as f:
                package_data = json.load(f)
                
            self.assertEqual(package_data["name"], "perslm-core", "Package name should be perslm-core")
            self.assertIn("version", package_data, "Package should have a version")
            self.assertIn("main", package_data, "Package should have a main entry point")
            self.assertIn("scripts", package_data, "Package should have scripts")
            self.assertIn("cli", package_data["scripts"], "Package should have a CLI script")
        except Exception as e:
            self.fail(f"Failed to parse package.json: {e}")


class PersLMCoreFunctionalTest(unittest.TestCase):
    """Test the basic functionality of the perslm-core module."""
    
    def test_cli_help(self):
        """Test that the CLI help command works."""
        try:
            # Run the CLI with --help
            result = subprocess.run(
                [sys.executable, os.path.join(SCRIPT_DIR, "cli.py"), "--help"],
                check=True,
                capture_output=True,
                text=True
            )
            
            # Check output contains expected text
            self.assertIn("PersLM Core", result.stdout, "CLI help should mention PersLM Core")
            self.assertIn("analyze", result.stdout, "CLI help should mention analyze command")
            self.assertIn("optimize", result.stdout, "CLI help should mention optimize command")
            self.assertIn("benchmark", result.stdout, "CLI help should mention benchmark command")
        except subprocess.CalledProcessError as e:
            self.fail(f"CLI help command failed: {e}")
    
    def test_analyzer_presence(self):
        """Test that analyzers are present."""
        analyzer_dir = os.path.join(SCRIPT_DIR, "analyzers")
        analyzers = [f for f in os.listdir(analyzer_dir) 
                    if os.path.isfile(os.path.join(analyzer_dir, f)) and 
                    (f.endswith(".ts") or f.endswith(".js") or f.endswith(".py"))]
        
        self.assertGreater(len(analyzers), 0, "Should have at least one analyzer")


def print_test_summary(test_result):
    """Print a summary of the test results."""
    print("\n=== PersLM Core Validation Summary ===")
    print(f"Ran {test_result.testsRun} tests")
    
    if test_result.wasSuccessful():
        print("✅ All tests passed - PersLM Core structure is valid")
    else:
        print(f"❌ {len(test_result.failures) + len(test_result.errors)} tests failed")
        print("PersLM Core structure issues detected")

    # Print details of failures
    if test_result.failures:
        print("\nFailures:")
        for test, traceback in test_result.failures:
            print(f"- {test}")
    
    # Print details of errors
    if test_result.errors:
        print("\nErrors:")
        for test, traceback in test_result.errors:
            print(f"- {test}")


def main():
    """Run the tests and print a summary."""
    # Create test suite
    suite = unittest.TestSuite()
    
    # Add structure tests
    suite.addTest(unittest.makeSuite(PersLMCoreStructureTest))
    
    # Add functionality tests
    suite.addTest(unittest.makeSuite(PersLMCoreFunctionalTest))
    
    # Run tests
    test_result = unittest.TestResult()
    suite.run(test_result)
    
    # Print summary
    print_test_summary(test_result)
    
    # Return appropriate exit code
    return 0 if test_result.wasSuccessful() else 1


if __name__ == "__main__":
    sys.exit(main()) 