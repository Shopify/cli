import ThemeCommand from '../../utilities/theme-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {startServer} from '@shopify/theme-language-server-node'

export default class LanguageServer extends ThemeCommand {
  static summary = 'Start a Language Server Protocol server.'

  static descriptionWithMarkdown = `Starts the [Language Server](https://shopify.dev/docs/themes/tools/cli/language-server).`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
  }

  async run(): Promise<void> {
    await this.parse(LanguageServer)
    startServer()
  }
}
