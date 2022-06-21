import {content, token, debug} from './output'
import {version} from '../package.json'
import latestVersion from 'latest-version'

/**
 * Returns the latest available version of an NPM package.
 * @param name {string} The name of the NPM package.
 * @returns A promise to get the latest available version of a package.
 */
export async function latestNpmPackageVersion(name: string) {
  debug(content`Getting the latest version of NPM package: ${token.raw(name)}`)
  return latestVersion(name)
}

export function cliVersion(): string {
  return version
}
