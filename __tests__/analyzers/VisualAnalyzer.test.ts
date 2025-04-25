import { VisualAnalyzer } from '../../src/analyzers/visual-analyzer';
import fs from 'fs-extra';
import path from 'path';

// Mock the dependencies
jest.mock('puppeteer', () => {
  return {
    launch: jest.fn().mockImplementation(() => ({
      newPage: jest.fn().mockImplementation(() => ({
        setViewport: jest.fn(),
        goto: jest.fn(),
        $eval: jest.fn(),
        screenshot: jest.fn().mockResolvedValue(Buffer.from('mock-screenshot')),
        close: jest.fn()
      })),
      close: jest.fn()
    }))
  };
});

// Mock fs-extra
jest.mock('fs-extra', () => ({
  ensureDirSync: jest.fn(),
  writeFileSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn().mockReturnValue(Buffer.from('mock-screenshot')),
  pathExistsSync: jest.fn().mockReturnValue(true)
}));

describe('VisualAnalyzer', () => {
  let analyzer: VisualAnalyzer;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create analyzer instance with test config
    analyzer = new VisualAnalyzer({
      screenshotDir: './screenshots',
      viewport: { width: 1280, height: 800 },
      baseUrl: 'http://localhost:3000',
      components: [
        {
          name: 'Button',
          selector: '.button',
          states: ['default', 'hover', 'active', 'disabled']
        }
      ]
    });
  });
  
  test('constructor initializes with default config when none provided', () => {
    const defaultAnalyzer = new VisualAnalyzer();
    expect(defaultAnalyzer).toBeDefined();
    // Default config would be checked here
  });
  
  test('analyze captures screenshots for a component', async () => {
    const result = await analyzer.analyze('Button');
    
    expect(result).toBeDefined();
    expect(result.componentName).toBe('Button');
    expect(result.screenshots).toBeDefined();
    expect(result.screenshots.length).toBeGreaterThan(0);
    
    // Verify that the screenshot function was called
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
  
  test('compareWithBaseline detects visual differences', async () => {
    // Mock the baseline screenshot existence
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    
    const mockDifferences = {
      diffCount: 100,
      diffPercentage: 0.5,
      diffImagePath: 'mock-diff-path'
    };
    
    // Mock the compare method
    analyzer.compareImages = jest.fn().mockResolvedValue(mockDifferences);
    
    const result = await analyzer.compareWithBaseline('Button');
    
    expect(result).toBeDefined();
    expect(result.hasDifferences).toBe(true);
    expect(result.differences).toEqual(expect.arrayContaining([
      expect.objectContaining({
        diffCount: 100,
        diffPercentage: 0.5
      })
    ]));
  });
  
  test('analyzeColorConsistency identifies color issues', async () => {
    // Mock screenshot data for color analysis
    const mockColors = [
      { hex: '#FF0000', count: 150 }, // Red
      { hex: '#FF0100', count: 140 }, // Very similar to red
      { hex: '#0000FF', count: 100 }, // Blue
      { hex: '#00FF00', count: 50 }   // Green
    ];
    
    // Mock the color extraction method
    analyzer.extractColors = jest.fn().mockResolvedValue(mockColors);
    
    const result = await analyzer.analyzeColorConsistency('Button');
    
    expect(result).toBeDefined();
    expect(result.colorGroups.length).toBeGreaterThan(0);
    expect(result.inconsistencies.length).toBeGreaterThan(0);
    expect(result.inconsistencies[0]).toEqual(expect.objectContaining({
      type: 'similar-colors',
      colors: expect.arrayContaining(['#FF0000', '#FF0100'])
    }));
  });
  
  test('checkAccessibility validates contrast ratios', async () => {
    // Mock the accessibility checker
    analyzer.checkContrastRatio = jest.fn().mockResolvedValue({
      passes: false,
      ratio: 2.5, // Below WCAG AA requirement of 4.5:1
      requiredRatio: 4.5,
      foregroundColor: '#999999',
      backgroundColor: '#AAAAAA',
      element: '.button-text'
    });
    
    const result = await analyzer.checkAccessibility('Button');
    
    expect(result).toBeDefined();
    expect(result.contrastIssues.length).toBeGreaterThan(0);
    expect(result.contrastIssues[0]).toEqual(expect.objectContaining({
      ratio: 2.5,
      requiredRatio: 4.5
    }));
  });
  
  test('generateReport creates a visual analysis report', async () => {
    // Mock all the analysis methods
    analyzer.analyze = jest.fn().mockResolvedValue({
      componentName: 'Button',
      screenshots: ['path/to/screenshot.png'],
      duration: 150
    });
    
    analyzer.compareWithBaseline = jest.fn().mockResolvedValue({
      hasDifferences: true,
      differences: [
        {
          state: 'default',
          diffCount: 100,
          diffPercentage: 0.5,
          diffImagePath: 'path/to/diff.png'
        }
      ]
    });
    
    analyzer.analyzeColorConsistency = jest.fn().mockResolvedValue({
      colorGroups: [{ name: 'reds', colors: ['#FF0000', '#FF0100'] }],
      inconsistencies: [
        {
          type: 'similar-colors',
          colors: ['#FF0000', '#FF0100'],
          recommendation: 'Standardize red color usage'
        }
      ]
    });
    
    analyzer.checkAccessibility = jest.fn().mockResolvedValue({
      contrastIssues: [
        {
          element: '.button-text',
          ratio: 2.5,
          requiredRatio: 4.5,
          foregroundColor: '#999999',
          backgroundColor: '#AAAAAA'
        }
      ]
    });
    
    const report = await analyzer.generateReport('Button');
    
    expect(report).toBeDefined();
    expect(report.componentName).toBe('Button');
    expect(report.visualIssues.length).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100); // Should have a lower score due to issues
    expect(report.recommendations.length).toBeGreaterThan(0);
  });
}); 