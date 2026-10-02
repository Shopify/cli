import {themeShareJsonOutputSchema} from '../../services/share/types.js'
import {renderThemeShareResult, renderThemeShareEnvironmentResults} from '../../services/share/result.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {executeThemePush, PushFlags} from '../../services/push.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {getRandomName} from '@shopify/cli-kit/common/string'
import {recordTiming} from '@shopify/cli-kit/node/analytics'
import {InferredFlags} from '@oclif/core/interfaces'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {ArgOutput} from '@shopify/cli-kit/node/base-command'

import {Writable} from 'stream'

type ShareFlags = InferredFlags<typeof Share.flags>
export default class Share extends ThemeCommand {
  static get jsonOutputSchema() {
    return themeShareJsonOutputSchema
  }

  static summary = 'Creates a shareable, unpublished, and new theme on your theme library with a randomized name.'

  static descriptionWithMarkdown = `Uploads your theme as a new, unpublished theme in your theme library. The theme is given a randomized name.

  This command returns a [preview link](https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can share with others.`

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...themeFlags,
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
    listing: Flags.string({
      description:
        'The listing preset to use for multi-preset themes. Applies preset files from listings/[preset-name] directory.',
      env: 'SHOPIFY_FLAG_LISTING',
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
      listing: flags.listing,
    }

    recordTiming('theme-command:share')
    const result = await executeThemePush(pushFlags, adminSession, multiEnvironment, context)
    if (result && !(flags.json && multiEnvironment)) renderThemeShareResult(result, flags.json ? 'json' : 'text')
    recordTiming('theme-command:share')
    return result
  }

  protected collectsEnvironmentResults(flags: {json?: boolean}): boolean {
    return Boolean(flags.json)
  }

  protected renderEnvironmentResults(results: {environment: string; result: unknown}[]): void {
    renderThemeShareEnvironmentResults(results)
  }
}
