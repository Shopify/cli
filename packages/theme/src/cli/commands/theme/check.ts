import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Check extends Command {
  static description = 'Validate the theme'

  async run(): Promise<void> {
    await ruby.exec(['theme', 'check'], '')
  }
}
