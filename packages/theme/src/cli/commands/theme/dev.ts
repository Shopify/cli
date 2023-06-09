import {themeFlags} from '../../flags.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {DevelopmentThemeManager} from '../../utilities/development-theme-manager.js'
import {
  showDeprecationWarnings,
  currentDirectoryConfirmed,
  renderLinks,
  validThemeDirectory,
} from '../../services/dev.js'
import {findOrSelectTheme} from '../../utilities/theme-selector.js'
import {Flags} from '@oclif/core'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {ensureAuthenticatedStorefront, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {outputDebug} from '@shopify/cli-kit/node/output'

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
  }

  static cli2Flags = [
    'host',
    'live-reload',
    'poll',
    'theme-editor-sync',
    'overwrite-json',
    'port',
    'theme',
    'only',
    'ignore',
    'stable',
    'force',
    'notify',
  ]

  // Tokens are valid for 120 min, better to be safe and refresh every 110 min
  ThemeRefreshTimeoutInMs = 110 * 60 * 1000

  /**
   * Executes the theme serve command.
   * Every 110 minutes, it will refresh the session token.
   */
  async run(): Promise<void> {
    showDeprecationWarnings(this.argv)
    let {flags} = await this.parse(Dev)
    const store = ensureThemeStore(flags)
    const adminSession = await refreshTokens(store, flags.password)

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
    const command = ['theme', 'serve', flags.path, ...flagsToPass]

    if (!(await validThemeDirectory(flags.path)) && !(await currentDirectoryConfirmed(flags.force))) {
      return
    }

    renderLinks(store, flags.theme!, flags.host, flags.port)

    setInterval(() => {
      outputDebug('Refreshing theme session tokens...')
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      refreshTokens(store, flags.password)
    }, this.ThemeRefreshTimeoutInMs)
    await execCLI2(command, {store, adminToken: adminSession.token})
  }
}

async function refreshTokens(store: string, password: string | undefined) {
  const adminSession = await ensureAuthenticatedThemes(store, password, [], true)
  const storefrontToken = await ensureAuthenticatedStorefront([], password)
  await execCLI2(['theme', 'token', '--admin', adminSession.token, '--sfr', storefrontToken])
  return adminSession
}
