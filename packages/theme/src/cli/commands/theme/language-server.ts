import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class LanguageServer extends Command {
  static description = 'Start a Language Server Protocol server.'

  async run(): Promise<void> {
    await ruby.execCLI(['theme', 'language-server'])
  }
}
