import constants from '../constants'
import {captureOutput} from '../system'

import {isTruthy} from './utilities'

/**
 * When ran in a Spin environment, it returns the fqdn of the instance.
 * @returns {string} fqdn of the Spin environment.
 */
export async function fqdn(env = process.env): Promise<string> {
  const spinInstance = await instance(env)
  const showResponse = await show(spinInstance === undefined)
  return showResponse.fqdn
}

/**
 * Runs "spin show" and returns the JSON-parsed output.
 * @param {latest} Whether to pass --latest when running the command.
 * @returns The JSON-parsed output of the Spin CLI.
 * @throws Any error raised from the underlying Spin CLI.
 */
export async function show(latest: boolean): Promise<{fqdn: string}> {
  const args = latest ? ['show', '--latest', '--json'] : ['show', '--json']
  const output = await captureOutput('spin', args)
  return JSON.parse(output)
}

/**
 * Returns true if the CLI is running in a Spin environment.
 * @param env {[key: string]: string} Environment variables
 * @returns {boolean} True if the CLI is running in a Spin environment.
 */
export function isSpin(env = process.env): boolean {
  return isTruthy(env[constants.environmentVariables.spin])
}

/**
 * Returns the value of the SPIN_INSTANCE environment variable.
 * @param env {[key: string]: string} Environment variables
 * @returns {string | undefined} The value of the SPIN_INSTANCE environment variable.
 */
export function instance(env = process.env): string | undefined {
  return env[constants.environmentVariables.spinInstance]
}

/**
 * Returns the value of the SPIN_WORKSPACE environment variable.
 * @param env {[key: string]: string} Environment variables
 * @returns {string | undefined} The value of the SPIN_WORKSPACE environment variable.
 */
export function workspace(env = process.env): string | undefined {
  return env[constants.environmentVariables.spinWorkspace]
}

/**
 * Returns the value of the SPIN_NAMESPACE environment variable.
 * @param env {[key: string]: string} Environment variables
 * @returns {string | undefined} The value of the SPIN_NAMESPACE environment variable.
 */
export function namespace(env = process.env): string | undefined {
  return env[constants.environmentVariables.spinNamespace]
}

/**
 * Returns the value of the SPIN_HOST environment variable.
 * @param env {[key: string]: string} Environment variables
 * @returns {string | undefined} The value of the SPIN_HOST environment variable.
 */
export function host(env = process.env): string | undefined {
  return env[constants.environmentVariables.spinHost]
}
