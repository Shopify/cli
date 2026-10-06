import ThemeCommand from '../../utilities/theme-command.js'
import {fetchThemeInfo, getThemeEnvironmentInfo} from '../../services/info.js'
import {renderThemeInfoResult} from '../../services/info/result.js'
import {themeInfoJsonOutputSchema} from '../../services/info/types.js'
import {themeFlags} from '../../flags.js'
import {Flags} from '@oclif/core'
import {AdminSession} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'
import {globalFlags, jsonFlag} from '@shopify/cli-kit/node/cli'
import {OutputFlags} from '@oclif/core/interfaces'
import {outputResult} from '@shopify/cli-kit/node/output'
import {recordTiming} from '@shopify/cli-kit/node/analytics'
import type {ThemeEnvironmentResult} from '../../services/json-output/schema.js'

type InfoFlags = OutputFlags<typeof Info.flags>

export default class Info extends ThemeCommand {
  static get jsonOutputSchema() {
    return themeInfoJsonOutputSchema
  }

  static descriptionWithMarkdown =
    'Displays information about your theme environment, including your current store. Can also retrieve information about a specific theme.'

  static description = this.descriptionForHelp()

  static flags = {
    ...globalFlags,
    ...jsonFlag,
    ...themeFlags,
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

  async command(flags: InfoFlags, adminSession: AdminSession, multiEnvironment = false) {
    recordTiming('theme-command:info')
    if (flags.theme || flags.development) {
      const output = await fetchThemeInfo(adminSession, flags)
      if (!output) {
        throw new AbortError('Theme not found!')
      }

      if (flags.json && multiEnvironment) {
        recordTiming('theme-command:info')
        return output
      }
      renderThemeInfoResult(output, flags.json ? 'json' : 'text', flags)
    } else {
      const {result, developmentTheme} = getThemeEnvironmentInfo({cliVersion: this.config.version})
      if (flags.json && multiEnvironment) {
        recordTiming('theme-command:info')
        return result
      }
      renderThemeInfoResult(result, flags.json ? 'json' : 'text', {developmentTheme})
    }
    recordTiming('theme-command:info')
  }

  protected collectsEnvironmentResults(flags: {json?: boolean}): boolean {
    return Boolean(flags.json)
  }

  protected renderEnvironmentResults(environments: ThemeEnvironmentResult[]): void {
    outputResult(themeInfoJsonOutputSchema.encode({environments}))
  }
}
