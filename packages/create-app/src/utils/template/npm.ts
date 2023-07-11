import {PackageManager, installNodeModules, PackageJson} from '@shopify/cli-kit/node/node-package-manager'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {moduleDirectory, normalizePath} from '@shopify/cli-kit/node/path'
import {findPathUp} from '@shopify/cli-kit/node/fs'
import {platform} from 'os'

interface UpdateCLIDependenciesOptions {
  directory: string
  packageJSON: PackageJson
  local: boolean
}

export async function updateCLIDependencies({packageJSON, local}: UpdateCLIDependenciesOptions): Promise<PackageJson> {
  packageJSON.dependencies = packageJSON.dependencies || {}
  packageJSON.dependencies['@shopify/cli'] = CLI_KIT_VERSION
  packageJSON.dependencies['@shopify/app'] = CLI_KIT_VERSION

  if (local) {
    const cliPath = await packagePath('cli')
    const appPath = await packagePath('app')
    const cliKitPath = await packagePath('cli-kit')
    const pluginCloudflarePath = await packagePath('plugin-cloudflare')
    const didYouMeanPath = await packagePath('plugin-did-you-mean')

    // eslint-disable-next-line require-atomic-updates
    packageJSON.dependencies['@shopify/cli'] = cliPath
    // eslint-disable-next-line require-atomic-updates
    packageJSON.dependencies['@shopify/app'] = appPath

    const dependencyOverrides = {
      '@shopify/cli': cliPath,
      '@shopify/app': appPath,
      '@shopify/cli-kit': cliKitPath,
      '@shopify/plugin-did-you-mean': didYouMeanPath,
      '@shopify/plugin-cloudflare': pluginCloudflarePath,
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

async function packagePath(packageName: string): Promise<string> {
  const packageAbsolutePath = (await findPathUp(`packages/${packageName}`, {
    type: 'directory',
    cwd: moduleDirectory(import.meta.url),
  })) as string
  return `file:${packageAbsolutePath}`
}

export async function getDeepInstallNPMTasks({
  from,
  packageManager,
}: {
  from: string
  packageManager: PackageManager
}): Promise<void> {
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
  return installNodeModules({directory: normalizePath(from), packageManager, args})
}
