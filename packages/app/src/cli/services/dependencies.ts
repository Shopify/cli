import {AppInterface} from '../models/app/app.js'
import {installNPMDependenciesRecursively} from '@shopify/cli-kit/node/node-package-manager'
import {renderTasks} from '@shopify/cli-kit/node/ui'

/**
 * Given an app, it installs its NPM dependencies by traversing
 * the sub-directories and finding the ones that have NPM dependencies
 * defined in package.json files.
 * @param app - App whose dependencies will be installed.
 * @returns An copy of the app with the Node dependencies updated.
 */
export async function installAppDependencies(app: AppInterface) {
  const tasks = [
    {
      title: 'Installing dependencies',
      task: async () => {
        await installNPMDependenciesRecursively({
          packageManager: app.packageManager,
          directory: app.directory,
          deep: 3,
        })
      },
    },
  ]
  await renderTasks(tasks)
  await app.updateDependencies()
  return app
}
