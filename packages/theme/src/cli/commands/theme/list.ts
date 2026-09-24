import {ALLOWED_ROLES, Role} from '../../utilities/theme-selector/fetch.js'
import {themeFlags} from '../../flags.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {list} from '../../services/list.js'
import {renderThemeListResult} from '../../services/list/result.js'
import {themeListJsonOutputSchema} from '../../services/list/types.js'
import {outputResult} from '@shopify/cli-kit/node/output'
import {Flags} from '@oclif/core'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {OutputFlags} from '@oclif/core/interfaces'
import {AdminSession} from '@shopify/cli-kit/node/session'

type ListFlags = OutputFlags<typeof List.flags>

export default class List extends ThemeCommand {
  static get jsonOutputSchema() {
    return themeListJsonOutputSchema
  }

  static descriptionWithMarkdown = 'Lists the themes in your store, along with their IDs and statuses.'

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...themeFlags,
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
  }

  static multiEnvironmentsFlags = ['store', 'password']

  async command(flags: ListFlags, adminSession: AdminSession, multiEnvironment = false) {
    const result = await list(flags, adminSession)
    if (flags.json && multiEnvironment) return result
    renderThemeListResult(result, flags.json ? 'json' : 'text', {
      store: adminSession.storeFqdn,
      environment: flags.environment,
    })
  }

  protected collectsEnvironmentResults(flags: {json?: boolean}): boolean {
    return Boolean(flags.json)
  }

  protected renderEnvironmentResults(environments: {environment: string; result: unknown}[]): void {
    outputResult(themeListJsonOutputSchema.encode(themeListJsonOutputSchema.validate({environments})))
  }
}
