import {isTruthy} from './context/utilities.js'

/**
 * Returns true if the POLARIS_UNIFIED environment variable is set to true.
 *
 * @returns `true` if the POLARIS_UNIFIED environment variable is set to true.
 */
export function isPolarisUnifiedEnabled(): boolean {
  return isTruthy(process.env.POLARIS_UNIFIED)
}
