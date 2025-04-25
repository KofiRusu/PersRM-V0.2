# UI/UX Reasoning Model System

The UI/UX Reasoning Model System is an AI-powered assistant that helps developers generate expert reasoning, UI components, and complete routes based on natural language prompts. This system leverages AI models to provide in-depth analysis of UI/UX design questions and automatically generate corresponding code.

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Using the Cursor Commands](#using-the-cursor-commands)
- [Writing Effective Prompts](#writing-effective-prompts)
- [Supported Layouts and Components](#supported-layouts-and-components)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [Troubleshooting](#troubleshooting)

## Features

- **AI-powered UI/UX reasoning**: Get expert analysis on design decisions and implementation approaches
- **Component generation**: Generate ready-to-use React components based on reasoning
- **Complete route generation**: Create full page routes with API endpoints and layouts
- **Multiple model support**: Use OpenAI, DeepSeek, or local models
- **Integrated experience**: Everything works directly within your editor

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- Cursor editor
- OpenAI API key or local model setup

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/perslm.git
   cd perslm
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables by creating a `.env` file:
   ```
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-4o
   NEXT_PUBLIC_OLLAMA_BASE_URL=http://localhost:11434
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

## Using the Cursor Commands

The system provides several Cursor commands for different use cases:

### 1. Generate UI Component with Reasoning

```
Command: generate-reasoning-ui
```

This command:
1. Prompts you for a UI component description
2. Generates expert reasoning on the design and implementation
3. Produces a ready-to-use React component based on the reasoning
4. Inserts both the reasoning and code at your cursor position

**Example prompt:** "Create a user profile form with photo upload"

### 2. Generate Complete Route with Reasoning

```
Command: generate-reasoning-route
```

This command:
1. Prompts you for a route description
2. Generates expert reasoning about the route's design and implementation
3. Creates multiple files including:
   - Page component (`page.tsx`)
   - API route if needed (`api/[route-name]/route.ts`)
   - Layout component if needed (`layout.tsx`)
4. Inserts a summary of the generated files at your cursor position

**Example prompt:** "Create a feedback form page with validation and API endpoint"

### 3. Generate UI Reasoning Only

```
Command: generate-ui-reasoning-only
```

This command:
1. Prompts you for a UI/UX question
2. Generates detailed reasoning and best practices
3. Inserts the reasoning as a comment at your cursor position

**Example prompt:** "When should I use a modal dialog vs. a slide-over panel?"

## Writing Effective Prompts

For best results, follow these guidelines when writing prompts:

### For UI Components:

- **Be specific about the component type**: "Create a dropdown menu" vs "Create a multi-select dropdown with search"
- **Describe key functionality**: "Create a form with email validation and submission feedback"
- **Mention technology preferences**: "Create a form using React Hook Form and Zod"

### For Route Generation:

- **Specify page type**: "Create a dashboard page", "Create a settings form page"
- **Mention API requirements**: "Create a product listing page with filter API endpoints"
- **Include data requirements**: "Create a user profile page that fetches user data from API"

### For Reasoning Questions:

- **Frame as specific design decisions**: "When should I use tabs vs accordion for content sections?"
- **Provide context**: "What's the best way to implement form validation for a multi-step checkout?"
- **Ask about trade-offs**: "What are the pros and cons of infinite scroll vs pagination?"

## Supported Layouts and Components

The system can generate a wide range of layouts and components:

### Page Layouts:
- Dashboard layouts
- Form pages
- Content display pages
- Detail pages
- List views

### UI Components:
- Forms (with various field types)
- Navigation components
- Modal dialogs
- Cards and containers
- Data tables
- Charts and data visualization
- Feedback components (alerts, toasts)

All generated components use:
- TypeScript
- React/Next.js
- TailwindCSS
- shadcn/ui components

## How It Works

The system follows a pipeline approach:

1. **Reasoning Generation**:
   - Takes your natural language prompt
   - Uses AI models to generate comprehensive reasoning
   - Structures the response into sections (Analysis, Approaches, Best Practices, etc.)

2. **Code Generation**:
   - For components: Transforms reasoning into React component code
   - For routes: Extracts structured data from reasoning
   - Generates appropriate files based on the extracted structure

3. **File Creation**:
   - Creates necessary directories if they don't exist
   - Writes generated code to appropriate files
   - Returns file paths and results

## Contributing

We welcome contributions to improve the UI/UX Reasoning Model system! Here's how you can help:

### Adding New Reasoning Examples

The system uses examples for few-shot learning. You can contribute by adding high-quality examples to `data/reasoning-examples.json`:

1. Identify common UI/UX questions that aren't well covered
2. Create a detailed reasoning response following the structured format
3. Submit a pull request with your new examples

### Improving Code Generation

To improve code generation quality:

1. Identify component types or patterns that need improvement
2. Create examples with both reasoning and ideal implementation
3. Submit improvements to the generation prompts

## Troubleshooting

### Common Issues:

**API Key Issues:**
- Ensure your OpenAI API key is set correctly in the `.env` file
- Check that your API key has sufficient quota

**Model Errors:**
- If using a local model, check that it's running at the expected URL
- Verify the model supports the required capabilities

**Generation Failures:**
- Unclear prompts may lead to low-quality results - be more specific
- Very complex components might need to be broken down into smaller parts

### Getting Help:

If you encounter issues:
1. Check the console logs for error messages
2. Consult the [GitHub issues](https://github.com/yourusername/perslm/issues)
3. Open a new issue with detailed steps to reproduce the problem 