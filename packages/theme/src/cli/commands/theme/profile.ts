import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {render} from '../../utilities/theme-environment/storefront-renderer.js'
import {DevServerSession} from '../../utilities/theme-environment/types.js'
import {ensureThemeStore} from '../../utilities/theme-store.js'
import {consoleLog} from '@shopify/cli-kit/node/output'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {ensureAuthenticatedStorefront, ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'

export default class Profile extends ThemeCommand {
  static summary = 'TODO'

  static descriptionWithMarkdown = `TODO`

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...globalFlags,
    ...themeFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(Profile)

    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password, [], true)
    const storefrontToken = await ensureAuthenticatedStorefront([], flags.password)

    consoleLog('Hello from theme profile')

    const session: DevServerSession = {
      ...adminSession,
      storefrontToken,
      storefrontPassword: 'passw0rd',
      //                  ^------------ add your store password here
      expiresAt: new Date(),
    }

    const response = await render(session, {
      path: '/',
      query: [],
      themeId: '163350020118',
      //       ^---------------------- add your theme id here
      cookies: '',
      headers: {},
      replaceTemplates: {},
    })

    consoleLog('-----------------------')
    consoleLog(await response.text())
    consoleLog('-----------------------')
  }
}
