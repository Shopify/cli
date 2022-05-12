import {exec} from './system'
import {glob, dirname, join as pathJoin} from './path'
import type {Writable} from 'node:stream'
import type {ExecOptions} from './system'

export enum DependencyManager {
  Npm = 'npm',
  Yarn = 'yarn',
  Pnpm = 'pnpm',
}
export const dependencyManager = Object.entries(DependencyManager).map(([_, value]) => `${value}`)

/**
 * Returns the dependency manager used to run the create workflow.
 * @param env {Object} The environment variables of the process in which the CLI runs.
 * @returns The dependency manager
 */
export function dependencyManagerUsedForCreating(env = process.env): DependencyManager {
  if (env.npm_config_user_agent?.includes('yarn')) {
    return DependencyManager.Yarn
  } else if (env.npm_config_user_agent?.includes('pnpm')) {
    return DependencyManager.Pnpm
  } else {
    return DependencyManager.Npm
  }
}

interface InstallRecursivelyOptions {
  /**
   * The dependency manager to use to install the dependencies.
   */
  dependencyManager: DependencyManager
  /**
   * The directory from where we'll find package.json's recursively
   */
  directory: string
}

/**
 * This function traverses down a directory tree to find directories containing a package.json
 * and installs the dependencies if needed. To know if it's needed, it uses the "check" command
 * provided by dependency managers.
 * @param options {InstallRecursivelyOptions} Options to install dependencies recursively.
 */
export async function installRecursively(options: InstallRecursivelyOptions) {
  const packageJsons = await glob(pathJoin(options.directory, '**/package.json'), {
    cwd: options.directory,
    onlyFiles: true,
  })
  const abortController = new AbortController()
  try {
    await Promise.all(
      packageJsons.map(async (packageJsonPath) => {
        const directory = dirname(packageJsonPath)
        await install(directory, options.dependencyManager, undefined, undefined, abortController.signal)
      }),
    )
  } catch (error: any) {
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
