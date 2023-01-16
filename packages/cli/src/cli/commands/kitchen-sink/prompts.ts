import {prompts} from '../../services/kitchen-sink/prompts.js'
import Command from '@shopify/cli-kit/node/base-command'

/**
 * This command is used to output all the UI prompt components of the CLI.
 * It's useful to test how they behave under different terminal sizes
 * and to help update the documentation when they change.
 */
export default class KitchenSinkPrompts extends Command {
  static description = 'View the UI kit components prompts'
  static hidden = true

  async run(): Promise<void> {
    await prompts()
  }
}
