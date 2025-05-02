// Simple ID generator function as a replacement for uuid
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

import {
  AgentMode,
  ComponentType,
  PhaseType,
  SeverityLevel,
  UXIssue,
  PhaseScore,
  UXEnhancementSummary
} from './types';

// Common component issues by type
const commonIssues: Record<PhaseType, string[]> = {
  [PhaseType.LOAD_TIME]: [
    'Excessive re-renders detected',
    'Large bundle size impacting load time',
    'Missing memoization on expensive calculations',
    'Inefficient data fetching strategy',
  ],
  [PhaseType.RESPONSIVENESS]: [
    'Blocking UI thread with heavy operations',
    'Slow event handler response time',
    'Missing debounce on input events',
    'Animation jank detected',
  ],
  [PhaseType.ACCESSIBILITY]: [
    'Missing aria-label on interactive element',
    'Insufficient color contrast ratio',
    'Keyboard navigation issues',
    'No focus management for modal dialogs',
  ],
  [PhaseType.VISUAL_CONSISTENCY]: [
    'Inconsistent spacing with design system',
    'Color usage outside of design tokens',
    'Typography doesn\'t match design system',
    'Component layout not responding correctly to themes',
  ],
  [PhaseType.ANIMATIONS]: [
    'Animation duration too long',
    'Missing animation for state changes',
    'Choppy transitions detected',
    'Excessive motion may cause accessibility issues',
  ],
  [PhaseType.DESIGN_TOKENS]: [
    'Direct color values instead of tokens',
    'Hardcoded spacing values',
    'Non-standard font sizes',
    'Inconsistent border radius values',
  ],
  [PhaseType.COGNITIVE_LOAD]: [
    'High information density',
    'Complex interaction pattern',
    'Cognitive overload due to too many options',
    'Poor mental model match',
  ]
};

/**
 * Generate a random UX issue for a component
 * This follows the UXIssue interface from persrm/types.ts,
 * which is different from the one in ux-enhancer/types.ts
 */
function generateRandomIssue(componentName: string, phase: PhaseType): UXIssue {
  const issues = commonIssues[phase];
  const description = issues[Math.floor(Math.random() * issues.length)];
  
  // Generate random line numbers
  const lineStart = Math.floor(Math.random() * 100) + 1;
  const lineEnd = lineStart + Math.floor(Math.random() * 10) + 1;
  
  // Generate random severity
  const severities = [SeverityLevel.INFO, SeverityLevel.WARNING, SeverityLevel.ERROR];
  const severity = severities[Math.floor(Math.random() * severities.length)];
  
  // Create an issue that matches the UXIssue interface in persrm/types.ts
  return {
    id: generateId(),
    component: componentName,
    phase,
    description,
    severity,
    location: `src/components/${componentName}.tsx:${lineStart}-${lineEnd}`,
    code: `const ${componentName} = () => { /* problematic code */ }`,
    suggestedFix: `Consider using React.memo() for the ${componentName} component to prevent unnecessary re-renders.`
  };
}

/**
 * Generate a PhaseScore object with accurate types
 */
function generatePhaseScore(phase: PhaseType): PhaseScore {
  const baseScore = Math.floor(Math.random() * 70) + 30; // Score between 30-100
  
  // Create issues for this phase
  const issueCount = Math.floor(Math.random() * 3) + (baseScore < 60 ? 3 : 1);
  const issuesArray: UXIssue[] = [];
  
  for (let i = 0; i < issueCount; i++) {
    issuesArray.push(generateRandomIssue('TestComponent', phase));
  }
  
  // Must match the PhaseScore interface from persrm/types.ts
  return {
    phase,
    score: baseScore,
    maxScore: 100,
    issues: issuesArray
  };
}

/**
 * Generates mock enhancement summary data for a component
 * @param componentName Name of the component
 * @param componentType Type of the component
 * @returns A mock UX enhancement summary
 */
export function generateMockEnhancementSummary(
  componentName: string,
  componentType: ComponentType = ComponentType.CUSTOM
): UXEnhancementSummary {
  // Generate random phases to analyze (at least 3)
  const allPhases = Object.values(PhaseType);
  const phaseCount = Math.floor(Math.random() * 3) + 3; // 3-6 phases
  const selectedPhases: PhaseType[] = [];
  
  // Always include these core phases
  selectedPhases.push(PhaseType.LOAD_TIME);
  selectedPhases.push(PhaseType.RESPONSIVENESS);
  selectedPhases.push(PhaseType.ACCESSIBILITY);
  
  // Add some random additional phases if needed
  while (selectedPhases.length < phaseCount) {
    const randomPhase = allPhases[Math.floor(Math.random() * allPhases.length)];
    if (!selectedPhases.includes(randomPhase)) {
      selectedPhases.push(randomPhase);
    }
  }
  
  // Generate phase scores
  const phases = selectedPhases.map(phase => generatePhaseScore(phase));
  
  // Generate random number of issues based on overall score
  const issueCount = Math.floor(Math.random() * 5) + 2; // 2-7 issues
  const issues: UXIssue[] = [];
  
  for (let i = 0; i < issueCount; i++) {
    const randomPhase = selectedPhases[Math.floor(Math.random() * selectedPhases.length)];
    issues.push(generateRandomIssue(componentName, randomPhase));
  }
  
  // Calculate overall score based on phase scores
  const overallScore = Math.round(
    phases.reduce((sum, phase) => sum + phase.score, 0) / phases.length
  );
  
  // Must match the UXEnhancementSummary interface from persrm/types.ts
  return {
    id: generateId(),
    appName: 'My React App',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    duration: Math.floor(Math.random() * 2000) + 500, // 500-2500ms
    overallScore,
    maxScore: 100,
    phases,
    issues
  };
}

/**
 * Generate a set of mock enhancement summaries for multiple components
 * @param count Number of mock summaries to generate
 * @returns Array of mock enhancement summaries
 */
export function generateMockEnhancementSummaries(count: number): UXEnhancementSummary[] {
  const componentNamePrefixes = ['Button', 'Card', 'Modal', 'Table', 'Form', 'Nav', 'List', 'Chart'];
  const componentNameSuffixes = ['Component', 'Container', 'View', 'Element', 'Widget'];
  const results: UXEnhancementSummary[] = [];
  
  for (let i = 0; i < count; i++) {
    const prefix = componentNamePrefixes[Math.floor(Math.random() * componentNamePrefixes.length)];
    const suffix = componentNameSuffixes[Math.floor(Math.random() * componentNameSuffixes.length)];
    const componentName = `${prefix}${suffix}`;
    
    const componentType = ComponentType.CUSTOM;
      
    results.push(generateMockEnhancementSummary(componentName, componentType));
  }
  
  return results;
} 