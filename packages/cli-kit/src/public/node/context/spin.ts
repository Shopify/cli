import {isTruthy} from './utilities.js'
import {fileExists, readFileSync} from '../fs.js'
import {environmentVariables} from '../../../private/node/constants.js'
import {captureOutput} from '../system.js'
import {outputContent, outputToken} from '../output.js'
import {getCachedSpinFqdn, setCachedSpinFqdn} from '../../../private/node/context/spin-cache.js'
import {AbortError} from '../error.js'
import {Environment, serviceEnvironment} from '../../../private/node/context/service.js'

const SpinInstanceNotFoundMessages = (spinInstance: string | undefined, error: string) => {
  const errorMessage = outputContent`${outputToken.genericShellCommand(
    `spin`,
  )} yielded the following error trying to obtain the fully qualified domain name of the Spin instance:
${error}
  `
  let nextSteps: string | undefined
  if (spinInstance) {
    nextSteps = `Make sure ${spinInstance} is the instance name and not a fully qualified domain name`
  }
  return {errorMessage, nextSteps}
}

const spinFqdnFilePath = '/etc/spin/machine/fqdn'

/**
 * When ran in a Spin environment, it returns the fqdn of the instance.
 *
 * Will cache the value of the Spin FQDN during the execution of the CLI.
 * To avoid multiple calls to `readSync` or `show`.
 *
 * @param env - Environment variables.
 * @returns Fqdn of the Spin environment.
 */
export async function spinFqdn(env = process.env): Promise<string> {
  let spinFqdn = getCachedSpinFqdn()
  if (spinFqdn) return spinFqdn

  if (await fileExists(spinFqdnFilePath)) {
    spinFqdn = await readFileSync(spinFqdnFilePath).toString()
  } else {
    const spinInstance = await instance(env)
    const showResponse = await show(spinInstance, env)

    spinFqdn = showResponse.fqdn
  }
  setCachedSpinFqdn(spinFqdn)
  return spinFqdn
}

/**
 * Runs "spin show" and returns the JSON-parsed output.
 *
 * @param spinInstance - When it's undefined, we'll fetch the latest one.
 * @param env - Environment variables.
 * @returns The JSON-parsed output of the Spin CLI.
 * @throws Any error raised from the underlying Spin CLI.
 */
export async function show(spinInstance: string | undefined, env = process.env): Promise<{fqdn: string}> {
  const latest = spinInstance === undefined
  const args = latest ? ['show', '--latest', '--json'] : ['show', '--json']
  const output = await captureOutput('spin', args, {env})
  const json = JSON.parse(output)
  if (json.error) {
    const {errorMessage, nextSteps} = SpinInstanceNotFoundMessages(spinInstance, json.error)
    throw new AbortError(errorMessage, nextSteps)
  } else {
    return json
  }
}

/**
 * Returns true if the CLI is running in a Spin environment.
 *
 * @param env - Environment variables.
 * @returns True if the CLI is running in a Spin environment.
 */
export function isSpin(env = process.env): boolean {
  return isTruthy(env[environmentVariables.spin])
}

/**
 * Returns the value of the SPIN_INSTANCE environment variable.
 *
 * @param env - Environment variables.
 * @returns The value of the SPIN_INSTANCE environment variable.
 */
export function instance(env = process.env): string | undefined {
  return env[environmentVariables.spinInstance]
}

/**
 * Returns true if the CLI is running in a Spin environment.
 *
 * @param env - Environment variables.
 * @returns True if the CLI is running in a Spin environment.
 */
export function isSpinEnvironment(env = process.env): boolean {
  return serviceEnvironment(env) === Environment.Spin
}

/**
 * Returns the value of the SERVER_PORT environment variable.
 *
 * @param env - Environment variables.
 * @returns The value of the SERVER_PORT environment variable.
 */
export function appPort(env = process.env): number | undefined {
  const port = Number(env[environmentVariables.spinAppPort])
  return (!isNaN(port) && port) || undefined
}

/**
 * Returns the value of the SPIN_APP_HOST environment variable.
 *
 * @param env - Environment variables.
 * @returns The value of the SPIN_APP_HOST environment variable.
 */
export function appHost(env = process.env): string | undefined {
  return env[environmentVariables.spinAppHost]
}
