import {sanitizeErrorMessage} from './sanitizers.js'
import type {ErrorContext} from './types.js'

/**
 * Extracts and sanitizes context from an error for grouping and debugging.
 *
 * @param error - The error to extract context from.
 * @returns An ErrorContext object with sanitized and original values.
 */
export function extractErrorContext(error: Error): ErrorContext {
  // Safely get error class name
  let errorClass = 'Error'
  try {
    errorClass = error.constructor?.name ?? 'Error'
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // If accessing constructor.name throws, use default
  }

  // Safely get error message
  let errorMessage = ''
  try {
    errorMessage = error.message ?? ''
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // If accessing message throws, use empty string
  }

  const sanitizedMessage = sanitizeErrorMessage(errorMessage)

  // Extract top frame from stack trace if available
  let topFrame: ErrorContext['topFrame']
  let originalStack: string | undefined

  try {
    originalStack = error.stack
    if (originalStack) {
      const stackLines = originalStack.split('\n')
      const firstStackLine = stackLines.find((line) => line.trim().startsWith('at '))

      if (firstStackLine) {
        const match = firstStackLine.match(/at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?/)
        if (match) {
          // Sanitize the file path in the stack frame
          const sanitizedFile = sanitizeErrorMessage(match[2] ?? '')
          topFrame = {
            method: match[1] ?? '<anonymous>',
            file: sanitizedFile,
            lineNumber: parseInt(match[3] ?? '0', 10),
          }
        }
      }
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    // If accessing stack throws, leave topFrame and originalStack undefined
  }

  return {
    errorClass,
    errorMessage,
    sanitizedMessage,
    topFrame,
    originalStack,
    originalMessage: errorMessage,
    // Additional context can be added here if needed
    // command, environment, platform, cliVersion will be added by the caller
  }
}

/**
 * Extracts the top stack frame from a stack trace string.
 *
 * @param stack - The stack trace string to parse.
 * @returns A formatted string with method and file, or undefined if not found.
 */
export function extractTopStackFrame(stack: string | undefined): string | undefined {
  if (!stack) return undefined

  const lines = stack.split('\n')
  const firstStackLine = lines.find((line) => line.trim().startsWith('at '))

  if (firstStackLine) {
    // Extract just the file and method from the first stack frame
    const match = firstStackLine.match(/at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?/)
    if (match) {
      const method = match[1] ?? '<anonymous>'
      // Get just the filename
      const file = (match[2] ?? '').replace(/^.*[\\/\\\\]/, '')
      return `${method}@${file}`
    }
  }

  return undefined
}
