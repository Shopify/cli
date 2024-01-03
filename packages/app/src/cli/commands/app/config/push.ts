import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import {loadAppConfiguration} from '../../../models/app/loader.js'
import {pushConfig} from '../../../services/app/config/push.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class ConfigPush extends Command {
  static summary = 'Pushes your default app configuration to Shopify.'

  static description = `Pushes your default app configuration to Shopify. You can specify a different configuration file with the \`--config\` flag. This overwrites the settings for the app specified in the configuration file in your Partner Dashboard.`

  static flags = {
    ...globalFlags,
    ...appFlags,
    force: Flags.boolean({
      hidden: false,
      description: 'Push configuration without asking for confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
      char: 'f',
      default: false,
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigPush)
    const {configuration} = await loadAppConfiguration({
      configName: flags.config,
      directory: flags.path,
    })

    await pushConfig({configuration, force: flags.force})
  }
}
