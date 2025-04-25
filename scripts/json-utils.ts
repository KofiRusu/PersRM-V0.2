/**
 * Utility functions for handling JSON fields with SQLite
 * 
 * These helpers make it easier to work with JSON data stored as strings
 * when using SQLite as your database provider.
 */

/**
 * Safely converts an object to a JSON string for storage in SQLite
 */
export function toJsonString(data: any): string | null {
  if (data === null || data === undefined) {
    return null;
  }
  
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error('Failed to stringify JSON data:', error);
    return null;
  }
}

/**
 * Safely parses a JSON string from SQLite into an object
 */
export function fromJsonString<T = any>(jsonString: string | null): T | null {
  if (!jsonString) {
    return null;
  }
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Failed to parse JSON string:', error);
    return null;
  }
}

/**
 * Example usage with Prisma models:
 * 
 * // When creating/updating records:
 * const event = await prisma.event.create({
 *   data: {
 *     eventType: 'click',
 *     timestamp: new Date(),
 *     sessionId: 'session123',
 *     metadata: toJsonString({ page: '/home', component: 'button' })
 *   }
 * });
 * 
 * // When reading records:
 * const metadata = fromJsonString(event.metadata);
 * console.log(metadata?.page); // '/home'
 */ 