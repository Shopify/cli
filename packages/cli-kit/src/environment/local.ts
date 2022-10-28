import {isTruthy, isSet} from './utilities.js'
import {isSpin} from './spin.js'
import constants from '../constants.js'
import {exists as fileExists} from '../file.js'
import {exec} from '../system.js'
import isInteractive from 'is-interactive'
import macaddress from 'macaddress'
import {homedir} from 'node:os'

/**
 * It returns true if the terminal is interactive.
 * @returns True if the terminal is interactive.
 */
export function isTerminalInteractive(): boolean {
  return isInteractive()
}

/**
 * Returns the path to the user's home directory.
 * @returns The path to the user's home directory.
 */
export function homeDirectory(): string {
  return homedir()
}

/**
 * Returns true if the CLI is running in debug mode.
 * @param env - The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_ENV is development
 */
export function isDevelopment(env = process.env): boolean {
  return env[constants.environmentVariables.env] === 'development'
}

/**
 * Returns true if the CLI is running in verbose mode.
 * @param env - The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_FLAG_VERBOSE is truthy or the flag --verbose has been passed
 */
export function isVerbose(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.verbose]) || process.argv.includes('--verbose')
}

/**
 * Returns true if the environment in which the CLI is running is either
 * a local environment (where dev is present) or a cloud environment (spin).
 * @returns True if the CLI is used in a Shopify environment.
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
 * @param env - The environment variables from the environment of the current process.
 * @returns True if the SHOPIFY_UNIT_TEST environment variable is truthy.
 */
export function isUnitTest(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.unitTest])
}

/**
 * Returns true if reporting analytics is enabled.
 * @param env - The environment variables from the environment of the current process.
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

export function useDeviceAuth(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.deviceAuth]) || isCloudEnvironment(env)
}

export function useFunctionMatching(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.functionMatching])
}

// https://www.gitpod.io/docs/environment-variables#default-environment-variables
export function gitpodURL(env = process.env): string | undefined {
  return env[constants.environmentVariables.gitpod]
}

// https://docs.github.com/en/codespaces/developing-in-codespaces/default-environment-variables-for-your-codespace#list-of-default-environment-variables
export function codespaceURL(env = process.env): string | undefined {
  return env[constants.environmentVariables.codespaceName]
}

/**
 * Checks if the CLI is run from a cloud environment
 *
 * @param env - Environment variables used when the cli is launched
 *
 * @returns True in case the CLI is run from a cloud environment
 */
export function isCloudEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return cloudEnvironment(env).platform !== 'localhost'
}

/**
 * Returns the cloud environment platform name and if the platform support online IDE in case the CLI is run from one of
 * them. Platform name 'localhost' is returned otherwise
 *
 * @param env - Environment variables used when the cli is launched
 *
 * @returns Cloud platform information
 */
export function cloudEnvironment(env: NodeJS.ProcessEnv = process.env): {
  platform: 'spin' | 'codespaces' | 'gitpod' | 'localhost'
  editor: boolean
} {
  if (isSet(env[constants.environmentVariables.codespaces])) {
    return {platform: 'codespaces', editor: true}
  }
  if (isSet(env[constants.environmentVariables.gitpod])) {
    return {platform: 'gitpod', editor: true}
  }
  if (isSpin(env)) {
    return {platform: 'spin', editor: false}
  }
  return {platform: 'localhost', editor: false}
}

/**
 * Returns whether the environment has Git available.
 * @returns A promise that resolves with the value.
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
 * Returns the first mac address found
 *
 * @returns Mac address
 */
export function macAddress() {
  return macaddress.one()
}
