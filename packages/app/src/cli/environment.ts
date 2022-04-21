import {environmentVariables} from './constants'
import {environment} from '@shopify/cli-kit'

/**
 * Returns whether we should run the extensions' CLI through the sources.
 * @param env {NodeJS.ProcesEnv} Environment object containing the environment variables.
 * @returns True if the CLI should run the extensions' CLI through its sources.
 */
export function useExtensionsCLISources(env = process.env): boolean {
  return environment.utilities.isTruthy(env[environmentVariables.useExtensionsCLISources])
}
