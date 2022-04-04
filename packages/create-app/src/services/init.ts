import {template as getTemplatePath} from '../utils/paths'
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
  local: boolean
}

async function init(options: InitOptions) {
  const user = (await os.username()) ?? ''
  const templatePath = await getTemplatePath('app')

  let cliPackageVersion = constants.versions.cli
  let appPackageVersion = constants.versions.app
  const dependencyOverrides: {[key: string]: string} = {}

  if (options.local) {
    cliPackageVersion = `file:${(await path.findUp('packages/cli', {type: 'directory'})) as string}`
    appPackageVersion = `file:${(await path.findUp('packages/app', {type: 'directory'})) as string}`

    dependencyOverrides['@shopify/cli'] = cliPackageVersion
    dependencyOverrides['@shopify/app'] = appPackageVersion
    dependencyOverrides['@shopify/cli-kit'] = `file:${
      (await path.findUp('packages/cli-kit', {type: 'directory'})) as string
    }`
  }

  const dependencyManager = inferDependencyManager(options.dependencyManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)

  await file.inTemporaryDirectory(async (tmpDir) => {
    const tmpDirApp = path.join(tmpDir, 'app')
    const tmpDirHome = path.join(tmpDirApp, blocks.home.directoryName)
    const tmpDirDownload = path.join(tmpDir, 'download')

    await downloadTemplate({
      templateUrl: options.template,
      into: tmpDirDownload,
    })

    await file.mkdir(tmpDirHome)
    await file.mkdir(tmpDirDownload)

    const list = new ui.Listr(
      [
        {
          title: 'Downloading template',
          task: async (_, task) => {
            await downloadTemplate({
              templateUrl: options.template,
              into: tmpDirDownload,
            })
          },
        },
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
            const hooksPreFilePaths = await path.glob(path.join(tmpDirDownload, 'hooks/pre/*'))
            const hooksPostFilePaths = await path.glob(path.join(tmpDirDownload, 'hooks/post/*'))

            return task.newListr([
              {
                title: 'Scaffolding home',
                task: async () => {
                  await scaffoldTemplate({
                    ...options,
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
              ...hooksPreFilePaths.map((sourcePath) => {
                const hookPath = path.join(tmpDirHome, path.relative(tmpDirDownload, sourcePath)).replace('.liquid', '')
                return {
                  title: path.basename(hookPath),
                  task: async (_: any, task: any) => {
                    const stdout = new Writable({
                      write(chunk, encoding, next) {
                        task.output = chunk.toString()
                        next()
                      },
                    })
                    const stderr = new Writable({
                      write(chunk, encoding, next) {
                        task.output = chunk.toString()
                        next()
                      },
                    })
                    await system.exec(hookPath, [], {cwd: tmpDirHome, stdout, stderr})
                  },
                }
              }),
              ...hooksPostFilePaths.map((sourcePath) => {
                const hookPath = path.join(tmpDirHome, path.relative(tmpDirDownload, sourcePath)).replace('.liquid', '')
                return {
                  title: path.basename(hookPath),
                  task: async (_: any, task: any) => {
                    const stdout = new Writable({
                      write(chunk, encoding, next) {
                        task.output = chunk.toString()
                        next()
                      },
                    })
                    const stderr = new Writable({
                      write(chunk, encoding, next) {
                        task.output = chunk.toString()
                        next()
                      },
                    })
                    await system.exec(hookPath, [], {cwd: tmpDirHome, stdout, stderr})
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
            const output = new Writable({
              write(chunk, encoding, next) {
                task.output = chunk.toString()
                next()
              },
            })
            await dependency.install(tmpDirApp, dependencyManager, output, output)
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
  }
  await template.recursiveDirectoryCopy(options.templatePath, options.directory, templateData)
}

export default init
