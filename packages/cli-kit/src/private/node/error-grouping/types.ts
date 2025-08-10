/**
 * Represents a parsed stack frame from an error stack trace.
 */
export interface StackFrame {
  /** The file path where the error occurred. */
  file: string
  /** The method/function name where the error occurred. */
  method: string
  /** The line number in the file. */
  lineNumber?: number
  /** The column number in the file. */
  columnNumber?: number
}

/**
 * Error context information used for generating grouping hashes.
 */
export interface ErrorContext {
  /** The error class name (e.g., 'TypeError', 'FatalError'). */
  errorClass: string

  /** The raw error message. */
  errorMessage: string

  /** The sanitized error message with sensitive data removed. */
  sanitizedMessage: string

  /** Information about the top stack frame. */
  topFrame?: StackFrame

  /** The CLI command being executed (e.g., 'app dev'). */
  command?: string

  /** The environment (e.g., 'development', 'production'). */
  environment?: string

  /** The platform (e.g., 'darwin', 'win32', 'linux'). */
  platform?: string

  /** The CLI version. */
  cliVersion?: string

  /** The original stack trace before sanitization. */
  originalStack?: string

  /** The original error message before sanitization. */
  originalMessage: string
}

/**
 * Rule for sanitizing sensitive data from error messages.
 */
export interface SanitizationRule {
  /** The regex pattern to match sensitive data. */
  pattern: RegExp

  /** The replacement string for matched data. */
  replace: string

  /** Optional description of what this rule sanitizes. */
  description?: string
}
