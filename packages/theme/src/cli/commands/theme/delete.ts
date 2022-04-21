import {Command, Flags} from '@oclif/core'
import {session, string, store as conf, error, ruby} from '@shopify/cli-kit'

export default class Delete extends Command {
  static description = "Delete remote themes from the connected store. This command can't be undone"

  static args = [{name: 'themeId', description: 'The ID of the theme to delete', required: false}]

  static flags = {
    development: Flags.boolean({
      hidden: false,
      char: 'd',
      description: 'Delete your development theme.',
      env: 'SHOPIFY_CLI_THEME_DELETE_DEVELOPMENT',
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'show-all': Flags.boolean({
      hidden: false,
      char: 'a',
      description: 'Include others development themes in theme list.',
      env: 'SHOPIFY_CLI_THEME_DELETE_SHOW_ALL',
    }),
    force: Flags.boolean({
      hidden: false,
      char: 'f',
      description: 'Skip confirmation.',
      env: 'SHOPIFY_CLI_THEME_DELETE_FORCE',
    }),
    store: Flags.string({
      hidden: false,
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags, args} = await this.parse(Delete)

    const store = flags.store || conf.getThemeStore()
    if (!store) {
      throw new error.Fatal('A store is required', 'Set the store using --store={your_store}')
    }

    const command = ['theme', 'delete']
    if (args.themeId) {
      command.push(args.themeId)
    }

    if (flags.development) {
      command.push('-d')
    }
    if (flags.force) {
      command.push('-f')
    }
    if (flags['show-all']) {
      command.push('-a')
    }

    const adminSession = await session.ensureAuthenticatedAdmin(store)
    await ruby.exec(command, adminSession)
  }
}
