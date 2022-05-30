import {Command} from '@oclif/core'
import {output} from '@shopify/cli-kit'

export default class Editions extends Command {
  static description = 'Shopify editions'

  async run(): Promise<void> {
    output.info('Hello world')
  }
}
