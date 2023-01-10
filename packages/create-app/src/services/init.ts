import {getDeepInstallNPMTasks, updateCLIDependencies} from '../utils/template/npm.js'
import cleanup from '../utils/template/cleanup.js'

import {string, path, file, template, npm, git, environment, error, output} from '@shopify/cli-kit'
import {packageManager, PackageManager, packageManagerUsedForCreating} from '@shopify/cli-kit/node/node-package-manager'
import {renderSuccess, renderTasks} from '@shopify/cli-kit/node/ui'
import {parseGitHubRepositoryReference} from '@shopify/cli-kit/node/github'

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
    let tasks = [
      {
        title: `Downloading template from ${repoUrl}`,
        task: async () => {
          await git.downloadRepository({
            repoUrl,
            destination: templateDownloadDir,
            shallow: true,
          })
        },
      },
    ]

    tasks = tasks.concat([
      {
        title: 'Parsing liquid',
        task: async () => {
          await template.recursiveDirectoryCopy(templatePathDir, templateScaffoldDir, {
            dependency_manager: packageManager,
            app_name: options.name,
          })
        },
      },
      {
        title: 'Updating package.json',
        task: async () => {
          const packageJSON = await npm.readPackageJSON(templateScaffoldDir)

          await npm.updateAppData(packageJSON, hyphenizedName)
          await updateCLIDependencies({packageJSON, local: options.local, directory: templateScaffoldDir})

          await npm.writePackageJSON(templateScaffoldDir, packageJSON)

          // Ensure that the installation of dependencies doesn't fail when using
          // pnpm due to missing peerDependencies.
          if (packageManager === 'pnpm') {
            await file.append(path.join(templateScaffoldDir, '.npmrc'), `auto-install-peers=true\n`)
          }
        },
      },
    ])

    if (await environment.local.isShopify()) {
      tasks.push({
        title: "[Shopifolks-only] Configuring the project's NPM registry",
        task: async () => {
          const npmrcPath = path.join(templateScaffoldDir, '.npmrc')
          const npmrcContent = `@shopify:registry=https://registry.npmjs.org\n`
          await file.append(npmrcPath, npmrcContent)
        },
      })
    }

    tasks = tasks.concat([
      {
        title: `Installing dependencies with ${packageManager}`,
        task: async () => {
          await getDeepInstallNPMTasks({
            from: templateScaffoldDir,
            packageManager,
          })
        },
      },
      {
        title: 'Cleaning up',
        task: async () => {
          await cleanup(templateScaffoldDir)
        },
      },
      {
        title: 'Initializing a Git repository...',
        task: async () => {
          await git.initializeRepository(templateScaffoldDir)
        },
      },
    ])

    await renderTasks(tasks, {
      silent: environment.local.isUnitTest(),
    })

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
