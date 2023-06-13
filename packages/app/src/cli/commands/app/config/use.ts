import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigUse extends Command {
  static hidden = true

  static description = 'Set a particular configuration to use.'

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigUse)
  }
}
