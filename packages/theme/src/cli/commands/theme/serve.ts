import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Push extends Command {
  static description =
    'Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to your terminal. While running, changes will push to the store in real time.'

  async run(): Promise<void> {
    await ruby.exec(['theme', 'serve'])
  }
}
