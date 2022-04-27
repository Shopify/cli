import {file, path, toml} from '@shopify/cli-kit'
import {App, AppConfigurationSchema, AppConfiguration} from '$cli/models/app/app'
import {configurationFileNames} from '$cli/constants'

export async function updateAppConfigurationFile(app: App, data: Partial<AppConfiguration>): Promise<void> {
  const confPath = path.join(app.directory, configurationFileNames.app)
  const config = {...app.configuration, ...data}
  const parsedConfig = AppConfigurationSchema.parse(config)
  const configurationContent = toml.encode(parsedConfig)

  const header = '# This file stores configurations for your Shopify app.\n\n'
  await file.write(confPath, header + configurationContent)
}
