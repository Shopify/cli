import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Help extends Command {
  static description = 'Show help from Ruby CLI'
  static hidden = true

  async run(): Promise<void> {
    await ruby.exec(['theme', 'help'], '')
  }
}
