import {getDeepInstallNPMTasks, updateCLIDependencies} from '../utils/template/npm.js'
import cleanup from '../utils/template/cleanup.js'

import {string, path, file, output, ui, template, npm, git, github, environment, error} from '@shopify/cli-kit'
import {packageManager, PackageManager, packageManagerUsedForCreating} from '@shopify/cli-kit/node/node-package-manager'

interface InitOptions {
  name: string
  directory: string
  template: string
  packageManager: string | undefined
  local: boolean
}

const DirectoryExistsError = (name: string) => {
  return new error.Abort(`\nA directory with this name (${name}) already exists.\nChoose a new name for your app.`)
}

async function init(options: InitOptions) {
  const packageManager: PackageManager = inferPackageManager(options.packageManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)
  const githubRepo = github.parseGithubRepoReference(options.template)

  await ensureAppDirectoryIsAvailable(outputDirectory, hyphenizedName)

  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')
    const templatePathDir = githubRepo.filePath
      ? path.join(templateDownloadDir, githubRepo.filePath)
      : templateDownloadDir
    const templateScaffoldDir = path.join(tmpDir, 'app')
    const repoUrl = githubRepo.branch ? `${githubRepo.repoBaseUrl}#${githubRepo.branch}` : githubRepo.repoBaseUrl

    await file.mkdir(templateDownloadDir)
    let tasks: ui.ListrTasks = []

    await ui.task({
      title: `Downloading template from ${repoUrl}`,
      task: async () => {
        await git.downloadRepository({
          repoUrl,
          destination: templateDownloadDir,
          shallow: true,
        })
        return {successMessage: `Downloaded template from ${repoUrl}`}
      },
    })

    tasks = tasks.concat([
      {
        title: `Initialize your app ${hyphenizedName}`,
        task: async (_, parentTask) => {
          parentTask.title = `Initializing your app ${hyphenizedName}`
          return parentTask.newListr([
            {
              title: 'Parse liquid',
              task: async (_, task) => {
                task.title = 'Parsing liquid'
                await template.recursiveDirectoryCopy(templatePathDir, templateScaffoldDir, {
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  dependency_manager: packageManager,
                  // eslint-disable-next-line @typescript-eslint/naming-convention
                  app_name: options.name,
                })

                task.title = 'Liquid parsed'
              },
            },
            {
              title: 'Update package.json',
              task: async (_, task) => {
                task.title = 'Updating package.json'
                const packageJSON = await npm.readPackageJSON(templateScaffoldDir)

                await npm.updateAppData(packageJSON, hyphenizedName)
                await updateCLIDependencies(packageJSON, options.local)

                await npm.writePackageJSON(templateScaffoldDir, packageJSON)

                task.title = 'Updated package.json'
                parentTask.title = 'App initialized'
              },
            },
          ])
        },
      },
    ])

    if (await environment.local.isShopify()) {
      tasks.push({
        title: "[Shopifolks-only] Configure the project's NPM registry",
        task: async (_, task) => {
          task.title = "[Shopifolks-only] Configuring the project's NPM registry"
          const npmrcPath = path.join(templateScaffoldDir, '.npmrc')
          const npmrcContent = `@shopify:registry=https://registry.npmjs.org\n`
          await file.append(npmrcPath, npmrcContent)
          task.title = "[Shopifolks-only] Project's NPM registry configured."
        },
      })
    }

    tasks = tasks.concat([
      {
        title: `Install dependencies with ${packageManager}`,
        task: async (_, parentTask) => {
          parentTask.title = `Installing dependencies with ${packageManager}`
          function didInstallEverything() {
            parentTask.title = `Dependencies installed with ${packageManager}`
          }

          return parentTask.newListr(
            await getDeepInstallNPMTasks({
              from: templateScaffoldDir,
              packageManager,
              didInstallEverything,
            }),
            {concurrent: false},
          )
        },
      },
      {
        title: 'Clean up',
        task: async (_, task) => {
          task.title = 'Cleaning up'
          await cleanup(templateScaffoldDir)
          task.title = 'Completed clean up'
        },
      },
      {
        title: 'Initializing a Git repository...',
        task: async (_, task) => {
          await git.initializeRepository(templateScaffoldDir)
          task.title = 'Git repository initialized'
        },
      },
    ])

    const list = ui.newListr(tasks, {
      concurrent: false,
      rendererOptions: {collapse: false},
      rendererSilent: environment.local.isUnitTest(),
    })
    await list.run()

    await file.move(templateScaffoldDir, outputDirectory)
  })

  output.info(output.content`
  ${hyphenizedName} is ready for you to build! Remember to ${output.token.genericShellCommand(`cd ${hyphenizedName}`)}
  Check the setup instructions in your README file
  To preview your project, run ${output.token.packagejsonScript(packageManager, 'dev')}
  To add extensions, run ${output.token.packagejsonScript(packageManager, 'scaffold extension')}
  For more details on all that you can build, see the docs: ${output.token.link(
    'shopify.dev',
    'https://shopify.dev',
  )} ✨

  For help and a list of commands, enter ${output.token.packagejsonScript(packageManager, 'shopify app', '--help')}
  `)
}

function inferPackageManager(optionsPackageManager: string | undefined): PackageManager {
  if (optionsPackageManager && packageManager.includes(optionsPackageManager as PackageManager)) {
    return optionsPackageManager as PackageManager
  }
  const usedPackageManager = packageManagerUsedForCreating()
  return usedPackageManager === 'unknown' ? 'npm' : usedPackageManager
}

async function ensureAppDirectoryIsAvailable(directory: string, name: string): Promise<void> {
  const exists = await file.exists(directory)
  if (exists) throw DirectoryExistsError(name)
}

export default init
