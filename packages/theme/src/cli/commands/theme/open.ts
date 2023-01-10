import {getThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {editorLink, previewLink} from '../../utilities/theme-links.js'
import {Flags} from '@oclif/core'
import {cli, session, system} from '@shopify/cli-kit'
import * as uix from '@shopify/cli-kit/node/ui'

export default class Open extends ThemeCommand {
  static description = 'Opens the preview of your remote theme.'

  static flags = {
    ...cli.globalFlags,
    password: themeFlags.password,
    development: Flags.boolean({
      char: 'd',
      description: 'Delete your development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    editor: Flags.boolean({
      char: 'e',
      description: 'Open the theme editor for the specified theme in the browser.',
      env: 'SHOPIFY_FLAG_EDITOR',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Pull theme files from your remote live theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    store: themeFlags.store,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Open)
    const {development, live, theme: identifier} = flags
    const store = await getThemeStore(flags)

    const adminSession = await session.ensureAuthenticatedThemes(store, flags.password)

    const theme = await findOrSelectTheme(adminSession, {
      header: 'Select a theme to open',
      filter: {
        live,
        development,
        identifier,
      },
    })

    const preview = previewLink(theme, adminSession)
    const editor = editorLink(theme, adminSession)

    if (flags.editor) {
      await system.open(editor)
    } else {
      await system.open(preview)
    }

    uix.renderInfo({
      headline: {
        userInput: theme.name,
      },
      body: {
        list: {
          items: [
            {link: {label: 'Preview your theme', url: preview}},
            {link: {label: 'Customize your theme at the theme', url: editor}},
          ],
        },
      },
    })
  }
}
