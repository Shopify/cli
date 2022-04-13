import {Command, Flags} from '@oclif/core'
import {ruby, session, string} from '@shopify/cli-kit'

export default class Pull extends Command {
  static description = 'Download your remote theme files locally.'

  static flags = {
    store: Flags.string({
      hidden: false,
      char: 's',
      description: 'Store',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Pull)
    const store = flags.store || 'mystore'
    const adminSession = await session.ensureAuthenticatedAdmin(store)
    console.log(adminSession)
    await ruby.exec(['theme', 'pull'], '')
  }
}
