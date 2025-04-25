/**
 * EventEmitter class for the plugin system
 * Enables event-based communication between plugins and the system
 */
export type EventListener = (...args: any[]) => void;

export class EventEmitter {
  private events: Map<string, Set<EventListener>> = new Map();

  /**
   * Register an event listener
   * @param event Event name
   * @param listener Event listener function
   * @returns Function to remove the listener
   */
  public on(event: string, listener: EventListener): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    
    this.events.get(event)!.add(listener);
    
    // Return function to remove the listener
    return () => {
      this.off(event, listener);
    };
  }

  /**
   * Register a one-time event listener
   * @param event Event name
   * @param listener Event listener function
   * @returns Function to remove the listener
   */
  public once(event: string, listener: EventListener): () => void {
    const onceListener = (...args: any[]) => {
      this.off(event, onceListener);
      listener(...args);
    };
    
    return this.on(event, onceListener);
  }

  /**
   * Unregister an event listener
   * @param event Event name
   * @param listener Event listener function
   */
  public off(event: string, listener: EventListener): void {
    if (!this.events.has(event)) {
      return;
    }
    
    this.events.get(event)!.delete(listener);
    
    // Clean up empty event sets
    if (this.events.get(event)!.size === 0) {
      this.events.delete(event);
    }
  }

  /**
   * Emit an event
   * @param event Event name
   * @param args Event arguments
   * @returns Whether the event had listeners
   */
  public emit(event: string, ...args: any[]): boolean {
    if (!this.events.has(event)) {
      return false;
    }
    
    for (const listener of this.events.get(event)!) {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for "${event}":`, error);
      }
    }
    
    return true;
  }

  /**
   * Remove all listeners
   * @param event Optional event name to clear only specific event
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  /**
   * Get all listeners for an event
   * @param event Event name
   * @returns Array of listeners
   */
  public listeners(event: string): EventListener[] {
    if (!this.events.has(event)) {
      return [];
    }
    
    return Array.from(this.events.get(event)!);
  }

  /**
   * Get listener count for an event
   * @param event Event name
   * @returns Number of listeners
   */
  public listenerCount(event: string): number {
    if (!this.events.has(event)) {
      return 0;
    }
    
    return this.events.get(event)!.size;
  }
} 