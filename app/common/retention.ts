/**
 * RetentionService - Handles tracking and analytics for user interactions
 * Used to monitor feature usage, engagement metrics, and assistant effectiveness
 */

export interface EventData {
  eventType: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AssistantEvent extends EventData {
  action: 'open' | 'close' | 'interaction';
  duration?: number; // Time in ms that assistant was open (for close events)
  source?: 'button' | 'keyboard' | 'api' | 'auto';
}

class RetentionService {
  private events: EventData[] = [];
  private apiEndpoint: string | null = null;
  private sessionStartTime: number;
  private flushInterval: number = 60000; // 1 minute
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastAssistantOpenTime: number | null = null;

  constructor() {
    this.sessionStartTime = Date.now();
    this.setupAutomaticFlush();
  }

  /**
   * Configure the service with an API endpoint
   */
  public configure(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Track an event with the retention service
   */
  public trackEvent(eventType: string, metadata?: Record<string, any>): void {
    const event: EventData = {
      eventType,
      timestamp: Date.now(),
      metadata,
    };

    this.events.push(event);
    console.debug(`[RetentionService] Tracked event: ${eventType}`, metadata);
  }

  /**
   * Track assistant-specific events
   */
  public trackAssistantEvent(action: AssistantEvent['action'], source: AssistantEvent['source'], metadata?: Record<string, any>): void {
    // For open events, store the timestamp
    if (action === 'open') {
      this.lastAssistantOpenTime = Date.now();
    }

    // For close events, calculate duration if we have an open timestamp
    let duration;
    if (action === 'close' && this.lastAssistantOpenTime !== null) {
      duration = Date.now() - this.lastAssistantOpenTime;
      this.lastAssistantOpenTime = null;
    }

    const event: AssistantEvent = {
      eventType: 'assistant',
      timestamp: Date.now(),
      action,
      source,
      duration,
      metadata,
    };

    this.events.push(event);
    console.debug(`[RetentionService] Assistant ${action} via ${source}`, { duration, ...metadata });
  }

  /**
   * Setup automatic flushing of events
   */
  private setupAutomaticFlush(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      this.flush().catch(err => {
        console.error('[RetentionService] Error flushing events:', err);
      });
    }, this.flushInterval);
  }

  /**
   * Send events to the server and clear the local cache
   */
  public async flush(): Promise<void> {
    if (!this.events.length) return;
    
    if (this.apiEndpoint) {
      try {
        const response = await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            events: this.events,
            sessionId: this.sessionStartTime,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to send events: ${response.status} ${response.statusText}`);
        }

        // Clear events after successful send
        this.events = [];
      } catch (error) {
        console.error('[RetentionService] Error sending events:', error);
        // Keep events in the queue to try again later
      }
    } else {
      // If no API endpoint, just log to console and clear
      console.info('[RetentionService] Would have sent events:', this.events);
      this.events = [];
    }
  }

  /**
   * Get current session events (for analytics dashboard)
   */
  public getEvents(): EventData[] {
    return [...this.events];
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Attempt to flush any remaining events
    this.flush().catch(console.error);
  }
}

// Export singleton instance
export const retentionService = new RetentionService();
export default retentionService; 