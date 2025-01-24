import {nonRandomUUID} from './crypto.js'
import {isTruthy} from './context/utilities.js'
import {sniffForJson} from './path.js'
import {environmentVariables, systemEnvironmentVariables} from '../../private/node/constants.js'

/**
 * It returns the environment variables of the environment
 * where the Node process is running.
 *
 * This function exists to prevent the access of the process
 * global variable which is discouraged via the no-process-env
 * ESLint rule.
 *
 * @returns Current process environment variables.
 */
export function getEnvironmentVariables(): NodeJS.ProcessEnv {
  return process.env
}

/**
 * Returns the value of the organization id from the environment variables.
 *
 * @returns True if the current proccess is running using the partners token.
 */
export function getOrganization(): string | undefined {
  return getEnvironmentVariables()[environmentVariables.organization]
}

/**
 * Return the backend port value.
 *
 * @returns The port as a number. Undefined otherwise.
 */
export function getBackendPort(): number | undefined {
  const backendPort = getEnvironmentVariables()[systemEnvironmentVariables.backendPort]
  if (backendPort && !isNaN(Number(backendPort))) {
    return Number(backendPort)
  }
  return undefined
}

/**
 * Returns the information of the identity & refresh tokens, provided by environment variables.
 *
 * @returns The identity token information in case it exists.
 */
export function getIdentityTokenInformation(): {accessToken: string; refreshToken: string; userId: string} | undefined {
  const identityToken = getEnvironmentVariables()[environmentVariables.identityToken]
  const refreshToken = getEnvironmentVariables()[environmentVariables.refreshToken]
  if (!identityToken || !refreshToken) return undefined
  return {
    accessToken: identityToken,
    refreshToken,
    userId: nonRandomUUID(identityToken),
  }
}

/**
 * Checks if the JSON output is enabled via flag (--json or -j) or environment variable (SHOPIFY_FLAG_JSON).
 *
 * @param environment - Process environment variables.
 * @returns True if the JSON output is enabled, false otherwise.
 */
export function jsonOutputEnabled(environment = getEnvironmentVariables()): boolean {
  return sniffForJson() || isTruthy(environment[environmentVariables.json])
}
