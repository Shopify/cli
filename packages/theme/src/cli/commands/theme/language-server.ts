import Command from '@shopify/cli-kit/node/base-command'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {cli} from '@shopify/cli-kit'

export default class LanguageServer extends Command {
  static description = 'Start a Language Server Protocol server.'

  static flags = {
    ...cli.globalFlags,
  }

  async run(): Promise<void> {
    await execCLI2(['theme', 'language-server'])
  }
}
