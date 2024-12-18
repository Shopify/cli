import {list} from '../../services/commands/notifications.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class List extends Command {
  static description = 'List current notifications configured for the CLI.'
  static hidden = true

  async run(): Promise<void> {
    await list()
  }
}
