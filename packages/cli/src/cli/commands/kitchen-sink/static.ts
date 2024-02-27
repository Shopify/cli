import {staticService} from '../../services/kitchen-sink/static.js'
import Command from '@shopify/cli-kit/node/base-command'

/**
 * This command is used to output all the banner UI components of the CLI.
 * It's useful to test how they behave under different terminal sizes
 * and to help update the documentation when they change.
 */
export default class KitchenSinkStatic extends Command {
  static description = 'View the UI kit components that display static output'
  static hidden = true

  async run(): Promise<void> {
    await staticService()
  }
}
