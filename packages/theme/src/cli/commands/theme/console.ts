import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedStorefront, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {execCLI2} from '@shopify/cli-kit/node/ruby'
import {renderInfo, renderWarning} from '@shopify/cli-kit/node/ui'
import {openURL} from '@shopify/cli-kit/node/system'

export default class Console extends ThemeCommand {
  static description = 'Early access feature: Shopify Liquid REPL'
  static hidden = true

  static flags = {
    ...globalFlags,
    store: themeFlags.store,
    password: themeFlags.password,
    environment: themeFlags.environment,
  }

  async run() {
    const {flags} = await this.parse(Console)
    const store = ensureThemeStore(flags)
    const password = flags.password

    const adminSession = await ensureAuthenticatedThemes(store, password, [], true)
    const storefrontToken = await ensureAuthenticatedStorefront([], password)
    const authUrl = 'http://localhost:9293'

    renderWarning({
      headline: 'This is a beta feature.',
      body: [
        'This command is beta, so it can change or be removed.',
        'If you have any feedback or would like to to keep it, please leave an up-vote',
        {link: {label: 'here', url: 'https://github.com/Shopify/cli/issues/1344'}},
        {char: '.'},
      ],
    })

    renderInfo({
      body: ['Activate Shopify Liquid console on', {link: {label: 'your browser', url: authUrl}}, {char: '.'}],
    })

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(() => openURL(authUrl), 2000)

    return execCLI2(['theme', 'console'], {adminSession, storefrontToken})
  }
}
