interface EventData {
  [key: string]: any;
}

interface TrackedEvent {
  id: string;
  timestamp: string;
  eventName: string;
  data: EventData;
  sessionId?: string;
  userId?: string;
}

interface ExportOptions {
  startDate?: Date;
  endDate?: Date;
  eventNames?: string[];
  format: 'json' | 'csv';
  includeHeaders?: boolean; // For CSV only
}

export class RetentionService {
  private events: TrackedEvent[] = [];
  private sessionId: string | null = null;
  private userId: string | null = null;
  private storageKey = 'persLm-retention-events';
  
  constructor() {
    this.loadEventsFromStorage();
    this.sessionId = localStorage.getItem('reasoningAssistantCurrentSession') || null;
    this.userId = localStorage.getItem('persLm-user-id') || null;
    
    // Auto-save events periodically
    setInterval(() => this.saveEventsToStorage(), 60000); // Save every minute
  }
  
  /**
   * Set the current session ID
   */
  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }
  
  /**
   * Set the current user ID
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
    if (userId) {
      localStorage.setItem('persLm-user-id', userId);
    } else {
      localStorage.removeItem('persLm-user-id');
    }
  }
  
  /**
   * Track an event with optional data
   */
  trackEvent(eventName: string, data: EventData = {}): string {
    const event: TrackedEvent = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      eventName,
      data,
      sessionId: this.sessionId || undefined,
      userId: this.userId || undefined
    };
    
    this.events.push(event);
    
    // Auto-save if we have accumulated a number of events
    if (this.events.length % 10 === 0) {
      this.saveEventsToStorage();
    }
    
    return event.id;
  }
  
  /**
   * Get all tracked events
   */
  getAllEvents(): TrackedEvent[] {
    return [...this.events];
  }
  
  /**
   * Filter events by criteria
   */
  filterEvents(options: {
    startDate?: Date;
    endDate?: Date;
    eventNames?: string[];
    sessionId?: string;
    userId?: string;
  }): TrackedEvent[] {
    let filteredEvents = [...this.events];
    
    if (options.startDate) {
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.timestamp) >= options.startDate!
      );
    }
    
    if (options.endDate) {
      filteredEvents = filteredEvents.filter(event => 
        new Date(event.timestamp) <= options.endDate!
      );
    }
    
    if (options.eventNames && options.eventNames.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        options.eventNames!.includes(event.eventName)
      );
    }
    
    if (options.sessionId) {
      filteredEvents = filteredEvents.filter(event => 
        event.sessionId === options.sessionId
      );
    }
    
    if (options.userId) {
      filteredEvents = filteredEvents.filter(event => 
        event.userId === options.userId
      );
    }
    
    return filteredEvents;
  }
  
  /**
   * Export events data to JSON or CSV
   */
  exportEvents(options: ExportOptions): string {
    const filteredEvents = this.filterEvents({
      startDate: options.startDate,
      endDate: options.endDate,
      eventNames: options.eventNames
    });
    
    if (options.format === 'json') {
      return JSON.stringify(filteredEvents, null, 2);
    } else if (options.format === 'csv') {
      return this.convertToCSV(filteredEvents, options.includeHeaders || true);
    }
    
    throw new Error(`Unsupported export format: ${options.format}`);
  }
  
  /**
   * Clear all events
   */
  clearEvents(): void {
    this.events = [];
    localStorage.removeItem(this.storageKey);
  }
  
  /**
   * Get aggregated analytics data
   */
  getAnalytics(): {
    totalEvents: number;
    uniqueSessions: number;
    uniqueUsers: number;
    eventBreakdown: Record<string, number>;
    sessionLengths: Record<string, number>;
  } {
    const sessions = new Set<string>();
    const users = new Set<string>();
    const eventBreakdown: Record<string, number> = {};
    const sessionEvents: Record<string, TrackedEvent[]> = {};
    
    this.events.forEach(event => {
      // Count unique sessions and users
      if (event.sessionId) {
        sessions.add(event.sessionId);
        
        // Group events by session
        if (!sessionEvents[event.sessionId]) {
          sessionEvents[event.sessionId] = [];
        }
        sessionEvents[event.sessionId].push(event);
      }
      
      if (event.userId) {
        users.add(event.userId);
      }
      
      // Count event types
      if (!eventBreakdown[event.eventName]) {
        eventBreakdown[event.eventName] = 0;
      }
      eventBreakdown[event.eventName]++;
    });
    
    // Calculate session durations (in minutes)
    const sessionLengths: Record<string, number> = {};
    Object.entries(sessionEvents).forEach(([sessionId, events]) => {
      // Sort events by timestamp
      events.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      
      if (events.length >= 2) {
        const firstEvent = events[0];
        const lastEvent = events[events.length - 1];
        const durationMs = new Date(lastEvent.timestamp).getTime() - 
                          new Date(firstEvent.timestamp).getTime();
        sessionLengths[sessionId] = Math.round(durationMs / 60000); // Convert to minutes
      } else {
        sessionLengths[sessionId] = 0;
      }
    });
    
    return {
      totalEvents: this.events.length,
      uniqueSessions: sessions.size,
      uniqueUsers: users.size,
      eventBreakdown,
      sessionLengths
    };
  }
  
  /**
   * Save events to localStorage
   */
  private saveEventsToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.events));
    } catch (error) {
      console.error('Failed to save events to localStorage:', error);
      
      // If localStorage is full, keep only the last 1000 events
      if (this.events.length > 1000) {
        this.events = this.events.slice(-1000);
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.events));
        } catch (e) {
          console.error('Still failed to save events after reducing size:', e);
        }
      }
    }
  }
  
  /**
   * Load events from localStorage
   */
  private loadEventsFromStorage(): void {
    try {
      const storedEvents = localStorage.getItem(this.storageKey);
      if (storedEvents) {
        this.events = JSON.parse(storedEvents);
      }
    } catch (error) {
      console.error('Failed to load events from localStorage:', error);
      this.events = [];
    }
  }
  
  /**
   * Generate a unique ID for events
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }
  
  /**
   * Convert events array to CSV string
   */
  private convertToCSV(events: TrackedEvent[], includeHeaders: boolean): string {
    if (events.length === 0) {
      return '';
    }
    
    // Collect all possible data keys across all events
    const dataKeys = new Set<string>();
    events.forEach(event => {
      Object.keys(event.data).forEach(key => dataKeys.add(key));
    });
    
    const headers = ['id', 'timestamp', 'eventName', 'sessionId', 'userId', ...dataKeys];
    const rows: string[][] = [];
    
    // Add headers row if requested
    if (includeHeaders) {
      rows.push(headers);
    }
    
    // Add data rows
    events.forEach(event => {
      const row: string[] = [
        event.id,
        event.timestamp,
        event.eventName,
        event.sessionId || '',
        event.userId || ''
      ];
      
      // Add data fields in the correct order
      dataKeys.forEach(key => {
        const value = event.data[key];
        row.push(value !== undefined ? String(value) : '');
      });
      
      rows.push(row);
    });
    
    // Convert rows to CSV
    return rows.map(row => 
      row.map(value => {
        // Quote values that contain commas or quotes
        if (value.includes(',') || value.includes('"')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    ).join('\n');
  }
}

// Export singleton instance
export const retentionService = new RetentionService(); 