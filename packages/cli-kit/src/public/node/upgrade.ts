import {isDevelopment} from './context/local.js'
import {currentProcessIsGlobal, inferPackageManagerForGlobalCLI, getProjectDir} from './is-global.js'
import {
  checkForCachedNewVersion,
  findUpAndReadPackageJson,
  PackageJson,
  checkForNewVersion,
  DependencyType,
  usesWorkspaces,
  addNPMDependencies,
  getPackageManager,
} from './node-package-manager.js'
import {outputContent, outputDebug, outputInfo, outputToken, outputWarn} from './output.js'
import {cwd, moduleDirectory, sniffForPath} from './path.js'
import {exec, isCI} from './system.js'
import {isPreReleaseVersion} from './version.js'
import {getAutoUpgradeEnabled, setAutoUpgradeEnabled, runAtMinimumInterval} from '../../private/node/conf-store.js'
import {CLI_KIT_VERSION} from '../common/version.js'

export {getAutoUpgradeEnabled, setAutoUpgradeEnabled}

/**
 * Utility function for generating an install command for the user to run
 * to install an updated version of Shopify CLI.
 *
 * @returns A string with the command to run, or undefined if the package manager cannot be determined.
 */
export function cliInstallCommand(): string | undefined {
  const packageManager = inferPackageManagerForGlobalCLI()
  if (!packageManager || packageManager === 'unknown') return undefined

  if (packageManager === 'homebrew') {
    return 'brew upgrade shopify-cli'
  } else if (packageManager === 'yarn') {
    return `${packageManager} global add @shopify/cli@latest`
  } else {
    const verb = packageManager === 'pnpm' ? 'add' : 'install'
    return `${packageManager} ${verb} -g @shopify/cli@latest`
  }
}

/**
 * Runs the CLI upgrade using the appropriate package manager.
 * Determines the install command and executes it.
 *
 * @throws AbortError if the package manager or command cannot be determined.
 */
export async function runCLIUpgrade(): Promise<void> {
  // Path where the current project is (app/hydrogen)
  const path = sniffForPath() ?? cwd()
  const projectDir = getProjectDir(path)

  // Check if we are running in a global context if not, return
  const isGlobal = currentProcessIsGlobal()

  // Don't auto-upgrade for development mode
  if (!isGlobal && isDevelopment()) {
    outputInfo('Skipping upgrade in development mode.')
    return
  }

  // Generate the install command for the global CLI and execute it
  if (isGlobal) {
    const installCommand = cliInstallCommand()
    if (!installCommand) {
      throw new Error('Could not determine the package manager')
    }
    const [command, ...args] = installCommand.split(' ')
    if (!command) {
      throw new Error('Could not determine the command to run')
    }
    outputInfo(outputContent`Upgrading Shopify CLI by running: ${outputToken.genericShellCommand(installCommand)}...`)
    await exec(command, args, {stdio: 'inherit'})
  } else if (projectDir) {
    await upgradeLocalShopify(projectDir, CLI_KIT_VERSION)
  } else {
    throw new Error('Could not determine the local project directory')
  }
}

/**
 * Returns the version to auto-upgrade to, or undefined if auto-upgrade should be skipped.
 * Auto-upgrade is enabled by default and can be disabled via `setAutoUpgradeEnabled(false)`.
 * Also skips for CI, pre-release versions, or when no newer version is available.
 *
 * @returns The version string to upgrade to, or undefined if no upgrade should happen.
 */
export function versionToAutoUpgrade(): string | undefined {
  const currentVersion = CLI_KIT_VERSION
  const newerVersion = checkForCachedNewVersion('@shopify/cli', currentVersion)
  if (!newerVersion) {
    outputDebug('Auto-upgrade: No newer version available.')
    return undefined
  }
  if (process.env.SHOPIFY_CLI_FORCE_AUTO_UPGRADE === '1') {
    outputDebug('Auto-upgrade: Forcing auto-upgrade because of SHOPIFY_CLI_FORCE_AUTO_UPGRADE.')
    return newerVersion
  }
  if (!getAutoUpgradeEnabled()) {
    outputDebug('Auto-upgrade: Skipping because auto-upgrade is not enabled.')
    return undefined
  }
  if (isCI()) {
    outputDebug('Auto-upgrade: Skipping auto-upgrade in CI.')
    return undefined
  }
  if (isPreReleaseVersion(currentVersion)) {
    outputDebug('Auto-upgrade: Skipping auto-upgrade for pre-release version.')
    return undefined
  }
  return newerVersion
}

/**
 * Shows a daily upgrade-available warning for users who have not enabled auto-upgrade.
 * Skipped in CI and for pre-release versions. When auto-upgrade is enabled this is a no-op
 * because the postrun hook will handle the upgrade directly.
 */
