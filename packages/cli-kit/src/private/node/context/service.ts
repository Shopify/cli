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

/**
 * Returns true if the environment is local.
 *
 * @param env - Environment variables.
 * @returns True if the environment is local.
 */
export function isLocalEnvironment(env = process.env): boolean {
  return serviceEnvironment(env) === Environment.Local
}
