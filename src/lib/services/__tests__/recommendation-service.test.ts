import { describe, test, expect } from 'vitest';
import { 
  getRecommendations, 
  RecommendationRequest,
  ComponentType
} from '../recommendation-service';

describe('Recommendation Service', () => {
  test('returns recommendations based on user needs', () => {
    const request: RecommendationRequest = {
      userNeeds: ['dashboard', 'data display']
    };
    
    const result = getRecommendations(request);
    
    expect(result.components.length).toBeGreaterThan(0);
    expect(result.components.some(comp => comp.name === 'DataGrid')).toBe(true);
    expect(result.components.some(comp => comp.name === 'DashboardLayout')).toBe(true);
    expect(result.reasoning).toContain('Based on your needs');
    expect(result.score).toBeGreaterThan(0);
  });
  
  test('filters by component type exclusions', () => {
    const request: RecommendationRequest = {
      userNeeds: ['dashboard', 'data display'],
      excludeTypes: ['display' as ComponentType]
    };
    
    const result = getRecommendations(request);
    
    // Should not include display components like DataGrid
    expect(result.components.some(comp => comp.type === 'display')).toBe(false);
    // But should still include layout components
    expect(result.components.some(comp => comp.name === 'DashboardLayout')).toBe(true);
  });
  
  test('filters by complexity', () => {
    const request: RecommendationRequest = {
      userNeeds: ['dashboard', 'data display'],
      complexity: 3 // Looking for simple components
    };
    
    const result = getRecommendations(request);
    
    // Complex components should be filtered out or ranked lower
    result.components.forEach(component => {
      // Components should be within 2 complexity points of requested level
      expect(Math.abs(component.complexity - 3)).toBeLessThanOrEqual(2);
    });
  });
  
  test('returns empty results for non-matching criteria', () => {
    const request: RecommendationRequest = {
      userNeeds: ['non-existent feature'],
      excludeTypes: ['form', 'display', 'navigation', 'layout', 'feedback']
    };
    
    const result = getRecommendations(request);
    
    expect(result.components.length).toBe(0);
    expect(result.reasoning).toContain('No components match');
    expect(result.score).toBe(0);
  });
  
  test('filters by included tags', () => {
    const request: RecommendationRequest = {
      userNeeds: ['user interface'],
      includeTags: ['notification', 'toast']
    };
    
    const result = getRecommendations(request);
    
    expect(result.components.length).toBeGreaterThan(0);
    expect(result.components[0].name).toBe('NotificationSystem');
    
    // All returned components should have at least one of the included tags
    result.components.forEach(component => {
      const hasMatchingTag = component.tags.some(tag => 
        request.includeTags!.includes(tag)
      );
      expect(hasMatchingTag).toBe(true);
    });
  });
}); 