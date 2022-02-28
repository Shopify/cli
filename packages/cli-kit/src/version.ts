import latestVersion from 'latest-version'

import * as packageInfo from '../package.json'

/**
 * Returns the latest available version of an NPM package.
 * @param name {string} The name of the NPM package.
 * @returns A promise to get the latest available version of a package.
 */
export async function latestNpmPackageVersion(name: string) {
  return latestVersion(name)
}

/**
 * Returns the current version of cli-kit
 * @returns A String value of the cli-kit version
 */
export function currentCLIKitVersion() {
  return packageInfo.version
}
