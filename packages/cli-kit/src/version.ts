import latestVersion from 'latest-version'

/**
 * Returns the latest available version of an NPM package.
 * @param name {string} The name of the NPM package.
 * @returns A promise to get the latest available version of a package.
 */
export async function latestNpmPackageVersion(name: string) {
  return latestVersion(name)
}

export function currentVersion(name: string) {
  return '0.16.0' // TODO
}
