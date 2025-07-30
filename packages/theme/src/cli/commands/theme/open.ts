import ThemeCommand, {RequiredFlags} from '../../utilities/theme-command.js'
import {themeFlags} from '../../flags.js'
import {open} from '../../services/open.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {InferredFlags} from '@oclif/core/interfaces'

type OpenFlags = InferredFlags<typeof Open.flags>
export default class Open extends ThemeCommand {
  static summary = 'Opens the preview of your remote theme.'

  static descriptionWithMarkdown = `Returns links that let you preview the specified theme. The following links are returned:

  - A link to the [editor](https://shopify.dev/docs/themes/tools/online-editor) for the theme in the Shopify admin.
  - A [preview link](https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can share with other developers.

  If you don't specify a theme, then you're prompted to select the theme to open from the list of the themes in your store.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
    development: Flags.boolean({
      char: 'd',
      description: 'Open your development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    editor: Flags.boolean({
      char: 'E',
      description: 'Open the theme editor for the specified theme in the browser.',
      env: 'SHOPIFY_FLAG_EDITOR',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Open your live (published) theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
  }

  static multiEnvironmentsFlags: RequiredFlags = null

  async command(flags: OpenFlags, adminSession: AdminSession) {
    await open(adminSession, flags)
  }
}
