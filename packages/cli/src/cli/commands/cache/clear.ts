import Command from '@shopify/cli-kit/node/base-command'
import {clearCache} from '@shopify/cli-kit/node/cli'

export default class ClearCache extends Command {
  static description = 'Clear the CLI cache, used to store some API responses and handle notifications status'
  static hidden = true

  async run(): Promise<void> {
    clearCache()
  }
}
