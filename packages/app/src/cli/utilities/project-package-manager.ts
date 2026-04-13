import {Project} from '../models/project/project.js'
import {ProjectPackageManager} from '@shopify/cli-kit/node/node-package-manager'
import {AbortError} from '@shopify/cli-kit/node/error'

/**
 * Narrows project package-manager metadata for install/mutation operations.
 */
export function requireProjectPackageManagerForOperations(
  project: Pick<Project, 'packageManager' | 'directory'>,
): ProjectPackageManager {
  if (project.packageManager === 'unknown') {
    throw new AbortError(
      `Could not determine the project package manager for ${project.directory}. Add a package.json to the app root before running dependency operations.`,
    )
  }

  return project.packageManager
}
