import {Command, Flags} from '@oclif/core'
import {ruby} from '@shopify/cli-kit'

export default class Package extends Command {
  static description = 'Package your theme into a .zip file, ready to upload to the Online Store.'

  static flags = {
    path: Flags.string({
      description: 'The path to your theme',
      default: '.',
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Package)

    await ruby.exec(['theme', 'package', flags.path])
  }
}
