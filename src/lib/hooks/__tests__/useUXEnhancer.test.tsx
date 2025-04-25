import { renderHook, act } from '@testing-library/react-hooks';
import { useUXEnhancer, UXEnhancerEngine } from '../useUXEnhancer';

// Mock UX Enhancer Engine for testing
class MockEngine implements UXEnhancerEngine {
  private _isAnalyzing: boolean = false;
  private _progressCallbacks: ((progress: number) => void)[] = [];
  private _completeCallbacks: ((summary: any) => void)[] = [];
  private _errorCallbacks: ((error: Error) => void)[] = [];
  
  // Control test behavior
  mockAnalysisSuccess: boolean = true;
  mockProgress: number[] = [25, 50, 75, 100];
  mockResult: any = {
    overallScore: 85,
    maxScore: 100,
    timestamp: new Date().toISOString(),
    duration: 1500,
    totalIssues: 5,
    phases: {
      phase1: {
        name: 'Phase 1',
        score: 40,
        maxScore: 50,
        description: 'Test phase',
        duration: 500,
        issues: []
      },
      phase2: {
        name: 'Phase 2',
        score: 45,
        maxScore: 50,
        description: 'Test phase 2',
        duration: 1000,
        issues: []
      }
    }
  };
  mockError: Error = new Error('Test error');

  async analyze(options?: any): Promise<void> {
    this._isAnalyzing = true;
    
    // Simulate async behavior
    setTimeout(() => {
      if (this.mockAnalysisSuccess) {
        // Simulate progress updates
        this.mockProgress.forEach((progress, index) => {
          setTimeout(() => {
            this._progressCallbacks.forEach(cb => cb(progress));
            
            // When progress is complete, send result
            if (progress === 100) {
              this._isAnalyzing = false;
              this._completeCallbacks.forEach(cb => cb(this.mockResult));
            }
          }, index * 50);
        });
      } else {
        // Simulate error
        setTimeout(() => {
          this._isAnalyzing = false;
          this._errorCallbacks.forEach(cb => cb(this.mockError));
        }, 100);
      }
    }, 0);
  }

  onProgress(callback: (progress: number) => void): () => void {
    this._progressCallbacks.push(callback);
    return () => {
      this._progressCallbacks = this._progressCallbacks.filter(cb => cb !== callback);
    };
  }

  onComplete(callback: (summary: any) => void): () => void {
    this._completeCallbacks.push(callback);
    return () => {
      this._completeCallbacks = this._completeCallbacks.filter(cb => cb !== callback);
    };
  }

  onError(callback: (error: Error) => void): () => void {
    this._errorCallbacks.push(callback);
    return () => {
      this._errorCallbacks = this._errorCallbacks.filter(cb => cb !== callback);
    };
  }

  async generateReport(path?: string): Promise<string> {
    if (!this.mockAnalysisSuccess) {
      throw this.mockError;
    }
    return '/mock/report-path.json';
  }

  isAnalyzing(): boolean {
    return this._isAnalyzing;
  }
}

