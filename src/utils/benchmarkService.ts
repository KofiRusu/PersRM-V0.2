import { RetentionService } from "./retentionService";

export interface UiPerformanceMetric {
  name: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface AnimationMetric {
  variant: string;
  smoothness: number; // 0-1 score based on frame rate
  frameDrops: number;
  startTime: number;
  endTime: number;
}

export interface BenchmarkSummary {
  timestamp: string;
  environment: {
    userAgent: string;
    screenSize: string;
    devicePixelRatio: number;
    platform: string;
  };
  metrics: {
    uiPerformance: UiPerformanceMetric[];
    animations: AnimationMetric[];
    apiLatencies: UiPerformanceMetric[];
  };
  averages: {
    assistantOpenTime: number;
    reasoningResponseTime: number;
    animationSmoothness: number;
  };
}

class BenchmarkService {
  private retentionService: RetentionService;
  private uiMetrics: UiPerformanceMetric[] = [];
  private animationMetrics: AnimationMetric[] = [];
  private apiLatencies: UiPerformanceMetric[] = [];
  private currentMeasurements: Map<string, number> = new Map();
  private rafCallbacks: Map<string, number> = new Map();
  private frameData: Map<string, { timestamps: number[]; drops: number }> =
    new Map();

  constructor() {
    this.retentionService = new RetentionService();
  }

  /**
   * Start measuring a UI operation
   */
  startMeasure(name: string): void {
    this.currentMeasurements.set(name, performance.now());
  }

