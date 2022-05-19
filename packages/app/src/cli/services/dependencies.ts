import {App} from '../models/app/app'
import {dependency, ui, environment} from '@shopify/cli-kit'

/**
 * Given an app, it installs its NPM dependencies by traversing
 * the sub-directories and finding the ones that have NPM dependencies
 * defined in package.json files.
 * @param app {App} App whose dependencies will be installed.
 */
export async function installAppDependencies(app: App) {
  const list = new ui.Listr(
    [
      {
        title: 'Installing any necessary dependencies',
        task: async (_, task) => {
          await dependency.installNPMDependenciesRecursively({
            dependencyManager: app.dependencyManager,
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
}
