import {Project} from '../models/project/project.js'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'

/**
 * Formats a follow-up command for the current project.
 *
 * Display-only paths should use this helper instead of branching on the
 * project's package manager directly.
 */
export function formatProjectFollowUpCommand(
  project: Pick<Project, 'packageManager'>,
  command: string,
  ...args: string[]
) {
  return formatPackageManagerCommand(project.packageManager, command, ...args)
}
