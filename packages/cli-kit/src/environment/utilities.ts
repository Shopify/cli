/**
 * Returns whether an environment variable value represents a truthy value.
 */
export function isTruthy(variable: string | undefined): boolean {
  if (!variable) {
    return false
  }
  return ['1', 'true', 'TRUE', 'yes', 'YES'].includes(variable)
}

/**
 * Returns whether an environment variable has been set and is non-empty
 */
export function isSet(variable: string | undefined): boolean {
  if (variable === undefined || variable.trim() === '') {
    return false
  }
  return true
}
