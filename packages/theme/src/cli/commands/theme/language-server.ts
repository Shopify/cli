import ThemeCommand from '../../utilities/theme-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {startServer} from '@shopify/theme-language-server-node'

export default class LanguageServer extends ThemeCommand {
  static description = 'Start a Language Server Protocol server.'

  static flags = {
    ...globalFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(LanguageServer)
    startServer()
  }
}
