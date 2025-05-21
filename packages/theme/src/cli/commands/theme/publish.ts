import ThemeCommand from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {publish, renderArgumentsWarning} from '../../services/publish.js'
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

  // Accept any number of args without naming them
  static strict = false

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

  async command(flags: PublishFlags, adminSession: AdminSession) {
    // Deprecated use of passing the theme id as an argument
    // ex: `shopify theme publish <themeid>`
    const positionalArgValue =
      this.argv && this.argv.length > 0 && typeof this.argv[0] === 'string' ? this.argv[0] : undefined

    if (!flags.theme && positionalArgValue) {
      flags.theme = positionalArgValue
      renderArgumentsWarning(positionalArgValue)
    }
    await publish(adminSession, flags)
  }
}
