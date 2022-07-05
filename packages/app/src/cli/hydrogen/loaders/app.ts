import {HydrogenApp} from '../models/app.js'
import {Configuration} from '../models/configuration.js'
import {getModuleLoader} from '../utilities/module-loader.js'
import {path, error, output, dependency} from '@shopify/cli-kit'

export async function loadHydrogenApp(fromDirectory: string): Promise<HydrogenApp> {
  const configurationFilePath = await path.findUp(['hydrogen.config.js', 'hydrogen.config.ts'], {
    cwd: fromDirectory,
    type: 'file',
  })
  if (!configurationFilePath) {
    throw new error.Abort(
      "Couldn't locate the Hydrogen app in this directory and parent directories",
      'Hydrogen apps have a hydrogen.config.{ts,js} configuration file at their root.',
    )
  }
  const appDirectory = path.dirname(configurationFilePath)
  const configuration = await loadConfiguration(configurationFilePath)
  const dependencyManager = await dependency.getDependencyManager(appDirectory)
  const app = {
    directory: appDirectory,
    configuration,
    dependencyManager,
    name: configuration.name,
  }
  return app
}

export async function loadConfiguration(configurationFilePath: string): Promise<Configuration> {
  output.debug(output.content`Loading configuration file at path ${output.token.path(configurationFilePath)}`)
  const moduleLoader = await getModuleLoader(path.dirname(configurationFilePath))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configuration: Configuration = ((await moduleLoader.load(configurationFilePath)) as any).default
  output.debug(output.content`Configuration loaded from ${output.token.path(configurationFilePath)}`)
  await moduleLoader.close()
  return configuration
}
