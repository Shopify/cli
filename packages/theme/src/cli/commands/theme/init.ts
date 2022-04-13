import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Init extends Command {
  static description = 'Create a new theme'

  async run(): Promise<void> {
    await ruby.exec(['theme', 'init'], '')
  }
}
