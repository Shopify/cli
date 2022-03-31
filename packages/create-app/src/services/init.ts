import {template as getTemplatePath} from '../utils/paths'
import askPrompts from '../utils/home-template/prompts'
import downloadTemplate from '../utils/home-template/download'
import cleanupHome from '../utils/home-template/cleanup'
import {blocks} from '../constants'
import {string, path, template, file, output, os, ui, dependency, constants, system} from '@shopify/cli-kit'
import {Writable} from 'stream'

interface InitOptions {
  name: string
  directory: string
  template: string
  dependencyManager: string | undefined
  shopifyCliVersion: string | undefined
  shopifyAppVersion: string | undefined
  shopifyCliKitVersion: string | undefined
}

async function init(options: InitOptions) {
  const user = (await os.username()) ?? ''
  const templatePath = await getTemplatePath('app')
  const cliPackageVersion = options.shopifyCliVersion ?? constants.versions.cli
  const appPackageVersion = options.shopifyAppVersion ?? constants.versions.app

  const dependencyOverrides: {[key: string]: string} = {}
  if (options.shopifyCliVersion) {
    dependencyOverrides['@shopify/cli'] = options.shopifyCliVersion
  }
  if (options.shopifyAppVersion) {
    dependencyOverrides['@shopify/app'] = options.shopifyAppVersion
  }
  if (options.shopifyCliKitVersion) {
    dependencyOverrides['@shopify/cli-kit'] = options.shopifyCliKitVersion
  }

  const dependencyManager = inferDependencyManager(options.dependencyManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)
  const homeOutputDirectory = path.join(options.directory, hyphenizedName, 'home')

  await file.inTemporaryDirectory(async (tmpDir) => {
    const tmpDirApp = path.join(tmpDir, 'app')
    const tmpDirHome = path.join(tmpDirApp, blocks.home.directoryName)
    const tmpDirDownload = path.join(tmpDir, 'download')

    await downloadTemplate({
      templateUrl: options.template,
      into: tmpDirDownload,
    })

    const promptAnswers = await askPrompts(tmpDirDownload)

    await file.mkdir(tmpDirHome)
    await file.mkdir(tmpDirDownload)

    const list = new ui.Listr(
      [
        {
          title: `Initializing your app ${hyphenizedName}`,
          task: async (_, task) => {
            await scaffoldTemplate({
              ...options,
              directory: tmpDirApp,
              templatePath,
              cliPackageVersion,
              appPackageVersion,
              user,
              dependencyManager,
              dependencyOverrides,
            })
            task.title = 'App initialized'
          },
        },
        {
          title: `Creating home`,
          task: async (_, task) => {
            const hooksPreFilePaths = await path.glob(path.join(homeOutputDirectory, '**/_template/hooks/pre/*'))
            const hooksPostFilePaths = (
              await path.glob(path.join(homeOutputDirectory, '**/_template/hooks/post/*'))
            ).map((hookPath) => hookPath.replace(/\.liquid$/, ''))

            return task.newListr([
              ...hooksPreFilePaths.map((hookPath) => {
                return {
                  title: path.basename(hookPath),
                  task: async () => {
                    const stdout = new Writable({
                      write(chunk, encoding, next) {
                        task.output = chunk.toString()
                        next()
                      },
                    })
                    // @PEDRO: Adding `{stdout}` at the end raises an error
                    await system.exec(hookPath, [])
                  },
                }
              }),
              {
                title: 'Scaffolding home',
                task: async () => {
                  await scaffoldTemplate({
                    ...options,
                    prompts: promptAnswers as any,
                    directory: tmpDirHome,
                    templatePath: tmpDirDownload,
                    cliPackageVersion,
                    appPackageVersion,
                    user,
                    dependencyManager,
                    dependencyOverrides,
                  })
                },
              },
              ...hooksPostFilePaths.map((tmpHookPath) => {
                const relativeFilePath = path.relative(tmpDirDownload, tmpHookPath)
                const hookPath = path.join(tmpDirHome, relativeFilePath)
                return {
                  title: path.basename(hookPath),
                  task: async () => {
                    const stdout = new Writable({
                      write(chunk, encoding, next) {
                        task.output = chunk.toString()
                        next()
                      },
                    })
                    // @GIULIANO: How shoul we handle stderr? You mentioned error logs.
                    await system.exec(hookPath, [])
                  },
                }
              }),
              {
                title: 'Cleaning up home',
                task: async () => {
                  await cleanupHome(tmpDirHome)
                },
              },
            ])
          },
        },
        {
          title: `Installing app dependencies with ${dependencyManager}`,
          task: async (_, task) => {
            const stdout = new Writable({
              write(chunk, encoding, next) {
                task.output = chunk.toString()
                next()
              },
            })
            await dependency.install(tmpDirApp, dependencyManager, stdout)
          },
        },
      ],
      {concurrent: false},
    )
    await list.run()

    await file.move(tmpDirApp, outputDirectory)
  })

  output.info(output.content`
  ${hyphenizedName} is ready to build! ✨
    Docs: ${output.token.link('Quick start guide', 'https://shopify.dev/apps/getting-started')}
    Inspiration ${output.token.command(`${dependencyManager} shopify help`)}
  `)
}

function inferDependencyManager(optionsDependencyManager: string | undefined): dependency.DependencyManager {
  if (optionsDependencyManager && dependency.dependencyManager.includes(optionsDependencyManager)) {
    return optionsDependencyManager as dependency.DependencyManager
  }
  return dependency.dependencyManagerUsedForCreating()
}

async function scaffoldTemplate(
  options: InitOptions & {
    directory: string
    prompts?: {[key: string]: string | number | boolean}
    templatePath: string
    cliPackageVersion: string
    appPackageVersion: string
    dependencyOverrides: {[key: string]: string}
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
    dependency_overrides: options.dependencyOverrides,
    author: options.user,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    dependency_manager: options.dependencyManager,
    ...options.prompts,
  }
  await template.recursiveDirectoryCopy(options.templatePath, options.directory, templateData)
}

export default init
