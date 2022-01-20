import constants from './constants';
import {Environment} from './network/service';

/**
 * Given an environment variable that represents the environment to use for a given serve,
 * it returns the environment as a enum;
 * @param value The environment variable value.
 * @returns {ServiceEnvironment} representing the environment to use.
 */
function serviceEnvironment(value: undefined | string): Environment {
  if (value === 'local') {
    return Environment.Local;
  } else if (value === 'spin') {
    return Environment.Spin;
  } else {
    return Environment.Production;
  }
}

/**
 * Returns true if the CLI is running in debug mode.
 * @param env The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_CLI_CONFIG is debug
 */
export function isDebug(env = process.env): boolean {
  return env[constants.environmentVariables.config] === 'debug';
}

/**
 * Returns true if the CLI is running in release mode.
 * @param env The environment variables from the environment of the current process.
 * @returns true if SHOPIFY_CLI_CONFIG isn't debug
 */
export function isRelease(env = process.env): boolean {
  return env[constants.environmentVariables.config] !== 'debug';
}

/**
 * Returns the environment to be used for the interactions with the partners' CLI API.
 * @param env The environment variables from the environment of the current process.
 */
export function partnersApiEnvironment(env = process.env): Environment {
  return serviceEnvironment(env[constants.environmentVariables.partnersApiEnv]);
}

/**
 * Returns the environment to be used for the interactions with the admin API.
 * @param env The environment variables from the environment of the current process.
 */
export function adminApiEnvironment(env = process.env): Environment {
  return serviceEnvironment(env[constants.environmentVariables.adminApiEnv]);
}

/**
 * Returns the environment to be used for the interactions with the storefront renderer API.
 * @param env The environment variables from the environment of the current process.
 */
export function storefrontRendererApiEnvironment(
  env = process.env,
): Environment {
  return serviceEnvironment(
    env[constants.environmentVariables.storefrontRendererApiEnv],
  );
}

/**
 * Returns the environment to be used for the interactions with identity.
 * @param env The environment variables from the environment of the current process.
 */
export function identityEnvironment(env = process.env): Environment {
  return serviceEnvironment(env[constants.environmentVariables.identityEnv]);
}
