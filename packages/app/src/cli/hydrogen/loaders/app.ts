import {HydrogenApp} from '../models/app.js'
import {Configuration} from '../models/configuration.js'
import {getModuleLoader} from '../utilities/module-loader.js'
import {UserConfigurationEnvironment} from '../../../hydrogen/configuration.js'
import {path, error, output} from '@shopify/cli-kit'
import {getPackageManager} from '@shopify/cli-kit/node/node-package-manager'

export async function loadHydrogenApp(
  fromDirectory: string,
  environment: UserConfigurationEnvironment,
): Promise<HydrogenApp> {
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
  const configuration = await loadConfiguration(configurationFilePath, environment)
  const dependencyManager = await getPackageManager(appDirectory)
  const app = {
    directory: appDirectory,
    configuration,
    dependencyManager,
    name: configuration.name,
    environment,
  }
  return app
}

export async function loadConfiguration(
  configurationFilePath: string,
  environment: UserConfigurationEnvironment,
): Promise<Configuration> {
  output.debug(output.content`Loading configuration file at path ${output.token.path(configurationFilePath)}`)
  const moduleLoader = await getModuleLoader(path.dirname(configurationFilePath))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configuration: Configuration = (await ((await moduleLoader.load(configurationFilePath)) as any).default)({
    environment,
  })
  output.debug(output.content`Configuration loaded from ${output.token.path(configurationFilePath)}`)
  await moduleLoader.close()
  return configuration
}
