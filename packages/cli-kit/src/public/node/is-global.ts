import {PackageManager} from './node-package-manager.js'
import {outputInfo} from './output.js'
import {cwd, dirname, joinPath, sniffForPath} from './path.js'
import {exec, terminalSupportsPrompting} from './system.js'
import {renderSelectPrompt} from './ui.js'
import {globalCLIVersion} from './version.js'
import {isUnitTest} from './context/local.js'
import {findPathUpSync, globSync} from './fs.js'
import {realpathSync} from 'fs'

let _isGlobal: boolean | undefined

/**
 * Returns true if the current process is running in a global context.
 *
 * @param argv - The arguments passed to the process.
 * @returns `true` if the current process is running in a global context.
 */
export function currentProcessIsGlobal(argv = process.argv): boolean {
  // If we are running tests, we need to disable the cache
  try {
    if (_isGlobal !== undefined && !isUnitTest()) return _isGlobal

    // Path where the current project is (app/hydrogen)
    const path = sniffForPath() ?? cwd()

    const projectDir = getProjectDir(path)
    if (!projectDir) {
      return true
    }

    // From node docs: "The second element [of the array] will be the path to the JavaScript file being executed"
    const binDir = argv[1] ?? ''

    // If binDir starts with packageJsonPath, then we are running a local CLI
    const isLocal = binDir.startsWith(projectDir.trim())

    _isGlobal = !isLocal
    return _isGlobal
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
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
  if (await globalCLIVersion()) {
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
 * @param env - The environment variables of the process.
 * @returns The package manager used by the global CLI.
 */
export function inferPackageManagerForGlobalCLI(argv = process.argv, env = process.env): PackageManager {
  if (!currentProcessIsGlobal(argv)) return 'unknown'

  // Check for Homebrew first (most reliable via environment variable)
  if (env.SHOPIFY_HOMEBREW_FORMULA) {
    return 'homebrew'
  }

  // argv[1] contains the path of the executed binary
  const processArgv = argv[1] ?? ''

  // Resolve symlinks to get the real path of the binary.
  // This prevents misdetection when a symlink exists in a Homebrew directory
  // but points to a different package manager's installation (e.g., yarn global).
  let realPath = processArgv.toLowerCase()
  try {
    realPath = realpathSync(processArgv).toLowerCase()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // If realpath fails (e.g., file doesn't exist, permission denied),
    // fall back to using the original path for detection
  }

  // Check package managers using the resolved real path first
  if (realPath.includes('yarn')) return 'yarn'
  if (realPath.includes('pnpm')) return 'pnpm'
  if (realPath.includes('bun')) return 'bun'

  // Check for Homebrew via Cellar path (resolved symlink)
  if (realPath.includes('/cellar/')) return 'homebrew'

  // Check for Homebrew via HOMEBREW_PREFIX (using original path)
  const homebrewPrefix = env.HOMEBREW_PREFIX
  if (homebrewPrefix && processArgv.startsWith(homebrewPrefix)) return 'homebrew'

  // Default to npm for global installs that don't match any other package manager
  return 'npm'
}

/**
 * Returns the project directory for the given path.
 *
 * @param directory - The path to the directory to get the project directory for.
 * @returns The project directory for the given path.
 */
export function getProjectDir(directory: string): string | undefined {
  const configFiles = ['shopify.app{,.*}.toml', 'hydrogen.config.js', 'hydrogen.config.ts']
  const existsConfigFile = (directory: string) => {
    const configPaths = globSync(configFiles.map((file) => joinPath(directory, file)))
    return configPaths.length > 0 ? configPaths[0] : undefined
  }
  try {
    const configFile = findPathUpSync(existsConfigFile, {
      cwd: directory,
      type: 'file',
    })
    if (configFile) return dirname(configFile)
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return undefined
  }
}
