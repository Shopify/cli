import {
  string,
  path,
  error,
  file,
  output,
  os,
  ui,
  npm,
  environment,
  github,
  template,
  git,
  constants,
  version,
} from '@shopify/cli-kit'
import {
  installNodeModules,
  packageManager,
  PackageManager,
  packageManagerUsedForCreating,
} from '@shopify/cli-kit/node/node-package-manager'

import {Writable} from 'stream'

interface InitOptions {
  name: string
  template: string
  directory: string
  packageManager?: string
  shopifyCliVersion?: string
  cliHydrogenPackageVersion?: string
  hydrogenVersion?: string
  local: boolean
}

const suggestHydrogenSupport = () => `
Help us make Hydrogen better by reporting this error so we can improve this message and/or fix the error.
  - Chat with us on Discord: https://discord.com/invite/ppSbThrFaS
  - Create an issue in GitHub: https://github.com/Shopify/hydrogen/issues/new
`

async function init(options: InitOptions) {
  const hydrogenVersion = await version.findPackageVersionUp({fromModuleURL: import.meta.url})
  const user = (await os.username()) ?? ''
  const cliPackageVersion = options.shopifyCliVersion ?? (await constants.versions.cliKit())
  const cliHydrogenPackageVersion = options.cliHydrogenPackageVersion ?? hydrogenVersion
  const hydrogenPackageVersion = options.hydrogenVersion
  const packageManager = inferPackageManager(options.packageManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)

  await ui.nonEmptyDirectoryPrompt(outputDirectory)

  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')
    const templateScaffoldDir = path.join(tmpDir, 'app')

    await file.mkdir(templateDownloadDir)
    await file.mkdir(templateScaffoldDir)

    let tasks: ui.ListrTasks = []

    const templateInfo = await github.parseRepoUrl(options.template)
    const branch = templateInfo.ref ? `#${templateInfo.ref}` : ''
    const templatePath = templateInfo.subDirectory
      ? path.join(templateDownloadDir, templateInfo.subDirectory)
      : templateDownloadDir

    const repoUrl = `${templateInfo.http}${branch}`
    await ui.task({
      title: `Downloading template from ${repoUrl}`,
      task: async () => {
        await git.downloadRepository({
          repoUrl,
          destination: templateDownloadDir,
          shallow: true,
        })
        if (!(await file.exists(path.join(templatePath, 'package.json')))) {
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
                    shopify_cli_version: cliPackageVersion,
                    hydrogen_version: hydrogenPackageVersion,
                    author: user,
                    dependency_manager: options.packageManager,
                  }
                  await template.recursiveDirectoryCopy(templatePath, templateScaffoldDir, templateData)

                  task.title = 'Template files parsed'
                },
              },
              {
                title: 'Updating package.json',
                task: async (_, task) => {
                  const packageJSON = await npm.readPackageJSON(templateScaffoldDir)
                  const cliVersion = await constants.versions.cliKit()
                  await npm.updateAppData(packageJSON, hyphenizedName)
                  await updateCLIDependencies(packageJSON, options.local, {
                    dependencies: {
                      '@shopify/hydrogen': hydrogenPackageVersion,
                    },
                    devDependencies: {
                      '@shopify/cli-hydrogen': cliHydrogenPackageVersion,
                      '@shopify/cli': cliVersion,
                    },
                  })
                  await updateCLIScripts(packageJSON)
                  await npm.writePackageJSON(templateScaffoldDir, packageJSON)

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

    if (await environment.local.isShopify()) {
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
          await file.move(`${templateScaffoldDir}/_gitignore`, `${templateScaffoldDir}/.gitignore`)
          await git.initializeRepository(templateScaffoldDir)
          await git.addAll(templateScaffoldDir)
          await git.commit('Initial commit generated by hydrogen', {directory: templateScaffoldDir})
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

async function updateCLIScripts(packageJSON: npm.PackageJSON): Promise<npm.PackageJSON> {
  packageJSON.scripts.dev = `shopify hydrogen dev`

  return packageJSON
}

async function updateCLIDependencies(
  packageJSON: npm.PackageJSON,
  local: boolean,
  packageDependencies: PackageDependencies,
): Promise<npm.PackageJSON> {
  const {devDependencies, dependencies} = packageDependencies

  packageJSON.devDependencies = packageJSON.devDependencies || {}
  packageJSON.dependencies = packageJSON.dependencies || {}

  Object.keys(devDependencies).forEach((key) => {
    packageJSON.devDependencies[key] = devDependencies[key] || packageJSON.devDependencies[key]!
  })

  Object.keys(dependencies).forEach((key) => {
    packageJSON.dependencies[key] = dependencies[key] || packageJSON.dependencies[key]!
  })

  if (local) {
    const devDependencyOverrides = {
      '@shopify/cli': `file:${(await path.findUp('packages/cli-main', {type: 'directory'})) as string}`,
      '@shopify/cli-hydrogen': `file:${(await path.findUp('packages/cli-hydrogen', {type: 'directory'})) as string}`,
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
  const npmrcPath = path.join(directory, '.npmrc')
  const npmrcContent = `${content}\n`
  if (!(await file.exists(npmrcPath))) {
    await file.touch(npmrcPath)
  }
  await file.appendFile(npmrcPath, npmrcContent)
}

async function cleanup(webOutputDirectory: string) {
  const gitPaths = await path.glob(
    [
      path.join(webOutputDirectory, '**', '.git'),
      path.join(webOutputDirectory, '**', '.github'),
      path.join(webOutputDirectory, '**', '.gitmodules'),
      path.join(webOutputDirectory, '.stackblitzrc'),
    ],
    {
      dot: true,
      onlyFiles: false,
      onlyDirectories: false,
      ignore: ['**/node_modules/**'],
    },
  )

  return Promise.all(gitPaths.map((path) => file.rmdir(path, {force: true}))).then(() => {})
}
