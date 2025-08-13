import {SANITIZATION_RULES} from './patterns.js'

/**
 * Pre-compile all regex patterns at module load time for better performance.
 * This avoids recompiling the same regex patterns on every sanitization call.
 * 
 * Each rule contains:
 * - pattern: The compiled RegExp object
 * - replace: The replacement template string (may contain $1, $2, etc. for capture groups)
 */
const preCompiledRules = SANITIZATION_RULES.map((rule) => ({
  pattern: new RegExp(rule.pattern.source, rule.pattern.flags),
  replace: rule.replace,
}))

/**
 * Normalizes capture groups from regex matches and applies them to a replacement template.
 * 
 * This function handles:
 * 1. Converting backslashes to forward slashes in file paths (Windows → Unix style)
 * 2. Substituting capture groups ($1, $2, etc.) in the replacement template
 * 
 * @param groups - Array of captured groups from the regex match
 * @param replaceTemplate - Template string that may contain $1, $2, etc. placeholders
 * @returns The replacement string with all placeholders substituted
 * 
 * @example
 * // For a pattern that captures a prefix and a UUID:
 * // groups: ['request_id: ', 'abc123...']
 * // replaceTemplate: '$1<REQUEST_ID>'
 * // returns: 'request_id: <REQUEST_ID>'
 */
function normalizeCaptureGroups(groups: unknown[], replaceTemplate: string): string {
  // Normalize backslashes to forward slashes in all string groups (for Windows paths)
  const normalizedGroups = groups.map((group) => (typeof group === 'string' ? group.replace(/\\/g, '/') : group))

  // Replace each capture group placeholder ($1, $2, etc.) with the actual captured value
  let replacement = replaceTemplate
  normalizedGroups.forEach((group, index) => {
    if (typeof group === 'string') {
      // Replace $1 with groups[0], $2 with groups[1], etc.
      replacement = replacement.replace(`$${index + 1}`, group)
    }
  })
  return replacement
}

/**
 * Sanitizes an error message by replacing dynamic values with placeholders.
 * 
 * This function applies a series of sanitization rules to remove sensitive or
 * variable data from error messages, making them suitable for grouping and
 * aggregation. Rules are applied in order, so more specific patterns should
 * come before general ones in the SANITIZATION_RULES array.
 * 
 * The sanitization process:
 * 1. Each rule's regex pattern is applied to the current message
 * 2. If the pattern has capture groups and the replacement uses them ($1, $2, etc.),
 *    the capture groups are processed through normalizeCaptureGroups
 * 3. Otherwise, the replacement is used directly
 * 4. Rules are applied sequentially, each working on the output of the previous
 *
 * @param message - The error message to sanitize.
 * @returns The sanitized message with dynamic values replaced by placeholders.
 * 
 * @example
 * sanitizeErrorMessage('Failed to connect to my-store.myshopify.com:3000')
 * // Returns: 'Failed to connect to <STORE>.myshopify.com:<PORT>'
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return ''

  // Use reduce to apply each sanitization rule sequentially
  return preCompiledRules.reduce((sanitized, rule) => 
    sanitized.replace(rule.pattern, (_match, ...groups) => {
      // If the pattern has capture groups and the replacement template uses them,
      // process the groups to handle path normalization and placeholder substitution
      if (groups.length > 0 && rule.replace.includes('$1')) {
        return normalizeCaptureGroups(groups, rule.replace)
      }
      // For simple replacements without capture groups, use the replacement directly
      return rule.replace
    }), 
    message
  )
}
