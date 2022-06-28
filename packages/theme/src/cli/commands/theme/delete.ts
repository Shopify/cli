import {getTheme} from '../../utilities/theme-store'
import {Command, Flags} from '@oclif/core'
import {session, string, ruby} from '@shopify/cli-kit'

export default class Delete extends Command {
  static description = "Delete remote themes from the connected store. This command can't be undone"

  static args = [{name: 'themeId', description: 'The ID of the theme to delete', required: false}]

  static flags = {
    development: Flags.boolean({
      char: 'd',
      description: 'Delete your development theme.',
      env: 'SHOPIFY_FLAG_THEME_DEVELOPMENT',
    }),
    // eslint-disable-next-line @typescript-eslint/naming-convention
    'show-all': Flags.boolean({
      char: 'a',
      description: 'Include others development themes in theme list.',
      env: 'SHOPIFY_FLAG_THEME_SHOW_ALL',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation.',
      env: 'SHOPIFY_FLAG_THEME_FORCE',
    }),
    store: Flags.string({
      char: 's',
      description: 'Store URL',
      env: 'SHOPIFY_FLAG_STORE',
      parse: (input, _) => Promise.resolve(string.normalizeStoreName(input)),
    }),
  }

  async run(): Promise<void> {
    const {flags, args} = await this.parse(Delete)

    const store = getTheme(flags)

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
    await ruby.execCLI(command, adminSession)
  }
}
