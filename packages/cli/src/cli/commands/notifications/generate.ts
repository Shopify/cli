import {generate} from '../../services/commands/notifications.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class Generate extends Command {
  static description = 'Generate a new notification for the the CLI.'

  static hidden = true

  async run(): Promise<void> {
    await generate()
  }
}
