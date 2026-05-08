import {cwd, dirname, isSubpath, joinPath, sniffForPath} from './path.js'
import {isUnitTest} from './context/local.js'
import {findPathUpSync, globSync, fileExistsSync} from './fs.js'
import {realpathSync} from 'fs'
import type {PackageManager} from './node-package-manager.js'

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
    if (!binDir) {
      return true
    }

    // If binDir lives inside projectDir, we are running a local CLI.
    // Use isSubpath (pathe.relative under the hood) instead of a raw
    // string startsWith: projectDir flows through normalizePath and is
    // forward-slash on every platform, while argv[1] is OS-native, so on
    // Windows it arrives backslash-separated and a naive startsWith would
    // misclassify a local install as global.
    const isLocal = isSubpath(projectDir.trim(), binDir)

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
  const {outputInfo} = await import('./output.js')
  const {exec} = await import('./system.js')
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
  const {terminalSupportsPrompting} = await import('./system.js')
  if (!terminalSupportsPrompting()) return {install: false, alreadyInstalled: false}
  const {globalCLIVersion} = await import('./version.js')
  if (await globalCLIVersion()) {
    return {install: false, alreadyInstalled: true}
  }
  const {renderSelectPrompt} = await import('./ui.js')
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

  const processArgv = argv[1] ?? ''
  const symlinkPath = processArgv.toLowerCase()

  // Resolve symlinks to get the real path of the binary.
  let realPath = symlinkPath
  try {
    realPath = realpathSync(processArgv).toLowerCase()
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    // fall back to using the original path for detection
  }

  // Inspect both the (unresolved) symlink path and the resolved real path. Some
  // package managers — notably bun (`~/.bun/bin/<name>`) — install global binaries
  // as symlinks pointing into a generic `node_modules` directory whose real path
  // no longer contains the package manager name. The original symlink under the
  // PM's bin dir is the most reliable signal in that case.
  const matches = (needle: string) => realPath.includes(needle) || symlinkPath.includes(needle)

  if (matches('yarn')) return 'yarn'
  if (matches('pnpm')) return 'pnpm'
  if (matches('bun')) return 'bun'

  // Check for Homebrew via Cellar path (resolved symlink)
  if (realPath.includes('/cellar/')) return 'homebrew'

  return 'npm'
}

/**
 * Returns the project directory for the given path.
 *
 * @param directory - The path to search upward from.
 * @returns The project root directory, or undefined if not found.
 */
export function getProjectDir(directory: string): string | undefined {
  // Performance: Check for the most common config files first using fileExistsSync (fast-path)
  // to avoid the overhead of globbing/directory scanning in the common case.
  const configFiles = ['shopify.app.toml', 'hydrogen.config.js', 'hydrogen.config.ts']
  const existsConfigFile = (directory: string) => {
    for (const file of configFiles) {
      const configPath = joinPath(directory, file)
      if (fileExistsSync(configPath)) return configPath
    }

    // Fallback to glob for custom app config files or if fast-path files were not found.
    const configPaths = globSync(joinPath(directory, 'shopify.app.*.toml'))
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
