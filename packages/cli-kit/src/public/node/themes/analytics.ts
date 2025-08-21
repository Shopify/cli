import {
  recordTiming as storeRecordTiming,
  recordError as storeRecordError,
  recordRetry as storeRecordRetry,
  recordEvent as storeRecordEvent,
} from './analytics/storage.js'

/**
 * Records timing data for performance monitoring. Call twice with the same
 * event name to start and stop timing. First call starts the timer, second
 * call stops it and records the duration.
 *
 * @example
 * ```ts
 *   recordTiming('theme-upload') // Start timing
 *   // ... do work ...
 *   recordTiming('theme-upload') // Stop timing and record duration
 * ```
 *
 * @param eventName - Unique identifier for the timing event
 */
export function recordTiming(eventName: string): void {
  storeRecordTiming(eventName)
}

/**
 * Records error information for debugging and monitoring. Use this to track
 * any exceptions or error conditions that occur during theme operations.
 * Errors are automatically categorized for easier analysis.
 *
 * @example
 * ```ts
 *   try {
 *     // ... risky operation ...
 *   } catch (error) {
 *     recordError(error)
 *   }
 * ```
 *
 * @param error - Error object or message to record
 */
export function recordError<T>(error: T): T {
  storeRecordError(error)
  return error
}

/**
 * Records retry attempts for network operations. Use this to track when
 * operations are retried due to transient failures. Helps identify
 * problematic endpoints or operations that frequently fail.
 *
 * @example
 * ```ts
 *   recordRetry('https://api.shopify.com/themes', 'upload')
 * ```
 *
 * @param url - The URL or endpoint being retried
 * @param operation - Description of the operation being retried
 */
export function recordRetry(url: string, operation: string): void {
  storeRecordRetry(url, operation)
}

/**
 * Records custom events for tracking specific user actions or system events.
 * Use this for important milestones, user interactions, or significant
 * state changes in the application.
 *
 * @example
 * ```ts
 *   recordEvent('theme-dev-started')
 *   recordEvent('file-watcher-connected')
 * ```
 *
 * @param eventName - Descriptive name for the event
 */
export function recordEvent(eventName: string): void {
  storeRecordEvent(eventName)
}
