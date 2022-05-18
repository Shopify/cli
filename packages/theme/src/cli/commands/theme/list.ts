import {getThemeStore} from '../../utilities/theme-store'
import {Command, Flags} from '@oclif/core'
import {ruby, session, string} from '@shopify/cli-kit'

export default class List extends Command {
  static description = 'Lists your remote themes.'

  static flags = {
    store: Flags.string({
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)
    const store = getThemeStore(flags)
    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await ruby.execCLI(['theme', 'list'], adminSession)
  }
}
