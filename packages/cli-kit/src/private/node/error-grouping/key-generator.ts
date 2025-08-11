import {extractErrorContext, extractTopStackFrame} from './context-extractor.js'

/**
 * Generates a semantic grouping key for an error to improve error grouping in Observe.
 * Uses error class, sanitized message, handled/unhandled status, and top stack frame.
 *
 * @param error - The error to generate a key for.
 * @param unhandled - Whether the error is unhandled.
 * @returns A grouping key string in format: cli:handled/unhandled:errorClass:sanitizedMessage:topStackFrame
 */
function isValidError(error: Error): boolean {
  return error && typeof error === 'object' && error instanceof Error
}

export function generateGroupingKey(error: Error, unhandled: boolean): string {
  try {
    if (!isValidError(error)) {
      return 'cli:invalid:InvalidInput:invalid-error-object:unknown'
    }

    const context = extractErrorContext(error)
    const handledStatus = unhandled ? 'unhandled' : 'handled'

    let topStackFrame = 'unknown'
    try {
      topStackFrame = extractTopStackFrame(error.stack) ?? 'unknown'
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // If accessing stack throws, use 'unknown'
    }

    const groupingKey = `cli:${handledStatus}:${context.errorClass}:${context.sanitizedMessage}:${topStackFrame}`

    return groupingKey
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (keyError: unknown) {
    const errorName = error?.constructor?.name || 'Unknown'
    const handledStatus = unhandled ? 'unhandled' : 'handled'
    return `cli:${handledStatus}:${errorName}:fallback-key-generation-failed:unknown`
  }
}
