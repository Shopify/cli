import {environmentVariables} from '../constants.js'

const SERVICE_ACCOUNT_TOKEN = environmentVariables.serviceAccountToken
const APP_TOKEN = environmentVariables.appAutomationToken
const PARTNERS_TOKEN = environmentVariables.partnersToken

interface AutomationTokenVariablesProblem {
  message: string
  tryMessage: string
}

/**
 * Returns the name of the automation token variable the CLI authenticates with: the first one that is set, in
 * the order SHOPIFY_SERVICE_ACCOUNT_TOKEN, SHOPIFY_APP_AUTOMATION_TOKEN, SHOPIFY_CLI_PARTNERS_TOKEN.
 *
 * A variable set to an empty string still counts as set, so `automationTokenVariablesProblem` can report it.
 *
 * @param env - Environment variables to read.
 * @returns The variable name, or undefined when none of them is set.
 */
export function automationTokenVariable(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return [SERVICE_ACCOUNT_TOKEN, APP_TOKEN, PARTNERS_TOKEN].find((name) => env[name] !== undefined)
}

/**
 * Returns the `env_auth_method` analytics value for the automation token variable the CLI authenticates with:
 * `service_account_token` for SHOPIFY_SERVICE_ACCOUNT_TOKEN, and `partners_token` for SHOPIFY_APP_AUTOMATION_TOKEN and
 * SHOPIFY_CLI_PARTNERS_TOKEN, which existing dashboards already expect.
 *
 * @param env - Environment variables to read.
 * @returns The auth method to report.
 */
export function automationTokenAuthMethod(
  env: NodeJS.ProcessEnv = process.env,
): 'service_account_token' | 'partners_token' {
  return automationTokenVariable(env) === SERVICE_ACCOUNT_TOKEN ? 'service_account_token' : 'partners_token'
}

/**
 * Whether the CLI authenticates with SHOPIFY_APP_AUTOMATION_TOKEN, which is deprecated in favor of
 * SHOPIFY_SERVICE_ACCOUNT_TOKEN. False when the variables can't be used, since the CLI reports that problem instead.
 *
 * @param env - Environment variables to read.
 * @returns True when the CLI uses SHOPIFY_APP_AUTOMATION_TOKEN.
 */
export function isAppAutomationTokenVariableInUse(env: NodeJS.ProcessEnv = process.env): boolean {
  return automationTokenVariable(env) === APP_TOKEN && !automationTokenVariablesProblem(env)
}

/**
 * Explains why the automation token variables can't be used, so a misconfigured environment fails instead of
 * falling back to the logged-in user.
 *
 * - SHOPIFY_SERVICE_ACCOUNT_TOKEN can't be set together with SHOPIFY_APP_AUTOMATION_TOKEN or
 *   SHOPIFY_CLI_PARTNERS_TOKEN.
 * - The selected variable can't be empty.
 *
 * @param env - Environment variables to check.
 * @returns The problem to report, or undefined when the variables can be used.
 */
export function automationTokenVariablesProblem(
  env: NodeJS.ProcessEnv = process.env,
): AutomationTokenVariablesProblem | undefined {
  if (env[SERVICE_ACCOUNT_TOKEN] !== undefined) {
    const conflictingVariables = [APP_TOKEN, PARTNERS_TOKEN].filter((name) => env[name] !== undefined)
    if (conflictingVariables.length > 0) {
      return {
        message: `${SERVICE_ACCOUNT_TOKEN} can't be set together with ${conflictingVariables.join(' or ')}.`,
        tryMessage: `Unset ${conflictingVariables.join(' and ')}, or unset ${SERVICE_ACCOUNT_TOKEN}.`,
      }
    }
  }

  const variable = automationTokenVariable(env)
  if (variable && env[variable] === '') {
    return {
      message: `${variable} is set but empty.`,
      tryMessage: 'Set it to an automation token, or unset it to log in with your Shopify account.',
    }
  }
  return undefined
}
