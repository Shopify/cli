import {isTruthy} from './context/utilities.js'

/**
 * Returns true if the REMOTE_DOM_EXPERIMENT environment variable is set to true.
 *
 * @returns `true` if the REMOTE_DOM_EXPERIMENT environment variable is set to true.
 */
export function isRemoteDomExperimentEnabled(): boolean {
  return isTruthy(process.env.REMOTE_DOM_EXPERIMENT)
}
