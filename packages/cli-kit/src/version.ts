import {content, token, debug} from './output.js'
import {moduleDirectory} from './path.js'
import {Bug} from './error.js'
import {findUpAndReadPackageJson} from './node/node-package-manager.js'
import latestVersion from 'latest-version'

export const PackageJsonVersionNotFoundError = (packageJsonPath: string) => {
  return new Bug(content`The package.json at path ${token.path(packageJsonPath)} doesn't contain a version`)
}

/**
 * Returns the latest available version of an NPM package.
 * @param name {string} The name of the NPM package.
 * @returns A promise to get the latest available version of a package.
 */
export async function latestNpmPackageVersion(name: string) {
  debug(content`Getting the latest version of NPM package: ${token.raw(name)}`)
  return latestVersion(name)
}

interface FindPackageVersionUpOptions {
  fromModuleURL: URL | string
}

/**
 * Given a module URL, it traverses the directory hierarchy up until it finds a package.json
 * and then it returns the version in it.
 * @param options {FindPackageVersionUpOptions} Options
 * @returns {Promise<string>} The version if it can find the package.json and it exists. An error otherwise.
 */
export async function findPackageVersionUp(options: FindPackageVersionUpOptions): Promise<string> {
  const fromDirectory = moduleDirectory(options.fromModuleURL)
  const packageJson = await findUpAndReadPackageJson(fromDirectory)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const version = (packageJson.content as any).version
  if (!version) {
    throw PackageJsonVersionNotFoundError(packageJson.path)
  }
  return version
}
