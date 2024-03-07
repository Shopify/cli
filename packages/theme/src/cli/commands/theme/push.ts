import {themeFlags} from '../../flags.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Push extends ThemeCommand {
  static summary = 'Uploads your local theme files to the connected store, overwriting the remote version if specified.'

  static usage = `shopify theme push

shopify theme push --unpublished --json
  `

  static descriptionWithMarkdown = `Uploads your local theme files to Shopify, overwriting the remote version if specified.

  If no theme is specified, then you're prompted to select the theme to overwrite from the list of the themes in your store.

  You can run this command only in a directory that matches the [default Shopify theme folder structure](https://shopify.dev/docs/themes/tools/cli#directory-structure).

  This command returns the following information:

  - A link to the [editor](https://shopify.dev/docs/themes/tools/online-editor) for the theme in the Shopify admin.
  - A [preview link](https://help.shopify.com/manual/online-store/themes/adding-themes?shpxid=cee12a89-AA22-4AD3-38C8-91C8FC0E1FB0#share-a-theme-preview-with-others) that you can share with others.

  If you use the \`--json\` flag, then theme information is returned in JSON format, which can be used as a machine-readable input for scripts or continuous integration.

  Sample output:

  \`\`\`json
  {
    "theme": {
      "id": 108267175958,
      "name": "MyTheme",
      "role": "unpublished",
      "shop": "mystore.myshopify.com",
      "editor_url": "https://mystore.myshopify.com/admin/themes/108267175958/editor",
      "preview_url": "https://mystore.myshopify.com/?preview_theme_id=108267175958"
    }
  }
  \`\`\`
    `

  static description = this.descriptionWithoutMarkdown()

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
      description: 'Push theme files from your remote development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    live: Flags.boolean({
      char: 'l',
      description: 'Push theme files from your remote live theme.',
      env: 'SHOPIFY_FLAG_LIVE',
    }),
    unpublished: Flags.boolean({
      char: 'u',
      description: 'Create a new unpublished theme and push to it.',
      env: 'SHOPIFY_FLAG_UNPUBLISHED',
    }),
    nodelete: Flags.boolean({
      char: 'n',
      description: 'Runs the push command without deleting local files.',
      env: 'SHOPIFY_FLAG_NODELETE',
    }),
    only: Flags.string({
      char: 'o',
      description: 'Download only the specified files (Multiple flags allowed).',
      multiple: true,
      env: 'SHOPIFY_FLAG_ONLY',
    }),
    ignore: Flags.string({
      char: 'x',
      description: 'Skip downloading the specified files (Multiple flags allowed).',
      multiple: true,
      env: 'SHOPIFY_FLAG_IGNORE',
    }),
    json: Flags.boolean({
      char: 'j',
      description: 'Output JSON instead of a UI.',
      env: 'SHOPIFY_FLAG_JSON',
    }),
    'allow-live': Flags.boolean({
      char: 'a',
      description: 'Allow push to a live theme.',
      env: 'SHOPIFY_FLAG_ALLOW_LIVE',
    }),
    publish: Flags.boolean({
      char: 'p',
      description: 'Publish as the live theme after uploading.',
      env: 'SHOPIFY_FLAG_PUBLISH',
    }),
    stable: Flags.boolean({
      hidden: true,
      description:
        'Performs the upload by relying in the legacy upload approach (slower, but it might be more stable in some scenarios)',
      env: 'SHOPIFY_FLAG_STABLE',
    }),
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
  }

  static cli2Flags = [
    'theme',
    'development',
    'live',
    'unpublished',
    'nodelete',
    'only',
    'ignore',
    'json',
    'allow-live',
    'publish',
    'stable',
    'force',
    'development-theme-id',
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(Push)
    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    const developmentThemeManager = new DevelopmentThemeManager(adminSession)
    const theme = await (flags.development ? developmentThemeManager.findOrCreate() : developmentThemeManager.fetch())
    if (theme) {
      if (flags.development) {
        flags.theme = `${theme.id}`
        flags.development = false
      }
      flags['development-theme-id'] = theme.id
    }

    const flagsToPass = this.passThroughFlags(flags, {allowedFlags: Push.cli2Flags})
    const command = ['theme', 'push', flags.path, ...flagsToPass]

    await execCLI2(command, {store, adminToken: adminSession.token})
  }
}
