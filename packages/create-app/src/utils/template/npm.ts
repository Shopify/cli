import {dependency, path, ui} from '@shopify/cli-kit'
import {Writable} from 'stream'

interface DeepInstallNPMTasksOptions {
  from: string
  dependencyManager: dependency.DependencyManager
  didInstallEverything(): void
}

export default async function getDeepInstallNPMTasks({
  from,
  dependencyManager,
  didInstallEverything,
}: DeepInstallNPMTasksOptions): Promise<ui.ListrTask[]> {
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
