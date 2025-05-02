#!/bin/bash

echo "⏳ Testing PersLM modular split..."

# Test perslm-core
echo "⏳ Testing perslm-core..."
cd perslm-core
if [ -f "README.md" ] && [ -d "analyzers" ] && [ -d "cli" ] && [ -d "reasoning" ] && [ -f "cli.py" ] && [ -f "test_core.py" ]; then
  echo "✅ perslm-core structure looks good"
  
  # Try running the CLI help command
  echo "⏳ Testing perslm-core CLI..."
  if python cli.py --help > /dev/null 2>&1; then
    echo "✅ perslm-core CLI runs successfully"
  else
    echo "❌ perslm-core CLI failed to run"
  fi
  
  # Try running the validation test
  echo "⏳ Running perslm-core validation test..."
  python test_core.py
else
  echo "❌ perslm-core is missing expected files/directories"
fi
cd ..

# Test perslm-uiux-agent
echo "⏳ Testing perslm-uiux-agent..."
cd perslm-uiux-agent
if [ -f "README.md" ] && [ -d "ux-enhancer" ] && [ -d "sessions" ] && [ -f "package.json" ] && [ -f "tsconfig.json" ]; then
  echo "✅ perslm-uiux-agent structure looks good"
  
  # Check if package.json references perslm-core
  if grep -q "perslm-core" package.json; then
    echo "✅ perslm-uiux-agent depends on perslm-core"
  else
    echo "❌ perslm-uiux-agent is missing dependency on perslm-core"
  fi
else
  echo "❌ perslm-uiux-agent is missing expected files/directories"
fi
cd ..

# Test perslm-pyui
echo "⏳ Testing perslm-pyui..."
cd perslm-pyui
if [ -f "README.md" ] && [ -f "chatbot_interface.py" ] && [ -f "task_dashboard.py" ] && [ -f "requirements.txt" ]; then
  echo "✅ perslm-pyui structure looks good"
  
  # Check if requirements.txt has expected dependencies
  if grep -q "streamlit" requirements.txt && grep -q "gradio" requirements.txt; then
    echo "✅ perslm-pyui has required dependencies"
  else
    echo "❌ perslm-pyui is missing required dependencies"
  fi
else
  echo "❌ perslm-pyui is missing expected files/directories"
fi
cd ..

# Test shared files
echo "⏳ Testing shared files..."
if [ -f "MODULAR_OVERVIEW.md" ] && [ -f "run-system.py" ]; then
  echo "✅ Shared files look good"
else
  echo "❌ Missing required shared files"
fi

echo "✅ Testing complete!" 