import ThemeCommand from '../../../utilities/theme-command.js'
import {themeFlags} from '../../../flags.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class UpdateInit extends ThemeCommand {
  static description = `Run an 'update_extension.json' script in a theme.`

  static hidden = true

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
  }

  async run(): Promise<void> {
    // empty.
  }
}
