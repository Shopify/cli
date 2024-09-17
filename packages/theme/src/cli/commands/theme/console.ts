import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {ensureReplEnv, initializeRepl} from '../../services/console.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {renderWarning} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'

export default class Console extends ThemeCommand {
  static summary = 'Shopify Liquid REPL (read-eval-print loop) tool'

  static usage = ['theme:console', 'theme:console --url /products/classic-leather-jacket']

  static descriptionWithMarkdown = `Starts the Shopify Liquid REPL (read-eval-print loop) tool. This tool provides an interactive terminal interface for evaluating Liquid code and exploring Liquid objects, filters, and tags using real store data.

  You can also provide context to the console using a URL, as some Liquid objects are context-specific`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    store: themeFlags.store,
    password: themeFlags.password,
    environment: themeFlags.environment,
    url: Flags.string({
      description: 'The url to be used as context',
      env: 'SHOPIFY_FLAG_URL',
      default: '/',
    }),
    port: Flags.string({
      hidden: true,
      description: 'Local port to serve authentication service.',
      env: 'SHOPIFY_FLAG_PORT',
    }),
    'store-password': Flags.string({
      description: 'The password for storefronts with password protection.',
      env: 'SHOPIFY_FLAG_STORE_PASSWORD',
    }),
    legacy: Flags.boolean({
      hidden: true,
      description: 'Use the legacy Ruby implementation for the `shopify theme console` command.',
      env: 'SHOPIFY_FLAG_LEGACY',
    }),
  }

  async run() {
    const {flags} = await this.parse(Console)
    const store = ensureThemeStore(flags)
    const {url, port, password: themeAccessPassword} = flags
    const cliVersion = CLI_KIT_VERSION
    const theme = `liquid-console-repl-${cliVersion}`

    const adminSession = await ensureAuthenticatedThemes(store, themeAccessPassword, [], true)
    const authUrl = `http://localhost:${port ?? '9293'}/password`

    if (flags.port) {
      renderPortDeprecationWarning()
    }
    const {themeId, storePassword} = await ensureReplEnv(adminSession, flags['store-password'])
    await initializeRepl(adminSession, themeId, url, themeAccessPassword, storePassword)
  }
}
function renderPortDeprecationWarning() {
  renderWarning({
    headline: ['The', {command: '--port'}, 'flag has been deprecated.'],
    body: [
      {command: 'shopify theme console'},
      'no longer requires a port to run. The',
      {command: '--port'},
      'flag is in the process of being deprecated and will be removed soon.',
    ],
  })
}
