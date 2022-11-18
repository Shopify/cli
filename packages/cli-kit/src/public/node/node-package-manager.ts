import {AbortError, BugError} from './error.js'
import {Version} from './semver.js'
import {exec} from '../../system.js'
import {exists as fileExists, read as readFile, write as writeFile} from '../../file.js'
import {glob, dirname, join as pathJoin, findUp} from '../../path.js'
import {latestNpmPackageVersion} from '../../version.js'
import {content, token, debug} from '../../output.js'
import {AbortController, AbortSignal} from 'abort-controller'
import type {Writable} from 'node:stream'
import type {ExecOptions} from '../../system.js'

/** The name of the Yarn lock file */
export const yarnLockfile = 'yarn.lock'

/** The name of the pnpm lock file */
export const pnpmLockfile = 'pnpm-lock.yaml'

/** The name of the pnpm workspace file */
export const pnpmWorkspaceFile = 'pnpm-workspace.yaml'

/** An array containing the lockfiles from all the package managers */
export const lockfiles = [yarnLockfile, pnpmLockfile]

/**
 * A union type that represents the type of dependencies in the package.json
 * - dev: devDependencies
 * - prod: dependencies
 * - peer: peerDependencies
 */
export type DependencyType = 'dev' | 'prod' | 'peer'

/**
 * A union that represents the package managers available.
 */
export const packageManager = ['yarn', 'npm', 'pnpm'] as const
export type PackageManager = typeof packageManager[number]

/**
 * Returns an abort error that's thrown when a directory that's expected to have
 * a package.json doesn't have it.
 * @param directory - The path to the directory that should contain a package.json
 * @returns An abort error.
 */
export const PackageJsonNotFoundError = (directory: string) => {
  return new AbortError(`The directory ${directory} doesn't have a package.json.`)
}

/**
 * Returns a bug error that's thrown when the lookup of the package.json traversing the directory
 * hierarchy up can't find a package.json
 * @param directory - The directory from which the traverse has been done
 * @returns An abort error.
 */
export const FindUpAndReadPackageJsonNotFoundError = (directory: string) => {
  return new BugError(content`Couldn't find a a package.json traversing directories from ${token.path(directory)}`)
}

/**
 * Returns the dependency manager used to run the create workflow.
 * @param env - The environment variables of the process in which the CLI runs.
 * @returns The dependency manager
 */
export function packageManagerUsedForCreating(env = process.env): PackageManager | 'unknown' {
  if (env.npm_config_user_agent?.includes('yarn')) {
    return 'yarn'
  } else if (env.npm_config_user_agent?.includes('pnpm')) {
    return 'pnpm'
  } else if (env.npm_config_user_agent?.includes('npm')) {
    return 'npm'
  }
  return 'unknown'
}

/**
 * Returns the dependency manager used by an existing project.
 * @param directory - The root directory of the project.
 * @returns The dependency manager
 */
export async function getPackageManager(directory: string): Promise<PackageManager> {
  debug(content`Obtaining the dependency manager in directory ${token.path(directory)}...`)
  const yarnLockPath = pathJoin(directory, yarnLockfile)
  const pnpmLockPath = pathJoin(directory, pnpmLockfile)
  if (await fileExists(yarnLockPath)) {
    return 'yarn'
  } else if (await fileExists(pnpmLockPath)) {
    return 'pnpm'
  } else {
    return 'npm'
  }
}

interface InstallNPMDependenciesRecursivelyOptions {
  /**
   * The dependency manager to use to install the dependencies.
   */
  packageManager: PackageManager
  /**
   * The directory from where we'll find package.json's recursively
   */
  directory: string

  /**
   * Specifies the maximum depth of the glob search.
   */
  deep?: number
}

/**
 * This function traverses down a directory tree to find directories containing a package.json
 * and installs the dependencies if needed. To know if it's needed, it uses the "check" command
 * provided by dependency managers.
 * @param options - Options to install dependencies recursively.
 */
