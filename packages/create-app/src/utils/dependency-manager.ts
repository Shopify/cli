enum DependencyManager {
  Npm,
  Yarn,
}

/**
 * Returns the dependency manager used to create the app.
 * @param env {Object} The environment variables of the process in which the CLI runs.
 * @returns
 */
export function dependencyManagerUsedForCreating(
  env = process.env,
): DependencyManager {
  if (env.npm_lifecycle_event === 'npx') {
    return DependencyManager.Npm;
  } else {
    return DependencyManager.Yarn;
  }
}
