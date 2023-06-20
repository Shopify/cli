/**
 * Returns whether an environment variable value represents a truthy value.
 *
 * @param variable - Environment variable value to check.
 * @returns True when the value is truthy, e.g. '1', 'true', etc.
 */
export function isTruthy(variable: string | undefined): boolean {
  if (!variable) {
    return false
  }
  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(variable)
}
