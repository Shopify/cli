import {exec} from './system'
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

/**
 * Installs the dependencies in the given directory.
 * @param directory {string} The directory that contains the package.json
 * @param dependencyManager {DependencyManager} The dependency manager to use to install the dependencies.
 * @param stdout {Writable} Standard output stream.
 * @returns stderr {Writable} Standard error stream.
 */
export async function install(
  directory: string,
  dependencyManager: DependencyManager,
  stdout?: Writable,
  stderr?: Writable,
) {
  const options: ExecOptions = {cwd: directory, stdout, stderr}
  await exec(dependencyManager, ['install'], options)
}
