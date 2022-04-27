import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class HelpOld extends Command {
  static description = 'Show help from Ruby CLI'
  static hidden = true

  async run(): Promise<void> {
    await ruby.execCLI(['theme', 'help'])
  }
}
