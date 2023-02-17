import {upgrade} from '../services/upgrade.js'
import {Flags} from '@oclif/core'
import Command from '@shopify/cli-kit/node/base-command'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {resolvePath, cwd} from '@shopify/cli-kit/node/path'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Upgrade extends Command {
  static description = 'Upgrade the Shopify CLI.'

  static flags = {
    ...globalFlags,
    path: Flags.string({
      hidden: false,
      description: 'The path to your project directory.',
      parse: (input, _) => Promise.resolve(resolvePath(input)),
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Upgrade)
    const directory = flags.path ? resolvePath(flags.path) : cwd()
    const currentVersion = CLI_KIT_VERSION
    await upgrade(directory, currentVersion)
  }
}
