import { openai } from '@/lib/openai';
import { LogResult } from '../memory/retentionService';

export interface FeedbackAnalysis {
  sentiment: 'positive' | 'negative' | 'neutral';
  categories: string[];
  actionItems: string[];
  score: number; // 0-10 scale
  result: LogResult;
  errorType?: string;
}

interface AnalysisPrompt {
  feedback: string;
  component: string;
  originalPrompt?: string;
  generatedCode?: string;
}

/**
 * Service for analyzing user feedback on generated components
 */
export class FeedbackAnalyzer {
  /**
   * Analyze feedback and categorize it
   */
  async analyzeFeedback(prompt: AnalysisPrompt): Promise<FeedbackAnalysis> {
    const { feedback, component, originalPrompt, generatedCode } = prompt;
    
    if (!feedback || feedback.trim().length === 0) {
      return this.getDefaultAnalysis();
    }
    
    // For short feedback, use rule-based analysis
    if (feedback.length < 20) {
      return this.analyzeShortFeedback(feedback);
    }
    
    // For longer feedback, use AI-based analysis
    try {
      return await this.analyzeWithAI(prompt);
    } catch (error) {
      console.error('Error analyzing feedback with AI:', error);
      // Fallback to rule-based analysis
      return this.analyzeShortFeedback(feedback);
    }
  }
  
  /**
   * Simple rule-based analysis for short feedback
   */
  private analyzeShortFeedback(feedback: string): FeedbackAnalysis {
    const lowerFeedback = feedback.toLowerCase();
    
    // Detect sentiment
    const positiveTerms = ['good', 'great', 'excellent', 'perfect', 'amazing', 'love', 'nice', 'well', 'worked'];
    const negativeTerms = ['bad', 'error', 'wrong', 'incorrect', 'issue', 'bug', 'problem', 'not working', 'broken', 'failed'];
    
    const positiveScore = positiveTerms.filter(term => lowerFeedback.includes(term)).length;
    const negativeScore = negativeTerms.filter(term => lowerFeedback.includes(term)).length;
    
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveScore > negativeScore) {
      sentiment = 'positive';
    } else if (negativeScore > positiveScore) {
      sentiment = 'negative';
    }
    
    // Determine categories
    const categories: string[] = [];
    if (lowerFeedback.includes('responsive') || lowerFeedback.includes('mobile')) {
      categories.push('responsive design');
    }
    if (lowerFeedback.includes('accessibility') || lowerFeedback.includes('a11y')) {
      categories.push('accessibility');
    }
    if (lowerFeedback.includes('performance') || lowerFeedback.includes('slow')) {
      categories.push('performance');
    }
    if (lowerFeedback.includes('type') || lowerFeedback.includes('typescript')) {
      categories.push('types');
    }
    if (lowerFeedback.includes('style') || lowerFeedback.includes('css') || lowerFeedback.includes('tailwind')) {
      categories.push('styling');
    }
    if (lowerFeedback.includes('logic') || lowerFeedback.includes('function')) {
      categories.push('logic');
    }
    
    // Default to UI/UX if no specific categories
    if (categories.length === 0) {
      categories.push('general ui/ux');
    }
    
    // Calculate score
    const score = sentiment === 'positive' ? 8 : (sentiment === 'neutral' ? 5 : 3);
    
    // Determine result
    const result: LogResult = sentiment === 'positive' ? 'success' : (sentiment === 'neutral' ? 'improved' : 'failure');
    
    // Determine action items
    const actionItems: string[] = [];
    if (sentiment !== 'positive') {
      categories.forEach(category => {
        actionItems.push(`Review and improve ${category}`);
      });
    }
    
    // Determine error type
    let errorType: string | undefined;
    if (sentiment === 'negative') {
      if (lowerFeedback.includes('crash') || lowerFeedback.includes('error')) {
        errorType = 'runtime_error';
      } else if (lowerFeedback.includes('design') || lowerFeedback.includes('layout')) {
        errorType = 'design_issue';
      } else if (lowerFeedback.includes('function') || lowerFeedback.includes('work')) {
        errorType = 'functionality_issue';
      }
    }
    
    return {
      sentiment,
      categories,
      actionItems,
      score,
      result,
      errorType,
    };
  }
  
  /**
   * Use AI to analyze detailed feedback
   */
  private async analyzeWithAI(prompt: AnalysisPrompt): Promise<FeedbackAnalysis> {
    const client = openai;
    if (!client) {
      throw new Error('OpenAI client not configured');
    }
    
    const { feedback, component, originalPrompt, generatedCode } = prompt;
    
    const systemPrompt = `
      You are an expert AI feedback analyzer for UI components. 
      Analyze the given feedback and return a structured analysis with the following fields:
      - sentiment: "positive", "negative", or "neutral"
      - categories: array of relevant categories (e.g., "accessibility", "performance", "responsive design", "types", "styling", "logic")
      - actionItems: array of specific actions to improve the component
      - score: numerical score from 0-10 (0 being worst, 10 being best)
      - result: either "success", "failure", or "improved"
      - errorType: (optional) specific error type if relevant
      
      The analysis should be returned as a JSON object.
    `;
    
    const userPrompt = `
      Component: ${component}
      
      Feedback: 
      ${feedback}
      
      ${originalPrompt ? `Original Prompt: ${originalPrompt}` : ''}
      
      ${generatedCode ? `Generated Code (excerpt): ${generatedCode.substring(0, 500)}...` : ''}
      
      Analyze this feedback and return the structured analysis.
    `;
    
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });
    
    const analysisText = response.choices[0]?.message.content || '{}';
    
    try {
      const analysis = JSON.parse(analysisText) as FeedbackAnalysis;
      
      // Ensure required fields exist
      return {
        sentiment: analysis.sentiment || 'neutral',
        categories: analysis.categories || ['general'],
        actionItems: analysis.actionItems || [],
        score: typeof analysis.score === 'number' ? analysis.score : 5,
        result: analysis.result || 'neutral',
        errorType: analysis.errorType,
      };
    } catch (error) {
      console.error('Error parsing AI feedback analysis:', error);
      return this.getDefaultAnalysis();
    }
  }
  
  /**
   * Get default analysis when no feedback is provided or analysis fails
   */
  private getDefaultAnalysis(): FeedbackAnalysis {
    return {
      sentiment: 'neutral',
      categories: ['general'],
      actionItems: [],
      score: 5,
      result: 'improved',
    };
  }
} 