import constants from '../constants';

import {isTruthy} from './utilities';

/**
 * Returns true if the CLI is running in a Spin environment.
 * @param env {[key: string]: string} Environment variables
 * @returns {boolean} True if the CLI is running in a Spin environment.
 */
export function isSpin(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.spin]);
}

/**
 * Returns the value of the SPIN_INSTANCE environment variable.
 * @param env {[key: string]: string} Environment variables
 * @returns {string | undefined} The value of the SPIN_INSTANCE environment variable.
 */
export function instance(env = process.env): string | undefined {
  return env[constants.environmentVariables.spinInstance];
}

/**
 * Returns the value of the SPIN_WORKSPACE environment variable.
 * @param env {[key: string]: string} Environment variables
 * @returns {string | undefined} The value of the SPIN_WORKSPACE environment variable.
 */
export function workspace(env = process.env): string | undefined {
  return env[constants.environmentVariables.spinWorkspace];
}

/**
 * Returns the value of the SPIN_NAMESPACE environment variable.
 * @param env {[key: string]: string} Environment variables
 * @returns {string | undefined} The value of the SPIN_NAMESPACE environment variable.
 */
export function namespace(env = process.env): string | undefined {
  return env[constants.environmentVariables.spinNamespace];
}

/**
 * Returns the value of the SPIN_HOST environment variable.
 * @param env {[key: string]: string} Environment variables
 * @returns {string | undefined} The value of the SPIN_HOST environment variable.
 */
export function host(env = process.env): string | undefined {
  return env[constants.environmentVariables.spinHost];
}
