import {getDeepInstallNPMTasks, updateCLIDependencies} from '../utils/template/npm.js'

import {string, path, file, output, ui, template, npm, git, github, environment, error} from '@shopify/cli-kit'
import {packageManager, PackageManager, packageManagerUsedForCreating} from '@shopify/cli-kit/node/node-package-manager'

interface InitOptions {
  name: string
  directory: string
  packageManager: string | undefined
  local: boolean
}

const DirectoryExistsError = (name: string) => {
  return new error.Abort(`\nA directory with this name (${name}) already exists.\nChoose a new name for your app.`)
}

async function init(options: InitOptions) {
  const packageManager: PackageManager = inferPackageManager(options.packageManager)
  const hyphenizedName = string.hyphenize(options.name)
  const outputDirectory = path.join(options.directory, hyphenizedName)

  await ensureAppDirectoryIsAvailable(outputDirectory, hyphenizedName)

  await file.inTemporaryDirectory(async (tmpDir) => {
    const templateScaffoldDir = path.join(tmpDir, 'app')

    let tasks: ui.ListrTasks = []

    tasks = tasks.concat([
      {
        title: `Initialize your app ${hyphenizedName}`,
        task: async (_, task) => {
          const templateDirectory = (await path.findUp('templates/app', {
            cwd: path.moduleDirectory(import.meta.url),
            type: 'directory',
          })) as string

          await template.recursiveDirectoryCopy(templateDirectory, templateScaffoldDir, {
            name: options.name,
            packageManager: options.packageManager ?? 'yarn',
          })

          const packageJSON = await npm.readPackageJSON(templateScaffoldDir)

          await npm.updateAppData(packageJSON, hyphenizedName)
          await updateCLIDependencies({packageJSON, local: options.local, directory: templateScaffoldDir})

          await npm.writePackageJSON(templateScaffoldDir, packageJSON)

          // Ensure that the installation of dependencies doesn't fail when using
          // pnpm due to missing peerDependencies.
          if (packageManager === 'pnpm') {
            await file.append(path.join(templateScaffoldDir, '.npmrc'), `auto-install-peers=true\n`)
          }
        },
      },
    ])

    if (await environment.local.isShopify()) {
      tasks.push({
        title: "[Shopifolks-only] Configure the project's NPM registry",
        task: async (_, task) => {
          task.title = "[Shopifolks-only] Configuring the project's NPM registry"
          const npmrcPath = path.join(templateScaffoldDir, '.npmrc')
          const npmrcContent = `@shopify:registry=https://registry.npmjs.org\n`
          await file.append(npmrcPath, npmrcContent)
          task.title = "[Shopifolks-only] Project's NPM registry configured."
        },
      })
    }

    tasks = tasks.concat([
      {
        title: `Install dependencies with ${packageManager}`,
        task: async (_, parentTask) => {
          parentTask.title = `Installing dependencies with ${packageManager}`
          function didInstallEverything() {
            parentTask.title = `Dependencies installed with ${packageManager}`
          }

          return parentTask.newListr(
            await getDeepInstallNPMTasks({
              from: templateScaffoldDir,
              packageManager,
              didInstallEverything,
            }),
            {concurrent: false},
          )
        },
      },
      {
        title: 'Initializing a Git repository...',
        task: async (_, task) => {
          await git.initializeRepository(templateScaffoldDir)
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
  ${hyphenizedName} is ready for you to build! Remember to ${output.token.genericShellCommand(`cd ${hyphenizedName}`)}
  Check the setup instructions in your README file
  To preview your project, run ${output.token.packagejsonScript(packageManager, 'dev')}
  To add extensions, run ${output.token.packagejsonScript(packageManager, 'generate extension')}
  For more details on all that you can build, see the docs: ${output.token.link(
    'shopify.dev',
    'https://shopify.dev',
  )} ✨

  For help and a list of commands, enter ${output.token.packagejsonScript(packageManager, 'shopify app', '--help')}
  `)
}

function inferPackageManager(optionsPackageManager: string | undefined): PackageManager {
  if (optionsPackageManager && packageManager.includes(optionsPackageManager as PackageManager)) {
    return optionsPackageManager as PackageManager
  }
  const usedPackageManager = packageManagerUsedForCreating()
  return usedPackageManager === 'unknown' ? 'npm' : usedPackageManager
}

async function ensureAppDirectoryIsAvailable(directory: string, name: string): Promise<void> {
  const exists = await file.exists(directory)
  if (exists) throw DirectoryExistsError(name)
}

export default init
