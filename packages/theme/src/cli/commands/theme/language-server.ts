import ThemeCommand from '../../utilities/theme-command.js'
import {execCLI} from '../../utilities/ruby.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class LanguageServer extends ThemeCommand {
  static description = 'Start a Language Server Protocol server.'

  static flags = {
    ...globalFlags,
  }

  async run(): Promise<void> {
    await execCLI(['theme', 'language-server'])
  }
}
