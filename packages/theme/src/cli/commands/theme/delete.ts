import ThemeCommand from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {getThemeStore} from '../../utilities/theme-store.js'
import {findOrSelectTheme, findThemes} from '../../utilities/theme-selector.js'
import {deleteThemes, renderArgumentsWarning} from '../../services/delete.js'
import {Theme} from '../../models/theme.js'
import {Flags} from '@oclif/core'
import {cli, session} from '@shopify/cli-kit'

export default class Delete extends ThemeCommand {
  static description = "Delete remote themes from the connected store. This command can't be undone"

  // Accept any number of args without naming them
  static strict = false

  static flags = {
    ...cli.globalFlags,
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
    // Handle parameters
    const {flags, argv} = await this.parse(Delete)
    const {development, password, force, theme} = flags
    const showAll = flags['show-all']

    const identifiers = [...argv, ...(theme ?? [])]
    const query = {development, identifiers}
    const store = await getThemeStore(flags)

    const adminSession = await session.ensureAuthenticatedThemes(store, password)

    const hasDeprecatedArgs = argv.length > 0
    if (hasDeprecatedArgs) {
      renderArgumentsWarning(argv)
    }

    let themes: Theme[]

    if (showAll || identifiers.length <= 1) {
      const theme = await findOrSelectTheme(adminSession, {
        header: `What theme do you want to delete from ${store}?`,
        filter: {development, identifiers},
      })

      themes = [theme]
    } else {
      themes = await findThemes(adminSession, query)
    }

    await deleteThemes(themes, adminSession, force)
  }
}
