import {error, output, ui} from '@shopify/cli-kit'
import {username} from '@shopify/cli-kit/node/os'
import {
  findUpAndReadPackageJson,
  installNodeModules,
  PackageJson,
  packageManager,
  PackageManager,
  packageManagerUsedForCreating,
  writePackageJSON,
} from '@shopify/cli-kit/node/node-package-manager'
import {parseGitHubRepositoryURL} from '@shopify/cli-kit/node/github'
import {hyphenate} from '@shopify/cli-kit/common/string'
import {recursiveLiquidTemplateCopy} from '@shopify/cli-kit/node/liquid'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {isShopify, isUnitTest} from '@shopify/cli-kit/node/environment/local'
import {
  addAllToGitFromDirectory,
  createGitCommit,
  downloadGitRepository,
  initializeGitRepository,
} from '@shopify/cli-kit/node/git'
import {appendFile, fileExists, inTemporaryDirectory, mkdir, moveFile, rmdir, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath, glob, findPathUp} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

interface InitOptions {
  name: string
  template: string
  directory: string
  packageManager?: string
  shopifyCliVersion?: string
  hydrogenVersion?: string
  local: boolean
}

const suggestHydrogenSupport = () => `
Help us make Hydrogen better by reporting this error so we can improve this message and/or fix the error.
  - Chat with us on Discord: https://discord.com/invite/ppSbThrFaS
  - Create an issue in GitHub: https://github.com/Shopify/hydrogen/issues/new
`

async function init(options: InitOptions) {
  const user = (await username()) ?? ''
  const cliVersion = options.shopifyCliVersion ?? CLI_KIT_VERSION
  const hydrogenPackageVersion = options.hydrogenVersion
  const packageManager = inferPackageManager(options.packageManager)
  const hyphenizedName = hyphenate(options.name)
  const outputDirectory = joinPath(options.directory, hyphenizedName)

  await ui.nonEmptyDirectoryPrompt(outputDirectory)

  await inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = joinPath(tmpDir, 'download')
    const templateScaffoldDir = joinPath(tmpDir, 'app')

    await mkdir(templateDownloadDir)
    await mkdir(templateScaffoldDir)

    let tasks: ui.ListrTasks = []

    const templateInfo = await parseGitHubRepositoryURL(options.template).valueOrAbort()
    const branch = templateInfo.ref ? `#${templateInfo.ref}` : ''
    const templatePath = templateInfo.subDirectory
      ? joinPath(templateDownloadDir, templateInfo.subDirectory)
      : templateDownloadDir

    const repoUrl = `${templateInfo.http}${branch}`
    await ui.task({
      title: `Downloading template from ${repoUrl}`,
      task: async () => {
        await downloadGitRepository({
          repoUrl,
          destination: templateDownloadDir,
          shallow: true,
        })
        if (!(await fileExists(joinPath(templatePath, 'package.json')))) {
          throw new error.Abort(`The template ${templatePath} was not found.`, suggestHydrogenSupport())
        }
        return {successMessage: `Downloaded template from ${repoUrl}`}
      },
    })

    tasks = tasks.concat([
      {
        title: `Initializing your app ${hyphenizedName}`,
        task: async (_, parentTask) => {
          return parentTask.newListr(
            [
              {
                title: 'Parsing template files',
                task: async (_, task) => {
                  const templateData = {
                    name: hyphenizedName,
                    shopify_cli_version: cliVersion,
                    hydrogen_version: hydrogenPackageVersion,
                    author: user,
                    dependency_manager: options.packageManager,
                  }
                  await recursiveLiquidTemplateCopy(templatePath, templateScaffoldDir, templateData)

                  task.title = 'Template files parsed'
                },
              },
              {
                title: 'Updating package.json',
                task: async (_, task) => {
                  const packageJSON = (await findUpAndReadPackageJson(templateScaffoldDir)).content
                  packageJSON.name = hyphenizedName
                  packageJSON.author = (await username()) ?? ''
                  await updateCLIDependencies(packageJSON, options.local, {
                    dependencies: {
                      '@shopify/hydrogen': hydrogenPackageVersion,
                    },
                    devDependencies: {
                      '@shopify/cli-hydrogen': cliVersion,
                      '@shopify/cli': cliVersion,
                    },
                  })
                  await updateCLIScripts(packageJSON)
                  await writePackageJSON(templateScaffoldDir, packageJSON)

                  task.title = 'Package.json updated'
                  parentTask.title = 'App initialized'
                },
              },
            ],
            {concurrent: false},
          )
        },
      },
    ])

    if (await isShopify()) {
      tasks.push({
        title: "[Shopifolks-only] Configuring the project's NPM registry",
        task: async (_, task) => {
          await writeToNpmrc(templateScaffoldDir, `@shopify:registry=https://registry.npmjs.org`)
          task.title = "[Shopifolks-only] Project's NPM registry configured."
        },
      })
    }

    tasks = tasks.concat([
      {
        title: `Installing dependencies with ${packageManager}`,
        task: async (_, task) => {
          const stdout = new Writable({
            write(chunk, encoding, next) {
              task.output = chunk.toString()
              next()
            },
          })
          await installDependencies(templateScaffoldDir, packageManager, stdout)
        },
      },
      {
        title: 'Cleaning up',
        task: async (_, task) => {
          await cleanup(templateScaffoldDir)

          task.title = 'Completed clean up'
        },
      },
      {
        title: 'Initializing a Git repository...',
        task: async (_, task) => {
          await initializeGitRepository(templateScaffoldDir)
          await addAllToGitFromDirectory(templateScaffoldDir)
          await createGitCommit('Initial commit generated by Hydrogen', {directory: templateScaffoldDir})
          task.title = 'Git repository initialized'
        },
      },
    ])

    const list = ui.newListr(tasks, {
      concurrent: false,
      rendererOptions: {collapse: false},
      rendererSilent: isUnitTest(),
    })

    await list.run()

    await moveFile(templateScaffoldDir, outputDirectory)
  })

  output.info(output.content`
✨ ${hyphenizedName} is ready to build!
🚀 Run ${output.token.packagejsonScript(
    packageManager,
    'dev',
  )} to start your local development server and start building.

📚 Docs: ${output.token.link('Quick start guide', 'https://shopify.dev/custom-storefronts/hydrogen')}`)

  output.info(output.content`
👋 Note: your project will display inventory from the Hydrogen Demo Store.\
 To connect this project to your Shopify store’s inventory instead,\
 update ${output.token.yellow(`${hyphenizedName}/hydrogen.config.js`)} with your\
 store ID and Storefront API key.\n`)
}

