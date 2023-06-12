import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {pushConfig} from '../../../services/app/config/push.js'
import {Flags} from '@oclif/core'

export default class ConfigPush extends Command {
  static hidden = true

  static description = "Push your app's config to the Partner Dashboard."

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
        hidden: false,
        description: 'The API key of your app.',
        env: 'SHOPIFY_FLAG_APP_API_KEY',
      }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigPush)

    await pushConfig({apiKey: flags['api-key']})
  }
}
