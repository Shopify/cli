import {isSpin} from './spin.js'
import {isTruthy} from './utilities.js'
import {getCIMetadata, isSet, Metadata} from '../../../private/node/context/utilities.js'
import {environmentVariables, pathConstants} from '../../../private/node/constants.js'
import {fileExists} from '../fs.js'
import {exec} from '../system.js'
import isInteractive from 'is-interactive'
import macaddress from 'macaddress'
import {homedir} from 'os'

/**
 * It returns true if the terminal is interactive.
 *
 * @returns True if the terminal is interactive.
 */
export function isTerminalInteractive(): boolean {
  return isInteractive()
}

/**
 * Returns the path to the user's home directory.
 *
 * @returns The path to the user's home directory.
 */
export function homeDirectory(): string {
  return homedir()
}

/**
 * Returns true if the CLI is running in debug mode.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True if SHOPIFY_ENV is development.
 */
export function isDevelopment(env = process.env): boolean {
  return env[environmentVariables.env] === 'development'
}

/**
 * Returns true if the CLI is running in verbose mode.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True if SHOPIFY_FLAG_VERBOSE is truthy or the flag --verbose has been passed.
 */
export function isVerbose(env = process.env): boolean {
  return isTruthy(env[environmentVariables.verbose]) || process.argv.includes('--verbose')
}

/**
 * Returns true if the environment in which the CLI is running is either
 * a local environment (where dev is present) or a cloud environment (spin).
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True if the CLI is used in a Shopify environment.
 */
export async function isShopify(env = process.env): Promise<boolean> {
  if (Object.prototype.hasOwnProperty.call(env, environmentVariables.runAsUser)) {
    return !isTruthy(env[environmentVariables.runAsUser])
  }
  const devInstalled = await fileExists(pathConstants.executables.dev)
  return devInstalled || isSpin(env)
}

/**
 * This variable is used when running unit tests to indicate that the CLI's business logic
 * is run as a subject of a unit test. We can use this variable to disable output through
 * the standard streams.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True if the SHOPIFY_UNIT_TEST environment variable is truthy.
 */
export function isUnitTest(env = process.env): boolean {
  return isTruthy(env[environmentVariables.unitTest])
}

/**
 * Returns true if reporting analytics is enabled.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True unless SHOPIFY_CLI_NO_ANALYTICS is truthy or debug mode is enabled.
 */
export function analyticsDisabled(env = process.env): boolean {
  return isTruthy(env[environmentVariables.noAnalytics]) || isDevelopment(env)
}

/**
 * Returns true if reporting analytics should always happen, regardless of DEBUG mode etc.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True if SHOPIFY_CLI_ALWAYS_LOG_ANALYTICS is truthy.
 */
export function alwaysLogAnalytics(env = process.env): boolean {
  return isTruthy(env[environmentVariables.alwaysLogAnalytics])
}

/**
 * Returns true if reporting metrics should always happen, regardless of DEBUG mode etc.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True if SHOPIFY_CLI_ALWAYS_LOG_METRICS is truthy.
 */
export function alwaysLogMetrics(env = process.env): boolean {
  return isTruthy(env[environmentVariables.alwaysLogMetrics])
}

/**
 * Returns true if the CLI User is 1P.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True if SHOPIFY_CLI_1P is truthy.
 */
export function firstPartyDev(env = process.env): boolean {
  return isTruthy(env[environmentVariables.firstPartyDev])
}

/**
 * Returns true if the CLI should use device auth.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns True if SHOPIFY_CLI_DEVICE_AUTH is truthy or the CLI is run from a cloud environment.
 */
export function useDeviceAuth(env = process.env): boolean {
  return isTruthy(env[environmentVariables.deviceAuth]) || isCloudEnvironment(env)
}

/**
 * Returns true if the CLI should use theme bundling.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns False if SHOPIFY_CLI_NO_THEME_BUNDLING is truthy.
 */
export function useThemebundling(env = process.env): boolean {
  return !isTruthy(env[environmentVariables.noThemeBundling])
}

/**
 * Returns true if the embedded CLI will be used for theme commands.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns False if SHOPIFY_CLI_BUNDLED_THEME_CLI is truthy.
 */
