import {version as cliVersion} from '../../../../cli-main/package.json'
import {version as appVersion} from '../../../../app/package.json'
import {path, dependency, ui, npm} from '@shopify/cli-kit'
import {Writable} from 'stream'

export async function updateCLIDependencies(packageJSON: npm.PackageJSON, local: boolean): Promise<npm.PackageJSON> {
  packageJSON.dependencies = packageJSON.dependencies || {}
  packageJSON.dependencies['@shopify/cli'] = cliVersion
  packageJSON.dependencies['@shopify/app'] = appVersion

  if (local) {
    const cliPath = `file:${(await path.findUp('packages/cli-main', {type: 'directory'})) as string}`
    const appPath = `file:${(await path.findUp('packages/app', {type: 'directory'})) as string}`
    const cliKitPath = `file:${(await path.findUp('packages/cli-kit', {type: 'directory'})) as string}`

    // eslint-disable-next-line require-atomic-updates
    packageJSON.dependencies['@shopify/cli'] = cliPath
    // eslint-disable-next-line require-atomic-updates
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

  return packageJSON
}

export async function getDeepInstallNPMTasks({
  from,
  dependencyManager,
  didInstallEverything,
}: {
  from: string
  dependencyManager: dependency.DependencyManager
  didInstallEverything(): void
}): Promise<ui.ListrTask[]> {
  const packageJSONFiles = await path.glob([path.join(from, '**/package.json')])
  let foldersInstalled = 0

  return packageJSONFiles.map((filePath) => {
    const folderPath = filePath.replace('package.json', '')
    const titlePath = folderPath.replace(from, '')

    return {
      title: `Installing dependencies in ${titlePath}`,
      task: async (_, task) => {
        const output = new Writable({
          write(chunk, _, next) {
            task.output = chunk.toString()
            next()
          },
        })

        await dependency.install(folderPath, dependencyManager, output, output)

        task.title = `Installed dependencies in ${titlePath}`

        foldersInstalled++

        if (foldersInstalled === packageJSONFiles.length) {
          didInstallEverything()
        }
      },
    }
  })
}