export async function installNPMDependenciesRecursively(options: InstallNPMDependenciesRecursivelyOptions) {
  const packageJsons = await glob(pathJoin(options.directory, '**/package.json'), {
    ignore: [pathJoin(options.directory, 'node_modules/**/package.json')],
    cwd: options.directory,
    onlyFiles: true,
    deep: options.deep,
  })
  const abortController = new AbortController()
  try {
    await Promise.all(
      packageJsons.map(async (packageJsonPath) => {
        const directory = dirname(packageJsonPath)
        await installNodeModules({
          directory,
          packageManager: options.packageManager,
          stdout: undefined,
          stderr: undefined,
          signal: abortController.signal,
          args: [],
        })
      }),
    )
  } catch (error) {
    abortController.abort()
    throw error
  }
}

interface InstallNodeModulesOptions {
  directory: string
  args: string[]
  packageManager: PackageManager
  stdout?: Writable
  stderr?: Writable
  signal?: AbortSignal
}

export async function installNodeModules(options: InstallNodeModulesOptions) {
  const execOptions: ExecOptions = {
    cwd: options.directory,
    stdin: undefined,
    stdout: options.stdout,
    stderr: options.stderr,
    signal: options.signal,
  }
  let args = ['install']
  if (options.args) {
    args = args.concat(options.args)
  }
  await exec(options.packageManager, args, execOptions)
}

/**
 * Returns the name of the package configured in its package.json
 * @param packageJsonPath - Path to the package.json file
 * @returns A promise that resolves with the name.
 */
export async function getPackageName(packageJsonPath: string): Promise<string | undefined> {
  const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
  return packageJsonContent.name
}

/**
 * Returns the list of production and dev dependencies of a package.json
 * @param packageJsonPath - Path to the package.json file
 * @returns A promise that resolves with the list of dependencies.
 */
export async function getDependencies(packageJsonPath: string): Promise<{[key: string]: string}> {
  const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
  const dependencies: {[key: string]: string} = packageJsonContent.dependencies ?? {}
  const devDependencies: {[key: string]: string} = packageJsonContent.devDependencies ?? {}

  return {...dependencies, ...devDependencies}
}

/**
 * Returns true if the app uses workspaces, false otherwise.
 * @param packageJsonPath - Path to the package.json file
 * @param pnpmWorkspacePath - Path to the pnpm-workspace.yaml file
 * @returns A promise that resolves with true if the app uses workspaces, false otherwise.
 */
export async function usesWorkspaces(appDirectory: string): Promise<boolean> {
  const packageJsonPath = pathJoin(appDirectory, 'package.json')
  const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
  const pnpmWorkspacePath = pathJoin(appDirectory, pnpmWorkspaceFile)
  return Boolean(packageJsonContent.workspaces) || fileExists(pnpmWorkspacePath)
}

/**
 * Given an NPM dependency, it checks if there's a more recent version, and if there is, it returns its value.
 * @param dependency - The dependency name (e.g. react)
 * @param currentVersion - The current version.
 * @returns A promise that resolves with a more recent version or undefined if there's no more recent version.
 */
export async function checkForNewVersion(dependency: string, currentVersion: string): Promise<string | undefined> {
  debug(content`Checking if there's a version of ${dependency} newer than ${currentVersion}`)
  try {
    const lastVersion = await latestNpmPackageVersion(dependency)
    if (lastVersion && new Version(currentVersion).compare(lastVersion) < 0) {
      return lastVersion
    } else {
      return undefined
    }
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return undefined
  }
}

/**
 * An interface that represents a package.json
 */
export interface PackageJson {
  /**
   * The name attribute of the package.json
   */
  name?: string

  /**
   * The version attribute of the package.json
   */
  version?: string

  /**
   * The dependencies attribute of the package.json
   */
  dependencies?: {[key: string]: string}

