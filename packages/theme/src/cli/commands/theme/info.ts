import {themeFlags} from '../../flags.js'
import {fetchThemeInfo, fetchDevInfo, formatThemeInfo} from '../../services/info.js'
import ThemeCommand from '../../utilities/theme-command.js'
import {Flags} from '@oclif/core'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {outputResult} from '@shopify/cli-kit/node/output'
import {renderInfo} from '@shopify/cli-kit/node/ui'
import {OutputFlags} from '@oclif/core/lib/interfaces/parser.js'

type InfoFlags = OutputFlags<typeof Info.flags>

export default class Info extends ThemeCommand {
  static description =
    'Displays information about your theme environment, including your current store. Can also retrieve information about a specific theme.'

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    store: themeFlags.store,
    password: themeFlags.password,
    environment: themeFlags.environment,
    development: Flags.boolean({
      char: 'd',
      description: 'Retrieve info from your development theme.',
      env: 'SHOPIFY_FLAG_DEVELOPMENT',
    }),
    theme: Flags.string({
      char: 't',
      description: 'Theme ID or name of the remote theme.',
      env: 'SHOPIFY_FLAG_THEME_ID',
    }),
  }

  static multiEnvironmentsFlags = ['store', 'password']

  async command(flags: InfoFlags, adminSession: AdminSession): Promise<void> {
    if (flags.theme || flags.development) {
      const output = await fetchThemeInfo(adminSession, flags)
      if (!output) {
        throw new AbortError('Theme not found!')
      }

      if (flags.json) {
        return outputResult(JSON.stringify(output, null, 2))
      }

      const formattedInfo = await formatThemeInfo(output, flags)
      renderInfo(formattedInfo)
    } else {
      const infoMessage = await fetchDevInfo({cliVersion: this.config.version})
      renderInfo({customSections: infoMessage})
    }
  }
}
