import {constants, path, dependency, ui, npm} from '@shopify/cli-kit'
import {Writable} from 'stream'

export async function updateCLIDependencies(packageJSON: npm.PackageJSON, local: boolean): Promise<npm.PackageJSON> {
  packageJSON.dependencies = packageJSON.dependencies || {}
  packageJSON.dependencies['@shopify/cli'] = constants.versions.cli
  packageJSON.dependencies['@shopify/app'] = constants.versions.app

  if (local) {
    const dependencyOverrides = {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@shopify/cli': `file:${(await path.findUp('packages/cli', {type: 'directory'})) as string}`,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@shopify/app': `file:${(await path.findUp('packages/app', {type: 'directory'})) as string}`,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      '@shopify/cli-kit': `file:${(await path.findUp('packages/cli-kit', {type: 'directory'})) as string}`,
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
