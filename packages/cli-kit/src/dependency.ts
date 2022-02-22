import type {Writable} from 'node:stream'

import {exec} from './system'
import type {ExecOptions} from './system'

export enum DependencyManager {
  Npm = 'npm',
  Yarn = 'yarn',
  Pnpm = 'pnpm',
}
export const dependencyManager = Object.entries(DependencyManager).map(
  ([_, value]) => `${value}`,
)

/**
 * Returns the dependency manager used to run the create workflow.
 * @param env {Object} The environment variables of the process in which the CLI runs.
 * @returns The dependency manager
 */
export function dependencyManagerUsedForCreating(
  env = process.env,
): DependencyManager {
  if (env.npm_lifecycle_event === 'npx') {
    return DependencyManager.Npm
  } else if (env.npm_config_user_agent?.includes('yarn')) {
    return DependencyManager.Yarn
  } else if (env.PNPM_HOME) {
    return DependencyManager.Pnpm
  } else {
    return DependencyManager.Npm
  }
}

/**
 * Installs the dependencies in the given directory.
 * @param directory {string} The directory that contains the package.json
 * @param dependencyManager {DependencyManager} The dependency manager to use to install the dependencies.
 * @returns
 */
export async function install(
  directory: string,
  dependencyManager: DependencyManager,
  stdout?: Writable,
) {
  const options: ExecOptions = {cwd: directory, stdout}
  await exec(dependencyManager, ['install'], options)
}
