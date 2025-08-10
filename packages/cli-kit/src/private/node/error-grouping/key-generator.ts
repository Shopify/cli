import {extractErrorContext, extractTopStackFrame} from './context-extractor.js'

/**
 * Generates a semantic grouping key for an error to improve error grouping in Observe.
 * Uses error class, sanitized message, handled/unhandled status, and top stack frame.
 *
 * @param error - The error to generate a key for.
 * @param unhandled - Whether the error is unhandled.
 * @returns A grouping key string in format: cli:handled/unhandled:errorClass:sanitizedMessage:topStackFrame
 */
export function generateGroupingKey(error: Error, unhandled: boolean): string {
  try {
    // Validate input - must be an actual Error instance
    if (!error || typeof error !== 'object' || !(error instanceof Error)) {
      return 'cli:invalid:InvalidInput:invalid-error-object:unknown'
    }

    // Extract context
    const context = extractErrorContext(error)

    // Determine handled status
    const handledStatus = unhandled ? 'unhandled' : 'handled'

    // Extract top stack frame (safely access error.stack)
    let topStackFrame = 'unknown'
    try {
      topStackFrame = extractTopStackFrame(error.stack) ?? 'unknown'
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // If accessing stack throws, use 'unknown'
    }

    // Build the grouping key with the top stack frame
    const groupingKey = `cli:${handledStatus}:${context.errorClass}:${context.sanitizedMessage}:${topStackFrame}`

    return groupingKey
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (keyError: unknown) {
    // Return a fallback key that still provides some grouping value
    const errorName = error?.constructor?.name || 'Unknown'
    const handledStatus = unhandled ? 'unhandled' : 'handled'
    return `cli:${handledStatus}:${errorName}:fallback-key-generation-failed:unknown`
  }
}
