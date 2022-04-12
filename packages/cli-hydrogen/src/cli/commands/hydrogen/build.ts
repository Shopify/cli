import buildService from '../../services/build'
import {Command, Flags} from '@oclif/core'
import {path} from '@shopify/cli-kit'

export default class Build extends Command {
  static description = 'Builds a Hydrogen storefront for production'
  static flags = {
    path: Flags.string({
      hidden: true,
      description: 'the path to your hydrogen storefront',
      env: 'SHOPIFY_HYDROGEN_PATH',
    }),
    target: Flags.string({
      char: 't',
      description: 'the target platform to build for',
      options: ['node', 'worker'],
      default: 'worker',
      env: 'SHOPIFY_HYDROGEN_BUILD_TARGET',
    }),
    base: Flags.string({
      char: 'b',
      description: ' the public path when served in production',
      env: 'SHOPIFY_HYDROGEN_BUILD_BASE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Build)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()

    await buildService({...flags, directory, target: flags.target as 'node' | 'worker'})
  }
}
