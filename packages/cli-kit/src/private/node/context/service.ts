import {environmentVariables} from '../constants.js'

/**
 * Enum that represents the environment to use for a given service.
 *
 * @readonly
 */
export enum Environment {
  Local = 'local',
  Production = 'production',
}

/**
 * Returns the environment to use for a given service.
 *
 * @param env - Environment variables.
 * @returns The environment to use for a given service.
 */
export function serviceEnvironment(env = process.env): Environment {
  const value = env[environmentVariables.serviceEnv]
  if (value === 'local') {
    return Environment.Local
  } else {
    return Environment.Production
  }
}
