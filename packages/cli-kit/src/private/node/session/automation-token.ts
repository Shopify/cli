import {environmentVariables} from '../constants.js'

/**
 * The environment variable an automation token was read from.
 */
type AutomationTokenSource = 'app' | 'partners'

interface AutomationToken {
  value: string
  source: AutomationTokenSource
}

/**
 * Reads the automation token from the environment without validating it, so it never throws.
 *
 * Telemetry reads the token through this function because reporting must not fail a command.
 * Authentication reads it through `getAutomationToken`.
 *
 * SHOPIFY_APP_AUTOMATION_TOKEN takes precedence over the deprecated SHOPIFY_CLI_PARTNERS_TOKEN whenever it is
 * set, even to an empty value. An empty value means no token.
 *
 * @param env - Environment variables to read the token from.
 * @returns The automation token and the variable it came from, or undefined when there is none.
 */
export function peekAutomationToken(env: NodeJS.ProcessEnv = process.env): AutomationToken | undefined {
  const appToken = env[environmentVariables.appAutomationToken]
  if (appToken !== undefined) return appToken === '' ? undefined : {value: appToken, source: 'app'}

  const partnersToken = env[environmentVariables.partnersToken]
  return partnersToken ? {value: partnersToken, source: 'partners'} : undefined
}

/**
 * Selects the automation token to authenticate with.
 *
 * @param env - Environment variables to read the token from.
 * @returns The automation token and the variable it came from, or undefined when there is none.
 */
export function getAutomationToken(env: NodeJS.ProcessEnv = process.env): AutomationToken | undefined {
  return peekAutomationToken(env)
}
