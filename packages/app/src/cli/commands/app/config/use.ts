import {appFlags} from '../../../flags.js'
import use from '../../../services/app/config/use.js'
import Command from '../../../utilities/app-command.js'
import {Args, Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigUse extends Command {
  static hidden = true

  static description = 'Set a particular configuration to use.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset current configuration.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
    }),
  }

  static args = {
    // we want to this argument to be optional so that the user
    // can also select one from the list of available app tomls.
    config: Args.string({
      description: 'Name of the config file.',
    }),
  }

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(ConfigUse)
    await use({directory: flags.path, config: args.config, reset: flags.reset})
  }
}
