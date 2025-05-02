# PersRM UI

This package contains the user interface for PersRM, built with Next.js, Tailwind CSS, and other modern web technologies.

## Features

- Web interface for the PersRM reasoning model
- Session management
- Reasoning visualization
- Interactive reasoning workspace
- Responsive design

## Prerequisites

- Node.js 16.x or later
- npm 7.x or later

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

The development server will start at http://localhost:3000

## Structure

- `src/pages/` - Next.js pages
- `src/components/` - Reusable React components
- `src/hooks/` - Custom React hooks
- `src/utils/` - Utility functions
- `src/styles/` - Global styles
- `public/` - Static assets

## Integration with PersRM Core

This UI package imports and uses the `persrm-core` package for all reasoning functionality. The core functions are imported and used in the UI components, primarily through the following functions:

- `startReasoning(query, options)` - Used to submit queries to the reasoning engine
- `getRecentSessions(limit)` - Used to display recent reasoning sessions
- `saveFeedback(sessionId, feedback)` - Used to provide feedback on reasoning results

## Environment Variables

Create a `.env.local` file with the following variables:

```
NEXT_PUBLIC_API_URL=http://localhost:3100
```

## Testing

```bash
# Run tests
npm test
``` 