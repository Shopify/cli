import {themeFlags} from '../../flags.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {dev, refreshTokens, showDeprecationWarnings} from '../../services/dev.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {showEmbeddedCLIWarning} from '../../utilities/embedded-cli-warning.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class Dev extends ThemeCommand {
  static description =
    'Uploads the current theme as a development theme to the connected store, then prints theme editor and preview URLs to your terminal. While running, changes will push to the store in real time.'

  static flags = {
    ...globalFlags,
    path: themeFlags.path,
    host: Flags.string({
      description: 'Set which network interface the web server listens on. The default value is 127.0.0.1.',
      env: 'SHOPIFY_FLAG_HOST',
    }),
    'live-reload': Flags.string({
      description: `The live reload mode switches the server behavior when a file is modified:
- hot-reload Hot reloads local changes to CSS and sections (default)
- full-page  Always refreshes the entire page
- off        Deactivate live reload`,
      default: 'hot-reload',
      options: ['hot-reload', 'full-page', 'off'],
      env: 'SHOPIFY_FLAG_LIVE_RELOAD',
    }),
    poll: Flags.boolean({
      description: 'Force polling to detect file changes.',
      env: 'SHOPIFY_FLAG_POLL',
    }),
    'theme-editor-sync': Flags.boolean({
      description: 'Synchronize Theme Editor updates in the local theme files.',
      env: 'SHOPIFY_FLAG_THEME_EDITOR_SYNC',
    }),
    port: Flags.string({
      description: 'Local port to serve theme preview from.',
      env: 'SHOPIFY_FLAG_PORT',
    }),
    store: themeFlags.store,
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
    nodelete: Flags.boolean({
      char: 'n',
      description: 'Runs the dev command without deleting local files.',
      env: 'SHOPIFY_FLAG_NODELETE',
    }),
    only: Flags.string({
      char: 'o',
      multiple: true,
      description: 'Hot reload only files that match the specified pattern.',
      env: 'SHOPIFY_FLAG_ONLY',
    }),
    ignore: Flags.string({
      char: 'x',
      multiple: true,
      description: 'Skip hot reloading any files that match the specified pattern.',
      env: 'SHOPIFY_FLAG_IGNORE',
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
    password: themeFlags.password,
    environment: themeFlags.environment,
    notify: Flags.string({
      description:
        'The file path or URL. The file path is to a file that you want updated on idle. The URL path is where you want a webhook posted to report on file changes.',
      env: 'SHOPIFY_FLAG_NOTIFY',
    }),
    open: Flags.boolean({
      description: 'Automatically launch the theme preview in your default web browser.',
      env: 'SHOPIFY_FLAG_OPEN',
      default: false,
    }),
  }

  static cli2Flags = [
    'host',
    'live-reload',
    'poll',
    'theme-editor-sync',
    'overwrite-json',
    'port',
    'theme',
    'nodelete',
    'only',
    'ignore',
    'stable',
    'force',
    'notify',
  ]

  /**
   * Executes the theme serve command.
   * Every 110 minutes, it will refresh the session token.
   */
  async run(): Promise<void> {
    showEmbeddedCLIWarning()
    showDeprecationWarnings(this.argv)

    let {flags} = await this.parse(Dev)
    const store = ensureThemeStore(flags)

    const {adminSession, storefrontToken} = await refreshTokens(store, flags.password)

    if (flags.theme) {
      const filter = {filter: {theme: flags.theme}}
      const theme = await findOrSelectTheme(adminSession, filter)

      flags = {...flags, theme: theme.id.toString()}
    } else {
      const theme = await new DevelopmentThemeManager(adminSession).findOrCreate()
      const overwriteJson = flags['theme-editor-sync'] && theme.createdAtRuntime

      flags = {...flags, theme: theme.id.toString(), 'overwrite-json': overwriteJson}
    }

    const flagsToPass = this.passThroughFlags(flags, {allowedFlags: Dev.cli2Flags})

    await dev({
      adminSession,
      storefrontToken,
      directory: flags.path,
      store,
      password: flags.password,
      theme: flags.theme!,
      host: flags.host,
      port: flags.port,
      force: flags.force,
      open: flags.open,
      flagsToPass,
    })
  }
}
