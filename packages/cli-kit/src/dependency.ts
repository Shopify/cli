import {Bug} from './error';

export enum DependencyManager {
  Npm,
  Yarn,
  Pnpm,
}

/**
 * Returns the dependency manager used to run the create workflow.
 * @param env {Object} The environment variables of the process in which the CLI runs.
 * @returns The dependency manager
 */
export function createDependencyManager(env = process.env): DependencyManager {
  if (env.npm_lifecycle_event === 'npx') {
    return DependencyManager.Npm;
    // has key PNPM_HOME
  } else if (env.npm_config_user_agent?.includes('yarn')) {
    return DependencyManager.Yarn;
  } else if (env.PNPM_HOME) {
    return DependencyManager.Pnpm;
  } else {
    throw new Bug(
      "Couldn't determine the dependency used to run the create workflow",
    );
  }
}
