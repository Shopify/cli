import {Command} from '@oclif/core'
import {output} from '@shopify/cli-kit'

export default class Version extends Command {
  static description = 'View full debug logs from the Shopify CLI'

  async run(): Promise<void> {
    await output.pageLogs()
  }
}
