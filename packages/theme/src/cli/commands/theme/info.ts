import ThemeCommand from '../../utilities/theme-command.js'
import {themeInfo} from '../../services/info.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {outputInfo} from '@shopify/cli-kit/node/output'

export default class ThemeInfo extends ThemeCommand {
  static description = 'Print basic information about your theme environment.'

  static flags = {
    ...globalFlags,
  }

  public async run(): Promise<void> {
    const infoMessage = await themeInfo({cliVersion: this.config.version})
    outputInfo(infoMessage)
  }
}
