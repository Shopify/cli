import {ensureThemeStore} from '../../utilities/theme-store.js'
import {list} from '../../services/list.js'
import {ALLOWED_ROLES, Role} from '../../utilities/theme-selector/fetch.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {ensureAuthenticatedThemes} from '@shopify/cli-kit/node/session'
import {globalFlags} from '@shopify/cli-kit/node/cli'

export default class List extends ThemeCommand {
  static description = 'Lists the themes in your store, along with their IDs and statuses.'

  static flags = {
    ...globalFlags,
    password: themeFlags.password,
    store: themeFlags.store,
    role: Flags.custom<Role>({
      description: 'Only list themes with the given role.',
      options: ALLOWED_ROLES,
      env: 'SHOPIFY_FLAG_ROLE',
    })(),
    name: Flags.string({
      description: 'Only list themes that contain the given name.',
      env: 'SHOPIFY_FLAG_NAME',
    }),
    id: Flags.integer({
      description: 'Only list theme with the given ID.',
      env: 'SHOPIFY_FLAG_ID',
    }),
    json: Flags.boolean({
      description: 'Output the theme list as JSON.',
      default: false,
      env: 'SHOPIFY_FLAG_JSON',
    }),
    environment: themeFlags.environment,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(List)
    const store = ensureThemeStore(flags)
    const adminSession = await ensureAuthenticatedThemes(store, flags.password)

    await list(adminSession, flags)
  }
}
