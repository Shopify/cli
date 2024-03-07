import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {deleteThemes, renderDeprecatedArgsWarning} from '../../services/delete.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Delete extends ThemeCommand {
  static summary = "Delete remote themes from the connected store. This command can't be undone."

  static descriptionWithMarkdown = `Deletes a theme from your store.

  You can specify multiple themes by ID. If no theme is specified, then you're prompted to select the theme that you want to delete from the list of themes in your store.

  You're asked to confirm that you want to delete the specified themes before they are deleted. You can skip this confirmation using the \`--force\` flag.`

  static description = this.descriptionWithoutMarkdown()

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
    environment: themeFlags.environment,
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
