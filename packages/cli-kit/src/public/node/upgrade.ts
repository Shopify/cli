import {fetchNotifications, filterNotifications} from './notifications-system.js'
import {isDevelopment} from './context/local.js'
import {
  currentProcessIsGlobal,
  inferPackageManagerForGlobalCLI,
  getProjectDir,
  getHomebrewCLIFormula,
} from './is-global.js'
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
import {presentUpgradeResult} from './upgrade/result.js'
import {execUpgradeCommand, upgradeOutputStreams} from './upgrade/output.js'
import {cwd, moduleDirectory, sniffForPath} from './path.js'
import {isCI} from './system.js'
import {globalCLIVersion, isPreReleaseVersion, isMajorVersionChange, availableHomebrewCLIVersion} from './version.js'
import {AbortError} from './error.js'
import {getAutoUpgradeEnabled, setAutoUpgradeEnabled, runAtMinimumInterval} from '../../private/node/conf-store.js'
import {CLI_KIT_VERSION} from '../common/version.js'
import {lt as semverLt, SemVer} from 'semver'
import type {UpgradeResult} from './upgrade/types.js'

export {getAutoUpgradeEnabled, setAutoUpgradeEnabled}

/**
 * Utility function for generating an install command for the user to run
 * to install an updated version of Shopify CLI.
 *
 * @param version - The version or dist-tag to install. Homebrew can't
 * install a specific version, so it always upgrades to the formula's current version.
 * @returns A string with the command to run, or undefined if the package manager cannot be determined.
 */
export function cliInstallCommand(version: string): string | undefined {
  const packageManager = inferPackageManagerForGlobalCLI()
  if (!packageManager || packageManager === 'unknown') return undefined

  if (packageManager === 'homebrew') {
    return `brew upgrade ${getHomebrewCLIFormula()}`
  } else if (packageManager === 'yarn') {
    return `${packageManager} global add @shopify/cli@${version}`
  } else {
    const verb = packageManager === 'pnpm' ? 'add' : 'install'
    return `${packageManager} ${verb} -g @shopify/cli@${version}`
  }
}

/**
 * Options for {@link runCLIUpgrade}.
 */
export interface RunCLIUpgradeOptions {
  /**
   * `true` when the upgrade is being triggered by the automatic postrun hook.
   * In that case we skip project-local upgrades — those should only happen when the
   * user explicitly runs `shopify upgrade` so we don't surprise them by mutating
   * their `package.json` / lockfile in the background.
   */
  autoupgrade?: boolean

  /**
   * The exact version to install. The auto-upgrade hook passes the version it already
   * vetted, such as one that isn't a major version change, so the install can't drift to
   * whatever `latest` points at by the time the package manager runs. When omitted, the
   * CLI installs `latest`.
   */
  version?: string
}

/**
 * Runs the CLI upgrade using the appropriate package manager.
 * Determines the install command and executes it.
 *
 * @param options - See {@link RunCLIUpgradeOptions}.
 * @throws AbortError if the package manager or command cannot be determined.
 */
export async function runCLIUpgrade(options: RunCLIUpgradeOptions = {}): Promise<void> {
  presentUpgradeResult(await upgradeCLI(options), 'text')
}

/**
 * Upgrades the CLI and returns the outcome independently of final presentation.
 *
 * @param options - Whether the upgrade was triggered automatically.
 * @returns The verified global version, local dependency update, or skip reason.
 */
