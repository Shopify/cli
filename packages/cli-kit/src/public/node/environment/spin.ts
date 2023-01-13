import {isTruthy} from '../../../private/node/environment/utilities.js'
import constants from '../../../constants.js'
import {captureOutput} from '../system.js'
import {content, token} from '../../../output.js'
import {exists, readSync} from '../../../file.js'
import {getCachedSpinFqdn, setCachedSpinFqdn} from '../../../private/node/environment/spin-cache.js'
import {Abort} from '../../../error.js'
import {Environment, serviceEnvironment} from '../../../private/node/environment/service.js'

const SpinInstanceNotFoundMessages = (spinInstance: string | undefined, error: string) => {
  const errorMessage = content`${token.genericShellCommand(
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

  if (await exists(spinFqdnFilePath)) {
    spinFqdn = await readSync(spinFqdnFilePath).toString()
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
    throw new Abort(errorMessage, nextSteps)
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
  return isTruthy(env[constants.environmentVariables.spin])
}

/**
 * Returns the value of the SPIN_INSTANCE environment variable.
 *
 * @param env - Environment variables.
 * @returns The value of the SPIN_INSTANCE environment variable.
 */
export function instance(env = process.env): string | undefined {
  return env[constants.environmentVariables.spinInstance]
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
