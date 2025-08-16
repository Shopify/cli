import {extractTopStackFrame} from './context-extractor.js'
import {sanitizeErrorMessage} from './sanitizers.js'

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

/**
 * Safely extracts the error class name.
 */
function getErrorClassName(error: Error): string {
  try {
    return error.constructor?.name ?? 'Error'
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return 'Error'
  }
}

/**
 * Safely extracts the error message.
 */
function getErrorMessage(error: Error): string {
  try {
    return error.message ?? ''
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return ''
  }
}

export function generateGroupingKey(error: Error, unhandled: boolean): string {
  try {
    if (!isValidError(error)) {
      return 'cli:invalid:InvalidInput:invalid-error-object:unknown'
    }

    const errorClass = getErrorClassName(error)
    const errorMessage = getErrorMessage(error)
    const sanitizedMessage = sanitizeErrorMessage(errorMessage)
    const handledStatus = unhandled ? 'unhandled' : 'handled'

    let topStackFrame = 'unknown'
    try {
      topStackFrame = extractTopStackFrame(error.stack) ?? 'unknown'
      // eslint-disable-next-line no-catch-all/no-catch-all
    } catch {
      // If accessing stack throws, use 'unknown'
    }

    const groupingKey = `cli:${handledStatus}:${errorClass}:${sanitizedMessage}:${topStackFrame}`

    return groupingKey
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (keyError: unknown) {
    const errorName = error?.constructor?.name || 'Unknown'
    const handledStatus = unhandled ? 'unhandled' : 'handled'
    return `cli:${handledStatus}:${errorName}:fallback-key-generation-failed:unknown`
  }
}
