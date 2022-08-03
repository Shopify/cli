import {getTheme} from '../../utilities/theme-store.js'
import {Flags} from '@oclif/core'
import {cli, session, string} from '@shopify/cli-kit'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import Command from '@shopify/cli-kit/node/base-command'

export default class List extends Command {
  static description = 'Lists your remote themes.'

  static flags = {
    ...cli.globalFlags,
    store: Flags.string({
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)
    const store = getTheme(flags)
    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await execCLI2(['theme', 'list'], {adminSession})
  }
}
