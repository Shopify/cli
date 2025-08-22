import ThemeCommand from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {publish} from '../../services/publish.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {OutputFlags} from '@oclif/core/interfaces'
import {AdminSession} from '@shopify/cli-kit/node/session'

type PublishFlags = OutputFlags<typeof Publish.flags>

export default class Publish extends ThemeCommand {
  static summary = 'Set a remote theme as the live theme.'

  static descriptionWithMarkdown = `Publishes an unpublished theme from your theme library.

If no theme ID is specified, then you're prompted to select the theme that you want to publish from the list of themes in your store.

You can run this command only in a directory that matches the [default Shopify theme folder structure](https://shopify.dev/docs/themes/tools/cli#directory-structure).

If you want to publish your local theme, then you need to run \`shopify theme push\` first. You're asked to confirm that you want to publish the specified theme. You can skip this confirmation using the \`--force\` flag.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
  }

  static multiEnvironmentsFlags = ['store', 'password', 'theme']

  async command(flags: PublishFlags, adminSession: AdminSession, multiEnvironment?: boolean) {
    await publish(adminSession, flags, multiEnvironment)
  }
}
