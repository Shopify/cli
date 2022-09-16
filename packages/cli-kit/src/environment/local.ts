import {isTruthy, isSet} from './utilities.js'
import {isSpin} from './spin.js'
import constants from '../constants.js'
import {exists as fileExists} from '../file.js'
import {exec} from '../system.js'
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
 * @returns true if SHOPIFY_ENV is development
 */
export function isDevelopment(env = process.env): boolean {
  return env[constants.environmentVariables.env] === 'development'
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
  if (Object.prototype.hasOwnProperty.call(env, constants.environmentVariables.runAsUser)) {
    return !isTruthy(env[constants.environmentVariables.runAsUser])
  }
  const devInstalled = await fileExists(constants.paths.executables.dev)
  return devInstalled || isSpin(env)
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
 * @returns true unless SHOPIFY_CLI_NO_ANALYTICS is truthy or debug mode is enabled.
 */
export function analyticsDisabled(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.noAnalytics]) || isDevelopment(env)
}

/** Returns true if reporting analytics should always happen, regardless of DEBUG mode etc. */
export function alwaysLogAnalytics(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.alwaysLogAnalytics])
}

export function firstPartyDev(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.firstPartyDev])
}

export function isDebugGoBinary(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.debugGoBinary])
}

export function useDeviceAuth(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.deviceAuth]) || isCloudEnvironment(env)
}

// https://www.gitpod.io/docs/environment-variables#default-environment-variables
export function gitpodURL(env = process.env): string | undefined {
  return env[constants.environmentVariables.gitpod]
}

// https://docs.github.com/en/codespaces/developing-in-codespaces/default-environment-variables-for-your-codespace#list-of-default-environment-variables
export function codespaceURL(env = process.env): string | undefined {
  return env[constants.environmentVariables.codespaceName]
}

// https://docs.github.com/en/codespaces/developing-in-codespaces/default-environment-variables-for-your-codespace#list-of-default-environment-variables
export function codesandboxHost(env = process.env): string | undefined {
  return env[constants.environmentVariables.codesandboxHost]
}

export function isCloudEnvironment(env = process.env): boolean {
  return isCodespaces(env) || isGitpod(env) || isCodesandbox(env) || isSpin(env)
}

function isCodespaces(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.codespaces])
}

function isGitpod(env = process.env): boolean {
  return isSet(env[constants.environmentVariables.gitpod])
}

function isCodesandbox(env = process.env): boolean {
  return isSet(env[constants.environmentVariables.codesandboxHost])
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

/**
 * Gets info on the CI platform the CLI is running on, if applicable
 */
export function ciPlatform(env = process.env): {isCI: true; name: string} | {isCI: false; name?: undefined} {
  if (isTruthy(env.CI)) {
    let name = 'unknown'
    if (isTruthy(env.CIRCLECI)) {
      name = 'circleci'
    } else if (isSet(env.GITHUB_ACTION)) {
      name = 'github'
    } else if (isTruthy(env.GITLAB_CI)) {
      name = 'gitlab'
    }

    return {
      isCI: true,
      name,
    }
  }
  return {
    isCI: false,
  }
}

/**
 * Gets info on the Web IDE platform the CLI is running on, if applicable
 */
export function webIDEPlatform(env = process.env) {
  if (isCodespaces(env)) return 'codespaces'
  if (isGitpod(env)) return 'gitpod'
  return undefined
}
