import {getDeepInstallNPMTasks, updateCLIDependencies} from '../utils/template/npm.js'
import cleanup from '../utils/template/cleanup.js'

import {string, path, file, ui, npm, git, environment, error, output} from '@shopify/cli-kit'
import {packageManager, PackageManager, packageManagerUsedForCreating} from '@shopify/cli-kit/node/node-package-manager'
import {renderSuccess} from '@shopify/cli-kit/node/ui'
import {parseGitHubRepositoryReference} from '@shopify/cli-kit/node/github'
import {recursiveDirectoryCopy} from '@shopify/cli-kit/node/template'

interface InitOptions {
  name: string
  directory: string
  template: string
  packageManager: string | undefined
  local: boolean
}

async function init(options: InitOptions) {
  const packageManager: PackageManager = inferPackageManager(options.packageManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)
  const githubRepo = parseGitHubRepositoryReference(options.template)

  await ensureAppDirectoryIsAvailable(outputDirectory, hyphenizedName)

  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')
    const templatePathDir = githubRepo.filePath
      ? path.join(templateDownloadDir, githubRepo.filePath)
      : templateDownloadDir
    const templateScaffoldDir = path.join(tmpDir, 'app')
    const repoUrl = githubRepo.branch ? `${githubRepo.baseURL}#${githubRepo.branch}` : githubRepo.baseURL

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
                await recursiveDirectoryCopy(templatePathDir, templateScaffoldDir, {
                  dependency_manager: packageManager,
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
                await updateCLIDependencies({packageJSON, local: options.local, directory: templateScaffoldDir})

                await npm.writePackageJSON(templateScaffoldDir, packageJSON)

                // Ensure that the installation of dependencies doesn't fail when using
                // pnpm due to missing peerDependencies.
                if (packageManager === 'pnpm') {
                  await file.append(path.join(templateScaffoldDir, '.npmrc'), `auto-install-peers=true\n`)
                }

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

  renderSuccess({
    headline: [{userInput: hyphenizedName}, 'is ready for you to build!'],
    nextSteps: [
      ['Run', {command: `cd ${hyphenizedName}`}],
      ['For extensions, run', {command: output.formatPackageManagerCommand(packageManager, 'generate extension')}],
      ['To see your app, run', {command: output.formatPackageManagerCommand(packageManager, 'dev')}],
    ],
    reference: [
      {link: {label: 'Shopify docs', url: 'https://shopify.dev'}},
      [
        'For an overview of commands, run',
        {command: `${output.formatPackageManagerCommand(packageManager, 'shopify app', '--help')}`},
      ],
    ],
  })
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
  if (exists)
    throw new error.Abort(`\nA directory with this name (${name}) already exists.\nChoose a new name for your app.`)
}

export default init
