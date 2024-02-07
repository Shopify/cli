import {appFlags} from '../../../flags.js'
import link, {LinkOptions} from '../../../services/app/config/link.js'
import Command from '../../../utilities/app-command.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigLink extends Command {
  static description = 'Fetch your app configuration from the Partner Dashboard.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigLink)

    const options: LinkOptions = {
      directory: flags.path,
      apiKey: flags['client-id'],
    }
    await link(options)
  }
}
