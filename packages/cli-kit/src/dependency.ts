import {exec} from './system'
import {exists as fileExists, read as readFile} from './file'
import {glob, dirname, join as pathJoin} from './path'
import {Abort} from './error'
import {latestNpmPackageVersion} from './version'
import {Version} from './semver'
import {content, token, debug} from './output'
import {AbortController, AbortSignal} from 'abort-controller'
import type {Writable} from 'node:stream'
import type {ExecOptions} from './system'

export const genericConfigurationFileNames = {
  yarn: {
    lockfile: 'yarn.lock',
  },
  pnpm: {
    lockfile: 'pnpm-lock.yaml',
  },
} as const

export const dependencyManager = ['yarn', 'npm', 'pnpm'] as const
export type DependencyManager = typeof dependencyManager[number]

export const PackageJsonNotFoundError = (directory: string) => {
  return new Abort(`The directory ${directory} doesn't have a package.json.`)
}

/**
 * Returns the dependency manager used to run the create workflow.
 * @param env {Object} The environment variables of the process in which the CLI runs.
 * @returns The dependency manager
 */
export function dependencyManagerUsedForCreating(env = process.env): DependencyManager {
  if (env.npm_config_user_agent?.includes('yarn')) {
    return 'yarn'
  } else if (env.npm_config_user_agent?.includes('pnpm')) {
    return 'pnpm'
  } else {
    return 'npm'
  }
}

/**
 * Returns the dependency manager used by an existing project.
 * @param directory {string} The root directory of the project.
 * @returns The dependency manager
 */
export async function getDependencyManager(directory: string): Promise<DependencyManager> {
  debug(content`Obtaining the dependency manager in directory ${token.path(directory)}...`)
  const yarnLockPath = pathJoin(directory, genericConfigurationFileNames.yarn.lockfile)
  const pnpmLockPath = pathJoin(directory, genericConfigurationFileNames.pnpm.lockfile)
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
  dependencyManager: DependencyManager
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
 * @param options {InstallNPMDependenciesRecursivelyOptions} Options to install dependencies recursively.
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
        await install(directory, options.dependencyManager, undefined, undefined, abortController.signal)
      }),
    )
  } catch (error) {
    abortController.abort()
    throw error
  }
}

/**
 * Installs the dependencies in the given directory.
 * @param directory {string} The directory that contains the package.json
 * @param dependencyManager {DependencyManager} The dependency manager to use to install the dependencies.
 * @param stdout {Writable} Standard output stream.
 * @param stderr {Writable} Standard error stream.
 * @param signal {AbortSignal} Abort signal.
 * @returns stderr {Writable} Standard error stream.
 */
export async function install(
  directory: string,
  dependencyManager: DependencyManager,
  stdout?: Writable,
  stderr?: Writable,
  signal?: AbortSignal,
) {
  const options: ExecOptions = {cwd: directory, stdout, stderr, signal}
  await exec(dependencyManager, ['install'], options)
}

/**
 * Returns the name of the package configured in its package.json
 * @param packageJsonPath {string} Path to the package.json file
 * @returns A promise that resolves with the name.
 */
export async function getPackageName(packageJsonPath: string): Promise<string> {
  const packageJsonContent = await packageJSONContents(packageJsonPath)
  return packageJsonContent.name
}

/**
 * Returns the list of production and dev dependencies of a package.json
 * @param packageJsonPath {string} Path to the package.json file
 * @returns A promise that resolves with the list of dependencies.
 */
export async function getDependencies(packageJsonPath: string): Promise<{[key: string]: string}> {
  const packageJsonContent = await packageJSONContents(packageJsonPath)
  const dependencies: {[key: string]: string} = packageJsonContent.dependencies ?? {}
  const devDependencies: {[key: string]: string} = packageJsonContent.devDependencies ?? {}

  return {...dependencies, ...devDependencies}
}

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

export function getOutputUpdateCLIReminder(dependencyManager: DependencyManager, version: string): string {
  const updateCommand = token.packagejsonScript(dependencyManager, 'shopify', 'upgrade')
  return content`💡 Version ${version} available! Run ${updateCommand}`.value
}

interface PackageJSONContents {
  name: string
  version?: string
  dependencies?: {[key: string]: string}
  devDependencies?: {[key: string]: string}
}

export async function packageJSONContents(packageJsonPath: string): Promise<PackageJSONContents> {
  if (!(await fileExists(packageJsonPath))) {
    throw PackageJsonNotFoundError(dirname(packageJsonPath))
  }
  return JSON.parse(await readFile(packageJsonPath))
}

export type DependencyType = 'dev' | 'prod' | 'peer'

interface AddNPMDependenciesIfNeededOptions {
  /** How dependencies should be added */
  type: DependencyType

  /** The dependency manager to use to add dependencies */
  dependencyManager: DependencyManager

  /** The directory that contains the package.json where dependencies will be added */
  directory: string

  /** Standard output coming from the underlying installation process */
  stdout?: Writable

  /** Standard error coming from the underlying installation process */
  stderr?: Writable

  /** Abort signal to stop the process */
  signal?: AbortSignal
}

export interface DependencyVersion {
  name: string
  version: string | undefined
}

/**
 * Adds dependencies to a Node project (i.e. a project that has a package.json)
 * @param dependencies {string[]} List of dependencies to be added.
 * @param options {AddNPMDependenciesIfNeededOptions} Options for adding dependencies.
 */
export async function addNPMDependenciesIfNeeded(
  dependencies: DependencyVersion[],
  options: AddNPMDependenciesIfNeededOptions,
  force = false,
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
  if (!force) {
    dependenciesToAdd = dependencies.filter((dep) => {
      return !existingDependencies.includes(dep.name)
    })
  }
  if (dependenciesToAdd.length === 0) {
    return
  }
  let args: string[]
  const depedenciesWithVersion = dependenciesToAdd.map((dep) => {
    return dep.version ? `${dep.name}@${dep.version}` : dep.name
  })
  switch (options.dependencyManager) {
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
  options.stdout?.write(`Executing...${args.join(' ')}`)
  await exec(options.dependencyManager, args, {
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

// eslint-disable-next-line no-warning-comments
// TODO: Switch it around so add-if-needed depends on this, rather than calling
// if-needed with force: true which is counterintuitive.
export async function addLatestNPMDependencies(dependencies: string[], options: AddNPMDependenciesIfNeededOptions) {
  await addNPMDependenciesIfNeeded(
    dependencies.map((dependency) => {
      return {name: dependency, version: 'latest'}
    }),
    options,
    true,
  )
}

/**
 * Returns the arguments to add dependencies using NPM.
 * @param dependencies {string[]} The list of dependencies to add
 * @param type {DependencyType} The dependency type.
 * @returns {string[]} An array with the arguments.
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
 * @param dependencies {string[]} The list of dependencies to add
 * @param type {DependencyType} The dependency type.
 * @returns {string[]} An array with the arguments.
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
 * @param dependencies {string[]} The list of dependencies to add
 * @param type {DependencyType} The dependency type.
 * @returns {string[]} An array with the arguments.
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
