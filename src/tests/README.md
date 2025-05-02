# Task Monitor Tests

This directory contains tests for the Task Monitor component system.

## Testing Strategy

1. **Unit Tests**: `taskMonitor.test.tsx`
   - Tests individual functions
   - Verifies the TaskMonitorContext works correctly
   - Uses React Testing Library patterns

2. **Manual UUID Validation**: `validateUuid.ts`
   - Simple script to verify UUID generation works correctly
   - Checks that IDs are unique
   - Ensures proper timestamp-based format

## Running Tests

To run the full test suite (requires @testing-library setup):
```bash
npm test
```

To validate UUID generation (doesn't require additional dependencies):
```bash
npm run test:uuid
```

## UUID Generation

The system uses a combined approach for generating unique IDs:

1. **Recommended**: Use the `uuid` library's v4 function (cryptographically secure random UUIDs)
   ```typescript
   import { v4 as uuidv4 } from 'uuid'
   const id = uuidv4()
   ```

2. **Fallback**: A timestamp-random string combination for development without the UUID package
   ```typescript
   const generateId = () => {
     const timestamp = Date.now().toString(36)
     const randomStr = Math.random().toString(36).substring(2, 8)
     return `${timestamp}-${randomStr}`
   }
   ```

The TaskMonitorContext is configured to use whichever option is available, with a preference for the standard UUID library.

## Testing Coverage

Current tests cover:
- Task creation
- Task status updates
- UUID uniqueness

Additional test coverage may be needed for:
- Task filtering
- Task deletion
- Error handling
- Persistence 