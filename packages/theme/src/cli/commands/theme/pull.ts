import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {pull} from '../../services/pull.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {OutputFlags} from '@oclif/core/lib/interfaces/parser.js'

type PullFlags = OutputFlags<typeof Pull.flags>

export default class Pull extends ThemeCommand {
  static summary = 'Download your remote theme files locally.'

  static descriptionWithMarkdown = `Retrieves theme files from Shopify.

If no theme is specified, then you're prompted to select the theme to pull from the list of the themes in your store.`

  static description = this.descriptionWithoutMarkdown()

  static multiEnvironmentsFlags = ['store', 'password', 'force']

  static flags = {
    ...globalFlags,
    ...themeFlags,
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    development: Flags.boolean({
      char: 'd',
      description: 'Pull theme files from your remote development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Pull theme files from your remote live theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
    nodelete: Flags.boolean({
      char: 'n',
      description: `Prevent deleting local files that don't exist remotely.`,
      env: 'SHOPIFY_FLAG_NODELETE',
    }),
    only: Flags.string({
      char: 'o',
      multiple: true,
      description: 'Download only the specified files (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_ONLY',
    }),
    ignore: Flags.string({
      char: 'x',
      multiple: true,
      description: 'Skip downloading the specified files (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_IGNORE',
    }),
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  async command(flags: PullFlags, adminSession: AdminSession) {
    await pull(
      {
        path: flags.path,
        password: flags.password,
        store: flags.store,
        theme: flags.theme,
        development: flags.development,
        live: flags.live,
        nodelete: flags.nodelete,
        only: flags.only,
        ignore: flags.ignore,
        force: flags.force,
        verbose: flags.verbose,
        noColor: flags['no-color'],
      },
      adminSession,
    )
  }
}
