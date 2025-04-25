import {PackageManager} from './node-package-manager.js'
import {outputInfo} from './output.js'
import {captureOutput, exec, terminalSupportsPrompting} from './system.js'
import {renderSelectPrompt} from './ui.js'

/**
 * Returns true if the current process is running in a global context.
 *
 * @param argv - The arguments passed to the process.
 * @returns `true` if the current process is running in a global context.
 */
export function currentProcessIsGlobal(argv = process.argv): boolean {
  const currentExecutable = argv[1] ?? ''
  return !currentExecutable.includes('node_modules')
}

/**
 * Returns true if the global CLI is installed.
 *
 * @returns `true` if the global CLI is installed.
 */
export async function isGlobalCLIInstalled(): Promise<boolean> {
  try {
    const env = {...process.env, SHOPIFY_CLI_NO_ANALYTICS: '1'}
    const output = await captureOutput('shopify', ['app'], {env})
    // Installed if `app dev` is available globally
    return output.includes('app dev')
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
export async function installGlobalShopifyCLI(packageManager: PackageManager): Promise<void> {
  const args =
    packageManager === 'yarn' ? ['global', 'add', '@shopify/cli@latest'] : ['install', '-g', '@shopify/cli@latest']
  outputInfo(`Running ${packageManager} ${args.join(' ')}...`)
  await exec(packageManager, args, {stdio: 'inherit'})
}

export interface InstallGlobalCLIPromptResult {
  install: boolean
  alreadyInstalled: boolean
}
/**
 * Prompts the user to install the global CLI.
 *
 * @returns `true` if the user has installed the global CLI.
 */
export async function installGlobalCLIPrompt(): Promise<InstallGlobalCLIPromptResult> {
  if (!terminalSupportsPrompting()) return {install: false, alreadyInstalled: false}
  if (await isGlobalCLIInstalled()) {
    return {install: false, alreadyInstalled: true}
  }
  const result = await renderSelectPrompt({
    message: 'We recommend installing Shopify CLI globally in your system. Would you like to install it now?',
    choices: [
      {value: 'yes', label: 'Yes'},
      {value: 'no', label: 'No, just for this project'},
    ],
  })

  return {install: result === 'yes', alreadyInstalled: false}
}

/**
 * Infers the package manager used by the global CLI.
 *
 * @param argv - The arguments passed to the process.
 * @returns The package manager used by the global CLI.
 */
export function inferPackageManagerForGlobalCLI(argv = process.argv): PackageManager {
  if (!currentProcessIsGlobal(argv)) return 'unknown'

  // argv[1] contains the path of the executed binary
  const processArgv = argv[1] ?? ''
  if (processArgv.includes('yarn')) return 'yarn'
  if (processArgv.includes('pnpm')) return 'pnpm'
  if (processArgv.includes('bun')) return 'bun'
  return 'npm'
}
