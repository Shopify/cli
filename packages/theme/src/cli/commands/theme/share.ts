import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {push, PushFlags} from '../../services/push.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {getRandomName} from '@shopify/cli-kit/common/string'
import {recordTiming} from '@shopify/cli-kit/node/analytics'
import {InferredFlags} from '@oclif/core/interfaces'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {ArgOutput} from '@shopify/cli-kit/node/base-command'
import {Writable} from 'stream'

type ShareFlags = InferredFlags<typeof Share.flags>
export default class Share extends ThemeCommand {
  static summary = 'Creates a shareable, unpublished, and new theme on your theme library with a randomized name.'

  static descriptionWithMarkdown = `Uploads your theme as a new, unpublished theme in your theme library. The theme is given a randomized name.

  This command returns a [preview link](https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can share with others.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  static multiEnvironmentsFlags = ['store', 'password', 'path']

  async command(
    flags: ShareFlags,
    adminSession: AdminSession,
    multiEnvironment: boolean,
    _args?: ArgOutput,
    context?: {stdout?: Writable; stderr?: Writable},
  ) {
    const pushFlags: PushFlags = {
      environment: flags.environment,
      force: flags.force,
      noColor: flags['no-color'],
      password: flags.password,
      path: flags.path,
      store: flags.store,
      theme: getRandomName('creative'),
      unpublished: true,
    }

    recordTiming('theme-command:share')
    await push(pushFlags, adminSession, multiEnvironment, context)
    recordTiming('theme-command:share')
  }
}
