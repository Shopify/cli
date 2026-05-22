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
  rmdir,
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
              await ensurePnpmWorkspaceFile(templateScaffoldDir, workspacesFolders)
              // Ensure that the installation of dependencies doesn't fail when using
              // pnpm due to missing peerDependencies.
              await appendFile(joinPath(templateScaffoldDir, '.npmrc'), `auto-install-peers=true\n`)
              break
            }
            case 'homebrew':
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

    // Move the scaffolded template into its final directory BEFORE installing
    // dependencies. pnpm (and other package managers) create absolute-path
    // junctions/symlinks on Windows, so installing in the temp dir and then
    // moving the tree orphans every link under node_modules/.pnpm/*.
    let outputDirectoryCreated = false
    tasks.push({
      title: 'Preparing project directory',
      task: async () => {
        await ensureAppDirectoryIsAvailable(outputDirectory, hyphenizedName)
        outputDirectoryCreated = true
        await moveFile(templateScaffoldDir, outputDirectory)
      },
    })

    tasks.push(
      {
        title: `Installing dependencies with ${packageManager}`,
        task: async () => {
          await getDeepInstallNPMTasks({from: outputDirectory, packageManager})
        },
      },
      {
        title: 'Cleaning up',
        task: async () => {
          await cleanup(outputDirectory, packageManager)
        },
      },
      {
        title: 'Initializing a Git repository...',
        task: async () => {
          await initializeGitRepository(outputDirectory)
        },
      },
    )

    try {
      await renderTasks(tasks)
    } catch (error) {
      // If a task failed after the project was moved to its final directory,
      // remove the partial project so the user isn't left with a half-baked
      // scaffold (no node_modules, no cleanup, no git init).
      if (outputDirectoryCreated) {
        await rmdir(outputDirectory).catch(() => {})
      }
      throw error
    }
  })

  let app: OrganizationApp
  if (options.selectedAppOrNameResult.result === 'new') {
    const creationOptions = await loadConfigForAppCreation(outputDirectory, options.name)
    const org = options.selectedAppOrNameResult.org
    app = await options.developerPlatformClient.createApp(org, creationOptions)
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
        {
          link: {
            label: 'Shopify Dev MCP,',
            url: 'https://shopify.dev/docs/apps/build/devmcp',
          },
        },
        'connect your AI assistant to development resources',
      ],
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

export async function ensurePnpmWorkspaceFile(directory: string, workspacesFolders: string[]) {
  const pnpmWorkspacePath = joinPath(directory, 'pnpm-workspace.yaml')
  if (await fileExists(pnpmWorkspacePath)) {
    return
  }
  const workspacesContent = workspacesFolders.map((folder) => ` - '${folder}'`).join(`\n`)
  await writeFile(pnpmWorkspacePath, `packages:\n${workspacesContent}`)
}

export default init
