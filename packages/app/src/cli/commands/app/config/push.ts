import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import {pushConfig} from '../../../services/app/config/push.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {loadExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

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
    const specifications = await loadExtensionsSpecifications(this.config)
    const app = await loadApp({specifications, directory: flags.path, mode: 'report'})

    await pushConfig({app, apiKey: flags['api-key']!})
  }
}
