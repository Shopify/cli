import ThemeCommand from '../../utilities/theme-command.js'
import {themeInfo} from '../../services/info.js'
import {cli, output} from '@shopify/cli-kit'

export default class ThemeInfo extends ThemeCommand {
  static description = 'Print basic information about your theme environment'

  static flags = {
    ...cli.globalFlags,
  }

  public async run(): Promise<void> {
    const infoMessage = await themeInfo({cliVersion: this.config.version})
    output.info(infoMessage)
  }
}
