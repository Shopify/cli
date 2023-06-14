import {appFlags} from '../../../flags.js'
import link, {LinkOptions} from '../../../services/app/config/link.js'
import Command from '../../../utilities/app-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ConfigLink extends Command {
  static hidden = true

  static description = "Fetch your app's config from the Partner Dashboard."

  static flags = {
    ...globalFlags,
    ...appFlags,
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(ConfigLink)

    const options: LinkOptions = {
      commandConfig: this.config,
      directory: flags.path,
    }
    await link(options)
  }
}