export async function upgradeCLI(options: RunCLIUpgradeOptions = {}): Promise<UpgradeResult> {
  // Path where the current project is (app/hydrogen)
  const path = sniffForPath() ?? cwd()
  const projectDir = getProjectDir(path)

  // Check if we are running in a global context if not, return
  const isGlobal = currentProcessIsGlobal()

  // Don't auto-upgrade for development mode
  if (isDevelopment()) {
    outputInfo('Skipping upgrade in development mode.')
    return {status: 'skipped', reason: 'development', scope: isGlobal ? 'global' : 'local'}
  }

  // When triggered by the automatic postrun hook, skip project-local upgrades.
  // Bumping `package.json` / lockfile silently in the background would surprise users
  // and produce noisy diffs; explicit `shopify upgrade` invocations still upgrade the
  // local project.
  if (options.autoupgrade && !isGlobal) {
    return {status: 'skipped', reason: 'local-autoupgrade', scope: 'local'}
  }

  // Generate the install command for the global CLI and execute it
  if (isGlobal) {
    const packageManager = inferPackageManagerForGlobalCLI()
    const installCommand = cliInstallCommand(options.version ?? 'latest')
    if (!installCommand || packageManager === 'unknown') {
      throw new Error('Could not determine the package manager')
    }
    const [command, ...args] = installCommand.split(' ')
    if (!command) {
      throw new Error('Could not determine the command to run')
    }
    // Verify against the caller's target. Manual Homebrew upgrades follow the installed
    // formula, which can differ from npm's latest release.
    const newerVersion =
      options.version ??
      (packageManager === 'homebrew'
        ? await availableHomebrewCLIVersion()
        : checkForCachedNewVersion('@shopify/cli', CLI_KIT_VERSION))
    const headline = newerVersion
      ? `✨ New version of Shopify CLI available! (${CLI_KIT_VERSION} → ${newerVersion})`
      : '✨ New version of Shopify CLI available!'
    outputInfo(
      outputContent`${headline}
   Now upgrading by running: ${outputToken.genericShellCommand(installCommand)}...`,
    )
    // Use the same Homebrew formula metadata that the automatic upgrade hook checked.
    const execOptions =
      options.autoupgrade && packageManager === 'homebrew' ? {env: {HOMEBREW_NO_AUTO_UPDATE: '1'}} : {}
    await execUpgradeCommand(command, args, execOptions)

    // A zero exit code doesn't guarantee the right version landed: the version check above
    // queries the public npm registry, while the install goes through whatever registry the
    // user has configured. A private registry with a stale `latest` tag (or one that serves
    // stale metadata on auth errors) can "successfully" install an outdated version. Verify
    // what's actually installed before claiming success.
    // Versioned Homebrew formulas expose separate commands such as shopify4.
    const cliBinary =
      packageManager === 'homebrew' ? getHomebrewCLIFormula().replace(/^shopify-cli@?/, 'shopify') : 'shopify'
    const installedVersion = await globalCLIVersion(cliBinary)
    if (!installedVersion) {
      throw new AbortError(
        "Couldn't verify the Shopify CLI version after upgrading.",
        outputContent`Check the installed version by running ${outputToken.genericShellCommand('shopify version')}.`,
      )
    }
    const expectedVersion = newerVersion ?? CLI_KIT_VERSION
    if (semverLt(installedVersion, expectedVersion)) {
      throw new AbortError(
        `Failed to upgrade Shopify CLI. Expected to be on version ${expectedVersion}, but version ${installedVersion} is now installed.`,
        'Your package manager may be resolving @shopify/cli from a registry with outdated versions. Check your npm registry configuration and try again.',
      )
    }
    return {
      status: 'success',
      changed: installedVersion !== CLI_KIT_VERSION,
      scope: 'global',
      previousVersion: CLI_KIT_VERSION,
      version: installedVersion,
      packageManager,
    }
  } else if (projectDir) {
    return upgradeLocalShopify(projectDir, CLI_KIT_VERSION)
  } else {
    throw new Error('Could not determine the local project directory')
  }
}

/**
 * Finds the newest stable release in the current major, or skips automatic upgrades.
 * Auto-upgrade is enabled by default and can be disabled via `setAutoUpgradeEnabled(false)`.
 * Also skips for CI, pre-release versions, or when no newer version is available.
 *
 * @returns The version string to upgrade to, or undefined if no upgrade should happen.
 */
export async function versionToAutoUpgrade(): Promise<string | undefined> {
  const currentVersion = CLI_KIT_VERSION
  const forced = process.env.SHOPIFY_CLI_FORCE_AUTO_UPGRADE === '1'
  if (!forced && !getAutoUpgradeEnabled()) {
    outputDebug('Auto-upgrade: Skipping because auto-upgrade is not enabled.')
    return undefined
  }
  if (!forced && isCI()) {
    outputDebug('Auto-upgrade: Skipping auto-upgrade in CI.')
    return undefined
  }
  if (!forced && isPreReleaseVersion(currentVersion)) {
    outputDebug('Auto-upgrade: Skipping auto-upgrade for pre-release version.')
    return undefined
  }
  const newerVersion = await checkForNewVersion('@shopify/cli', currentVersion, {
    versionRange: `${new SemVer(currentVersion).major}.x`,
    cacheExpiryInHours: 24,
  })
  if (!newerVersion) outputDebug('Auto-upgrade: No newer version available in the current major.')
  return newerVersion
}

/**
 * Checks the freshly fetched notifications feed for a kill-switch notification that
 * disables auto-upgrade. A blocking notification is one with `surface: "autoupgrade"`,
 * `type: "error"`, and matching version/date ranges for the current CLI.
 *
 * Fails open: any error fetching or parsing the feed results in `false`, so a broken
 * notifications endpoint never prevents users from auto-upgrading. Intentionally silent
 * (no logs) — this is invoked on the auto-upgrade hot path.
 *
 * @returns `true` when an active blocking notification is found, `false` otherwise.
 */
