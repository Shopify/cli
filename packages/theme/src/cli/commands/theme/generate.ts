import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'

import {installComponent} from '../../services/generate.js'
import {hasRequiredThemeDirectories} from '../../utilities/theme-fs.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Generate extends ThemeCommand {
  static summary = 'Fetches and installs Shopify component used for building themes.'

  static descriptionWithMarkdown = ``

  static description = this.descriptionWithoutMarkdown()

  static usage = 'theme generate [flags]'

  static args = {}

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Generate)

    if (!(await hasRequiredThemeDirectories(flags.path))) {
      return
    }

    await installComponent(flags.path)
  }
}
