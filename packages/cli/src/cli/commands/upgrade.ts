import {upgrade} from '../services/upgrade.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'

export default class Upgrade extends Command {
  static description = 'Upgrade the Shopify CLI.'

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The path to your project directory.',
      env: 'SHOPIFY_FLAG_PATH',
      parse: async (input) => resolvePath(input),
      default: async () => cwd(),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Upgrade)
    await upgrade(flags.path, CLI_KIT_VERSION)
  }
}
