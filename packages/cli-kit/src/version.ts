import {content, token, debug} from './output.js'
import {moduleDirectory, findUp} from './path.js'
import {read} from './file.js'
import {Bug} from './error.js'
import latestVersion from 'latest-version'

export const PackageJsonNotFoundError = (directory: string) => {
  return new Bug(content`Couldn't find a a package.json traversing directories from ${token.path(directory)}`)
}

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
  const packageJsonPath = await findUp('package.json', {cwd: fromDirectory, type: 'file'})
  if (packageJsonPath) {
    const packageJson = JSON.parse(await read(packageJsonPath))
    if (!packageJson.version) {
      throw PackageJsonVersionNotFoundError(packageJsonPath)
    }
    return packageJson.version
  } else {
    throw PackageJsonNotFoundError(fromDirectory)
  }
}
