import {environmentVariables} from '../constants.js'

const ORGANIZATION_TOKEN = environmentVariables.organizationAutomationToken
const APP_TOKEN = environmentVariables.appAutomationToken
const PARTNERS_TOKEN = environmentVariables.partnersToken

interface AutomationTokenVariablesProblem {
  message: string
  tryMessage: string
}

/**
 * Returns the name of the automation token variable the CLI authenticates with: the first one that is set, in
 * the order SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN, SHOPIFY_APP_AUTOMATION_TOKEN, SHOPIFY_CLI_PARTNERS_TOKEN.
 *
 * A variable set to an empty string still counts as set, so `automationTokenVariablesProblem` can report it.
 *
 * @param env - Environment variables to read.
 * @returns The variable name, or undefined when none of them is set.
 */
export function automationTokenVariable(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return [ORGANIZATION_TOKEN, APP_TOKEN, PARTNERS_TOKEN].find((name) => env[name] !== undefined)
}

/**
 * Explains why the automation token variables can't be used, so a misconfigured environment fails instead of
 * falling back to the logged-in user.
 *
 * - SHOPIFY_ORGANIZATION_AUTOMATION_TOKEN can't be set together with SHOPIFY_APP_AUTOMATION_TOKEN or
 *   SHOPIFY_CLI_PARTNERS_TOKEN.
 * - The selected variable can't be empty.
 *
 * @param env - Environment variables to check.
 * @returns The problem to report, or undefined when the variables can be used.
 */
export function automationTokenVariablesProblem(
  env: NodeJS.ProcessEnv = process.env,
): AutomationTokenVariablesProblem | undefined {
  if (env[ORGANIZATION_TOKEN] !== undefined) {
    const conflictingVariables = [APP_TOKEN, PARTNERS_TOKEN].filter((name) => env[name] !== undefined)
    if (conflictingVariables.length > 0) {
      return {
        message: `${ORGANIZATION_TOKEN} can't be set together with ${conflictingVariables.join(' or ')}.`,
        tryMessage: `Unset ${conflictingVariables.join(' and ')}, or unset ${ORGANIZATION_TOKEN}.`,
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
