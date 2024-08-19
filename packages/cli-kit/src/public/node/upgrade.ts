import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI} from './is-global.js'
import {packageManagerFromUserAgent} from './node-package-manager.js'
import {outputContent, outputToken} from './output.js'

/**
 * Utility function for generating an install command for the user to run
 * to install an updated version of Shopify CLI.
 * @returns A string with the command to run.
 */
export function cliInstallCommand(): string {
  const isGlobal = currentProcessIsGlobal()
  let packageManager = packageManagerFromUserAgent() ?? inferPackageManagerForGlobalCLI()
  if (packageManager === 'unknown') packageManager = 'npm'

  if (packageManager === 'yarn') {
    return `yarn ${isGlobal ? 'global ' : ''}add @shopify/cli@latest`
  } else {
    return `${packageManager} i ${isGlobal ? '-g ' : ''}@shopify/cli@latest`
  }
}

/**
 * Generates a message to remind the user to update the CLI.
 *
 * @param version - The version to update to.
 * @returns The message to remind the user to update the CLI.
 */
export function getOutputUpdateCLIReminder(version: string): string {
  return outputContent`💡 Version ${version} available! Run ${outputToken.genericShellCommand(cliInstallCommand())}`
    .value
}