  /**
   * End measuring a UI operation and record the metric
   */
  endMeasure(
    name: string,
    category: "ui" | "api" = "ui",
  ): UiPerformanceMetric | null {
    const startTime = this.currentMeasurements.get(name);
    if (startTime === undefined) {
      console.warn(`No measurement started for "${name}"`);
      return null;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    const metric: UiPerformanceMetric = {
      name,
      startTime,
      endTime,
      duration,
    };

    if (category === "ui") {
      this.uiMetrics.push(metric);
    } else {
      this.apiLatencies.push(metric);
    }

    this.currentMeasurements.delete(name);
    this.retentionService.trackEvent("benchmark", {
      metricName: name,
      duration,
      category,
    });

    return metric;
  }

  /**
   * Measure animation smoothness
   */
  startAnimationMeasurement(animationId: string, variant: string): void {
    // Reset frame data
    this.frameData.set(animationId, {
      timestamps: [],
      drops: 0,
    });

    // Start tracking frames
    const measureFrame = (timestamp: number) => {
      const frameInfo = this.frameData.get(animationId);
      if (!frameInfo) return;

      // Record timestamp
      frameInfo.timestamps.push(timestamp);

      // Check for dropped frames (assuming 60fps as target)
      if (frameInfo.timestamps.length >= 2) {
        const lastIndex = frameInfo.timestamps.length - 1;
        const timeDiff =
          frameInfo.timestamps[lastIndex] - frameInfo.timestamps[lastIndex - 1];

        // If frame took longer than 20ms (50fps), count it as a frame drop
        if (timeDiff > 20) {
          // Calculate how many frames were dropped
          const droppedFrames = Math.floor(timeDiff / 16.67) - 1;
          if (droppedFrames > 0) {
            frameInfo.drops += droppedFrames;
          }
        }
      }

      // Continue measuring
      const rafId = requestAnimationFrame(measureFrame);
      this.rafCallbacks.set(animationId, rafId);
    };

    // Start the measurement
    const rafId = requestAnimationFrame(measureFrame);
    this.rafCallbacks.set(animationId, rafId);
    this.startMeasure(`animation-${animationId}`);
  }

  /**
   * End animation measurement and calculate metrics
   */
  endAnimationMeasurement(
    animationId: string,
    variant: string,
  ): AnimationMetric | null {
    // Stop animation frame callback
    const rafId = this.rafCallbacks.get(animationId);
    if (rafId) {
      cancelAnimationFrame(rafId);
      this.rafCallbacks.delete(animationId);
    }

    // Get timing data
    const metric = this.endMeasure(`animation-${animationId}`);
    if (!metric) return null;

    // Get frame data
    const frameInfo = this.frameData.get(animationId);
    if (!frameInfo) return null;

    // Calculate smoothness (1 = perfect, lower = worse)
    const { timestamps, drops } = frameInfo;
    const totalExpectedFrames = Math.ceil(
      (metric.endTime - metric.startTime) / 16.67,
    );
    const actualFrames = timestamps.length;
    const smoothness = Math.max(
      0,
      Math.min(1, 1 - drops / totalExpectedFrames),
    );

    const animationMetric: AnimationMetric = {
      variant,
      smoothness,
      frameDrops: drops,
      startTime: metric.startTime,
      endTime: metric.endTime,
    };

    this.animationMetrics.push(animationMetric);

    // Clean up
    this.frameData.delete(animationId);

    // Track animation metric
    this.retentionService.trackEvent("animation-benchmark", {
      animationId,
      variant,
      smoothness,
      frameDrops: drops,
      duration: metric.duration,
    });

    return animationMetric;
  }

  /**
   * Generate a benchmark summary
   */
  generateBenchmarkSummary(): BenchmarkSummary {
    // Calculate averages
    const assistantOpenTimes = this.uiMetrics
      .filter((metric) => metric.name.includes("assistant-open"))
      .map((metric) => metric.duration);

    const reasoningTimes = this.apiLatencies
      .filter((metric) => metric.name.includes("reasoning-api"))
      .map((metric) => metric.duration);

    const averageAssistantOpenTime =
      assistantOpenTimes.length > 0
        ? assistantOpenTimes.reduce((sum, time) => sum + time, 0) /
          assistantOpenTimes.length
        : 0;

    const averageReasoningTime =
      reasoningTimes.length > 0
        ? reasoningTimes.reduce((sum, time) => sum + time, 0) /
          reasoningTimes.length
        : 0;

    const averageAnimationSmoothness =
      this.animationMetrics.length > 0
        ? this.animationMetrics.reduce(
            (sum, metric) => sum + metric.smoothness,
            0,
          ) / this.animationMetrics.length
        : 0;

    // Create summary
    const summary: BenchmarkSummary = {
      timestamp: new Date().toISOString(),
      environment: {
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width}x${window.screen.height}`,
        devicePixelRatio: window.devicePixelRatio,
        platform: navigator.platform,
      },
      metrics: {
        uiPerformance: [...this.uiMetrics],
        animations: [...this.animationMetrics],
        apiLatencies: [...this.apiLatencies],
      },
      averages: {
        assistantOpenTime: averageAssistantOpenTime,
        reasoningResponseTime: averageReasoningTime,
        animationSmoothness: averageAnimationSmoothness,
      },
    };

    // Log summary to retention service
    this.retentionService.trackEvent("benchmark-summary", {
      timestamp: summary.timestamp,
      averageAssistantOpenTime,
      averageReasoningTime,
      averageAnimationSmoothness,
      totalMetrics:
        this.uiMetrics.length +
        this.animationMetrics.length +
        this.apiLatencies.length,
    });

    return summary;
  }

  /**
   * Export benchmark data to JSON
   */
  exportBenchmarkData(): string {
    const summary = this.generateBenchmarkSummary();
    return JSON.stringify(summary, null, 2);
  }

  /**
   * Reset all collected metrics
   */
  resetMetrics(): void {
    this.uiMetrics = [];
    this.animationMetrics = [];
    this.apiLatencies = [];
    this.currentMeasurements.clear();

    // Cancel any ongoing animation measurements
    this.rafCallbacks.forEach((rafId) => cancelAnimationFrame(rafId));
    this.rafCallbacks.clear();
    this.frameData.clear();
  }
}

// Export singleton instance
export const benchmarkService = new BenchmarkService();
