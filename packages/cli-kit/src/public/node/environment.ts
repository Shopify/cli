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
 * Returns the value of the SHOPIFY_CLI_PARTNERS_TOKEN environment variable.
 *
 * @returns Current process environment variables.
 */
export function getPartnersToken(): string | undefined {
  return getEnvironmentVariables()[environmentVariables.partnersToken]
}

/**
 * Check if the current proccess is running using the partners token.
 *
 * @returns True if the current proccess is running using the partners token.
 */
export function usePartnersToken(): boolean {
  return getPartnersToken() !== undefined
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
 * Returns the information of the identity token.
 *
 * @returns The identity token information in case it exists.
 */
export function getIdentityTokenInformation(): {accessToken: string; refreshToken: string} | undefined {
  const identityToken = getEnvironmentVariables()[environmentVariables.identityToken]
  const refreshToken = getEnvironmentVariables()[environmentVariables.refreshToken]
  if (!identityToken || !refreshToken) return undefined
  return {
    accessToken: identityToken,
    refreshToken,
  }
}
