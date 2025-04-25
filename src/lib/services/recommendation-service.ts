// Service for generating UI component recommendations based on user needs
export type ComponentType = 'form' | 'display' | 'navigation' | 'layout' | 'feedback';

export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  complexity: number; // 1-10 scale
  description: string;
  tags: string[];
  useCases: string[];
}

export interface RecommendationRequest {
  userNeeds: string[];
  complexity?: number; // preferred complexity level
  excludeTypes?: ComponentType[];
  includeTags?: string[];
}

export interface RecommendationResult {
  components: Component[];
  reasoning: string;
  score: number;
}

// Sample component database
const componentDatabase: Component[] = [
  {
    id: 'form-1',
    name: 'MultiStepForm',
    type: 'form',
    complexity: 7,
    description: 'A multi-step form with validation and progress tracking',
    tags: ['form', 'stepper', 'validation', 'progress'],
    useCases: ['user onboarding', 'complex data collection', 'surveys']
  },
  {
    id: 'nav-1',
    name: 'SidebarNavigation',
    type: 'navigation',
    complexity: 5,
    description: 'Responsive sidebar navigation with collapsible sections',
    tags: ['navigation', 'sidebar', 'responsive'],
    useCases: ['dashboards', 'admin panels', 'content management']
  },
  {
    id: 'display-1',
    name: 'DataGrid',
    type: 'display',
    complexity: 6,
    description: 'Interactive data grid with sorting, filtering, and pagination',
    tags: ['table', 'grid', 'filter', 'sort'],
    useCases: ['data display', 'admin interfaces', 'reporting']
  },
  {
    id: 'layout-1',
    name: 'DashboardLayout',
    type: 'layout',
    complexity: 4,
    description: 'Responsive dashboard layout with card containers',
    tags: ['layout', 'dashboard', 'cards', 'responsive'],
    useCases: ['analytics dashboards', 'admin interfaces']
  },
  {
    id: 'feedback-1',
    name: 'NotificationSystem',
    type: 'feedback',
    complexity: 6,
    description: 'Toast notification system with different severity levels',
    tags: ['notification', 'toast', 'alert'],
    useCases: ['user feedback', 'error handling', 'success messages']
  }
];

/**
 * Recommends components based on user needs
 */
export function getRecommendations(request: RecommendationRequest): RecommendationResult {
  const { userNeeds, complexity, excludeTypes = [], includeTags = [] } = request;
  
  // Filter components based on user needs
  let filteredComponents = componentDatabase.filter(component => {
    // Exclude unwanted component types
    if (excludeTypes.includes(component.type)) {
      return false;
    }
    
    // Filter by complexity if specified
    if (complexity !== undefined && Math.abs(component.complexity - complexity) > 2) {
      return false;
    }
    
    // Check if component addresses any of the user needs
    const isRelevant = userNeeds.some(need => 
      component.useCases.some(useCase => useCase.toLowerCase().includes(need.toLowerCase())) ||
      component.tags.some(tag => tag.toLowerCase().includes(need.toLowerCase()))
    );
    
    // If includeTags are specified, ensure at least one tag matches
    const hasRequiredTags = includeTags.length === 0 || 
      includeTags.some(tag => component.tags.includes(tag));
    
    return isRelevant && hasRequiredTags;
  });
  
  // Calculate relevance score (simple algorithm for demonstration)
  const calculateScore = (component: Component): number => {
    let score = 0;
    
    // Score based on matching user needs
    userNeeds.forEach(need => {
      component.useCases.forEach(useCase => {
        if (useCase.toLowerCase().includes(need.toLowerCase())) {
          score += 2;
        }
      });
      
      component.tags.forEach(tag => {
        if (tag.toLowerCase().includes(need.toLowerCase())) {
          score += 1;
        }
      });
    });
    
    // Adjust for complexity match if specified
    if (complexity !== undefined) {
      score += (10 - Math.abs(component.complexity - complexity)) / 2;
    }
    
    // Bonus for having requested tags
    includeTags.forEach(tag => {
      if (component.tags.includes(tag)) {
        score += 2;
      }
    });
    
    return score;
  };
  
  // Sort components by score
  filteredComponents = filteredComponents
    .map(component => ({ 
      component, 
      score: calculateScore(component) 
    }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.component);
  
  // Generate reasoning
  const reasoning = generateReasoning(filteredComponents, request);
  
  // Calculate overall score
  const overallScore = filteredComponents.length > 0 
    ? filteredComponents.reduce((acc, component) => acc + calculateScore(component), 0) / filteredComponents.length
    : 0;
  
  return {
    components: filteredComponents,
    reasoning,
    score: Number((overallScore).toFixed(2))
  };
}

/**
 * Generates reasoning for recommendations
 */
function generateReasoning(components: Component[], request: RecommendationRequest): string {
  if (components.length === 0) {
    return "No components match your specified criteria. Consider broadening your search parameters.";
  }
  
  let reasoning = `Based on your needs (${request.userNeeds.join(', ')}), I've found ${components.length} relevant components.\n\n`;
  
  // Add specific reasoning for top components
  components.slice(0, 3).forEach(component => {
    const matchingNeeds = request.userNeeds.filter(need => 
      component.useCases.some(useCase => useCase.toLowerCase().includes(need.toLowerCase())) ||
      component.tags.some(tag => tag.toLowerCase().includes(need.toLowerCase()))
    );
    
    reasoning += `- ${component.name}: Recommended for ${matchingNeeds.join(', ')}. `;
    reasoning += `This ${component.type} component has a complexity of ${component.complexity}/10. `;
    reasoning += `It's suitable for ${component.useCases.join(', ')}.\n`;
  });
  
  return reasoning;
} 