import {Command, Flags} from '@oclif/core'
import {ruby, session, string} from '@shopify/cli-kit'
import {getThemeStore} from '$cli/utilities/theme-store'

export default class Share extends Command {
  static description =
    'Creates a shareable, unpublished, and new theme on your theme library with a randomized name. Works like an alias to {{command:theme push -u -t=RANDOMIZED_NAME}}'

  static flags = {
    path: Flags.string({
      description: 'The path to your theme',
      default: '.',
      env: 'SHOPIFY_FLAG_PATH',
    }),
    store: Flags.string({
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Share)
    const store = getThemeStore(flags)
    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await ruby.execCLI(['theme', 'share', flags.path], adminSession)
  }
}
