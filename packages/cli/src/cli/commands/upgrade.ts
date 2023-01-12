import {upgrade} from '../services/upgrade.js'
import {Flags} from '@oclif/core'
import {constants, path} from '@shopify/cli-kit'
import Command from '@shopify/cli-kit/node/base-command'

export default class Upgrade extends Command {
  static description = 'Upgrade the Shopify CLI.'

  static flags = {
    path: Flags.string({
      hidden: false,
      description: 'The path to your project directory.',
      parse: (input, _) => Promise.resolve(path.resolve(input)),
      env: 'SHOPIFY_FLAG_PATH',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Upgrade)
    const directory = flags.path ? path.resolve(flags.path) : process.cwd()
    const currentVersion = await constants.versions.cliKit()
    await upgrade(directory, currentVersion)
  }
}
