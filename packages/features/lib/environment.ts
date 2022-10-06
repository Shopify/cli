/**
 * Given an environment variable, it returns true if its value represents a truthy value.
 * @param value - The environment variable value or undefined if it's not defined.
 * @returns True if the variable represents a truthy value.
 */
function isTruthy(value: string | undefined): boolean {
  if (!value) {
    return false
  }
  return ['TRUE', 'true', 'YES', 'yes', '1'].includes(value)
}

/** Returns true if acceptance tests are run with DEBUG=1 */
export const isDebug = isTruthy(process.env.DEBUG)

/** Returns true if the acceptance tests are running on CI */
export const isCI = isTruthy(process.env.CI)
