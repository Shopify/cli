import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {ensureReplEnv, repl} from '../../services/console.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedStorefront, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {Flags} from '@oclif/core'
import {CLI_KIT_VERSION} from '@shopify/cli-kit/common/version'
import {outputInfo} from '@shopify/cli-kit/node/output'

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
      description: 'Local port to serve authentication service.',
      env: 'SHOPIFY_FLAG_PORT',
      default: '9293',
    }),
    'store-password': Flags.string({
      description: 'The password for the storefront.',
      env: 'SHOPIFY_FLAG_STORE_PASSWORD',
    }),
    'dev-preview': Flags.boolean({
      hidden: true,
      description: 'Enables the developer preview for the upcoming `theme console` implementation.',
      env: 'SHOPIFY_FLAG_BETA',
    }),
  }

  async run() {
    const {flags} = await this.parse(Console)
    const store = ensureThemeStore(flags)
    const {url, port, password: themeAccessPassword} = flags
    const cliVersion = CLI_KIT_VERSION
    const theme = `liquid-console-repl-${cliVersion}`

    const adminSession = await ensureAuthenticatedThemes(store, themeAccessPassword, [], true)
    const storefrontToken = await ensureAuthenticatedStorefront([], themeAccessPassword)
    const authUrl = `http://localhost:${port}/password`

    if (flags['dev-preview']) {
      outputInfo('This feature is currently in development and is not ready for use or testing yet.')
      const {themeId, storePassword} = await ensureReplEnv(adminSession, flags['store-password'])
      await repl(adminSession, storefrontToken, themeId, storePassword)
      return
    }

    renderInfo({
      body: [
        'Activate the Shopify Liquid console in',
        {link: {label: 'your browser', url: authUrl}},
        'and enter your store password if prompted.',
      ],
    })

    return execCLI2(['theme', 'console', '--url', url, '--port', port, '--theme', theme], {
      store,
      adminToken: adminSession.token,
      storefrontToken,
    })
  }
}
