import {SANITIZATION_RULES} from './patterns.js'

// Pre-compile patterns for performance
const compiledRules = SANITIZATION_RULES.map((rule) => ({
  pattern: new RegExp(rule.pattern.source, rule.pattern.flags),
  replace: rule.replace,
}))

/**
 * Sanitizes an error message by replacing dynamic values with placeholders.
 *
 * @param message - The error message to sanitize.
 * @returns The sanitized message with dynamic values replaced.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return ''

  let sanitized = message

  // Apply all sanitization rules
  for (const rule of compiledRules) {
    sanitized = sanitized.replace(rule.pattern, rule.replace)
  }

  return sanitized
}

/**
 * Sanitizes a stack trace by replacing dynamic values with placeholders.
 *
 * @param stack - The stack trace string to sanitize.
 * @returns The sanitized stack trace, or undefined if input is undefined.
 */
export function sanitizeStackTrace(stack: string | undefined): string | undefined {
  if (!stack) return undefined

  let sanitized = stack

  // Apply sanitization rules to the stack trace
  for (const rule of compiledRules) {
    sanitized = sanitized.replace(rule.pattern, rule.replace)
  }

  return sanitized
}
