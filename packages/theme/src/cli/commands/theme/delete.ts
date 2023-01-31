import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {deleteThemes, renderDeprecatedArgsWarning} from '../../services/delete.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Delete extends ThemeCommand {
  static description = "Delete remote themes from the connected store. This command can't be undone."

  // Accept any number of args without naming them
  static strict = false

  static flags = {
    ...globalFlags,
    password: themeFlags.password,
    development: Flags.boolean({
      char: 'd',
      description: 'Delete your development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    'show-all': Flags.boolean({
      char: 'a',
      description: 'Include others development themes in theme list.',
      env: 'SHOPIFY_FLAG_SHOW_ALL',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
      multiple: true,
    }),
    store: themeFlags.store,
  }

  async run(): Promise<void> {
    const {flags, argv} = await this.parse(Delete)
    const {development, force, password, theme} = flags
    const themes = [...argv, ...(theme ?? [])]

    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, password)

    const hasDeprecatedArgs = argv.length > 0
    if (hasDeprecatedArgs) {
      renderDeprecatedArgsWarning(argv)
    }

    await deleteThemes(adminSession, {
      selectTheme: flags['show-all'],
      development,
      themes,
      force,
    })
  }
}
