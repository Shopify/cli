import {generate} from '../../services/commands/notifications.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class Generate extends Command {
  static description =
    'Generate a notifications.json file for the the CLI, appending a new notification to the current file.'

  static hidden = true

  async run(): Promise<void> {
    await generate()
  }
}
