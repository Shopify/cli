/// <reference types="node" />
export declare enum DependencyManager {
  Npm = 'npm',
  Yarn = 'yarn',
  Pnpm = 'pnpm',
}
/**
 * Returns the dependency manager used to run the create workflow.
 * @param env {Object} The environment variables of the process in which the CLI runs.
 * @returns The dependency manager
 */
export declare function dependencyManagerUsedForCreating(
  env?: NodeJS.ProcessEnv,
): DependencyManager;
/**
 * Installs the dependencies in the given directory.
 * @param directory {string} The directory that contains the package.json
 * @param dependencyManager {DependencyManager} The dependency manager to use to install the dependencies.
 * @returns
 */
export declare function install(
  directory: string,
  dependencyManager: DependencyManager,
): Promise<void>;
