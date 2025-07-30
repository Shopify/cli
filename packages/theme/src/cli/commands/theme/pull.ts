import {globFlags, themeFlags} from '../../flags.js'
import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {pull} from '../../services/pull.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {Flags} from '@oclif/core'
import {recordTiming} from '@shopify/cli-kit/node/analytics'
import {InferredFlags} from '@oclif/core/interfaces'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {ArgOutput} from '@shopify/cli-kit/node/base-command'
import {Writable} from 'stream'

type PullFlags = InferredFlags<typeof Pull.flags>
export default class Pull extends ThemeCommand {
  static summary = 'Download your remote theme files locally.'

  static descriptionWithMarkdown = `Retrieves theme files from Shopify.

If no theme is specified, then you're prompted to select the theme to pull from the list of the themes in your store.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
    ...globFlags('download'),
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
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = ['store', 'password', 'path', ['live', 'development', 'theme']]

  async command(
    flags: PullFlags,
    adminSession?: AdminSession,
    multiEnvironment?: boolean,
    _args?: ArgOutput,
    context?: {stdout?: Writable; stderr?: Writable},
  ) {
    recordTiming('theme-command:pull')
    await pull({...flags, noColor: flags['no-color']}, adminSession, multiEnvironment, context)
    recordTiming('theme-command:pull')
  }
}
