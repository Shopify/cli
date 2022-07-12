import Command from '@shopify/cli-kit/node/base-command'
import {output} from '@shopify/cli-kit'

export default class Logs extends Command {
  static description = 'View full debug logs from the Shopify CLI'

  async run(): Promise<void> {
    await output.pageLogs()
  }
}
