import {AbortError, BugError} from './error.js'
import {AbortController, AbortSignal} from './abort.js'
import {exec} from './system.js'
import {fileExists, readFile, writeFile, findPathUp, glob} from './fs.js'
import {dirname, joinPath} from './path.js'
import {runWithTimer} from './metadata.js'
import {outputToken, outputContent, outputDebug} from '../../public/node/output.js'
import latestVersion from 'latest-version'
import {SemVer} from 'semver'
import type {Writable} from 'stream'
import type {ExecOptions} from './system.js'

/** The name of the Yarn lock file */
export const yarnLockfile = 'yarn.lock'

/** The name of the npm lock file */
export const npmLockfile = 'package-lock.json'

/** The name of the pnpm lock file */
export const pnpmLockfile = 'pnpm-lock.yaml'

/** The name of the bun lock file */
export const bunLockfile = 'bun.lockb'

/** The name of the pnpm workspace file */
export const pnpmWorkspaceFile = 'pnpm-workspace.yaml'

/** An array containing the lockfiles from all the package managers */
export const lockfiles: Lockfile[] = [yarnLockfile, pnpmLockfile, npmLockfile, bunLockfile]
export type Lockfile = 'yarn.lock' | 'package-lock.json' | 'pnpm-lock.yaml' | 'bun.lockb'

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
export const packageManager = ['yarn', 'npm', 'pnpm', 'bun', 'unknown'] as const
export type PackageManager = (typeof packageManager)[number]

/**
 * Returns an abort error that's thrown when the package manager can't be determined.
 * @returns An abort error.
 */
export class UnknownPackageManagerError extends AbortError {
  constructor() {
    super('Unknown package manager')
  }
}

/**
 * Returns an abort error that's thrown when a directory that's expected to have
 * a package.json doesn't have it.
 * @param directory - The path to the directory that should contain a package.json
 * @returns An abort error.
 */
export class PackageJsonNotFoundError extends AbortError {
  constructor(directory: string) {
    super(outputContent`The directory ${outputToken.path(directory)} doesn't have a package.json.`)
  }
}

/**
 * Returns a bug error that's thrown when the lookup of the package.json traversing the directory
 * hierarchy up can't find a package.json
 * @param directory - The directory from which the traverse has been done
 * @returns An abort error.
 */
export class FindUpAndReadPackageJsonNotFoundError extends BugError {
  constructor(directory: string) {
    super(outputContent`Couldn't find a a package.json traversing directories from ${outputToken.path(directory)}`)
  }
}

/**
 * Returns the dependency manager used to run the create workflow.
 * @param env - The environment variables of the process in which the CLI runs.
 * @returns The dependency manager
 */
export function packageManagerFromUserAgent(env = process.env): PackageManager {
  if (env.npm_config_user_agent?.includes('yarn')) {
    return 'yarn'
  } else if (env.npm_config_user_agent?.includes('pnpm')) {
    return 'pnpm'
  } else if (env.npm_config_user_agent?.includes('bun')) {
    return 'bun'
  } else if (env.npm_config_user_agent?.includes('npm')) {
    return 'npm'
  }
  return 'unknown'
}

/**
 * Returns the dependency manager used in a directory.
 * @param fromDirectory - The starting directory
 * @returns The dependency manager
 */