export async function hasBlockingAutoUpgradeNotification(): Promise<boolean> {
  try {
    const {notifications} = await fetchNotifications()
    // Reuse the standard notifications filtering for version/date/surface. The empty
    // commandId disables the command filter; ['autoupgrade'] scopes to our surface.
    // The frequency filter is a no-op here because we never render, so nothing gets
    // written to the lastShown cache for these notifications.
    const matching = filterNotifications(notifications, '', ['autoupgrade'])
    return matching.some((notification) => notification.type === 'error')
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return false
  }
}

/**
 * Shows a daily notice for a new major, independently of automatic same-major upgrades.
 * When auto-upgrade is disabled, also shows notices for minor and patch releases.
 * Skipped in CI and for pre-release versions.
 */
export async function warnIfUpgradeAvailable(): Promise<void> {
  if (isCI() || isPreReleaseVersion(CLI_KIT_VERSION)) return

  const newerVersion = checkForCachedNewVersion('@shopify/cli', CLI_KIT_VERSION)
  if (!newerVersion) return
  const isMajor = isMajorVersionChange(CLI_KIT_VERSION, newerVersion)
  if (getAutoUpgradeEnabled() && !isMajor) return

  await runAtMinimumInterval('warn-on-available-upgrade', {days: 1}, async () => {
    outputWarn(getOutputUpdateCLIReminder(newerVersion, isMajor))
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
  let installCommand = cliInstallCommand(version)
  let versionedCommand: string | undefined
  if (inferPackageManagerForGlobalCLI() === 'homebrew') {
    const formulaMajor = /^shopify-cli@(\d+)$/.exec(getHomebrewCLIFormula())?.[1]
    const targetMajor = new SemVer(version).major
    if (formulaMajor && Number(formulaMajor) !== targetMajor) {
      installCommand = `brew install shopify-cli@${targetMajor}`
      versionedCommand = `shopify${targetMajor}`
    }
  }
  const base = installCommand
    ? outputContent`💡 Version ${version} available! Run ${outputToken.genericShellCommand(installCommand)}`.value
    : outputContent`💡 Version ${version} available!`.value
  const reminder = versionedCommand ? `${base}\nUse ${versionedCommand} to run this major.` : base

  if (isMajor) {
    const releaseUrl = `https://github.com/Shopify/cli/releases/tag/${version}`
    const majorNotice =
      outputContent`⚠️  This is a major version — review breaking changes before upgrading:\n   ${outputToken.link(releaseUrl, releaseUrl)}`
        .value
    return `${reminder}\n\n${majorNotice}`
  }

  return reminder
}

async function upgradeLocalShopify(projectDir: string, currentVersion: string): Promise<UpgradeResult> {
  const packageJson = (await findUpAndReadPackageJson(projectDir)).content
  const packageJsonDependencies = packageJson.dependencies ?? {}
  const packageJsonDevDependencies = packageJson.devDependencies ?? {}
  const allDependencies = {...packageJsonDependencies, ...packageJsonDevDependencies}

  let resolvedCLIVersion = allDependencies[await cliDependency()]
  if (!resolvedCLIVersion) {
    outputDebug('Auto-upgrade: CLI dependency not found in project dependencies, skipping local upgrade.')
    return {status: 'skipped', reason: 'dependency-not-found', scope: 'local'}
  }

  if (resolvedCLIVersion.slice(0, 1).match(/[\^~]/)) resolvedCLIVersion = currentVersion
  const newestCLIVersion = await checkForNewVersion(await cliDependency(), resolvedCLIVersion)

  if (newestCLIVersion) {
    outputUpgradeMessage(resolvedCLIVersion, newestCLIVersion)
  } else {
    outputWontInstallMessage(resolvedCLIVersion)
  }

  const dependencies = await installJsonDependencies('prod', packageJsonDependencies, projectDir)
  const devDependencies = await installJsonDependencies('dev', packageJsonDevDependencies, projectDir)
  // Local installs are not verified, so the registry version is not an installed-version claim.
  return {
    status: 'success',
    changed: null,
    scope: 'local',
    directory: projectDir,
    previousVersion: resolvedCLIVersion,
    availableVersion: newestCLIVersion ?? null,
    packages: [...new Set([...dependencies, ...devDependencies])],
  }
}

async function installJsonDependencies(
  depsEnv: DependencyType,
  deps: {[key: string]: string},
  directory: string,
): Promise<string[]> {
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
    const packageManager = await getPackageManager(directory)
    const streams = upgradeOutputStreams()
    try {
      await addNPMDependencies(packagesToUpdate, {
        packageManager,
        type: depsEnv,
        directory,
        ...streams,
        addToRootDirectory: appUsesWorkspaces,
      })
    } finally {
      if (streams.stdout !== process.stdout) streams.stdout.end()
      if (streams.stderr !== process.stderr) streams.stderr.end()
    }
  }
  return packagesToUpdate.map(({name}) => name)
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
