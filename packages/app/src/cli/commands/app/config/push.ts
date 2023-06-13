import {appFlags} from '../../../flags.js'
import Command from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigPush extends Command {
  static hidden = true

  static description = "Push your app's config to the Partner Dashboard."

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigPush)
  }
}
