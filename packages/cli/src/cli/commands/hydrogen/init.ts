import Command from '@shopify/cli-kit/node/base-command'
import {outputSuccess} from '@shopify/cli-kit/node/output'

export default class HydrogenInit extends Command {
  static description = 'Create a Hydrogen project'

  async run(): Promise<void> {
    outputSuccess('[demo] Hydrogen project created')
  }
}
