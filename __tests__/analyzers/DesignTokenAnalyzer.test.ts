import { DesignTokenAnalyzer } from '../../src/analyzers/design-token-analyzer';
import fs from 'fs-extra';
import path from 'path';

// Mock fs-extra
jest.mock('fs-extra', () => ({
  readFile: jest.fn(),
  readJSONSync: jest.fn(),
  existsSync: jest.fn().mockReturnValue(true),
  ensureDirSync: jest.fn()
}));

// Mock glob
jest.mock('glob', () => ({
  sync: jest.fn()
}));

describe('DesignTokenAnalyzer', () => {
  let analyzer: DesignTokenAnalyzer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock design system JSON
    (fs.readJSONSync as jest.Mock).mockImplementation((filePath) => {
      if (filePath.includes('design-system.json')) {
        return {
          colors: {
            primary: '#0066cc',
            secondary: '#6c757d',
            success: '#28a745',
            danger: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
          },
          spacing: {
            xs: '4px',
            sm: '8px',
            md: '16px',
            lg: '24px',
            xl: '32px'
          },
          typography: {
            fontFamily: '"Segoe UI", "Roboto", sans-serif',
            fontSize: {
              small: '12px',
              medium: '16px',
              large: '20px'
            }
          },
          shadows: {
            small: '0 1px 2px rgba(0, 0, 0, 0.1)',
            medium: '0 2px 4px rgba(0, 0, 0, 0.1)',
            large: '0 4px 8px rgba(0, 0, 0, 0.1)'
          }
        };
      }
      return {};
    });
    
    // Create analyzer instance
    analyzer = new DesignTokenAnalyzer({
      verbose: false,
      designSystemPath: './design-system.json'
    });
  });
  
  test('constructor initializes with default config when none provided', () => {
    const defaultAnalyzer = new DesignTokenAnalyzer();
    expect(defaultAnalyzer).toBeDefined();
    expect(fs.readJSONSync).toHaveBeenCalled();
  });
  
  test('extractTokensFromComponent extracts tokens from a component file', async () => {
    // Mock the file content for a React component with inline styles
    (fs.readFile as jest.Mock).mockResolvedValue(`
      import React from 'react';
      import { colors } from './design-tokens';
      
      export const Button = ({ label, variant = 'primary' }) => {
        return (
          <button 
            style={{
              backgroundColor: colors.primary,
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        );
      };
    `);
    
    const result = await analyzer.extractTokensFromComponent('src/components/Button.tsx');
    
    expect(result).toBeDefined();
    expect(result.componentName).toBe('Button');
    expect(result.tokensFound.length).toBeGreaterThan(0);
    expect(result.score).toBeDefined();
  });
  
  test('validateTokens identifies inconsistent colors', async () => {
    // Mock a component using a similar but not exact color
    (fs.readFile as jest.Mock).mockResolvedValue(`
      import React from 'react';
      
      export const Card = () => {
        return (
          <div style={{
            backgroundColor: '#0067cd', // Similar to #0066cc but not exact
            color: 'white',
            padding: '16px',
            borderRadius: '4px'
          }}>
            <h2>Card Title</h2>
            <p>Card content</p>
          </div>
        );
      };
    `);
    
    const result = await analyzer.extractTokensFromComponent('src/components/Card.tsx');
    
    // Should find similar color issue
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some(issue => issue.type === 'inconsistent')).toBe(true);
  });
  
  test('extractTokensFromCss extracts tokens from CSS files', async () => {
    // Mock CSS file related to the component
    const mockCssContent = `
      .button {
        background-color: #0066cc;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
      }
      
      .button:hover {
        background-color: #0055aa;
      }
    `;
    
    // Mock related CSS file exists
    const glob = require('glob');
    (glob.sync as jest.Mock).mockReturnValue(['src/components/Button.css']);
    (fs.readFile as jest.Mock).mockImplementation((filePath) => {
      if (filePath.includes('Button.css')) {
        return Promise.resolve(mockCssContent);
      }
      return Promise.resolve('');
    });
    
    const result = await analyzer.extractTokensFromComponent('src/components/Button.tsx');
    
    expect(result.tokensFound.some(token => 
      token.type === 'color' && token.value.includes('#0066cc')
    )).toBe(true);
  });
  
  test('analyzeDirectory processes all components', async () => {
    // Mock component files discovery
    const glob = require('glob');
    (glob.sync as jest.Mock).mockReturnValue([
      'src/components/Button.tsx',
      'src/components/Card.tsx',
      'src/components/Input.tsx'
    ]);
    
    // Mock file content for components
    (fs.readFile as jest.Mock).mockResolvedValue(`
      import React from 'react';
      
      export default function Component() {
        return <div style={{ color: '#0066cc' }}>Test</div>;
      }
    `);
    
    const results = await analyzer.analyzeDirectory('src/components');
    
    expect(results.length).toBe(3);
    expect(results[0].componentName).toBeDefined();
    expect(results[0].tokensFound.length).toBeGreaterThan(0);
  });
  
  test('generateTokenReport creates a summary of token usage', async () => {
    // Mock some token extraction results
    const mockExtractedTokens = new Map<string, Set<string>>();
    mockExtractedTokens.set('Button', new Set(['color.primary', 'spacing.md']));
    mockExtractedTokens.set('Card', new Set(['color.primary', 'color.secondary', 'spacing.lg']));
    
    // Set private field directly using type assertion
    (analyzer as any).extractedTokens = mockExtractedTokens;
    
    const report = analyzer.generateTokenReport();
    
    expect(report.tokenCount).toBeGreaterThan(0);
    expect(report.components.length).toBe(2);
    expect(report.components[0].name).toBe('Button');
    expect(report.components[1].name).toBe('Card');
  });
}); 