export function useEmbeddedThemeCLI(env = process.env): boolean {
  return !isTruthy(env[environmentVariables.bundledThemeCLI])
}

/**
 * Return gitpodURL if we are running in gitpod.
 * Https://www.gitpod.io/docs/environment-variables#default-environment-variables.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns The gitpod URL.
 */
export function gitpodURL(env = process.env): string | undefined {
  return env[environmentVariables.gitpod]
}

/**
 * Return codespaceURL if we are running in codespaces.
 * Https://docs.github.com/en/codespaces/developing-in-codespaces/default-environment-variables-for-your-codespace#list-of-default-environment-variables.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns The codespace URL.
 */
export function codespaceURL(env = process.env): string | undefined {
  return env[environmentVariables.codespaceName]
}

/**
 * Return codespacePortForwardingDomain if we are running in codespaces.
 * Https://docs.github.com/en/codespaces/developing-in-codespaces/default-environment-variables-for-your-codespace#list-of-default-environment-variables.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns The codespace port forwarding domain.
 */
export function codespacePortForwardingDomain(env = process.env): string | undefined {
  return env[environmentVariables.codespacePortForwardingDomain]
}

/**
 * Checks if the CLI is run from a cloud environment.
 *
 * @param env - Environment variables used when the cli is launched.
 * @returns True in case the CLI is run from a cloud environment.
 */
export function isCloudEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return cloudEnvironment(env).platform !== 'localhost'
}

/**
 * Returns the cloud environment platform name and if the platform support online IDE in case the CLI is run from one of
 * them. Platform name 'localhost' is returned otherwise.
 *
 * @param env - Environment variables used when the cli is launched.
 * @returns Cloud platform information.
 */
export function cloudEnvironment(env: NodeJS.ProcessEnv = process.env): {
  platform: 'spin' | 'codespaces' | 'gitpod' | 'cloudShell' | 'localhost'
  editor: boolean
} {
  if (isSet(env[environmentVariables.codespaces])) {
    return {platform: 'codespaces', editor: true}
  }
  if (isSet(env[environmentVariables.gitpod])) {
    return {platform: 'gitpod', editor: true}
  }
  if (isSet(env[environmentVariables.cloudShell])) {
    return {platform: 'cloudShell', editor: true}
  }
  if (isSpin(env)) {
    return {platform: 'spin', editor: false}
  }
  return {platform: 'localhost', editor: false}
}

/**
 * Returns whether the environment has Git available.
 *
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
 * Gets info on the CI platform the CLI is running on, if applicable.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns The CI platform info.
 */
export function ciPlatform(
  env = process.env,
): {isCI: true; name: string; metadata: Metadata} | {isCI: false; name?: undefined; metadata?: undefined} {
  if (isTruthy(env.CI)) {
    let name = 'unknown'
    if (isSet(env.BITBUCKET_BUILD_NUMBER)) {
      name = 'bitbucket'
    } else if (isTruthy(env.CIRCLECI)) {
      name = 'circleci'
    } else if (isSet(env.GITHUB_ACTION)) {
      name = 'github'
    } else if (isTruthy(env.GITLAB_CI)) {
      name = 'gitlab'
    }

    return {
      isCI: true,
      name,
      metadata: getCIMetadata(name, env),
    }
  }
  return {
    isCI: false,
  }
}

/**
 * Returns the first mac address found.
 *
 * @returns Mac address.
 */
export function macAddress(): Promise<string> {
  return macaddress.one()
}

/**
 * Get the domain to send OTEL metrics to.
 *
 * It can be overridden via the SHOPIFY_CLI_OTEL_EXPORTER_OTLP_ENDPOINT environment variable.
 *
 * @param env - The environment variables from the environment of the current process.
 * @returns The domain to send OTEL metrics to.
 */
export function opentelemetryDomain(env = process.env): string | undefined {
  if (isSet(env[environmentVariables.otelURL])) {
    return env[environmentVariables.otelURL]
  }
  return 'https://otlp-http-production-cli.shopifysvc.com'
}

export type CIMetadata = Metadata
