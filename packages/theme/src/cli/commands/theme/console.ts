import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedStorefront, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {renderInfo} from '@shopify/cli-kit/node/ui'
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
      description: 'Local port to serve authentication service.',
      env: 'SHOPIFY_FLAG_PORT',
      default: '9293',
    }),
  }

  async run() {
    const {flags} = await this.parse(Console)
    const store = ensureThemeStore(flags)
    const {password, url, port} = flags
    const cliVersion = CLI_KIT_VERSION
    const theme = `liquid-console-repl-${cliVersion}`

    const adminSession = await ensureAuthenticatedThemes(store, password, [], true)
    const storefrontToken = await ensureAuthenticatedStorefront([], password)
    const authUrl = `http://localhost:${port}/password`

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
