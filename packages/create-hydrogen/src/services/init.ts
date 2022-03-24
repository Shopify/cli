// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore

import {template as getTemplatePath} from '../utils/paths'
import {constants, string, path, template, file, output, os, ui, dependency} from '@shopify/cli-kit'
import {Writable} from 'stream'

interface InitOptions {
  name: string
  template: string
  directory: string
  dependencyManager: string | undefined
  shopifyCliVersion: string | undefined
  hydrogenVersion: string
}

const RENAME_MAP = {
  _gitignore: '.gitignore',
}

async function init(options: InitOptions) {
  const user = (await os.username()) ?? ''
  const templatePath = await getTemplatePath(options.template)
  const cliPackageVersion = options.shopifyCliVersion ?? constants.versions.cli
  const hydrogenPackageVersion = options.hydrogenVersion
  const dependencyManager = inferDependencyManager(options.dependencyManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)
  await ui.list(
    [
      {
        title: `Initializing your hydrogen storefront ${hyphenizedName}`,
        task: async (_, task) => {
          await createHydrogen({
            ...options,
            outputDirectory,
            templatePath,
            cliPackageVersion,
            hydrogenPackageVersion,
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

  output.info(output.content`
  ${hyphenizedName} is ready to build! ✨
    Run ${output.token.command(`${dependencyManager} dev`)} to start developing.
    Docs: ${output.token.link('Quick start guide', 'https://shopify.dev/custom-storefronts/hydrogen')}
  `)
}

function inferDependencyManager(optionsDependencyManager: string | undefined): dependency.DependencyManager {
  if (optionsDependencyManager && dependency.dependencyManager.includes(optionsDependencyManager)) {
    return optionsDependencyManager as dependency.DependencyManager
  }
  return dependency.dependencyManagerUsedForCreating()
}

function initializeGit() {
  return file.write('.gitignore', 'node_modules/')
}

async function installDependencies(
  directory: string,
  dependencyManager: dependency.DependencyManager,
  stdout: Writable,
): Promise<void> {
  await dependency.install(directory, dependencyManager, stdout)
}

async function createHydrogen(
  options: InitOptions & {
    outputDirectory: string
    templatePath: string
    cliPackageVersion: string
    hydrogenPackageVersion: string
    user: string
    dependencyManager: string
  },
): Promise<void> {
  const templateData = {
    name: options.name,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    shopify_cli_version: options.cliPackageVersion,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    hydrogen_version: options.hydrogenPackageVersion,
    author: options.user,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    dependency_manager: options.dependencyManager,
  }
  await template.recursiveDirectoryCopy(options.templatePath, options.outputDirectory, templateData)
}

export default init
