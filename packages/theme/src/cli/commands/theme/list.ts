import {ALLOWED_ROLES, Role} from '../../utilities/theme-selector/fetch.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {list} from '../../services/list.js'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {OutputFlags} from '@oclif/core/lib/interfaces/parser.js'
import {AdminSession} from '@shopify/cli-kit/node/session'

type ListFlags = OutputFlags<typeof List.flags>

export default class List extends ThemeCommand {
  static description = 'Lists the themes in your store, along with their IDs and statuses.'

  static flags = {
    ...globalFlags,
    ...jsonFlag,
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
    environment: themeFlags.environment,
  }

  static multiEnvironmentsFlags = ['store', 'password']

  async command(flags: ListFlags, adminSession: AdminSession) {
    await list(flags, adminSession)
  }
}
