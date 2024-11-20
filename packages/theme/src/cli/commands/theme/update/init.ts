import ThemeCommand from '../../../utilities/theme-command.js'
import {init} from '../../../services/update/init.js'
import {themeFlags} from '../../../flags.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class UpdateInit extends ThemeCommand {
  static description = `Initialize an 'update_extension.json' script.`

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(UpdateInit)
    await init(flags.path)
  }
}