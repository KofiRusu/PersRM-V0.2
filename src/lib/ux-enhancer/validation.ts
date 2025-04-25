import { 
  PhaseType, 
  SeverityLevel, 
  ValidationResult,
  EnhancementSummary as UXEnhancementSummary,
  PhaseScore,
  UXIssue
} from './types';

// Re-export ValidationResult from types
export { ValidationResult };

// Interface definitions
export interface EnhancementSummary extends UXEnhancementSummary {}

/**
 * Validates an enhancement summary to ensure it contains all required properties
 * and that the data is in the expected format.
 */
export function validateEnhancementSummary(summary: EnhancementSummary): ValidationResult {
  const errors: string[] = [];
  const missingPhases: string[] = [];
  const invalidPhases: string[] = [];

  // Check if summary is defined
  if (!summary) {
    return {
      valid: false,
      errors: ['Enhancement summary is undefined or null']
    };
  }

  // Check required top-level properties
  const requiredProps = ['id', 'appName', 'version', 'timestamp', 'duration', 'overallScore', 'maxScore', 'phases', 'issues'];
  for (const prop of requiredProps) {
    if (!(prop in summary)) {
      errors.push(`Missing required property: ${prop}`);
    }
  }

  // Validate numeric values
  if (typeof summary.overallScore !== 'number') {
    errors.push('overallScore must be a number');
  }

  if (typeof summary.maxScore !== 'number') {
    errors.push('maxScore must be a number');
  }

  if (typeof summary.duration !== 'number') {
    errors.push('duration must be a number');
  }

  // Validate timestamp
  if (typeof summary.timestamp !== 'number') {
    errors.push('timestamp must be a number');
  }

  // Validate phases
  if (summary.phases) {
    // Check that all required phases are present
    for (const phase of Object.values(PhaseType)) {
      if (!summary.phases[phase]) {
        missingPhases.push(phase);
      } else {
        const validationResult = validatePhase(summary.phases[phase]);
        if (!validationResult.valid) {
          invalidPhases.push(phase);
          errors.push(`Invalid phase ${phase}: ${validationResult.errors?.join(', ')}`);
        }
      }
    }
  }

  // Validate issues
  if (summary.issues) {
    if (!Array.isArray(summary.issues)) {
      errors.push('issues must be an array');
    } else {
      summary.issues.forEach((issue, index) => {
        const validationResult = validateIssue(issue);
        if (!validationResult.valid) {
          errors.push(`Invalid issue at index ${index}: ${validationResult.errors?.join(', ')}`);
        }
      });
    }
  }

  return {
    valid: errors.length === 0 && missingPhases.length === 0 && invalidPhases.length === 0,
    errors,
    missingPhases: missingPhases.length > 0 ? missingPhases : undefined,
    invalidPhases: invalidPhases.length > 0 ? invalidPhases : undefined
  };
}

/**
 * Validates a phase result
 */
function validatePhase(phase: PhaseScore): ValidationResult {
  const errors: string[] = [];

  // Check required properties
  const requiredProps = ['score', 'maxScore', 'issues', 'startTimestamp', 'endTimestamp'];
  for (const prop of requiredProps) {
    if (!(prop in phase)) {
      errors.push(`Missing required property: ${prop}`);
    }
  }

  // Validate numeric values
  if (typeof phase.score !== 'number') {
    errors.push('score must be a number');
  }

  if (typeof phase.maxScore !== 'number') {
    errors.push('maxScore must be a number');
  }

  // Validate timestamps
  if (typeof phase.startTimestamp !== 'number') {
    errors.push('startTimestamp must be a number');
  }

  if (typeof phase.endTimestamp !== 'number') {
    errors.push('endTimestamp must be a number');
  }

  // Validate issues
  if (!Array.isArray(phase.issues)) {
    errors.push('issues must be an array');
  } else {
    // Validate each issue in the phase
    phase.issues.forEach((issue, index) => {
      const validationResult = validateIssue(issue);
      if (!validationResult.valid) {
        errors.push(`Invalid issue at index ${index}: ${validationResult.errors?.join(', ')}`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Validates an issue
 */
function validateIssue(issue: UXIssue): ValidationResult {
  const errors: string[] = [];

  // Check required properties
  const requiredProps = ['id', 'title', 'description', 'severity', 'phase', 'timestamp'];
  for (const prop of requiredProps) {
    if (!(prop in issue)) {
      errors.push(`Missing required property: ${prop}`);
    }
  }

  // Validate severity
  if (issue.severity && !Object.values(SeverityLevel).includes(issue.severity)) {
    errors.push(`Invalid severity level: ${issue.severity}`);
  }

  // Validate phase
  if (issue.phase && !Object.values(PhaseType).includes(issue.phase)) {
    errors.push(`Invalid phase type: ${issue.phase}`);
  }

  // Validate timestamp
  if (typeof issue.timestamp !== 'number') {
    errors.push('timestamp must be a number');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
} 