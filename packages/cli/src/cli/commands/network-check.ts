import {networkCheckService} from '../services/commands/network-check.js'
import Command from '@shopify/cli-kit/node/base-command'

export default class NetworkCheck extends Command {
  static description = 'Check the network connection'

  async run(): Promise<void> {
    await networkCheckService()
  }
}
