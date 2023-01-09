import {kitchenSink} from '../services/kitchen-sink.js'
import Command from '@shopify/cli-kit/node/base-command'

/**
 * This command is used to output all the UI components of the CLI.
 * It's useful to test how they behave under different terminal sizes
 * and to help update the documentation when they change.
 */
export default class KitchenSink extends Command {
  static description = 'View all the available UI kit components'
  static hidden = true

  async run(): Promise<void> {
    await kitchenSink()
  }
}
