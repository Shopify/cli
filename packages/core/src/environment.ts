import constants from './constants';

/** Values that represent a true value */
const truthyValues = ['1', 'true', 'TRUE', 'yes', 'YES'];

/**
 * Returns true if the given environment variable represents a truthy value.
 */
function isTruthy(value: undefined | string): boolean {
  if (!value) {
    return false;
  }
  return truthyValues.includes(value);
}

/**
 * Returns true if the CLI is running in debug mode.
 * @param env The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_CLI_DEBUG is truthy
 */
export function isDebug(env = process.env): boolean | undefined {
  return isTruthy(env[constants.environmentVariables.debug]);
}