export async function getPackageManager(fromDirectory: string): Promise<PackageManager> {
  const packageJson = await findPathUp('package.json', {cwd: fromDirectory, type: 'file'})
  if (!packageJson) {
    return packageManagerFromUserAgent()
  }
  const directory = dirname(packageJson)
  outputDebug(outputContent`Obtaining the dependency manager in directory ${outputToken.path(directory)}...`)
  const yarnLockPath = joinPath(directory, yarnLockfile)
  const pnpmLockPath = joinPath(directory, pnpmLockfile)
  const bunLockPath = joinPath(directory, bunLockfile)
  if (await fileExists(yarnLockPath)) {
    return 'yarn'
  } else if (await fileExists(pnpmLockPath)) {
    return 'pnpm'
  } else if (await fileExists(bunLockPath)) {
    return 'bun'
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
export async function installNPMDependenciesRecursively(
  options: InstallNPMDependenciesRecursivelyOptions,
): Promise<void> {
  const packageJsons = await glob(joinPath(options.directory, '**/package.json'), {
    ignore: [joinPath(options.directory, 'node_modules/**/package.json')],
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
  args?: string[]
  packageManager: PackageManager
  stdout?: Writable
  stderr?: Writable
  signal?: AbortSignal
}

export async function installNodeModules(options: InstallNodeModulesOptions): Promise<void> {
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
  await runWithTimer('cmd_all_timing_network_ms')(async () => {
    await exec(options.packageManager, args, execOptions)
  })
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
 * Returns the version of the package configured in its package.json
 * @param packageJsonPath - Path to the package.json file
 * @returns A promise that resolves with the version.
 */
export async function getPackageVersion(packageJsonPath: string): Promise<string | undefined> {
  const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
  return packageJsonContent.version
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
  const packageJsonPath = joinPath(appDirectory, 'package.json')
  const packageJsonContent = await readAndParsePackageJson(packageJsonPath)
  const pnpmWorkspacePath = joinPath(appDirectory, pnpmWorkspaceFile)
  return Boolean(packageJsonContent.workspaces) || fileExists(pnpmWorkspacePath)
}

/**
 * Given an NPM dependency, it checks if there's a more recent version, and if there is, it returns its value.
 * @param dependency - The dependency name (e.g. react)
 * @param currentVersion - The current version.
 * @returns A promise that resolves with a more recent version or undefined if there's no more recent version.
 */
export async function checkForNewVersion(dependency: string, currentVersion: string): Promise<string | undefined> {
  outputDebug(outputContent`Checking if there's a version of ${dependency} newer than ${currentVersion}`)
  try {
    const lastVersion = await getLatestNPMPackageVersion(dependency)
    if (lastVersion && new SemVer(currentVersion).compare(lastVersion) < 0) {
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
   * The author attribute of the package.json
   */
  author?: string

  /**
   * The version attribute of the package.json
   */
  version?: string

  /**
   * The scripts attribute of the package.json
   */
  scripts?: {[key: string]: string}

  /**
   * The dependencies attribute of the package.json
   */
  dependencies?: {[key: string]: string}

  /**
   * The devDependencies attribute of the package.json
   */
  devDependencies?: {[key: string]: string}

  /**
   * The peerDependencies attribute of the package.json
   */
  peerDependencies?: {[key: string]: string}

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

  /**
   *  The prettier attribute of the package.json
   */
  prettier?: string

  /**
   * The private attribute of the package.json.
   * https://docs.npmjs.com/cli/v9/configuring-npm/package-json#private
   */
  private?: boolean
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
    throw new PackageJsonNotFoundError(dirname(packageJsonPath))
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

  /** Whether to add the dependencies to the root package.json or to the package.json of the directory */
  addToRootDirectory?: boolean
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
): Promise<void> {
  outputDebug(outputContent`Adding the following dependencies if needed:
${outputToken.json(dependencies)}
With options:
${outputToken.json(options)}
  `)
  const packageJsonPath = joinPath(options.directory, 'package.json')
  if (!(await fileExists(packageJsonPath))) {
    throw new PackageJsonNotFoundError(options.directory)
  }
  const existingDependencies = Object.keys(await getDependencies(packageJsonPath))
  const dependenciesToAdd = dependencies.filter((dep) => {
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
): Promise<void> {
  const dependenciesWithVersion = dependencies.map((dep) => {
    return dep.version ? `${dep.name}@${dep.version}` : dep.name
  })
  options.stdout?.write(`Installing ${[dependenciesWithVersion].join(' ')} with ${options.packageManager}`)
  switch (options.packageManager) {
    case 'npm':
      // npm isn't too smart when resolving the dependency tree. For example, admin ui extensions include react as
      // a peer dependency, but npm can't figure out the relationship and fails. Installing dependencies one by one
      // makes the task easier and npm can then proceed.
      for (const dep of dependenciesWithVersion) {
        // eslint-disable-next-line no-await-in-loop
        await installDependencies(options, argumentsToAddDependenciesWithNPM(dep, options.type))
      }
      break
    case 'yarn':
      await installDependencies(
        options,
        argumentsToAddDependenciesWithYarn(dependenciesWithVersion, options.type, Boolean(options.addToRootDirectory)),
      )
      break
    case 'pnpm':
      await installDependencies(
        options,
        argumentsToAddDependenciesWithPNPM(dependenciesWithVersion, options.type, Boolean(options.addToRootDirectory)),
      )
      break
    case 'bun':
      await installDependencies(options, argumentsToAddDependenciesWithBun(dependenciesWithVersion, options.type))
      await installDependencies(options, ['install'])
      break
    case 'unknown':
      throw new UnknownPackageManagerError()
  }
}

async function installDependencies(options: AddNPMDependenciesIfNeededOptions, args: string[]) {
  return runWithTimer('cmd_all_timing_network_ms')(async () => {
    return exec(options.packageManager, args, {
      cwd: options.directory,
      stdout: options.stdout,
      stderr: options.stderr,
      signal: options.signal,
    })
  })
}

export async function addNPMDependenciesWithoutVersionIfNeeded(
  dependencies: string[],
  options: AddNPMDependenciesIfNeededOptions,
): Promise<void> {
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
function argumentsToAddDependenciesWithNPM(dependency: string, type: DependencyType): string[] {
  let command = ['install']
  command = command.concat(dependency)
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
  // NPM adds ^ to the installed version by default. We want to install exact versions unless specified otherwise.
  if (dependency.match(/@\d/g)) {
    command.push('--save-exact')
  }
  return command
}

/**
 * Returns the arguments to add dependencies using Yarn.
 * @param dependencies - The list of dependencies to add
 * @param type - The dependency type.
 * @param addAtRoot - Force to install the dependencies in the workspace root (optional, default = false)
 * @returns An array with the arguments.
 */
function argumentsToAddDependenciesWithYarn(dependencies: string[], type: DependencyType, addAtRoot = false): string[] {
  let command = ['add']

  if (addAtRoot) {
    command.push('-W')
  }

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
 * @param addAtRoot - Force to install the dependencies in the workspace root (optional, default = false)
 * @returns An array with the arguments.
 */
function argumentsToAddDependenciesWithPNPM(dependencies: string[], type: DependencyType, addAtRoot = false): string[] {
  let command = ['add']

  if (addAtRoot) {
    command.push('-w')
  }

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
 * Returns the arguments to add dependencies using Bun.
 * @param dependencies - The list of dependencies to add
 * @param type - The dependency type.
 * @returns An array with the arguments.
 */
function argumentsToAddDependenciesWithBun(dependencies: string[], type: DependencyType): string[] {
  let command = ['add']

  command = command.concat(dependencies)

  switch (type) {
    case 'dev':
      command.push('--development')
      break
    case 'peer':
      command.push('--optional')
      break
    case 'prod':
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
export async function findUpAndReadPackageJson(fromDirectory: string): Promise<{path: string; content: PackageJson}> {
  const packageJsonPath = await findPathUp('package.json', {cwd: fromDirectory, type: 'file'})
  if (packageJsonPath) {
    const packageJson = JSON.parse(await readFile(packageJsonPath))
    return {path: packageJsonPath, content: packageJson}
  } else {
    throw new FindUpAndReadPackageJsonNotFoundError(fromDirectory)
  }
}

export async function addResolutionOrOverride(directory: string, dependencies: {[key: string]: string}): Promise<void> {
  const packageManager = await getPackageManager(directory)
  const packageJsonPath = joinPath(directory, 'package.json')
  const packageJsonContent = await readAndParsePackageJson(packageJsonPath)

  if (packageManager === 'yarn') {
    packageJsonContent.resolutions = packageJsonContent.resolutions
      ? {...packageJsonContent.resolutions, ...dependencies}
      : dependencies
  }
  if (packageManager === 'npm' || packageManager === 'pnpm' || packageManager === 'bun') {
    packageJsonContent.overrides = packageJsonContent.overrides
      ? {...packageJsonContent.overrides, ...dependencies}
      : dependencies
  }

  await writeFile(packageJsonPath, JSON.stringify(packageJsonContent, null, 2))
}

/**
 * Returns the latest available version of an NPM package.
 * @param name - The name of the NPM package.
 * @returns A promise to get the latest available version of a package.
 */
async function getLatestNPMPackageVersion(name: string) {
  outputDebug(outputContent`Getting the latest version of NPM package: ${outputToken.raw(name)}`)
  return runWithTimer('cmd_all_timing_network_ms')(() => {
    return latestVersion(name)
  })
}

/**
 * Writes the package.json file to the given directory.
 *
 * @param directory - Directory where the package.json file will be written.
 * @param packageJSON - Package.json file to write.
 */
export async function writePackageJSON(directory: string, packageJSON: PackageJson): Promise<void> {
  outputDebug(outputContent`JSON-encoding and writing content to package.json at ${outputToken.path(directory)}...`)
  const packagePath = joinPath(directory, 'package.json')
  await writeFile(packagePath, JSON.stringify(packageJSON, null, 2))
}
