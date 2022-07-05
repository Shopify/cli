import {string, path, file, output, ui, constants, dependency, git, environment, error} from '@shopify/cli-kit'
import {Writable} from 'node:stream'

interface InitOptions {
  name: string
  directory: string
  dependencyManager: string | undefined
  local: boolean
}

const DirectoryExistsError = (name: string) => {
  return new error.Abort(`\nA directory with this name (${name}) already exists.\nChoose a new name for your app.`)
}

async function init(options: InitOptions) {
  const dependencyManager: dependency.DependencyManager = inferDependencyManager(options.dependencyManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)

  await ensureAppDirectoryIsAvailable(outputDirectory, hyphenizedName)

  await file.inTemporaryDirectory(async (tmpDir) => {
    let tasks: ui.ListrTasks = []

    tasks = tasks.concat([
      {
        title: `Initializing your app ${hyphenizedName}`,
        task: async (_, parentTask) => {
          await createApp(tmpDir, options)
        },
      },
    ])

    if (await environment.local.isShopify()) {
      tasks.push({
        title: "[Shopifolks-only] Configure the project's NPM registry",
        task: async (_, task) => {
          task.title = "[Shopifolks-only] Configuring the project's NPM registry"
          const npmrcPath = path.join(tmpDir, '.npmrc')
          const npmrcContent = `@shopify:registry=https://registry.npmjs.org\n`
          await file.append(npmrcPath, npmrcContent)
          task.title = "[Shopifolks-only] Project's NPM registry configured."
        },
      })
    }

    tasks = tasks.concat([
      {
        title: `Install dependencies with ${dependencyManager}`,
        task: async (_, task) => {
          await dependency.install(
            tmpDir,
            dependencyManager,
            new Writable({
              write(chunk, _, next) {
                task.output = chunk.toString()
                next()
              },
            }),
            new Writable({
              write(chunk, _, next) {
                task.output = chunk.toString()
                next()
              },
            }),
          )

          task.title = `Installed dependencies`
        },
      },
      {
        title: 'Initializing a Git repository...',
        task: async (_, task) => {
          await git.initializeRepository(tmpDir)
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

    await file.move(tmpDir, outputDirectory)
  })

  output.info(output.content`
  ${hyphenizedName} is ready for you to build! Remember to ${output.token.genericShellCommand(`cd ${hyphenizedName}`)}
  To preview your project, run ${output.token.packagejsonScript(dependencyManager, 'dev')}
  To add extensions, run ${output.token.packagejsonScript(dependencyManager, 'scaffold extension')}
  For more details on all that you can build, see the docs: ${output.token.link(
    'shopify.dev',
    'https://shopify.dev',
  )} ✨

  For help and a list of commands, enter ${output.token.packagejsonScript(dependencyManager, 'shopify app', '--help')}
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

async function ensureAppDirectoryIsAvailable(directory: string, name: string): Promise<void> {
  const exists = await file.exists(directory)
  if (exists) throw DirectoryExistsError(name)
}

export async function createApp(directory: string, options: InitOptions) {
  await createPackageJson(directory, options)
}

export async function createPackageJson(directory: string, options: InitOptions) {
  const packageJsonPath = path.join(directory, 'package.json')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packageJSON: any = {
    name: options.name,
    license: 'UNLICENSED',
    private: true,
    scripts: {
      shopify: 'shopify',
      build: 'shopify app build',
      dev: 'shopify app dev',
      push: 'shopify app push',
      scaffold: 'shopify app scaffold',
      deploy: 'shopify app deploy',
    },
    dependencies: {
      react: '^18.1.0',
    },
  }
  const cliKitVersion = await constants.versions.cliKit()

  packageJSON.dependencies['@shopify/cli'] = cliKitVersion
  packageJSON.dependencies['@shopify/app'] = cliKitVersion

  if (options.local) {
    const cliPath = `file:${(await path.findUp('packages/cli-main', {type: 'directory'})) as string}`
    const appPath = `file:${(await path.findUp('packages/app', {type: 'directory'})) as string}`
    const cliKitPath = `file:${(await path.findUp('packages/cli-kit', {type: 'directory'})) as string}`

    packageJSON.dependencies['@shopify/cli'] = cliPath

    packageJSON.dependencies['@shopify/app'] = appPath

    const dependencyOverrides = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@shopify/cli': cliPath,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@shopify/app': appPath,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@shopify/cli-kit': cliKitPath,
    }
    packageJSON.overrides = packageJSON.overrides
      ? {...packageJSON.overrides, ...dependencyOverrides}
      : dependencyOverrides

    packageJSON.resolutions = packageJSON.resolutions
      ? {...packageJSON.resolutions, ...dependencyOverrides}
      : dependencyOverrides
  }

  await file.write(packageJsonPath, JSON.stringify(packageJSON, null, 2))
}

export default init
