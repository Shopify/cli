import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {profile} from '../../services/profile.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {renderTasksToStdErr} from '../../utilities/theme-ui.js'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Task} from '@shopify/cli-kit/node/ui'

export default class Profile extends ThemeCommand {
  static summary = 'Profile the Liquid rendering of a theme page.'

  static usage = ['theme profile', 'theme profile --url /products/classic-leather-jacket']

  static descriptionWithMarkdown = `Profile the Shopify Liquid on a given page.

  This command will open a web page with the Speedscope profiler detailing the time spent executing Liquid on the given page.`

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
    ...jsonFlag,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Profile)
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

    const tasks: Task[] = [
      {
        title: `Generating Liquid profile for ${store + flags.url}`,
        task: async () => {
          await profile(
            adminSession,
            theme.id.toString(),
            flags.url,
            flags.json,
            themeAccessPassword,
            flags['store-password'],
          )
        },
      },
    ]
    await renderTasksToStdErr(tasks)
  }
}
