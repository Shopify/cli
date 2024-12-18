import {versionSatisfies} from '../node/node-package-manager.js'
import {captureOutput} from '../node/system.js'

/**
 * Returns the version of the local dependency of the CLI if it's installed in the provided directory.
 *
 * @param directory - Path of the project to look for the dependency.
 * @returns The CLI version or undefined if the dependency is not installed.
 */
export async function localCLIVersion(directory: string): Promise<string | undefined> {
  try {
    const output = await captureOutput('npm', ['list', '@shopify/cli'], {cwd: directory})
    return output.match(/@shopify\/cli@([\w.-]*)/)?.[1]
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

/**
 * Returns the version of the globally installed CLI, only if it's greater than 3.59.0 (when the global CLI was introduced).
 *
 * @returns The version of the CLI if it is globally installed or undefined.
 */
export async function globalCLIVersion(): Promise<string | undefined> {
  try {
    const env = {...process.env, SHOPIFY_CLI_NO_ANALYTICS: '1'}
    const version = await captureOutput('shopify', ['version'], {env})
    if (versionSatisfies(version, `>=3.59.0`)) {
      return version
    }
    return undefined
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}
