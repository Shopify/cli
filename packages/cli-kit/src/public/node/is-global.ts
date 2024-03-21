import {PackageManager} from './node-package-manager.js'
import {outputInfo} from './output.js'
import {captureOutput, exec} from './system.js'
import {renderSelectPrompt} from './ui.js'

/**
 * Returns true if the current process is running in a global context.
 *
 * @param env - The environment to check. Defaults to `process.env`.
 * @returns `true` if the current process is running in a global context.
 */
export function currentProcessIsGlobal(env = process.env): boolean {
  // npm, yarn, pnpm and bun define this if run locally.
  // If undefined, we can assume it's global (But there is no foolproof way to know)
  return env.npm_config_user_agent === undefined
}

/**
 * Returns true if the global CLI is installed.
 *
 * @returns `true` if the global CLI is installed.
 */
export async function isGlobalCLIInstalled(): Promise<boolean> {
  try {
    await captureOutput('shopify', ['--help'])
    return true
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * Installs the global Shopify CLI, using the provided package manager.
 *
 * @param packageManager - The package manager to use.
 */
async function installGlobalShopifyCLI(packageManager: PackageManager): Promise<void> {
  const args =
    packageManager === 'yarn'
      ? ['global', 'add', '@shopify/cli@experimental']
      : ['install', '-g', '@shopify/cli@experimental']
  outputInfo(`Running ${packageManager} ${args.join(' ')}...`)
  await exec(packageManager, args, {stdio: 'inherit'})
}

/**
 * Prompts the user to install the global CLI.
 *
 * @param packageManager - The package manager to use.
 * @returns `true` if the user has installed the global CLI.
 */
export async function installGlobalCLIIfNeeded(packageManager: PackageManager): Promise<boolean> {
  if (await isGlobalCLIInstalled()) {
    return true
  }
  const globalResult = await renderSelectPrompt({
    message: 'We recommend installing Shopify CLI globally in your system. Would you like to install it now?',
    choices: [
      {value: 'yes', label: 'Yes'},
      {value: 'no', label: 'No, just for this project'},
    ],
  })

  if (globalResult === 'yes') {
    await installGlobalShopifyCLI(packageManager)
  }
  return globalResult === 'yes'
}
