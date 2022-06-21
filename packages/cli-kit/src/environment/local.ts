import {isTruthy} from './utilities'
import {isSpin} from './spin'
import constants from '../constants'
import {exists as fileExists} from '../file'
import {exec} from '../system'
import isInteractive from 'is-interactive'
import {homedir} from 'node:os'

/**
 * It returns true if the terminal is interactive.
 * @returns {boolean} True if the terminal is interactive.
 */
export function isTerminalInteractive(): boolean {
  return isInteractive()
}

/**
 * Returns the path to the user's home directory.
 * @returns {string} The path to the user's home directory.
 */
export function homeDirectory(): string {
  return homedir()
}

/**
 * Returns true if the CLI is running in debug mode.
 * @param env The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_CONFIG is debug
 */
export function isDebug(env = process.env): boolean {
  return env[constants.environmentVariables.shopifyConfig] === 'debug'
}

/**
 * Returns true if the CLI is running in verbose mode.
 * @param env The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_FLAG_VERBOSE is truthy or the flag --verbose has been passed
 */
export function isVerbose(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.verbose]) || process.argv.includes('--verbose')
}

/**
 * Returns true if the environment in which the CLI is running is either
 * a local environment (where dev is present) or a cloud environment (spin).
 * @returns {boolean} True if the CLI is used in a Shopify environment.
 */
export async function isShopify(env = process.env): Promise<boolean> {
  if (env[constants.environmentVariables.runAsUser]) {
    return !isTruthy(env[constants.environmentVariables.runAsUser])
  }
  const devInstalled = await fileExists(constants.paths.executables.dev)
  return devInstalled || isSpin()
}

/**
 * This variable is used when running unit tests to indicate that the CLI's business logic
 * is run as a subject of a unit test. We can use this variable to disable output through
 * the standard streams.
 * @param env The environment variables from the environment of the current process.
 * @returns True if the SHOPIFY_UNIT_TEST environment variable is truthy.
 */
export function isUnitTest(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.unitTest])
}

/**
 * Returns true if reporting analytics is enabled.
 * @param env The environment variables from the environment of the current process.
 * @returns true unless SHOPIFY_CLI_NO_ANALYTICS is truthy.
 */
export function analyticsDisabled(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.noAnalytics])
}

/**
 * Returns whether the environment has Git available.
 * @returns {Promise<boolean>} A promise that resolves with the value.
 */
export async function hasGit(): Promise<boolean> {
  try {
    await exec('git', ['--version'])
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}
