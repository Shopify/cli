import {Command} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Delete extends Command {
  static description = 'Delete a remote theme'

  async run(): Promise<void> {
    await ruby.exec(['theme', 'delete'], '')
  }
}
