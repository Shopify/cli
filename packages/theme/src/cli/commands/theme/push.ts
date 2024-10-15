import {themeFlags} from '../../flags.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand, {FlagValues} from '../../utilities/theme-command.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {push, PushFlags} from '../../services/push.js'
import {hasRequiredThemeDirectories} from '../../utilities/theme-fs.js'
import {currentDirectoryConfirmed} from '../../utilities/theme-ui.js'
import {showEmbeddedCLIWarning} from '../../utilities/embedded-cli-warning.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {cwd, resolvePath} from '@shopify/cli-kit/node/path'
import {useEmbeddedThemeCLI} from '@shopify/cli-kit/node/context/local'
import {execCLI2} from '@shopify/cli-kit/node/ruby'

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
    legacy: Flags.boolean({
      hidden: true,
      description: 'Use the legacy Ruby implementation for the `shopify theme push` command.',
      env: 'SHOPIFY_FLAG_LEGACY',
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
    'force',
    'development-theme-id',
  ]

  async run(): Promise<void> {
    const {flags} = await this.parse(Push)

    if (flags.password || flags.legacy) {
      await this.execLegacyPush()
      return
    }

    const pushFlags: PushFlags = {
      path: flags.path,
      password: flags.password,
      store: flags.store,
      environment: flags.environment,
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
    }

    await push(pushFlags)
  }

  async execLegacyPush() {
    const {flags} = await this.parse(Push)
    const path = flags.path || cwd()
    const force = flags.force || false

    const store = ensureThemeStore({store: flags.store})
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    const workingDirectory = path ? resolvePath(path) : cwd()
    if (!(await hasRequiredThemeDirectories(workingDirectory)) && !(await currentDirectoryConfirmed(force))) {
      return
    }

    const flagsForCli2 = flags as typeof flags & FlagValues

    showEmbeddedCLIWarning()

    const developmentThemeManager = new DevelopmentThemeManager(adminSession)

    const targetTheme = await (flagsForCli2.development
      ? developmentThemeManager.findOrCreate()
      : developmentThemeManager.fetch())

    if (targetTheme) {
      if (flagsForCli2.development) {
        flagsForCli2.theme = `${targetTheme.id}`
        flagsForCli2.development = false
      }
      if (useEmbeddedThemeCLI()) {
        flagsForCli2['development-theme-id'] = targetTheme.id
      }
    }

    const flagsToPass = this.passThroughFlags(flagsForCli2, {
      allowedFlags: Push.cli2Flags,
    })
    const command = ['theme', 'push', flagsForCli2.path, ...flagsToPass]

    await execCLI2(command, {store, adminToken: adminSession.token})
  }
}
