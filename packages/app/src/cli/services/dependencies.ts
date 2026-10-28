import {Project} from '../models/project/project.js'
import {installNPMDependenciesRecursively} from '@shopify/cli-kit/node/node-package-manager'
import {renderTasks} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'

/**
 * Given a project, it installs its NPM dependencies by traversing
 * the sub-directories and finding the ones that have NPM dependencies
 * defined in package.json files.
 * @param project - Project whose dependencies will be installed.
 * @param options - Optional signal that stops in-progress installations.
 */
export async function installAppDependencies(project: Project, {signal}: {signal?: AbortSignal} = {}) {
  const tasks = [
    {
      title: 'Installing dependencies',
      task: async () => {
        await installNPMDependenciesRecursively({
          packageManager: project.packageManager,
          directory: project.directory,
          deep: 3,
          signal,
        })
      },
    },
  ]
  await renderTasks(tasks)
}
