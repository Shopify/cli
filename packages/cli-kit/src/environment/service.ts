import {
  partners as partnersEnvironment,
  shopify as shopifyEnvironment,
  identity as identityEnvironment,
  dms as dmsEnvironment,
} from './service.js'
import {Environment, Service} from '../network/service.js'
import constants from '../constants.js'

export async function environmentForService(service: Service): Promise<Environment> {
  let environment: Environment
  switch (service) {
    case 'identity':
      environment = await identityEnvironment()
      break
    case 'partners':
      environment = await partnersEnvironment()
      break
    case 'shopify':
      environment = await shopifyEnvironment()
      break
    case 'dms':
      environment = await dmsEnvironment()
      break
  }
  return environment
}

/**
 * Given an environment variable that represents the environment to use for a given serve,
 * it returns the environment as a enum;
 * @param value The environment variable value.
 * @returns {Environment} representing the environment to use.
 */
function service(value: undefined | string): Environment {
  if (value === 'local') {
    return Environment.Local
  } else if (value === 'spin') {
    return Environment.Spin
  } else {
    return Environment.Production
  }
}

/**
 * Returns the environment to be used for the interactions with the partners' CLI API.
 * @param env The environment variables from the environment of the current process.
 */
export function partners(env = process.env): Environment {
  return service(env[constants.environmentVariables.partnersEnv])
}

/**
 * Returns the environment to be used for the interactions with the admin API.
 * @param env The environment variables from the environment of the current process.
 */
export function shopify(env = process.env): Environment {
  return service(env[constants.environmentVariables.shopifyEnv])
}

/**
 * Returns the environment to be used for the interactions with identity.
 * @param env The environment variables from the environment of the current process.
 */
export function identity(env = process.env): Environment {
  return service(env[constants.environmentVariables.identityEnv])
}

/**
 * Returns the environment to be used for the interactions with dms.
 * @param env The environment variables from the environment of the current process.
 */
export function dms(env = process.env): Environment {
  return service(env[constants.environmentVariables.dmsEnv])
}
