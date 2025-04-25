import { 
  AnimationPerformanceTracker,
  AnimationConfig
} from '../../src/analyzers/animation-performance-tracker';
import { SeverityLevel } from '../../src/lib/persrm/types';

describe('AnimationPerformanceTracker', () => {
  let tracker: AnimationPerformanceTracker;
  
  beforeEach(() => {
    tracker = new AnimationPerformanceTracker({
      targetFrameRate: 60,
      slowFrameThreshold: 16.7,
      recordFrames: true,
      verbose: false,
      headless: true
    });
  });
  
  test('constructor initializes with default config when none provided', () => {
    const defaultTracker = new AnimationPerformanceTracker();
    expect(defaultTracker).toBeDefined();
  });
  
  test('registerComponent stores animation configurations', () => {
    // Define test animations
    const animations: AnimationConfig[] = [
      { name: 'hover', selector: '.button', type: 'hover', duration: 300 },
      { name: 'click', selector: '.button', type: 'click', duration: 200 }
    ];
    
    // Register the animations
    tracker.registerComponent('Button', animations);
    
    // Test by triggering tracking
    return tracker.trackFrameRate('Button', 'hover').then(frameData => {
      expect(frameData).toBeDefined();
      expect(frameData.averageFps).toBeGreaterThan(0);
      expect(frameData.timestamps.length).toBeGreaterThan(0);
    });
  });
  
  test('trackFrameRate generates valid frame data with correct duration', async () => {
    // Register a component with a specific duration
    const animations: AnimationConfig[] = [
      { name: 'slide', selector: '.carousel', type: 'custom', duration: 500 }
    ];
    
    tracker.registerComponent('Carousel', animations);
    
    // Track the animation
    const frameData = await tracker.trackFrameRate('Carousel', 'slide');
    
    // Validate the frame data
    expect(frameData).toBeDefined();
    expect(frameData.duration).toBeCloseTo(500, -2); // Close to 500ms within 100ms
    expect(frameData.timestamps.length).toBeGreaterThan(0);
    expect(frameData.frameDeltas.length).toBeGreaterThan(0);
    expect(frameData.averageFps).toBeGreaterThan(0);
    expect(frameData.minFps).toBeGreaterThan(0);
    expect(frameData.maxFps).toBeGreaterThan(0);
    expect(frameData.maxFps).toBeGreaterThanOrEqual(frameData.averageFps);
    expect(frameData.minFps).toBeLessThanOrEqual(frameData.averageFps);
  });
  
  test('analyzeComponent detects performance issues for slow animations', async () => {
    // Create a mock setup that will generate low frame rates
    const originalSimulateFrameData = tracker['simulateFrameData'];
    
    // Replace with a function that simulates poor performance
    tracker['simulateFrameData'] = jest.fn().mockImplementation(() => {
      return {
        averageFps: 30, // Half the target rate
        minFps: 15,
        maxFps: 45,
        dropCount: 10,
        duration: 500,
        timestamps: Array.from({ length: 30 }, (_, i) => Date.now() + i * 33.3), // 30fps
        frameDeltas: Array.from({ length: 29 }, () => 33.3) // 30fps
      };
    });
    
    // Register a component
    const animations: AnimationConfig[] = [
      { name: 'open', selector: '.modal', type: 'custom', duration: 300 }
    ];
    
    tracker.registerComponent('Modal', animations);
    
    // Analyze the component
    const result = await tracker.analyzeComponent('Modal');
    
    // Restore original function
    tracker['simulateFrameData'] = originalSimulateFrameData;
    
    // Validate the analysis results
    expect(result).toBeDefined();
    expect(result.componentId).toBe('Modal');
    expect(result.animations.length).toBe(1);
    expect(result.animations[0].name).toBe('open');
    
    // Should detect performance issues
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some(issue => 
      issue.description.includes('Low average frame rate')
    )).toBe(true);
    
    // Score should be reduced due to performance issues
    expect(result.score).toBeLessThan(90);
  });
  
  test('analyzeComponent runs a generic test when no animations are registered', async () => {
    // No animations registered for this component
    const result = await tracker.analyzeComponent('UnregisteredComponent');
    
    expect(result).toBeDefined();
    expect(result.componentId).toBe('UnregisteredComponent');
    expect(result.animations.length).toBe(1);
    expect(result.animations[0].name).toBe('general');
  });
  
  test('analyzeDirectory processes multiple components', async () => {
    // This test mocks the directory analysis
    
    // Spy on analyzeComponent method
    const analyzeSpy = jest.spyOn(tracker, 'analyzeComponent');
    
    // Register some test animations for the components that will be "found"
    tracker.registerComponent('Button', [
      { name: 'hover', selector: '.button', type: 'hover', duration: 300 }
    ]);
    
    tracker.registerComponent('Dropdown', [
      { name: 'open', selector: '.dropdown', type: 'click', duration: 300 }
    ]);
    
    // Analyze the directory
    const results = await tracker.analyzeDirectory('./src/components');
    
    // Should have analyzed multiple components
    expect(results.length).toBeGreaterThan(0);
    
    // The actual analyzeComponent method should have been called multiple times
    expect(analyzeSpy).toHaveBeenCalledTimes(5); // Based on componentIds in analyzeDirectory
    
    // We should have animation results for each component
    results.forEach(result => {
      expect(result.componentId).toBeDefined();
      expect(result.animations.length).toBeGreaterThan(0);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });
  });
  
  test('parseFrameData correctly processes browser frame data', () => {
    // Create mock frame data that would come from the browser
    const mockBrowserData = JSON.stringify({
      timestamps: [
        1000,
        1016,
        1033,
        1050,
        1066,
        1083,
        1100
      ]
    });
    
    // Parse the data
    const frameData = tracker['parseFrameData'](mockBrowserData);
    
    // Validate parsed data
    expect(frameData).toBeDefined();
    expect(frameData.timestamps.length).toBe(7);
    expect(frameData.frameDeltas.length).toBe(6); // One less than timestamps
    expect(frameData.averageFps).toBeCloseTo(60, 0); // Roughly 60fps
    expect(frameData.duration).toBe(100); // 1100 - 1000
    
    // Test with invalid data
    const invalidData = '{"notTimestamps": []}';
    const defaultFrameData = tracker['parseFrameData'](invalidData);
    
    expect(defaultFrameData.averageFps).toBe(0); // Should provide default values
  });
  
  test('getFrameTrackingScript generates valid JavaScript', () => {
    const script = tracker['getFrameTrackingScript'](500);
    
    // Should be valid JavaScript that can be executed
    expect(typeof script).toBe('string');
    expect(script).toContain('requestAnimationFrame');
    expect(script).toContain('performance.now()');
    expect(script).toContain('timestamps.push');
    expect(script).toContain('500'); // Duration should be included
  });
  
  test('detectPerformanceIssues identifies various performance problems', () => {
    // Create frame data with various issues
    const frameData = {
      averageFps: 30, // Low average FPS
      minFps: 10, // Very low minimum FPS
      maxFps: 60,
      dropCount: 10, // Many dropped frames
      duration: 1000,
      timestamps: [],
      frameDeltas: Array(30).fill(33.3) // 30 frame deltas
    };
    
    // Detect issues
    const issues = tracker['detectPerformanceIssues']('TestComponent', 'animation', frameData);
    
    // Should detect multiple issues
    expect(issues.length).toBeGreaterThan(1);
    
    // Should identify low average FPS
    expect(issues.some(issue => 
      issue.description.includes('Low average frame rate')
    )).toBe(true);
    
    // Should identify frame drops
    expect(issues.some(issue => 
      issue.description.includes('frame drops detected')
    )).toBe(true);
    
    // Should identify severe frame rate drops
    expect(issues.some(issue => 
      issue.description.includes('Severe frame rate drops')
    )).toBe(true);
    
    // Should have appropriate severity levels
    expect(issues.some(issue => issue.severity === SeverityLevel.ERROR)).toBe(true);
  });
  
  test('calculatePerformanceScore penalizes performance issues appropriately', () => {
    // Create some animations with different performance characteristics
    const goodPerformance = {
      name: 'good',
      data: {
        averageFps: 58,
        minFps: 45,
        maxFps: 60,
        dropCount: 2,
        duration: 1000,
        timestamps: [],
        frameDeltas: []
      }
    };
    
    const poorPerformance = {
      name: 'poor',
      data: {
        averageFps: 25,
        minFps: 10,
        maxFps: 40,
        dropCount: 15,
        duration: 1000,
        timestamps: [],
        frameDeltas: []
      }
    };
    
    // Create some issues
    const noIssues = [];
    const severalIssues = [
      {
        id: '1',
        component: 'test',
        animation: 'test',
        description: 'Test issue 1',
        severity: SeverityLevel.WARNING,
        impact: 'Medium',
        suggestion: 'Fix it'
      },
      {
        id: '2',
        component: 'test',
        animation: 'test',
        description: 'Test issue 2',
        severity: SeverityLevel.ERROR,
        impact: 'High',
        suggestion: 'Fix it now'
      }
    ];
    
    // Calculate scores for different scenarios
    const goodScore = tracker['calculatePerformanceScore']([goodPerformance], noIssues);
    const goodWithIssuesScore = tracker['calculatePerformanceScore']([goodPerformance], severalIssues);
    const poorScore = tracker['calculatePerformanceScore']([poorPerformance], noIssues);
    const poorWithIssuesScore = tracker['calculatePerformanceScore']([poorPerformance], severalIssues);
    
    // Good performance should score high
    expect(goodScore).toBeGreaterThan(80);
    
    // Issues should reduce the score
    expect(goodWithIssuesScore).toBeLessThan(goodScore);
    
    // Poor performance should score lower
    expect(poorScore).toBeLessThan(goodScore);
    
    // Poor performance with issues should score lowest
    expect(poorWithIssuesScore).toBeLessThan(poorScore);
    expect(poorWithIssuesScore).toBeLessThan(goodWithIssuesScore);
  });
}); 