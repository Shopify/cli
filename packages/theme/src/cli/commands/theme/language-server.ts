import ThemeCommand from '../../utilities/theme-command.js'
import {themeDevPreviewFlag} from '../../flags.js'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {startServer} from '@shopify/theme-language-server-node'

export default class LanguageServer extends ThemeCommand {
  static description = 'Start a Language Server Protocol server.'

  static flags = {
    ...globalFlags,
    ...themeDevPreviewFlag,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(LanguageServer)

    if (flags['dev-preview']) {
      startServer()
      return
    }

    await execCLI2(['theme', 'language-server'])
  }
}
