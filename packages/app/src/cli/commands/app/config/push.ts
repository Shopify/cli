import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import {pushConfig} from '../../../services/app/config/push.js'
import {load as loadApp} from '../../../models/app/loader.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigPush extends Command {
  static hidden = true

  static description = "Push your app's config to the Partner Dashboard."

  static flags = {
    ...globalFlags,
    ...appFlags,
    config: Flags.string({
      hidden: false,
      description: 'Name for the config file.',
      env: 'SHOPIFY_FLAG_APP_CONFIG',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigPush)
    const app = await loadApp({specifications: [], configName: flags.config, directory: flags.path, mode: 'report'})

    await pushConfig({app})
  }
}
