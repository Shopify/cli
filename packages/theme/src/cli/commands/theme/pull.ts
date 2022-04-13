import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Pull extends Command {
  static description = 'Download your remote theme files locally.'

  async run(): Promise<void> {
    await ruby.exec(['theme', 'pull'], '')
  }
}
