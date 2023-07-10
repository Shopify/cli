import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import {loadAppConfiguration} from '../../../models/app/loader.js'
import {pushConfig} from '../../../services/app/config/push.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigPush extends Command {
  static description = 'Push your app configuration to the Partner Dashboard.'

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigPush)
    const {configuration, configurationPath} = await loadAppConfiguration({
      configName: flags.config,
      directory: flags.path,
    })

    await pushConfig({configuration, configurationPath})
  }
}
