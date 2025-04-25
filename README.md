# Schema UI System with AI Component Generator

This project combines a comprehensive schema-driven UI system with an AI-powered UI component generator similar to Vercel's v0.dev.

## Features

### Schema UI System
- Schema-driven form generation
- Version control and diffing
- Real-time collaboration
- AI-powered change analysis

### AI UI Generator
- Generate UI components from natural language prompts
- Create forms from JSON schema
- Save components to your library
- Multiple AI model support (OpenAI, Ollama)
- Version history tracking
- Component tagging and organization

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- SQLite (for development)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/schema-ui-system.git
cd schema-ui-system
```

2. Install dependencies
```bash
npm install
# or
yarn
```

3. Set up environment variables
```bash
cp .env.example .env.local
```
Edit `.env.local` and add your OpenAI API key.

4. Set up the database
```bash
npx prisma migrate dev --name init
```

5. Start the development server
```bash
npm run dev
# or
yarn dev
```

## Using the AI UI Generator

### Generating Components from Prompts
1. Navigate to `/ui-generator`
2. Enter a natural language prompt describing the UI you want
3. Click "Generate UI"
4. View, copy, or save the generated component to your library

### Generating Components from JSON Schema
1. Navigate to `/ui-generator` and select the "JSON Schema" tab
2. Paste a valid JSON schema or upload a JSON file
3. Click "Generate UI"
4. The system will create a fully functional form component based on your schema

### Managing Your Component Library
1. Navigate to `/components` to view your saved components
2. Filter by type (prompt or schema-based) or search by name/description
3. Click on any component to view details, copy code, or see version history

## Development

### Database Management
- Run `npm run prisma:studio` to view and edit the database through the Prisma Studio interface
- Run `npm run prisma:migrate:dev` to generate new migrations after schema changes

### Adding New AI Models
To add support for new AI models, edit the `src/lib/aiClient.ts` file.

## Project Structure

```
/app                    # Next.js App Router pages
  /ui-generator         # AI UI Generator
  /components           # Component Library
/components             # React components
  /ui                   # Shadcn UI components
  /ui-generator         # UI Generator components
  /schema               # Schema UI System components
/lib                    # Shared utilities
  /db.ts                # Prisma client
  /aiClient.ts          # AI generation logic
/prisma                 # Database schema and migrations
```

## License
MIT 

# UX Enhancer

A powerful UX enhancement and analysis tool for improving your application's user experience.

## Features

- **Real-time UX Analysis**: Evaluate your application's user experience in real-time
- **Performance Metrics**: Track key performance indicators across different phases
- **Issue Detection**: Automatically identify UX issues with severity ratings
- **Enhancement Suggestions**: Receive actionable suggestions to improve your UI/UX
- **Comprehensive Dashboard**: Visualize analysis results in an intuitive dashboard
- **Report Generation**: Generate detailed reports for documentation and tracking

## Getting Started

### Installation

```bash
npm install ux-enhancer
```

### Basic Usage

```tsx
import { UXDashboard } from './components/UXDashboard';
import { createUXEnhancerEngine } from './lib/ux-enhancer';

function App() {
  const engine = createUXEnhancerEngine({ 
    targetApp: 'my-application',
    analysisDepth: 'detailed'
  });

  return (
    <div className="app">
      <UXDashboard engine={engine} />
    </div>
  );
}
```

### Custom Hook

The UX Enhancer provides a React hook for more control:

```tsx
import { useUXEnhancer } from './lib/hooks/useUXEnhancer';
import { createUXEnhancerEngine } from './lib/ux-enhancer';

function MyComponent() {
  const engine = createUXEnhancerEngine();
  const { 
    summary, 
    error, 
    loading, 
    analyzing, 
    progress, 
    analyze, 
    generateReport, 
    isValid, 
    validationErrors 
  } = useUXEnhancer(engine, { autoRefresh: true });

  // Your custom UI implementation
  return (
    <div>
      {/* Render your UI based on the analysis state */}
    </div>
  );
}
```

## Architecture

The UX Enhancer consists of several key components:

1. **UX Enhancer Engine**: Core analysis logic that evaluates your application
2. **React Hook**: `useUXEnhancer` hook for integrating with React components
3. **Dashboard Component**: Ready-to-use visualization of analysis results
4. **Validation**: Ensures data integrity and proper formatting
5. **Report Generation**: Creates standardized reports for sharing and documentation

## Dashboard

The UX Dashboard provides a complete visualization of analysis results, including:

- Overall score and performance metrics
- Phase-by-phase breakdown
- Issue details with severity ratings
- Visual charts and indicators
- Interactive filters and tabs

## Demo

To explore a demo implementation:

```bash
npm run dev
```

Then navigate to `/ux-enhancer-demo` to see the UX Enhancer in action.

## Running Tests

```bash
npm test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License. 

