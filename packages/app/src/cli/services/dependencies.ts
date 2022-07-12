import {AppInterface} from '../models/app/app.js'
import {ui, environment} from '@shopify/cli-kit'
import {installNPMDependenciesRecursively} from '@shopify/cli-kit/node/node-package-manager'

/**
 * Given an app, it installs its NPM dependencies by traversing
 * the sub-directories and finding the ones that have NPM dependencies
 * defined in package.json files.
 * @param app {AppInterface} App whose dependencies will be installed.
 * @returns {Promise<AppInterface>} An copy of the app with the Node dependencies updated.
 */
export async function installAppDependencies(app: AppInterface) {
  const list = ui.newListr(
    [
      {
        title: 'Installing any necessary dependencies',
        task: async (_, task) => {
          await installNPMDependenciesRecursively({
            packageManager: app.packageManager,
            directory: app.directory,
            deep: 3,
          })
          task.title = 'Dependencies installed'
        },
      },
    ],
    {rendererSilent: environment.local.isUnitTest()},
  )
  await list.run()
  await app.updateDependencies()
  return app
}
