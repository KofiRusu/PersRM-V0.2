// Mock client for benchmark data
// This will be replaced with actual API calls in production

// Mock data for benchmark results
const mockBenchmarkResults = {
  summary: {
    totalModels: 3,
    totalPrompts: 5,
    lastRunTimestamp: new Date().toISOString(),
    bestOverallModel: "GPT-4o"
  },
  models: {
    "GPT-4o": {
      avgResponseTime: 2450.3,
      avgCodeLength: 1253.7,
      successRate: 98,
      successCount: 49,
      failCount: 1,
      totalTime: 122515,
      regressions: []
    },
    "GPT-3.5 Turbo": {
      avgResponseTime: 1320.8,
      avgCodeLength: 943.2,
      successRate: 88,
      successCount: 44,
      failCount: 6,
      totalTime: 66040,
      regressions: [
        { type: "success", prompt: "form-schema-to-ui", previousValue: true, currentValue: false }
      ]
    },
    "DeepSeek Chat": {
      avgResponseTime: 1875.4,
      avgCodeLength: 1087.5,
      successRate: 92,
      successCount: 46,
      failCount: 4,
      totalTime: 93770,
      regressions: [
        { type: "responseTime", prompt: "ui-button-basic", previousValue: 1650, currentValue: 1875 }
      ]
    }
  },
  prompts: {
    "ui-button-basic": {
      bestModel: "GPT-4o",
      worstModel: "GPT-3.5 Turbo",
      results: {
        "GPT-4o": {
          responseTime: 2250,
          codeLength: 1150,
          success: true
        },
        "GPT-3.5 Turbo": {
          responseTime: 1150,
          codeLength: 850,
          success: true
        },
        "DeepSeek Chat": {
          responseTime: 1875,
          codeLength: 950,
          success: true
        }
      }
    },
    "form-schema-to-ui": {
      bestModel: "GPT-4o",
      worstModel: "GPT-3.5 Turbo",
      results: {
        "GPT-4o": {
          responseTime: 2850,
          codeLength: 1520,
          success: true
        },
        "GPT-3.5 Turbo": {
          responseTime: 1450,
          codeLength: 980,
          success: false,
          error: "Invalid component structure"
        },
        "DeepSeek Chat": {
          responseTime: 2120,
          codeLength: 1250,
          success: true
        }
      }
    },
    "accessibility-check": {
      bestModel: "GPT-4o",
      worstModel: "DeepSeek Chat",
      results: {
        "GPT-4o": {
          responseTime: 2150,
          codeLength: 1050,
          success: true
        },
        "GPT-3.5 Turbo": {
          responseTime: 1250,
          codeLength: 920,
          success: true
        },
        "DeepSeek Chat": {
          responseTime: 1750,
          codeLength: 1020,
          success: false,
          error: "Incomplete accessibility analysis"
        }
      }
    },
    "reasoning-about-layout": {
      bestModel: "GPT-4o",
      worstModel: "GPT-3.5 Turbo",
      results: {
        "GPT-4o": {
          responseTime: 2650,
          codeLength: 1350,
          success: true
        },
        "GPT-3.5 Turbo": {
          responseTime: 1480,
          codeLength: 970,
          success: false,
          error: "Inconsistent layout structure"
        },
        "DeepSeek Chat": {
          responseTime: 1920,
          codeLength: 1150,
          success: true
        }
      }
    },
    "code-enhancement-suggestion": {
      bestModel: "DeepSeek Chat",
      worstModel: "GPT-3.5 Turbo",
      results: {
        "GPT-4o": {
          responseTime: 2350,
          codeLength: 1180,
          success: true
        },
        "GPT-3.5 Turbo": {
          responseTime: 1450,
          codeLength: 1020,
          success: false,
          error: "Unusable code suggestions"
        },
        "DeepSeek Chat": {
          responseTime: 1780,
          codeLength: 1140,
          success: true
        }
      }
    }
  },
  history: [
    {
      timestamp: "2025-05-16T12:35:22.509Z",
      models: {
        "GPT-4o": { successRate: 96, avgResponseTime: 2380.5 },
        "GPT-3.5 Turbo": { successRate: 92, avgResponseTime: 1290.3 },
        "DeepSeek Chat": { successRate: 92, avgResponseTime: 1750.8 }
      }
    },
    {
      timestamp: "2025-05-15T09:41:15.733Z",
      models: {
        "GPT-4o": { successRate: 96, avgResponseTime: 2420.1 },
        "GPT-3.5 Turbo": { successRate: 88, avgResponseTime: 1350.7 },
        "DeepSeek Chat": { successRate: 88, avgResponseTime: 1820.2 }
      }
    },
    {
      timestamp: "2025-05-14T10:22:37.112Z",
      models: {
        "GPT-4o": { successRate: 92, avgResponseTime: 2550.4 },
        "GPT-3.5 Turbo": { successRate: 84, avgResponseTime: 1380.9 },
        "DeepSeek Chat": { successRate: 88, avgResponseTime: 1890.5 }
      }
    }
  ]
};

// Mock model preference map data
const mockModelPreferenceMap = {
  "ui-button-basic": { 
    preferredModel: "GPT-4o", 
    confidence: 0.85, 
    reasons: ["Most consistent styling", "Better accessibility"] 
  },
  "form-schema-to-ui": { 
    preferredModel: "GPT-4o", 
    confidence: 0.92, 
    reasons: ["Complete implementation", "Better validation"] 
  },
  "accessibility-check": { 
    preferredModel: "GPT-4o", 
    confidence: 0.78, 
    reasons: ["More comprehensive", "Follows WCAG standards"] 
  },
  "reasoning-about-layout": { 
    preferredModel: "DeepSeek Chat", 
    confidence: 0.67, 
    reasons: ["Better spacing logic", "More responsive"] 
  },
  "code-enhancement-suggestion": { 
    preferredModel: "DeepSeek Chat", 
    confidence: 0.81, 
    reasons: ["More practical suggestions", "Better optimization"] 
  },
};

// Function to get benchmark results
export async function getBenchmarkResults() {
  // In a real implementation, this would fetch from an API
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockBenchmarkResults);
    }, 500); // Simulate network delay
  });
}

// Function to get model preference map
export async function getModelPreferenceMap() {
  // In a real implementation, this would fetch from an API
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockModelPreferenceMap);
    }, 500); // Simulate network delay
  });
}

// Function to run a benchmark
export async function runBenchmark() {
  return new Promise((resolve) => {
    setTimeout(() => {
      // In a real implementation, this would trigger a benchmark run
      resolve({ success: true, message: "Benchmark completed successfully" });
    }, 2000); // Simulate benchmark run time
  });
}

// Function to export benchmark results
export async function exportBenchmarkResults(format = 'json') {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ 
        success: true, 
        message: `Benchmark results exported as ${format}`,
        downloadUrl: `/api/benchmarks/export?format=${format}`
      });
    }, 1000);
  });
}

// Function to archive benchmark results to Notion
export async function archiveBenchmarkToNotion() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ 
        success: true, 
        message: "Benchmark results archived to Notion",
        notionPageUrl: "https://notion.so/benchmarks/latest"
      });
    }, 1500);
  });
} 