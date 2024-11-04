import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI} from './is-global.js'
import {packageManagerFromUserAgent} from './node-package-manager.js'
import {outputContent, outputToken} from './output.js'

/**
 * Utility function for generating an install command for the user to run
 * to install an updated version of Shopify CLI.
 *
 * @returns A string with the command to run.
 */
export function cliInstallCommand(): string {
  return cliInstallCommandAsArray().join(' ')
}

/**
 * Utility function for generating an install command for the user to run
 * to install an updated version of Shopify CLI. Returns as an array of strings.
 *
 * @returns A string array with the command to run.
 */
export function cliInstallCommandAsArray(): [string, ...string[]] {
  const isGlobal = currentProcessIsGlobal()
  let packageManager = packageManagerFromUserAgent()
  // packageManagerFromUserAgent() will return 'unknown' if it can't determine the package manager
  if (packageManager === 'unknown') {
    packageManager = inferPackageManagerForGlobalCLI()
  }
  // inferPackageManagerForGlobalCLI() will also return 'unknown' if it can't determine the package manager
  if (packageManager === 'unknown') packageManager = 'npm'

  if (packageManager === 'yarn') {
    return [
      packageManager,
      ...(isGlobal ? ['global'] : []),
      'add',
      '@shopify/cli@latest',
    ]
  } else {
    return [
      packageManager,
      packageManager === 'pnpm' ? 'add' : 'install',
      ...(isGlobal ? ['-g'] : []),
      '@shopify/cli@latest',
    ]
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
