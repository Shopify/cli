import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {ThemeInfo, themeInfo, devInfo} from '../../services/info.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {Flags} from '@oclif/core'
import {AbortError} from '@shopify/cli-kit/node/error'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {formatSection, outputInfo} from '@shopify/cli-kit/node/output'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Info extends ThemeCommand {
  static description =
    'Displays information about your theme environment, including your current store. Can also retrieve information about a specific theme.'

  static flags = {
    ...globalFlags,
    store: themeFlags.store,
    password: themeFlags.password,
    environment: themeFlags.environment,
    development: Flags.boolean({
      char: 'd',
      description: 'Retrieve info from your development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    json: Flags.boolean({
      description: 'Output the theme info as JSON.',
      default: false,
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Info)

    if (flags.theme || flags.development) {
      const store = ensureThemeStore(flags)
      const adminSession = await ensureAuthenticatedThemes(store, flags.password)

      let theme
      if (flags.development) {
        const developmentThemeManager = new DevelopmentThemeManager(adminSession)
        theme = await (flags.development ? developmentThemeManager.findOrCreate() : developmentThemeManager.fetch())
      } else {
        const filter = {filter: {theme: flags.theme}}
        theme = await findOrSelectTheme(adminSession, filter)
      }

      const output: ThemeInfo | undefined = theme ? themeInfo(theme, store, adminSession) : undefined

      if (flags.json) {
        return outputInfo(JSON.stringify(output, null, 2))
      }

      if (!output) {
        throw new AbortError('Theme not found!')
      }

      const infoMessage = Object.entries(output.theme)
        .map(([key, val]) => formatSection(key, `${val}`))
        .join('\n\n')
      outputInfo(infoMessage)
    } else {
      const infoMessage = await devInfo({cliVersion: this.config.version})
      outputInfo(infoMessage)
    }
  }
}
