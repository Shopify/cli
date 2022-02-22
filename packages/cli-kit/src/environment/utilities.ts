/**
 * Returns whether an environment variable value represents a truthy value.
 * @param variable {string | undefined} Given a environment variable value, it returns true if it represents a truthy value.
 * @returns {boolean}
 */
export function isTruthy(variable: string | undefined): boolean {
  if (!variable) {
    return false
  }
  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(variable)
}
