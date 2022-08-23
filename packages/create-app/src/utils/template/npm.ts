import {path, ui, npm, constants} from '@shopify/cli-kit'
import {PackageManager, installNodeModules} from '@shopify/cli-kit/node/node-package-manager'
import {Writable} from 'stream'
import {platform} from 'node:os'

export async function updateCLIDependencies(packageJSON: npm.PackageJSON, local: boolean): Promise<npm.PackageJSON> {
  const cliKitVersion = await constants.versions.cliKit()

  packageJSON.dependencies = packageJSON.dependencies || {}
  packageJSON.dependencies['@shopify/cli'] = cliKitVersion
  packageJSON.dependencies['@shopify/app'] = cliKitVersion

  if (local) {
    const cliPath = `file:${(await path.findUp('packages/cli-main', {type: 'directory'})) as string}`
    const appPath = `file:${(await path.findUp('packages/app', {type: 'directory'})) as string}`
    const cliKitPath = `file:${(await path.findUp('packages/cli-kit', {type: 'directory'})) as string}`
    const extensionsCliPath = `file:${(await path.findUp('packages/ui-extensions-cli', {type: 'directory'})) as string}`

    // eslint-disable-next-line require-atomic-updates
    packageJSON.dependencies['@shopify/cli'] = cliPath
    // eslint-disable-next-line require-atomic-updates
    packageJSON.dependencies['@shopify/app'] = appPath

    const dependencyOverrides = {
      '@shopify/cli': cliPath,
      '@shopify/app': appPath,
      '@shopify/cli-kit': cliKitPath,
      '@shopify/shopify-cli-extensions': extensionsCliPath,
    }

    packageJSON.overrides = packageJSON.overrides
      ? {...packageJSON.overrides, ...dependencyOverrides}
      : dependencyOverrides

    packageJSON.resolutions = packageJSON.resolutions
      ? {...packageJSON.resolutions, ...dependencyOverrides}
      : dependencyOverrides
  }

  return packageJSON
}

export async function getDeepInstallNPMTasks({
  from,
  packageManager,
  didInstallEverything,
}: {
  from: string
  packageManager: PackageManager
  didInstallEverything(): void
}): Promise<ui.ListrTask[]> {
  const root = path.normalize(from)
  const packageJSONFiles = await path.glob([path.join(root, '**/package.json')])
  let foldersInstalled = 0

  return packageJSONFiles.map((filePath) => {
    const folderPath = filePath.replace('package.json', '')
    const titlePath = folderPath.replace(root, '')

    return {
      title: `Installing dependencies in ${titlePath}`,
      task: async (_, task) => {
        const output = new Writable({
          write(chunk, _, next) {
            task.output = chunk.toString()
            next()
          },
        })
        /**
         * Installation of dependencies using Yarn on Windows might lead
         * to "EPERM: operation not permitted, unlink" errors when Yarn tries
         * to access the cache. By limiting the network concurrency we mitigate the
         * error:
         *
         * Failing scenario: https://github.com/Shopify/cli/runs/7913938724
         * Reported issue: https://github.com/yarnpkg/yarn/issues/7212
         */
        const args = platform() === 'win32' && packageManager === 'yarn' ? ['--network-concurrency', '1'] : []
        await installNodeModules({directory: folderPath, packageManager, stdout: output, stderr: output, args})

        task.title = `Installed dependencies in ${titlePath}`

        foldersInstalled++

        if (foldersInstalled === packageJSONFiles.length) {
          didInstallEverything()
        }
      },
    }
  })
}
