import devService from '../../services/dev'
import {path} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'

export default class Dev extends Command {
  static description = 'Run a Hydrogen storefront locally for development'
  static flags = {
    path: Flags.string({
      hidden: true,
      description: 'the path to your hydrogen storefront',
      env: 'SHOPIFY_HYDROGEN_PATH',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Dev)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()

    await devService({directory})
  }
}
