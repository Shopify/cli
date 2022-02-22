import constants from '../constants'

import {isTruthy} from './utilities'

/**
 * Returns true if the CLI is running in debug mode.
 * @param env The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_CONFIG is debug
 */
export function isDebug(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.debug])
}
