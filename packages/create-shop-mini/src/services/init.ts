import {getDeepInstallNPMTasks} from '../utils/template/npm.js'
import {
  getLatestNPMPackageVersion,
  findUpAndReadPackageJson,
  packageManager,
  PackageManager,
  packageManagerUsedForCreating,
  writePackageJSON,
} from '@shopify/cli-kit/node/node-package-manager'
import ReplaceInFile from 'replace-in-file'
import {renderSuccess, renderTasks, Task} from '@shopify/cli-kit/node/ui'
import {parseGitHubRepositoryReference} from '@shopify/cli-kit/node/github'
import {hyphenate, capitalize, camelize} from '@shopify/cli-kit/common/string'
import {recursiveLiquidTemplateCopy} from '@shopify/cli-kit/node/liquid'
import {isShopify} from '@shopify/cli-kit/node/context/local'
import {downloadGitRepository, initializeGitRepository} from '@shopify/cli-kit/node/git'
import {appendFile, fileExists, inTemporaryDirectory, mkdir, moveFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {username} from '@shopify/cli-kit/node/os'
import {AbortError} from '@shopify/cli-kit/node/error'
import {formatPackageManagerCommand} from '@shopify/cli-kit/node/output'

const {replaceInFile} = ReplaceInFile

interface InitOptions {
  name: string
  directory: string
  template: string
  packageManager: string | undefined
  local: boolean
}

async function init(options: InitOptions) {
  const packageManager: PackageManager = inferPackageManager(options.packageManager)
  const hyphenatedName = hyphenate(options.name)
  const pascalName = capitalize(camelize(hyphenatedName))
  const outputDirectory = joinPath(options.directory, hyphenatedName)
  const githubRepo = parseGitHubRepositoryReference("https://github.com/Shopify/shop-minis-cli/templates")
  const templatesSubpath = `/__template_${options.template}`
  const templatesCommonSubpath = `/__template_common`

  await ensureAppDirectoryIsAvailable(outputDirectory, hyphenatedName)

  await inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = joinPath(tmpDir, 'download')
    const templatePathDir = githubRepo.filePath
      ? joinPath(templateDownloadDir, githubRepo.filePath)
      : templateDownloadDir
    const templateScaffoldDir = joinPath(tmpDir, 'shop-mini')
    const repoUrl = githubRepo.branch ? `${githubRepo.baseURL}#${githubRepo.branch}` : githubRepo.baseURL

    await mkdir(templateDownloadDir)
    const tasks: Task<unknown>[] = [
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
      {
        title: 'Parsing liquid',
        task: async () => {
          await Promise.all([templatesSubpath, templatesCommonSubpath].map(async (subpath) => {
            const templateDirWithSubpath = joinPath(templatePathDir, subpath)
            await recursiveLiquidTemplateCopy(templateDirWithSubpath, templateScaffoldDir, {})
          }))
          // Should be replaced by liquid parsing
          const stringsToReplace = {
            __MINI_APP_NAME__: options.name,
            __MINI_APP_HANDLE_PASCAL_CASE__: pascalName,
            __MINI_APP_HANDLE_KEBAB_CASE__: hyphenatedName,
            __SHOP_MINIS_CLI_VERSION__: await getLatestNPMPackageVersion('@shopify/shop-minis-cli'),
          }
          await replaceStringsInTemplate(templateScaffoldDir, stringsToReplace)
        },
      },
      {
        title: 'Updating package.json',
        task: async () => {
          const packageJSON = (await findUpAndReadPackageJson(templateScaffoldDir)).content
          packageJSON.name = hyphenatedName
          packageJSON.author = (await username()) ?? ''

          await writePackageJSON(templateScaffoldDir, packageJSON)

          // Ensure that the installation of dependencies doesn't fail when using
          // pnpm due to missing peerDependencies.
          if (packageManager === 'pnpm') {
            await appendFile(joinPath(templateScaffoldDir, '.npmrc'), `auto-install-peers=true\n`)
          }
        },
      },
    ]

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
        title: 'Installing dependencies',
        task: async () => {
          const subtasks = await getDeepInstallNPMTasks({from: templateScaffoldDir, packageManager})
          return subtasks
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

  renderSuccess({
    headline: [{userInput: hyphenatedName}, 'is ready!'],
    nextSteps: [
      ['Run', {command: `cd ${hyphenatedName}`}],
      ['Run Shop Mini, and open it on an iOS or Android device:', {command: formatPackageManagerCommand(packageManager, 'start')}],
    ],
    reference: [
      {link: {label: 'Shop minis documentation', url: 'https://shop.app/minis/docs/'}},
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
  const exists = await fileExists(directory)
  if (exists)
    throw new AbortError(`\nA directory with this name (${name}) already exists.\nChoose a new name for your app.`)
}

async function replaceStringsInTemplate(
  dir: string,
  stringsToReplace: Record<string, string>
) {
  for (const [replaceKey, replaceValue] of Object.entries(stringsToReplace)) {
    const replaceOptions = {
      files: [`${dir}/**/*.*`],
      from: new RegExp(replaceKey, 'g'),
      to: replaceValue,
      optionsForFiles: {
        ignore: ['**/node_modules/**'],
      },
    }

    await replaceInFile(replaceOptions)
  }
}

export default init
