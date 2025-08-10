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
    sanitized = sanitized.replace(rule.pattern, (_match, ...groups) => {
      // If there are capture groups and this is a path-related pattern
      if (groups.length > 0 && rule.replace.includes('$1')) {
        // Normalize backslashes to forward slashes in captured paths
        const normalizedGroups = groups.map((group) => (typeof group === 'string' ? group.replace(/\\/g, '/') : group))
        // Replace $1, $2, etc. with normalized groups
        let replacement = rule.replace
        normalizedGroups.forEach((group, index) => {
          if (typeof group === 'string') {
            replacement = replacement.replace(`$${index + 1}`, group)
          }
        })
        return replacement
      }
      // For patterns without capture groups, use the original replace string
      return rule.replace
    })
  }

  return sanitized
}

