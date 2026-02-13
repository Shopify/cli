import {findPathUpSync} from './fs.js'
import {moduleDirectory} from './path.js'
import {captureOutput} from '../node/system.js'
import which from 'which'
import {satisfies, SemVer} from 'semver'
import {readFileSync} from 'node:fs'

let _cliVersion: string | undefined

/**
 * Returns the current CLI version, read from the nearest package.json.
 * The result is cached after the first call.
 *
 * This is a lazy function (rather than a top-level constant) because `findPathUpSync`
 * depends on npm packages that may not yet be initialized during ESM module evaluation
 * when circular imports are involved. Deferring the call to runtime avoids that issue.
 *
 * In unbundled (dev) mode this finds cli-kit's own package.json.
 * In bundled (global install) mode this finds the CLI's package.json, which shares the same version.
 *
 * @returns The CLI version string.
 */
export function cliVersion(): string {
  if (_cliVersion === undefined) {
    const packageJsonPath = findPathUpSync('package.json', {cwd: moduleDirectory(import.meta.url), type: 'file'})
    if (packageJsonPath) {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
      if (pkg.name.startsWith('@shopify/cli') && pkg.version) {
        _cliVersion = pkg.version
      }
    }
    _cliVersion ??= '0.0.0'
  }
  return _cliVersion
}
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
    // Both execa and which find the project dependency. We need to exclude it.
    const shopifyBinaries = which.sync('shopify', {all: true}).filter((path) => !path.includes('node_modules'))
    if (!shopifyBinaries[0]) return undefined
    const output = await captureOutput(shopifyBinaries[0], [], {env})
    const versionMatch = output.match(/@shopify\/cli\/([^\s]+)/)
    if (versionMatch && versionMatch[1]) {
      const version = versionMatch[1]
      if (satisfies(version, `>=3.59.0`) || isPreReleaseVersion(version)) {
        return version
      }
    }
    return undefined
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch {
    return undefined
  }
}

/**
 * Returns true if the given version is a pre-release version.
 * Meaning is a `nightly`, `snapshot`, or `experimental` version.
 *
 * @param version - The version to check.
 * @returns True if the version is a pre-release version.
 */
export function isPreReleaseVersion(version: string): boolean {
  return version.startsWith('0.0.0')
}

/**
 * Checks if the version is a major version change.
 *
 * @param currentVersion - The current version.
 * @param newerVersion - The newer version.
 * @returns True if the version is a major version change.
 */
export function isMajorVersionChange(currentVersion: string, newerVersion: string): boolean {
  if (isPreReleaseVersion(currentVersion) || isPreReleaseVersion(newerVersion)) return false
  const currentSemVer = new SemVer(currentVersion)
  const newerSemVer = new SemVer(newerVersion)
  return currentSemVer.major !== newerSemVer.major
}
