import {appFlags} from '../../../flags.js'
import use from '../../../services/app/config/use.js'
import Command from '../../../utilities/app-command.js'
import {Args} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigUse extends Command {
  static hidden = true

  static description = 'Set a particular configuration to use.'

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  static args = {
    config: Args.string(),
  }

  public async run(): Promise<void> {
    const {flags, args} = await this.parse(ConfigUse)
    await use(flags.path, args.config)
  }
}
