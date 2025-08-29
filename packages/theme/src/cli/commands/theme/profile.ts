import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {profile} from '../../services/profile.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {validateThemePassword} from '../../services/flags-validation.js'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'

export default class Profile extends ThemeCommand {
  static summary = 'Profile the Liquid rendering of a theme page.'

  static usage = [
    'theme profile',
    'theme profile --url /products/classic-leather-jacket',
    'theme profile --frame header-group --iterations 30',
  ]

  static descriptionWithMarkdown = `Profile the Shopify Liquid on a given page.

  This command will open a web page with the Speedscope profiler detailing the time spent executing Liquid on the given page.

  When the \`--frame\` flag is provided, the command will analyze specific frames in the profile data and display timing information for frames matching the given substring. Use \`--iterations\` to run the analysis multiple times.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    url: Flags.string({
      description: 'The url to be used as context',
      env: 'SHOPIFY_FLAG_URL',
      default: '/',
    }),
    'store-password': Flags.string({
      description: 'The password for storefronts with password protection.',
      env: 'SHOPIFY_FLAG_STORE_PASSWORD',
    }),
    frame: Flags.string({
      description: 'Frame name substring to filter and analyze in the profile data.',
      env: 'SHOPIFY_FLAG_FRAME',
    }),
    iterations: Flags.integer({
      description: 'Number of iterations to run the frame analysis.',
      default: 1,
      env: 'SHOPIFY_FLAG_ITERATIONS',
    }),
    ...jsonFlag,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Profile)

    validateThemePassword(flags.password)

    const store = ensureThemeStore(flags)
    const {password: themeAccessPassword} = flags

    const adminSession = await ensureAuthenticatedThemes(store, themeAccessPassword)
    let filter
    if (flags.theme) {
      filter = {filter: {theme: flags.theme}}
    } else {
      filter = {filter: {live: true}}
    }
    const theme = await findOrSelectTheme(adminSession, filter)

    await profile(
      adminSession,
      theme.id.toString(),
      flags.url,
      flags.json,
      themeAccessPassword,
      flags['store-password'],
      flags.frame,
      flags.iterations,
    )
  }
}
