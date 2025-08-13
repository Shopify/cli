import {SANITIZATION_RULES} from './patterns.js'

/**
 * Pre-compile all regex patterns at module load time for better performance.
 * This avoids recompiling the same regex patterns on every sanitization call.
 *
 * Each rule contains:
 * - pattern: The compiled RegExp object
 * - replace: The replacement template string (may contain $1, $2, etc. for capture groups)
 * - normalizeWindowsPaths: Optional flag for rules that need Windows path normalization
 */
const preCompiledRules = SANITIZATION_RULES.map((rule) => ({
  pattern: new RegExp(rule.pattern.source, rule.pattern.flags),
  replace: rule.replace,
  normalizeWindowsPaths: rule.normalizeWindowsPaths || false,
}))

/**
 * Applies a replacement pattern while normalizing Windows path separators.
 * Converts backslashes to forward slashes in captured groups before applying the replacement.
 *
 * @param match - The full matched string
 * @param groups - Captured groups from the regex match
 * @param replaceTemplate - The replacement template with $1, $2, etc. placeholders
 * @returns The replacement string with normalized path separators
 *
 * @example
 * // match: "Error in C:\\Users\\john\\node_modules\\express\\index.js"
 * // groups: ["Error in ", "express\\index.js"]
 * // replaceTemplate: "$1node_modules/$2"
 * // returns: "Error in node_modules/express/index.js"
 */
function applyWindowsPathNormalization(match: string, groups: unknown[], replaceTemplate: string): string {
  let result = replaceTemplate
  groups.forEach((group, index) => {
    if (typeof group === 'string') {
      // Convert backslashes to forward slashes for captured path segments
      const normalizedGroup = group.replace(/\\/g, '/')
      result = result.replace(`$${index + 1}`, normalizedGroup)
    }
  })
  return result
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
 * 2. For file path rules, backslashes are converted to forward slashes (Windows → Unix)
 * 3. JavaScript's native $1, $2 replacement handles capture groups automatically
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
  return preCompiledRules.reduce((sanitized, rule) => {
    // For file path rules that capture Windows paths, we need to normalize backslashes
    if (rule.normalizeWindowsPaths) {
      return sanitized.replace(rule.pattern, (match, ...groups) =>
        applyWindowsPathNormalization(match, groups, rule.replace),
      )
    }

    // For all other rules, use JavaScript's native replacement (handles $1, $2, etc. automatically)
    return sanitized.replace(rule.pattern, rule.replace)
  }, message)
}