function inferPackageManager(optionsPackageManager: string | undefined): PackageManager {
  if (optionsPackageManager && packageManager.includes(optionsPackageManager as PackageManager)) {
    return optionsPackageManager as PackageManager
  }
  const usedPackageManager = packageManagerUsedForCreating()
  return usedPackageManager === 'unknown' ? 'npm' : usedPackageManager
}

export default init

interface PackageDependencies {
  devDependencies: {[key: string]: string | undefined}
  dependencies: {[key: string]: string | undefined}
}

async function updateCLIScripts(packageJSON: PackageJson): Promise<PackageJson> {
  packageJSON.scripts = packageJSON.scripts || {}
  packageJSON.scripts.dev = `shopify hydrogen dev`

  return packageJSON
}

async function updateCLIDependencies(
  packageJSON: PackageJson,
  local: boolean,
  packageDependencies: PackageDependencies,
): Promise<PackageJson> {
  const {devDependencies, dependencies} = packageDependencies

  packageJSON.devDependencies = packageJSON.devDependencies || {}
  packageJSON.dependencies = packageJSON.dependencies || {}

  Object.keys(devDependencies).forEach((key) => {
    packageJSON.devDependencies![key] = devDependencies[key] || packageJSON.devDependencies![key]!
  })

  Object.keys(dependencies).forEach((key) => {
    packageJSON.dependencies![key] = dependencies[key] || packageJSON.dependencies![key]!
  })

  if (local) {
    const devDependencyOverrides = {
      '@shopify/cli': `file:${(await findPathUp('packages/cli', {type: 'directory'})) as string}`,
      '@shopify/cli-hydrogen': `file:${(await findPathUp('packages/cli-hydrogen', {type: 'directory'})) as string}`,
    }

    packageJSON.overrides = packageJSON.overrides
      ? {...packageJSON.overrides, ...devDependencyOverrides}
      : devDependencyOverrides

    packageJSON.resolutions = packageJSON.resolutions
      ? {...packageJSON.resolutions, ...devDependencyOverrides}
      : devDependencyOverrides
  }

  return packageJSON
}

async function installDependencies(directory: string, packageManager: PackageManager, stdout: Writable): Promise<void> {
  if (packageManager === 'pnpm') {
    await writeToNpmrc(directory, 'auto-install-peers = true')
  }
  await installNodeModules({directory, packageManager, stdout, args: []})
}

async function writeToNpmrc(directory: string, content: string) {
  const npmrcPath = joinPath(directory, '.npmrc')
  const npmrcContent = `${content}\n`
  if (!(await fileExists(npmrcPath))) {
    await touchFile(npmrcPath)
  }
  await appendFile(npmrcPath, npmrcContent)
}

async function cleanup(webOutputDirectory: string) {
  const gitPaths = await glob(
    [
      joinPath(webOutputDirectory, '**', '.git'),
      joinPath(webOutputDirectory, '**', '.github'),
      joinPath(webOutputDirectory, '**', '.gitmodules'),
      joinPath(webOutputDirectory, '.stackblitzrc'),
    ],
    {
      dot: true,
      onlyFiles: false,
      onlyDirectories: false,
      ignore: ['**/node_modules/**'],
    },
  )

  return Promise.all(gitPaths.map((path) => rmdir(path, {force: true}))).then(() => {})
}
