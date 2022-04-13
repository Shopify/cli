import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Package extends Command {
  static description = 'Set a remote theme as the live theme.'

  async run(): Promise<void> {
    await ruby.exec(['theme', 'publish'], '')
  }
}
