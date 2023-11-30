import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import {loadAppConfiguration} from '../../../models/app/loader.js'
import {pushConfig} from '../../../services/app/config/push.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'

export default class ConfigPush extends Command {
  static description = 'Push your app configuration to the Partner Dashboard.'

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
    const specifications = await loadLocalExtensionsSpecifications(this.config)
    const {configuration, configSchema} = await loadAppConfiguration({
      configName: flags.config,
      directory: flags.path,
      specifications,
    })

    await pushConfig({configuration, force: flags.force, configSchema})
  }
}
