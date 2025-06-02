import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI} from './is-global.js'
import {packageManagerFromUserAgent} from './node-package-manager.js'

/**
 * Utility function for generating an install command for the user to run
 * to install an updated version of Shopify CLI.
 *
 * @returns A string with the command to run.
 */
export function cliInstallCommand(): string {
  const isGlobal = currentProcessIsGlobal()
  let packageManager = packageManagerFromUserAgent()
  // packageManagerFromUserAgent() will return 'unknown' if it can't determine the package manager
  if (packageManager === 'unknown') {
    packageManager = inferPackageManagerForGlobalCLI()
  }
  // inferPackageManagerForGlobalCLI() will also return 'unknown' if it can't determine the package manager
  if (packageManager === 'unknown') packageManager = 'npm'

  if (packageManager === 'yarn') {
    return `${packageManager} ${isGlobal ? 'global ' : ''}add @shopify/cli@latest`
  } else {
    const verb = packageManager === 'pnpm' ? 'add' : 'install'
    return `${packageManager} ${verb} ${isGlobal ? '-g ' : ''}@shopify/cli@latest`
  }
}

/**
 * Generates a message to remind the user to update the CLI.
 *
 * @param version - The version to update to.
 * @returns The message to remind the user to update the CLI.
 */
export function getOutputUpdateCLIReminder(version: string): string {
  return `💡 Version ${version} available! Run \`${cliInstallCommand()}\``
}
