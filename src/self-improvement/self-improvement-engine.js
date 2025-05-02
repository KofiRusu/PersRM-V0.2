/**
 * Self-Improvement Engine for PersLM
 * Analyzes benchmark results and suggests improvements
 */

const fs = require('fs');
const path = require('path');

/**
 * Self-Improvement Engine class
 */
class SelfImprovementEngine {
  /**
   * Analyzes scoring reports to identify patterns and weaknesses
   * @param {string} reportDir - Directory containing markdown reports
   * @returns {Object} Analysis summary
   */
  async analyzeScoringReports(reportDir) {
    // Check if directory exists
    if (!fs.existsSync(reportDir)) {
      throw new Error(`Report directory not found: ${reportDir}`);
    }

    // Get all markdown files in the directory
    const files = fs.readdirSync(reportDir)
      .filter(file => file.endsWith('.md') && (file.startsWith('score-') || file.includes('-score')));

    if (files.length === 0) {
      throw new Error('No scoring reports found in the directory');
    }

    console.log(`Analyzing ${files.length} scoring reports...`);

    // Parse each report
    const reports = [];
    const componentTypes = new Set();

    for (const file of files) {
      const filePath = path.join(reportDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      try {
        const report = this.parseReport(content);
        reports.push(report);
        
        // Extract component type from name
        const componentType = this.extractComponentType(report.componentName);
        if (componentType) {
          componentTypes.add(componentType);
        }
      } catch (error) {
        console.warn(`Error parsing report ${file}: ${error}`);
      }
    }

    // Calculate averages and identify weaknesses
    const weaknesses = this.identifyWeaknesses(reports);
    const averageScores = this.calculateAverageScores(reports);
    const improvementsByCategory = this.calculateImprovementsByCategory(reports);
    const enhancementImprovements = this.calculateEnhancementImprovements(reports);

    // Get most common weakness
    const mostCommonWeakness = weaknesses.length > 0 
      ? weaknesses[0].category 
      : 'none';

    return {
      weaknesses,
      mostCommonWeakness,
      averageScores,
      totalReports: reports.length,
      componentTypes: Array.from(componentTypes),
      enhancementImprovements,
      improvementsByCategory
    };
  }

  /**
   * Parses a scoring report from markdown content
   * @param {string} content - Report content
   * @returns {Object} Structured report object
   */
  parseReport(content) {
    // Extract component name
    const titleMatch = content.match(/(?:# Scoring Report|# Component Evaluation): (.*)/);
    if (!titleMatch) {
      throw new Error('Could not extract component name from report');
    }
    
    const componentName = titleMatch[1].trim();
    
    // Extract prompt ID
    const promptIdMatch = content.match(/Prompt ID: ([a-zA-Z0-9-]+)/);
    const promptId = promptIdMatch ? promptIdMatch[1] : 'unknown';
    
    // Create the basic report
    const report = {
      promptId,
      componentName
    };
    
    // Extract baseline and enhanced scores
    const criteria = ['fidelity', 'codeQuality', 'accessibility', 'uxPolish', 'innovation'];
    
    // Special case for newer format with table
    if (content.includes('| Criteria | Baseline | Enhanced |')) {
      const tableLines = content.split('\n').filter(line => line.includes('|'));
      for (const criterion of criteria) {
        const regex = new RegExp(`${criterion}\\s*\\|\\s*(\\d+(?:\\.\\d+)?)\\s*\\|\\s*(\\d+(?:\\.\\d+)?)`, 'i');
        for (const line of tableLines) {
          const match = line.match(regex);
          if (match) {
            report.baseline = report.baseline || {};
            report.enhanced = report.enhanced || {};
            report.baseline[criterion.toLowerCase()] = parseFloat(match[1]);
            report.enhanced[criterion.toLowerCase()] = parseFloat(match[2]);
            break;
          }
        }
      }
      
      // Calculate total scores
      if (report.baseline) {
        report.baseline.totalScore = criteria.reduce((sum, c) => sum + (report.baseline[c.toLowerCase()] || 0), 0);
      }
      if (report.enhanced) {
        report.enhanced.totalScore = criteria.reduce((sum, c) => sum + (report.enhanced[c.toLowerCase()] || 0), 0);
      }
    } else {
      // Check if baseline section exists
      if (content.includes('## Baseline') || content.includes('### Scoring Criteria')) {
        report.baseline = {};
        for (const criterion of criteria) {
          report.baseline[criterion.toLowerCase()] = this.extractScore(content, criterion, 'baseline');
        }
        // Extract total score
        const totalScoreMatch = content.match(/\*\*Total Score\*\*:\s*(\d+)\s*\/\s*\d+/);
        if (totalScoreMatch) {
          report.baseline.totalScore = parseInt(totalScoreMatch[1], 10);
        } else {
          report.baseline.totalScore = Object.values(report.baseline).reduce((a, b) => a + b, 0);
        }
      }
      
      // Check if enhanced section exists
      if (content.includes('## Enhanced') || content.includes('## Enhanced Scores')) {
        report.enhanced = {};
        for (const criterion of criteria) {
          report.enhanced[criterion.toLowerCase()] = this.extractScore(content, criterion, 'enhanced');
        }
        // Extract total score
        const totalScoreMatch = content.match(/\*\*Total Score\*\*:\s*(\d+)\s*\/\s*\d+/);
        if (totalScoreMatch && totalScoreMatch.length > 1) {
          report.enhanced.totalScore = parseInt(totalScoreMatch[1], 10);
        } else {
          report.enhanced.totalScore = Object.values(report.enhanced).reduce((a, b) => a + b, 0);
        }
      }
    }
    
    // Calculate improvements if both sections exist
    if (report.baseline && report.enhanced) {
      report.improvements = {};
      for (const criterion of criteria) {
        const lowerCriterion = criterion.toLowerCase();
        if (report.baseline[lowerCriterion] !== undefined && report.enhanced[lowerCriterion] !== undefined) {
          report.improvements[lowerCriterion] = report.enhanced[lowerCriterion] - report.baseline[lowerCriterion];
        }
      }
      report.improvements.totalScore = report.enhanced.totalScore - report.baseline.totalScore;
    }
    
    return report;
  }

  /**
   * Extracts a score from the markdown content
   * @param {string} content - Report content
   * @param {string} criterion - The criterion to extract (e.g., "Fidelity")
   * @param {string} section - The section to extract from ("baseline" or "enhanced")
   * @returns {number} The extracted score
   */
  extractScore(content, criterion, section) {
    const sectionMarker = section === 'baseline' ? '## Baseline' : '## Enhanced';
    const criterionRegex = new RegExp(`${criterion}[^:]*:\\s*(\\d+(?:\\.\\d+)?)\\s*\\/\\s*\\d+`, 'i');
    
    // Find the section
    const sectionStartIndex = content.indexOf(sectionMarker);
    if (sectionStartIndex === -1) return 0;
    
    // Find the next section
    const nextSectionIndex = content.indexOf('##', sectionStartIndex + sectionMarker.length);
    const sectionContent = nextSectionIndex !== -1 
      ? content.substring(sectionStartIndex, nextSectionIndex)
      : content.substring(sectionStartIndex);
    
    // Extract the score
    const match = sectionContent.match(criterionRegex);
    return match ? parseFloat(match[1]) : 0;
  }

  /**
   * Extracts the component type from a component name
   * @param {string} componentName - Full component name
   * @returns {string|undefined} Component type
   */
  extractComponentType(componentName) {
    // Common component types
    const commonTypes = [
      'button', 'card', 'form', 'modal', 'dropdown', 'table', 
      'list', 'menu', 'nav', 'header', 'footer', 'sidebar', 
      'accordion', 'tabs', 'pagination', 'slider', 'toggle',
      'hero', 'section'
    ];
    
    const lowerName = componentName.toLowerCase();
    
    for (const type of commonTypes) {
      if (lowerName.includes(type)) {
        return type;
      }
    }
    
    return undefined;
  }

  /**
   * Identifies weaknesses based on scores
   * @param {Array} reports - List of parsed reports
   * @returns {Array} Weakness categories and counts
   */
  identifyWeaknesses(reports) {
    // Threshold for identifying weaknesses
    const WEAKNESS_THRESHOLD = 3;
    
    // Count weaknesses by category
    const weaknessCounts = {};
    const criteria = ['fidelity', 'codeQuality', 'accessibility', 'uxPolish', 'innovation'];
    
    for (const report of reports) {
      // Use enhanced scores if available, otherwise baseline
      const scores = report.enhanced || report.baseline;
      if (!scores) continue;
      
      for (const criterion of criteria) {
        if (scores[criterion] && scores[criterion] < WEAKNESS_THRESHOLD) {
          weaknessCounts[criterion] = (weaknessCounts[criterion] || 0) + 1;
        }
      }
    }
    
    // Convert to array and sort by count
    const weaknesses = Object.entries(weaknessCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    
    return weaknesses;
  }

  /**
   * Calculates average scores across all reports
   * @param {Array} reports - List of parsed reports
   * @returns {Array} Average scores by category
   */
  calculateAverageScores(reports) {
    const criteria = ['fidelity', 'codeQuality', 'accessibility', 'uxPolish', 'innovation'];
    const scores = {};
    const counts = {};
    
    // Aggregate scores
    for (const report of reports) {
      // Use enhanced scores if available, otherwise baseline
      const reportScores = report.enhanced || report.baseline;
      if (!reportScores) continue;
      
      for (const criterion of criteria) {
        if (reportScores[criterion] !== undefined) {
          scores[criterion] = (scores[criterion] || 0) + reportScores[criterion];
          counts[criterion] = (counts[criterion] || 0) + 1;
        }
      }
    }
    
    // Calculate averages
    return Object.entries(scores)
      .map(([category, total]) => ({
        category,
        score: total / (counts[category] || 1)
      }));
  }

  /**
   * Calculates improvements by category
   * @param {Array} reports - List of parsed reports
   * @returns {Array} Average improvements by category
   */
  calculateImprovementsByCategory(reports) {
    const criteria = ['fidelity', 'codeQuality', 'accessibility', 'uxPolish', 'innovation'];
    const improvements = {};
    const counts = {};
    
    // Aggregate improvements
    for (const report of reports) {
      if (!report.improvements) continue;
      
      for (const criterion of criteria) {
        if (report.improvements[criterion] !== undefined) {
          improvements[criterion] = (improvements[criterion] || 0) + report.improvements[criterion];
          counts[criterion] = (counts[criterion] || 0) + 1;
        }
      }
    }
    
    // Calculate averages
    return Object.entries(improvements)
      .map(([category, total]) => ({
        category,
        averageImprovement: total / (counts[category] || 1)
      }));
  }

  /**
   * Calculates enhancement improvements by component
   * @param {Array} reports - List of parsed reports
   * @returns {Array} Improvements by component
   */
  calculateEnhancementImprovements(reports) {
    return reports
      .filter(report => report.baseline && report.enhanced && report.improvements)
      .map(report => ({
        component: report.componentName,
        improvement: report.improvements.totalScore
      }));
  }

  /**
   * Suggests improvements to the component generation prompts
   * @param {Object} summary - Analysis summary
   * @returns {Array} Array of suggested improvements
   */
  suggestPromptImprovements(summary) {
    const suggestions = [];
    
    // Handle accessibility weaknesses
    if (summary.weaknesses.some(w => w.category === 'accessibility')) {
      suggestions.push('Explicitly require ARIA attributes for interactive elements');
      suggestions.push('Request keyboard navigation support for all interactive components');
      suggestions.push('Specify that components must be screen reader compatible');
      suggestions.push('Include color contrast requirements for text and interactive elements');
      suggestions.push('Require proper semantic HTML elements for structure');
    }
    
    // Handle UX polish weaknesses
    if (summary.weaknesses.some(w => w.category === 'uxPolish')) {
      suggestions.push('Request smooth transitions for state changes');
      suggestions.push('Specify hover and focus states for interactive elements');
      suggestions.push('Require mobile-friendly touch targets and interactions');
      suggestions.push('Include loading states and transitions for asynchronous actions');
      suggestions.push('Specify responsive design requirements with concrete breakpoints');
    }
    
    // Handle code quality weaknesses
    if (summary.weaknesses.some(w => w.category === 'codeQuality')) {
      suggestions.push('Require well-structured component organization with logical prop grouping');
      suggestions.push('Specify consistent naming conventions for props and internal variables');
      suggestions.push('Request comprehensive TypeScript type definitions for all props and states');
      suggestions.push('Include error handling requirements for edge cases');
      suggestions.push('Request performance optimization best practices');
    }
    
    // Handle fidelity weaknesses
    if (summary.weaknesses.some(w => w.category === 'fidelity')) {
      suggestions.push('Provide more specific implementation details for key features');
      suggestions.push('Include visual examples or references to guide the implementation');
      suggestions.push('Specify exact prop structures and default values');
      suggestions.push('Detail expected component behavior for different states');
      suggestions.push('Request comprehensive test coverage for functionality verification');
    }
    
    // Handle innovation weaknesses
    if (summary.weaknesses.some(w => w.category === 'innovation')) {
      suggestions.push('Encourage creative additions that enhance usability beyond requirements');
      suggestions.push('Request novel interaction patterns that improve user experience');
      suggestions.push('Suggest exploration of modern design trends in the implementation');
      suggestions.push('Ask for intelligent defaults that anticipate user needs');
      suggestions.push('Encourage context-aware behavior that adapts to usage patterns');
    }
    
    return suggestions;
  }

  /**
   * Suggests strategies for enhancing components
   * @param {Object} summary - Analysis summary
   * @returns {Array} Array of suggested strategies
   */
  suggestEnhancementStrategies(summary) {
    const strategies = [];
    
    // Handle accessibility weaknesses
    if (summary.weaknesses.some(w => w.category === 'accessibility')) {
      strategies.push('Integrate automated accessibility checks in the enhancement process');
      strategies.push('Add a comprehensive ARIA attribute application step');
      strategies.push('Implement keyboard navigation and focus management improvements');
      strategies.push('Apply contrast verification and enhancement for text elements');
      strategies.push('Convert non-semantic markup to appropriate semantic elements');
    }
    
    // Handle UX polish weaknesses
    if (summary.weaknesses.some(w => w.category === 'uxPolish')) {
      strategies.push('Apply consistent transition and animation patterns');
      strategies.push('Enhance hover and focus states with visual feedback');
      strategies.push('Implement responsive design patterns for all viewport sizes');
      strategies.push('Add loading state and skeleton screen implementations');
      strategies.push('Refine touch interactions for mobile experiences');
    }
    
    // Handle code quality weaknesses
    if (summary.weaknesses.some(w => w.category === 'codeQuality')) {
      strategies.push('Restructure component organization for better maintainability');
      strategies.push('Enhance type definitions with more specific interfaces');
      strategies.push('Apply performance optimizations like memoization and callback stabilization');
      strategies.push('Implement comprehensive error handling and fallbacks');
      strategies.push('Refactor naming conventions for consistency and clarity');
    }
    
    // Handle fidelity weaknesses
    if (summary.weaknesses.some(w => w.category === 'fidelity')) {
      strategies.push('Analyze and implement missing requirements from prompt');
      strategies.push('Verify behavior across all specified component states');
      strategies.push('Ensure all prop combinations work as expected');
      strategies.push('Add default values aligned with requirements');
      strategies.push('Implement edge case handling as specified');
    }
    
    // Handle innovation weaknesses
    if (summary.weaknesses.some(w => w.category === 'innovation')) {
      strategies.push('Add intelligent defaults based on common usage patterns');
      strategies.push('Implement progressive enhancement for modern browsers');
      strategies.push('Create novel interaction patterns that enhance usability');
      strategies.push('Add contextual behavior adaptations');
      strategies.push('Integrate subtle delight factors for better user experience');
    }
    
    return strategies;
  }

  /**
   * Applies self-improvements based on analysis (stub)
   * @returns {Promise<void>}
   */
  async applySelfImprovements() {
    console.log('This is a stub method for future implementation');
    console.log('In the future, this will automatically apply improvement suggestions');
  }
}

module.exports = { SelfImprovementEngine }; 