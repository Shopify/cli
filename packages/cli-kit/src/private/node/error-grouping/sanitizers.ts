import {SANITIZATION_RULES} from './patterns.js'

const preCompiledRules = SANITIZATION_RULES.map((rule) => ({
  pattern: new RegExp(rule.pattern.source, rule.pattern.flags),
  replace: rule.replace,
}))

function normalizeCaptureGroups(groups: unknown[], replaceTemplate: string): string {
  const normalizedGroups = groups.map((group) => (typeof group === 'string' ? group.replace(/\\/g, '/') : group))

  let replacement = replaceTemplate
  normalizedGroups.forEach((group, index) => {
    if (typeof group === 'string') {
      replacement = replacement.replace(`$${index + 1}`, group)
    }
  })
  return replacement
}

/**
 * Sanitizes an error message by replacing dynamic values with placeholders.
 *
 * @param message - The error message to sanitize.
 * @returns The sanitized message with dynamic values replaced.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return ''

  let sanitized = message

  for (const rule of preCompiledRules) {
    sanitized = sanitized.replace(rule.pattern, (_match, ...groups) => {
      if (groups.length > 0 && rule.replace.includes('$1')) {
        return normalizeCaptureGroups(groups, rule.replace)
      }
      return rule.replace
    })
  }

  return sanitized
}
