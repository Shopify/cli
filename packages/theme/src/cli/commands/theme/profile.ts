import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {profile} from '../../services/profile.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Profile extends ThemeCommand {
  static summary = 'Profile the Liquid rendering of a theme page.'

  static usage = ['theme profile --url /products/classic-leather-jacket']

  static descriptionWithMarkdown = `Profile the Shopify Liquid on a given page (URL).`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    store: themeFlags.store,
    password: themeFlags.password,
    url: Flags.string({
      char: 'u',
      description: 'URL to the theme page to profile.',
      env: 'SHOPIFY_FLAG_URL',
      required: true,
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Return profiling data as JSON.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Profile)
    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password, [], true)

    await profile(adminSession, flags.password, store, flags.url, flags.json)
  }
}
