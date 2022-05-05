import {getDeepInstallNPMTasks, updateCLIDependencies} from '../utils/template/npm'
import cleanup from '../utils/template/cleanup'

import {string, path, file, output, ui, dependency, template, npm, git} from '@shopify/cli-kit'

interface InitOptions {
  name: string
  directory: string
  template: string
  dependencyManager: string | undefined
  local: boolean
}

async function init(options: InitOptions) {
  const dependencyManager = inferDependencyManager(options.dependencyManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)

  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')
    const templateScaffoldDir = path.join(tmpDir, 'app')

    await file.mkdir(templateDownloadDir)

    const list = new ui.Listr(
      [
        {
          title: 'Downloading template',
          task: async (_, task) => {
            await git.downloadRepository({
              repoUrl: options.template,
              destination: templateDownloadDir,
            })
            task.title = 'Template downloaded'
          },
        },
        {
          title: `Initializing your app ${hyphenizedName}`,
          task: async (_, parentTask) => {
            return parentTask.newListr([
              {
                title: 'Parsing liquid',
                task: async (_, task) => {
                  await template.recursiveDirectoryCopy(templateDownloadDir, templateScaffoldDir, {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    dependency_manager: dependencyManager,
                  })

                  task.title = 'Liquid parsed'
                },
              },
              {
                title: 'Updating package.json',
                task: async (_, task) => {
                  const packageJSON = await npm.readPackageJSON(templateScaffoldDir)

                  await npm.updateAppData(packageJSON, hyphenizedName)
                  await updateCLIDependencies(packageJSON, options.local)

                  await npm.writePackageJSON(templateScaffoldDir, packageJSON)

                  task.title = 'Package.json updated'
                  parentTask.title = 'App initialized'
                },
              },
            ])
          },
        },
        {
          title: `Installing dependencies with ${dependencyManager}`,
          task: async (_, parentTask) => {
            function didInstallEverything() {
              parentTask.title = `Dependencies installed with ${dependencyManager}`
            }

            return parentTask.newListr(
              await getDeepInstallNPMTasks({
                from: templateScaffoldDir,
                dependencyManager,
                didInstallEverything,
              }),
              {concurrent: false},
            )
          },
        },
        {
          title: 'Cleaning up',
          task: async (_, task) => {
            await cleanup(templateScaffoldDir)

            task.title = 'Completed clean up'
          },
        },
      ],
      {concurrent: false},
    )
    await list.run()

    await file.move(templateScaffoldDir, outputDirectory)
  })

  output.info(output.content`
  ${hyphenizedName} is ready to build! ✨
    Docs: ${output.token.link('Quick start guide', 'https://shopify.dev/apps/getting-started')}
    Inspiration ${output.token.command(`${dependencyManager} shopify help`)}
  `)
}

function inferDependencyManager(optionsDependencyManager: string | undefined): dependency.DependencyManager {
  if (optionsDependencyManager && dependency.dependencyManager.includes(optionsDependencyManager)) {
    return optionsDependencyManager as dependency.DependencyManager
  }
  return dependency.dependencyManagerUsedForCreating()
}

export default init
