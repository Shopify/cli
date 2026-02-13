import {themeFlags} from '../../flags.js'
import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {profile} from '../../services/profile.js'
import {runProfileAnalysis} from '../../utilities/profile-analysis.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {renderTasksToStdErr} from '../../utilities/theme-ui.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {Task} from '@shopify/cli-kit/node/ui'
import {InferredFlags} from '@oclif/core/interfaces'
import {AdminSession} from '@shopify/cli-kit/node/session'

type ProfileFlags = InferredFlags<typeof Profile.flags>
export default class Profile extends ThemeCommand {
  static summary = 'Profile the Liquid rendering of a theme page.'

  static usage = [
    'theme profile',
    'theme profile --url /products/classic-leather-jacket',
    'theme profile --analysis',
    'theme profile --analysis --url /collections/all',
  ]

  static descriptionWithMarkdown = `Profile the Shopify Liquid on a given page.

  This command opens an interactive flame graph showing the time spent executing Liquid on the given page.

  Use the \`--analysis\` flag to display a human-readable breakdown of Liquid rendering performance directly in the terminal instead of opening the flame graph viewer.`

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
    analysis: Flags.boolean({
      char: 'a',
      description: 'Analyze the profile and display a summary of Liquid rendering performance in the terminal.',
      env: 'SHOPIFY_FLAG_ANALYSIS',
      default: false,
    }),
    ...jsonFlag,
  }

  static multiEnvironmentsFlags: RequiredFlags = null

  async command(flags: ProfileFlags, adminSession: AdminSession) {
    const {password: themeAccessPassword} = flags

    let filter
    if (flags.theme) {
      filter = {filter: {theme: flags.theme}}
    } else {
      filter = {filter: {live: true}}
    }
    const theme = await findOrSelectTheme(adminSession, filter)

    if (flags.analysis) {
      await runProfileAnalysis({
        adminSession,
        themeId: theme.id.toString(),
        url: flags.url,
        themeAccessPassword,
        storefrontPassword: flags['store-password'],
      })
      return
    }

    const tasks: Task[] = [
      {
        title: `Generating Liquid profile for ${adminSession.storeFqdn} ${flags.url}`,
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
