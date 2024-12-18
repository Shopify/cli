import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {profile} from '../../services/profile.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Profile extends ThemeCommand {
  static summary = 'Profile the Liquid rendering of a theme page.'

  static usage = ['theme profile --url /products/classic-leather-jacket']

  static descriptionWithMarkdown = `Profile the Shopify Liquid on a given page.

  This command will open a web page with the Speedscope profiler detailing the time spent executing Liquid on the given page.`

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
      parse: async (url) => (url.startsWith('/') ? url : `/${url}`),
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

    await profile(flags.password, store, flags.url, flags.json)
  }
}
