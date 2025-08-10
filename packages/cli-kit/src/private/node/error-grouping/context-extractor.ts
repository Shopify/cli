import {sanitizeErrorMessage} from './sanitizers.js'
import type {ErrorContext, StackFrame} from './types.js'

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
  let topFrame: StackFrame | undefined
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
            columnNumber: parseInt(match[4] ?? '0', 10),
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

// Node.js internal module patterns to skip
const NODE_INTERNAL_PATTERNS = [
  /node:internal\//,
  // Matches all node:* modules
  /node:[a-z_]+/,
  // Legacy internal modules
  /^internal\//,
] as const

/**
 * Type guard to check if a line is a Node.js internal frame.
 * @param line - The stack trace line to check.
 * @returns True if the line is from a Node.js internal module.
 */
function isNodeInternalFrame(line: string): boolean {
  return NODE_INTERNAL_PATTERNS.some((pattern) => pattern.test(line))
}

/**
 * Extracts the top stack frame from a stack trace string.
 * Skips Node.js internal frames to find the first meaningful application frame.
 *
 * @param stack - The stack trace string to parse.
 * @returns A formatted string with file and method, or undefined if not found.
 */
export function extractTopStackFrame(stack: string | undefined): string | undefined {
  if (!stack) return undefined

  const lines = stack.split('\n')

  // Find the first non-internal stack frame
  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine.startsWith('at ')) continue

    // Skip Node.js internal frames using the type-safe pattern check
    if (isNodeInternalFrame(trimmedLine)) {
      continue
    }

    // Extract file and method from the stack frame
    const match = trimmedLine.match(/at\s+(?:(.+?)\s+\()?(.+):(\d+):(\d+)\)?/)
    if (match) {
      const method = match[1] ?? '<anonymous>'
      const fullPath = match[2] ?? ''

      // Normalize the file path
      const filename = normalizeFilePath(fullPath)

      // Clean up the method name
      const cleanMethod = normalizeMethodName(method)

      // Format: filename:functionName
      return `${filename}:${cleanMethod}`
    }
  }

  return undefined
}

/**
 * Normalizes a file path by removing absolute paths and keeping only relevant parts.
 * @param fullPath - The full file path to normalize.
 * @returns The normalized file path.
 */
function normalizeFilePath(fullPath: string): string {
  let filename = fullPath

  // Common path patterns to normalize, ordered by specificity
  const pathPatterns: [RegExp, string][] = [
    // Package paths
    [/^.*\/packages\//, 'packages/'],
    // Node modules - strip everything before node_modules
    [/^.*\/node_modules\//, ''],
    // Source directories
    [/^.*\/src\//, 'src/'],
    [/^.*\/lib\//, 'lib/'],
    [/^.*\/dist\//, 'dist/'],
    // Build directories
    [/^.*\/build\//, 'build/'],
    [/^.*\/out\//, 'out/'],
  ]

  // Apply the first matching pattern
  for (const [pattern, replacement] of pathPatterns) {
    if (pattern.test(filename)) {
      filename = filename.replace(pattern, replacement)
      break
    }
  }

  // If still has absolute path, intelligently extract relevant parts
  if (filename.startsWith('/') || filename.match(/^[A-Z]:\\/)) {
    const parts = filename.split(/[\\/]/)
    // Keep more parts if it's a short path, fewer if it's long
    const numParts = parts.length <= 5 ? parts.length : Math.min(3, parts.length)
    const relevantParts = parts.slice(-numParts).filter(Boolean)
    filename = relevantParts.join('/')
  }

  return filename
}

/**
 * Normalizes a method name by removing common wrappers and decorators.
 * @param method - The method name to normalize.
 * @returns The normalized method name.
 */
function normalizeMethodName(method: string): string {
  let cleanMethod = method

  // Remove common wrappers and decorators
  const methodCleanupPatterns: [RegExp, string][] = [
    // Async/await wrappers
    [/^async\s+/, ''],
    // Promise wrappers
    [/^Promise\./, ''],
    // Generator functions
    [/^\*\s*/, ''],
    // Renamed imports/exports
    [/\s*\[as\s+.+\]$/, ''],
    // Object property access
    [/^Object\./, ''],
    // Class constructors
    [/^new\s+/, ''],
  ]

  for (const [pattern, replacement] of methodCleanupPatterns) {
    cleanMethod = cleanMethod.replace(pattern, replacement)
  }

  return cleanMethod || '<anonymous>'
}