describe('useUXEnhancer hook', () => {
  let mockEngine: MockEngine;

  beforeEach(() => {
    mockEngine = new MockEngine();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should initialize with default values', () => {
    const { result } = renderHook(() => useUXEnhancer(mockEngine));
    
    expect(result.current.summary).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBeFalsy();
    expect(result.current.analyzing).toBeFalsy();
    expect(result.current.progress).toBe(0);
    expect(result.current.isValid).toBeFalsy();
    expect(result.current.validationErrors).toEqual([]);
  });

  test('should handle analyze success', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useUXEnhancer(mockEngine));
    
    act(() => {
      result.current.analyze();
    });
    
    expect(result.current.loading).toBeTruthy();
    expect(result.current.analyzing).toBeTruthy();
    
    // Advance timers to trigger first progress update
    act(() => {
      jest.advanceTimersByTime(50);
    });
    
    expect(result.current.progress).toBe(25);
    
    // Advance timers to complete the analysis
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    expect(result.current.loading).toBeFalsy();
    expect(result.current.analyzing).toBeFalsy();
    expect(result.current.progress).toBe(100);
    expect(result.current.summary).toEqual(mockEngine.mockResult);
  });

  test('should handle analyze error', async () => {
    mockEngine.mockAnalysisSuccess = false;
    
    const { result } = renderHook(() => useUXEnhancer(mockEngine));
    
    act(() => {
      result.current.analyze();
    });
    
    expect(result.current.loading).toBeTruthy();
    expect(result.current.analyzing).toBeTruthy();
    
    // Advance timers to trigger error
    act(() => {
      jest.advanceTimersByTime(100);
    });
    
    expect(result.current.loading).toBeFalsy();
    expect(result.current.analyzing).toBeFalsy();
    expect(result.current.error).toEqual(mockEngine.mockError);
    expect(result.current.summary).toBeNull();
  });

  test('should handle generate report success', async () => {
    const { result } = renderHook(() => useUXEnhancer(mockEngine));
    
    let reportPath: string | undefined;
    
    await act(async () => {
      reportPath = await result.current.generateReport();
    });
    
    expect(reportPath).toBe('/mock/report-path.json');
  });

  test('should handle generate report error', async () => {
    mockEngine.mockAnalysisSuccess = false;
    
    const { result } = renderHook(() => useUXEnhancer(mockEngine));
    
    let caughtError: Error | undefined;
    
    await act(async () => {
      try {
        await result.current.generateReport();
      } catch (err) {
        caughtError = err as Error;
      }
    });
    
    expect(caughtError).toEqual(mockEngine.mockError);
    expect(result.current.error).toEqual(mockEngine.mockError);
  });

  test('should handle auto refresh', () => {
    const { result } = renderHook(() => useUXEnhancer(mockEngine, { 
      autoRefresh: true,
      refreshInterval: 1000 
    }));
    
    // Initially should not have called analyze
    expect(result.current.analyzing).toBeFalsy();
    
    // Advance timer to trigger auto refresh
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    // Should be analyzing now
    expect(result.current.analyzing).toBeTruthy();
    
    // Complete the analysis
    act(() => {
      jest.advanceTimersByTime(250);
    });
    
    expect(result.current.analyzing).toBeFalsy();
    
    // Should schedule another analysis
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    // Should be analyzing again
    expect(result.current.analyzing).toBeTruthy();
  });

  test('should not auto refresh when analyzing', () => {
    const { result } = renderHook(() => useUXEnhancer(mockEngine, { 
      autoRefresh: true,
      refreshInterval: 1000 
    }));
    
    // Start an analysis
    act(() => {
      result.current.analyze();
    });
    
    expect(result.current.analyzing).toBeTruthy();
    
    // Advance timer but don't complete the analysis
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    // Analyzing flag should still be from the manual call, not a new one
    expect(result.current.analyzing).toBeTruthy();
  });

  test('should validate summary on analysis completion', () => {
    const { result } = renderHook(() => useUXEnhancer(mockEngine));
    
    // Set up a valid result
    mockEngine.mockResult = {
      overallScore: 85,
      maxScore: 100,
      timestamp: new Date().toISOString(),
      duration: 1500,
      totalIssues: 5,
      phases: {
        phase1: {
          name: 'Phase 1',
          score: 40,
          maxScore: 50,
          description: 'Test phase',
          duration: 500,
          issues: []
        }
      }
    };
    
    act(() => {
      result.current.analyze();
    });
    
    // Complete the analysis
    act(() => {
      jest.advanceTimersByTime(250);
    });
    
    expect(result.current.isValid).toBeTruthy();
    expect(result.current.validationErrors).toEqual([]);

    // Now set up an invalid result
    mockEngine.mockResult = {
      // Missing required fields
      timestamp: new Date().toISOString()
    };
    
    act(() => {
      result.current.analyze();
    });
    
    // Complete the analysis
    act(() => {
      jest.advanceTimersByTime(250);
    });
    
    expect(result.current.isValid).toBeFalsy();
    expect(result.current.validationErrors.length).toBeGreaterThan(0);
  });
}); 