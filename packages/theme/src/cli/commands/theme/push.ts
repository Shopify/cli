import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Push extends Command {
  static description =
    'Uploads your local theme files to the connected store, overwriting the remote version if specified.'

  async run(): Promise<void> {
    await ruby.exec(['theme', 'push'], '')
  }
}
