import {getDeepInstallNPMTasks, updateCLIDependencies} from './template/npm.js'
import cleanup from './template/cleanup.js'
import link from '../app/config/link.js'
import {OrganizationApp} from '../../models/organization.js'
import {DeveloperPlatformClient} from '../../utilities/developer-platform-client.js'
import {loadConfigForAppCreation} from '../../models/app/loader.js'
import {SelectAppOrNewAppNameResult} from '../../commands/app/init.js'
import {linkedAppContext} from '../app-context.js'
import {
  findUpAndReadPackageJson,
  lockfiles,
  PackageManager,
  UnknownPackageManagerError,
  writePackageJSON,
} from '@shopify/cli-kit/node/node-package-manager'
import {renderInfo, renderSuccess, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {parseGitHubRepositoryReference} from '@shopify/cli-kit/node/github'
import {hyphenate} from '@shopify/cli-kit/common/string'
import {recursiveLiquidTemplateCopy} from '@shopify/cli-kit/node/liquid'
import {isShopify} from '@shopify/cli-kit/node/context/local'
import {downloadGitRepository, initializeGitRepository} from '@shopify/cli-kit/node/git'
import {
  appendFile,
  fileExists,
  fileExistsSync,
  inTemporaryDirectory,
  mkdir,
  moveFile,
  readFile,
  writeFile,
} from '@shopify/cli-kit/node/fs'
import {joinPath, normalizePath} from '@shopify/cli-kit/node/path'
import {username} from '@shopify/cli-kit/node/os'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'
import {LocalStorage} from '@shopify/cli-kit/node/local-storage'

interface InitOptions {
  name: string
  selectedAppOrNameResult: SelectAppOrNewAppNameResult
  directory: string
  template: string
  packageManager: PackageManager
  local: boolean
  useGlobalCLI: boolean
  developerPlatformClient: DeveloperPlatformClient
  postCloneActions: {
    removeLockfilesFromGitignore: boolean
  }
}

async function init(options: InitOptions) {
  const packageManager: PackageManager = options.packageManager
  const hyphenizedName = hyphenate(options.name)
  const outputDirectory = joinPath(options.directory, hyphenizedName)
  const githubRepo = parseGitHubRepositoryReference(options.template)

  await ensureAppDirectoryIsAvailable(outputDirectory, hyphenizedName)
  // Remove cache from previous projects in the same directory
  await clearCache(outputDirectory)

  renderInfo({
    body: [
      `Initializing project with`,
      {command: packageManager},
      `\nUse the`,
      {command: `--package-manager`},
      `flag to select a different package manager.`,
    ],
  })

  await inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = joinPath(tmpDir, 'download')
    const templatePathDir = githubRepo.filePath
      ? joinPath(templateDownloadDir, githubRepo.filePath)
      : templateDownloadDir
    const templateScaffoldDir = joinPath(tmpDir, 'app')
    const repoUrl = githubRepo.branch ? `${githubRepo.baseURL}#${githubRepo.branch}` : githubRepo.baseURL

    await mkdir(templateDownloadDir)
    const tasks: Task[] = [
      {
        title: `Downloading template from ${repoUrl}`,
        task: async () => {
          await downloadGitRepository({
            repoUrl,
            destination: templateDownloadDir,
            shallow: true,
          })
        },
      },
    ]

    tasks.push(
      {
        title: 'Parsing liquid',
        task: async () => {
          await recursiveLiquidTemplateCopy(templatePathDir, templateScaffoldDir, {
            dependency_manager: packageManager,
            app_name: options.name,
          })
        },
      },
      {
        title: 'Updating package.json',
        task: async () => {
          const packageJSON = (await findUpAndReadPackageJson(templateScaffoldDir)).content
          packageJSON.name = hyphenizedName
          packageJSON.author = (await username()) ?? ''
          packageJSON.private = true
          const workspacesFolders = ['extensions/*'].concat(detectAdditionalWorkspacesFolders(templateScaffoldDir))

          switch (packageManager) {
            case 'npm':
            case 'yarn':
            case 'bun':
              packageJSON.workspaces = workspacesFolders
              break
            case 'pnpm': {
              const workspacesContent = workspacesFolders.map((folder) => ` - '${folder}'`).join(`\n`)
              await writeFile(joinPath(templateScaffoldDir, 'pnpm-workspace.yaml'), `packages:\n${workspacesContent}`)
              // Ensure that the installation of dependencies doesn't fail when using
              // pnpm due to missing peerDependencies.
              await appendFile(joinPath(templateScaffoldDir, '.npmrc'), `auto-install-peers=true\n`)
              break
            }
            case 'unknown':
              throw new UnknownPackageManagerError()
          }

          await updateCLIDependencies({
            packageJSON,
            local: options.local,
            directory: templateScaffoldDir,
            useGlobalCLI: options.useGlobalCLI,
          })
          await writePackageJSON(templateScaffoldDir, packageJSON)
        },
      },
    )

    if (options.postCloneActions.removeLockfilesFromGitignore) {
      tasks.push({
        title: 'Removing lockfiles from .gitignore',
        task: async () => {
          const gitignorePath = joinPath(templateScaffoldDir, '.gitignore')
          if (await fileExists(gitignorePath)) {
            let existingContent = await readFile(gitignorePath)

            lockfiles.forEach((lockfile) => {
              // convert to a regex matching a whole line, escaping any special characters
              const lockfileRegex = new RegExp(`^${lockfile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'gm')
              existingContent = existingContent.replace(lockfileRegex, '')
            })

            await writeFile(gitignorePath, existingContent.trim())
          }
        },
      })
    }

    if (await isShopify()) {
      tasks.push({
        title: "[Shopifolks-only] Configuring the project's NPM registry",
        task: async () => {
          const npmrcPath = joinPath(templateScaffoldDir, '.npmrc')
          const npmrcContent = `@shopify:registry=https://registry.npmjs.org\n`
          await appendFile(npmrcPath, npmrcContent)
        },
      })
    }

    tasks.push(
      {
        title: `Installing dependencies with ${packageManager}`,
        task: async () => {
          await getDeepInstallNPMTasks({from: templateScaffoldDir, packageManager})
        },
      },
      {
        title: 'Cleaning up',
        task: async () => {
          await cleanup(templateScaffoldDir, packageManager)
        },
      },
      {
        title: 'Initializing a Git repository...',
        task: async () => {
          await initializeGitRepository(templateScaffoldDir)
        },
      },
    )

    await renderTasks(tasks)

    await moveFile(templateScaffoldDir, outputDirectory)
  })

  let app: OrganizationApp
  if (options.selectedAppOrNameResult.result === 'new') {
    const creationOptions = await loadConfigForAppCreation(outputDirectory, options.name)
    const org = options.selectedAppOrNameResult.org
    app = await options.developerPlatformClient.createApp(org, options.name, creationOptions)
  } else {
    app = options.selectedAppOrNameResult.app
  }

  // Link the new project to the selected/created App
  await link(
    {
      directory: outputDirectory,
      apiKey: app.apiKey,
      appId: app.id,
      organizationId: app.organizationId,
      configName: 'shopify.app.toml',
      developerPlatformClient: options.developerPlatformClient,
      isNewApp: true,
    },
    false,
  )

  const appContextResult = await linkedAppContext({
    directory: outputDirectory,
    clientId: undefined,
    forceRelink: false,
    userProvidedConfigName: undefined,
    unsafeReportMode: false,
  })

  renderSuccess({
    headline: [{userInput: hyphenizedName}, 'is ready for you to build!'],
    nextSteps: [
      ['Run', {command: `cd ${hyphenizedName}`}],
      ['For extensions, run', {command: formatPackageManagerCommand(packageManager, 'shopify app generate extension')}],
      ['To see your app, run', {command: formatPackageManagerCommand(packageManager, 'shopify app dev')}],
    ],
    reference: [
      {link: {label: 'Shopify docs', url: 'https://shopify.dev'}},
      [
        'For an overview of commands, run',
        {command: formatPackageManagerCommand(packageManager, 'shopify app', '--help')},
      ],
    ],
  })

  return {app: appContextResult.app}
}

async function ensureAppDirectoryIsAvailable(directory: string, name: string): Promise<void> {
  const exists = await fileExists(directory)
  if (exists)
    throw new AbortError(`\nA directory with this name (${name}) already exists.\nChoose a new name for your app.`)
}

async function clearCache(directory: string) {
  const appCache = new LocalStorage({projectName: 'shopify-cli-app'})
  const normalizedDirectory = normalizePath(directory)
  appCache.delete(normalizedDirectory)
}

function detectAdditionalWorkspacesFolders(directory: string) {
  return ['web', 'web/frontend'].filter((folder) => fileExistsSync(joinPath(directory, folder)))
}

export default init
