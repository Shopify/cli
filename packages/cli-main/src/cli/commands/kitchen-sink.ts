import {kitchenSink} from '../services/kitchen-sink.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class KitchenSink extends Command {
  static description = 'View all the available UI kit components'
  static hidden = true

  async run(): Promise<void> {
    await kitchenSink()
  }
}
