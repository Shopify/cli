import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {packageTheme} from '../../services/package.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Package extends ThemeCommand {
  static summary = 'Package your theme into a .zip file, ready to upload to the Online Store.'

  static descriptionWithMarkdown = `Packages your local theme files into a ZIP file that can be uploaded to Shopify.

  Only folders that match the [default Shopify theme folder structure](https://shopify.dev/docs/themes/tools/cli#directory-structure) are included in the package.

  The ZIP file uses the name \`theme_name-theme_version.zip\`, based on parameters in your [settings_schema.json](https://shopify.dev/docs/themes/architecture/config/settings-schema-json) file.`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Package)
    await packageTheme(flags.path)
  }
}
