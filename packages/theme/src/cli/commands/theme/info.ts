import ThemeCommand from '../../utilities/theme-command.js'
import {themeInfo} from '../../services/info.js'
import {output} from '@shopify/cli-kit'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class ThemeInfo extends ThemeCommand {
  static description = 'Print basic information about your theme environment'

  static flags = {
    ...globalFlags,
  }

  public async run(): Promise<void> {
    const infoMessage = await themeInfo({cliVersion: this.config.version})
    output.info(infoMessage)
  }
}
