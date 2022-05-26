// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore

import {downloadTemplate} from '../utils/template'

import {constants, template, string, path, file, output, os, ui, npm, dependency, environment} from '@shopify/cli-kit'
import {Writable} from 'stream'

interface InitOptions {
  name: string
  template: string
  directory: string
  dependencyManager?: string
  shopifyCliVersion?: string
  cliHydrogenPackageVersion?: string
  hydrogenVersion?: string
  local: boolean
}

const RENAME_MAP = {
  _gitignore: '.gitignore',
}

const GIT_HOST = 'git@github.com'

async function init(options: InitOptions) {
  const user = (await os.username()) ?? ''
  const cliPackageVersion = options.shopifyCliVersion ?? constants.versions.cli
  const cliHydrogenPackageVersion = options.cliHydrogenPackageVersion ?? constants.versions.cliHydrogen
  const hydrogenPackageVersion = options.hydrogenVersion
  const dependencyManager = inferDependencyManager(options.dependencyManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)

  await ui.nonEmptyDirectoryPrompt(outputDirectory)

  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateDownloadDir = path.join(tmpDir, 'download')
    const templateScaffoldDir = path.join(tmpDir, 'app')

    await file.mkdir(templateDownloadDir)
    await file.mkdir(templateScaffoldDir)

    let tasks: ConstructorParameters<typeof ui.Listr>[0] = []

    tasks = tasks.concat([
      {
        title: 'Downloading template',
        task: async (_, task) => {
          await downloadTemplate({
            templateUrl: [GIT_HOST, options.template].join(':'),
            into: templateDownloadDir,
          })

          task.title = 'Template downloaded'
        },
      },
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
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    shopify_cli_version: cliPackageVersion,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    hydrogen_version: hydrogenPackageVersion,
                    author: user,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    dependency_manager: options.dependencyManager,
                  }
                  await template.recursiveDirectoryCopy(templateDownloadDir, templateScaffoldDir, templateData)

                  task.title = 'Template files parsed'
                },
              },
              {
                title: 'Updating package.json',
                task: async (_, task) => {
                  const packageJSON = await npm.readPackageJSON(templateScaffoldDir)

                  await npm.updateAppData(packageJSON, hyphenizedName)
                  await updateCLIDependencies(packageJSON, options.local, {
                    dependencies: {
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      '@shopify/hydrogen': hydrogenPackageVersion,
                    },
                    devDependencies: {
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      '@shopify/cli-hydrogen': cliHydrogenPackageVersion,
                      // eslint-disable-next-line @typescript-eslint/naming-convention
                      '@shopify/cli': cliPackageVersion,
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
        task: async (_, task) => {
          const stdout = new Writable({
            write(chunk, encoding, next) {
              task.output = chunk.toString()
              next()
            },
          })
          await installDependencies(templateScaffoldDir, dependencyManager, stdout)
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
  ${hyphenizedName} is ready to build! ✨
    Run ${output.token.command(dependencyManager, 'dev')} to start developing.
    Docs: ${output.token.link('Quick start guide', 'https://shopify.dev/custom-storefronts/hydrogen')}
  `)

  output.info(output.content`Your project will display inventory from the Hydrogen Demo Store.
    To connect this project to your Shopify store's inventory instead,
    update ${output.token.yellow(`${hyphenizedName}/hydrogen.config.js`)} with your
    store ID and Storefront API key.\n`)
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
    packageJSON.devDependencies[key] = devDependencies[key] || packageJSON.devDependencies[key]
  })

  Object.keys(dependencies).forEach((key) => {
    packageJSON.dependencies[key] = dependencies[key] || packageJSON.dependencies[key]
  })

  if (local) {
    const devDependencyOverrides = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@shopify/cli': `file:${(await path.findUp('packages/cli', {type: 'directory'})) as string}`,
      // eslint-disable-next-line @typescript-eslint/naming-convention
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

async function installDependencies(
  directory: string,
  dependencyManager: dependency.DependencyManager,
  stdout: Writable,
): Promise<void> {
  await dependency.install(directory, dependencyManager, stdout)
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
