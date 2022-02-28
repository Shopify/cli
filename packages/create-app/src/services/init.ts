import {Writable} from 'stream'

import {
  string,
  path,
  template,
  file,
  output,
  os,
  ui,
  dependency,
  constants,
} from '@shopify/cli-kit'

import {template as getTemplatePath} from '../utils/paths'

interface InitOptions {
  name: string
  directory: string
  dependencyManager: string | undefined
  shopifyCliVersion: string | undefined
  shopifyAppVersion: string | undefined
  shopifyCliKitVersion: string | undefined
}

async function init(options: InitOptions) {
  const user = (await os.username()) ?? ''
  const templatePath = await getTemplatePath('app')
  const cliPackageVersion = options.shopifyCliVersion ?? constants.versions.cli
  const appPackageVersion =
    options.shopifyAppVersion ?? constants.versions.cliKit
  const cliKitOverridenVersion = options.shopifyCliKitVersion

  const dependencyManager = inferDependencyManager(options.dependencyManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)
  await ui.list(
    [
      {
        title: `Initializing your app ${hyphenizedName}`,
        task: async (_, task) => {
          await createApp({
            ...options,
            outputDirectory,
            templatePath,
            cliPackageVersion,
            appPackageVersion,
            cliKitOverridenVersion,
            user,
            dependencyManager,
          })
          task.title = 'Initialized'
        },
      },
      {
        title: `Installing dependencies with ${dependencyManager}`,
        task: async (_, task) => {
          const stdout = new Writable({
            write(chunk, encoding, next) {
              task.output = chunk.toString()
              next()
            },
          })
          await installDependencies(outputDirectory, dependencyManager, stdout)
        },
      },
    ],
    {concurrent: false},
  )

  output.message(output.content`
  ${hyphenizedName} is ready to build! ✨
    Docs: ${output.token.link(
      'Quick start guide',
      'https://shopify.dev/apps/getting-started',
    )}
    Inspiration ${output.token.command(`${dependencyManager} shopify help`)}
  `)
}

function inferDependencyManager(
  optionsDependencyManager: string | undefined,
): dependency.DependencyManager {
  if (
    optionsDependencyManager &&
    dependency.dependencyManager.includes(optionsDependencyManager)
  ) {
    return optionsDependencyManager as dependency.DependencyManager
  }
  return dependency.dependencyManagerUsedForCreating()
}

async function installDependencies(
  directory: string,
  dependencyManager: dependency.DependencyManager,
  stdout: Writable,
): Promise<void> {
  await dependency.install(directory, dependencyManager, stdout)
}

async function createApp(
  options: InitOptions & {
    outputDirectory: string
    templatePath: string
    cliPackageVersion: string
    appPackageVersion: string
    cliKitOverridenVersion: string | undefined
    user: string
    dependencyManager: string
  },
): Promise<void> {
  const templateData = {
    name: options.name,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    shopify_cli_version: options.cliPackageVersion,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    shopify_app_version: options.appPackageVersion,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    cli_kit_version_overriden_version: options.cliKitOverridenVersion,
    author: options.user,
    dependencyManager: options.dependencyManager,
  }
  await template.recursiveDirectoryCopy(
    options.templatePath,
    options.outputDirectory,
    templateData,
  )
}

export default init
