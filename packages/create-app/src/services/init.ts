import {getDeepInstallNPMTasks, updateCLIDependencies} from '../utils/template/npm'
import cleanup from '../utils/template/cleanup'

import {string, path, file, output, ui, dependency, template, npm, git, environment} from '@shopify/cli-kit'

interface InitOptions {
  name: string
  directory: string
  template: string
  dependencyManager: string | undefined
  local: boolean
}

async function init(options: InitOptions) {
  const dependencyManager: dependency.DependencyManager = inferDependencyManager(options.dependencyManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)

  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')
    const templateScaffoldDir = path.join(tmpDir, 'app')

    await file.mkdir(templateDownloadDir)
    let tasks: ConstructorParameters<typeof ui.Listr>[0] = []

    tasks = tasks.concat([
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
    ])

    if (await environment.local.isShopify()) {
      tasks.push({
        title: "[Shopifolks-only] Configuring the project's NPM registry",
        task: async (_, task) => {
          const npmrcPath = path.join(templateScaffoldDir, '.npmrc')
          const npmrcContent = `registry=https://registry.npmjs.org`
          await file.write(npmrcPath, npmrcContent)
          task.title = "[Shopifolks-only] Project's NPM registry configured."
        },
      })
    }

    tasks = tasks.concat([
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
    ])

    const list = new ui.Listr(tasks, {
      concurrent: false,
      rendererOptions: {collapse: false},
      rendererSilent: environment.local.isUnitTest(),
    })
    await list.run()

    await file.move(templateScaffoldDir, outputDirectory)
  })

  output.info(output.content`
  ${hyphenizedName} is ready for you to build! Remember to cd into your new directory.
  To preview your project, run ${output.token.command(`${dependencyManager} dev`)}
  To add extensions, run a scaffold command. For more details on all that you can build, see the docs: ${output.token.link(
    'shopify.dev',
    'https://shopify.dev',
  )}. ✨

  For help and a list of commands, enter --help.
  `)
}

function inferDependencyManager(optionsDependencyManager: string | undefined): dependency.DependencyManager {
  if (
    optionsDependencyManager &&
    dependency.dependencyManager.includes(optionsDependencyManager as dependency.DependencyManager)
  ) {
    return optionsDependencyManager as dependency.DependencyManager
  }
  return dependency.dependencyManagerUsedForCreating()
}

export default init
