import devService from '../../services/dev.js'
import {hydrogenFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import Command from '@shopify/cli-kit/node/base-command'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class Dev extends Command {
  static description = 'Run a Hydrogen storefront locally for development.'
  static flags = {
    ...globalFlags,
    path: hydrogenFlags.path,
    force: Flags.boolean({
      description: 'force dependency pre-bundling.',
      env: 'SHOPIFY_FLAG_DEV_FORCE',
    }),
    host: Flags.boolean({
      description: 'listen on all addresses, including LAN and public addresses.',
      env: 'SHOPIFY_FLAG_DEV_HOST',
    }),
    open: Flags.boolean({
      description: 'automatically open the app in the browser',
      env: 'SHOPIFY_FLAG_DEV_OPEN',
      default: false,
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Dev)
    const directory = flags.path ? resolvePath(flags.path) : cwd()

    await devService({directory, ...flags, commandConfig: this.config})
  }
}