# PersRM - Personalized UI/UX Performance Agent

PersRM is a comprehensive tool for analyzing, optimizing, and enhancing the UI/UX performance of web applications. It provides detailed insights into visual consistency, design token usage, animations, and cognitive load, allowing developers to make data-driven decisions to improve their application's user experience.

## Features

- 🔍 **Analysis**: Scan your project and identify UI/UX issues
- ⚡ **Optimization**: Get actionable suggestions to improve performance
- 🧩 **Component Generation**: Generate optimized components based on your design system
- 📊 **Reporting**: Detailed reports for tracking improvements
- 🔄 **CI Integration**: Integrate with CI/CD pipelines for continuous UX monitoring
- 🔥 **Hot Reload**: Auto-optimization when files change with watcher

## Installation

```bash
npm install -g persrm
```

Or use it without installing:

```bash
npx persrm [command]
```

## Usage

### Initialize Configuration

```bash
persrm init
```

This creates a `persrm.config.json` file in your project with default settings.

### Analyze a Project

```bash
persrm analyze <project-path> [options]
```

Options:
- `-o, --output-dir <path>`: Output directory for results (default: './persrm-output')
- `-v, --verbose`: Enable verbose logging
- `-s, --screenshots`: Take screenshots during analysis
- `-d, --design-system <path>`: Path to design system
- `--ci`: Run in CI mode
- `--pr <number>`: PR number for CI mode
- `--branch <name>`: Branch name for CI mode

### Optimize a Project

```bash
persrm optimize <project-path> [options]
```

Analyzes your project and provides optimization suggestions.

### Generate a Component

```bash
persrm generate <component-name> [options]
```

Options:
- `-t, --type <type>`: Type of component to generate (default: 'BASIC')
- `-p, --project <path>`: Project path (required)
- `-f, --framework <name>`: Framework to use (react, vue, angular) (default: 'react')
- `-s, --style <type>`: Styling approach (css, scss, styled) (default: 'css')
- `--props <props>`: Component props as JSON string
- `--tests`: Generate tests
- `--stories`: Generate storybook stories

### Generate a Report

```bash
persrm report [options]
```

Options:
- `-i, --input <path>`: Path to input result file
- `-f, --format <format>`: Report format (html, md, json) (default: 'html')
- `--screenshots`: Include screenshots in report
- `--diffs`: Include visual diffs in report
- `--compare <path>`: Path to previous result to compare with
- `--ci-publish`: Publish report to CI

## Hot Reload & Watch Mode

PersRM supports hot reload functionality that automatically runs optimizations when your components change. This is perfect for development workflows where you want immediate feedback on UX improvements.

### Using Watch Mode

```bash
# Run using npm scripts
npm run ux:watch:mock

# Or directly
ts-node src/agents/watch.ts ./path/to/components
```

The watcher will:
1. Monitor the specified directory for file changes
2. Automatically run optimization when files are modified
3. Generate reports with UX scores and suggestions
4. Show real-time feedback in the terminal

### Configuration in agent-config.json

For Cursor integration, you can configure auto-optimization in your `agent-config.json`:

```json
{
  "config": {
    "autoOptimize": true,
    "watchPath": "./src/components",
    "verbose": true
  }
}
```

### Using in PersRMUI

The React UI component supports auto-optimization by passing props:

```tsx
<PersRMUI 
  agent={agent} 
  autoOptimize={true} 
  watchPath="./src/components" 
/>
```

## Examples

### Basic Analysis

```bash
npm run ux:analyze
```

### Optimize with Design System

```bash
npm run ux:optimize
```

### Generate an HTML Report

```bash
npm run ux:report
```

### Watch Components for Changes (Mock Mode)

```bash
npm run ux:watch:mock
```

## Configuration

The `persrm.config.json` file supports the following options:

```json
{
  "mode": "ANALYSIS",
  "projectPath": ".",
  "outputDir": "./persrm-output",
  "verbose": false,
  "takeScreenshots": false,
  "designSystemPath": "./design-system",
  "ciMode": false,
  "prNumber": null,
  "branch": null,
  "autoOptimize": false,
  "watchPath": "./src/components"
}
```

## License

MIT 