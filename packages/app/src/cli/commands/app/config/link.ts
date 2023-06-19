import {appFlags} from '../../../flags.js'
import link, {LinkOptions} from '../../../services/app/config/link.js'
import Command from '../../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigLink extends Command {
  static hidden = true

  static description = "Fetch your app's config from the Partner Dashboard."

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: false,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
    }),
    config: Flags.string({
      hidden: false,
      description: 'Name for the config file.',
      env: 'SHOPIFY_FLAG_APP_CONFIG',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigLink)

    const options: LinkOptions = {
      commandConfig: this.config,
      directory: flags.path,
      apiKey: flags['api-key'],
      configName: flags.config,
    }
    await link(options)
  }
}