  /**
   * The devDependencies attribute of the package.json
   */
  devDependencies?: {[key: string]: string}

  /**
   * The optional oclif settings attribute of the package.json
   */
  oclif?: {
    plugins?: string[]
  }

  /**
   * The workspaces attribute of the package.json
   */
  workspaces?: string[]

  /**
   * The resolutions attribute of the package.json. Only useful when using yarn as package manager
   */
  resolutions?: {[key: string]: string}

  /**
   * The overrides attribute of the package.json. Only useful when using npm o npmn as package managers
   */
  overrides?: {[key: string]: string}
}

/**
 * Reads and parses a package.json
 * @param packageJsonPath - Path to the package.json
 * @returns An promise that resolves with an in-memory representation
 *    of the package.json or rejects with an error if the file is not found or the content is
 *    not decodable.
 */
export async function readAndParsePackageJson(packageJsonPath: string): Promise<PackageJson> {
  if (!(await fileExists(packageJsonPath))) {
    throw PackageJsonNotFoundError(dirname(packageJsonPath))
  }
  return JSON.parse(await readFile(packageJsonPath))
}

interface AddNPMDependenciesIfNeededOptions {
  /** How dependencies should be added */
  type: DependencyType

  /** The dependency manager to use to add dependencies */
  packageManager: PackageManager

  /** The directory that contains the package.json where dependencies will be added */
  directory: string

  /** Standard output coming from the underlying installation process */
  stdout?: Writable

  /** Standard error coming from the underlying installation process */
  stderr?: Writable

  /** Abort signal to stop the process */
  signal?: AbortSignal
}

/**
 * An interface that represents a dependency name with its version
 */
export interface DependencyVersion {
  /**
   * The name of the NPM dependency as it's reflected in the package.json:
   *
   * @example
   * In the example below name would be "react"
   * ```
   * {
   *   "react": "1.2.3"
   * }
   * ```
   */
  name: string

  /**
   * The version of the NPM dependency as it's reflected in the package.json:
   *
   * @example
   * In the example below version would be "1.2.3"
   * ```
   * {
   *   "react": "1.2.3"
   * }
   * ```
   */
  version: string | undefined
}

/**
 * Adds dependencies to a Node project (i.e. a project that has a package.json)
 * @param dependencies - List of dependencies to be added.
 * @param options - Options for adding dependencies.
 */
export async function addNPMDependenciesIfNeeded(
  dependencies: DependencyVersion[],
  options: AddNPMDependenciesIfNeededOptions,
) {
  debug(content`Adding the following dependencies if needed:
${token.json(dependencies)}
With options:
${token.json(options)}
  `)
  const packageJsonPath = pathJoin(options.directory, 'package.json')
  if (!(await fileExists(packageJsonPath))) {
    throw PackageJsonNotFoundError(options.directory)
  }
  const existingDependencies = Object.keys(await getDependencies(packageJsonPath))
  let dependenciesToAdd = dependencies
  dependenciesToAdd = dependencies.filter((dep) => {
    return !existingDependencies.includes(dep.name)
  })
  if (dependenciesToAdd.length === 0) {
    return
  }
  await addNPMDependencies(dependenciesToAdd, options)
}

export async function addNPMDependencies(
  dependencies: DependencyVersion[],
  options: AddNPMDependenciesIfNeededOptions,
) {
  let args: string[]
  const depedenciesWithVersion = dependencies.map((dep) => {
    return dep.version ? `${dep.name}@${dep.version}` : dep.name
  })
  switch (options.packageManager) {
    case 'npm':
      args = argumentsToAddDependenciesWithNPM(depedenciesWithVersion, options.type)
      break
    case 'yarn':
      args = argumentsToAddDependenciesWithYarn(depedenciesWithVersion, options.type)
      break
    case 'pnpm':
      args = argumentsToAddDependenciesWithPNPM(depedenciesWithVersion, options.type)
      break
  }
  options.stdout?.write(`Executing... ${[options.packageManager, ...args].join(' ')}`)
  await exec(options.packageManager, args, {
    cwd: options.directory,
    stdout: options.stdout,
    stderr: options.stderr,
    signal: options.signal,
  })
}

