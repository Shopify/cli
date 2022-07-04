import {Command} from '@oclif/core'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

export default class LanguageServer extends Command {
  static description = 'Start a Language Server Protocol server.'

  async run(): Promise<void> {
    await execCLI2(['theme', 'language-server'])
  }
}
