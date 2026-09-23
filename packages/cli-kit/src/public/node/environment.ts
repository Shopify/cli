import {nonRandomUUID} from './crypto.js'
import {AbortError} from './error.js'
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

export interface AutomationToken {
  value: string
  source: 'organization' | 'app' | 'partners'
}

/**
 * Selects the automation token to use for authentication.
 *
 * Organization and app automation tokens are mutually exclusive because they represent different
 * authentication subjects. The deprecated Partners token remains a fallback for compatibility.
 *
 * @param env - Environment variables to select the token from.
 * @returns The selected automation token and its source, or undefined if none is set.
 * @throws AbortError when both organization and app automation tokens are set.
 */
export function getAutomationToken(env = getEnvironmentVariables()): AutomationToken | undefined {
  const organizationToken = nonEmptyEnvironmentVariable(env[environmentVariables.organizationAutomationToken])
  const appToken = nonEmptyEnvironmentVariable(env[environmentVariables.appAutomationToken])
  const partnersToken = nonEmptyEnvironmentVariable(env[environmentVariables.partnersToken])

  if (organizationToken && appToken) {
    throw new AbortError(
      "SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN and SHOPIFY_APP_AUTOMATION_TOKEN can't both be set.",
      'Unset one of the automation token environment variables and try again.',
    )
  }

  if (organizationToken) return {value: organizationToken, source: 'organization'}
  if (appToken) return {value: appToken, source: 'app'}
  if (partnersToken) return {value: partnersToken, source: 'partners'}
  return undefined
}

/**
 * Returns the selected automation token value.
 *
 * Prefer getAutomationToken when the token source is needed.
 *
 * @returns The selected automation token value, or undefined if none is set.
 */
export function getAppAutomationToken(): string | undefined {
  return getAutomationToken()?.value
}

function nonEmptyEnvironmentVariable(value: string | undefined): string | undefined {
  if (value === '') return undefined
  return value
}

/**
 * Returns the value of the organization id from the environment variables.
 *
 * @returns True if the current proccess is running using the partners token.
 */
export function getOrganization(): string | undefined {
  return getEnvironmentVariables()[environmentVariables.organization]
}

function parseEnvNumber(value: string | undefined): number | undefined {
  if (value && !isNaN(Number(value))) {
    return Number(value)
  }
  return undefined
}

/**
 * Return the backend port value.
 *
 * @returns The port as a number. Undefined otherwise.
 */
export function getBackendPort(): number | undefined {
  return parseEnvNumber(getEnvironmentVariables()[systemEnvironmentVariables.backendPort])
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
 * @param argv - Command arguments to inspect for JSON flags.
 * @returns True if the JSON output is enabled, false otherwise.
 */
export function jsonOutputEnabled(environment = getEnvironmentVariables(), argv = process.argv): boolean {
  return sniffForJson(argv) || isTruthy(environment[environmentVariables.json])
}

/**
 * If true, the CLI should not use the network level retry.
 *
 * If there is an error when calling a network API that looks like a DNS or connectivity issue, the CLI will by default
 * automatically retry the request.
 *
 * @param environment - Process environment variables.
 * @returns True if the SHOPIFY_CLI_SKIP_NETWORK_LEVEL_RETRY environment variable is set.
 */
export function skipNetworkLevelRetry(environment = getEnvironmentVariables()): boolean {
  return isTruthy(environment[environmentVariables.skipNetworkLevelRetry])
}

/**
 * Returns the default maximum request time for network calls in milliseconds.
 *
 * After this long, API requests may be cancelled by an AbortSignal. The limit can be overridden by setting the
 * SHOPIFY_CLI_MAX_REQUEST_TIME_FOR_NETWORK_CALLS environment variable.
 *
 * @param environment - Process environment variables.
 * @returns The maximum request time in milliseconds.
 */
export function maxRequestTimeForNetworkCallsMs(environment = getEnvironmentVariables()): number {
  return parseEnvNumber(environment[environmentVariables.maxRequestTimeForNetworkCalls]) ?? 30 * 1000
}