export async function addNPMDependenciesWithoutVersionIfNeeded(
  dependencies: string[],
  options: AddNPMDependenciesIfNeededOptions,
) {
  await addNPMDependenciesIfNeeded(
    dependencies.map((dependency) => {
      return {name: dependency, version: undefined}
    }),
    options,
  )
}

/**
 * Returns the arguments to add dependencies using NPM.
 * @param dependencies - The list of dependencies to add
 * @param type - The dependency type.
 * @returns An array with the arguments.
 */
function argumentsToAddDependenciesWithNPM(dependencies: string[], type: DependencyType): string[] {
  let command = ['install']
  command = command.concat(dependencies)
  switch (type) {
    case 'dev':
      command.push('--save-dev')
      break
    case 'peer':
      command.push('--save-peer')
      break
    case 'prod':
      command.push('--save-prod')
      break
  }
  return command
}

/**
 * Returns the arguments to add dependencies using Yarn.
 * @param dependencies - The list of dependencies to add
 * @param type - The dependency type.
 * @returns An array with the arguments.
 */
function argumentsToAddDependenciesWithYarn(dependencies: string[], type: DependencyType): string[] {
  let command = ['add']
  command = command.concat(dependencies)
  switch (type) {
    case 'dev':
      command.push('--dev')
      break
    case 'peer':
      command.push('--peer')
      break
    case 'prod':
      command.push('--prod')
      break
  }
  return command
}

/**
 * Returns the arguments to add dependencies using PNPM.
 * @param dependencies - The list of dependencies to add
 * @param type - The dependency type.
 * @returns An array with the arguments.
 */
function argumentsToAddDependenciesWithPNPM(dependencies: string[], type: DependencyType): string[] {
  let command = ['add']
  command = command.concat(dependencies)
  switch (type) {
    case 'dev':
      command.push('--save-dev')
      break
    case 'peer':
      command.push('--save-peer')
      break
    case 'prod':
      command.push('--save-prod')
      break
  }
  return command
}

/**
 * Given a directory it traverses the directory up looking for a package.json and if found, it reads it
 * decodes the JSON, and returns its content as a Javascript object.
 * @param options - The directory from which traverse up.
 * @returns If found, the promise resolves with the path to the
 *  package.json and its content. If not found, it throws a FindUpAndReadPackageJsonNotFoundError error.
 */
export async function findUpAndReadPackageJson(fromDirectory: string): Promise<{path: string; content: unknown}> {
  const packageJsonPath = await findUp('package.json', {cwd: fromDirectory, type: 'file'})
  if (packageJsonPath) {
    const packageJson = JSON.parse(await readFile(packageJsonPath))
    return {path: packageJsonPath, content: packageJson}
  } else {
    throw FindUpAndReadPackageJsonNotFoundError(fromDirectory)
  }
}

export async function addResolutionOrOverride(directory: string, dependencies: {[key: string]: string}) {
  const packageManager = await getPackageManager(directory)
  const packageJsonPath = pathJoin(directory, 'package.json')
  const packageJsonContent = await readAndParsePackageJson(packageJsonPath)

  if (packageManager === 'yarn') {
    packageJsonContent.resolutions = packageJsonContent.resolutions
      ? {...packageJsonContent.resolutions, ...dependencies}
      : dependencies
  }
  if (packageManager === 'npm' || packageManager === 'pnpm') {
    packageJsonContent.overrides = packageJsonContent.overrides
      ? {...packageJsonContent.overrides, ...dependencies}
      : dependencies
  }

  await writeFile(packageJsonPath, JSON.stringify(packageJsonContent, null, 2))
}
