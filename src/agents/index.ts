import createPersRMAgent, { CursorPersRMAgent } from './PersRM';
import PersRMUI from './PersRMUI';

// Re-export everything
export {
  createPersRMAgent,
  CursorPersRMAgent,
  PersRMUI
};

// Default export for direct import
export default {
  createAgent: createPersRMAgent,
  UI: PersRMUI
}; 