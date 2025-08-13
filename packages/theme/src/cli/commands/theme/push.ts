import {globFlags, themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {push, PushFlags} from '../../services/push.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {recordTiming} from '@shopify/cli-kit/node/analytics'

export default class Push extends ThemeCommand {
  static summary = 'Uploads your local theme files to the connected store, overwriting the remote version if specified.'

  static usage = ['theme push', 'theme push --unpublished --json']

  static descriptionWithMarkdown = `Uploads your local theme files to Shopify, overwriting the remote version if specified.

  If no theme is specified, then you're prompted to select the theme to overwrite from the list of the themes in your store.

  You can run this command only in a directory that matches the [default Shopify theme folder structure](https://shopify.dev/docs/themes/tools/cli#directory-structure).

  This command returns the following information:

  - A link to the [editor](https://shopify.dev/docs/themes/tools/online-editor) for the theme in the Shopify admin.
  - A [preview link](https://help.shopify.com/manual/online-store/themes/adding-themes#share-a-theme-preview-with-others) that you can share with others.

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
    ...globFlags('upload'),
    ...jsonFlag,
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
      description: `Prevent deleting remote files that don't exist locally.`,
      env: 'SHOPIFY_FLAG_NODELETE',
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
    force: Flags.boolean({
      hidden: true,
      char: 'f',
      description: 'Proceed without confirmation, if current directory does not seem to be theme directory.',
      env: 'SHOPIFY_FLAG_FORCE',
    }),
    strict: Flags.boolean({
      description: 'Require theme check to pass without errors before pushing. Warnings are allowed.',
      env: 'SHOPIFY_FLAG_STRICT_PUSH',
    }),
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Push)

    const pushFlags: PushFlags = {
      path: flags.path,
      password: flags.password,
      store: flags.store,
      theme: flags.theme,
      development: flags.development,
      live: flags.live,
      unpublished: flags.unpublished,
      nodelete: flags.nodelete,
      only: flags.only,
      ignore: flags.ignore,
      json: flags.json,
      allowLive: flags['allow-live'],
      publish: flags.publish,
      force: flags.force,
      noColor: flags['no-color'],
      verbose: flags.verbose,
      strict: flags.strict,
    }

    recordTiming('theme-command:push')
    await push(pushFlags)
    recordTiming('theme-command:push')
  }
}