export async function warnIfUpgradeAvailable(): Promise<void> {
  if (isCI() || isPreReleaseVersion(CLI_KIT_VERSION) || getAutoUpgradeEnabled()) return

  const newerVersion = checkForCachedNewVersion('@shopify/cli', CLI_KIT_VERSION)
  if (!newerVersion) return

  await runAtMinimumInterval('warn-on-available-upgrade', {days: 1}, async () => {
    outputWarn(getOutputUpdateCLIReminder(newerVersion))
  })
}

/**
 * Generates a message to remind the user to update the CLI.
 * For major version bumps, appends a link to the GitHub release notes so users
 * can review breaking changes before deciding to upgrade.
 *
 * @param version - The version to update to.
 * @param isMajor - Whether the version bump is a major version change.
 * @returns The message to remind the user to update the CLI.
 */
export function getOutputUpdateCLIReminder(version: string, isMajor = false): string {
  const installCommand = cliInstallCommand()
  const base = installCommand
    ? outputContent`💡 Version ${version} available! Run ${outputToken.genericShellCommand(installCommand)}`.value
    : outputContent`💡 Version ${version} available!`.value

  if (isMajor) {
    const releaseUrl = `https://github.com/Shopify/cli/releases/tag/${version}`
    const majorNotice =
      outputContent`⚠️  This is a major version — review breaking changes before upgrading:\n   ${outputToken.link(releaseUrl, releaseUrl)}`
        .value
    return `${base}\n\n${majorNotice}`
  }

  return base
}

async function upgradeLocalShopify(projectDir: string, currentVersion: string) {
  const packageJson = (await findUpAndReadPackageJson(projectDir)).content
  const packageJsonDependencies = packageJson.dependencies ?? {}
  const packageJsonDevDependencies = packageJson.devDependencies ?? {}
  const allDependencies = {...packageJsonDependencies, ...packageJsonDevDependencies}

  let resolvedCLIVersion = allDependencies[await cliDependency()]
  if (!resolvedCLIVersion) {
    outputDebug('Auto-upgrade: CLI dependency not found in project dependencies, skipping local upgrade.')
    return
  }

  if (resolvedCLIVersion.slice(0, 1).match(/[\^~]/)) resolvedCLIVersion = currentVersion
  const newestCLIVersion = await checkForNewVersion(await cliDependency(), resolvedCLIVersion)

  if (newestCLIVersion) {
    outputUpgradeMessage(resolvedCLIVersion, newestCLIVersion)
  } else {
    outputWontInstallMessage(resolvedCLIVersion)
  }

  await installJsonDependencies('prod', packageJsonDependencies, projectDir)
  await installJsonDependencies('dev', packageJsonDevDependencies, projectDir)
}

async function installJsonDependencies(
  depsEnv: DependencyType,
  deps: {[key: string]: string},
  directory: string,
): Promise<void> {
  const packagesToUpdate = [await cliDependency(), ...(await oclifPlugins())]
    .filter((pkg: string): boolean => {
      const pkgRequirement: string | undefined = deps[pkg]
      return Boolean(pkgRequirement)
    })
    .map((pkg) => {
      return {name: pkg, version: 'latest'}
    })

  const appUsesWorkspaces = await usesWorkspaces(directory)

  if (packagesToUpdate.length > 0) {
    await addNPMDependencies(packagesToUpdate, {
      packageManager: await getPackageManager(directory),
      type: depsEnv,
      directory,
      stdout: process.stdout,
      stderr: process.stderr,
      addToRootDirectory: appUsesWorkspaces,
    })
  }
}

async function cliDependency(): Promise<string> {
  return (await packageJsonContents()).name
}

async function oclifPlugins(): Promise<string[]> {
  return (await packageJsonContents())?.oclif?.plugins ?? []
}

type PackageJsonWithName = Omit<PackageJson, 'name'> & {name: string}
let _packageJsonContents: PackageJsonWithName | undefined

async function packageJsonContents(): Promise<PackageJsonWithName> {
  if (!_packageJsonContents) {
    const packageJson = await findUpAndReadPackageJson(moduleDirectory(import.meta.url))
    _packageJsonContents = _packageJsonContents ?? (packageJson.content as PackageJsonWithName)
  }
  return _packageJsonContents
}

function outputWontInstallMessage(currentVersion: string): void {
  outputInfo(outputContent`You're on the latest version, ${outputToken.yellow(currentVersion)}, no need to upgrade!`)
}

function outputUpgradeMessage(currentVersion: string, newestVersion: string): void {
  outputInfo(
    outputContent`Upgrading CLI from ${outputToken.yellow(currentVersion)} to ${outputToken.yellow(newestVersion)}...`,
  )
}
