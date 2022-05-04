import devService from '../../services/dev'
import {path, cli} from '@shopify/cli-kit'
import {Command, Flags} from '@oclif/core'

export default class Dev extends Command {
  static description = 'Run a Hydrogen storefront locally for development'
  static flags = {
    ...cli.globalFlags,
    path: Flags.string({
      hidden: true,
      description: 'the path to your hydrogen storefront',
      env: 'SHOPIFY_FLAG_PATH',
    }),
    force: Flags.boolean({
      description: 'force dependency pre-bundling.',
      env: 'SHOPIFY_FLAG_DEV_FORCE',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Dev)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()

    await devService({directory, ...flags})
  }
}
