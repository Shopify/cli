import {isSpin} from '../../../public/node/environment/spin.js'
import constants from '../../../constants.js'

/**
 * Enum that represents the environment to use for a given service.
 *
 * @readonly
 */
export enum Environment {
  Local = 'local',
  Production = 'production',
  Spin = 'spin',
}

/**
 * Returns the environment to use for a given service.
 *
 * @param env - Environment variables.
 * @returns The environment to use for a given service.
 */
export function serviceEnvironment(env = process.env): Environment {
  const value = env[constants.environmentVariables.serviceEnv]
  if (value === 'local') {
    return Environment.Local
  } else if (value === 'spin' || isSpin(env)) {
    return Environment.Spin
  } else {
    return Environment.Production
  }
}
